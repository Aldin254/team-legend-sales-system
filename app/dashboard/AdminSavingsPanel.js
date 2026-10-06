"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

const REFRESH_MS = 5000;

export default function AdminSavingsPanel({
  user,
}) {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const accessToken =
    user?.access_token ||
    null;

  const [loading, setLoading] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  // ==================================================
  // SAVINGS
  // ==================================================

  const [summary, setSummary] =
    useState({
      pending_count: 0,
      pending_amount: 0,
      confirmed_count: 0,
      confirmed_amount: 0,
      rejected_count: 0,
    });

  const [balances, setBalances] =
    useState([]);

  const [payments, setPayments] =
    useState([]);

  const [ledger, setLedger] =
    useState([]);

  // ==================================================
  // BANKING
  // ==================================================

  const [
    bankingSummary,
    setBankingSummary,
  ] = useState({
    current_week_target: 0,
    current_week_paid: 0,
    current_week_remaining: 0,
    missed_weeks: 0,
  });

  const [
    currentWeekStart,
    setCurrentWeekStart,
  ] = useState("");

  const [
    bankingTargets,
    setBankingTargets,
  ] = useState([]);

  const [
    availableEmployees,
    setAvailableEmployees,
  ] = useState([]);

  const [
    selectedBankingEmployeeId,
    setSelectedBankingEmployeeId,
  ] = useState("");

  const [
    addingBankingEmployee,
    setAddingBankingEmployee,
  ] = useState(false);

  const [
    bankingWeeks,
    setBankingWeeks,
  ] = useState([]);

  const [
    targetHistory,
    setTargetHistory,
  ] = useState([]);

  const [
    targetForms,
    setTargetForms,
  ] = useState({});

  const [
    closeReasons,
    setCloseReasons,
  ] = useState({});

  const [
    savingTargetId,
    setSavingTargetId,
  ] = useState(null);

  const [
    closingWeekKey,
    setClosingWeekKey,
  ] = useState(null);

  // ==================================================
  // FILTERS
  // ==================================================

  const [
    shopFilter,
    setShopFilter,
  ] = useState("ALL");

  const [
    categoryFilter,
    setCategoryFilter,
  ] = useState("ALL");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("ALL");

  const [
    bankingStatusFilter,
    setBankingStatusFilter,
  ] = useState("ALL");

  // ==================================================
  // HEADERS
  // ==================================================

  const authHeaders =
    useCallback(
      () => ({
        apikey:
          supabaseAnonKey,

        Authorization:
          `Bearer ${accessToken}`,

        "Content-Type":
          "application/json",
      }),
      [
        supabaseAnonKey,
        accessToken,
      ]
    );

  // ==================================================
  // RPC
  // ==================================================

  const callRpc =
    useCallback(
      async (
        functionName,
        body = {}
      ) => {
        if (
          !supabaseUrl ||
          !supabaseAnonKey ||
          !accessToken
        ) {
          throw new Error(
            "Admin session is incomplete."
          );
        }

        const response =
          await fetch(
            `${supabaseUrl}/rest/v1/rpc/${functionName}`,
            {
              method:
                "POST",

              headers:
                authHeaders(),

              body:
                JSON.stringify(
                  body
                ),

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
              `Unable to run ${functionName}.`
          );
        }

        return result;
      },
      [
        supabaseUrl,
        supabaseAnonKey,
        accessToken,
        authHeaders,
      ]
    );

  // ==================================================
  // LOAD ALL
  // ==================================================

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
          setLoading(
            false
          );

          return;
        }

        try {
          if (!silent) {
            setRefreshing(
              true
            );
          }

          setError("");

          const [
            savingsResult,
            bankingResult,
          ] =
            await Promise.all([
              callRpc(
                "tl_admin_savings_activity_snapshot",
                {
                  p_limit:
                    200,
                }
              ),

              callRpc(
                "tl_admin_banking_weekly_snapshot",
                {
                  p_weeks_back:
                    12,
                }
              ),
            ]);

          // ========================================
          // SAVINGS
          // ========================================

          setSummary({
            pending_count:
              Number(
                savingsResult
                  ?.summary
                  ?.pending_count ||
                  0
              ),

            pending_amount:
              Number(
                savingsResult
                  ?.summary
                  ?.pending_amount ||
                  0
              ),

            confirmed_count:
              Number(
                savingsResult
                  ?.summary
                  ?.confirmed_count ||
                  0
              ),

            confirmed_amount:
              Number(
                savingsResult
                  ?.summary
                  ?.confirmed_amount ||
                  0
              ),

            rejected_count:
              Number(
                savingsResult
                  ?.summary
                  ?.rejected_count ||
                  0
              ),
          });

          setBalances(
            Array.isArray(
              savingsResult
                ?.balances
            )
              ? savingsResult
                  .balances
              : []
          );

          setPayments(
            Array.isArray(
              savingsResult
                ?.payments
            )
              ? savingsResult
                  .payments
              : []
          );

          setLedger(
            Array.isArray(
              savingsResult
                ?.ledger
            )
              ? savingsResult
                  .ledger
              : []
          );

          // ========================================
          // BANKING
          // ========================================

          setCurrentWeekStart(
            bankingResult
              ?.current_week_start ||
              ""
          );

          setBankingSummary({
            current_week_target:
              Number(
                bankingResult
                  ?.summary
                  ?.current_week_target ||
                  0
              ),

            current_week_paid:
              Number(
                bankingResult
                  ?.summary
                  ?.current_week_paid ||
                  0
              ),

            current_week_remaining:
              Number(
                bankingResult
                  ?.summary
                  ?.current_week_remaining ||
                  0
              ),

            missed_weeks:
              Number(
                bankingResult
                  ?.summary
                  ?.missed_weeks ||
                  0
              ),
          });

          const loadedTargets =
            Array.isArray(
              bankingResult
                ?.targets
            )
              ? bankingResult
                  .targets
              : [];

          const loadedAvailableEmployees =
            Array.isArray(
              bankingResult
                ?.available_employees
            )
              ? bankingResult
                  .available_employees
              : [];

          setBankingTargets(
            loadedTargets
          );

          setAvailableEmployees(
            loadedAvailableEmployees
          );

          setSelectedBankingEmployeeId(
            (
              previous
            ) => {
              const stillAvailable =
                loadedAvailableEmployees.some(
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

              if (
                previous &&
                stillAvailable
              ) {
                return previous;
              }

              return "";
            }
          );

          setBankingWeeks(
            Array.isArray(
              bankingResult
                ?.weeks
            )
              ? bankingResult
                  .weeks
              : []
          );

          setTargetHistory(
            Array.isArray(
              bankingResult
                ?.target_history
            )
              ? bankingResult
                  .target_history
              : []
          );

          // Keep anything Admin is currently typing.
          setTargetForms(
            (
              previous
            ) => {
              const next = {
                ...previous,
              };

              for (
                const employee
                of loadedTargets
              ) {
                const existing =
                  next[
                    employee
                      .employee_id
                  ];

                if (
                  !existing ||
                  existing.dirty !==
                    true
                ) {
                  next[
                    employee
                      .employee_id
                  ] = {
                    amount:
                      String(
                        employee
                          .weekly_target ??
                          0
                      ),

                    reason:
                      "",

                    dirty:
                      false,
                  };
                }
              }

              return next;
            }
          );
        } catch (err) {
          console.error(
            "ADMIN SAVINGS / BANKING ERROR:",
            err
          );

          setError(
            err?.message ||
              "Unable to load Savings / Banking control."
          );
        } finally {
          setLoading(
            false
          );

          if (!silent) {
            setRefreshing(
              false
            );
          }
        }
      },
      [
        supabaseUrl,
        supabaseAnonKey,
        accessToken,
        callRpc,
      ]
    );

  // ==================================================
  // INITIAL + LIVE REFRESH
  // ==================================================

  useEffect(() => {
    loadData();

    const timer =
      setInterval(
        () => {
          loadData(
            true
          );
        },
        REFRESH_MS
      );

    return () => {
      clearInterval(
        timer
      );
    };
  }, [
    loadData,
  ]);

  // ==================================================
  // SHOP OPTIONS
  // ==================================================

  const shopOptions =
    useMemo(
      () => {
        const map =
          new Map();

        for (
          const item of [
            ...balances,
            ...payments,
            ...ledger,
          ]
        ) {
          if (
            item?.shop_id &&
            item?.shop_name
          ) {
            map.set(
              item.shop_id,
              item.shop_name
            );
          }
        }

        return [
          ...map.entries(),
        ].sort(
          (
            a,
            b
          ) =>
            String(
              a[1]
            ).localeCompare(
              String(
                b[1]
              )
            )
        );
      },
      [
        balances,
        payments,
        ledger,
      ]
    );

  // ==================================================
  // FILTERED SAVINGS
  // ==================================================

  const filteredBalances =
    useMemo(
      () =>
        balances.filter(
          (
            item
          ) => {
            if (
              shopFilter !==
                "ALL" &&
              String(
                item.shop_id
              ) !==
                String(
                  shopFilter
                )
            ) {
              return false;
            }

            if (
              categoryFilter !==
                "ALL" &&
              item.category !==
                categoryFilter
            ) {
              return false;
            }

            return true;
          }
        ),
      [
        balances,
        shopFilter,
        categoryFilter,
      ]
    );

  const filteredPayments =
    useMemo(
      () =>
        payments.filter(
          (
            item
          ) => {
            if (
              shopFilter !==
                "ALL" &&
              String(
                item.shop_id
              ) !==
                String(
                  shopFilter
                )
            ) {
              return false;
            }

            if (
              categoryFilter !==
                "ALL" &&
              item.category !==
                categoryFilter
            ) {
              return false;
            }

            if (
              statusFilter !==
                "ALL" &&
              item.status !==
                statusFilter
            ) {
              return false;
            }

            return true;
          }
        ),
      [
        payments,
        shopFilter,
        categoryFilter,
        statusFilter,
      ]
    );

  const filteredLedger =
    useMemo(
      () =>
        ledger.filter(
          (
            item
          ) => {
            if (
              shopFilter !==
                "ALL" &&
              String(
                item.shop_id
              ) !==
                String(
                  shopFilter
                )
            ) {
              return false;
            }

            if (
              categoryFilter !==
                "ALL" &&
              item.category !==
                categoryFilter
            ) {
              return false;
            }

            return true;
          }
        ),
      [
        ledger,
        shopFilter,
        categoryFilter,
      ]
    );

  // ==================================================
  // FILTERED BANKING WEEKS
  // ==================================================

  const filteredBankingWeeks =
    useMemo(
      () =>
        bankingWeeks.filter(
          (
            item
          ) => {
            if (
              bankingStatusFilter ===
              "ALL"
            ) {
              return true;
            }

            return (
              String(
                item.display_status ||
                  item.status ||
                  ""
              ).toUpperCase() ===
              bankingStatusFilter
            );
          }
        ),
      [
        bankingWeeks,
        bankingStatusFilter,
      ]
    );

  // ==================================================
  // TOTAL SAVINGS
  // ==================================================

  const totalCurrentSavings =
    useMemo(
      () =>
        balances.reduce(
          (
            total,
            item
          ) =>
            total +
            Number(
              item.current_balance ||
                0
            ),
          0
        ),
      [
        balances,
      ]
    );

  // ==================================================
  // UPDATE TARGET FORM
  // ==================================================

  function updateTargetForm(
    employeeId,
    field,
    value
  ) {
    setTargetForms(
      (
        previous
      ) => ({
        ...previous,

        [employeeId]: {
          ...(
            previous[
              employeeId
            ] ||
            {}
          ),

          [field]:
            value,

          dirty:
            true,
        },
      })
    );

    setError("");
    setSuccess("");
  }
  // ==================================================
  // ADD EMPLOYEE TO BANKING
  // ==================================================

  async function addBankingEmployee() {
    if (
      addingBankingEmployee ||
      !selectedBankingEmployeeId
    ) {
      return;
    }

    const employee =
      availableEmployees.find(
        (
          item
        ) =>
          String(
            item.employee_id
          ) ===
          String(
            selectedBankingEmployeeId
          )
      );

    if (!employee) {
      setError(
        "Select an employee first."
      );

      return;
    }

    const confirmed =
      window.confirm(
        "ADD EMPLOYEE TO BANKING\n\n" +
          `Employee: ${employee.employee_name}\n` +
          `Role: ${employee.role || "-"}\n\n` +
          "Banking will follow this employee even when they work at different shops."
      );

    if (!confirmed) {
      return;
    }

    try {
      setAddingBankingEmployee(
        true
      );

      setError("");
      setSuccess("");

      await callRpc(
        "tl_admin_add_banking_employee",
        {
          p_employee_id:
            employee.employee_id,
        }
      );

      setSuccess(
        `${employee.employee_name} was added to Employee Banking.`
      );

      setSelectedBankingEmployeeId(
        ""
      );

      await loadData(
        true
      );
    } catch (err) {
      console.error(
        "ADD BANKING EMPLOYEE ERROR:",
        err
      );

      setError(
        err?.message ||
          "Unable to add employee to Banking."
      );
    } finally {
      setAddingBankingEmployee(
        false
      );
    }
  }

  // ==================================================
  // SAVE WEEKLY TARGET
  // ==================================================

  async function saveBankingTarget(
    employee
  ) {
    if (
      savingTargetId
    ) {
      return;
    }

    const form =
      targetForms[
        employee.employee_id
      ] ||
      {};

    const amount =
      Number(
        form.amount
      );

    const oldAmount =
      Number(
        employee.weekly_target ||
          0
      );

    const reason =
      String(
        form.reason ||
          ""
      ).trim();

    if (
      !Number.isFinite(
        amount
      ) ||
      amount < 0
    ) {
      setError(
        "Enter a valid weekly Banking target."
      );

      return;
    }

    if (
      roundMoney(
        amount
      ) ===
      roundMoney(
        oldAmount
      )
    ) {
      setError(
        `The Banking target for ${employee.employee_name} has not changed.`
      );

      return;
    }

    if (
      reason.length <
      3
    ) {
      setError(
        `Enter a reason for changing ${employee.employee_name}'s weekly Banking target.`
      );

      return;
    }

    const confirmed =
      window.confirm(
        "CHANGE WEEKLY BANKING TARGET\n\n" +
          `Employee: ${employee.employee_name}\n` +
          `Current Target: KES ${money(
            oldAmount
          )}\n` +
          `New Target: KES ${money(
            amount
          )}\n` +
          `Reason: ${reason}\n\n` +
          "This changes the Banking target only. No money will move."
      );

    if (!confirmed) {
      return;
    }

    try {
      setSavingTargetId(
        employee.employee_id
      );

      setError("");
      setSuccess("");

      await callRpc(
        "tl_admin_set_employee_banking_target",
        {
          p_employee_id:
            employee.employee_id,

          p_target_amount:
            roundMoney(
              amount
            ),

          p_reason:
            reason,
        }
      );

      setTargetForms(
        (
          previous
        ) => ({
          ...previous,

          [employee.employee_id]:
            {
              amount:
                String(
                  roundMoney(
                    amount
                  )
                ),

              reason:
                "",

              dirty:
                false,
            },
        })
      );

      setSuccess(
        `${employee.employee_name}'s weekly Banking target is now KES ${money(
          amount
        )}.`
      );

      await loadData(
        true
      );
    } catch (err) {
      console.error(
        "SAVE BANKING TARGET ERROR:",
        err
      );

      setError(
        err?.message ||
          "Unable to save Banking target."
      );
    } finally {
      setSavingTargetId(
        null
      );
    }
  }

  // ==================================================
  // CLOSE MISSED WEEK
  // ==================================================

  async function closeBankingWeek(
    week
  ) {
    const key =
      bankingWeekKey(
        week
      );

    if (
      closingWeekKey
    ) {
      return;
    }

    const reason =
      String(
        closeReasons[
          key
        ] ||
          ""
      ).trim();

    if (
      reason.length <
      3
    ) {
      setError(
        `Enter a reason for closing ${week.employee_name}'s missed Banking week.`
      );

      return;
    }

    const confirmed =
      window.confirm(
        "CLOSE MISSED BANKING WEEK\n\n" +
          `Employee: ${week.employee_name}\n` +
          `Week: ${week.week_start} to ${week.week_end}\n` +
          `Target: KES ${money(
            week.target_amount
          )}\n` +
          `Actually Banked: KES ${money(
            week.confirmed_paid_amount
          )}\n` +
          `Remaining: KES ${money(
            week.remaining_amount
          )}\n` +
          `Reason: ${reason}\n\n` +
          "This closes the weekly obligation only. " +
          "Savings, Expenses, Float and balances will NOT change."
      );

    if (!confirmed) {
      return;
    }

    try {
      setClosingWeekKey(
        key
      );

      setError("");
      setSuccess("");

      await callRpc(
        "tl_admin_close_banking_week",
        {
          p_employee_id:
            week.employee_id,

          p_week_start:
            week.week_start,

          p_reason:
            reason,
        }
      );

      setCloseReasons(
        (
          previous
        ) => ({
          ...previous,

          [key]:
            "",
        })
      );

      setSuccess(
        `${week.employee_name}'s Banking week ${week.week_start} was administratively closed. No money was moved.`
      );

      await loadData(
        true
      );
    } catch (err) {
      console.error(
        "CLOSE BANKING WEEK ERROR:",
        err
      );

      setError(
        err?.message ||
          "Unable to close Banking week."
      );
    } finally {
      setClosingWeekKey(
        null
      );
    }
  }

  // ==================================================
  // LOADING
  // ==================================================

  if (
    loading
  ) {
    return (
      <div
        style={
          loadingStyle
        }
      >
        Loading Savings / Banking control...
      </div>
    );
  }

  // ==================================================
  // DISPLAY
  // ==================================================

  return (
    <section
      style={
        wrapperStyle
      }
    >
      {/* =========================================== */}
      {/* HEADER */}
      {/* =========================================== */}

      <div
        style={
          headerStyle
        }
      >
        <div>
          <div
            style={
              titleStyle
            }
          >
            SAVINGS / BANKING CONTROL
          </div>

          <div
            style={
              subtitleStyle
            }
          >
            Live Savings balances, payments, employee Banking targets and permanent audit trail.
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            loadData()
          }
          disabled={
            refreshing
          }
          style={
            refreshButtonStyle
          }
        >
          {refreshing
            ? "Refreshing..."
            : "Refresh"}
        </button>
      </div>

      {/* =========================================== */}
      {/* MESSAGES */}
      {/* =========================================== */}

      {error && (
        <div
          style={
            errorStyle
          }
        >
          {error}
        </div>
      )}

      {success && (
        <div
          style={
            successStyle
          }
        >
          {success}
        </div>
      )}

      {/* =========================================== */}
      {/* SAVINGS SUMMARY */}
      {/* =========================================== */}

      <div
        style={
          summaryGridStyle
        }
      >
        <SummaryCard
          label="TOTAL SAVED"
          value={`KES ${money(
            totalCurrentSavings
          )}`}
        />

        <SummaryCard
          label="PENDING PAYMENTS"
          value={
            summary
              .pending_count
          }
          sub={`KES ${money(
            summary
              .pending_amount
          )}`}
          warning
        />

        <SummaryCard
          label="CONFIRMED PAYMENTS"
          value={
            summary
              .confirmed_count
          }
          sub={`KES ${money(
            summary
              .confirmed_amount
          )}`}
          success
        />

        <SummaryCard
          label="REJECTED / FAILED"
          value={
            summary
              .rejected_count
          }
          danger
        />
      </div>

      {/* =========================================== */}
      {/* BANKING WEEK SUMMARY */}
      {/* =========================================== */}

      <div
        style={
          bankingSummaryPanelStyle
        }
      >
        <div
          style={
            bankingSummaryHeaderStyle
          }
        >
          <div>
            EMPLOYEE WEEKLY BANKING
          </div>

          <small>
            Current week starts{" "}
            {formatDate(
              currentWeekStart
            )}
          </small>
        </div>

        <div
          style={
            summaryGridStyle
          }
        >
          <SummaryCard
            label="CURRENT WEEK TARGET"
            value={`KES ${money(
              bankingSummary
                .current_week_target
            )}`}
          />

          <SummaryCard
            label="CONFIRMED BANKED"
            value={`KES ${money(
              bankingSummary
                .current_week_paid
            )}`}
            success
          />

          <SummaryCard
            label="REMAINING THIS WEEK"
            value={`KES ${money(
              bankingSummary
                .current_week_remaining
            )}`}
            warning
          />

          <SummaryCard
            label="MISSED / PARTIAL PAST WEEKS"
            value={
              bankingSummary
                .missed_weeks
            }
            danger={
              bankingSummary
                .missed_weeks >
              0
            }
          />
        </div>
      </div>

      {/* =========================================== */}
      {/* EMPLOYEE TARGET MANAGEMENT */}
      {/* =========================================== */}

      <div
        style={
          bankingPanelStyle
        }
      >
        <div
          style={
            bankingTitleStyle
          }
        >
          EMPLOYEE WEEKLY BANKING TARGETS
        </div>

        <div
          style={
            bankingRuleStyle
          }
        >
          Banking belongs to the employee, not the shop. Relief and mobile cashiers keep the same Banking balance and weekly target when working at different shops.
        </div>

        {/* ADD EMPLOYEE */}

        <div
          style={
            addEmployeePanelStyle
          }
        >
          <div>
            <label
              style={
                labelStyle
              }
            >
              ADD EMPLOYEE TO BANKING
            </label>

            <select
              value={
                selectedBankingEmployeeId
              }
              onChange={(
                event
              ) =>
                setSelectedBankingEmployeeId(
                  event.target.value
                )
              }
              disabled={
                addingBankingEmployee ||
                availableEmployees.length ===
                  0
              }
              style={
                inputStyle
              }
            >
              <option
                value=""
              >
                {availableEmployees.length ===
                0
                  ? "No employees available to add"
                  : "Select employee"}
              </option>

              {availableEmployees.map(
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
                    {employee.employee_name}
                    {employee.role
                      ? ` (${employee.role})`
                      : ""}
                  </option>
                )
              )}
            </select>
          </div>

          <button
            type="button"
            onClick={
              addBankingEmployee
            }
            disabled={
              addingBankingEmployee ||
              !selectedBankingEmployeeId
            }
            style={{
              ...addEmployeeButtonStyle,

              opacity:
                addingBankingEmployee ||
                !selectedBankingEmployeeId
                  ? 0.6
                  : 1,
            }}
          >
            {addingBankingEmployee
              ? "Adding..."
              : "Add Employee"}
          </button>
        </div>

        {bankingTargets.length ===
        0 ? (
          <div
            style={
              emptyStyle
            }
          >
            No employees have been added to Banking yet.
          </div>
        ) : (
          <div
            style={
              targetListStyle
            }
          >
            {bankingTargets.map(
              (
                employee
              ) => {
                const form =
                  targetForms[
                    employee
                      .employee_id
                  ] ||
                  {
                    amount:
                      String(
                        employee
                          .weekly_target ||
                          0
                      ),

                    reason:
                      "",
                  };

                const busy =
                  savingTargetId ===
                  employee
                    .employee_id;

                return (
                  <div
                    key={
                      employee
                        .employee_id
                    }
                    style={
                      targetRowStyle
                    }
                  >
                    <div>
                      <div
                        style={
                          employeeNameStyle
                        }
                      >
                        {
                          employee
                            .employee_name
                        }
                      </div>

                      <div
                        style={
                          employeeMetaStyle
                        }
                      >
                        Current target: KES{" "}
                        {money(
                          employee
                            .weekly_target
                        )}

                        {employee.role &&
                          ` • ${employee.role}`}

                        {!employee.is_active &&
                          " • INACTIVE"}
                      </div>
                    </div>

                    <div>
                      <label
                        style={
                          labelStyle
                        }
                      >
                        NEW WEEKLY TARGET
                      </label>

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          form.amount ??
                          ""
                        }
                        disabled={
                          busy
                        }
                        onChange={(
                          event
                        ) =>
                          updateTargetForm(
                            employee
                              .employee_id,
                            "amount",
                            event
                              .target
                              .value
                          )
                        }
                        style={
                          inputStyle
                        }
                      />
                    </div>

                    <div>
                      <label
                        style={
                          labelStyle
                        }
                      >
                        CHANGE REASON
                      </label>

                      <input
                        type="text"
                        value={
                          form.reason ||
                          ""
                        }
                        disabled={
                          busy
                        }
                        onChange={(
                          event
                        ) =>
                          updateTargetForm(
                            employee
                              .employee_id,
                            "reason",
                            event
                              .target
                              .value
                          )
                        }
                        placeholder="Example: Weekly target increased"
                        style={
                          inputStyle
                        }
                      />
                    </div>

                    <button
                      type="button"
                      disabled={
                        busy
                      }
                      onClick={() =>
                        saveBankingTarget(
                          employee
                        )
                      }
                      style={{
                        ...saveTargetButtonStyle,

                        opacity:
                          busy
                            ? 0.6
                            : 1,
                      }}
                    >
                      {busy
                        ? "Saving..."
                        : "Save Target"}
                    </button>
                  </div>
                );
              }
            )}
          </div>
        )}

        <div
          style={
            bankingPrivacyStyle
          }
        >
          Weekly Banking targets are Admin controls. The cashier Savings screen shows only the employee's saved and available Banking money, not the target.
        </div>
      </div>

      {/* =========================================== */}
      {/* WEEKLY BANKING HISTORY */}
      {/* =========================================== */}

      <div
        style={
          bankingPanelStyle
        }
      >
        <div
          style={
            bankingTitleRowStyle
          }
        >
          <div
            style={
              bankingTitleStyleNoBg
            }
          >
            WEEKLY BANKING STATUS
          </div>

          <select
            value={
              bankingStatusFilter
            }
            onChange={(
              event
            ) =>
              setBankingStatusFilter(
                event.target.value
              )
            }
            style={
              smallSelectStyle
            }
          >
            <option value="ALL">
              All Statuses
            </option>

            <option value="OPEN">
              Open
            </option>

            <option value="PARTIAL">
              Partial
            </option>

            <option value="TARGET_MET">
              Target Met
            </option>

            <option value="ABOVE_TARGET">
              Above Target
            </option>

            <option value="MISSED">
              Missed
            </option>

            <option value="ADMIN_CLOSED">
              Admin Closed
            </option>
          </select>
        </div>

        {filteredBankingWeeks.length ===
        0 ? (
          <div
            style={
              emptyStyle
            }
          >
            No Banking weeks match this filter.
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
                  "1200px",
              }}
            >
              <thead>
                <tr>
                  <TableHead>
                    Employee
                  </TableHead>

                  <TableHead>
                    Week
                  </TableHead>

                  <TableHead right>
                    Target
                  </TableHead>

                  <TableHead right>
                    Confirmed
                  </TableHead>

                  <TableHead right>
                    Remaining
                  </TableHead>

                  <TableHead>
                    Status
                  </TableHead>

                  <TableHead>
                    Admin Close Reason
                  </TableHead>

                  <TableHead>
                    Action
                  </TableHead>
                </tr>
              </thead>

              <tbody>
                {filteredBankingWeeks.map(
                  (
                    week
                  ) => {
                    const key =
                      bankingWeekKey(
                        week
                      );

                    const status =
                      String(
                        week.display_status ||
                          week.status ||
                          ""
                      ).toUpperCase();

                    const mayClose =
                      Boolean(
                        week.is_missed
                      ) &&
                      status !==
                        "ADMIN_CLOSED";

                    const busy =
                      closingWeekKey ===
                      key;

                    return (
                      <tr
                        key={
                          key
                        }
                      >
                        <TableCell>
                          <strong>
                            {
                              week.employee_name
                            }
                          </strong>
                        </TableCell>

                        <TableCell>
                          {formatDate(
                            week.week_start
                          )}
                          {" → "}
                          {formatDate(
                            week.week_end
                          )}

                          {week.is_current_week && (
                            <div
                              style={
                                currentWeekTextStyle
                              }
                            >
                              CURRENT WEEK
                            </div>
                          )}
                        </TableCell>

                        <TableCell
                          right
                        >
                          KES{" "}
                          {money(
                            week.target_amount
                          )}
                        </TableCell>

                        <TableCell
                          right
                        >
                          KES{" "}
                          {money(
                            week.confirmed_paid_amount
                          )}
                        </TableCell>

                        <TableCell
                          right
                        >
                          KES{" "}
                          {money(
                            week.remaining_amount
                          )}
                        </TableCell>

                        <TableCell>
                          <BankingStatusBadge
                            status={
                              status
                            }
                          />
                        </TableCell>

                        <TableCell>
                          {status ===
                          "ADMIN_CLOSED" ? (
                            <div>
                              {
                                week.admin_close_reason ||
                                "-"
                              }

                              <div
                                style={
                                  smallMutedStyle
                                }
                              >
                                {formatDateTime(
                                  week.closed_at
                                )}
                              </div>
                            </div>
                          ) : mayClose ? (
                            <input
                              type="text"
                              value={
                                closeReasons[
                                  key
                                ] ||
                                ""
                              }
                              disabled={
                                busy
                              }
                              onChange={(
                                event
                              ) =>
                                setCloseReasons(
                                  (
                                    previous
                                  ) => ({
                                    ...previous,

                                    [key]:
                                      event
                                        .target
                                        .value,
                                  })
                                )
                              }
                              placeholder="Reason, e.g. insufficient money"
                              style={
                                inputStyle
                              }
                            />
                          ) : (
                            "-"
                          )}
                        </TableCell>

                        <TableCell>
                          {mayClose ? (
                            <button
                              type="button"
                              disabled={
                                busy
                              }
                              onClick={() =>
                                closeBankingWeek(
                                  week
                                )
                              }
                              style={{
                                ...closeWeekButtonStyle,

                                opacity:
                                  busy
                                    ? 0.6
                                    : 1,
                              }}
                            >
                              {busy
                                ? "Closing..."
                                : "Close Week"}
                            </button>
                          ) : (
                            <span
                              style={
                                smallMutedStyle
                              }
                            >
                              No action
                            </span>
                          )}
                        </TableCell>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        )}

        <div
          style={
            bankingCloseNoticeStyle
          }
        >
          Closing a missed Banking week is administrative only. It never changes Savings, Expenses, Added Float or Closing Balance.
        </div>
      </div>

      {/* =========================================== */}
      {/* BANKING TARGET HISTORY */}
      {/* =========================================== */}

      <div
        style={
          panelStyle
        }
      >
        <div
          style={
            historyTitleStyle
          }
        >
          BANKING TARGET CHANGE HISTORY
        </div>

        {targetHistory.length ===
        0 ? (
          <div
            style={
              emptyStyle
            }
          >
            No Banking target changes recorded yet.
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
                    Date / Time
                  </TableHead>

                  <TableHead>
                    Employee
                  </TableHead>

                  <TableHead right>
                    Weekly Target
                  </TableHead>

                  <TableHead>
                    Reason
                  </TableHead>
                </tr>
              </thead>

              <tbody>
                {targetHistory
                  .slice(
                    0,
                    100
                  )
                  .map(
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
                            item.effective_at
                          )}
                        </TableCell>

                        <TableCell>
                          {
                            item.employee_name
                          }
                        </TableCell>

                        <TableCell
                          right
                        >
                          KES{" "}
                          {money(
                            item.target_amount
                          )}
                        </TableCell>

                        <TableCell>
                          {item.reason ||
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
{/* =========================================== */}
      {/* SAVINGS FILTERS */}
      {/* =========================================== */}

      <div
        style={
          filterPanelStyle
        }
      >
        <div>
          <label
            style={
              labelStyle
            }
          >
            SHOP
          </label>

          <select
            value={
              shopFilter
            }
            onChange={(
              event
            ) =>
              setShopFilter(
                event.target.value
              )
            }
            style={
              inputStyle
            }
          >
            <option
              value="ALL"
            >
              All Shops
            </option>

            {shopOptions.map(
              ([
                id,
                name,
              ]) => (
                <option
                  key={
                    id
                  }
                  value={
                    id
                  }
                >
                  {name}
                </option>
              )
            )}
          </select>
        </div>

        <div>
          <label
            style={
              labelStyle
            }
          >
            CATEGORY
          </label>

          <select
            value={
              categoryFilter
            }
            onChange={(
              event
            ) =>
              setCategoryFilter(
                event.target.value
              )
            }
            style={
              inputStyle
            }
          >
            <option value="ALL">
              All Categories
            </option>

            <option value="WIFI">
              WIFI
            </option>

            <option value="DSTV">
              DSTV
            </option>

            <option value="RENT">
              RENT
            </option>

            <option value="ELECTRICITY">
              ELECTRICITY
            </option>

            <option value="BANKING">
              BANKING
            </option>
          </select>
        </div>

        <div>
          <label
            style={
              labelStyle
            }
          >
            PAYMENT STATUS
          </label>

          <select
            value={
              statusFilter
            }
            onChange={(
              event
            ) =>
              setStatusFilter(
                event.target.value
              )
            }
            style={
              inputStyle
            }
          >
            <option value="ALL">
              All Statuses
            </option>

            <option value="PENDING">
              Pending
            </option>

            <option value="PROCESSING">
              Processing
            </option>

            <option value="CONFIRMED">
              Confirmed
            </option>

            <option value="REJECTED">
              Rejected
            </option>

            <option value="FAILED">
              Failed
            </option>

            <option value="CANCELLED">
              Cancelled
            </option>
          </select>
        </div>
      </div>

      {/* =========================================== */}
      {/* CURRENT SAVINGS BALANCES */}
      {/* =========================================== */}

      <div
        style={
          panelStyle
        }
      >
        <div
          style={
            panelTitleStyle
          }
        >
          CURRENT SAVINGS BALANCES
        </div>

        {filteredBalances.length ===
        0 ? (
          <div
            style={
              emptyStyle
            }
          >
            No Savings balances match the selected filters.
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
                    Category
                  </TableHead>

                  <TableHead>
                    Shop
                  </TableHead>

                  <TableHead>
                    Employee
                  </TableHead>

                  <TableHead right>
                    Current Balance
                  </TableHead>

                  <TableHead>
                    Status
                  </TableHead>

                  <TableHead>
                    Last Updated
                  </TableHead>
                </tr>
              </thead>

              <tbody>
                {filteredBalances.map(
                  (
                    item
                  ) => (
                    <tr
                      key={
                        item.id
                      }
                    >
                      <TableCell>
                        <strong>
                          {
                            item.category
                          }
                        </strong>
                      </TableCell>

                      <TableCell>
                        {item.shop_name ||
                          "-"}
                      </TableCell>

                      <TableCell>
                        {item.employee_name ||
                          "-"}
                      </TableCell>

                      <TableCell
                        right
                      >
                        <strong>
                          KES{" "}
                          {money(
                            item.current_balance
                          )}
                        </strong>
                      </TableCell>

                      <TableCell>
                        {item.is_active
                          ? "ACTIVE"
                          : "INACTIVE"}
                      </TableCell>

                      <TableCell>
                        {formatDateTime(
                          item.updated_at
                        )}
                      </TableCell>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =========================================== */}
      {/* PAYMENT ACTIVITY */}
      {/* =========================================== */}

      <div
        style={
          panelStyle
        }
      >
        <div
          style={
            panelTitleStyle
          }
        >
          SAVINGS / BANKING PAYMENT ACTIVITY
        </div>

        {filteredPayments.length ===
        0 ? (
          <div
            style={
              emptyStyle
            }
          >
            No payment activity matches the selected filters.
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
                  "1300px",
              }}
            >
              <thead>
                <tr>
                  <TableHead>
                    Requested
                  </TableHead>

                  <TableHead>
                    Category
                  </TableHead>

                  <TableHead>
                    Shop
                  </TableHead>

                  <TableHead>
                    Employee
                  </TableHead>

                  <TableHead right>
                    Amount
                  </TableHead>

                  <TableHead>
                    Destination
                  </TableHead>

                  <TableHead>
                    Method / Provider
                  </TableHead>

                  <TableHead>
                    Reference
                  </TableHead>

                  <TableHead right>
                    Fee
                  </TableHead>

                  <TableHead>
                    Status
                  </TableHead>

                  <TableHead>
                    Completed
                  </TableHead>
                </tr>
              </thead>

              <tbody>
                {filteredPayments.map(
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
                          item.requested_at
                        )}
                      </TableCell>

                      <TableCell>
                        <strong>
                          {
                            item.category
                          }
                        </strong>
                      </TableCell>

                      <TableCell>
                        {item.shop_name ||
                          "-"}
                      </TableCell>

                      <TableCell>
                        {item.employee_name ||
                          "-"}
                      </TableCell>

                      <TableCell
                        right
                      >
                        KES{" "}
                        {money(
                          item.amount
                        )}
                      </TableCell>

                      <TableCell>
                        <div>
                          {item.destination_name ||
                            "-"}
                        </div>

                        <small>
                          {destinationText(
                            item
                          )}
                        </small>
                      </TableCell>

                      <TableCell>
                        {item.payment_provider ||
                          item.payment_method ||
                          "-"}
                      </TableCell>

                      <TableCell>
                        {item.payment_reference ||
                          item.external_transaction_id ||
                          item.rejection_reason ||
                          "-"}
                      </TableCell>

                      <TableCell
                        right
                      >
                        KES{" "}
                        {money(
                          item.transaction_fee
                        )}
                      </TableCell>

                      <TableCell>
                        <StatusBadge
                          status={
                            item.status
                          }
                        />
                      </TableCell>

                      <TableCell>
                        {formatDateTime(
                          item.confirmed_at ||
                            item.rejected_at
                        )}
                      </TableCell>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =========================================== */}
      {/* SAVINGS LEDGER */}
      {/* =========================================== */}

      <div
        style={
          panelStyle
        }
      >
        <div
          style={
            panelTitleStyle
          }
        >
          SAVINGS LEDGER
        </div>

        <div
          style={
            ledgerNoticeStyle
          }
        >
          Permanent money-movement record. SAVE increases Savings. PAYMENT and WITHDRAWAL decrease Savings.
        </div>

        {filteredLedger.length ===
        0 ? (
          <div
            style={
              emptyStyle
            }
          >
            No ledger entries match the selected filters.
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
                  "1100px",
              }}
            >
              <thead>
                <tr>
                  <TableHead>
                    Date / Time
                  </TableHead>

                  <TableHead>
                    Category
                  </TableHead>

                  <TableHead>
                    Shop
                  </TableHead>

                  <TableHead>
                    Employee
                  </TableHead>

                  <TableHead>
                    Transaction
                  </TableHead>

                  <TableHead right>
                    Amount
                  </TableHead>

                  <TableHead right>
                    Before
                  </TableHead>

                  <TableHead right>
                    After
                  </TableHead>

                  <TableHead>
                    Description
                  </TableHead>
                </tr>
              </thead>

              <tbody>
                {filteredLedger.map(
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
                          item.created_at
                        )}
                      </TableCell>

                      <TableCell>
                        <strong>
                          {
                            item.category
                          }
                        </strong>
                      </TableCell>

                      <TableCell>
                        {item.shop_name ||
                          "-"}
                      </TableCell>

                      <TableCell>
                        {item.employee_name ||
                          "-"}
                      </TableCell>

                      <TableCell>
                        <LedgerBadge
                          type={
                            item.transaction_type
                          }
                        />
                      </TableCell>

                      <TableCell
                        right
                      >
                        KES{" "}
                        {money(
                          item.amount
                        )}
                      </TableCell>

                      <TableCell
                        right
                      >
                        KES{" "}
                        {money(
                          item.balance_before
                        )}
                      </TableCell>

                      <TableCell
                        right
                      >
                        KES{" "}
                        {money(
                          item.balance_after
                        )}
                      </TableCell>

                      <TableCell>
                        {item.description ||
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

      <div
        style={
          safetyNoticeStyle
        }
      >
        Savings balances are controlled by the ledger. Weekly Banking closure is administrative only and cannot alter financial balances.
      </div>
    </section>
  );
}

// ==================================================
// COMPONENTS
// ==================================================

function SummaryCard({
  label,
  value,
  sub,
  success = false,
  warning = false,
  danger = false,
}) {
  let background =
    "#eff6ff";

  let border =
    "#93c5fd";

  let color =
    "#1e3a8a";

  if (success) {
    background =
      "#f0fdf4";

    border =
      "#86efac";

    color =
      "#166534";
  }

  if (warning) {
    background =
      "#fffbeb";

    border =
      "#fde68a";

    color =
      "#92400e";
  }

  if (danger) {
    background =
      "#fef2f2";

    border =
      "#fecaca";

    color =
      "#991b1b";
  }

  return (
    <div
      style={{
        ...summaryCardStyle,

        backgroundColor:
          background,

        borderColor:
          border,

        color,
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
          summaryValueStyle
        }
      >
        {value}
      </div>

      {sub && (
        <div
          style={
            summarySubStyle
          }
        >
          {sub}
        </div>
      )}
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

function StatusBadge({
  status,
}) {
  const value =
    String(
      status ||
        ""
    ).toUpperCase();

  let background =
    "#e2e8f0";

  let color =
    "#334155";

  if (
    value ===
    "CONFIRMED"
  ) {
    background =
      "#dcfce7";

    color =
      "#166534";
  } else if (
    value ===
      "PENDING" ||
    value ===
      "PROCESSING"
  ) {
    background =
      "#fef3c7";

    color =
      "#92400e";
  } else if (
    value ===
      "REJECTED" ||
    value ===
      "FAILED" ||
    value ===
      "CANCELLED"
  ) {
    background =
      "#fee2e2";

    color =
      "#991b1b";
  }

  return (
    <span
      style={{
        ...badgeStyle,

        backgroundColor:
          background,

        color,
      }}
    >
      {value || "-"}
    </span>
  );
}

function BankingStatusBadge({
  status,
}) {
  const value =
    String(
      status ||
        ""
    ).toUpperCase();

  let background =
    "#e2e8f0";

  let color =
    "#334155";

  if (
    value ===
      "TARGET_MET" ||
    value ===
      "ABOVE_TARGET"
  ) {
    background =
      "#dcfce7";

    color =
      "#166534";
  } else if (
    value ===
      "OPEN" ||
    value ===
      "PARTIAL"
  ) {
    background =
      "#fef3c7";

    color =
      "#92400e";
  } else if (
    value ===
    "MISSED"
  ) {
    background =
      "#fee2e2";

    color =
      "#991b1b";
  } else if (
    value ===
    "ADMIN_CLOSED"
  ) {
    background =
      "#e0e7ff";

    color =
      "#3730a3";
  }

  return (
    <span
      style={{
        ...badgeStyle,

        backgroundColor:
          background,

        color,
      }}
    >
      {friendlyBankingStatus(
        value
      )}
    </span>
  );
}

function LedgerBadge({
  type,
}) {
  const value =
    String(
      type ||
        ""
    ).toUpperCase();

  let background =
    "#e2e8f0";

  let color =
    "#334155";

  if (
    value ===
      "SAVE" ||
    value ===
      "OPENING_ADJUSTMENT"
  ) {
    background =
      "#dcfce7";

    color =
      "#166534";
  }

  if (
    value ===
      "PAYMENT" ||
    value ===
      "WITHDRAWAL"
  ) {
    background =
      "#dbeafe";

    color =
      "#1d4ed8";
  }

  return (
    <span
      style={{
        ...badgeStyle,

        backgroundColor:
          background,

        color,
      }}
    >
      {value}
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

function bankingWeekKey(
  week
) {
  return `${week.employee_id}-${week.week_start}`;
}

function friendlyBankingStatus(
  status
) {
  switch (
    status
  ) {
    case "TARGET_MET":
      return "TARGET MET";

    case "ABOVE_TARGET":
      return "ABOVE TARGET";

    case "ADMIN_CLOSED":
      return "ADMIN CLOSED";

    case "MISSED":
      return "MISSED";

    case "PARTIAL":
      return "PARTIAL";

    case "OPEN":
      return "OPEN";

    default:
      return status || "-";
  }
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

function destinationText(
  item
) {
  const parts =
    [
      item.destination_bank,
      item.destination_paybill_till,
      item.destination_account,
    ].filter(
      Boolean
    );

  return parts.length
    ? parts.join(
        " • "
      )
    : "-";
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

  fontWeight:
    "bold",
};

const headerStyle = {
  padding:
    "14px",

  borderRadius:
    "7px",

  background:
    "linear-gradient(90deg,#064e3b,#0f766e)",

  color:
    "white",

  display:
    "flex",

  alignItems:
    "center",

  justifyContent:
    "space-between",

  gap:
    "12px",

  flexWrap:
    "wrap",
};

const titleStyle = {
  fontSize:
    "15px",

  fontWeight:
    "900",
};

const subtitleStyle = {
  marginTop:
    "4px",

  fontSize:
    "9px",

  color:
    "#ccfbf1",
};

const refreshButtonStyle = {
  border:
    "1px solid rgba(255,255,255,0.45)",

  borderRadius:
    "5px",

  padding:
    "8px 12px",

  backgroundColor:
    "transparent",

  color:
    "white",

  fontWeight:
    "bold",

  cursor:
    "pointer",
};

const summaryGridStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "repeat(auto-fit,minmax(170px,1fr))",

  gap:
    "10px",
};

const summaryCardStyle = {
  border:
    "1px solid",

  borderRadius:
    "7px",

  padding:
    "12px",
};

const summaryLabelStyle = {
  fontSize:
    "8px",

  fontWeight:
    "900",
};

const summaryValueStyle = {
  marginTop:
    "5px",

  fontSize:
    "18px",

  fontWeight:
    "900",
};

const summarySubStyle = {
  marginTop:
    "3px",

  fontSize:
    "10px",

  fontWeight:
    "bold",
};

const bankingSummaryPanelStyle = {
  padding:
    "12px",

  border:
    "1px solid #99f6e4",

  borderRadius:
    "7px",

  backgroundColor:
    "#f0fdfa",
};

const bankingSummaryHeaderStyle = {
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

  marginBottom:
    "10px",

  color:
    "#115e59",

  fontSize:
    "11px",

  fontWeight:
    "900",
};

const bankingPanelStyle = {
  backgroundColor:
    "white",

  border:
    "1px solid #99f6e4",

  borderRadius:
    "7px",

  overflow:
    "hidden",
};

const bankingTitleStyle = {
  padding:
    "10px 12px",

  backgroundColor:
    "#0f766e",

  color:
    "white",

  fontSize:
    "12px",

  fontWeight:
    "900",
};

const bankingTitleRowStyle = {
  padding:
    "9px 12px",

  backgroundColor:
    "#0f766e",

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

const bankingTitleStyleNoBg = {
  color:
    "white",

  fontSize:
    "12px",

  fontWeight:
    "900",
};

const bankingRuleStyle = {
  padding:
    "9px",

  backgroundColor:
    "#ecfdf5",

  color:
    "#166534",

  borderBottom:
    "1px solid #bbf7d0",

  fontSize:
    "9px",

  textAlign:
    "center",
};

const addEmployeePanelStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "1fr 160px",

  gap:
    "10px",

  alignItems:
    "end",

  padding:
    "12px",

  backgroundColor:
    "#f0fdfa",

  borderBottom:
    "1px solid #99f6e4",
};

const addEmployeeButtonStyle = {
  border:
    "none",

  borderRadius:
    "4px",

  padding:
    "9px",

  backgroundColor:
    "#0f766e",

  color:
    "white",

  fontSize:
    "9px",

  fontWeight:
    "bold",

  cursor:
    "pointer",
};

const bankingPrivacyStyle = {
  padding:
    "9px",

  backgroundColor:
    "#f8fafc",

  color:
    "#64748b",

  borderTop:
    "1px solid #e2e8f0",

  fontSize:
    "9px",

  textAlign:
    "center",
};

const bankingCloseNoticeStyle = {
  padding:
    "9px",

  borderTop:
    "1px solid #fde68a",

  backgroundColor:
    "#fffbeb",

  color:
    "#92400e",

  textAlign:
    "center",

  fontSize:
    "9px",
};

const targetListStyle = {
  display:
    "grid",

  overflowX:
    "auto",
};

const targetRowStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "minmax(160px,1fr) minmax(150px,0.8fr) minmax(220px,1.4fr) 110px",

  gap:
    "8px",

  alignItems:
    "end",

  padding:
    "9px",

  borderTop:
    "1px solid #e2e8f0",

  minWidth:
    "780px",
};

const employeeNameStyle = {
  fontSize:
    "10px",

  fontWeight:
    "900",

  color:
    "#0f172a",
};

const employeeMetaStyle = {
  marginTop:
    "4px",

  fontSize:
    "8px",

  color:
    "#64748b",
};

const saveTargetButtonStyle = {
  border:
    "none",

  borderRadius:
    "4px",

  padding:
    "9px",

  backgroundColor:
    "#15803d",

  color:
    "white",

  fontSize:
    "9px",

  fontWeight:
    "bold",

  cursor:
    "pointer",
};

const closeWeekButtonStyle = {
  border:
    "none",

  borderRadius:
    "4px",

  padding:
    "8px 10px",

  backgroundColor:
    "#dc2626",

  color:
    "white",

  fontSize:
    "9px",

  fontWeight:
    "bold",

  cursor:
    "pointer",
};

const currentWeekTextStyle = {
  marginTop:
    "3px",

  color:
    "#0f766e",

  fontSize:
    "7px",

  fontWeight:
    "900",
};

const smallMutedStyle = {
  color:
    "#94a3b8",

  fontSize:
    "8px",
};

const smallSelectStyle = {
  minWidth:
    "170px",

  padding:
    "6px",

  border:
    "1px solid #99f6e4",

  borderRadius:
    "4px",

  backgroundColor:
    "white",

  fontSize:
    "9px",
};

const filterPanelStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "repeat(auto-fit,minmax(180px,1fr))",

  gap:
    "10px",

  padding:
    "12px",

  backgroundColor:
    "white",

  border:
    "1px solid #cbd5e1",

  borderRadius:
    "7px",
};

const labelStyle = {
  display:
    "block",

  marginBottom:
    "5px",

  color:
    "#475569",

  fontSize:
    "8px",

  fontWeight:
    "bold",
};

const inputStyle = {
  width:
    "100%",

  boxSizing:
    "border-box",

  padding:
    "8px",

  border:
    "1px solid #94a3b8",

  borderRadius:
    "4px",

  backgroundColor:
    "white",

  fontSize:
    "10px",
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

const panelTitleStyle = {
  padding:
    "10px 12px",

  backgroundColor:
    "#0873b9",

  color:
    "white",

  fontSize:
    "12px",

  fontWeight:
    "900",
};

const historyTitleStyle = {
  padding:
    "10px 12px",

  backgroundColor:
    "#7c3aed",

  color:
    "white",

  fontSize:
    "12px",

  fontWeight:
    "900",
};

const tableWrapStyle = {
  overflowX:
    "auto",
};

const tableStyle = {
  width:
    "100%",

  minWidth:
    "850px",

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
};

const tableCellStyle = {
  padding:
    "9px 8px",

  borderBottom:
    "1px solid #e2e8f0",

  color:
    "#334155",

  fontSize:
    "9px",

  verticalAlign:
    "top",
};

const badgeStyle = {
  display:
    "inline-block",

  padding:
    "4px 7px",

  borderRadius:
    "10px",

  fontSize:
    "7px",

  fontWeight:
    "900",

  whiteSpace:
    "nowrap",
};

const ledgerNoticeStyle = {
  padding:
    "9px",

  backgroundColor:
    "#ecfeff",

  color:
    "#155e75",

  borderBottom:
    "1px solid #bae6fd",

  textAlign:
    "center",

  fontSize:
    "9px",
};

const emptyStyle = {
  padding:
    "22px",

  color:
    "#64748b",

  textAlign:
    "center",

  fontSize:
    "10px",
};

const safetyNoticeStyle = {
  padding:
    "10px",

  backgroundColor:
    "#f0fdf4",

  border:
    "1px solid #86efac",

  borderRadius:
    "6px",

  color:
    "#166534",

  textAlign:
    "center",

  fontSize:
    "9px",

  fontWeight:
    "bold",
};

const errorStyle = {
  padding:
    "10px",

  backgroundColor:
    "#fef2f2",

  border:
    "1px solid #fecaca",

  borderRadius:
    "6px",

  color:
    "#991b1b",

  fontSize:
    "10px",

  fontWeight:
    "bold",
};

const successStyle = {
  padding:
    "10px",

  backgroundColor:
    "#f0fdf4",

  border:
    "1px solid #86efac",

  borderRadius:
    "6px",

  color:
    "#166534",

  fontSize:
    "10px",

  fontWeight:
    "bold",
};
