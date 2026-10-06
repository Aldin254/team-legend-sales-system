"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

const ACCOUNT_TYPES = [
  "RENT",
  "WIFI",
  "DSTV",
  "BANKING",
];

export default function AdminAccountsPanel({
  user,
}) {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const accessToken =
    user?.access_token ||
    null;

  const [shops, setShops] =
    useState([]);

  const [
    selectedShopId,
    setSelectedShopId,
  ] = useState("");

  const [accounts, setAccounts] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [
    loadingAccounts,
    setLoadingAccounts,
  ] = useState(false);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [messageType, setMessageType] =
    useState("");

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
  // LOAD SHOPS
  // ==================================================

  const loadShops =
    useCallback(
      async () => {
        if (
          !supabaseUrl ||
          !supabaseAnonKey ||
          !accessToken
        ) {
          setLoading(false);
          return;
        }

        try {
          setLoading(true);

          const response =
            await fetch(
              `${supabaseUrl}/rest/v1/shops` +
                `?is_active=eq.true` +
                `&select=id,shop_name,shop_type,is_active` +
                `&order=shop_name.asc`,
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
                "Unable to load shops."
            );
          }

          const rows =
            Array.isArray(result)
              ? result
              : [];

          setShops(
            rows
          );

          setSelectedShopId(
            (
              previous
            ) =>
              previous ||
              rows[0]?.id ||
              ""
          );
        } catch (error) {
          console.error(
            "ADMIN ACCOUNTS SHOPS ERROR:",
            error
          );

          setMessage(
            error?.message ||
              "Unable to load shops."
          );

          setMessageType(
            "error"
          );
        } finally {
          setLoading(false);
        }
      },
      [
        supabaseUrl,
        supabaseAnonKey,
        accessToken,
        authHeaders,
      ]
    );

  // ==================================================
  // LOAD SHOP ACCOUNTS
  // ==================================================

  const loadAccounts =
    useCallback(
      async (
        shopId
      ) => {
        if (
          !shopId ||
          !supabaseUrl ||
          !accessToken
        ) {
          setAccounts(
            makeBlankAccounts()
          );

          return;
        }

        try {
          setLoadingAccounts(
            true
          );

          setMessage("");
          setMessageType("");

          const response =
            await fetch(
              `${supabaseUrl}/rest/v1/shop_accounts` +
                `?shop_id=eq.${encodeURIComponent(
                  shopId
                )}` +
                `&select=id,shop_id,account_type,description,account_number,paybill_till,bank,is_active` +
                `&order=account_type.asc`,
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
                "Unable to load shop accounts."
            );
          }

          const existing =
            Array.isArray(result)
              ? result
              : [];

          const merged =
            ACCOUNT_TYPES.map(
              (
                type
              ) => {
                const found =
                  existing.find(
                    (
                      item
                    ) =>
                      String(
                        item.account_type ||
                          ""
                      )
                        .trim()
                        .toUpperCase() ===
                      type
                  );

                return {
                  id:
                    found?.id ||
                    null,

                  shop_id:
                    shopId,

                  account_type:
                    type,

                  description:
                    found?.description ||
                    type,

                  account_number:
                    found?.account_number ||
                    "",

                  paybill_till:
                    found?.paybill_till ||
                    "",

                  bank:
                    found?.bank ||
                    "",

                  is_active:
                    found?.is_active !==
                    false,
                };
              }
            );

          setAccounts(
            merged
          );
        } catch (error) {
          console.error(
            "ADMIN SHOP ACCOUNTS ERROR:",
            error
          );

          setAccounts(
            makeBlankAccounts(
              shopId
            )
          );

          setMessage(
            error?.message ||
              "Unable to load shop accounts."
          );

          setMessageType(
            "error"
          );
        } finally {
          setLoadingAccounts(
            false
          );
        }
      },
      [
        supabaseUrl,
        accessToken,
        authHeaders,
      ]
    );

  // ==================================================
  // INITIAL LOAD
  // ==================================================

  useEffect(() => {
    loadShops();
  }, [
    loadShops,
  ]);

  // ==================================================
  // LOAD WHEN SHOP CHANGES
  // ==================================================

  useEffect(() => {
    if (
      selectedShopId
    ) {
      loadAccounts(
        selectedShopId
      );
    }
  }, [
    selectedShopId,
    loadAccounts,
  ]);

  // ==================================================
  // SELECTED SHOP
  // ==================================================

  const selectedShop =
    useMemo(
      () =>
        shops.find(
          (
            shop
          ) =>
            String(
              shop.id
            ) ===
            String(
              selectedShopId
            )
        ) ||
        null,
      [
        shops,
        selectedShopId,
      ]
    );

  // ==================================================
  // UPDATE FIELD
  // ==================================================

  function updateAccount(
    type,
    field,
    value
  ) {
    setAccounts(
      (
        previous
      ) =>
        previous.map(
          (
            account
          ) =>
            account.account_type ===
            type
              ? {
                  ...account,

                  [field]:
                    value,
                }
              : account
        )
    );

    setMessage("");
    setMessageType("");
  }

  // ==================================================
  // SAVE ALL
  // ==================================================

  async function saveAccounts() {
    if (
      saving ||
      !selectedShopId
    ) {
      return;
    }

    try {
      setSaving(
        true
      );

      setMessage("");
      setMessageType("");

      for (
        const account
        of accounts
      ) {
        const payload = {
          shop_id:
            selectedShopId,

          account_type:
            account.account_type,

          description:
            cleanValue(
              account.description
            ) ||
            account.account_type,

          account_number:
            cleanValue(
              account.account_number
            ) ||
            null,

          paybill_till:
            cleanValue(
              account.paybill_till
            ) ||
            null,

          bank:
            cleanValue(
              account.bank
            ) ||
            null,

          is_active:
            Boolean(
              account.is_active
            ),
        };

        let response;

        if (
          account.id
        ) {
          response =
            await fetch(
              `${supabaseUrl}/rest/v1/shop_accounts` +
                `?id=eq.${encodeURIComponent(
                  account.id
                )}`,
              {
                method:
                  "PATCH",

                headers: {
                  ...authHeaders(),

                  Prefer:
                    "return=representation",
                },

                body:
                  JSON.stringify(
                    payload
                  ),

                cache:
                  "no-store",
              }
            );
        } else {
          response =
            await fetch(
              `${supabaseUrl}/rest/v1/shop_accounts`,
              {
                method:
                  "POST",

                headers: {
                  ...authHeaders(),

                  Prefer:
                    "return=representation",
                },

                body:
                  JSON.stringify(
                    payload
                  ),

                cache:
                  "no-store",
              }
            );
        }

        const result =
          await safeJson(
            response
          );

        if (!response.ok) {
          throw new Error(
            result?.message ||
              result?.details ||
              result?.hint ||
              `Unable to save ${account.account_type}.`
          );
        }
      }

      setMessage(
        `${selectedShop?.shop_name || "Shop"} account information saved successfully.`
      );

      setMessageType(
        "success"
      );

      await loadAccounts(
        selectedShopId
      );
    } catch (error) {
      console.error(
        "SAVE SHOP ACCOUNTS ERROR:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to save account information."
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

  if (
    loading
  ) {
    return (
      <div style={loadingStyle}>
        Loading shop accounts...
      </div>
    );
  }

  return (
    <section style={wrapperStyle}>
      {/* SHOP CONTROL */}

      <div style={controlPanelStyle}>
        <div>
          <div style={controlTitleStyle}>
            SHOP ACCOUNT INFORMATION
          </div>

          <div style={controlSubtitleStyle}>
            Manage Rent, WIFI, DSTV and Banking details shown to cashiers.
          </div>
        </div>

        <div style={shopControlStyle}>
          <label style={labelStyle}>
            SELECT SHOP
          </label>

          <select
            value={
              selectedShopId
            }
            onChange={(
              event
            ) => {
              setSelectedShopId(
                event.target.value
              );

              setMessage("");
              setMessageType("");
            }}
            style={shopSelectStyle}
          >
            {shops.length ===
            0 ? (
              <option value="">
                No active shops
              </option>
            ) : (
              shops.map(
                (
                  shop
                ) => (
                  <option
                    key={
                      shop.id
                    }
                    value={
                      shop.id
                    }
                  >
                    {
                      shop.shop_name
                    }
                  </option>
                )
              )
            )}
          </select>
        </div>
      </div>

      {/* SHOP NAME */}

      {selectedShop && (
        <div style={selectedShopStyle}>
          Editing account information for{" "}
          <strong>
            {
              selectedShop.shop_name
            }
          </strong>
        </div>
      )}

      {/* MESSAGE */}

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

      {/* ACCOUNT TABLE */}

      <div style={panelStyle}>
        <div style={tableTitleStyle}>
          ACCOUNTS INFORMATION
        </div>

        <div style={headerRowStyle}>
          <div>
            TYPE
          </div>

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

          <div>
            ACTIVE
          </div>
        </div>

        {loadingAccounts ? (
          <div style={emptyStyle}>
            Loading account information...
          </div>
        ) : (
          accounts.map(
            (
              account
            ) => (
              <div
                key={
                  account.account_type
                }
                style={accountRowStyle}
              >
                <div style={accountTypeStyle}>
                  {
                    account.account_type
                  }
                </div>

                <input
                  type="text"
                  value={
                    account.description
                  }
                  onChange={(
                    event
                  ) =>
                    updateAccount(
                      account.account_type,
                      "description",
                      event.target.value
                    )
                  }
                  placeholder={
                    account.account_type
                  }
                  style={inputStyle}
                />

                <input
                  type="text"
                  value={
                    account.account_number
                  }
                  onChange={(
                    event
                  ) =>
                    updateAccount(
                      account.account_type,
                      "account_number",
                      event.target.value
                    )
                  }
                  placeholder="Account number"
                  style={inputStyle}
                />

                <input
                  type="text"
                  value={
                    account.paybill_till
                  }
                  onChange={(
                    event
                  ) =>
                    updateAccount(
                      account.account_type,
                      "paybill_till",
                      event.target.value
                    )
                  }
                  placeholder="PayBill / Till"
                  style={inputStyle}
                />

                <input
                  type="text"
                  value={
                    account.bank
                  }
                  onChange={(
                    event
                  ) =>
                    updateAccount(
                      account.account_type,
                      "bank",
                      event.target.value
                    )
                  }
                  placeholder="Bank / Provider"
                  style={inputStyle}
                />

                <label style={activeWrapStyle}>
                  <input
                    type="checkbox"
                    checked={
                      account.is_active
                    }
                    onChange={(
                      event
                    ) =>
                      updateAccount(
                        account.account_type,
                        "is_active",
                        event.target.checked
                      )
                    }
                  />

                  <span>
                    {account.is_active
                      ? "YES"
                      : "NO"}
                  </span>
                </label>
              </div>
            )
          )
        )}

        <div style={noteStyle}>
          Active account information is automatically available on the cashier Accounts Information panel.
        </div>
      </div>

      {/* SAVE */}

      <button
        type="button"
        onClick={
          saveAccounts
        }
        disabled={
          saving ||
          !selectedShopId ||
          loadingAccounts
        }
        style={{
          ...saveButtonStyle,

          opacity:
            saving ||
            !selectedShopId ||
            loadingAccounts
              ? 0.6
              : 1,
        }}
      >
        {saving
          ? "SAVING..."
          : "SAVE ACCOUNT INFORMATION"}
      </button>
    </section>
  );
}

// ==================================================
// HELPERS
// ==================================================

function makeBlankAccounts(
  shopId = ""
) {
  return ACCOUNT_TYPES.map(
    (
      type
    ) => ({
      id:
        null,

      shop_id:
        shopId,

      account_type:
        type,

      description:
        type,

      account_number:
        "",

      paybill_till:
        "",

      bank:
        "",

      is_active:
        true,
    })
  );
}

function cleanValue(
  value
) {
  return String(
    value ??
      ""
  ).trim();
}

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
// STYLES
// ==================================================

const wrapperStyle = {
  width:
    "100%",

  display:
    "grid",

  gap:
    "12px",
};

const controlPanelStyle = {
  backgroundColor:
    "#0f766e",

  color:
    "white",

  borderRadius:
    "7px",

  padding:
    "14px",

  display:
    "flex",

  justifyContent:
    "space-between",

  alignItems:
    "end",

  gap:
    "20px",

  flexWrap:
    "wrap",
};

const controlTitleStyle = {
  fontSize:
    "15px",

  fontWeight:
    "900",
};

const controlSubtitleStyle = {
  marginTop:
    "4px",

  fontSize:
    "9px",

  color:
    "#ccfbf1",
};

const shopControlStyle = {
  minWidth:
    "240px",
};

const labelStyle = {
  display:
    "block",

  marginBottom:
    "5px",

  fontSize:
    "9px",

  fontWeight:
    "bold",
};

const shopSelectStyle = {
  width:
    "100%",

  padding:
    "9px",

  border:
    "1px solid #cbd5e1",

  borderRadius:
    "5px",

  backgroundColor:
    "white",
};

const selectedShopStyle = {
  padding:
    "10px",

  backgroundColor:
    "#ecfeff",

  border:
    "1px solid #a5f3fc",

  borderRadius:
    "5px",

  color:
    "#155e75",

  fontSize:
    "10px",
};

const panelStyle = {
  backgroundColor:
    "white",

  border:
    "1px solid #cbd5e1",

  borderRadius:
    "7px",

  overflowX:
    "auto",
};

const tableTitleStyle = {
  backgroundColor:
    "#0873b9",

  color:
    "white",

  padding:
    "10px 12px",

  fontSize:
    "13px",

  fontWeight:
    "900",
};

const headerRowStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "100px 1fr 1.2fr 1fr 1fr 80px",

  minWidth:
    "900px",

  gap:
    "6px",

  padding:
    "8px",

  backgroundColor:
    "#eef4f8",

  color:
    "#475569",

  fontSize:
    "8px",

  fontWeight:
    "bold",

  textAlign:
    "center",
};

const accountRowStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "100px 1fr 1.2fr 1fr 1fr 80px",

  minWidth:
    "900px",

  gap:
    "6px",

  alignItems:
    "center",

  padding:
    "8px",

  borderTop:
    "1px solid #e2e8f0",
};

const accountTypeStyle = {
  color:
    "#0f172a",

  fontWeight:
    "900",

  fontSize:
    "10px",
};

const inputStyle = {
  width:
    "100%",

  boxSizing:
    "border-box",

  padding:
    "8px",

  border:
    "1px solid #94a3b8",

  borderRadius:
    "4px",

  fontSize:
    "10px",
};

const activeWrapStyle = {
  display:
    "flex",

  justifyContent:
    "center",

  alignItems:
    "center",

  gap:
    "5px",

  fontSize:
    "9px",

  fontWeight:
    "bold",
};

const noteStyle = {
  padding:
    "9px",

  borderTop:
    "1px solid #e2e8f0",

  backgroundColor:
    "#f8fafc",

  color:
    "#64748b",

  textAlign:
    "center",

  fontSize:
    "9px",
};

const saveButtonStyle = {
  width:
    "100%",

  padding:
    "11px",

  border:
    "none",

  borderRadius:
    "5px",

  backgroundColor:
    "#15803d",

  color:
    "white",

  fontWeight:
    "900",

  cursor:
    "pointer",
};

const successStyle = {
  padding:
    "10px",

  backgroundColor:
    "#f0fdf4",

  border:
    "1px solid #86efac",

  borderRadius:
    "5px",

  color:
    "#166534",

  fontSize:
    "10px",

  fontWeight:
    "bold",
};

const errorStyle = {
  padding:
    "10px",

  backgroundColor:
    "#fef2f2",

  border:
    "1px solid #fecaca",

  borderRadius:
    "5px",

  color:
    "#991b1b",

  fontSize:
    "10px",

  fontWeight:
    "bold",
};

const loadingStyle = {
  padding:
    "30px",

  backgroundColor:
    "white",

  border:
    "1px solid #cbd5e1",

  borderRadius:
    "7px",

  color:
    "#64748b",

  textAlign:
    "center",
};

const emptyStyle = {
  minWidth:
    "900px",

  padding:
    "25px",

  boxSizing:
    "border-box",

  color:
    "#64748b",

  textAlign:
    "center",

  fontSize:
    "10px",
};
