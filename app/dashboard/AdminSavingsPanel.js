"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// TEAM LEGEND / NYIKA — ADMIN SAVINGS / BANKING
// Banking and shop payment totals remain read-only.
// Employee shop routing is controlled by Admin Salary Management.
// Confirmed Banking payments use the approved PAYMENT ledger.
// SAVE and PAYMENT are separate to prevent double counting.

const REFRESH_MS = 10000;

const PERIODS = [
  ["this_week", "This Week"],
  ["last_week", "Last Week"],
  ["this_month", "This Month"],
];

const ELECTRICITY_PERIODS = [
  ["this_week", "This Week"],
  ["this_month", "This Month"],
  ["last_month", "Last Month"],
];

const PAYMENT_CATEGORIES = [
  { key: "WIFI", label: "WiFi" },
  { key: "DSTV", label: "DStv" },
  { key: "RENT", label: "Rent" },
  { key: "ELECTRICITY", label: "Electricity" },
];

// ==================================================
// DATE AND MONEY HELPERS
// ==================================================

function dateKey(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (key) => parts.find((p) => p.type === key)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function localTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function displayDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function periodBounds(period) {
  const today = dateKey(new Date());
  const d = new Date(`${today}T12:00:00Z`);
  const key = (value) => value.toISOString().slice(0, 10);
  const mondayOffset = (d.getUTCDay() + 6) % 7;
  const weekStart = new Date(d);
  weekStart.setUTCDate(d.getUTCDate() - mondayOffset);

  if (period === "this_month") {
    return [`${today.slice(0, 7)}-01`, today];
  }

  if (period === "last_month") {
    const first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1));
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0));
    return [key(first), key(last)];
  }

  if (period === "last_week") {
    const first = new Date(weekStart);
    first.setUTCDate(first.getUTCDate() - 7);
    const last = new Date(weekStart);
    last.setUTCDate(last.getUTCDate() - 1);
    return [key(first), key(last)];
  }

  const sunday = new Date(weekStart);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  return [key(weekStart), key(sunday)];
}

function withinPeriod(value, period) {
  const key = dateKey(value);
  const [start, end] = periodBounds(period);
  return Boolean(key && key >= start && key <= end);
}

function money(value) {
  const numeric = Number(value ?? 0);
  return (Number.isFinite(numeric) ? numeric : 0).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function upper(value) {
  return String(value ?? "").trim().toUpperCase();
}

function sameId(a, b) {
  return Boolean(a && b && String(a) === String(b));
}

function monthKey(period) {
  const now = dateKey(new Date());
  if (period === "last_month") {
    const [year, month] = now.split("-").map(Number);
    return new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7);
  }
  return now.slice(0, 7);
}

function categoryOf(row) {
  return upper(row?.category);
}

function paymentDate(row) {
  return row?.confirmed_at || null;
}

function isConfirmed(row) {
  return upper(row?.status) === "CONFIRMED" && !!paymentDate(row);
}

// ==================================================
// MASTER EMPLOYEE LABELS — KEEP EXISTING ROUTING
// ==================================================

function labelForPerson(row, shops, dutyRows, salaryRows) {
  const name = row.full_name || "Employee";
  const salary = salaryRows.find((r) => sameId(r.employee_id, row.employee_id));
  const mode = upper(salary?.routing_mode);
  const manualId = salary?.manual_shop_id || salary?.manual_salary_shop_id;

  if (manualId && mode !== "AUTO") {
    const selectedShop = shops.find((s) => sameId(s.id || s.shop_id, manualId));
    const shopName =
      salary?.manual_shop_name ||
      salary?.manual_salary_shop_name ||
      selectedShop?.shop_name ||
      selectedShop?.name ||
      "MANUAL SHOP";
    return `${shopName} — ${name}`;
  }

  const duty = dutyRows.find((r) => sameId(r.employee_id, row.employee_id));
  if (duty?.effective_status === "ON_DUTY" && duty.effective_shop_name) {
    return `${duty.effective_shop_name} — ${name}`;
  }

  const shop = shops.find((s) => sameId(s.id || s.shop_id, row.shop_id));
  const storedName = String(row.shop_name || "").trim();
  const nameValid = !["", "UNASSIGNED", "NOT FIXED", "NO SHOP ASSIGNED"].includes(
    upper(storedName)
  );
  const fixedName = nameValid ? storedName : shop?.shop_name || shop?.name;

  if (fixedName) return `${fixedName} — ${name}`;
  if (upper(row.assignment_type) === "NOT_FIXED") return `RELIEF — ${name}`;
  if (upper(row.job_title) === "TEAM_LEADER") return `TEAM LEADER — ${name}`;
  if (upper(row.job_title) === "ACCOUNTANT") return `ACCOUNTANT — ${name}`;
  return `UNASSIGNED — ${name}`;
}

function buildTodayDuty(masterEmployees, shops, shifts, reliefRows, today) {
  const employeesById = new Map(
    masterEmployees.map((e) => [String(e.employee_id), e])
  );
  const shopsById = new Map(
    shops.map((s) => [String(s.id || s.shop_id), s])
  );
  const dutyById = new Map();

  const put = (employeeId, shopName, source, status = "ON_DUTY") => {
    if (!employeeId || !shopName) return;
    const key = String(employeeId);
    if (dutyById.has(key) && status === "ON_DUTY") return;
    dutyById.set(key, {
      employee_id: employeeId,
      effective_shop_name: shopName,
      duty_source: source,
      effective_status: status,
    });
  };

  for (const shift of shifts) {
    if (String(shift.duty_date).slice(0, 10) !== today) continue;
    if (
      !shift.employee_id ||
      !["DAY", "NIGHT"].includes(upper(shift.shift_period))
    ) continue;
    put(
      shift.employee_id,
      shift.shop_name,
      shift.is_reliever ? "24H_RELIEF" : "24H_ROTA"
    );
  }

  for (const relief of reliefRows) {
    if (String(relief.duty_date).slice(0, 10) !== today) continue;
    if (!relief.reliever_employee_id || !relief.covered_employee_id) continue;
    const covered = employeesById.get(String(relief.covered_employee_id));
    if (!covered) continue;
    const shop = shopsById.get(String(covered.shop_id));
    const shopName = covered.shop_name || shop?.shop_name || shop?.name;
    put(
      relief.reliever_employee_id,
      shopName,
      relief.temporary ? "TEMPORARY_RELIEF" : "RELIEF"
    );
  }

  return Array.from(dutyById.values());
}

// ==================================================
// METRIC CARD
// ==================================================

function Metric({ title, amount, variant = "teal", children }) {
  return (
    <div className={`tlba-metric ${variant}`}>
      <div className="tlba-metric-label">{title}</div>
      <div className="tlba-metric-content">
        <strong>KES {money(amount)}</strong>
        {children}
      </div>
    </div>
  );
}

// ==================================================
// MAIN PANEL
// ==================================================

export default function AdminSavingsPanel({ user }) {
  const baseUrl = String(
    process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  ).replace(/\/+$/, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const token = user?.access_token || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payments, setPayments] = useState([]);
  const [balances, setBalances] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [masterEmployees, setMasterEmployees] = useState([]);
  const [shops, setShops] = useState([]);
  const [rotaShifts, setRotaShifts] = useState([]);
  const [reliefRows, setReliefRows] = useState([]);
  const [todayForRota, setTodayForRota] = useState(() => dateKey(new Date()));
  const [salaryRoutes, setSalaryRoutes] = useState([]);
  const [routingError, setRoutingError] = useState("");
  const [period, setPeriod] = useState("this_week");
  const [detailsPeriod, setDetailsPeriod] = useState("this_week");
  const [detailsEmployeeId, setDetailsEmployeeId] = useState("");
  const [shopId, setShopId] = useState("");
  const [shopMonth, setShopMonth] = useState("this_month");
  const [electricityPeriod, setElectricityPeriod] = useState("this_week");
  const [statementOpen, setStatementOpen] = useState(true);
  const [truncated, setTruncated] = useState(false);
  const requestRef = useRef(0);

  const todayDuty = useMemo(
    () => buildTodayDuty(
      masterEmployees, shops, rotaShifts, reliefRows, todayForRota
    ),
    [masterEmployees, shops, rotaShifts, reliefRows, todayForRota]
  );

  // ==================================================
  // RPC
  // ==================================================

  const rpc = useCallback(async (name, args = {}) => {
    if (!baseUrl || !anonKey || !token) {
      throw new Error("Admin login is missing.");
    }
    const response = await fetch(`${baseUrl}/rest/v1/rpc/${name}`, {
      method: "POST",
      cache: "no-store",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(body?.message || body?.details || `${name} failed.`);
    }
    return body;
  }, [baseUrl, anonKey, token]);

  // ==================================================
  // LOAD SNAPSHOT (NO NEW DATABASE QUERIES)
  // ==================================================

  const load = useCallback(async () => {
    const ticket = ++requestRef.current;
    if (!baseUrl || !token || !anonKey) {
      setError("Admin login is missing.");
      setLoading(false);
      return;
    }

    try {
      const [snapshot, people, shopOptions] = await Promise.all([
        rpc("tl_admin_savings_activity_snapshot", { p_limit: 500 }),
        rpc("tl_admin_master_employee_list"),
        rpc("tl_admin_master_employee_shops_v1"),
      ]);
      if (ticket !== requestRef.current) return;

      if (
        !Array.isArray(snapshot?.payments) ||
        !Array.isArray(snapshot?.balances) ||
        !Array.isArray(snapshot?.ledger) ||
        !Array.isArray(people) ||
        !Array.isArray(shopOptions)
      ) {
        throw new Error("Unexpected banking data format.");
      }

      setPayments(snapshot.payments);
      setBalances(snapshot.balances);
      setLedger(snapshot.ledger);
      setMasterEmployees(people);
      setShops(shopOptions);
      setTruncated(
        snapshot.payments.length >= 500 ||
        snapshot.ledger.length >= 500
      );
      setError("");
    } catch (err) {
      if (ticket !== requestRef.current) return;
      setError(err?.message || "Unable to load Banking.");
    } finally {
      if (ticket === requestRef.current) setLoading(false);
    }
  }, [rpc, baseUrl, anonKey, token]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => {
      clearInterval(timer);
      requestRef.current += 1;
    };
  }, [load]);

  // ==================================================
  // ADMIN DUTY ROTA LABELS (UNCHANGED)
  // ==================================================

  useEffect(() => {
    let active = true;
    async function refreshRouting() {
      try {
        const today = dateKey(new Date());
        const [preview24h, relief, salary] = await Promise.all([
          rpc("tl_rota_24h_shift_preview", {
            p_start_date: today,
            p_days: 1,
          }),
          rpc("tl_rota_relief_preview", {
            p_start_date: today,
            p_days: 1,
          }),
          rpc("tl_salary_master_admin_list"),
        ]);
        if (!active) return;
        if (
          !Array.isArray(preview24h?.shifts) ||
          !Array.isArray(relief) ||
          !Array.isArray(salary)
        ) {
          throw new Error("Unexpected Duty Rota or Salary response format.");
        }
        setRotaShifts(preview24h.shifts);
        setReliefRows(relief);
        setTodayForRota(today);
        setSalaryRoutes(salary);
        setRoutingError("");
      } catch (e) {
        if (!active) return;
        setRotaShifts([]);
        setReliefRows([]);
        setSalaryRoutes([]);
        setRoutingError(e?.message || "Could not read today's employee rota.");
      }
    }

    if (baseUrl && anonKey && token) {
      void refreshRouting();
      const id = setInterval(() => {
        if (document.visibilityState === "visible") void refreshRouting();
      }, 60000);
      return () => {
        active = false;
        clearInterval(id);
      };
    }
    return () => { active = false; };
  }, [rpc, baseUrl, anonKey, token]);

  // ==================================================
  // EMPLOYEES AND SHOPS
  // ==================================================

  const activeEmployees = useMemo(
    () => masterEmployees.filter((e) => upper(e.employment_status) === "ACTIVE"),
    [masterEmployees]
  );

  useEffect(() => {
    if (!activeEmployees.some((e) => sameId(e.employee_id, detailsEmployeeId))) {
      setDetailsEmployeeId("");
    }
  }, [activeEmployees, detailsEmployeeId]);

  useEffect(() => {
    if (!shops.some((s) => sameId(s.id || s.shop_id, shopId))) {
      setShopId("");
    }
  }, [shops, shopId]);

  // ==================================================
  // BANKING — ORIGINAL METRICS
  // ==================================================

  const bankingLedger = useMemo(
    () => ledger.filter((entry) => categoryOf(entry) === "BANKING"),
    [ledger]
  );
  const bankedLedger = useMemo(
    () => bankingLedger.filter((entry) => upper(entry.transaction_type) === "PAYMENT"),
    [bankingLedger]
  );

  const totalBanked = useMemo(
    () => bankedLedger
      .filter((entry) => withinPeriod(entry.created_at, period))
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0),
    [bankedLedger, period]
  );

  const pendingAmount = useMemo(
    () => payments
      .filter((entry) =>
        categoryOf(entry) === "BANKING" &&
        ["PENDING", "PROCESSING"].includes(upper(entry.status)) &&
        withinPeriod(entry.requested_at, period)
      )
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0),
    [payments, period]
  );

  const confirmedAmount = useMemo(
    () => bankedLedger.reduce((sum, entry) => sum + Number(entry.amount || 0), 0),
    [bankedLedger]
  );

  const selectedDetailsEmployee = activeEmployees.find(
    (e) => sameId(e.employee_id, detailsEmployeeId)
  ) || null;

  const selectedSavedBalance = useMemo(
    () => selectedDetailsEmployee
      ? balances
          .filter((entry) =>
            categoryOf(entry) === "BANKING" &&
            sameId(entry.employee_id, selectedDetailsEmployee.employee_id)
          )
          .reduce((sum, entry) => sum + Number(entry.current_balance || 0), 0)
      : 0,
    [balances, selectedDetailsEmployee]
  );

  const statementRows = useMemo(
    () => bankingLedger
      .filter((entry) =>
        sameId(entry.employee_id, detailsEmployeeId) &&
        withinPeriod(entry.created_at, detailsPeriod)
      )
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [bankingLedger, detailsEmployeeId, detailsPeriod]
  );

  const statementBanked = useMemo(
    () => statementRows
      .filter((e) => upper(e.transaction_type) === "PAYMENT")
      .reduce((sum, e) => sum + Number(e.amount || 0), 0),
    [statementRows]
  );

  const statementSaved = useMemo(
    () => statementRows
      .filter((e) => upper(e.transaction_type) === "SAVE")
      .reduce((sum, e) => sum + Number(e.amount || 0), 0),
    [statementRows]
  );

  const paymentById = useMemo(
    () => new Map(payments.map((p) => [String(p.id), p])),
    [payments]
  );

  // ==================================================
  // SHOP MONTHLY PAYMENT STATUS — ORIGINAL RULES
  // ==================================================

  const monthPayments = useMemo(() => {
    const selectedMonth = monthKey(shopMonth);

    return PAYMENT_CATEGORIES.map(({ key, label }) => {
      const shopPayments = payments.filter(
        (p) => sameId(p.shop_id, shopId) && categoryOf(p) === key
      );
      const confirmed = shopPayments.filter(
        (p) => isConfirmed(p) &&
          dateKey(paymentDate(p)).slice(0, 7) === selectedMonth
      );
      const pending = shopPayments.filter(
        (p) => ["PENDING", "PROCESSING"].includes(upper(p.status))
      );
      const currentSaved = balances
        .filter((a) =>
          sameId(a.shop_id, shopId) &&
          categoryOf(a) === key &&
          a.is_active !== false
        )
        .reduce((sum, a) => sum + Number(a.current_balance || 0), 0);
      const confirmedPaid = confirmed.reduce(
        (sum, p) => sum + Number(p.amount || 0), 0
      );
      const pendingAmount = pending.reduce(
        (sum, p) => sum + Number(p.amount || 0), 0
      );
      const state = !shopId
        ? "SELECT SHOP"
        : confirmedPaid > 0
        ? "PAID"
        : pending.length > 0
        ? "PENDING"
        : truncated
        ? "UNVERIFIED"
        : "NOT PAID";

      return { key, label, state, currentSaved, confirmedPaid, pendingAmount };
    });
  }, [payments, balances, shopId, shopMonth, truncated]);

  // ==================================================
  // ELECTRICITY BREAKDOWN — NEW READ-ONLY SECTION
  //
  // SAVE: actual additions to the electricity wallet.
  // PAYMENT: posted only after Accountant confirmation.
  // PENDING: requests, not confirmed payments.
  // CURRENT BALANCE: live shop wallet, not period total.
  // ==================================================

  const electricityLedger = useMemo(
    () => ledger.filter((entry) =>
      categoryOf(entry) === "ELECTRICITY" &&
      sameId(entry.shop_id, shopId) &&
      ["SAVE", "PAYMENT"].includes(upper(entry.transaction_type))
    ),
    [ledger, shopId]
  );

  const electricityRequests = useMemo(
    () => payments.filter((p) =>
      categoryOf(p) === "ELECTRICITY" &&
      sameId(p.shop_id, shopId)
    ),
    [payments, shopId]
  );

  // Use the actual confirmation timestamp for linked PAYMENT entries.
  // If a linked request is not included in the snapshot, fall back to
  // the PAYMENT ledger timestamp (never the request timestamp).
  const electricityEntryAt = useCallback((entry) => {
    if (upper(entry.transaction_type) !== "PAYMENT") return entry.created_at;
    const request = paymentById.get(String(entry.payment_request_id));
    return request?.confirmed_at || entry.created_at;
  }, [paymentById]);

  const electricityPeriodLedger = useMemo(
    () => electricityLedger.filter((entry) =>
      withinPeriod(electricityEntryAt(entry), electricityPeriod)
    ),
    [electricityLedger, electricityEntryAt, electricityPeriod]
  );

  const electricitySaved = useMemo(
    () => electricityPeriodLedger
      .filter((e) => upper(e.transaction_type) === "SAVE")
      .reduce((sum, e) => sum + Number(e.amount || 0), 0),
    [electricityPeriodLedger]
  );

  const electricityPaid = useMemo(
    () => electricityPeriodLedger
      .filter((e) => upper(e.transaction_type) === "PAYMENT")
      .reduce((sum, e) => sum + Number(e.amount || 0), 0),
    [electricityPeriodLedger]
  );

  const electricityPendingRequests = useMemo(
    () => electricityRequests.filter((p) =>
      ["PENDING", "PROCESSING"].includes(upper(p.status)) &&
      withinPeriod(p.requested_at, electricityPeriod)
    ),
    [electricityRequests, electricityPeriod]
  );

  const electricityPending = useMemo(
    () => electricityPendingRequests.reduce(
      (sum, p) => sum + Number(p.amount || 0), 0
    ),
    [electricityPendingRequests]
  );

  const electricityBalance = useMemo(
    () => balances.filter((b) =>
      categoryOf(b) === "ELECTRICITY" &&
      sameId(b.shop_id, shopId) &&
      b.is_active !== false
    ).reduce((sum, b) => sum + Number(b.current_balance || 0), 0),
    [balances, shopId]
  );

  const electricityActivity = useMemo(() => {
    const confirmedAndSaved = electricityPeriodLedger.map((entry, index) => {
      const type = upper(entry.transaction_type);
      const linkedPayment = paymentById.get(String(entry.payment_request_id));
      return {
        id: `ledger-${entry.id || index}`,
        at: electricityEntryAt(entry),
        type,
        reference:
          linkedPayment?.payment_reference ||
          linkedPayment?.external_transaction_id ||
          entry.payment_reference ||
          entry.reference ||
          "—",
        amount: Number(entry.amount || 0),
        status: type === "SAVE" ? "SAVED" : "CONFIRMED",
      };
    });

    const pendingRows = electricityPendingRequests.map((p, index) => ({
      id: `pending-${p.id || index}`,
      at: p.requested_at,
      type: "REQUEST",
      reference: p.payment_reference || p.external_transaction_id || "—",
      amount: Number(p.amount || 0),
      status: upper(p.status),
    }));

    return [...confirmedAndSaved, ...pendingRows]
      .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
  }, [electricityPeriodLedger, electricityPendingRequests, electricityEntryAt, paymentById]);

  const electricityDates = periodBounds(electricityPeriod);

  // ==================================================
  // RENDER
  // ==================================================

  return (
    <section className="tlba-root">
      <style>{css}</style>

      {error && <div className="tlba-error" role="alert">{error}</div>}

      {routingError && (
        <div className="tlba-error" role="status">
          EMPLOYEE SHOP LABELS NOT VERIFIED: {routingError}
        </div>
      )}

      {truncated && (
        <div className="tlba-error" role="status">
          ACTIVITY HISTORY LIMIT REACHED — RECENT PAYMENT STATUS
          AND PERIOD TOTALS MAY BE INCOMPLETE.
        </div>
      )}

      {loading ? (
        <div className="tlba-loading">Loading Banking...</div>
      ) : (
        <>
          {/* TOP SUMMARY — UNCHANGED */}
          <div className="tlba-summary">
            <Metric title="TOTAL BANKED" amount={totalBanked}>
              <select
                aria-label="Total banked period"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              >
                {PERIODS.map(([value, name]) => (
                  <option key={value} value={value}>{name}</option>
                ))}
              </select>
            </Metric>

            <Metric
              title="PENDING CONFIRMATION"
              amount={pendingAmount}
              variant="amber"
            />
            <Metric title="CONFIRMED" amount={confirmedAmount} variant="green" />
          </div>

          <div className="tlba-layout">
            {/* SHOP MONTHLY PAYMENT STATUS */}
            <section className="tlba-panel">
              <div className="tlba-panelhead">
                <h2>Shop Monthly Payment Status</h2>
                <span className="tlba-badge">READ ONLY</span>
              </div>

              <div className="tlba-inner">
                <label htmlFor="tlba-month">MONTH</label>
                <select
                  id="tlba-month"
                  value={shopMonth}
                  onChange={(e) => setShopMonth(e.target.value)}
                >
                  <option value="this_month">This Month</option>
                  <option value="last_month">Last Month</option>
                </select>

                <label htmlFor="tlba-shop">SHOP</label>
                <select
                  id="tlba-shop"
                  value={shopId}
                  onChange={(e) => setShopId(e.target.value)}
                >
                  <option value="">Select shop</option>
                  {shops.map((shop) => (
                    <option
                      key={shop.id || shop.shop_id}
                      value={shop.id || shop.shop_id}
                    >
                      {shop.name || shop.shop_name}
                    </option>
                  ))}
                </select>

                <div className="tlba-monthlist">
                  {monthPayments.map((item) => (
                    <div key={item.key} className="tlba-monthrow">
                      <div className="tlba-monthinfo">
                        <strong>{item.label}</strong>
                        {shopId && (
                          <small>
                            SAVED KES {money(item.currentSaved)}
                            {item.confirmedPaid > 0 &&
                              `  ·  PAID THIS MONTH KES ${money(item.confirmedPaid)}`}
                          </small>
                        )}
                      </div>
                      <div className="tlba-monthright">
                        {shopId && item.pendingAmount > 0 && (
                          <small className="tlba-pendingamount">
                            PENDING KES {money(item.pendingAmount)}
                          </small>
                        )}
                        <span
                          className={`tlba-status ${
                            item.state === "PAID"
                              ? "paid"
                              : item.state === "PENDING"
                              ? "pending"
                              : item.state === "NOT PAID"
                              ? "notpaid"
                              : "unknown"
                          }`}
                        >
                          {item.state}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* NEW: ELECTRICITY VARIABLE BREAKDOWN */}
                <div className="tlba-electricity">
                  <div className="tlba-electricity-heading">
                    <strong>ELECTRICITY BREAKDOWN</strong>
                    <span>VARIABLE EXPENSE · READ ONLY</span>
                  </div>

                  <label htmlFor="tlba-electricity-period">PERIOD</label>
                  <select
                    id="tlba-electricity-period"
                    value={electricityPeriod}
                    onChange={(e) => setElectricityPeriod(e.target.value)}
                  >
                    {ELECTRICITY_PERIODS.map(([value, name]) => (
                      <option key={value} value={value}>{name}</option>
                    ))}
                  </select>

                  <div className="tlba-electricity-dates">
                    {displayDate(`${electricityDates[0]}T12:00:00+03:00`)}
                    {" — "}
                    {displayDate(`${electricityDates[1]}T12:00:00+03:00`)}
                  </div>

                  {!shopId ? (
                    <div className="tlba-electricity-empty">
                      Select a shop above to view Electricity transactions.
                    </div>
                  ) : (
                    <>
                      <div className="tlba-electricity-grid">
                        <div className="tlba-electricity-stat">
                          <small>SAVED IN PERIOD</small>
                          <strong>KES {money(electricitySaved)}</strong>
                        </div>
                        <div className="tlba-electricity-stat">
                          <small>PAID IN PERIOD</small>
                          <strong>KES {money(electricityPaid)}</strong>
                        </div>
                        <div className="tlba-electricity-stat">
                          <small>PENDING REQUESTS IN PERIOD</small>
                          <strong>KES {money(electricityPending)}</strong>
                        </div>
                        <div className="tlba-electricity-stat balance">
                          <small>CURRENT SAVED BALANCE</small>
                          <strong>KES {money(electricityBalance)}</strong>
                        </div>
                      </div>

                      <div className="tlba-electricity-tablewrap">
                        <table>
                          <thead>
                            <tr>
                              <th>DATE</th>
                              <th>TIME</th>
                              <th>TYPE</th>
                              <th>REFERENCE</th>
                              <th>AMOUNT (KES)</th>
                              <th>STATUS</th>
                            </tr>
                          </thead>
                          <tbody>
                            {electricityActivity.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="tlba-electricity-empty">
                                  No Electricity transactions for this period.
                                </td>
                              </tr>
                            ) : electricityActivity.map((row) => (
                              <tr key={row.id}>
                                <td>{displayDate(row.at)}</td>
                                <td>{localTime(row.at)}</td>
                                <td>{row.type}</td>
                                <td>{row.reference}</td>
                                <td className={row.type === "SAVE" ? "tlba-positive" : "tlba-outflow"}>
                                  {row.type === "SAVE" ? "+" : "−"} {money(row.amount)}
                                </td>
                                <td>{row.status}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="tlba-electricity-note">
                        SAVED is posted once when the cashier saves money.
                        PAID counts only confirmed payment-ledger entries.
                        Pending requests are not paid. Current balance is
                        the live wallet balance, not a period total.
                        {truncated && (
                          <strong> History is limited to the latest 500 records; period totals may be incomplete.</strong>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </section>

            {/* EMPLOYEE BANKING DETAILS — UNCHANGED */}
            <section className="tlba-panel">
              <div className="tlba-panelhead">
                <h2>Employee Banking Details</h2>
                <span className="tlba-badge">READ ONLY</span>
              </div>

              <div className="tlba-inner">
                <label htmlFor="tlba-details-employee">EMPLOYEE</label>
                <select
                  id="tlba-details-employee"
                  value={detailsEmployeeId}
                  onChange={(e) => {
                    setDetailsEmployeeId(e.target.value);
                    setStatementOpen(true);
                  }}
                >
                  <option value="">Select employee</option>
                  {activeEmployees.map((person) => (
                    <option key={person.employee_id} value={person.employee_id}>
                      {labelForPerson(person, shops, todayDuty, salaryRoutes)}
                    </option>
                  ))}
                </select>

                <div className="tlba-employee-balance">
                  <span>CURRENT SAVED BALANCE</span>
                  <strong>KES {money(selectedSavedBalance)}</strong>
                </div>

                <div className="tlba-statement-controls">
                  <select
                    aria-label="Employee statement period"
                    value={detailsPeriod}
                    onChange={(e) => setDetailsPeriod(e.target.value)}
                  >
                    {PERIODS.map(([value, name]) => (
                      <option key={value} value={value}>{name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    aria-expanded={statementOpen}
                    onClick={() => setStatementOpen((v) => !v)}
                  >
                    STATEMENT {statementOpen ? "▲" : "▼"}
                  </button>
                </div>

                {statementOpen && (
                  <div className="tlba-tablewrap">
                    <table>
                      <thead>
                        <tr>
                          <th>DATE</th>
                          <th>TIME</th>
                          <th>TYPE</th>
                          <th>REFERENCE</th>
                          <th>AMOUNT (KES)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {!detailsEmployeeId ? (
                          <tr><td colSpan={5}>Select employee</td></tr>
                        ) : statementRows.length === 0 ? (
                          <tr><td colSpan={5}>No Banking activity for this period</td></tr>
                        ) : statementRows.map((item) => (
                          <tr key={item.id}>
                            <td>{displayDate(item.created_at)}</td>
                            <td>{localTime(item.created_at)}</td>
                            <td>{upper(item.transaction_type) || "—"}</td>
                            <td>
                              {paymentById.get(String(item.payment_request_id))?.payment_reference ||
                                paymentById.get(String(item.payment_request_id))?.external_transaction_id ||
                                "—"}
                            </td>
                            <td className={
                              upper(item.transaction_type) === "SAVE"
                                ? "tlba-positive"
                                : "tlba-outflow"
                            }>
                              {upper(item.transaction_type) === "SAVE" ? "+" : "−"} {money(item.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="tlba-statement-subtotal">
                  <span>SAVED IN PERIOD</span>
                  <strong>KES {money(statementSaved)}</strong>
                </div>

                <div className="tlba-total">
                  <div>TOTAL BANKED (CONFIRMED)</div>
                  <strong>KES {money(statementBanked)}</strong>
                </div>
              </div>
            </section>
          </div>
        </>
      )}
    </section>
  );
}

// ==================================================
// COMPLETE NAVY AND GOLD CSS
// ==================================================

const css = `
.tlba-root{
  color:#f1f6fd;background:#061526;border-radius:13px;padding:14px;
  font:600 14px Inter,ui-sans-serif,system-ui,sans-serif;box-sizing:border-box;
}
.tlba-root *{box-sizing:border-box}
.tlba-summary{
  display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:13px;margin-bottom:15px;
}
.tlba-metric{
  min-width:0;padding:20px;background:linear-gradient(110deg,#073e37,#06252e);
  border:1px solid #158570;border-radius:9px;
}
.tlba-metric.amber{background:linear-gradient(110deg,#54321f,#201d22);border-color:#b57c2b}
.tlba-metric.green{background:linear-gradient(110deg,#073e37,#06252e);border-color:#158570}
.tlba-metric-label{font-size:14px;font-weight:800;letter-spacing:.03em}
.tlba-metric-content{
  display:flex;justify-content:space-between;align-items:center;gap:10px;
  margin-top:9px;flex-wrap:wrap;
}
.tlba-metric-content strong{
  font-size:clamp(19px,2vw,27px);color:#ffdb68;
  white-space:nowrap;font-variant-numeric:tabular-nums;
}
.tlba-metric.green strong{color:#78edb9}
.tlba-root select{
  width:100%;min-width:0;min-height:44px;padding:10px 12px;
  border:1px solid #b38b36;background:#081b30;color:#f7f9fc;
  border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;
}
.tlba-root option{background:#07172c;color:#fff}
.tlba-metric select{width:auto;max-width:165px;border-color:#435e82}
.tlba-layout{
  display:grid;grid-template-columns:repeat(2,minmax(0,1fr));
  gap:15px;align-items:start;
}
.tlba-employee-balance{
  display:flex;justify-content:space-between;align-items:center;gap:8px;
  flex-wrap:wrap;background:#071d2c;border:1px solid #158570;
  border-radius:8px;padding:15px;color:#e6f3fd;font-size:13px;font-weight:800;
}
.tlba-employee-balance strong{font-size:22px;color:#78edb9}
.tlba-statement-subtotal{
  display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;
  font-size:13px;color:#deeefd;padding:11px 5px;
}
.tlba-outflow{color:#f4cb88;font-weight:850}
.tlba-panel{
  min-width:0;border:2px solid #d3af47;border-radius:12px;
  padding:16px;background:#06172d;
}
.tlba-panelhead{
  display:flex;align-items:center;justify-content:space-between;
  gap:8px;flex-wrap:wrap;margin-bottom:12px;
}
.tlba-panelhead h2{
  margin:0;color:#ffdc6a;font-size:clamp(17px,1.65vw,24px);font-weight:850;
}
.tlba-badge{
  color:#d8e7fb;background:#132d4a;border:1px solid #345378;
  padding:7px 9px;border-radius:7px;font-size:12px;white-space:nowrap;
}
.tlba-inner{
  background:#081e35;border:1px solid #21496e;border-radius:8px;
  padding:12px;display:grid;gap:9px;min-width:0;
}
.tlba-inner label{
  font-size:13px;font-weight:850;color:#d9e3ee;margin-top:7px;
}
.tlba-monthlist{display:grid;gap:7px;margin-top:8px}
.tlba-monthrow{
  display:flex;align-items:center;justify-content:space-between;gap:12px;
  background:#071b31;border:1px solid #235077;border-radius:8px;
  padding:9px 12px;min-height:56px;font-size:16px;
}
.tlba-status{
  display:inline-block;min-width:116px;text-align:center;border-radius:6px;
  padding:10px 11px;color:white;font-size:13px;font-weight:850;white-space:nowrap;
}
.tlba-monthinfo{display:flex;flex-direction:column;gap:5px;min-width:0}
.tlba-monthinfo small{font-size:11px;font-weight:650;color:#b8cde2;line-height:1.4}
.tlba-monthright{
  display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end;
}
.tlba-pendingamount{font-size:11px;color:#ffcc80;font-weight:800}
.tlba-status.paid{background:#079b69}
.tlba-status.pending{background:#916018}
.tlba-status.notpaid{background:#d53138}
.tlba-status.unknown{background:#36506c}
.tlba-statement-controls{
  display:flex;gap:8px;align-items:center;margin-top:6px;
}
.tlba-statement-controls select{flex:1}
.tlba-statement-controls button{
  min-height:44px;padding:10px 14px;white-space:nowrap;
  background:#173d61;color:white;border:1px solid #426a94;
  border-radius:8px;font-size:13px;font-weight:850;cursor:pointer;
}
.tlba-tablewrap{width:100%;overflow-x:auto}
.tlba-tablewrap table{border-collapse:collapse;width:100%;min-width:415px;font-size:13px}
.tlba-tablewrap th{
  color:#d8e5f3;text-align:left;background:#123857;
  padding:11px 9px;border:1px solid #265176;white-space:nowrap;
}
.tlba-tablewrap td{border:1px solid #25425f;padding:10px 9px;overflow-wrap:anywhere}
.tlba-tablewrap td:last-child,.tlba-tablewrap th:last-child{
  text-align:right;white-space:nowrap;
}
.tlba-positive{color:#50e7a3;font-weight:850}
.tlba-total{
  display:flex;justify-content:space-between;align-items:center;gap:10px;
  flex-wrap:wrap;background:#073a36;border:1px solid #147c67;
  border-radius:8px;padding:15px;margin-top:4px;
  color:#ffdc6b;font-size:17px;font-weight:850;
}
.tlba-total strong{
  font-size:clamp(19px,2.3vw,29px);font-variant-numeric:tabular-nums;
}
.tlba-loading{padding:40px;text-align:center}
.tlba-error{
  padding:13px 16px;margin-bottom:12px;background:#51232d;
  border:1px solid #b54c57;color:#ffd6dc;border-radius:8px;font-weight:800;
}
/* ELECTRICITY — consistent with the existing navy/gold theme */
.tlba-electricity{
  margin-top:12px;padding:13px;background:#071b31;
  border:1px solid #b38b36;border-radius:9px;display:grid;gap:11px;min-width:0;
}
.tlba-electricity-heading{
  display:flex;justify-content:space-between;align-items:center;
  flex-wrap:wrap;gap:7px;padding-bottom:7px;border-bottom:1px solid #385372;
}
.tlba-electricity-heading strong{color:#ffdc6a;font-size:16px;font-weight:900}
.tlba-electricity-heading span{font-size:10px;color:#b8cde2}
.tlba-electricity-dates{font-size:12px;color:#b8cde2;font-weight:700}
.tlba-electricity-grid{
  display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;
}
.tlba-electricity-stat{
  min-width:0;padding:11px;background:#102840;border:1px solid #31577a;
  border-radius:7px;display:flex;flex-direction:column;gap:6px;
}
.tlba-electricity-stat.balance{background:#0d3832;border-color:#16866b}
.tlba-electricity-stat small{font-size:10px;color:#bfd4e8;font-weight:850}
.tlba-electricity-stat strong{
  font-size:clamp(15px,1.35vw,20px);color:#ffdc6a;
  overflow-wrap:anywhere;font-variant-numeric:tabular-nums;
}
.tlba-electricity-stat.balance strong{color:#78edb9}
.tlba-electricity-tablewrap{overflow-x:auto;width:100%}
.tlba-electricity-tablewrap table{
  border-collapse:collapse;width:100%;min-width:620px;font-size:12px;
}
.tlba-electricity-tablewrap th{
  color:#d8e5f3;background:#123857;text-align:left;
  padding:10px 8px;border:1px solid #265176;white-space:nowrap;
}
.tlba-electricity-tablewrap td{
  border:1px solid #25425f;padding:9px 8px;
  overflow-wrap:anywhere;
}
.tlba-electricity-tablewrap td:nth-child(5),
.tlba-electricity-tablewrap th:nth-child(5){
  text-align:right;white-space:nowrap;
}
.tlba-electricity-empty{padding:13px;text-align:center;color:#c4d5e4;font-size:12px}
.tlba-electricity-note{font-size:11px;line-height:1.6;color:#b8cde2}
.tlba-electricity-note strong{color:#ffd28e}
@media(max-width:900px){
  .tlba-layout{grid-template-columns:1fr}
  .tlba-summary{grid-template-columns:repeat(auto-fit,minmax(230px,1fr))}
}
@media(max-width:550px){
  .tlba-root{padding:9px}
  .tlba-panel{padding:10px}
  .tlba-metric{padding:13px}
  .tlba-statement-controls{flex-wrap:wrap}
  .tlba-statement-controls button{flex:1}
  .tlba-metric select{max-width:none;width:100%}
}
`;
