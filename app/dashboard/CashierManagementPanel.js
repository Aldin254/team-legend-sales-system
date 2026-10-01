"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

export default function CashierManagementPanel({
  user,
  currentShift,
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const accessToken =
    user?.access_token || null;

  const shiftId =
    currentShift?.id || null;

  const cashierName =
    user?.full_name ||
    user?.name ||
    user?.username ||
    "Cashier";

  // ==================================================
  // LOAD MANAGEMENT STATUS
  // DIRECTLY FROM SAVINGS / BANKING
  // ==================================================

  const loadManagement = useCallback(
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
            `&select=id,description,amount,payment_status,created_at` +
            `&order=created_at.asc`,
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
          throw new Error(
            result?.message ||
              result?.details ||
              "Unable to load management status."
          );
        }

        setRows(
          Array.isArray(result)
            ? result
            : []
        );
      } catch (error) {
        console.error(
          "MANAGEMENT STATUS ERROR:",
          error
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
    ]
  );

  // ==================================================
  // AUTO REFRESH
  // ==================================================

  useEffect(() => {
    loadManagement();

    const timer =
      setInterval(
        loadManagement,
        5000
      );

    return () => {
      clearInterval(timer);
    };
  }, [loadManagement]);

  // ==================================================
  // DISPLAY
  // ==================================================

  return (
    <section style={panelStyle}>
      <div style={titleStyle}>
        MANAGEMENT STATUS
      </div>

      <div style={headerStyle}>
        <div>
          DESCRIPTION
        </div>

        <div>
          CASHIER
        </div>

        <div>
          AMOUNT
        </div>

        <div>
          DATE
        </div>

        <div>
          STATUS
        </div>
      </div>

      {loading ? (
        <div style={emptyStyle}>
          Loading...
        </div>
      ) : rows.length === 0 ? (
        <div style={emptyStyle}>
          No Savings / Banking entries yet.
        </div>
      ) : (
        rows.map((row) => {
          const paid =
            String(
              row.payment_status ||
                ""
            ).toUpperCase() ===
            "PAID";

          return (
            <div
              key={row.id}
              style={rowStyle}
            >
              <div style={descriptionStyle}>
                {row.description}
              </div>

              <div>
                {cashierName}
              </div>

              <div style={amountStyle}>
                {money(
                  row.amount
                )}
              </div>

              <div>
                {formatDate(
                  row.created_at
                )}
              </div>

              <div
                style={
                  paid
                    ? yesStyle
                    : noStyle
                }
              >
                {paid
                  ? "YES"
                  : "NO"}
              </div>
            </div>
          );
        })
      )}
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
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  );
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone:
        "Africa/Nairobi",

      day:
        "2-digit",

      month:
        "short",

      year:
        "numeric",
    }
  ).format(
    new Date(value)
  );
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

  fontWeight:
    "bold",

  fontSize:
    "14px",
};

const headerStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "1.5fr 0.9fr 0.8fr 0.9fr 0.6fr",

  gap:
    "5px",

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
    "1.5fr 0.9fr 0.8fr 0.9fr 0.6fr",

  gap:
    "5px",

  alignItems:
    "center",

  padding:
    "6px 8px",

  borderTop:
    "1px solid #e5e7eb",

  fontSize:
    "10px",
};

const descriptionStyle = {
  fontWeight:
    "bold",
};

const amountStyle = {
  textAlign:
    "right",
};

const yesStyle = {
  backgroundColor:
    "#16a34a",

  color:
    "white",

  fontWeight:
    "bold",

  textAlign:
    "center",

  padding:
    "5px",

  borderRadius:
    "3px",
};

const noStyle = {
  backgroundColor:
    "#ef233c",

  color:
    "white",

  fontWeight:
    "bold",

  textAlign:
    "center",

  padding:
    "5px",

  borderRadius:
    "3px",
};

const emptyStyle = {
  padding:
    "20px",

  color:
    "#64748b",

  textAlign:
    "center",

  fontSize:
    "11px",
};
