"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const ROUTES = [
  { id: "MPESA_TO_MPESA", label: "M-PESA → M-PESA" },
  { id: "MPESA_TO_IM", label: "M-PESA → I&M" },
  { id: "IM_TO_MPESA", label: "I&M → M-PESA" },
  { id: "MPESA_TO_CONSOLIDATED", label: "M-PESA → CONSOLIDATED" },
];

const EMPTY_IM_ACCOUNT = {
  id: null,
  account_name: "Team Legend I&M",
  paybill_number: "",
  account_number: "",
  default_reference: "",
  is_active: true,
};

const EMPTY_MPESA_ACCOUNT = {
  id: null,
  account_name: "",
  account_type: "",
  destination_number: "",
  account_reference: "",
  is_active: true,
};

const EMPTY_CONSOLIDATED_ACCOUNT = {
  id: null,
  account_name: "",
  paybill_number: "",
  account_number: "",
  is_active: true,
};

export default function AdminMpesaRatesPanel({ user }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const accessToken = user?.access_token || null;

  const authHeaders = useMemo(() => ({
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  }), [supabaseAnonKey, accessToken]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const [recipients, setRecipients] = useState([]);
  const [savingRecipientId, setSavingRecipientId] = useState("");
  const [deletingRecipientId, setDeletingRecipientId] = useState("");

  const [route, setRoute] = useState("MPESA_TO_MPESA");
  const [rows, setRows] = useState([]);
  const [removedIds, setRemovedIds] = useState([]);

  const [imAccount, setImAccount] = useState(EMPTY_IM_ACCOUNT);

  const [mpesaAccount, setMpesaAccount] = useState(EMPTY_MPESA_ACCOUNT);
  const [mpesaConnected, setMpesaConnected] = useState(false);
  const [mpesaChanged, setMpesaChanged] = useState(false);
  const [savingMpesa, setSavingMpesa] = useState(false);

  const [activePayment, setActivePayment] = useState(null);
  const [activatingMode, setActivatingMode] = useState(false);

  const [consolidatedAccount, setConsolidatedAccount] = useState(
    EMPTY_CONSOLIDATED_ACCOUNT
  );
  const [consolidatedConnected, setConsolidatedConnected] = useState(false);
  const [consolidatedChanged, setConsolidatedChanged] = useState(false);
  const [bankingMode, setBankingMode] = useState("MANUAL");
  const [automaticReady, setAutomaticReady] = useState(false);

  const [reason, setReason] = useState("");
  const [changed, setChanged] = useState(false);

  useEffect(() => {
    if (!message) return;

    const timer = setTimeout(() => {
      setMessage("");
      setMessageType("");
    }, 5000);

    return () => clearTimeout(timer);
  }, [message, messageType]);

  function showError(text) {
    setMessage(text);
    setMessageType("error");
  }

  function updateMessage(text) {
    setMessage(text);
    setMessageType("success");
  }

  const callRpc = useCallback(async (functionName, body = {}) => {
    if (!supabaseUrl || !supabaseAnonKey || !accessToken) {
      throw new Error("Admin session is incomplete.");
    }

    const response = await fetch(
      `${supabaseUrl}/rest/v1/rpc/${functionName}`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(body),
        cache: "no-store",
      }
    );

    const result = await safeJson(response);

    if (!response.ok) {
      throw new Error(
        result?.message ||
        result?.details ||
        result?.hint ||
        `Unable to run ${functionName}.`
      );
    }

    return result;
  }, [supabaseUrl, supabaseAnonKey, accessToken, authHeaders]);

  const restGet = useCallback(async (path, fallbackMessage) => {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/${path}`,
      {
        method: "GET",
        headers: authHeaders,
        cache: "no-store",
      }
    );

    const result = await safeJson(response);

    if (!response.ok) {
      throw new Error(
        result?.message ||
        result?.details ||
        result?.hint ||
        fallbackMessage
      );
    }

    return result;
  }, [supabaseUrl, authHeaders]);

  const loadAll = useCallback(async ({ silent = false } = {}) => {
    if (!supabaseUrl || !supabaseAnonKey || !accessToken) {
      setLoading(false);
      return;
    }

    if (silent) setRefreshing(true);
    else setLoading(true);

    try {
      const [
        tariffResult,
        imAccountsResult,
        accountsResult,
        bankingModeResult,
        activeModeResult,
      ] = await Promise.all([
        restGet(
          "payment_tariff_bands?select=*&order=payment_method.asc,min_amount.asc",
          "Unable to load payment tariffs."
        ),
        restGet(
          "im_payment_accounts?select=*&order=is_active.desc,updated_at.desc",
          "Unable to load I&M account."
        ),
        callRpc("tl_admin_shop_payment_snapshot", {}),
        callRpc("tl_banking_mode_snapshot", {}),
        restGet(
          "payment_system_settings?id=eq.1&select=collection_method,float_send_method,updated_at",
          "Unable to read active payment mode."
        ),
      ]);

      if (!Array.isArray(accountsResult)) {
        throw new Error("Unable to load shop payment accounts.");
      }

      const tariffRows = Array.isArray(tariffResult) ? tariffResult : [];

      setRows(tariffRows.map((item) => ({
        ...item,
        _key: String(item.id),
        _new: false,
      })));

      setRemovedIds([]);
      setChanged(false);
      setConsolidatedChanged(false);

      const currentMode = Array.isArray(activeModeResult)
        ? activeModeResult[0]
        : null;

      setActivePayment(currentMode || null);

      const bankingState = Array.isArray(bankingModeResult)
        ? bankingModeResult[0]
        : bankingModeResult;

      setBankingMode(
        bankingState?.mode === "AUTOMATIC" ? "AUTOMATIC" : "MANUAL"
      );
      setAutomaticReady(bankingState?.automatic_ready === true);

      const imRows = Array.isArray(imAccountsResult)
        ? imAccountsResult
        : [];

      const im = imRows.find((r) => r.is_active) || imRows[0] || null;

      setImAccount(im ? {
        id: im.id,
        account_name: im.account_name || "Team Legend I&M",
        paybill_number: im.paybill_number || "",
        account_number: im.account_number || "",
        default_reference: im.default_reference || "",
        is_active: im.is_active !== false,
      } : { ...EMPTY_IM_ACCOUNT });

      // Existing Company M-PESA account.
      // A secure snapshot RPC is the fallback if direct
      // table access is unavailable.

      try {
        let mpesaRows;

        try {
          mpesaRows = await restGet(
            "mpesa_company_accounts?select=*&order=is_active.desc,updated_at.desc",
            "Unable to read company M-PESA account."
          );
        } catch {
          mpesaRows = await callRpc(
            "tl_admin_mpesa_company_account_snapshot",
            {}
          );
        }

        if (Array.isArray(mpesaRows) && mpesaRows.length === 0) {
          mpesaRows = await callRpc(
            "tl_admin_mpesa_company_account_snapshot",
            {}
          );
        }

        const accounts = Array.isArray(mpesaRows)
          ? mpesaRows
          : mpesaRows ? [mpesaRows] : [];

        const account = accounts.find(
          (item) => item?.is_active === true
        ) || accounts[0] || null;

        setMpesaAccount(account ? {
          id: account.id || null,
          account_name: String(account.account_name || ""),
          account_type: String(account.account_type || ""),
          destination_number: String(account.destination_number || ""),
          account_reference: String(account.account_reference || ""),
          is_active: account.is_active === true,
        } : { ...EMPTY_MPESA_ACCOUNT });

        setMpesaConnected(Boolean(account?.id));
        setMpesaChanged(false);
      } catch (error) {
        console.warn(
          "Company M-PESA account snapshot unavailable:",
          error
        );

        setMpesaAccount({ ...EMPTY_MPESA_ACCOUNT });
        setMpesaConnected(false);
        setMpesaChanged(false);
      }

      // Existing Consolidated Banking section stays separate.

      try {
        const result = await callRpc(
          "tl_admin_consolidated_company_account_snapshot",
          {}
        );

        const account = Array.isArray(result) ? result[0] : result;

        setConsolidatedAccount(account ? {
          id: account.id || null,
          account_name: String(account.account_name || ""),
          paybill_number: String(account.paybill_number || ""),
          account_number: String(account.account_number || ""),
          is_active: account.is_active !== false,
        } : { ...EMPTY_CONSOLIDATED_ACCOUNT });

        setConsolidatedConnected(true);
      } catch (error) {
        setConsolidatedConnected(false);
        setConsolidatedAccount({ ...EMPTY_CONSOLIDATED_ACCOUNT });

        console.warn(
          "Consolidated account backend not installed:",
          error
        );
      }

      setRecipients(
        accountsResult.map((row) => ({
          ...row,
          phone_number: String(row.phone_number || ""),
          im_reference: String(row.im_reference || ""),
          allow_mpesa_to_mpesa: row.allow_mpesa_to_mpesa !== false,
          allow_im_to_mpesa: row.allow_im_to_mpesa !== false,
        }))
      );
    } catch (error) {
      console.error("LOAD PAYMENT ADMIN ERROR:", error);
      showError(error?.message || "Unable to load payment settings.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [supabaseUrl, supabaseAnonKey, accessToken, restGet, callRpc]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // SHOP PAYMENT ACCOUNTS — PRESERVED

  const sortedRecipients = useMemo(() => {
    return [...recipients].sort((a, b) =>
      String(a.shop_name || "").localeCompare(
        String(b.shop_name || "")
      )
    );
  }, [recipients]);

  function updateRecipientField(shopId, field, value) {
    setRecipients((previous) => previous.map((recipient) =>
      String(recipient.shop_id) === String(shopId)
        ? { ...recipient, [field]: value }
        : recipient
    ));
  }

  async function saveRecipientRecord(recipient) {
    const shopId = String(recipient.shop_id || "");
    const phone = String(recipient.phone_number || "").trim();

    if (!shopId) return showError("Select shop.");
    if (!phone) return showError("Enter shop M-Pesa number.");

    try {
      setSavingRecipientId(shopId);
      setMessage("");

      await callRpc("tl_admin_shop_payment_save", {
        p_shop_id: shopId,
        p_phone_number: phone,
        p_im_reference: String(recipient.im_reference || "").trim() || null,
        p_allow_mpesa_to_mpesa: recipient.allow_mpesa_to_mpesa !== false,
        p_allow_im_to_mpesa: recipient.allow_im_to_mpesa !== false,
      });

      setMessage("Shop payment account saved.");
      setMessageType("success");
      await loadAll({ silent: true });
    } catch (error) {
      showError(error?.message || "Unable to save shop account.");
    } finally {
      setSavingRecipientId("");
    }
  }

  async function disableRecipient(recipient) {
    const shopId = String(recipient.shop_id || "");

    if (!shopId || !window.confirm(
      `Remove active payment number for ${recipient.shop_name}?`
    )) return;

    try {
      setDeletingRecipientId(shopId);

      await callRpc("tl_admin_shop_payment_disable", {
        p_shop_id: shopId,
      });

      setMessage("Shop payment account removed.");
      setMessageType("success");
      await loadAll({ silent: true });
    } catch (error) {
      showError(error?.message || "Unable to remove shop account.");
    } finally {
      setDeletingRecipientId("");
    }
  }

  // ONE RATE TABLE — FOUR PAYMENT METHODS

  const visibleRows = useMemo(
    () => rows
      .filter((r) =>
        r.payment_method === route &&
        !removedIds.includes(String(r.id))
      )
      .sort((a, b) => Number(a.min_amount) - Number(b.min_amount)),
    [rows, route, removedIds]
  );

  function updateRow(key, field, value) {
    setRows((old) => old.map((r) =>
      r._key === key ? { ...r, [field]: value } : r
    ));

    setChanged(true);
  }

  function addRow() {
    const key = `new-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    setRows((old) => [
      ...old,
      {
        _key: key,
        _new: true,
        id: null,
        payment_method: route,
        min_amount: "",
        max_amount: "",
        fee: "",
        is_active: true,
      },
    ]);

    setChanged(true);
  }

  function removeRow(row) {
    if (!window.confirm(
      "Remove this fee band when you save changes?"
    )) return;

    if (row._new) {
      setRows((old) => old.filter((r) => r._key !== row._key));
    } else {
      setRemovedIds((old) => [
        ...new Set([...old, String(row.id)]),
      ]);
    }

    setChanged(true);
  }

  function setMpesa(key, value) {
    setMpesaAccount((old) => ({ ...old, [key]: value }));
    setMpesaChanged(true);
  }

  async function saveMpesaDetails() {
    if (busy || savingMpesa || activatingMode) return;

    try {
      if (!mpesaConnected || !mpesaAccount.id) {
        throw new Error(
          "Company M-PESA account is not available for editing."
        );
      }

      if (!reason.trim()) {
        throw new Error(
          "Enter a reason for the M-PESA account changes."
        );
      }

      if (
        !mpesaAccount.account_name.trim() ||
        !mpesaAccount.destination_number.trim()
      ) {
        throw new Error(
          "Enter Company M-PESA name and destination number."
        );
      }

      if (!window.confirm(
        "Save the Company M-PESA account details?"
      )) return;

      setSavingMpesa(true);

      const result = await callRpc("tl_admin_mpesa_company_account_save", {
        p_id: mpesaAccount.id,
        p_account_name: mpesaAccount.account_name.trim(),
        p_destination_number: mpesaAccount.destination_number.trim(),
        p_account_reference:
          mpesaAccount.account_reference.trim() || null,
        p_is_active: mpesaAccount.is_active === true,
        p_reason: reason.trim(),
      });

      if (result?.success !== true) {
        throw new Error(
          result?.message || "Company M-PESA save was not confirmed."
        );
      }

      setReason("");
      await loadAll({ silent: true });
      updateMessage(
        result.changed === false
          ? "Account details are already current. Nothing was changed."
          : "Company M-PESA details saved."
      );
    } catch (error) {
      showError(
        error?.message || "Unable to save Company M-PESA details."
      );
    } finally {
      setSavingMpesa(false);
    }
  }

  async function activateMode() {
    if (busy || activatingMode || savingMpesa) return;

    try {
      if (!["MPESA_TO_MPESA", "MPESA_TO_IM"].includes(route)) {
        throw new Error(
          "Select M-PESA → M-PESA or M-PESA → I&M to activate."
        );
      }

      if (!activePayment) {
        throw new Error("Active payment mode has not loaded.");
      }

      if (changed || mpesaChanged) {
        throw new Error(
          "Save or discard unsaved edits before activating a mode."
        );
      }

      if (!reason.trim()) {
        throw new Error(
          "Enter a reason in the field below before activating."
        );
      }

      if (route === activePayment.collection_method) {
        throw new Error(
          "This cashier collection mode is already active."
        );
      }

      const accountantRoute = route === "MPESA_TO_MPESA"
        ? "M-PESA → M-PESA"
        : "I&M → M-PESA";

      if (!window.confirm(
        `Activate ${ROUTES.find((x) => x.id === route)?.label} for cashiers ` +
        `and ${accountantRoute} for Accountant payouts? ` +
        "Existing expenses and pending transaction fees will remain unchanged."
      )) return;

      setActivatingMode(true);

      const result = await callRpc(
        "tl_admin_activate_payment_mode",
        {
          p_collection_method: route,
          p_reason: reason.trim(),
        }
      );

      if (result?.success !== true) {
        throw new Error(
          result?.message || "Payment mode activation failed."
        );
      }

      setReason("");
      await loadAll({ silent: true });

      updateMessage(
        result?.changed === false
          ? "Selected payment mode was already active."
          : "Cashier and Accountant payment modes activated together."
      );
    } catch (error) {
      showError(
        error?.message || "Unable to activate payment mode."
      );
    } finally {
      setActivatingMode(false);
    }
  }

  function setIm(key, value) {
    setImAccount((old) => ({ ...old, [key]: value }));
    setChanged(true);
  }

  function setConsolidated(key, value) {
    setConsolidatedAccount((old) => ({ ...old, [key]: value }));
    setConsolidatedChanged(true);
    setChanged(true);
  }

  function validateRows() {
    for (const r of rows) {
      if (r.id && removedIds.includes(String(r.id))) continue;

      if (!ROUTES.some(
        (option) => option.id === r.payment_method
      )) {
        throw new Error("Unknown payment route.");
      }

      const min = Number(r.min_amount);
      const max = Number(r.max_amount);
      const fee = Number(r.fee);

      if (
        r.min_amount === "" ||
        r.max_amount === "" ||
        r.fee === "" ||
        !Number.isFinite(min) ||
        !Number.isFinite(max) ||
        !Number.isFinite(fee) ||
        min < 0.01 ||
        max < min ||
        fee < 0 ||
        Math.abs(Math.round(min * 100) - min * 100) > 1e-6 ||
        Math.abs(Math.round(max * 100) - max * 100) > 1e-6 ||
        Math.abs(Math.round(fee * 100) - fee * 100) > 1e-6
      ) {
        throw new Error(
          "Enter valid Min, Max and Fee values (two decimal places maximum)."
        );
      }
    }

    for (const option of ROUTES) {
      const active = rows
        .filter((r) =>
          r.payment_method === option.id &&
          r.is_active !== false &&
          !(r.id && removedIds.includes(String(r.id)))
        )
        .sort(
          (a, b) =>
            Number(a.min_amount) - Number(b.min_amount)
        );

      if (!active.length) {
        if (rows.some((r) =>
          r.payment_method === option.id
        )) {
          throw new Error(
            `Missing active rates: ${option.label}.`
          );
        }
        continue;
      }

      if (Number(active[0].min_amount) !== 1) {
        throw new Error(
          `${option.label}: first band must start at KES 1.`
        );
      }

      for (let i = 1; i < active.length; i++) {
        const previousMax = Number(active[i - 1].max_amount);
        const nextMin = Number(active[i].min_amount);
        const difference =
          Math.round(
            (nextMin - previousMax) * 100
          ) / 100;

        if (difference <= 0 || difference > 1) {
          throw new Error(
            `${option.label}: overlapping or missing fee ranges.`
          );
        }
      }
    }
  }

  async function saveAll() {
    if (busy) return;

    try {
      if (!changed) {
        throw new Error(
          "No tariff or bank changes to save."
        );
      }

      if (!reason.trim()) {
        throw new Error(
          "Enter one reason for these changes."
        );
      }

      if (
        bankingMode === "AUTOMATIC" &&
        !automaticReady
      ) {
        throw new Error(
          "Automatic Banking integration is not ready."
        );
      }

      validateRows();

      if (
        !imAccount.account_name.trim() ||
        (
          !imAccount.paybill_number.trim() &&
          !imAccount.account_number.trim()
        )
      ) {
        throw new Error(
          "I&M company account details are incomplete."
        );
      }

      // Consolidated Banking is a separate pending integration.
      // Its missing backend does not block unrelated edits.

      if (consolidatedChanged && !consolidatedConnected) {
        throw new Error(
          "Consolidated Bank account backend is not connected yet. Install its Supabase account functions before editing Consolidated Banking."
        );
      }

      if (
        consolidatedChanged &&
        (
          !consolidatedAccount.account_name.trim() ||
          (
            !consolidatedAccount.paybill_number.trim() &&
            !consolidatedAccount.account_number.trim()
          )
        )
      ) {
        throw new Error(
          "Enter the Consolidated Bank company account details."
        );
      }

      if (!window.confirm(
        "Save the payment settings and fee changes?"
      )) return;

      setBusy(true);
      setMessage("");

      await callRpc(
        "tl_admin_payment_routes_save_all",
        {
          p_bands: rows
            .filter(
              (r) =>
                !r.id ||
                !removedIds.includes(String(r.id))
            )
            .map((r) => ({
              id: r.id || null,
              payment_method: r.payment_method,
              min_amount: Number(r.min_amount),
              max_amount: Number(r.max_amount),
              fee: Number(r.fee),
              is_active: r.is_active !== false,
            })),
          p_removed_ids: removedIds,
          p_im_account: imAccount,
          p_consolidated_account: consolidatedAccount,
          p_banking_mode: bankingMode,
          p_reason: reason.trim(),
        }
      );

      setReason("");
      updateMessage("Payment settings saved.");
      await loadAll({ silent: true });
    } catch (error) {
      showError(
        error?.message ||
        "Unable to save payment settings."
      );
    } finally {
      setBusy(false);
    }
  }
  if (loading) {
    return (
      <div style={loadingStyle}>
        Loading payment settings...
      </div>
    );
  }

  return (
    <div className="tl-payment-admin" style={wrapperStyle}>
      <style>{`
        .tl-payment-admin input[type="number"] {
          appearance: textfield;
          -moz-appearance: textfield;
        }

        .tl-payment-admin input[type="number"]::-webkit-inner-spin-button,
        .tl-payment-admin input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }

        .tl-payment-admin button:disabled {
          cursor: not-allowed;
          opacity: .55;
        }
      `}</style>

      <section style={heroStyle}>
        <strong>BANKING & PAYMENT SETTINGS</strong>

        <button
          type="button"
          onClick={() => {
            if (
              (changed || mpesaChanged) &&
              !window.confirm("Discard unsaved changes?")
            ) return;

            loadAll({ silent: true });
          }}
          disabled={
            refreshing ||
            busy ||
            activatingMode ||
            savingMpesa
          }
          style={refreshButtonStyle}
        >
          {refreshing ? "REFRESHING..." : "REFRESH ALL"}
        </button>
      </section>

      {message && (
        <div
          role={
            messageType === "error"
              ? "alert"
              : "status"
          }
          style={{
            ...messageStyle,
            color:
              messageType === "error"
                ? "#991b1b"
                : "#166534",
            background:
              messageType === "error"
                ? "#fef2f2"
                : "#ecfdf5",
          }}
        >
          {message}
        </div>
      )}

      {/* SHOP PAYMENT ACCOUNTS — UNCHANGED */}

      <details style={dropdownStyle}>
        <summary
          style={{
            ...cashierTitleStyle,
            ...dropdownHeadingStyle,
          }}
        >
          <span>SHOP PAYMENT ACCOUNTS</span>
          <span aria-hidden="true">▾</span>
        </summary>

        <div style={bodyStyle}>
          <div style={cashierWrapStyle}>
            <div style={cashierHeaderStyle}>
              <div style={{ textAlign: "left" }}>
                SHOP
              </div>
              <div style={{ textAlign: "left" }}>
                CASHIER — DUTY ROTA
              </div>
              <div style={{ textAlign: "left" }}>
                M-PESA
              </div>
              <div style={{ textAlign: "left" }}>
                I&M REF
              </div>
              <div style={{ textAlign: "center" }}>
                M→M
              </div>
              <div style={{ textAlign: "center" }}>
                I&M→M
              </div>
              <div style={{ textAlign: "center" }}>
                SAVE
              </div>
              <div style={{ textAlign: "center" }}>
                REMOVE
              </div>
            </div>

            {sortedRecipients.map((recipient) => (
              <div
                key={recipient.shop_id}
                style={cashierRowStyle}
              >
                <strong>{recipient.shop_name}</strong>

                <div style={dutyNameStyle}>
                  {recipient.cashier_name || "NOT ASSIGNED"}
                </div>

                <input
                  type="tel"
                  value={recipient.phone_number || ""}
                  onChange={(event) =>
                    updateRecipientField(
                      recipient.shop_id,
                      "phone_number",
                      event.target.value
                    )
                  }
                  style={smallInputStyle}
                />

                <input
                  value={recipient.im_reference || ""}
                  onChange={(event) =>
                    updateRecipientField(
                      recipient.shop_id,
                      "im_reference",
                      event.target.value
                    )
                  }
                  style={smallInputStyle}
                />

                <CenterCheck
                  checked={
                    recipient.allow_mpesa_to_mpesa !== false
                  }
                  onChange={(checked) =>
                    updateRecipientField(
                      recipient.shop_id,
                      "allow_mpesa_to_mpesa",
                      checked
                    )
                  }
                />

                <CenterCheck
                  checked={
                    recipient.allow_im_to_mpesa !== false
                  }
                  onChange={(checked) =>
                    updateRecipientField(
                      recipient.shop_id,
                      "allow_im_to_mpesa",
                      checked
                    )
                  }
                />

                <button
                  type="button"
                  onClick={() =>
                    saveRecipientRecord(recipient)
                  }
                  disabled={
                    savingRecipientId ===
                    String(recipient.shop_id)
                  }
                  style={saveButtonStyle}
                >
                  {savingRecipientId ===
                  String(recipient.shop_id)
                    ? "SAVING..."
                    : "SAVE"}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    disableRecipient(recipient)
                  }
                  disabled={
                    deletingRecipientId ===
                    String(recipient.shop_id)
                  }
                  style={deleteButtonStyle}
                >
                  {deletingRecipientId ===
                  String(recipient.shop_id)
                    ? "REMOVING..."
                    : "REMOVE"}
                </button>
              </div>
            ))}
          </div>
        </div>
      </details>

      {/* ONE ROUTE AT A TIME — ONE TABLE */}

      <section style={panelStyle}>
        <div style={sectionTitle}>
          PAYMENT RATES
        </div>

        <div style={bodyStyle}>
          {/* PAYMENT DROPDOWN AND ACTIVATION */}

          <div style={modeToolbarStyle}>
            <Field label="PAYMENT METHOD">
              <select
                style={inputStyle}
                value={route}
                onChange={(event) => {
                  setRoute(event.target.value);
                  setMessage("");
                  setMessageType("");
                }}
              >
                {ROUTES.map((item) => (
                  <option
                    key={item.id}
                    value={item.id}
                  >
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>

            <button
              type="button"
              style={activateButtonStyle}
              disabled={
                busy ||
                activatingMode ||
                savingMpesa ||
                refreshing ||
                changed ||
                mpesaChanged ||
                !activePayment ||
                ![
                  "MPESA_TO_MPESA",
                  "MPESA_TO_IM",
                ].includes(route) ||
                activePayment?.collection_method === route
              }
              onClick={activateMode}
            >
              {activatingMode
                ? "ACTIVATING..."
                : activePayment?.collection_method === route
                ? "ACTIVE MODE"
                : "ACTIVATE MODE"}
            </button>
          </div>

          {/* CURRENT LIVE PAYMENT CONFIGURATION */}

          <div style={modeSummaryStyle}>
            <strong>ACTIVE:</strong>{" "}

            {activePayment
              ? `${
                  ROUTES.find(
                    (item) =>
                      item.id ===
                      activePayment.collection_method
                  )?.label ||
                  activePayment.collection_method
                } (Cashier) · ${
                  ROUTES.find(
                    (item) =>
                      item.id ===
                      activePayment.float_send_method
                  )?.label ||
                  activePayment.float_send_method
                } (Accountant)`
              : "Not loaded — activation unavailable"}
          </div>

          {/* ONE SHARED REASON */}

          <div
            style={{
              ...formGrid,
              marginTop: 6,
            }}
          >
            <Field label="ONE REASON FOR MODE ACTIVATION OR CHANGES">
              <textarea
                rows={2}
                style={textareaStyle}
                placeholder="Reason for activation or account / fee changes"
                value={reason}
                onChange={(event) =>
                  setReason(event.target.value)
                }
              />
            </Field>

            <div
              style={{
                display: "flex",
                alignItems: "end",
              }}
            >
              <button
                type="button"
                style={outlineButton}
                onClick={addRow}
                disabled={
                  busy ||
                  activatingMode ||
                  savingMpesa
                }
              >
                + ADD FEE BAND
              </button>
            </div>
          </div>

          {(
            route === "IM_TO_MPESA" ||
            route === "MPESA_TO_CONSOLIDATED"
          ) && (
            <div style={smallTextStyle}>
              {route === "IM_TO_MPESA"
                ? "I&M → M-PESA activates automatically with M-PESA → I&M."
                : "Consolidated Banking mode is separate and is not activated here."}
            </div>
          )}

          {/* UNIFIED PAYMENT FEE TABLE */}

          <div style={tableWrap}>
            <div style={tableHeader}>
              <span>MIN (KES)</span>
              <span>MAX (KES)</span>
              <span>FEE (KES)</span>
              <span>ACTIVE</span>
              <span>REMOVE</span>
            </div>

            {!visibleRows.length && (
              <div style={emptyStyle}>
                No tariff bands for this route.
                Add its rates before saving.
              </div>
            )}

            {visibleRows.map((r) => (
              <div
                key={r._key}
                style={tableRow}
              >
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={
                    r.min_amount === ""
                      ? ""
                      : Math.ceil(
                          Number(r.min_amount)
                        )
                  }
                  style={smallInputStyle}
                  aria-label="Minimum amount"
                  onChange={(event) =>
                    updateRow(
                      r._key,
                      "min_amount",
                      event.target.value
                    )
                  }
                />

                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={r.max_amount}
                  style={smallInputStyle}
                  aria-label="Maximum amount"
                  onChange={(event) =>
                    updateRow(
                      r._key,
                      "max_amount",
                      event.target.value
                    )
                  }
                />

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={r.fee}
                  style={smallInputStyle}
                  aria-label="Transaction fee"
                  onChange={(event) =>
                    updateRow(
                      r._key,
                      "fee",
                      event.target.value
                    )
                  }
                />

                <CenterCheck
                  checked={r.is_active !== false}
                  onChange={(checked) =>
                    updateRow(
                      r._key,
                      "is_active",
                      checked
                    )
                  }
                />

                <button
                  type="button"
                  onClick={() => removeRow(r)}
                  style={deleteButtonStyle}
                >
                  REMOVE
                </button>
              </div>
            ))}
          </div>

          {/* COMPANY M-PESA ACCOUNT */}

          {route === "MPESA_TO_MPESA" && (
            <div style={subPanelStyle}>
              <strong>
                COMPANY M-PESA ACCOUNT — CASHIER SEND MONEY
              </strong>

              {!mpesaConnected && (
                <div style={warningStyle}>
                  Company M-PESA account cannot be
                  loaded. Check Admin account read
                  permissions or install its
                  snapshot RPC.
                </div>
              )}

              <div style={formGrid}>
                <Field label="ACCOUNT NAME">
                  <input
                    style={inputStyle}
                    value={
                      mpesaAccount.account_name
                    }
                    disabled={!mpesaConnected}
                    onChange={(event) =>
                      setMpesa(
                        "account_name",
                        event.target.value
                      )
                    }
                  />
                </Field>

                <Field label="M-PESA DESTINATION NUMBER">
                  <input
                    type="tel"
                    style={inputStyle}
                    value={
                      mpesaAccount.destination_number
                    }
                    disabled={!mpesaConnected}
                    onChange={(event) =>
                      setMpesa(
                        "destination_number",
                        event.target.value
                      )
                    }
                  />
                </Field>

                <Field label="ACCOUNT REFERENCE">
                  <input
                    style={inputStyle}
                    value={
                      mpesaAccount.account_reference
                    }
                    disabled={!mpesaConnected}
                    onChange={(event) =>
                      setMpesa(
                        "account_reference",
                        event.target.value
                      )
                    }
                  />
                </Field>

                <Field label="ACCOUNT TYPE">
                  <input
                    style={{
                      ...inputStyle,
                      background: "#f1f5f9",
                    }}
                    value={
                      mpesaAccount.account_type
                    }
                    readOnly
                  />
                </Field>
              </div>

              <label style={checkboxLineStyle}>
                <input
                  type="checkbox"
                  checked={
                    mpesaAccount.is_active === true
                  }
                  disabled={!mpesaConnected}
                  onChange={(event) =>
                    setMpesa(
                      "is_active",
                      event.target.checked
                    )
                  }
                />

                ACTIVE COMPANY M-PESA ACCOUNT
              </label>

              <button
                type="button"
                style={{
                  ...outlineButton,
                  justifySelf: "start",
                }}
                disabled={
                  !mpesaConnected ||
                  savingMpesa ||
                  busy ||
                  activatingMode ||
                  changed
                }
                onClick={saveMpesaDetails}
              >
                {savingMpesa
                  ? "SAVING..."
                  : "SAVE M-PESA DETAILS"}
              </button>

              <div style={smallTextStyle}>
                Cashiers receive the current
                company destination when preparing
                new M-PESA → M-PESA returns.
                Prepared transactions retain
                their original saved destination
                and fee.
              </div>
            </div>
          )}

          {/* I&M ACCOUNT — SEND MONEY */}

          {route === "MPESA_TO_IM" && (
            <div style={subPanelStyle}>
              <strong>
                I&M COMPANY ACCOUNT — SEND MONEY
              </strong>

              <div style={formGrid}>
                <Field label="ACCOUNT NAME">
                  <input
                    style={inputStyle}
                    value={
                      imAccount.account_name
                    }
                    onChange={(event) =>
                      setIm(
                        "account_name",
                        event.target.value
                      )
                    }
                  />
                </Field>

                <Field label="PAYBILL NUMBER">
                  <input
                    style={inputStyle}
                    value={
                      imAccount.paybill_number
                    }
                    onChange={(event) =>
                      setIm(
                        "paybill_number",
                        event.target.value
                      )
                    }
                  />
                </Field>

                <Field label="ACCOUNT NUMBER">
                  <input
                    style={inputStyle}
                    value={
                      imAccount.account_number
                    }
                    onChange={(event) =>
                      setIm(
                        "account_number",
                        event.target.value
                      )
                    }
                  />
                </Field>
              </div>

              <label style={checkboxLineStyle}>
                <input
                  type="checkbox"
                  checked={
                    imAccount.is_active !== false
                  }
                  onChange={(event) =>
                    setIm(
                      "is_active",
                      event.target.checked
                    )
                  }
                />

                ACTIVE I&M COMPANY ACCOUNT
              </label>
            </div>
          )}

          {/* CONSOLIDATED BANKING — PRESERVED */}

          {route === "MPESA_TO_CONSOLIDATED" && (
            <div style={subPanelStyle}>
              <strong>
                CONSOLIDATED BANK COMPANY ACCOUNT
              </strong>

              <div style={smallTextStyle}>
                BOTH BANKING MODES USE THESE
                CONSOLIDATED FEES
              </div>

              <Field label="BANKING CONFIRMATION MODE">
                <select
                  style={inputStyle}
                  value={bankingMode}
                  onChange={(event) => {
                    setBankingMode(
                      event.target.value
                    );
                    setConsolidatedChanged(true);
                    setChanged(true);
                  }}
                >
                  <option value="MANUAL">
                    MANUAL — ANONYMOUS REFERENCE
                  </option>

                  <option
                    value="AUTOMATIC"
                    disabled={!automaticReady}
                  >
                    AUTOMATIC
                    {!automaticReady
                      ? " — NOT CONNECTED"
                      : ""}
                  </option>
                </select>
              </Field>

              {!consolidatedConnected && (
                <div style={warningStyle}>
                  Account setup pending in
                  Supabase. Do not save account
                  changes yet.
                </div>
              )}

              <div style={formGrid}>
                <Field label="ACCOUNT NAME">
                  <input
                    style={inputStyle}
                    value={
                      consolidatedAccount.account_name
                    }
                    onChange={(event) =>
                      setConsolidated(
                        "account_name",
                        event.target.value
                      )
                    }
                  />
                </Field>

                <Field label="PAYBILL NUMBER">
                  <input
                    style={inputStyle}
                    value={
                      consolidatedAccount.paybill_number
                    }
                    onChange={(event) =>
                      setConsolidated(
                        "paybill_number",
                        event.target.value
                      )
                    }
                  />
                </Field>

                <Field label="ACCOUNT NUMBER">
                  <input
                    style={inputStyle}
                    value={
                      consolidatedAccount.account_number
                    }
                    onChange={(event) =>
                      setConsolidated(
                        "account_number",
                        event.target.value
                      )
                    }
                  />
                </Field>
              </div>

              <label style={checkboxLineStyle}>
                <input
                  type="checkbox"
                  checked={
                    consolidatedAccount.is_active !== false
                  }
                  onChange={(event) =>
                    setConsolidated(
                      "is_active",
                      event.target.checked
                    )
                  }
                />

                ACTIVE CONSOLIDATED BANK COMPANY ACCOUNT
              </label>
            </div>
          )}

          {/* MAIN RATE / BANK SETTINGS SAVE */}

          <button
            type="button"
            style={saveAllButton}
            disabled={
              busy ||
              activatingMode ||
              savingMpesa ||
              !changed
            }
            onClick={saveAll}
          >
            {busy
              ? "SAVING..."
              : "SAVE ALL CHANGES"}
          </button>
        </div>
      </section>
    </div>
  );
}

// SUPPORT COMPONENTS

function Field({ label, children }) {
  return (
    <div>
      <label style={labelStyle}>
        {label}
      </label>
      {children}
    </div>
  );
}

function CenterCheck({ checked, onChange }) {
  return (
    <div style={centerStyle}>
      <input
        type="checkbox"
        checked={Boolean(checked)}
        onChange={(event) =>
          onChange(event.target.checked)
        }
      />
    </div>
  );
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

// PROFESSIONAL ADMIN THEME

const wrapperStyle = {
  display: "grid",
  gap: 14,
};

const loadingStyle = {
  padding: 30,
  textAlign: "center",
  fontWeight: 700,
};

const heroStyle = {
  padding: 16,
  borderRadius: 7,
  background:
    "linear-gradient(90deg,#047857,#0f766e)",
  color: "white",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
};

const refreshButtonStyle = {
  padding: "9px 13px",
  border: "1px solid white",
  background: "transparent",
  color: "white",
  borderRadius: 5,
  cursor: "pointer",
  fontWeight: 700,
};

const messageStyle = {
  padding: 10,
  borderRadius: 5,
  fontSize: 12,
  fontWeight: 700,
};

const panelStyle = {
  border: "1px solid #cbd5e1",
  borderRadius: 7,
  background: "white",
  overflow: "hidden",
};

const sectionTitle = {
  padding: 12,
  background: "#0f172a",
  color: "white",
  fontWeight: 900,
};

const bodyStyle = {
  padding: "13px",
};

const modeToolbarStyle = {
  display: "grid",
  gridTemplateColumns:
    "minmax(0,1fr) auto",
  gap: 10,
  alignItems: "end",
  marginTop: 12,
};

const activateButtonStyle = {
  padding: "10px 13px",
  borderRadius: 5,
  border: "none",
  background: "#0f766e",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
  whiteSpace: "nowrap",
  fontSize: 11,
};

const modeSummaryStyle = {
  fontSize: 11,
  color: "#475569",
  background: "#f1f5f9",
  borderRadius: 5,
  padding: "9px 10px",
  marginTop: 10,
};

const formGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(220px,1fr))",
  gap: 12,
  margin: "12px 0",
};

const labelStyle = {
  display: "block",
  marginBottom: 5,
  color: "#334155",
  fontSize: 11,
  fontWeight: 800,
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #94a3b8",
  borderRadius: 5,
  background: "white",
  color: "#0f172a",
  padding: "10px",
  fontSize: 12,
};

const smallInputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "7px",
  border: "1px solid #cbd5e1",
  borderRadius: "4px",
  fontSize: "11px",
  backgroundColor: "white",
  color: "#0f172a",
};

const textareaStyle = {
  ...inputStyle,
  resize: "vertical",
  marginBottom: 12,
};

const outlineButton = {
  background: "#f1f5f9",
  color: "#0f172a",
  border: "1px solid #cbd5e1",
  padding: "10px 14px",
  borderRadius: 5,
  fontWeight: 800,
  cursor: "pointer",
};

const saveAllButton = {
  width: "100%",
  padding: 12,
  border: 0,
  borderRadius: 6,
  background: "#047857",
  color: "white",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 13,
};

const deleteButtonStyle = {
  padding: "7px",
  border: "none",
  borderRadius: "4px",
  backgroundColor: "#dc2626",
  color: "white",
  fontSize: "10px",
  fontWeight: "bold",
  cursor: "pointer",
};

const saveButtonStyle = {
  padding: "7px",
  border: "none",
  borderRadius: "4px",
  backgroundColor: "#0284c7",
  color: "white",
  fontSize: "10px",
  fontWeight: "bold",
  cursor: "pointer",
};

const centerStyle = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
};

const tableWrap = {
  overflowX: "auto",
  marginTop: 10,
  marginBottom: 16,
};

const tableCols =
  "1fr 1fr 1fr 70px 86px";

const tableHeader = {
  display: "grid",
  gridTemplateColumns: tableCols,
  gap: 6,
  minWidth: 540,
  padding: 8,
  background: "#e2e8f0",
  fontSize: 11,
  fontWeight: 900,
};

const tableRow = {
  display: "grid",
  gridTemplateColumns: tableCols,
  gap: 6,
  minWidth: 540,
  alignItems: "center",
  padding: 8,
  borderBottom:
    "1px solid #e2e8f0",
};

const emptyStyle = {
  padding: 15,
  color: "#64748b",
  fontSize: 12,
};

const subPanelStyle = {
  margin: "14px 0",
  padding: 13,
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  display: "grid",
  gap: 8,
  borderRadius: 6,
};

const checkboxLineStyle = {
  display: "flex",
  gap: 7,
  alignItems: "center",
  fontSize: 12,
  fontWeight: 700,
};

const dropdownStyle = {
  border: "1px solid #cbd5e1",
  borderRadius: "7px",
  overflow: "hidden",
  backgroundColor: "white",
};

const dropdownHeadingStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  cursor: "pointer",
  listStyle: "none",
  userSelect: "none",
};

const cashierTitleStyle = {
  padding: "11px",
  backgroundColor: "#0f766e",
  color: "white",
  fontWeight: "900",
  fontSize: "13px",
};

const cashierWrapStyle = {
  marginTop: "12px",
  overflowX: "auto",
};

const cashierColumns =
  "1.1fr 1.4fr 1.1fr 1.1fr .45fr .45fr .7fr .7fr";

const cashierHeaderStyle = {
  display: "grid",
  gridTemplateColumns:
    cashierColumns,
  gap: "5px",
  minWidth: "940px",
  padding: "7px",
  backgroundColor: "#f1f5f9",
  fontSize: "10px",
  fontWeight: "bold",
  textAlign: "left",
};

const cashierRowStyle = {
  display: "grid",
  gridTemplateColumns:
    cashierColumns,
  gap: "5px",
  minWidth: "940px",
  padding: "7px",
  borderTop:
    "1px solid #e2e8f0",
  alignItems: "center",
  fontSize: "11px",
};

const dutyNameStyle = {
  fontSize: "11px",
  fontWeight: "700",
  overflowWrap: "anywhere",
};

const smallTextStyle = {
  color: "#475569",
  fontSize: 11,
  fontWeight: 700,
};

const warningStyle = {
  color: "#9a3412",
  fontSize: 11,
  background: "#fff7ed",
  border: "1px solid #fed7aa",
  borderRadius: 5,
  padding: 9,
};
