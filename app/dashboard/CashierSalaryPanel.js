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

  const lockTimersRef =
    useRef({});

  const pinTimersRef =
    useRef({});

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
// PROFESSIONAL MATTE BLACK STYLES
// ==================================================

const panelStyle = {
  minWidth:
    0,

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
    "13px 15px",

  background:
    "linear-gradient(145deg, rgba(215,179,106,0.15), rgba(17,22,28,0.98))",

  color:
    "#FFFFFF",

  borderBottom:
    "1px solid rgba(215,179,106,0.34)",

  borderLeft:
    "4px solid #D7B36A",

  fontSize:
    "15px",

  fontWeight:
    950,

  letterSpacing:
    "0.5px",
};


const privacyNoticeStyle = {
  padding:
    "9px 12px",

  backgroundColor:
    "#0D1115",

  color:
    "#FFFFFF",

  borderBottom:
    "1px solid #292F36",

  fontSize:
    "11px",

  textAlign:
    "center",

  lineHeight:
    1.45,
};


const messageStyle = {
  margin:
    "8px",

  padding:
    "9px",

  borderRadius:
    "7px",

  fontSize:
    "11px",

  fontWeight:
    800,
};


const headerStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "1.3fr 0.8fr 0.8fr 0.9fr",

  gap:
    "5px",

  padding:
    "9px",

  backgroundColor:
    "#11161C",

  color:
    "#FFFFFF",

  borderBottom:
    "1px solid #343C45",

  fontSize:
    "10px",

  fontWeight:
    900,

  textAlign:
    "center",

  letterSpacing:
    "0.35px",
};


const salaryRowStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "1.3fr 0.8fr 0.8fr 0.9fr",

  gap:
    "6px",

  padding:
    "8px",

  alignItems:
    "center",

  backgroundColor:
    "#0D1115",

  borderBottom:
    "1px solid #252B31",

  color:
    "#FFFFFF",

  fontSize:
    "11px",
};


const employeeNameStyle = {
  fontWeight:
    900,

  color:
    "#FFFFFF",
};


const privateStyle = {
  padding:
    "6px",

  borderRadius:
    "6px",

  backgroundColor:
    "#171C22",

  border:
    "1px solid #424B55",

  color:
    "#FFFFFF",

  textAlign:
    "center",

  fontWeight:
    900,

  fontSize:
    "9px",
};


// ==================================================
// STATUS BADGES
// ==================================================

const pendingStatusStyle = {
  padding:
    "6px",

  borderRadius:
    "6px",

  backgroundColor:
    "#171C22",

  color:
    "#FFFFFF",

  border:
    "1px solid rgba(215,179,106,0.48)",

  textAlign:
    "center",

  fontWeight:
    900,

  fontSize:
    "9px",
};


const paidStatusStyle = {
  padding:
    "6px",

  borderRadius:
    "6px",

  backgroundColor:
    "#10261A",

  color:
    "#FFFFFF",

  border:
    "1px solid #2F6B47",

  textAlign:
    "center",

  fontWeight:
    900,

  fontSize:
    "9px",
};


const notDueStatusStyle = {
  padding:
    "6px",

  borderRadius:
    "6px",

  backgroundColor:
    "#171C22",

  color:
    "#FFFFFF",

  border:
    "1px solid #424B55",

  textAlign:
    "center",

  fontWeight:
    900,

  fontSize:
    "9px",
};


const lockedStatusStyle = {
  padding:
    "6px",

  borderRadius:
    "6px",

  backgroundColor:
    "#2C1619",

  color:
    "#FFFFFF",

  border:
    "1px solid #79363C",

  textAlign:
    "center",

  fontWeight:
    900,

  fontSize:
    "9px",
};


// ==================================================
// ACTION / STATE
// ==================================================

const viewButtonStyle = {
  width:
    "100%",

  minHeight:
    "34px",

  padding:
    "7px",

  border:
    "1px solid rgba(215,179,106,0.45)",

  borderRadius:
    "7px",

  background:
    "linear-gradient(145deg, rgba(215,179,106,0.15), #11161C)",

  color:
    "#FFFFFF",

  fontSize:
    "10px",

  fontWeight:
    900,

  cursor:
    "pointer",
};


const lockedStyle = {
  padding:
    "6px",

  borderRadius:
    "6px",

  backgroundColor:
    "#2C1619",

  border:
    "1px solid #79363C",

  color:
    "#FFFFFF",

  textAlign:
    "center",

  fontSize:
    "9px",

  fontWeight:
    900,
};


const unlockedBadgeStyle = {
  padding:
    "6px",

  borderRadius:
    "6px",

  backgroundColor:
    "#171C22",

  border:
    "1px solid rgba(215,179,106,0.48)",

  color:
    "#FFFFFF",

  textAlign:
    "center",

  fontSize:
    "9px",

  fontWeight:
    900,
};


const paidPrivateStyle = {
  padding:
    "6px",

  borderRadius:
    "6px",

  backgroundColor:
    "#10261A",

  border:
    "1px solid #2F6B47",

  color:
    "#FFFFFF",

  textAlign:
    "center",

  fontSize:
    "9px",

  fontWeight:
    900,
};


const notDueStyle = {
  padding:
    "6px",

  borderRadius:
    "6px",

  backgroundColor:
    "#171C22",

  border:
    "1px solid #424B55",

  color:
    "#FFFFFF",

  textAlign:
    "center",

  fontSize:
    "9px",

  fontWeight:
    900,
};


// ==================================================
// PIN BOX
// ==================================================

const pinBoxStyle = {
  margin:
    "8px",

  padding:
    "10px",

  border:
    "1px solid rgba(215,179,106,0.48)",

  background:
    "linear-gradient(145deg, #151A20, #0C1014)",

  borderRadius:
    "9px",
};


const pinLabelStyle = {
  marginBottom:
    "7px",

  color:
    "#FFFFFF",

  fontSize:
    "11px",

  fontWeight:
    900,
};


const pinGridStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "1fr 100px 80px",

  gap:
    "7px",
};


const pinInputStyle = {
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

  textAlign:
    "center",

  fontSize:
    "15px",

  fontWeight:
    900,

  letterSpacing:
    "5px",

  outline:
    "none",
};


const pinConfirmButtonStyle = {
  border:
    "1px solid rgba(215,179,106,0.48)",

  borderRadius:
    "7px",

  background:
    "linear-gradient(145deg, rgba(215,179,106,0.15), #11161C)",

  color:
    "#FFFFFF",

  fontSize:
    "9px",

  fontWeight:
    900,

  cursor:
    "pointer",
};


const cancelButtonStyle = {
  border:
    "1px solid #454E58",

  borderRadius:
    "7px",

  backgroundColor:
    "#171C22",

  color:
    "#FFFFFF",

  fontSize:
    "9px",

  fontWeight:
    900,

  cursor:
    "pointer",
};


const attemptsStyle = {
  marginTop:
    "7px",

  color:
    "#AAB2BC",

  fontSize:
    "9px",

  lineHeight:
    1.45,
};


// ==================================================
// PRIVATE DETAILS
// ==================================================

const detailsBoxStyle = {
  margin:
    "8px",

  padding:
    "10px",

  border:
    "1px solid rgba(215,179,106,0.50)",

  background:
    "linear-gradient(145deg, #151A20, #0B0F13)",

  borderRadius:
    "9px",
};


const detailsTitleStyle = {
  marginBottom:
    "9px",

  color:
    "#FFFFFF",

  fontSize:
    "11px",

  fontWeight:
    950,

  letterSpacing:
    "0.3px",
};


const detailsGridStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "repeat(4, minmax(0, 1fr))",

  gap:
    "7px",
};


const detailBoxStyle = {
  padding:
    "8px",

  border:
    "1px solid #39424C",

  borderRadius:
    "7px",

  backgroundColor:
    "#080B0E",

  textAlign:
    "center",

  color:
    "#FFFFFF",
};


const strongDetailBoxStyle = {
  background:
    "linear-gradient(145deg, rgba(215,179,106,0.13), #0D1115)",

  border:
    "1px solid rgba(215,179,106,0.52)",
};


const detailTitleStyle = {
  fontSize:
    "8px",

  color:
    "#AAB2BC",

  fontWeight:
    900,
};


const detailValueStyle = {
  marginTop:
    "4px",

  fontSize:
    "11px",

  fontWeight:
    950,

  color:
    "#FFFFFF",
};


const payButtonStyle = {
  width:
    "100%",

  marginTop:
    "9px",

  minHeight:
    "38px",

  padding:
    "9px",

  border:
    "1px solid rgba(215,179,106,0.52)",

  borderRadius:
    "7px",

  background:
    "linear-gradient(145deg, rgba(215,179,106,0.17), #11161C)",

  color:
    "#FFFFFF",

  fontSize:
    "10px",

  fontWeight:
    950,

  cursor:
    "pointer",
};


const tenSecondStyle = {
  marginTop:
    "9px",

  padding:
    "8px",

  borderRadius:
    "7px",

  backgroundColor:
    "#10261A",

  border:
    "1px solid #2F6B47",

  color:
    "#FFFFFF",

  textAlign:
    "center",

  fontSize:
    "9px",

  fontWeight:
    900,
};


const unlockedNoticeStyle = {
  marginTop:
    "7px",

  padding:
    "7px",

  borderRadius:
    "7px",

  backgroundColor:
    "#171C22",

  border:
    "1px solid #424B55",

  color:
    "#FFFFFF",

  textAlign:
    "center",

  fontSize:
    "9px",

  fontWeight:
    800,
};


const emptyStyle = {
  padding:
    "20px",

  backgroundColor:
    "#0D1115",

  color:
    "#FFFFFF",

  textAlign:
    "center",

  fontSize:
    "11px",

  fontWeight:
    750,
};


const footerStyle = {
  padding:
    "9px 10px",

  borderTop:
    "1px solid #292F36",

  backgroundColor:
    "#0D1115",

  color:
    "#AAB2BC",

  textAlign:
    "center",

  fontSize:
    "9px",

  lineHeight:
    1.45,
};
