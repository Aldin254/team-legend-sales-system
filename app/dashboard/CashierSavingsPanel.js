"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

// =============================================================
// TEAM LEGEND / NYIKA — CASHIER SAVINGS / BANKING
// Professional styling; original Supabase money rules retained
// =============================================================

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
  blue: "#7DB8FA",
  danger: "#FB8B96",
};

function blankInputs() {
  const result = {};
  for (const category of CATEGORY_CONFIG) {
    result[category.key] = { save: "", pay: "", withdraw: "" };
  }
  return result;
}

export default function CashierSavingsPanel({ user, currentShift }) {
  const [categories, setCategories] = useState([]);
  const [paymentRequests, setPaymentRequests] = useState([]);
  const [bankingEmployees, setBankingEmployees] = useState([]);
  const [selectedBankingEmployeeId, setSelectedBankingEmployeeId] = useState("");
  const [inputs, setInputs] = useState(blankInputs);
  const [loading, setLoading] = useState(true);
  const [actionKey, setActionKey] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const accessToken = user?.access_token || null;
  const shiftId = currentShift?.id || null;

  // ===========================================================
  // LOAD SAVINGS AND EMPLOYEE BANKING
  // ===========================================================

  const loadSavings = useCallback(async (silent = false) => {
    if (!shiftId || !accessToken || !supabaseUrl || !supabaseAnonKey) {
      setLoading(false);
      return;
    }

    try {
      if (!silent) setLoading(true);

      const headers = authHeaders(supabaseAnonKey, accessToken);

      const [savingsResponse, bankingResponse] = await Promise.all([
        fetch(`${supabaseUrl}/rest/v1/rpc/tl_cashier_savings_snapshot`, {
          method: "POST",
          headers,
          body: JSON.stringify({ p_shift_id: shiftId }),
          cache: "no-store",
        }),
        fetch(`${supabaseUrl}/rest/v1/rpc/tl_cashier_banking_directory`, {
          method: "POST",
          headers,
          body: JSON.stringify({ p_shift_id: shiftId }),
          cache: "no-store",
        }),
      ]);

      const [savingsResult, bankingResult] = await Promise.all([
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

      const loadedCategories = Array.isArray(savingsResult?.categories)
        ? savingsResult.categories
        : [];

      const loadedRequests = Array.isArray(savingsResult?.payment_requests)
        ? savingsResult.payment_requests
        : [];

      const loadedEmployees = Array.isArray(bankingResult?.employees)
        ? bankingResult.employees
        : [];

      setCategories(loadedCategories);
      setPaymentRequests(loadedRequests);
      setBankingEmployees(loadedEmployees);

      setSelectedBankingEmployeeId((previous) => {
        if (!previous) return "";
        return loadedEmployees.some(
          (employee) =>
            String(employee.employee_id) === String(previous)
        )
          ? previous
          : "";
      });
    } catch (error) {
      console.error("LOAD SAVINGS ERROR:", error);

      if (!silent) {
        setMessage(error?.message || "Unable to load Savings.");
        setMessageType("error");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [shiftId, accessToken, supabaseUrl, supabaseAnonKey]);

  // ===========================================================
  // LIVE REFRESH
  // ===========================================================

  useEffect(() => {
    loadSavings();

    const timer = setInterval(() => loadSavings(true), 5000);

    return () => clearInterval(timer);
  }, [loadSavings]);

  // ===========================================================
  // EMPLOYEE BANKING DIRECTORY
  // ===========================================================

  const sortedBankingEmployees = useMemo(
    () =>
      [...bankingEmployees].sort((a, b) => {
        const mobileA = a?.is_mobile ? 0 : 1;
        const mobileB = b?.is_mobile ? 0 : 1;

        if (mobileA !== mobileB) return mobileA - mobileB;

        const shopCompare = String(a?.shop_name || "").localeCompare(
          String(b?.shop_name || "")
        );

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

  // ===========================================================
  // SAVINGS ROWS
  // ===========================================================

  const rows = useMemo(
    () =>
      CATEGORY_CONFIG.map((config) => {
        if (config.key === "BANKING") {
          return {
            ...config,
            accountId: null,
            balance: Number(selectedBankingEmployee?.saved_balance || 0),
            obligationAmount: null,
            pendingPaymentAmount: Number(
              selectedBankingEmployee?.pending_payment_amount || 0
            ),
            availableBalance: Number(
              selectedBankingEmployee?.available_balance || 0
            ),
            employeeId: selectedBankingEmployee?.employee_id || null,
          };
        }

        const found = categories.find(
          (row) =>
            String(row?.category || "").toUpperCase() === config.key
        );

        return {
          ...config,
          accountId: found?.account_id || null,
          balance: Number(found?.balance || 0),
          obligationAmount:
            found?.obligation_amount === null ||
            found?.obligation_amount === undefined
              ? null
              : Number(found.obligation_amount),
          pendingPaymentAmount: Number(
            found?.pending_payment_amount || 0
          ),
          availableBalance: Number(found?.available_balance || 0),
        };
      }),
    [categories, selectedBankingEmployee]
  );

  // ===========================================================
  // TOTALS
  // ===========================================================

  const totals = useMemo(() => {
    let saved = 0;
    let reserved = 0;
    let available = 0;

    for (const row of rows) {
      saved += Number(row.balance || 0);
      reserved += Number(row.pendingPaymentAmount || 0);
      available += Number(row.availableBalance || 0);
    }

    return {
      saved: roundMoney(saved),
      reserved: roundMoney(reserved),
      available: roundMoney(available),
    };
  }, [rows]);

  // ===========================================================
  // INPUT HELPERS
  // ===========================================================

  function setInput(category, field, value) {
    setInputs((previous) => ({
      ...previous,
      [category]: {
        ...previous[category],
        [field]: value,
      },
    }));

    setMessage("");
    setMessageType("");
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

  function clearBankingInputs() {
    setInputs((previous) => ({
      ...previous,
      BANKING: { save: "", pay: "", withdraw: "" },
    }));
  }

  function selectBankingEmployee(employeeId) {
    setSelectedBankingEmployeeId(employeeId);
    clearBankingInputs();
    setMessage("");
    setMessageType("");
  }

  function requireBankingEmployee() {
    if (selectedBankingEmployee) return true;

    setMessage("Select an employee before using Banking.");
    setMessageType("error");
    return false;
  }

  // ===========================================================
  // SAVE — POSTS IMMEDIATELY TO SAVINGS AND EXPENSES
  // ===========================================================

  async function saveMoney(row) {
    if (row.key === "BANKING" && !requireBankingEmployee()) return;

    const rawAmount = inputs[row.key]?.save;
    const amount = Number(rawAmount);

    if (
      rawAmount === "" ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      setMessage(`Enter a valid amount to save for ${row.label}.`);
      setMessageType("error");
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
      setMessage("");
      setMessageType("");

      const isBanking = row.key === "BANKING";

      const functionName = isBanking
        ? "tl_cashier_save_banking_employee"
        : "tl_cashier_save_savings";

      const body = isBanking
        ? {
            p_shift_id: shiftId,
            p_employee_id: selectedBankingEmployee.employee_id,
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
          headers: authHeaders(supabaseAnonKey, accessToken),
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

      setMessage(
        isBanking
          ? `${selectedBankingEmployee.employee_name}: KES ${money(amount)} Banking saved successfully.`
          : `${row.label}: KES ${money(amount)} saved successfully.`
      );

      setMessageType("success");
      await loadSavings(true);
    } catch (error) {
      console.error("SAVE MONEY ERROR:", error);
      setMessage(error?.message || "Unable to save money.");
      setMessageType("error");
    } finally {
      setActionKey("");
    }
  }

  function getPaymentAmount(row) {
    return row.fixedPayment
      ? Number(row.obligationAmount || 0)
      : Number(inputs[row.key]?.pay || 0);
  }

  // ===========================================================
  // REQUEST PAY — ACCOUNTANT CONFIRMATION REQUIRED
  // ===========================================================

  async function requestPayment(row) {
    if (row.key === "BANKING" && !requireBankingEmployee()) return;

    if (
      row.fixedPayment &&
      (row.obligationAmount === null ||
        !Number.isFinite(row.obligationAmount) ||
        row.obligationAmount <= 0)
    ) {
      setMessage(
        `${row.label} fixed payment amount has not been configured by Admin yet.`
      );
      setMessageType("error");
      return;
    }

    const amount = getPaymentAmount(row);

    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage(`Enter a valid ${row.label} payment amount.`);
      setMessageType("error");
      return;
    }

    if (amount > row.availableBalance) {
      setMessage(
        `${row.label} payment cannot exceed available Savings. ` +
          `Available: KES ${money(row.availableBalance)}.`
      );
      setMessageType("error");
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
      setMessage("");
      setMessageType("");

      const isBanking = row.key === "BANKING";

      const functionName = isBanking
        ? "tl_cashier_request_banking_payment_employee"
        : "tl_cashier_request_savings_payment";

      const body = isBanking
        ? {
            p_shift_id: shiftId,
            p_employee_id: selectedBankingEmployee.employee_id,
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
          headers: authHeaders(supabaseAnonKey, accessToken),
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

      if (!row.fixedPayment) clearInput(row.key, "pay");

      setMessage(
        isBanking
          ? `${selectedBankingEmployee.employee_name}: Banking payment request sent to Accountant for KES ${money(amount)}.`
          : `${row.label} payment request sent to Accountant for KES ${money(amount)}.`
      );

      setMessageType("success");
      await loadSavings(true);
    } catch (error) {
      console.error("REQUEST PAYMENT ERROR:", error);
      setMessage(error?.message || "Unable to request payment.");
      setMessageType("error");
    } finally {
      setActionKey("");
    }
  }

  // ===========================================================
  // WITHDRAW — RETURNS TO M-SHWARI ADDED FLOAT
  // ===========================================================

  async function withdrawMoney(row) {
    if (row.key === "BANKING" && !requireBankingEmployee()) return;

    const rawAmount = inputs[row.key]?.withdraw;
    const amount = Number(rawAmount);

    if (
      rawAmount === "" ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      setMessage(`Enter a valid ${row.label} withdrawal amount.`);
      setMessageType("error");
      return;
    }

    if (amount > row.availableBalance) {
      setMessage(
        `Withdrawal cannot exceed available ${row.label} Savings. ` +
          `Available: KES ${money(row.availableBalance)}.`
      );
      setMessageType("error");
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
      setMessage("");
      setMessageType("");

      const isBanking = row.key === "BANKING";

      const functionName = isBanking
        ? "tl_cashier_withdraw_banking_employee"
        : "tl_cashier_withdraw_savings";

      const body = isBanking
        ? {
            p_shift_id: shiftId,
            p_employee_id: selectedBankingEmployee.employee_id,
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
          headers: authHeaders(supabaseAnonKey, accessToken),
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

      setMessage(
        isBanking
          ? `${selectedBankingEmployee.employee_name}: KES ${money(amount)} withdrawn from Banking to M-Shwari Added Float ${result?.mshwari_slot || ""}.`
          : `${row.label}: KES ${money(amount)} withdrawn to M-Shwari Added Float ${result?.mshwari_slot || ""}.`
      );

      setMessageType("success");
      await loadSavings(true);
    } catch (error) {
      console.error("WITHDRAW SAVINGS ERROR:", error);
      setMessage(error?.message || "Unable to withdraw Savings.");
      setMessageType("error");
    } finally {
      setActionKey("");
    }
  }

  // ===========================================================
  // DISPLAY
  // ===========================================================

  return (
    <section style={styles.panel}>
      <div style={styles.heading}>
        <div style={styles.headingTitle}>
          SAVINGS <span style={{ color: T.gold }}>/</span> BANKING
        </div>
        <div style={styles.headingCaption}>
          Shop savings · employee banking · Accountant payment requests
        </div>
      </div>

      <div style={styles.instruction}>
        <span style={styles.instructionDot} />
        <span>
          <strong style={{ color: T.ink }}>SAVE</strong> posts immediately to
          Savings and Expenses.{" "}
          <strong style={{ color: T.ink }}>PAY</strong> requires Accountant
          confirmation.
        </span>
      </div>

      {message && (
        <div
          role="status"
          style={{
            ...styles.message,
            ...(messageType === "success"
              ? styles.messageSuccess
              : styles.messageError),
          }}
        >
          {message}
        </div>
      )}

      {loading ? (
        <div style={styles.loading}>Loading Savings / Banking…</div>
      ) : (
        <>
          {/* SAVINGS CATEGORY CARDS */}

          <div style={styles.categoryGrid}>
            {rows.map((row) => {
              const saveBusy = actionKey === `SAVE-${row.key}`;
              const payBusy = actionKey === `PAY-${row.key}`;
              const withdrawBusy = actionKey === `WITHDRAW-${row.key}`;
              const anyBusy = actionKey !== "";

              const isBanking = row.key === "BANKING";
              const bankingReady =
                !isBanking || Boolean(selectedBankingEmployee);

              const fixedAmountReady =
                row.obligationAmount !== null &&
                Number.isFinite(row.obligationAmount) &&
                row.obligationAmount > 0;

              const fixedCanPay =
                fixedAmountReady &&
                row.availableBalance >= row.obligationAmount;

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
                    ...(isBanking ? styles.bankingCard : {}),
                  }}
                >
                  <div style={styles.categoryHead}>
                    <div style={{ minWidth: 0 }}>
                      <div style={styles.categoryName}>{row.label}</div>
                      <div style={styles.categorySub}>
                        {row.fixedPayment
                          ? `Fixed payment: ${
                              fixedAmountReady
                                ? `KES ${money(row.obligationAmount)}`
                                : "Not configured"
                            }`
                          : isBanking
                          ? "Employee banking"
                          : "Variable payment amount"}
                      </div>
                    </div>

                    <span style={styles.categoryTag}>
                      {isBanking
                        ? "EMPLOYEE"
                        : row.fixedPayment
                        ? "FIXED"
                        : "VARIABLE"}
                    </span>
                  </div>

                  {/* SAVED AND AVAILABLE BALANCES */}

                  <div style={styles.balanceGrid}>
  <BalanceTile
    label="SAVED"
    amount={row.balance}
  />
</div>
                  {/* EMPLOYEE BANKING SELECTOR */}

                  {isBanking && (
                    <div style={styles.bankingSelectorWrap}>
                      <label
                        style={styles.label}
                        htmlFor="tl-banking-employee"
                      >
                        SELECT EMPLOYEE
                      </label>

                      <select
                        id="tl-banking-employee"
                        value={selectedBankingEmployeeId}
                        disabled={anyBusy}
                        onChange={(event) =>
                          selectBankingEmployee(event.target.value)
                        }
                        style={styles.select}
                      >
                        <option value="">Select employee</option>

                        {sortedBankingEmployees.map((employee) => (
                          <option
                            key={employee.employee_id}
                            value={employee.employee_id}
                          >
                            {employee.is_mobile
                              ? `★ MOBILE — ${employee.employee_name}`
                              : `${
                                  employee.shop_name || "UNASSIGNED"
                                } — ${employee.employee_name}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* PENDING PAYMENT RESERVATION */}

                  {row.pendingPaymentAmount > 0 && (
                    <div style={styles.reserved}>
                      KES {money(row.pendingPaymentAmount)} reserved for
                      Accountant confirmation.
                    </div>
                  )}

                  {/* SAVE / PAY / WITHDRAW */}

                  <div style={styles.actions}>
                    <div style={styles.actionRow}>
                      <span style={styles.actionLabel}>SAVE</span>

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
                          setInput(row.key, "save", event.target.value)
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
                          opacity: anyBusy || !bankingReady ? 0.45 : 1,
                        }}
                      >
                        {saveBusy ? "Saving…" : "Save"}
                      </button>
                    </div>

                    <div style={styles.actionRow}>
                      <span style={styles.actionLabel}>PAY</span>

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
                          placeholder="Admin fixed amount"
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
                            setInput(row.key, "pay", event.target.value)
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
                        {payBusy ? "Sending…" : "Request Pay"}
                      </button>
                    </div>

                    <div style={styles.actionRow}>
                      <span style={styles.actionLabel}>WITHDRAW</span>

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        aria-label={`${row.label} withdrawal amount`}
                        value={selected.withdraw}
                        disabled={anyBusy || !bankingReady}
                        placeholder={
                          isBanking && !bankingReady
                            ? "Select employee"
                            : "Amount"
                        }
                        onChange={(event) =>
                          setInput(row.key, "withdraw", event.target.value)
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
                          opacity: disableWithdraw ? 0.45 : 1,
                        }}
                      >
                        {withdrawBusy ? "Working…" : "Withdraw"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {/* SAVINGS TOTALS */}

          <div style={styles.totalsGrid}>
            <TotalTile label="TOTAL SAVED" amount={totals.saved} />
            <TotalTile
              label="PENDING PAYMENTS"
              amount={totals.reserved}
            />
            
          </div>

          {/* RECENT PAYMENT REQUESTS */}

          <div style={styles.history}>
            <div style={styles.historyHeading}>
              RECENT PAYMENT REQUESTS
            </div>

            {paymentRequests.length === 0 ? (
              <div style={styles.emptyHistory}>
                No payment requests yet.
              </div>
            ) : (
              <div style={styles.historyGrid}>
                {paymentRequests.slice(0, 6).map((request) => (
                  <div key={request.id} style={styles.historyRow}>
                    <div style={{ minWidth: 0 }}>
                      <strong style={{ color: T.ink }}>
                        {request.category}
                      </strong>
                      <div style={styles.historyDate}>
                        {formatDateTime(request.requested_at)}
                      </div>
                    </div>

                    <strong style={styles.historyAmount}>
                      KES {money(request.amount)}
                    </strong>

                    <StatusBadge status={request.status} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={styles.footnote}>
            Saving reduces available shift money immediately because it is
            posted to Expenses. Paying later does not create a second
            expense. Employee Banking follows the selected employee.
          </div>
        </>
      )}
    </section>
  );
}

// =============================================================
// REUSABLE DISPLAY COMPONENTS
// =============================================================

function BalanceTile({ label, amount, highlight = false }) {
  return (
    <div style={styles.balanceTile}>
      <span style={styles.balanceLabel}>{label}</span>
      <strong
        style={{
          ...styles.balanceAmount,
          color: highlight ? T.teal : T.ink,
        }}
      >
        KES {money(amount)}
      </strong>
    </div>
  );
}

function TotalTile({ label, amount, highlight = false }) {
  return (
    <div style={styles.totalTile}>
      <div style={styles.totalLabel}>{label}</div>
      <strong
        style={{
          ...styles.totalAmount,
          color: highlight ? T.teal : T.ink,
        }}
      >
        KES {money(amount)}
      </strong>
    </div>
  );
}

function StatusBadge({ status }) {
  const value = String(status || "").toUpperCase();

  let style = styles.statusPending;

  if (value === "CONFIRMED") {
    style = styles.statusConfirmed;
  } else if (value === "PROCESSING") {
    style = styles.statusProcessing;
  } else if (["REJECTED", "FAILED", "CANCELLED"].includes(value)) {
    style = styles.statusRejected;
  }

  return (
    <span style={{ ...styles.statusBase, ...style }}>
      {value || "PENDING"}
    </span>
  );
}

// =============================================================
// API / MONEY HELPERS
// =============================================================

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
    Math.round((Number(value) + Number.EPSILON) * 100) / 100
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

// =============================================================
// PROFESSIONAL SAVINGS PANEL STYLES
// =============================================================

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
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
    padding: "15px 17px",
    background: "#152639",
    borderLeft: `3px solid ${T.gold}`,
    borderBottom: `1px solid ${T.border}`,
  },

  headingTitle: {
    fontSize: 14,
    fontWeight: 850,
    letterSpacing: ".07em",
    color: T.ink,
  },

  headingCaption: {
    fontSize: 11,
    color: T.muted,
  },

  instruction: {
    display: "flex",
    alignItems: "flex-start",
    gap: 9,
    padding: "11px 17px",
    borderBottom: `1px solid ${T.softBorder}`,
    color: T.sub,
    fontSize: 12,
    lineHeight: 1.5,
  },

  instructionDot: {
    flexShrink: 0,
    width: 7,
    height: 7,
    marginTop: 6,
    background: T.teal,
    borderRadius: "50%",
  },

  message: {
    margin: "11px 13px 0",
    padding: "11px 12px",
    borderRadius: 8,
    fontSize: 12,
    lineHeight: 1.5,
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
    padding: 28,
    textAlign: "center",
    color: T.sub,
  },

  categoryGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(min(100%, 330px), 1fr))",
    gap: 13,
    padding: "15px",
  },

  categoryCard: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    padding: "15px",
    background: T.surfaceRaised,
    border: `1px solid ${T.border}`,
    borderRadius: 10,
    boxSizing: "border-box",
  },

  bankingCard: {
    borderColor: "#756039",
    background:
      "linear-gradient(155deg, #1C2C3F 0%, #15263A 50%)",
  },

  categoryHead: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 14,
    minHeight: 53,
  },

  categoryName: {
    color: T.ink,
    fontSize: 16,
    fontWeight: 850,
    letterSpacing: ".015em",
  },

  categorySub: {
    marginTop: 5,
    fontSize: 11,
    lineHeight: 1.4,
    color: T.muted,
  },

  categoryTag: {
    flexShrink: 0,
    color: T.gold,
    fontSize: 9,
    fontWeight: 850,
    letterSpacing: ".05em",
    border: "1px solid #6A593A",
    background: "#2A2930",
    borderRadius: 5,
    padding: "5px 6px",
  },

 balanceGrid: {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  gap: 8,
  marginBottom: 14,
},
  balanceTile: {
    display: "grid",
    gap: 7,
    minWidth: 0,
    background: T.inset,
    border: `1px solid ${T.softBorder}`,
    borderRadius: 7,
    padding: "10px 11px",
  },

  balanceLabel: {
    fontSize: 10,
    letterSpacing: ".08em",
    fontWeight: 800,
    color: T.muted,
  },

  balanceAmount: {
    fontSize: 14,
    fontWeight: 850,
    fontVariantNumeric: "tabular-nums",
    overflowWrap: "anywhere",
  },

  bankingSelectorWrap: {
    padding: 11,
    marginBottom: 12,
    background: T.inset,
    border: `1px solid ${T.border}`,
    borderRadius: 8,
  },

  label: {
    display: "block",
    fontSize: 10,
    color: T.sub,
    fontWeight: 850,
    marginBottom: 7,
    letterSpacing: ".07em",
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
    marginBottom: 12,
    padding: "10px 11px",
    color: "#FFE3A8",
    fontSize: 11,
    lineHeight: 1.5,
    background: "#322A1D",
    border: "1px solid #695638",
    borderRadius: 7,
  },

  actions: {
    display: "grid",
    gap: 9,
    marginTop: "auto",
  },

  actionRow: {
    display: "grid",
    gridTemplateColumns: "66px minmax(0,1fr) 104px",
    alignItems: "center",
    gap: 7,
    minWidth: 0,
  },

  actionLabel: {
    color: T.sub,
    fontSize: 10,
    fontWeight: 850,
    letterSpacing: ".015em",
  },

  input: {
    display: "block",
    minWidth: 0,
    width: "100%",
    boxSizing: "border-box",
    minHeight: 40,
    padding: "9px 10px",
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
    minHeight: 40,
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
    padding: "0 15px 15px",
  },

  totalTile: {
    minWidth: 0,
    display: "grid",
    gap: 7,
    padding: "14px 15px",
    background: T.surfaceRaised,
    border: `1px solid ${T.border}`,
    borderRadius: 9,
  },

  totalLabel: {
    color: T.muted,
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: ".08em",
  },

  totalAmount: {
    fontSize: 17,
    fontWeight: 850,
    fontVariantNumeric: "tabular-nums",
    overflowWrap: "anywhere",
  },

  history: {
    margin: "0 15px 15px",
    padding: "14px",
    background: T.surfaceRaised,
    border: `1px solid ${T.border}`,
    borderRadius: 9,
  },

  historyHeading: {
    color: T.sub,
    fontSize: 11,
    letterSpacing: ".07em",
    fontWeight: 850,
    marginBottom: 10,
  },

  emptyHistory: {
    color: T.muted,
    fontSize: 12,
    padding: "10px 0",
  },

  historyGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(min(100%,290px),1fr))",
    gap: 8,
  },

  historyRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0,1fr) auto auto",
    alignItems: "center",
    gap: 10,
    padding: "11px 12px",
    background: T.inset,
    border: `1px solid ${T.softBorder}`,
    borderRadius: 7,
    fontSize: 11,
  },

  historyDate: {
    fontSize: 10,
    color: T.muted,
    marginTop: 3,
  },

  historyAmount: {
    color: T.ink,
    whiteSpace: "nowrap",
    fontVariantNumeric: "tabular-nums",
  },

  statusBase: {
    fontSize: 9,
    fontWeight: 850,
    letterSpacing: ".03em",
    padding: "6px 8px",
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

  footnote: {
    color: T.muted,
    borderTop: `1px solid ${T.softBorder}`,
    padding: "12px 16px 15px",
    fontSize: 11,
    lineHeight: 1.55,
  },
};
