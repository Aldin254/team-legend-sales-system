"use client";

import { useCallback, useEffect, useState } from "react";

// TEAM LEGEND — company-wide Kenya holiday bonus settings.
// Stage 1: Admin-only configuration and audit.
// NO EXPENSES ARE POSTED HERE. Posting comes in the next SQL stage.
// Employee-specific Meals/Bonus settings remain untouched.

const formatMoney = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? amount.toLocaleString("en-KE", { maximumFractionDigits: 2 })
    : "0";
};

const moneyInputValid = (value) => /^\d+(?:\.\d{1,2})?$/.test(String(value).trim());

function draftFrom(event) {
  return {
    enabled: event.enabled === true,
    amount: String(event.amount ?? 0),
    greeting: String(event.greeting || `Happy ${event.holiday_name}! 🇰🇪`),
    reason: "",
    dirty: false,
  };
}

function daysUntil(date, today) {
  const start = Date.parse(`${today}T12:00:00Z`);
  const end = Date.parse(`${date}T12:00:00Z`);
  return Number.isFinite(start) && Number.isFinite(end)
    ? Math.round((end - start) / 86400000)
    : null;
}

function displayDate(yyyyMMdd) {
  const timestamp = Date.parse(`${yyyyMMdd}T12:00:00Z`);
  return Number.isFinite(timestamp)
    ? new Intl.DateTimeFormat("en-KE", {
        timeZone: "UTC",
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(timestamp))
    : yyyyMMdd;
}

export default function AdminHolidayEventsPanel({ user }) {
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const token = user?.access_token || "";

  const [events, setEvents] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [today, setToday] = useState("");
  const [employeeCount, setEmployeeCount] = useState(0);
  const [postingConnected, setPostingConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
// Automatically clear success messages after 5 seconds.
useEffect(() => {
  if (!success) return;

  const timer = setTimeout(() => {
    setSuccess("");
  }, 5000);

  return () => clearTimeout(timer);
}, [success]);
  const rpc = useCallback(async (functionName, payload = {}, signal) => {
    if (!url || !anonKey || !token) {
      throw new Error("Admin session or Supabase configuration is missing.");
    }
    const response = await fetch(`${url}/rest/v1/rpc/${functionName}`, {
      method: "POST",
      cache: "no-store",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      ...(signal ? { signal } : {}),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(result?.message || result?.details || `${functionName} failed.`);
    }
    return result;
  }, [url, anonKey, token]);

  const load = useCallback(async (silent = false, signal) => {
    if (!silent) setLoading(true);
    try {
      const result = await rpc("tl_admin_holiday_bonus_snapshot", {}, signal);
      if (signal?.aborted) return;
      if (result?.ok !== true || !Array.isArray(result.events)) {
        throw new Error("Unexpected holiday bonus response.");
      }
      setEvents(result.events);
      setToday(String(result.today || ""));
      setEmployeeCount(Number(result.employee_count || 0));
      setPostingConnected(result.posting_connected === true);
      setDrafts((previous) => {
        const next = {};
        for (const event of result.events) {
          const id = String(event.id);
          next[id] = previous[id]?.dirty ? previous[id] : draftFrom(event);
        }
        return next;
      });
      setError("");
    } catch (err) {
      if (!signal?.aborted) setError(err?.message || "Unable to load holiday events.");
    } finally {
      if (!silent && !signal?.aborted) setLoading(false);
    }
  }, [rpc]);

  useEffect(() => {
    const controller = new AbortController();
    void load(false, controller.signal);
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void load(true, controller.signal);
    }, 30000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [load]);

  function edit(eventId, field, value) {
    const id = String(eventId);
    setDrafts((previous) => ({
      ...previous,
      [id]: { ...previous[id], [field]: value, dirty: true },
    }));
    setSuccess("");
    setError("");
  }

  async function save(event) {
    const id = String(event.id);
    const draft = drafts[id];
    if (!draft?.dirty || savingId) return;
    if (!moneyInputValid(draft.amount) || Number(draft.amount) > 1000000000) {
      setError("Enter a valid holiday amount, up to 2 decimal places.");
      return;
    }
    if (draft.enabled && Number(draft.amount) <= 0) {
      setError("Set a bonus amount greater than zero before enabling.");
      return;
    }
    const greeting = String(draft.greeting || "").trim();
    if (greeting.length < 3 || greeting.length > 140) {
      setError("Holiday greeting must be between 3 and 140 characters.");
      return;
    }
    const reason = String(draft.reason || "").trim();
    if (reason.length < 2 || reason.length > 500) {
      setError("Enter a reason for the changes (2–500 characters).");
      return;
    }

    setSavingId(id);
    setError("");
    setSuccess("");
    try {
      const result = await rpc("tl_admin_holiday_bonus_save", {
        p_event_id: event.id,
        p_enabled: draft.enabled,
        p_amount: Number(draft.amount),
        p_greeting: greeting,
        p_reason: reason,
      });
      if (result?.ok !== true) throw new Error("Holiday settings were not saved.");
      setDrafts((previous) => ({
        ...previous,
        [id]: { ...draft, reason: "", dirty: false },
      }));
      setSuccess(`${event.holiday_name} saved. No expense has been charged.`);
      await load(true);
    } catch (err) {
      setError(err?.message || "Unable to save holiday bonus.");
    } finally {
      setSavingId("");
    }
  }

  return (
    <section className="mbh-panel" aria-label="Kenya holiday bonus settings">
      <style>{css}</style>
      <div className="mbh-heading">
        <div>
          <h2>🇰🇪 Kenya Holiday Events</h2>
        </div>
        <span className="mbh-heading-tag">ADMIN CONTROL</span>
      </div>

      <div className="mbh-meta">
        <span>UPCOMING HOLIDAYS</span>
        <span>ACTIVE MASTER EMPLOYEES: <b>{employeeCount}</b></span>
      </div>

      {error && <div className="mbh-alert mbh-error" role="alert">{error}</div>}
      {success && <div className="mbh-alert mbh-success" role="status">{success}</div>}
      {loading && <div className="mbh-empty">Loading Kenya holidays...</div>}
      {!loading && events.length === 0 && (
        <div className="mbh-empty">
          No scheduled holidays in the next seven days. This Admin panel stays here permanently.
        </div>
      )}

      {events.map((event) => {
        const id = String(event.id);
        const draft = drafts[id] || draftFrom(event);
        const remaining = daysUntil(event.holiday_date, today);
        const disabled = savingId !== "";
        const previewTotal = employeeCount * (Number(draft.amount) || 0);
        return (
          <div className="mbh-event" key={id}>
            <div className="mbh-event-top">
              <div>
                <strong>{event.holiday_name}</strong>
                <span>{displayDate(event.holiday_date)}</span>
              </div>
              <span className="mbh-days">
                {remaining === 0 ? "TODAY" : `${remaining ?? "?"} DAYS LEFT`}
              </span>
            </div>
            <div className="mbh-settings">
              <div className="mbh-field">
                <span>Holiday Bonus — All Employees</span>
                <button
                  type="button"
                  className={`mbh-switch ${draft.enabled ? "mbh-on" : ""}`}
                  role="switch"
                  aria-checked={draft.enabled}
                  disabled={disabled}
                  onClick={() => edit(id, "enabled", !draft.enabled)}
                >
                  <span className="mbh-knob" />
                  {draft.enabled ? "Enabled" : "Disabled"}
                </button>
              </div>
              <label className="mbh-field">
                <span>Amount per employee</span>
                <div className="mbh-money">
                  <span>KES</span>
                  <input
                    type="number"
                    min="0"
                    max="1000000000"
                    step="0.01"
                    value={draft.amount}
                    disabled={disabled}
                    onChange={(e) => edit(id, "amount", e.target.value)}
                  />
                </div>
              </label>
              <label className="mbh-field mbh-greeting-field">
                <span>Holiday greeting</span>
                <input
                  type="text"
                  maxLength={140}
                  value={draft.greeting}
                  disabled={disabled}
                  onChange={(e) => edit(id, "greeting", e.target.value)}
                />
              </label>
            </div>
           <div className="mbh-estimate">
  ESTIMATED COST: <b>KES {formatMoney(previewTotal)}</b>
</div>
           <div className="mbh-preview">
  {draft.enabled ? (
    <>
      <strong>{draft.greeting}</strong>
      <span>KES {formatMoney(draft.amount)}</span>
    </>
  ) : (
    <strong>DISABLED</strong>
  )}
</div>
            <div className="mbh-footer">
              <label>
                Reason for changes
                <input
                  type="text"
                  placeholder="Reason required to save"
                  maxLength={500}
                  value={draft.reason}
                  disabled={disabled}
                  onChange={(e) => edit(id, "reason", e.target.value)}
                />
              </label>
              <button
                type="button"
                className="mbh-save"
                disabled={!draft.dirty || disabled}
                onClick={() => void save(event)}
              >
                {savingId === id ? "Saving..." : "Save Holiday Bonus"}
              </button>
            </div>
          </div>
        );
      })}

      <div className="mbh-notice">
        {postingConnected
          ? "Holiday deductions are handled by the holiday-date posting system, not by this Admin panel."
          : "Stage 1 is settings only: enabling now does not create an expense. The holiday-date posting and cashier visibility will be connected in the next stage."}
      </div>
    </section>
  );
}

const css = `
.mbh-panel{margin-top:20px;background:linear-gradient(145deg,#0c1c30,#0a1729);border:2px solid #d6ae5b;border-radius:14px;padding:19px 22px;color:#edf3fb;font-family:Arial,system-ui,sans-serif}
.mbh-panel *,.mbh-panel *::before,.mbh-panel *::after{box-sizing:border-box}
.mbh-heading{display:flex;justify-content:space-between;align-items:start;gap:12px}
.mbh-heading h2{margin:0;color:#ecc879;font-size:20px;font-weight:900}
.mbh-heading p{margin:6px 0 0;color:#a9bfd4;font-size:12px}
.mbh-heading-tag{white-space:nowrap;font-size:10px;color:#f0d69b;border:1px solid #987b42;border-radius:30px;padding:6px 9px}
.mbh-meta{display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;margin:17px 0 14px;padding:11px;background:#142840;border:1px solid #38506a;border-radius:8px;color:#bed0e0;font-weight:800;letter-spacing:.04em;font-size:11px}
.mbh-meta b{color:#fff}
.mbh-alert{margin:10px 0;border-radius:7px;padding:10px 12px;font-size:12px}
.mbh-error{background:#4b2333;color:#ffe2e8;border:1px solid #ab586b}
.mbh-success{background:#153d32;color:#baffd9;border:1px solid #298660}
.mbh-empty{border:1px dashed #475973;background:#102238;border-radius:8px;padding:18px;color:#bbcbda;font-size:13px}
.mbh-event{background:#101f34;border:1px solid #60718a;border-radius:11px;margin-top:13px;overflow:hidden}
.mbh-event-top{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 17px;background:#172c44;border-bottom:1px solid #485873}
.mbh-event-top>div{display:grid;gap:5px}
.mbh-event-top strong{color:#fff;font-size:16px}
.mbh-event-top>div>span{font-size:11px;color:#b6c8da}
.mbh-days{color:#baf4d9;background:#164235;padding:6px 10px;border-radius:20px;font-size:10px;font-weight:900;white-space:nowrap}
.mbh-settings{display:grid;grid-template-columns:minmax(130px,.7fr) minmax(145px,.7fr) minmax(200px,1.6fr);gap:18px;padding:17px}
.mbh-field{display:grid;align-content:start;gap:10px;min-width:0}
.mbh-field>span,.mbh-footer label{font-size:12px;color:#d4e1ed;font-weight:750}
.mbh-switch{width:132px;height:40px;border:1px solid #798496;border-radius:22px;background:#47566a;color:#fff;display:flex;align-items:center;gap:9px;padding:5px 10px;font-size:11px;cursor:pointer}
.mbh-switch.mbh-on{background:#126d51;border-color:#40c994}
.mbh-knob{background:#fff;width:22px;height:22px;border-radius:50%;flex-shrink:0}
.mbh-money{height:43px;display:flex;align-items:center;border:1px solid #667c94;border-radius:8px;overflow:hidden;background:#091a2f}
.mbh-money span{font-size:11px;padding:0 10px;color:#c3d2e0}
.mbh-money input{flex:1;min-width:0;width:100%;height:100%;border:0;background:transparent;color:#fff;font-size:16px;font-weight:850;text-align:right;padding:7px 10px}
.mbh-field>input,.mbh-footer input{background:#0b1b30;color:#fff;border:1px solid #657b93;border-radius:8px;min-width:0;width:100%;padding:12px;font:inherit;font-size:12px}
.mbh-estimate{border-top:1px solid #364b63;border-bottom:1px solid #364b63;padding:12px 17px;color:#b9cede;font-size:12px}
.mbh-estimate b{color:#a0f4c9}.mbh-estimate span{color:#9eb0bf}
.mbh-preview{background:#14352f;color:#c5ffdf;min-height:52px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;padding:13px 17px;font-size:12px}
.mbh-preview strong{font-size:14px;color:#fff}
.mbh-footer{display:flex;gap:15px;justify-content:space-between;align-items:end;padding:16px 17px}
.mbh-footer label{display:grid;gap:7px;flex:1;min-width:220px}
.mbh-save{background:linear-gradient(125deg,#fff0b5,#edbd5e);border:1px solid #ecc879;color:#1d2130;border-radius:8px;padding:12px 17px;font-size:12px;font-weight:900;cursor:pointer;white-space:nowrap}
.mbh-panel button:disabled,.mbh-panel input:disabled{opacity:.55;cursor:not-allowed}
.mbh-notice{border:1px solid #51627a;border-radius:8px;background:#13253a;color:#aebed2;padding:12px 14px;font-size:11px;margin-top:14px;line-height:1.6}
.mbh-panel input[type="number"]{appearance:textfield;-moz-appearance:textfield}
.mbh-panel input[type="number"]::-webkit-inner-spin-button,.mbh-panel input[type="number"]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
@media(max-width:850px){.mbh-settings{grid-template-columns:repeat(2,minmax(0,1fr))}.mbh-greeting-field{grid-column:1/-1}}
@media(max-width:560px){.mbh-panel{padding:14px}.mbh-settings{grid-template-columns:1fr;padding:13px}.mbh-greeting-field{grid-column:auto}.mbh-event-top{padding:12px}.mbh-footer{flex-direction:column;align-items:stretch;padding:13px}.mbh-footer label{min-width:0}.mbh-meta{font-size:10px}}
`;
