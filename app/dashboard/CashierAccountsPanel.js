"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

export default function CashierAccountsPanel({
  user,
}) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const accessToken =
    user?.access_token || null;

  const shopId =
    user?.shop_id ||
    user?.shopId ||
    null;

  // ================================================
  // LOAD SHOP ACCOUNTS
  // ================================================

  const loadAccounts = useCallback(
    async () => {
      if (
        !shopId ||
        !accessToken ||
        !supabaseUrl ||
        !supabaseAnonKey
      ) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/shop_accounts` +
            `?shop_id=eq.${encodeURIComponent(shopId)}` +
            `&is_active=eq.true` +
            `&select=id,account_type,description,account_number,paybill_till,bank,is_active`,
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
              "Unable to load accounts."
          );
        }

        setAccounts(
          Array.isArray(result)
            ? result
            : []
        );
      } catch (error) {
        console.error(
          "ACCOUNTS ERROR:",
          error
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

  // ================================================
  // AUTO REFRESH
  // ================================================

  useEffect(() => {
    loadAccounts();

    const timer =
      setInterval(
        loadAccounts,
        5000
      );

    return () => {
      clearInterval(timer);
    };
  }, [loadAccounts]);

  // ================================================
  // ORDER
  // ================================================

  const orderedAccounts =
    useMemo(() => {
      const order = [
        "RENT",
        "WIFI",
        "DSTV",
        "BANKING",
      ];

      return [...accounts].sort(
        (a, b) =>
          order.indexOf(
            a.account_type
          ) -
          order.indexOf(
            b.account_type
          )
      );
    }, [accounts]);

  // ================================================
  // DISPLAY
  // ================================================

  return (
    <section style={panelStyle}>
      <div style={titleStyle}>
        ACCOUNTS INFORMATION
      </div>

      <div style={headerStyle}>
        <div>
          DESCRIPTION
        </div>

        <div>
          ACCOUNT NUMBER
        </div>

        <div>
          PAYBILL / TILL
        </div>

        <div>
          BANK
        </div>
      </div>

      {loading ? (
        <div style={emptyStyle}>
          Loading accounts...
        </div>
      ) : orderedAccounts.length === 0 ? (
        <div style={emptyStyle}>
          No account information available.
        </div>
      ) : (
        orderedAccounts.map(
          (account) => (
            <div
              key={account.id}
              style={rowStyle}
            >
              <div style={typeStyle}>
                {account.account_type}
              </div>

              <div style={valueStyle}>
                {showValue(
                  account.account_number
                )}
              </div>

              <div style={valueStyle}>
                {showValue(
                  account.paybill_till
                )}
              </div>

              <div style={valueStyle}>
                {showValue(
                  account.bank
                )}
              </div>
            </div>
          )
        )
      )}

      <div style={noteStyle}>
        Account information is managed by Admin.
      </div>
    </section>
  );
}

// ================================================
// HELPERS
// ================================================

function showValue(value) {
  const clean =
    String(
      value ?? ""
    ).trim();

  return clean || "-";
}

// ================================================
// STYLES
// ================================================

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
    "0.8fr 1.2fr 1.1fr 1fr",

  gap:
    "5px",

  padding:
    "8px",

  backgroundColor:
    "#eef4f8",

  fontSize:
    "8px",

  fontWeight:
    "bold",

  textAlign:
    "center",
};

const rowStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "0.8fr 1.2fr 1.1fr 1fr",

  gap:
    "5px",

  alignItems:
    "center",

  padding:
    "7px 8px",

  borderTop:
    "1px solid #e5e7eb",

  fontSize:
    "10px",
};

const typeStyle = {
  fontWeight:
    "bold",

  color:
    "#0f172a",
};

const valueStyle = {
  backgroundColor:
    "#f8fafc",

  border:
    "1px solid #e2e8f0",

  borderRadius:
    "3px",

  padding:
    "6px 4px",

  textAlign:
    "center",

  minHeight:
    "14px",
};

const noteStyle = {
  padding:
    "8px",

  borderTop:
    "1px solid #e5e7eb",

  color:
    "#64748b",

  fontSize:
    "9px",

  textAlign:
    "center",
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
