"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

export default function AdminAccountsPanel({
  user,
}) {
  const [shops, setShops] = useState([]);
  const [selectedShopId, setSelectedShopId] = useState("");
  const [accounts, setAccounts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const accessToken =
    user?.access_token || null;

  // ==================================================
  // AUTH HEADERS
  // ==================================================

  const headers = useMemo(() => {
    return {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };
  }, [
    supabaseAnonKey,
    accessToken,
  ]);

  // ==================================================
  // LOAD SHOPS
  // ==================================================

  const loadShops = useCallback(
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
        const response = await fetch(
          `${supabaseUrl}/rest/v1/shops` +
            `?select=id,shop_name,is_active` +
            `&is_active=eq.true` +
            `&order=shop_name.asc`,
          {
            method: "GET",
            headers,
            cache: "no-store",
          }
        );

        const result =
          await safeJson(response);

        if (!response.ok) {
          throw new Error(
            result?.message ||
              result?.details ||
              "Unable to load shops."
          );
        }

        const loadedShops =
          Array.isArray(result)
            ? result
            : [];

        setShops(loadedShops);

        setSelectedShopId(
          (previous) =>
            previous ||
            loadedShops[0]?.id ||
            ""
        );
      } catch (error) {
        console.error(
          "LOAD SHOPS ERROR:",
          error
        );

        setMessage(
          error?.message ||
            "Unable to load shops."
        );

        setMessageType("error");
      }
    },
    [
      supabaseUrl,
      supabaseAnonKey,
      accessToken,
      headers,
    ]
  );

  // ==================================================
  // LOAD ACCOUNTS
  // ==================================================

  const loadAccounts = useCallback(
    async () => {
      if (
        !selectedShopId ||
        !supabaseUrl ||
        !supabaseAnonKey ||
        !accessToken
      ) {
        setAccounts([]);
        return;
      }

      try {
        setLoading(true);

        const response = await fetch(
          `${supabaseUrl}/rest/v1/shop_accounts` +
            `?shop_id=eq.${encodeURIComponent(
              selectedShopId
            )}` +
            `&select=id,shop_id,account_type,description,account_number,paybill_till,bank,is_active`,
          {
            method: "GET",
            headers,
            cache: "no-store",
          }
        );

        const result =
          await safeJson(response);

        if (!response.ok) {
          throw new Error(
            result?.message ||
              result?.details ||
              "Unable to load account information."
          );
        }

        const loaded =
          Array.isArray(result)
            ? result
            : [];

        const order = [
          "RENT",
          "WIFI",
          "DSTV",
          "BANKING",
        ];

        loaded.sort(
          (a, b) =>
            order.indexOf(
              a.account_type
            ) -
            order.indexOf(
              b.account_type
            )
        );

        setAccounts(loaded);
      } catch (error) {
        console.error(
          "LOAD ACCOUNTS ERROR:",
          error
        );

        setMessage(
          error?.message ||
            "Unable to load account information."
        );

        setMessageType("error");
      } finally {
        setLoading(false);
      }
    },
    [
      selectedShopId,
      supabaseUrl,
      supabaseAnonKey,
      accessToken,
      headers,
    ]
  );

  // ==================================================
  // INITIAL LOAD
  // ==================================================

  useEffect(() => {
    loadShops();
  }, [loadShops]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // ==================================================
  // EDIT FIELD
  // ==================================================

  function updateLocalField(
    accountId,
    field,
    value
  ) {
    setAccounts(
      (previous) =>
        previous.map(
          (account) =>
            account.id === accountId
              ? {
                  ...account,
                  [field]: value,
                }
              : account
        )
    );

    setMessage("");
  }

  // ==================================================
  // SAVE ONE ACCOUNT ROW
  // ==================================================

  async function saveAccount(
    account
  ) {
    if (!account?.id) {
      return;
    }

    try {
      setSavingId(
        account.id
      );

      setMessage("");
      setMessageType("");

      const response =
        await fetch(
          `${supabaseUrl}/rest/v1/shop_accounts` +
            `?id=eq.${encodeURIComponent(
              account.id
            )}`,
          {
            method: "PATCH",

            headers: {
              ...headers,
              Prefer:
                "return=representation",
            },

            body: JSON.stringify({
              description:
                cleanValue(
                  account.description
                ),

              account_number:
                cleanValue(
                  account.account_number
                ),

              paybill_till:
                cleanValue(
                  account.paybill_till
                ),

              bank:
                cleanValue(
                  account.bank
                ),
            }),
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
            result?.hint ||
            "Unable to save account information."
        );
      }

      setMessage(
        `${account.account_type} account saved successfully.`
      );

      setMessageType(
        "success"
      );

      await loadAccounts();
    } catch (error) {
      console.error(
        "SAVE ACCOUNT ERROR:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to save account information."
      );

      setMessageType("error");
    } finally {
      setSavingId(null);
    }
  }

  // ==================================================
  // SELECTED SHOP NAME
  // ==================================================

  const selectedShop =
    shops.find(
      (shop) =>
        shop.id ===
        selectedShopId
    );

  // ==================================================
  // DISPLAY
  // ==================================================

  return (
    <section style={panelStyle}>
      <div style={titleStyle}>
        ACCOUNTS MANAGEMENT
      </div>

      <div style={toolbarStyle}>
        <div>
          <div style={labelStyle}>
            SELECT SHOP
          </div>

          <select
            value={
              selectedShopId
            }
            onChange={(event) => {
              setSelectedShopId(
                event.target.value
              );

              setMessage("");
            }}
            style={selectStyle}
          >
            {shops.map(
              (shop) => (
                <option
                  key={shop.id}
                  value={shop.id}
                >
                  {shop.shop_name}
                </option>
              )
            )}
          </select>
        </div>

        <div style={shopInfoStyle}>
          Editing accounts for
          <strong>
            {" "}
            {selectedShop?.shop_name ||
              "-"}
          </strong>
        </div>
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

      <div style={headerStyle}>
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
          ACTION
        </div>
      </div>

      {loading ? (
        <div style={emptyStyle}>
          Loading account information...
        </div>
      ) : accounts.length === 0 ? (
        <div style={emptyStyle}>
          No account rows found for this shop.
        </div>
      ) : (
        accounts.map(
          (account) => (
            <div
              key={account.id}
              style={rowStyle}
            >
              <div style={typeStyle}>
                {account.account_type}
              </div>

              <input
                type="text"
                value={
                  account.description ||
                  ""
                }
                onChange={(event) =>
                  updateLocalField(
                    account.id,
                    "description",
                    event.target.value
                  )
                }
                style={inputStyle}
              />

              <input
                type="text"
                value={
                  account.account_number ||
                  ""
                }
                placeholder="Account number"
                onChange={(event) =>
                  updateLocalField(
                    account.id,
                    "account_number",
                    event.target.value
                  )
                }
                style={inputStyle}
              />

              <input
                type="text"
                value={
                  account.paybill_till ||
                  ""
                }
                placeholder="Paybill / Till"
                onChange={(event) =>
                  updateLocalField(
                    account.id,
                    "paybill_till",
                    event.target.value
                  )
                }
                style={inputStyle}
              />

              <input
                type="text"
                value={
                  account.bank ||
                  ""
                }
                placeholder="Bank"
                onChange={(event) =>
                  updateLocalField(
                    account.id,
                    "bank",
                    event.target.value
                  )
                }
                style={inputStyle}
              />

              <button
                type="button"
                disabled={
                  savingId ===
                  account.id
                }
                onClick={() =>
                  saveAccount(
                    account
                  )
                }
                style={saveButtonStyle}
              >
                {savingId ===
                account.id
                  ? "Saving..."
                  : "Save"}
              </button>
            </div>
          )
        )
      )}

      <div style={noteStyle}>
        Changes made here will automatically appear on the cashier dashboard for the selected shop.
      </div>
    </section>
  );
}

// ==================================================
// HELPERS
// ==================================================

function cleanValue(
  value
) {
  const cleaned =
    String(
      value ?? ""
    ).trim();

  return cleaned === ""
    ? null
    : cleaned;
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

const panelStyle = {
  backgroundColor:
    "#ffffff",

  borderRadius:
    "8px",

  overflow:
    "hidden",

  boxShadow:
    "0 1px 6px rgba(0,0,0,0.12)",
};

const titleStyle = {
  backgroundColor:
    "#063c63",

  color:
    "white",

  padding:
    "14px",

  fontSize:
    "17px",

  fontWeight:
    "bold",
};

const toolbarStyle = {
  display:
    "flex",

  justifyContent:
    "space-between",

  alignItems:
    "end",

  gap:
    "15px",

  padding:
    "15px",

  backgroundColor:
    "#f1f5f9",
};

const labelStyle = {
  fontSize:
    "10px",

  fontWeight:
    "bold",

  marginBottom:
    "5px",
};

const selectStyle = {
  minWidth:
    "240px",

  padding:
    "9px",

  border:
    "1px solid #94a3b8",

  borderRadius:
    "5px",

  backgroundColor:
    "white",
};

const shopInfoStyle = {
  fontSize:
    "12px",

  color:
    "#475569",
};

const headerStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "0.7fr 1.3fr 1.2fr 1.2fr 1fr 0.7fr",

  gap:
    "7px",

  padding:
    "9px",

  backgroundColor:
    "#0873b9",

  color:
    "white",

  fontSize:
    "10px",

  fontWeight:
    "bold",

  textAlign:
    "center",
};

const rowStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "0.7fr 1.3fr 1.2fr 1.2fr 1fr 0.7fr",

  gap:
    "7px",

  padding:
    "8px 9px",

  alignItems:
    "center",

  borderBottom:
    "1px solid #e2e8f0",
};

const typeStyle = {
  fontWeight:
    "bold",

  fontSize:
    "11px",

  color:
    "#0f172a",
};

const inputStyle = {
  width:
    "100%",

  boxSizing:
    "border-box",

  padding:
    "8px",

  border:
    "1px solid #cbd5e1",

  borderRadius:
    "4px",

  fontSize:
    "11px",
};

const saveButtonStyle = {
  padding:
    "8px 10px",

  border:
    "none",

  borderRadius:
    "4px",

  backgroundColor:
    "#07912a",

  color:
    "white",

  cursor:
    "pointer",

  fontWeight:
    "bold",
};

const messageStyle = {
  margin:
    "10px 15px",

  padding:
    "9px",

  borderRadius:
    "5px",

  fontSize:
    "11px",
};

const emptyStyle = {
  padding:
    "25px",

  textAlign:
    "center",

  color:
    "#64748b",
};

const noteStyle = {
  padding:
    "12px",

  backgroundColor:
    "#f8fafc",

  color:
    "#64748b",

  fontSize:
    "10px",

  textAlign:
    "center",
};
