"use client";

import { useEffect, useMemo, useState } from "react";

export default function ShiftIncomeEntries({
  user,
  currentShift,
}) {
  const [entries, setEntries] = useState([]);
  const [entryType, setEntryType] = useState("COMPANY_FLOAT");
  const [description, setDescription] = useState("Float from company");
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
  // LOAD FLOAT ENTRIES
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

        const response = await fetch(
          `${supabaseUrl}/rest/v1/shift_income_entries` +
            `?shift_id=eq.${encodeURIComponent(shiftId)}` +
            `&select=id,shift_id,entry_type,description,amount,created_at` +
            `&order=created_at.asc`,
          {
            method: "GET",
            headers: {
              apikey: supabaseAnonKey,
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            cache: "no-store",
          }
        );

        let result = null;

        try {
          result = await response.json();
        } catch {
          result = null;
        }

        if (!response.ok) {
          throw new Error(
            result?.message ||
              result?.details ||
              "Unable to load float entries."
          );
        }

        if (cancelled) {
          return;
        }

        const loadedEntries =
          Array.isArray(result)
            ? result
            : [];

        setEntries(loadedEntries);

        // Recalculate and repair shift total
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

        if (!cancelled) {
          setMessage(
            error?.message ||
              "Unable to load float entries."
          );

          setMessageType("error");
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
  // UPDATE DESCRIPTION WHEN TYPE CHANGES
  // --------------------------------------------------

  function handleEntryTypeChange(value) {
    setEntryType(value);

    if (value === "COMPANY_FLOAT") {
      setDescription(
        "Float from company"
      );
    }

    if (value === "MSHWARI_FLOAT") {
      setDescription(
        "Float from M-Shwari"
      );
    }

    setMessage("");
    setMessageType("");
  }

  // --------------------------------------------------
  // SYNC shifts.total_added_float
  //
  // ONLY:
  // COMPANY FLOAT
  // + M-SHWARI FLOAT
  // --------------------------------------------------

  async function syncShiftTotalAdded(
    totalAdded
  ) {
    if (
      !shiftId ||
      !accessToken ||
      !supabaseUrl ||
      !supabaseAnonKey
    ) {
      return;
    }

    const response = await fetch(
      `${supabaseUrl}/rest/v1/shifts?id=eq.${encodeURIComponent(
        shiftId
      )}`,
      {
        method: "PATCH",

        headers: {
          apikey:
            supabaseAnonKey,

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

      throw new Error(
        result?.message ||
          result?.details ||
          result?.hint ||
          "Unable to update total added float."
      );
    }
  }

  // --------------------------------------------------
  // ADD FLOAT
  // --------------------------------------------------

  async function addEntry() {
    if (!shiftId) {
      setMessage(
        "No open shift was found."
      );
      setMessageType("error");
      return;
    }

    if (!accessToken) {
      setMessage(
        "Authentication is missing. Please log in again."
      );
      setMessageType("error");
      return;
    }

    if (
      entryType !== "COMPANY_FLOAT" &&
      entryType !== "MSHWARI_FLOAT"
    ) {
      setMessage(
        "Select a valid float type."
      );
      setMessageType("error");
      return;
    }

    const numericAmount =
      Number(amount);

    if (
      amount === "" ||
      Number.isNaN(numericAmount) ||
      numericAmount <= 0
    ) {
      setMessage(
        "Enter a valid amount greater than zero."
      );
      setMessageType("error");
      return;
    }

    try {
      setSaving(true);
      setMessage("");
      setMessageType("");

      const response = await fetch(
        `${supabaseUrl}/rest/v1/shift_income_entries`,
        {
          method: "POST",

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

          body: JSON.stringify({
            shift_id:
              shiftId,

            entry_type:
              entryType,

            description:
              description.trim() ||
              (entryType === "COMPANY_FLOAT"
                ? "Float from company"
                : "Float from M-Shwari"),

            amount:
              roundMoney(
                numericAmount
              ),
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
        console.error(
          "FLOAT INSERT ERROR:",
          result
        );

        throw new Error(
          result?.message ||
            result?.details ||
            result?.hint ||
            "Unable to save float entry."
        );
      }

      const insertedRow =
        Array.isArray(result) &&
        result.length > 0
          ? result[0]
          : null;

      if (!insertedRow) {
        throw new Error(
          "Float was saved but no record was returned."
        );
      }

      const updatedEntries = [
        ...entries,
        insertedRow,
      ];

      setEntries(
        updatedEntries
      );

      const newTotal =
        calculateTotalAdded(
          updatedEntries
        );

      await syncShiftTotalAdded(
        newTotal
      );

      setAmount("");

      setMessage(
        "Float saved successfully."
      );

      setMessageType(
        "success"
      );
    } catch (error) {
      console.error(
        "SAVE FLOAT ERROR:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to save float."
      );

      setMessageType("error");
    } finally {
      setSaving(false);
    }
  }

  // --------------------------------------------------
  // TOTALS
  // --------------------------------------------------

  const totals =
    useMemo(() => {
      let company = 0;
      let mshwari = 0;

      for (const entry of entries) {
        const value =
          Number(
            entry.amount || 0
          );

        if (
          entry.entry_type ===
          "COMPANY_FLOAT"
        ) {
          company += value;
        }

        if (
          entry.entry_type ===
          "MSHWARI_FLOAT"
        ) {
          mshwari += value;
        }
      }

      return {
        company:
          roundMoney(company),

        mshwari:
          roundMoney(mshwari),

        total:
          roundMoney(
            company +
              mshwari
          ),
      };
    }, [entries]);

  // --------------------------------------------------
  // ONLY DISPLAY VALID FLOAT HISTORY
  // --------------------------------------------------

  const visibleEntries =
    entries.filter(
      (entry) =>
        entry.entry_type ===
          "COMPANY_FLOAT" ||
        entry.entry_type ===
          "MSHWARI_FLOAT"
    );

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
          color: "#64748b",
          marginBottom: "20px",
        }}
      >
        Record money added during the current shift.
      </p>

      {/* SUMMARY */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(3, minmax(0, 1fr))",
          gap: "10px",
          marginBottom: "24px",
        }}
      >
        <SummaryCard
          title="Company Float"
          value={totals.company}
        />

        <SummaryCard
          title="M-Shwari Float"
          value={totals.mshwari}
        />

        <SummaryCard
          title="Total Added"
          value={totals.total}
        />
      </div>

      {/* ADD ENTRY */}

      <h3>
        Add Entry
      </h3>

      <label
        style={labelStyle}
      >
        Entry Type
      </label>

      <select
        value={entryType}
        disabled={saving}
        onChange={(e) =>
          handleEntryTypeChange(
            e.target.value
          )
        }
        style={inputStyle}
      >
        <option value="COMPANY_FLOAT">
          Company Float
        </option>

        <option value="MSHWARI_FLOAT">
          M-Shwari Float
        </option>
      </select>

      <label
        style={labelStyle}
      >
        Description
      </label>

      <input
        type="text"
        value={description}
        disabled={saving}
        onChange={(e) =>
          setDescription(
            e.target.value
          )
        }
        style={inputStyle}
      />

      <label
        style={labelStyle}
      >
        Amount (KES)
      </label>

      <input
        type="number"
        min="0"
        step="0.01"
        value={amount}
        disabled={saving}
        onChange={(e) => {
          setAmount(
            e.target.value
          );

          setMessage("");
          setMessageType("");
        }}
        placeholder="Enter amount"
        style={inputStyle}
      />

      {message && (
        <div
          style={{
            padding: "12px",
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
        onClick={addEntry}
        disabled={
          saving ||
          loading
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
          : "Add Float"}
      </button>

      {/* HISTORY */}

      <div
        style={{
          marginTop: "28px",
        }}
      >
        <h3>
          Float History
        </h3>

        {loading ? (
          <p>
            Loading...
          </p>
        ) : visibleEntries.length === 0 ? (
          <p
            style={{
              color: "#64748b",
            }}
          >
            No float has been added during this shift.
          </p>
        ) : (
          visibleEntries.map(
            (entry) => (
              <div
                key={entry.id}
                style={{
                  borderTop:
                    "1px solid #e2e8f0",
                  padding:
                    "12px 0",
                }}
              >
                <div
                  style={{
                    display:
                      "flex",
                    justifyContent:
                      "space-between",
                    gap: "15px",
                  }}
                >
                  <div>
                    <strong>
                      {displayEntryType(
                        entry.entry_type
                      )}
                    </strong>

                    <div
                      style={{
                        color:
                          "#64748b",
                        fontSize:
                          "13px",
                        marginTop:
                          "4px",
                      }}
                    >
                      {entry.description}
                    </div>

                    <div
                      style={{
                        color:
                          "#64748b",
                        fontSize:
                          "12px",
                        marginTop:
                          "4px",
                      }}
                    >
                      {formatDate(
                        entry.created_at
                      )}
                    </div>
                  </div>

                  <strong>
                    KES{" "}
                    {Number(
                      entry.amount || 0
                    ).toLocaleString(
                      "en-KE",
                      {
                        minimumFractionDigits:
                          2,
                        maximumFractionDigits:
                          2,
                      }
                    )}
                  </strong>
                </div>
              </div>
            )
          )
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------
// TOTAL ADDED FLOAT
//
// ONLY COMPANY + M-SHWARI
// --------------------------------------------------

function calculateTotalAdded(
  entries
) {
  let total = 0;

  for (const entry of entries) {
    if (
      entry.entry_type !==
        "COMPANY_FLOAT" &&
      entry.entry_type !==
        "MSHWARI_FLOAT"
    ) {
      continue;
    }

    total +=
      Number(
        entry.amount || 0
      );
  }

  return roundMoney(
    total
  );
}

// --------------------------------------------------
// ENTRY TYPE LABEL
// --------------------------------------------------

function displayEntryType(
  type
) {
  if (
    type ===
    "COMPANY_FLOAT"
  ) {
    return "Company Float";
  }

  if (
    type ===
    "MSHWARI_FLOAT"
  ) {
    return "M-Shwari Float";
  }

  return type;
}

// --------------------------------------------------
// DATE
// --------------------------------------------------

function formatDate(value) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "en-KE",
    {
      timeZone:
        "Africa/Nairobi",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(
    new Date(value)
  );
}

// --------------------------------------------------
// SUMMARY CARD
// --------------------------------------------------

function SummaryCard({
  title,
  value,
}) {
  return (
    <div
      style={{
        padding: "14px",
        backgroundColor:
          "#f8fafc",
        border:
          "1px solid #e2e8f0",
        borderRadius: "9px",
      }}
    >
      <div
        style={{
          color: "#64748b",
          fontSize: "12px",
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontWeight: "bold",
          marginTop: "5px",
        }}
      >
        KES{" "}
        {Number(
          value || 0
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

// --------------------------------------------------
// STYLES
// --------------------------------------------------

const labelStyle = {
  display: "block",
  fontWeight: "bold",
  marginBottom: "7px",
};

const inputStyle = {
  width: "100%",
  padding: "12px",
  border:
    "1px solid #cbd5e1",
  borderRadius: "8px",
  boxSizing: "border-box",
  marginBottom: "16px",
  fontSize: "15px",
};

// --------------------------------------------------
// MONEY
// --------------------------------------------------

function roundMoney(value) {
  return (
    Math.round(
      (Number(value) +
        Number.EPSILON) *
        100
    ) / 100
  );
}
