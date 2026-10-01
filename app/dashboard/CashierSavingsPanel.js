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
  const [savings, setSavings] = useState([]);

  const [inputs, setInputs] = useState(
    Array.from({ length: 4 }, () => ({
      description: "",
      amount: "",
    }))
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [markingId, setMarkingId] = useState(null);

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

  // ==================================================
  // LOAD SAVINGS
  // ==================================================

  const loadSavings = useCallback(
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
        const response = await fetch(
          `${supabaseUrl}/rest/v1/shift_savings` +
            `?shift_id=eq.${encodeURIComponent(shiftId)}` +
            `&select=id,shift_id,description,amount,payment_status,created_at` +
            `&order=created_at.asc`,
          {
            method: "GET",

            headers: {
              apikey: supabaseAnonKey,

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
          result = await response.json();
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
          Array.isArray(result)
            ? result
            : [];

        setSavings(loaded);

        // Preserve unsaved typing.
        // Saved rows become locked.

        setInputs((previous) => {
          const next =
            Array.from(
              { length: 4 },
              (_, index) => ({
                description:
                  previous[index]?.description || "",

                amount:
                  previous[index]?.amount || "",
              })
            );

          for (let i = 0; i < 4; i += 1) {
            if (loaded[i]) {
              next[i] = {
                description:
                  loaded[i].description || "",

                amount:
                  String(
                    loaded[i].amount ?? ""
                  ),
              };
            }
          }

          return next;
        });
      } catch (error) {
        console.error(
          "LOAD SAVINGS ERROR:",
          error
        );

        setMessage(
          error?.message ||
            "Unable to load savings."
        );

        setMessageType("error");
      } finally {
        setLoading(false);
      }
    },
    [
      shiftId,
      accessToken,
      supabaseUrl,
      supabaseAnonKey,
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
      clearInterval(timer);
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

      setMessageType("error");
      return;
    }

    const rowsToSave = [];

    for (let i = 0; i < 4; i += 1) {
      // Existing row is already saved.
      if (savings[i]) {
        continue;
      }

      const description =
        String(
          inputs[i]?.description || ""
        ).trim();

      const rawAmount =
        inputs[i]?.amount;

      const hasDescription =
        description !== "";

      const hasAmount =
        rawAmount !== "" &&
        rawAmount !== undefined;

      // Blank row is allowed.
      if (
        !hasDescription &&
        !hasAmount
      ) {
        continue;
      }

      if (!hasDescription) {
        setMessage(
          `Enter the description for Savings ${
            i + 1
          }.`
        );

        setMessageType("error");
        return;
      }

      const amount =
        Number(rawAmount);

      if (
        !hasAmount ||
        Number.isNaN(amount) ||
        amount <= 0
      ) {
        setMessage(
          `Enter a valid amount for Savings ${
            i + 1
          }.`
        );

        setMessageType("error");
        return;
      }

      rowsToSave.push({
        shift_id:
          shiftId,

        description,

        amount:
          roundMoney(amount),

        payment_status:
          "PENDING",
      });
    }

    if (
      rowsToSave.length === 0
    ) {
      setMessage(
        "Enter at least one savings or banking entry."
      );

      setMessageType("error");
      return;
    }

    try {
      setSaving(true);
      setMessage("");
      setMessageType("");

      const response = await fetch(
        `${supabaseUrl}/rest/v1/shift_savings`,
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

          body: JSON.stringify(
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
        "Savings saved successfully."
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

      setMessageType("error");
    } finally {
      setSaving(false);
    }
  }

  // ==================================================
  // MARK AS PAID
  // ==================================================

  async function markAsPaid(row) {
    if (
      !row?.id ||
      !accessToken
    ) {
      return;
    }

    try {
      setMarkingId(row.id);
      setMessage("");
      setMessageType("");

      const response = await fetch(
        `${supabaseUrl}/rest/v1/shift_savings` +
          `?id=eq.${encodeURIComponent(row.id)}`,
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
              "return=representation",
          },

          body: JSON.stringify({
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

      setMessageType("error");
    } finally {
      setMarkingId(null);
    }
  }

  // ==================================================
  // TOTALS
  // ==================================================

  const totals =
    useMemo(() => {
      let pending = 0;
      let paid = 0;

      for (const row of savings) {
        const amount =
          Number(
            row.amount || 0
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
          roundMoney(pending),

        paid:
          roundMoney(paid),

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
    <section style={panelStyle}>
      <div style={titleStyle}>
        SAVINGS / BANKING
      </div>

      <div style={headerStyle}>
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

      {Array.from(
        { length: 4 },
        (_, index) => {
          const saved =
            savings[index];

          if (saved) {
            const isPaid =
              saved.payment_status ===
              "PAID";

            return (
              <div
                key={
                  saved.id ||
                  `saved-${index}`
                }
                style={rowStyle}
              >
                <div style={savedBoxStyle}>
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
                    <div style={paidStyle}>
                      PAID ✓
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        markAsPaid(
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

          return (
            <div
              key={`new-${index}`}
              style={rowStyle}
            >
              <input
                type="text"
                value={
                  inputs[index]
                    ?.description ||
                  ""
                }
                disabled={
                  saving
                }
                placeholder="Description"
                onChange={(event) => {
                  const value =
                    event.target.value;

                  setInputs(
                    (previous) => {
                      const next =
                        previous.map(
                          (row) => ({
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

                  setMessage("");
                }}
                style={inputStyle}
              />

              <input
                type="number"
                min="0"
                step="0.01"
                value={
                  inputs[index]
                    ?.amount ||
                  ""
                }
                disabled={
                  saving
                }
                placeholder="0.00"
                onChange={(event) => {
                  const value =
                    event.target.value;

                  setInputs(
                    (previous) => {
                      const next =
                        previous.map(
                          (row) => ({
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

                  setMessage("");
                }}
                style={{
                  ...inputStyle,
                  textAlign:
                    "right",
                }}
              />

              <div style={newPendingStyle}>
                PENDING
              </div>
            </div>
          );
        }
      )}

      <div style={totalStyle}>
        <strong>
          TOTAL SAVINGS
        </strong>

        <strong>
          {money(
            totals.total
          )}
        </strong>
      </div>

      <div style={summaryStyle}>
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
        <div style={buttonWrapStyle}>
          <button
            type="button"
            onClick={
              saveSavings
            }
            disabled={
              saving
            }
            style={saveButtonStyle}
          >
            {saving
              ? "Saving..."
              : "Save Savings / Banking"}
          </button>
        </div>
      )}

      <div style={noteStyle}>
        Savings / Banking does not reduce Closing Balance.
      </div>
    </section>
  );
}

// ==================================================
// HELPERS
// ==================================================

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
  backgroundColor: "white",
  borderRadius: "6px",
  overflow: "hidden",
  boxShadow:
    "0 1px 5px rgba(0,0,0,0.12)",
};

const titleStyle = {
  backgroundColor: "#0873b9",
  color: "white",
  padding: "9px 12px",
  fontSize: "14px",
  fontWeight: "bold",
};

const headerStyle = {
  display: "grid",
  gridTemplateColumns:
    "1.35fr 0.85fr 0.9fr",
  gap: "6px",
  padding: "8px",
  backgroundColor: "#eef4f8",
  fontSize: "9px",
  fontWeight: "bold",
  textAlign: "center",
};

const rowStyle = {
  display: "grid",
  gridTemplateColumns:
    "1.35fr 0.85fr 0.9fr",
  gap: "6px",
  padding: "4px 8px",
  alignItems: "center",
  borderTop:
    "1px solid #e5e7eb",
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "6px",
  border:
    "1px solid #cbd5e1",
  borderRadius: "4px",
  fontSize: "11px",
};

const savedBoxStyle = {
  padding: "6px",
  border:
    "1px solid #86efac",
  backgroundColor: "#ecfdf5",
  borderRadius: "4px",
  fontSize: "11px",
};

const newPendingStyle = {
  padding: "6px",
  borderRadius: "4px",
  backgroundColor: "#fef3c7",
  color: "#92400e",
  textAlign: "center",
  fontSize: "10px",
  fontWeight: "bold",
};

const pendingButtonStyle = {
  width: "100%",
  padding: "6px",
  border: "none",
  borderRadius: "4px",
  backgroundColor: "#facc15",
  color: "#713f12",
  cursor: "pointer",
  fontSize: "10px",
  fontWeight: "bold",
};

const paidStyle = {
  padding: "6px",
  borderRadius: "4px",
  backgroundColor: "#dcfce7",
  color: "#166534",
  textAlign: "center",
  fontSize: "10px",
  fontWeight: "bold",
};

const totalStyle = {
  display: "flex",
  justifyContent:
    "space-between",
  padding: "10px",
  backgroundColor: "#dcfce7",
  borderTop:
    "1px solid #bbf7d0",
  fontSize: "12px",
};

const summaryStyle = {
  display: "flex",
  justifyContent:
    "space-between",
  gap: "10px",
  padding: "8px 10px",
  fontSize: "10px",
  color: "#475569",
};

const buttonWrapStyle = {
  padding: "8px",
};

const saveButtonStyle = {
  width: "100%",
  padding: "9px",
  border: "none",
  borderRadius: "5px",
  backgroundColor: "#0873b9",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
};

const messageStyle = {
  margin: "7px 8px 0",
  padding: "7px",
  borderRadius: "4px",
  fontSize: "10px",
};

const noteStyle = {
  padding:
    "0 9px 9px",
  color: "#64748b",
  fontSize: "9px",
};
