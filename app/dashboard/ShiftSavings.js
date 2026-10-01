"use client";

import { useEffect, useMemo, useState } from "react";

export default function ShiftSavings({
  user,
  currentShift,
}) {
  const [savings, setSavings] = useState([]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

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
  // LOAD SAVINGS FOR CURRENT SHIFT
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

    async function loadSavings() {
      try {
        setLoading(true);
        setMessage("");
        setMessageType("");

        const url =
          `${supabaseUrl}/rest/v1/shift_savings` +
          `?shift_id=eq.${encodeURIComponent(shiftId)}` +
          `&select=id,shift_id,description,amount,payment_status,created_at` +
          `&order=created_at.asc`;

        const response = await fetch(url, {
          method: "GET",

          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },

          cache: "no-store",
        });

        let result = null;

        try {
          result = await response.json();
        } catch {
          result = null;
        }

        if (!response.ok) {
          console.error(
            "SHIFT SAVINGS LOAD ERROR:",
            result
          );

          throw new Error(
            result?.message ||
              result?.details ||
              result?.hint ||
              "Unable to load savings."
          );
        }

        if (cancelled) {
          return;
        }

        setSavings(
          Array.isArray(result)
            ? result
            : []
        );
      } catch (error) {
        console.error(
          "LOAD SHIFT SAVINGS ERROR:",
          error
        );

        if (!cancelled) {
          setMessage(
            error?.message ||
              "Unable to load savings."
          );

          setMessageType("error");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadSavings();

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
    let pending = 0;
    let paid = 0;

    for (const row of savings) {
      const value =
        Number(row.amount) || 0;

      if (
        row.payment_status === "PAID"
      ) {
        paid += value;
      } else if (
        row.payment_status === "PENDING"
      ) {
        pending += value;
      }
    }

    pending = roundMoney(pending);
    paid = roundMoney(paid);

    return {
      pending,
      paid,
      total: roundMoney(
        pending + paid
      ),
    };
  }, [savings]);

  // --------------------------------------------------
  // SAVE NEW SAVING
  // --------------------------------------------------

  async function saveSaving() {
    if (!shiftId) {
      setMessage(
        "No open shift was found."
      );
      setMessageType("error");
      return;
    }

    if (!accessToken) {
      setMessage(
        "Login authentication is missing. Please log in again."
      );
      setMessageType("error");
      return;
    }

    if (
      !supabaseUrl ||
      !supabaseAnonKey
    ) {
      setMessage(
        "Database configuration is missing."
      );
      setMessageType("error");
      return;
    }

    const cleanDescription =
      description.trim();

    if (!cleanDescription) {
      setMessage(
        "Please enter a savings description."
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
        "Please enter a valid amount greater than zero."
      );
      setMessageType("error");
      return;
    }

    try {
      setSaving(true);
      setMessage("");
      setMessageType("");

      const savingData = {
        shift_id: shiftId,
        description: cleanDescription,
        amount: roundMoney(
          numericAmount
        ),

        // Allowed by the database:
        // PENDING or PAID
        payment_status: "PENDING",
      };

      console.log(
        "Saving shift saving:",
        savingData
      );

      const response = await fetch(
        `${supabaseUrl}/rest/v1/shift_savings`,
        {
          method: "POST",

          headers: {
            apikey: supabaseAnonKey,
            Authorization:
              `Bearer ${accessToken}`,
            "Content-Type":
              "application/json",
            Prefer:
              "return=representation",
          },

          body: JSON.stringify(
            savingData
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
          "SHIFT SAVING INSERT ERROR:",
          result
        );

        throw new Error(
          result?.message ||
            result?.details ||
            result?.hint ||
            "Unable to save savings entry."
        );
      }

      if (
        !Array.isArray(result) ||
        result.length === 0
      ) {
        throw new Error(
          "Savings entry was saved, but the saved record was not returned."
        );
      }

      const savedRow =
        result[0];

      setSavings((previous) => [
        ...previous,
        savedRow,
      ]);

      setDescription("");
      setAmount("");

      setMessage(
        "Savings entry saved successfully."
      );

      setMessageType("success");
    } catch (error) {
      console.error(
        "SAVE SHIFT SAVING ERROR:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to save savings entry."
      );

      setMessageType("error");
    } finally {
      setSaving(false);
    }
  }

  // --------------------------------------------------
  // MARK SAVING AS PAID
  // --------------------------------------------------

  async function markAsPaid(row) {
    if (!row?.id) {
      return;
    }

    if (
      row.payment_status === "PAID"
    ) {
      return;
    }

    if (!accessToken) {
      setMessage(
        "Login authentication is missing. Please log in again."
      );
      setMessageType("error");
      return;
    }

    try {
      setUpdatingId(row.id);
      setMessage("");
      setMessageType("");

      const response = await fetch(
        `${supabaseUrl}/rest/v1/shift_savings?id=eq.${encodeURIComponent(
          row.id
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
              "return=representation",
          },

          body: JSON.stringify({
            payment_status: "PAID",
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
          "SHIFT SAVING UPDATE ERROR:",
          result
        );

        throw new Error(
          result?.message ||
            result?.details ||
            result?.hint ||
            "Unable to mark savings as paid."
        );
      }

      const updatedRow =
        Array.isArray(result) &&
        result.length > 0
          ? result[0]
          : {
              ...row,
              payment_status: "PAID",
            };

      setSavings((previous) =>
        previous.map((item) =>
          item.id === row.id
            ? updatedRow
            : item
        )
      );

      setMessage(
        "Savings payment marked as PAID."
      );

      setMessageType("success");
    } catch (error) {
      console.error(
        "MARK SAVING PAID ERROR:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to update savings payment."
      );

      setMessageType("error");
    } finally {
      setUpdatingId(null);
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
        Savings
      </h2>

      <p
        style={{
          marginTop: 0,
          marginBottom: "22px",
          color: "#64748b",
        }}
      >
        Record savings or banking payments for the current shift.
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
          title="Pending"
          amount={totals.pending}
        />

        <SummaryCard
          title="Paid"
          amount={totals.paid}
        />

        <SummaryCard
          title="Total Savings"
          amount={totals.total}
        />
      </div>

      {/* ADD SAVING */}

      <div
        style={{
          backgroundColor: "#f8fafc",
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
          Add Savings
        </h3>

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
          value={description}
          disabled={saving}
          onChange={(e) => {
            setDescription(
              e.target.value
            );

            setMessage("");
            setMessageType("");
          }}
          placeholder="e.g. Daily banking"
          style={{
            width: "100%",
            padding: "13px",
            border:
              "1px solid #cbd5e1",
            borderRadius: "8px",
            boxSizing: "border-box",
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
          value={amount}
          disabled={saving}
          onChange={(e) => {
            setAmount(
              e.target.value
            );

            setMessage("");
            setMessageType("");
          }}
          placeholder="Enter savings amount"
          style={{
            width: "100%",
            padding: "13px",
            border:
              "1px solid #cbd5e1",
            borderRadius: "8px",
            boxSizing: "border-box",
            fontSize: "15px",
            marginBottom: "16px",
          }}
        />

        <div
          style={{
            padding: "11px",
            marginBottom: "16px",
            backgroundColor: "#fff7ed",
            color: "#9a3412",
            borderRadius: "8px",
            fontSize: "13px",
          }}
        >
          New savings are recorded as PENDING until they are marked PAID.
        </div>

        {message && (
          <div
            style={{
              padding: "11px",
              marginBottom: "16px",
              borderRadius: "8px",

              backgroundColor:
                messageType === "success"
                  ? "#ecfdf5"
                  : "#fef2f2",

              color:
                messageType === "success"
                  ? "#166534"
                  : "#991b1b",
            }}
          >
            {message}
          </div>
        )}

        <button
          type="button"
          onClick={saveSaving}
          disabled={saving}
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
            : "Save Savings"}
        </button>
      </div>

      {/* SAVINGS HISTORY */}

      <h3
        style={{
          marginBottom: "12px",
        }}
      >
        Savings History
      </h3>

      {loading ? (
        <div
          style={{
            color: "#64748b",
            padding: "12px 0",
          }}
        >
          Loading savings...
        </div>
      ) : savings.length === 0 ? (
        <div
          style={{
            padding: "14px",
            backgroundColor: "#f8fafc",
            borderRadius: "8px",
            color: "#64748b",
          }}
        >
          No savings have been recorded yet.
        </div>
      ) : (
        <div>
          {savings.map((row) => {
            const isPaid =
              row.payment_status === "PAID";

            const isUpdating =
              updatingId === row.id;

            return (
              <div
                key={row.id}
                style={{
                  padding: "14px 0",
                  borderBottom:
                    "1px solid #e2e8f0",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent:
                      "space-between",
                    alignItems: "flex-start",
                    gap: "20px",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: "bold",
                      }}
                    >
                      {row.description}
                    </div>

                    {row.created_at && (
                      <div
                        style={{
                          color: "#94a3b8",
                          fontSize: "12px",
                          marginTop: "4px",
                        }}
                      >
                        {formatKenyaDate(
                          row.created_at
                        )}
                      </div>
                    )}

                    <div
                      style={{
                        marginTop: "7px",
                        fontSize: "12px",
                        fontWeight: "bold",
                        color: isPaid
                          ? "#15803d"
                          : "#b45309",
                      }}
                    >
                      {row.payment_status}
                    </div>
                  </div>

                  <div
                    style={{
                      fontWeight: "bold",
                      whiteSpace: "nowrap",
                    }}
                  >
                    KES{" "}
                    {Number(
                      row.amount || 0
                    ).toLocaleString(
                      "en-KE",
                      {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }
                    )}
                  </div>
                </div>

                {!isPaid && (
                  <button
                    type="button"
                    disabled={isUpdating}
                    onClick={() =>
                      markAsPaid(row)
                    }
                    style={{
                      width: "100%",
                      marginTop: "10px",
                      padding: "10px",
                      border: "none",
                      borderRadius: "7px",

                      backgroundColor:
                        isUpdating
                          ? "#94a3b8"
                          : "#0f766e",

                      color: "white",
                      fontWeight: "bold",

                      cursor:
                        isUpdating
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    {isUpdating
                      ? "Updating..."
                      : "Mark as PAID"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------
// ROUND MONEY
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

// --------------------------------------------------
// KENYA DATE / TIME
// --------------------------------------------------

function formatKenyaDate(value) {
  try {
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
        backgroundColor: "#f8fafc",
        padding: "14px",
        borderRadius: "9px",
        border:
          "1px solid #e2e8f0",
      }}
    >
      <div
        style={{
          color: "#64748b",
          fontSize: "12px",
          marginBottom: "5px",
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontWeight: "bold",
          fontSize: "17px",
        }}
      >
        KES{" "}
        {Number(
          amount || 0
        ).toLocaleString(
          "en-KE",
          {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }
        )}
      </div>
    </div>
  );
}
