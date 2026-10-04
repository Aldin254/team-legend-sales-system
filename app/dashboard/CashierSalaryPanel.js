"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

export default function CashierSalaryPanel({
  user,
  currentShift,
  onSalaryPaid,
}) {
  const [employees, setEmployees] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [pinOpenId, setPinOpenId] =
    useState(null);

  const [pinInputs, setPinInputs] =
    useState({});

  const [verifyingId, setVerifyingId] =
    useState(null);

  const [payingId, setPayingId] =
    useState(null);

  const [unlocked, setUnlocked] =
    useState({});

  const [recentPaid, setRecentPaid] =
    useState({});

  const [message, setMessage] =
    useState("");

  const [messageType, setMessageType] =
    useState("");

  // ==================================================
  // TIMERS
  // ==================================================

  // After successful payment:
  // private paid details stay visible for 10 seconds.
  const lockTimersRef =
    useRef({});

  // PIN entry box:
  // closes after 20 seconds of inactivity.
  const pinTimersRef =
    useRef({});

  // Successfully unlocked salary details:
  // closes after 20 seconds if employee does nothing.
  const unlockedTimersRef =
    useRef({});

  // ==================================================
  // SUPABASE
  // ==================================================

  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env
      .NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const accessToken =
    user?.access_token ||
    null;

  const shopId =
    currentShift?.shop_id ||
    user?.shop_id ||
    null;

  const shiftId =
    currentShift?.id ||
    null;

  // ==================================================
  // LOAD ACTIVE SALARY EMPLOYEES
  // ==================================================

  const loadEmployees =
    useCallback(
      async () => {
        if (
          !shopId ||
          !accessToken ||
          !supabaseUrl ||
          !supabaseAnonKey
        ) {
          setEmployees(
            []
          );

          setLoading(
            false
          );

          return;
        }

        try {
          const result =
            await callRpc({
              supabaseUrl,

              accessToken,

              supabaseAnonKey,

              functionName:
                "tl_salary_cashier_list",

              body: {
                p_shop_id:
                  shopId,
              },
            });

          setEmployees(
            Array.isArray(
              result
            )
              ? result
              : []
          );
        } catch (error) {
          console.error(
            "LOAD CASHIER SALARY ERROR:",
            error
          );

          setMessage(
            error?.message ||
              "Unable to load salary information."
          );

          setMessageType(
            "error"
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      [
        shopId,
        accessToken,
        supabaseUrl,
        supabaseAnonKey,
      ]
    );

  // ==================================================
  // AUTO REFRESH
  // ==================================================

  useEffect(() => {
    loadEmployees();

    const timer =
      setInterval(
        loadEmployees,
        5000
      );

    return () => {
      clearInterval(
        timer
      );
    };
  }, [
    loadEmployees,
  ]);

  // ==================================================
  // CLEAR ALL TIMERS ON UNMOUNT
  // ==================================================

  useEffect(() => {
    return () => {
      for (
        const timer of
        Object.values(
          lockTimersRef.current
        )
      ) {
        clearTimeout(
          timer
        );
      }

      for (
        const timer of
        Object.values(
          pinTimersRef.current
        )
      ) {
        clearTimeout(
          timer
        );
      }

      for (
        const timer of
        Object.values(
          unlockedTimersRef.current
        )
      ) {
        clearTimeout(
          timer
        );
      }
    };
  }, []);

  // ==================================================
  // PIN TIMER HELPERS
  // ==================================================

  function clearPinTimer(
    employeeId
  ) {
    if (
      pinTimersRef.current[
        employeeId
      ]
    ) {
      clearTimeout(
        pinTimersRef.current[
          employeeId
        ]
      );

      delete pinTimersRef
        .current[
        employeeId
      ];
    }
  }

  function startPinCloseTimer(
    employeeId
  ) {
    clearPinTimer(
      employeeId
    );

    pinTimersRef.current[
      employeeId
    ] =
      setTimeout(
        () => {
          setPinOpenId(
            (
              current
            ) =>
              current ===
              employeeId
                ? null
                : current
          );

          setPinInputs(
            (
              previous
            ) => ({
              ...previous,

              [employeeId]:
                "",
            })
          );

          setMessage(
            ""
          );

          setMessageType(
            ""
          );

          delete pinTimersRef
            .current[
            employeeId
          ];
        },
        20000
      );
  }

  // ==================================================
  // UNLOCKED SALARY TIMER HELPERS
  // ==================================================

  function clearUnlockedTimer(
    employeeId
  ) {
    if (
      unlockedTimersRef
        .current[
        employeeId
      ]
    ) {
      clearTimeout(
        unlockedTimersRef
          .current[
          employeeId
        ]
      );

      delete unlockedTimersRef
        .current[
        employeeId
      ];
    }
  }

  function startUnlockedCloseTimer(
    employeeId
  ) {
    clearUnlockedTimer(
      employeeId
    );

    unlockedTimersRef
      .current[
      employeeId
    ] =
      setTimeout(
        () => {
          setUnlocked(
            (
              previous
            ) => {
              const next = {
                ...previous,
              };

              delete next[
                employeeId
              ];

              return next;
            }
          );

          setPinOpenId(
            null
          );

          setPinInputs(
            (
              previous
            ) => ({
              ...previous,

              [employeeId]:
                "",
            })
          );

          setMessage(
            ""
          );

          setMessageType(
            ""
          );

          delete unlockedTimersRef
            .current[
            employeeId
          ];

          loadEmployees();
        },
        20000
      );
  }

  // ==================================================
  // OPEN PIN BOX
  // ==================================================

  function openPin(
    row
  ) {
    if (
      row?.pin_locked
    ) {
      setMessage(
        `${row.employee_name}'s Salary PIN is locked. Contact Admin.`
      );

      setMessageType(
        "error"
      );

      return;
    }

    if (
      String(
        row?.status ||
          ""
      ).toUpperCase() !==
      "PENDING"
    ) {
      return;
    }

    // Clear other open PIN timers.
    for (
      const employeeId of
      Object.keys(
        pinTimersRef.current
      )
    ) {
      clearPinTimer(
        employeeId
      );
    }

    setPinOpenId(
      row.employee_id
    );

    setPinInputs(
      (
        previous
      ) => ({
        ...previous,

        [row.employee_id]:
          "",
      })
    );

    setMessage(
      ""
    );

    setMessageType(
      ""
    );

    // PIN box closes after
    // 20 seconds of inactivity.
    startPinCloseTimer(
      row.employee_id
    );
  }

  // ==================================================
  // VERIFY EMPLOYEE PIN
  // ==================================================

  async function verifyPin(
    row
  ) {
    if (
      !row?.employee_id ||
      !shiftId
    ) {
      return;
    }

    const pin =
      String(
        pinInputs[
          row.employee_id
        ] ||
          ""
      ).trim();

    if (
      !/^\d{4}$/.test(
        pin
      )
    ) {
      setMessage(
        "Enter the 4-digit Salary PIN."
      );

      setMessageType(
        "error"
      );

      startPinCloseTimer(
        row.employee_id
      );

      return;
    }

    try {
      // Stop PIN inactivity timer
      // while checking the PIN.
      clearPinTimer(
        row.employee_id
      );

      setVerifyingId(
        row.employee_id
      );

      setMessage(
        ""
      );

      setMessageType(
        ""
      );

      const result =
        await callRpc({
          supabaseUrl,

          accessToken,

          supabaseAnonKey,

          functionName:
            "tl_salary_verify_pin",

          body: {
            p_employee_id:
              row.employee_id,

            p_shift_id:
              shiftId,

            p_pin:
              pin,
          },
        });

      if (
        !result?.success
      ) {
        setMessage(
          result?.message ||
            "Unable to unlock salary."
        );

        setMessageType(
          "error"
        );

        setPinInputs(
          (
            previous
          ) => ({
            ...previous,

            [row.employee_id]:
              "",
          })
        );

        await loadEmployees();

        // Keep PIN panel open,
        // but close after 20 seconds.
        startPinCloseTimer(
          row.employee_id
        );

        return;
      }

      if (
        result?.code ===
        "NO_PENDING_SALARY"
      ) {
        clearPinTimer(
          row.employee_id
        );

        setMessage(
          result?.message ||
            "No salary is currently due."
        );

        setMessageType(
          "success"
        );

        setPinOpenId(
          null
        );

        setPinInputs(
          (
            previous
          ) => ({
            ...previous,

            [row.employee_id]:
              "",
          })
        );

        await loadEmployees();

        return;
      }

      if (
        result?.code !==
        "PIN_OK"
      ) {
        setMessage(
          result?.message ||
            "Unable to open salary."
        );

        setMessageType(
          "error"
        );

        startPinCloseTimer(
          row.employee_id
        );

        return;
      }

      // Correct PIN.
      clearPinTimer(
        row.employee_id
      );

      setUnlocked(
        (
          previous
        ) => ({
          ...previous,

          [row.employee_id]:
            result,
        })
      );

      setPinOpenId(
        null
      );

      setPinInputs(
        (
          previous
        ) => ({
          ...previous,

          [row.employee_id]:
            "",
        })
      );

      setMessage(
        `${row.employee_name}'s salary has been unlocked.`
      );

      setMessageType(
        "success"
      );

      // Private salary details now
      // automatically hide after 20 seconds.
      startUnlockedCloseTimer(
        row.employee_id
      );
    } catch (error) {
      console.error(
        "VERIFY SALARY PIN ERROR:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to verify Salary PIN."
      );

      setMessageType(
        "error"
      );

      startPinCloseTimer(
        row.employee_id
      );
    } finally {
      setVerifyingId(
        null
      );
    }
  }

  // ==================================================
  // PAY SALARY
  // ==================================================

  async function paySalary(
    row
  ) {
    const details =
      unlocked[
        row.employee_id
      ];

    if (
      !details?.session_id
    ) {
      setMessage(
        "Salary authorization is missing. Enter the Salary PIN again."
      );

      setMessageType(
        "error"
      );

      return;
    }

    // User has clicked PAY SALARY.
    // Stop the 20-second unlocked timer
    // while confirmation/payment is happening.
    clearUnlockedTimer(
      row.employee_id
    );

    const confirmed =
      window.confirm(
        "CONFIRM WEEKLY SALARY PAYMENT\n\n" +
          `Employee: ${
            details.employee_name ||
            row.employee_name
          }\n` +
          `Earned Week: ${formatWeek(
            details.earned_week_start,
            details.earned_week_end
          )}\n\n` +
          `Weekly Salary: KES ${money(
            details.gross_salary
          )}\n` +
          `Advance: ${
            details.advance ||
            "NO"
          }\n` +
          `Advance Deduction: KES ${money(
            details.advance_deduction
          )}\n` +
          `Net Salary To Pay: KES ${money(
            details.net_salary
          )}\n` +
          `Advance Balance After: KES ${money(
            details.advance_balance_after
          )}\n\n` +
          "The net salary will automatically be added to Expenses as a PRIVATE salary expense.\n\n" +
          "Pay this salary?"
      );

    if (
      !confirmed
    ) {
      // Employee cancelled payment.
      // Start 20-second privacy timer again.
      startUnlockedCloseTimer(
        row.employee_id
      );

      return;
    }

    try {
      setPayingId(
        row.employee_id
      );

      setMessage(
        ""
      );

      setMessageType(
        ""
      );

      const result =
        await callRpc({
          supabaseUrl,

          accessToken,

          supabaseAnonKey,

          functionName:
            "tl_salary_pay",

          body: {
            p_employee_id:
              row.employee_id,

            p_shift_id:
              shiftId,

            p_session_id:
              details.session_id,
          },
        });

      if (
        !result?.success
      ) {
        throw new Error(
          result?.message ||
            "Unable to pay salary."
        );
      }

      // ==================================================
      // SUCCESSFUL PAYMENT
      // ==================================================

      setRecentPaid(
        (
          previous
        ) => ({
          ...previous,

          [row.employee_id]:
            true,
        })
      );

      setUnlocked(
        (
          previous
        ) => ({
          ...previous,

          [row.employee_id]: {
            ...details,
            ...result,
          },
        })
      );

      setMessage(
        `${row.employee_name}'s salary was paid successfully. Salary details will hide automatically in 10 seconds.`
      );

      setMessageType(
        "success"
      );

      if (
        typeof onSalaryPaid ===
        "function"
      ) {
        await onSalaryPaid();
      }

      await loadEmployees();

      // Clear old post-payment timer.
      if (
        lockTimersRef.current[
          row.employee_id
        ]
      ) {
        clearTimeout(
          lockTimersRef.current[
            row.employee_id
          ]
        );
      }

      // Paid private details remain
      // visible for exactly 10 seconds.
      lockTimersRef.current[
        row.employee_id
      ] =
        setTimeout(
          () => {
            setUnlocked(
              (
                previous
              ) => {
                const next = {
                  ...previous,
                };

                delete next[
                  row.employee_id
                ];

                return next;
              }
            );

            setRecentPaid(
              (
                previous
              ) => {
                const next = {
                  ...previous,
                };

                delete next[
                  row.employee_id
                ];

                return next;
              }
            );

            setPinOpenId(
              null
            );

            setPinInputs(
              (
                previous
              ) => ({
                ...previous,

                [row.employee_id]:
                  "",
              })
            );

            setMessage(
              ""
            );

            setMessageType(
              ""
            );

            delete lockTimersRef
              .current[
              row.employee_id
            ];

            loadEmployees();
          },
          10000
        );
    } catch (error) {
      console.error(
        "PAY SALARY ERROR:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to complete salary payment."
      );

      setMessageType(
        "error"
      );

      // If payment failed, salary is still
      // unlocked. Protect it again with
      // the 20-second auto-close timer.
      startUnlockedCloseTimer(
        row.employee_id
      );
    } finally {
      setPayingId(
        null
      );
    }
  }

  // ==================================================
  // DISPLAY
  // ==================================================

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
        WEEKLY SALARY
      </div>

      <div
        style={
          privacyNoticeStyle
        }
      >
        Salary amounts are private. Each employee must use their own
        4-digit Salary PIN.
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

      <div
        style={
          headerStyle
        }
      >
        <div>
          EMPLOYEE
        </div>

        <div>
          SALARY
        </div>

        <div>
          STATUS
        </div>

        <div>
          ACTION
        </div>
      </div>

      {loading ? (
        <div
          style={
            emptyStyle
          }
        >
          Loading salary employees...
        </div>
      ) : employees.length ===
        0 ? (
        <div
          style={
            emptyStyle
          }
        >
          No active salary employees for this shop.
        </div>
      ) : (
        employees.map(
          (
            row
          ) => {
            const employeeId =
              row.employee_id;

            const details =
              unlocked[
                employeeId
              ];

            const justPaid =
              Boolean(
                recentPaid[
                  employeeId
                ]
              );

            const status =
              String(
                row.status ||
                  "NOT DUE"
              ).toUpperCase();

            const locked =
              Boolean(
                row.pin_locked
              );

            const pinOpen =
              pinOpenId ===
              employeeId;

            return (
              <div
                key={
                  employeeId
                }
              >
                <div
                  style={
                    salaryRowStyle
                  }
                >
                  <div
                    style={
                      employeeNameStyle
                    }
                  >
                    {row.employee_name}
                  </div>

                  <div
                    style={
                      privateStyle
                    }
                  >
                    🔒 PRIVATE
                  </div>

                  <SalaryStatus
                    status={
                      locked
                        ? "LOCKED"
                        : justPaid
                        ? "PAID"
                        : status
                    }
                  />

                  <div>
                    {locked ? (
                      <div
                        style={
                          lockedStyle
                        }
                      >
                        CONTACT ADMIN
                      </div>
                    ) : details ? (
                      <div
                        style={
                          unlockedBadgeStyle
                        }
                      >
                        UNLOCKED
                      </div>
                    ) : status ===
                      "PENDING" ? (
                      <button
                        type="button"
                        onClick={() =>
                          openPin(
                            row
                          )
                        }
                        style={
                          viewButtonStyle
                        }
                      >
                        VIEW / PAY
                      </button>
                    ) : status ===
                      "PAID" ? (
                      <div
                        style={
                          paidPrivateStyle
                        }
                      >
                        PRIVATE ✓
                      </div>
                    ) : (
                      <div
                        style={
                          notDueStyle
                        }
                      >
                        NOT DUE
                      </div>
                    )}
                  </div>
                </div>

                {/* ================================= */}
                {/* PIN ENTRY */}
                {/* ================================= */}

                {pinOpen && (
                  <div
                    style={
                      pinBoxStyle
                    }
                  >
                    <div
                      style={
                        pinLabelStyle
                      }
                    >
                      Enter {row.employee_name}'s 4-digit Salary PIN
                    </div>

                    <div
                      style={
                        pinGridStyle
                      }
                    >
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={4}
                        value={
                          pinInputs[
                            employeeId
                          ] ||
                          ""
                        }
                        disabled={
                          verifyingId ===
                          employeeId
                        }
                        autoFocus
                        placeholder="••••"
                        onChange={(
                          event
                        ) => {
                          const value =
                            event.target.value
                              .replace(
                                /\D/g,
                                ""
                              )
                              .slice(
                                0,
                                4
                              );

                          setPinInputs(
                            (
                              previous
                            ) => ({
                              ...previous,

                              [employeeId]:
                                value,
                            })
                          );

                          setMessage(
                            ""
                          );

                          setMessageType(
                            ""
                          );

                          // Every keypress restarts
                          // the 20-second inactivity timer.
                          startPinCloseTimer(
                            employeeId
                          );
                        }}
                        style={
                          pinInputStyle
                        }
                      />

                      <button
                        type="button"
                        disabled={
                          verifyingId ===
                          employeeId
                        }
                        onClick={() =>
                          verifyPin(
                            row
                          )
                        }
                        style={
                          pinConfirmButtonStyle
                        }
                      >
                        {verifyingId ===
                        employeeId
                          ? "CHECKING..."
                          : "UNLOCK"}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          clearPinTimer(
                            employeeId
                          );

                          setPinOpenId(
                            null
                          );

                          setPinInputs(
                            (
                              previous
                            ) => ({
                              ...previous,

                              [employeeId]:
                                "",
                            })
                          );

                          setMessage(
                            ""
                          );

                          setMessageType(
                            ""
                          );
                        }}
                        style={
                          cancelButtonStyle
                        }
                      >
                        CANCEL
                      </button>
                    </div>

                    <div
                      style={
                        attemptsStyle
                      }
                    >
                      Maximum 3 incorrect attempts. After the third
                      incorrect PIN, Admin must unlock the employee.
                      The PIN box closes automatically after 20 seconds
                      of inactivity.
                    </div>
                  </div>
                )}

                {/* ================================= */}
                {/* PRIVATE SALARY DETAILS */}
                {/* ================================= */}

                {details && (
                  <div
                    style={
                      detailsBoxStyle
                    }
                  >
                    <div
                      style={
                        detailsTitleStyle
                      }
                    >
                      {details.employee_name ||
                        row.employee_name}{" "}
                      — PRIVATE SALARY DETAILS
                    </div>

                    <div
                      style={
                        detailsGridStyle
                      }
                    >
                      <DetailBox
                        title="EARNED WEEK"
                        value={
                          formatWeek(
                            details.earned_week_start,
                            details.earned_week_end
                          )
                        }
                      />

                      <DetailBox
                        title="WEEKLY SALARY"
                        value={`KES ${money(
                          details.gross_salary
                        )}`}
                      />

                      <DetailBox
                        title="ADVANCE"
                        value={
                          details.advance ||
                          (
                            Number(
                              details.advance_balance_before ||
                                0
                            ) > 0
                              ? "YES"
                              : "NO"
                          )
                        }
                      />

                      <DetailBox
                        title="ADVANCE BALANCE"
                        value={`KES ${money(
                          details.advance_balance_before
                        )}`}
                      />

                      <DetailBox
                        title="ADV. DEDUCTION"
                        value={`KES ${money(
                          details.advance_deduction
                        )}`}
                      />

                      <DetailBox
                        title="NET SALARY"
                        value={`KES ${money(
                          details.net_salary
                        )}`}
                        strong
                      />

                      <DetailBox
                        title="ADVANCE AFTER"
                        value={`KES ${money(
                          details.advance_balance_after
                        )}`}
                      />

                      <DetailBox
                        title="PAYMENT"
                        value={
                          justPaid
                            ? "PAID ✓"
                            : "PENDING"
                        }
                        strong
                      />
                    </div>

                    {justPaid ? (
                      <div
                        style={
                          tenSecondStyle
                        }
                      >
                        Salary paid successfully. These private details
                        will lock automatically after 10 seconds.
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={
                            payingId ===
                            employeeId
                          }
                          onClick={() =>
                            paySalary(
                              row
                            )
                          }
                          style={
                            payButtonStyle
                          }
                        >
                          {payingId ===
                          employeeId
                            ? "PAYING SALARY..."
                            : "PAY SALARY"}
                        </button>

                        <div
                          style={
                            unlockedNoticeStyle
                          }
                        >
                          Private salary details will close automatically
                          after 20 seconds if no payment is made.
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          }
        )
      )}

      <div
        style={
          footerStyle
        }
      >
        Salary earned Monday–Sunday becomes payable from the following
        Monday. A successful salary payment is automatically added to
        Expenses as a private salary expense.
      </div>
    </section>
  );
}

// ==================================================
// STATUS
// ==================================================

function SalaryStatus({
  status,
}) {
  const text =
    String(
      status ||
        ""
    ).toUpperCase();

  let style =
    notDueStatusStyle;

  if (
    text ===
    "PENDING"
  ) {
    style =
      pendingStatusStyle;
  }

  if (
    text ===
    "PAID"
  ) {
    style =
      paidStatusStyle;
  }

  if (
    text ===
    "LOCKED"
  ) {
    style =
      lockedStatusStyle;
  }

  return (
    <div
      style={
        style
      }
    >
      {text ===
      "PAID"
        ? "PAID ✓"
        : text}
    </div>
  );
}

// ==================================================
// DETAIL BOX
// ==================================================

function DetailBox({
  title,
  value,
  strong = false,
}) {
  return (
    <div
      style={{
        ...detailBoxStyle,

        ...(strong
          ? strongDetailBoxStyle
          : {}),
      }}
    >
      <div
        style={
          detailTitleStyle
        }
      >
        {title}
      </div>

      <div
        style={
          detailValueStyle
        }
      >
        {value}
      </div>
    </div>
  );
}

// ==================================================
// RPC
// ==================================================

async function callRpc({
  supabaseUrl,
  accessToken,
  supabaseAnonKey,
  functionName,
  body,
}) {
  const response =
    await fetch(
      `${supabaseUrl}/rest/v1/rpc/${functionName}`,
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

  if (
    !response.ok
  ) {
    throw new Error(
      result?.message ||
        result?.details ||
        result?.hint ||
        `Unable to run ${functionName}.`
    );
  }

  return result;
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

// ==================================================
// HELPERS
// ==================================================

function money(
  value
) {
  const numeric =
    Number(
      value ??
        0
    );

  return (
    Number.isFinite(
      numeric
    )
      ? numeric
      : 0
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

function formatWeek(
  start,
  end
) {
  if (
    !start
  ) {
    return "-";
  }

  const startText =
    formatDate(
      start
    );

  const endText =
    end
      ? formatDate(
          end
        )
      : "-";

  return `${startText} - ${endText}`;
}

function formatDate(
  value
) {
  if (
    !value
  ) {
    return "-";
  }

  const date =
    new Date(
      `${value}T00:00:00`
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

// ==================================================
// STYLES
// ==================================================

const panelStyle = {
  backgroundColor:
    "#ffffff",

  borderRadius:
    "6px",

  overflow:
    "hidden",

  boxShadow:
    "0 1px 5px rgba(0,0,0,0.12)",
};

const titleStyle = {
  backgroundColor:
    "#4f46e5",

  color:
    "#ffffff",

  padding:
    "9px 12px",

  fontSize:
    "14px",

  fontWeight:
    "bold",
};

const privacyNoticeStyle = {
  padding:
    "7px 9px",

  backgroundColor:
    "#eef2ff",

  color:
    "#3730a3",

  fontSize:
    "9px",

  textAlign:
    "center",
};

const messageStyle = {
  margin:
    "7px 8px 0",

  padding:
    "7px",

  borderRadius:
    "4px",

  fontSize:
    "10px",
};

const headerStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "1.3fr 0.8fr 0.8fr 0.9fr",

  gap:
    "5px",

  padding:
    "8px",

  backgroundColor:
    "#f1f5f9",

  fontSize:
    "8px",

  fontWeight:
    "bold",

  textAlign:
    "center",
};

const salaryRowStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "1.3fr 0.8fr 0.8fr 0.9fr",

  gap:
    "5px",

  padding:
    "6px 8px",

  alignItems:
    "center",

  borderTop:
    "1px solid #e2e8f0",

  fontSize:
    "10px",
};

const employeeNameStyle = {
  fontWeight:
    "bold",

  color:
    "#0f172a",
};

const privateStyle = {
  padding:
    "5px",

  borderRadius:
    "4px",

  backgroundColor:
    "#e2e8f0",

  color:
    "#475569",

  textAlign:
    "center",

  fontWeight:
    "bold",
};

const pendingStatusStyle = {
  padding:
    "5px",

  borderRadius:
    "4px",

  backgroundColor:
    "#fef3c7",

  color:
    "#92400e",

  textAlign:
    "center",

  fontWeight:
    "bold",
};

const paidStatusStyle = {
  padding:
    "5px",

  borderRadius:
    "4px",

  backgroundColor:
    "#dcfce7",

  color:
    "#166534",

  textAlign:
    "center",

  fontWeight:
    "bold",
};

const notDueStatusStyle = {
  padding:
    "5px",

  borderRadius:
    "4px",

  backgroundColor:
    "#f1f5f9",

  color:
    "#64748b",

  textAlign:
    "center",

  fontWeight:
    "bold",
};

const lockedStatusStyle = {
  padding:
    "5px",

  borderRadius:
    "4px",

  backgroundColor:
    "#fee2e2",

  color:
    "#991b1b",

  textAlign:
    "center",

  fontWeight:
    "bold",
};

const viewButtonStyle = {
  width:
    "100%",

  padding:
    "6px",

  border:
    "none",

  borderRadius:
    "4px",

  backgroundColor:
    "#4f46e5",

  color:
    "#ffffff",

  fontSize:
    "9px",

  fontWeight:
    "bold",

  cursor:
    "pointer",
};

const lockedStyle = {
  padding:
    "5px",

  borderRadius:
    "4px",

  backgroundColor:
    "#fee2e2",

  color:
    "#991b1b",

  textAlign:
    "center",

  fontSize:
    "8px",

  fontWeight:
    "bold",
};

const unlockedBadgeStyle = {
  padding:
    "5px",

  borderRadius:
    "4px",

  backgroundColor:
    "#dbeafe",

  color:
    "#1d4ed8",

  textAlign:
    "center",

  fontSize:
    "8px",

  fontWeight:
    "bold",
};

const paidPrivateStyle = {
  padding:
    "5px",

  borderRadius:
    "4px",

  backgroundColor:
    "#dcfce7",

  color:
    "#166534",

  textAlign:
    "center",

  fontSize:
    "8px",

  fontWeight:
    "bold",
};

const notDueStyle = {
  padding:
    "5px",

  borderRadius:
    "4px",

  backgroundColor:
    "#f1f5f9",

  color:
    "#64748b",

  textAlign:
    "center",

  fontSize:
    "8px",

  fontWeight:
    "bold",
};

const pinBoxStyle = {
  margin:
    "0 8px 8px",

  padding:
    "9px",

  border:
    "1px solid #a5b4fc",

  backgroundColor:
    "#eef2ff",

  borderRadius:
    "5px",
};

const pinLabelStyle = {
  marginBottom:
    "7px",

  color:
    "#3730a3",

  fontSize:
    "10px",

  fontWeight:
    "bold",
};

const pinGridStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "1fr 100px 80px",

  gap:
    "6px",
};

const pinInputStyle = {
  width:
    "100%",

  boxSizing:
    "border-box",

  padding:
    "8px",

  border:
    "1px solid #818cf8",

  borderRadius:
    "4px",

  textAlign:
    "center",

  fontSize:
    "15px",

  letterSpacing:
    "5px",
};

const pinConfirmButtonStyle = {
  border:
    "none",

  borderRadius:
    "4px",

  backgroundColor:
    "#4f46e5",

  color:
    "#ffffff",

  fontSize:
    "9px",

  fontWeight:
    "bold",

  cursor:
    "pointer",
};

const cancelButtonStyle = {
  border:
    "none",

  borderRadius:
    "4px",

  backgroundColor:
    "#64748b",

  color:
    "#ffffff",

  fontSize:
    "9px",

  fontWeight:
    "bold",

  cursor:
    "pointer",
};

const attemptsStyle = {
  marginTop:
    "6px",

  color:
    "#64748b",

  fontSize:
    "8px",
};

const detailsBoxStyle = {
  margin:
    "0 8px 8px",

  padding:
    "9px",

  border:
    "2px solid #4f46e5",

  backgroundColor:
    "#f8fafc",

  borderRadius:
    "6px",
};

const detailsTitleStyle = {
  marginBottom:
    "8px",

  color:
    "#312e81",

  fontSize:
    "10px",

  fontWeight:
    "bold",
};

const detailsGridStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "repeat(4, minmax(0, 1fr))",

  gap:
    "6px",
};

const detailBoxStyle = {
  padding:
    "7px",

  border:
    "1px solid #cbd5e1",

  borderRadius:
    "4px",

  backgroundColor:
    "#ffffff",

  textAlign:
    "center",
};

const strongDetailBoxStyle = {
  backgroundColor:
    "#dcfce7",

  border:
    "1px solid #86efac",
};

const detailTitleStyle = {
  fontSize:
    "7px",

  color:
    "#64748b",

  fontWeight:
    "bold",
};

const detailValueStyle = {
  marginTop:
    "4px",

  fontSize:
    "10px",

  fontWeight:
    "bold",

  color:
    "#0f172a",
};

const payButtonStyle = {
  width:
    "100%",

  marginTop:
    "9px",

  padding:
    "9px",

  border:
    "none",

  borderRadius:
    "5px",

  backgroundColor:
    "#15803d",

  color:
    "#ffffff",

  fontSize:
    "10px",

  fontWeight:
    "bold",

  cursor:
    "pointer",
};

const tenSecondStyle = {
  marginTop:
    "9px",

  padding:
    "8px",

  borderRadius:
    "4px",

  backgroundColor:
    "#dcfce7",

  color:
    "#166534",

  textAlign:
    "center",

  fontSize:
    "9px",

  fontWeight:
    "bold",
};

const unlockedNoticeStyle = {
  marginTop:
    "6px",

  padding:
    "6px",

  borderRadius:
    "4px",

  backgroundColor:
    "#fff7ed",

  color:
    "#9a3412",

  textAlign:
    "center",

  fontSize:
    "8px",

  fontWeight:
    "bold",
};

const emptyStyle = {
  padding:
    "18px",

  color:
    "#64748b",

  textAlign:
    "center",

  fontSize:
    "10px",
};

const footerStyle = {
  padding:
    "8px",

  borderTop:
    "1px solid #e2e8f0",

  backgroundColor:
    "#f8fafc",

  color:
    "#64748b",

  textAlign:
    "center",

  fontSize:
    "8px",
};
