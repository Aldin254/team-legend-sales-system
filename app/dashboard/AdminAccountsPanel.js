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
  "ELECTRICITY",
  "BANKING",
];

const FIXED_AMOUNT_TYPES =
  new Set([
    "RENT",
    "WIFI",
    "DSTV",
  ]);

export default function AdminAccountsPanel({
  user,
}) {
  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env
      .NEXT_PUBLIC_SUPABASE_ANON_KEY;

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

  const [
    auditHistory,
    setAuditHistory,
  ] = useState([]);

  const [loading, setLoading] =
    useState(true);

  const [
    loadingAccounts,
    setLoadingAccounts,
  ] = useState(false);

  const [
    loadingHistory,
    setLoadingHistory,
  ] = useState(false);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [
    messageType,
    setMessageType,
  ] = useState("");

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
            Array.isArray(
              result
            )
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
            makeBlankAccounts(
              shopId
            )
          );

          return;
        }

        try {
          setLoadingAccounts(
            true
          );

          const response =
            await fetch(
              `${supabaseUrl}/rest/v1/shop_accounts` +
                `?shop_id=eq.${encodeURIComponent(
                  shopId
                )}` +
                `&select=id,shop_id,account_type,description,account_number,paybill_till,bank,is_active,obligation_amount,obligation_change_reason` +
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
            Array.isArray(
              result
            )
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

                const obligation =
                  found
                    ?.obligation_amount ===
                    null ||
                  found
                    ?.obligation_amount ===
                    undefined
                    ? ""
                    : String(
                        found
                          .obligation_amount
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

                  obligation_amount:
                    obligation,

                  original_obligation_amount:
                    obligation,

                  change_reason:
                    "",
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
  // LOAD FIXED AMOUNT AUDIT
  // ==================================================

  const loadAuditHistory =
    useCallback(
      async (
        shopId
      ) => {
        if (
          !shopId ||
          !supabaseUrl ||
          !accessToken
        ) {
          setAuditHistory(
            []
          );

          return;
        }

        try {
          setLoadingHistory(
            true
          );

          const response =
            await fetch(
              `${supabaseUrl}/rest/v1/rpc/tl_admin_shop_obligation_history`,
              {
                method:
                  "POST",

                headers:
                  authHeaders(),

                body:
                  JSON.stringify({
                    p_shop_id:
                      shopId,
                  }),

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
                "Unable to load fixed amount history."
            );
          }

          setAuditHistory(
            Array.isArray(
              result
            )
              ? result
              : []
          );
        } catch (error) {
          console.error(
            "ACCOUNT AMOUNT AUDIT ERROR:",
            error
          );

          setAuditHistory(
            []
          );
        } finally {
          setLoadingHistory(
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
  // SHOP CHANGED
  // ==================================================

  useEffect(() => {
    if (
      selectedShopId
    ) {
      setMessage("");
      setMessageType("");

      loadAccounts(
        selectedShopId
      );

      loadAuditHistory(
        selectedShopId
      );
    }
  }, [
    selectedShopId,
    loadAccounts,
    loadAuditHistory,
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

    // ----------------------------------------------
    // VALIDATE FIXED AMOUNTS
    // ----------------------------------------------

    for (
      const account of
      accounts
    ) {
      if (
        !FIXED_AMOUNT_TYPES.has(
          account.account_type
        )
      ) {
        continue;
      }

      const raw =
        cleanValue(
          account.obligation_amount
        );

      if (
        raw !== ""
      ) {
        const amount =
          Number(
            raw
          );

        if (
          !Number.isFinite(
            amount
          ) ||
          amount < 0
        ) {
          setMessage(
            `Enter a valid fixed amount for ${account.account_type}.`
          );

          setMessageType(
            "error"
          );

          return;
        }
      }

      const changed =
        !amountsEqual(
          account
            .original_obligation_amount,
          account
            .obligation_amount
        );

      const hadExistingAmount =
        cleanValue(
          account
            .original_obligation_amount
        ) !== "";

      if (
        changed &&
        hadExistingAmount &&
        cleanValue(
          account.change_reason
        ) === ""
      ) {
        setMessage(
          `Enter the reason for changing the ${account.account_type} fixed amount.`
        );

        setMessageType(
          "error"
        );

        return;
      }
    }

    try {
      setSaving(
        true
      );

      setMessage("");
      setMessageType("");

      for (
        const account of
        accounts
      ) {
        const fixed =
          FIXED_AMOUNT_TYPES.has(
            account.account_type
          );

        const changed =
          fixed &&
          !amountsEqual(
            account
              .original_obligation_amount,
            account
              .obligation_amount
          );

        const amountText =
          cleanValue(
            account
              .obligation_amount
          );

        const obligationAmount =
          fixed &&
          amountText !== ""
            ? roundMoney(
                Number(
                  amountText
                )
              )
            : null;

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

          obligation_amount:
            obligationAmount,

          obligation_change_reason:
            fixed &&
            changed
              ? cleanValue(
                  account
                    .change_reason
                ) ||
                null
              : null,
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

      await Promise.all([
        loadAccounts(
          selectedShopId
        ),

        loadAuditHistory(
          selectedShopId
        ),
      ]);
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
      <div
        style={
          loadingStyle
        }
      >
        Loading shop accounts...
      </div>
    );
  }

  return (
    <section
      style={
        wrapperStyle
      }
    >
      {/* =========================================== */}
      {/* SHOP CONTROL */}
      {/* =========================================== */}

      <div
        style={
          controlPanelStyle
        }
      >
        <div>
          <div
            style={
              controlTitleStyle
            }
          >
            SHOP ACCOUNT INFORMATION
          </div>

          <div
            style={
              controlSubtitleStyle
            }
          >
            Manage payment accounts and fixed WiFi, DStv and Rent amounts.
          </div>
        </div>

        <div
          style={
            shopControlStyle
          }
        >
          <label
            style={
              labelStyle
            }
          >
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
                event
                  .target
                  .value
              );

              setMessage("");
              setMessageType("");
            }}
            style={
              shopSelectStyle
            }
          >
            {shops.length ===
            0 ? (
              <option
                value=""
              >
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

      {/* =========================================== */}
      {/* SHOP NAME */}
      {/* =========================================== */}

      {selectedShop && (
        <div
          style={
            selectedShopStyle
          }
        >
          Editing account information for{" "}

          <strong>
            {
              selectedShop.shop_name
            }
          </strong>
        </div>
      )}

      {/* =========================================== */}
      {/* MESSAGE */}
      {/* =========================================== */}

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

      {/* =========================================== */}
      {/* ACCOUNT TABLE */}
      {/* =========================================== */}

      <div
        style={
          panelStyle
        }
      >
        <div
          style={
            tableTitleStyle
          }
        >
          ACCOUNTS INFORMATION
        </div>

        <div
          style={
            headerRowStyle
          }
        >
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
            FIXED AMOUNT
          </div>

          <div>
            CHANGE REASON
          </div>

          <div>
            ACTIVE
          </div>
        </div>

        {loadingAccounts ? (
          <div
            style={
              emptyStyle
            }
          >
            Loading account information...
          </div>
        ) : (
          accounts.map(
            (
              account
            ) => {
              const fixed =
                FIXED_AMOUNT_TYPES.has(
                  account.account_type
                );

              const amountChanged =
                fixed &&
                !amountsEqual(
                  account
                    .original_obligation_amount,
                  account
                    .obligation_amount
                );

              return (
                <div
                  key={
                    account.account_type
                  }
                  style={
                    accountRowStyle
                  }
                >
                  <div
                    style={
                      accountTypeStyle
                    }
                  >
                    {
                      account.account_type
                    }

                    {fixed && (
                      <div
                        style={
                          fixedBadgeStyle
                        }
                      >
                        FIXED
                      </div>
                    )}

                    {account.account_type ===
                      "ELECTRICITY" && (
                      <div
                        style={
                          variableBadgeStyle
                        }
                      >
                        VARIABLE
                      </div>
                    )}

                    {account.account_type ===
                      "BANKING" && (
                      <div
                        style={
                          variableBadgeStyle
                        }
                      >
                        EMPLOYEE
                      </div>
                    )}
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
                        event
                          .target
                          .value
                      )
                    }
                    placeholder={
                      account.account_type
                    }
                    style={
                      inputStyle
                    }
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
                        event
                          .target
                          .value
                      )
                    }
                    placeholder="Account number"
                    style={
                      inputStyle
                    }
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
                        event
                          .target
                          .value
                      )
                    }
                    placeholder="PayBill / Till"
                    style={
                      inputStyle
                    }
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
                        event
                          .target
                          .value
                      )
                    }
                    placeholder="Bank / Provider"
                    style={
                      inputStyle
                    }
                  />

                  {fixed ? (
                    <div
                      style={
                        amountWrapStyle
                      }
                    >
                      <span
                        style={
                          currencyStyle
                        }
                      >
                        KES
                      </span>

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          account
                            .obligation_amount
                        }
                        onChange={(
                          event
                        ) =>
                          updateAccount(
                            account.account_type,
                            "obligation_amount",
                            event
                              .target
                              .value
                          )
                        }
                        placeholder="0.00"
                        style={
                          amountInputStyle
                        }
                      />
                    </div>
                  ) : (
                    <div
                      style={
                        variableAmountStyle
                      }
                    >
                      {account.account_type ===
                      "ELECTRICITY"
                        ? "VARIABLE"
                        : "NO FIXED AMOUNT"}
                    </div>
                  )}

                  {fixed ? (
                    <input
                      type="text"
                      value={
                        account
                          .change_reason
                      }
                      disabled={
                        !amountChanged
                      }
                      onChange={(
                        event
                      ) =>
                        updateAccount(
                          account.account_type,
                          "change_reason",
                          event
                            .target
                            .value
                        )
                      }
                      placeholder={
                        amountChanged
                          ? "Why is amount changing?"
                          : "Only needed when amount changes"
                      }
                      style={{
                        ...inputStyle,

                        backgroundColor:
                          amountChanged
                            ? "white"
                            : "#f8fafc",
                      }}
                    />
                  ) : (
                    <div
                      style={
                        notApplicableStyle
                      }
                    >
                      —
                    </div>
                  )}

                  <label
                    style={
                      activeWrapStyle
                    }
                  >
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
                          event
                            .target
                            .checked
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
              );
            }
          )
        )}

        <div
          style={
            noteStyle
          }
        >
          WiFi, DStv and Rent use the fixed amount shown here.
          Electricity remains variable. Banking has no cashier-visible
          fixed target.
        </div>
      </div>

      {/* =========================================== */}
      {/* SAVE */}
      {/* =========================================== */}

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

      {/* =========================================== */}
      {/* FIXED AMOUNT HISTORY */}
      {/* =========================================== */}

      <div
        style={
          historyPanelStyle
        }
      >
        <div
          style={
            historyTitleStyle
          }
        >
          FIXED AMOUNT CHANGE HISTORY
        </div>

        {loadingHistory ? (
          <div
            style={
              historyEmptyStyle
            }
          >
            Loading history...
          </div>
        ) : auditHistory.length ===
          0 ? (
          <div
            style={
              historyEmptyStyle
            }
          >
            No fixed amount changes recorded for this shop yet.
          </div>
        ) : (
          <>
            <div
              style={
                historyHeaderStyle
              }
            >
              <div>
                TYPE
              </div>

              <div>
                OLD
              </div>

              <div>
                NEW
              </div>

              <div>
                REASON
              </div>

              <div>
                DATE / TIME
              </div>
            </div>

            {auditHistory
              .slice(
                0,
                20
              )
              .map(
                (
                  item
                ) => (
                  <div
                    key={
                      item.id
                    }
                    style={
                      historyRowStyle
                    }
                  >
                    <strong>
                      {
                        item.account_type
                      }
                    </strong>

                    <div>
                      {item.old_amount ===
                        null ||
                      item.old_amount ===
                        undefined
                        ? "—"
                        : `KES ${money(
                            item.old_amount
                          )}`}
                    </div>

                    <div>
                      {item.new_amount ===
                        null ||
                      item.new_amount ===
                        undefined
                        ? "—"
                        : `KES ${money(
                            item.new_amount
                          )}`}
                    </div>

                    <div>
                      {
                        item.reason ||
                        "Initial amount"
                      }
                    </div>

                    <div>
                      {formatDateTime(
                        item.changed_at
                      )}
                    </div>
                  </div>
                )
              )}
          </>
        )}
      </div>
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

      obligation_amount:
        "",

      original_obligation_amount:
        "",

      change_reason:
        "",
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

function normalizedAmount(
  value
) {
  const cleaned =
    cleanValue(
      value
    );

  if (
    cleaned ===
    ""
  ) {
    return null;
  }

  const numeric =
    Number(
      cleaned
    );

  return Number.isFinite(
    numeric
  )
    ? roundMoney(
        numeric
      )
    : null;
}

function amountsEqual(
  first,
  second
) {
  const a =
    normalizedAmount(
      first
    );

  const b =
    normalizedAmount(
      second
    );

  return a === b;
}

function roundMoney(
  value
) {
  return (
    Math.round(
      (
        Number(
          value
        ) +
        Number.EPSILON
      ) *
        100
    ) /
    100
  );
}

function money(
  value
) {
  return Number(
    value ||
      0
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

function formatDateTime(
  value
) {
  if (!value) {
    return "";
  }

  try {
    return new Intl.DateTimeFormat(
      "en-KE",
      {
        timeZone:
          "Africa/Nairobi",

        day:
          "2-digit",

        month:
          "short",

        year:
          "numeric",

        hour:
          "2-digit",

        minute:
          "2-digit",
      }
    ).format(
      new Date(
        value
      )
    );
  } catch {
    return "";
  }
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
    "100px 1fr 1.15fr 1fr 1fr 130px 1.2fr 70px",

  minWidth:
    "1250px",

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
    "100px 1fr 1.15fr 1fr 1fr 130px 1.2fr 70px",

  minWidth:
    "1250px",

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

const fixedBadgeStyle = {
  display:
    "inline-block",

  marginTop:
    "3px",

  padding:
    "2px 4px",

  borderRadius:
    "3px",

  backgroundColor:
    "#dbeafe",

  color:
    "#1d4ed8",

  fontSize:
    "7px",
};

const variableBadgeStyle = {
  display:
    "inline-block",

  marginTop:
    "3px",

  padding:
    "2px 4px",

  borderRadius:
    "3px",

  backgroundColor:
    "#fef3c7",

  color:
    "#92400e",

  fontSize:
    "7px",
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

const amountWrapStyle = {
  display:
    "flex",

  alignItems:
    "center",

  border:
    "1px solid #94a3b8",

  borderRadius:
    "4px",

  overflow:
    "hidden",

  backgroundColor:
    "white",
};

const currencyStyle = {
  padding:
    "8px 6px",

  backgroundColor:
    "#f1f5f9",

  color:
    "#475569",

  fontSize:
    "8px",

  fontWeight:
    "bold",
};

const amountInputStyle = {
  width:
    "100%",

  minWidth:
    0,

  boxSizing:
    "border-box",

  padding:
    "8px",

  border:
    "none",

  outline:
    "none",

  textAlign:
    "right",

  fontSize:
    "10px",
};

const variableAmountStyle = {
  padding:
    "8px",

  backgroundColor:
    "#f8fafc",

  border:
    "1px solid #cbd5e1",

  borderRadius:
    "4px",

  color:
    "#64748b",

  textAlign:
    "center",

  fontSize:
    "8px",

  fontWeight:
    "bold",
};

const notApplicableStyle = {
  textAlign:
    "center",

  color:
    "#94a3b8",
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
    "1250px",

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

const historyPanelStyle = {
  backgroundColor:
    "white",

  border:
    "1px solid #cbd5e1",

  borderRadius:
    "7px",

  overflowX:
    "auto",
};

const historyTitleStyle = {
  padding:
    "10px 12px",

  backgroundColor:
    "#7c3aed",

  color:
    "white",

  fontSize:
    "12px",

  fontWeight:
    "900",
};

const historyHeaderStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "100px 130px 130px 1fr 180px",

  minWidth:
    "800px",

  gap:
    "8px",

  padding:
    "8px",

  backgroundColor:
    "#f5f3ff",

  color:
    "#5b21b6",

  fontSize:
    "8px",

  fontWeight:
    "bold",
};

const historyRowStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "100px 130px 130px 1fr 180px",

  minWidth:
    "800px",

  gap:
    "8px",

  alignItems:
    "center",

  padding:
    "8px",

  borderTop:
    "1px solid #e2e8f0",

  fontSize:
    "9px",
};

const historyEmptyStyle = {
  padding:
    "20px",

  color:
    "#64748b",

  textAlign:
    "center",

  fontSize:
    "9px",
};
