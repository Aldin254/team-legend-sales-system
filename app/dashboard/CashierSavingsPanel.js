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
  const [categories, setCategories] =
    useState([]);

  const [
    paymentRequests,
    setPaymentRequests,
  ] = useState([]);

  const [
    bankingEmployees,
    setBankingEmployees,
  ] = useState([]);

  const [
    selectedBankingEmployeeId,
    setSelectedBankingEmployeeId,
  ] = useState("");

  const [inputs, setInputs] =
    useState(blankInputs());

  const [loading, setLoading] =
    useState(true);

  const [actionKey, setActionKey] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [
    messageType,
    setMessageType,
  ] = useState("");

  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env
      .NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const accessToken =
    user?.access_token || null;

  const shiftId =
    currentShift?.id || null;

  // ============================================================
  // LOAD
  // ============================================================

  const loadSavings =
    useCallback(
      async (
        silent = false
      ) => {
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

          const headers =
            authHeaders(
              supabaseAnonKey,
              accessToken
            );

          const [
            savingsResponse,
            bankingResponse,
          ] =
            await Promise.all([
              fetch(
                `${supabaseUrl}/rest/v1/rpc/tl_cashier_savings_snapshot`,
                {
                  method: "POST",

                  headers,

                  body:
                    JSON.stringify(
                      {
                        p_shift_id:
                          shiftId,
                      }
                    ),

                  cache:
                    "no-store",
                }
              ),

              fetch(
                `${supabaseUrl}/rest/v1/rpc/tl_cashier_banking_directory`,
                {
                  method: "POST",

                  headers,

                  body:
                    JSON.stringify(
                      {
                        p_shift_id:
                          shiftId,
                      }
                    ),

                  cache:
                    "no-store",
                }
              ),
            ]);

          const [
            savingsResult,
            bankingResult,
          ] =
            await Promise.all([
              safeJson(
                savingsResponse
              ),

              safeJson(
                bankingResponse
              ),
            ]);

          if (
            !savingsResponse.ok
          ) {
            throw new Error(
              savingsResult?.message ||
                savingsResult?.details ||
                savingsResult?.hint ||
                "Unable to load Savings."
            );
          }

          if (
            !bankingResponse.ok
          ) {
            throw new Error(
              bankingResult?.message ||
                bankingResult?.details ||
                bankingResult?.hint ||
                "Unable to load employee Banking directory."
            );
          }

          const loadedCategories =
            Array.isArray(
              savingsResult
                ?.categories
            )
              ? savingsResult.categories
              : [];

          const loadedRequests =
            Array.isArray(
              savingsResult
                ?.payment_requests
            )
              ? savingsResult
                  .payment_requests
              : [];

          const loadedEmployees =
            Array.isArray(
              bankingResult
                ?.employees
            )
              ? bankingResult.employees
              : [];

          setCategories(
            loadedCategories
          );

          setPaymentRequests(
            loadedRequests
          );

          setBankingEmployees(
            loadedEmployees
          );

          setSelectedBankingEmployeeId(
            (previous) => {
              if (!previous) {
                return "";
              }

              const exists =
                loadedEmployees.some(
                  (
                    employee
                  ) =>
                    String(
                      employee
                        .employee_id
                    ) ===
                    String(
                      previous
                    )
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

            setMessageType(
              "error"
            );
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

    const timer =
      setInterval(
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
  // ============================================================

  const sortedBankingEmployees =
    useMemo(() => {
      return [
        ...bankingEmployees,
      ].sort(
        (a, b) => {
          const mobileA =
            a?.is_mobile
              ? 0
              : 1;

          const mobileB =
            b?.is_mobile
              ? 0
              : 1;

          if (
            mobileA !==
            mobileB
          ) {
            return (
              mobileA -
              mobileB
            );
          }

          const shopCompare =
            String(
              a?.shop_name ||
                ""
            ).localeCompare(
              String(
                b?.shop_name ||
                  ""
              )
            );

          if (
            shopCompare !==
            0
          ) {
            return shopCompare;
          }

          return String(
            a?.employee_name ||
              ""
          ).localeCompare(
            String(
              b?.employee_name ||
                ""
            )
          );
        }
      );
    }, [
      bankingEmployees,
    ]);

  const selectedBankingEmployee =
    useMemo(() => {
      if (
        !selectedBankingEmployeeId
      ) {
        return null;
      }

      return (
        bankingEmployees.find(
          (
            employee
          ) =>
            String(
              employee
                .employee_id
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

              accountId:
                null,

              balance:
                Number(
                  selectedBankingEmployee
                    ?.saved_balance ||
                    0
                ),

              obligationAmount:
                null,

              pendingPaymentAmount:
                Number(
                  selectedBankingEmployee
                    ?.pending_payment_amount ||
                    0
                ),

              availableBalance:
                Number(
                  selectedBankingEmployee
                    ?.available_balance ||
                    0
                ),

              employeeId:
                selectedBankingEmployee
                  ?.employee_id ||
                null,
            };
          }

          const found =
            categories.find(
              (row) =>
                String(
                  row?.category ||
                    ""
                ).toUpperCase() ===
                config.key
            );

          return {
            ...config,

            accountId:
              found?.account_id ||
              null,

            balance:
              Number(
                found?.balance ||
                  0
              ),

            obligationAmount:
              found?.obligation_amount ===
                null ||
              found?.obligation_amount ===
                undefined
                ? null
                : Number(
                    found
                      .obligation_amount
                  ),

            pendingPaymentAmount:
              Number(
                found
                  ?.pending_payment_amount ||
                  0
              ),

            availableBalance:
              Number(
                found
                  ?.available_balance ||
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

      for (
        const row of rows
      ) {
        saved +=
          Number(
            row.balance ||
              0
          );

        reserved +=
          Number(
            row
              .pendingPaymentAmount ||
              0
          );

        available +=
          Number(
            row
              .availableBalance ||
              0
          );
      }

      return {
        saved:
          roundMoney(
            saved
          ),

        reserved:
          roundMoney(
            reserved
          ),

        available:
          roundMoney(
            available
          ),
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
    setInputs(
      (previous) => ({
        ...previous,

        [category]: {
          ...previous[
            category
          ],

          [field]:
            value,
        },
      })
    );

    setMessage("");
    setMessageType("");
  }

  function clearInput(
    category,
    field
  ) {
    setInputs(
      (previous) => ({
        ...previous,

        [category]: {
          ...previous[
            category
          ],

          [field]:
            "",
        },
      })
    );
  }

  function clearBankingInputs() {
    setInputs(
      (previous) => ({
        ...previous,

        BANKING: {
          save: "",
          pay: "",
          withdraw: "",
        },
      })
    );
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

    setMessageType(
      "error"
    );

    return false;
  }
  // ============================================================
  // SAVE
  // ============================================================

  async function saveMoney(
    row
  ) {
    if (
      row.key ===
        "BANKING" &&
      !requireBankingEmployee()
    ) {
      return;
    }

    const rawAmount =
      inputs[
        row.key
      ]?.save;

    const amount =
      Number(
        rawAmount
      );

    if (
      rawAmount === "" ||
      !Number.isFinite(
        amount
      ) ||
      amount <= 0
    ) {
      setMessage(
        `Enter a valid amount to save for ${row.label}.`
      );

      setMessageType(
        "error"
      );

      return;
    }

    const bankingText =
      row.key ===
      "BANKING"
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
        row.key ===
        "BANKING";

      const functionName =
        isBanking
          ? "tl_cashier_save_banking_employee"
          : "tl_cashier_save_savings";

      const body =
        isBanking
          ? {
              p_shift_id:
                shiftId,

              p_employee_id:
                selectedBankingEmployee
                  .employee_id,

              p_amount:
                roundMoney(
                  amount
                ),
            }
          : {
              p_shift_id:
                shiftId,

              p_category:
                row.key,

              p_amount:
                roundMoney(
                  amount
                ),
            };

      const response =
        await fetch(
          `${supabaseUrl}/rest/v1/rpc/${functionName}`,
          {
            method:
              "POST",

            headers:
              authHeaders(
                supabaseAnonKey,
                accessToken
              ),

            body:
              JSON.stringify(
                body
              ),
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

      await loadSavings(
        true
      );
    } catch (error) {
      console.error(
        "SAVE MONEY ERROR:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to save money."
      );

      setMessageType(
        "error"
      );
    } finally {
      setActionKey("");
    }
  }

  function getPaymentAmount(
    row
  ) {
    if (
      row.fixedPayment
    ) {
      return Number(
        row.obligationAmount ||
          0
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
      row.key ===
        "BANKING" &&
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
        row.obligationAmount <=
          0
      )
    ) {
      setMessage(
        `${row.label} fixed payment amount has not been configured by Admin yet.`
      );

      setMessageType(
        "error"
      );

      return;
    }

    const amount =
      getPaymentAmount(
        row
      );

    if (
      !Number.isFinite(
        amount
      ) ||
      amount <= 0
    ) {
      setMessage(
        `Enter a valid ${row.label} payment amount.`
      );

      setMessageType(
        "error"
      );

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

      setMessageType(
        "error"
      );

      return;
    }

    const bankingText =
      row.key ===
      "BANKING"
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
        row.key ===
        "BANKING";

      const functionName =
        isBanking
          ? "tl_cashier_request_banking_payment_employee"
          : "tl_cashier_request_savings_payment";

      const body =
        isBanking
          ? {
              p_shift_id:
                shiftId,

              p_employee_id:
                selectedBankingEmployee
                  .employee_id,

              p_amount:
                roundMoney(
                  amount
                ),
            }
          : {
              p_shift_id:
                shiftId,

              p_category:
                row.key,

              p_amount:
                roundMoney(
                  amount
                ),
            };

      const response =
        await fetch(
          `${supabaseUrl}/rest/v1/rpc/${functionName}`,
          {
            method:
              "POST",

            headers:
              authHeaders(
                supabaseAnonKey,
                accessToken
              ),

            body:
              JSON.stringify(
                body
              ),
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

      await loadSavings(
        true
      );
    } catch (error) {
      console.error(
        "REQUEST PAYMENT ERROR:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to request payment."
      );

      setMessageType(
        "error"
      );
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
      row.key ===
        "BANKING" &&
      !requireBankingEmployee()
    ) {
      return;
    }

    const rawAmount =
      inputs[
        row.key
      ]?.withdraw;

    const amount =
      Number(
        rawAmount
      );

    if (
      rawAmount === "" ||
      !Number.isFinite(
        amount
      ) ||
      amount <= 0
    ) {
      setMessage(
        `Enter a valid ${row.label} withdrawal amount.`
      );

      setMessageType(
        "error"
      );

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

      setMessageType(
        "error"
      );

      return;
    }

    const bankingText =
      row.key ===
      "BANKING"
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
        row.key ===
        "BANKING";

      const functionName =
        isBanking
          ? "tl_cashier_withdraw_banking_employee"
          : "tl_cashier_withdraw_savings";

      const body =
        isBanking
          ? {
              p_shift_id:
                shiftId,

              p_employee_id:
                selectedBankingEmployee
                  .employee_id,

              p_amount:
                roundMoney(
                  amount
                ),
            }
          : {
              p_shift_id:
                shiftId,

              p_category:
                row.key,

              p_amount:
                roundMoney(
                  amount
                ),
            };

      const response =
        await fetch(
          `${supabaseUrl}/rest/v1/rpc/${functionName}`,
          {
            method:
              "POST",

            headers:
              authHeaders(
                supabaseAnonKey,
                accessToken
              ),

            body:
              JSON.stringify(
                body
              ),
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

      await loadSavings(
        true
      );
    } catch (error) {
      console.error(
        "WITHDRAW SAVINGS ERROR:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to withdraw Savings."
      );

      setMessageType(
        "error"
      );
    } finally {
      setActionKey("");
    }
  }

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
          titleStyle
        }
      >
        SAVINGS / BANKING
      </div>

      <div
        style={
          explanationStyle
        }
      >
        SAVE posts immediately to Savings and Expenses. PAY requires Accountant confirmation.
      </div>

      {message && (
        <div
          style={{
            ...messageStyle,

            border:
              messageType ===
              "success"
                ? "1px solid #2F6B47"
                : "1px solid #79363C",

            background:
              messageType ===
              "success"
                ? "#10261A"
                : "#2C1619",

            color:
              "#FFFFFF",
          }}
        >
          {message}
        </div>
      )}

      {loading ? (
        <div
          style={
            loadingStyle
          }
        >
          Loading Savings...
        </div>
      ) : (
        <>
          {/* ======================================= */}
          {/* HORIZONTAL SAVINGS CATEGORY CARDS */}
          {/* ======================================= */}

          <div
            style={
              categoriesGridStyle
            }
          >
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
                  actionKey !==
                  "";

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
                    key={
                      row.key
                    }
                    style={{
                      ...categoryCardStyle,

                      ...(isBanking
                        ? bankingCategoryCardStyle
                        : {}),
                    }}
                  >
                    {/* CATEGORY TITLE */}

                    <div
                      style={
                        categoryTopStyle
                      }
                    >
                      <div>
                        <div
                          style={
                            categoryNameStyle
                          }
                        >
                          {
                            row.label
                          }
                        </div>

                        {row.fixedPayment && (
                          <div
                            style={
                              subTextStyle
                            }
                          >
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
                          <div
                            style={
                              subTextStyle
                            }
                          >
                            Variable amount
                          </div>
                        )}

                        {isBanking && (
                          <div
                            style={
                              subTextStyle
                            }
                          >
                            Employee Banking
                          </div>
                        )}
                      </div>
                    </div>

                    {/* SAVED / AVAILABLE */}

                    <div
                      style={
                        balanceGridStyle
                      }
                    >
                      <div
                        style={
                          balanceBoxStyle
                        }
                      >
                        <span>
                          SAVED
                        </span>

                        <strong>
                          KES{" "}
                          {money(
                            row.balance
                          )}
                        </strong>
                      </div>

                      <div
                        style={
                          balanceBoxStyle
                        }
                      >
                        <span>
                          AVAILABLE
                        </span>

                        <strong>
                          KES{" "}
                          {money(
                            row.availableBalance
                          )}
                        </strong>
                      </div>
                    </div>

                    {/* EMPLOYEE BANKING SELECTOR */}

                    {isBanking && (
                      <div
                        style={
                          employeeSelectorStyle
                        }
                      >
                        <div
                          style={
                            employeeSelectorTitleStyle
                          }
                        >
                          SELECT EMPLOYEE
                        </div>

                        <select
                          value={
                            selectedBankingEmployeeId
                          }
                          disabled={
                            anyBusy
                          }
                          onChange={(
                            event
                          ) =>
                            selectBankingEmployee(
                              event
                                .target
                                .value
                            )
                          }
                          style={
                            employeeDirectSelectStyle
                          }
                        >
                          <option value="">
                            Select employee
                          </option>

                          {sortedBankingEmployees.map(
                            (
                              employee
                            ) => (
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
                      <div
                        style={
                          reservedStyle
                        }
                      >
                        KES{" "}
                        {money(
                          row.pendingPaymentAmount
                        )}{" "}
                        reserved for Accountant confirmation.
                      </div>
                    )}

                    {/* SAVE */}

                    <div
                      style={
                        actionRowStyle
                      }
                    >
                      <div
                        style={
                          actionLabelStyle
                        }
                      >
                        SAVE
                      </div>

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          inputs[
                            row.key
                          ]?.save ||
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
                        onChange={(
                          event
                        ) =>
                          setInput(
                            row.key,
                            "save",
                            event
                              .target
                              .value
                          )
                        }
                        style={
                          inputStyle
                        }
                      />

                      <button
                        type="button"
                        disabled={
                          anyBusy ||
                          !bankingReady
                        }
                        onClick={() =>
                          saveMoney(
                            row
                          )
                        }
                        style={{
                          ...actionButtonStyle,

                          opacity:
                            anyBusy ||
                            !bankingReady
                              ? 0.45
                              : 1,
                        }}
                      >
                        {saveBusy
                          ? "Saving..."
                          : "Save"}
                      </button>
                    </div>

                    {/* PAY */}

                    <div
                      style={
                        actionRowStyle
                      }
                    >
                      <div
                        style={
                          actionLabelStyle
                        }
                      >
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
                            ]?.pay ||
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
                          onChange={(
                            event
                          ) =>
                            setInput(
                              row.key,
                              "pay",
                              event
                                .target
                                .value
                            )
                          }
                          style={
                            inputStyle
                          }
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
                          ...actionButtonStyle,

                          opacity:
                            anyBusy ||
                            !bankingReady ||
                            row.availableBalance <=
                              0 ||
                            (
                              row.fixedPayment &&
                              !fixedCanPay
                            )
                              ? 0.45
                              : 1,
                        }}
                      >
                        {payBusy
                          ? "Sending..."
                          : "Request Pay"}
                      </button>
                    </div>

                    {/* WITHDRAW */}

                    <div
                      style={
                        actionRowStyle
                      }
                    >
                      <div
                        style={
                          actionLabelStyle
                        }
                      >
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
                        onChange={(
                          event
                        ) =>
                          setInput(
                            row.key,
                            "withdraw",
                            event
                              .target
                              .value
                          )
                        }
                        style={
                          inputStyle
                        }
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
                          ...actionButtonStyle,

                          opacity:
                            anyBusy ||
                            !bankingReady ||
                            row.availableBalance <=
                              0
                              ? 0.45
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
          </div>
{/* TOTALS */}

          <div
            style={
              totalStyle
            }
          >
            <div
              style={
                totalCardStyle
              }
            >
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

            <div
              style={
                totalCardStyle
              }
            >
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

            <div
              style={
                totalCardStyle
              }
            >
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

          <div
            style={
              historyWrapStyle
            }
          >
            <div
              style={
                historyTitleStyle
              }
            >
              RECENT PAYMENT REQUESTS
            </div>

            {paymentRequests.length ===
            0 ? (
              <div
                style={
                  emptyHistoryStyle
                }
              >
                No payment requests yet.
              </div>
            ) : (
              <div
                style={
                  historyGridStyle
                }
              >
                {paymentRequests
                  .slice(
                    0,
                    6
                  )
                  .map(
                    (
                      request
                    ) => (
                      <div
                        key={
                          request.id
                        }
                        style={
                          historyRowStyle
                        }
                      >
                        <div>
                          <strong>
                            {
                              request.category
                            }
                          </strong>

                          <div
                            style={
                              historyTimeStyle
                            }
                          >
                            {formatDateTime(
                              request.requested_at
                            )}
                          </div>
                        </div>

                        <div
                          style={
                            historyAmountStyle
                          }
                        >
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
                  )}
              </div>
            )}
          </div>

          <div
            style={
              noteStyle
            }
          >
            Saving reduces available shift money immediately because it is posted to Expenses. Paying later does not create a second expense. Employee Banking follows the selected employee.
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
    value ===
    "CONFIRMED"
  ) {
    style =
      confirmedStyle;
  } else if (
    value ===
    "PROCESSING"
  ) {
    style =
      processingStyle;
  } else if (
    [
      "REJECTED",
      "FAILED",
      "CANCELLED",
    ].includes(
      value
    )
  ) {
    style =
      rejectedStyle;
  }

  return (
    <div
      style={
        style
      }
    >
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
    apikey:
      anonKey,

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
      new Date(
        value
      )
    );
  } catch {
    return "";
  }
}


// ============================================================
// PROFESSIONAL MATTE BLACK STYLES
// ============================================================

const panelStyle = {
  gridColumn:
    "1 / -1",

  width:
    "100%",

  boxSizing:
    "border-box",

  background:
    "linear-gradient(180deg, #11161C 0%, #0B0F13 100%)",

  color:
    "#FFFFFF",

  border:
    "1px solid #303840",

  borderRadius:
    "14px",

  overflow:
    "hidden",

  boxShadow:
    "0 10px 28px rgba(0,0,0,0.22)",
};


const titleStyle = {
  padding:
    "13px 16px",

  background:
    "linear-gradient(145deg, rgba(215,179,106,0.16), rgba(17,22,28,0.98))",

  color:
    "#FFFFFF",

  borderBottom:
    "1px solid rgba(215,179,106,0.34)",

  borderLeft:
    "4px solid #D7B36A",

  fontSize:
    "16px",

  fontWeight:
    950,

  letterSpacing:
    "0.5px",
};


const explanationStyle = {
  padding:
    "9px 16px",

  backgroundColor:
    "#0D1115",

  color:
    "#FFFFFF",

  borderBottom:
    "1px solid #292F36",

  fontSize:
    "12px",

  lineHeight:
    1.45,
};


const loadingStyle = {
  padding:
    "24px",

  textAlign:
    "center",

  color:
    "#FFFFFF",

  fontSize:
    "14px",

  fontWeight:
    750,
};


const messageStyle = {
  margin:
    "10px",

  padding:
    "10px 12px",

  borderRadius:
    "8px",

  fontSize:
    "13px",

  fontWeight:
    800,
};


// ============================================================
// HORIZONTAL CATEGORY GRID
// ============================================================

const categoriesGridStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "repeat(auto-fit, minmax(280px, 1fr))",

  gap:
    "10px",

  padding:
    "12px",
};


const categoryCardStyle = {
  minWidth:
    0,

  padding:
    "12px",

  background:
    "linear-gradient(145deg, #151A20, #0C1014)",

  border:
    "1px solid #343C45",

  borderRadius:
    "11px",

  boxShadow:
    "0 7px 18px rgba(0,0,0,0.20)",
};


const bankingCategoryCardStyle = {
  border:
    "1px solid rgba(215,179,106,0.48)",

  background:
    "linear-gradient(145deg, rgba(215,179,106,0.08), #0D1115)",
};


const categoryTopStyle = {
  display:
    "flex",

  justifyContent:
    "space-between",

  alignItems:
    "flex-start",

  gap:
    "10px",

  minHeight:
    "38px",

  marginBottom:
    "9px",
};


const categoryNameStyle = {
  color:
    "#FFFFFF",

  fontSize:
    "15px",

  fontWeight:
    950,

  letterSpacing:
    "0.5px",
};


const subTextStyle = {
  marginTop:
    "3px",

  color:
    "#B8C0C8",

  fontSize:
    "11px",

  fontWeight:
    700,
};


// ============================================================
// BALANCES
// ============================================================

const balanceGridStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "repeat(2, minmax(0, 1fr))",

  gap:
    "7px",

  marginBottom:
    "9px",
};


const balanceBoxStyle = {
  display:
    "grid",

  gap:
    "4px",

  padding:
    "9px 10px",

  backgroundColor:
    "#080B0E",

  color:
    "#FFFFFF",

  border:
    "1px solid #39424C",

  borderRadius:
    "8px",

  fontSize:
    "11px",
};


const moneyCellStyle = {
  color:
    "#FFFFFF",
};


const availableCellStyle = {
  color:
    "#FFFFFF",
};


// ============================================================
// EMPLOYEE SELECTOR
// ============================================================

const employeeSelectorStyle = {
  margin:
    "8px 0",

  padding:
    "9px",

  border:
    "1px solid #414A54",

  borderRadius:
    "8px",

  backgroundColor:
    "#0A0E12",
};


const employeeSelectorTitleStyle = {
  color:
    "#FFFFFF",

  fontSize:
    "11px",

  fontWeight:
    900,

  marginBottom:
    "5px",
};


const employeeDirectSelectStyle = {
  width:
    "100%",

  boxSizing:
    "border-box",

  minHeight:
    "38px",

  padding:
    "8px",

  border:
    "1px solid #4A535D",

  borderRadius:
    "7px",

  backgroundColor:
    "#080B0E",

  color:
    "#FFFFFF",

  fontSize:
    "12px",

  fontWeight:
    750,

  cursor:
    "pointer",
};


// ============================================================
// ACTIONS
// ============================================================

const reservedStyle = {
  marginBottom:
    "7px",

  padding:
    "7px 8px",

  backgroundColor:
    "#171C22",

  color:
    "#FFFFFF",

  border:
    "1px solid rgba(215,179,106,0.32)",

  borderRadius:
    "7px",

  fontSize:
    "11px",
};


const actionRowStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "72px minmax(0, 1fr) 110px",

  gap:
    "6px",

  alignItems:
    "center",

  marginTop:
    "6px",
};


const actionLabelStyle = {
  color:
    "#FFFFFF",

  fontSize:
    "11px",

  fontWeight:
    900,
};


const inputStyle = {
  width:
    "100%",

  boxSizing:
    "border-box",

  minHeight:
    "36px",

  padding:
    "8px",

  border:
    "1px solid #454E58",

  borderRadius:
    "7px",

  backgroundColor:
    "#080B0E",

  color:
    "#FFFFFF",

  fontSize:
    "12px",

  fontWeight:
    750,

  textAlign:
    "right",

  outline:
    "none",
};


const actionButtonStyle = {
  width:
    "100%",

  minHeight:
    "36px",

  padding:
    "8px",

  border:
    "1px solid rgba(215,179,106,0.40)",

  borderRadius:
    "7px",

  background:
    "linear-gradient(145deg, rgba(215,179,106,0.15), #11161C)",

  color:
    "#FFFFFF",

  cursor:
    "pointer",

  fontSize:
    "11px",

  fontWeight:
    900,
};


// ============================================================
// TOTALS
// ============================================================

const totalStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "repeat(3, 1fr)",

  gap:
    "9px",

  padding:
    "0 12px 12px",
};


const totalCardStyle = {
  padding:
    "11px",

  display:
    "grid",

  gap:
    "5px",

  background:
    "linear-gradient(145deg, rgba(215,179,106,0.10), #10151A)",

  border:
    "1px solid rgba(215,179,106,0.34)",

  borderRadius:
    "9px",

  textAlign:
    "center",

  color:
    "#FFFFFF",

  fontSize:
    "11px",

  fontWeight:
    800,
};


// ============================================================
// HISTORY
// ============================================================

const historyWrapStyle = {
  padding:
    "0 12px 12px",
};


const historyTitleStyle = {
  marginBottom:
    "7px",

  color:
    "#FFFFFF",

  fontSize:
    "12px",

  fontWeight:
    900,
};


const historyGridStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "repeat(auto-fit, minmax(240px, 1fr))",

  gap:
    "8px",
};


const emptyHistoryStyle = {
  padding:
    "11px",

  backgroundColor:
    "#0D1115",

  color:
    "#FFFFFF",

  border:
    "1px solid #343C45",

  borderRadius:
    "8px",

  fontSize:
    "11px",
};


const historyRowStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "1.1fr 0.8fr 0.7fr",

  gap:
    "6px",

  alignItems:
    "center",

  padding:
    "9px",

  backgroundColor:
    "#0D1115",

  border:
    "1px solid #303840",

  borderRadius:
    "8px",

  color:
    "#FFFFFF",

  fontSize:
    "11px",
};


const historyTimeStyle = {
  color:
    "#AAB2BC",

  marginTop:
    "2px",

  fontSize:
    "10px",
};


const historyAmountStyle = {
  textAlign:
    "right",

  color:
    "#FFFFFF",

  fontWeight:
    900,
};


// ============================================================
// STATUS
// ============================================================

const pendingStyle = {
  padding:
    "6px",

  borderRadius:
    "6px",

  backgroundColor:
    "#171C22",

  border:
    "1px solid #4A535D",

  color:
    "#FFFFFF",

  textAlign:
    "center",

  fontSize:
    "10px",

  fontWeight:
    900,
};


const processingStyle = {
  ...pendingStyle,
};


const confirmedStyle = {
  ...pendingStyle,

  border:
    "1px solid #2F6B47",
};


const rejectedStyle = {
  ...pendingStyle,

  border:
    "1px solid #79363C",
};


const noteStyle = {
  padding:
    "10px 12px 12px",

  color:
    "#AAB2BC",

  fontSize:
    "11px",

  lineHeight:
    1.45,

  borderTop:
    "1px solid #292F36",
};
