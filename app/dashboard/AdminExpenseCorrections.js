"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

export default function AdminExpenseCorrections({
  user,
  selectedShift,
  selectedShop,
  onChanged,
}) {
  const EMPTY_ROWS = 10;

  const [expenses, setExpenses] = useState([]);

  const [descriptionInputs, setDescriptionInputs] =
    useState(
      Array(EMPTY_ROWS).fill("")
    );

  const [amountInputs, setAmountInputs] =
    useState(
      Array(EMPTY_ROWS).fill("")
    );

  const [reason, setReason] = useState("");

  const [loading, setLoading] = useState(false);
  const [savingIndex, setSavingIndex] = useState(null);
  const [deletingId, setDeletingId] = useState("");

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const accessToken =
    user?.access_token || null;

  // audit_log.user_id -> profiles.id
  const adminProfileId =
    user?.profile_id || null;

  const shiftId =
    selectedShift?.id || null;

  const shopId =
    selectedShift?.shop_id ||
    selectedShop?.id ||
    null;

  // ==================================================
  // HEADERS
  // ==================================================

  const authHeaders =
    useMemo(() => {
      return {
        apikey:
          supabaseAnonKey,

        Authorization:
          `Bearer ${accessToken}`,

        "Content-Type":
          "application/json",
      };
    }, [
      supabaseAnonKey,
      accessToken,
    ]);

  // ==================================================
  // CURRENT EXPENSE TOTAL
  // ==================================================

  const actualExpenseTotal =
    useMemo(() => {
      return roundMoney(
        expenses.reduce(
          (sum, expense) =>
            sum +
            Number(
              expense.amount || 0
            ),
          0
        )
      );
    }, [expenses]);

  // ==================================================
  // LOAD EXPENSES
  // ==================================================

  const loadExpenses =
    useCallback(
      async () => {
        if (
          !shiftId ||
          !supabaseUrl ||
          !supabaseAnonKey ||
          !accessToken
        ) {
          setExpenses([]);

          setDescriptionInputs(
            Array(EMPTY_ROWS).fill("")
          );

          setAmountInputs(
            Array(EMPTY_ROWS).fill("")
          );

          return;
        }

        try {
          setLoading(true);

          const response =
            await fetch(
              `${supabaseUrl}/rest/v1/expenses` +
                `?shift_id=eq.${encodeURIComponent(
                  shiftId
                )}` +
                `&select=id,shift_id,description,amount,created_by,created_at` +
                `&order=created_at.asc`,
              {
                method: "GET",

                headers:
                  authHeaders,

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
                "Unable to load expenses."
            );
          }

          const loaded =
            Array.isArray(result)
              ? result
              : [];

          setExpenses(
            loaded
          );

          const descriptions =
            Array(
              EMPTY_ROWS
            ).fill("");

          const amounts =
            Array(
              EMPTY_ROWS
            ).fill("");

          for (
            let index = 0;
            index < EMPTY_ROWS;
            index++
          ) {
            const expense =
              loaded[index];

            if (!expense) {
              continue;
            }

            descriptions[index] =
              expense.description ||
              "";

            amounts[index] =
              String(
                expense.amount ??
                  ""
              );
          }

          setDescriptionInputs(
            descriptions
          );

          setAmountInputs(
            amounts
          );
        } catch (error) {
          console.error(
            "LOAD ADMIN EXPENSES ERROR:",
            error
          );

          setMessage(
            error?.message ||
              "Unable to load expenses."
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
        supabaseUrl,
        supabaseAnonKey,
        accessToken,
        authHeaders,
      ]
    );

  // ==================================================
  // SHIFT CHANGED
  // ==================================================

  useEffect(() => {
    setReason("");
    setMessage("");

    loadExpenses();
  }, [loadExpenses]);

  // ==================================================
  // VALIDATE COMMON ACTION
  // ==================================================

  function validateAction() {
    if (!shiftId) {
      setMessage(
        "Select a shift first."
      );

      setMessageType(
        "error"
      );

      return false;
    }

    if (!shopId) {
      setMessage(
        "Shop information is missing."
      );

      setMessageType(
        "error"
      );

      return false;
    }

    if (!adminProfileId) {
      setMessage(
        "Admin profile ID is missing. Please log in again."
      );

      setMessageType(
        "error"
      );

      return false;
    }

    const cleanReason =
      String(
        reason || ""
      ).trim();

    if (
      cleanReason.length < 3
    ) {
      setMessage(
        "Enter an expense correction reason first."
      );

      setMessageType(
        "error"
      );

      return false;
    }

    return true;
  }

  // ==================================================
  // SAVE / UPDATE EXPENSE
  // ==================================================

  async function saveExpense(index) {
    if (!validateAction()) {
      return;
    }

    const existing =
      expenses[index] || null;

    const cleanDescription =
      String(
        descriptionInputs[
          index
        ] || ""
      ).trim();

    const rawAmount =
      amountInputs[
        index
      ];

    const amount =
      Number(
        rawAmount
      );

    if (!cleanDescription) {
      setMessage(
        `Enter a description for Expense ${
          index + 1
        }.`
      );

      setMessageType(
        "error"
      );

      return;
    }

    if (
      rawAmount === "" ||
      Number.isNaN(
        amount
      ) ||
      amount < 0
    ) {
      setMessage(
        `Enter a valid amount for Expense ${
          index + 1
        }.`
      );

      setMessageType(
        "error"
      );

      return;
    }

    const cleanReason =
      String(
        reason
      ).trim();

    const confirmed =
      window.confirm(
        "ADMIN EXPENSE CORRECTION\n\n" +
          `Expense ${
            index + 1
          }\n` +
          `${cleanDescription}\n` +
          `KES ${money(
            amount
          )}\n\n` +
          `${
            existing
              ? "Update this expense?"
              : "Add this expense?"
          }`
      );

    if (!confirmed) {
      return;
    }

    try {
      setSavingIndex(
        index
      );

      setMessage("");
      setMessageType("");

      let changedRecord = null;
      let oldData = {};

      // ==========================================
      // UPDATE EXISTING EXPENSE
      // ==========================================

      if (existing) {
        oldData = {
          ...existing,
        };

        const response =
          await fetch(
            `${supabaseUrl}/rest/v1/expenses` +
              `?id=eq.${encodeURIComponent(
                existing.id
              )}`,
            {
              method:
                "PATCH",

              headers: {
                ...authHeaders,

                Prefer:
                  "return=representation",
              },

              body:
                JSON.stringify({
                  description:
                    cleanDescription,

                  amount:
                    roundMoney(
                      amount
                    ),
                }),
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
              "Unable to update expense."
          );
        }

        if (
          !Array.isArray(
            result
          ) ||
          result.length === 0
        ) {
          throw new Error(
            "Updated expense was not returned."
          );
        }

        changedRecord =
          result[0];
      }

      // ==========================================
      // ADD NEW EXPENSE
      // ==========================================

      else {
        const response =
          await fetch(
            `${supabaseUrl}/rest/v1/expenses`,
            {
              method:
                "POST",

              headers: {
                ...authHeaders,

                Prefer:
                  "return=representation",
              },

              body:
                JSON.stringify({
                  shift_id:
                    shiftId,

                  description:
                    cleanDescription,

                  amount:
                    roundMoney(
                      amount
                    ),

                  created_by:
                    adminProfileId,
                }),
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
              "Unable to add expense."
          );
        }

        if (
          !Array.isArray(
            result
          ) ||
          result.length === 0
        ) {
          throw new Error(
            "Added expense was not returned."
          );
        }

        changedRecord =
          result[0];

        oldData = {
          record_status:
            "NOT_PRESENT",
        };
      }

      // ==========================================
      // RECALCULATE TOTAL EXPENSES
      // ==========================================

      const newExpenseTotal =
        await syncShiftExpenseTotal();

      // ==========================================
      // WRITE AUDIT LOG
      // ==========================================

      const auditOk =
        await writeAudit({
          action:
            existing
              ? "ADMIN_EXPENSE_UPDATE"
              : "ADMIN_EXPENSE_ADD",

          recordId:
            changedRecord.id,

          oldData,

          newData: {
            ...changedRecord,

            correction_reason:
              cleanReason,

            shift_total_expenses:
              newExpenseTotal,
          },
        });

      if (!auditOk) {
        setMessage(
          "Expense was saved, but the audit log could not be written."
        );

        setMessageType(
          "error"
        );
      } else {
        setMessage(
          `Expense ${
            index + 1
          } saved successfully.`
        );

        setMessageType(
          "success"
        );
      }

      setReason("");

      await loadExpenses();

      if (
        typeof onChanged ===
        "function"
      ) {
        await onChanged();
      }
    } catch (error) {
      console.error(
        "SAVE ADMIN EXPENSE ERROR:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to save expense correction."
      );

      setMessageType(
        "error"
      );
    } finally {
      setSavingIndex(
        null
      );
    }
  }

  // ==================================================
  // DELETE EXPENSE
  // ==================================================

  async function deleteExpense({
    expense,
    index,
  }) {
    if (!expense?.id) {
      return;
    }

    if (!validateAction()) {
      return;
    }

    const cleanReason =
      String(
        reason
      ).trim();

    const confirmed =
      window.confirm(
        "ADMIN DELETE EXPENSE\n\n" +
          `${expense.description}\n` +
          `KES ${money(
            expense.amount
          )}\n\n` +
          "Delete this expense permanently?"
      );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(
        expense.id
      );

      setMessage("");
      setMessageType("");

      const oldData = {
        ...expense,
      };

      const response =
        await fetch(
          `${supabaseUrl}/rest/v1/expenses` +
            `?id=eq.${encodeURIComponent(
              expense.id
            )}`,
          {
            method:
              "DELETE",

            headers: {
              ...authHeaders,

              Prefer:
                "return=representation",
            },
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
            "Unable to delete expense."
        );
      }

      // ==========================================
      // RECALCULATE TOTAL EXPENSES
      // ==========================================

      const newExpenseTotal =
        await syncShiftExpenseTotal();

      // ==========================================
      // WRITE AUDIT
      // ==========================================

      const auditOk =
        await writeAudit({
          action:
            "ADMIN_EXPENSE_DELETE",

          recordId:
            expense.id,

          oldData,

          newData: {
            deleted:
              true,

            correction_reason:
              cleanReason,

            shift_id:
              shiftId,

            expense_row:
              index + 1,

            shift_total_expenses:
              newExpenseTotal,
          },
        });

      if (!auditOk) {
        setMessage(
          "Expense was deleted, but the audit log could not be written."
        );

        setMessageType(
          "error"
        );
      } else {
        setMessage(
          `Expense ${
            index + 1
          } deleted successfully.`
        );

        setMessageType(
          "success"
        );
      }

      setReason("");

      await loadExpenses();

      if (
        typeof onChanged ===
        "function"
      ) {
        await onChanged();
      }
    } catch (error) {
      console.error(
        "DELETE ADMIN EXPENSE ERROR:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to delete expense."
      );

      setMessageType(
        "error"
      );
    } finally {
      setDeletingId("");
    }
  }

  // ==================================================
  // SYNC SHIFT TOTAL_EXPENSES
  // ==================================================

  async function syncShiftExpenseTotal() {
    const response =
      await fetch(
        `${supabaseUrl}/rest/v1/expenses` +
          `?shift_id=eq.${encodeURIComponent(
            shiftId
          )}` +
          `&select=id,amount`,
        {
          method:
            "GET",

          headers:
            authHeaders,

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
          "Unable to recalculate total expenses."
      );
    }

    const total =
      roundMoney(
        (
          Array.isArray(
            result
          )
            ? result
            : []
        ).reduce(
          (sum, row) =>
            sum +
            Number(
              row.amount || 0
            ),
          0
        )
      );

    const patchResponse =
      await fetch(
        `${supabaseUrl}/rest/v1/shifts` +
          `?id=eq.${encodeURIComponent(
            shiftId
          )}`,
        {
          method:
            "PATCH",

          headers: {
            ...authHeaders,

            Prefer:
              "return=representation",
          },

          body:
            JSON.stringify({
              total_expenses:
                total,
            }),
        }
      );

    const patchResult =
      await safeJson(
        patchResponse
      );

    if (!patchResponse.ok) {
      throw new Error(
        patchResult?.message ||
          patchResult?.details ||
          patchResult?.hint ||
          "Expense changed, but shift total expenses could not be updated."
      );
    }

    return total;
  }

  // ==================================================
  // WRITE AUDIT LOG
  // ==================================================

  async function writeAudit({
    action,
    recordId,
    oldData,
    newData,
  }) {
    try {
      const response =
        await fetch(
          `${supabaseUrl}/rest/v1/audit_log`,
          {
            method:
              "POST",

            headers: {
              ...authHeaders,

              Prefer:
                "return=representation",
            },

            body:
              JSON.stringify({
                user_id:
                  adminProfileId,

                shop_id:
                  shopId,

                action,

                table_name:
                  "expenses",

                record_id:
                  recordId,

                old_data:
                  oldData || {},

                new_data:
                  newData || {},
              }),
          }
        );

      if (!response.ok) {
        const result =
          await safeJson(
            response
          );

        console.error(
          "EXPENSE AUDIT ERROR:",
          result
        );

        return false;
      }

      return true;
    } catch (error) {
      console.error(
        "EXPENSE AUDIT ERROR:",
        error
      );

      return false;
    }
  }

  // ==================================================
  // DISPLAY
  // ==================================================

  if (!selectedShift) {
    return null;
  }

  return (
    <section style={panelStyle}>
      <div style={titleStyle}>
        EXPENSE CORRECTIONS
      </div>

      <div style={bodyStyle}>
        <div style={summaryGridStyle}>
          <div>
            <small>
              SHIFT TOTAL EXPENSES
            </small>

            <strong>
              KES{" "}
              {money(
                selectedShift.total_expenses
              )}
            </strong>
          </div>

          <div>
            <small>
              ACTUAL EXPENSE RECORDS
            </small>

            <strong>
              KES{" "}
              {money(
                actualExpenseTotal
              )}
            </strong>
          </div>

          <div>
            <small>
              TOTAL MODE
            </small>

            <strong>
              {selectedShift.admin_manual_totals
                ? "MANUAL"
                : "AUTOMATIC"}
            </strong>
          </div>
        </div>

        {selectedShift.admin_manual_totals && (
          <div style={manualWarningStyle}>
            Manual Admin Totals is ON for this shift.
            Expense corrections will update Total Expenses,
            but Net Income and Closing Balance will remain
            at the Admin manual values.
          </div>
        )}

        <div style={headerStyle}>
          <div>
            NO.
          </div>

          <div>
            DESCRIPTION
          </div>

          <div>
            AMOUNT (KES)
          </div>

          <div>
            CURRENT
          </div>

          <div>
            SAVE
          </div>

          <div>
            REMOVE
          </div>
        </div>

        {Array.from(
          {
            length:
              EMPTY_ROWS,
          },
          (_, index) => {
            const expense =
              expenses[index] ||
              null;

            return (
              <div
                key={
                  expense?.id ||
                  `expense-${index}`
                }
                style={rowStyle}
              >
                <div style={numberStyle}>
                  {index + 1}
                </div>

                <input
                  type="text"
                  value={
                    descriptionInputs[
                      index
                    ] || ""
                  }
                  placeholder="Description"
                  onChange={(event) => {
                    const value =
                      event.target.value;

                    setDescriptionInputs(
                      (previous) => {
                        const next = [
                          ...previous,
                        ];

                        next[index] =
                          value;

                        return next;
                      }
                    );

                    setMessage("");
                  }}
                  style={inputStyle}
                />

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    amountInputs[
                      index
                    ] || ""
                  }
                  placeholder="0.00"
                  onChange={(event) => {
                    const value =
                      event.target.value;

                    setAmountInputs(
                      (previous) => {
                        const next = [
                          ...previous,
                        ];

                        next[index] =
                          value;

                        return next;
                      }
                    );

                    setMessage("");
                  }}
                  style={amountInputStyle}
                />

                <div
                  style={
                    expense
                      ? savedStyle
                      : missingStyle
                  }
                >
                  {expense
                    ? `KES ${money(
                        expense.amount
                      )}`
                    : "MISSING"}
                </div>

                <button
                  type="button"
                  disabled={
                    savingIndex ===
                      index ||
                    Boolean(
                      deletingId
                    )
                  }
                  onClick={() =>
                    saveExpense(
                      index
                    )
                  }
                  style={saveButtonStyle}
                >
                  {savingIndex ===
                  index
                    ? "SAVING..."
                    : expense
                    ? "UPDATE"
                    : "ADD"}
                </button>

                {expense ? (
                  <button
                    type="button"
                    disabled={
                      deletingId ===
                        expense.id ||
                      savingIndex !==
                        null
                    }
                    onClick={() =>
                      deleteExpense({
                        expense,
                        index,
                      })
                    }
                    style={deleteButtonStyle}
                  >
                    {deletingId ===
                    expense.id
                      ? "DELETING..."
                      : "DELETE"}
                  </button>
                ) : (
                  <div />
                )}
              </div>
            );
          }
        )}

        <div style={reasonWrapStyle}>
          <label style={labelStyle}>
            EXPENSE CORRECTION REASON *
          </label>

          <textarea
            value={reason}
            onChange={(event) => {
              setReason(
                event.target.value
              );

              setMessage("");
            }}
            rows={2}
            placeholder="Example: Cashier entered Water expense incorrectly."
            style={textareaStyle}
          />
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

        {loading && (
          <div style={loadingStyle}>
            Loading expense records...
          </div>
        )}

        <div style={noticeStyle}>
          Admin can add, update or delete expenses.
          Total Expenses is recalculated automatically,
          and every correction is written to the audit log.
        </div>
      </div>
    </section>
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

function money(value) {
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

function roundMoney(value) {
  return (
    Math.round(
      (Number(value) +
        Number.EPSILON) *
        100
    ) / 100
  );
}

// ==================================================
// STYLES
// ==================================================

const panelStyle = {
  marginTop:
    "18px",

  border:
    "1px solid #fecaca",

  borderRadius:
    "7px",

  overflow:
    "hidden",

  backgroundColor:
    "#ffffff",
};

const titleStyle = {
  backgroundColor:
    "#be123c",

  color:
    "white",

  padding:
    "10px 12px",

  fontWeight:
    "bold",

  fontSize:
    "13px",
};

const bodyStyle = {
  padding:
    "12px",
};

const summaryGridStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "repeat(3,1fr)",

  gap:
    "8px",

  marginBottom:
    "10px",
};

const manualWarningStyle = {
  padding:
    "9px",

  marginBottom:
    "10px",

  backgroundColor:
    "#fef3c7",

  border:
    "1px solid #fde68a",

  color:
    "#92400e",

  borderRadius:
    "5px",

  fontSize:
    "10px",
};

const headerStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "0.35fr 2fr 1fr 1fr 0.75fr 0.75fr",

  gap:
    "7px",

  padding:
    "8px",

  backgroundColor:
    "#ffe4e6",

  color:
    "#9f1239",

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
    "0.35fr 2fr 1fr 1fr 0.75fr 0.75fr",

  gap:
    "7px",

  alignItems:
    "center",

  padding:
    "7px 8px",

  borderTop:
    "1px solid #e2e8f0",

  fontSize:
    "10px",
};

const numberStyle = {
  textAlign:
    "center",

  fontWeight:
    "bold",

  color:
    "#475569",
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
};

const amountInputStyle = {
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

  textAlign:
    "right",
};

const savedStyle = {
  padding:
    "7px",

  backgroundColor:
    "#ecfdf5",

  border:
    "1px solid #86efac",

  color:
    "#166534",

  borderRadius:
    "4px",

  textAlign:
    "center",

  fontWeight:
    "bold",
};

const missingStyle = {
  padding:
    "7px",

  backgroundColor:
    "#f8fafc",

  border:
    "1px solid #cbd5e1",

  color:
    "#64748b",

  borderRadius:
    "4px",

  textAlign:
    "center",

  fontWeight:
    "bold",
};

const saveButtonStyle = {
  border:
    "none",

  borderRadius:
    "4px",

  padding:
    "8px",

  backgroundColor:
    "#e11d48",

  color:
    "white",

  fontWeight:
    "bold",

  cursor:
    "pointer",

  fontSize:
    "9px",
};

const deleteButtonStyle = {
  border:
    "none",

  borderRadius:
    "4px",

  padding:
    "8px",

  backgroundColor:
    "#991b1b",

  color:
    "white",

  fontWeight:
    "bold",

  cursor:
    "pointer",

  fontSize:
    "9px",
};

const reasonWrapStyle = {
  marginTop:
    "12px",
};

const labelStyle = {
  display:
    "block",

  marginBottom:
    "5px",

  fontSize:
    "9px",

  fontWeight:
    "bold",

  color:
    "#334155",
};

const textareaStyle = {
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

  resize:
    "vertical",
};

const messageStyle = {
  marginTop:
    "10px",

  padding:
    "9px",

  borderRadius:
    "5px",

  fontSize:
    "10px",
};

const loadingStyle = {
  padding:
    "10px",

  textAlign:
    "center",

  color:
    "#64748b",

  fontSize:
    "10px",
};

const noticeStyle = {
  marginTop:
    "10px",

  padding:
    "8px",

  backgroundColor:
    "#f8fafc",

  color:
    "#64748b",

  textAlign:
    "center",

  fontSize:
    "9px",
};
