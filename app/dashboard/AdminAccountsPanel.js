"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

export default function AdminAccountantPanel({
  user,
}) {
  const [
    selectedDate,
    setSelectedDate,
  ] = useState(
    () =>
      getNairobiDateInput()
  );

  const [
    snapshot,
    setSnapshot,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    showTransactions,
    setShowTransactions,
  ] = useState(true);

  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env
      .NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const accessToken =
    user?.access_token ||
    null;

  // ==================================================
  // LOAD ACCOUNTANT ADMIN SNAPSHOT
  // ==================================================

  const loadSnapshot =
    useCallback(
      async (
        quiet = false
      ) => {
        if (
          !selectedDate ||
          !accessToken ||
          !supabaseUrl ||
          !supabaseAnonKey
        ) {
          setLoading(false);
          return;
        }

        try {
          if (!quiet) {
            setLoading(true);
          }

          setError("");

          const response =
            await fetch(
              `${supabaseUrl}/rest/v1/rpc/tl_admin_accountant_snapshot`,
              {
                method:
                  "POST",

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
                    p_report_date:
                      selectedDate,
                  }),

                cache:
                  "no-store",
              }
            );

          const result =
            await safeJson(
              response
            );

          if (
            !response.ok
          ) {
            throw new Error(
              result?.message ||
                result?.details ||
                result?.hint ||
                "Unable to load Accountant information."
            );
          }

          setSnapshot(
            result || null
          );
        } catch (error) {
          console.error(
            "ADMIN ACCOUNTANT PANEL ERROR:",
            error
          );

          setError(
            error?.message ||
              "Unable to load Accountant information."
          );
        } finally {
          if (!quiet) {
            setLoading(false);
          }
        }
      },
      [
        selectedDate,
        accessToken,
        supabaseUrl,
        supabaseAnonKey,
      ]
    );

  // ==================================================
  // AUTO REFRESH
  // ==================================================

  useEffect(() => {
    loadSnapshot();

    const timer =
      setInterval(
        () => {
          loadSnapshot(
            true
          );
        },
        5000
      );

    return () => {
      clearInterval(
        timer
      );
    };
  }, [
    loadSnapshot,
  ]);

  // ==================================================
  // DATA
  // ==================================================

  const report =
    snapshot?.report ||
    null;

  const expenses =
    Array.isArray(
      snapshot?.expenses
    )
      ? snapshot.expenses
      : [];

  const transactions =
    Array.isArray(
      snapshot?.transactions
    )
      ? snapshot.transactions
      : [];

  const accountants =
    Array.isArray(
      snapshot?.accountants
    )
      ? snapshot.accountants
      : [];

  // ==================================================
  // 20 ACCOUNTANT EXPENSE POSITIONS
  // ==================================================

  const expenseSlots =
    useMemo(() => {
      const map =
        new Map();

      for (
        const expense
        of expenses
      ) {
        const slot =
          Number(
            expense?.slot_number
          );

        if (
          Number.isInteger(
            slot
          ) &&
          slot >= 1 &&
          slot <= 20
        ) {
          map.set(
            slot,
            expense
          );
        }
      }

      return Array.from(
        {
          length:
            20,
        },

        (
          _,
          index
        ) => {
          const slot =
            index + 1;

          return {
            slot,
            expense:
              map.get(
                slot
              ) ||
              null,
          };
        }
      );
    }, [
      expenses,
    ]);

  const savedExpenseCount =
    expenses.length;

  const calculatedExpenseTotal =
    roundMoney(
      expenses.reduce(
        (
          sum,
          expense
        ) =>
          sum +
          Number(
            expense?.amount ??
              0
          ),
        0
      )
    );

  // ==================================================
  // DISPLAY
  // ==================================================

  return (
    <section
      style={
        pageStyle
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
            ACCOUNTANT CONTROL
          </div>

          <div
            style={
              subtitleStyle
            }
          >
            Admin monitoring • Float • Returns • Expenses • Controls
          </div>
        </div>

        <div
          style={
            dateControlStyle
          }
        >
          <label
            style={
              dateLabelStyle
            }
          >
            REPORT DATE
          </label>

          <input
            type="date"
            value={
              selectedDate
            }
            onChange={(
              event
            ) => {
              setSelectedDate(
                event.target.value
              );
            }}
            style={
              dateInputStyle
            }
          />

          <button
            type="button"
            onClick={() =>
              loadSnapshot()
            }
            style={
              refreshButtonStyle
            }
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div
          style={
            errorStyle
          }
        >
          {error}
        </div>
      )}

      {loading ? (
        <div
          style={
            loadingStyle
          }
        >
          Loading Accountant information...
        </div>
      ) : (
        <>
          {/* ====================================== */}
          {/* ACCOUNTANT PROFILE                    */}
          {/* ====================================== */}

          <PanelTitle
            title="ACCOUNTANT DETAILS"
          />

          <section
            style={
              panelStyle
            }
          >
            {accountants.length ===
            0 ? (
              <div
                style={
                  emptyStyle
                }
              >
                No active or inactive Accountant profile was returned.
              </div>
            ) : (
              <div
                style={
                  accountantGridStyle
                }
              >
                {accountants.map(
                  (
                    accountant
                  ) => (
                    <div
                      key={
                        accountant.id
                      }
                      style={
                        accountantCardStyle
                      }
                    >
                      <div
                        style={
                          accountantNameStyle
                        }
                      >
                        {accountant.full_name ||
                          "Accountant"}
                      </div>

                      <div>
                        Username:{" "}
                        <strong>
                          {accountant.username ||
                            "-"}
                        </strong>
                      </div>

                      <div>
                        Role:{" "}
                        <strong>
                          {accountant.role ||
                            "ACCOUNTANT"}
                        </strong>
                      </div>

                      <div>
                        Status:{" "}
                        <span
                          style={
                            accountant.is_active
                              ? activeTextStyle
                              : inactiveTextStyle
                          }
                        >
                          {accountant.is_active
                            ? "ACTIVE"
                            : "INACTIVE"}
                        </span>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </section>

          {/* ====================================== */}
          {/* DAILY REPORT                          */}
          {/* ====================================== */}

          <PanelTitle
            title="DAILY ACCOUNTANT REPORT"
          />

          <section
            style={
              panelStyle
            }
          >
            {!report ? (
              <div
                style={
                  emptyStyle
                }
              >
                No Accountant report exists for{" "}
                {formatSimpleDate(
                  selectedDate
                )}
                .
              </div>
            ) : (
              <>
                <div
                  style={
                    reportCardsStyle
                  }
                >
                  <ReportCard
                    title="REPORT DATE"
                    value={
                      formatSimpleDate(
                        report.report_date
                      )
                    }
                    moneyValue={
                      false
                    }
                  />

                  <ReportCard
                    title="BALANCE B/F"
                    value={
                      report.opening_balance
                    }
                  />

                  <ReportCard
                    title="FLOAT SENT"
                    value={
                      report.total_float_sent
                    }
                  />

                  <ReportCard
                    title="FLOAT RECEIVED"
                    value={
                      report.total_float_received
                    }
                  />

                  <ReportCard
                    title="TRANSACTION FEES"
                    value={
                      report.total_transaction_fees
                    }
                  />

                  <ReportCard
                    title="ACCOUNTANT EXPENSES"
                    value={
                      report.total_expenses
                    }
                    tone="red"
                  />

                  <ReportCard
                    title="CLOSING BALANCE"
                    value={
                      report.closing_balance
                    }
                    tone="green"
                  />
                </div>

                <div
                  style={
                    reportFooterStyle
                  }
                >
                  <div>
                    Status:{" "}
                    <StatusBadge
                      value={
                        report.status
                      }
                    />
                  </div>

                  <div>
                    Opened:{" "}
                    <strong>
                      {formatDateTime(
                        report.opened_at
                      )}
                    </strong>
                  </div>

                  <div>
                    Closed:{" "}
                    <strong>
                      {formatDateTime(
                        report.closed_at
                      )}
                    </strong>
                  </div>

                  <div>
                    Close Method:{" "}
                    <strong>
                      {report.close_method ||
                        "-"}
                    </strong>
                  </div>
                </div>
              </>
            )}
          </section>

          {/* ====================================== */}
          {/* ACCOUNTANT EXPENSES                   */}
          {/* ====================================== */}

          <PanelTitle
            title="ACCOUNTANT EXPENSES"
            tone="red"
          />

          <section
            style={
              panelStyle
            }
          >
            <div
              style={
                expenseSummaryStyle
              }
            >
              <div>
                Manual positions used:{" "}
                <strong>
                  {savedExpenseCount}
                  /20
                </strong>
              </div>

              <div>
                Manual expense total:{" "}
                <strong>
                  KES{" "}
                  {money(
                    calculatedExpenseTotal
                  )}
                </strong>
              </div>

              <div>
                Daily report total:{" "}
                <strong>
                  KES{" "}
                  {money(
                    report?.total_expenses ??
                      0
                  )}
                </strong>
              </div>
            </div>

            <div
              style={
                expenseHeaderStyle
              }
            >
              <div>
                SLOT
              </div>

              <div>
                DESCRIPTION
              </div>

              <div>
                AMOUNT
              </div>

              <div>
                ENTERED
              </div>

              <div>
                STATUS
              </div>
            </div>

            {expenseSlots.map(
              ({
                slot,
                expense,
              }) => (
                <div
                  key={
                    slot
                  }
                  style={
                    expenseRowStyle
                  }
                >
                  <div
                    style={
                      centerStyle
                    }
                  >
                    {slot}
                  </div>

                  <div>
                    {expense?.description ||
                      "-"}
                  </div>

                  <div
                    style={
                      amountStyle
                    }
                  >
                    {expense
                      ? `KES ${money(
                          expense.amount
                        )}`
                      : "-"}
                  </div>

                  <div
                    style={
                      centerStyle
                    }
                  >
                    {expense
                      ? formatDateTime(
                          expense.created_at
                        )
                      : "-"}
                  </div>

                  <div
                    style={
                      centerStyle
                    }
                  >
                    {expense ? (
                      <span
                        style={
                          expense.locked
                            ? lockedStyle
                            : openStyle
                        }
                      >
                        {expense.locked
                          ? "LOCKED"
                          : "OPEN"}
                      </span>
                    ) : (
                      <span
                        style={
                          unusedStyle
                        }
                      >
                        UNUSED
                      </span>
                    )}
                  </div>
                </div>
              )
            )}

            <div
              style={
                noteStyle
              }
            >
              These are the Accountant's manual Expense 1–20 entries. This Admin screen is monitoring only.
            </div>
          </section>
{/* ====================================== */}
          {/* TRANSACTIONS                          */}
          {/* ====================================== */}

          <div
            style={
              transactionTitleWrapStyle
            }
          >
            <PanelTitle
              title="ACCOUNTANT TRANSACTIONS"
            />

            <button
              type="button"
              onClick={() => {
                setShowTransactions(
                  (
                    previous
                  ) =>
                    !previous
                );
              }}
              style={
                collapseButtonStyle
              }
            >
              {showTransactions
                ? "▲ Hide"
                : "▼ Show"}{" "}
              ({transactions.length})
            </button>
          </div>

          {showTransactions && (
            <section
              style={
                panelStyle
              }
            >
              <div
                style={
                  transactionHeaderStyle
                }
              >
                <div>
                  TIME
                </div>

                <div>
                  TRANSACTION
                </div>

                <div>
                  DIRECTION
                </div>

                <div>
                  CASHIER / RECIPIENT
                </div>

                <div>
                  AMOUNT
                </div>

                <div>
                  FEE
                </div>

                <div>
                  RECEIPT
                </div>

                <div>
                  STATUS
                </div>
              </div>

              {transactions.length ===
              0 ? (
                <div
                  style={
                    emptyStyle
                  }
                >
                  No Accountant transactions for this date.
                </div>
              ) : (
                transactions.map(
                  (
                    transaction
                  ) => (
                    <div
                      key={
                        transaction.id
                      }
                      style={
                        transactionRowStyle
                      }
                    >
                      <div
                        style={
                          smallCenterStyle
                        }
                      >
                        {formatTime(
                          transaction.created_at
                        )}
                      </div>

                      <div
                        style={
                          transactionNoStyle
                        }
                      >
                        {transaction.transaction_no ||
                          "-"}
                      </div>

                      <div
                        style={
                          centerStyle
                        }
                      >
                        {displayFlow(
                          transaction.flow
                        )}
                      </div>

                      <div>
                        {displayPerson(
                          transaction
                        )}
                      </div>

                      <div
                        style={
                          amountStyle
                        }
                      >
                        KES{" "}
                        {money(
                          transaction.amount
                        )}
                      </div>

                      <div
                        style={
                          amountStyle
                        }
                      >
                        KES{" "}
                        {money(
                          transaction.actual_fee ??
                            transaction.estimated_fee ??
                            0
                        )}
                      </div>

                      <div
                        style={
                          receiptStyle
                        }
                      >
                        {transaction.manual_receipt_no ||
                          transaction.mpesa_receipt_number ||
                          "-"}
                      </div>

                      <div
                        style={
                          centerStyle
                        }
                      >
                        <StatusBadge
                          value={
                            transaction.status
                          }
                        />
                      </div>
                    </div>
                  )
                )
              )}

              <div
                style={
                  noteStyle
                }
              >
                Both Accountant → Cashier and Cashier → Accountant movements are shown here. Receipt numbers and final transaction status remain part of the permanent transaction history.
              </div>
            </section>
          )}

          {/* ====================================== */}
          {/* ADMIN NOTICE                          */}
          {/* ====================================== */}

          <div
            style={
              adminNoticeStyle
            }
          >
            <strong>
              ADMIN MONITORING
            </strong>

            <div>
              The Accountant continues normal daily operations. Admin does not need to approve routine float returns or enter the Accountant's expenses. This screen gives Admin visibility over the report, manual expenses and transaction history.
            </div>
          </div>
        </>
      )}
    </section>
  );
}

// ==================================================
// COMPONENTS
// ==================================================

function PanelTitle({
  title,
  tone,
}) {
  return (
    <div
      style={{
        ...panelTitleStyle,

        backgroundColor:
          tone ===
          "red"
            ? "#b91c1c"
            : "#0873b9",
      }}
    >
      {title}
    </div>
  );
}

function ReportCard({
  title,
  value,
  moneyValue = true,
  tone,
}) {
  let background =
    "#f8fafc";

  let border =
    "#cbd5e1";

  if (
    tone ===
    "green"
  ) {
    background =
      "#ecfdf5";

    border =
      "#86efac";
  }

  if (
    tone ===
    "red"
  ) {
    background =
      "#fff1f2";

    border =
      "#fda4af";
  }

  return (
    <div
      style={{
        ...reportCardStyle,

        backgroundColor:
          background,

        borderColor:
          border,
      }}
    >
      <div
        style={
          reportCardTitleStyle
        }
      >
        {title}
      </div>

      <div
        style={
          reportCardValueStyle
        }
      >
        {moneyValue
          ? `KES ${money(
              value
            )}`
          : value ||
            "-"}
      </div>
    </div>
  );
}

function StatusBadge({
  value,
}) {
  const status =
    String(
      value ||
        "UNKNOWN"
    )
      .trim()
      .toUpperCase();

  let background =
    "#64748b";

  if (
    status ===
      "COMPLETED" ||
    status ===
      "CLOSED" ||
    status ===
      "OPEN"
  ) {
    background =
      "#16a34a";
  }

  if (
    status.includes(
      "PENDING"
    ) ||
    status.includes(
      "AWAITING"
    ) ||
    status ===
      "CHECKING"
  ) {
    background =
      "#f59e0b";
  }

  if (
    status ===
      "FAILED" ||
    status ===
      "CANCELLED" ||
    status ===
      "REVERSED"
  ) {
    background =
      "#dc2626";
  }

  return (
    <span
      style={{
        ...statusBadgeStyle,

        backgroundColor:
          background,
      }}
    >
      {status}
    </span>
  );
}

// ==================================================
// HELPERS
// ==================================================

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
  const numeric =
    Number(
      value ??
        0
    );

  const safe =
    Number.isFinite(
      numeric
    )
      ? numeric
      : 0;

  return safe.toLocaleString(
    "en-KE",
    {
      minimumFractionDigits:
        2,

      maximumFractionDigits:
        2,
    }
  );
}

function roundMoney(
  value
) {
  return (
    Math.round(
      (
        Number(
          value
        ) +
        Number.EPSILON
      ) *
        100
    ) / 100
  );
}

function displayFlow(
  value
) {
  const flow =
    String(
      value ||
        ""
    )
      .trim()
      .toUpperCase();

  if (
    flow ===
    "ACCOUNTANT_TO_CASHIER"
  ) {
    return "Accounts → Cashier";
  }

  if (
    flow ===
    "CASHIER_TO_ACCOUNTANT"
  ) {
    return "Cashier → Accounts";
  }

  return (
    value ||
    "-"
  );
}

function displayPerson(
  transaction
) {
  if (
    String(
      transaction?.flow ||
        ""
    ).toUpperCase() ===
    "ACCOUNTANT_TO_CASHIER"
  ) {
    return (
      transaction
        ?.recipient_name_snapshot ||
      transaction
        ?.cashier_name ||
      "-"
    );
  }

  return (
    transaction
      ?.cashier_name ||
    transaction
      ?.recipient_name_snapshot ||
    "-"
  );
}

function getNairobiDateInput() {
  const parts =
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone:
          "Africa/Nairobi",

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",
      }
    ).formatToParts(
      new Date()
    );

  const values = {};

  for (
    const part
    of parts
  ) {
    if (
      part.type !==
      "literal"
    ) {
      values[
        part.type
      ] =
        part.value;
    }
  }

  return `${values.year}-${values.month}-${values.day}`;
}

function formatSimpleDate(
  value
) {
  if (!value) {
    return "-";
  }

  const date =
    new Date(
      `${value}T12:00:00`
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone:
        "Africa/Nairobi",

      day:
        "2-digit",

      month:
        "short",

      year:
        "numeric",
    }
  ).format(
    date
  );
}

function formatDateTime(
  value
) {
  if (!value) {
    return "-";
  }

  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "-";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone:
        "Africa/Nairobi",

      day:
        "2-digit",

      month:
        "short",

      year:
        "numeric",

      hour:
        "2-digit",

      minute:
        "2-digit",
    }
  ).format(
    date
  );
}

function formatTime(
  value
) {
  if (!value) {
    return "-";
  }

  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "-";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone:
        "Africa/Nairobi",

      hour:
        "2-digit",

      minute:
        "2-digit",
    }
  ).format(
    date
  );
}

// ==================================================
// STYLES
// ==================================================

const pageStyle = {
  width:
    "100%",

  boxSizing:
    "border-box",

  fontFamily:
    "Arial, sans-serif",

  color:
    "#0f172a",
};

const titleBarStyle = {
  display:
    "flex",

  justifyContent:
    "space-between",

  alignItems:
    "center",

  gap:
    "12px",

  flexWrap:
    "wrap",

  backgroundColor:
    "#063c63",

  color:
    "white",

  padding:
    "14px",

  borderRadius:
    "7px",

  marginBottom:
    "10px",
};

const titleStyle = {
  fontSize:
    "20px",

  fontWeight:
    "900",
};

const subtitleStyle = {
  fontSize:
    "10px",

  marginTop:
    "4px",

  letterSpacing:
    "0.5px",
};

const dateControlStyle = {
  display:
    "flex",

  gap:
    "7px",

  alignItems:
    "center",

  flexWrap:
    "wrap",
};

const dateLabelStyle = {
  fontSize:
    "10px",

  fontWeight:
    "bold",
};

const dateInputStyle = {
  padding:
    "8px",

  borderRadius:
    "5px",

  border:
    "1px solid #cbd5e1",
};

const refreshButtonStyle = {
  padding:
    "8px 14px",

  border:
    "none",

  borderRadius:
    "5px",

  backgroundColor:
    "#16a34a",

  color:
    "white",

  fontWeight:
    "bold",

  cursor:
    "pointer",
};

const panelTitleStyle = {
  color:
    "white",

  padding:
    "9px 12px",

  fontWeight:
    "bold",

  borderRadius:
    "6px 6px 0 0",

  marginTop:
    "10px",
};

const panelStyle = {
  backgroundColor:
    "white",

  border:
    "1px solid #e2e8f0",

  borderTop:
    "none",

  borderRadius:
    "0 0 6px 6px",

  overflow:
    "hidden",

  marginBottom:
    "10px",
};

const accountantGridStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "repeat(auto-fit, minmax(220px, 1fr))",

  gap:
    "8px",

  padding:
    "10px",
};

const accountantCardStyle = {
  backgroundColor:
    "#f8fafc",

  border:
    "1px solid #cbd5e1",

  borderRadius:
    "6px",

  padding:
    "10px",

  fontSize:
    "11px",

  lineHeight:
    "1.8",
};

const accountantNameStyle = {
  fontSize:
    "14px",

  fontWeight:
    "bold",

  color:
    "#063c63",

  marginBottom:
    "5px",
};

const activeTextStyle = {
  color:
    "#15803d",

  fontWeight:
    "bold",
};

const inactiveTextStyle = {
  color:
    "#b91c1c",

  fontWeight:
    "bold",
};

// ==================================================
// DAILY REPORT
// ==================================================

const reportCardsStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "repeat(7, minmax(120px, 1fr))",

  gap:
    "7px",

  padding:
    "10px",

  overflowX:
    "auto",
};

const reportCardStyle = {
  border:
    "1px solid #cbd5e1",

  borderRadius:
    "6px",

  padding:
    "10px",

  minWidth:
    "105px",
};

const reportCardTitleStyle = {
  color:
    "#64748b",

  fontSize:
    "9px",

  fontWeight:
    "bold",

  marginBottom:
    "5px",
};

const reportCardValueStyle = {
  color:
    "#0f172a",

  fontSize:
    "14px",

  fontWeight:
    "bold",
};

const reportFooterStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "repeat(4, minmax(0, 1fr))",

  gap:
    "8px",

  padding:
    "10px",

  borderTop:
    "1px solid #e2e8f0",

  backgroundColor:
    "#f8fafc",

  fontSize:
    "10px",
};

// ==================================================
// EXPENSES
// ==================================================

const expenseSummaryStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "repeat(3, minmax(0, 1fr))",

  gap:
    "8px",

  padding:
    "10px",

  backgroundColor:
    "#fff7ed",

  borderBottom:
    "1px solid #fed7aa",

  fontSize:
    "11px",
};

const expenseHeaderStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "55px minmax(180px, 2fr) minmax(100px, 1fr) minmax(130px, 1fr) 90px",

  gap:
    "6px",

  padding:
    "8px",

  backgroundColor:
    "#fee2e2",

  color:
    "#7f1d1d",

  fontSize:
    "9px",

  fontWeight:
    "bold",

  textAlign:
    "center",
};

const expenseRowStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "55px minmax(180px, 2fr) minmax(100px, 1fr) minmax(130px, 1fr) 90px",

  gap:
    "6px",

  alignItems:
    "center",

  padding:
    "7px 8px",

  borderTop:
    "1px solid #e5e7eb",

  fontSize:
    "10px",
};

const centerStyle = {
  textAlign:
    "center",
};

const amountStyle = {
  textAlign:
    "right",

  fontWeight:
    "bold",
};

const lockedStyle = {
  display:
    "inline-block",

  padding:
    "4px 7px",

  borderRadius:
    "4px",

  backgroundColor:
    "#dcfce7",

  color:
    "#166534",

  fontSize:
    "9px",

  fontWeight:
    "bold",
};

const openStyle = {
  display:
    "inline-block",

  padding:
    "4px 7px",

  borderRadius:
    "4px",

  backgroundColor:
    "#fef3c7",

  color:
    "#92400e",

  fontSize:
    "9px",

  fontWeight:
    "bold",
};

const unusedStyle = {
  display:
    "inline-block",

  padding:
    "4px 7px",

  borderRadius:
    "4px",

  backgroundColor:
    "#f1f5f9",

  color:
    "#64748b",

  fontSize:
    "9px",

  fontWeight:
    "bold",
};

const noteStyle = {
  padding:
    "8px 10px",

  borderTop:
    "1px solid #e2e8f0",

  color:
    "#64748b",

  backgroundColor:
    "#f8fafc",

  fontSize:
    "9px",

  textAlign:
    "center",
};

// ==================================================
// TRANSACTIONS
// ==================================================

const transactionTitleWrapStyle = {
  position:
    "relative",

  marginTop:
    "10px",
};

const collapseButtonStyle = {
  position:
    "absolute",

  right:
    "8px",

  top:
    "5px",

  border:
    "1px solid rgba(255,255,255,0.7)",

  backgroundColor:
    "rgba(255,255,255,0.15)",

  color:
    "white",

  borderRadius:
    "4px",

  padding:
    "4px 9px",

  fontSize:
    "9px",

  fontWeight:
    "bold",

  cursor:
    "pointer",
};

const transactionHeaderStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "70px 1.15fr 1fr 1.2fr 0.8fr 0.7fr 1fr 1fr",

  gap:
    "6px",

  padding:
    "8px",

  backgroundColor:
    "#e0f2fe",

  color:
    "#0c4a6e",

  fontSize:
    "8px",

  fontWeight:
    "bold",

  textAlign:
    "center",

  minWidth:
    "900px",
};

const transactionRowStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "70px 1.15fr 1fr 1.2fr 0.8fr 0.7fr 1fr 1fr",

  gap:
    "6px",

  alignItems:
    "center",

  padding:
    "7px 8px",

  borderTop:
    "1px solid #e2e8f0",

  fontSize:
    "9px",

  minWidth:
    "900px",
};

const smallCenterStyle = {
  textAlign:
    "center",

  fontSize:
    "9px",
};

const transactionNoStyle = {
  fontWeight:
    "bold",

  wordBreak:
    "break-word",
};

const receiptStyle = {
  textAlign:
    "center",

  fontFamily:
    "monospace",

  fontWeight:
    "bold",

  fontSize:
    "9px",

  wordBreak:
    "break-all",
};

const statusBadgeStyle = {
  display:
    "inline-block",

  color:
    "white",

  borderRadius:
    "999px",

  padding:
    "4px 7px",

  fontSize:
    "8px",

  fontWeight:
    "bold",

  whiteSpace:
    "nowrap",
};

// ==================================================
// GENERAL
// ==================================================

const emptyStyle = {
  padding:
    "22px",

  textAlign:
    "center",

  color:
    "#64748b",

  fontSize:
    "11px",
};

const loadingStyle = {
  backgroundColor:
    "white",

  padding:
    "30px",

  textAlign:
    "center",

  color:
    "#64748b",

  borderRadius:
    "6px",

  border:
    "1px solid #e2e8f0",
};

const errorStyle = {
  padding:
    "10px",

  marginBottom:
    "10px",

  backgroundColor:
    "#fee2e2",

  color:
    "#991b1b",

  border:
    "1px solid #fecaca",

  borderRadius:
    "5px",

  fontSize:
    "11px",
};

const adminNoticeStyle = {
  backgroundColor:
    "#eff6ff",

  color:
    "#1e3a8a",

  border:
    "1px solid #bfdbfe",

  borderRadius:
    "6px",

  padding:
    "12px",

  marginTop:
    "10px",

  marginBottom:
    "12px",

  fontSize:
    "10px",

  lineHeight:
    "1.7",
};
