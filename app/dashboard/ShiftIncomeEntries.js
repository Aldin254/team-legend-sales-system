"use client";

import { useEffect, useMemo, useState } from "react";

export default function ShiftIncomeEntries({
  user,
  currentShift,
}) {
  const [entries, setEntries] = useState([]);
  const [entryType, setEntryType] = useState("COMPANY_FLOAT");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const accessToken =
    user?.access_token || null;

  const shiftId =
    currentShift?.id || null;

  // --------------------------------------------------
  // UPDATE PARENT SHIFT TOTAL
  // --------------------------------------------------

  async function syncShiftTotal(totalAdded) {
    if (
      !shiftId ||
      !accessToken ||
      !supabaseUrl ||
      !supabaseAnonKey
    ) {
      throw new Error(
        "Unable to synchronize shift total."
      );
    }

    const response = await fetch(
      `${supabaseUrl}/rest/v1/shifts?id=eq.${encodeURIComponent(
        shiftId
      )}`,
      {
        method: "PATCH",

        headers: {
          apikey: supabaseAnonKey,

          Authorization:
            `Bearer ${accessToken}`,

          "Content-Type":
            "application/json",

          Prefer:
            "return=minimal",
        },

        body: JSON.stringify({
          total_added_float:
            roundMoney(totalAdded),
        }),
      }
    );

    if (!response.ok) {
      let result = null;

      try {
        result =
          await response.json();
      } catch {
        result = null;
      }

      console.error(
        "SHIFT TOTAL UPDATE ERROR:",
        result
      );

      throw new Error(
        result?.message ||
          result?.details ||
          result?.hint ||
          "Unable to update total added float."
      );
    }
  }

  // --------------------------------------------------
  // LOAD EXISTING ENTRIES
  // --------------------------------------------------

  useEffect(() => {
    if (
      !shiftId ||
      !accessToken ||
      !supabaseUrl ||
      !supabaseAnonKey
    ) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadEntries() {
      try {
        setLoading(true);
        setMessage("");
        setMessageType("");

        const url =
          `${supabaseUrl}/rest/v1/shift_income_entries` +
          `?shift_id=eq.${encodeURIComponent(
            shiftId
          )}` +
          `&select=id,shift_id,entry_type,description,amount,created_at` +
          `&order=created_at.asc`;

        const response = await fetch(
          url,
          {
            method: "GET",

            headers: {
              apikey:
                supabaseAnonKey,

              Authorization:
                `Bearer ${accessToken}`,

              "Content-Type":
                "application/json",
            },

            cache: "no-store",
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
          console.error(
            "SHIFT INCOME LOAD ERROR:",
            result
          );

          throw new Error(
            result?.message ||
              result?.details ||
              result?.hint ||
              "Unable to load shift income entries."
          );
        }

        if (cancelled) {
          return;
        }

        const loadedEntries =
          Array.isArray(result)
            ? result
            : [];

        setEntries(
          loadedEntries
        );

        // --------------------------------------------
        // REPAIR / SYNCHRONIZE SHIFT TOTAL
        // This also fixes old shifts where the entries
        // exist but total_added_float is still zero.
        // --------------------------------------------

        const totalAdded =
          calculateTotalAdded(
            loadedEntries
          );

        try {
          await syncShiftTotal(
            totalAdded
          );
        } catch (syncError) {
          console.error(
            "INITIAL SHIFT TOTAL SYNC ERROR:",
            syncError
          );

          if (!cancelled) {
            setMessage(
              syncError?.message ||
                "Entries loaded, but shift total could not be synchronized."
            );

            setMessageType(
              "error"
            );
          }
        }
      } catch (error) {
        console.error(
          "LOAD SHIFT INCOME ERROR:",
          error
        );

        if (!cancelled) {
          setMessage(
            error?.message ||
              "Unable to load shift income entries."
          );

          setMessageType(
            "error"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadEntries();

    return () => {
      cancelled = true;
    };
  }, [
    shiftId,
    accessToken,
    supabaseUrl,
    supabaseAnonKey,
  ]);

  // --------------------------------------------------
  // TOTALS
  // --------------------------------------------------

  const totals = useMemo(() => {
    let companyFloat = 0;
    let mshwariFloat = 0;
    let other = 0;
    let balanceBF = 0;

    for (const entry of entries) {
      const value =
        Number(entry.amount) || 0;

      switch (
        entry.entry_type
      ) {
        case "COMPANY_FLOAT":
          companyFloat += value;
          break;

        case "MSHWARI_FLOAT":
          mshwariFloat += value;
          break;

        case "OTHER":
          other += value;
          break;

        case "BALANCE_BF":
          balanceBF += value;
          break;

        default:
          break;
      }
    }

    companyFloat =
      roundMoney(
        companyFloat
      );

    mshwariFloat =
      roundMoney(
        mshwariFloat
      );

    other =
      roundMoney(
        other
      );

    balanceBF =
      roundMoney(
        balanceBF
      );

    const totalAdded =
      roundMoney(
        companyFloat +
          mshwariFloat +
          other
      );

    return {
      companyFloat,
      mshwariFloat,
      other,
      balanceBF,
      totalAdded,
    };
  }, [entries]);

  // --------------------------------------------------
  // SAVE ENTRY
  // --------------------------------------------------

  async function saveEntry() {
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
        "Login authentication is missing. Please log in again."
      );

      setMessageType(
        "error"
      );

      return;
    }

    if (
      !supabaseUrl ||
      !supabaseAnonKey
    ) {
      setMessage(
        "Database configuration is missing."
      );

      setMessageType(
        "error"
      );

      return;
    }

    const numericAmount =
      Number(amount);

    if (
      amount === "" ||
      Number.isNaN(
        numericAmount
      ) ||
      numericAmount <= 0
    ) {
      setMessage(
        "Please enter a valid amount greater than zero."
      );

      setMessageType(
        "error"
      );

      return;
    }

    const allowedTypes = [
      "COMPANY_FLOAT",
      "MSHWARI_FLOAT",
      "OTHER",
    ];

    if (
      !allowedTypes.includes(
        entryType
      )
    ) {
      setMessage(
        "Invalid entry type."
      );

      setMessageType(
        "error"
      );

      return;
    }

    try {
      setSaving(true);
      setMessage("");
      setMessageType("");

      const body = {
        shift_id:
          shiftId,

        entry_type:
          entryType,

        description:
          description.trim() ||
          defaultDescription(
            entryType
          ),

        amount:
          roundMoney(
            numericAmount
          ),
      };

      console.log(
        "Saving shift income entry:",
        body
      );

      // --------------------------------------------
      // INSERT ENTRY
      // --------------------------------------------

      const response =
        await fetch(
          `${supabaseUrl}/rest/v1/shift_income_entries`,
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
                body
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
        console.error(
          "SHIFT INCOME INSERT ERROR:",
          result
        );

        throw new Error(
          result?.message ||
            result?.details ||
            result?.hint ||
            "Unable to save entry."
        );
      }

      if (
        !Array.isArray(
          result
        ) ||
        result.length === 0
      ) {
        throw new Error(
          "Entry was saved, but the saved record was not returned."
        );
      }

      const savedEntry =
        result[0];

      const updatedEntries = [
        ...entries,
        savedEntry,
      ];

      // Update screen immediately.
      setEntries(
        updatedEntries
      );

      setAmount("");
      setDescription("");

      // --------------------------------------------
      // CALCULATE NEW TOTAL
      // --------------------------------------------

      const newTotalAdded =
        calculateTotalAdded(
          updatedEntries
        );

      // --------------------------------------------
      // UPDATE shifts.total_added_float
      // --------------------------------------------

      try {
        await syncShiftTotal(
          newTotalAdded
        );
      } catch (syncError) {
        console.error(
          "POST-SAVE SHIFT TOTAL SYNC ERROR:",
          syncError
        );

        setMessage(
          "Entry saved successfully, but the shift total could not be synchronized. Do not enter it again; refresh the page once."
        );

        setMessageType(
          "error"
        );

        return;
      }

      setMessage(
        "Entry saved and shift total updated successfully."
      );

      setMessageType(
        "success"
      );
    } catch (error) {
      console.error(
        "SAVE SHIFT INCOME ERROR:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to save entry."
      );

      setMessageType(
        "error"
      );
    } finally {
      setSaving(false);
    }
  }

  // --------------------------------------------------
  // DISPLAY
  // --------------------------------------------------

  if (!currentShift) {
    return null;
  }

  return (
    <div
      style={{
        marginTop: "24px",
        backgroundColor: "white",
        padding: "25px",
        borderRadius: "12px",
        boxShadow:
          "0 2px 10px rgba(0,0,0,0.08)",
        maxWidth: "700px",
      }}
    >
      <h2
        style={{
          marginTop: 0,
          marginBottom: "6px",
        }}
      >
        Float / Income Entries
      </h2>

      <p
        style={{
          marginTop: 0,
          marginBottom: "22px",
          color: "#64748b",
        }}
      >
        Record money added during the current shift.
      </p>

      {/* SUMMARY */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(150px, 1fr))",
          gap: "12px",
          marginBottom: "25px",
        }}
      >
        <SummaryCard
          title="Company Float"
          amount={
            totals.companyFloat
          }
        />

        <SummaryCard
          title="M-Shwari Float"
          amount={
            totals.mshwariFloat
          }
        />

        <SummaryCard
          title="Other"
          amount={
            totals.other
          }
        />

        <SummaryCard
          title="Total Added"
          amount={
            totals.totalAdded
          }
        />
      </div>

      {/* ADD ENTRY */}

      <div
        style={{
          backgroundColor:
            "#f8fafc",
          padding: "18px",
          borderRadius: "10px",
          marginBottom: "24px",
        }}
      >
        <h3
          style={{
            marginTop: 0,
          }}
        >
          Add Entry
        </h3>

        <label
          style={{
            display: "block",
            fontWeight: "bold",
            marginBottom: "7px",
          }}
        >
          Entry Type
        </label>

        <select
          value={
            entryType
          }
          disabled={
            saving
          }
          onChange={(e) => {
            setEntryType(
              e.target.value
            );

            setMessage("");
            setMessageType("");
          }}
          style={{
            width: "100%",
            padding: "13px",
            border:
              "1px solid #cbd5e1",
            borderRadius: "8px",
            boxSizing:
              "border-box",
            fontSize: "15px",
            marginBottom: "16px",
            backgroundColor:
              "white",
          }}
        >
          <option value="COMPANY_FLOAT">
            Company Float
          </option>

          <option value="MSHWARI_FLOAT">
            M-Shwari Float
          </option>

          <option value="OTHER">
            Other
          </option>
        </select>

        <label
          style={{
            display: "block",
            fontWeight: "bold",
            marginBottom: "7px",
          }}
        >
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
          onChange={(e) => {
            setDescription(
              e.target.value
            );

            setMessage("");
            setMessageType("");
          }}
          placeholder={
            defaultDescription(
              entryType
            )
          }
          style={{
            width: "100%",
            padding: "13px",
            border:
              "1px solid #cbd5e1",
            borderRadius: "8px",
            boxSizing:
              "border-box",
            fontSize: "15px",
            marginBottom: "16px",
          }}
        />

        <label
          style={{
            display: "block",
            fontWeight: "bold",
            marginBottom: "7px",
          }}
        >
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
          onChange={(e) => {
            setAmount(
              e.target.value
            );

            setMessage("");
            setMessageType("");
          }}
          placeholder="Enter amount"
          style={{
            width: "100%",
            padding: "13px",
            border:
              "1px solid #cbd5e1",
            borderRadius: "8px",
            boxSizing:
              "border-box",
            fontSize: "15px",
            marginBottom: "16px",
          }}
        />

        {message && (
          <div
            style={{
              padding: "11px",
              marginBottom: "16px",
              borderRadius: "8px",

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

        <button
          type="button"
          onClick={
            saveEntry
          }
          disabled={
            saving
          }
          style={{
            width: "100%",
            padding: "14px",
            border: "none",
            borderRadius: "8px",

            backgroundColor:
              saving
                ? "#94a3b8"
                : "#168d32",

            color: "white",
            fontSize: "16px",
            fontWeight: "bold",

            cursor:
              saving
                ? "not-allowed"
                : "pointer",
          }}
        >
          {saving
            ? "Saving..."
            : "Save Entry"}
        </button>
      </div>

      {/* ENTRY HISTORY */}

      <h3
        style={{
          marginBottom: "12px",
        }}
      >
        Shift Entry History
      </h3>

      {loading ? (
        <div
          style={{
            color: "#64748b",
            padding: "12px 0",
          }}
        >
          Loading entries...
        </div>
      ) : entries.length === 0 ? (
        <div
          style={{
            padding: "14px",
            backgroundColor:
              "#f8fafc",
            borderRadius: "8px",
            color: "#64748b",
          }}
        >
          No float or income entries have been recorded yet.
        </div>
      ) : (
        <div>
          {entries.map(
            (entry) => (
              <div
                key={
                  entry.id
                }
                style={{
                  padding:
                    "13px 0",

                  borderBottom:
                    "1px solid #e2e8f0",

                  display:
                    "flex",

                  justifyContent:
                    "space-between",

                  gap:
                    "20px",

                  alignItems:
                    "center",
                }}
              >
                <div>
                  <div
                    style={{
                      fontWeight:
                        "bold",
                    }}
                  >
                    {friendlyType(
                      entry.entry_type
                    )}
                  </div>

                  <div
                    style={{
                      color:
                        "#64748b",

                      fontSize:
                        "13px",

                      marginTop:
                        "3px",
                    }}
                  >
                    {entry.description ||
                      "-"}
                  </div>

                  {entry.created_at && (
                    <div
                      style={{
                        color:
                          "#94a3b8",

                        fontSize:
                          "12px",

                        marginTop:
                          "3px",
                      }}
                    >
                      {formatKenyaDate(
                        entry.created_at
                      )}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    fontWeight:
                      "bold",

                    whiteSpace:
                      "nowrap",
                  }}
                >
                  KES{" "}
                  {Number(
                    entry.amount ||
                      0
                  ).toLocaleString(
                    "en-KE",
                    {
                      minimumFractionDigits:
                        2,

                      maximumFractionDigits:
                        2,
                    }
                  )}
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------
// CALCULATE TOTAL ADDED
// --------------------------------------------------

function calculateTotalAdded(
  entries
) {
  let total = 0;

  for (const entry of entries) {
    if (
      entry.entry_type ===
        "COMPANY_FLOAT" ||
      entry.entry_type ===
        "MSHWARI_FLOAT" ||
      entry.entry_type ===
        "OTHER"
    ) {
      total +=
        Number(
          entry.amount
        ) || 0;
    }
  }

  return roundMoney(
    total
  );
}

// --------------------------------------------------
// ROUND MONEY
// --------------------------------------------------

function roundMoney(
  value
) {
  return (
    Math.round(
      (Number(value) +
        Number.EPSILON) *
        100
    ) / 100
  );
}

// --------------------------------------------------
// DEFAULT DESCRIPTION
// --------------------------------------------------

function defaultDescription(
  type
) {
  switch (type) {
    case "COMPANY_FLOAT":
      return "Float from company";

    case "MSHWARI_FLOAT":
      return "Float from M-Shwari";

    case "BALANCE_BF":
      return "Balance B/F";

    case "OTHER":
      return "Other income";

    default:
      return "";
  }
}

// --------------------------------------------------
// FRIENDLY TYPE
// --------------------------------------------------

function friendlyType(
  type
) {
  switch (type) {
    case "COMPANY_FLOAT":
      return "Company Float";

    case "MSHWARI_FLOAT":
      return "M-Shwari Float";

    case "BALANCE_BF":
      return "Balance B/F";

    case "OTHER":
      return "Other";

    default:
      return type || "Entry";
  }
}

// --------------------------------------------------
// KENYA DATE / TIME
// --------------------------------------------------

function formatKenyaDate(
  value
) {
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
      new Date(value)
    );
  } catch {
    return value;
  }
}

// --------------------------------------------------
// SUMMARY CARD
// --------------------------------------------------

function SummaryCard({
  title,
  amount,
}) {
  return (
    <div
      style={{
        backgroundColor:
          "#f8fafc",

        padding:
          "14px",

        borderRadius:
          "9px",

        border:
          "1px solid #e2e8f0",
      }}
    >
      <div
        style={{
          color:
            "#64748b",

          fontSize:
            "12px",

          marginBottom:
            "5px",
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontWeight:
            "bold",

          fontSize:
            "17px",
        }}
      >
        KES{" "}
        {Number(
          amount || 0
        ).toLocaleString(
          "en-KE",
          {
            minimumFractionDigits:
              2,

            maximumFractionDigits:
              2,
          }
        )}
      </div>
    </div>
  );
}
