"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const accessToken = user?.access_token || null;

  const authHeaders = useMemo(() => ({
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  }), [supabaseAnonKey, accessToken]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  useEffect(() => {
    if (!message) return;

    const timer = setTimeout(() => {
      setMessage("");
      setMessageType("");
    }, 5000);

    return () => clearTimeout(timer);
  }, [message, messageType]);

  const [paymentSettings, setPaymentSettings] = useState({
    collection_method: "MPESA_TO_MPESA",
    float_send_method: "MPESA_TO_MPESA",
  });
  const [savingPaymentSystem, setSavingPaymentSystem] = useState(false);

  const [imAccount, setImAccount] = useState(EMPTY_IM_ACCOUNT);
  const [savingImAccount, setSavingImAccount] = useState(false);

  const [paymentTariffs, setPaymentTariffs] = useState([]);
  const [newPaymentMethod, setNewPaymentMethod] = useState("MPESA_TO_IM");
  const [newPaymentMin, setNewPaymentMin] = useState("");
  const [newPaymentMax, setNewPaymentMax] = useState("");
  const [newPaymentFee, setNewPaymentFee] = useState("");
  const [addingPaymentTariff, setAddingPaymentTariff] = useState(false);
  const [savingPaymentTariffId, setSavingPaymentTariffId] = useState("");
  const [deletingPaymentTariffId, setDeletingPaymentTariffId] = useState("");
  const [paymentTestMethod, setPaymentTestMethod] = useState("MPESA_TO_IM");
  const [paymentTestAmount, setPaymentTestAmount] = useState("");
  const [paymentTestResult, setPaymentTestResult] = useState(null);
  const [testingPaymentFee, setTestingPaymentFee] = useState(false);

  const [recipients, setRecipients] = useState([]);
  const [savingRecipientId, setSavingRecipientId] = useState("");
  const [deletingRecipientId, setDeletingRecipientId] = useState("");

  const [rates, setRates] = useState([]);
  const [savingId, setSavingId] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [adding, setAdding] = useState(false);
  const [testing, setTesting] = useState(false);
  const [newFlow, setNewFlow] = useState("");
  const [newMinimum, setNewMinimum] = useState("");
  const [newMaximum, setNewMaximum] = useState("");
  const [newFee, setNewFee] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(getNairobiDate());
  const [effectiveTo, setEffectiveTo] = useState("");
  const [newNote, setNewNote] = useState("");
  const [testFeeType, setTestFeeType] = useState("");
  const [testAmount, setTestAmount] = useState("");
  const [testResult, setTestResult] = useState(null);

  function showError(text) {
    setMessage(text);
    setMessageType("error");
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

  // ==================================================
  // LOAD PAYMENT SETTINGS, TARIFFS AND SHOP ACCOUNTS
  // ==================================================

  const loadAll = useCallback(async ({ silent = false } = {}) => {
    if (!supabaseUrl || !supabaseAnonKey || !accessToken) {
      setLoading(false);
      return;
    }

    if (silent) setRefreshing(true);
    else setLoading(true);

    try {
      if (!silent) {
        setMessage("");
        setMessageType("");
      }

      const [
        mpesaRatesResult,
        settingsResult,
        imAccountsResult,
        tariffResult,
        accountsResult,
      ] = await Promise.all([
        callRpc("tl_admin_mpesa_fee_rates", {}),
        restGet(
          "payment_system_settings?id=eq.1&select=*",
          "Unable to load payment settings."
        ),
        restGet(
          "im_payment_accounts?select=*&order=is_active.desc,updated_at.desc",
          "Unable to load I&M account."
        ),
        restGet(
          "payment_tariff_bands?select=*&order=payment_method.asc,min_amount.asc",
          "Unable to load payment tariffs."
        ),
        callRpc("tl_admin_shop_payment_snapshot", {}),
      ]);

      const loadedRates = normaliseRates(mpesaRatesResult);
      setRates(loadedRates);
      setTestFeeType(
        (current) => current || getRateType(loadedRates[0]) || ""
      );

      const settingsRow = Array.isArray(settingsResult)
        ? settingsResult[0]
        : null;

      if (settingsRow) {
        setPaymentSettings({
          collection_method:
            settingsRow.collection_method || "MPESA_TO_MPESA",
          float_send_method:
            settingsRow.float_send_method || "MPESA_TO_MPESA",
        });
      }

      const imRows = Array.isArray(imAccountsResult)
        ? imAccountsResult
        : [];

      const selectedIm = imRows.find((row) => row?.is_active) ||
        imRows[0] || null;

      if (selectedIm) {
        setImAccount({
          id: selectedIm.id,
          account_name: selectedIm.account_name || "Team Legend I&M",
          paybill_number: selectedIm.paybill_number || "",
          account_number: selectedIm.account_number || "",
          default_reference: selectedIm.default_reference || "",
          is_active: selectedIm.is_active !== false,
        });
      } else {
        setImAccount(EMPTY_IM_ACCOUNT);
      }

      setPaymentTariffs(
        Array.isArray(tariffResult) ? tariffResult : []
      );

      if (!Array.isArray(accountsResult)) {
        throw new Error("Unable to load shop payment accounts.");
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
      setMessage(
        error?.message || "Unable to load payment administration."
      );
      setMessageType("error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [
    supabaseUrl,
    supabaseAnonKey,
    accessToken,
    callRpc,
    restGet,
  ]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ==================================================
  // PAYMENT SYSTEM
  // ==================================================

  async function savePaymentSystem() {
    const confirmed = window.confirm(
      "CHANGE PAYMENT SYSTEM\n\n" +
      `Cashier returns: ${methodLabel(paymentSettings.collection_method)}\n` +
      `Float sending: ${methodLabel(paymentSettings.float_send_method)}\n\n` +
      "Apply this to new transactions?"
    );
    if (!confirmed) return;

    try {
      setSavingPaymentSystem(true);
      setMessage("");

      const result = await callRpc("tl_admin_set_payment_system", {
        p_collection_method: paymentSettings.collection_method,
        p_float_send_method: paymentSettings.float_send_method,
      });

      setPaymentSettings({
        collection_method:
          result?.collection_method || paymentSettings.collection_method,
        float_send_method:
          result?.float_send_method || paymentSettings.float_send_method,
      });

      setMessage("Payment system saved successfully.");
      setMessageType("success");
    } catch (error) {
      showError(error?.message || "Unable to save payment system.");
    } finally {
      setSavingPaymentSystem(false);
    }
  }

  // ==================================================
  // I&M ACCOUNT
  // ==================================================

  async function saveImAccount() {
    const accountName = String(imAccount.account_name || "").trim();
    const paybill = String(imAccount.paybill_number || "").trim();
    const accountNumber = String(imAccount.account_number || "").trim();

    if (!accountName) return showError("Enter the I&M account name.");
    if (!paybill && !accountNumber) {
      return showError("Enter the I&M Paybill or account number.");
    }

    try {
      setSavingImAccount(true);
      setMessage("");

      const result = await callRpc("tl_admin_save_im_payment_account", {
        p_id: imAccount.id || null,
        p_account_name: accountName,
        p_paybill_number: paybill || null,
        p_account_number: accountNumber || null,
        p_default_reference:
          String(imAccount.default_reference || "").trim() || null,
        p_is_active: imAccount.is_active !== false,
      });

      setImAccount((current) => ({
        ...current,
        id: result?.id || current.id,
      }));
      setMessage("I&M account saved successfully.");
      setMessageType("success");
      await loadAll({ silent: true });
    } catch (error) {
      showError(error?.message || "Unable to save I&M account.");
    } finally {
      setSavingImAccount(false);
    }
  }

  // ==================================================
  // I&M TARIFF BANDS
  // ==================================================

  function updatePaymentTariffField(id, field, value) {
    setPaymentTariffs((previous) => previous.map((row) =>
      String(row.id) === String(id)
        ? { ...row, [field]: value }
        : row
    ));
  }

  async function savePaymentTariff(row) {
    const minAmount = Number(row.min_amount);
    const maxAmount = Number(row.max_amount);
    const fee = Number(row.fee);

    if (!Number.isFinite(minAmount) || minAmount < 0) {
      return showError("Enter a valid minimum amount.");
    }
    if (!Number.isFinite(maxAmount) || maxAmount < minAmount) {
      return showError("Maximum must be equal to or higher than minimum.");
    }
    if (!Number.isFinite(fee) || fee < 0) {
      return showError("Enter a valid fee.");
    }

    try {
      setSavingPaymentTariffId(String(row.id));
      setMessage("");

      await callRpc("tl_admin_save_payment_tariff_band", {
        p_id: row.id,
        p_payment_method: row.payment_method,
        p_min_amount: roundMoney(minAmount),
        p_max_amount: roundMoney(maxAmount),
        p_fee: roundMoney(fee),
        p_is_active: row.is_active !== false,
      });

      setMessage("Payment tariff saved.");
      setMessageType("success");
      await loadAll({ silent: true });
    } catch (error) {
      showError(error?.message || "Unable to save tariff.");
    } finally {
      setSavingPaymentTariffId("");
    }
  }

  async function addPaymentTariffBand() {
    const minAmount = Number(newPaymentMin);
    const maxAmount = Number(newPaymentMax);
    const fee = Number(newPaymentFee);

    if (newPaymentMin === "" || !Number.isFinite(minAmount)) {
      return showError("Enter the minimum amount.");
    }
    if (
      newPaymentMax === "" ||
      !Number.isFinite(maxAmount) ||
      maxAmount < minAmount
    ) {
      return showError("Enter a valid maximum amount.");
    }
    if (newPaymentFee === "" || !Number.isFinite(fee) || fee < 0) {
      return showError("Enter a valid fee.");
    }

    try {
      setAddingPaymentTariff(true);
      setMessage("");

      await callRpc("tl_admin_save_payment_tariff_band", {
        p_id: null,
        p_payment_method: newPaymentMethod,
        p_min_amount: roundMoney(minAmount),
        p_max_amount: roundMoney(maxAmount),
        p_fee: roundMoney(fee),
        p_is_active: true,
      });

      setNewPaymentMin("");
      setNewPaymentMax("");
      setNewPaymentFee("");
      setMessage("Payment tariff band added.");
      setMessageType("success");
      await loadAll({ silent: true });
    } catch (error) {
      showError(error?.message || "Unable to add tariff band.");
    } finally {
      setAddingPaymentTariff(false);
    }
  }

  async function deletePaymentTariff(row) {
    if (!window.confirm(
      `Delete ${methodLabel(row.payment_method)} band KES ` +
      `${money(row.min_amount)} - ${money(row.max_amount)}?`
    )) return;

    try {
      setDeletingPaymentTariffId(String(row.id));

      const response = await fetch(
        `${supabaseUrl}/rest/v1/payment_tariff_bands` +
        `?id=eq.${encodeURIComponent(row.id)}`,
        {
          method: "DELETE",
          headers: { ...authHeaders, Prefer: "return=minimal" },
          cache: "no-store",
        }
      );

      const result = await safeJson(response);
      if (!response.ok) {
        throw new Error(
          result?.message || result?.details || "Unable to delete tariff."
        );
      }

      setMessage("Payment tariff deleted.");
      setMessageType("success");
      await loadAll({ silent: true });
    } catch (error) {
      showError(error?.message || "Unable to delete tariff.");
    } finally {
      setDeletingPaymentTariffId("");
    }
  }

  async function testPaymentFee() {
    const amount = Number(paymentTestAmount);
    if (paymentTestAmount === "" || !Number.isFinite(amount)) {
      return showError("Enter an amount to test.");
    }

    try {
      setTestingPaymentFee(true);
      setPaymentTestResult(null);

      const result = await callRpc("tl_payment_fee_for_amount", {
        p_payment_method: paymentTestMethod,
        p_amount: roundMoney(amount),
      });
      setPaymentTestResult(extractNumericResult(result));
    } catch (error) {
      showError(error?.message || "Unable to test fee.");
    } finally {
      setTestingPaymentFee(false);
    }
  }

  // ==================================================
  // SHOP PAYMENT ACCOUNTS
  // ==================================================

  const sortedRecipients = useMemo(() => {
    return [...recipients].sort((a, b) =>
      String(a.shop_name || "").localeCompare(String(b.shop_name || ""))
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

  // ==================================================
  // M-PESA FEE RATES
  // ==================================================

  function updateRateField(id, field, value) {
    setRates((previous) => previous.map((rate) =>
      String(rate.id) === String(id)
        ? { ...rate, [field]: value }
        : rate
    ));
  }

  async function saveRate(rate) {
    const feeType = String(getRateType(rate)).trim().toUpperCase();
    const minAmount = Number(getMinimum(rate));
    const maxAmount = Number(getMaximum(rate));
    const fee = Number(getFee(rate));

    if (!feeType) return showError("Fee type is required.");

    try {
      setSavingId(String(rate.id));

      await callRpc("tl_admin_save_mpesa_fee_rate", {
        p_id: rate.id,
        p_fee_type: feeType,
        p_min_amount: roundMoney(minAmount),
        p_max_amount: roundMoney(maxAmount),
        p_fee: roundMoney(fee),
        p_is_active: getIsActive(rate),
      });

      setMessage("M-Pesa rate saved.");
      setMessageType("success");
      await loadAll({ silent: true });
    } catch (error) {
      showError(error?.message || "Unable to save M-Pesa rate.");
    } finally {
      setSavingId("");
    }
  }

  async function deleteRate(rate) {
    if (!window.confirm("Delete this M-Pesa rate?")) return;

    try {
      setDeletingId(String(rate.id));
      await callRpc("tl_admin_delete_mpesa_fee_rate", {
        p_id: rate.id,
      });

      setMessage("M-Pesa rate deleted.");
      setMessageType("success");
      await loadAll({ silent: true });
    } catch (error) {
      showError(error?.message || "Unable to delete M-Pesa rate.");
    } finally {
      setDeletingId("");
    }
  }

  async function addBand() {
    const flow = String(newFlow || "").trim().toUpperCase();
    const minimum = Number(newMinimum);
    const maximum = Number(newMaximum);
    const fee = Number(newFee);

    if (!flow) return showError("Enter M-Pesa fee type.");
    if (newMinimum === "" || !Number.isFinite(minimum)) {
      return showError("Enter minimum amount.");
    }
    if (
      newMaximum === "" ||
      !Number.isFinite(maximum) ||
      maximum < minimum
    ) {
      return showError("Enter valid maximum amount.");
    }
    if (newFee === "" || !Number.isFinite(fee)) {
      return showError("Enter M-Pesa fee.");
    }

    try {
      setAdding(true);

      await callRpc("tl_admin_add_mpesa_fee_band", {
        p_flow: flow,
        p_minimum_amount: roundMoney(minimum),
        p_maximum_amount: roundMoney(maximum),
        p_fee_amount: roundMoney(fee),
        p_effective_from: effectiveFrom,
        p_effective_to: effectiveTo || null,
        p_note: String(newNote || "").trim() || null,
      });

      setNewMinimum("");
      setNewMaximum("");
      setNewFee("");
      setEffectiveTo("");
      setNewNote("");
      setMessage("M-Pesa band added.");
      setMessageType("success");
      await loadAll({ silent: true });
    } catch (error) {
      showError(error?.message || "Unable to add M-Pesa band.");
    } finally {
      setAdding(false);
    }
  }

  async function testFee() {
    const amount = Number(testAmount);
    if (testAmount === "" || !Number.isFinite(amount)) {
      return showError("Enter test amount.");
    }

    try {
      setTesting(true);
      setTestResult(null);

      const result = await callRpc("tl_mpesa_fee_for_amount", {
        p_fee_type: String(testFeeType || "").trim().toUpperCase(),
        p_amount: roundMoney(amount),
      });

      setTestResult(extractNumericResult(result));
    } catch (error) {
      showError(error?.message || "Unable to test M-Pesa fee.");
    } finally {
      setTesting(false);
    }
  }

  const feeTypes = useMemo(
    () => [...new Set(rates.map(getRateType).filter(Boolean))],
    [rates]
  );

  if (loading) {
    return (
      <div style={loadingStyle}>
        Loading payment administration...
      </div>
    );
  }

  return (
    <div className="tl-payment-admin" style={wrapperStyle}>
      <style>{`
        .tl-payment-admin details > summary::-webkit-details-marker {
          display: none;
        }
        .tl-payment-admin input[type="number"] {
          appearance: textfield;
          -moz-appearance: textfield;
        }
        .tl-payment-admin input[type="number"]::-webkit-inner-spin-button,
        .tl-payment-admin input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
      `}</style>

      <section style={heroStyle}>
        <div style={heroTitleStyle}>
          BANKING & PAYMENT SETTINGS
        </div>

        <button
          type="button"
          onClick={() => loadAll({ silent: true })}
          disabled={refreshing}
          style={refreshButtonStyle}
        >
          {refreshing ? "REFRESHING..." : "REFRESH ALL"}
        </button>
      </section>

      {message && (
        <div
          role={messageType === "error" ? "alert" : "status"}
          style={{
            ...messageStyle,
            backgroundColor:
              messageType === "success" ? "#ecfdf5" : "#fef2f2",
            color:
              messageType === "success" ? "#166534" : "#991b1b",
            border:
              messageType === "success"
                ? "1px solid #86efac"
                : "1px solid #fecaca",
          }}
        >
          {message}
        </div>
      )}

      <details style={dropdownStyle}>
        <summary style={{ ...cashierTitleStyle, ...dropdownHeadingStyle }}>
          <span>SHOP PAYMENT ACCOUNTS</span>
          <span aria-hidden="true">▾</span>
        </summary>

        <div style={bodyStyle}>
          <div style={cashierWrapStyle}>
            <div style={cashierHeaderStyle}>
              <div style={{ textAlign: "left" }}>SHOP</div>
              <div style={{ textAlign: "left" }}>CASHIER — DUTY ROTA</div>
              <div style={{ textAlign: "left" }}>M-PESA</div>
              <div style={{ textAlign: "left" }}>I&M REF</div>
              <div style={{ textAlign: "center" }}>M→M</div>
              <div style={{ textAlign: "center" }}>I&M→M</div>
              <div style={{ textAlign: "center" }}>SAVE</div>
              <div style={{ textAlign: "center" }}>REMOVE</div>
            </div>

            {sortedRecipients.map((recipient) => (
              <div key={recipient.shop_id} style={cashierRowStyle}>
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
                  checked={recipient.allow_mpesa_to_mpesa !== false}
                  onChange={(checked) =>
                    updateRecipientField(
                      recipient.shop_id,
                      "allow_mpesa_to_mpesa",
                      checked
                    )
                  }
                />

                <CenterCheck
                  checked={recipient.allow_im_to_mpesa !== false}
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
                  onClick={() => saveRecipientRecord(recipient)}
                  disabled={savingRecipientId === String(recipient.shop_id)}
                  style={saveButtonStyle}
                >
                  {savingRecipientId === String(recipient.shop_id)
                    ? "SAVING..." : "SAVE"}
                </button>

                <button
                  type="button"
                  onClick={() => disableRecipient(recipient)}
                  disabled={deletingRecipientId === String(recipient.shop_id)}
                  style={deleteButtonStyle}
                >
                  {deletingRecipientId === String(recipient.shop_id)
                    ? "REMOVING..." : "REMOVE"}
                </button>
              </div>
            ))}
          </div>
        </div>
      </details>

      <details style={dropdownStyle}>
        <summary style={{ ...darkTitleStyle, ...dropdownHeadingStyle }}>
          <span>PAYMENT SYSTEM</span>
          <span aria-hidden="true">▾</span>
        </summary>

        <div style={bodyStyle}>
          <div style={systemGridStyle}>
            <PaymentMethodBox
              title="MONEY RECEIVED FROM CASHIERS"
              value={paymentSettings.collection_method}
              options={[
                ["MPESA_TO_MPESA", "M-PESA → M-PESA"],
                ["MPESA_TO_IM", "M-PESA → I&M"],
              ]}
              onChange={(value) =>
                setPaymentSettings((current) => ({
                  ...current,
                  collection_method: value,
                }))
              }
            />

            <PaymentMethodBox
              title="FLOAT SENT TO CASHIERS"
              value={paymentSettings.float_send_method}
              options={[
                ["MPESA_TO_MPESA", "M-PESA → M-PESA"],
                ["IM_TO_MPESA", "I&M → M-PESA"],
              ]}
              onChange={(value) =>
                setPaymentSettings((current) => ({
                  ...current,
                  float_send_method: value,
                }))
              }
            />
          </div>

          <button
            type="button"
            onClick={savePaymentSystem}
            disabled={savingPaymentSystem}
            style={darkButtonStyle}
          >
            {savingPaymentSystem ? "SAVING..." : "SAVE PAYMENT SYSTEM"}
          </button>
        </div>
      </details>

      <details style={dropdownStyle}>
        <summary style={{ ...bankTitleStyle, ...dropdownHeadingStyle }}>
          <span>I&M COMPANY ACCOUNT</span>
          <span aria-hidden="true">▾</span>
        </summary>

        <div style={bodyStyle}>
          <div style={fourGridStyle}>
            <Field label="ACCOUNT NAME">
              <input
                value={imAccount.account_name}
                onChange={(event) =>
                  setImAccount((current) => ({
                    ...current,
                    account_name: event.target.value,
                  }))
                }
                style={inputStyle}
              />
            </Field>

            <Field label="PAYBILL NUMBER">
              <input
                value={imAccount.paybill_number}
                onChange={(event) =>
                  setImAccount((current) => ({
                    ...current,
                    paybill_number: event.target.value,
                  }))
                }
                style={inputStyle}
              />
            </Field>

            <Field label="ACCOUNT NUMBER">
              <input
                value={imAccount.account_number}
                onChange={(event) =>
                  setImAccount((current) => ({
                    ...current,
                    account_number: event.target.value,
                  }))
                }
                style={inputStyle}
              />
            </Field>

            <Field label="DEFAULT REFERENCE">
              <input
                value={imAccount.default_reference}
                onChange={(event) =>
                  setImAccount((current) => ({
                    ...current,
                    default_reference: event.target.value,
                  }))
                }
                style={inputStyle}
              />
            </Field>
          </div>

          <label style={checkboxLineStyle}>
            <input
              type="checkbox"
              checked={imAccount.is_active !== false}
              onChange={(event) =>
                setImAccount((current) => ({
                  ...current,
                  is_active: event.target.checked,
                }))
              }
            />
            Active I&M company account
          </label>

          <button
            type="button"
            onClick={saveImAccount}
            disabled={savingImAccount}
            style={bankButtonStyle}
          >
            {savingImAccount ? "SAVING..." : "SAVE I&M DETAILS"}
          </button>
        </div>
      </details>

      <details style={dropdownStyle}>
        <summary style={{ ...orangeTitleStyle, ...dropdownHeadingStyle }}>
          <span>I&M & M-PESA CHARGES</span>
          <span aria-hidden="true">▾</span>
        </summary>

        <div style={bodyStyle}>
          <div style={paymentAddGridStyle}>
            <Field label="METHOD">
              <select
                value={newPaymentMethod}
                onChange={(event) =>
                  setNewPaymentMethod(event.target.value)
                }
                style={inputStyle}
              >
                <option value="MPESA_TO_IM">M-PESA → I&M</option>
                <option value="IM_TO_MPESA">I&M → M-PESA</option>
              </select>
            </Field>

            <Field label="MINIMUM">
              <input
                type="number"
                value={newPaymentMin}
                onChange={(event) =>
                  setNewPaymentMin(event.target.value)
                }
                style={inputStyle}
              />
            </Field>

            <Field label="MAXIMUM">
              <input
                type="number"
                value={newPaymentMax}
                onChange={(event) =>
                  setNewPaymentMax(event.target.value)
                }
                style={inputStyle}
              />
            </Field>

            <Field label="FEE">
              <input
                type="number"
                value={newPaymentFee}
                onChange={(event) =>
                  setNewPaymentFee(event.target.value)
                }
                style={inputStyle}
              />
            </Field>

            <button
              type="button"
              onClick={addPaymentTariffBand}
              disabled={addingPaymentTariff}
              style={orangeButtonStyle}
            >
              {addingPaymentTariff ? "ADDING..." : "ADD BAND"}
            </button>
          </div>

          <PaymentTariffTable
            title="M-PESA → I&M CHARGES"
            method="MPESA_TO_IM"
            rows={paymentTariffs}
            savingId={savingPaymentTariffId}
            deletingId={deletingPaymentTariffId}
            onChange={updatePaymentTariffField}
            onSave={savePaymentTariff}
            onDelete={deletePaymentTariff}
          />

          <PaymentTariffTable
            title="I&M → M-PESA CHARGES"
            method="IM_TO_MPESA"
            rows={paymentTariffs}
            savingId={savingPaymentTariffId}
            deletingId={deletingPaymentTariffId}
            onChange={updatePaymentTariffField}
            onSave={savePaymentTariff}
            onDelete={deletePaymentTariff}
          />

          <div style={testerPanelStyle}>
            <div style={threeGridStyle}>
              <Field label="TEST METHOD">
                <select
                  value={paymentTestMethod}
                  onChange={(event) => {
                    setPaymentTestMethod(event.target.value);
                    setPaymentTestResult(null);
                  }}
                  style={inputStyle}
                >
                  <option value="MPESA_TO_IM">M-PESA → I&M</option>
                  <option value="IM_TO_MPESA">I&M → M-PESA</option>
                </select>
              </Field>

              <Field label="AMOUNT">
                <input
                  type="number"
                  value={paymentTestAmount}
                  onChange={(event) => {
                    setPaymentTestAmount(event.target.value);
                    setPaymentTestResult(null);
                  }}
                  style={inputStyle}
                />
              </Field>

              <Field label="CALCULATED FEE">
                <div style={feeResultStyle}>
                  KES {money(paymentTestResult ?? 0)}
                </div>
              </Field>
            </div>

            <button
              type="button"
              onClick={testPaymentFee}
              disabled={testingPaymentFee}
              style={blueButtonStyle}
            >
              {testingPaymentFee
                ? "CHECKING..."
                : "TEST BANK PAYMENT FEE"}
            </button>
          </div>
        </div>
      </details>

      <details style={dropdownStyle}>
        <summary style={{ ...greenTitleStyle, ...dropdownHeadingStyle }}>
          <span>M-PESA RATE BANDS & CALCULATOR</span>
          <span aria-hidden="true">▾</span>
        </summary>
<section style={panelStyle}>
          <div style={purpleTitleStyle}>
            ADD NEW M-PESA FEE BAND
          </div>

          <div style={bodyStyle}>
            <div style={fourGridStyle}>
              <Field label="FEE TYPE / FLOW">
                <input
                  list="fee-types"
                  value={newFlow}
                  onChange={(event) =>
                    setNewFlow(event.target.value)
                  }
                  style={inputStyle}
                />
                <datalist id="fee-types">
                  {feeTypes.map((type) => (
                    <option key={type} value={type} />
                  ))}
                </datalist>
              </Field>

              <Field label="MINIMUM AMOUNT">
                <input
                  type="number"
                  value={newMinimum}
                  onChange={(event) =>
                    setNewMinimum(event.target.value)
                  }
                  style={inputStyle}
                />
              </Field>

              <Field label="MAXIMUM AMOUNT">
                <input
                  type="number"
                  value={newMaximum}
                  onChange={(event) =>
                    setNewMaximum(event.target.value)
                  }
                  style={inputStyle}
                />
              </Field>

              <Field label="SAFARICOM FEE">
                <input
                  type="number"
                  value={newFee}
                  onChange={(event) =>
                    setNewFee(event.target.value)
                  }
                  style={inputStyle}
                />
              </Field>
            </div>

            <div style={twoGridStyle}>
              <Field label="EFFECTIVE FROM">
                <input
                  type="date"
                  value={effectiveFrom}
                  onChange={(event) =>
                    setEffectiveFrom(event.target.value)
                  }
                  style={inputStyle}
                />
              </Field>

              <Field label="EFFECTIVE TO">
                <input
                  type="date"
                  value={effectiveTo}
                  onChange={(event) =>
                    setEffectiveTo(event.target.value)
                  }
                  style={inputStyle}
                />
              </Field>
            </div>

            <Field label="ADMIN NOTE">
              <textarea
                value={newNote}
                onChange={(event) =>
                  setNewNote(event.target.value)
                }
                rows={2}
                style={textareaStyle}
              />
            </Field>

            <button
              type="button"
              onClick={addBand}
              disabled={adding}
              style={purpleButtonStyle}
            >
              {adding ? "ADDING..." : "ADD M-PESA RATE"}
            </button>
          </div>
        </section>

        <section style={panelStyle}>
          <div style={greenTitleStyle}>
            CURRENT M-PESA RATE BANDS
          </div>

          {rates.length === 0 ? (
            <div style={emptyStyle}>
              No M-Pesa rate bands were returned.
            </div>
          ) : (
            <>
              <div style={rateHeaderStyle}>
                <div>TYPE</div>
                <div>MIN</div>
                <div>MAX</div>
                <div>FEE</div>
                <div>ACTIVE</div>
                <div>EFFECTIVE</div>
                <div>SAVE</div>
                <div>DELETE</div>
              </div>

              {rates.map((rate, index) => (
                <div
                  key={rate.id || index}
                  style={rateRowStyle}
                >
                  <input
                    value={getRateType(rate)}
                    onChange={(event) =>
                      updateRateField(
                        rate.id,
                        "fee_type",
                        event.target.value
                      )
                    }
                    style={smallInputStyle}
                  />

                  <input
                    type="number"
                    value={getMinimum(rate)}
                    onChange={(event) =>
                      updateRateField(
                        rate.id,
                        "min_amount",
                        event.target.value
                      )
                    }
                    style={smallInputStyle}
                  />

                  <input
                    type="number"
                    value={getMaximum(rate)}
                    onChange={(event) =>
                      updateRateField(
                        rate.id,
                        "max_amount",
                        event.target.value
                      )
                    }
                    style={smallInputStyle}
                  />

                  <input
                    type="number"
                    value={getFee(rate)}
                    onChange={(event) =>
                      updateRateField(
                        rate.id,
                        "fee",
                        event.target.value
                      )
                    }
                    style={smallInputStyle}
                  />

                  <CenterCheck
                    checked={getIsActive(rate)}
                    onChange={(checked) =>
                      updateRateField(
                        rate.id,
                        "is_active",
                        checked
                      )
                    }
                  />

                  <div style={smallTextStyle}>
                    {rate.effective_from || "-"}
                    {" → "}
                    {rate.effective_to || "OPEN"}
                  </div>

                  <button
                    type="button"
                    onClick={() => saveRate(rate)}
                    disabled={savingId === String(rate.id)}
                    style={saveButtonStyle}
                  >
                    {savingId === String(rate.id)
                      ? "SAVING..."
                      : "SAVE"}
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteRate(rate)}
                    disabled={deletingId === String(rate.id)}
                    style={deleteButtonStyle}
                  >
                    {deletingId === String(rate.id)
                      ? "DELETING..."
                      : "DELETE"}
                  </button>
                </div>
              ))}
            </>
          )}
        </section>

        <section style={panelStyle}>
          <div style={blueTitleStyle}>
            M-PESA FEE TEST
          </div>

          <div style={bodyStyle}>
            <div style={threeGridStyle}>
              <Field label="FEE TYPE">
                <input
                  list="test-fee-types"
                  value={testFeeType}
                  onChange={(event) => {
                    setTestFeeType(event.target.value);
                    setTestResult(null);
                  }}
                  style={inputStyle}
                />
                <datalist id="test-fee-types">
                  {feeTypes.map((type) => (
                    <option key={type} value={type} />
                  ))}
                </datalist>
              </Field>

              <Field label="TRANSACTION AMOUNT">
                <input
                  type="number"
                  value={testAmount}
                  onChange={(event) => {
                    setTestAmount(event.target.value);
                    setTestResult(null);
                  }}
                  style={inputStyle}
                />
              </Field>

              <Field label="CALCULATED FEE">
                <div style={feeResultStyle}>
                  KES {money(testResult ?? 0)}
                </div>
              </Field>
            </div>

            <button
              type="button"
              onClick={testFee}
              disabled={testing}
              style={blueButtonStyle}
            >
              {testing ? "CHECKING..." : "TEST TRANSACTION FEE"}
            </button>
          </div>
        </section>
      </details>

    </div>
  );
}

function PaymentMethodBox({ title, value, options, onChange }) {
  return (
    <div style={methodBoxStyle}>
      <div style={methodTitleStyle}>{title}</div>

      {options.map(([method, label]) => (
        <label key={method} style={radioStyle}>
          <input
            type="radio"
            name={title}
            checked={value === method}
            onChange={() => onChange(method)}
          />
          {label}
        </label>
      ))}
    </div>
  );
}

function PaymentTariffTable({
  title,
  method,
  rows,
  savingId,
  deletingId,
  onChange,
  onSave,
  onDelete,
}) {
  const filtered = rows.filter(
    (row) => row.payment_method === method
  );

  return (
    <div style={subPanelStyle}>
      <div style={subTitleStyle}>{title}</div>

      <div style={tariffHeaderStyle}>
        <div>MIN</div>
        <div>MAX</div>
        <div>FEE</div>
        <div>ACTIVE</div>
        <div>SAVE</div>
        <div>DELETE</div>
      </div>

      {filtered.length === 0 ? (
        <div style={emptyStyle}>No tariff bands.</div>
      ) : (
        filtered.map((row) => (
          <div key={row.id} style={tariffRowStyle}>
            <input
              type="number"
              value={row.min_amount}
              onChange={(event) =>
                onChange(row.id, "min_amount", event.target.value)
              }
              style={smallInputStyle}
            />

            <input
              type="number"
              value={row.max_amount}
              onChange={(event) =>
                onChange(row.id, "max_amount", event.target.value)
              }
              style={smallInputStyle}
            />

            <input
              type="number"
              value={row.fee}
              onChange={(event) =>
                onChange(row.id, "fee", event.target.value)
              }
              style={smallInputStyle}
            />

            <CenterCheck
              checked={row.is_active !== false}
              onChange={(checked) =>
                onChange(row.id, "is_active", checked)
              }
            />

            <button
              type="button"
              onClick={() => onSave(row)}
              disabled={savingId === String(row.id)}
              style={saveButtonStyle}
            >
              {savingId === String(row.id) ? "SAVING..." : "SAVE"}
            </button>

            <button
              type="button"
              onClick={() => onDelete(row)}
              disabled={deletingId === String(row.id)}
              style={deleteButtonStyle}
            >
              {deletingId === String(row.id) ? "DELETING..." : "DELETE"}
            </button>
          </div>
        ))
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
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

// ==================================================
// M-PESA RATE HELPERS
// ==================================================

function normaliseRates(value) {
  let source = value;

  if (typeof source === "string") {
    try {
      source = JSON.parse(source);
    } catch {
      return [];
    }
  }

  let rows = [];

  if (Array.isArray(source)) {
    rows = source;
  } else if (Array.isArray(source?.rates)) {
    rows = source.rates;
  } else if (Array.isArray(source?.data)) {
    rows = source.data;
  } else if (
    source &&
    typeof source === "object" &&
    (
      source.id ||
      source.fee_type ||
      source.flow ||
      source.min_amount !== undefined ||
      source.minimum_amount !== undefined
    )
  ) {
    rows = [source];
  } else if (source && typeof source === "object") {
    rows = Object.values(source).flatMap((item) => {
      if (Array.isArray(item)) return item;
      if (item && typeof item === "object") return [item];
      return [];
    });
  }

  return rows
    .filter((rate) =>
      rate &&
      typeof rate === "object" &&
      !Array.isArray(rate)
    )
    .map((rate) => ({
      ...rate,
      fee_type: rate?.fee_type ?? rate?.flow ?? "",
      min_amount:
        rate?.min_amount ?? rate?.minimum_amount ?? 0,
      max_amount:
        rate?.max_amount ?? rate?.maximum_amount ?? 0,
      fee: rate?.fee ?? rate?.fee_amount ?? 0,
      is_active: rate?.is_active !== false,
    }));
}

function getRateType(rate) {
  return String(rate?.fee_type ?? rate?.flow ?? "");
}

function getMinimum(rate) {
  return rate?.min_amount ?? rate?.minimum_amount ?? 0;
}

function getMaximum(rate) {
  return rate?.max_amount ?? rate?.maximum_amount ?? 0;
}

function getFee(rate) {
  return rate?.fee ?? rate?.fee_amount ?? 0;
}

function getIsActive(rate) {
  return rate?.is_active !== false;
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function extractNumericResult(value) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value !== "") {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  if (Array.isArray(value) && value.length > 0) {
    return extractNumericResult(value[0]);
  }

  if (value && typeof value === "object") {
    const candidates = [
      value.fee,
      value.fee_amount,
      value.transaction_fee,
      value.result,
      value.amount,
    ];

    for (const candidate of candidates) {
      const numeric = Number(candidate);
      if (Number.isFinite(numeric)) return numeric;
    }
  }

  return 0;
}

function money(value) {
  const numeric = Number(value ?? 0);
  return (
    Number.isFinite(numeric) ? numeric : 0
  ).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function roundMoney(value) {
  return Math.round(
    (Number(value) + Number.EPSILON) * 100
  ) / 100;
}

function getNairobiDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find(
    (part) => part.type === "year"
  )?.value;

  const month = parts.find(
    (part) => part.type === "month"
  )?.value;

  const day = parts.find(
    (part) => part.type === "day"
  )?.value;

  return `${year}-${month}-${day}`;
}

function methodLabel(value) {
  switch (value) {
    case "MPESA_TO_MPESA":
      return "M-PESA → M-PESA";
    case "MPESA_TO_IM":
      return "M-PESA → I&M";
    case "IM_TO_MPESA":
      return "I&M → M-PESA";
    default:
      return value || "-";
  }
}

// ==================================================
// PROFESSIONAL ADMIN THEME
// ==================================================

const wrapperStyle = {
  display: "grid",
  gap: "14px",
};

const loadingStyle = {
  padding: "30px",
  textAlign: "center",
  fontWeight: "bold",
};

const heroStyle = {
  padding: "16px",
  borderRadius: "7px",
  background: "linear-gradient(90deg,#047857,#0f766e)",
  color: "white",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap",
};

const heroTitleStyle = {
  fontSize: "17px",
  fontWeight: "900",
};

const refreshButtonStyle = {
  padding: "9px 13px",
  backgroundColor: "transparent",
  border: "1px solid white",
  color: "white",
  borderRadius: "5px",
  cursor: "pointer",
  fontWeight: "bold",
  fontSize: "12px",
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

const panelStyle = {
  backgroundColor: "white",
  border: "1px solid #cbd5e1",
  borderRadius: "7px",
  overflow: "hidden",
};

const bodyStyle = {
  padding: "13px",
};

const darkTitleStyle = {
  padding: "11px",
  backgroundColor: "#0f172a",
  color: "white",
  fontWeight: "900",
  fontSize: "13px",
};

const bankTitleStyle = {
  padding: "11px",
  backgroundColor: "#0284c7",
  color: "white",
  fontWeight: "900",
  fontSize: "13px",
};

const orangeTitleStyle = {
  padding: "11px",
  backgroundColor: "#dc2626",
  color: "white",
  fontWeight: "900",
  fontSize: "13px",
};

const cashierTitleStyle = {
  padding: "11px",
  backgroundColor: "#0f766e",
  color: "white",
  fontWeight: "900",
  fontSize: "13px",
};

const purpleTitleStyle = {
  padding: "11px",
  backgroundColor: "#7c3aed",
  color: "white",
  fontWeight: "900",
  fontSize: "13px",
};

const greenTitleStyle = {
  padding: "11px",
  backgroundColor: "#047857",
  color: "white",
  fontWeight: "900",
  fontSize: "13px",
};

const blueTitleStyle = {
  padding: "11px",
  backgroundColor: "#0284c7",
  color: "white",
  fontWeight: "900",
  fontSize: "13px",
};

const messageStyle = {
  padding: "10px",
  borderRadius: "5px",
  fontWeight: "bold",
  fontSize: "12px",
};

const systemGridStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(260px,1fr))",
  gap: "10px",
};

const methodBoxStyle = {
  padding: "12px",
  border: "1px solid #cbd5e1",
  borderRadius: "5px",
  backgroundColor: "#f8fafc",
};

const methodTitleStyle = {
  fontWeight: "900",
  fontSize: "12px",
  marginBottom: "8px",
};

const radioStyle = {
  display: "flex",
  alignItems: "center",
  gap: "7px",
  margin: "7px 0",
  fontWeight: "bold",
  fontSize: "12px",
};

const baseButton = {
  width: "100%",
  marginTop: "10px",
  padding: "10px",
  border: "none",
  borderRadius: "4px",
  color: "white",
  fontWeight: "bold",
  fontSize: "12px",
  cursor: "pointer",
};

const darkButtonStyle = {
  ...baseButton,
  backgroundColor: "#0f172a",
};

const bankButtonStyle = {
  ...baseButton,
  backgroundColor: "#0284c7",
};

const orangeButtonStyle = {
  ...baseButton,
  width: "auto",
  marginTop: 0,
  backgroundColor: "#dc2626",
};

const purpleButtonStyle = {
  ...baseButton,
  backgroundColor: "#7c3aed",
};

const blueButtonStyle = {
  ...baseButton,
  backgroundColor: "#0284c7",
};

const fourGridStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(180px,1fr))",
  gap: "10px",
};

const threeGridStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(200px,1fr))",
  gap: "10px",
};

const twoGridStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(220px,1fr))",
  gap: "10px",
  marginTop: "10px",
};

const paymentAddGridStyle = {
  display: "grid",
  gridTemplateColumns: "1.2fr 1fr 1fr 1fr auto",
  gap: "8px",
  alignItems: "end",
};

const dutyNameStyle = {
  fontSize: "11px",
  fontWeight: "700",
  overflowWrap: "anywhere",
};

const labelStyle = {
  display: "block",
  marginBottom: "5px",
  fontSize: "11px",
  fontWeight: "bold",
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "9px",
  border: "1px solid #94a3b8",
  borderRadius: "4px",
  backgroundColor: "white",
  color: "#0f172a",
  fontSize: "12px",
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
  width: "100%",
  boxSizing: "border-box",
  padding: "9px",
  border: "1px solid #94a3b8",
  borderRadius: "4px",
  resize: "vertical",
  fontSize: "12px",
};

const checkboxLineStyle = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  marginTop: "9px",
  fontSize: "12px",
  fontWeight: "bold",
};

const testerPanelStyle = {
  marginTop: "12px",
  padding: "10px",
  backgroundColor: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: "5px",
};

const feeResultStyle = {
  padding: "9px",
  backgroundColor: "#ecfdf5",
  border: "1px solid #86efac",
  borderRadius: "4px",
  fontWeight: "900",
  color: "#166534",
  fontSize: "13px",
};

const subPanelStyle = {
  marginTop: "12px",
  border: "1px solid #e2e8f0",
  borderRadius: "5px",
  overflow: "hidden",
};

const subTitleStyle = {
  padding: "8px",
  backgroundColor: "#f8fafc",
  fontWeight: "900",
  fontSize: "12px",
};

const tariffColumns = "1fr 1fr 1fr 0.6fr 0.8fr 0.8fr";

const tariffHeaderStyle = {
  display: "grid",
  gridTemplateColumns: tariffColumns,
  gap: "6px",
  padding: "7px",
  backgroundColor: "#f1f5f9",
  fontSize: "10px",
  fontWeight: "bold",
  textAlign: "center",
};

const tariffRowStyle = {
  display: "grid",
  gridTemplateColumns: tariffColumns,
  gap: "6px",
  padding: "7px",
  borderTop: "1px solid #e2e8f0",
  alignItems: "center",
  fontSize: "11px",
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

const rateColumns =
  "1.2fr 0.8fr 0.8fr 0.7fr 0.5fr 1fr 0.7fr 0.7fr";

const rateHeaderStyle = {
  display: "grid",
  gridTemplateColumns: rateColumns,
  gap: "6px",
  padding: "7px",
  backgroundColor: "#f1f5f9",
  fontSize: "10px",
  fontWeight: "bold",
  textAlign: "center",
};

const rateRowStyle = {
  display: "grid",
  gridTemplateColumns: rateColumns,
  gap: "6px",
  padding: "7px",
  alignItems: "center",
  borderTop: "1px solid #e2e8f0",
  fontSize: "11px",
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

const centerStyle = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
};

const smallTextStyle = {
  fontSize: "10px",
  textAlign: "center",
  color: "#64748b",
};

const emptyStyle = {
  padding: "18px",
  textAlign: "center",
  color: "#64748b",
  fontSize: "12px",
};
