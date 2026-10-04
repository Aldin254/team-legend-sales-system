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
  const [reportDate, setReportDate] =
    useState(
      getNairobiDate()
    );

  const [snapshot, setSnapshot] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const accessToken =
    user?.access_token ||
    null;

  // ==================================================
  // LOAD ADMIN ACCOUNTANT SNAPSHOT
  // ==================================================

  const loadSnapshot =
    useCallback(
      async () => {
        if (
          !accessToken ||
          !supabaseUrl ||
          !supabaseAnonKey ||
          !reportDate
        ) {
          setLoading(false);
          return;
        }

        try {
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
                      reportDate,
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
                "Unable to load Accountant information."
            );
          }

          setSnapshot(
            result &&
              typeof result ===
                "object"
              ? result
              : {}
          );
        } catch (error) {
          console.error(
            "ADMIN ACCOUNTANT SNAPSHOT ERROR:",
            error
          );

          setError(
            error?.message ||
              "Unable to load Accountant information."
          );
        } finally {
          setLoading(false);
        }
      },
      [
        accessToken,
        supabaseUrl,
        supabaseAnonKey,
        reportDate,
      ]
    );

  // ==================================================
  // AUTO REFRESH
  // ==================================================

  useEffect(() => {
    setLoading(true);

    loadSnapshot();

    const timer =
      setInterval(
        loadSnapshot,
        5000
      );

    return () => {
      clearInterval(timer);
    };
  }, [loadSnapshot]);

  // ==================================================
  // NORMALISE DATA
  // ==================================================

  const report =
    useMemo(() => {
      const raw =
        snapshot?.report;

      if (
        Array.isArray(raw)
      ) {
        return (
          raw[0] ||
          null
        );
      }

      if (
        raw &&
        typeof raw ===
          "object"
      ) {
        return raw;
      }

      return null;
    }, [snapshot]);

  const expenses =
    useMemo(
      () =>
        normaliseArray(
          snapshot?.expenses
        ),
      [
        snapshot,
      ]
    );

  const transactions =
    useMemo(
      () =>
        normaliseArray(
          snapshot?.transactions
        ),
      [
        snapshot,
      ]
    );

  const accountants =
    useMemo(
      () =>
        normaliseArray(
          snapshot?.accountants
        ),
      [
        snapshot,
      ]
    );

  // ==================================================
  // REPORT VALUES
  // ==================================================

  const openingBalance =
    numberValue(
      report?.opening_balance
    );

  const totalFloatSent =
    numberValue(
      report?.total_float_sent
    );

  const totalFloatReceived =
    numberValue(
      report?.total_float_received
    );

  const totalFees =
    numberValue(
      report?.total_transaction_fees
    );

  const totalExpenses =
    numberValue(
      report?.total_expenses
    );

  const closingBalance =
    numberValue(
      report?.closing_balance
    );

  const reportStatus =
    String(
      report?.status ||
        "NO REPORT"
    )
      .trim()
      .toUpperCase();

  // ==================================================
  // TRANSACTION GROUPS
  // ==================================================

  const cashierReturns =
    transactions.filter(
      (
        transaction
      ) =>
        String(
          transaction?.flow ||
            ""
        )
          .trim()
          .toUpperCase() ===
        "CASHIER_TO_ACCOUNTANT"
    );

  const accountantSends =
    transactions.filter(
      (
        transaction
      ) =>
        String(
          transaction?.flow ||
            ""
        )
          .trim()
          .toUpperCase() ===
        "ACCOUNTANT_TO_CASHIER"
    );

  // ==================================================
  // DISPLAY
  // ==================================================

  return (
    <div style={wrapperStyle}>
      {/* ========================================= */}
      {/* DATE CONTROL */}
      {/* ========================================= */}

      <section style={controlPanelStyle}>
        <div>
          <div style={controlTitleStyle}>
            LEGEND ACCOUNTS
          </div>

          <div style={controlSubtitleStyle}>
            Admin monitoring and audit view
          </div>
        </div>

        <div style={dateWrapStyle}>
          <label style={labelStyle}>
            Report Date
          </label>

          <input
            type="date"
            value={reportDate}
            onChange={(
              event
            ) => {
              setReportDate(
                event.target.value
              );

              setLoading(
                true
              );
            }}
            style={dateInputStyle}
          />
        </div>
      </section>

      {/* ========================================= */}
      {/* ERROR */}
      {/* ========================================= */}

      {error && (
        <div style={errorStyle}>
          {error}
        </div>
      )}

      {/* ========================================= */}
      {/* LOADING */}
      {/* ========================================= */}

      {loading &&
      !snapshot ? (
        <div style={loadingStyle}>
          Loading Legend Accounts...
        </div>
      ) : (
        <>
          {/* ===================================== */}
          {/* DAILY REPORT */}
          {/* ===================================== */}

          <section style={panelStyle}>
            <div style={panelHeaderStyle}>
              <div>
                <div style={panelTitleStyle}>
                  DAILY ACCOUNTANT REPORT
                </div>

                <div style={panelSubtitleStyle}>
                  Africa/Nairobi calendar day
                </div>
              </div>

              <div
                style={
                  reportStatus ===
                  "OPEN"
                    ? openBadgeStyle
                    : reportStatus ===
                      "CLOSED"
                    ? closedBadgeStyle
                    : neutralBadgeStyle
                }
              >
                {reportStatus}
              </div>
            </div>

            <div style={summaryGridStyle}>
              <SummaryCard
                title="REPORT DATE"
                text={
                  report?.report_date ||
                  reportDate
                }
              />

              <SummaryCard
                title="BALANCE B/F"
                amount={
                  openingBalance
                }
              />

              <SummaryCard
                title="FLOAT SENT"
                amount={
                  totalFloatSent
                }
              />

              <SummaryCard
                title="FLOAT RECEIVED"
                amount={
                  totalFloatReceived
                }
              />

              <SummaryCard
                title="TRANSACTION FEES"
                amount={
                  totalFees
                }
              />

              <SummaryCard
                title="ACCOUNTANT EXPENSES"
                amount={
                  totalExpenses
                }
              />

              <SummaryCard
                title="CLOSING BALANCE"
                amount={
                  closingBalance
                }
                strong
              />
            </div>

            <div style={reportNoteStyle}>
              This section is read-only for Admin monitoring.
              Accountant transactions and cashier-return confirmations
              continue through their normal protected workflows.
            </div>
          </section>

          {/* ===================================== */}
          {/* ACCOUNTANTS */}
          {/* ===================================== */}

          <section style={panelStyle}>
            <SectionTitle
              title="ACCOUNTANT USERS"
              subtitle="Active and configured Legend Accounts users"
            />

            {accountants.length ===
            0 ? (
              <div style={emptyStyle}>
                No Accountant users returned.
              </div>
            ) : (
              <div style={accountantGridStyle}>
                {accountants.map(
                  (
                    accountant,
                    index
                  ) => (
                    <div
                      key={
                        accountant?.id ||
                        index
                      }
                      style={accountantCardStyle}
                    >
                      <div style={accountantNameStyle}>
                        {accountant?.full_name ||
                          accountant?.name ||
                          accountant?.username ||
                          "Accountant"}
                      </div>

                      <div style={accountantDetailStyle}>
                        Role:{" "}
                        {String(
                          accountant?.role ||
                            "ACCOUNTANT"
                        ).toUpperCase()}
                      </div>

                      <div style={accountantDetailStyle}>
                        Username:{" "}
                        {accountant?.username ||
                          "-"}
                      </div>

                      <div
                        style={
                          accountant?.is_active ===
                          false
                            ? inactiveTextStyle
                            : activeTextStyle
                        }
                      >
                        {accountant?.is_active ===
                        false
                          ? "INACTIVE"
                          : "ACTIVE ✓"}
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </section>

          {/* ===================================== */}
          {/* ACCOUNTANT MANUAL EXPENSES */}
          {/* ===================================== */}

          <section style={panelStyle}>
            <SectionTitle
              title="ACCOUNTANT EXPENSES"
              subtitle="Manual expenses entered by Legend Accounts"
            />

            <div style={expenseHeaderStyle}>
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
                STATUS
              </div>

              <div>
                TIME
              </div>
            </div>

            {expenses.length ===
            0 ? (
              <div style={emptyStyle}>
                No Accountant expenses for this date.
              </div>
            ) : (
              expenses.map(
                (
                  expense,
                  index
                ) => (
                  <div
                    key={
                      expense?.id ||
                      index
                    }
                    style={expenseRowStyle}
                  >
                    <div style={centerStyle}>
                      {expense?.slot_number ??
                        index +
                          1}
                    </div>

                    <div style={descriptionStyle}>
                      {expense?.description ||
                        "-"}
                    </div>

                    <div style={moneyCellStyle}>
                      KES{" "}
                      {money(
                        expense?.amount
                      )}
                    </div>

                    <div style={centerStyle}>
                      <span
                        style={
                          expense?.locked
                            ? lockedBadgeStyle
                            : openExpenseBadgeStyle
                        }
                      >
                        {expense?.locked
                          ? "LOCKED"
                          : "OPEN"}
                      </span>
                    </div>

                    <div style={centerStyle}>
                      {formatDateTime(
                        expense?.created_at
                      )}
                    </div>
                  </div>
                )
              )
            )}

            <div style={expenseFooterStyle}>
              Total Accountant Expenses:{" "}
              <strong>
                KES{" "}
                {money(
                  totalExpenses
                )}
              </strong>
            </div>
          </section>

          {/* ===================================== */}
          {/* CASHIER RETURNS */}
          {/* ===================================== */}

          <section style={panelStyle}>
            <SectionTitle
              title="CASHIER → LEGEND ACCOUNTS"
              subtitle="Cashier float-return transactions"
            />

            <TransactionTable
              rows={
                cashierReturns
              }
              direction="RETURN"
            />
          </section>

          {/* ===================================== */}
          {/* ACCOUNTANT SENDS */}
          {/* ===================================== */}

          <section style={panelStyle}>
            <SectionTitle
              title="LEGEND ACCOUNTS → CASHIER"
              subtitle="Company Float transfers sent to cashiers"
            />

            <TransactionTable
              rows={
                accountantSends
              }
              direction="SEND"
            />
          </section>

          {/* ===================================== */}
          {/* ALL TRANSACTIONS */}
          {/* ===================================== */}

          <section style={panelStyle}>
            <SectionTitle
              title="ACCOUNTANT TRANSACTION HISTORY"
              subtitle="All transactions returned for the selected Accountant day"
            />

            <div style={historyHeaderStyle}>
              <div>
                TRANSACTION
              </div>

              <div>
                FLOW
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

              <div>
                TIME
              </div>
            </div>

            {transactions.length ===
            0 ? (
              <div style={emptyStyle}>
                No Accountant transactions for this date.
              </div>
            ) : (
              transactions.map(
                (
                  transaction,
                  index
                ) => (
                  <div
                    key={
                      transaction?.id ||
                      index
                    }
                    style={historyRowStyle}
                  >
                    <div style={smallCellStyle}>
                      {transaction?.transaction_no ||
                        "-"}
                    </div>

                    <div style={smallCellStyle}>
                      {friendlyFlow(
                        transaction?.flow
                      )}
                    </div>

                    <div style={smallCellStyle}>
                      {transaction?.cashier_name ||
                        transaction?.recipient_name_snapshot ||
                        "-"}
                    </div>

                    <div style={moneyCellStyle}>
                      {money(
                        transaction?.amount
                      )}
                    </div>

                    <div style={moneyCellStyle}>
                      {money(
                        transaction?.actual_fee ??
                          transaction?.estimated_fee
                      )}
                    </div>

                    <div style={smallCellStyle}>
                      {transaction?.manual_receipt_no ||
                        transaction?.mpesa_receipt_number ||
                        "-"}
                    </div>

                    <div style={centerStyle}>
                      <StatusBadge
                        status={
                          transaction?.status
                        }
                      />
                    </div>

                    <div style={smallCellStyle}>
                      {formatDateTime(
                        transaction?.completed_at ||
                          transaction?.updated_at ||
                          transaction?.created_at
                      )}
                    </div>
                  </div>
                )
              )
            )}
          </section>
        </>
      )}
    </div>
  );
}

// ==================================================
// TRANSACTION TABLE
// ==================================================

function TransactionTable({
  rows,
  direction,
}) {
  return (
    <>
      <div style={transactionHeaderStyle}>
        <div>
          TRANSACTION
        </div>

        <div>
          CASHIER
        </div>

        <div>
          SLOT
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

      {rows.length ===
      0 ? (
        <div style={emptyStyle}>
          {direction ===
          "RETURN"
            ? "No cashier returns for this date."
            : "No Accountant-to-Cashier transfers for this date."}
        </div>
      ) : (
        rows.map(
          (
            transaction,
            index
          ) => {
            const slot =
              direction ===
              "RETURN"
                ? transaction?.return_slot
                : transaction?.company_float_slot;

            return (
              <div
                key={
                  transaction?.id ||
                  index
                }
                style={transactionRowStyle}
              >
                <div style={smallCellStyle}>
                  {transaction?.transaction_no ||
                    "-"}
                </div>

                <div style={smallCellStyle}>
                  {transaction?.cashier_name ||
                    transaction?.recipient_name_snapshot ||
                    "-"}
                </div>

                <div style={centerStyle}>
                  {slot ??
                    "-"}
                </div>

                <div style={moneyCellStyle}>
                  KES{" "}
                  {money(
                    transaction?.amount
                  )}
                </div>

                <div style={moneyCellStyle}>
                  KES{" "}
                  {money(
                    transaction?.actual_fee ??
                      transaction?.estimated_fee
                  )}
                </div>

                <div style={smallCellStyle}>
                  {transaction?.manual_receipt_no ||
                    transaction?.mpesa_receipt_number ||
                    "-"}
                </div>

                <div style={centerStyle}>
                  <StatusBadge
                    status={
                      transaction?.status
                    }
                  />
                </div>
              </div>
            );
          }
        )
      )}
    </>
  );
}

// ==================================================
// STATUS BADGE
// ==================================================

function StatusBadge({
  status,
}) {
  const clean =
    String(
      status ||
        "UNKNOWN"
    )
      .trim()
      .toUpperCase();

  let background =
    "#64748b";

  if (
    clean ===
      "COMPLETED" ||
    clean ===
      "CONFIRMED"
  ) {
    background =
      "#15803d";
  } else if (
    clean.includes(
      "PENDING"
    ) ||
    clean.includes(
      "AWAITING"
    ) ||
    clean ===
      "CHECKING"
  ) {
    background =
      "#d97706";
  } else if (
    clean ===
      "FAILED" ||
    clean ===
      "CANCELLED" ||
    clean ===
      "REVERSED"
  ) {
    background =
      "#b91c1c";
  }

  return (
    <span
      style={{
        ...statusBadgeBaseStyle,

        backgroundColor:
          background,
      }}
    >
      {clean}
    </span>
  );
}

// ==================================================
// SUMMARY CARD
// ==================================================

function SummaryCard({
  title,
  amount,
  text,
  strong,
}) {
  return (
    <div
      style={{
        ...summaryCardStyle,

        ...(strong
          ? strongSummaryCardStyle
          : {}),
      }}
    >
      <div style={summaryTitleStyle}>
        {title}
      </div>

      <div style={summaryValueStyle}>
        {text !==
        undefined
          ? text
          : `KES ${money(
              amount
            )}`}
      </div>
    </div>
  );
}

// ==================================================
// SECTION TITLE
// ==================================================

function SectionTitle({
  title,
  subtitle,
}) {
  return (
    <div style={sectionTitleWrapStyle}>
      <div style={sectionTitleStyle}>
        {title}
      </div>

      <div style={sectionSubtitleStyle}>
        {subtitle}
      </div>
    </div>
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

function normaliseArray(
  value
) {
  if (
    Array.isArray(
      value
    )
  ) {
    return value;
  }

  if (
    value &&
    typeof value ===
      "object"
  ) {
    return Object.values(
      value
    ).filter(
      (
        item
      ) =>
        item &&
        typeof item ===
          "object"
    );
  }

  return [];
}

function numberValue(
  value
) {
  const numeric =
    Number(
      value ?? 0
    );

  return Number.isFinite(
    numeric
  )
    ? numeric
    : 0;
}

function money(
  value
) {
  return numberValue(
    value
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

function getNairobiDate() {
  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
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

  const year =
    parts.find(
      (
        part
      ) =>
        part.type ===
        "year"
    )?.value;

  const month =
    parts.find(
      (
        part
      ) =>
        part.type ===
        "month"
    )?.value;

  const day =
    parts.find(
      (
        part
      ) =>
        part.type ===
        "day"
    )?.value;

  return `${year}-${month}-${day}`;
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
    return String(
      value
    );
  }

  return new Intl.DateTimeFormat(
    "en-KE",
    {
      timeZone:
        "Africa/Nairobi",

      day:
        "2-digit",

      month:
        "short",

      hour:
        "2-digit",

      minute:
        "2-digit",
    }
  ).format(
    date
  );
}

function friendlyFlow(
  value
) {
  const clean =
    String(
      value ||
        ""
    )
      .trim()
      .toUpperCase();

  if (
    clean ===
    "CASHIER_TO_ACCOUNTANT"
  ) {
    return "Cashier → Accounts";
  }

  if (
    clean ===
    "ACCOUNTANT_TO_CASHIER"
  ) {
    return "Accounts → Cashier";
  }

  return (
    clean ||
    "-"
  );
}

// ==================================================
// STYLES
// ==================================================

const wrapperStyle = {
  width:
    "100%",

  display:
    "grid",

  gap:
    "14px",
};

const controlPanelStyle = {
  backgroundColor:
    "#064e3b",

  color:
    "white",

  padding:
    "15px",

  borderRadius:
    "7px",

  display:
    "flex",

  justifyContent:
    "space-between",

  alignItems:
    "end",

  gap:
    "20px",
};

const controlTitleStyle = {
  fontSize:
    "17px",

  fontWeight:
    "900",
};

const controlSubtitleStyle = {
  marginTop:
    "4px",

  fontSize:
    "10px",

  color:
    "#d1fae5",
};

const dateWrapStyle = {
  minWidth:
    "180px",
};

const labelStyle = {
  display:
    "block",

  marginBottom:
    "5px",

  fontSize:
    "9px",

  fontWeight:
    "bold",
};

const dateInputStyle = {
  width:
    "100%",

  padding:
    "8px",

  boxSizing:
    "border-box",

  border:
    "1px solid #d1d5db",

  borderRadius:
    "4px",
};

const panelStyle = {
  backgroundColor:
    "white",

  border:
    "1px solid #cbd5e1",

  borderRadius:
    "7px",

  overflow:
    "hidden",
};

const panelHeaderStyle = {
  padding:
    "13px",

  display:
    "flex",

  justifyContent:
    "space-between",

  alignItems:
    "center",

  gap:
    "12px",

  borderBottom:
    "1px solid #e2e8f0",
};

const panelTitleStyle = {
  fontWeight:
    "900",

  fontSize:
    "13px",
};

const panelSubtitleStyle = {
  marginTop:
    "3px",

  color:
    "#64748b",

  fontSize:
    "9px",
};

const summaryGridStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "repeat(auto-fit,minmax(135px,1fr))",

  gap:
    "8px",

  padding:
    "12px",
};

const summaryCardStyle = {
  minHeight:
    "62px",

  padding:
    "10px",

  border:
    "1px solid #e2e8f0",

  borderRadius:
    "6px",

  backgroundColor:
    "#f8fafc",
};

const strongSummaryCardStyle = {
  backgroundColor:
    "#ecfdf5",

  border:
    "1px solid #86efac",
};

const summaryTitleStyle = {
  color:
    "#64748b",

  fontSize:
    "8px",

  fontWeight:
    "bold",
};

const summaryValueStyle = {
  marginTop:
    "8px",

  fontSize:
    "14px",

  fontWeight:
    "900",
};

const reportNoteStyle = {
  padding:
    "8px 12px",

  borderTop:
    "1px solid #e2e8f0",

  backgroundColor:
    "#f8fafc",

  color:
    "#64748b",

  textAlign:
    "center",

  fontSize:
    "9px",
};

const sectionTitleWrapStyle = {
  padding:
    "10px 12px",

  backgroundColor:
    "#0f766e",

  color:
    "white",
};

const sectionTitleStyle = {
  fontWeight:
    "900",

  fontSize:
    "12px",
};

const sectionSubtitleStyle = {
  marginTop:
    "3px",

  fontSize:
    "8px",

  color:
    "#ccfbf1",
};

const accountantGridStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "repeat(auto-fit,minmax(180px,1fr))",

  gap:
    "10px",

  padding:
    "12px",
};

const accountantCardStyle = {
  padding:
    "12px",

  border:
    "1px solid #e2e8f0",

  borderRadius:
    "6px",

  backgroundColor:
    "#f8fafc",
};

const accountantNameStyle = {
  fontWeight:
    "900",

  fontSize:
    "12px",

  marginBottom:
    "6px",
};

const accountantDetailStyle = {
  color:
    "#64748b",

  fontSize:
    "9px",

  marginTop:
    "3px",
};

const activeTextStyle = {
  marginTop:
    "7px",

  color:
    "#15803d",

  fontSize:
    "9px",

  fontWeight:
    "bold",
};

const inactiveTextStyle = {
  marginTop:
    "7px",

  color:
    "#b91c1c",

  fontSize:
    "9px",

  fontWeight:
    "bold",
};

const expenseHeaderStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "60px minmax(180px,1fr) 130px 100px 130px",

  gap:
    "6px",

  padding:
    "8px",

  backgroundColor:
    "#f1f5f9",

  fontSize:
    "8px",

  fontWeight:
    "bold",
};

const expenseRowStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "60px minmax(180px,1fr) 130px 100px 130px",

  gap:
    "6px",

  alignItems:
    "center",

  padding:
    "8px",

  borderTop:
    "1px solid #e2e8f0",

  fontSize:
    "9px",
};

const expenseFooterStyle = {
  padding:
    "10px 12px",

  borderTop:
    "1px solid #e2e8f0",

  textAlign:
    "right",

  backgroundColor:
    "#f8fafc",

  fontSize:
    "10px",
};

const transactionHeaderStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "1.1fr 1fr 60px 110px 100px 1fr 1fr",

  gap:
    "6px",

  padding:
    "8px",

  backgroundColor:
    "#f1f5f9",

  fontSize:
    "8px",

  fontWeight:
    "bold",
};

const transactionRowStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "1.1fr 1fr 60px 110px 100px 1fr 1fr",

  gap:
    "6px",

  alignItems:
    "center",

  padding:
    "8px",

  borderTop:
    "1px solid #e2e8f0",

  fontSize:
    "9px",
};

const historyHeaderStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "1fr 1fr 1.1fr 90px 80px 1fr 1fr 120px",

  gap:
    "5px",

  padding:
    "8px",

  backgroundColor:
    "#f1f5f9",

  fontSize:
    "7px",

  fontWeight:
    "bold",
};

const historyRowStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "1fr 1fr 1.1fr 90px 80px 1fr 1fr 120px",

  gap:
    "5px",

  alignItems:
    "center",

  padding:
    "8px",

  borderTop:
    "1px solid #e2e8f0",

  fontSize:
    "8px",
};

const descriptionStyle = {
  fontWeight:
    "bold",
};

const centerStyle = {
  textAlign:
    "center",
};

const moneyCellStyle = {
  textAlign:
    "right",

  fontWeight:
    "bold",
};

const smallCellStyle = {
  wordBreak:
    "break-word",
};

const lockedBadgeStyle = {
  display:
    "inline-block",

  padding:
    "4px 6px",

  borderRadius:
    "10px",

  backgroundColor:
    "#e2e8f0",

  color:
    "#475569",

  fontWeight:
    "bold",

  fontSize:
    "8px",
};

const openExpenseBadgeStyle = {
  ...lockedBadgeStyle,

  backgroundColor:
    "#dcfce7",

  color:
    "#166534",
};

const statusBadgeBaseStyle = {
  display:
    "inline-block",

  padding:
    "4px 6px",

  borderRadius:
    "10px",

  color:
    "white",

  fontWeight:
    "bold",

  fontSize:
    "7px",

  whiteSpace:
    "nowrap",
};

const openBadgeStyle = {
  padding:
    "5px 9px",

  backgroundColor:
    "#15803d",

  color:
    "white",

  borderRadius:
    "12px",

  fontWeight:
    "bold",

  fontSize:
    "8px",
};

const closedBadgeStyle = {
  ...openBadgeStyle,

  backgroundColor:
    "#475569",
};

const neutralBadgeStyle = {
  ...openBadgeStyle,

  backgroundColor:
    "#94a3b8",
};

const emptyStyle = {
  padding:
    "20px",

  textAlign:
    "center",

  color:
    "#64748b",

  fontSize:
    "10px",
};

const loadingStyle = {
  padding:
    "30px",

  textAlign:
    "center",

  backgroundColor:
    "white",

  border:
    "1px solid #cbd5e1",

  borderRadius:
    "7px",

  color:
    "#64748b",
};

const errorStyle = {
  padding:
    "11px",

  border:
    "1px solid #fecaca",

  backgroundColor:
    "#fef2f2",

  color:
    "#b91c1c",

  borderRadius:
    "6px",

  fontSize:
    "10px",

  fontWeight:
    "bold",
};
