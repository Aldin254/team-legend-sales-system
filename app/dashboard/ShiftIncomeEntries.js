"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

export default function ShiftIncomeEntries({
  user,
  currentShift,
}) {
  const [entries, setEntries] =
    useState([]);

  const [amount, setAmount] =
    useState("");

  const [description, setDescription] =
    useState(
      "Float from M-Shwari"
    );

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [messageType, setMessageType] =
    useState("");

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const accessToken =
    user?.access_token ||
    null;

  const shiftId =
    currentShift?.id ||
    null;

  // ==================================================
  // AUTH HEADERS
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
  // SYNC SHIFT TOTAL ADDED FLOAT
  //
  // COMPANY FLOAT
  // + M-SHWARI FLOAT
  // ==================================================

  const syncShiftTotalAdded =
    useCallback(
      async (
        totalAdded
      ) => {
        if (
          !shiftId ||
          !accessToken ||
          !supabaseUrl ||
          !supabaseAnonKey
        ) {
          return;
        }

        const response =
          await fetch(
            `${supabaseUrl}/rest/v1/shifts` +
              `?id=eq.${encodeURIComponent(
                shiftId
              )}`,
            {
              method:
                "PATCH",

              headers: {
                ...authHeaders(),

                Prefer:
                  "return=minimal",
              },

              body:
                JSON.stringify({
                  total_added_float:
                    roundMoney(
                      totalAdded
                    ),
                }),
            }
          );

        if (!response.ok) {
          const result =
            await safeJson(
              response
            );

          throw new Error(
            result?.message ||
              result?.details ||
              result?.hint ||
              "Unable to update total added float."
          );
        }
      },
      [
        shiftId,
        accessToken,
        supabaseUrl,
        supabaseAnonKey,
        authHeaders,
      ]
    );

  // ==================================================
  // LOAD FLOAT ENTRIES
  // ==================================================

  const loadEntries =
    useCallback(
      async (
        options = {}
      ) => {
        const silent =
          options?.silent ===
          true;

        if (
          !shiftId ||
          !accessToken ||
          !supabaseUrl ||
          !supabaseAnonKey
        ) {
          setEntries([]);
          setLoading(false);
          return;
        }

        try {
          if (!silent) {
            setLoading(true);
          }

          const response =
            await fetch(
              `${supabaseUrl}/rest/v1/shift_income_entries` +
                `?shift_id=eq.${encodeURIComponent(
                  shiftId
                )}` +
                `&select=id,shift_id,entry_type,description,amount,created_at` +
                `&order=created_at.asc`,
              {
                method:
                  "GET",

                headers:
                  authHeaders(),

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

          const loadedEntries =
            Array.isArray(
              result
            )
              ? result
              : [];

          setEntries(
            loadedEntries
          );

          const totalAdded =
            calculateTotalAdded(
              loadedEntries
            );

          await syncShiftTotalAdded(
            totalAdded
          );
        } catch (error) {
          console.error(
            "LOAD FLOAT ENTRIES ERROR:",
            error
          );

          if (!silent) {
            setMessage(
              error?.message ||
                "Unable to load float entries."
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
        authHeaders,
        syncShiftTotalAdded,
      ]
    );

  // ==================================================
  // INITIAL LOAD + AUTO REFRESH
  //
  // Accountant → Cashier transfers can arrive at any
  // time. Cashier sees them automatically.
  // ==================================================

  useEffect(() => {
    loadEntries();

    const timer =
      setInterval(
        () => {
          loadEntries({
            silent:
              true,
          });
        },
        5000
      );

    return () => {
      clearInterval(
        timer
      );
    };
  }, [
    loadEntries,
  ]);

  // ==================================================
  // COMPANY FLOAT ENTRIES
  //
  // READ ONLY.
  // These may only come from Legend Accounts.
  // ==================================================

  const companyFloatEntries =
    useMemo(
      () =>
        entries
          .filter(
            (entry) =>
              entry.entry_type ===
              "COMPANY_FLOAT"
          )
          .sort(
            (
              a,
              b
            ) =>
              new Date(
                a.created_at
              ).getTime() -
              new Date(
                b.created_at
              ).getTime()
          ),
      [
        entries,
      ]
    );

  // ==================================================
  // COMPANY FLOAT SLOT MAP
  //
  // Accountant-generated entries use descriptions:
  //
  // Float 1 from company
  // Float 2 from company
  // Float 3 from company
  //
  // Older entries without a numbered description
  // fall back to their sequential position.
  // ==================================================

  const companyFloatSlots =
    useMemo(
      () => {
        const slots = [
          null,
          null,
          null,
        ];

        const unassigned =
          [];

        for (
          const entry of companyFloatEntries
        ) {
          const slot =
            getCompanyFloatSlot(
              entry?.description
            );

          if (
            slot >= 1 &&
            slot <= 3 &&
            !slots[
              slot - 1
            ]
          ) {
            slots[
              slot - 1
            ] =
              entry;
          } else {
            unassigned.push(
              entry
            );
          }
        }

        for (
          const entry of unassigned
        ) {
          const emptyIndex =
            slots.findIndex(
              (item) =>
                !item
            );

          if (
            emptyIndex ===
            -1
          ) {
            break;
          }

          slots[
            emptyIndex
          ] =
            entry;
        }

        return slots;
      },
      [
        companyFloatEntries,
      ]
    );

  // ==================================================
  // M-SHWARI ENTRIES
  // ==================================================

  const mshwariEntries =
    useMemo(
      () =>
        entries
          .filter(
            (entry) =>
              entry.entry_type ===
              "MSHWARI_FLOAT"
          )
          .sort(
            (
              a,
              b
            ) =>
              new Date(
                a.created_at
              ).getTime() -
              new Date(
                b.created_at
              ).getTime()
          ),
      [
        entries,
      ]
    );

  // ==================================================
  // TOTALS
  // ==================================================

  const totals =
    useMemo(
      () => {
        let company =
          0;

        let mshwari =
          0;

        for (
          const entry of entries
        ) {
          const value =
            Number(
              entry?.amount ??
                0
            );

          if (
            !Number.isFinite(
              value
            )
          ) {
            continue;
          }

          if (
            entry.entry_type ===
            "COMPANY_FLOAT"
          ) {
            company +=
              value;
          }

          if (
            entry.entry_type ===
            "MSHWARI_FLOAT"
          ) {
            mshwari +=
              value;
          }
        }

        return {
          company:
            roundMoney(
              company
            ),

          mshwari:
            roundMoney(
              mshwari
            ),

          total:
            roundMoney(
              company +
                mshwari
            ),
        };
      },
      [
        entries,
      ]
    );

  // ==================================================
  // ADD M-SHWARI FLOAT
  //
  // COMPANY FLOAT CANNOT BE CREATED HERE.
  // ==================================================

  async function addMshwariFloat() {
    if (
      saving
    ) {
      return;
    }

    if (!shiftId) {
      setMessage(
        "No open shift was found."
      );

      setMessageType(
        "error"
      );

      return;
    }

    if (!accessToken) {
      setMessage(
        "Authentication is missing. Please log in again."
      );

      setMessageType(
        "error"
      );

      return;
    }

    const numericAmount =
      Number(
        amount
      );

    if (
      amount === "" ||
      !Number.isFinite(
        numericAmount
      ) ||
      numericAmount <= 0
    ) {
      setMessage(
        "Enter a valid M-Shwari amount greater than zero."
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
          `${supabaseUrl}/rest/v1/shift_income_entries`,
          {
            method:
              "POST",

            headers: {
              ...authHeaders(),

              Prefer:
                "return=representation",
            },

            body:
              JSON.stringify({
                shift_id:
                  shiftId,

                entry_type:
                  "MSHWARI_FLOAT",

                description:
                  String(
                    description ||
                      ""
                  ).trim() ||
                  "Float from M-Shwari",

                amount:
                  roundMoney(
                    numericAmount
                  ),
              }),
          }
        );

      const result =
        await safeJson(
          response
        );

      if (!response.ok) {
        console.error(
          "MSHWARI FLOAT INSERT ERROR:",
          result
        );

        throw new Error(
          result?.message ||
            result?.details ||
            result?.hint ||
            "Unable to save M-Shwari float."
        );
      }

      const insertedRow =
        Array.isArray(
          result
        ) &&
        result.length >
          0
          ? result[0]
          : null;

      if (!insertedRow) {
        throw new Error(
          "M-Shwari float was saved but no record was returned."
        );
      }

      const updatedEntries = [
        ...entries,
        insertedRow,
      ];

      setEntries(
        updatedEntries
      );

      await syncShiftTotalAdded(
        calculateTotalAdded(
          updatedEntries
        )
      );

      setAmount("");

      setDescription(
        "Float from M-Shwari"
      );

      setMessage(
        "M-Shwari float saved successfully."
      );

      setMessageType(
        "success"
      );
    } catch (error) {
      console.error(
        "SAVE MSHWARI FLOAT ERROR:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to save M-Shwari float."
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
  // DISPLAY
  // ==================================================

  if (!currentShift) {
    return null;
  }

  return (
    <section style={panelStyle}>
      <div style={titleStyle}>
        FLOAT / INCOME ENTRIES
      </div>

      <div style={subtitleStyle}>
        Company Float is controlled by Legend Accounts.
      </div>

      {/* ========================================== */}
      {/* SUMMARY */}
      {/* ========================================== */}

      <div style={summaryGridStyle}>
        <SummaryCard
          title="Company Float"
          value={
            totals.company
          }
        />

        <SummaryCard
          title="M-Shwari Float"
          value={
            totals.mshwari
          }
        />

        <SummaryCard
          title="Total Added"
          value={
            totals.total
          }
        />
      </div>

      {/* ========================================== */}
      {/* COMPANY FLOAT - READ ONLY */}
      {/* ========================================== */}

      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>
          COMPANY FLOAT
        </div>

        <div style={companyNoticeStyle}>
          <strong>
            READ ONLY
          </strong>
          {" — "}
          Company Float can only be added by Legend Accounts.
          Cashiers cannot enter, change or overwrite these values.
        </div>

        <div style={companyFloatGridStyle}>
          {[1, 2, 3].map(
            (slot) => {
              const entry =
                companyFloatSlots[
                  slot - 1
                ];

              return (
                <CompanyFloatCard
                  key={
                    slot
                  }
                  slot={
                    slot
                  }
                  entry={
                    entry
                  }
                />
              );
            }
          )}
        </div>
      </div>
{/* ========================================== */}
      {/* M-SHWARI FLOAT */}
      {/* ========================================== */}

      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>
          M-SHWARI FLOAT
        </div>

        <div style={mshwariNoticeStyle}>
          M-Shwari Float remains a cashier entry.
        </div>

        <label style={labelStyle}>
          Description
        </label>

        <input
          type="text"
          value={
            description
          }
          disabled={
            saving
          }
          onChange={(
            event
          ) => {
            setDescription(
              event.target
                .value
            );

            setMessage("");
            setMessageType("");
          }}
          style={inputStyle}
        />

        <label style={labelStyle}>
          Amount (KES)
        </label>

        <input
          type="number"
          min="0"
          step="0.01"
          value={
            amount
          }
          disabled={
            saving
          }
          onChange={(
            event
          ) => {
            setAmount(
              event.target
                .value
            );

            setMessage("");
            setMessageType("");
          }}
          placeholder="Enter M-Shwari amount"
          style={inputStyle}
        />

        {message && (
          <div
            style={
              messageType ===
              "success"
                ? successStyle
                : errorStyle
            }
          >
            {message}
          </div>
        )}

        <button
          type="button"
          onClick={
            addMshwariFloat
          }
          disabled={
            saving ||
            loading
          }
          style={{
            ...saveButtonStyle,

            backgroundColor:
              saving ||
              loading
                ? "#94a3b8"
                : "#168d32",

            cursor:
              saving ||
              loading
                ? "not-allowed"
                : "pointer",
          }}
        >
          {saving
            ? "Saving..."
            : "Add M-Shwari Float"}
        </button>
      </div>

      {/* ========================================== */}
      {/* M-SHWARI HISTORY */}
      {/* ========================================== */}

      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>
          M-SHWARI HISTORY
        </div>

        {loading ? (
          <div style={emptyStyle}>
            Loading...
          </div>
        ) : mshwariEntries.length ===
          0 ? (
          <div style={emptyStyle}>
            No M-Shwari float has been added during this shift.
          </div>
        ) : (
          mshwariEntries.map(
            (
              entry
            ) => (
              <div
                key={
                  entry.id
                }
                style={historyRowStyle}
              >
                <div>
                  <strong>
                    M-Shwari Float
                  </strong>

                  <div style={historyDescriptionStyle}>
                    {entry.description ||
                      "Float from M-Shwari"}
                  </div>

                  <div style={historyDateStyle}>
                    {formatDate(
                      entry.created_at
                    )}
                  </div>
                </div>

                <strong style={historyAmountStyle}>
                  KES{" "}
                  {money(
                    entry.amount
                  )}
                </strong>
              </div>
            )
          )
        )}
      </div>
    </section>
  );
}

// ==================================================
// COMPANY FLOAT CARD
// ==================================================

function CompanyFloatCard({
  slot,
  entry,
}) {
  const hasValue =
    Boolean(
      entry
    );

  return (
    <div
      style={{
        ...companyFloatCardStyle,

        backgroundColor:
          hasValue
            ? "#ecfdf5"
            : "#f8fafc",

        borderColor:
          hasValue
            ? "#86efac"
            : "#cbd5e1",
      }}
    >
      <div style={companyFloatLabelStyle}>
        Company Float{" "}
        {slot}
      </div>

      <div
        style={{
          ...companyFloatValueStyle,

          color:
            hasValue
              ? "#166534"
              : "#64748b",
        }}
      >
        KES{" "}
        {money(
          entry?.amount ??
            0
        )}
      </div>

      <div
        style={
          hasValue
            ? receivedBadgeStyle
            : lockedBadgeStyle
        }
      >
        {hasValue
          ? "RECEIVED ✓"
          : "LOCKED"}
      </div>

      {hasValue && (
        <>
          <div style={companyFloatDescriptionStyle}>
            {entry?.description ||
              `Float ${slot} from company`}
          </div>

          <div style={companyFloatDateStyle}>
            {formatDate(
              entry?.created_at
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ==================================================
// SUMMARY CARD
// ==================================================

function SummaryCard({
  title,
  value,
}) {
  return (
    <div style={summaryCardStyle}>
      <div style={summaryLabelStyle}>
        {title}
      </div>

      <div style={summaryValueStyle}>
        KES{" "}
        {money(
          value
        )}
      </div>
    </div>
  );
}

// ==================================================
// TOTAL ADDED FLOAT
//
// COMPANY + M-SHWARI ONLY
// ==================================================

function calculateTotalAdded(
  entries
) {
  let total =
    0;

  for (
    const entry of entries
  ) {
    if (
      entry.entry_type !==
        "COMPANY_FLOAT" &&
      entry.entry_type !==
        "MSHWARI_FLOAT"
    ) {
      continue;
    }

    const amount =
      Number(
        entry?.amount ??
          0
      );

    if (
      Number.isFinite(
        amount
      )
    ) {
      total +=
        amount;
    }
  }

  return roundMoney(
    total
  );
}

// ==================================================
// COMPANY FLOAT SLOT
// ==================================================

function getCompanyFloatSlot(
  description
) {
  const text =
    String(
      description ||
        ""
    )
      .trim()
      .toLowerCase();

  const match =
    text.match(
      /float\s*([123])\s*from\s*company/
    );

  if (!match) {
    return null;
  }

  const slot =
    Number(
      match[1]
    );

  return (
    Number.isInteger(
      slot
    ) &&
    slot >= 1 &&
    slot <= 3
  )
    ? slot
    : null;
}

// ==================================================
// SAFE JSON
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

// ==================================================
// MONEY
// ==================================================

function money(
  value
) {
  return Number(
    value ??
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

// ==================================================
// DATE
// ==================================================

function formatDate(
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

        year:
          "numeric",

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

// ==================================================
// STYLES
// ==================================================

const panelStyle = {
  marginTop:
    "24px",

  backgroundColor:
    "white",

  padding:
    "20px",

  borderRadius:
    "10px",

  boxShadow:
    "0 2px 10px rgba(0,0,0,0.08)",

  maxWidth:
    "750px",
};

const titleStyle = {
  fontSize:
    "18px",

  fontWeight:
    "900",

  color:
    "#0f172a",
};

const subtitleStyle = {
  marginTop:
    "5px",

  marginBottom:
    "18px",

  color:
    "#64748b",

  fontSize:
    "11px",
};

const summaryGridStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "repeat(3,minmax(0,1fr))",

  gap:
    "10px",

  marginBottom:
    "18px",
};

const summaryCardStyle = {
  padding:
    "12px",

  backgroundColor:
    "#f8fafc",

  border:
    "1px solid #e2e8f0",

  borderRadius:
    "7px",
};

const summaryLabelStyle = {
  color:
    "#64748b",

  fontSize:
    "10px",
};

const summaryValueStyle = {
  marginTop:
    "5px",

  fontWeight:
    "bold",

  fontSize:
    "14px",
};

const sectionStyle = {
  marginTop:
    "18px",

  paddingTop:
    "16px",

  borderTop:
    "1px solid #e2e8f0",
};

const sectionTitleStyle = {
  fontWeight:
    "900",

  fontSize:
    "13px",

  marginBottom:
    "10px",
};

const companyNoticeStyle = {
  padding:
    "10px",

  marginBottom:
    "12px",

  border:
    "1px solid #bae6fd",

  borderRadius:
    "5px",

  backgroundColor:
    "#f0f9ff",

  color:
    "#075985",

  fontSize:
    "10px",

  lineHeight:
    "1.5",
};

const mshwariNoticeStyle = {
  padding:
    "8px",

  marginBottom:
    "12px",

  borderRadius:
    "5px",

  backgroundColor:
    "#f8fafc",

  color:
    "#64748b",

  fontSize:
    "10px",
};

const companyFloatGridStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "repeat(auto-fit,minmax(180px,1fr))",

  gap:
    "10px",
};

const companyFloatCardStyle = {
  border:
    "1px solid",

  borderRadius:
    "7px",

  padding:
    "12px",
};

const companyFloatLabelStyle = {
  color:
    "#475569",

  fontSize:
    "10px",

  fontWeight:
    "bold",
};

const companyFloatValueStyle = {
  marginTop:
    "6px",

  fontSize:
    "17px",

  fontWeight:
    "900",
};

const receivedBadgeStyle = {
  display:
    "inline-block",

  marginTop:
    "8px",

  padding:
    "4px 7px",

  borderRadius:
    "12px",

  backgroundColor:
    "#16a34a",

  color:
    "white",

  fontSize:
    "8px",

  fontWeight:
    "bold",
};

const lockedBadgeStyle = {
  display:
    "inline-block",

  marginTop:
    "8px",

  padding:
    "4px 7px",

  borderRadius:
    "12px",

  backgroundColor:
    "#e2e8f0",

  color:
    "#475569",

  fontSize:
    "8px",

  fontWeight:
    "bold",
};

const companyFloatDescriptionStyle = {
  marginTop:
    "8px",

  color:
    "#475569",

  fontSize:
    "9px",
};

const companyFloatDateStyle = {
  marginTop:
    "3px",

  color:
    "#94a3b8",

  fontSize:
    "8px",
};

const labelStyle = {
  display:
    "block",

  fontWeight:
    "bold",

  fontSize:
    "11px",

  marginBottom:
    "6px",
};

const inputStyle = {
  width:
    "100%",

  boxSizing:
    "border-box",

  padding:
    "10px",

  border:
    "1px solid #cbd5e1",

  borderRadius:
    "6px",

  marginBottom:
    "12px",

  fontSize:
    "13px",
};

const saveButtonStyle = {
  width:
    "100%",

  padding:
    "11px",

  border:
    "none",

  borderRadius:
    "6px",

  color:
    "white",

  fontWeight:
    "bold",
};

const successStyle = {
  padding:
    "10px",

  marginBottom:
    "12px",

  borderRadius:
    "5px",

  backgroundColor:
    "#ecfdf5",

  border:
    "1px solid #86efac",

  color:
    "#166534",

  fontSize:
    "10px",
};

const errorStyle = {
  padding:
    "10px",

  marginBottom:
    "12px",

  borderRadius:
    "5px",

  backgroundColor:
    "#fef2f2",

  border:
    "1px solid #fecaca",

  color:
    "#991b1b",

  fontSize:
    "10px",
};

const historyRowStyle = {
  display:
    "flex",

  justifyContent:
    "space-between",

  gap:
    "15px",

  padding:
    "10px 0",

  borderTop:
    "1px solid #e2e8f0",
};

const historyDescriptionStyle = {
  marginTop:
    "3px",

  color:
    "#64748b",

  fontSize:
    "10px",
};

const historyDateStyle = {
  marginTop:
    "3px",

  color:
    "#94a3b8",

  fontSize:
    "9px",
};

const historyAmountStyle = {
  whiteSpace:
    "nowrap",
};

const emptyStyle = {
  padding:
    "12px",

  color:
    "#64748b",

  textAlign:
    "center",

  fontSize:
    "10px",
};
