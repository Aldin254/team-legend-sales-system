"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const BENEFITS = [
  { name: "Lunch", amount: "lunch_amount", enabled: "lunch_enabled" },
  { name: "Supper", amount: "supper_amount", enabled: "supper_enabled" },
  { name: "Monday Bonus", amount: "monday_bonus", enabled: "monday_enabled" },
  { name: "Friday Bonus", amount: "friday_bonus", enabled: "friday_enabled" },
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

function validAmount(raw) {
  if (!/^\d+(?:\.\d{1,2})?$/.test(String(raw ?? "").trim())) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value <= 1000000000 ? value : null;
}

// Read-only routing: no duplicate Meals shop pin.
// A FIXED Master shop wins for the Home Shop field. Otherwise,
// use the existing manual Salary shop pin, if supplied by the Salary RPC.
// Today's effective Duty Rota will be resolved by the database
// during the separate automatic expense-posting stage.
function readOnlyRoute(employee, salaryRows, shops) {
  if (!employee) return { name: "Unassigned", type: "", source: "NONE" };

  if (upper(employee.assignment_type) === "FIXED" && employee.shop_id) {
    const shop = shops.find((s) => sameId(s.id, employee.shop_id));
    return {
      name: employee.shop_name || shop?.name || "Fixed shop",
      type: employee.shop_type || shop?.shop_type || "",
      source: "MASTER",
    };
  }

  const salary = salaryRows.find((s) => sameId(s.employee_id, employee.employee_id));
  const manualId = salary?.manual_shop_id || salary?.manual_salary_shop_id;

  if (manualId && upper(salary?.routing_mode) !== "AUTO") {
    const shop = shops.find((s) => sameId(s.id, manualId));
    return {
      name: shop?.name || salary?.manual_shop_name ||
        salary?.manual_salary_shop_name || "Salary-pinned shop",
      type: shop?.shop_type || "",
      source: "SALARY",
    };
  }

  return {
    name: "Unassigned / Duty Rota",
    type: "",
    source: "ROTA",
  };
}

export default function AdminMealsBonusPanel({ user }) {
  const baseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
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
  const [salaryWarning, setSalaryWarning] = useState("");
  const [success, setSuccess] = useState("");

  const rpc = useCallback(async (fn, payload = {}, signal) => {
    if (!baseUrl || !anonKey || !accessToken) {
      throw new Error("Admin session or Supabase configuration is missing.");
    }

    const response = await fetch(`${baseUrl}/rest/v1/rpc/${fn}`, {
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
      throw new Error(result?.message || result?.details || `${fn} failed (${response.status}).`);
    }
    return result;
  }, [baseUrl, anonKey, accessToken]);

  const load = useCallback(async (silent = false, signal) => {
    if (!silent) setLoading(true);
    try {
      const [benefitReply, salaryReply] = await Promise.allSettled([
        rpc("tl_admin_meals_bonus_snapshot", {}, signal),
        rpc("tl_salary_master_admin_list", {}, signal),
      ]);
      if (signal?.aborted) return;
      if (benefitReply.status === "rejected") throw benefitReply.reason;
      const result = benefitReply.value;
      if (result?.ok !== true || !Array.isArray(result.employees) || !Array.isArray(result.shops)) {
        throw new Error("Invalid Meals / Bonus database response.");
      }
      setEmployees(result.employees);
      setShops(result.shops);
      if (salaryReply.status === "fulfilled" && Array.isArray(salaryReply.value)) {
        setSalaryRows(salaryReply.value);
        setSalaryWarning("");
      } else {
        setSalaryRows([]);
        setSalaryWarning("Salary shop routing could not be verified. Please refresh.");
      }
      setError("");
    } catch (err) {
      if (!signal?.aborted) setError(err?.message || "Unable to load employee benefits.");
    } finally {
      if (!silent && !signal?.aborted) setLoading(false);
    }
  }, [rpc]);

  useEffect(() => {
    const controller = new AbortController();
    void load(false, controller.signal);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load(true, controller.signal);
    }, 30000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [load]);

  useEffect(() => {
    if (!employees.length) {
      setSelectedId("");
      setDraft(null);
    } else if (!employees.some((row) => sameId(row.employee_id, selectedId))) {
      setSelectedId(String(employees[0].employee_id));
      setDirty(false);
    }
  }, [employees, selectedId]);

  const employee = useMemo(
    () => employees.find((row) => sameId(row.employee_id, selectedId)) || null,
    [employees, selectedId]
  );

  useEffect(() => {
    if (employee && !dirty) setDraft(makeDraft(employee));
  }, [employee, dirty]);

  const route = useMemo(
    () => readOnlyRoute(employee, salaryRows, shops),
    [employee, salaryRows, shops]
  );
  const autoExempt = upper(route.type) === "24_HOUR";
  const effectiveExempt = autoExempt || draft?.manual_clock_in_exempt === true;

  function chooseEmployee(id) {
    if (dirty && !window.confirm("Discard unsaved changes?")) return;
    const row = employees.find((e) => sameId(e.employee_id, id));
    setSelectedId(id);
    setDraft(makeDraft(row));
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

  async function save() {
    if (!employee || !draft || !dirty || saving) return;
    const amounts = {};
    for (const benefit of BENEFITS) {
      const amount = validAmount(draft[benefit.amount]);
      if (amount === null) {
        setError(`${benefit.name} must be a valid KES amount (up to 2 decimals).`);
        return;
      }
      amounts[benefit.amount] = amount;
    }
    if (reason.trim().length < 2 || reason.trim().length > 500) {
      setError("Enter one reason, between 2 and 500 characters.");
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
      if (result?.ok !== true) throw new Error("Database did not confirm the save.");
      setDirty(false);
      setReason("");
      setSuccess("Changes saved.");
      await load(true);
    } catch (err) {
      setError(err?.message || "Unable to save benefit settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="tmb-root">
      <style>{styles}</style>
      <div className="tmb-heading">MEALS / BONUS CONTROL</div>
      <div className="tmb-body">
        <label className="tmb-label" htmlFor="tmb-employee">SELECT EMPLOYEE — MASTER EMPLOYEE LIST</label>
        <select
          className="tmb-select" id="tmb-employee" value={selectedId}
          onChange={(e) => chooseEmployee(e.target.value)}
          disabled={loading || saving}
        >
          {!employees.length && <option value="">No active employees</option>}
          {employees.map((row) => {
            const r = readOnlyRoute(row, salaryRows, shops);
            return (
              <option key={row.employee_id} value={row.employee_id}>
                {row.full_name} — {r.name} — {r.type || row.job_title || "EMPLOYEE"}
              </option>
            );
          })}
        </select>

        {error && <div className="tmb-error" role="alert">{error}</div>}
        {salaryWarning && <div className="tmb-warning" role="status">{salaryWarning}</div>}
        {success && <div className="tmb-success" role="status">{success}</div>}
        {loading && !employee && <div className="tmb-empty">Loading Master Employees...</div>}

        {employee && draft && (
          <>
            <div className="tmb-identity">
              <div><span>FULL NAME</span><strong>{employee.full_name}</strong></div>
              <div><span>SHOP</span><strong>{route.name}</strong></div>
              <div><span>POSITION / CATEGORY</span><strong>{route.type || employee.job_title || "EMPLOYEE"}</strong></div>
            </div>

            <div className="tmb-benefits">
              {BENEFITS.map((benefit) => (
                <div className="tmb-benefit" key={benefit.amount}>
                  <label htmlFor={`tmb-${benefit.amount}`}>{benefit.name}</label>
                  <div className="tmb-amount-controls">
                    <span>KES</span>
                    <input
                      id={`tmb-${benefit.amount}`}
                      type="number" min="0" max="1000000000" step="0.01"
                      value={draft[benefit.amount]} disabled={saving}
                      onChange={(e) => update(benefit.amount, e.target.value)}
                    />
                    <button
                      type="button" disabled={saving}
                      aria-pressed={draft[benefit.enabled]}
                      className={draft[benefit.enabled] ? "tmb-enabled" : "tmb-disabled"}
                      onClick={() => update(benefit.enabled, !draft[benefit.enabled])}
                    >
                      {draft[benefit.enabled] ? "ENABLED" : "DISABLED"}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="tmb-exemption">
              <div>
                <strong>10:50 AM EXEMPTION</strong>
                <span>{autoExempt ? "24-HOUR SHOP — AUTO EXEMPT" : effectiveExempt ? "EXEMPT" : "STANDARD CUTOFF"}</span>
              </div>
              <button
                type="button"
                disabled={saving || autoExempt}
                aria-pressed={effectiveExempt}
                className={effectiveExempt ? "tmb-enabled" : "tmb-disabled"}
                onClick={() => update("manual_clock_in_exempt", !draft.manual_clock_in_exempt)}
              >
                {autoExempt ? "AUTO EXEMPT" : draft.manual_clock_in_exempt ? "EXEMPT" : "NOT EXEMPT"}
              </button>
            </div>

            <label className="tmb-label" htmlFor="tmb-reason">REASON FOR CHANGES</label>
            <input
              id="tmb-reason" className="tmb-reason" type="text"
              maxLength={500} placeholder="Enter one reason"
              value={reason} disabled={saving}
              onChange={(e) => setReason(e.target.value)}
            />
            <button
              className="tmb-save" type="button" onClick={save}
              disabled={saving || !dirty}
            >
              {saving ? "SAVING..." : "SAVE CHANGES"}
            </button>
          </>
        )}
      </div>
    </section>
  );
}

const styles = `
.tmb-root{width:100%;max-width:970px;font:600 13px Arial,system-ui,sans-serif;color:#f7f9fc}
.tmb-root *{box-sizing:border-box}
.tmb-heading{background:#111c30;color:#f4d075;border:1px solid #9b803e;border-radius:9px 9px 0 0;padding:17px 20px;font-size:18px;font-weight:900}
.tmb-body{display:grid;gap:14px;background:#0b1d32;border:1px solid #9b803e;border-top:0;border-radius:0 0 9px 9px;padding:19px}
.tmb-label{color:#ead18a;font-size:12px;font-weight:900}
.tmb-select,.tmb-reason{width:100%;min-height:43px;background:#172e49;border:1px solid #687d99;color:#fff;border-radius:6px;padding:9px 12px;font-size:13px}
.tmb-select option{background:#172e49;color:#fff}
.tmb-identity{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}
.tmb-identity>div{min-width:0;background:#142940;border:1px solid #435772;border-radius:6px;padding:13px;display:grid;gap:6px}
.tmb-identity span{color:#dfc27b;font-size:10px;font-weight:900}
.tmb-identity strong{overflow-wrap:anywhere;font-size:13px}
.tmb-benefits{border:1px solid #39506b;border-radius:7px;overflow:hidden}
.tmb-benefit{display:grid;grid-template-columns:1fr 1.8fr;align-items:center;gap:12px;background:#10243b;padding:12px 14px}
.tmb-benefit+.tmb-benefit{border-top:1px solid #354b65}
.tmb-benefit label{font-size:15px;font-weight:900;color:#f4d075}
.tmb-amount-controls{display:flex;align-items:center;justify-content:flex-end;gap:9px}
.tmb-amount-controls span{font-size:11px;color:#d8e4f1}
.tmb-amount-controls input{width:140px;min-width:0;min-height:41px;text-align:center;background:#1c344f;border:1px solid #77879a;border-radius:5px;color:#fff;font-size:15px;font-weight:900}
.tmb-amount-controls button,.tmb-exemption button{width:116px;flex-shrink:0;padding:12px 7px;border:0;border-radius:6px;color:#fff;font-size:11px;font-weight:900;cursor:pointer}
.tmb-enabled{background:#12825a}
.tmb-disabled{background:#914446}
.tmb-exemption{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px;background:#142940;border:1px solid #86703f;border-radius:7px}
.tmb-exemption>div{display:grid;gap:6px}
.tmb-exemption strong{color:#f4d075;font-size:13px}
.tmb-exemption span{color:#d9e7f5;font-size:12px}
.tmb-save{background:#127e59;color:#fff;border:0;border-radius:6px;padding:13px 18px;font-size:13px;font-weight:900;cursor:pointer}
.tmb-root button:disabled{opacity:.5;cursor:not-allowed}
.tmb-error,.tmb-warning,.tmb-success{padding:10px;border-radius:6px;font-size:12px}
.tmb-error{background:#572332;border:1px solid #a95c69;color:#ffe1e4}
.tmb-warning{background:#443519;border:1px solid #a48037;color:#ffeca9}
.tmb-success{background:#124232;border:1px solid #2a8b69;color:#b8ffdb}
.tmb-empty{padding:20px;text-align:center}
@media(max-width:660px){
 .tmb-body{padding:12px}.tmb-identity{grid-template-columns:1fr}
 .tmb-benefit{grid-template-columns:1fr;gap:8px}.tmb-amount-controls{justify-content:flex-start}
 .tmb-amount-controls input{width:110px}.tmb-amount-controls button{width:105px}
 .tmb-exemption{flex-wrap:wrap}
}
`;
