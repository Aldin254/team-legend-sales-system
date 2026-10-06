"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

const CATEGORY_CONFIG = [
  {
    key: "WIFI",
    label: "WIFI",
    fixedPayment: true,
  },
  {
    key: "DSTV",
    label: "DSTV",
    fixedPayment: true,
  },
  {
    key: "RENT",
    label: "RENT",
    fixedPayment: true,
  },
  {
    key: "ELECTRICITY",
    label: "ELECTRICITY",
    fixedPayment: false,
  },
  {
    key: "BANKING",
    label: "BANKING",
    fixedPayment: false,
  },
];

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

export default function CashierSavingsPanel({
  user,
  currentShift,
}) {
  const [categories, setCategories] = useState([]);
  const [paymentRequests, setPaymentRequests] = useState([]);

  const [
    bankingEmployees,
    setBankingEmployees,
  ] = useState([]);

  const [
    selectedBankingEmployeeId,
    setSelectedBankingEmployeeId,
  ] = useState("");

  const [inputs, setInputs] = useState(
    blankInputs()
  );

  const [loading, setLoading] = useState(true);
  const [actionKey, setActionKey] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const accessToken =
    user?.access_token || null;

  const shiftId =
    currentShift?.id || null;

  // ============================================================
  // LOAD
  // ============================================================

  const loadSavings = useCallback(
    async (silent = false) => {
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
        if (!silent) {
          setLoading(true);
        }

        const headers = authHeaders(
          supabaseAnonKey,
          accessToken
        );

        const [
          savingsResponse,
          bankingResponse,
        ] = await Promise.all([
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

        const [
          savingsResult,
          bankingResult,
        ] = await Promise.all([
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

        const loadedCategories =
          Array.isArray(
            savingsResult?.categories
          )
            ? savingsResult.categories
            : [];

        const loadedRequests =
          Array.isArray(
            savingsResult?.payment_requests
          )
            ? savingsResult.payment_requests
            : [];

        const loadedEmployees =
          Array.isArray(
            bankingResult?.employees
          )
            ? bankingResult.employees
            : [];

        setCategories(loadedCategories);
        setPaymentRequests(loadedRequests);
        setBankingEmployees(loadedEmployees);

        setSelectedBankingEmployeeId(
          (previous) => {
            if (!previous) {
              return "";
            }

            const exists =
              loadedEmployees.some(
                (employee) =>
                  String(
                    employee.employee_id
                  ) === String(previous)
              );

            return exists
              ? previous
              : "";
          }
        );
      } catch (error) {
        console.error(
          "LOAD SAVINGS ERROR:",
          error
        );

        if (!silent) {
          setMessage(
            error?.message ||
              "Unable to load Savings."
          );

          setMessageType("error");
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [
      shiftId,
      accessToken,
      supabaseUrl,
      supabaseAnonKey,
    ]
  );

  // ============================================================
  // LIVE REFRESH
  // ============================================================

  useEffect(() => {
    loadSavings();

    const timer = setInterval(
      () => {
        loadSavings(true);
      },
      5000
    );

    return () => {
      clearInterval(timer);
    };
  }, [loadSavings]);

  // ============================================================
  // EMPLOYEE LIST
  // MOBILE FIRST → SHOP → NAME
  // ============================================================

  const sortedBankingEmployees =
    useMemo(() => {
      return [...bankingEmployees].sort(
        (a, b) => {
          const mobileA =
            a?.is_mobile ? 0 : 1;

          const mobileB =
            b?.is_mobile ? 0 : 1;

          if (mobileA !== mobileB) {
            return mobileA - mobileB;
          }

          const shopCompare =
            String(
              a?.shop_name || ""
            ).localeCompare(
              String(
                b?.shop_name || ""
              )
            );

          if (shopCompare !== 0) {
            return shopCompare;
          }

          return String(
            a?.employee_name || ""
          ).localeCompare(
            String(
              b?.employee_name || ""
            )
          );
        }
      );
    }, [bankingEmployees]);

  const selectedBankingEmployee =
    useMemo(() => {
      if (!selectedBankingEmployeeId) {
        return null;
      }

      return (
        bankingEmployees.find(
          (employee) =>
            String(
              employee.employee_id
            ) ===
            String(
              selectedBankingEmployeeId
            )
        ) || null
      );
    }, [
      bankingEmployees,
      selectedBankingEmployeeId,
    ]);

  // ============================================================
  // ROWS
  // ============================================================

  const rows =
    useMemo(() => {
      return CATEGORY_CONFIG.map(
        (config) => {
          if (
            config.key ===
            "BANKING"
          ) {
            return {
              ...config,

              accountId: null,

              balance: Number(
                selectedBankingEmployee
                  ?.saved_balance || 0
              ),

              obligationAmount: null,

              pendingPaymentAmount:
                Number(
                  selectedBankingEmployee
                    ?.pending_payment_amount ||
                    0
                ),

              availableBalance:
                Number(
                  selectedBankingEmployee
                    ?.available_balance || 0
                ),

              employeeId:
                selectedBankingEmployee
                  ?.employee_id || null,
            };
          }

          const found =
            categories.find(
              (row) =>
                String(
                  row?.category || ""
                ).toUpperCase() ===
                config.key
            );

          return {
            ...config,

            accountId:
              found?.account_id || null,

            balance:
              Number(
                found?.balance || 0
              ),

            obligationAmount:
              found?.obligation_amount ===
                null ||
              found?.obligation_amount ===
                undefined
                ? null
                : Number(
                    found.obligation_amount
                  ),

            pendingPaymentAmount:
              Number(
                found?.pending_payment_amount ||
                  0
              ),

            availableBalance:
              Number(
                found?.available_balance ||
                  0
              ),
          };
        }
      );
    }, [
      categories,
      selectedBankingEmployee,
    ]);

  // ============================================================
  // TOTALS
  // ============================================================

  const totals =
    useMemo(() => {
      let saved = 0;
      let reserved = 0;
      let available = 0;

      for (const row of rows) {
        saved += Number(
          row.balance || 0
        );

        reserved += Number(
          row.pendingPaymentAmount || 0
        );

        available += Number(
          row.availableBalance || 0
        );
      }

      return {
        saved: roundMoney(saved),
        reserved: roundMoney(reserved),
        available: roundMoney(available),
      };
    }, [rows]);

  // ============================================================
  // INPUTS
  // ============================================================

  function setInput(
    category,
    field,
    value
  ) {
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

  function clearInput(
    category,
    field
  ) {
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

      BANKING: {
        save: "",
        pay: "",
        withdraw: "",
      },
    }));
  }

  function selectBankingEmployee(
    employeeId
  ) {
    setSelectedBankingEmployeeId(
      employeeId
    );

    clearBankingInputs();

    setMessage("");
    setMessageType("");
  }

  function requireBankingEmployee() {
    if (
      selectedBankingEmployee
    ) {
      return true;
    }

    setMessage(
      "Select an employee before using Banking."
    );

    setMessageType("error");

    return false;
  }

  // ============================================================
  // SAVE
  // ============================================================

  async function saveMoney(
    row
  ) {
    if (
      row.key === "BANKING" &&
      !requireBankingEmployee()
    ) {
      return;
    }

    const rawAmount =
      inputs[
        row.key
      ]?.save;

    const amount =
      Number(rawAmount);

    if (
      rawAmount === "" ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      setMessage(
        `Enter a valid amount to save for ${row.label}.`
      );

      setMessageType("error");

      return;
    }

    const bankingText =
      row.key === "BANKING"
        ? `\nEmployee: ${selectedBankingEmployee.employee_name}`
        : "";

    const confirmed =
      window.confirm(
        `Save KES ${money(
          amount
        )} to ${row.label}?${bankingText}\n\nThis will immediately add KES ${money(
          amount
        )} to Expenses and Savings.`
      );

    if (!confirmed) {
      return;
    }

    const key =
      `SAVE-${row.key}`;

    try {
      setActionKey(key);
      setMessage("");
      setMessageType("");

      const isBanking =
        row.key === "BANKING";

      const functionName =
        isBanking
          ? "tl_cashier_save_banking_employee"
          : "tl_cashier_save_savings";

      const body =
        isBanking
          ? {
              p_shift_id: shiftId,

              p_employee_id:
                selectedBankingEmployee
                  .employee_id,

              p_amount:
                roundMoney(amount),
            }
          : {
              p_shift_id: shiftId,
              p_category: row.key,
              p_amount:
                roundMoney(amount),
            };

      const response =
        await fetch(
          `${supabaseUrl}/rest/v1/rpc/${functionName}`,
          {
            method: "POST",

            headers:
              authHeaders(
                supabaseAnonKey,
                accessToken
              ),

            body:
              JSON.stringify(body),
          }
        );

      const result =
        await safeJson(response);

      if (!response.ok) {
        throw new Error(
          result?.message ||
            result?.details ||
            result?.hint ||
            "Unable to save money."
        );
      }

      clearInput(
        row.key,
        "save"
      );

      setMessage(
        isBanking
          ? `${selectedBankingEmployee.employee_name}: KES ${money(
              amount
            )} Banking saved successfully.`
          : `${row.label}: KES ${money(
              amount
            )} saved successfully.`
      );

      setMessageType(
        "success"
      );

      await loadSavings(true);
    } catch (error) {
      console.error(
        "SAVE MONEY ERROR:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to save money."
      );

      setMessageType("error");
    } finally {
      setActionKey("");
    }
  }

  function getPaymentAmount(
    row
  ) {
    if (row.fixedPayment) {
      return Number(
        row.obligationAmount || 0
      );
    }

    return Number(
      inputs[
        row.key
      ]?.pay || 0
    );
  }
  // ============================================================
  // PAY
  // ============================================================

  async function requestPayment(
    row
  ) {
    if (
      row.key === "BANKING" &&
      !requireBankingEmployee()
    ) {
      return;
    }

    if (
      row.fixedPayment &&
      (
        row.obligationAmount ===
          null ||
        !Number.isFinite(
          row.obligationAmount
        ) ||
        row.obligationAmount <= 0
      )
    ) {
      setMessage(
        `${row.label} fixed payment amount has not been configured by Admin yet.`
      );

      setMessageType("error");

      return;
    }

    const amount =
      getPaymentAmount(row);

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      setMessage(
        `Enter a valid ${row.label} payment amount.`
      );

      setMessageType("error");

      return;
    }

    if (
      amount >
      row.availableBalance
    ) {
      setMessage(
        `${row.label} payment cannot exceed available Savings. Available: KES ${money(
          row.availableBalance
        )}.`
      );

      setMessageType("error");

      return;
    }

    const bankingText =
      row.key === "BANKING"
        ? `\nEmployee: ${selectedBankingEmployee.employee_name}`
        : "";

    const confirmed =
      window.confirm(
        `Request ${row.label} payment?${bankingText}\n\nAmount: KES ${money(
          amount
        )}\n\nThe Accountant must confirm the actual payment before this amount leaves Savings.`
      );

    if (!confirmed) {
      return;
    }

    const key =
      `PAY-${row.key}`;

    try {
      setActionKey(key);
      setMessage("");
      setMessageType("");

      const isBanking =
        row.key === "BANKING";

      const functionName =
        isBanking
          ? "tl_cashier_request_banking_payment_employee"
          : "tl_cashier_request_savings_payment";

      const body =
        isBanking
          ? {
              p_shift_id: shiftId,

              p_employee_id:
                selectedBankingEmployee
                  .employee_id,

              p_amount:
                roundMoney(amount),
            }
          : {
              p_shift_id: shiftId,
              p_category: row.key,
              p_amount:
                roundMoney(amount),
            };

      const response =
        await fetch(
          `${supabaseUrl}/rest/v1/rpc/${functionName}`,
          {
            method: "POST",

            headers:
              authHeaders(
                supabaseAnonKey,
                accessToken
              ),

            body:
              JSON.stringify(body),
          }
        );

      const result =
        await safeJson(response);

      if (!response.ok) {
        throw new Error(
          result?.message ||
            result?.details ||
            result?.hint ||
            "Unable to request payment."
        );
      }

      if (
        !row.fixedPayment
      ) {
        clearInput(
          row.key,
          "pay"
        );
      }

      setMessage(
        isBanking
          ? `${selectedBankingEmployee.employee_name}: Banking payment request sent to Accountant for KES ${money(
              amount
            )}.`
          : `${row.label} payment request sent to Accountant for KES ${money(
              amount
            )}.`
      );

      setMessageType(
        "success"
      );

      await loadSavings(true);
    } catch (error) {
      console.error(
        "REQUEST PAYMENT ERROR:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to request payment."
      );

      setMessageType("error");
    } finally {
      setActionKey("");
    }
  }

  // ============================================================
  // WITHDRAW
  // ============================================================

  async function withdrawMoney(
    row
  ) {
    if (
      row.key === "BANKING" &&
      !requireBankingEmployee()
    ) {
      return;
    }

    const rawAmount =
      inputs[
        row.key
      ]?.withdraw;

    const amount =
      Number(rawAmount);

    if (
      rawAmount === "" ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      setMessage(
        `Enter a valid ${row.label} withdrawal amount.`
      );

      setMessageType("error");

      return;
    }

    if (
      amount >
      row.availableBalance
    ) {
      setMessage(
        `Withdrawal cannot exceed available ${row.label} Savings. Available: KES ${money(
          row.availableBalance
        )}.`
      );

      setMessageType("error");

      return;
    }

    const bankingText =
      row.key === "BANKING"
        ? `\nEmployee: ${selectedBankingEmployee.employee_name}`
        : "";

    const confirmed =
      window.confirm(
        `Withdraw KES ${money(
          amount
        )} from ${row.label} Savings?${bankingText}\n\nThe money will automatically enter the next available M-Shwari Added Float position.`
      );

    if (!confirmed) {
      return;
    }

    const key =
      `WITHDRAW-${row.key}`;

    try {
      setActionKey(key);
      setMessage("");
      setMessageType("");

      const isBanking =
        row.key === "BANKING";

      const functionName =
        isBanking
          ? "tl_cashier_withdraw_banking_employee"
          : "tl_cashier_withdraw_savings";

      const body =
        isBanking
          ? {
              p_shift_id: shiftId,

              p_employee_id:
                selectedBankingEmployee
                  .employee_id,

              p_amount:
                roundMoney(amount),
            }
          : {
              p_shift_id: shiftId,
              p_category: row.key,
              p_amount:
                roundMoney(amount),
            };

      const response =
        await fetch(
          `${supabaseUrl}/rest/v1/rpc/${functionName}`,
          {
            method: "POST",

            headers:
              authHeaders(
                supabaseAnonKey,
                accessToken
              ),

            body:
              JSON.stringify(body),
          }
        );

      const result =
        await safeJson(response);

      if (!response.ok) {
        throw new Error(
          result?.message ||
            result?.details ||
            result?.hint ||
            "Unable to withdraw Savings."
        );
      }

      clearInput(
        row.key,
        "withdraw"
      );

      setMessage(
        isBanking
          ? `${selectedBankingEmployee.employee_name}: KES ${money(
              amount
            )} withdrawn from Banking to M-Shwari Added Float ${result?.mshwari_slot || ""}.`
          : `${row.label}: KES ${money(
              amount
            )} withdrawn to M-Shwari Added Float ${result?.mshwari_slot || ""}.`
      );

      setMessageType(
        "success"
      );

      await loadSavings(true);
    } catch (error) {
      console.error(
        "WITHDRAW SAVINGS ERROR:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to withdraw Savings."
      );

      setMessageType("error");
    } finally {
      setActionKey("");
    }
  }

  // ============================================================
  // DISPLAY
  // ============================================================

  return (
    <section style={panelStyle}>
      <div style={titleStyle}>
        SAVINGS / BANKING
      </div>

      <div style={explanationStyle}>
        SAVE posts immediately to Savings and Expenses.
        PAY requires Accountant confirmation.
      </div>

      {message && (
        <div
          style={{
            ...messageStyle,

            backgroundColor:
              messageType ===
              "success"
                ? "#ecfdf5"
                : "#fef2f2",

            color:
              messageType ===
              "success"
                ? "#166534"
                : "#991b1b",
          }}
        >
          {message}
        </div>
      )}

      {loading ? (
        <div style={loadingStyle}>
          Loading Savings...
        </div>
      ) : (
        <>
          <div style={headerStyle}>
            <div>
              CATEGORY
            </div>

            <div>
              SAVED
            </div>

            <div>
              AVAILABLE
            </div>
          </div>

          {rows.map(
            (row) => {
              const saveBusy =
                actionKey ===
                `SAVE-${row.key}`;

              const payBusy =
                actionKey ===
                `PAY-${row.key}`;

              const withdrawBusy =
                actionKey ===
                `WITHDRAW-${row.key}`;

              const anyBusy =
                actionKey !== "";

              const isBanking =
                row.key ===
                "BANKING";

              const bankingReady =
                !isBanking ||
                Boolean(
                  selectedBankingEmployee
                );

              const fixedAmountReady =
                row.obligationAmount !==
                  null &&
                Number.isFinite(
                  row.obligationAmount
                ) &&
                row.obligationAmount >
                  0;

              const fixedCanPay =
                fixedAmountReady &&
                row.availableBalance >=
                  row.obligationAmount;

              return (
                <div
                  key={row.key}
                  style={{
                    ...categoryCardStyle,

                    ...(isBanking
                      ? bankingCategoryCardStyle
                      : {}),
                  }}
                >
                  <div style={balanceRowStyle}>
                    <div>
                      <strong>
                        {row.label}
                      </strong>

                      {row.fixedPayment && (
                        <div style={fixedTextStyle}>
                          Fixed payment:{" "}
                          {fixedAmountReady
                            ? `KES ${money(
                                row.obligationAmount
                              )}`
                            : "Not configured"}
                        </div>
                      )}

                      {row.key ===
                        "ELECTRICITY" && (
                        <div style={variableTextStyle}>
                          Variable amount
                        </div>
                      )}

                      {isBanking && (
                        <div style={variableTextStyle}>
                          Employee Banking
                        </div>
                      )}
                    </div>

                    <div style={moneyCellStyle}>
                      KES{" "}
                      {money(
                        row.balance
                      )}
                    </div>

                    <div style={availableCellStyle}>
                      KES{" "}
                      {money(
                        row.availableBalance
                      )}
                    </div>
                  </div>

                  {/* ================================= */}
                  {/* DIRECT BANKING EMPLOYEE DROPDOWN */}
                  {/* ================================= */}

                  {isBanking && (
                    <div style={employeeSelectorStyle}>
                      <div style={employeeSelectorTitleStyle}>
                        SELECT EMPLOYEE
                      </div>

                      <select
                        value={
                          selectedBankingEmployeeId
                        }
                        disabled={anyBusy}
                        onChange={(event) =>
                          selectBankingEmployee(
                            event.target.value
                          )
                        }
                        style={employeeDirectSelectStyle}
                      >
                        <option value="">
                          Select employee
                        </option>

                        {sortedBankingEmployees.map(
                          (employee) => (
                            <option
                              key={
                                employee.employee_id
                              }
                              value={
                                employee.employee_id
                              }
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

                  {row.pendingPaymentAmount >
                    0 && (
                    <div style={reservedStyle}>
                      KES{" "}
                      {money(
                        row.pendingPaymentAmount
                      )}{" "}
                      reserved for Accountant payment confirmation.
                    </div>
                  )}

                  {/* SAVE */}

                  <div style={actionRowStyle}>
                    <div style={actionLabelStyle}>
                      SAVE
                    </div>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={
                        inputs[
                          row.key
                        ]?.save || ""
                      }
                      disabled={
                        anyBusy ||
                        !bankingReady
                      }
                      placeholder={
                        isBanking &&
                        !bankingReady
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
                      style={inputStyle}
                    />

                    <button
                      type="button"
                      disabled={
                        anyBusy ||
                        !bankingReady
                      }
                      onClick={() =>
                        saveMoney(row)
                      }
                      style={{
                        ...saveButtonStyle,

                        opacity:
                          anyBusy ||
                          !bankingReady
                            ? 0.5
                            : 1,
                      }}
                    >
                      {saveBusy
                        ? "Saving..."
                        : "Save"}
                    </button>
                  </div>

                  {/* PAY */}

                  <div style={actionRowStyle}>
                    <div style={actionLabelStyle}>
                      PAY
                    </div>

                    {row.fixedPayment ? (
                      <input
                        type="text"
                        value={
                          fixedAmountReady
                            ? money(
                                row.obligationAmount
                              )
                            : ""
                        }
                        readOnly
                        placeholder="Admin fixed amount"
                        style={{
                          ...inputStyle,

                          backgroundColor:
                            "#f8fafc",

                          cursor:
                            "not-allowed",
                        }}
                      />
                    ) : (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          inputs[
                            row.key
                          ]?.pay || ""
                        }
                        disabled={
                          anyBusy ||
                          !bankingReady
                        }
                        placeholder={
                          isBanking &&
                          !bankingReady
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
                        style={inputStyle}
                      />
                    )}

                    <button
                      type="button"
                      disabled={
                        anyBusy ||
                        !bankingReady ||
                        row.availableBalance <=
                          0 ||
                        (
                          row.fixedPayment &&
                          !fixedCanPay
                        )
                      }
                      onClick={() =>
                        requestPayment(
                          row
                        )
                      }
                      style={{
                        ...payButtonStyle,

                        opacity:
                          anyBusy ||
                          !bankingReady ||
                          row.availableBalance <=
                            0 ||
                          (
                            row.fixedPayment &&
                            !fixedCanPay
                          )
                            ? 0.5
                            : 1,
                      }}
                    >
                      {payBusy
                        ? "Sending..."
                        : "Request Pay"}
                    </button>
                  </div>

                  {/* WITHDRAW */}

                  <div style={actionRowStyle}>
                    <div style={actionLabelStyle}>
                      WITHDRAW
                    </div>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={
                        inputs[
                          row.key
                        ]?.withdraw ||
                        ""
                      }
                      disabled={
                        anyBusy ||
                        !bankingReady
                      }
                      placeholder={
                        isBanking &&
                        !bankingReady
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
                      style={inputStyle}
                    />

                    <button
                      type="button"
                      disabled={
                        anyBusy ||
                        !bankingReady ||
                        row.availableBalance <=
                          0
                      }
                      onClick={() =>
                        withdrawMoney(
                          row
                        )
                      }
                      style={{
                        ...withdrawButtonStyle,

                        opacity:
                          anyBusy ||
                          !bankingReady ||
                          row.availableBalance <=
                            0
                            ? 0.5
                            : 1,
                      }}
                    >
                      {withdrawBusy
                        ? "Withdrawing..."
                        : "Withdraw"}
                    </button>
                  </div>
                </div>
              );
            }
          )}

          {/* TOTALS */}

          <div style={totalStyle}>
            <div style={totalCardStyle}>
              <span>
                TOTAL SAVED
              </span>

              <strong>
                KES{" "}
                {money(
                  totals.saved
                )}
              </strong>
            </div>

            <div style={totalCardStyle}>
              <span>
                PENDING PAYMENTS
              </span>

              <strong>
                KES{" "}
                {money(
                  totals.reserved
                )}
              </strong>
            </div>

            <div style={totalCardStyle}>
              <span>
                AVAILABLE
              </span>

              <strong>
                KES{" "}
                {money(
                  totals.available
                )}
              </strong>
            </div>
          </div>

          {/* HISTORY */}

          <div style={historyWrapStyle}>
            <div style={historyTitleStyle}>
              RECENT PAYMENT REQUESTS
            </div>

            {paymentRequests.length ===
            0 ? (
              <div style={emptyHistoryStyle}>
                No payment requests yet.
              </div>
            ) : (
              paymentRequests
                .slice(0, 6)
                .map(
                  (request) => (
                    <div
                      key={request.id}
                      style={historyRowStyle}
                    >
                      <div>
                        <strong>
                          {
                            request.category
                          }
                        </strong>

                        <div style={historyTimeStyle}>
                          {formatDateTime(
                            request.requested_at
                          )}
                        </div>
                      </div>

                      <div style={historyAmountStyle}>
                        KES{" "}
                        {money(
                          request.amount
                        )}
                      </div>

                      <StatusBadge
                        status={
                          request.status
                        }
                      />
                    </div>
                  )
                )
            )}
          </div>

          <div style={noteStyle}>
            Saving reduces available shift money immediately because it
            is posted to Expenses. Paying later does not create a second
            expense. Employee Banking follows the selected employee.
          </div>
        </>
      )}
    </section>
  );
}

// ============================================================
// STATUS
// ============================================================

function StatusBadge({
  status,
}) {
  const value =
    String(
      status || ""
    ).toUpperCase();

  let style =
    pendingStyle;

  if (
    value === "CONFIRMED"
  ) {
    style =
      confirmedStyle;
  } else if (
    value === "PROCESSING"
  ) {
    style =
      processingStyle;
  } else if (
    [
      "REJECTED",
      "FAILED",
      "CANCELLED",
    ].includes(value)
  ) {
    style =
      rejectedStyle;
  }

  return (
    <div style={style}>
      {value ||
        "PENDING"}
    </div>
  );
}

// ============================================================
// HELPERS
// ============================================================

function authHeaders(
  anonKey,
  accessToken
) {
  return {
    apikey: anonKey,

    Authorization:
      `Bearer ${accessToken}`,

    "Content-Type":
      "application/json",
  };
}

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
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  );
}

function roundMoney(
  value
) {
  return (
    Math.round(
      (
        Number(value) +
        Number.EPSILON
      ) *
        100
    ) /
    100
  );
}

function formatDateTime(
  value
) {
  if (!value) {
    return "";
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
          "short",

        hour:
          "2-digit",

        minute:
          "2-digit",
      }
    ).format(
      new Date(value)
    );
  } catch {
    return "";
  }
}
// ============================================================
// STYLES
// ============================================================

const panelStyle = {
  backgroundColor: "white",
  borderRadius: "6px",
  overflow: "hidden",
  boxShadow:
    "0 1px 5px rgba(0,0,0,0.12)",
};

const titleStyle = {
  backgroundColor: "#0873b9",
  color: "white",
  padding: "10px 12px",
  fontSize: "14px",
  fontWeight: "bold",
};

const explanationStyle = {
  padding: "8px 10px",
  backgroundColor: "#eff6ff",
  color: "#1e3a8a",
  fontSize: "9px",
  lineHeight: "1.4",
};

const loadingStyle = {
  padding: "20px",
  textAlign: "center",
  color: "#64748b",
  fontSize: "11px",
};

const messageStyle = {
  margin: "8px",
  padding: "8px",
  borderRadius: "5px",
  fontSize: "10px",
  fontWeight: "600",
};

const headerStyle = {
  display: "grid",
  gridTemplateColumns:
    "1.25fr 0.9fr 0.9fr",
  gap: "6px",
  padding: "8px",
  backgroundColor: "#eef4f8",
  color: "#334155",
  fontSize: "9px",
  fontWeight: "bold",
  textAlign: "center",
};

const categoryCardStyle = {
  padding: "8px",
  borderTop:
    "1px solid #e5e7eb",
  backgroundColor: "#ffffff",
};

const bankingCategoryCardStyle = {
  backgroundColor: "#f8fffe",
  borderTop:
    "2px solid #0f766e",
};

const balanceRowStyle = {
  display: "grid",
  gridTemplateColumns:
    "1.25fr 0.9fr 0.9fr",
  gap: "6px",
  alignItems: "center",
  marginBottom: "6px",
  fontSize: "11px",
};

const fixedTextStyle = {
  marginTop: "2px",
  color: "#64748b",
  fontSize: "8px",
  fontWeight: "normal",
};

const variableTextStyle = {
  ...fixedTextStyle,
};

const moneyCellStyle = {
  padding: "7px",
  borderRadius: "4px",
  backgroundColor: "#ecfdf5",
  color: "#166534",
  fontWeight: "bold",
  textAlign: "right",
};

const availableCellStyle = {
  padding: "7px",
  borderRadius: "4px",
  backgroundColor: "#eff6ff",
  color: "#1d4ed8",
  fontWeight: "bold",
  textAlign: "right",
};

// ============================================================
// DIRECT EMPLOYEE DROPDOWN
// ============================================================

const employeeSelectorStyle = {
  margin: "7px 0 8px",
  padding: "9px",
  border:
    "1px solid #99f6e4",
  borderRadius: "6px",
  backgroundColor: "#f0fdfa",
};

const employeeSelectorTitleStyle = {
  color: "#115e59",
  fontSize: "9px",
  fontWeight: "900",
  marginBottom: "5px",
};

const employeeDirectSelectStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "9px",
  border:
    "1px solid #14b8a6",
  borderRadius: "4px",
  backgroundColor: "white",
  color: "#0f172a",
  fontSize: "10px",
  fontWeight: "700",
  cursor: "pointer",
};

// ============================================================
// ACTIONS
// ============================================================

const reservedStyle = {
  marginBottom: "6px",
  padding: "5px 7px",
  backgroundColor: "#fef3c7",
  color: "#92400e",
  borderRadius: "4px",
  fontSize: "8px",
};

const actionRowStyle = {
  display: "grid",
  gridTemplateColumns:
    "0.65fr 1fr 0.9fr",
  gap: "5px",
  alignItems: "center",
  marginTop: "5px",
};

const actionLabelStyle = {
  color: "#475569",
  fontSize: "8px",
  fontWeight: "bold",
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "7px",
  border:
    "1px solid #cbd5e1",
  borderRadius: "4px",
  fontSize: "10px",
  textAlign: "right",
};

const saveButtonStyle = {
  width: "100%",
  padding: "7px",
  border: "none",
  borderRadius: "4px",
  backgroundColor: "#0873b9",
  color: "white",
  cursor: "pointer",
  fontSize: "9px",
  fontWeight: "bold",
};

const payButtonStyle = {
  ...saveButtonStyle,
  backgroundColor: "#15803d",
};

const withdrawButtonStyle = {
  ...saveButtonStyle,
  backgroundColor: "#d97706",
};

// ============================================================
// TOTALS
// ============================================================

const totalStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(3, 1fr)",
  gap: "1px",
  marginTop: "3px",
  backgroundColor: "#d1d5db",
  borderTop:
    "1px solid #d1d5db",
  borderBottom:
    "1px solid #d1d5db",
};

const totalCardStyle = {
  padding: "8px",
  display: "grid",
  gap: "3px",
  backgroundColor: "#f8fafc",
  textAlign: "center",
  color: "#475569",
  fontSize: "8px",
};

// ============================================================
// HISTORY
// ============================================================

const historyWrapStyle = {
  padding: "8px",
};

const historyTitleStyle = {
  marginBottom: "6px",
  color: "#334155",
  fontSize: "9px",
  fontWeight: "bold",
};

const emptyHistoryStyle = {
  padding: "8px",
  backgroundColor: "#f8fafc",
  color: "#64748b",
  borderRadius: "4px",
  fontSize: "9px",
};

const historyRowStyle = {
  display: "grid",
  gridTemplateColumns:
    "1.2fr 0.8fr 0.8fr",
  gap: "6px",
  alignItems: "center",
  padding: "6px 0",
  borderBottom:
    "1px solid #e5e7eb",
  fontSize: "9px",
};

const historyTimeStyle = {
  color: "#94a3b8",
  marginTop: "2px",
  fontSize: "8px",
};

const historyAmountStyle = {
  textAlign: "right",
  fontWeight: "bold",
};

// ============================================================
// STATUS
// ============================================================

const pendingStyle = {
  padding: "5px",
  borderRadius: "4px",
  backgroundColor: "#fef3c7",
  color: "#92400e",
  textAlign: "center",
  fontSize: "8px",
  fontWeight: "bold",
};

const processingStyle = {
  ...pendingStyle,
  backgroundColor: "#dbeafe",
  color: "#1d4ed8",
};

const confirmedStyle = {
  ...pendingStyle,
  backgroundColor: "#dcfce7",
  color: "#166534",
};

const rejectedStyle = {
  ...pendingStyle,
  backgroundColor: "#fee2e2",
  color: "#991b1b",
};

const noteStyle = {
  padding: "8px 10px 10px",
  color: "#64748b",
  fontSize: "8px",
  lineHeight: "1.4",
};
