"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

export default function AdminSavingsCorrections({
  user,
  selectedShift,
  selectedShop,
}) {
  const ROWS = 4;

  const [savings, setSavings] = useState([]);

  const [descriptionInputs, setDescriptionInputs] =
    useState(Array(ROWS).fill(""));

  const [amountInputs, setAmountInputs] =
    useState(Array(ROWS).fill(""));

  const [statusInputs, setStatusInputs] =
    useState(Array(ROWS).fill("PENDING"));

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
  // TOTALS
  // ==================================================

  const totals =
    useMemo(() => {
      let total = 0;
      let paid = 0;
      let pending = 0;

      for (const row of savings) {
        const amount =
          Number(
            row.amount || 0
          );

        total += amount;

        if (
          String(
            row.payment_status ||
              ""
          ).toUpperCase() ===
          "PAID"
        ) {
          paid += amount;
        } else {
          pending += amount;
        }
      }

      return {
        total:
          roundMoney(total),

        paid:
          roundMoney(paid),

        pending:
          roundMoney(pending),
      };
    }, [savings]);

  // ==================================================
  // LOAD SAVINGS
  // ==================================================

  const loadSavings =
    useCallback(
      async () => {
        if (
          !shiftId ||
          !supabaseUrl ||
          !supabaseAnonKey ||
          !accessToken
        ) {
          setSavings([]);

          setDescriptionInputs(
            Array(ROWS).fill("")
          );

          setAmountInputs(
            Array(ROWS).fill("")
          );

          setStatusInputs(
            Array(ROWS).fill(
              "PENDING"
            )
          );

          return;
        }

        try {
          setLoading(true);

          const response =
            await fetch(
              `${supabaseUrl}/rest/v1/shift_savings` +
                `?shift_id=eq.${encodeURIComponent(
                  shiftId
                )}` +
                `&select=id,shift_id,description,amount,payment_status,created_at` +
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
                "Unable to load savings."
            );
          }

          const loaded =
            Array.isArray(result)
              ? result
              : [];

          setSavings(loaded);

          const descriptions =
            Array(ROWS).fill("");

          const amounts =
            Array(ROWS).fill("");

          const statuses =
            Array(ROWS).fill(
              "PENDING"
            );

          for (
            let index = 0;
            index < ROWS;
            index++
          ) {
            const row =
              loaded[index];

            if (!row) {
              continue;
            }

            descriptions[index] =
              row.description ||
              "";

            amounts[index] =
              String(
                row.amount ??
                  ""
              );

            statuses[index] =
              String(
                row.payment_status ||
                  "PENDING"
              ).toUpperCase();
          }

          setDescriptionInputs(
            descriptions
          );

          setAmountInputs(
            amounts
          );

          setStatusInputs(
            statuses
          );
        } catch (error) {
          console.error(
            "LOAD ADMIN SAVINGS ERROR:",
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

    loadSavings();
  }, [loadSavings]);

  // ==================================================
  // VALIDATION
  // ==================================================

  function validateAction() {
    if (!shiftId) {
      setMessage(
        "Select a shift first."
      );

      setMessageType("error");

      return false;
    }

    if (!shopId) {
      setMessage(
        "Shop information is missing."
      );

      setMessageType("error");

      return false;
    }

    if (!adminProfileId) {
      setMessage(
        "Admin profile ID is missing. Please log in again."
      );

      setMessageType("error");

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
        "Enter a Savings / Banking correction reason first."
      );

      setMessageType("error");

      return false;
    }

    return true;
  }

  // ==================================================
  // SAVE / UPDATE
  // ==================================================

  async function saveSaving(index) {
    if (!validateAction()) {
      return;
    }

    const existing =
      savings[index] || null;

    const description =
      String(
        descriptionInputs[
          index
        ] || ""
      ).trim();

    const rawAmount =
      amountInputs[index];

    const amount =
      Number(rawAmount);

    const paymentStatus =
      String(
        statusInputs[index] ||
          "PENDING"
      ).toUpperCase();

    if (!description) {
      setMessage(
        `Enter a description for Savings row ${
          index + 1
        }.`
      );

      setMessageType("error");

      return;
    }

    if (
      rawAmount === "" ||
      Number.isNaN(amount) ||
      amount < 0
    ) {
      setMessage(
        `Enter a valid amount for Savings row ${
          index + 1
        }.`
      );

      setMessageType("error");

      return;
    }

    if (
      ![
        "PENDING",
        "PAID",
      ].includes(
        paymentStatus
      )
    ) {
      setMessage(
        "Payment status must be PENDING or PAID."
      );

      setMessageType("error");

      return;
    }

    const cleanReason =
      String(reason).trim();

    const confirmed =
      window.confirm(
        "ADMIN SAVINGS CORRECTION\n\n" +
          `${description}\n` +
          `KES ${money(
            amount
          )}\n` +
          `Status: ${paymentStatus}\n\n` +
          `${
            existing
              ? "Update this record?"
              : "Add this record?"
          }`
      );

    if (!confirmed) {
      return;
    }

    try {
      setSavingIndex(index);

      setMessage("");
      setMessageType("");

      let changedRecord = null;
      let oldData = {};

      // ==========================================
      // UPDATE EXISTING
      // ==========================================

      if (existing) {
        oldData = {
          ...existing,
        };

        const response =
          await fetch(
            `${supabaseUrl}/rest/v1/shift_savings` +
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
                  description,

                  amount:
                    roundMoney(
                      amount
                    ),

                  payment_status:
                    paymentStatus,
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
              "Unable to update savings record."
          );
        }

        if (
          !Array.isArray(
            result
          ) ||
          result.length === 0
        ) {
          throw new Error(
            "Updated savings record was not returned."
          );
        }

        changedRecord =
          result[0];
      }

      // ==========================================
      // ADD NEW
      // ==========================================

      else {
        const response =
          await fetch(
            `${supabaseUrl}/rest/v1/shift_savings`,
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

                  description,

                  amount:
                    roundMoney(
                      amount
                    ),

                  payment_status:
                    paymentStatus,
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
              "Unable to add savings record."
          );
        }

        if (
          !Array.isArray(
            result
          ) ||
          result.length === 0
        ) {
          throw new Error(
            "Added savings record was not returned."
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
      // AUDIT
      // ==========================================

      const auditOk =
        await writeAudit({
          action:
            existing
              ? "ADMIN_SAVINGS_UPDATE"
              : "ADMIN_SAVINGS_ADD",

          recordId:
            changedRecord.id,

          oldData,

          newData: {
            ...changedRecord,

            correction_reason:
              cleanReason,
          },
        });

      if (!auditOk) {
        setMessage(
          "Savings record was saved, but the audit log could not be written."
        );

        setMessageType(
          "error"
        );
      } else {
        setMessage(
          `Savings row ${
            index + 1
          } saved successfully.`
        );

        setMessageType(
          "success"
        );
      }

      setReason("");

      await loadSavings();
    } catch (error) {
      console.error(
        "SAVE ADMIN SAVINGS ERROR:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to save Savings / Banking correction."
      );

      setMessageType(
        "error"
      );
    } finally {
      setSavingIndex(null);
    }
  }

  // ==================================================
  // DELETE
  // ==================================================

  async function deleteSaving({
    row,
    index,
  }) {
    if (!row?.id) {
      return;
    }

    if (!validateAction()) {
      return;
    }

    const cleanReason =
      String(reason).trim();

    const confirmed =
      window.confirm(
        "ADMIN DELETE SAVINGS RECORD\n\n" +
          `${row.description}\n` +
          `KES ${money(
            row.amount
          )}\n` +
          `Status: ${
            row.payment_status
          }\n\n` +
          "Delete this record?"
      );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(
        row.id
      );

      setMessage("");
      setMessageType("");

      const oldData = {
        ...row,
      };

      const response =
        await fetch(
          `${supabaseUrl}/rest/v1/shift_savings` +
            `?id=eq.${encodeURIComponent(
              row.id
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
            "Unable to delete savings record."
        );
      }

      const auditOk =
        await writeAudit({
          action:
            "ADMIN_SAVINGS_DELETE",

          recordId:
            row.id,

          oldData,

          newData: {
            deleted:
              true,

            shift_id:
              shiftId,

            correction_reason:
              cleanReason,

            savings_row:
              index + 1,
          },
        });

      if (!auditOk) {
        setMessage(
          "Savings record was deleted, but the audit log could not be written."
        );

        setMessageType(
          "error"
        );
      } else {
        setMessage(
          `Savings row ${
            index + 1
          } deleted successfully.`
        );

        setMessageType(
          "success"
        );
      }

      setReason("");

      await loadSavings();
    } catch (error) {
      console.error(
        "DELETE ADMIN SAVINGS ERROR:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to delete Savings / Banking record."
      );

      setMessageType(
        "error"
      );
    } finally {
      setDeletingId("");
    }
  }

  // ==================================================
  // AUDIT
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
                  "shift_savings",

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
          "SAVINGS AUDIT ERROR:",
          result
        );

        return false;
      }

      return true;
    } catch (error) {
      console.error(
        "SAVINGS AUDIT ERROR:",
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
        SAVINGS / BANKING CORRECTIONS
      </div>

      <div style={bodyStyle}>
        <div style={summaryGridStyle}>
          <div>
            <small>
              TOTAL SAVINGS
            </small>

            <strong>
              KES{" "}
              {money(
                totals.total
              )}
            </strong>
          </div>

          <div>
            <small>
              PAID
            </small>

            <strong>
              KES{" "}
              {money(
                totals.paid
              )}
            </strong>
          </div>

          <div>
            <small>
              PENDING
            </small>

            <strong>
              KES{" "}
              {money(
                totals.pending
              )}
            </strong>
          </div>
        </div>

        <div style={importantStyle}>
          Savings / Banking does not reduce Total Sales,
          Net Income or Closing Balance.
        </div>

        <div style={headerStyle}>
          <div>
            NO.
          </div>

          <div>
            DESCRIPTION
          </div>

          <div>
            AMOUNT
          </div>

          <div>
            PAYMENT STATUS
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
              ROWS,
          },
          (_, index) => {
            const row =
              savings[index] ||
              null;

            return (
              <div
                key={
                  row?.id ||
                  `saving-${index}`
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
                  style={amountStyle}
                />

                <select
                  value={
                    statusInputs[
                      index
                    ] ||
                    "PENDING"
                  }
                  onChange={(event) => {
                    const value =
                      event.target.value;

                    setStatusInputs(
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
                  style={selectStyle}
                >
                  <option value="PENDING">
                    PENDING
                  </option>

                  <option value="PAID">
                    PAID
                  </option>
                </select>

                <div
                  style={
                    row
                      ? row.payment_status ===
                        "PAID"
                        ? paidStyle
                        : pendingStyle
                      : missingStyle
                  }
                >
                  {row
                    ? `${row.payment_status} • KES ${money(
                        row.amount
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
                    saveSaving(
                      index
                    )
                  }
                  style={saveButtonStyle}
                >
                  {savingIndex ===
                  index
                    ? "SAVING..."
                    : row
                    ? "UPDATE"
                    : "ADD"}
                </button>

                {row ? (
                  <button
                    type="button"
                    disabled={
                      deletingId ===
                        row.id ||
                      savingIndex !==
                        null
                    }
                    onClick={() =>
                      deleteSaving({
                        row,
                        index,
                      })
                    }
                    style={deleteButtonStyle}
                  >
                    {deletingId ===
                    row.id
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
            SAVINGS / BANKING CORRECTION REASON *
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
            placeholder="Example: Cashier marked Daily Banking as Pending instead of Paid."
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
            Loading Savings / Banking records...
          </div>
        )}

        <div style={noticeStyle}>
          Admin can add, update, delete, or change
          PENDING / PAID status. Every change is written
          to the audit log.
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
    "1px solid #bae6fd",

  borderRadius:
    "7px",

  overflow:
    "hidden",

  backgroundColor:
    "#ffffff",
};

const titleStyle = {
  backgroundColor:
    "#0e7490",

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

const importantStyle = {
  backgroundColor:
    "#ecfeff",

  border:
    "1px solid #a5f3fc",

  color:
    "#155e75",

  padding:
    "8px",

  borderRadius:
    "5px",

  marginBottom:
    "10px",

  fontSize:
    "10px",

  fontWeight:
    "bold",
};

const headerStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "0.3fr 1.7fr 0.8fr 1fr 1.2fr 0.7fr 0.7fr",

  gap:
    "7px",

  padding:
    "8px",

  backgroundColor:
    "#cffafe",

  color:
    "#155e75",

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
    "0.3fr 1.7fr 0.8fr 1fr 1.2fr 0.7fr 0.7fr",

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

const amountStyle = {
  ...inputStyle,

  textAlign:
    "right",
};

const selectStyle = {
  width:
    "100%",

  padding:
    "8px",

  border:
    "1px solid #94a3b8",

  borderRadius:
    "4px",

  backgroundColor:
    "white",
};

const paidStyle = {
  padding:
    "7px",

  border:
    "1px solid #86efac",

  backgroundColor:
    "#ecfdf5",

  color:
    "#166534",

  borderRadius:
    "4px",

  textAlign:
    "center",

  fontWeight:
    "bold",
};

const pendingStyle = {
  padding:
    "7px",

  border:
    "1px solid #fde68a",

  backgroundColor:
    "#fef3c7",

  color:
    "#92400e",

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

  border:
    "1px solid #cbd5e1",

  backgroundColor:
    "#f8fafc",

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
    "#0891b2",

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
    "#dc2626",

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
