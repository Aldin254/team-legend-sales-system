"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

// TEAM LEGEND — Unified payment-rate management.
// SHOP PAYMENT ACCOUNTS preserved from the original file.

const ROUTES = [
  { id: "MPESA_TO_MPESA", label: "M-PESA → M-PESA" },
  { id: "MPESA_TO_IM", label: "M-PESA → I&M" },
  { id: "IM_TO_MPESA", label: "I&M → M-PESA" },
  {
    id: "MPESA_TO_CONSOLIDATED",
    label: "M-PESA → CONSOLIDATED",
  },
];

const EMPTY_IM_ACCOUNT = {
  id: null,
  account_name: "Team Legend I&M",
  paybill_number: "",
  account_number: "",
  default_reference: "",
  is_active: true,
};

export default function AdminMpesaRatesPanel({ user }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const accessToken = user?.access_token || null;

  const authHeaders = useMemo(
    () => ({
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    }),
    [supabaseAnonKey, accessToken]
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const [recipients, setRecipients] = useState([]);
  const [savingRecipientId, setSavingRecipientId] =
    useState("");
  const [deletingRecipientId, setDeletingRecipientId] =
    useState("");

  const [route, setRoute] = useState(
    "MPESA_TO_CONSOLIDATED"
  );
  const [rows, setRows] = useState([]);
  const [removedIds, setRemovedIds] = useState([]);

  const [paymentSettings, setPaymentSettings] = useState({
    collection_method: "MPESA_TO_MPESA",
    float_send_method: "MPESA_TO_MPESA",
  });

  const [imAccount, setImAccount] =
    useState(EMPTY_IM_ACCOUNT);

  const [bankingMode, setBankingMode] =
    useState("MANUAL");
  const [automaticReady, setAutomaticReady] =
    useState(false);

  const [reason, setReason] = useState("");
  const [testAmount, setTestAmount] = useState("");
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
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

  const callRpc = useCallback(
    async (functionName, body = {}) => {
      if (
        !supabaseUrl ||
        !supabaseAnonKey ||
        !accessToken
      ) {
        throw new Error(
          "Admin session is incomplete."
        );
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
    },
    [
      supabaseUrl,
      supabaseAnonKey,
      accessToken,
      authHeaders,
    ]
  );

  const restGet = useCallback(
    async (path, fallbackMessage) => {
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
    },
    [supabaseUrl, authHeaders]
  );

  // LOAD PAYMENT SETTINGS AND SHOP ACCOUNTS

  const loadAll = useCallback(
    async ({ silent = false } = {}) => {
      if (
        !supabaseUrl ||
        !supabaseAnonKey ||
        !accessToken
      ) {
        setLoading(false);
        return;
      }

      if (silent) setRefreshing(true);
      else setLoading(true);

      try {
        const [
          tariffResult,
          settingsResult,
          imAccountsResult,
          accountsResult,
          modeResult,
        ] = await Promise.all([
          restGet(
            "payment_tariff_bands?select=*&order=payment_method.asc,min_amount.asc",
            "Unable to load tariffs."
          ),
          restGet(
            "payment_system_settings?id=eq.1&select=*",
            "Unable to load settings."
          ),
          restGet(
            "im_payment_accounts?select=*&order=is_active.desc,updated_at.desc",
            "Unable to load I&M account."
          ),
          callRpc(
            "tl_admin_shop_payment_snapshot",
            {}
          ),
          callRpc(
            "tl_banking_mode_snapshot",
            {}
          ),
        ]);

        if (!Array.isArray(accountsResult)) {
          throw new Error(
            "Unable to load shop payment accounts."
          );
        }

        const tariffRows = Array.isArray(tariffResult)
          ? tariffResult
          : [];

        setRows(
          tariffRows.map((t) => ({
            ...t,
            _key: String(t.id),
            _new: false,
          }))
        );

        setRemovedIds([]);
        setChanged(false);

        const settings = Array.isArray(settingsResult)
          ? settingsResult[0]
          : null;

        setPaymentSettings({
          collection_method:
            settings?.collection_method ||
            "MPESA_TO_MPESA",
          float_send_method:
            settings?.float_send_method ||
            "MPESA_TO_MPESA",
        });

        const imRows = Array.isArray(imAccountsResult)
          ? imAccountsResult
          : [];

        const im =
          imRows.find((r) => r.is_active) ||
          imRows[0] ||
          null;

        setImAccount(
          im
            ? {
                id: im.id,
                account_name:
                  im.account_name ||
                  "Team Legend I&M",
                paybill_number:
                  im.paybill_number || "",
                account_number:
                  im.account_number || "",
                default_reference:
                  im.default_reference || "",
                is_active:
                  im.is_active !== false,
              }
            : { ...EMPTY_IM_ACCOUNT }
        );

        const mode = Array.isArray(modeResult)
          ? modeResult[0]
          : modeResult;

        setBankingMode(
          mode?.mode === "AUTOMATIC"
            ? "AUTOMATIC"
            : "MANUAL"
        );

        setAutomaticReady(
          mode?.automatic_ready === true
        );

        setRecipients(
          accountsResult.map((row) => ({
            ...row,
            phone_number: String(
              row.phone_number || ""
            ),
            im_reference: String(
              row.im_reference || ""
            ),
            allow_mpesa_to_mpesa:
              row.allow_mpesa_to_mpesa !== false,
            allow_im_to_mpesa:
              row.allow_im_to_mpesa !== false,
          }))
        );
      } catch (error) {
        console.error(
          "LOAD PAYMENT ADMIN ERROR:",
          error
        );

        showError(
          error?.message ||
            "Unable to load payment settings."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      supabaseUrl,
      supabaseAnonKey,
      accessToken,
      restGet,
      callRpc,
    ]
  );

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

  function updateRecipientField(
    shopId,
    field,
    value
  ) {
    setRecipients((previous) =>
      previous.map((recipient) =>
        String(recipient.shop_id) === String(shopId)
          ? {
              ...recipient,
              [field]: value,
            }
          : recipient
      )
    );
  }

  async function saveRecipientRecord(recipient) {
    const shopId = String(
      recipient.shop_id || ""
    );

    const phone = String(
      recipient.phone_number || ""
    ).trim();

    if (!shopId) {
      return showError("Select shop.");
    }

    if (!phone) {
      return showError(
        "Enter shop M-Pesa number."
      );
    }

    try {
      setSavingRecipientId(shopId);
      setMessage("");

      await callRpc(
        "tl_admin_shop_payment_save",
        {
          p_shop_id: shopId,
          p_phone_number: phone,
          p_im_reference:
            String(
              recipient.im_reference || ""
            ).trim() || null,
          p_allow_mpesa_to_mpesa:
            recipient.allow_mpesa_to_mpesa !==
            false,
          p_allow_im_to_mpesa:
            recipient.allow_im_to_mpesa !==
            false,
        }
      );

      setMessage(
        "Shop payment account saved."
      );
      setMessageType("success");

      await loadAll({ silent: true });
    } catch (error) {
      showError(
        error?.message ||
          "Unable to save shop account."
      );
    } finally {
      setSavingRecipientId("");
    }
  }

  async function disableRecipient(recipient) {
    const shopId = String(
      recipient.shop_id || ""
    );

    if (
      !shopId ||
      !window.confirm(
        `Remove active payment number for ${recipient.shop_name}?`
      )
    ) {
      return;
    }

    try {
      setDeletingRecipientId(shopId);

      await callRpc(
        "tl_admin_shop_payment_disable",
        {
          p_shop_id: shopId,
        }
      );

      setMessage(
        "Shop payment account removed."
      );
      setMessageType("success");

      await loadAll({ silent: true });
    } catch (error) {
      showError(
        error?.message ||
          "Unable to remove shop account."
      );
    } finally {
      setDeletingRecipientId("");
    }
  }

  // SINGLE FEE TABLE — FOUR ROUTES

  const visibleRows = useMemo(
    () =>
      rows
        .filter(
          (r) =>
            r.payment_method === route &&
            !removedIds.includes(
              String(r.id)
            )
        )
        .sort(
          (a, b) =>
            Number(a.min_amount) -
            Number(b.min_amount)
        ),
    [rows, route, removedIds]
  );

  function updateRow(key, field, value) {
    setRows((old) =>
      old.map((r) =>
        r._key === key
          ? { ...r, [field]: value }
          : r
      )
    );

    setChanged(true);
    setTestResult(null);
  }

  function addRow() {
    const key =
      `new-${Date.now()}-` +
      Math.random().toString(36).slice(2);

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
    if (
      !window.confirm(
        "Remove this fee band when you save changes?"
      )
    ) {
      return;
    }

    if (row._new) {
      setRows((old) =>
        old.filter(
          (r) =>
            r._key !== row._key
        )
      );
    } else {
      setRemovedIds((old) => [
        ...new Set([
          ...old,
          String(row.id),
        ]),
      ]);
    }

    setChanged(true);
    setTestResult(null);
  }

  function setSetting(key, value) {
    setPaymentSettings((old) => ({
      ...old,
      [key]: value,
    }));

    setChanged(true);
  }

  function setIm(key, value) {
    setImAccount((old) => ({
      ...old,
      [key]: value,
    }));

    setChanged(true);
  }

  function validateRows() {
    for (const r of rows) {
      if (
        r.id &&
        removedIds.includes(
          String(r.id)
        )
      ) {
        continue;
      }

      if (
        !ROUTES.some(
          (option) =>
            option.id === r.payment_method
        )
      ) {
        throw new Error(
          "Unknown payment route."
        );
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
        Math.round(min * 100) !==
          min * 100 ||
        Math.round(max * 100) !==
          max * 100 ||
        Math.round(fee * 100) !==
          fee * 100
      ) {
        throw new Error(
          "Enter valid Min, Max and Fee values (two decimal places maximum)."
        );
      }
    }

    for (const option of ROUTES) {
      const active = rows
        .filter(
          (r) =>
            r.payment_method === option.id &&
            r.is_active !== false &&
            !(
              r.id &&
              removedIds.includes(
                String(r.id)
              )
            )
        )
        .sort(
          (a, b) =>
            Number(a.min_amount) -
            Number(b.min_amount)
        );

      if (!active.length) {
        throw new Error(
          `Missing active rates: ${option.label}.`
        );
      }

      if (
        Number(active[0].min_amount) !== 1
      ) {
        throw new Error(
          `${option.label}: first band must start at KES 1.`
        );
      }

      for (
        let i = 1;
        i < active.length;
        i++
      ) {
        const previousMax = Number(
          active[i - 1].max_amount
        );

        const nextMin = Number(
          active[i].min_amount
        );

        if (
          Math.abs(
            nextMin -
              previousMax -
              0.01
          ) > 0.000001
        ) {
          throw new Error(
            `${option.label}: overlapping or missing fee ranges.`
          );
        }
      }
    }
  }

  // SAVE ALL CHANGES WITH ONE REASON

  async function saveAll() {
    if (busy) return;

    try {
      if (!changed) {
        throw new Error(
          "No changes to save."
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
          "Automatic Banking is not yet connected."
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

      if (
        !window.confirm(
          "Save the payment settings and fee changes?"
        )
      ) {
        return;
      }

      setBusy(true);
      setMessage("");

      // Requires the atomic Supabase backend function.
      await callRpc(
        "tl_admin_payment_routes_save_all",
        {
          p_bands: rows.map((r) => ({
            id: r.id || null,
            payment_method:
              r.payment_method,
            min_amount:
              Number(r.min_amount),
            max_amount:
              Number(r.max_amount),
            fee: Number(r.fee),
            is_active:
              r.is_active !== false,
          })),
          p_removed_ids: removedIds,
          p_payment_settings:
            paymentSettings,
          p_im_account: imAccount,
          p_banking_mode: bankingMode,
          p_reason: reason.trim(),
        }
      );

      setReason("");
      updateMessage(
        "Payment settings saved."
      );

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

  // FEE TEST

  async function testFee() {
    const amount = Number(testAmount);

    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      testAmount === ""
    ) {
      showError(
        "Enter a valid amount."
      );
      return;
    }

    try {
      setTesting(true);

      const value = await callRpc(
        "tl_payment_fee_for_amount",
        {
          p_payment_method: route,
          p_amount:
            Math.round(amount * 100) / 100,
        }
      );

      setTestResult(Number(value));
    } catch (error) {
      showError(
        error?.message ||
          "Unable to calculate fee."
      );
    } finally {
      setTesting(false);
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
    <div
      className="tl-payment-admin"
      style={wrapperStyle}
    >
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
        <strong>
          BANKING & PAYMENT SETTINGS
        </strong>

        <button
          type="button"
          onClick={() => {
            if (
              changed &&
              !window.confirm(
                "Discard unsaved changes?"
              )
            ) {
              return;
            }

            loadAll({ silent: true });
          }}
          disabled={refreshing || busy}
          style={refreshButtonStyle}
        >
          {refreshing
            ? "REFRESHING..."
            : "REFRESH ALL"}
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
          <span>
            SHOP PAYMENT ACCOUNTS
          </span>

          <span aria-hidden="true">
            ▾
          </span>
        </summary>

        <div style={bodyStyle}>
          <div style={cashierWrapStyle}>
            <div style={cashierHeaderStyle}>
              <div
                style={{ textAlign: "left" }}
              >
                SHOP
              </div>

              <div
                style={{ textAlign: "left" }}
              >
                CASHIER — DUTY ROTA
              </div>

              <div
                style={{ textAlign: "left" }}
              >
                M-PESA
              </div>

              <div
                style={{ textAlign: "left" }}
              >
                I&M REF
              </div>

              <div
                style={{ textAlign: "center" }}
              >
                M→M
              </div>

              <div
                style={{ textAlign: "center" }}
              >
                I&M→M
              </div>

              <div
                style={{ textAlign: "center" }}
              >
                SAVE
              </div>

              <div
                style={{ textAlign: "center" }}
              >
                REMOVE
              </div>
            </div>

            {sortedRecipients.map(
              (recipient) => (
                <div
                  key={recipient.shop_id}
                  style={cashierRowStyle}
                >
                  <strong>
                    {recipient.shop_name}
                  </strong>

                  <div style={dutyNameStyle}>
                    {recipient.cashier_name ||
                      "NOT ASSIGNED"}
                  </div>

                  <input
                    type="tel"
                    value={
                      recipient.phone_number ||
                      ""
                    }
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
                    value={
                      recipient.im_reference ||
                      ""
                    }
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
                      recipient.allow_mpesa_to_mpesa !==
                      false
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
                      recipient.allow_im_to_mpesa !==
                      false
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
                      saveRecipientRecord(
                        recipient
                      )
                    }
                    disabled={
                      savingRecipientId ===
                      String(
                        recipient.shop_id
                      )
                    }
                    style={saveButtonStyle}
                  >
                    {savingRecipientId ===
                    String(
                      recipient.shop_id
                    )
                      ? "SAVING..."
                      : "SAVE"}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      disableRecipient(
                        recipient
                      )
                    }
                    disabled={
                      deletingRecipientId ===
                      String(
                        recipient.shop_id
                      )
                    }
                    style={deleteButtonStyle}
                  >
                    {deletingRecipientId ===
                    String(
                      recipient.shop_id
                    )
                      ? "REMOVING..."
                      : "REMOVE"}
                  </button>
                </div>
              )
            )}
          </div>
        </div>
      </details>
{/* ONE PAYMENT ROUTE AT A TIME */}

      <section style={panelStyle}>
        <div style={sectionTitle}>
          PAYMENT RATES
        </div>

        <div style={bodyStyle}>
          <div style={formGrid}>
            <Field label="PAYMENT METHOD">
              <select
                style={inputStyle}
                value={route}
                onChange={(event) => {
                  setRoute(
                    event.target.value
                  );
                  setTestResult(null);
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
              >
                + ADD FEE BAND
              </button>
            </div>
          </div>

          {/* ONE EDITABLE FEE TABLE */}

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
                  value={r.min_amount}
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
                  checked={
                    r.is_active !== false
                  }
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
                  onClick={() =>
                    removeRow(r)
                  }
                  style={deleteButtonStyle}
                >
                  REMOVE
                </button>
              </div>
            ))}
          </div>

          {/* I&M COMPANY ACCOUNT */}

          {route === "MPESA_TO_IM" && (
            <div style={subPanelStyle}>
              <strong>
                I&M COMPANY ACCOUNT
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

                <Field label="DEFAULT REFERENCE">
                  <input
                    style={inputStyle}
                    value={
                      imAccount.default_reference
                    }
                    onChange={(event) =>
                      setIm(
                        "default_reference",
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

          {/* MANUAL / AUTOMATIC BANKING */}

          {route ===
            "MPESA_TO_CONSOLIDATED" && (
            <div style={subPanelStyle}>
              <strong>
                BANKING MODE — SAME CHARGES FOR BOTH MODES
              </strong>

              <div style={formGrid}>
                <Field label="CONFIRMATION MODE">
                  <select
                    style={inputStyle}
                    value={bankingMode}
                    onChange={(event) => {
                      setBankingMode(
                        event.target.value
                      );
                      setChanged(true);
                    }}
                  >
                    <option value="MANUAL">
                      MANUAL (ANONYMOUS REFERENCE)
                    </option>

                    <option
                      value="AUTOMATIC"
                      disabled={
                        !automaticReady
                      }
                    >
                      AUTOMATIC
                      {!automaticReady
                        ? " — BANK INTEGRATION PENDING"
                        : ""}
                    </option>
                  </select>
                </Field>
              </div>
            </div>
          )}

          {/* PAYMENT ROUTING */}

          <div style={subPanelStyle}>
            <strong>
              PAYMENT ROUTES
            </strong>

            <div style={formGrid}>
              <Field label="MONEY RECEIVED FROM CASHIERS">
                <select
                  style={inputStyle}
                  value={
                    paymentSettings.collection_method
                  }
                  onChange={(event) =>
                    setSetting(
                      "collection_method",
                      event.target.value
                    )
                  }
                >
                  <option value="MPESA_TO_MPESA">
                    M-PESA → M-PESA
                  </option>

                  <option value="MPESA_TO_IM">
                    M-PESA → I&M
                  </option>
                </select>
              </Field>

              <Field label="FLOAT SENT TO CASHIERS">
                <select
                  style={inputStyle}
                  value={
                    paymentSettings.float_send_method
                  }
                  onChange={(event) =>
                    setSetting(
                      "float_send_method",
                      event.target.value
                    )
                  }
                >
                  <option value="MPESA_TO_MPESA">
                    M-PESA → M-PESA
                  </option>

                  <option value="IM_TO_MPESA">
                    I&M → M-PESA
                  </option>
                </select>
              </Field>
            </div>
          </div>

          {/* FEE CALCULATOR */}

          <div style={subPanelStyle}>
            <strong>
              FEE TEST
            </strong>

            <div style={formGrid}>
              <Field label="AMOUNT (KES)">
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  style={inputStyle}
                  value={testAmount}
                  onChange={(event) => {
                    setTestAmount(
                      event.target.value
                    );
                    setTestResult(null);
                  }}
                />
              </Field>

              <Field label="SAVED TARIFF FEE">
                <div style={feeResultStyle}>
                  {testResult === null
                    ? "—"
                    : `KES ${money(testResult)}`}
                </div>
              </Field>
            </div>

            <button
              type="button"
              style={outlineButton}
              onClick={testFee}
              disabled={testing}
            >
              {testing
                ? "TESTING..."
                : "TEST FEE"}
            </button>
          </div>

          {/* SINGLE REASON */}

          <Field label="ONE REASON FOR ALL CHANGES">
            <textarea
              rows={2}
              style={textareaStyle}
              placeholder="Reason for changes"
              value={reason}
              onChange={(event) =>
                setReason(
                  event.target.value
                )
              }
            />
          </Field>

          {/* SINGLE SAVE BUTTON */}

          <button
            type="button"
            style={saveAllButton}
            disabled={busy || !changed}
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

// COMPONENT HELPERS

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

function CenterCheck({
  checked,
  onChange,
}) {
  return (
    <div style={centerStyle}>
      <input
        type="checkbox"
        checked={Boolean(checked)}
        onChange={(event) =>
          onChange(
            event.target.checked
          )
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

function money(value) {
  return Number(value || 0).toLocaleString(
    "en-KE",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  );
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
  borderBottom: "1px solid #e2e8f0",
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

const feeResultStyle = {
  padding: 10,
  borderRadius: 5,
  background: "#ecfdf5",
  color: "#166534",
  fontWeight: 900,
  border: "1px solid #86efac",
};

// ORIGINAL SHOP PAYMENT ACCOUNTS STYLES

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
  gridTemplateColumns: cashierColumns,
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
  gridTemplateColumns: cashierColumns,
  gap: "5px",
  minWidth: "940px",
  padding: "7px",
  borderTop: "1px solid #e2e8f0",
  alignItems: "center",
  fontSize: "11px",
};

const dutyNameStyle = {
  fontSize: "11px",
  fontWeight: "700",
  overflowWrap: "anywhere",
};
