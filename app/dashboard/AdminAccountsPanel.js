"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

// ==================================================
// TEAM LEGEND / NYIKA
// ADMIN ACCOUNTS INFORMATION
//
// EXISTING FUNCTIONS PRESERVED:
// - Select shop
// - Account descriptions
// - Account numbers
// - Paybill / Till
// - Bank / Provider
// - Fixed RENT / WIFI / DSTV amounts
// - Fixed amount change reasons
// - Fixed amount audit history
// - Active / Inactive accounts
//
// NEW:
// - Due date administration
// - RENT: 1st of every month
// - BANKING: Every Monday
// - WIFI / DSTV / ELECTRICITY: Admin date
//
// Due dates are informational only.
// No savings, payment or expense logic changed.
// ==================================================

const ACCOUNT_TYPES = [
  "RENT",
  "WIFI",
  "DSTV",
  "ELECTRICITY",
  "BANKING",
];

const FIXED_AMOUNT_TYPES = new Set([
  "RENT",
  "WIFI",
  "DSTV",
]);

const MANUAL_DUE_TYPES = new Set([
  "WIFI",
  "DSTV",
  "ELECTRICITY",
]);

const ACCOUNT_COLUMNS =
  "100px minmax(125px,1fr) " +
  "minmax(135px,1.15fr) " +
  "minmax(110px,1fr) " +
  "minmax(110px,1fr) " +
  "145px 135px minmax(165px,1.2fr) 70px";

// ==================================================
// MAIN COMPONENT
// ==================================================

export default function AdminAccountsPanel({ user }) {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const accessToken =
    user?.access_token || null;

  const [shops, setShops] = useState([]);
  const [selectedShopId, setSelectedShopId] =
    useState("");

  const [accounts, setAccounts] = useState([]);
  const [auditHistory, setAuditHistory] =
    useState([]);

  const [loading, setLoading] = useState(true);
  const [loadingAccounts, setLoadingAccounts] =
    useState(false);
  const [loadingHistory, setLoadingHistory] =
    useState(false);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] =
    useState("");

  const accountRequestRef = useRef(0);
  const historyRequestRef = useRef(0);

  // ==================================================
  // AUTH HEADERS
  // ==================================================

  const authHeaders = useCallback(
    () => ({
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    }),
    [supabaseAnonKey, accessToken]
  );

  // ==================================================
  // LOAD SHOPS
  // ==================================================

  const loadShops = useCallback(async () => {
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

      const response = await fetch(
        `${supabaseUrl}/rest/v1/shops` +
          `?is_active=eq.true` +
          `&select=id,shop_name,shop_type,is_active` +
          `&order=shop_name.asc`,
        {
          method: "GET",
          headers: authHeaders(),
          cache: "no-store",
        }
      );

      const result = await safeJson(response);

      if (!response.ok) {
        throw new Error(
          result?.message ||
            result?.details ||
            "Unable to load shops."
        );
      }

      const rows = Array.isArray(result)
        ? result
        : [];

      setShops(rows);

      setSelectedShopId((previous) => {
        if (
          previous &&
          rows.some((shop) => shop.id === previous)
        ) {
          return previous;
        }

        return rows[0]?.id || "";
      });
    } catch (error) {
      console.error(
        "ADMIN ACCOUNTS SHOPS ERROR:",
        error
      );

      setMessage(
        error?.message || "Unable to load shops."
      );
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }, [
    supabaseUrl,
    supabaseAnonKey,
    accessToken,
    authHeaders,
  ]);

  // ==================================================
  // LOAD SHOP ACCOUNTS
  // ==================================================

  const loadAccounts = useCallback(
    async (shopId) => {
      const requestId = ++accountRequestRef.current;

      if (
        !shopId ||
        !supabaseUrl ||
        !accessToken
      ) {
        setAccounts(makeBlankAccounts(shopId));
        setLoadingAccounts(false);
        return;
      }

      try {
        setLoadingAccounts(true);

        const response = await fetch(
          `${supabaseUrl}/rest/v1/shop_accounts` +
            `?shop_id=eq.${encodeURIComponent(shopId)}` +
            `&select=id,shop_id,account_type,description,` +
            `account_number,paybill_till,bank,is_active,` +
            `obligation_amount,obligation_change_reason,due_date` +
            `&order=account_type.asc`,
          {
            method: "GET",
            headers: authHeaders(),
            cache: "no-store",
          }
        );

        const result = await safeJson(response);

        if (!response.ok) {
          throw new Error(
            result?.message ||
              result?.details ||
              "Unable to load shop accounts."
          );
        }

        if (requestId !== accountRequestRef.current) {
          return;
        }

        const existing = Array.isArray(result)
          ? result
          : [];

        const merged = ACCOUNT_TYPES.map((type) => {
          const found = existing.find(
            (item) =>
              String(item.account_type || "")
                .trim()
                .toUpperCase() === type
          );

          const obligation =
            found?.obligation_amount === null ||
            found?.obligation_amount === undefined
              ? ""
              : String(found.obligation_amount);

          return {
            id: found?.id || null,
            shop_id: shopId,
            account_type: type,

            description:
              found?.description || type,

            account_number:
              found?.account_number || "",

            paybill_till:
              found?.paybill_till || "",

            bank:
              found?.bank || "",

            is_active:
              found?.is_active !== false,

            obligation_amount: obligation,

            original_obligation_amount:
              obligation,

            change_reason: "",

            // NEW: saved calendar date.
            // Automatic categories use their
            // recurring rules for display.
            due_date:
              found?.due_date
                ? String(found.due_date).slice(0, 10)
                : "",
          };
        });

        setAccounts(merged);
      } catch (error) {
        if (requestId !== accountRequestRef.current) {
          return;
        }

        console.error(
          "ADMIN SHOP ACCOUNTS ERROR:",
          error
        );

        setAccounts(makeBlankAccounts(shopId));

        setMessage(
          error?.message ||
            "Unable to load shop accounts."
        );
        setMessageType("error");
      } finally {
        if (requestId === accountRequestRef.current) {
          setLoadingAccounts(false);
        }
      }
    },
    [
      supabaseUrl,
      accessToken,
      authHeaders,
    ]
  );

  // ==================================================
  // LOAD FIXED AMOUNT AUDIT HISTORY
  // ==================================================

  const loadAuditHistory = useCallback(
    async (shopId) => {
      const requestId = ++historyRequestRef.current;

      if (
        !shopId ||
        !supabaseUrl ||
        !accessToken
      ) {
        setAuditHistory([]);
        return;
      }

      try {
        setLoadingHistory(true);

        const response = await fetch(
          `${supabaseUrl}/rest/v1/rpc/tl_admin_shop_obligation_history`,
          {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({
              p_shop_id: shopId,
            }),
            cache: "no-store",
          }
        );

        const result = await safeJson(response);

        if (!response.ok) {
          throw new Error(
            result?.message ||
              result?.details ||
              "Unable to load fixed amount history."
          );
        }

        if (requestId !== historyRequestRef.current) {
          return;
        }

        setAuditHistory(
          Array.isArray(result) ? result : []
        );
      } catch (error) {
        if (requestId !== historyRequestRef.current) {
          return;
        }

        console.error(
          "ACCOUNT AMOUNT AUDIT ERROR:",
          error
        );

        setAuditHistory([]);
      } finally {
        if (requestId === historyRequestRef.current) {
          setLoadingHistory(false);
        }
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
  }, [loadShops]);

  // ==================================================
  // SHOP CHANGED
  // ==================================================

  useEffect(() => {
    if (!selectedShopId) return;

    setMessage("");
    setMessageType("");

    loadAccounts(selectedShopId);
    loadAuditHistory(selectedShopId);
  }, [
    selectedShopId,
    loadAccounts,
    loadAuditHistory,
  ]);

  // ==================================================
  // SELECTED SHOP
  // ==================================================

  const selectedShop = useMemo(
    () =>
      shops.find(
        (shop) =>
          String(shop.id) === String(selectedShopId)
      ) || null,
    [shops, selectedShopId]
  );

  // ==================================================
  // UPDATE ACCOUNT FIELD
  // ==================================================

  function updateAccount(type, field, value) {
    setAccounts((previous) =>
      previous.map((account) =>
        account.account_type === type
          ? {
              ...account,
              [field]: value,
            }
          : account
      )
    );

    setMessage("");
    setMessageType("");
  }

  // ==================================================
  // VALIDATE AND SAVE ALL ACCOUNTS
  // ==================================================

  async function saveAccounts() {
    if (
      saving ||
      !selectedShopId ||
      loadingAccounts ||
      accounts.length !== ACCOUNT_TYPES.length
    ) {
      return;
    }

    // ----------------------------------------------
    // VERIFY FIXED AMOUNTS AND CHANGE REASONS
    // ----------------------------------------------

    for (const account of accounts) {
      if (!FIXED_AMOUNT_TYPES.has(account.account_type)) {
        continue;
      }

      const raw = cleanValue(
        account.obligation_amount
      );

      if (raw !== "") {
        const amount = Number(raw);

        if (
          !Number.isFinite(amount) ||
          amount < 0
        ) {
          setMessage(
            `Enter a valid fixed amount for ${account.account_type}.`
          );
          setMessageType("error");
          return;
        }
      }

      const changed = !amountsEqual(
        account.original_obligation_amount,
        account.obligation_amount
      );

      const hadExistingAmount =
        cleanValue(
          account.original_obligation_amount
        ) !== "";

      if (
        changed &&
        hadExistingAmount &&
        cleanValue(account.change_reason) === ""
      ) {
        setMessage(
          `Enter the reason for changing the ${account.account_type} fixed amount.`
        );
        setMessageType("error");
        return;
      }
    }

    // ----------------------------------------------
    // VALIDATE MANUAL DUE DATES
    // ----------------------------------------------

    for (const account of accounts) {
      if (!MANUAL_DUE_TYPES.has(account.account_type)) {
        continue;
      }

      const dueDate = cleanValue(account.due_date);

      // An empty date is permitted.
      // Cashier will display NOT SET.
      if (dueDate === "") continue;

      if (!isValidDateKey(dueDate)) {
        setMessage(
          `Select a valid due date for ${account.account_type}.`
        );
        setMessageType("error");
        return;
      }
    }

    const confirmed = window.confirm(
      `Save account information for ${
        selectedShop?.shop_name || "this shop"
      }?\n\n` +
        "WiFi, DStv and Electricity due dates will be updated.\n" +
        "Rent remains due on the 1st of each month.\n" +
        "Banking remains due every Monday.\n\n" +
        "Existing account details and fixed amounts will also be saved."
    );

    if (!confirmed) return;

    let savedCount = 0;

    try {
      setSaving(true);
      setMessage("");
      setMessageType("");

      for (const account of accounts) {
        const fixed = FIXED_AMOUNT_TYPES.has(
          account.account_type
        );

        const changed =
          fixed &&
          !amountsEqual(
            account.original_obligation_amount,
            account.obligation_amount
          );

        const amountText = cleanValue(
          account.obligation_amount
        );

        const obligationAmount =
          fixed && amountText !== ""
            ? roundMoney(Number(amountText))
            : null;

        const isManualDue = MANUAL_DUE_TYPES.has(
          account.account_type
        );

        const dueDate = cleanValue(
          account.due_date
        );

        const payload = {
          shop_id: selectedShopId,

          account_type: account.account_type,

          description:
            cleanValue(account.description) ||
            account.account_type,

          account_number:
            cleanValue(account.account_number) || null,

          paybill_till:
            cleanValue(account.paybill_till) || null,

          bank:
            cleanValue(account.bank) || null,

          is_active: Boolean(account.is_active),

          obligation_amount: obligationAmount,

          obligation_change_reason:
            fixed && changed
              ? cleanValue(account.change_reason) || null
              : null,

          // WiFi, DStv and Electricity are editable.
          // Preserve any existing stored value for
          // Rent / Banking; their displayed dates
          // are calculated automatically.
          due_date:
            isManualDue
              ? dueDate || null
              : dueDate || null,
        };

        const existing = Boolean(account.id);

        const url = existing
          ? `${supabaseUrl}/rest/v1/shop_accounts` +
            `?id=eq.${encodeURIComponent(account.id)}`
          : `${supabaseUrl}/rest/v1/shop_accounts`;

        const response = await fetch(url, {
          method: existing ? "PATCH" : "POST",
          headers: {
            ...authHeaders(),
            Prefer: "return=representation",
          },
          body: JSON.stringify(payload),
          cache: "no-store",
        });

        const result = await safeJson(response);

        if (!response.ok) {
          throw new Error(
            result?.message ||
              result?.details ||
              result?.hint ||
              `Unable to save ${account.account_type}.`
          );
        }

        if (!Array.isArray(result) || result.length === 0) {
          throw new Error(
            `${account.account_type} was not saved. Check Admin permissions.`
          );
        }

        savedCount += 1;
      }

      setMessage(
        `${selectedShop?.shop_name || "Shop"} account information and due dates saved successfully.`
      );
      setMessageType("success");

      await Promise.all([
        loadAccounts(selectedShopId),
        loadAuditHistory(selectedShopId),
      ]);
    } catch (error) {
      console.error(
        "SAVE SHOP ACCOUNTS ERROR:",
        error
      );

      setMessage(
        savedCount > 0
          ? `Saving stopped after ${savedCount} account(s). Review the shop before retrying. ${error?.message || ""}`
          : error?.message ||
              "Unable to save account information."
      );

      setMessageType("error");
    } finally {
      setSaving(false);
    }
  }

  // ==================================================
  // DISPLAY
  // ==================================================

  if (loading) {
    return (
      <div style={loadingStyle}>
        Loading shop accounts...
      </div>
    );
  }

  return (
    <section style={wrapperStyle}>
      {/* SHOP SELECTOR */}

      <div style={controlPanelStyle}>
        <div>
          <div style={controlTitleStyle}>
            SHOP ACCOUNT INFORMATION
          </div>

          <div style={controlSubtitleStyle}>
            Manage account details, fixed payment
            amounts and due dates.
          </div>
        </div>

        <div style={shopControlStyle}>
          <label style={labelStyle}>
            SELECT SHOP
          </label>

          <select
            value={selectedShopId}
            disabled={saving}
            onChange={(event) => {
              setSelectedShopId(event.target.value);
              setMessage("");
              setMessageType("");
            }}
            style={shopSelectStyle}
          >
            {shops.length === 0 ? (
              <option value="">
                No active shops
              </option>
            ) : (
              shops.map((shop) => (
                <option key={shop.id} value={shop.id}>
                  {shop.shop_name}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {/* SELECTED SHOP */}

      {selectedShop && (
        <div style={selectedShopStyle}>
          Editing account information for{" "}
          <strong>{selectedShop.shop_name}</strong>
        </div>
      )}

      {/* STATUS */}

      {message && (
        <div
          role="status"
          style={
            messageType === "success"
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
          <div>TYPE</div>
          <div>DESCRIPTION</div>
          <div>ACCOUNT NUMBER</div>
          <div>PAYBILL / TILL</div>
          <div>BANK</div>
          <div>DUE DATE</div>
          <div>FIXED AMOUNT</div>
          <div>CHANGE REASON</div>
          <div>ACTIVE</div>
        </div>

        {loadingAccounts ? (
          <div style={emptyStyle}>
            Loading account information...
          </div>
        ) : (
          accounts.map((account) => {
            const type = account.account_type;

            const fixed =
              FIXED_AMOUNT_TYPES.has(type);

            const manualDue =
              MANUAL_DUE_TYPES.has(type);

            const amountChanged =
              fixed &&
              !amountsEqual(
                account.original_obligation_amount,
                account.obligation_amount
              );

            return (
              <div
                key={type}
                style={accountRowStyle}
              >
                {/* TYPE */}

                <div style={accountTypeStyle}>
                  {type}

                  {fixed && (
                    <div style={fixedBadgeStyle}>
                      FIXED
                    </div>
                  )}

                  {type === "ELECTRICITY" && (
                    <div style={variableBadgeStyle}>
                      VARIABLE
                    </div>
                  )}

                  {type === "BANKING" && (
                    <div style={variableBadgeStyle}>
                      EMPLOYEE
                    </div>
                  )}
                </div>

                {/* DESCRIPTION */}

                <input
                  type="text"
                  value={account.description}
                  disabled={saving}
                  onChange={(event) =>
                    updateAccount(
                      type,
                      "description",
                      event.target.value
                    )
                  }
                  placeholder={type}
                  style={inputStyle}
                />

                {/* ACCOUNT NUMBER */}

                <input
                  type="text"
                  value={account.account_number}
                  disabled={saving}
                  onChange={(event) =>
                    updateAccount(
                      type,
                      "account_number",
                      event.target.value
                    )
                  }
                  placeholder="Account number"
                  style={inputStyle}
                />

                {/* PAYBILL / TILL */}

                <input
                  type="text"
                  value={account.paybill_till}
                  disabled={saving}
                  onChange={(event) =>
                    updateAccount(
                      type,
                      "paybill_till",
                      event.target.value
                    )
                  }
                  placeholder="PayBill / Till"
                  style={inputStyle}
                />

                {/* BANK */}

                <input
                  type="text"
                  value={account.bank}
                  disabled={saving}
                  onChange={(event) =>
                    updateAccount(
                      type,
                      "bank",
                      event.target.value
                    )
                  }
                  placeholder="Bank / Provider"
                  style={inputStyle}
                />

                {/* DUE DATE — NEW */}

                {manualDue ? (
                  <div style={dueDateWrapStyle}>
                    <input
                      type="date"
                      aria-label={`${type} due date`}
                      value={account.due_date || ""}
                      disabled={saving}
                      onChange={(event) =>
                        updateAccount(
                          type,
                          "due_date",
                          event.target.value
                        )
                      }
                      style={dueDateInputStyle}
                    />

                    <div style={dueDateHintStyle}>
                      ADMIN SET DATE
                    </div>
                  </div>
                ) : (
                  <div style={automaticDueStyle}>
                    <strong>
                      {type === "RENT"
                        ? "EVERY 1ST"
                        : "EVERY MONDAY"}
                    </strong>

                    <span>
                      Next:{" "}
                      {type === "RENT"
                        ? formatDateKey(
                            nextRentDue(todayNairobi())
                          )
                        : formatDateKey(
                            nextBankingDue(todayNairobi())
                          )}
                    </span>

                    <small>AUTOMATIC</small>
                  </div>
                )}

                {/* FIXED AMOUNT */}

                {fixed ? (
                  <div style={amountWrapStyle}>
                    <span style={currencyStyle}>
                      KES
                    </span>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={account.obligation_amount}
                      disabled={saving}
                      onChange={(event) =>
                        updateAccount(
                          type,
                          "obligation_amount",
                          event.target.value
                        )
                      }
                      placeholder="0.00"
                      style={amountInputStyle}
                    />
                  </div>
                ) : (
                  <div style={variableAmountStyle}>
                    {type === "ELECTRICITY"
                      ? "VARIABLE"
                      : "NO FIXED AMOUNT"}
                  </div>
                )}

                {/* FIXED AMOUNT CHANGE REASON */}

                {fixed ? (
                  <input
                    type="text"
                    value={account.change_reason}
                    disabled={!amountChanged || saving}
                    onChange={(event) =>
                      updateAccount(
                        type,
                        "change_reason",
                        event.target.value
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
                  <div style={notApplicableStyle}>
                    —
                  </div>
                )}

                {/* ACTIVE */}

                <label style={activeWrapStyle}>
                  <input
                    type="checkbox"
                    checked={account.is_active}
                    disabled={saving}
                    onChange={(event) =>
                      updateAccount(
                        type,
                        "is_active",
                        event.target.checked
                      )
                    }
                  />

                  <span>
                    {account.is_active ? "YES" : "NO"}
                  </span>
                </label>
              </div>
            );
          })
        )}

        <div style={noteStyle}>
          Rent is due on the 1st of every month.
          Banking is due every Monday.
          Admin selects calendar due dates for
          WiFi, DStv and Electricity.
          Due dates do not automatically create payments
          or change expenses.
        </div>
      </div>

      {/* SAVE BUTTON */}

      <button
        type="button"
        onClick={saveAccounts}
        disabled={
          saving ||
          !selectedShopId ||
          loadingAccounts ||
          accounts.length !== ACCOUNT_TYPES.length
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

      {/* EXISTING FIXED AMOUNT HISTORY */}

      <div style={historyPanelStyle}>
        <div style={historyTitleStyle}>
          FIXED AMOUNT CHANGE HISTORY
        </div>

        {loadingHistory ? (
          <div style={historyEmptyStyle}>
            Loading history...
          </div>
        ) : auditHistory.length === 0 ? (
          <div style={historyEmptyStyle}>
            No fixed amount changes recorded
            for this shop yet.
          </div>
        ) : (
          <>
            <div style={historyHeaderStyle}>
              <div>TYPE</div>
              <div>OLD</div>
              <div>NEW</div>
              <div>REASON</div>
              <div>DATE / TIME</div>
            </div>

            {auditHistory.slice(0, 20).map((item) => (
              <div
                key={item.id}
                style={historyRowStyle}
              >
                <strong>{item.account_type}</strong>

                <div>
                  {item.old_amount === null ||
                  item.old_amount === undefined
                    ? "—"
                    : `KES ${money(item.old_amount)}`}
                </div>

                <div>
                  {item.new_amount === null ||
                  item.new_amount === undefined
                    ? "—"
                    : `KES ${money(item.new_amount)}`}
                </div>

                <div>
                  {item.reason || "Initial amount"}
                </div>

                <div>
                  {formatDateTime(item.changed_at)}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </section>
  );
}

// ==================================================
// INITIAL ACCOUNT ROWS
// ==================================================

function makeBlankAccounts(shopId = "") {
  return ACCOUNT_TYPES.map((type) => ({
    id: null,
    shop_id: shopId,
    account_type: type,
    description: type,
    account_number: "",
    paybill_till: "",
    bank: "",
    is_active: true,
    obligation_amount: "",
    original_obligation_amount: "",
    change_reason: "",
    due_date: "",
  }));
}

// ==================================================
// AMOUNT HELPERS
// ==================================================

function cleanValue(value) {
  return String(value ?? "").trim();
}

function normalizedAmount(value) {
  const cleaned = cleanValue(value);

  if (cleaned === "") return null;

  const numeric = Number(cleaned);

  return Number.isFinite(numeric)
    ? roundMoney(numeric)
    : null;
}

function amountsEqual(first, second) {
  return normalizedAmount(first) ===
    normalizedAmount(second);
}

function roundMoney(value) {
  return (
    Math.round(
      (Number(value) + Number.EPSILON) * 100
    ) / 100
  );
}

function money(value) {
  return Number(value || 0).toLocaleString(
    "en-KE",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  );
}

// ==================================================
// NAIROBI DUE DATE HELPERS
// ==================================================

function todayNairobi() {
  const parts = new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: "Africa/Nairobi",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).formatToParts(new Date());

  const result = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      result[part.type] = part.value;
    }
  }

  return (
    `${result.year}-${result.month}-${result.day}`
  );
}

function isValidDateKey(value) {
  const text = String(value || "");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return false;
  }

  const date = new Date(`${text}T12:00:00Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === text
  );
}

function parseDateKey(value) {
  if (!isValidDateKey(value)) return null;

  return new Date(`${value}T12:00:00Z`);
}

function nextRentDue(today) {
  const date = parseDateKey(today);

  if (!date) return null;

  if (date.getUTCDate() === 1) {
    return today;
  }

  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      1
    )
  )
    .toISOString()
    .slice(0, 10);
}

function nextBankingDue(today) {
  const date = parseDateKey(today);

  if (!date) return null;

  const daysUntilMonday =
    (8 - date.getUTCDay()) % 7;

  date.setUTCDate(
    date.getUTCDate() + daysUntilMonday
  );

  return date.toISOString().slice(0, 10);
}

function formatDateKey(value) {
  const date = parseDateKey(value);

  if (!date) return "—";

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: "UTC",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  ).format(date);
}

// ==================================================
// OTHER HELPERS
// ==================================================

function formatDateTime(value) {
  if (!value) return "";

  try {
    return new Intl.DateTimeFormat(
      "en-KE",
      {
        timeZone: "Africa/Nairobi",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    ).format(new Date(value));
  } catch {
    return "";
  }
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

// ==================================================
// EXISTING ADMIN STYLES
// ==================================================

const wrapperStyle = {
  width: "100%",
  display: "grid",
  gap: "12px",
};

const controlPanelStyle = {
  backgroundColor: "#0f766e",
  color: "white",
  borderRadius: "7px",
  padding: "14px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "end",
  gap: "20px",
  flexWrap: "wrap",
};

const controlTitleStyle = {
  fontSize: "15px",
  fontWeight: "900",
};

const controlSubtitleStyle = {
  marginTop: "4px",
  fontSize: "9px",
  color: "#ccfbf1",
};

const shopControlStyle = {
  minWidth: "240px",
};

const labelStyle = {
  display: "block",
  marginBottom: "5px",
  fontSize: "9px",
  fontWeight: "bold",
};

const shopSelectStyle = {
  width: "100%",
  padding: "9px",
  border: "1px solid #cbd5e1",
  borderRadius: "5px",
  backgroundColor: "white",
  color: "#0f172a",
};

const selectedShopStyle = {
  padding: "10px",
  backgroundColor: "#ecfeff",
  border: "1px solid #a5f3fc",
  borderRadius: "5px",
  color: "#155e75",
  fontSize: "10px",
};

const panelStyle = {
  backgroundColor: "white",
  border: "1px solid #cbd5e1",
  borderRadius: "7px",
  overflowX: "auto",
};

const tableTitleStyle = {
  backgroundColor: "#0873b9",
  color: "white",
  padding: "10px 12px",
  fontSize: "13px",
  fontWeight: "900",
};

const headerRowStyle = {
  display: "grid",
  gridTemplateColumns: ACCOUNT_COLUMNS,
  minWidth: "1460px",
  gap: "6px",
  padding: "8px",
  backgroundColor: "#eef4f8",
  color: "#475569",
  fontSize: "8px",
  fontWeight: "bold",
  textAlign: "center",
};

const accountRowStyle = {
  display: "grid",
  gridTemplateColumns: ACCOUNT_COLUMNS,
  minWidth: "1460px",
  gap: "6px",
  alignItems: "center",
  padding: "8px",
  borderTop: "1px solid #e2e8f0",
};

const accountTypeStyle = {
  color: "#0f172a",
  fontWeight: "900",
  fontSize: "10px",
};

const fixedBadgeStyle = {
  display: "inline-block",
  marginTop: "3px",
  padding: "2px 4px",
  borderRadius: "3px",
  backgroundColor: "#dbeafe",
  color: "#1d4ed8",
  fontSize: "7px",
};

const variableBadgeStyle = {
  display: "inline-block",
  marginTop: "3px",
  padding: "2px 4px",
  borderRadius: "3px",
  backgroundColor: "#fef3c7",
  color: "#92400e",
  fontSize: "7px",
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "8px",
  border: "1px solid #94a3b8",
  borderRadius: "4px",
  fontSize: "10px",
  color: "#0f172a",
  backgroundColor: "white",
};

const amountWrapStyle = {
  display: "flex",
  alignItems: "center",
  border: "1px solid #94a3b8",
  borderRadius: "4px",
  overflow: "hidden",
  backgroundColor: "white",
};

const currencyStyle = {
  padding: "8px 6px",
  backgroundColor: "#f1f5f9",
  color: "#475569",
  fontSize: "8px",
  fontWeight: "bold",
};

const amountInputStyle = {
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  padding: "8px",
  border: "none",
  outline: "none",
  textAlign: "right",
  fontSize: "10px",
};

const variableAmountStyle = {
  padding: "8px",
  backgroundColor: "#f8fafc",
  border: "1px solid #cbd5e1",
  borderRadius: "4px",
  color: "#64748b",
  textAlign: "center",
  fontSize: "8px",
  fontWeight: "bold",
};

const notApplicableStyle = {
  textAlign: "center",
  color: "#94a3b8",
};

const activeWrapStyle = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: "5px",
  fontSize: "9px",
  fontWeight: "bold",
  color: "#0f172a",
};

const noteStyle = {
  padding: "10px",
  borderTop: "1px solid #e2e8f0",
  backgroundColor: "#f8fafc",
  color: "#64748b",
  textAlign: "center",
  fontSize: "9px",
  lineHeight: 1.5,
};

const saveButtonStyle = {
  width: "100%",
  padding: "11px",
  border: "none",
  borderRadius: "5px",
  backgroundColor: "#15803d",
  color: "white",
  fontWeight: "900",
  cursor: "pointer",
};

const successStyle = {
  padding: "10px",
  backgroundColor: "#f0fdf4",
  border: "1px solid #86efac",
  borderRadius: "5px",
  color: "#166534",
  fontSize: "10px",
  fontWeight: "bold",
};

const errorStyle = {
  padding: "10px",
  backgroundColor: "#fef2f2",
  border: "1px solid #fecaca",
  borderRadius: "5px",
  color: "#991b1b",
  fontSize: "10px",
  fontWeight: "bold",
};

const loadingStyle = {
  padding: "30px",
  backgroundColor: "white",
  border: "1px solid #cbd5e1",
  borderRadius: "7px",
  color: "#64748b",
  textAlign: "center",
};

const emptyStyle = {
  minWidth: "1460px",
  padding: "25px",
  boxSizing: "border-box",
  color: "#64748b",
  textAlign: "center",
  fontSize: "10px",
};

// ==================================================
// NEW DUE DATE STYLES
// ==================================================

const dueDateWrapStyle = {
  display: "grid",
  gap: "4px",
  minWidth: 0,
};

const dueDateInputStyle = {
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  padding: "7px 5px",
  border: "1px solid #94a3b8",
  borderRadius: "4px",
  backgroundColor: "white",
  color: "#0f172a",
  fontSize: "10px",
};

const dueDateHintStyle = {
  color: "#64748b",
  fontSize: "8px",
  fontWeight: "bold",
  textAlign: "center",
};

const automaticDueStyle = {
  display: "grid",
  gap: "3px",
  padding: "6px",
  backgroundColor: "#f0fdfa",
  border: "1px solid #99f6e4",
  borderRadius: "5px",
  textAlign: "center",
  color: "#115e59",
  fontSize: "9px",
  lineHeight: 1.4,
};

// ==================================================
// EXISTING HISTORY STYLES
// ==================================================

const historyPanelStyle = {
  backgroundColor: "white",
  border: "1px solid #cbd5e1",
  borderRadius: "7px",
  overflowX: "auto",
};

const historyTitleStyle = {
  padding: "10px 12px",
  backgroundColor: "#7c3aed",
  color: "white",
  fontSize: "12px",
  fontWeight: "900",
};

const historyHeaderStyle = {
  display: "grid",
  gridTemplateColumns:
    "100px 130px 130px 1fr 180px",
  minWidth: "800px",
  gap: "8px",
  padding: "8px",
  backgroundColor: "#f5f3ff",
  color: "#5b21b6",
  fontSize: "8px",
  fontWeight: "bold",
};

const historyRowStyle = {
  display: "grid",
  gridTemplateColumns:
    "100px 130px 130px 1fr 180px",
  minWidth: "800px",
  gap: "8px",
  alignItems: "center",
  padding: "8px",
  borderTop: "1px solid #e2e8f0",
  fontSize: "9px",
};

const historyEmptyStyle = {
  padding: "20px",
  color: "#64748b",
  textAlign: "center",
  fontSize: "9px",
};
