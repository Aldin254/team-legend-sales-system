"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const ACCOUNT_TYPES = ["RENT", "WIFI", "DSTV", "ELECTRICITY", "BANKING"];
const FIXED_TYPES = new Set(["RENT", "WIFI", "DSTV"]);
const EDITABLE_DUE_TYPES = new Set(["WIFI", "DSTV", "ELECTRICITY"]);
const MONTHLY_TYPES = new Set(["WIFI", "DSTV"]);

const ACCOUNT_COLUMNS =
  "110px minmax(160px,1.2fr) minmax(145px,1fr) " +
  "minmax(145px,1fr) 205px 145px minmax(185px,1.2fr) 80px";

export default function AdminAccountsPanel({ user }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const accessToken = user?.access_token || null;

  const [shops, setShops] = useState([]);
  const [selectedShopId, setSelectedShopId] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [auditHistory, setAuditHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [editingDue, setEditingDue] = useState({});

  const accountRequestRef = useRef(0);
  const historyRequestRef = useRef(0);

  const authHeaders = useCallback(
    () => ({
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    }),
    [supabaseAnonKey, accessToken]
  );

  const loadShops = useCallback(async () => {
    if (!supabaseUrl || !supabaseAnonKey || !accessToken) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        `${supabaseUrl}/rest/v1/shops` +
          "?is_active=eq.true&select=id,shop_name,shop_type,is_active" +
          "&order=shop_name.asc",
        {
          method: "GET",
          headers: authHeaders(),
          cache: "no-store",
        }
      );

      const result = await safeJson(response);

      if (!response.ok) {
        throw new Error(
          result?.message || result?.details || "Unable to load shops."
        );
      }

      const rows = Array.isArray(result) ? result : [];
      setShops(rows);

      setSelectedShopId((previous) =>
        previous && rows.some((shop) => shop.id === previous)
          ? previous
          : rows[0]?.id || ""
      );
    } catch (error) {
      console.error("ADMIN ACCOUNTS SHOPS ERROR:", error);
      setMessage(error?.message || "Unable to load shops.");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }, [supabaseUrl, supabaseAnonKey, accessToken, authHeaders]);

  const loadAccounts = useCallback(
    async (shopId) => {
      const requestId = ++accountRequestRef.current;

      if (!shopId || !supabaseUrl || !accessToken) {
        setAccounts(makeBlankAccounts(shopId));
        setLoadingAccounts(false);
        return;
      }

      try {
        setLoadingAccounts(true);

        const response = await fetch(
          `${supabaseUrl}/rest/v1/shop_accounts` +
            `?shop_id=eq.${encodeURIComponent(shopId)}` +
            "&select=id,shop_id,account_type,description," +
            "account_number,paybill_till,bank,is_active," +
            "obligation_amount,obligation_change_reason,due_date" +
            "&order=account_type.asc",
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

        if (requestId !== accountRequestRef.current) return;

        const existing = Array.isArray(result) ? result : [];

        const merged = ACCOUNT_TYPES.map((type) => {
          const found = existing.find(
            (item) =>
              String(item.account_type || "").trim().toUpperCase() === type
          );

          const amount =
            found?.obligation_amount == null
              ? ""
              : String(found.obligation_amount);

          return {
            id: found?.id || null,
            shop_id: shopId,
            account_type: type,
            description: found?.description || type,
            account_number: found?.account_number || "",
            paybill_till: found?.paybill_till || "",
            bank: found?.bank || "",
            is_active: found?.is_active !== false,
            obligation_amount: amount,
            original_obligation_amount: amount,
            change_reason: "",
            due_date: found?.due_date
              ? String(found.due_date).slice(0, 10)
              : "",
          };
        });

        setAccounts(merged);
        setEditingDue({});
      } catch (error) {
        if (requestId !== accountRequestRef.current) return;

        console.error("ADMIN SHOP ACCOUNTS ERROR:", error);
        setAccounts(makeBlankAccounts(shopId));
        setMessage(error?.message || "Unable to load shop accounts.");
        setMessageType("error");
      } finally {
        if (requestId === accountRequestRef.current) {
          setLoadingAccounts(false);
        }
      }
    },
    [supabaseUrl, accessToken, authHeaders]
  );

  const loadAuditHistory = useCallback(
    async (shopId) => {
      const requestId = ++historyRequestRef.current;

      if (!shopId || !supabaseUrl || !accessToken) {
        setAuditHistory([]);
        setLoadingHistory(false);
        return;
      }

      try {
        setLoadingHistory(true);

        const response = await fetch(
          `${supabaseUrl}/rest/v1/rpc/tl_admin_shop_obligation_history`,
          {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ p_shop_id: shopId }),
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

        if (requestId !== historyRequestRef.current) return;

        setAuditHistory(Array.isArray(result) ? result : []);
      } catch (error) {
        if (requestId !== historyRequestRef.current) return;

        console.error("ACCOUNT AMOUNT AUDIT ERROR:", error);
        setAuditHistory([]);
      } finally {
        if (requestId === historyRequestRef.current) {
          setLoadingHistory(false);
        }
      }
    },
    [supabaseUrl, accessToken, authHeaders]
  );

  useEffect(() => {
    loadShops();
  }, [loadShops]);

  useEffect(() => {
    if (!selectedShopId) return;

    setMessage("");
    setMessageType("");

    loadAccounts(selectedShopId);
    loadAuditHistory(selectedShopId);
  }, [selectedShopId, loadAccounts, loadAuditHistory]);

  const selectedShop = useMemo(
    () =>
      shops.find(
        (shop) => String(shop.id) === String(selectedShopId)
      ) || null,
    [shops, selectedShopId]
  );

  function updateAccount(type, field, value) {
    setAccounts((previous) =>
      previous.map((account) =>
        account.account_type === type
          ? { ...account, [field]: value }
          : account
      )
    );

    setMessage("");
    setMessageType("");
  }

  async function saveAccounts() {
    if (
      saving ||
      !selectedShopId ||
      loadingAccounts ||
      accounts.length !== ACCOUNT_TYPES.length
    ) {
      return;
    }

    for (const account of accounts) {
      const type = account.account_type;

      if (FIXED_TYPES.has(type)) {
        const raw = cleanValue(account.obligation_amount);

        if (
          raw !== "" &&
          (!Number.isFinite(Number(raw)) || Number(raw) < 0)
        ) {
          setMessage(`Enter a valid fixed amount for ${type}.`);
          setMessageType("error");
          return;
        }

        const changed = !amountsEqual(
          account.original_obligation_amount,
          account.obligation_amount
        );

        const hadExistingAmount =
          cleanValue(account.original_obligation_amount) !== "";

        if (
          changed &&
          hadExistingAmount &&
          !cleanValue(account.change_reason)
        ) {
          setMessage(
            `Enter the reason for changing the ${type} fixed amount.`
          );
          setMessageType("error");
          return;
        }
      }

      if (EDITABLE_DUE_TYPES.has(type)) {
        const date = cleanValue(account.due_date);

        if (date && !isValidDateKey(date)) {
          setMessage(`Select a valid due date for ${type}.`);
          setMessageType("error");
          return;
        }
      }
    }

    const confirmed = window.confirm(
      `Save account information for ${
        selectedShop?.shop_name || "this shop"
      }?\n\n` +
        "WiFi and DStv repeat every month on the day you select.\n" +
        "Changing that date updates future months.\n" +
        "Rent stays on the 1st, Banking stays on Monday.\n" +
        "Electricity has a manually selected due date."
    );

    if (!confirmed) return;

    let savedCount = 0;

    try {
      setSaving(true);
      setMessage("");
      setMessageType("");

      for (const account of accounts) {
        const fixed = FIXED_TYPES.has(account.account_type);

        const changed =
          fixed &&
          !amountsEqual(
            account.original_obligation_amount,
            account.obligation_amount
          );

        const amountText = cleanValue(account.obligation_amount);

        const obligationAmount =
          fixed && amountText !== ""
            ? roundMoney(Number(amountText))
            : null;

        const payload = {
          shop_id: selectedShopId,
          account_type: account.account_type,

          description:
            cleanValue(account.description) || account.account_type,

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

          due_date: cleanValue(account.due_date) || null,
        };

        const existing = Boolean(account.id);

        const endpoint = existing
          ? `${supabaseUrl}/rest/v1/shop_accounts?id=eq.${encodeURIComponent(
              account.id
            )}`
          : `${supabaseUrl}/rest/v1/shop_accounts`;

        const response = await fetch(endpoint, {
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
        `${selectedShop?.shop_name || "Shop"} account information saved.`
      );
      setMessageType("success");

      await Promise.all([
        loadAccounts(selectedShopId),
        loadAuditHistory(selectedShopId),
      ]);
    } catch (error) {
      console.error("SAVE SHOP ACCOUNTS ERROR:", error);

      setMessage(
        savedCount > 0
          ? `Saving stopped after ${savedCount} account(s). Review before retrying. ${
              error?.message || ""
            }`
          : error?.message || "Unable to save account information."
      );
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div style={loadingStyle}>Loading shop accounts...</div>;
  }

  return (
    <section style={wrapperStyle}>
      <div style={controlPanelStyle}>
        <div style={controlTitleStyle}>
          SHOP ACCOUNT INFORMATION
        </div>

        <div style={shopControlStyle}>
          <label style={labelStyle}>SELECT SHOP</label>

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
              <option value="">No active shops</option>
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

      {message && (
        <div
          role="status"
          style={
            messageType === "success" ? successStyle : errorStyle
          }
        >
          {message}
        </div>
      )}

      <div style={panelStyle}>
        <div style={tableTitleStyle}>
          ACCOUNTS INFORMATION
        </div>

        <div style={headerRowStyle}>
          <div>TYPE</div>
          <div>ACCOUNT NUMBER</div>
          <div>PAYBILL / TILL</div>
          <div>BANK / PROVIDER</div>
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
            const fixed = FIXED_TYPES.has(type);
            const monthly = MONTHLY_TYPES.has(type);

            const amountChanged =
              fixed &&
              !amountsEqual(
                account.original_obligation_amount,
                account.obligation_amount
              );

            const today = todayNairobi();

            const due =
              type === "RENT"
                ? nextRentDue(today)
                : type === "BANKING"
                ? nextBankingDue(today)
                : monthly
                ? nextMonthlyDue(account.due_date, today)
                : account.due_date;

            const editMonthly =
              Boolean(editingDue[type]) || !account.due_date;

            return (
              <div key={type} style={accountRowStyle}>
                <div style={accountTypeStyle}>{type}</div>

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

                {monthly ? (
                  <div style={monthlyDueStyle}>
                    <div style={dueValueStyle}>
                      {due ? formatDateKey(due) : "NOT SET"}
                    </div>

                    {editMonthly ? (
                      <input
                        type="date"
                        aria-label={`${type} monthly due date`}
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
                    ) : (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          setEditingDue((previous) => ({
                            ...previous,
                            [type]: true,
                          }))
                        }
                        style={editDueButtonStyle}
                      >
                        Change date
                      </button>
                    )}
                  </div>
                ) : type === "ELECTRICITY" ? (
                  <input
                    type="date"
                    aria-label="Electricity due date"
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
                ) : (
                  <div style={automaticDueStyle}>
                    <strong>
                      {type === "RENT"
                        ? "EVERY 1ST"
                        : "EVERY MONDAY"}
                    </strong>

                    <span>{formatDateKey(due)}</span>
                  </div>
                )}

                {fixed ? (
                  <div style={amountWrapStyle}>
                    <span style={currencyStyle}>KES</span>

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
                  <div style={notApplicableStyle}>—</div>
                )}

                {fixed && amountChanged ? (
                  <input
                    type="text"
                    value={account.change_reason}
                    disabled={saving}
                    onChange={(event) =>
                      updateAccount(
                        type,
                        "change_reason",
                        event.target.value
                      )
                    }
                    placeholder="Reason for change"
                    style={inputStyle}
                  />
                ) : (
                  <div style={notApplicableStyle}>—</div>
                )}

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
      </div>

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
            saving || !selectedShopId || loadingAccounts
              ? 0.6
              : 1,
        }}
      >
        {saving
          ? "SAVING..."
          : "SAVE ACCOUNT INFORMATION"}
      </button>

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
            No history yet.
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
              <div key={item.id} style={historyRowStyle}>
                <strong>{item.account_type}</strong>

                <div>
                  {item.old_amount == null
                    ? "—"
                    : `KES ${money(item.old_amount)}`}
                </div>

                <div>
                  {item.new_amount == null
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
// DATA AND DATE HELPERS
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

function cleanValue(value) {
  return String(value ?? "").trim();
}

function normalizedAmount(value) {
  const clean = cleanValue(value);

  if (clean === "") return null;

  const numeric = Number(clean);

  return Number.isFinite(numeric)
    ? roundMoney(numeric)
    : null;
}

function amountsEqual(a, b) {
  return normalizedAmount(a) === normalizedAmount(b);
}

function roundMoney(value) {
  return Math.round(
    (Number(value) + Number.EPSILON) * 100
  ) / 100;
}

function money(value) {
  return Number(value || 0).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function todayNairobi() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const result = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      result[part.type] = part.value;
    }
  }

  return `${result.year}-${result.month}-${result.day}`;
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
  return isValidDateKey(value)
    ? new Date(`${value}T12:00:00Z`)
    : null;
}

function monthDate(year, monthIndex, day) {
  const lastDay = new Date(
    Date.UTC(year, monthIndex + 1, 0)
  ).getUTCDate();

  return new Date(
    Date.UTC(year, monthIndex, Math.min(day, lastDay))
  )
    .toISOString()
    .slice(0, 10);
}

// WIFI / DSTV: recurring monthly dates.
// For example, 16 Nov -> 16 Dec -> 16 Jan.
// The last day is used in months that are too short.

function nextMonthlyDue(anchor, today) {
  const start = parseDateKey(anchor);
  const current = parseDateKey(today);

  if (!start || !current) return null;

  if (anchor >= today) return anchor;

  const anchorDay = start.getUTCDate();

  let year = current.getUTCFullYear();
  let month = current.getUTCMonth();

  let candidate = monthDate(
    year,
    month,
    anchorDay
  );

  if (candidate < today) {
    month += 1;

    if (month >= 12) {
      year += 1;
      month = 0;
    }

    candidate = monthDate(
      year,
      month,
      anchorDay
    );
  }

  return candidate;
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

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value) {
  if (!value) return "";

  try {
    return new Intl.DateTimeFormat("en-KE", {
      timeZone: "Africa/Nairobi",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
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
// PROFESSIONAL ACCOUNT STYLES
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
  fontSize: "17px",
  fontWeight: "900",
};

const shopControlStyle = {
  minWidth: "240px",
};

const labelStyle = {
  display: "block",
  marginBottom: "5px",
  fontSize: "12px",
  fontWeight: "bold",
};

const shopSelectStyle = {
  width: "100%",
  padding: "10px",
  border: "1px solid #cbd5e1",
  borderRadius: "5px",
  backgroundColor: "white",
  color: "#0f172a",
  fontSize: "13px",
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
  padding: "11px 12px",
  fontSize: "15px",
  fontWeight: "900",
};

const headerRowStyle = {
  display: "grid",
  gridTemplateColumns: ACCOUNT_COLUMNS,
  minWidth: "1340px",
  gap: "7px",
  padding: "10px 8px",
  backgroundColor: "#eef4f8",
  color: "#475569",
  fontSize: "11px",
  fontWeight: "bold",
  textAlign: "center",
};

const accountRowStyle = {
  display: "grid",
  gridTemplateColumns: ACCOUNT_COLUMNS,
  minWidth: "1340px",
  gap: "7px",
  alignItems: "center",
  padding: "10px 8px",
  borderTop: "1px solid #e2e8f0",
};

const accountTypeStyle = {
  color: "#0f172a",
  fontWeight: "900",
  fontSize: "13px",
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "9px",
  border: "1px solid #94a3b8",
  borderRadius: "4px",
  fontSize: "13px",
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
  padding: "9px 7px",
  backgroundColor: "#f1f5f9",
  color: "#475569",
  fontSize: "11px",
  fontWeight: "bold",
};

const amountInputStyle = {
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  padding: "9px",
  border: "none",
  outline: "none",
  textAlign: "right",
  fontSize: "13px",
};

const notApplicableStyle = {
  textAlign: "center",
  color: "#94a3b8",
  fontSize: "13px",
};

const activeWrapStyle = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: "5px",
  fontSize: "12px",
  fontWeight: "bold",
  color: "#0f172a",
};

const saveButtonStyle = {
  width: "100%",
  padding: "12px",
  border: "none",
  borderRadius: "5px",
  backgroundColor: "#15803d",
  color: "white",
  fontSize: "13px",
  fontWeight: "900",
  cursor: "pointer",
};

const successStyle = {
  padding: "11px",
  backgroundColor: "#f0fdf4",
  border: "1px solid #86efac",
  borderRadius: "5px",
  color: "#166534",
  fontSize: "12px",
  fontWeight: "bold",
};

const errorStyle = {
  padding: "11px",
  backgroundColor: "#fef2f2",
  border: "1px solid #fecaca",
  borderRadius: "5px",
  color: "#991b1b",
  fontSize: "12px",
  fontWeight: "bold",
};

const loadingStyle = {
  padding: "30px",
  backgroundColor: "white",
  border: "1px solid #cbd5e1",
  borderRadius: "7px",
  color: "#64748b",
  textAlign: "center",
  fontSize: "13px",
};

const emptyStyle = {
  minWidth: "1340px",
  padding: "25px",
  boxSizing: "border-box",
  color: "#64748b",
  textAlign: "center",
  fontSize: "13px",
};

const dueDateInputStyle = {
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  padding: "9px 5px",
  border: "1px solid #94a3b8",
  borderRadius: "4px",
  backgroundColor: "white",
  color: "#0f172a",
  fontSize: "12px",
};

const monthlyDueStyle = {
  display: "grid",
  gap: "4px",
  minWidth: 0,
  padding: "6px",
  border: "1px solid #99f6e4",
  borderRadius: "5px",
  backgroundColor: "#f0fdfa",
};

const dueValueStyle = {
  color: "#115e59",
  fontSize: "13px",
  fontWeight: "900",
  textAlign: "center",
};

const editDueButtonStyle = {
  border: "1px solid #99f6e4",
  borderRadius: "4px",
  padding: "5px 8px",
  backgroundColor: "white",
  color: "#115e59",
  fontSize: "11px",
  fontWeight: "bold",
  cursor: "pointer",
};

const automaticDueStyle = {
  display: "grid",
  gap: "3px",
  padding: "7px",
  backgroundColor: "#f0fdfa",
  border: "1px solid #99f6e4",
  borderRadius: "5px",
  textAlign: "center",
  color: "#115e59",
  fontSize: "12px",
  lineHeight: 1.4,
};

const historyPanelStyle = {
  backgroundColor: "white",
  border: "1px solid #cbd5e1",
  borderRadius: "7px",
  overflowX: "auto",
};

const historyTitleStyle = {
  padding: "11px 12px",
  backgroundColor: "#7c3aed",
  color: "white",
  fontSize: "14px",
  fontWeight: "900",
};

const historyHeaderStyle = {
  display: "grid",
  gridTemplateColumns:
    "110px 145px 145px 1fr 180px",
  minWidth: "850px",
  gap: "8px",
  padding: "10px 8px",
  backgroundColor: "#f5f3ff",
  color: "#5b21b6",
  fontSize: "11px",
  fontWeight: "bold",
};

const historyRowStyle = {
  display: "grid",
  gridTemplateColumns:
    "110px 145px 145px 1fr 180px",
  minWidth: "850px",
  gap: "8px",
  alignItems: "center",
  padding: "10px 8px",
  borderTop: "1px solid #e2e8f0",
  fontSize: "12px",
};

const historyEmptyStyle = {
  padding: "20px",
  color: "#64748b",
  textAlign: "center",
  fontSize: "12px",
};
