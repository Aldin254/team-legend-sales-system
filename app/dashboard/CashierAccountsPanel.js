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
  const [accounts, setAccounts] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env
      .NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const accessToken =
    user?.access_token ||
    null;

  const shopId =
    user?.shop_id ||
    user?.shopId ||
    null;

  // ================================================
  // LOAD SHOP ACCOUNTS
  // ================================================

  const loadAccounts =
    useCallback(
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
          const response =
            await fetch(
              `${supabaseUrl}/rest/v1/shop_accounts` +
                `?shop_id=eq.${encodeURIComponent(
                  shopId
                )}` +
                `&is_active=eq.true` +
                `&select=id,account_type,description,account_number,paybill_till,bank,is_active`,
              {
                method:
                  "GET",

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

          let result =
            null;

          try {
            result =
              await response.json();
          } catch {
            result =
              null;
          }

          if (
            !response.ok
          ) {
            throw new Error(
              result?.message ||
                result?.details ||
                "Unable to load accounts."
            );
          }

          setAccounts(
            Array.isArray(
              result
            )
              ? result
              : []
          );
        } catch (error) {
          console.error(
            "ACCOUNTS ERROR:",
            error
          );
        } finally {
          setLoading(
            false
          );
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
      clearInterval(
        timer
      );
    };
  }, [
    loadAccounts,
  ]);

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

      return [
        ...accounts,
      ].sort(
        (a, b) =>
          order.indexOf(
            a.account_type
          ) -
          order.indexOf(
            b.account_type
          )
      );
    }, [
      accounts,
    ]);

  // ================================================
  // DISPLAY
  // ================================================

  return (
    <section
      style={
        panelStyle
      }
    >
      <div
        style={
          titleStyle
        }
      >
        ACCOUNTS INFORMATION
      </div>

      <div
        style={
          headerStyle
        }
      >
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
        <div
          style={
            emptyStyle
          }
        >
          Loading accounts...
        </div>
      ) : orderedAccounts.length ===
        0 ? (
        <div
          style={
            emptyStyle
          }
        >
          No account information available.
        </div>
      ) : (
        orderedAccounts.map(
          (
            account
          ) => (
            <div
              key={
                account.id
              }
              style={
                rowStyle
              }
            >
              <div
                style={
                  typeStyle
                }
              >
                {
                  account.account_type
                }
              </div>

              <div
                style={
                  valueStyle
                }
              >
                {showValue(
                  account.account_number
                )}
              </div>

              <div
                style={
                  valueStyle
                }
              >
                {showValue(
                  account.paybill_till
                )}
              </div>

              <div
                style={
                  valueStyle
                }
              >
                {showValue(
                  account.bank
                )}
              </div>
            </div>
          )
        )
      )}

      <div
        style={
          noteStyle
        }
      >
        Account information is managed by Admin.
      </div>
    </section>
  );
}

// ================================================
// HELPERS
// ================================================

function showValue(
  value
) {
  const clean =
    String(
      value ??
        ""
    ).trim();

  return (
    clean ||
    "-"
  );
}

// ================================================
// PROFESSIONAL MATTE BLACK STYLES
// ================================================

const panelStyle = {
  minWidth:
    0,

  background:
    "linear-gradient(180deg, #11161C 0%, #0B0F13 100%)",

  color:
    "#FFFFFF",

  border:
    "1px solid #303840",

  borderRadius:
    "14px",

  overflow:
    "hidden",

  boxShadow:
    "0 10px 28px rgba(0,0,0,0.22)",
};


const titleStyle = {
  padding:
    "13px 15px",

  background:
    "linear-gradient(145deg, rgba(215,179,106,0.15), rgba(17,22,28,0.98))",

  color:
    "#FFFFFF",

  borderBottom:
    "1px solid rgba(215,179,106,0.34)",

  borderLeft:
    "4px solid #D7B36A",

  fontWeight:
    950,

  fontSize:
    "15px",

  letterSpacing:
    "0.5px",
};


const headerStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "0.8fr 1.2fr 1.1fr 1fr",

  gap:
    "6px",

  padding:
    "9px",

  backgroundColor:
    "#11161C",

  color:
    "#FFFFFF",

  borderBottom:
    "1px solid #343C45",

  fontSize:
    "9px",

  fontWeight:
    900,

  textAlign:
    "center",

  letterSpacing:
    "0.3px",
};


const rowStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "0.8fr 1.2fr 1.1fr 1fr",

  gap:
    "6px",

  alignItems:
    "center",

  padding:
    "8px",

  backgroundColor:
    "#0D1115",

  borderBottom:
    "1px solid #252B31",

  color:
    "#FFFFFF",

  fontSize:
    "11px",
};


const typeStyle = {
  fontWeight:
    900,

  color:
    "#FFFFFF",

  letterSpacing:
    "0.2px",
};


const valueStyle = {
  minHeight:
    "20px",

  padding:
    "7px 6px",

  display:
    "flex",

  alignItems:
    "center",

  justifyContent:
    "center",

  backgroundColor:
    "#080B0E",

  color:
    "#FFFFFF",

  border:
    "1px solid #3D4650",

  borderRadius:
    "7px",

  textAlign:
    "center",

  fontWeight:
    750,

  wordBreak:
    "break-word",
};


const noteStyle = {
  padding:
    "9px 10px",

  borderTop:
    "1px solid #292F36",

  backgroundColor:
    "#0D1115",

  color:
    "#AAB2BC",

  fontSize:
    "9px",

  textAlign:
    "center",

  lineHeight:
    1.45,
};


const emptyStyle = {
  padding:
    "20px",

  backgroundColor:
    "#0D1115",

  color:
    "#FFFFFF",

  textAlign:
    "center",

  fontSize:
    "11px",

  fontWeight:
    750,
};
