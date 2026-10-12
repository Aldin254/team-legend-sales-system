"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

// TEAM LEGEND / NYIKA — ADMIN SAVINGS / BANKING
// READ ONLY
// Salary Management controls employee shop routing.
// No separate Banking AUTO / MANUAL configuration.

const REFRESH_MS = 10000;

const PERIODS = [
  ["this_week", "This Week"],
  ["last_week", "Last Week"],
  ["this_month", "This Month"],
];

const PAYMENT_CATEGORIES = [
  "DSTV",
  "ELECTRICITY",
  "RENT",
];

// ============================================
// DATE HELPERS
// ============================================

function dateKey(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const parts = new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: "Africa/Nairobi",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).formatToParts(date);

  const get = (key) =>
    parts.find(
      (part) => part.type === key
    )?.value || "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

function localTime(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

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

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function periodBounds(period) {
  const today = dateKey(new Date());

  const date = new Date(
    `${today}T12:00:00Z`
  );

  const mondayOffset =
    (date.getUTCDay() + 6) % 7;

  const weekStart = new Date(date);

  weekStart.setUTCDate(
    date.getUTCDate() - mondayOffset
  );

  const key = (value) =>
    value.toISOString().slice(0, 10);

  if (period === "this_month") {
    return [
      today.slice(0, 7) + "-01",
      today,
    ];
  }

  if (period === "last_week") {
    const start = new Date(weekStart);

    start.setUTCDate(
      start.getUTCDate() - 7
    );

    const end = new Date(weekStart);

    end.setUTCDate(
      end.getUTCDate() - 1
    );

    return [
      key(start),
      key(end),
    ];
  }

  const sunday = new Date(weekStart);

  sunday.setUTCDate(
    sunday.getUTCDate() + 6
  );

  return [
    key(weekStart),
    key(sunday),
  ];
}

function withinPeriod(value, period) {
  const day = dateKey(value);

  const [start, end] =
    periodBounds(period);

  return Boolean(
    day &&
    day >= start &&
    day <= end
  );
}

function monthKey(period) {
  const today = dateKey(new Date());

  if (period === "last_month") {
    const [year, month] =
      today.split("-").map(Number);

    return new Date(
      Date.UTC(
        year,
        month - 2,
        1
      )
    ).toISOString().slice(0, 7);
  }

  return today.slice(0, 7);
}

// ============================================
// GENERAL HELPERS
// ============================================

function money(value) {
  const number = Number(value ?? 0);

  return (
    Number.isFinite(number) ? number : 0
  ).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function upper(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

function sameId(first, second) {
  return Boolean(
    first &&
    second &&
    String(first) === String(second)
  );
}

function bankingId(person) {
  return (
    person?.profile_id ||
    person?.banking_employee_id ||
    person?.employee_id
  );
}

function categoryOf(row) {
  return upper(row?.category);
}

function paymentDate(row) {
  return row?.confirmed_at || null;
}

function isConfirmed(row) {
  return (
    upper(row?.status) === "CONFIRMED" &&
    Boolean(paymentDate(row))
  );
}

function labelForPerson(row, shops) {
  const shop = shops.find(
    (item) =>
      sameId(
        item.id,
        row.shop_id
      )
  );

  const assignment =
    shop?.name ||
    (
      row.job_title === "TEAM_LEADER"
        ? "TEAM LEADER"
        : row.job_title === "ACCOUNTANT"
        ? "ACCOUNTANT"
        : "UNASSIGNED"
    );

  return (
    `${assignment} — ` +
    `${row.full_name || "Employee"}`
  );
}

// ============================================
// METRIC CARD
// ============================================

function Metric({
  title,
  amount,
  variant = "teal",
  children,
}) {
  return (
    <div
      className={`tlba-metric ${variant}`}
    >
      <div className="tlba-metric-label">
        {title}
      </div>

      <div className="tlba-metric-content">
        <strong>
          KES {money(amount)}
        </strong>

        {children}
      </div>
    </div>
  );
}

// ============================================
// MAIN ADMIN PANEL
// ============================================

export default function AdminSavingsPanel({
  user,
}) {
  const baseUrl = String(
    process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  ).replace(/\/+$/, "");

  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";

  const token =
    user?.access_token || "";

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [payments, setPayments] =
    useState([]);

  const [balances, setBalances] =
    useState([]);

  const [
    masterEmployees,
    setMasterEmployees,
  ] = useState([]);

  const [shops, setShops] =
    useState([]);

  const [period, setPeriod] =
    useState("this_week");

  const [
    detailsPeriod,
    setDetailsPeriod,
  ] = useState("this_week");

  const [
    bankingEmployeeId,
    setBankingEmployeeId,
  ] = useState("");

  const [
    detailsEmployeeId,
    setDetailsEmployeeId,
  ] = useState("");

  const [shopId, setShopId] =
    useState("");

  const [shopMonth, setShopMonth] =
    useState("this_month");

  const [
    statementOpen,
    setStatementOpen,
  ] = useState(true);

  const [truncated, setTruncated] =
    useState(false);

  const requestRef = useRef(0);

  // ==========================================
  // SUPABASE
  // ==========================================

  const rpc = useCallback(
    async (name, args = {}) => {
      if (
        !baseUrl ||
        !anonKey ||
        !token
      ) {
        throw new Error(
          "Admin login is missing."
        );
      }

      const response = await fetch(
        `${baseUrl}/rest/v1/rpc/${name}`,
        {
          method: "POST",
          cache: "no-store",

          headers: {
            apikey: anonKey,
            Authorization:
              `Bearer ${token}`,
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify(args),
        }
      );

      const body = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        throw new Error(
          body?.message ||
          body?.details ||
          `${name} failed.`
        );
      }

      return body;
    },
    [
      baseUrl,
      anonKey,
      token,
    ]
  );

  // ==========================================
  // LOAD EXISTING READ-ONLY DATA
  // ==========================================

  const load = useCallback(
    async () => {
      const ticket =
        ++requestRef.current;

      if (
        !baseUrl ||
        !anonKey ||
        !token
      ) {
        setError(
          "Admin login is missing."
        );

        setLoading(false);
        return;
      }

      try {
        const [
          snapshot,
          people,
          shopOptions,
        ] = await Promise.all([
          rpc(
            "tl_admin_savings_activity_snapshot",
            {
              p_limit: 500,
            }
          ),

          rpc(
            "tl_admin_master_employee_list"
          ),

          rpc(
            "tl_admin_master_employee_shops_v1"
          ),
        ]);

        if (
          ticket !== requestRef.current
        ) {
          return;
        }

        if (
          !Array.isArray(snapshot?.payments) ||
          !Array.isArray(snapshot?.balances) ||
          !Array.isArray(people) ||
          !Array.isArray(shopOptions)
        ) {
          throw new Error(
            "Unexpected banking data format."
          );
        }

        setPayments(snapshot.payments);
        setBalances(snapshot.balances);
        setMasterEmployees(people);
        setShops(shopOptions);

        setTruncated(
          snapshot.payments.length >= 500
        );

        setError("");
      } catch (err) {
        if (
          ticket !== requestRef.current
        ) {
          return;
        }

        console.error(
          "ADMIN SAVINGS / BANKING ERROR:",
          err
        );

        setError(
          err?.message ||
          "Unable to load Banking."
        );
      } finally {
        if (
          ticket === requestRef.current
        ) {
          setLoading(false);
        }
      }
    },
    [
      rpc,
      baseUrl,
      anonKey,
      token,
    ]
  );

  // ==========================================
  // AUTO REFRESH
  // ==========================================

  useEffect(() => {
    void load();

    const timer = setInterval(
      () => {
        void load();
      },
      REFRESH_MS
    );

    return () => {
      clearInterval(timer);
      requestRef.current += 1;
    };
  }, [load]);

  // ==========================================
  // MASTER EMPLOYEE LIST
  // Salary manages routing.
  // Banking has no duplicate route setting.
  // ==========================================

  const activeEmployees = useMemo(
    () =>
      masterEmployees.filter(
        (employee) =>
          upper(
            employee.employment_status
          ) === "ACTIVE"
      ),
    [masterEmployees]
  );

  useEffect(() => {
    if (
      !activeEmployees.some(
        (employee) =>
          sameId(
            employee.employee_id,
            bankingEmployeeId
          )
      )
    ) {
      setBankingEmployeeId("");
    }
  }, [
    activeEmployees,
    bankingEmployeeId,
  ]);

  useEffect(() => {
    if (
      !activeEmployees.some(
        (employee) =>
          sameId(
            employee.employee_id,
            detailsEmployeeId
          )
      )
    ) {
      setDetailsEmployeeId("");
    }
  }, [
    activeEmployees,
    detailsEmployeeId,
  ]);

  useEffect(() => {
    if (
      !shops.some(
        (shop) =>
          sameId(
            shop.id,
            shopId
          )
      )
    ) {
      setShopId("");
    }
  }, [
    shops,
    shopId,
  ]);

  // ==========================================
  // BANKING TOTALS
  // ==========================================

  const confirmedBanking = useMemo(
    () =>
      payments.filter(
        (payment) =>
          categoryOf(payment) ===
            "BANKING" &&
          isConfirmed(payment)
      ),
    [payments]
  );

  const periodBanked = useMemo(
    () =>
      confirmedBanking.filter(
        (payment) =>
          withinPeriod(
            paymentDate(payment),
            period
          )
      ),
    [
      confirmedBanking,
      period,
    ]
  );

  const totalBanked = useMemo(
    () =>
      periodBanked.reduce(
        (sum, payment) =>
          sum +
          Number(payment.amount || 0),
        0
      ),
    [periodBanked]
  );

  const pendingAmount = useMemo(
    () =>
      payments
        .filter(
          (payment) =>
            categoryOf(payment) ===
              "BANKING" &&
            [
              "PENDING",
              "PROCESSING",
            ].includes(
              upper(payment.status)
            ) &&
            withinPeriod(
              payment.requested_at,
              period
            )
        )
        .reduce(
          (sum, payment) =>
            sum +
            Number(payment.amount || 0),
          0
        ),
    [
      payments,
      period,
    ]
  );

  const confirmedAmount = useMemo(
    () =>
      confirmedBanking.reduce(
        (sum, item) =>
          sum +
          Number(item.amount || 0),
        0
      ),
    [confirmedBanking]
  );

  // ==========================================
  // EMPLOYEE SAVINGS BALANCE
  // ==========================================

  const selectedBankingEmployee =
    activeEmployees.find(
      (employee) =>
        sameId(
          employee.employee_id,
          bankingEmployeeId
        )
    ) || null;

  const savedBalance = useMemo(
    () =>
      selectedBankingEmployee
        ? balances
            .filter(
              (balance) =>
                categoryOf(balance) ===
                  "BANKING" &&
                sameId(
                  balance.employee_id,
                  bankingId(
                    selectedBankingEmployee
                  )
                )
            )
            .reduce(
              (sum, balance) =>
                sum +
                Number(
                  balance.current_balance || 0
                ),
              0
            )
        : 0,
    [
      balances,
      selectedBankingEmployee,
    ]
  );

  // ==========================================
  // EMPLOYEE BANKING STATEMENT
  // ==========================================

  const selectedDetailsEmployee =
    activeEmployees.find(
      (employee) =>
        sameId(
          employee.employee_id,
          detailsEmployeeId
        )
    ) || null;

  const statementRows = useMemo(
    () =>
      confirmedBanking
        .filter(
          (payment) =>
            sameId(
              payment.employee_id,
              bankingId(
                selectedDetailsEmployee
              )
            ) &&
            withinPeriod(
              paymentDate(payment),
              detailsPeriod
            )
        )
        .sort(
          (a, b) =>
            new Date(b.confirmed_at) -
            new Date(a.confirmed_at)
        ),
    [
      confirmedBanking,
      selectedDetailsEmployee,
      detailsPeriod,
    ]
  );

  const statementTotal = useMemo(
    () =>
      statementRows.reduce(
        (sum, payment) =>
          sum +
          Number(
            payment.amount || 0
          ),
        0
      ),
    [statementRows]
  );

  // ==========================================
  // SHOP MONTHLY PAYMENT STATUS
  // ==========================================

  const monthPayments = useMemo(
    () =>
      PAYMENT_CATEGORIES.map(
        (category) => ({
          category,

          paid: payments.some(
            (payment) =>
              sameId(
                payment.shop_id,
                shopId
              ) &&
              categoryOf(payment) ===
                category &&
              isConfirmed(payment) &&
              dateKey(
                paymentDate(payment)
              ).slice(0, 7) ===
                monthKey(shopMonth)
          ),
        })
      ),
    [
      payments,
      shopId,
      shopMonth,
    ]
  );

  // ==========================================
  // DISPLAY
  // ==========================================

  return (
    <section className="tlba-root">
      <style>{css}</style>

      {error && (
        <div
          className="tlba-error"
          role="alert"
        >
          {error}
        </div>
      )}

      {truncated && (
        <div
          className="tlba-error"
          role="status"
        >
          BANKING HISTORY LIMIT REACHED —
          PERIOD TOTALS MAY BE INCOMPLETE.
        </div>
      )}

      {loading ? (
        <div className="tlba-loading">
          Loading Banking...
        </div>
      ) : (
        <>
          {/* TOTALS */}

          <div className="tlba-summary">
            <Metric
              title="TOTAL BANKED"
              amount={totalBanked}
            >
              <select
                aria-label="Total banked period"
                value={period}
                onChange={(event) =>
                  setPeriod(
                    event.target.value
                  )
                }
              >
                {PERIODS.map(
                  ([value, label]) => (
                    <option
                      key={value}
                      value={value}
                    >
                      {label}
                    </option>
                  )
                )}
              </select>
            </Metric>

            <Metric
              title="PENDING CONFIRMATION"
              amount={pendingAmount}
              variant="amber"
            />

            <Metric
              title="CONFIRMED"
              amount={confirmedAmount}
              variant="green"
            />
          </div>

          {/* BANKING */}

          <div className="tlba-layout">
            <section
              className="tlba-panel tlba-banking"
            >
              <div className="tlba-panelhead">
                <h2>Banking</h2>

                <span className="tlba-badge">
                  READ ONLY
                </span>
              </div>

              <div className="tlba-inner">
                <div className="tlba-saved">
                  <div>SAVED</div>

                  <strong>
                    KES {money(savedBalance)}
                  </strong>
                </div>

                <label htmlFor="tlba-master">
                  MASTER EMPLOYEE
                </label>

                <select
                  id="tlba-master"
                  value={bankingEmployeeId}
                  onChange={(event) =>
                    setBankingEmployeeId(
                      event.target.value
                    )
                  }
                >
                  <option value="">
                    Select employee
                  </option>

                  {activeEmployees.map(
                    (employee) => (
                      <option
                        key={
                          employee.employee_id
                        }
                        value={
                          employee.employee_id
                        }
                      >
                        {labelForPerson(
                          employee,
                          shops
                        )}
                      </option>
                    )
                  )}
                </select>
              </div>
            </section>

            {/* SHOP PAYMENT STATUS */}

            <div className="tlba-right">
              <section className="tlba-panel">
                <div className="tlba-panelhead">
                  <h2>
                    Shop Monthly Payment Status
                  </h2>

                  <span className="tlba-badge">
                    READ ONLY
                  </span>
                </div>

                <div className="tlba-inner">
                  <label htmlFor="tlba-month">
                    MONTH
                  </label>

                  <select
                    id="tlba-month"
                    value={shopMonth}
                    onChange={(event) =>
                      setShopMonth(
                        event.target.value
                      )
                    }
                  >
                    <option value="this_month">
                      This Month
                    </option>

                    <option value="last_month">
                      Last Month
                    </option>
                  </select>

                  <label htmlFor="tlba-shop">
                    SHOP
                  </label>

                  <select
                    id="tlba-shop"
                    value={shopId}
                    onChange={(event) =>
                      setShopId(
                        event.target.value
                      )
                    }
                  >
                    <option value="">
                      Select shop
                    </option>

                    {shops.map(
                      (shop) => (
                        <option
                          key={shop.id}
                          value={shop.id}
                        >
                          {shop.name}
                        </option>
                      )
                    )}
                  </select>

                  <div className="tlba-monthlist">
                    {monthPayments.map(
                      ({
                        category,
                        paid,
                      }) => (
                        <div
                          key={category}
                          className="tlba-monthrow"
                        >
                          <strong>
                            {category === "DSTV"
                              ? "DStv"
                              : category === "RENT"
                              ? "Rent"
                              : "Electricity"}
                          </strong>

                          <span
                            className={`tlba-status ${
                              !shopId
                                ? "unknown"
                                : paid
                                ? "paid"
                                : "notpaid"
                            }`}
                          >
                            {!shopId
                              ? "SELECT SHOP"
                              : paid
                              ? "PAID"
                              : truncated
                              ? "UNVERIFIED"
                              : "NOT PAID"}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </section>

              {/* EMPLOYEE BANKING DETAILS */}

              <section className="tlba-panel">
                <div className="tlba-panelhead">
                  <h2>
                    Employee Banking Details
                  </h2>

                  <span className="tlba-badge">
                    READ ONLY
                  </span>
                </div>

                <div className="tlba-inner">
                  <label htmlFor="tlba-details-employee">
                    EMPLOYEE
                  </label>

                  <select
                    id="tlba-details-employee"
                    value={detailsEmployeeId}
                    onChange={(event) => {
                      setDetailsEmployeeId(
                        event.target.value
                      );

                      setStatementOpen(true);
                    }}
                  >
                    <option value="">
                      Select employee
                    </option>

                    {activeEmployees.map(
                      (employee) => (
                        <option
                          key={
                            employee.employee_id
                          }
                          value={
                            employee.employee_id
                          }
                        >
                          {labelForPerson(
                            employee,
                            shops
                          )}
                        </option>
                      )
                    )}
                  </select>

                  <div className="tlba-statement-controls">
                    <select
                      aria-label="Employee statement period"
                      value={detailsPeriod}
                      onChange={(event) =>
                        setDetailsPeriod(
                          event.target.value
                        )
                      }
                    >
                      {PERIODS.map(
                        ([value, label]) => (
                          <option
                            key={value}
                            value={value}
                          >
                            {label}
                          </option>
                        )
                      )}
                    </select>

                    <button
                      type="button"
                      aria-expanded={statementOpen}
                      onClick={() =>
                        setStatementOpen(
                          (value) => !value
                        )
                      }
                    >
                      STATEMENT{" "}
                      {statementOpen
                        ? "▲"
                        : "▼"}
                    </button>
                  </div>

                  {statementOpen && (
                    <div className="tlba-tablewrap">
                      <table>
                        <thead>
                          <tr>
                            <th>DATE</th>
                            <th>TIME</th>
                            <th>CODE</th>
                            <th>AMOUNT (KES)</th>
                          </tr>
                        </thead>

                        <tbody>
                          {!detailsEmployeeId ? (
                            <tr>
                              <td colSpan={4}>
                                Select employee
                              </td>
                            </tr>
                          ) : statementRows.length ===
                            0 ? (
                            <tr>
                              <td colSpan={4}>
                                No confirmed banking
                              </td>
                            </tr>
                          ) : (
                            statementRows.map(
                              (payment) => (
                                <tr
                                  key={payment.id}
                                >
                                  <td>
                                    {displayDate(
                                      paymentDate(
                                        payment
                                      )
                                    )}
                                  </td>

                                  <td>
                                    {localTime(
                                      paymentDate(
                                        payment
                                      )
                                    )}
                                  </td>

                                  <td>
                                    {payment.payment_reference ||
                                      payment.external_transaction_id ||
                                      "—"}
                                  </td>

                                  <td className="tlba-positive">
                                    +{" "}
                                    {money(
                                      payment.amount
                                    )}
                                  </td>
                                </tr>
                              )
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="tlba-total">
                    <div>
                      TOTAL AMOUNT
                    </div>

                    <strong>
                      KES {money(statementTotal)}
                    </strong>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

// ============================================
// NAVY / GOLD STYLES
// ============================================

const css = `
.tlba-root {
  color: #f1f6fd;
  background: #061526;
  border-radius: 13px;
  padding: 14px;
  font: 600 14px Inter, ui-sans-serif,
    system-ui, sans-serif;
  box-sizing: border-box;
}

.tlba-root * {
  box-sizing: border-box;
}

.tlba-summary {
  display: grid;
  grid-template-columns:
    repeat(3, minmax(0, 1fr));
  gap: 13px;
  margin-bottom: 15px;
}

.tlba-metric {
  min-width: 0;
  padding: 20px;
  background:
    linear-gradient(110deg, #073e37, #06252e);
  border: 1px solid #158570;
  border-radius: 9px;
}

.tlba-metric.amber {
  background:
    linear-gradient(110deg, #54321f, #201d22);
  border-color: #b57c2b;
}

.tlba-metric.green {
  background:
    linear-gradient(110deg, #073e37, #06252e);
  border-color: #158570;
}

.tlba-metric-label {
  font-size: 14px;
  font-weight: 800;
  letter-spacing: .03em;
}

.tlba-metric-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-top: 9px;
  flex-wrap: wrap;
}

.tlba-metric-content strong {
  font-size: clamp(19px, 2vw, 27px);
  color: #ffdb68;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.tlba-metric.green strong {
  color: #78edb9;
}

.tlba-root select {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid #b38b36;
  background: #081b30;
  color: #f7f9fc;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.tlba-root option {
  background: #07172c;
  color: #fff;
}

.tlba-metric select {
  width: auto;
  max-width: 165px;
  border-color: #435e82;
}

.tlba-layout {
  display: grid;
  grid-template-columns:
    minmax(0, 1.12fr)
    minmax(0, 1fr);
  gap: 15px;
  align-items: start;
}

.tlba-right {
  display: grid;
  gap: 15px;
  min-width: 0;
}

.tlba-panel {
  min-width: 0;
  border: 2px solid #d3af47;
  border-radius: 12px;
  padding: 16px;
  background: #06172d;
}

.tlba-panelhead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.tlba-panelhead h2 {
  margin: 0;
  color: #ffdc6a;
  font-size: clamp(17px, 1.65vw, 24px);
  font-weight: 850;
}

.tlba-badge {
  color: #d8e7fb;
  background: #132d4a;
  border: 1px solid #345378;
  padding: 7px 9px;
  border-radius: 7px;
  font-size: 12px;
  white-space: nowrap;
}

.tlba-inner {
  background: #081e35;
  border: 1px solid #21496e;
  border-radius: 8px;
  padding: 12px;
  display: grid;
  gap: 9px;
  min-width: 0;
}

.tlba-inner label {
  font-size: 13px;
  font-weight: 850;
  color: #d9e3ee;
  margin-top: 7px;
}

.tlba-saved {
  display: grid;
  gap: 7px;
  padding: 16px;
  background: #061527;
  border: 1px solid #1a3857;
  border-radius: 8px;
  margin-bottom: 10px;
}

.tlba-saved strong {
  font-size: 28px;
  color: #ffda67;
}

.tlba-monthlist {
  display: grid;
  gap: 7px;
  margin-top: 8px;
}

.tlba-monthrow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: #071b31;
  border: 1px solid #235077;
  border-radius: 8px;
  padding: 9px 12px;
  min-height: 56px;
  font-size: 16px;
}

.tlba-status {
  display: inline-block;
  min-width: 116px;
  text-align: center;
  border-radius: 6px;
  padding: 10px 11px;
  color: white;
  font-size: 13px;
  font-weight: 850;
  white-space: nowrap;
}

.tlba-status.paid {
  background: #079b69;
}

.tlba-status.notpaid {
  background: #d53138;
}

.tlba-status.unknown {
  background: #36506c;
}

.tlba-statement-controls {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 6px;
}

.tlba-statement-controls select {
  flex: 1;
}

.tlba-statement-controls button {
  min-height: 44px;
  padding: 10px 14px;
  white-space: nowrap;
  background: #173d61;
  color: white;
  border: 1px solid #426a94;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 850;
  cursor: pointer;
}

.tlba-tablewrap {
  width: 100%;
  overflow-x: auto;
}

.tlba-tablewrap table {
  border-collapse: collapse;
  width: 100%;
  min-width: 415px;
  font-size: 13px;
}

.tlba-tablewrap th {
  color: #d8e5f3;
  text-align: left;
  background: #123857;
  padding: 11px 9px;
  border: 1px solid #265176;
  white-space: nowrap;
}

.tlba-tablewrap td {
  border: 1px solid #25425f;
  padding: 10px 9px;
  overflow-wrap: anywhere;
}

.tlba-tablewrap td:last-child,
.tlba-tablewrap th:last-child {
  text-align: right;
  white-space: nowrap;
}

.tlba-positive {
  color: #50e7a3;
  font-weight: 850;
}

.tlba-total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  background: #073a36;
  border: 1px solid #147c67;
  border-radius: 8px;
  padding: 15px;
  margin-top: 4px;
  color: #ffdc6b;
  font-size: 17px;
  font-weight: 850;
}

.tlba-total strong {
  font-size: clamp(19px, 2.3vw, 29px);
  font-variant-numeric: tabular-nums;
}

.tlba-loading {
  padding: 40px;
  text-align: center;
}

.tlba-error {
  padding: 13px 16px;
  margin-bottom: 12px;
  background: #51232d;
  border: 1px solid #b54c57;
  color: #ffd6dc;
  border-radius: 8px;
  font-weight: 800;
}

@media (max-width: 1000px) {
  .tlba-layout {
    grid-template-columns: 1fr;
  }

  .tlba-summary {
    grid-template-columns:
      repeat(auto-fit, minmax(230px, 1fr));
  }
}

@media (max-width: 550px) {
  .tlba-root {
    padding: 9px;
  }

  .tlba-panel {
    padding: 10px;
  }

  .tlba-metric {
    padding: 13px;
  }

  .tlba-statement-controls {
    flex-wrap: wrap;
  }

  .tlba-statement-controls button {
    flex: 1;
  }

  .tlba-metric select {
    max-width: none;
    width: 100%;
  }
}
`;
