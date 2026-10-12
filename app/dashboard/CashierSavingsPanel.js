"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

// TEAM LEGEND — shared 12H and 24H Savings / Banking panel.
// Presentation is compact; existing money RPC workflows are unchanged.
const CATEGORY_CONFIG = [
  { key: "WIFI", label: "WiFi", fixedPayment: true },
  { key: "DSTV", label: "DStv", fixedPayment: true },
  { key: "RENT", label: "Rent", fixedPayment: true },
  { key: "ELECTRICITY", label: "Electricity", fixedPayment: false },
  { key: "BANKING", label: "Banking", fixedPayment: false },
];

const T = {
  surface: "#101F30",
  surfaceRaised: "#15263A",
  inset: "#0A1725",
  border: "#2A3D52",
  softBorder: "#223448",
  ink: "#F0F5FA",
  sub: "#C4D0DC",
  muted: "#91A5B8",
  gold: "#D9B66C",
  teal: "#40C9AC",
};

function blankInputs() {
  const result = {};
  for (const category of CATEGORY_CONFIG) {
    result[category.key] = {
      save: "",
      pay: "",
      withdraw: "",
    };
  }
  return result;
}

export default function CashierSavingsPanel({ user, currentShift }) {
  const [categories, setCategories] = useState([]);
  const [paymentRequests, setPaymentRequests] = useState([]);
  const [bankingEmployees, setBankingEmployees] = useState([]);
  const [selectedBankingEmployeeId, setSelectedBankingEmployeeId] =
    useState("");
  const [inputs, setInputs] = useState(blankInputs);
  const [loading, setLoading] = useState(true);
  const [actionKey, setActionKey] = useState("");
  const [notice, setNotice] = useState(null);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const accessToken = user?.access_token || null;
  const shiftId = currentShift?.id || null;

  // All transient messages disappear after five seconds.
  useEffect(() => {
    if (!notice) return;

    const timer = setTimeout(() => {
      setNotice(null);
    }, 5000);

    return () => clearTimeout(timer);
  }, [notice]);

  function notify(text, type = "error") {
    setNotice({ text, type });
  }

  // ==========================================
  // LOAD SAVINGS
  // ==========================================

  const loadSavings = useCallback(async (silent = false) => {
    if (
      !shiftId ||
      !accessToken ||
      !supabaseUrl ||
      !supabaseAnonKey
    ) {
      setLoading(false);
      return;
    }

    try {
      if (!silent) setLoading(true);

      const headers = authHeaders(supabaseAnonKey, accessToken);

      const [savingsResponse, bankingResponse] =
        await Promise.all([
          fetch(
            `${supabaseUrl}/rest/v1/rpc/tl_cashier_savings_snapshot`,
            {
              method: "POST",
              headers,
              body: JSON.stringify({
                p_shift_id: shiftId,
              }),
              cache: "no-store",
            }
          ),
          fetch(
            `${supabaseUrl}/rest/v1/rpc/tl_cashier_banking_directory`,
            {
              method: "POST",
              headers,
              body: JSON.stringify({
                p_shift_id: shiftId,
              }),
              cache: "no-store",
            }
          ),
        ]);

      const [savingsResult, bankingResult] =
        await Promise.all([
          safeJson(savingsResponse),
          safeJson(bankingResponse),
        ]);

      if (!savingsResponse.ok) {
        throw new Error(
          savingsResult?.message ||
          savingsResult?.details ||
          savingsResult?.hint ||
          "Unable to load Savings."
        );
      }

      if (!bankingResponse.ok) {
        throw new Error(
          bankingResult?.message ||
          bankingResult?.details ||
          bankingResult?.hint ||
          "Unable to load employee Banking directory."
        );
      }

      const loadedCategories = Array.isArray(
        savingsResult?.categories
      )
        ? savingsResult.categories
        : [];

      const loadedRequests = Array.isArray(
        savingsResult?.payment_requests
      )
        ? savingsResult.payment_requests
        : [];

      const loadedEmployees = Array.isArray(
        bankingResult?.employees
      )
        ? bankingResult.employees
        : [];

      setCategories(loadedCategories);
      setPaymentRequests(loadedRequests);
      setBankingEmployees(loadedEmployees);

      setSelectedBankingEmployeeId((previous) =>
        previous &&
        loadedEmployees.some(
          (e) =>
            String(e.employee_id) === String(previous)
        )
          ? previous
          : ""
      );
    } catch (error) {
      console.error("LOAD SAVINGS ERROR:", error);

      if (!silent) {
        setNotice({
          text: error?.message || "Unable to load Savings.",
          type: "error",
        });
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [
    shiftId,
    accessToken,
    supabaseUrl,
    supabaseAnonKey,
  ]);

  // ==========================================
  // AUTO REFRESH
  // ==========================================

  useEffect(() => {
    loadSavings();

    const timer = setInterval(() => {
      loadSavings(true);
    }, 5000);

    return () => clearInterval(timer);
  }, [loadSavings]);

  // ==========================================
  // BANKING EMPLOYEE DIRECTORY
  // ==========================================

  const sortedBankingEmployees = useMemo(
    () =>
      [...bankingEmployees].sort((a, b) => {
        const mobileA = a?.is_mobile ? 0 : 1;
        const mobileB = b?.is_mobile ? 0 : 1;

        if (mobileA !== mobileB) {
          return mobileA - mobileB;
        }

        const shopCompare = String(
          a?.shop_name || ""
        ).localeCompare(String(b?.shop_name || ""));

        return shopCompare !== 0
          ? shopCompare
          : String(a?.employee_name || "").localeCompare(
              String(b?.employee_name || "")
            );
      }),
    [bankingEmployees]
  );

  const selectedBankingEmployee = useMemo(() => {
    if (!selectedBankingEmployeeId) return null;

    return (
      bankingEmployees.find(
        (employee) =>
          String(employee.employee_id) ===
          String(selectedBankingEmployeeId)
      ) || null
    );
  }, [bankingEmployees, selectedBankingEmployeeId]);

  // ==========================================
  // CATEGORY DATA
  // ==========================================

  const rows = useMemo(
    () =>
      CATEGORY_CONFIG.map((config) => {
        if (config.key === "BANKING") {
          return {
            ...config,
            accountId: null,
            balance: Number(
              selectedBankingEmployee?.saved_balance || 0
            ),
            obligationAmount: null,
            pendingPaymentAmount: Number(
              selectedBankingEmployee?.pending_payment_amount || 0
            ),
            availableBalance: Number(
              selectedBankingEmployee?.available_balance || 0
            ),
            employeeId:
              selectedBankingEmployee?.employee_id || null,
          };
        }

        const found = categories.find(
          (row) =>
            String(row?.category || "").toUpperCase() ===
            config.key
        );

        return {
          ...config,
          accountId: found?.account_id || null,
          balance: Number(found?.balance || 0),
          obligationAmount:
            found?.obligation_amount == null
              ? null
              : Number(found.obligation_amount),
          pendingPaymentAmount: Number(
            found?.pending_payment_amount || 0
          ),
          availableBalance: Number(
            found?.available_balance || 0
          ),
        };
      }),
    [categories, selectedBankingEmployee]
  );

  // ==========================================
  // TOTALS
  // ==========================================

  const totals = useMemo(() => {
    return {
      saved: roundMoney(
        rows.reduce(
          (sum, row) => sum + Number(row.balance || 0),
          0
        )
      ),
      reserved: roundMoney(
        rows.reduce(
          (sum, row) =>
            sum + Number(row.pendingPaymentAmount || 0),
          0
        )
      ),
    };
  }, [rows]);

  // ==========================================
  // INPUT HELPERS
  // ==========================================

  function setInput(category, field, value) {
    setInputs((previous) => ({
      ...previous,
      [category]: {
        ...previous[category],
        [field]: value,
      },
    }));

    setNotice(null);
  }

  function clearInput(category, field) {
    setInputs((previous) => ({
      ...previous,
      [category]: {
        ...previous[category],
        [field]: "",
      },
    }));
  }

  function selectBankingEmployee(employeeId) {
    setSelectedBankingEmployeeId(employeeId);

    setInputs((previous) => ({
      ...previous,
      BANKING: {
        save: "",
        pay: "",
        withdraw: "",
      },
    }));

    setNotice(null);
  }

  function requireBankingEmployee() {
    if (selectedBankingEmployee) return true;

    notify("Select an employee for Banking.");
    return false;
  }
  // ==========================================
  // SAVE MONEY
  // ==========================================

  async function saveMoney(row) {
    if (actionKey) return;

    if (
      row.key === "BANKING" &&
      !requireBankingEmployee()
    ) {
      return;
    }

    const rawAmount = inputs[row.key]?.save;
    const amount = Number(rawAmount);

    if (
      rawAmount === "" ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      notify(`Enter a valid ${row.label} save amount.`);
      return;
    }

    const bankingText =
      row.key === "BANKING"
        ? `\nEmployee: ${selectedBankingEmployee.employee_name}`
        : "";

    const confirmed = window.confirm(
      `Save KES ${money(amount)} to ${row.label}?${bankingText}\n\n` +
      `This will immediately add KES ${money(amount)} to Expenses and Savings.`
    );

    if (!confirmed) return;

    const key = `SAVE-${row.key}`;

    try {
      setActionKey(key);
      setNotice(null);

      const isBanking = row.key === "BANKING";

      const functionName = isBanking
        ? "tl_cashier_save_banking_employee"
        : "tl_cashier_save_savings";

      const body = isBanking
        ? {
            p_shift_id: shiftId,
            p_employee_id:
              selectedBankingEmployee.employee_id,
            p_amount: roundMoney(amount),
          }
        : {
            p_shift_id: shiftId,
            p_category: row.key,
            p_amount: roundMoney(amount),
          };

      const response = await fetch(
        `${supabaseUrl}/rest/v1/rpc/${functionName}`,
        {
          method: "POST",
          headers: authHeaders(
            supabaseAnonKey,
            accessToken
          ),
          body: JSON.stringify(body),
        }
      );

      const result = await safeJson(response);

      if (!response.ok) {
        throw new Error(
          result?.message ||
          result?.details ||
          result?.hint ||
          "Unable to save money."
        );
      }

      clearInput(row.key, "save");

      notify(
        isBanking
          ? `${selectedBankingEmployee.employee_name}: KES ${money(amount)} saved.`
          : `${row.label}: KES ${money(amount)} saved.`,
        "success"
      );

      await loadSavings(true);
    } catch (error) {
      console.error("SAVE MONEY ERROR:", error);

      notify(
        error?.message || "Unable to save money."
      );
    } finally {
      setActionKey("");
    }
  }

  // ==========================================
  // PAYMENT AMOUNT
  // ==========================================

  function getPaymentAmount(row) {
    return row.fixedPayment
      ? Number(row.obligationAmount || 0)
      : Number(inputs[row.key]?.pay || 0);
  }

  // ==========================================
  // REQUEST PAYMENT — ACCOUNTANT APPROVAL
  // ==========================================

  async function requestPayment(row) {
    if (actionKey) return;

    if (
      row.key === "BANKING" &&
      !requireBankingEmployee()
    ) {
      return;
    }

    if (
      row.fixedPayment &&
      (
        row.obligationAmount === null ||
        !Number.isFinite(row.obligationAmount) ||
        row.obligationAmount <= 0
      )
    ) {
      notify(
        `${row.label} payment amount is not set by Admin.`
      );
      return;
    }

    const amount = getPaymentAmount(row);

    if (!Number.isFinite(amount) || amount <= 0) {
      notify(
        `Enter a valid ${row.label} payment amount.`
      );
      return;
    }

    if (amount > row.availableBalance) {
      notify(
        `${row.label}: Available KES ${money(row.availableBalance)}.`
      );
      return;
    }

    const bankingText =
      row.key === "BANKING"
        ? `\nEmployee: ${selectedBankingEmployee.employee_name}`
        : "";

    const confirmed = window.confirm(
      `Request ${row.label} payment?${bankingText}\n\n` +
      `Amount: KES ${money(amount)}\n\n` +
      `The Accountant must confirm the actual payment before this amount leaves Savings.`
    );

    if (!confirmed) return;

    const key = `PAY-${row.key}`;

    try {
      setActionKey(key);
      setNotice(null);

      const isBanking = row.key === "BANKING";

      const functionName = isBanking
        ? "tl_cashier_request_banking_payment_employee"
        : "tl_cashier_request_savings_payment";

      const body = isBanking
        ? {
            p_shift_id: shiftId,
            p_employee_id:
              selectedBankingEmployee.employee_id,
            p_amount: roundMoney(amount),
          }
        : {
            p_shift_id: shiftId,
            p_category: row.key,
            p_amount: roundMoney(amount),
          };

      const response = await fetch(
        `${supabaseUrl}/rest/v1/rpc/${functionName}`,
        {
          method: "POST",
          headers: authHeaders(
            supabaseAnonKey,
            accessToken
          ),
          body: JSON.stringify(body),
        }
      );

      const result = await safeJson(response);

      if (!response.ok) {
        throw new Error(
          result?.message ||
          result?.details ||
          result?.hint ||
          "Unable to request payment."
        );
      }

      if (!row.fixedPayment) {
        clearInput(row.key, "pay");
      }

      notify(
        `${row.label}: Payment request sent to Accountant.`,
        "success"
      );

      await loadSavings(true);
    } catch (error) {
      console.error("REQUEST PAYMENT ERROR:", error);

      notify(
        error?.message || "Unable to request payment."
      );
    } finally {
      setActionKey("");
    }
  }

  // ==========================================
  // WITHDRAW SAVINGS
  // ==========================================

  async function withdrawMoney(row) {
    if (actionKey) return;

    if (
      row.key === "BANKING" &&
      !requireBankingEmployee()
    ) {
      return;
    }

    const rawAmount = inputs[row.key]?.withdraw;
    const amount = Number(rawAmount);

    if (
      rawAmount === "" ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      notify(
        `Enter a valid ${row.label} withdrawal amount.`
      );
      return;
    }

    if (amount > row.availableBalance) {
      notify(
        `${row.label}: Available KES ${money(row.availableBalance)}.`
      );
      return;
    }

    const bankingText =
      row.key === "BANKING"
        ? `\nEmployee: ${selectedBankingEmployee.employee_name}`
        : "";

    const confirmed = window.confirm(
      `Withdraw KES ${money(amount)} from ${row.label} Savings?${bankingText}\n\n` +
      `The money will automatically enter the next available M-Shwari Added Float position.`
    );

    if (!confirmed) return;

    const key = `WITHDRAW-${row.key}`;

    try {
      setActionKey(key);
      setNotice(null);

      const isBanking = row.key === "BANKING";

      const functionName = isBanking
        ? "tl_cashier_withdraw_banking_employee"
        : "tl_cashier_withdraw_savings";

      const body = isBanking
        ? {
            p_shift_id: shiftId,
            p_employee_id:
              selectedBankingEmployee.employee_id,
            p_amount: roundMoney(amount),
          }
        : {
            p_shift_id: shiftId,
            p_category: row.key,
            p_amount: roundMoney(amount),
          };

      const response = await fetch(
        `${supabaseUrl}/rest/v1/rpc/${functionName}`,
        {
          method: "POST",
          headers: authHeaders(
            supabaseAnonKey,
            accessToken
          ),
          body: JSON.stringify(body),
        }
      );

      const result = await safeJson(response);

      if (!response.ok) {
        throw new Error(
          result?.message ||
          result?.details ||
          result?.hint ||
          "Unable to withdraw Savings."
        );
      }

      clearInput(row.key, "withdraw");

      notify(
        `${row.label}: KES ${money(amount)} withdrawn to M-Shwari Float ${result?.mshwari_slot || ""}.`,
        "success"
      );

      await loadSavings(true);
    } catch (error) {
      console.error("WITHDRAW SAVINGS ERROR:", error);

      notify(
        error?.message || "Unable to withdraw Savings."
      );
    } finally {
      setActionKey("");
    }
  }
  // ==========================================
  // DISPLAY
  // ==========================================

  return (
    <section className="tl-shared-savings" style={styles.panel}>
      <style>{`
        .tl-shared-savings input[type="number"] {
          appearance: textfield;
          -moz-appearance: textfield;
        }

        .tl-shared-savings input[type="number"]::-webkit-inner-spin-button,
        .tl-shared-savings input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
      `}</style>

      <div style={styles.heading}>
        SAVINGS / BANKING
      </div>

      {notice && (
        <div
          role="status"
          aria-live="polite"
          style={{
            ...styles.message,
            ...(notice.type === "success"
              ? styles.messageSuccess
              : styles.messageError),
          }}
        >
          {notice.text}
        </div>
      )}

      {loading ? (
        <div style={styles.loading}>
          Loading...
        </div>
      ) : (
        <>
          <div style={styles.categoryGrid}>
            {rows.map((row) => {
              const saveBusy =
                actionKey === `SAVE-${row.key}`;

              const payBusy =
                actionKey === `PAY-${row.key}`;

              const withdrawBusy =
                actionKey === `WITHDRAW-${row.key}`;

              const anyBusy = actionKey !== "";
              const isBanking = row.key === "BANKING";

              const bankingReady =
                !isBanking ||
                Boolean(selectedBankingEmployee);

              const fixedAmountReady =
                row.obligationAmount !== null &&
                Number.isFinite(row.obligationAmount) &&
                row.obligationAmount > 0;

              const fixedCanPay =
                fixedAmountReady &&
                row.availableBalance >=
                  row.obligationAmount;

              const selected = inputs[row.key] || {
                save: "",
                pay: "",
                withdraw: "",
              };

              const disablePay =
                anyBusy ||
                !bankingReady ||
                row.availableBalance <= 0 ||
                (row.fixedPayment && !fixedCanPay);

              const disableWithdraw =
                anyBusy ||
                !bankingReady ||
                row.availableBalance <= 0;

              return (
                <article
                  key={row.key}
                  style={{
                    ...styles.categoryCard,
                    ...(isBanking
                      ? styles.bankingCard
                      : {}),
                  }}
                >
                  <div style={styles.categoryHead}>
                    <strong style={styles.categoryName}>
                      {row.label}
                    </strong>

                    {row.fixedPayment && (
                      <span style={styles.fixedTag}>
                        FIXED
                      </span>
                    )}
                  </div>

                  <div style={styles.balanceTile}>
                    <span style={styles.balanceLabel}>
                      SAVED
                    </span>

                    <strong style={styles.balanceAmount}>
                      KES {money(row.balance)}
                    </strong>
                  </div>

                  {isBanking && (
                    <div style={styles.bankingSelectorWrap}>
                      <select
                        aria-label="Select Banking employee"
                        value={selectedBankingEmployeeId}
                        disabled={anyBusy}
                        onChange={(event) =>
                          selectBankingEmployee(
                            event.target.value
                          )
                        }
                        style={styles.select}
                      >
                        <option value="">
                          Select employee
                        </option>

                        {sortedBankingEmployees.map(
                          (employee) => (
                            <option
                              key={employee.employee_id}
                              value={employee.employee_id}
                            >
                              {employee.is_mobile
                                ? `★ MOBILE — ${employee.employee_name}`
                                : `${employee.shop_name || "UNASSIGNED"} — ${employee.employee_name}`}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                  )}

                  {row.pendingPaymentAmount > 0 && (
                    <div style={styles.reserved}>
                      PENDING: KES{" "}
                      {money(row.pendingPaymentAmount)}
                    </div>
                  )}

                  <div style={styles.actions}>
                    {/* SAVE */}

                    <div style={styles.actionRow}>
                      <span style={styles.actionLabel}>
                        SAVE
                      </span>

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        aria-label={`${row.label} save amount`}
                        value={selected.save}
                        disabled={anyBusy || !bankingReady}
                        placeholder={
                          isBanking && !bankingReady
                            ? "Select employee"
                            : "Amount"
                        }
                        onChange={(event) =>
                          setInput(
                            row.key,
                            "save",
                            event.target.value
                          )
                        }
                        style={styles.input}
                      />

                      <button
                        type="button"
                        disabled={anyBusy || !bankingReady}
                        onClick={() => saveMoney(row)}
                        style={{
                          ...styles.actionButton,
                          ...styles.saveButton,
                          opacity:
                            anyBusy || !bankingReady
                              ? 0.45
                              : 1,
                        }}
                      >
                        {saveBusy ? "Saving..." : "Save"}
                      </button>
                    </div>

                    {/* REQUEST PAY */}

                    <div style={styles.actionRow}>
                      <span style={styles.actionLabel}>
                        PAY
                      </span>

                      {row.fixedPayment ? (
                        <input
                          type="text"
                          readOnly
                          aria-label={`${row.label} fixed payment amount`}
                          value={
                            fixedAmountReady
                              ? money(row.obligationAmount)
                              : ""
                          }
                          placeholder="Not set"
                          style={{
                            ...styles.input,
                            ...styles.readOnlyInput,
                          }}
                        />
                      ) : (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          aria-label={`${row.label} payment amount`}
                          value={selected.pay}
                          disabled={anyBusy || !bankingReady}
                          placeholder={
                            isBanking && !bankingReady
                              ? "Select employee"
                              : "Amount"
                          }
                          onChange={(event) =>
                            setInput(
                              row.key,
                              "pay",
                              event.target.value
                            )
                          }
                          style={styles.input}
                        />
                      )}

                      <button
                        type="button"
                        disabled={disablePay}
                        onClick={() => requestPayment(row)}
                        style={{
                          ...styles.actionButton,
                          ...styles.payButton,
                          opacity: disablePay ? 0.45 : 1,
                        }}
                      >
                        {payBusy
                          ? "Sending..."
                          : "Request Pay"}
                      </button>
                    </div>

                    {/* WITHDRAW */}

                    <div style={styles.actionRow}>
                      <span style={styles.actionLabel}>
                        WITHDRAW
                      </span>

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        aria-label={`${row.label} withdrawal amount`}
                        value={selected.withdraw}
                        disabled={disableWithdraw}
                        placeholder={
                          isBanking && !bankingReady
                            ? "Select employee"
                            : "Amount"
                        }
                        onChange={(event) =>
                          setInput(
                            row.key,
                            "withdraw",
                            event.target.value
                          )
                        }
                        style={styles.input}
                      />

                      <button
                        type="button"
                        disabled={disableWithdraw}
                        onClick={() => withdrawMoney(row)}
                        style={{
                          ...styles.actionButton,
                          ...styles.withdrawButton,
                          opacity:
                            disableWithdraw ? 0.45 : 1,
                        }}
                      >
                        {withdrawBusy
                          ? "Working..."
                          : "Withdraw"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {/* TOTALS */}

          <div style={styles.totalsGrid}>
            <TotalTile
              label="TOTAL SAVED"
              amount={totals.saved}
            />

            {totals.reserved > 0 && (
              <TotalTile
                label="PENDING PAYMENTS"
                amount={totals.reserved}
              />
            )}
          </div>

          {/* FINANCIAL STATUSES REMAIN VISIBLE */}

          {paymentRequests.length > 0 && (
            <div style={styles.history}>
              <div style={styles.historyHeading}>
                PAYMENT STATUS
              </div>

              <div style={styles.historyGrid}>
                {paymentRequests
                  .slice(0, 6)
                  .map((request) => (
                    <div
                      key={request.id}
                      style={styles.historyRow}
                    >
                      <div style={styles.historyName}>
                        <strong>
                          {request.category}
                        </strong>

                        <span style={styles.historyDate}>
                          {formatDateTime(
                            request.requested_at
                          )}
                        </span>
                      </div>

                      <strong style={styles.historyAmount}>
                        KES {money(request.amount)}
                      </strong>

                      <StatusBadge
                        status={request.status}
                      />
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

// ==========================================
// DISPLAY COMPONENTS
// ==========================================

function TotalTile({ label, amount }) {
  return (
    <div style={styles.totalTile}>
      <span style={styles.totalLabel}>
        {label}
      </span>

      <strong style={styles.totalAmount}>
        KES {money(amount)}
      </strong>
    </div>
  );
}

function StatusBadge({ status }) {
  const value = String(status || "").toUpperCase();

  const statusStyle =
    value === "CONFIRMED"
      ? styles.statusConfirmed
      : value === "PROCESSING"
      ? styles.statusProcessing
      : ["REJECTED", "FAILED", "CANCELLED"].includes(value)
      ? styles.statusRejected
      : styles.statusPending;

  return (
    <span
      style={{
        ...styles.statusBase,
        ...statusStyle,
      }}
    >
      {value || "PENDING"}
    </span>
  );
}

// ==========================================
// API AND MONEY HELPERS
// ==========================================

function authHeaders(anonKey, accessToken) {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function money(value) {
  return Number(value || 0).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function roundMoney(value) {
  return (
    Math.round(
      (Number(value) + Number.EPSILON) * 100
    ) / 100
  );
}

function formatDateTime(value) {
  if (!value) return "";

  try {
    return new Intl.DateTimeFormat("en-KE", {
      timeZone: "Africa/Nairobi",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "";
  }
}
// ==========================================
// SAVINGS / BANKING STYLES
// ==========================================

const styles = {
  panel: {
    gridColumn: "1 / -1",
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    background: T.surface,
    color: T.ink,
    border: `1px solid ${T.border}`,
    borderRadius: 12,
    overflow: "hidden",
    boxShadow: "0 8px 25px rgba(0,0,0,.10)",
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },

  heading: {
    padding: "12px 16px",
    background: "#152639",
    borderLeft: `3px solid ${T.gold}`,
    borderBottom: `1px solid ${T.border}`,
    color: T.ink,
    fontSize: 14,
    fontWeight: 850,
    letterSpacing: ".06em",
  },

  message: {
    margin: "9px 12px 0",
    padding: "10px 12px",
    borderRadius: 7,
    fontSize: 12,
    fontWeight: 750,
  },

  messageSuccess: {
    background: "#10332E",
    border: "1px solid #2A6354",
    color: "#A8EBD1",
  },

  messageError: {
    background: "#38202A",
    border: "1px solid #774155",
    color: "#FFC3CE",
  },

  loading: {
    padding: 20,
    textAlign: "center",
    color: T.sub,
  },

  categoryGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(min(100%, 330px), 1fr))",
    gap: 12,
    padding: "12px",
  },

  categoryCard: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    padding: 13,
    background: T.surfaceRaised,
    border: `1px solid ${T.border}`,
    borderRadius: 9,
    boxSizing: "border-box",
  },

  bankingCard: {
    borderColor: "#756039",
    background:
      "linear-gradient(155deg, #1C2C3F 0%, #15263A 50%)",
  },

  categoryHead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 10,
  },

  categoryName: {
    color: T.ink,
    fontSize: 16,
    fontWeight: 850,
  },

  fixedTag: {
    color: T.gold,
    fontSize: 9,
    fontWeight: 800,
    border: "1px solid #6A593A",
    background: "#2A2930",
    borderRadius: 5,
    padding: "4px 6px",
  },

  balanceTile: {
    display: "grid",
    gap: 5,
    minWidth: 0,
    marginBottom: 11,
    background: T.inset,
    border: `1px solid ${T.softBorder}`,
    borderRadius: 7,
    padding: "9px 11px",
  },

  balanceLabel: {
    fontSize: 10,
    letterSpacing: ".08em",
    fontWeight: 800,
    color: T.muted,
  },

  balanceAmount: {
    fontSize: 15,
    fontWeight: 850,
    fontVariantNumeric: "tabular-nums",
    overflowWrap: "anywhere",
  },

  bankingSelectorWrap: {
    marginBottom: 10,
  },

  select: {
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    minHeight: 39,
    padding: "9px 10px",
    border: `1px solid ${T.border}`,
    borderRadius: 7,
    background: T.surface,
    color: T.ink,
    fontSize: 12,
    fontFamily: "inherit",
  },

  reserved: {
    marginBottom: 10,
    padding: "8px 10px",
    color: "#FFE3A8",
    fontSize: 11,
    fontWeight: 800,
    background: "#322A1D",
    border: "1px solid #695638",
    borderRadius: 7,
  },

  actions: {
    display: "grid",
    gap: 8,
    marginTop: "auto",
  },

  actionRow: {
    display: "grid",
    gridTemplateColumns:
      "66px minmax(0,1fr) 104px",
    alignItems: "center",
    gap: 7,
    minWidth: 0,
  },

  actionLabel: {
    color: T.sub,
    fontSize: 10,
    fontWeight: 850,
  },

  input: {
    display: "block",
    minWidth: 0,
    width: "100%",
    boxSizing: "border-box",
    minHeight: 39,
    padding: "8px 10px",
    color: T.ink,
    background: T.inset,
    border: `1px solid ${T.border}`,
    borderRadius: 7,
    fontSize: 12,
    fontWeight: 650,
    textAlign: "right",
    fontFamily: "inherit",
    fontVariantNumeric: "tabular-nums",
  },

  readOnlyInput: {
    color: T.muted,
    cursor: "not-allowed",
    background: "#102030",
  },

  actionButton: {
    minWidth: 0,
    width: "100%",
    minHeight: 39,
    padding: "7px 6px",
    borderRadius: 7,
    fontWeight: 850,
    fontSize: 11,
    fontFamily: "inherit",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  saveButton: {
    background: "#186C60",
    border: "1px solid #268B7B",
    color: "#FFFFFF",
  },

  payButton: {
    background: "#224C74",
    border: "1px solid #346D9E",
    color: "#FFFFFF",
  },

  withdrawButton: {
    background: T.surface,
    border: `1px solid ${T.border}`,
    color: T.sub,
  },

  totalsGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(min(100%, 195px), 1fr))",
    gap: 10,
    padding: "0 12px 12px",
  },

  totalTile: {
    minWidth: 0,
    display: "grid",
    gap: 5,
    padding: "11px 13px",
    background: T.surfaceRaised,
    border: `1px solid ${T.border}`,
    borderRadius: 8,
  },

  totalLabel: {
    color: T.muted,
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: ".07em",
  },

  totalAmount: {
    fontSize: 17,
    fontWeight: 850,
    fontVariantNumeric: "tabular-nums",
    overflowWrap: "anywhere",
  },

  history: {
    margin: "0 12px 12px",
    padding: "11px",
    background: T.surfaceRaised,
    border: `1px solid ${T.border}`,
    borderRadius: 8,
  },

  historyHeading: {
    color: T.sub,
    fontSize: 11,
    letterSpacing: ".06em",
    fontWeight: 850,
    marginBottom: 8,
  },

  historyGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(min(100%,290px),1fr))",
    gap: 7,
  },

  historyRow: {
    display: "grid",
    gridTemplateColumns:
      "minmax(0,1fr) auto auto",
    alignItems: "center",
    gap: 9,
    padding: "9px 10px",
    background: T.inset,
    border: `1px solid ${T.softBorder}`,
    borderRadius: 7,
    fontSize: 11,
  },

  historyName: {
    display: "grid",
    gap: 3,
    minWidth: 0,
    color: T.ink,
  },

  historyDate: {
    fontSize: 10,
    color: T.muted,
  },

  historyAmount: {
    color: T.ink,
    whiteSpace: "nowrap",
    fontVariantNumeric: "tabular-nums",
  },

  statusBase: {
    fontSize: 9,
    fontWeight: 850,
    padding: "5px 7px",
    borderRadius: 5,
    whiteSpace: "nowrap",
    textAlign: "center",
  },

  statusPending: {
    color: "#FFE3A8",
    background: "#322A1D",
    border: "1px solid #695638",
  },

  statusProcessing: {
    color: "#B1D2FF",
    background: "#142D48",
    border: "1px solid #355779",
  },

  statusConfirmed: {
    color: "#A8EBD1",
    background: "#10332E",
    border: "1px solid #2A6354",
  },

  statusRejected: {
    color: "#FFC3CE",
    background: "#38202A",
    border: "1px solid #774155",
  },
};
