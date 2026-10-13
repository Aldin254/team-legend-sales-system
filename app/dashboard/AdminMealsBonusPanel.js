"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

// TEAM LEGEND — MEALS / BONUS (professional navy + gold layout)
// Design-only replacement: preserves Stage 1 snapshot/save RPCs.
// Master Employee is the source of identity. Salary routing is read-only.
// NO expense postings and NO changes to attendance/bonus eligibility here.

const BENEFITS = [
  { label: "Lunch", amount: "lunch_amount", enabled: "lunch_enabled" },
  { label: "Supper", amount: "supper_amount", enabled: "supper_enabled" },
  { label: "Monday Bonus", amount: "monday_bonus", enabled: "monday_enabled" },
  { label: "Friday Bonus", amount: "friday_bonus", enabled: "friday_enabled" },
];

const upper = (value) => String(value ?? "").trim().toUpperCase();
const sameId = (a, b) => Boolean(a && b && String(a) === String(b));

function makeDraft(row) {
  if (!row) return null;
  return {
    employee_id: row.employee_id,
    lunch_amount: String(row.lunch_amount ?? 0),
    supper_amount: String(row.supper_amount ?? 0),
    monday_bonus: String(row.monday_bonus ?? 0),
    friday_bonus: String(row.friday_bonus ?? 0),
    lunch_enabled: row.lunch_enabled === true,
    supper_enabled: row.supper_enabled === true,
    monday_enabled: row.monday_enabled === true,
    friday_enabled: row.friday_enabled === true,
    manual_clock_in_exempt: row.manual_clock_in_exempt === true,
  };
}

function parseMoney(value) {
  const raw = String(value ?? "").trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) return null;
  const number = Number(raw);
  return Number.isFinite(number) && number <= 1000000000 ? number : null;
}

function money(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "0";
  return amount.toLocaleString("en-KE", { maximumFractionDigits: 2 });
}

function nairobiWeekday() {
  try {
    const weekday = new Intl.DateTimeFormat("en-US", {
      timeZone: "Africa/Nairobi",
      weekday: "long",
    }).format(new Date());
    return weekday.toUpperCase();
  } catch {
    return "";
  }
}

// This is DISPLAY routing, not expense authorization. An employee's
// fixed Master shop displays first. If not fixed, read the existing Salary
// pin (no second pin in Meals). Duty Rota/relief and actual shop attribution
// must be resolved by the authoritative backend at posting time.
function displayRoute(employee, salaries, shops) {
  if (!employee) {
    return { shop: "Unassigned", type: "", source: "NONE" };
  }

  if (upper(employee.assignment_type) === "FIXED" && employee.shop_id) {
    const found = shops.find((shop) => sameId(shop.id, employee.shop_id));
    return {
      shop: employee.shop_name || found?.name || "Fixed shop",
      type: employee.shop_type || found?.shop_type || "",
      source: "MASTER",
    };
  }

  const salary = salaries.find((item) => sameId(item.employee_id, employee.employee_id));
  const manualShopId = salary?.manual_shop_id || salary?.manual_salary_shop_id;

  if (manualShopId && upper(salary?.routing_mode) !== "AUTO") {
    const found = shops.find((shop) => sameId(shop.id, manualShopId));
    return {
      shop: found?.name || salary?.manual_shop_name ||
        salary?.manual_salary_shop_name || "Salary-pinned shop",
      type: found?.shop_type || "",
      source: "SALARY",
    };
  }

  return { shop: "Duty Rota / Unassigned", type: "", source: "ROTA" };
}

function BenefitField({ label, amount, enabled, disabled, onAmount, onEnabled }) {
  return (
    <div className="mb-benefit">
      <div className="mb-benefit-title">{label}</div>
      <button
        type="button"
        className="mb-enable-row"
        role="switch"
        aria-label={`${label} ${enabled ? "enabled" : "disabled"}`}
        aria-checked={enabled}
        disabled={disabled}
        onClick={() => onEnabled(!enabled)}
      >
        <span className={`mb-toggle ${enabled ? "mb-toggle-on" : "mb-toggle-off"}`}>
          <span className="mb-toggle-knob" />
        </span>
        <span>{enabled ? "Enabled" : "Disabled"}</span>
      </button>
      <div className="mb-money-box">
        <span>KSh</span>
        <input
          type="number"
          min="0"
          max="1000000000"
          step="0.01"
          aria-label={`${label} amount in Kenyan shillings`}
          disabled={disabled}
          value={amount}
          onChange={(event) => onAmount(event.target.value)}
        />
      </div>
    </div>
  );
}

export default function AdminMealsBonusPanel({ user }) {
  const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const accessToken = user?.access_token || "";

  const [employees, setEmployees] = useState([]);
  const [shops, setShops] = useState([]);
  const [salaryRows, setSalaryRows] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [routingWarning, setRoutingWarning] = useState("");
  const [success, setSuccess] = useState("");

  const rpc = useCallback(async (functionName, payload = {}, signal) => {
    if (!supabaseUrl || !anonKey || !accessToken) {
      throw new Error("Admin session or Supabase configuration is missing.");
    }
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${functionName}`, {
      method: "POST",
      cache: "no-store",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      ...(signal ? { signal } : {}),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(
        result?.message || result?.details || `${functionName} failed (${response.status}).`
      );
    }
    return result;
  }, [supabaseUrl, anonKey, accessToken]);

  const load = useCallback(async (silent = false, signal) => {
    if (!silent) setLoading(true);
    try {
      const [benefits, salaries] = await Promise.allSettled([
        rpc("tl_admin_meals_bonus_snapshot", {}, signal),
        rpc("tl_salary_master_admin_list", {}, signal),
      ]);
      if (signal?.aborted) return;
      if (benefits.status === "rejected") throw benefits.reason;
      if (benefits.value?.ok !== true ||
          !Array.isArray(benefits.value.employees) ||
          !Array.isArray(benefits.value.shops)) {
        throw new Error("Unexpected Meals / Bonus data format.");
      }

      setEmployees(benefits.value.employees);
      setShops(benefits.value.shops);
      if (salaries.status === "fulfilled" && Array.isArray(salaries.value)) {
        setSalaryRows(salaries.value);
        setRoutingWarning("");
      } else {
        setSalaryRows([]);
        setRoutingWarning("Salary shop routing is temporarily unavailable.");
      }
      setError("");
    } catch (err) {
      if (!signal?.aborted) {
        setError(err?.message || "Unable to load Meals / Bonus.");
      }
    } finally {
      if (!silent && !signal?.aborted) setLoading(false);
    }
  }, [rpc]);

  useEffect(() => {
    const controller = new AbortController();
    void load(false, controller.signal);
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        void load(true, controller.signal);
      }
    }, 30000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [load]);

  useEffect(() => {
    if (employees.length === 0) {
      setSelectedId("");
      setDraft(null);
    } else if (!employees.some((row) => sameId(row.employee_id, selectedId))) {
      setSelectedId(String(employees[0].employee_id));
      setDirty(false);
    }
  }, [employees, selectedId]);

  const employee = useMemo(() => employees.find(
    (row) => sameId(row.employee_id, selectedId)
  ) || null, [employees, selectedId]);

  useEffect(() => {
    if (employee && !dirty) setDraft(makeDraft(employee));
  }, [employee, dirty]);

  const route = useMemo(
    () => displayRoute(employee, salaryRows, shops),
    [employee, salaryRows, shops]
  );
  const autoExempt = upper(route.type) === "24_HOUR";
  const exempt = autoExempt || draft?.manual_clock_in_exempt === true;
  const weekday = nairobiWeekday();
  const dailyBonus = weekday === "MONDAY"
    ? { amount: "monday_bonus", enabled: "monday_enabled" }
    : weekday === "FRIDAY"
      ? { amount: "friday_bonus", enabled: "friday_enabled" }
      : null;

  function chooseEmployee(value) {
    if (dirty && !window.confirm("Discard unsaved changes for this employee?")) return;
    const next = employees.find((row) => sameId(row.employee_id, value));
    setSelectedId(value);
    setDraft(makeDraft(next));
    setDirty(false);
    setReason("");
    setError("");
    setSuccess("");
  }

  function update(field, value) {
    setDraft((current) => current ? { ...current, [field]: value } : current);
    setDirty(true);
    setError("");
    setSuccess("");
  }

  function reset() {
    if (!employee || saving) return;
    setDraft(makeDraft(employee));
    setDirty(false);
    setReason("");
    setError("");
    setSuccess("");
  }

  async function save() {
    if (!employee || !draft || !dirty || saving) return;
    const amounts = {};
    for (const benefit of BENEFITS) {
      const value = parseMoney(draft[benefit.amount]);
      if (value === null) {
        setError(`${benefit.label} must be a valid KSh amount (up to 2 decimals).`);
        return;
      }
      amounts[benefit.amount] = value;
    }
    if (reason.trim().length < 2 || reason.trim().length > 500) {
      setError("Please enter a reason between 2 and 500 characters.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const result = await rpc("tl_admin_meals_bonus_save", {
        p_employee_id: employee.employee_id,
        p_lunch_amount: amounts.lunch_amount,
        p_supper_amount: amounts.supper_amount,
        p_monday_bonus: amounts.monday_bonus,
        p_friday_bonus: amounts.friday_bonus,
        p_lunch_enabled: draft.lunch_enabled,
        p_supper_enabled: draft.supper_enabled,
        p_monday_enabled: draft.monday_enabled,
        p_friday_enabled: draft.friday_enabled,
        p_manual_clock_in_exempt: draft.manual_clock_in_exempt,
        p_reason: reason.trim(),
      });
      if (result?.ok !== true) throw new Error("The database did not confirm Save Changes.");
      setDirty(false);
      setReason("");
      setSuccess("Changes saved.");
      await load(true);
    } catch (err) {
      setError(err?.message || "Unable to save Meals / Bonus.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-page">
      <style>{css}</style>

      <div className="mb-page-heading">
        <h1><span aria-hidden="true">🍴</span> Meals / Bonus</h1>
        <span className="mb-breadcrumb">Home <b>›</b> Meals &amp; Bonus</span>
      </div>

      <section className="mb-panel">
        <h2><span aria-hidden="true">▤</span> Employee Meals &amp; Bonus</h2>
        <div className="mb-sheet">
          <div className="mb-employee-grid">
            <label className="mb-field mb-employee-field" htmlFor="mb-employee">
              <span>Employee</span>
              <select
                id="mb-employee"
                disabled={loading || saving}
                value={selectedId}
                onChange={(event) => chooseEmployee(event.target.value)}
              >
                {employees.length === 0 && <option value="">No active employees</option>}
                {employees.map((row) => {
                  const r = displayRoute(row, salaryRows, shops);
                  return (
                    <option key={row.employee_id} value={row.employee_id}>
                      {row.full_name} — {r.shop}
                    </option>
                  );
                })}
              </select>
            </label>

            <div className="mb-field mb-category">
              <span>Category</span>
              <div className="mb-category-value">
                <span aria-hidden="true">♛</span>
                {route.type || employee?.job_title || "UNASSIGNED"}
              </div>
            </div>
          </div>

          {error && <div className="mb-alert mb-error" role="alert">{error}</div>}
          {routingWarning && <div className="mb-alert mb-warning" role="status">{routingWarning}</div>}
          {success && <div className="mb-alert mb-success" role="status">{success}</div>}
          {loading && !employee && <div className="mb-loading">Loading employees...</div>}

          {employee && draft && (
            <>
              <div className="mb-benefits-grid">
                {BENEFITS.map((item) => (
                  <BenefitField
                    key={item.amount}
                    label={item.label}
                    amount={draft[item.amount]}
                    enabled={draft[item.enabled]}
                    disabled={saving}
                    onAmount={(value) => update(item.amount, value)}
                    onEnabled={(value) => update(item.enabled, value)}
                  />
                ))}

                <div className="mb-exemption">
                  <div className="mb-benefit-title">
                    Exempt <span title="Exempt employees do not need to meet the 10:50 AM clock-in cutoff." aria-label="Clock-in exemption information">ⓘ</span>
                  </div>
                  <select
                    aria-label="Employee clock-in exemption"
                    value={exempt ? "YES" : "NO"}
                    disabled={saving || autoExempt}
                    onChange={(event) => update("manual_clock_in_exempt", event.target.value === "YES")}
                  >
                    <option value="NO">No</option>
                    <option value="YES">Yes</option>
                  </select>
                  {autoExempt && <small>24-hour automatic</small>}
                </div>
              </div>

              <div className="mb-footer">
                <label htmlFor="mb-reason">
                  Reason for changes
                  <input
                    id="mb-reason"
                    type="text"
                    maxLength={500}
                    value={reason}
                    disabled={saving}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Enter a reason to save"
                  />
                </label>
                <div className="mb-actions">
                  <button type="button" className="mb-reset" onClick={reset} disabled={!dirty || saving}>
                    <span aria-hidden="true">↶</span> Reset
                  </button>
                  <button type="button" className="mb-save" onClick={save} disabled={!dirty || saving}>
                    <span aria-hidden="true">▣</span> {saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {employee && draft && (
        <section className="mb-preview">
          <div className="mb-preview-heading">
            <strong><span aria-hidden="true">◉</span> Cashier View Preview</strong>
            <span>Settings preview only</span>
          </div>
          <div className="mb-preview-line">
            <strong>{employee.full_name}</strong>
            <div>Lunch <b>{draft.lunch_enabled ? money(draft.lunch_amount) : "—"}</b></div>
            <div>Supper <b>{draft.supper_enabled ? money(draft.supper_amount) : "—"}</b></div>
            {dailyBonus && (
              <div>Bonus <b>{draft[dailyBonus.enabled] ? money(draft[dailyBonus.amount]) : "—"}</b></div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

const css = `
.mb-page {
  --mb-bg:#071222;
  --mb-navy:#0a172b;
  --mb-navy-soft:#102039;
  --mb-gold:#ecc879;
  --mb-gold-dark:#a8894e;
  --mb-white:#edf3fb;
  --mb-muted:#b8c4d7;
  color:var(--mb-white);
  background:radial-gradient(ellipse at 70% 15%, #142843 0%, #09172a 44%, #071222 100%);
  min-height:calc(100vh - 68px);
  padding:28px 24px 45px;
  margin:-24px;
  width:calc(100% + 48px);
  box-sizing:border-box;
  font-family:Arial,system-ui,sans-serif;
}
.mb-page *, .mb-page *::before, .mb-page *::after {box-sizing:border-box}
.mb-page-heading{display:flex;justify-content:space-between;gap:16px;align-items:center;margin-bottom:19px}
.mb-page-heading h1{margin:0;color:var(--mb-gold);font-size:clamp(24px,3vw,36px);font-weight:900;letter-spacing:.3px;display:flex;gap:14px;align-items:center}
.mb-page-heading h1 span{font-size:28px}
.mb-breadcrumb{color:#bdc7d7;font-size:12px;white-space:nowrap}
.mb-breadcrumb b{font-size:17px;color:#667994;padding:0 5px}
.mb-panel{border:2px solid #d6ae5b;border-radius:14px;background:rgba(7,17,31,.66);padding:20px 22px 17px;box-shadow:0 16px 35px rgba(0,0,0,.16)}
.mb-panel h2{margin:0 0 14px;color:var(--mb-gold);font-size:19px;font-weight:900;display:flex;gap:12px;align-items:center}
.mb-panel h2 span{font-size:24px}
.mb-sheet{border:1px solid #997a46;border-radius:11px;background:linear-gradient(140deg,rgba(23,36,57,.97),rgba(13,25,44,.98));overflow:hidden}
.mb-employee-grid{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(190px,.65fr);gap:28px;align-items:end;padding:20px 22px}
.mb-field{display:grid;gap:9px;min-width:0}
.mb-field>span{font-size:12px;color:#ced8e8;font-weight:700}
.mb-employee-field select, .mb-category-value{min-height:43px;border:1px solid #72829a;border-radius:8px;color:#f1f6ff;background:#0d1b31;padding:10px 13px;font-size:14px;font-weight:750;width:100%}
.mb-employee-field select{cursor:pointer}
.mb-employee-field select option{background:#0d1b31;color:#fff}
.mb-category-value{border-color:#957941;background:linear-gradient(90deg,#28291f,#202738);color:#f4d17a;display:flex;align-items:center;gap:12px;overflow-wrap:anywhere}
.mb-category-value>span{font-size:19px}
.mb-alert{margin:0 22px 14px;border-radius:6px;padding:10px 12px;font-size:12px}
.mb-error{background:#502331;border:1px solid #a95668;color:#ffe2e8}
.mb-warning{background:#49391b;border:1px solid #977941;color:#ffedbf}
.mb-success{background:#153f33;border:1px solid #298660;color:#bdffdb}
.mb-loading{text-align:center;padding:25px;color:var(--mb-muted)}
.mb-benefits-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr)) minmax(150px,.96fr);border-top:1px solid #35445e;padding:20px 21px 22px;gap:15px;align-items:start}
.mb-benefit{min-width:0}
.mb-benefit-title{font-size:13px;color:#e8edf6;font-weight:900;margin:0 0 12px;white-space:nowrap}
.mb-enable-row{display:flex;gap:9px;align-items:center;background:none;border:0;color:#dbe4f1;font-size:11px;padding:0;margin:0 0 15px;cursor:pointer;white-space:nowrap}
.mb-toggle{width:41px;height:23px;border-radius:16px;position:relative;border:1px solid rgba(255,255,255,.26);flex-shrink:0;transition:background .14s ease}
.mb-toggle-on{background:#16a34a}
.mb-toggle-off{background:#777f91}
.mb-toggle-knob{position:absolute;top:2px;left:2px;width:17px;height:17px;border-radius:50%;background:white;box-shadow:0 1px 4px rgba(0,0,0,.3);transition:transform .14s ease}
.mb-toggle-on .mb-toggle-knob{transform:translateX(18px)}
.mb-money-box{height:44px;display:flex;align-items:center;border:1px solid #5f708b;border-radius:8px;background:#0a192e;overflow:hidden;min-width:0}
.mb-money-box span{padding-left:10px;color:#b9c5d8;font-size:11px;white-space:nowrap}
.mb-money-box input{width:100%;min-width:0;height:100%;background:transparent;border:0;outline:0;color:#f8fafc;font-weight:900;font-size:16px;text-align:center;padding:0 4px}
.mb-money-box:focus-within{outline:2px solid #b89755;outline-offset:1px}
.mb-exemption{border-left:1px solid #596781;padding-left:16px;align-self:stretch;min-width:0}
.mb-exemption .mb-benefit-title{display:flex;align-items:center;gap:5px}
.mb-exemption .mb-benefit-title span{color:#a4b4ce;font-size:12px;cursor:help}
.mb-exemption select{margin-top:1px;width:100%;min-height:43px;background:#0d1c32;color:#eaf4ff;border:1px solid #697a95;border-radius:8px;padding:9px 10px;font-size:14px;font-weight:750;cursor:pointer}
.mb-exemption small{display:block;color:#d7bc7d;font-size:10px;margin-top:8px}
.mb-footer{border-top:1px solid #35445e;padding:17px 21px;display:flex;flex-wrap:wrap;gap:15px;justify-content:space-between;align-items:end}
.mb-footer label{display:grid;gap:6px;min-width:min(280px,100%);flex:1;font-size:11px;color:#cfdae8;font-weight:750}
.mb-footer input{background:#0c1c32;border:1px solid #61738e;border-radius:7px;color:#fff;padding:10px 12px;min-height:41px;font-size:12px;max-width:500px}
.mb-actions{display:flex;align-items:center;gap:10px;margin-left:auto}
.mb-actions button{border-radius:8px;min-height:44px;font-size:12px;font-weight:900;cursor:pointer;padding:10px 16px;white-space:nowrap}
.mb-actions button span{font-size:17px;vertical-align:-1px;margin-right:4px}
.mb-reset{color:#e2e9f4;border:1px solid #687791;background:#11213a}
.mb-save{background:linear-gradient(135deg,#fff0b5,#edbd5e);border:1px solid #f0cc75;color:#151b27;box-shadow:0 3px 12px rgba(230,177,77,.15)}
.mb-page button:disabled,.mb-page select:disabled,.mb-page input:disabled{opacity:.52;cursor:not-allowed}
.mb-preview{border:1px solid #32445e;border-radius:11px;background:rgba(16,32,55,.7);padding:17px 19px;margin-top:18px}
.mb-preview-heading{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}
.mb-preview-heading strong{color:var(--mb-gold);font-size:17px}
.mb-preview-heading strong span{margin-right:9px;font-size:21px}
.mb-preview-heading>span{color:#98a9be;font-size:11px}
.mb-preview-line{display:flex;flex-wrap:wrap;align-items:center;gap:12px 30px;min-height:55px;border:1px solid #41634f;background:linear-gradient(90deg,#193c38,#0f302d);border-radius:8px;padding:13px 21px}
.mb-preview-line>strong{color:#f0dfaa;font-size:15px;flex:2;min-width:180px}
.mb-preview-line>div{color:#d5e9e2;font-size:13px;display:flex;align-items:center;gap:10px;white-space:nowrap}
.mb-preview-line b{color:#71e5a0;font-size:19px}
@media(max-width:1100px){
  .mb-employee-grid{gap:15px}
  .mb-benefits-grid{gap:10px;padding:17px 13px;grid-template-columns:repeat(4,minmax(0,1fr)) minmax(110px,.9fr)}
  .mb-exemption{padding-left:10px}
  .mb-enable-row{gap:5px}
  .mb-benefit-title{font-size:12px}
  .mb-money-box span{padding-left:6px}
}
@media(max-width:870px){
  .mb-benefits-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:19px}
  .mb-exemption{border-left:0;border-top:1px solid #485876;padding-left:0;padding-top:16px;grid-column:1/-1}
  .mb-exemption select{max-width:230px}
  .mb-employee-grid{grid-template-columns:1fr 1fr}
}
@media(max-width:600px){
  .mb-page{padding:20px 13px 28px}
  .mb-page-heading{align-items:flex-start}
  .mb-breadcrumb{display:none}
  .mb-panel{padding:13px 10px}
  .mb-panel h2{font-size:16px}
  .mb-employee-grid{grid-template-columns:1fr;padding:14px;gap:12px}
  .mb-benefits-grid{padding:17px 12px;gap:17px}
  .mb-benefit-title{white-space:normal}
  .mb-enable-row{font-size:10px}
  .mb-money-box input{font-size:14px}
  .mb-exemption{grid-column:1/-1}
  .mb-footer{padding:14px}
  .mb-footer label{min-width:100%}
  .mb-footer input{max-width:none}
  .mb-actions{width:100%;margin-left:0;justify-content:flex-end}
  .mb-actions button{font-size:11px}
  .mb-preview{padding:14px}
  .mb-preview-heading strong{font-size:14px}
  .mb-preview-line{gap:12px 16px;padding:13px}
  .mb-preview-line>strong{min-width:100%}
}
`;
