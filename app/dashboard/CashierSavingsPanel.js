"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// TEAM LEGEND — Shared 12H / 24H Savings and Banking.
const PAYMENT_STATUS_SECONDS = 15;

const CATEGORIES = [
  { key: "WIFI", label: "WiFi", fixedPayment: true },
  { key: "DSTV", label: "DStv", fixedPayment: true },
  { key: "RENT", label: "Rent", fixedPayment: true },
  { key: "ELECTRICITY", label: "Electricity", fixedPayment: false },
  { key: "BANKING", label: "Banking", fixedPayment: false },
];

const C = {
  bg: "#101F30",
  raised: "#15263A",
  inset: "#0A1725",
  border: "#2A3D52",
  muted: "#91A5B8",
  text: "#F0F5FA",
  sub: "#C4D0DC",
  gold: "#D9B66C",
};

const makeInputs = () =>
  Object.fromEntries(
    CATEGORIES.map(({ key }) => [
      key,
      { save: "", pay: "", withdraw: "" },
    ])
  );

export default function CashierSavingsPanel({
  user,
  currentShift,
}) {
  const [categories, setCategories] = useState([]);
  const [paymentRequests, setPaymentRequests] = useState([]);
  const [bankingEmployees, setBankingEmployees] = useState([]);
  const [bankingMode, setBankingMode] = useState(null);
  const [employeeId, setEmployeeId] = useState("");
  const [bankingReference, setBankingReference] = useState("");
  const [inputs, setInputs] = useState(makeInputs);
  const [loading, setLoading] = useState(true);
  const [actionKey, setActionKey] = useState("");
  const [notice, setNotice] = useState(null);
  const [paymentStatusOpen, setPaymentStatusOpen] = useState(true);

  const busyRef = useRef(false);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = user?.access_token || null;
  const shiftId = currentShift?.id || null;

  // FIVE-SECOND NOTIFICATIONS

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  // PAYMENT STATUS AUTO-COLLAPSE

  useEffect(() => {
    setPaymentStatusOpen(true);
  }, [shiftId]);

  useEffect(() => {
    if (
      !paymentStatusOpen ||
      loading ||
      paymentRequests.length === 0
    ) return;

    const timer = setTimeout(() => {
      setPaymentStatusOpen(false);
    }, PAYMENT_STATUS_SECONDS * 1000);

    return () => clearTimeout(timer);
  }, [paymentStatusOpen, loading, paymentRequests.length]);

  function notify(text, type = "error") {
    setNotice({ text, type });
  }

  // LOAD SAVINGS AND BANKING

  const loadSavings = useCallback(
    async (silent = false) => {
      if (!shiftId || !token || !supabaseUrl || !anonKey) {
        if (!silent) setLoading(false);
        return;
      }

      try {
        if (!silent) setLoading(true);

        const headers = authHeaders(anonKey, token);

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
              "Unable to load Banking employees."
          );
        }

        const nextCategories = Array.isArray(
          savingsResult?.categories
        )
          ? savingsResult.categories
          : [];

        const nextRequests = Array.isArray(
          savingsResult?.payment_requests
        )
          ? savingsResult.payment_requests
          : [];

        const nextEmployees = Array.isArray(
          bankingResult?.employees
        )
          ? bankingResult.employees
          : [];

        setCategories(nextCategories);
        setPaymentRequests(nextRequests);
        setBankingEmployees(nextEmployees);

        setEmployeeId((previous) => {
          if (!previous) return "";

          return nextEmployees.some(
            (employee) =>
              String(employee.employee_id) === String(previous)
          )
            ? previous
            : "";
        });
      } catch (error) {
        console.error("LOAD CASHIER SAVINGS ERROR:", error);

        if (!silent) {
          notify(error?.message || "Unable to load Savings.");
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [shiftId, token, supabaseUrl, anonKey]
  );

  // ADMIN BANKING MODE

  const loadBankingMode = useCallback(async () => {
    if (!token || !supabaseUrl || !anonKey) {
      setBankingMode(null);
      return null;
    }

    try {
      const response = await fetch(
        `${supabaseUrl}/rest/v1/rpc/tl_banking_mode_snapshot`,
        {
          method: "POST",
          headers: authHeaders(anonKey, token),
          body: "{}",
          cache: "no-store",
        }
      );

      const data = await safeJson(response);

      if (!response.ok) {
        throw new Error(data?.message || "Banking mode unavailable.");
      }

      const record = Array.isArray(data) ? data[0] : data;
      const mode = String(record?.mode || "").toUpperCase();

      if (mode !== "MANUAL" && mode !== "AUTOMATIC") {
        throw new Error("Invalid Banking mode.");
      }

      const current = {
        mode,
        automaticReady: record?.automatic_ready === true,
      };

      setBankingMode(current);
      return current;
    } catch (error) {
      console.error("LOAD BANKING MODE ERROR:", error);
      setBankingMode(null);
      return null;
    }
  }, [token, supabaseUrl, anonKey]);

  useEffect(() => {
    loadBankingMode();
    const timer = setInterval(loadBankingMode, 30000);
    return () => clearInterval(timer);
  }, [loadBankingMode]);

  // AUTO REFRESH

  useEffect(() => {
    loadSavings();

    const timer = setInterval(() => {
      loadSavings(true);
    }, 5000);

    return () => clearInterval(timer);
  }, [loadSavings]);

  // BANKING EMPLOYEES

  const sortedEmployees = useMemo(
    () =>
      [...bankingEmployees].sort((a, b) => {
        const mobile =
          Number(Boolean(b?.is_mobile)) -
          Number(Boolean(a?.is_mobile));

        if (mobile) return mobile;

        const shop = String(a?.shop_name || "").localeCompare(
          String(b?.shop_name || "")
        );

        return (
          shop ||
          String(a?.employee_name || "").localeCompare(
            String(b?.employee_name || "")
          )
        );
      }),
    [bankingEmployees]
  );

  const selectedEmployee = useMemo(
    () =>
      bankingEmployees.find(
        (employee) =>
          String(employee.employee_id) === String(employeeId)
      ) || null,
    [bankingEmployees, employeeId]
  );

  // SAVINGS CATEGORIES

  const rows = useMemo(
    () =>
      CATEGORIES.map((config) => {
        if (config.key === "BANKING") {
          return {
            ...config,
            balance: Number(selectedEmployee?.saved_balance || 0),
            obligationAmount: null,
            pendingPaymentAmount: Number(
              selectedEmployee?.pending_payment_amount || 0
            ),
            availableBalance: Number(
              selectedEmployee?.available_balance || 0
            ),
          };
        }

        const found = categories.find(
          (item) =>
            String(item?.category || "").toUpperCase() === config.key
        );

        return {
          ...config,
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
    [categories, selectedEmployee]
  );

  const totals = useMemo(
    () => ({
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
    }),
    [rows]
  );

  // INPUT HELPERS

  function setInput(category, field, value) {
    setInputs((old) => ({
      ...old,
      [category]: {
        ...old[category],
        [field]: value,
      },
    }));

    setNotice(null);
  }

  function clearInput(category, field) {
    setInputs((old) => ({
      ...old,
      [category]: {
        ...old[category],
        [field]: "",
      },
    }));
  }

  function selectEmployee(id) {
    setEmployeeId(id);
    setBankingReference("");

    setInputs((old) => ({
      ...old,
      BANKING: {
        save: "",
        pay: "",
        withdraw: "",
      },
    }));

    setNotice(null);
  }

  function bankingReady(row) {
    if (row.key !== "BANKING" || selectedEmployee) {
      return true;
    }

    notify("Select an employee for Banking.");
    return false;
  }

  // SUPABASE FINANCIAL OPERATIONS

  async function postMoney({
    row,
    action,
    rpc,
    body,
    onSuccess,
  }) {
    if (busyRef.current) return;

    busyRef.current = true;
    setActionKey(`${action}-${row.key}`);
    setNotice(null);

    try {
      const response = await fetch(
        `${supabaseUrl}/rest/v1/rpc/${rpc}`,
        {
          method: "POST",
          headers: authHeaders(anonKey, token),
          body: JSON.stringify(body),
          cache: "no-store",
        }
      );

      const result = await safeJson(response);

      if (!response.ok) {
        throw new Error(
          result?.message ||
            result?.details ||
            result?.hint ||
            `Unable to ${action.toLowerCase()} ${row.label}.`
        );
      }

      onSuccess(result);
      await loadSavings(true);
    } catch (error) {
      console.error(`${action} SAVINGS ERROR:`, error);

      notify(
        error?.message ||
          `Unable to ${action.toLowerCase()} ${row.label}.`
      );
    } finally {
      busyRef.current = false;
      setActionKey("");
    }
  }

  // SAVE

  async function saveMoney(row) {
    if (busyRef.current || !bankingReady(row)) return;

    const raw = inputs[row.key]?.save;
    const amount = Number(raw);

    if (
      raw === "" ||
      !Number.isFinite(amount) ||
      roundMoney(amount) <= 0
    ) {
      notify(`Enter a valid ${row.label} save amount.`);
      return;
    }

    const banking = row.key === "BANKING";

    const employeeText = banking
      ? `\nEmployee: ${selectedEmployee.employee_name}`
      : "";

    const confirmed = window.confirm(
      `Save KES ${money(amount)} to ${row.label}?${employeeText}\n\n` +
        `This will immediately add KES ${money(amount)} to Expenses and Savings.`
    );

    if (!confirmed) return;

    await postMoney({
      row,
      action: "SAVE",
      rpc: banking
        ? "tl_cashier_save_banking_employee"
        : "tl_cashier_save_savings",
      body: banking
        ? {
            p_shift_id: shiftId,
            p_employee_id: selectedEmployee.employee_id,
            p_amount: roundMoney(amount),
          }
        : {
            p_shift_id: shiftId,
            p_category: row.key,
            p_amount: roundMoney(amount),
          },

      onSuccess: () => {
        clearInput(row.key, "save");

        notify(
          `${
            banking ? selectedEmployee.employee_name : row.label
          }: KES ${money(amount)} saved.`,
          "success"
        );
      },
    });
  }

  // REQUEST PAYMENT

  async function requestPayment(row) {
    if (busyRef.current || !bankingReady(row)) return;

    if (
      row.fixedPayment &&
      (
        row.obligationAmount == null ||
        !Number.isFinite(row.obligationAmount) ||
        row.obligationAmount <= 0
      )
    ) {
      notify(
        `${row.label} fixed payment is not configured by Admin.`
      );
      return;
    }

    const amount = row.fixedPayment
      ? Number(row.obligationAmount || 0)
      : Number(inputs[row.key]?.pay || 0);

    if (
      !Number.isFinite(amount) ||
      roundMoney(amount) <= 0
    ) {
      notify(`Enter a valid ${row.label} payment amount.`);
      return;
    }

    if (amount > row.availableBalance) {
      notify(
        `${row.label}: Available KES ${money(row.availableBalance)}.`
      );
      return;
    }

    const banking = row.key === "BANKING";
    const reference = String(bankingReference || "")
      .trim()
      .toUpperCase();

    if (banking) {
      const currentMode = await loadBankingMode();

      if (!currentMode) {
        notify("Unable to verify Banking mode. Try again.");
        return;
      }

      if (currentMode.mode === "AUTOMATIC") {
        notify(
          currentMode.automaticReady
            ? "Automatic Banking PAY is not connected yet."
            : "Automatic Banking is not ready. Contact Admin."
        );
        return;
      }

      if (!/^[A-Z0-9]{8,16}$/.test(reference)) {
        notify("Enter a valid M-PESA reference.");
        return;
      }
    }

    const employeeText = banking
      ? `\nEmployee: ${selectedEmployee.employee_name}`
      : "";

    const confirmed = window.confirm(
      banking
        ? `Submit Banking PAY?${employeeText}\n\n` +
          `Amount: KES ${money(amount)}\n` +
          `M-PESA Ref: ${reference}`
        : `Request ${row.label} payment?${employeeText}\n\n` +
          `Amount: KES ${money(amount)}\n\n` +
          "The Accountant must confirm the actual payment before this amount leaves Savings."
    );

    if (!confirmed) return;

    await postMoney({
      row,
      action: "PAY",
      rpc: banking
        ? "tl_cashier_request_banking_payment_employee"
        : "tl_cashier_request_savings_payment",
      body: banking
        ? {
            p_shift_id: shiftId,
            p_employee_id: selectedEmployee.employee_id,
            p_amount: roundMoney(amount),
            p_mpesa_reference: reference,
          }
        : {
            p_shift_id: shiftId,
            p_category: row.key,
            p_amount: roundMoney(amount),
          },

      onSuccess: () => {
        if (!row.fixedPayment) {
          clearInput(row.key, "pay");
        }

        if (banking) setBankingReference("");

        notify(
          banking
            ? "Banking request submitted."
            : `${row.label}: Payment request sent to Accountant.`,
          "success"
        );
      },
    });
  }

  // WITHDRAW TO M-SHWARI FLOAT

  async function withdrawMoney(row) {
    if (busyRef.current || !bankingReady(row)) return;

    const raw = inputs[row.key]?.withdraw;
    const amount = Number(raw);

    if (
      raw === "" ||
      !Number.isFinite(amount) ||
      roundMoney(amount) <= 0
    ) {
      notify(`Enter a valid ${row.label} withdrawal amount.`);
      return;
    }

    if (amount > row.availableBalance) {
      notify(
        `${row.label}: Available KES ${money(row.availableBalance)}.`
      );
      return;
    }

    const banking = row.key === "BANKING";

    const employeeText = banking
      ? `\nEmployee: ${selectedEmployee.employee_name}`
      : "";

    const confirmed = window.confirm(
      `Withdraw KES ${money(amount)} from ${row.label} Savings?${employeeText}\n\n` +
        "The money will automatically enter the next available M-Shwari Added Float position."
    );

    if (!confirmed) return;

    await postMoney({
      row,
      action: "WITHDRAW",
      rpc: banking
        ? "tl_cashier_withdraw_banking_employee"
        : "tl_cashier_withdraw_savings",
      body: banking
        ? {
            p_shift_id: shiftId,
            p_employee_id: selectedEmployee.employee_id,
            p_amount: roundMoney(amount),
          }
        : {
            p_shift_id: shiftId,
            p_category: row.key,
            p_amount: roundMoney(amount),
          },

      onSuccess: (result) => {
        clearInput(row.key, "withdraw");

        notify(
          `${row.label}: KES ${money(amount)} withdrawn to M-Shwari Float ${
            result?.mshwari_slot || ""
          }.`,
          "success"
        );
      },
    });
  }

  // DISPLAY

  return (
    <section
      className="tl-shared-savings"
      style={s.panel}
    >
      <style>{css}</style>

      <div style={s.heading}>
        SAVINGS / BANKING
      </div>

      {notice && (
        <div
          role="status"
          aria-live="polite"
          style={{
            ...s.message,
            ...(notice.type === "success"
              ? s.success
              : s.error),
          }}
        >
          {notice.text}
        </div>
      )}

      {loading ? (
        <div style={s.loading}>Loading...</div>
      ) : (
        <>
          <div style={s.categoryGrid}>
            {rows.map((row) => {
              const banking = row.key === "BANKING";
              const ready = !banking || Boolean(selectedEmployee);
              const busy = actionKey !== "";

              const fixedReady =
                row.obligationAmount != null &&
                Number.isFinite(row.obligationAmount) &&
                row.obligationAmount > 0;

              const disablePay =
                busy ||
                !ready ||
                row.availableBalance <= 0 ||
                (
                  row.fixedPayment &&
                  (
                    !fixedReady ||
                    row.availableBalance < row.obligationAmount
                  )
                );

              const disableWithdraw =
                busy ||
                !ready ||
                row.availableBalance <= 0;

              const input = inputs[row.key] || {
                save: "",
                pay: "",
                withdraw: "",
              };

              return (
                <article
                  key={row.key}
                  style={{
                    ...s.categoryCard,
                    ...(banking ? s.bankingCard : {}),
                  }}
                >
                  <div style={s.categoryHead}>
                    <strong style={s.categoryName}>
                      {row.label}
                    </strong>

                    {banking && bankingMode && (
                      <span style={s.fixedTag}>
                        {bankingMode.mode}
                      </span>
                    )}

                    {row.fixedPayment && (
                      <span style={s.fixedTag}>
                        FIXED
                      </span>
                    )}
                  </div>

                  <div style={s.balanceTile}>
                    <span style={s.balanceLabel}>
                      SAVED
                    </span>
                    <strong style={s.balanceAmount}>
                      KES {money(row.balance)}
                    </strong>
                  </div>

                  {banking && (
                    <select
                      aria-label="Banking employee"
                      style={s.select}
                      value={employeeId}
                      disabled={busy}
                      onChange={(event) =>
                        selectEmployee(event.target.value)
                      }
                    >
                      <option value="">
                        Select employee
                      </option>

                      {sortedEmployees.map((employee) => (
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
                  )}

                  {banking && bankingMode?.mode === "MANUAL" && (
                    <input
                      type="text"
                      aria-label="M-PESA reference for Banking PAY"
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      maxLength={16}
                      style={{
                        ...s.input,
                        marginBottom: 10,
                        textAlign: "left",
                      }}
                      placeholder="M-PESA reference"
                      value={bankingReference}
                      disabled={busy || !ready}
                      onChange={(event) => {
                        setBankingReference(
                          event.target.value
                            .replace(/\s+/g, "")
                            .toUpperCase()
                        );
                        setNotice(null);
                      }}
                    />
                  )}

                  {row.pendingPaymentAmount > 0 && (
                    <div style={s.pending}>
                      PENDING: KES{" "}
                      {money(row.pendingPaymentAmount)}
                    </div>
                  )}

                  <div style={s.actions}>
                    <div style={s.actionRow}>
                      <span style={s.actionLabel}>
                        SAVE
                      </span>

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        style={s.input}
                        aria-label={`${row.label} save amount`}
                        value={input.save}
                        disabled={busy || !ready}
                        placeholder={
                          ready ? "Amount" : "Select employee"
                        }
                        onChange={(event) =>
                          setInput(
                            row.key,
                            "save",
                            event.target.value
                          )
                        }
                      />

                      <button
                        type="button"
                        onClick={() => saveMoney(row)}
                        disabled={busy || !ready}
                        style={{
                          ...s.button,
                          ...s.saveButton,
                        }}
                      >
                        {actionKey === `SAVE-${row.key}`
                          ? "Saving..."
                          : "Save"}
                      </button>
                    </div>

                    <div style={s.actionRow}>
                      <span style={s.actionLabel}>
                        PAY
                      </span>

                      {row.fixedPayment ? (
                        <input
                          type="text"
                          readOnly
                          style={{
                            ...s.input,
                            ...s.readOnly,
                          }}
                          aria-label={`${row.label} fixed payment amount`}
                          value={
                            fixedReady
                              ? money(row.obligationAmount)
                              : ""
                          }
                          placeholder="Not set"
                        />
                      ) : (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          style={s.input}
                          aria-label={`${row.label} payment amount`}
                          value={input.pay}
                          disabled={busy || !ready}
                          placeholder={
                            ready ? "Amount" : "Select employee"
                          }
                          onChange={(event) =>
                            setInput(
                              row.key,
                              "pay",
                              event.target.value
                            )
                          }
                        />
                      )}

                      <button
                        type="button"
                        onClick={() => requestPayment(row)}
                        disabled={disablePay}
                        style={{
                          ...s.button,
                          ...s.payButton,
                        }}
                      >
                        {actionKey === `PAY-${row.key}`
                          ? "Sending..."
                          : "Request Pay"}
                      </button>
                    </div>

                    <div style={s.actionRow}>
                      <span style={s.actionLabel}>
                        WITHDRAW
                      </span>

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        style={s.input}
                        aria-label={`${row.label} withdrawal amount`}
                        value={input.withdraw}
                        disabled={disableWithdraw}
                        placeholder={
                          ready ? "Amount" : "Select employee"
                        }
                        onChange={(event) =>
                          setInput(
                            row.key,
                            "withdraw",
                            event.target.value
                          )
                        }
                      />

                      <button
                        type="button"
                        onClick={() => withdrawMoney(row)}
                        disabled={disableWithdraw}
                        style={{
                          ...s.button,
                          ...s.withdrawButton,
                        }}
                      >
                        {actionKey === `WITHDRAW-${row.key}`
                          ? "Working..."
                          : "Withdraw"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div style={s.totalsGrid}>
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

          {paymentRequests.length > 0 && (
            <div style={s.history}>
              <button
                type="button"
                style={s.historyToggle}
                aria-expanded={paymentStatusOpen}
                aria-controls="tl-payment-status-list"
                onClick={() =>
                  setPaymentStatusOpen((value) => !value)
                }
              >
                <span>
                  PAYMENT STATUS ({paymentRequests.length})
                </span>
                <span aria-hidden="true">
                  {paymentStatusOpen ? "▲" : "▼"}
                </span>
              </button>

              {paymentStatusOpen && (
                <div
                  id="tl-payment-status-list"
                  style={s.historyGrid}
                >
                  {paymentRequests
                    .slice(0, 6)
                    .map((request) => (
                      <div
                        key={request.id}
                        style={s.historyRow}
                      >
                        <div style={s.historyName}>
                          <strong>
                            {request.category}
                          </strong>
                          <span style={s.historyDate}>
                            {formatDateTime(
                              request.requested_at
                            )}
                          </span>
                        </div>

                        <strong style={s.historyAmount}>
                          KES {money(request.amount)}
                        </strong>

                        <StatusBadge status={request.status} />
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

// DISPLAY HELPERS

function TotalTile({ label, amount }) {
  return (
    <div style={s.totalTile}>
      <span style={s.totalLabel}>{label}</span>
      <strong style={s.totalAmount}>
        KES {money(amount)}
      </strong>
    </div>
  );
}

function StatusBadge({ status }) {
  const value = String(status || "").toUpperCase();

  const appearance =
    value === "CONFIRMED"
      ? s.confirmed
      : value === "PROCESSING"
      ? s.processing
      : ["REJECTED", "FAILED", "CANCELLED"].includes(value)
      ? s.rejected
      : s.pendingStatus;

  return (
    <span
      style={{
        ...s.statusBase,
        ...appearance,
      }}
    >
      {value || "PENDING"}
    </span>
  );
}

// SUPABASE HELPERS

function authHeaders(anonKey, token) {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${token}`,
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

// MONEY AND DATE HELPERS

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

// INPUT STYLING

const css = `
.tl-shared-savings input[type="number"] {
  appearance: textfield;
  -moz-appearance: textfield;
}

.tl-shared-savings input[type="number"]::-webkit-inner-spin-button,
.tl-shared-savings input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.tl-shared-savings button:disabled {
  opacity: .5;
  cursor: not-allowed;
}

.tl-shared-savings button:focus-visible {
  outline: 2px solid #d9b66c;
  outline-offset: 2px;
}
`;

// PROFESSIONAL NAVY STYLES

const s = {
  panel: {
    gridColumn: "1 / -1",
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    background: C.bg,
    color: C.text,
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    overflow: "hidden",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, sans-serif",
  },

  heading: {
    padding: "12px 16px",
    background: C.raised,
    borderLeft: `3px solid ${C.gold}`,
    borderBottom: `1px solid ${C.border}`,
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

  success: {
    background: "#10332E",
    border: "1px solid #2A6354",
    color: "#A8EBD1",
  },

  error: {
    background: "#38202A",
    border: "1px solid #774155",
    color: "#FFC3CE",
  },

  loading: {
    padding: 20,
    textAlign: "center",
    color: C.sub,
  },

  categoryGrid: {
    display: "grid",
    gap: 12,
    padding: 12,
    gridTemplateColumns:
      "repeat(auto-fit, minmax(min(100%, 330px), 1fr))",
  },

  categoryCard: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    padding: 13,
    boxSizing: "border-box",
    background: C.raised,
    border: `1px solid ${C.border}`,
    borderRadius: 9,
  },

  bankingCard: {
    borderColor: "#756039",
    background:
      "linear-gradient(155deg, #1C2C3F, #15263A)",
  },

  categoryHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },

  categoryName: {
    fontSize: 16,
    fontWeight: 850,
    color: C.text,
  },

  fixedTag: {
    color: C.gold,
    fontSize: 9,
    fontWeight: 800,
    padding: "4px 6px",
    border: "1px solid #6A593A",
    background: "#2A2930",
    borderRadius: 5,
  },

  balanceTile: {
    display: "grid",
    gap: 5,
    minWidth: 0,
    padding: "9px 11px",
    marginBottom: 11,
    background: C.inset,
    border: "1px solid #223448",
    borderRadius: 7,
  },

  balanceLabel: {
    fontSize: 10,
    letterSpacing: ".08em",
    fontWeight: 800,
    color: C.muted,
  },

  balanceAmount: {
    fontSize: 15,
    fontWeight: 850,
    fontVariantNumeric: "tabular-nums",
  },

  select: {
    width: "100%",
    boxSizing: "border-box",
    marginBottom: 10,
    padding: "9px 10px",
    minHeight: 39,
    border: `1px solid ${C.border}`,
    borderRadius: 7,
    background: C.bg,
    color: C.text,
    fontSize: 12,
  },

  pending: {
    marginBottom: 10,
    padding: "8px 10px",
    fontSize: 11,
    fontWeight: 800,
    color: "#FFE3A8",
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
    fontSize: 10,
    fontWeight: 850,
    color: C.sub,
  },

  input: {
    minWidth: 0,
    width: "100%",
    boxSizing: "border-box",
    minHeight: 39,
    padding: "8px 10px",
    background: C.inset,
    color: C.text,
    border: `1px solid ${C.border}`,
    borderRadius: 7,
    fontSize: 12,
    fontWeight: 650,
    textAlign: "right",
    fontFamily: "inherit",
  },

  readOnly: {
    color: C.muted,
    background: "#102030",
    cursor: "not-allowed",
  },

  button: {
    minWidth: 0,
    width: "100%",
    minHeight: 39,
    padding: "7px 6px",
    borderRadius: 7,
    fontSize: 11,
    fontWeight: 850,
    cursor: "pointer",
    whiteSpace: "nowrap",
    fontFamily: "inherit",
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
    background: C.bg,
    border: `1px solid ${C.border}`,
    color: C.sub,
  },

  totalsGrid: {
    display: "grid",
    gap: 10,
    padding: "0 12px 12px",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(min(100%, 195px), 1fr))",
  },

  totalTile: {
    display: "grid",
    minWidth: 0,
    gap: 5,
    padding: "11px 13px",
    background: C.raised,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
  },

  totalLabel: {
    color: C.muted,
    fontSize: 10,
    fontWeight: 800,
  },

  totalAmount: {
    fontSize: 17,
    fontWeight: 850,
    fontVariantNumeric: "tabular-nums",
  },

  history: {
    margin: "0 12px 12px",
    padding: 11,
    background: C.raised,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
  },

  historyToggle: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    width: "100%",
    padding: "5px 2px",
    margin: 0,
    color: C.sub,
    background: "transparent",
    border: 0,
    fontSize: 11,
    fontWeight: 850,
    cursor: "pointer",
    textAlign: "left",
    fontFamily: "inherit",
  },

  historyGrid: {
    display: "grid",
    gap: 7,
    marginTop: 9,
    gridTemplateColumns:
      "repeat(auto-fit, minmax(min(100%, 290px), 1fr))",
  },

  historyRow: {
    display: "grid",
    gridTemplateColumns:
      "minmax(0,1fr) auto auto",
    alignItems: "center",
    gap: 9,
    padding: "9px 10px",
    fontSize: 11,
    background: C.inset,
    border: "1px solid #223448",
    borderRadius: 7,
  },

  historyName: {
    display: "grid",
    gap: 3,
    minWidth: 0,
    color: C.text,
  },

  historyDate: {
    color: C.muted,
    fontSize: 10,
  },

  historyAmount: {
    color: C.text,
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap",
  },

  statusBase: {
    fontSize: 9,
    fontWeight: 850,
    padding: "5px 7px",
    borderRadius: 5,
  },

  pendingStatus: {
    color: "#FFE3A8",
    background: "#322A1D",
    border: "1px solid #695638",
  },

  processing: {
    color: "#B1D2FF",
    background: "#142D48",
    border: "1px solid #355779",
  },

  confirmed: {
    color: "#A8EBD1",
    background: "#10332E",
    border: "1px solid #2A6354",
  },

  rejected: {
    color: "#FFC3CE",
    background: "#38202A",
    border: "1px solid #774155",
  },
};
