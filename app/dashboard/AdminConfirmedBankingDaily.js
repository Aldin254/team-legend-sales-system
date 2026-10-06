"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

const REFRESH_MS = 10000;

export default function AdminConfirmedBankingDaily({
  user,
}) {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const accessToken =
    user?.access_token || null;

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [dates, setDates] =
    useState({
      today: "",
      yesterday: "",
      week_start: "",
    });

  const [summary, setSummary] =
    useState({
      today_amount: 0,
      today_count: 0,
      yesterday_amount: 0,
      yesterday_count: 0,
      this_week_amount: 0,
    });

  const [daily, setDaily] =
    useState([]);

  const [recent, setRecent] =
    useState([]);

  // ============================================================
  // LOAD
  // ============================================================

  const loadData =
    useCallback(
      async (
        silent = false
      ) => {
        if (
          !supabaseUrl ||
          !supabaseAnonKey ||
          !accessToken
        ) {
          setLoading(false);
          return;
        }

        try {
          if (!silent) {
            setRefreshing(true);
          }

          setError("");

          const response =
            await fetch(
              `${supabaseUrl}/rest/v1/rpc/tl_admin_confirmed_banking_daily`,
              {
                method: "POST",

                headers: {
                  apikey:
                    supabaseAnonKey,

                  Authorization:
                    `Bearer ${accessToken}`,

                  "Content-Type":
                    "application/json",
                },

                body:
                  JSON.stringify({
                    p_days_back:
                      30,
                  }),

                cache:
                  "no-store",
              }
            );

          const result =
            await safeJson(
              response
            );

          if (!response.ok) {
            throw new Error(
              result?.message ||
                result?.details ||
                result?.hint ||
                "Unable to load confirmed Banking history."
            );
          }

          setDates({
            today:
              result?.today ||
              "",

            yesterday:
              result?.yesterday ||
              "",

            week_start:
              result?.week_start ||
              "",
          });

          setSummary({
            today_amount:
              Number(
                result
                  ?.summary
                  ?.today_amount ||
                  0
              ),

            today_count:
              Number(
                result
                  ?.summary
                  ?.today_count ||
                  0
              ),

            yesterday_amount:
              Number(
                result
                  ?.summary
                  ?.yesterday_amount ||
                  0
              ),

            yesterday_count:
              Number(
                result
                  ?.summary
                  ?.yesterday_count ||
                  0
              ),

            this_week_amount:
              Number(
                result
                  ?.summary
                  ?.this_week_amount ||
                  0
              ),
          });

          setDaily(
            Array.isArray(
              result?.daily
            )
              ? result.daily
              : []
          );

          setRecent(
            Array.isArray(
              result?.recent
            )
              ? result.recent
              : []
          );
        } catch (err) {
          console.error(
            "CONFIRMED BANKING DAILY ERROR:",
            err
          );

          setError(
            err?.message ||
              "Unable to load confirmed Banking history."
          );
        } finally {
          setLoading(false);

          if (!silent) {
            setRefreshing(false);
          }
        }
      },
      [
        supabaseUrl,
        supabaseAnonKey,
        accessToken,
      ]
    );

  // ============================================================
  // AUTO REFRESH
  // ============================================================

  useEffect(() => {
    loadData();

    const timer =
      setInterval(
        () => {
          loadData(true);
        },
        REFRESH_MS
      );

    return () => {
      clearInterval(timer);
    };
  }, [loadData]);

  // ============================================================
  // DISPLAY
  // ============================================================

  return (
    <section
      style={
        panelStyle
      }
    >
      <div
        style={
          titleBarStyle
        }
      >
        <div>
          <div
            style={
              titleStyle
            }
          >
            CONFIRMED BANKING BY DAY
          </div>

          <div
            style={
              subtitleStyle
            }
          >
            Accountant-confirmed employee Banking grouped by Kenya confirmation date.
          </div>
        </div>

        <button
          type="button"
          disabled={
            refreshing
          }
          onClick={() =>
            loadData()
          }
          style={{
            ...refreshButtonStyle,

            opacity:
              refreshing
                ? 0.6
                : 1,
          }}
        >
          {refreshing
            ? "Refreshing..."
            : "Refresh"}
        </button>
      </div>

      <div
        style={
          noticeStyle
        }
      >
        Read-only reporting. This section does not change Savings, Expenses, Added Float, Closing Balance or weekly targets.
      </div>

      {error && (
        <div
          style={
            errorStyle
          }
        >
          Banking history could not load: {error}
        </div>
      )}

      {loading ? (
        <div
          style={
            loadingStyle
          }
        >
          Loading confirmed Banking...
        </div>
      ) : (
        <>
          {/* ================================================= */}
          {/* SUMMARY */}
          {/* ================================================= */}

          <div
            style={
              summaryGridStyle
            }
          >
            <SummaryCard
              label={`TODAY • ${formatDate(
                dates.today
              )}`}
              amount={
                summary.today_amount
              }
              sub={`${summary.today_count} confirmed transaction${
                summary.today_count ===
                1
                  ? ""
                  : "s"
              }`}
              success
            />

            <SummaryCard
              label={`YESTERDAY • ${formatDate(
                dates.yesterday
              )}`}
              amount={
                summary.yesterday_amount
              }
              sub={`${summary.yesterday_count} confirmed transaction${
                summary.yesterday_count ===
                1
                  ? ""
                  : "s"
              }`}
            />

            <SummaryCard
              label="THIS WEEK"
              amount={
                summary.this_week_amount
              }
              sub={`From ${formatDate(
                dates.week_start
              )}`}
            />
          </div>

          {/* ================================================= */}
          {/* DAILY HISTORY */}
          {/* ================================================= */}

          <div
            style={
              sectionStyle
            }
          >
            <div
              style={
                sectionTitleStyle
              }
            >
              DAILY BANKING HISTORY
            </div>

            {daily.length ===
            0 ? (
              <div
                style={
                  emptyStyle
                }
              >
                No confirmed Banking history yet.
              </div>
            ) : (
              <div
                style={
                  tableWrapStyle
                }
              >
                <table
                  style={
                    tableStyle
                  }
                >
                  <thead>
                    <tr>
                      <TableHead>
                        Date
                      </TableHead>

                      <TableHead
                        right
                      >
                        Transactions
                      </TableHead>

                      <TableHead
                        right
                      >
                        Confirmed Banking
                      </TableHead>
                    </tr>
                  </thead>

                  <tbody>
                    {daily
  .filter(
    (item) =>
      item.is_today ||
      item.is_yesterday ||
      Number(item.confirmed_count || 0) > 0
  )
  .map(
                      (
                        item
                      ) => (
                        <tr
                          key={
                            item.banking_date
                          }
                        >
                          <TableCell>
                            <strong>
                              {formatDate(
                                item.banking_date
                              )}
                            </strong>

                            {item.is_today && (
                              <span
                                style={
                                  todayBadgeStyle
                                }
                              >
                                TODAY
                              </span>
                            )}

                            {item.is_yesterday && (
                              <span
                                style={
                                  yesterdayBadgeStyle
                                }
                              >
                                YESTERDAY
                              </span>
                            )}
                          </TableCell>

                          <TableCell
                            right
                          >
                            {Number(
                              item.confirmed_count ||
                                0
                            )}
                          </TableCell>

                          <TableCell
                            right
                          >
                            <strong>
                              KES{" "}
                              {money(
                                item.confirmed_amount
                              )}
                            </strong>
                          </TableCell>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ================================================= */}
          {/* RECENT CONFIRMED */}
          {/* ================================================= */}

          <div
            style={
              sectionStyle
            }
          >
            <div
              style={
                sectionTitleStyle
              }
            >
              RECENT CONFIRMED BANKING
            </div>

            {recent.length ===
            0 ? (
              <div
                style={
                  emptyStyle
                }
              >
                No confirmed Banking transactions yet.
              </div>
            ) : (
              <div
                style={
                  tableWrapStyle
                }
              >
                <table
                  style={{
                    ...tableStyle,

                    minWidth:
                      "800px",
                  }}
                >
                  <thead>
                    <tr>
                      <TableHead>
                        Confirmed
                      </TableHead>

                      <TableHead>
                        Employee
                      </TableHead>

                      <TableHead>
                        Shop
                      </TableHead>

                      <TableHead
                        right
                      >
                        Amount
                      </TableHead>

                      <TableHead>
                        Reference
                      </TableHead>

                      <TableHead>
                        Method
                      </TableHead>
                    </tr>
                  </thead>

                  <tbody>
                    {recent.map(
                      (
                        item
                      ) => (
                        <tr
                          key={
                            item.id
                          }
                        >
                          <TableCell>
                            {formatDateTime(
                              item.confirmed_at
                            )}
                          </TableCell>

                          <TableCell>
                            <strong>
                              {item.employee_name ||
                                "-"}
                            </strong>
                          </TableCell>

                          <TableCell>
                            {item.shop_name ||
                              "-"}
                          </TableCell>

                          <TableCell
                            right
                          >
                            <strong>
                              KES{" "}
                              {money(
                                item.amount
                              )}
                            </strong>
                          </TableCell>

                          <TableCell>
                            {item.payment_reference ||
                              item.external_transaction_id ||
                              "-"}
                          </TableCell>

                          <TableCell>
                            {item.payment_provider ||
                              item.payment_method ||
                              "-"}
                          </TableCell>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

// ============================================================
// SMALL COMPONENTS
// ============================================================

function SummaryCard({
  label,
  amount,
  sub,
  success = false,
}) {
  return (
    <div
      style={{
        ...summaryCardStyle,

        ...(success
          ? summarySuccessStyle
          : {}),
      }}
    >
      <div
        style={
          summaryLabelStyle
        }
      >
        {label}
      </div>

      <div
        style={
          summaryAmountStyle
        }
      >
        KES{" "}
        {money(
          amount
        )}
      </div>

      <div
        style={
          summarySubStyle
        }
      >
        {sub}
      </div>
    </div>
  );
}

function TableHead({
  children,
  right = false,
}) {
  return (
    <th
      style={{
        ...tableHeadStyle,

        textAlign:
          right
            ? "right"
            : "left",
      }}
    >
      {children}
    </th>
  );
}

function TableCell({
  children,
  right = false,
}) {
  return (
    <td
      style={{
        ...tableCellStyle,

        textAlign:
          right
            ? "right"
            : "left",
      }}
    >
      {children}
    </td>
  );
}

// ============================================================
// HELPERS
// ============================================================

async function safeJson(
  response
) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function money(
  value
) {
  return Number(
    value || 0
  ).toLocaleString(
    "en-KE",
    {
      minimumFractionDigits:
        2,

      maximumFractionDigits:
        2,
    }
  );
}

function formatDate(
  value
) {
  if (!value) {
    return "-";
  }

  try {
    const text =
      String(
        value
      ).slice(
        0,
        10
      );

    const parts =
      text.split(
        "-"
      );

    if (
      parts.length !==
      3
    ) {
      return text;
    }

    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  } catch {
    return "-";
  }
}

function formatDateTime(
  value
) {
  if (!value) {
    return "-";
  }

  try {
    return new Intl.DateTimeFormat(
      "en-KE",
      {
        timeZone:
          "Africa/Nairobi",

        day:
          "2-digit",

        month:
          "2-digit",

        year:
          "numeric",

        hour:
          "2-digit",

        minute:
          "2-digit",

        hourCycle:
          "h23",
      }
    ).format(
      new Date(
        value
      )
    );
  } catch {
    return "-";
  }
}

// ============================================================
// STYLES
// ============================================================

const panelStyle = {
  backgroundColor:
    "white",

  border:
    "1px solid #93c5fd",

  borderRadius:
    "7px",

  overflow:
    "hidden",
};

const titleBarStyle = {
  padding:
    "11px 12px",

  backgroundColor:
    "#0369a1",

  color:
    "white",

  display:
    "flex",

  justifyContent:
    "space-between",

  alignItems:
    "center",

  gap:
    "10px",

  flexWrap:
    "wrap",
};

const titleStyle = {
  fontSize:
    "12px",

  fontWeight:
    "900",
};

const subtitleStyle = {
  marginTop:
    "3px",

  fontSize:
    "8px",

  color:
    "#dbeafe",
};

const refreshButtonStyle = {
  padding:
    "7px 10px",

  border:
    "1px solid rgba(255,255,255,0.5)",

  borderRadius:
    "4px",

  backgroundColor:
    "transparent",

  color:
    "white",

  fontSize:
    "8px",

  fontWeight:
    "bold",

  cursor:
    "pointer",
};

const noticeStyle = {
  padding:
    "8px 10px",

  backgroundColor:
    "#eff6ff",

  borderBottom:
    "1px solid #bfdbfe",

  color:
    "#1e40af",

  textAlign:
    "center",

  fontSize:
    "8px",
};

const loadingStyle = {
  padding:
    "24px",

  textAlign:
    "center",

  color:
    "#64748b",

  fontSize:
    "10px",
};

const errorStyle = {
  margin:
    "10px",

  padding:
    "9px",

  backgroundColor:
    "#fef2f2",

  border:
    "1px solid #fecaca",

  borderRadius:
    "5px",

  color:
    "#991b1b",

  fontSize:
    "9px",

  fontWeight:
    "bold",
};

const summaryGridStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "repeat(auto-fit,minmax(180px,1fr))",

  gap:
    "9px",

  padding:
    "12px",
};

const summaryCardStyle = {
  padding:
    "11px",

  border:
    "1px solid #bfdbfe",

  borderRadius:
    "6px",

  backgroundColor:
    "#eff6ff",

  color:
    "#1e3a8a",
};

const summarySuccessStyle = {
  border:
    "1px solid #86efac",

  backgroundColor:
    "#f0fdf4",

  color:
    "#166534",
};

const summaryLabelStyle = {
  fontSize:
    "8px",

  fontWeight:
    "900",
};

const summaryAmountStyle = {
  marginTop:
    "4px",

  fontSize:
    "17px",

  fontWeight:
    "900",
};

const summarySubStyle = {
  marginTop:
    "3px",

  fontSize:
    "8px",

  fontWeight:
    "bold",
};

const sectionStyle = {
  margin:
    "0 12px 12px",

  border:
    "1px solid #e2e8f0",

  borderRadius:
    "6px",

  overflow:
    "hidden",
};

const sectionTitleStyle = {
  padding:
    "8px 10px",

  backgroundColor:
    "#f8fafc",

  borderBottom:
    "1px solid #e2e8f0",

  color:
    "#334155",

  fontSize:
    "9px",

  fontWeight:
    "900",
};

const tableWrapStyle = {
  width:
    "100%",

  overflowX:
    "auto",

  maxHeight:
    "260px",

  overflowY:
    "auto",
};

const tableStyle = {
  width:
    "100%",

  minWidth:
    "520px",

  borderCollapse:
    "collapse",
};

const tableHeadStyle = {
  padding:
    "8px",

  backgroundColor:
    "#f1f5f9",

  borderBottom:
    "1px solid #cbd5e1",

  color:
    "#475569",

  fontSize:
    "8px",

  whiteSpace:
    "nowrap",

  position:
    "sticky",

  top:
    0,

  zIndex:
    1,
};

const tableCellStyle = {
  padding:
    "8px",

  borderBottom:
    "1px solid #e2e8f0",

  color:
    "#334155",

  fontSize:
    "9px",

  verticalAlign:
    "top",
};

const todayBadgeStyle = {
  display:
    "inline-block",

  marginLeft:
    "6px",

  padding:
    "2px 5px",

  borderRadius:
    "8px",

  backgroundColor:
    "#dcfce7",

  color:
    "#166534",

  fontSize:
    "6px",

  fontWeight:
    "900",
};

const yesterdayBadgeStyle = {
  display:
    "inline-block",

  marginLeft:
    "6px",

  padding:
    "2px 5px",

  borderRadius:
    "8px",

  backgroundColor:
    "#dbeafe",

  color:
    "#1d4ed8",

  fontSize:
    "6px",

  fontWeight:
    "900",
};

const emptyStyle = {
  padding:
    "18px",

  textAlign:
    "center",

  color:
    "#64748b",

  fontSize:
    "9px",
};
