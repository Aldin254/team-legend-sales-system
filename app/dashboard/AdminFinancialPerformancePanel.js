"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

// TEAM LEGEND / NYIKA — ADMIN FINANCIAL PERFORMANCE
// Read-only. Uses one secured Admin RPC; never loads full banking history
// into the browser and never changes Cashier / Accountant calculations.

const MONEY = new Intl.NumberFormat("en-KE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function kes(value) {
  const n = Number(value ?? 0);
  return `KES ${MONEY.format(Number.isFinite(n) ? n : 0)}`;
}

function dateInNairobi() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const value = (type) => parts.find((p) => p.type === type)?.value || "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function utcDate(iso) { return new Date(`${iso}T12:00:00Z`); }
function isoDay(d) { return d.toISOString().slice(0, 10); }
function addDays(date, numberOfDays) {
  const d = utcDate(date);
  d.setUTCDate(d.getUTCDate() + numberOfDays);
  return isoDay(d);
}
function mondayOf(date) {
  const d = utcDate(date);
  const offset = (d.getUTCDay() + 6) % 7;
  return addDays(date, -offset);
}
function endOfMonth(yearMonth) {
  const [year, month] = yearMonth.split("-").map(Number);
  return isoDay(new Date(Date.UTC(year, month, 0, 12)));
}
function reportingDates(mode, weeks, month) {
  const today = dateInNairobi();
  const monday = mondayOf(today);
  const year = today.slice(0, 4);
  if (mode === "weeks") {
    const count = Math.min(52, Math.max(1, Number(weeks) || 1));
    return {
      start: addDays(monday, -(count - 1) * 7),
      end: addDays(monday, 6),
      label: `Last ${count} week${count === 1 ? "" : "s"} (including this week)`,
    };
  }
  if (mode === "this_month") {
    return { start: `${today.slice(0, 7)}-01`, end: endOfMonth(today.slice(0, 7)), label: "This month" };
  }
  if (mode === "month") {
    const selected = /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : today.slice(0, 7);
    return { start: `${selected}-01`, end: endOfMonth(selected), label: selected };
  }
  if (mode === "year") {
    return { start: `${year}-01-01`, end: `${year}-12-31`, label: `Year ${year}` };
  }
  return { start: monday, end: addDays(monday, 6), label: "This week" };
}

function Metric({ label, value, tone = "gold" }) {
  return (
    <div className={`tlfp-metric tlfp-${tone}`}>
      <small>{label}</small>
      <strong>{kes(value)}</strong>
    </div>
  );
}

function CountBadge({ children }) {
  return <span className="tlfp-count">{children}</span>;
}

function TableSection({ title, subtitle, children }) {
  return (
    <section className="tlfp-panel">
      <div className="tlfp-panel-header">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <span className="tlfp-readonly">READ ONLY</span>
      </div>
      <div className="tlfp-table-wrap">{children}</div>
    </section>
  );
}

export default function AdminFinancialPerformancePanel({ user }) {
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const token = user?.access_token || "";

  const [period, setPeriod] = useState("this_week");
  const [weeks, setWeeks] = useState("4");
  const [selectedMonth, setSelectedMonth] = useState(() => dateInNairobi().slice(0, 7));
  const [refreshVersion, refresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const dates = useMemo(
    () => reportingDates(period, weeks, selectedMonth),
    [period, weeks, selectedMonth]
  );

  const load = useCallback(async (signal) => {
    if (!url || !key || !token) {
      throw new Error("Admin session or Supabase connection is missing.");
    }
    const response = await fetch(
      `${url}/rest/v1/rpc/tl_admin_financial_performance_snapshot`,
      {
        method: "POST", cache: "no-store", signal,
        headers: {
          apikey: key,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_start_date: dates.start,
          p_end_date: dates.end,
        }),
      }
    );
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(
        data?.message || data?.details ||
        `Unable to retrieve financial rankings (${response.status}).`
      );
    }
    if (!Array.isArray(data?.employees) || !Array.isArray(data?.shops)) {
      throw new Error("Unexpected financial reporting response.");
    }
    return data;
  }, [url, key, token, dates.start, dates.end]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setResult(null);
    load(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setResult(data);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message || "Unable to load rankings.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [load, refreshVersion]);

  const shops = useMemo(() => result?.shops || [], [result]);
  const employees = useMemo(() => result?.employees || [], [result]);
  const floatRanking = useMemo(
    () => [...shops].sort((a, b) =>
      Number(b.float_balance_to_date || 0) - Number(a.float_balance_to_date || 0) ||
      String(a.shop_name).localeCompare(String(b.shop_name))
    ),
    [shops]
  );

  const totals = useMemo(() => ({
    banked: employees.reduce((s, e) => s + Number(e.banked_kes || 0), 0),
    sales: shops.reduce((s, e) => s + Number(e.platform_sales || 0), 0),
    profit: shops.reduce((s, e) => s + Number(e.net_performance || 0), 0),
    float: shops.reduce((s, e) => s + Number(e.float_balance_to_date || 0), 0),
    open: shops.reduce((s, e) => s + Number(e.open_shift_count || 0), 0),
    manual: shops.reduce((s, e) => s + Number(e.manual_shift_count || 0), 0),
  }), [shops, employees]);

  const currentYear = dateInNairobi().slice(0, 4);
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, "0");
    const label = new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" })
      .format(new Date(Date.UTC(Number(currentYear), i, 1)));
    return { value: `${currentYear}-${month}`, label: `${label} ${currentYear}` };
  });

  return (
    <section className="tlfp-root">
      <style>{css}</style>
      <div className="tlfp-heading">
        <div>
          <div className="tlfp-eyebrow">TEAM LEGEND / NYIKA</div>
          <h1>FINANCIAL PERFORMANCE</h1>
          <p>Employee banking · shop performance · company float position</p>
        </div>
        <span className="tlfp-admin">ADMIN ONLY</span>
      </div>

      <div className="tlfp-filters">
        <label>
          REPORTING PERIOD
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="this_week">This Week</option>
            <option value="weeks">Choose Number of Weeks</option>
            <option value="this_month">This Month</option>
            <option value="month">Choose Month</option>
            <option value="year">This Year</option>
          </select>
        </label>
        {period === "weeks" && (
          <label>
            WEEKS (INCLUDING CURRENT)
            <select value={weeks} onChange={(e) => setWeeks(e.target.value)}>
              {[1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 26, 52].map((n) => (
                <option key={n} value={String(n)}>{n} week{n === 1 ? "" : "s"}</option>
              ))}
            </select>
          </label>
        )}
        {period === "month" && (
          <label>
            SELECT MONTH
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
              {monthOptions.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>
        )}
        <div className="tlfp-daterange">
          <small>SELECTED DATES</small>
          <strong>{dates.start} — {dates.end}</strong>
        </div>
        <button type="button" onClick={() => refresh((v) => v + 1)} disabled={loading}>
          {loading ? "LOADING..." : "REFRESH"}
        </button>
      </div>

      {error && <div className="tlfp-error" role="alert">{error}</div>}
      {loading && <div className="tlfp-loading">Calculating rankings from Supabase...</div>}

      {!loading && result && (
        <>
          <p className="tlfp-context">
            {dates.label} · Results through {result.as_of_date || dates.end} (Nairobi time)
          </p>
          <div className="tlfp-metrics">
            <Metric label="CONFIRMED BANKING" value={totals.banked} tone="teal" />
            <Metric label="PLATFORM SALES" value={totals.sales} />
            <Metric label="NET SHOP PERFORMANCE" value={totals.profit} tone="teal" />
            <Metric label="COMPANY FLOAT BALANCE TO DATE" value={totals.float} />
          </div>

          {(totals.open > 0 || totals.manual > 0 ||
            Number(result.audit?.completed_sends_missing_float_entry || 0) > 0 ||
            Number(result.audit?.completed_returns_missing_expense || 0) > 0) && (
            <div className="tlfp-warning" role="status">
              {totals.open > 0 && <div>{totals.open} open / unfinished shift(s) — performance may still change.</div>}
              {totals.manual > 0 && <div>{totals.manual} shift(s) have Admin manual totals.</div>}
              {Number(result.audit?.completed_sends_missing_float_entry || 0) > 0 &&
                <div>{result.audit.completed_sends_missing_float_entry} completed send(s) lack a matching company-float entry; check the transfer ledger.</div>}
              {Number(result.audit?.completed_returns_missing_expense || 0) > 0 &&
                <div>{result.audit.completed_returns_missing_expense} completed return(s) lack matching return expenses; these returns count toward company float but cannot be excluded from recorded shop expenses.</div>}
            </div>
          )}

          <TableSection title="01 / EMPLOYEE BANKING RANKING" subtitle="Highest to lowest · confirmed BANKING PAYMENT ledger only">
            <table>
              <thead><tr>
                <th>RANK</th><th>EMPLOYEE</th><th>PAYMENTS</th><th className="numeric">TOTAL BANKED</th>
              </tr></thead>
              <tbody>
                {employees.length === 0 ? (
                  <tr><td colSpan={4} className="tlfp-empty">No employee records available.</td></tr>
                ) : employees.map((e, i) => (
                  <tr key={e.employee_id || i}>
                    <td><CountBadge>{i + 1}</CountBadge></td>
                    <td><strong>{e.employee_name || "Unmapped employee"}</strong>
                      {e.employment_status === "LEGACY/UNMAPPED" &&
                        <small className="tlfp-minor">Legacy / unmapped owner</small>}
                    </td>
                    <td>{e.payment_count}</td>
                    <td className="numeric emphasis">{kes(e.banked_kes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableSection>

          <TableSection title="02 / SHOP PERFORMANCE RANKING" subtitle="Platform sales − (all recorded expenses − completed company-return principal)">
            <table>
              <thead><tr>
                <th>RANK</th><th>SHOP</th><th className="numeric">PLATFORM SALES</th>
                <th className="numeric">ALL EXPENSES</th><th className="numeric">RETURNS EXCLUDED</th>
                <th className="numeric">ADJUSTED EXPENSES</th><th className="numeric">NET PERFORMANCE</th>
              </tr></thead>
              <tbody>
                {shops.length === 0 ? (
                  <tr><td colSpan={7} className="tlfp-empty">No shop records available.</td></tr>
                ) : shops.map((s, i) => (
                  <tr key={s.shop_id}>
                    <td><CountBadge>{i + 1}</CountBadge></td>
                    <td><strong>{s.shop_name}</strong><small className="tlfp-minor">{s.shop_type} · {s.shift_count} shifts</small></td>
                    <td className="numeric">{kes(s.platform_sales)}</td>
                    <td className="numeric">{kes(s.all_expenses)}</td>
                    <td className="numeric">{kes(s.excluded_return_principal)}</td>
                    <td className="numeric">{kes(s.adjusted_expenses)}</td>
                    <td className={`numeric emphasis ${Number(s.net_performance) < 0 ? "negative" : "positive"}`}>
                      {kes(s.net_performance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableSection>

          <TableSection title="03 / COMPANY FLOAT POSITION" subtitle="Company float received − all completed cash returns · negative balance allowed">
            <table>
              <thead><tr>
                <th>RANK</th><th>SHOP</th><th className="numeric">FLOAT IN PERIOD</th>
                <th className="numeric">SENT IN PERIOD</th><th className="numeric">PERIOD NET</th>
                <th className="numeric">RECEIVED TO DATE</th><th className="numeric">SENT TO DATE</th>
                <th className="numeric">BALANCE TO DATE</th>
              </tr></thead>
              <tbody>
                {floatRanking.length === 0 ? (
                  <tr><td colSpan={8} className="tlfp-empty">No shop records available.</td></tr>
                ) : floatRanking.map((s, i) => {
                  const amount = Number(s.float_balance_to_date || 0);
                  return (
                    <tr key={s.shop_id}>
                      <td><CountBadge>{i + 1}</CountBadge></td>
                      <td><strong>{s.shop_name}</strong>
                        <small className="tlfp-minor">{amount > 0 ? "RECEIVED MORE" : amount < 0 ? "SENT MORE" : "BALANCED"}</small>
                      </td>
                      <td className="numeric">{kes(s.float_received_period)}</td>
                      <td className="numeric">{kes(s.sent_to_company_period)}</td>
                      <td className="numeric">{kes(s.float_movement_period)}</td>
                      <td className="numeric">{kes(s.float_received_to_date)}</td>
                      <td className="numeric">{kes(s.sent_to_company_to_date)}</td>
                      <td className={`numeric emphasis ${amount > 0 ? "negative" : "positive"}`}>
                        {kes(amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableSection>

          <p className="tlfp-footnote">
            Rankings are read-only. Company float balances include all recorded history through the selected period end.
            Only the principal of linked, completed cashier-to-company return expenses is excluded from shop performance;
            transaction fees remain in expenses. Inactive shops and employees remain visible for historical accuracy.
          </p>
        </>
      )}
    </section>
  );
}

const css = `
.tlfp-root { background:#061526;color:#edf5ff;border:1px solid #173e61;border-radius:13px;
  padding:16px;font-family:Inter,ui-sans-serif,system-ui,sans-serif;font-size:13px; }
.tlfp-root * {box-sizing:border-box}
.tlfp-heading {display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;
  border-bottom:1px solid #35516e;padding-bottom:14px;margin-bottom:15px}
.tlfp-eyebrow {color:#97acc5;font-size:10px;letter-spacing:2px;font-weight:900}
.tlfp-heading h1 {font-size:clamp(19px,3vw,26px);line-height:1.2;color:#ffdc75;margin:5px 0}
.tlfp-heading p {margin:0;color:#b2c5da;font-size:12px}
.tlfp-admin,.tlfp-readonly {font-weight:850;color:#ffda76;border:1px solid #977a3a;
  border-radius:7px;padding:8px 10px;font-size:10px;white-space:nowrap}
.tlfp-filters {background:#0b243c;border:1px solid #35516e;border-radius:10px;padding:13px;
  display:flex;align-items:end;gap:12px;flex-wrap:wrap}
.tlfp-filters label {display:flex;flex-direction:column;gap:6px;min-width:180px;color:#c5d5e6;font-size:10px;font-weight:900}
.tlfp-filters select {background:#071a2d;color:#f7fbff;border:1px solid #a58a48;
  border-radius:7px;min-height:42px;padding:9px 12px;font-size:12px;font-weight:750}
.tlfp-daterange {display:flex;flex-direction:column;gap:7px;padding:0 8px 5px}
.tlfp-daterange small{font-size:10px;color:#b4c9df;font-weight:900}
.tlfp-daterange strong{font-size:12px;color:#ffdc75;white-space:nowrap}
.tlfp-filters button {background:#ad8738;color:#071626;border:0;border-radius:7px;min-height:42px;
  padding:10px 18px;font-weight:900;font-size:12px;cursor:pointer;margin-left:auto}
.tlfp-filters button:disabled{opacity:.55;cursor:default}
.tlfp-context{color:#bfccdc;font-size:12px;margin:13px 1px}
.tlfp-metrics {display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:16px 0}
.tlfp-metric{display:grid;gap:8px;padding:15px;min-width:0;border-radius:9px;
  background:linear-gradient(115deg,#3b301e,#1a2430);border:1px solid #9a7833}
.tlfp-metric.tlfp-teal{background:linear-gradient(115deg,#0b423d,#0a2835);border-color:#198372}
.tlfp-metric small{font-size:10px;font-weight:900;color:#d4deeb;letter-spacing:.3px}
.tlfp-metric strong{font-size:clamp(17px,2vw,24px);color:#ffdd78;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}
.tlfp-metric.tlfp-teal strong{color:#78e8b6}
.tlfp-panel{border:1px solid #c19d45;border-radius:10px;background:#0a2036;overflow:hidden;margin-top:16px}
.tlfp-panel-header{display:flex;justify-content:space-between;align-items:center;gap:10px;
  flex-wrap:wrap;padding:14px;border-bottom:1px solid #435b75}
.tlfp-panel-header h2{margin:0;color:#ffdc75;font-size:clamp(14px,2vw,19px);font-weight:900}
.tlfp-panel-header p{margin:5px 0 0;color:#b5c8dc;font-size:11px;font-weight:500}
.tlfp-table-wrap{width:100%;overflow-x:auto;max-height:560px;overflow-y:auto}
.tlfp-root table{border-collapse:collapse;width:100%;min-width:680px;font-size:12px}
.tlfp-root thead th{position:sticky;top:0;z-index:1;background:#133955;color:#e2edf8;
  padding:12px 11px;text-align:left;white-space:nowrap;font-size:10px;letter-spacing:.4px}
.tlfp-root tbody td{padding:11px;border-top:1px solid #294766;color:#e6eff9;white-space:nowrap}
.tlfp-root tbody tr:nth-child(even){background:#0d2942}
.tlfp-root tbody tr:hover{background:#133953}
.tlfp-root tbody td strong{font-weight:850}
.tlfp-root .numeric{text-align:right;font-variant-numeric:tabular-nums}
.tlfp-root .emphasis{color:#ffdc75;font-weight:900}
.tlfp-root .emphasis.negative{color:#ff9b9b}
.tlfp-root .emphasis.positive{color:#78e8b6}
.tlfp-count {display:inline-flex;align-items:center;justify-content:center;background:#153953;
  border:1px solid #507392;color:#ffdc75;border-radius:50%;height:30px;min-width:30px;font-weight:900}
.tlfp-minor{display:block;color:#9eb6ca;font-size:10px;margin-top:4px}
.tlfp-empty{text-align:center;color:#b8c9dc;padding:22px!important}
.tlfp-warning{background:#46311d;border:1px solid #aa8032;border-radius:8px;color:#ffe4b0;
  margin:12px 0;padding:12px;display:grid;gap:6px;font-size:12px}
.tlfp-error{background:#4b202c;border:1px solid #d46477;color:#ffe1e6;border-radius:8px;padding:14px;margin:14px 0}
.tlfp-loading{padding:38px 15px;color:#c5d8e8;text-align:center}
.tlfp-footnote{font-size:11px;line-height:1.6;color:#a9bfd2;margin:15px 2px 2px}
@media(max-width:1000px){.tlfp-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:580px){.tlfp-root{padding:9px}.tlfp-metrics{grid-template-columns:1fr 1fr;gap:7px}
 .tlfp-metric{padding:10px}.tlfp-metric strong{font-size:17px}
 .tlfp-filters label{min-width:100%;}.tlfp-daterange{padding:0 0 5px}
 .tlfp-filters button{margin-left:0;width:100%}}
`;
