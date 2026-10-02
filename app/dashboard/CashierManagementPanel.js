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
  const [rows, setRows] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const accessToken =
    user?.access_token || null;

  const shopId =
    currentShift?.shop_id ||
    user?.shop_id ||
    null;

  // ==================================================
  // LOAD MANAGEMENT STATUS
  // READ-ONLY FOR CASHIER
  // ==================================================

  const loadManagement =
    useCallback(
      async () => {
        if (
          !shopId ||
          !accessToken ||
          !supabaseUrl ||
          !supabaseAnonKey
        ) {
          setRows([]);
          setLoading(false);
          return;
        }

        try {
          setError("");

          const response =
            await fetch(
              `${supabaseUrl}/rest/v1/management_status` +
                `?shop_id=eq.${encodeURIComponent(
                  shopId
                )}` +
                `&is_active=eq.true` +
                `&select=id,shop_id,description,cashier_name,amount,due_date,status,is_active,created_at,updated_at` +
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

                cache:
                  "no-store",
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

          setError(
            error?.message ||
              "Unable to load Management Status."
          );
        } finally {
          setLoading(false);
        }
      },
      [
        shopId,
        accessToken,
        supabaseUrl,
        supabaseAnonKey,
      ]
    );

  // ==================================================
  // AUTO REFRESH
  // ==================================================

  useEffect(() => {
    setLoading(true);

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
      ) : error ? (
        <div style={errorStyle}>
          {error}
        </div>
      ) : rows.length === 0 ? (
        <div style={emptyStyle}>
          No Management Status entries yet.
        </div>
      ) : (
        rows.map((row) => {
          const status =
            String(
              row.status ||
                "PENDING"
            ).toUpperCase();

          const paid =
            status ===
            "PAID";

          return (
            <div
              key={row.id}
              style={rowStyle}
            >
              <div
                style={
                  descriptionStyle
                }
              >
                {row.description ||
                  "-"}
              </div>

              <div
                style={
                  centerStyle
                }
              >
                {row.cashier_name ||
                  "-"}
              </div>

              <div
                style={
                  amountStyle
                }
              >
                {money(
                  row.amount
                )}
              </div>

              <div
                style={
                  centerStyle
                }
              >
                {formatDate(
                  row.due_date
                )}
              </div>

              <div
                style={
                  paid
                    ? paidStyle
                    : pendingStyle
                }
              >
                {status}
              </div>
            </div>
          );
        })
      )}

      <div style={footerStyle}>
        Management Status is controlled by Admin.
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
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  );
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  const date =
    new Date(
      `${value}T00:00:00`
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
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
  ).format(date);
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
    "1.5fr 0.9fr 0.8fr 0.9fr 0.7fr",

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
    "1.5fr 0.9fr 0.8fr 0.9fr 0.7fr",

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

const centerStyle = {
  textAlign:
    "center",
};

const amountStyle = {
  textAlign:
    "right",

  fontWeight:
    "bold",
};

const paidStyle = {
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

const pendingStyle = {
  backgroundColor:
    "#f59e0b",

  color:
    "#111827",

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

const errorStyle = {
  padding:
    "12px",

  color:
    "#b91c1c",

  backgroundColor:
    "#fee2e2",

  textAlign:
    "center",

  fontSize:
    "11px",
};

const footerStyle = {
  padding:
    "6px 8px",

  borderTop:
    "1px solid #e5e7eb",

  color:
    "#64748b",

  textAlign:
    "center",

  fontSize:
    "9px",
};
