"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

export default function AdminFloatCorrections({
  user,
  selectedShift,
  selectedShop,
  onChanged,
}) {
  const [entries, setEntries] = useState([]);

  const [companyInputs, setCompanyInputs] = useState([
    "",
    "",
    "",
  ]);

  const [mshwariInputs, setMshwariInputs] = useState([
    "",
    "",
    "",
  ]);

  const [reason, setReason] = useState("");

  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState("");
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
  // SPLIT SAVED FLOATS
  // ==================================================

  const companyEntries =
    useMemo(() => {
      return entries.filter(
        (entry) =>
          entry.entry_type ===
          "COMPANY_FLOAT"
      );
    }, [entries]);

  const mshwariEntries =
    useMemo(() => {
      return entries.filter(
        (entry) =>
          entry.entry_type ===
          "MSHWARI_FLOAT"
      );
    }, [entries]);

  const totalSavedFloat =
    useMemo(() => {
      return roundMoney(
        entries.reduce(
          (sum, entry) => {
            if (
              entry.entry_type !==
                "COMPANY_FLOAT" &&
              entry.entry_type !==
                "MSHWARI_FLOAT"
            ) {
              return sum;
            }

            return (
              sum +
              Number(
                entry.amount || 0
              )
            );
          },
          0
        )
      );
    }, [entries]);

  // ==================================================
  // LOAD FLOAT ENTRIES
  // ==================================================

  const loadEntries =
    useCallback(
      async () => {
        if (
          !shiftId ||
          !supabaseUrl ||
          !supabaseAnonKey ||
          !accessToken
        ) {
          setEntries([]);

          setCompanyInputs([
            "",
            "",
            "",
          ]);

          setMshwariInputs([
            "",
            "",
            "",
          ]);

          return;
        }

        try {
          setLoading(true);

          const response =
            await fetch(
              `${supabaseUrl}/rest/v1/shift_income_entries` +
                `?shift_id=eq.${encodeURIComponent(
                  shiftId
                )}` +
                `&entry_type=in.(COMPANY_FLOAT,MSHWARI_FLOAT)` +
                `&select=id,shift_id,entry_type,description,amount,created_at` +
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
                "Unable to load float entries."
            );
          }

          const loaded =
            Array.isArray(result)
              ? result
              : [];

          setEntries(
            loaded
          );

          const company =
            loaded.filter(
              (entry) =>
                entry.entry_type ===
                "COMPANY_FLOAT"
            );

          const mshwari =
            loaded.filter(
              (entry) =>
                entry.entry_type ===
                "MSHWARI_FLOAT"
            );

          setCompanyInputs([
            company[0]
              ? String(
                  company[0].amount ??
                    ""
                )
              : "",

            company[1]
              ? String(
                  company[1].amount ??
                    ""
                )
              : "",

            company[2]
              ? String(
                  company[2].amount ??
                    ""
                )
              : "",
          ]);

          setMshwariInputs([
            mshwari[0]
              ? String(
                  mshwari[0].amount ??
                    ""
                )
              : "",

            mshwari[1]
              ? String(
                  mshwari[1].amount ??
                    ""
                )
              : "",

            mshwari[2]
              ? String(
                  mshwari[2].amount ??
                    ""
                )
              : "",
          ]);
        } catch (error) {
          console.error(
            "LOAD ADMIN FLOATS ERROR:",
            error
          );

          setMessage(
            error?.message ||
              "Unable to load floats."
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
  // AUTO LOAD WHEN SHIFT CHANGES
  // ==================================================

  useEffect(() => {
    setReason("");
    setMessage("");

    loadEntries();
  }, [loadEntries]);

  // ==================================================
  // VALIDATE COMMON REQUIREMENTS
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
        "Enter a correction reason before changing a float."
      );

      setMessageType(
        "error"
      );

      return false;
    }

    return true;
  }

  // ==================================================
  // ADD OR UPDATE FLOAT
  // ==================================================

  async function saveFloat({
    type,
    index,
  }) {
    if (!validateAction()) {
      return;
    }

    const isCompany =
      type ===
      "COMPANY_FLOAT";

    const savedEntry =
      isCompany
        ? companyEntries[index]
        : mshwariEntries[index];

    const rawValue =
      isCompany
        ? companyInputs[index]
        : mshwariInputs[index];

    const amount =
      Number(rawValue);

    if (
      rawValue === "" ||
      Number.isNaN(amount) ||
      amount <= 0
    ) {
      setMessage(
        "Enter a valid float amount greater than zero."
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

    const label =
      isCompany
        ? `Company Float ${
            index + 1
          }`
        : `M-Shwari Float ${
            index + 1
          }`;

    const confirmed =
      window.confirm(
        "ADMIN FLOAT CORRECTION\n\n" +
          `${label}: KES ${money(
            amount
          )}\n\n` +
          `${
            savedEntry
              ? "Update this float?"
              : "Add this float?"
          }`
      );

    if (!confirmed) {
      return;
    }

    const actionKey =
      `${type}-${index}`;

    try {
      setSavingKey(
        actionKey
      );

      setMessage("");
      setMessageType("");

      let changedRecord = null;
      let oldData = {};

      // ==========================================
      // UPDATE EXISTING
      // ==========================================

      if (savedEntry) {
        oldData = {
          ...savedEntry,
        };

        const response =
          await fetch(
            `${supabaseUrl}/rest/v1/shift_income_entries` +
              `?id=eq.${encodeURIComponent(
                savedEntry.id
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
                  amount:
                    roundMoney(
                      amount
                    ),

                  description:
                    savedEntry.description ||
                    defaultDescription(
                      type,
                      index
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
              "Unable to update float."
          );
        }

        if (
          !Array.isArray(
            result
          ) ||
          result.length === 0
        ) {
          throw new Error(
            "Updated float was not returned."
          );
        }

        changedRecord =
          result[0];
      }

      // ==========================================
      // ADD MISSING FLOAT
      // ==========================================

      else {
        const response =
          await fetch(
            `${supabaseUrl}/rest/v1/shift_income_entries`,
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

                  entry_type:
                    type,

                  description:
                    defaultDescription(
                      type,
                      index
                    ),

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
              "Unable to add float."
          );
        }

        if (
          !Array.isArray(
            result
          ) ||
          result.length === 0
        ) {
          throw new Error(
            "Added float was not returned."
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
      // SYNC SHIFT TOTAL FLOAT
      // ==========================================

      const newShiftTotal =
        await syncShiftFloatTotal();

      // ==========================================
      // AUDIT LOG
      // ==========================================

      const auditOk =
        await writeAudit({
          action:
            savedEntry
              ? "ADMIN_FLOAT_UPDATE"
              : "ADMIN_FLOAT_ADD",

          recordId:
            changedRecord.id,

          oldData,

          newData: {
            ...changedRecord,

            correction_reason:
              cleanReason,

            shift_total_added_float:
              newShiftTotal,
          },
        });

      if (!auditOk) {
        setMessage(
          "Float was saved, but the audit record could not be written."
        );

        setMessageType(
          "error"
        );
      } else {
        setMessage(
          `${label} saved successfully.`
        );

        setMessageType(
          "success"
        );
      }

      setReason("");

      await loadEntries();

      if (
        typeof onChanged ===
        "function"
      ) {
        await onChanged();
      }
    } catch (error) {
      console.error(
        "SAVE ADMIN FLOAT ERROR:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to save float correction."
      );

      setMessageType(
        "error"
      );
    } finally {
      setSavingKey("");
    }
  }

  // ==================================================
  // DELETE FLOAT
  // ==================================================

  async function deleteFloat({
    entry,
    type,
    index,
  }) {
    if (!entry?.id) {
      return;
    }

    if (!validateAction()) {
      return;
    }

    const cleanReason =
      String(
        reason
      ).trim();

    const label =
      type ===
      "COMPANY_FLOAT"
        ? `Company Float ${
            index + 1
          }`
        : `M-Shwari Float ${
            index + 1
          }`;

    const confirmed =
      window.confirm(
        "ADMIN DELETE FLOAT\n\n" +
          `${label}: KES ${money(
            entry.amount
          )}\n\n` +
          "Delete this float permanently?"
      );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(
        entry.id
      );

      setMessage("");
      setMessageType("");

      const oldData = {
        ...entry,
      };

      const response =
        await fetch(
          `${supabaseUrl}/rest/v1/shift_income_entries` +
            `?id=eq.${encodeURIComponent(
              entry.id
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
            "Unable to delete float."
        );
      }

      const newShiftTotal =
        await syncShiftFloatTotal();

      const auditOk =
        await writeAudit({
          action:
            "ADMIN_FLOAT_DELETE",

          recordId:
            entry.id,

          oldData,

          newData: {
            deleted:
              true,

            correction_reason:
              cleanReason,

            shift_id:
              shiftId,

            entry_type:
              type,

            shift_total_added_float:
              newShiftTotal,
          },
        });

      if (!auditOk) {
        setMessage(
          "Float was deleted, but the audit record could not be written."
        );

        setMessageType(
          "error"
        );
      } else {
        setMessage(
          `${label} deleted successfully.`
        );

        setMessageType(
          "success"
        );
      }

      setReason("");

      await loadEntries();

      if (
        typeof onChanged ===
        "function"
      ) {
        await onChanged();
      }
    } catch (error) {
      console.error(
        "DELETE ADMIN FLOAT ERROR:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to delete float."
      );

      setMessageType(
        "error"
      );
    } finally {
      setDeletingId("");
    }
  }

  // ==================================================
  // RECALCULATE + PATCH SHIFT TOTAL_ADDED_FLOAT
  // ==================================================

  async function syncShiftFloatTotal() {
    const response =
      await fetch(
        `${supabaseUrl}/rest/v1/shift_income_entries` +
          `?shift_id=eq.${encodeURIComponent(
            shiftId
          )}` +
          `&entry_type=in.(COMPANY_FLOAT,MSHWARI_FLOAT)` +
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
          "Unable to recalculate total float."
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
              total_added_float:
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
          "Float changed, but shift total could not be updated."
      );
    }

    return total;
  }

  // ==================================================
  // WRITE AUDIT
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
                  "shift_income_entries",

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
          "FLOAT AUDIT ERROR:",
          result
        );

        return false;
      }

      return true;
    } catch (error) {
      console.error(
        "FLOAT AUDIT ERROR:",
        error
      );

      return false;
    }
  }

  // ==================================================
  // RENDER ONE FLOAT ROW
  // ==================================================

  function renderFloatRow({
    type,
    index,
  }) {
    const isCompany =
      type ===
      "COMPANY_FLOAT";

    const savedEntry =
      isCompany
        ? companyEntries[index]
        : mshwariEntries[index];

    const inputs =
      isCompany
        ? companyInputs
        : mshwariInputs;

    const setInputs =
      isCompany
        ? setCompanyInputs
        : setMshwariInputs;

    const actionKey =
      `${type}-${index}`;

    const label =
      isCompany
        ? `Company Float ${
            index + 1
          }`
        : `M-Shwari Float ${
            index + 1
          }`;

    return (
      <div
        key={actionKey}
        style={rowStyle}
      >
        <div>
          <strong>
            {label}
          </strong>

          <div style={rowMetaStyle}>
            {savedEntry
              ? "Saved record"
              : "No record yet"}
          </div>
        </div>

        <input
          type="number"
          min="0"
          step="0.01"
          value={
            inputs[index] || ""
          }
          onChange={(event) => {
            const value =
              event.target.value;

            setInputs(
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
            savedEntry
              ? savedBadgeStyle
              : missingBadgeStyle
          }
        >
          {savedEntry
            ? `KES ${money(
                savedEntry.amount
              )}`
            : "MISSING"}
        </div>

        <button
          type="button"
          disabled={
            savingKey ===
              actionKey ||
            Boolean(
              deletingId
            )
          }
          onClick={() =>
            saveFloat({
              type,
              index,
            })
          }
          style={saveRowButtonStyle}
        >
          {savingKey ===
          actionKey
            ? "SAVING..."
            : savedEntry
            ? "UPDATE"
            : "ADD"}
        </button>

        {savedEntry ? (
          <button
            type="button"
            disabled={
              deletingId ===
                savedEntry.id ||
              Boolean(
                savingKey
              )
            }
            onClick={() =>
              deleteFloat({
                entry:
                  savedEntry,

                type,

                index,
              })
            }
            style={deleteButtonStyle}
          >
            {deletingId ===
            savedEntry.id
              ? "DELETING..."
              : "DELETE"}
          </button>
        ) : (
          <div />
        )}
      </div>
    );
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
        FLOAT CORRECTIONS
      </div>

      <div style={bodyStyle}>
        <div style={topInfoStyle}>
          <div>
            <small>
              CURRENT SHIFT FLOAT
            </small>

            <strong>
              KES{" "}
              {money(
                selectedShift.total_added_float
              )}
            </strong>
          </div>

          <div>
            <small>
              ACTUAL FLOAT RECORDS
            </small>

            <strong>
              KES{" "}
              {money(
                totalSavedFloat
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
            Float corrections will update the float records and
            Total Added Float, but Net Income and Closing Balance
            will remain at the Admin manual values.
          </div>
        )}

        <div style={headerStyle}>
          <div>
            FLOAT
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

        <div style={groupTitleStyle}>
          COMPANY FLOAT
        </div>

        {Array.from(
          { length: 3 },
          (_, index) =>
            renderFloatRow({
              type:
                "COMPANY_FLOAT",

              index,
            })
        )}

        <div style={groupTitleStyle}>
          M-SHWARI FLOAT
        </div>

        {Array.from(
          { length: 3 },
          (_, index) =>
            renderFloatRow({
              type:
                "MSHWARI_FLOAT",

              index,
            })
        )}

        <div style={reasonWrapStyle}>
          <label style={labelStyle}>
            FLOAT CORRECTION REASON *
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
            placeholder="Example: Cashier entered Company Float 1 incorrectly."
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
            Loading float records...
          </div>
        )}

        <div style={noticeStyle}>
          Admin can add, update or delete Company and M-Shwari
          floats. Every change is recorded in the audit log.
        </div>
      </div>
    </section>
  );
}

// ==================================================
// DEFAULT DESCRIPTION
// ==================================================

function defaultDescription(
  type,
  index
) {
  if (
    type ===
    "COMPANY_FLOAT"
  ) {
    return `Float ${
      index + 1
    } from company`;
  }

  return `Float ${
    index + 1
  } from M-Shwari`;
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
    "1px solid #dbeafe",

  borderRadius:
    "7px",

  overflow:
    "hidden",

  backgroundColor:
    "#ffffff",
};

const titleStyle = {
  backgroundColor:
    "#0369a1",

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

const topInfoStyle = {
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
    "1.5fr 1fr 1fr 0.75fr 0.75fr",

  gap:
    "7px",

  padding:
    "8px",

  backgroundColor:
    "#e0f2fe",

  color:
    "#0c4a6e",

  fontSize:
    "9px",

  fontWeight:
    "bold",

  textAlign:
    "center",
};

const groupTitleStyle = {
  padding:
    "7px 8px",

  backgroundColor:
    "#f8fafc",

  color:
    "#334155",

  fontSize:
    "10px",

  fontWeight:
    "bold",

  borderTop:
    "1px solid #e2e8f0",
};

const rowStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "1.5fr 1fr 1fr 0.75fr 0.75fr",

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

const rowMetaStyle = {
  marginTop:
    "2px",

  color:
    "#64748b",

  fontSize:
    "8px",
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

const savedBadgeStyle = {
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

const missingBadgeStyle = {
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

const saveRowButtonStyle = {
  border:
    "none",

  borderRadius:
    "4px",

  padding:
    "8px",

  backgroundColor:
    "#0284c7",

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
