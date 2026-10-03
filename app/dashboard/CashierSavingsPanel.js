"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

export default function CashierSavingsPanel({
  user,
  currentShift,
}) {
  const [savings, setSavings] =
    useState([]);

  const [inputs, setInputs] =
    useState(
      Array.from(
        { length: 4 },
        () => ({
          description: "",
          amount: "",
        })
      )
    );

  const [
    salaryNames,
    setSalaryNames,
  ] = useState({
    1: "",
    2: "",
  });

  const [
    salaryAmounts,
    setSalaryAmounts,
  ] = useState({
    1: "",
    2: "",
  });

  const [
    loadingSalaryNames,
    setLoadingSalaryNames,
  ] = useState(false);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [
    markingId,
    setMarkingId,
  ] = useState(null);

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

  const shopId =
    currentShift?.shop_id ||
    user?.shop_id ||
    null;

  const shiftName =
    normalizeShiftName(
      currentShift?.shift_name
    );

  const is24HourShift =
    shiftName === "SHIFT 1" ||
    shiftName === "SHIFT 2";

  const actualCashierName =
    String(
      currentShift?.cashier_name ||
        user?.full_name ||
        user?.name ||
        user?.username ||
        ""
    ).trim();

  const salaryName1 =
    String(
      salaryNames[1] || ""
    ).trim();

  const salaryName2 =
    String(
      salaryNames[2] || ""
    ).trim();

  // ==================================================
  // SPLIT 24-HOUR SAVINGS
  //
  // Normal rows stay separate from the permanent
  // salary rows.
  //
  // Salary entries are recognised by their permanent
  // salary descriptions.
  // ==================================================

  const savingsLayout =
    useMemo(() => {
      if (!is24HourShift) {
        return {
          general:
            savings,

          salary1:
            null,

          salary2:
            null,
        };
      }

      return split24HourSavings({
        savings,
        salaryName1,
        salaryName2,
      });
    }, [
      savings,
      is24HourShift,
      salaryName1,
      salaryName2,
    ]);

  const generalSavings =
    is24HourShift
      ? savingsLayout.general
      : savings;

  const salarySaving1 =
    is24HourShift
      ? savingsLayout.salary1
      : null;

  const salarySaving2 =
    is24HourShift
      ? savingsLayout.salary2
      : null;

  // ==================================================
  // LOAD PERMANENT SALARY NAMES
  // 24-HOUR ONLY
  // ==================================================

  const loadSalaryNames =
    useCallback(
      async () => {
        if (
          !is24HourShift ||
          !shopId ||
          !accessToken ||
          !supabaseUrl ||
          !supabaseAnonKey
        ) {
          return;
        }

        try {
          setLoadingSalaryNames(
            true
          );

          const response =
            await fetch(
              `${supabaseUrl}/rest/v1/shop_salary_settings` +
                `?shop_id=eq.${encodeURIComponent(
                  shopId
                )}` +
                `&is_active=eq.true` +
                `&select=id,shop_id,salary_slot,description,is_active` +
                `&order=salary_slot.asc`,
              {
                method:
                  "GET",

                headers: {
                  apikey:
                    supabaseAnonKey,

                  Authorization:
                    `Bearer ${accessToken}`,

                  "Content-Type":
                    "application/json",
                },

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
                "Unable to load salary names."
            );
          }

          const loaded =
            Array.isArray(
              result
            )
              ? result
              : [];

          const next = {
            1: "",
            2: "",
          };

          for (
            const row of loaded
          ) {
            const slot =
              Number(
                row.salary_slot
              );

            if (
              slot === 1 ||
              slot === 2
            ) {
              next[slot] =
                row.description ||
                "";
            }
          }

          setSalaryNames(
            next
          );
        } catch (error) {
          console.error(
            "LOAD SALARY NAMES ERROR:",
            error
          );

          setMessage(
            error?.message ||
              "Unable to load permanent salary names."
          );

          setMessageType(
            "error"
          );
        } finally {
          setLoadingSalaryNames(
            false
          );
        }
      },
      [
        is24HourShift,
        shopId,
        accessToken,
        supabaseUrl,
        supabaseAnonKey,
      ]
    );

  // ==================================================
  // LOAD SALARY NAMES + AUTO REFRESH
  // ==================================================

  useEffect(() => {
    if (!is24HourShift) {
      return;
    }

    loadSalaryNames();

    const timer =
      setInterval(
        loadSalaryNames,
        5000
      );

    return () => {
      clearInterval(
        timer
      );
    };
  }, [
    is24HourShift,
    loadSalaryNames,
  ]);

  // ==================================================
  // LOAD SAVINGS
  // ==================================================

  const loadSavings =
    useCallback(
      async () => {
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
          const response =
            await fetch(
              `${supabaseUrl}/rest/v1/shift_savings` +
                `?shift_id=eq.${encodeURIComponent(
                  shiftId
                )}` +
                `&select=id,shift_id,description,amount,payment_status,created_at` +
                `&order=created_at.asc`,
              {
                method:
                  "GET",

                headers: {
                  apikey:
                    supabaseAnonKey,

                  Authorization:
                    `Bearer ${accessToken}`,

                  "Content-Type":
                    "application/json",
                },

                cache:
                  "no-store",
              }
            );

          let result = null;

          try {
            result =
              await response.json();
          } catch {
            result = null;
          }

          if (!response.ok) {
            throw new Error(
              result?.message ||
                result?.details ||
                "Unable to load savings."
            );
          }

          const loaded =
            Array.isArray(
              result
            )
              ? result
              : [];

          setSavings(
            loaded
          );

          // ==========================================
          // 12-HOUR:
          // Preserve original behaviour.
          //
          // 24-HOUR:
          // Keep first four ordinary rows separate
          // from the two permanent salary rows.
          // ==========================================

          const layout =
            is24HourShift
              ? split24HourSavings({
                  savings:
                    loaded,

                  salaryName1,

                  salaryName2,
                })
              : {
                  general:
                    loaded,

                  salary1:
                    null,

                  salary2:
                    null,
                };

          const loadedGeneral =
            layout.general ||
            [];

          // ==========================================
          // PRESERVE UNSAVED NORMAL ROW TYPING
          // ==========================================

          setInputs(
            (
              previous
            ) => {
              const next =
                Array.from(
                  {
                    length:
                      4,
                  },

                  (
                    _,
                    index
                  ) => ({
                    description:
                      previous[
                        index
                      ]
                        ?.description ||
                      "",

                    amount:
                      previous[
                        index
                      ]
                        ?.amount ||
                      "",
                  })
                );

              for (
                let i = 0;
                i < 4;
                i += 1
              ) {
                if (
                  loadedGeneral[
                    i
                  ]
                ) {
                  next[i] = {
                    description:
                      loadedGeneral[
                        i
                      ]
                        .description ||
                      "",

                    amount:
                      String(
                        loadedGeneral[
                          i
                        ]
                          .amount ??
                          ""
                      ),
                  };
                }
              }

              return next;
            }
          );

          // ==========================================
          // PRESERVE UNSAVED SALARY AMOUNT TYPING
          // ==========================================

          if (
            is24HourShift
          ) {
            setSalaryAmounts(
              (
                previous
              ) => {
                const next = {
                  ...previous,
                };

                if (
                  layout.salary1
                ) {
                  next[1] =
                    String(
                      layout
                        .salary1
                        .amount ??
                        ""
                    );
                }

                if (
                  layout.salary2
                ) {
                  next[2] =
                    String(
                      layout
                        .salary2
                        .amount ??
                        ""
                    );
                }

                return next;
              }
            );
          }
        } catch (error) {
          console.error(
            "LOAD SAVINGS ERROR:",
            error
          );

          setMessage(
            error?.message ||
              "Unable to load savings."
          );

          setMessageType(
            "error"
          );
        } finally {
          setLoading(false);
        }
      },
      [
        shiftId,
        accessToken,
        supabaseUrl,
        supabaseAnonKey,
        is24HourShift,
        salaryName1,
        salaryName2,
      ]
    );

  // ==================================================
  // LOAD + REFRESH
  // ==================================================

  useEffect(() => {
    loadSavings();

    const timer =
      setInterval(
        loadSavings,
        5000
      );

    return () => {
      clearInterval(
        timer
      );
    };
  }, [loadSavings]);

  // ==================================================
  // SAVE SAVINGS
  // ==================================================

  async function saveSavings() {
    if (
      !shiftId ||
      !accessToken
    ) {
      setMessage(
        "Shift or login information is missing."
      );

      setMessageType(
        "error"
      );

      return;
    }

    const rowsToSave =
      [];

    // =================================================
    // FIRST FOUR NORMAL SAVINGS / BANKING ROWS
    // =================================================

    for (
      let i = 0;
      i < 4;
      i += 1
    ) {
      if (
        generalSavings[i]
      ) {
        continue;
      }

      const description =
        String(
          inputs[i]
            ?.description ||
            ""
        ).trim();

      const rawAmount =
        inputs[i]
          ?.amount;

      const hasDescription =
        description !== "";

      const hasAmount =
        rawAmount !== "" &&
        rawAmount !==
          undefined;

      // Blank normal row is allowed.
      if (
        !hasDescription &&
        !hasAmount
      ) {
        continue;
      }

      if (
        !hasDescription
      ) {
        setMessage(
          `Enter the description for Savings ${
            i + 1
          }.`
        );

        setMessageType(
          "error"
        );

        return;
      }

      const amount =
        Number(
          rawAmount
        );

      if (
        !hasAmount ||
        !Number.isFinite(
          amount
        ) ||
        amount <= 0
      ) {
        setMessage(
          `Enter a valid amount for Savings ${
            i + 1
          }.`
        );

        setMessageType(
          "error"
        );

        return;
      }

      rowsToSave.push({
        shift_id:
          shiftId,

        description,

        amount:
          roundMoney(
            amount
          ),

        payment_status:
          "PENDING",
      });
    }

    // =================================================
    // 24-HOUR PERMANENT SALARY ROWS
    // =================================================

    if (
      is24HourShift
    ) {
      const salaryRows = [
        {
          slot:
            1,

          name:
            salaryName1,

          saved:
            salarySaving1,
        },

        {
          slot:
            2,

          name:
            salaryName2,

          saved:
            salarySaving2,
        },
      ];

      for (
        const salary of
        salaryRows
      ) {
        if (
          salary.saved
        ) {
          continue;
        }

        const rawAmount =
          salaryAmounts[
            salary.slot
          ];

        if (
          rawAmount === "" ||
          rawAmount ===
            undefined ||
          rawAmount ===
            null
        ) {
          continue;
        }

        if (
          !salary.name
        ) {
          setMessage(
            `Salary Row ${salary.slot} has no permanent name. Ask Admin to configure it.`
          );

          setMessageType(
            "error"
          );

          return;
        }

        const amount =
          Number(
            rawAmount
          );

        if (
          !Number.isFinite(
            amount
          ) ||
          amount <= 0
        ) {
          setMessage(
            `Enter a valid amount for ${salary.name}.`
          );

          setMessageType(
            "error"
          );

          return;
        }

        rowsToSave.push({
          shift_id:
            shiftId,

          description:
            salary.name,

          amount:
            roundMoney(
              amount
            ),

          payment_status:
            "PENDING",
        });
      }
    }

    if (
      rowsToSave.length ===
      0
    ) {
      setMessage(
        "Enter at least one savings, banking, or salary amount."
      );

      setMessageType(
        "error"
      );

      return;
    }

    try {
      setSaving(
        true
      );

      setMessage("");
      setMessageType("");

      const response =
        await fetch(
          `${supabaseUrl}/rest/v1/shift_savings`,
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

              Prefer:
                "return=representation",
            },

            body:
              JSON.stringify(
                rowsToSave
              ),
          }
        );

      let result = null;

      try {
        result =
          await response.json();
      } catch {
        result = null;
      }

      if (!response.ok) {
        throw new Error(
          result?.message ||
            result?.details ||
            result?.hint ||
            "Unable to save savings."
        );
      }

      setMessage(
        is24HourShift
          ? "Savings / Banking / Salary saved successfully."
          : "Savings saved successfully."
      );

      setMessageType(
        "success"
      );

      await loadSavings();
    } catch (error) {
      console.error(
        "SAVE SAVINGS ERROR:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to save savings."
      );

      setMessageType(
        "error"
      );
    } finally {
      setSaving(
        false
      );
    }
  }

  // ==================================================
  // MARK AS PAID
  // ==================================================

  async function markAsPaid(
    row
  ) {
    if (
      !row?.id ||
      !accessToken
    ) {
      return;
    }

    try {
      setMarkingId(
        row.id
      );

      setMessage("");
      setMessageType("");

      const response =
        await fetch(
          `${supabaseUrl}/rest/v1/shift_savings` +
            `?id=eq.${encodeURIComponent(
              row.id
            )}`,
          {
            method:
              "PATCH",

            headers: {
              apikey:
                supabaseAnonKey,

              Authorization:
                `Bearer ${accessToken}`,

              "Content-Type":
                "application/json",

              Prefer:
                "return=representation",
            },

            body:
              JSON.stringify({
                payment_status:
                  "PAID",
              }),
          }
        );

      let result = null;

      try {
        result =
          await response.json();
      } catch {
        result = null;
      }

      if (!response.ok) {
        throw new Error(
          result?.message ||
            result?.details ||
            result?.hint ||
            "Unable to mark savings as paid."
        );
      }

      setMessage(
        "Payment marked as PAID."
      );

      setMessageType(
        "success"
      );

      await loadSavings();
    } catch (error) {
      console.error(
        "MARK SAVINGS PAID ERROR:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to update payment status."
      );

      setMessageType(
        "error"
      );
    } finally {
      setMarkingId(
        null
      );
    }
  }

  // ==================================================
  // TOTALS
  // ==================================================

  const totals =
    useMemo(() => {
      let pending = 0;
      let paid = 0;

      for (
        const row of savings
      ) {
        const amount =
          Number(
            row.amount ||
              0
          );

        if (
          row.payment_status ===
          "PAID"
        ) {
          paid += amount;
        } else {
          pending += amount;
        }
      }

      return {
        pending:
          roundMoney(
            pending
          ),

        paid:
          roundMoney(
            paid
          ),

        total:
          roundMoney(
            pending +
              paid
          ),
      };
    }, [savings]);

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
        SAVINGS / BANKING
      </div>

      {is24HourShift && (
        <div
          style={
            cashierBarStyle
          }
        >
          SHIFT CASHIER:{" "}
          <strong>
            {actualCashierName ||
              "-"}
          </strong>
        </div>
      )}

      <div
        style={
          headerStyle
        }
      >
        <div>
          DESCRIPTION
        </div>

        <div>
          AMOUNT (KES)
        </div>

        <div>
          PAYMENT STATUS
        </div>
      </div>

      {/* =============================================
          FIRST FOUR NORMAL SAVINGS / BANKING ROWS
      ============================================== */}

      {Array.from(
        {
          length:
            4,
        },

        (
          _,
          index
        ) => {
          const saved =
            generalSavings[
              index
            ];

          if (saved) {
            return (
              <SavedSavingsRow
                key={
                  saved.id ||
                  `saved-${index}`
                }
                saved={
                  saved
                }
                markingId={
                  markingId
                }
                onMarkPaid={
                  markAsPaid
                }
              />
            );
          }

          return (
            <div
              key={`new-${index}`}
              style={
                rowStyle
              }
            >
              <input
                type="text"
                value={
                  inputs[
                    index
                  ]
                    ?.description ||
                  ""
                }
                disabled={
                  saving
                }
                placeholder={
                  index === 0
                    ? "Description"
                    : index === 1
                    ? "Example: Banking / Rent / DSTV"
                    : "Description"
                }
                onChange={(
                  event
                ) => {
                  const value =
                    event
                      .target
                      .value;

                  setInputs(
                    (
                      previous
                    ) => {
                      const next =
                        previous.map(
                          (
                            row
                          ) => ({
                            ...row,
                          })
                        );

                      next[
                        index
                      ].description =
                        value;

                      return next;
                    }
                  );

                  setMessage(
                    ""
                  );
                }}
                style={
                  inputStyle
                }
              />

              <input
                type="number"
                min="0"
                step="0.01"
                value={
                  inputs[
                    index
                  ]
                    ?.amount ||
                  ""
                }
                disabled={
                  saving
                }
                placeholder="0.00"
                onChange={(
                  event
                ) => {
                  const value =
                    event
                      .target
                      .value;

                  setInputs(
                    (
                      previous
                    ) => {
                      const next =
                        previous.map(
                          (
                            row
                          ) => ({
                            ...row,
                          })
                        );

                      next[
                        index
                      ].amount =
                        value;

                      return next;
                    }
                  );

                  setMessage(
                    ""
                  );
                }}
                style={{
                  ...inputStyle,

                  textAlign:
                    "right",
                }}
              />

              <div
                style={
                  newPendingStyle
                }
              >
                PENDING
              </div>
            </div>
          );
        }
      )}

      {/* =============================================
          24-HOUR PERMANENT SALARY ROWS
      ============================================== */}

      {is24HourShift && (
        <>
          <SalaryRow
            slot={1}
            salaryName={
              salaryName1
            }
            saved={
              salarySaving1
            }
            amount={
              salaryAmounts[
                1
              ]
            }
            saving={
              saving
            }
            markingId={
              markingId
            }
            loadingName={
              loadingSalaryNames
            }
            onAmountChange={(
              value
            ) => {
              setSalaryAmounts(
                (
                  previous
                ) => ({
                  ...previous,

                  1:
                    value,
                })
              );

              setMessage(
                ""
              );
            }}
            onMarkPaid={
              markAsPaid
            }
          />

          <SalaryRow
            slot={2}
            salaryName={
              salaryName2
            }
            saved={
              salarySaving2
            }
            amount={
              salaryAmounts[
                2
              ]
            }
            saving={
              saving
            }
            markingId={
              markingId
            }
            loadingName={
              loadingSalaryNames
            }
            onAmountChange={(
              value
            ) => {
              setSalaryAmounts(
                (
                  previous
                ) => ({
                  ...previous,

                  2:
                    value,
                })
              );

              setMessage(
                ""
              );
            }}
            onMarkPaid={
              markAsPaid
            }
          />
        </>
      )}

      <div
        style={
          totalStyle
        }
      >
        <strong>
          TOTAL SAVINGS
        </strong>

        <strong>
          {money(
            totals.total
          )}
        </strong>
      </div>

      <div
        style={
          summaryStyle
        }
      >
        <span>
          Pending:{" "}
          <strong>
            KES{" "}
            {money(
              totals.pending
            )}
          </strong>
        </span>

        <span>
          Paid:{" "}
          <strong>
            KES{" "}
            {money(
              totals.paid
            )}
          </strong>
        </span>
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

      {!loading && (
        <div
          style={
            buttonWrapStyle
          }
        >
          <button
            type="button"
            onClick={
              saveSavings
            }
            disabled={
              saving
            }
            style={
              saveButtonStyle
            }
          >
            {saving
              ? "Saving..."
              : is24HourShift
              ? "Save Savings / Banking / Salary"
              : "Save Savings / Banking"}
          </button>
        </div>
      )}

      <div
        style={
          noteStyle
        }
      >
        {is24HourShift
          ? "Savings / Banking / Salary belongs to this shift and does not reduce Closing Balance."
          : "Savings / Banking does not reduce Closing Balance."}
      </div>
    </section>
  );
}

// ==================================================
// SAVED ROW
// ==================================================

function SavedSavingsRow({
  saved,
  markingId,
  onMarkPaid,
}) {
  const isPaid =
    saved.payment_status ===
    "PAID";

  return (
    <div
      style={
        rowStyle
      }
    >
      <div
        style={
          savedBoxStyle
        }
      >
        {saved.description}
      </div>

      <div
        style={{
          ...savedBoxStyle,

          textAlign:
            "right",
        }}
      >
        {money(
          saved.amount
        )}
      </div>

      <div>
        {isPaid ? (
          <div
            style={
              paidStyle
            }
          >
            PAID ✓
          </div>
        ) : (
          <button
            type="button"
            onClick={() =>
              onMarkPaid(
                saved
              )
            }
            disabled={
              markingId ===
              saved.id
            }
            style={
              pendingButtonStyle
            }
          >
            {markingId ===
            saved.id
              ? "Saving..."
              : "PENDING"}
          </button>
        )}
      </div>
    </div>
  );
}

// ==================================================
// PERMANENT SALARY ROW
// ==================================================

function SalaryRow({
  slot,
  salaryName,
  saved,
  amount,
  saving,
  markingId,
  loadingName,
  onAmountChange,
  onMarkPaid,
}) {
  if (saved) {
    return (
      <SavedSavingsRow
        saved={
          saved
        }
        markingId={
          markingId
        }
        onMarkPaid={
          onMarkPaid
        }
      />
    );
  }

  const hasName =
    String(
      salaryName || ""
    ).trim() !== "";

  return (
    <div
      style={
        salaryRowStyle
      }
    >
      <div
        style={
          fixedSalaryNameStyle
        }
      >
        {loadingName &&
        !hasName
          ? `Loading Salary Row ${slot}...`
          : hasName
          ? salaryName
          : `SALARY ROW ${slot} — ADMIN SETUP REQUIRED`}
      </div>

      <input
        type="number"
        min="0"
        step="0.01"
        value={
          amount || ""
        }
        disabled={
          saving ||
          !hasName
        }
        placeholder={
          hasName
            ? "0.00"
            : "Locked"
        }
        onChange={(
          event
        ) =>
          onAmountChange(
            event.target.value
          )
        }
        style={{
          ...inputStyle,

          textAlign:
            "right",

          backgroundColor:
            hasName
              ? "white"
              : "#f1f5f9",

          cursor:
            hasName
              ? "text"
              : "not-allowed",
        }}
      />

      <div
        style={
          salaryPendingStyle
        }
      >
        PENDING
      </div>
    </div>
  );
}

// ==================================================
// 24-HOUR SAVINGS SPLITTER
// ==================================================

function split24HourSavings({
  savings,
  salaryName1,
  salaryName2,
}) {
  const general = [];

  let salary1 =
    null;

  let salary2 =
    null;

  const name1 =
    normalizeDescription(
      salaryName1
    );

  const name2 =
    normalizeDescription(
      salaryName2
    );

  for (
    const row of savings
  ) {
    const description =
      normalizeDescription(
        row?.description
      );

    if (
      name1 &&
      description ===
        name1 &&
      !salary1
    ) {
      salary1 =
        row;

      continue;
    }

    if (
      name2 &&
      description ===
        name2 &&
      !salary2
    ) {
      salary2 =
        row;

      continue;
    }

    general.push(
      row
    );
  }

  return {
    general,
    salary1,
    salary2,
  };
}

// ==================================================
// HELPERS
// ==================================================

function normalizeDescription(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .toUpperCase()
    .replace(
      /\s+/g,
      " "
    );
}

function normalizeShiftName(
  value
) {
  const text =
    String(
      value || ""
    )
      .trim()
      .toUpperCase()
      .replace(
        /[_-]+/g,
        " "
      )
      .replace(
        /\s+/g,
        " "
      );

  if (
    text === "SHIFT1" ||
    text === "SHIFT 1"
  ) {
    return "SHIFT 1";
  }

  if (
    text === "SHIFT2" ||
    text === "SHIFT 2"
  ) {
    return "SHIFT 2";
  }

  return text;
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
    ) / 100
  );
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
// STYLES
// ==================================================

const panelStyle = {
  backgroundColor:
    "white",

  borderRadius:
    "6px",

  overflow:
    "hidden",

  boxShadow:
    "0 1px 5px rgba(0,0,0,0.12)",
};

const titleStyle = {
  backgroundColor:
    "#0873b9",

  color:
    "white",

  padding:
    "9px 12px",

  fontSize:
    "14px",

  fontWeight:
    "bold",
};

const cashierBarStyle = {
  padding:
    "7px 10px",

  backgroundColor:
    "#eff6ff",

  borderBottom:
    "1px solid #bfdbfe",

  color:
    "#1e3a8a",

  textAlign:
    "center",

  fontSize:
    "10px",
};

const headerStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "1.35fr 0.85fr 0.9fr",

  gap:
    "6px",

  padding:
    "8px",

  backgroundColor:
    "#eef4f8",

  fontSize:
    "9px",

  fontWeight:
    "bold",

  textAlign:
    "center",
};

const rowStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "1.35fr 0.85fr 0.9fr",

  gap:
    "6px",

  padding:
    "4px 8px",

  alignItems:
    "center",

  borderTop:
    "1px solid #e5e7eb",
};

const salaryRowStyle = {
  ...rowStyle,

  backgroundColor:
    "#f8fafc",
};

const inputStyle = {
  width:
    "100%",

  boxSizing:
    "border-box",

  padding:
    "6px",

  border:
    "1px solid #cbd5e1",

  borderRadius:
    "4px",

  fontSize:
    "11px",
};

const savedBoxStyle = {
  padding:
    "6px",

  border:
    "1px solid #86efac",

  backgroundColor:
    "#ecfdf5",

  borderRadius:
    "4px",

  fontSize:
    "11px",
};

const fixedSalaryNameStyle = {
  padding:
    "6px",

  border:
    "1px solid #93c5fd",

  backgroundColor:
    "#eff6ff",

  color:
    "#1e3a8a",

  borderRadius:
    "4px",

  fontSize:
    "10px",

  fontWeight:
    "bold",
};

const newPendingStyle = {
  padding:
    "6px",

  borderRadius:
    "4px",

  backgroundColor:
    "#fef3c7",

  color:
    "#92400e",

  textAlign:
    "center",

  fontSize:
    "10px",

  fontWeight:
    "bold",
};

const salaryPendingStyle = {
  ...newPendingStyle,

  backgroundColor:
    "#dbeafe",

  color:
    "#1e40af",
};

const pendingButtonStyle = {
  width:
    "100%",

  padding:
    "6px",

  border:
    "none",

  borderRadius:
    "4px",

  backgroundColor:
    "#facc15",

  color:
    "#713f12",

  cursor:
    "pointer",

  fontSize:
    "10px",

  fontWeight:
    "bold",
};

const paidStyle = {
  padding:
    "6px",

  borderRadius:
    "4px",

  backgroundColor:
    "#dcfce7",

  color:
    "#166534",

  textAlign:
    "center",

  fontSize:
    "10px",

  fontWeight:
    "bold",
};

const totalStyle = {
  display:
    "flex",

  justifyContent:
    "space-between",

  padding:
    "10px",

  backgroundColor:
    "#dcfce7",

  borderTop:
    "1px solid #bbf7d0",

  fontSize:
    "12px",
};

const summaryStyle = {
  display:
    "flex",

  justifyContent:
    "space-between",

  gap:
    "10px",

  padding:
    "8px 10px",

  fontSize:
    "10px",

  color:
    "#475569",
};

const buttonWrapStyle = {
  padding:
    "8px",
};

const saveButtonStyle = {
  width:
    "100%",

  padding:
    "9px",

  border:
    "none",

  borderRadius:
    "5px",

  backgroundColor:
    "#0873b9",

  color:
    "white",

  fontWeight:
    "bold",

  cursor:
    "pointer",
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

const noteStyle = {
  padding:
    "0 9px 9px",

  color:
    "#64748b",

  fontSize:
    "9px",
};
