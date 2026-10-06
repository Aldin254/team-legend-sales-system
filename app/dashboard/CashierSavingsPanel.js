"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

// ============================================================
// TEAM LEGEND
// CASHIER SAVINGS / BANKING
//
// SHOP SAVINGS
// WIFI / DSTV / RENT / ELECTRICITY
//   Continue working exactly as before.
//
// EMPLOYEE BANKING
//   Cashier searches/selects employee.
//   Mobile/Relief employees appear first.
//   Normal employees display SHOP — EMPLOYEE.
//   Multiple employees per shop supported.
//
// BANKING OWNER
//   Selected employee.
//
// AUDIT ACTOR
//   Logged-in cashier.
//
// SAVE
//   Immediate.
//   Adds to selected employee Banking Savings.
//   Posts one expense to current shift.
//
// PAY
//   Creates pending Accountant request.
//   No second principal expense.
//
// WITHDRAW
//   Reduces selected employee Banking Savings.
//   Adds money to next M-Shwari Float slot.
//
// WEEKLY TARGET
//   Never displayed to cashier.
// ============================================================

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

  for (
    const category of
    CATEGORY_CONFIG
  ) {
    result[
      category.key
    ] = {
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
  const [
    categories,
    setCategories,
  ] = useState([]);

  const [
    paymentRequests,
    setPaymentRequests,
  ] = useState([]);

  const [
    bankingEmployees,
    setBankingEmployees,
  ] = useState([]);

  const [
    bankingSearch,
    setBankingSearch,
  ] = useState("");

  const [
    selectedBankingEmployeeId,
    setSelectedBankingEmployeeId,
  ] = useState("");

  const [
    inputs,
    setInputs,
  ] = useState(
    blankInputs()
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    actionKey,
    setActionKey,
  ] = useState("");

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    messageType,
    setMessageType,
  ] = useState("");

  // ============================================================
  // SUPABASE
  // ============================================================

  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env
      .NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const accessToken =
    user?.access_token ||
    null;

  const shiftId =
    currentShift?.id ||
    null;

  // ============================================================
  // LOAD SNAPSHOT + EMPLOYEE BANKING DIRECTORY
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
          setLoading(
            false
          );

          return;
        }

        try {
          if (!silent) {
            setLoading(
              true
            );
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
                  method:
                    "POST",

                  headers,

                  body:
                    JSON.stringify({
                      p_shift_id:
                        shiftId,
                    }),

                  cache:
                    "no-store",
                }
              ),

              fetch(
                `${supabaseUrl}/rest/v1/rpc/tl_cashier_banking_directory`,
                {
                  method:
                    "POST",

                  headers,

                  body:
                    JSON.stringify({
                      p_shift_id:
                        shiftId,
                    }),

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
              ? savingsResult
                  .categories
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
              ? bankingResult
                  .employees
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

          // Keep selected employee only if still active.
          setSelectedBankingEmployeeId(
            (
              previous
            ) => {
              if (
                !previous
              ) {
                return "";
              }

              const stillExists =
                loadedEmployees.some(
                  (
                    employee
                  ) =>
                    String(
                      employee.employee_id
                    ) ===
                    String(
                      previous
                    )
                );

              return stillExists
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
            setLoading(
              false
            );
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
  // AUTO REFRESH
  // ============================================================

  useEffect(() => {
    loadSavings();

    const timer =
      setInterval(
        () => {
          loadSavings(
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
    loadSavings,
  ]);

  // ============================================================
  // SELECTED BANKING EMPLOYEE
  // ============================================================

  const selectedBankingEmployee =
    useMemo(
      () => {
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
                employee.employee_id
              ) ===
              String(
                selectedBankingEmployeeId
              )
          ) ||
          null
        );
      },
      [
        bankingEmployees,
        selectedBankingEmployeeId,
      ]
    );

  // ============================================================
  // SEARCHABLE EMPLOYEE LIST
  // ============================================================

  const visibleBankingEmployees =
    useMemo(
      () => {
        const search =
          String(
            bankingSearch ||
              ""
          )
            .trim()
            .toLowerCase();

        const sorted =
          [
            ...bankingEmployees,
          ].sort(
            (
              a,
              b
            ) => {
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

              const shopA =
                String(
                  a?.shop_name ||
                    ""
                );

              const shopB =
                String(
                  b?.shop_name ||
                    ""
                );

              const shopCompare =
                shopA.localeCompare(
                  shopB
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

        if (
          !search
        ) {
          return sorted;
        }

        return sorted.filter(
          (
            employee
          ) => {
            const text =
              [
                employee
                  ?.employee_name,
                employee
                  ?.shop_name,
                employee
                  ?.display_label,
                employee
                  ?.role,
              ]
                .filter(
                  Boolean
                )
                .join(
                  " "
                )
                .toLowerCase();

            return text.includes(
              search
            );
          }
        );
      },
      [
        bankingEmployees,
        bankingSearch,
      ]
    );

  // ============================================================
  // ROW DATA
  // ============================================================

  const rows =
    useMemo(
      () => {
        return CATEGORY_CONFIG.map(
          (
            config
          ) => {
            // ------------------------------------------
            // BANKING comes from selected employee,
            // not logged-in cashier snapshot.
            // ------------------------------------------

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

                employeeName:
                  selectedBankingEmployee
                    ?.employee_name ||
                  "",

                employeeDisplay:
                  selectedBankingEmployee
                    ?.display_label ||
                  "",
              };
            }

            // ------------------------------------------
            // SHOP SAVINGS remain exactly as before.
            // ------------------------------------------

            const found =
              categories.find(
                (
                  row
                ) =>
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
                found
                  ?.obligation_amount ===
                  null ||
                found
                  ?.obligation_amount ===
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
      },
      [
        categories,
        selectedBankingEmployee,
      ]
    );

  // ============================================================
  // TOTALS
  // ============================================================

  const totals =
    useMemo(
      () => {
        let saved =
          0;

        let reserved =
          0;

        let available =
          0;

        for (
          const row of
          rows
        ) {
          saved +=
            Number(
              row.balance ||
                0
            );

          reserved +=
            Number(
              row.pendingPaymentAmount ||
                0
            );

          available +=
            Number(
              row.availableBalance ||
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
      },
      [
        rows,
      ]
    );

  // ============================================================
  // INPUT
  // ============================================================

  function setInput(
    category,
    field,
    value
  ) {
    setInputs(
      (
        previous
      ) => ({
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

    setMessage(
      ""
    );

    setMessageType(
      ""
    );
  }

  function clearInput(
    category,
    field
  ) {
    setInputs(
      (
        previous
      ) => ({
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

  // ============================================================
  // BANKING EMPLOYEE SEARCH
  // ============================================================

  function changeBankingSearch(
    value
  ) {
    setBankingSearch(
      value
    );

    // Prevent acting on an old employee while searching another.
    setSelectedBankingEmployeeId(
      ""
    );

    clearInput(
      "BANKING",
      "save"
    );

    clearInput(
      "BANKING",
      "pay"
    );

    clearInput(
      "BANKING",
      "withdraw"
    );

    setMessage(
      ""
    );

    setMessageType(
      ""
    );
  }

  function selectBankingEmployee(
    employeeId
  ) {
    setSelectedBankingEmployeeId(
      employeeId
    );

    const employee =
      bankingEmployees.find(
        (
          item
        ) =>
          String(
            item.employee_id
          ) ===
          String(
            employeeId
          )
      );

    if (
      employee
    ) {
      setBankingSearch(
        employee.display_label ||
          `${employee.shop_name || "MOBILE"} — ${employee.employee_name}`
      );
    }

    clearInput(
      "BANKING",
      "save"
    );

    clearInput(
      "BANKING",
      "pay"
    );

    clearInput(
      "BANKING",
      "withdraw"
    );

    setMessage(
      ""
    );

    setMessageType(
      ""
    );
  }

  // ============================================================
  // VALIDATE BANKING EMPLOYEE
  // ============================================================

  function requireBankingEmployee() {
    if (
      selectedBankingEmployee
    ) {
      return true;
    }

    setMessage(
      "Search and select an employee before using Banking."
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
      rawAmount ===
        "" ||
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
        ? `\nEmployee: ${selectedBankingEmployee.employee_name}\n${selectedBankingEmployee.display_label}`
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
      setActionKey(
        key
      );

      setMessage(
        ""
      );

      setMessageType(
        ""
      );

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
                selectedBankingEmployee.employee_id,

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

      if (
        !response.ok
      ) {
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
      setActionKey(
        ""
      );
    }
  }
  // ============================================================
  // PAY
  // ============================================================

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
      ]?.pay ||
        0
    );
  }

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
        ? `\nEmployee: ${selectedBankingEmployee.employee_name}\n${selectedBankingEmployee.display_label}`
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
      setActionKey(
        key
      );

      setMessage(
        ""
      );

      setMessageType(
        ""
      );

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
                selectedBankingEmployee.employee_id,

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

      if (
        !response.ok
      ) {
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
      setActionKey(
        ""
      );
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
      rawAmount ===
        "" ||
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
        ? `\nEmployee: ${selectedBankingEmployee.employee_name}\n${selectedBankingEmployee.display_label}`
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
      setActionKey(
        key
      );

      setMessage(
        ""
      );

      setMessageType(
        ""
      );

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
                selectedBankingEmployee.employee_id,

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

      if (
        !response.ok
      ) {
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
      setActionKey(
        ""
      );
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
        SAVE posts immediately to Savings and Expenses.
        PAY requires Accountant confirmation.
        For BANKING, search and select the employee first.
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
        <div
          style={
            loadingStyle
          }
        >
          Loading Savings...
        </div>
      ) : (
        <>
          <div
            style={
              headerStyle
            }
          >
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
            (
              row
            ) => {
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
                  <div
                    style={
                      balanceRowStyle
                    }
                  >
                    <div>
                      <strong>
                        {
                          row.label
                        }
                      </strong>

                      {row.fixedPayment && (
                        <div
                          style={
                            fixedTextStyle
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
                            variableTextStyle
                          }
                        >
                          Variable amount
                        </div>
                      )}

                      {isBanking && (
                        <div
                          style={
                            variableTextStyle
                          }
                        >
                          Employee Banking
                        </div>
                      )}
                    </div>

                    <div
                      style={
                        moneyCellStyle
                      }
                    >
                      KES{" "}
                      {money(
                        row.balance
                      )}
                    </div>

                    <div
                      style={
                        availableCellStyle
                      }
                    >
                      KES{" "}
                      {money(
                        row.availableBalance
                      )}
                    </div>
                  </div>

                  {/* ================================= */}
                  {/* BANKING EMPLOYEE SELECTOR */}
                  {/* ================================= */}

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

                      <div
                        style={
                          employeeSelectorHelpStyle
                        }
                      >
                        Search by employee name or shop name.
                        Mobile / Relief employees are listed first.
                      </div>

                      <input
                        type="text"
                        value={
                          bankingSearch
                        }
                        disabled={
                          anyBusy
                        }
                        placeholder="Search name or shop e.g. Nyika, Irene..."
                        onChange={(
                          event
                        ) =>
                          changeBankingSearch(
                            event
                              .target
                              .value
                          )
                        }
                        style={
                          employeeSearchStyle
                        }
                      />

                      <select
                        value={
                          selectedBankingEmployeeId
                        }
                        disabled={
                          anyBusy ||
                          visibleBankingEmployees.length ===
                            0
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
                          employeeSelectStyle
                        }
                      >
                        <option
                          value=""
                        >
                          {visibleBankingEmployees.length ===
                          0
                            ? "No employee found"
                            : "Choose employee"}
                        </option>

                        {visibleBankingEmployees.map(
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
                                ? "★ "
                                : ""}
                              {employee.display_label ||
                                `${employee.shop_name || "MOBILE"} — ${employee.employee_name}`}
                            </option>
                          )
                        )}
                      </select>

                      {selectedBankingEmployee ? (
                        <div
                          style={
                            selectedEmployeeStyle
                          }
                        >
                          <div>
                            <span
                              style={
                                selectedEmployeeLabelStyle
                              }
                            >
                              BANKING FOR
                            </span>

                            <strong>
                              {
                                selectedBankingEmployee.employee_name
                              }
                            </strong>
                          </div>

                          <div
                            style={
                              selectedEmployeeShopStyle
                            }
                          >
                            {selectedBankingEmployee.is_mobile
                              ? "★ MOBILE / RELIEF"
                              : selectedBankingEmployee.shop_name ||
                                "UNASSIGNED"}
                          </div>
                        </div>
                      ) : (
                        <div
                          style={
                            noEmployeeSelectedStyle
                          }
                        >
                          Select the employee whose Banking money you are handling.
                        </div>
                      )}
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
                      reserved for Accountant payment confirmation.
                    </div>
                  )}

                  {/* ================================= */}
                  {/* SAVE */}
                  {/* ================================= */}

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

                  {/* ================================= */}
                  {/* PAY */}
                  {/* ================================= */}

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

                  {/* ================================= */}
                  {/* WITHDRAW */}
                  {/* ================================= */}

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

          {/* ======================================= */}
          {/* TOTALS */}
          {/* ======================================= */}

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

          {selectedBankingEmployee && (
            <div
              style={
                bankingTotalNoticeStyle
              }
            >
              Totals currently include Banking for{" "}
              <strong>
                {
                  selectedBankingEmployee.employee_name
                }
              </strong>
              .
            </div>
          )}

          {/* ======================================= */}
          {/* PAYMENT REQUEST HISTORY */}
          {/* ======================================= */}

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
              paymentRequests
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
                )
            )}
          </div>

          <div
            style={
              noteStyle
            }
          >
            Saving reduces available shift money immediately because it
            is posted to Expenses. Paying later does not create a second
            expense. Employee Banking follows the selected employee even
            when that employee works at another shop.
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
      status ||
        ""
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
      "REJECTED" ||
    value ===
      "FAILED" ||
    value ===
      "CANCELLED"
  ) {
    style =
      rejectedStyle;
  } else if (
    value ===
    "PROCESSING"
  ) {
    style =
      processingStyle;
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
    value ||
      0
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
        Number(
          value
        ) +
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
  // PAY
  // ============================================================

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
      ]?.pay ||
        0
    );
  }

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
        ? `\nEmployee: ${selectedBankingEmployee.employee_name}\n${selectedBankingEmployee.display_label}`
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
      setActionKey(
        key
      );

      setMessage(
        ""
      );

      setMessageType(
        ""
      );

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
                selectedBankingEmployee.employee_id,

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

      if (
        !response.ok
      ) {
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
      setActionKey(
        ""
      );
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
      rawAmount ===
        "" ||
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
        ? `\nEmployee: ${selectedBankingEmployee.employee_name}\n${selectedBankingEmployee.display_label}`
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
      setActionKey(
        key
      );

      setMessage(
        ""
      );

      setMessageType(
        ""
      );

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
                selectedBankingEmployee.employee_id,

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

      if (
        !response.ok
      ) {
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
      setActionKey(
        ""
      );
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
        SAVE posts immediately to Savings and Expenses.
        PAY requires Accountant confirmation.
        For BANKING, search and select the employee first.
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
        <div
          style={
            loadingStyle
          }
        >
          Loading Savings...
        </div>
      ) : (
        <>
          <div
            style={
              headerStyle
            }
          >
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
            (
              row
            ) => {
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
                  <div
                    style={
                      balanceRowStyle
                    }
                  >
                    <div>
                      <strong>
                        {
                          row.label
                        }
                      </strong>

                      {row.fixedPayment && (
                        <div
                          style={
                            fixedTextStyle
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
                            variableTextStyle
                          }
                        >
                          Variable amount
                        </div>
                      )}

                      {isBanking && (
                        <div
                          style={
                            variableTextStyle
                          }
                        >
                          Employee Banking
                        </div>
                      )}
                    </div>

                    <div
                      style={
                        moneyCellStyle
                      }
                    >
                      KES{" "}
                      {money(
                        row.balance
                      )}
                    </div>

                    <div
                      style={
                        availableCellStyle
                      }
                    >
                      KES{" "}
                      {money(
                        row.availableBalance
                      )}
                    </div>
                  </div>

                  {/* ================================= */}
                  {/* BANKING EMPLOYEE SELECTOR */}
                  {/* ================================= */}

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

                      <div
                        style={
                          employeeSelectorHelpStyle
                        }
                      >
                        Search by employee name or shop name.
                        Mobile / Relief employees are listed first.
                      </div>

                      <input
                        type="text"
                        value={
                          bankingSearch
                        }
                        disabled={
                          anyBusy
                        }
                        placeholder="Search name or shop e.g. Nyika, Irene..."
                        onChange={(
                          event
                        ) =>
                          changeBankingSearch(
                            event
                              .target
                              .value
                          )
                        }
                        style={
                          employeeSearchStyle
                        }
                      />

                      <select
                        value={
                          selectedBankingEmployeeId
                        }
                        disabled={
                          anyBusy ||
                          visibleBankingEmployees.length ===
                            0
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
                          employeeSelectStyle
                        }
                      >
                        <option
                          value=""
                        >
                          {visibleBankingEmployees.length ===
                          0
                            ? "No employee found"
                            : "Choose employee"}
                        </option>

                        {visibleBankingEmployees.map(
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
                                ? "★ "
                                : ""}
                              {employee.display_label ||
                                `${employee.shop_name || "MOBILE"} — ${employee.employee_name}`}
                            </option>
                          )
                        )}
                      </select>

                      {selectedBankingEmployee ? (
                        <div
                          style={
                            selectedEmployeeStyle
                          }
                        >
                          <div>
                            <span
                              style={
                                selectedEmployeeLabelStyle
                              }
                            >
                              BANKING FOR
                            </span>

                            <strong>
                              {
                                selectedBankingEmployee.employee_name
                              }
                            </strong>
                          </div>

                          <div
                            style={
                              selectedEmployeeShopStyle
                            }
                          >
                            {selectedBankingEmployee.is_mobile
                              ? "★ MOBILE / RELIEF"
                              : selectedBankingEmployee.shop_name ||
                                "UNASSIGNED"}
                          </div>
                        </div>
                      ) : (
                        <div
                          style={
                            noEmployeeSelectedStyle
                          }
                        >
                          Select the employee whose Banking money you are handling.
                        </div>
                      )}
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
                      reserved for Accountant payment confirmation.
                    </div>
                  )}

                  {/* ================================= */}
                  {/* SAVE */}
                  {/* ================================= */}

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

                  {/* ================================= */}
                  {/* PAY */}
                  {/* ================================= */}

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

                  {/* ================================= */}
                  {/* WITHDRAW */}
                  {/* ================================= */}

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

          {/* ======================================= */}
          {/* TOTALS */}
          {/* ======================================= */}

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

          {selectedBankingEmployee && (
            <div
              style={
                bankingTotalNoticeStyle
              }
            >
              Totals currently include Banking for{" "}
              <strong>
                {
                  selectedBankingEmployee.employee_name
                }
              </strong>
              .
            </div>
          )}

          {/* ======================================= */}
          {/* PAYMENT REQUEST HISTORY */}
          {/* ======================================= */}

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
              paymentRequests
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
                )
            )}
          </div>

          <div
            style={
              noteStyle
            }
          >
            Saving reduces available shift money immediately because it
            is posted to Expenses. Paying later does not create a second
            expense. Employee Banking follows the selected employee even
            when that employee works at another shop.
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
      status ||
        ""
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
      "REJECTED" ||
    value ===
      "FAILED" ||
    value ===
      "CANCELLED"
  ) {
    style =
      rejectedStyle;
  } else if (
    value ===
    "PROCESSING"
  ) {
    style =
      processingStyle;
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
    value ||
      0
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
        Number(
          value
        ) +
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
