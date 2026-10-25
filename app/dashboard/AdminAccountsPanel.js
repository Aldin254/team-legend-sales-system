"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// TEAM LEGEND — ADMIN ACCOUNTANT CONTROL
// Clean, readable presentation. Existing RPCs and financial logic retained.
const ACCOUNTANT_REFRESH_MS = 60_000;

export default function AdminAccountantPanel({ user }) {
  const [reportDate, setReportDate] = useState(getNairobiDate());
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [bfInput, setBfInput] = useState("");
  const [bfReason, setBfReason] = useState("");
  const [bfDirty, setBfDirty] = useState(false);
  const [savingBf, setSavingBf] = useState(false);
  const [bfMessage, setBfMessage] = useState("");
  const [bfMessageType, setBfMessageType] = useState("");
  const snapshotRequestRef = useRef(null);
  const lastSnapshotAtRef = useRef(0);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const accessToken = user?.access_token || null;

  const authHeaders = useMemo(
    () => ({
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    }),
    [supabaseAnonKey, accessToken]
  );

  // One active snapshot request at a time. A manual/post-save refresh takes
  // precedence over an older background request, avoiding stale B/F figures.
  const loadSnapshot = useCallback(async ({ force = false } = {}) => {
    if (!accessToken || !supabaseUrl || !supabaseAnonKey || !reportDate) {
      setLoading(false);
      return;
    }

    if (snapshotRequestRef.current) {
      if (!force) return;
      snapshotRequestRef.current.abort();
    }

    const controller = new AbortController();
    snapshotRequestRef.current = controller;

    try {
      setError("");
      const response = await fetch(
        `${supabaseUrl}/rest/v1/rpc/tl_admin_accountant_snapshot`,
        {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ p_report_date: reportDate }),
          cache: "no-store",
          signal: controller.signal,
        }
      );

      const result = await safeJson(response);
      if (controller.signal.aborted) return;
      if (!response.ok) {
        throw new Error(
          result?.message ||
            result?.details ||
            result?.hint ||
            "Unable to load Accountant information."
        );
      }

      setSnapshot(result && typeof result === "object" ? result : {});
      lastSnapshotAtRef.current = Date.now();
    } catch (error) {
      if (controller.signal.aborted || error?.name === "AbortError") return;
      console.error("ADMIN ACCOUNTANT SNAPSHOT ERROR:", error);
      setError(error?.message || "Unable to load Accountant information.");
    } finally {
      if (snapshotRequestRef.current === controller) {
        snapshotRequestRef.current = null;
        setLoading(false);
      }
    }
  }, [accessToken, supabaseUrl, supabaseAnonKey, reportDate, authHeaders]);

  useEffect(() => {
    setLoading(true);
    setSnapshot(null); // Never show another date's report while loading.
    lastSnapshotAtRef.current = 0;
    loadSnapshot({ force: true });

    const refreshIfDue = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastSnapshotAtRef.current < ACCOUNTANT_REFRESH_MS) return;
      loadSnapshot();
    };

    const timer = setInterval(refreshIfDue, ACCOUNTANT_REFRESH_MS);
    document.addEventListener("visibilitychange", refreshIfDue);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshIfDue);
      snapshotRequestRef.current?.abort();
      snapshotRequestRef.current = null;
    };
  }, [loadSnapshot]);

  const report = useMemo(() => {
    const raw = snapshot?.report;
    if (Array.isArray(raw)) return raw[0] || null;
    return raw && typeof raw === "object" ? raw : null;
  }, [snapshot]);

  const expenses = useMemo(
    () => normaliseArray(snapshot?.expenses),
    [snapshot]
  );
  const transactions = useMemo(
    () => normaliseArray(snapshot?.transactions),
    [snapshot]
  );
  const accountants = useMemo(
    () => normaliseArray(snapshot?.accountants),
    [snapshot]
  );

  const openingBalance = numberValue(report?.opening_balance);
  const totalFloatSent = numberValue(report?.total_float_sent);
  const totalFloatReceived = numberValue(report?.total_float_received);
  const totalFees = numberValue(report?.total_transaction_fees);
  const totalExpenses = numberValue(report?.total_expenses);
  const closingBalance = numberValue(report?.closing_balance);
  const reportStatus = String(report?.status || "NO REPORT")
    .trim()
    .toUpperCase();

  // Do not overwrite a B/F amount while Admin is typing.
  useEffect(() => {
    if (!report) {
      if (!bfDirty) setBfInput("");
      return;
    }
    if (!bfDirty) {
      setBfInput(String(report.opening_balance ?? 0));
    }
  }, [report, bfDirty]);

  useEffect(() => {
    setBfDirty(false);
    setBfReason("");
    setBfMessage("");
    setBfMessageType("");
    setBfInput("");
  }, [reportDate]);

  async function saveAccountantBf() {
    if (!reportDate) {
      setBfMessage("Select an Accountant report date.");
      setBfMessageType("error");
      return;
    }
    if (!report) {
      setBfMessage("There is no Accountant report for this date.");
      setBfMessageType("error");
      return;
    }

    const cleanAmount = String(bfInput ?? "").trim();
    if (cleanAmount === "") {
      setBfMessage("Enter the corrected Balance B/F.");
      setBfMessageType("error");
      return;
    }

    const newOpeningBalance = Number(cleanAmount);
    if (!Number.isFinite(newOpeningBalance)) {
      setBfMessage("Enter a valid Balance B/F.");
      setBfMessageType("error");
      return;
    }

    const cleanReason = String(bfReason || "").trim();
    if (cleanReason.length < 3) {
      setBfMessage("Enter a reason for the B/F correction.");
      setBfMessageType("error");
      return;
    }

    const oldBalance = openingBalance;
    if (roundMoney(oldBalance) === roundMoney(newOpeningBalance)) {
      setBfMessage("The new Balance B/F is the same as the current Balance B/F.");
      setBfMessageType("error");
      return;
    }

    const confirmed = window.confirm(
      "ADMIN ACCOUNTANT BALANCE B/F CORRECTION\n\n" +
        `Report Date: ${reportDate}\n` +
        `Current B/F: KES ${money(oldBalance)}\n` +
        `New B/F: KES ${money(newOpeningBalance)}\n\n` +
        `Reason: ${cleanReason}\n\n` +
        "This changes only the Accountant Balance B/F.\n\n" +
        "Continue?"
    );
    if (!confirmed) return;

    try {
      setSavingBf(true);
      setBfMessage("");
      setBfMessageType("");

      const response = await fetch(
        `${supabaseUrl}/rest/v1/rpc/tl_admin_set_accountant_bf`,
        {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            p_report_date: reportDate,
            p_opening_balance: roundMoney(newOpeningBalance),
            p_reason: cleanReason,
          }),
          cache: "no-store",
        }
      );

      const result = await safeJson(response);
      if (!response.ok) {
        throw new Error(
          result?.message ||
            result?.details ||
            result?.hint ||
            "Unable to update Accountant Balance B/F."
        );
      }
      if (result?.success === false) {
        throw new Error(result?.message || "Unable to update Accountant Balance B/F.");
      }

      setBfDirty(false);
      setBfReason("");
      setBfMessage(
        `Balance B/F updated from KES ${money(oldBalance)} to KES ${money(newOpeningBalance)}.`
      );
      setBfMessageType("success");
      await loadSnapshot({ force: true });
    } catch (error) {
      console.error("ADMIN ACCOUNTANT B/F ERROR:", error);
      setBfMessage(error?.message || "Unable to update Accountant Balance B/F.");
      setBfMessageType("error");
    } finally {
      setSavingBf(false);
    }
  }

  const cashierReturns = transactions.filter(
    (transaction) =>
      String(transaction?.flow || "").trim().toUpperCase() ===
      "CASHIER_TO_ACCOUNTANT"
  );
  const accountantSends = transactions.filter(
    (transaction) =>
      String(transaction?.flow || "").trim().toUpperCase() ===
      "ACCOUNTANT_TO_CASHIER"
  );

  return (
    <div style={wrapperStyle}>
      {/* REPORT DATE */}
      <section style={controlPanelStyle}>
        <div style={controlTitleStyle}>LEGEND ACCOUNTS</div>
        <div style={dateWrapStyle}>
          <label style={labelStyle}>REPORT DATE</label>
          <input
            type="date"
            value={reportDate}
            onChange={(event) => {
              setReportDate(event.target.value);
              setLoading(true);
            }}
            style={dateInputStyle}
          />
        </div>
      </section>

      {error && <div style={errorStyle}>{error}</div>}

      {loading && !snapshot ? (
        <div style={loadingStyle}>Loading Legend Accounts...</div>
      ) : (
        <>
          {/* DAILY SUMMARY */}
          <section style={panelStyle}>
            <div style={panelHeaderStyle}>
              <div style={panelTitleStyle}>DAILY ACCOUNTANT REPORT</div>
              <div
                style={
                  reportStatus === "OPEN"
                    ? openBadgeStyle
                    : reportStatus === "CLOSED"
                    ? closedBadgeStyle
                    : neutralBadgeStyle
                }
              >
                {reportStatus}
              </div>
            </div>
            <div style={summaryGridStyle}>
              <SummaryCard title="REPORT DATE" text={report?.report_date || reportDate} />
              <SummaryCard title="BALANCE B/F" amount={openingBalance} />
              <SummaryCard title="FLOAT SENT" amount={totalFloatSent} />
              <SummaryCard title="FLOAT RECEIVED" amount={totalFloatReceived} />
              <SummaryCard title="TRANSACTION FEES" amount={totalFees} />
              <SummaryCard title="ACCOUNTANT EXPENSES" amount={totalExpenses} />
              <SummaryCard title="CLOSING BALANCE" amount={closingBalance} strong />
            </div>
          </section>

          {/* ADMIN BALANCE B/F CORRECTION */}
          <section style={bfPanelStyle}>
            <div style={bfHeaderStyle}>
              <div style={bfTitleStyle}>ADMIN BALANCE B/F CORRECTION</div>
              <span style={bfOnlyBadgeStyle}>B/F ONLY</span>
            </div>

            {!report ? (
              <div style={emptyStyle}>No Accountant report exists for {reportDate}.</div>
            ) : (
              <div style={bfBodyStyle}>
                <div style={bfCurrentGridStyle}>
                  <div style={bfInfoCardStyle}>
                    <div style={bfInfoLabelStyle}>REPORT DATE</div>
                    <div style={bfInfoValueStyle}>{report?.report_date || reportDate}</div>
                  </div>
                  <div style={bfInfoCardStyle}>
                    <div style={bfInfoLabelStyle}>CURRENT BALANCE B/F</div>
                    <div style={bfInfoValueStyle}>KES {money(openingBalance)}</div>
                  </div>
                  <div style={bfInfoCardStyle}>
                    <div style={bfInfoLabelStyle}>CURRENT CLOSING BALANCE</div>
                    <div style={bfInfoValueStyle}>KES {money(closingBalance)}</div>
                  </div>
                </div>

                <div style={bfFieldGridStyle}>
                  <div>
                    <label style={bfLabelStyle}>CORRECTED BALANCE B/F (KES)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={bfInput}
                      disabled={savingBf}
                      onChange={(event) => {
                        setBfInput(event.target.value);
                        setBfDirty(true);
                        setBfMessage("");
                      }}
                      placeholder="Enter corrected B/F"
                      style={bfInputStyle}
                    />
                  </div>
                  <div>
                    <label style={bfLabelStyle}>CORRECTION REASON *</label>
                    <textarea
                      value={bfReason}
                      disabled={savingBf}
                      onChange={(event) => {
                        setBfReason(event.target.value);
                        setBfMessage("");
                      }}
                      rows={3}
                      placeholder="Reason for correction"
                      style={bfTextareaStyle}
                    />
                  </div>
                </div>

                {report?.admin_override_note && (
                  <div style={previousOverrideStyle}>
                    <strong>Previous Admin Correction:</strong>{" "}
                    {report.admin_override_note}
                  </div>
                )}

                {bfMessage && (
                  <div
                    role={bfMessageType === "error" ? "alert" : "status"}
                    style={{
                      ...bfMessageStyle,
                      backgroundColor: bfMessageType === "success" ? "#ecfdf5" : "#fef2f2",
                      borderColor: bfMessageType === "success" ? "#86efac" : "#fecaca",
                      color: bfMessageType === "success" ? "#166534" : "#991b1b",
                    }}
                  >
                    {bfMessage}
                  </div>
                )}

                <div style={bfButtonGridStyle}>
                  <button
                    type="button"
                    disabled={savingBf}
                    onClick={() => {
                      setBfInput(String(report?.opening_balance ?? 0));
                      setBfReason("");
                      setBfDirty(false);
                      setBfMessage("");
                    }}
                    style={bfResetButtonStyle}
                  >
                    RESET
                  </button>
                  <button
                    type="button"
                    disabled={savingBf}
                    onClick={saveAccountantBf}
                    style={{
                      ...bfSaveButtonStyle,
                      opacity: savingBf ? 0.65 : 1,
                      cursor: savingBf ? "not-allowed" : "pointer",
                    }}
                  >
                    {savingBf ? "UPDATING BALANCE B/F..." : "UPDATE BALANCE B/F"}
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* ACCOUNTANT USERS */}
          <section style={panelStyle}>
            <SectionTitle title="ACCOUNTANT USERS" />
            {accountants.length === 0 ? (
              <div style={emptyStyle}>No Accountant users returned.</div>
            ) : (
              <div style={accountantGridStyle}>
                {accountants.map((accountant, index) => (
                  <div key={accountant?.id || index} style={accountantCardStyle}>
                    <div style={accountantNameStyle}>
                      {accountant?.full_name || accountant?.name ||
                        accountant?.username || "Accountant"}
                    </div>
                    <div style={accountantDetailStyle}>
                      Role: {String(accountant?.role || "ACCOUNTANT").toUpperCase()}
                    </div>
                    <div style={accountantDetailStyle}>
                      Username: {accountant?.username || "-"}
                    </div>
                    <div style={accountant?.is_active === false ? inactiveTextStyle : activeTextStyle}>
                      {accountant?.is_active === false ? "INACTIVE" : "ACTIVE ✓"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ACCOUNTANT EXPENSES */}
          <section style={panelStyle}>
            <SectionTitle title="ACCOUNTANT EXPENSES" />
            <div style={tableScrollStyle}>
              <div style={expenseHeaderStyle}>
                <div>SLOT</div>
                <div>DESCRIPTION</div>
                <div>AMOUNT</div>
                <div>STATUS</div>
                <div>TIME</div>
              </div>
              {expenses.length === 0 ? (
                <div style={emptyStyle}>No Accountant expenses for this date.</div>
              ) : (
                expenses.map((expense, index) => (
                  <div key={expense?.id || index} style={expenseRowStyle}>
                    <div style={centerStyle}>{expense?.slot_number ?? index + 1}</div>
                    <div style={descriptionStyle}>{expense?.description || "-"}</div>
                    <div style={moneyCellStyle}>KES {money(expense?.amount)}</div>
                    <div style={centerStyle}>
                      <span style={expense?.locked ? lockedBadgeStyle : openExpenseBadgeStyle}>
                        {expense?.locked ? "LOCKED" : "OPEN"}
                      </span>
                    </div>
                    <div style={centerStyle}>{formatDateTime(expense?.created_at)}</div>
                  </div>
                ))
              )}
            </div>
            <div style={expenseFooterStyle}>
              Total Accountant Expenses: <strong>KES {money(totalExpenses)}</strong>
            </div>
          </section>
          {/* FLOAT RETURNS */}
          <section style={panelStyle}>
            <SectionTitle title="CASHIER → LEGEND ACCOUNTS" />
            <TransactionTable rows={cashierReturns} direction="RETURN" />
          </section>

          {/* FLOAT SENDS */}
          <section style={panelStyle}>
            <SectionTitle title="LEGEND ACCOUNTS → CASHIER" />
            <TransactionTable rows={accountantSends} direction="SEND" />
          </section>

          {/* ACCOUNTANT TRANSACTION HISTORY */}
          <section style={panelStyle}>
            <SectionTitle title="ACCOUNTANT TRANSACTION HISTORY" />
            <div style={tableScrollStyle}>
              <div style={historyHeaderStyle}>
                <div>TRANSACTION</div>
                <div>FLOW</div>
                <div>CASHIER / RECIPIENT</div>
                <div>AMOUNT</div>
                <div>FEE</div>
                <div>RECEIPT</div>
                <div>STATUS</div>
                <div>TIME</div>
              </div>
              {transactions.length === 0 ? (
                <div style={emptyStyle}>No Accountant transactions for this date.</div>
              ) : (
                transactions.map((transaction, index) => (
                  <div key={transaction?.id || index} style={historyRowStyle}>
                    <div style={smallCellStyle}>{transaction?.transaction_no || "-"}</div>
                    <div style={smallCellStyle}>{friendlyFlow(transaction?.flow)}</div>
                    <div style={smallCellStyle}>
                      {transaction?.cashier_name || transaction?.recipient_name_snapshot || "-"}
                    </div>
                    <div style={moneyCellStyle}>{money(transaction?.amount)}</div>
                    <div style={moneyCellStyle}>
                      {money(transaction?.actual_fee ?? transaction?.estimated_fee)}
                    </div>
                    <div style={smallCellStyle}>
                      {transaction?.manual_receipt_no || transaction?.mpesa_receipt_number || "-"}
                    </div>
                    <div style={centerStyle}><StatusBadge status={transaction?.status} /></div>
                    <div style={smallCellStyle}>
                      {formatDateTime(
                        transaction?.completed_at ||
                          transaction?.updated_at ||
                          transaction?.created_at
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function TransactionTable({ rows, direction }) {
  return (
    <div style={tableScrollStyle}>
      <div style={transactionHeaderStyle}>
        <div>TRANSACTION</div>
        <div>CASHIER</div>
        <div>SLOT</div>
        <div>AMOUNT</div>
        <div>FEE</div>
        <div>RECEIPT</div>
        <div>STATUS</div>
      </div>
      {rows.length === 0 ? (
        <div style={emptyStyle}>
          {direction === "RETURN"
            ? "No cashier returns for this date."
            : "No Accountant-to-Cashier transfers for this date."}
        </div>
      ) : (
        rows.map((transaction, index) => {
          const slot = direction === "RETURN"
            ? transaction?.return_slot
            : transaction?.company_float_slot;
          return (
            <div key={transaction?.id || index} style={transactionRowStyle}>
              <div style={smallCellStyle}>{transaction?.transaction_no || "-"}</div>
              <div style={smallCellStyle}>
                {transaction?.cashier_name || transaction?.recipient_name_snapshot || "-"}
              </div>
              <div style={centerStyle}>{slot ?? "-"}</div>
              <div style={moneyCellStyle}>KES {money(transaction?.amount)}</div>
              <div style={moneyCellStyle}>
                KES {money(transaction?.actual_fee ?? transaction?.estimated_fee)}
              </div>
              <div style={smallCellStyle}>
                {transaction?.manual_receipt_no || transaction?.mpesa_receipt_number || "-"}
              </div>
              <div style={centerStyle}><StatusBadge status={transaction?.status} /></div>
            </div>
          );
        })
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const clean = String(status || "UNKNOWN").trim().toUpperCase();
  let background = "#64748b";
  if (clean === "COMPLETED" || clean === "CONFIRMED") {
    background = "#15803d";
  } else if (
    clean.includes("PENDING") || clean.includes("AWAITING") || clean === "CHECKING"
  ) {
    background = "#d97706";
  } else if (["FAILED", "CANCELLED", "REVERSED"].includes(clean)) {
    background = "#b91c1c";
  }
  return (
    <span style={{ ...statusBadgeBaseStyle, backgroundColor: background }}>
      {clean}
    </span>
  );
}

function SummaryCard({ title, amount, text, strong }) {
  return (
    <div style={{ ...summaryCardStyle, ...(strong ? strongSummaryCardStyle : {}) }}>
      <div style={summaryTitleStyle}>{title}</div>
      <div style={summaryValueStyle}>
        {text !== undefined ? text : `KES ${money(amount)}`}
      </div>
    </div>
  );
}

function SectionTitle({ title }) {
  return (
    <div style={sectionTitleWrapStyle}>
      <div style={sectionTitleStyle}>{title}</div>
    </div>
  );
}

// HELPERS
async function safeJson(response) {
  try { return await response.json(); } catch { return null; }
}

function normaliseArray(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    return Object.values(value).filter((item) => item && typeof item === "object");
  }
  return [];
}

function numberValue(value) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function money(value) {
  return numberValue(value).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function getNairobiDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-KE", {
    timeZone: "Africa/Nairobi",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function friendlyFlow(value) {
  const clean = String(value || "").trim().toUpperCase();
  if (clean === "CASHIER_TO_ACCOUNTANT") return "Cashier → Accounts";
  if (clean === "ACCOUNTANT_TO_CASHIER") return "Accounts → Cashier";
  return clean || "-";
}

// STYLES — slightly larger minimum text, same colour scheme.
const wrapperStyle = {
  width: "100%", display: "grid", gap: "14px",
};
const controlPanelStyle = {
  backgroundColor: "#064e3b", color: "white", padding: "15px",
  borderRadius: "7px", display: "flex", justifyContent: "space-between",
  alignItems: "end", gap: "20px", flexWrap: "wrap",
};
const controlTitleStyle = { fontSize: "17px", fontWeight: "900" };
const dateWrapStyle = { minWidth: "180px" };
const labelStyle = { display: "block", marginBottom: "6px", fontSize: "11px", fontWeight: "bold" };
const dateInputStyle = {
  width: "100%", padding: "9px", boxSizing: "border-box",
  border: "1px solid #d1d5db", borderRadius: "4px", fontSize: "12px",
};
const panelStyle = {
  backgroundColor: "white", border: "1px solid #cbd5e1",
  borderRadius: "7px", overflow: "hidden",
};
const panelHeaderStyle = {
  padding: "13px", display: "flex", justifyContent: "space-between",
  alignItems: "center", gap: "12px", borderBottom: "1px solid #e2e8f0",
};
const panelTitleStyle = { fontWeight: "900", fontSize: "14px" };
const summaryGridStyle = {
  display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))",
  gap: "8px", padding: "12px",
};
const summaryCardStyle = {
  minHeight: "65px", padding: "10px", border: "1px solid #e2e8f0",
  borderRadius: "6px", backgroundColor: "#f8fafc",
};
const strongSummaryCardStyle = {
  backgroundColor: "#ecfdf5", border: "1px solid #86efac",
};
const summaryTitleStyle = { color: "#64748b", fontSize: "10px", fontWeight: "bold" };
const summaryValueStyle = { marginTop: "8px", fontSize: "15px", fontWeight: "900" };

const bfPanelStyle = {
  backgroundColor: "#ffffff", border: "2px solid #7c3aed",
  borderRadius: "7px", overflow: "hidden",
};
const bfHeaderStyle = {
  backgroundColor: "#7c3aed", color: "white", padding: "12px 14px",
  display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px",
};
const bfTitleStyle = { fontSize: "14px", fontWeight: "900" };
const bfOnlyBadgeStyle = {
  padding: "5px 9px", border: "1px solid rgba(255,255,255,0.55)",
  borderRadius: "12px", fontSize: "10px", fontWeight: "900", whiteSpace: "nowrap",
};
const bfBodyStyle = { padding: "13px" };
const bfCurrentGridStyle = {
  display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))",
  gap: "8px", marginBottom: "12px",
};
const bfInfoCardStyle = {
  padding: "10px", backgroundColor: "#f8fafc",
  border: "1px solid #e2e8f0", borderRadius: "5px",
};
const bfInfoLabelStyle = { color: "#64748b", fontSize: "10px", fontWeight: "bold" };
const bfInfoValueStyle = {
  marginTop: "5px", color: "#0f172a", fontSize: "14px", fontWeight: "900",
};
const bfFieldGridStyle = {
  display: "grid", gridTemplateColumns: "minmax(180px,0.7fr) minmax(280px,1.3fr)",
  gap: "10px", marginBottom: "12px",
};
const bfLabelStyle = {
  display: "block", marginBottom: "6px", color: "#334155",
  fontSize: "11px", fontWeight: "bold",
};
const bfInputStyle = {
  width: "100%", boxSizing: "border-box", padding: "10px",
  border: "1px solid #94a3b8", borderRadius: "5px",
  fontWeight: "bold", fontSize: "13px",
};
const bfTextareaStyle = {
  width: "100%", boxSizing: "border-box", padding: "10px",
  border: "1px solid #94a3b8", borderRadius: "5px",
  resize: "vertical", fontSize: "13px", fontFamily: "inherit",
};
const previousOverrideStyle = {
  padding: "10px", marginBottom: "10px", backgroundColor: "#f1f5f9",
  border: "1px solid #cbd5e1", borderRadius: "5px",
  color: "#475569", fontSize: "11px",
};
const bfMessageStyle = {
  padding: "10px", marginBottom: "10px", border: "1px solid",
  borderRadius: "5px", fontSize: "12px", fontWeight: "bold",
};
const bfButtonGridStyle = {
  display: "grid", gridTemplateColumns: "120px 1fr", gap: "8px",
};
const bfResetButtonStyle = {
  padding: "11px", border: "none", borderRadius: "5px",
  backgroundColor: "#64748b", color: "white", fontSize: "11px",
  fontWeight: "bold", cursor: "pointer",
};
const bfSaveButtonStyle = {
  padding: "11px", border: "none", borderRadius: "5px",
  backgroundColor: "#7c3aed", color: "white", fontSize: "11px", fontWeight: "900",
};

const sectionTitleWrapStyle = {
  padding: "11px 12px", backgroundColor: "#0f766e", color: "white",
};
const sectionTitleStyle = { fontWeight: "900", fontSize: "13px" };
const accountantGridStyle = {
  display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
  gap: "10px", padding: "12px",
};
const accountantCardStyle = {
  padding: "12px", border: "1px solid #e2e8f0", borderRadius: "6px",
  backgroundColor: "#f8fafc",
};
const accountantNameStyle = { fontWeight: "900", fontSize: "13px", marginBottom: "6px" };
const accountantDetailStyle = { color: "#64748b", fontSize: "11px", marginTop: "3px" };
const activeTextStyle = { marginTop: "7px", color: "#15803d", fontSize: "11px", fontWeight: "bold" };
const inactiveTextStyle = { marginTop: "7px", color: "#b91c1c", fontSize: "11px", fontWeight: "bold" };

const tableScrollStyle = { overflowX: "auto" };
const expenseColumns = "60px minmax(180px,1fr) 130px 100px 130px";
const expenseHeaderStyle = {
  display: "grid", gridTemplateColumns: expenseColumns, gap: "7px",
  minWidth: "650px", padding: "10px", backgroundColor: "#f1f5f9",
  fontSize: "10px", fontWeight: "bold",
};
const expenseRowStyle = {
  display: "grid", gridTemplateColumns: expenseColumns, gap: "7px",
  minWidth: "650px", alignItems: "center", padding: "10px",
  borderTop: "1px solid #e2e8f0", fontSize: "11px",
};
const expenseFooterStyle = {
  padding: "11px 12px", borderTop: "1px solid #e2e8f0",
  textAlign: "right", backgroundColor: "#f8fafc", fontSize: "12px",
};
const transactionColumns = "1.1fr 1fr 60px 110px 100px 1fr 1fr";
const transactionHeaderStyle = {
  display: "grid", gridTemplateColumns: transactionColumns, gap: "7px",
  minWidth: "760px", padding: "10px", backgroundColor: "#f1f5f9",
  fontSize: "10px", fontWeight: "bold",
};
const transactionRowStyle = {
  display: "grid", gridTemplateColumns: transactionColumns, gap: "7px",
  minWidth: "760px", alignItems: "center", padding: "10px",
  borderTop: "1px solid #e2e8f0", fontSize: "11px",
};
const historyColumns = "1fr 1fr 1.1fr 90px 80px 1fr 1fr 120px";
const historyHeaderStyle = {
  display: "grid", gridTemplateColumns: historyColumns, gap: "6px",
  minWidth: "910px", padding: "10px", backgroundColor: "#f1f5f9",
  fontSize: "10px", fontWeight: "bold",
};
const historyRowStyle = {
  display: "grid", gridTemplateColumns: historyColumns, gap: "6px",
  minWidth: "910px", alignItems: "center", padding: "10px",
  borderTop: "1px solid #e2e8f0", fontSize: "11px",
};
const descriptionStyle = { fontWeight: "bold" };
const centerStyle = { textAlign: "center" };
const moneyCellStyle = { textAlign: "right", fontWeight: "bold" };
const smallCellStyle = { wordBreak: "break-word" };
const lockedBadgeStyle = {
  display: "inline-block", padding: "5px 8px", borderRadius: "10px",
  backgroundColor: "#e2e8f0", color: "#475569", fontWeight: "bold", fontSize: "10px",
};
const openExpenseBadgeStyle = { ...lockedBadgeStyle, backgroundColor: "#dcfce7", color: "#166534" };
const statusBadgeBaseStyle = {
  display: "inline-block", padding: "5px 8px", borderRadius: "10px",
  color: "white", fontWeight: "bold", fontSize: "10px", whiteSpace: "nowrap",
};
const openBadgeStyle = {
  padding: "5px 9px", backgroundColor: "#15803d", color: "white",
  borderRadius: "12px", fontWeight: "bold", fontSize: "10px",
};
const closedBadgeStyle = { ...openBadgeStyle, backgroundColor: "#475569" };
const neutralBadgeStyle = { ...openBadgeStyle, backgroundColor: "#94a3b8" };
const emptyStyle = {
  padding: "20px", textAlign: "center", color: "#64748b", fontSize: "12px",
};
const loadingStyle = {
  padding: "30px", textAlign: "center", backgroundColor: "white",
  border: "1px solid #cbd5e1", borderRadius: "7px",
  color: "#64748b", fontSize: "12px",
};
const errorStyle = {
  padding: "11px", border: "1px solid #fecaca", backgroundColor: "#fef2f2",
  color: "#b91c1c", borderRadius: "6px", fontSize: "12px", fontWeight: "bold",
};
