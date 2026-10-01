"use client";

import { useEffect, useMemo, useState } from "react";

export default function ShiftExpenses({
  user,
  currentShift,
}) {
  const [expenses, setExpenses] = useState([]);
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

  const cashierId =
    user?.profile_id ||
    user?.id ||
    user?.user_id ||
    user?.auth_user_id ||
    null;

  const shiftId =
    currentShift?.id || null;

  // --------------------------------------------------
  // LOAD EXISTING EXPENSES
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

    async function loadExpenses() {
      try {
        setLoading(true);
        setMessage("");
        setMessageType("");

        const url =
          `${supabaseUrl}/rest/v1/expenses` +
          `?shift_id=eq.${encodeURIComponent(shiftId)}` +
          `&select=id,shift_id,description,amount,created_by,created_at` +
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
            "EXPENSE LOAD ERROR:",
            result
          );

          throw new Error(
            result?.message ||
              result?.details ||
              result?.hint ||
              "Unable to load expenses."
          );
        }

        if (cancelled) {
          return;
        }

        const loadedExpenses =
          Array.isArray(result)
            ? result
            : [];

        setExpenses(loadedExpenses);

        // Repair / synchronize total_expenses
        // whenever the page reloads.
        const totalExpenses =
          calculateTotalExpenses(
            loadedExpenses
          );

        try {
          await updateShiftExpenseTotal({
            supabaseUrl,
            supabaseAnonKey,
            accessToken,
            shiftId,
            totalExpenses,
          });
        } catch (syncError) {
          console.error(
            "INITIAL EXPENSE TOTAL SYNC ERROR:",
            syncError
          );

          if (!cancelled) {
            setMessage(
              syncError?.message ||
                "Expenses loaded, but the shift total could not be synchronized."
            );

            setMessageType("error");
          }
        }
      } catch (error) {
        console.error(
          "LOAD EXPENSES ERROR:",
          error
        );

        if (!cancelled) {
          setMessage(
            error?.message ||
              "Unable to load expenses."
          );

          setMessageType("error");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadExpenses();

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
  // TOTAL EXPENSES
  // --------------------------------------------------

  const totalExpenses = useMemo(() => {
    return calculateTotalExpenses(
      expenses
    );
  }, [expenses]);

  // --------------------------------------------------
  // SAVE EXPENSE
  // --------------------------------------------------

  async function saveExpense() {
    if (!shiftId) {
      setMessage(
        "No open shift was found."
      );
      setMessageType("error");
      return;
    }

    if (!cashierId) {
      setMessage(
        "Cashier information is missing."
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
        "Please enter the expense description."
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
        "Please enter a valid expense amount greater than zero."
      );
      setMessageType("error");
      return;
    }

    try {
      setSaving(true);
      setMessage("");
      setMessageType("");

      const expenseData = {
        shift_id: shiftId,
        description: cleanDescription,
        amount: roundMoney(
          numericAmount
        ),
        created_by: cashierId,
      };

      console.log(
        "Saving expense:",
        expenseData
      );

      // --------------------------------------------
      // INSERT EXPENSE
      // --------------------------------------------

      const response = await fetch(
        `${supabaseUrl}/rest/v1/expenses`,
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
            expenseData
          ),
        }
      );

      let result = null;

      try {
        result = await response.json();
      } catch {
        result = null;
      }

      if (!response.ok) {
        console.error(
          "EXPENSE INSERT ERROR:",
          result
        );

        throw new Error(
          result?.message ||
            result?.details ||
            result?.hint ||
            "Unable to save expense."
        );
      }

      if (
        !Array.isArray(result) ||
        result.length === 0
      ) {
        throw new Error(
          "Expense was saved, but the saved record was not returned."
        );
      }

      const savedExpense =
        result[0];

      const updatedExpenses = [
        ...expenses,
        savedExpense,
      ];

      setExpenses(
        updatedExpenses
      );

      setDescription("");
      setAmount("");

      // --------------------------------------------
      // CALCULATE NEW EXPENSE TOTAL
      // --------------------------------------------

      const newTotalExpenses =
        calculateTotalExpenses(
          updatedExpenses
        );

      // --------------------------------------------
      // UPDATE shifts.total_expenses
      // --------------------------------------------

      try {
        await updateShiftExpenseTotal({
          supabaseUrl,
          supabaseAnonKey,
          accessToken,
          shiftId,
          totalExpenses:
            newTotalExpenses,
        });
      } catch (syncError) {
        console.error(
          "POST-SAVE EXPENSE TOTAL SYNC ERROR:",
          syncError
        );

        setMessage(
          "Expense saved successfully, but the shift total could not be synchronized. Do not enter it again; refresh the page once."
        );

        setMessageType("error");
        return;
      }

      setMessage(
        "Expense saved and shift total updated successfully."
      );

      setMessageType(
        "success"
      );
    } catch (error) {
      console.error(
        "SAVE EXPENSE ERROR:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to save expense."
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
        Expenses
      </h2>

      <p
        style={{
          marginTop: 0,
          marginBottom: "22px",
          color: "#64748b",
        }}
      >
        Record expenses made during the current shift.
      </p>

      {/* TOTAL */}

      <div
        style={{
          backgroundColor: "#f8fafc",
          border:
            "1px solid #e2e8f0",
          borderRadius: "10px",
          padding: "16px",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            color: "#64748b",
            fontSize: "13px",
            marginBottom: "5px",
          }}
        >
          Total Expenses
        </div>

        <div
          style={{
            fontWeight: "bold",
            fontSize: "21px",
          }}
        >
          KES{" "}
          {Number(
            totalExpenses
          ).toLocaleString(
            "en-KE",
            {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }
          )}
        </div>
      </div>

      {/* ADD EXPENSE */}

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
          Add Expense
        </h3>

        <label
          style={{
            display: "block",
            fontWeight: "bold",
            marginBottom: "7px",
          }}
        >
          Expense Description
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
          placeholder="e.g. Electricity, transport, lunch"
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
          placeholder="Enter expense amount"
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
          onClick={saveExpense}
          disabled={saving}
          style={{
            width: "100%",
            padding: "14px",
            border: "none",
            borderRadius: "8px",

            backgroundColor:
              saving
                ? "#94a3b8"
                : "#dc2626",

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
            : "Save Expense"}
        </button>
      </div>

      {/* EXPENSE HISTORY */}

      <h3
        style={{
          marginBottom: "12px",
        }}
      >
        Expense History
      </h3>

      {loading ? (
        <div
          style={{
            color: "#64748b",
            padding: "12px 0",
          }}
        >
          Loading expenses...
        </div>
      ) : expenses.length === 0 ? (
        <div
          style={{
            padding: "14px",
            backgroundColor: "#f8fafc",
            borderRadius: "8px",
            color: "#64748b",
          }}
        >
          No expenses have been recorded yet.
        </div>
      ) : (
        <div>
          {expenses.map(
            (expense) => (
              <div
                key={expense.id}
                style={{
                  padding: "13px 0",
                  borderBottom:
                    "1px solid #e2e8f0",

                  display: "flex",
                  justifyContent:
                    "space-between",

                  alignItems: "center",
                  gap: "20px",
                }}
              >
                <div>
                  <div
                    style={{
                      fontWeight: "bold",
                    }}
                  >
                    {expense.description}
                  </div>

                  {expense.created_at && (
                    <div
                      style={{
                        color: "#94a3b8",
                        fontSize: "12px",
                        marginTop: "4px",
                      }}
                    >
                      {formatKenyaDate(
                        expense.created_at
                      )}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    fontWeight: "bold",
                    whiteSpace: "nowrap",
                  }}
                >
                  KES{" "}
                  {Number(
                    expense.amount || 0
                  ).toLocaleString(
                    "en-KE",
                    {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
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
// UPDATE shifts.total_expenses
// --------------------------------------------------

async function updateShiftExpenseTotal({
  supabaseUrl,
  supabaseAnonKey,
  accessToken,
  shiftId,
  totalExpenses,
}) {
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
        total_expenses:
          roundMoney(
            totalExpenses
          ),
      }),
    }
  );

  if (!response.ok) {
    let result = null;

    try {
      result = await response.json();
    } catch {
      result = null;
    }

    console.error(
      "SHIFT EXPENSE TOTAL UPDATE ERROR:",
      result
    );

    throw new Error(
      result?.message ||
        result?.details ||
        result?.hint ||
        "Unable to update the shift expense total."
    );
  }
}

// --------------------------------------------------
// CALCULATE EXPENSE TOTAL
// --------------------------------------------------

function calculateTotalExpenses(
  expenses
) {
  let total = 0;

  for (const expense of expenses) {
    total +=
      Number(
        expense.amount
      ) || 0;
  }

  return roundMoney(
    total
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
