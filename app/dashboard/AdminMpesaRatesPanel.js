"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

const BLANK_IM_ACCOUNT = {
  id: null,
  account_name: "Team Legend I&M",
  paybill_number: "",
  account_number: "",
  default_reference: "",
  is_active: true,
};

const BLANK_RECIPIENT = {
  shop_id: "",
  slot_number: "",
  recipient_name: "",
  phone_number: "",
  linked_profile_id: null,
  im_reference: "",
  allow_mpesa_to_mpesa: true,
  allow_im_to_mpesa: true,
  is_active: true,
};

export default function AdminMpesaRatesPanel({
  user,
}) {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const accessToken =
    user?.access_token ||
    null;

  const authHeaders =
    useMemo(
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

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [messageType, setMessageType] =
    useState("");

  // ==================================================
  // EXISTING SAFARICOM RATE SYSTEM
  // ==================================================

  const [rates, setRates] =
    useState([]);

  const [savingId, setSavingId] =
    useState("");

  const [deletingId, setDeletingId] =
    useState("");

  const [adding, setAdding] =
    useState(false);

  const [testing, setTesting] =
    useState(false);

  const [newFlow, setNewFlow] =
    useState("");

  const [newMinimum, setNewMinimum] =
    useState("");

  const [newMaximum, setNewMaximum] =
    useState("");

  const [newFee, setNewFee] =
    useState("");

  const [
    effectiveFrom,
    setEffectiveFrom,
  ] = useState(
    getNairobiDate()
  );

  const [
    effectiveTo,
    setEffectiveTo,
  ] = useState("");

  const [newNote, setNewNote] =
    useState("");

  const [
    testFeeType,
    setTestFeeType,
  ] = useState("");

  const [
    testAmount,
    setTestAmount,
  ] = useState("");

  const [
    testResult,
    setTestResult,
  ] = useState(null);

  // ==================================================
  // PAYMENT SYSTEM CONTROL
  // ==================================================

  const [
    paymentSettings,
    setPaymentSettings,
  ] = useState({
    collection_method:
      "MPESA_TO_MPESA",

    float_send_method:
      "MPESA_TO_MPESA",
  });

  const [
    savingPaymentSystem,
    setSavingPaymentSystem,
  ] = useState(false);

  // ==================================================
  // I&M COMPANY ACCOUNT
  // ==================================================

  const [
    imAccount,
    setImAccount,
  ] = useState(
    BLANK_IM_ACCOUNT
  );

  const [
    savingImAccount,
    setSavingImAccount,
  ] = useState(false);

  // ==================================================
  // NEW PAYMENT TARIFFS
  // ==================================================

  const [
    paymentTariffs,
    setPaymentTariffs,
  ] = useState([]);

  const [
    savingPaymentTariffId,
    setSavingPaymentTariffId,
  ] = useState("");

  const [
    deletingPaymentTariffId,
    setDeletingPaymentTariffId,
  ] = useState("");

  const [
    addingPaymentTariff,
    setAddingPaymentTariff,
  ] = useState(false);

  const [
    newPaymentMethod,
    setNewPaymentMethod,
  ] = useState(
    "MPESA_TO_IM"
  );

  const [
    newPaymentMin,
    setNewPaymentMin,
  ] = useState("");

  const [
    newPaymentMax,
    setNewPaymentMax,
  ] = useState("");

  const [
    newPaymentFee,
    setNewPaymentFee,
  ] = useState("");

  const [
    paymentTestMethod,
    setPaymentTestMethod,
  ] = useState(
    "MPESA_TO_IM"
  );

  const [
    paymentTestAmount,
    setPaymentTestAmount,
  ] = useState("");

  const [
    paymentTestResult,
    setPaymentTestResult,
  ] = useState(null);

  const [
    testingPaymentFee,
    setTestingPaymentFee,
  ] = useState(false);

  // ==================================================
  // CASHIER PAYMENT ACCOUNTS
  // ==================================================

  const [shops, setShops] =
    useState([]);

  const [
    recipients,
    setRecipients,
  ] = useState([]);

  const [
    newRecipient,
    setNewRecipient,
  ] = useState(
    BLANK_RECIPIENT
  );

  const [
    addingRecipient,
    setAddingRecipient,
  ] = useState(false);

  const [
    savingRecipientId,
    setSavingRecipientId,
  ] = useState("");

  // ==================================================
  // RPC
  // ==================================================

  const callRpc =
    useCallback(
      async (
        functionName,
        body = {}
      ) => {
        if (
          !supabaseUrl ||
          !supabaseAnonKey ||
          !accessToken
        ) {
          throw new Error(
            "Admin session is incomplete."
          );
        }

        const response =
          await fetch(
            `${supabaseUrl}/rest/v1/rpc/${functionName}`,
            {
              method:
                "POST",

              headers:
                authHeaders,

              body:
                JSON.stringify(
                  body
                ),

              cache:
                "no-store",
            }
          );

        const result =
          await safeJson(
            response
          );

        if (
          !response.ok
        ) {
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

  // ==================================================
  // REST GET
  // ==================================================

  const restGet =
    useCallback(
      async (
        path,
        fallbackMessage
      ) => {
        const response =
          await fetch(
            `${supabaseUrl}/rest/v1/${path}`,
            {
              method:
                "GET",

              headers:
                authHeaders,

              cache:
                "no-store",
            }
          );

        const result =
          await safeJson(
            response
          );

        if (
          !response.ok
        ) {
          throw new Error(
            result?.message ||
              result?.details ||
              result?.hint ||
              fallbackMessage
          );
        }

        return result;
      },
      [
        supabaseUrl,
        authHeaders,
      ]
    );

  // ==================================================
  // LOAD EVERYTHING
  // ==================================================

  const loadAll =
    useCallback(
      async ({
        silent = false,
      } = {}) => {
        if (
          !supabaseUrl ||
          !supabaseAnonKey ||
          !accessToken
        ) {
          setLoading(
            false
          );

          return;
        }

        if (
          silent
        ) {
          setRefreshing(
            true
          );
        } else {
          setLoading(
            true
          );
        }

        try {
          setMessage("");

          const [
            mpesaRateResult,
            settingsResult,
            imAccountsResult,
            tariffResult,
            shopsResult,
            recipientsResult,
          ] =
            await Promise.all([
              callRpc(
                "tl_admin_mpesa_fee_rates",
                {}
              ),

              restGet(
                "payment_system_settings?id=eq.1&select=*",
                "Unable to load payment system settings."
              ),

              restGet(
                "im_payment_accounts?select=*&order=is_active.desc,updated_at.desc",
                "Unable to load I&M account details."
              ),

              restGet(
                "payment_tariff_bands?select=*&order=payment_method.asc,min_amount.asc",
                "Unable to load payment tariffs."
              ),

              restGet(
                "shops?select=id,shop_name,is_active&order=shop_name.asc",
                "Unable to load shops."
              ),

              restGet(
                "mpesa_cashier_recipients?select=id,shop_id,slot_number,recipient_name,phone_number,linked_profile_id,is_active,im_reference,allow_mpesa_to_mpesa,allow_im_to_mpesa,created_at,updated_at&order=shop_id.asc,slot_number.asc",
                "Unable to load cashier payment accounts."
              ),
            ]);

          const loadedRates =
            normaliseRates(
              mpesaRateResult
            );

          setRates(
            loadedRates
          );

          setTestFeeType(
            (current) =>
              current ||
              getRateType(
                loadedRates[0]
              ) ||
              ""
          );

          const setting =
            Array.isArray(
              settingsResult
            )
              ? settingsResult[0]
              : null;

          if (
            setting
          ) {
            setPaymentSettings({
              collection_method:
                setting.collection_method ||
                "MPESA_TO_MPESA",

              float_send_method:
                setting.float_send_method ||
                "MPESA_TO_MPESA",
            });
          }

          const imRows =
            Array.isArray(
              imAccountsResult
            )
              ? imAccountsResult
              : [];

          const activeIm =
            imRows.find(
              (row) =>
                row?.is_active
            ) ||
            imRows[0] ||
            null;

          setImAccount(
            activeIm
              ? {
                  id:
                    activeIm.id,

                  account_name:
                    activeIm.account_name ||
                    "Team Legend I&M",

                  paybill_number:
                    activeIm.paybill_number ||
                    "",

                  account_number:
                    activeIm.account_number ||
                    "",

                  default_reference:
                    activeIm.default_reference ||
                    "",

                  is_active:
                    activeIm.is_active !==
                    false,
                }
              : BLANK_IM_ACCOUNT
          );

          setPaymentTariffs(
            Array.isArray(
              tariffResult
            )
              ? tariffResult
              : []
          );

          setShops(
            Array.isArray(
              shopsResult
            )
              ? shopsResult
              : []
          );

          setRecipients(
            (
              Array.isArray(
                recipientsResult
              )
                ? recipientsResult
                : []
            ).map(
              (row) => ({
                ...row,

                im_reference:
                  row?.im_reference ||
                  "",

                allow_mpesa_to_mpesa:
                  row?.allow_mpesa_to_mpesa !==
                  false,

                allow_im_to_mpesa:
                  row?.allow_im_to_mpesa !==
                  false,

                is_active:
                  row?.is_active !==
                  false,
              })
            )
          );
        } catch (error) {
          console.error(
            "LOAD PAYMENT ADMIN ERROR:",
            error
          );

          setMessage(
            error?.message ||
              "Unable to load payment administration."
          );

          setMessageType(
            "error"
          );
        } finally {
          setLoading(
            false
          );

          setRefreshing(
            false
          );
        }
      },
      [
        supabaseUrl,
        supabaseAnonKey,
        accessToken,
        callRpc,
        restGet,
      ]
    );

  // ==================================================
  // AUTO LOAD
  // ==================================================

  useEffect(() => {
    loadAll();
  }, [
    loadAll,
  ]);

  // ==================================================
  // PAYMENT SYSTEM CONTROL
  // ==================================================

  async function savePaymentSystem() {
    const confirmed =
      window.confirm(
        "CHANGE ACTIVE PAYMENT SYSTEM\n\n" +
          `Money received: ${methodLabel(
            paymentSettings.collection_method
          )}\n` +
          `Float sent: ${methodLabel(
            paymentSettings.float_send_method
          )}\n\n` +
          "Apply these methods to new transactions? Existing history will not be changed."
      );

    if (
      !confirmed
    ) {
      return;
    }

    try {
      setSavingPaymentSystem(
        true
      );

      setMessage("");

      const result =
        await callRpc(
          "tl_admin_set_payment_system",
          {
            p_collection_method:
              paymentSettings.collection_method,

            p_float_send_method:
              paymentSettings.float_send_method,
          }
        );

      setPaymentSettings({
        collection_method:
          result?.collection_method ||
          paymentSettings.collection_method,

        float_send_method:
          result?.float_send_method ||
          paymentSettings.float_send_method,
      });

      setMessage(
        "Payment system updated successfully."
      );

      setMessageType(
        "success"
      );
    } catch (error) {
      setMessage(
        error?.message ||
          "Unable to update payment system."
      );

      setMessageType(
        "error"
      );
    } finally {
      setSavingPaymentSystem(
        false
      );
    }
  }

  // ==================================================
  // I&M ACCOUNT
  // ==================================================

  async function saveImAccount() {
    if (
      !String(
        imAccount.account_name ||
          ""
      ).trim()
    ) {
      setMessage(
        "Enter the I&M account name."
      );

      setMessageType(
        "error"
      );

      return;
    }

    if (
      !String(
        imAccount.paybill_number ||
          ""
      ).trim() &&
      !String(
        imAccount.account_number ||
          ""
      ).trim()
    ) {
      setMessage(
        "Enter an I&M Paybill or account number."
      );

      setMessageType(
        "error"
      );

      return;
    }

    const confirmed =
      window.confirm(
        "SAVE I&M COMPANY ACCOUNT\n\n" +
          `Account Name: ${imAccount.account_name}\n` +
          `Paybill: ${
            imAccount.paybill_number ||
            "-"
          }\n` +
          `Account Number: ${
            imAccount.account_number ||
            "-"
          }\n` +
          `Default Reference: ${
            imAccount.default_reference ||
            "-"
          }`
      );

    if (
      !confirmed
    ) {
      return;
    }

    try {
      setSavingImAccount(
        true
      );

      setMessage("");

      const result =
        await callRpc(
          "tl_admin_save_im_payment_account",
          {
            p_id:
              imAccount.id ||
              null,

            p_account_name:
              String(
                imAccount.account_name ||
                  ""
              ).trim(),

            p_paybill_number:
              String(
                imAccount.paybill_number ||
                  ""
              ).trim() ||
              null,

            p_account_number:
              String(
                imAccount.account_number ||
                  ""
              ).trim() ||
              null,

            p_default_reference:
              String(
                imAccount.default_reference ||
                  ""
              ).trim() ||
              null,

            p_is_active:
              imAccount.is_active !==
              false,
          }
        );

      setImAccount(
        (current) => ({
          ...current,

          id:
            result?.id ||
            current.id,
        })
      );

      setMessage(
        "I&M company account saved successfully."
      );

      setMessageType(
        "success"
      );

      await loadAll({
        silent:
          true,
      });
    } catch (error) {
      setMessage(
        error?.message ||
          "Unable to save I&M account details."
      );

      setMessageType(
        "error"
      );
    } finally {
      setSavingImAccount(
        false
      );
    }
  }

  // ==================================================
  // PAYMENT TARIFFS
  // ==================================================

  function updatePaymentTariffField(
    id,
    field,
    value
  ) {
    setPaymentTariffs(
      (previous) =>
        previous.map(
          (row) =>
            String(
              row.id
            ) ===
            String(
              id
            )
              ? {
                  ...row,

                  [field]:
                    value,
                }
              : row
        )
    );

    setMessage("");
  }

  async function savePaymentTariff(
    rate
  ) {
    const minAmount =
      Number(
        rate?.min_amount
      );

    const maxAmount =
      Number(
        rate?.max_amount
      );

    const fee =
      Number(
        rate?.fee
      );

    if (
      !rate?.id
    ) {
      return;
    }

    if (
      !Number.isFinite(
        minAmount
      ) ||
      minAmount <
        0
    ) {
      return showError(
        "Enter a valid minimum amount."
      );
    }

    if (
      !Number.isFinite(
        maxAmount
      ) ||
      maxAmount <
        minAmount
    ) {
      return showError(
        "Maximum amount must be equal to or above minimum amount."
      );
    }

    if (
      !Number.isFinite(
        fee
      ) ||
      fee <
        0
    ) {
      return showError(
        "Enter a valid fee."
      );
    }

    const confirmed =
      window.confirm(
        `SAVE ${methodLabel(
          rate.payment_method
        )} TARIFF\n\n` +
          `KES ${money(
            minAmount
          )} - KES ${money(
            maxAmount
          )}\n` +
          `Fee: KES ${money(
            fee
          )}\n` +
          `Active: ${
            rate.is_active !==
            false
              ? "YES"
              : "NO"
          }`
      );

    if (
      !confirmed
    ) {
      return;
    }

    try {
      setSavingPaymentTariffId(
        String(
          rate.id
        )
      );

      setMessage("");

      await callRpc(
        "tl_admin_save_payment_tariff_band",
        {
          p_id:
            rate.id,

          p_payment_method:
            rate.payment_method,

          p_min_amount:
            roundMoney(
              minAmount
            ),

          p_max_amount:
            roundMoney(
              maxAmount
            ),

          p_fee:
            roundMoney(
              fee
            ),

          p_is_active:
            rate.is_active !==
            false,
        }
      );

      setMessage(
        "Payment tariff updated successfully."
      );

      setMessageType(
        "success"
      );

      await loadAll({
        silent:
          true,
      });
    } catch (error) {
      setMessage(
        error?.message ||
          "Unable to save payment tariff."
      );

      setMessageType(
        "error"
      );
    } finally {
      setSavingPaymentTariffId(
        ""
      );
    }
  }

  async function addPaymentTariffBand() {
    const minAmount =
      Number(
        newPaymentMin
      );

    const maxAmount =
      Number(
        newPaymentMax
      );

    const fee =
      Number(
        newPaymentFee
      );

    if (
      !Number.isFinite(
        minAmount
      ) ||
      minAmount <
        0
    ) {
      return showError(
        "Enter a valid payment tariff minimum amount."
      );
    }

    if (
      !Number.isFinite(
        maxAmount
      ) ||
      maxAmount <
        minAmount
    ) {
      return showError(
        "Enter a valid payment tariff maximum amount."
      );
    }

    if (
      !Number.isFinite(
        fee
      ) ||
      fee <
        0
    ) {
      return showError(
        "Enter a valid payment tariff fee."
      );
    }

    const confirmed =
      window.confirm(
        `ADD ${methodLabel(
          newPaymentMethod
        )} TARIFF\n\n` +
          `KES ${money(
            minAmount
          )} - KES ${money(
            maxAmount
          )}\n` +
          `Fee: KES ${money(
            fee
          )}`
      );

    if (
      !confirmed
    ) {
      return;
    }

    try {
      setAddingPaymentTariff(
        true
      );

      setMessage("");

      await callRpc(
        "tl_admin_save_payment_tariff_band",
        {
          p_id:
            null,

          p_payment_method:
            newPaymentMethod,

          p_min_amount:
            roundMoney(
              minAmount
            ),

          p_max_amount:
            roundMoney(
              maxAmount
            ),

          p_fee:
            roundMoney(
              fee
            ),

          p_is_active:
            true,
        }
      );

      setNewPaymentMin("");
      setNewPaymentMax("");
      setNewPaymentFee("");

      setMessage(
        "New payment tariff band added successfully."
      );

      setMessageType(
        "success"
      );

      await loadAll({
        silent:
          true,
      });
    } catch (error) {
      setMessage(
        error?.message ||
          "Unable to add payment tariff band."
      );

      setMessageType(
        "error"
      );
    } finally {
      setAddingPaymentTariff(
        false
      );
    }
  }

  async function deletePaymentTariff(
    rate
  ) {
    if (
      !rate?.id
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `DELETE ${methodLabel(
          rate.payment_method
        )} TARIFF\n\n` +
          `KES ${money(
            rate.min_amount
          )} - KES ${money(
            rate.max_amount
          )}\n\n` +
          "Delete this band?"
      );

    if (
      !confirmed
    ) {
      return;
    }

    try {
      setDeletingPaymentTariffId(
        String(
          rate.id
        )
      );

      setMessage("");

      const response =
        await fetch(
          `${supabaseUrl}/rest/v1/payment_tariff_bands?id=eq.${encodeURIComponent(
            rate.id
          )}`,
          {
            method:
              "DELETE",

            headers: {
              ...authHeaders,

              Prefer:
                "return=minimal",
            },

            cache:
              "no-store",
          }
        );

      const result =
        await safeJson(
          response
        );

      if (
        !response.ok
      ) {
        throw new Error(
          result?.message ||
            result?.details ||
            result?.hint ||
            "Unable to delete tariff."
        );
      }

      setMessage(
        "Payment tariff deleted successfully."
      );

      setMessageType(
        "success"
      );

      await loadAll({
        silent:
          true,
      });
    } catch (error) {
      setMessage(
        error?.message ||
          "Unable to delete payment tariff."
      );

      setMessageType(
        "error"
      );
    } finally {
      setDeletingPaymentTariffId(
        ""
      );
    }
  }

  async function testPaymentFee() {
    const amount =
      Number(
        paymentTestAmount
      );

    if (
      !Number.isFinite(
        amount
      ) ||
      amount <
        0
    ) {
      return showError(
        "Enter a valid payment amount to test."
      );
    }

    try {
      setTestingPaymentFee(
        true
      );

      setPaymentTestResult(
        null
      );

      setMessage("");

      const result =
        await callRpc(
          "tl_payment_fee_for_amount",
          {
            p_payment_method:
              paymentTestMethod,

            p_amount:
              roundMoney(
                amount
              ),
          }
        );

      setPaymentTestResult(
        extractNumericResult(
          result
        )
      );

      setMessage(
        "Payment tariff test completed."
      );

      setMessageType(
        "success"
      );
    } catch (error) {
      setMessage(
        error?.message ||
          "Unable to test payment tariff."
      );

      setMessageType(
        "error"
      );
    } finally {
      setTestingPaymentFee(
        false
      );
    }
  }

  // ==================================================
  // SHOP MAP
  // ==================================================

  const shopMap =
    useMemo(
      () => {
        const map =
          new Map();

        for (
          const shop of shops
        ) {
          map.set(
            String(
              shop.id
            ),
            shop
          );
        }

        return map;
      },
      [
        shops,
      ]
    );

  // ==================================================
  // SORTED RECIPIENTS
  // ==================================================

  const sortedRecipients =
    useMemo(
      () => {
        return [
          ...recipients,
        ].sort(
          (
            a,
            b
          ) => {
            const shopA =
              String(
                shopMap.get(
                  String(
                    a.shop_id
                  )
                )?.shop_name ||
                  ""
              );

            const shopB =
              String(
                shopMap.get(
                  String(
                    b.shop_id
                  )
                )?.shop_name ||
                  ""
              );

            const byShop =
              shopA.localeCompare(
                shopB
              );

            if (
              byShop !==
              0
            ) {
              return byShop;
            }

            return (
              Number(
                a.slot_number ||
                  0
              ) -
              Number(
                b.slot_number ||
                  0
              )
            );
          }
        );
      },
      [
        recipients,
        shopMap,
      ]
    );

  // ==================================================
  // CASHIER ACCOUNTS
  // ==================================================

  function updateRecipientField(
    id,
    field,
    value
  ) {
    setRecipients(
      (previous) =>
        previous.map(
          (row) =>
            String(
              row.id
            ) ===
            String(
              id
            )
              ? {
                  ...row,

                  [field]:
                    value,
                }
              : row
        )
    );

    setMessage("");
  }

  async function saveRecipient(
    recipient
  ) {
    if (
      !recipient?.id
    ) {
      return;
    }

    await saveRecipientRecord(
      recipient,
      {
        isNew:
          false,
      }
    );
  }

  async function addRecipient() {
    await saveRecipientRecord(
      newRecipient,
      {
        isNew:
          true,
      }
    );
  }

  async function saveRecipientRecord(
    recipient,
    {
      isNew,
    }
  ) {
    const slot =
      Number(
        recipient.slot_number
      );

    const name =
      String(
        recipient.recipient_name ||
          ""
      ).trim();

    const phone =
      String(
        recipient.phone_number ||
          ""
      ).trim();

    if (
      !recipient.shop_id
    ) {
      return showError(
        "Select a shop for the cashier."
      );
    }

    if (
      !Number.isInteger(
        slot
      ) ||
      slot <
        1 ||
      slot >
        50
    ) {
      return showError(
        "Cashier slot must be between 1 and 50."
      );
    }

    if (
      !name
    ) {
      return showError(
        "Enter the cashier name."
      );
    }

    if (
      !phone
    ) {
      return showError(
        "Enter the cashier M-Pesa number."
      );
    }

    const confirmed =
      window.confirm(
        `${
          isNew
            ? "ADD"
            : "SAVE"
        } CASHIER PAYMENT ACCOUNT\n\n` +
          `Shop: ${
            shopMap.get(
              String(
                recipient.shop_id
              )
            )?.shop_name ||
            "Shop"
          }\n` +
          `Slot: ${slot}\n` +
          `Cashier: ${name}\n` +
          `Phone: ${phone}\n` +
          `I&M Reference: ${
            recipient.im_reference ||
            "-"
          }\n` +
          `M-Pesa → M-Pesa: ${
            recipient.allow_mpesa_to_mpesa !==
            false
              ? "YES"
              : "NO"
          }\n` +
          `I&M → M-Pesa: ${
            recipient.allow_im_to_mpesa !==
            false
              ? "YES"
              : "NO"
          }\n` +
          `Active: ${
            recipient.is_active !==
            false
              ? "YES"
              : "NO"
          }`
      );

    if (
      !confirmed
    ) {
      return;
    }

    try {
      if (
        isNew
      ) {
        setAddingRecipient(
          true
        );
      } else {
        setSavingRecipientId(
          String(
            recipient.id
          )
        );
      }

      setMessage("");

      await callRpc(
        "tl_admin_save_cashier_payment_account",
        {
          p_id:
            isNew
              ? null
              : recipient.id,

          p_shop_id:
            recipient.shop_id,

          p_slot_number:
            slot,

          p_recipient_name:
            name,

          p_phone_number:
            phone,

          p_linked_profile_id:
            recipient.linked_profile_id ||
            null,

          p_im_reference:
            String(
              recipient.im_reference ||
                ""
            ).trim() ||
            null,

          p_allow_mpesa_to_mpesa:
            recipient.allow_mpesa_to_mpesa !==
            false,

          p_allow_im_to_mpesa:
            recipient.allow_im_to_mpesa !==
            false,

          p_is_active:
            recipient.is_active !==
            false,
        }
      );

      if (
        isNew
      ) {
        setNewRecipient(
          BLANK_RECIPIENT
        );
      }

      setMessage(
        isNew
          ? "Cashier payment account added successfully."
          : "Cashier payment account updated successfully."
      );

      setMessageType(
        "success"
      );

      await loadAll({
        silent:
          true,
      });
    } catch (error) {
      setMessage(
        error?.message ||
          "Unable to save cashier payment account."
      );

      setMessageType(
        "error"
      );
    } finally {
      setAddingRecipient(
        false
      );

      setSavingRecipientId(
        ""
      );
    }
  }

  // ==================================================
  // EXISTING SAFARICOM RATES
  // ==================================================

  function updateRateField(
    id,
    field,
    value
  ) {
    setRates(
      (previous) =>
        previous.map(
          (rate) =>
            String(
              rate.id
            ) ===
            String(
              id
            )
              ? {
                  ...rate,

                  [field]:
                    value,
                }
              : rate
        )
    );

    setMessage("");
  }

  async function saveRate(
    rate
  ) {
    if (
      !rate?.id
    ) {
      return showError(
        "This rate does not have a valid ID."
      );
    }

    const feeType =
      String(
        getRateType(
          rate
        ) ||
          ""
      )
        .trim()
        .toUpperCase();

    const minAmount =
      Number(
        getMinimum(
          rate
        )
      );

    const maxAmount =
      Number(
        getMaximum(
          rate
        )
      );

    const fee =
      Number(
        getFee(
          rate
        )
      );

    if (
      !feeType
    ) {
      return showError(
        "Fee type is required."
      );
    }

    if (
      !Number.isFinite(
        minAmount
      ) ||
      minAmount <
        0
    ) {
      return showError(
        "Enter a valid minimum amount."
      );
    }

    if (
      !Number.isFinite(
        maxAmount
      ) ||
      maxAmount <
        minAmount
    ) {
      return showError(
        "Maximum amount must be equal to or higher than minimum amount."
      );
    }

    if (
      !Number.isFinite(
        fee
      ) ||
      fee <
        0
    ) {
      return showError(
        "Enter a valid M-Pesa fee."
      );
    }

    const confirmed =
      window.confirm(
        "UPDATE M-PESA RATE\n\n" +
          `Fee Type: ${feeType}\n` +
          `From: KES ${money(
            minAmount
          )}\n` +
          `To: KES ${money(
            maxAmount
          )}\n` +
          `Fee: KES ${money(
            fee
          )}\n\n` +
          "Save this rate?"
      );

    if (
      !confirmed
    ) {
      return;
    }

    try {
      setSavingId(
        String(
          rate.id
        )
      );

      setMessage("");

      await callRpc(
        "tl_admin_save_mpesa_fee_rate",
        {
          p_id:
            rate.id,

          p_fee_type:
            feeType,

          p_min_amount:
            roundMoney(
              minAmount
            ),

          p_max_amount:
            roundMoney(
              maxAmount
            ),

          p_fee:
            roundMoney(
              fee
            ),

          p_is_active:
            getIsActive(
              rate
            ),
        }
      );

      setMessage(
        "M-Pesa rate updated successfully."
      );

      setMessageType(
        "success"
      );

      await loadAll({
        silent:
          true,
      });
    } catch (error) {
      setMessage(
        error?.message ||
          "Unable to update M-Pesa rate."
      );

      setMessageType(
        "error"
      );
    } finally {
      setSavingId("");
    }
  }

  async function deleteRate(
    rate
  ) {
    if (
      !rate?.id
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        "DELETE M-PESA RATE\n\n" +
          `${
            getRateType(
              rate
            ) ||
            "M-Pesa Rate"
          }\n` +
          `KES ${money(
            getMinimum(
              rate
            )
          )} - KES ${money(
            getMaximum(
              rate
            )
          )}\n\n` +
          "Delete this rate?"
      );

    if (
      !confirmed
    ) {
      return;
    }

    try {
      setDeletingId(
        String(
          rate.id
        )
      );

      setMessage("");

      await callRpc(
        "tl_admin_delete_mpesa_fee_rate",
        {
          p_id:
            rate.id,
        }
      );

      setMessage(
        "M-Pesa rate deleted successfully."
      );

      setMessageType(
        "success"
      );

      await loadAll({
        silent:
          true,
      });
    } catch (error) {
      setMessage(
        error?.message ||
          "Unable to delete M-Pesa rate."
      );

      setMessageType(
        "error"
      );
    } finally {
      setDeletingId("");
    }
  }

  async function addBand() {
    const flow =
      String(
        newFlow ||
          ""
      )
        .trim()
        .toUpperCase();

    const minimum =
      Number(
        newMinimum
      );

    const maximum =
      Number(
        newMaximum
      );

    const fee =
      Number(
        newFee
      );

    if (
      !flow
    ) {
      return showError(
        "Enter the M-Pesa fee type / flow."
      );
    }

    if (
      newMinimum ===
        "" ||
      !Number.isFinite(
        minimum
      ) ||
      minimum <
        0
    ) {
      return showError(
        "Enter a valid minimum amount."
      );
    }

    if (
      newMaximum ===
        "" ||
      !Number.isFinite(
        maximum
      ) ||
      maximum <
        minimum
    ) {
      return showError(
        "Enter a valid maximum amount."
      );
    }

    if (
      newFee ===
        "" ||
      !Number.isFinite(
        fee
      ) ||
      fee <
        0
    ) {
      return showError(
        "Enter a valid M-Pesa fee."
      );
    }

    if (
      !effectiveFrom
    ) {
      return showError(
        "Select the date the new rate becomes effective."
      );
    }

    if (
      effectiveTo &&
      effectiveTo <
        effectiveFrom
    ) {
      return showError(
        "Effective To cannot be earlier than Effective From."
      );
    }

    const confirmed =
      window.confirm(
        "ADD M-PESA FEE BAND\n\n" +
          `Type / Flow: ${flow}\n` +
          `From: KES ${money(
            minimum
          )}\n` +
          `To: KES ${money(
            maximum
          )}\n` +
          `Fee: KES ${money(
            fee
          )}\n` +
          `Effective From: ${effectiveFrom}\n` +
          `Effective To: ${
            effectiveTo ||
            "No end date"
          }\n\n` +
          "Add this M-Pesa rate?"
      );

    if (
      !confirmed
    ) {
      return;
    }

    try {
      setAdding(
        true
      );

      setMessage("");

      await callRpc(
        "tl_admin_add_mpesa_fee_band",
        {
          p_flow:
            flow,

          p_minimum_amount:
            roundMoney(
              minimum
            ),

          p_maximum_amount:
            roundMoney(
              maximum
            ),

          p_fee_amount:
            roundMoney(
              fee
            ),

          p_effective_from:
            effectiveFrom,

          p_effective_to:
            effectiveTo ||
            null,

          p_note:
            String(
              newNote ||
                ""
            ).trim() ||
            null,
        }
      );

      setNewMinimum("");
      setNewMaximum("");
      setNewFee("");
      setEffectiveTo("");
      setNewNote("");

      setMessage(
        "New M-Pesa fee band added successfully."
      );

      setMessageType(
        "success"
      );

      await loadAll({
        silent:
          true,
      });
    } catch (error) {
      setMessage(
        error?.message ||
          "Unable to add M-Pesa fee band."
      );

      setMessageType(
        "error"
      );
    } finally {
      setAdding(
        false
      );
    }
  }

  async function testFee() {
    const feeType =
      String(
        testFeeType ||
          ""
      )
        .trim()
        .toUpperCase();

    const amount =
      Number(
        testAmount
      );

    if (
      !feeType
    ) {
      return showError(
        "Enter a fee type to test."
      );
    }

    if (
      testAmount ===
        "" ||
      !Number.isFinite(
        amount
      ) ||
      amount <
        0
    ) {
      return showError(
        "Enter a valid amount to test."
      );
    }

    try {
      setTesting(
        true
      );

      setTestResult(
        null
      );

      setMessage("");

      const result =
        await callRpc(
          "tl_mpesa_fee_for_amount",
          {
            p_fee_type:
              feeType,

            p_amount:
              roundMoney(
                amount
              ),
          }
        );

      setTestResult(
        extractNumericResult(
          result
        )
      );

      setMessage(
        "M-Pesa fee test completed."
      );

      setMessageType(
        "success"
      );
    } catch (error) {
      setMessage(
        error?.message ||
          "Unable to test M-Pesa fee."
      );

      setMessageType(
        "error"
      );
    } finally {
      setTesting(
        false
      );
    }
  }

  // ==================================================
  // FEE TYPES
  // ==================================================

  const feeTypes =
    useMemo(
      () => {
        return [
          ...new Set(
            rates
              .map(
                (rate) =>
                  getRateType(
                    rate
                  )
              )
              .filter(
                Boolean
              )
          ),
        ];
      },
      [
        rates,
      ]
    );

  function showError(
    text
  ) {
    setMessage(
      text
    );

    setMessageType(
      "error"
    );
  }

  // ==================================================
  // LOADING
  // ==================================================

  if (
    loading
  ) {
    return (
      <div style={loadingPageStyle}>
        Loading payment administration...
      </div>
    );
  }

  // ==================================================
  // DISPLAY
  // ==================================================

  return (
    <div style={wrapperStyle}>
      {/* ========================================= */}
      {/* HERO */}
      {/* ========================================= */}

      <section style={heroStyle}>
        <div>
          <div style={heroTitleStyle}>
            PAYMENT SYSTEM & TRANSACTION RATES
          </div>

          <div style={heroSubtitleStyle}>
            Control M-Pesa, I&M, tariff tables and approved cashier payment accounts
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            loadAll({
              silent:
                true,
            })
          }
          disabled={
            refreshing
          }
          style={refreshButtonStyle}
        >
          {refreshing
            ? "Refreshing..."
            : "Refresh All"}
        </button>
      </section>

      {/* ========================================= */}
      {/* MESSAGE */}
      {/* ========================================= */}

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

            border:
              messageType ===
              "success"
                ? "1px solid #86efac"
                : "1px solid #fecaca",
          }}
        >
          {message}
        </div>
      )}

      {/* ========================================= */}
      {/* PAYMENT SYSTEM CONTROL */}
      {/* ========================================= */}

      <section style={panelStyle}>
        <div style={darkTitleStyle}>
          PAYMENT SYSTEM CONTROL
        </div>

        <div style={bodyStyle}>
          <div style={systemGridStyle}>
            <PaymentMethodBox
              title="MONEY RECEIVED FROM CASHIERS"
              value={
                paymentSettings.collection_method
              }
              options={[
                [
                  "MPESA_TO_MPESA",
                  "M-PESA → M-PESA",
                ],
                [
                  "MPESA_TO_IM",
                  "M-PESA → I&M",
                ],
              ]}
              onChange={(
                value
              ) =>
                setPaymentSettings(
                  (
                    current
                  ) => ({
                    ...current,

                    collection_method:
                      value,
                  })
                )
              }
            />

            <PaymentMethodBox
              title="FLOAT SENT TO CASHIERS"
              value={
                paymentSettings.float_send_method
              }
              options={[
                [
                  "MPESA_TO_MPESA",
                  "M-PESA → M-PESA",
                ],
                [
                  "IM_TO_MPESA",
                  "I&M → M-PESA",
                ],
              ]}
              onChange={(
                value
              ) =>
                setPaymentSettings(
                  (
                    current
                  ) => ({
                    ...current,

                    float_send_method:
                      value,
                  })
                )
              }
            />
          </div>

          <div style={controlSummaryStyle}>
            <strong>
              Current selection:
            </strong>{" "}
            Cashier returns use{" "}
            {methodLabel(
              paymentSettings.collection_method
            )}
            ; float sending uses{" "}
            {methodLabel(
              paymentSettings.float_send_method
            )}
            .
          </div>

          <button
            type="button"
            onClick={
              savePaymentSystem
            }
            disabled={
              savingPaymentSystem
            }
            style={saveWideButtonStyle}
          >
            {savingPaymentSystem
              ? "SAVING..."
              : "SAVE PAYMENT SYSTEM"}
          </button>
        </div>
      </section>

      {/* ========================================= */}
      {/* I&M ACCOUNT */}
      {/* ========================================= */}

      <section style={panelStyle}>
        <div style={bankTitleStyle}>
          I&M COMPANY PAYMENT ACCOUNT
        </div>

        <div style={bodyStyle}>
          <div style={fourGridStyle}>
            <Field label="ACCOUNT NAME">
              <input
                value={
                  imAccount.account_name
                }
                onChange={(
                  event
                ) =>
                  setImAccount(
                    (
                      current
                    ) => ({
                      ...current,

                      account_name:
                        event.target.value,
                    })
                  )
                }
                style={inputStyle}
              />
            </Field>

            <Field label="PAYBILL NUMBER">
              <input
                value={
                  imAccount.paybill_number
                }
                onChange={(
                  event
                ) =>
                  setImAccount(
                    (
                      current
                    ) => ({
                      ...current,

                      paybill_number:
                        event.target.value,
                    })
                  )
                }
                placeholder="Enter I&M Paybill"
                style={inputStyle}
              />
            </Field>

            <Field label="ACCOUNT NUMBER">
              <input
                value={
                  imAccount.account_number
                }
                onChange={(
                  event
                ) =>
                  setImAccount(
                    (
                      current
                    ) => ({
                      ...current,

                      account_number:
                        event.target.value,
                    })
                  )
                }
                placeholder="Enter I&M account"
                style={inputStyle}
              />
            </Field>

            <Field label="DEFAULT REFERENCE">
              <input
                value={
                  imAccount.default_reference
                }
                onChange={(
                  event
                ) =>
                  setImAccount(
                    (
                      current
                    ) => ({
                      ...current,

                      default_reference:
                        event.target.value,
                    })
                  )
                }
                placeholder="Optional"
                style={inputStyle}
              />
            </Field>
          </div>

          <label style={checkLineStyle}>
            <input
              type="checkbox"
              checked={
                imAccount.is_active !==
                false
              }
              onChange={(
                event
              ) =>
                setImAccount(
                  (
                    current
                  ) => ({
                    ...current,

                    is_active:
                      event.target.checked,
                  })
                )
              }
            />

            Active company I&M payment account
          </label>

          <button
            type="button"
            onClick={
              saveImAccount
            }
            disabled={
              savingImAccount
            }
            style={bankSaveButtonStyle}
          >
            {savingImAccount
              ? "SAVING..."
              : "SAVE I&M DETAILS"}
          </button>
        </div>
      </section>

      {/* ========================================= */}
      {/* BANK TARIFFS */}
      {/* ========================================= */}

      <section style={panelStyle}>
        <div style={orangeTitleStyle}>
          M-PESA ↔ I&M TRANSACTION CHARGES
        </div>

        <div style={bodyStyle}>
          <div style={importantNoticeStyle}>
            I&M → M-Pesa can remain at KES 0.00 now.
            If I&M introduces charges later, edit the tariff
            bands here. M-Pesa → I&M should be updated with
            the tariff bands you want the system to use.
          </div>

          <div style={paymentAddGridStyle}>
            <Field label="METHOD">
              <select
                value={
                  newPaymentMethod
                }
                onChange={(
                  event
                ) =>
                  setNewPaymentMethod(
                    event.target.value
                  )
                }
                style={inputStyle}
              >
                <option value="MPESA_TO_IM">
                  M-PESA → I&M
                </option>

                <option value="IM_TO_MPESA">
                  I&M → M-PESA
                </option>
              </select>
            </Field>

            <Field label="MINIMUM">
              <input
                type="number"
                min="0"
                step="0.01"
                value={
                  newPaymentMin
                }
                onChange={(
                  event
                ) =>
                  setNewPaymentMin(
                    event.target.value
                  )
                }
                style={inputStyle}
              />
            </Field>

            <Field label="MAXIMUM">
              <input
                type="number"
                min="0"
                step="0.01"
                value={
                  newPaymentMax
                }
                onChange={(
                  event
                ) =>
                  setNewPaymentMax(
                    event.target.value
                  )
                }
                style={inputStyle}
              />
            </Field>

            <Field label="FEE">
              <input
                type="number"
                min="0"
                step="0.01"
                value={
                  newPaymentFee
                }
                onChange={(
                  event
                ) =>
                  setNewPaymentFee(
                    event.target.value
                  )
                }
                style={inputStyle}
              />
            </Field>

            <button
              type="button"
              onClick={
                addPaymentTariffBand
              }
              disabled={
                addingPaymentTariff
              }
              style={orangeButtonStyle}
            >
              {addingPaymentTariff
                ? "ADDING..."
                : "ADD BAND"}
            </button>
          </div>

          <PaymentTariffTable
            title="M-PESA → I&M CHARGES"
            method="MPESA_TO_IM"
            rows={
              paymentTariffs
            }
            savingId={
              savingPaymentTariffId
            }
            deletingId={
              deletingPaymentTariffId
            }
            onChange={
              updatePaymentTariffField
            }
            onSave={
              savePaymentTariff
            }
            onDelete={
              deletePaymentTariff
            }
          />

          <PaymentTariffTable
            title="I&M → M-PESA CHARGES"
            method="IM_TO_MPESA"
            rows={
              paymentTariffs
            }
            savingId={
              savingPaymentTariffId
            }
            deletingId={
              deletingPaymentTariffId
            }
            onChange={
              updatePaymentTariffField
            }
            onSave={
              savePaymentTariff
            }
            onDelete={
              deletePaymentTariff
            }
          />

          <div style={testerBoxStyle}>
            <div style={testerGridStyle}>
              <Field label="TEST METHOD">
                <select
                  value={
                    paymentTestMethod
                  }
                  onChange={(
                    event
                  ) => {
                    setPaymentTestMethod(
                      event.target.value
                    );

                    setPaymentTestResult(
                      null
                    );
                  }}
                  style={inputStyle}
                >
                  <option value="MPESA_TO_IM">
                    M-PESA → I&M
                  </option>

                  <option value="IM_TO_MPESA">
                    I&M → M-PESA
                  </option>
                </select>
              </Field>

              <Field label="AMOUNT">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    paymentTestAmount
                  }
                  onChange={(
                    event
                  ) => {
                    setPaymentTestAmount(
                      event.target.value
                    );

                    setPaymentTestResult(
                      null
                    );
                  }}
                  style={inputStyle}
                />
              </Field>

              <Field label="CALCULATED FEE">
                <div style={testResultStyle}>
                  KES{" "}
                  {money(
                    paymentTestResult ??
                      0
                  )}
                </div>
              </Field>
            </div>

            <button
              type="button"
              onClick={
                testPaymentFee
              }
              disabled={
                testingPaymentFee
              }
              style={testButtonStyle}
            >
              {testingPaymentFee
                ? "CHECKING..."
                : "TEST BANK PAYMENT FEE"}
            </button>
          </div>
        </div>
      </section>

      {/* ========================================= */}
      {/* CASHIER ACCOUNTS */}
      {/* ========================================= */}

      <section style={panelStyle}>
        <div style={cashierTitleStyle}>
          APPROVED CASHIER PAYMENT ACCOUNTS
        </div>

        <div style={bodyStyle}>
          <div style={importantNoticeStyle}>
            These are the accounts that feed the Accountant
            recipient list. Add every approved shop/cashier here.
            Do not delete old recipients that have transaction
            history; switch Active off instead.
          </div>

          <div style={newCashierGridStyle}>
            <Field label="SHOP">
              <select
                value={
                  newRecipient.shop_id
                }
                onChange={(
                  event
                ) =>
                  setNewRecipient(
                    (
                      current
                    ) => ({
                      ...current,

                      shop_id:
                        event.target.value,
                    })
                  )
                }
                style={inputStyle}
              >
                <option value="">
                  Select shop
                </option>

                {shops
                  .filter(
                    (shop) =>
                      shop?.is_active !==
                      false
                  )
                  .map(
                    (shop) => (
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
                  )}
              </select>
            </Field>

            <Field label="SLOT">
              <input
                type="number"
                min="1"
                max="50"
                value={
                  newRecipient.slot_number
                }
                onChange={(
                  event
                ) =>
                  setNewRecipient(
                    (
                      current
                    ) => ({
                      ...current,

                      slot_number:
                        event.target.value,
                    })
                  )
                }
                style={inputStyle}
              />
            </Field>

            <Field label="CASHIER NAME">
              <input
                value={
                  newRecipient.recipient_name
                }
                onChange={(
                  event
                ) =>
                  setNewRecipient(
                    (
                      current
                    ) => ({
                      ...current,

                      recipient_name:
                        event.target.value,
                    })
                  )
                }
                style={inputStyle}
              />
            </Field>

            <Field label="M-PESA NUMBER">
              <input
                value={
                  newRecipient.phone_number
                }
                onChange={(
                  event
                ) =>
                  setNewRecipient(
                    (
                      current
                    ) => ({
                      ...current,

                      phone_number:
                        event.target.value,
                    })
                  )
                }
                placeholder="07XXXXXXXX"
                style={inputStyle}
              />
            </Field>

            <Field label="I&M REFERENCE">
              <input
                value={
                  newRecipient.im_reference
                }
                onChange={(
                  event
                ) =>
                  setNewRecipient(
                    (
                      current
                    ) => ({
                      ...current,

                      im_reference:
                        event.target.value,
                    })
                  )
                }
                placeholder="e.g. KINGS-TERRY"
                style={inputStyle}
              />
            </Field>
          </div>

          <div style={cashierToggleLineStyle}>
            <Toggle
              label="M-Pesa → M-Pesa"
              checked={
                newRecipient.allow_mpesa_to_mpesa
              }
              onChange={(
                value
              ) =>
                setNewRecipient(
                  (
                    current
                  ) => ({
                    ...current,

                    allow_mpesa_to_mpesa:
                      value,
                  })
                )
              }
            />

            <Toggle
              label="I&M → M-Pesa"
              checked={
                newRecipient.allow_im_to_mpesa
              }
              onChange={(
                value
              ) =>
                setNewRecipient(
                  (
                    current
                  ) => ({
                    ...current,

                    allow_im_to_mpesa:
                      value,
                  })
                )
              }
            />

            <Toggle
              label="Active"
              checked={
                newRecipient.is_active
              }
              onChange={(
                value
              ) =>
                setNewRecipient(
                  (
                    current
                  ) => ({
                    ...current,

                    is_active:
                      value,
                  })
                )
              }
            />
          </div>

          <button
            type="button"
            onClick={
              addRecipient
            }
            disabled={
              addingRecipient
            }
            style={cashierAddButtonStyle}
          >
            {addingRecipient
              ? "ADDING CASHIER..."
              : "+ ADD CASHIER PAYMENT ACCOUNT"}
          </button>

          <div style={cashierTableWrapStyle}>
            <div style={cashierHeaderStyle}>
              <div>
                SHOP
              </div>

              <div>
                SLOT
              </div>

              <div>
                CASHIER
              </div>

              <div>
                M-PESA
              </div>

              <div>
                I&M REF
              </div>

              <div>
                M→M
              </div>

              <div>
                I&M→M
              </div>

              <div>
                ACTIVE
              </div>

              <div>
                SAVE
              </div>
            </div>

            {sortedRecipients.map(
              (
                recipient
              ) => (
                <div
                  key={
                    recipient.id
                  }
                  style={cashierRowStyle}
                >
                  <select
                    value={
                      recipient.shop_id ||
                      ""
                    }
                    onChange={(
                      event
                    ) =>
                      updateRecipientField(
                        recipient.id,
                        "shop_id",
                        event.target.value
                      )
                    }
                    style={smallInputStyle}
                  >
                    {shops.map(
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
                    )}
                  </select>

                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={
                      recipient.slot_number ??
                      ""
                    }
                    onChange={(
                      event
                    ) =>
                      updateRecipientField(
                        recipient.id,
                        "slot_number",
                        event.target.value
                      )
                    }
                    style={smallInputStyle}
                  />

                  <input
                    value={
                      recipient.recipient_name ||
                      ""
                    }
                    onChange={(
                      event
                    ) =>
                      updateRecipientField(
                        recipient.id,
                        "recipient_name",
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
                  onChange={(
                    event
                  ) =>
                    updateRecipientField(
                      recipient.id,
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
                  onChange={(
                    value
                  ) =>
                    updateRecipientField(
                      recipient.id,
                      "allow_mpesa_to_mpesa",
                      value
                    )
                  }
                />

                <CenterCheck
                  checked={
                    recipient.allow_im_to_mpesa !==
                    false
                  }
                  onChange={(
                    value
                  ) =>
                    updateRecipientField(
                      recipient.id,
                      "allow_im_to_mpesa",
                      value
                    )
                  }
                />

                <CenterCheck
                  checked={
                    recipient.is_active !==
                    false
                  }
                  onChange={(
                    value
                  ) =>
                    updateRecipientField(
                      recipient.id,
                      "is_active",
                      value
                    )
                  }
                />

                <button
                  type="button"
                  onClick={() =>
                    saveRecipient(
                      recipient
                    )
                  }
                  disabled={
                    savingRecipientId ===
                    String(
                      recipient.id
                    )
                  }
                  style={saveButtonStyle}
                >
                  {savingRecipientId ===
                  String(
                    recipient.id
                  )
                    ? "SAVING..."
                    : "SAVE"}
                </button>
              </div>
            )
          )}
        </div>
      </div>
    </section>

    {/* ========================================= */}
    {/* EXISTING M-PESA RATE MANAGEMENT */}
    {/* ========================================= */}

    <section style={panelStyle}>
      <div style={purpleTitleStyle}>
        ADD NEW M-PESA FEE BAND
      </div>

      <div style={bodyStyle}>
        <div style={newRateGridStyle}>
          <Field label="FEE TYPE / FLOW">
            <input
              list="mpesa-fee-types"
              value={
                newFlow
              }
              onChange={(
                event
              ) =>
                setNewFlow(
                  event.target.value
                )
              }
              placeholder="Example: CASHIER_RETURN"
              style={inputStyle}
            />

            <datalist id="mpesa-fee-types">
              {feeTypes.map(
                (
                  type
                ) => (
                  <option
                    key={
                      type
                    }
                    value={
                      type
                    }
                  />
                )
              )}
            </datalist>
          </Field>

          <Field label="MINIMUM AMOUNT">
            <input
              type="number"
              min="0"
              step="0.01"
              value={
                newMinimum
              }
              onChange={(
                event
              ) =>
                setNewMinimum(
                  event.target.value
                )
              }
              style={inputStyle}
            />
          </Field>

          <Field label="MAXIMUM AMOUNT">
            <input
              type="number"
              min="0"
              step="0.01"
              value={
                newMaximum
              }
              onChange={(
                event
              ) =>
                setNewMaximum(
                  event.target.value
                )
              }
              style={inputStyle}
            />
          </Field>

          <Field label="SAFARICOM FEE">
            <input
              type="number"
              min="0"
              step="0.01"
              value={
                newFee
              }
              onChange={(
                event
              ) =>
                setNewFee(
                  event.target.value
                )
              }
              style={inputStyle}
            />
          </Field>
        </div>

        <div style={dateGridStyle}>
          <Field label="EFFECTIVE FROM">
            <input
              type="date"
              value={
                effectiveFrom
              }
              onChange={(
                event
              ) =>
                setEffectiveFrom(
                  event.target.value
                )
              }
              style={inputStyle}
            />
          </Field>

          <Field label="EFFECTIVE TO">
            <input
              type="date"
              value={
                effectiveTo
              }
              onChange={(
                event
              ) =>
                setEffectiveTo(
                  event.target.value
                )
              }
              style={inputStyle}
            />
          </Field>
        </div>

        <div style={noteWrapStyle}>
          <label style={labelStyle}>
            ADMIN NOTE
          </label>

          <textarea
            value={
              newNote
            }
            onChange={(
              event
            ) =>
              setNewNote(
                event.target.value
              )
            }
            rows={2}
            style={textareaStyle}
          />
        </div>

        <button
          type="button"
          onClick={
            addBand
          }
          disabled={
            adding
          }
          style={addButtonStyle}
        >
          {adding
            ? "ADDING RATE..."
            : "ADD M-PESA RATE"}
        </button>
      </div>
    </section>

    {/* ========================================= */}
    {/* CURRENT M-PESA RATES */}
    {/* ========================================= */}

    <section style={panelStyle}>
      <div style={greenTitleStyle}>
        CURRENT M-PESA RATE BANDS
      </div>

      {rates.length ===
      0 ? (
        <div style={emptyStyle}>
          No M-Pesa rate bands were returned.
        </div>
      ) : (
        <>
          <div style={rateHeaderStyle}>
            <div>
              TYPE
            </div>

            <div>
              MIN
            </div>

            <div>
              MAX
            </div>

            <div>
              FEE
            </div>

            <div>
              ACTIVE
            </div>

            <div>
              EFFECTIVE
            </div>

            <div>
              SAVE
            </div>

            <div>
              DELETE
            </div>
          </div>

          {rates.map(
            (
              rate,
              index
            ) => {
              const id =
                rate?.id ||
                `rate-${index}`;

              const actualId =
                rate?.id;

              return (
                <div
                  key={
                    id
                  }
                  style={rateRowStyle}
                >
                  <input
                    value={
                      getRateType(
                        rate
                      )
                    }
                    onChange={(
                      event
                    ) =>
                      updateRateField(
                        actualId,
                        "fee_type",
                        event.target.value
                      )
                    }
                    style={smallInputStyle}
                  />

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      getMinimum(
                        rate
                      )
                    }
                    onChange={(
                      event
                    ) =>
                      updateRateField(
                        actualId,
                        "min_amount",
                        event.target.value
                      )
                    }
                    style={smallInputStyle}
                  />

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      getMaximum(
                        rate
                      )
                    }
                    onChange={(
                      event
                    ) =>
                      updateRateField(
                        actualId,
                        "max_amount",
                        event.target.value
                      )
                    }
                    style={smallInputStyle}
                  />

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      getFee(
                        rate
                      )
                    }
                    onChange={(
                      event
                    ) =>
                      updateRateField(
                        actualId,
                        "fee",
                        event.target.value
                      )
                    }
                    style={smallInputStyle}
                  />

                  <label style={activeToggleStyle}>
                    <input
                      type="checkbox"
                      checked={
                        getIsActive(
                          rate
                        )
                      }
                      onChange={(
                        event
                      ) =>
                        updateRateField(
                          actualId,
                          "is_active",
                          event.target.checked
                        )
                      }
                    />

                    <span>
                      {getIsActive(
                        rate
                      )
                        ? "ACTIVE"
                        : "OFF"}
                    </span>
                  </label>

                  <div style={effectiveStyle}>
                    <div>
                      {rate?.effective_from ||
                        "-"}
                    </div>

                    <div>
                      to{" "}
                      {rate?.effective_to ||
                        "OPEN"}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      saveRate(
                        rate
                      )
                    }
                    disabled={
                      !actualId ||
                      savingId ===
                        String(
                          actualId
                        ) ||
                      Boolean(
                        deletingId
                      )
                    }
                    style={saveButtonStyle}
                  >
                    {savingId ===
                    String(
                      actualId
                    )
                      ? "SAVING..."
                      : "SAVE"}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      deleteRate(
                        rate
                      )
                    }
                    disabled={
                      !actualId ||
                      deletingId ===
                        String(
                          actualId
                        ) ||
                      Boolean(
                        savingId
                      )
                    }
                    style={deleteButtonStyle}
                  >
                    {deletingId ===
                    String(
                      actualId
                    )
                      ? "DELETING..."
                      : "DELETE"}
                  </button>
                </div>
              );
            }
          )}
        </>
      )}
    </section>

    {/* ========================================= */}
    {/* M-PESA FEE TEST */}
    {/* ========================================= */}

    <section style={panelStyle}>
      <div style={blueTitleStyle}>
        M-PESA FEE TEST
      </div>

      <div style={bodyStyle}>
        <div style={testGridStyle}>
          <Field label="FEE TYPE">
            <input
              list="mpesa-test-types"
              value={
                testFeeType
              }
              onChange={(
                event
              ) => {
                setTestFeeType(
                  event.target.value
                );

                setTestResult(
                  null
                );
              }}
              style={inputStyle}
            />

            <datalist id="mpesa-test-types">
              {feeTypes.map(
                (
                  type
                ) => (
                  <option
                    key={
                      type
                    }
                    value={
                      type
                    }
                  />
                )
              )}
            </datalist>
          </Field>

          <Field label="TRANSACTION AMOUNT">
            <input
              type="number"
              min="0"
              step="0.01"
              value={
                testAmount
              }
              onChange={(
                event
              ) => {
                setTestAmount(
                  event.target.value
                );

                setTestResult(
                  null
                );
              }}
              style={inputStyle}
            />
          </Field>

          <Field label="CALCULATED FEE">
            <div style={testResultStyle}>
              KES{" "}
              {money(
                testResult ??
                  0
              )}
            </div>
          </Field>
        </div>

        <button
          type="button"
          onClick={
            testFee
          }
          disabled={
            testing
          }
          style={testButtonStyle}
        >
          {testing
            ? "CHECKING..."
            : "TEST TRANSACTION FEE"}
        </button>
      </div>
    </section>

    <div style={footerNoticeStyle}>
      Payment-method changes affect new transactions only.
      Historical transactions keep the payment method and fee
      already recorded at the time they were completed.
    </div>
  </div>
);
}

// ==================================================
// PAYMENT METHOD BOX
// ==================================================

function PaymentMethodBox({
title,
value,
options,
onChange,
}) {
return (
  <div style={methodBoxStyle}>
    <div style={methodTitleStyle}>
      {title}
    </div>

    {options.map(
      ([
        method,
        label,
      ]) => (
        <label
          key={
            method
          }
          style={radioLineStyle}
        >
          <input
            type="radio"
            name={
              title
            }
            checked={
              value ===
              method
            }
            onChange={() =>
              onChange(
                method
              )
            }
          />

          <span>
            {label}
          </span>
        </label>
      )
    )}
  </div>
);
}

// ==================================================
// PAYMENT TARIFF TABLE
// ==================================================

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
const filtered =
  rows.filter(
    (
      row
    ) =>
      row?.payment_method ===
      method
  );

return (
  <div style={subTableStyle}>
    <div style={subTableTitleStyle}>
      {title}
    </div>

    <div style={tariffHeaderStyle}>
      <div>
        MIN
      </div>

      <div>
        MAX
      </div>

      <div>
        FEE
      </div>

      <div>
        ACTIVE
      </div>

      <div>
        SAVE
      </div>

      <div>
        DELETE
      </div>
    </div>

    {filtered.length ===
    0 ? (
      <div style={emptyStyle}>
        No tariff bands.
      </div>
    ) : (
      filtered.map(
        (
          row
        ) => (
          <div
            key={
              row.id
            }
            style={tariffRowStyle}
          >
            <input
              type="number"
              min="0"
              step="0.01"
              value={
                row.min_amount ??
                ""
              }
              onChange={(
                event
              ) =>
                onChange(
                  row.id,
                  "min_amount",
                  event.target.value
                )
              }
              style={smallInputStyle}
            />

            <input
              type="number"
              min="0"
              step="0.01"
              value={
                row.max_amount ??
                ""
              }
              onChange={(
                event
              ) =>
                onChange(
                  row.id,
                  "max_amount",
                  event.target.value
                )
              }
              style={smallInputStyle}
            />

            <input
              type="number"
              min="0"
              step="0.01"
              value={
                row.fee ??
                ""
              }
              onChange={(
                event
              ) =>
                onChange(
                  row.id,
                  "fee",
                  event.target.value
                )
              }
              style={smallInputStyle}
            />

            <label style={activeToggleStyle}>
              <input
                type="checkbox"
                checked={
                  row.is_active !==
                  false
                }
                onChange={(
                  event
                ) =>
                  onChange(
                    row.id,
                    "is_active",
                    event.target.checked
                  )
                }
              />

              <span>
                {row.is_active !==
                false
                  ? "ACTIVE"
                  : "OFF"}
              </span>
            </label>

            <button
              type="button"
              onClick={() =>
                onSave(
                  row
                )
              }
              disabled={
                savingId ===
                String(
                  row.id
                )
              }
              style={saveButtonStyle}
            >
              {savingId ===
              String(
                row.id
              )
                ? "SAVING..."
                : "SAVE"}
            </button>

            <button
              type="button"
              onClick={() =>
                onDelete(
                  row
                )
              }
              disabled={
                deletingId ===
                String(
                  row.id
                )
              }
              style={deleteButtonStyle}
            >
              {deletingId ===
              String(
                row.id
              )
                ? "DELETING..."
                : "DELETE"}
            </button>
          </div>
        )
      )
    )}
  </div>
);
}

// ==================================================
// FIELD
// ==================================================

function Field({
label,
children,
}) {
return (
  <div>
    <label style={labelStyle}>
      {label}
    </label>

    {children}
  </div>
);
}

// ==================================================
// TOGGLE
// ==================================================

function Toggle({
label,
checked,
onChange,
}) {
return (
  <label style={checkLineStyle}>
    <input
      type="checkbox"
      checked={
        Boolean(
          checked
        )
      }
      onChange={(
        event
      ) =>
        onChange(
          event.target.checked
        )
      }
    />

    {label}
  </label>
);
}

// ==================================================
// CENTER CHECK
// ==================================================

function CenterCheck({
checked,
onChange,
}) {
return (
  <div style={centerStyle}>
    <input
      type="checkbox"
      checked={
        Boolean(
          checked
        )
      }
      onChange={(
        event
      ) =>
        onChange(
          event.target.checked
        )
      }
    />
  </div>
);
}

// ==================================================
// NORMALISE M-PESA RATES
// ==================================================

function normaliseRates(
value
) {
let rows = [];

if (
  Array.isArray(
    value
  )
) {
  rows =
    value;
} else if (
  Array.isArray(
    value?.rates
  )
) {
  rows =
    value.rates;
} else if (
  Array.isArray(
    value?.data
  )
) {
  rows =
    value.data;
} else if (
  value &&
  typeof value ===
    "object"
) {
  rows =
    Object.values(
      value
    ).filter(
      (
        item
      ) =>
        item &&
        typeof item ===
          "object" &&
        !Array.isArray(
          item
        )
    );
}

return rows.map(
  (
    rate
  ) => ({
    ...rate,

    fee_type:
      rate?.fee_type ??
      rate?.flow ??
      "",

    min_amount:
      rate?.min_amount ??
      rate?.minimum_amount ??
      0,

    max_amount:
      rate?.max_amount ??
      rate?.maximum_amount ??
      0,

    fee:
      rate?.fee ??
      rate?.fee_amount ??
      0,

    is_active:
      rate?.is_active !==
      false,
  })
);
}

// ==================================================
// RATE HELPERS
// ==================================================

function getRateType(
rate
) {
return String(
  rate?.fee_type ??
    rate?.flow ??
    ""
);
}

function getMinimum(
rate
) {
return (
  rate?.min_amount ??
  rate?.minimum_amount ??
  0
);
}

function getMaximum(
rate
) {
return (
  rate?.max_amount ??
  rate?.maximum_amount ??
  0
);
}

function getFee(
rate
) {
return (
  rate?.fee ??
  rate?.fee_amount ??
  0
);
}

function getIsActive(
rate
) {
return (
  rate?.is_active !==
  false
);
}

// ==================================================
// HELPERS
// ==================================================

async function safeJson(
response
) {
try {
  return await response.json();
} catch {
  return null;
}
}

function extractNumericResult(
value
) {
if (
  typeof value ===
  "number"
) {
  return value;
}

if (
  typeof value ===
    "string" &&
  value !==
    ""
) {
  const numeric =
    Number(
      value
    );

  if (
    Number.isFinite(
      numeric
    )
  ) {
    return numeric;
  }
}

if (
  Array.isArray(
    value
  ) &&
  value.length >
    0
) {
  return extractNumericResult(
    value[0]
  );
}

if (
  value &&
  typeof value ===
    "object"
) {
  const candidates = [
    value.fee,
    value.fee_amount,
    value.transaction_fee,
    value.result,
    value.amount,
  ];

  for (
    const candidate of
    candidates
  ) {
    const numeric =
      Number(
        candidate
      );

    if (
      Number.isFinite(
        numeric
      )
    ) {
      return numeric;
    }
  }
}

return 0;
}

function money(
value
) {
const numeric =
  Number(
    value ??
      0
  );

return (
  Number.isFinite(
    numeric
  )
    ? numeric
    : 0
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

function getNairobiDate() {
const parts =
  new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone:
        "Africa/Nairobi",

      year:
        "numeric",

      month:
        "2-digit",

      day:
        "2-digit",
    }
  ).formatToParts(
    new Date()
  );

const year =
  parts.find(
    (
      part
    ) =>
      part.type ===
      "year"
  )?.value;

const month =
  parts.find(
    (
      part
    ) =>
      part.type ===
      "month"
  )?.value;

const day =
  parts.find(
    (
      part
    ) =>
      part.type ===
      "day"
  )?.value;

return `${year}-${month}-${day}`;
}

function methodLabel(
value
) {
switch (
  value
) {
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
// STYLES
// ==================================================

const wrapperStyle = {
display:
  "grid",

gap:
  "14px",
};

const loadingPageStyle = {
padding:
  "30px",

textAlign:
  "center",

color:
  "#475569",

fontWeight:
  "bold",
};

const heroStyle = {
padding:
  "16px",

borderRadius:
  "7px",

background:
  "linear-gradient(90deg,#047857,#0f766e)",

color:
  "white",

display:
  "flex",

justifyContent:
  "space-between",

alignItems:
  "center",

gap:
  "15px",

flexWrap:
  "wrap",
};

const heroTitleStyle = {
fontSize:
  "17px",

fontWeight:
  "900",
};

const heroSubtitleStyle = {
marginTop:
  "4px",

color:
  "#d1fae5",

fontSize:
  "10px",
};

const refreshButtonStyle = {
border:
  "1px solid rgba(255,255,255,0.5)",

borderRadius:
  "5px",

backgroundColor:
  "rgba(255,255,255,0.12)",

color:
  "white",

padding:
  "9px 13px",

fontWeight:
  "bold",

cursor:
  "pointer",
};

const panelStyle = {
backgroundColor:
  "white",

border:
  "1px solid #cbd5e1",

borderRadius:
  "7px",

overflow:
  "hidden",
};

const bodyStyle = {
padding:
  "13px",
};

const darkTitleStyle = {
padding:
  "11px 13px",

backgroundColor:
  "#0f172a",

color:
  "white",

fontSize:
  "12px",

fontWeight:
  "900",
};

const bankTitleStyle = {
padding:
  "11px 13px",

backgroundColor:
  "#1d4ed8",

color:
  "white",

fontSize:
  "12px",

fontWeight:
  "900",
};

const orangeTitleStyle = {
padding:
  "11px 13px",

backgroundColor:
  "#c2410c",

color:
  "white",

fontSize:
  "12px",

fontWeight:
  "900",
};

const cashierTitleStyle = {
padding:
  "11px 13px",

backgroundColor:
  "#0f766e",

color:
  "white",

fontSize:
  "12px",

fontWeight:
  "900",
};

const purpleTitleStyle = {
padding:
  "11px 13px",

backgroundColor:
  "#7c3aed",

color:
  "white",

fontSize:
  "12px",

fontWeight:
  "900",
};

const greenTitleStyle = {
padding:
  "11px 13px",

backgroundColor:
  "#047857",

color:
  "white",

fontSize:
  "12px",

fontWeight:
  "900",
};

const blueTitleStyle = {
padding:
  "11px 13px",

backgroundColor:
  "#0369a1",

color:
  "white",

fontSize:
  "12px",

fontWeight:
  "900",
};

const messageStyle = {
padding:
  "10px",

borderRadius:
  "5px",

fontSize:
  "10px",

fontWeight:
  "bold",
};

const systemGridStyle = {
display:
  "grid",

gridTemplateColumns:
  "repeat(auto-fit,minmax(260px,1fr))",

gap:
  "12px",
};

const methodBoxStyle = {
border:
  "1px solid #cbd5e1",

borderRadius:
  "6px",

padding:
  "12px",

backgroundColor:
  "#f8fafc",
};

const methodTitleStyle = {
fontSize:
  "10px",

fontWeight:
  "900",

marginBottom:
  "9px",

color:
  "#334155",
};

const radioLineStyle = {
display:
  "flex",

alignItems:
  "center",

gap:
  "8px",

margin:
  "7px 0",

fontSize:
  "11px",

fontWeight:
  "bold",
};

const controlSummaryStyle = {
marginTop:
  "10px",

padding:
  "10px",

backgroundColor:
  "#f1f5f9",

borderRadius:
  "5px",

fontSize:
  "10px",

color:
  "#334155",
};

const saveWideButtonStyle = {
width:
  "100%",

marginTop:
  "10px",

padding:
  "10px",

border:
  "none",

borderRadius:
  "5px",

backgroundColor:
  "#0f172a",

color:
  "white",

fontWeight:
  "bold",

cursor:
  "pointer",
};

const fourGridStyle = {
display:
  "grid",

gridTemplateColumns:
  "repeat(auto-fit,minmax(190px,1fr))",

gap:
  "10px",
};

const labelStyle = {
display:
  "block",

marginBottom:
  "5px",

color:
  "#334155",

fontSize:
  "9px",

fontWeight:
  "bold",
};

const inputStyle = {
width:
  "100%",

boxSizing:
  "border-box",

padding:
  "9px",

border:
  "1px solid #94a3b8",

borderRadius:
  "4px",

backgroundColor:
  "white",
};

const smallInputStyle = {
width:
  "100%",

boxSizing:
  "border-box",

padding:
  "7px",

border:
  "1px solid #cbd5e1",

borderRadius:
  "4px",

fontSize:
  "9px",
};

const checkLineStyle = {
display:
  "flex",

alignItems:
  "center",

gap:
  "7px",

marginTop:
  "10px",

fontSize:
  "10px",

fontWeight:
  "bold",

color:
  "#334155",
};

const bankSaveButtonStyle = {
width:
  "100%",

marginTop:
  "10px",

padding:
  "10px",

border:
  "none",

borderRadius:
  "5px",

backgroundColor:
  "#1d4ed8",

color:
  "white",

fontWeight:
  "bold",

cursor:
  "pointer",
};

const importantNoticeStyle = {
padding:
  "10px",

backgroundColor:
  "#fffbeb",

border:
  "1px solid #fde68a",

color:
  "#92400e",

borderRadius:
  "5px",

fontSize:
  "9px",

lineHeight:
  "1.5",

marginBottom:
  "10px",
};

const paymentAddGridStyle = {
display:
  "grid",

gridTemplateColumns:
  "1.3fr 1fr 1fr 1fr auto",

gap:
  "8px",

alignItems:
  "end",
};

const orangeButtonStyle = {
padding:
  "10px 14px",

border:
  "none",

borderRadius:
  "5px",

backgroundColor:
  "#c2410c",

color:
  "white",

fontWeight:
  "bold",

cursor:
  "pointer",
};

const subTableStyle = {
marginTop:
  "14px",

border:
  "1px solid #e2e8f0",

borderRadius:
  "6px",

overflow:
  "hidden",
};

const subTableTitleStyle = {
padding:
  "9px",

fontWeight:
  "900",

fontSize:
  "10px",

backgroundColor:
  "#f8fafc",

color:
  "#334155",
};

const tariffHeaderStyle = {
display:
  "grid",

gridTemplateColumns:
  "1fr 1fr 0.8fr 0.8fr 0.7fr 0.7fr",

gap:
  "6px",

padding:
  "8px",

backgroundColor:
  "#f1f5f9",

fontSize:
  "8px",

fontWeight:
  "bold",

textAlign:
  "center",
};

const tariffRowStyle = {
display:
  "grid",

gridTemplateColumns:
  "1fr 1fr 0.8fr 0.8fr 0.7fr 0.7fr",

gap:
  "6px",

padding:
  "8px",

alignItems:
  "center",

borderTop:
  "1px solid #e2e8f0",
};

const testerBoxStyle = {
marginTop:
  "14px",

padding:
  "10px",

backgroundColor:
  "#f8fafc",

borderRadius:
  "6px",

border:
  "1px solid #e2e8f0",
};

const testerGridStyle = {
display:
  "grid",

gridTemplateColumns:
  "1.2fr 1fr 1fr",

gap:
  "10px",

alignItems:
  "end",
};

const newCashierGridStyle = {
display:
  "grid",

gridTemplateColumns:
  "1.4fr 0.6fr 1.2fr 1fr 1fr",

gap:
  "8px",
};

const cashierToggleLineStyle = {
display:
  "flex",

gap:
  "16px",

flexWrap:
  "wrap",

alignItems:
  "center",

marginTop:
  "4px",
};

const cashierAddButtonStyle = {
width:
  "100%",

marginTop:
  "10px",

padding:
  "10px",

border:
  "none",

borderRadius:
  "5px",

backgroundColor:
  "#0f766e",

color:
  "white",

fontWeight:
  "bold",

cursor:
  "pointer",
};

const cashierTableWrapStyle = {
marginTop:
  "14px",

overflowX:
  "auto",
};

const cashierHeaderStyle = {
display:
  "grid",

gridTemplateColumns:
  "1.3fr 0.5fr 1.1fr 1fr 1fr 0.5fr 0.5fr 0.5fr 0.7fr",

gap:
  "5px",

minWidth:
  "1000px",

padding:
  "8px",

backgroundColor:
  "#f1f5f9",

fontSize:
  "8px",

fontWeight:
  "bold",

textAlign:
  "center",
};

const cashierRowStyle = {
display:
  "grid",

gridTemplateColumns:
  "1.3fr 0.5fr 1.1fr 1fr 1fr 0.5fr 0.5fr 0.5fr 0.7fr",

gap:
  "5px",

minWidth:
  "1000px",

padding:
  "8px",

borderTop:
  "1px solid #e2e8f0",

alignItems:
  "center",
};

const centerStyle = {
display:
  "flex",

justifyContent:
  "center",

alignItems:
  "center",
};

const newRateGridStyle = {
display:
  "grid",

gridTemplateColumns:
  "1.3fr 1fr 1fr 1fr",

gap:
  "10px",
};

const dateGridStyle = {
display:
  "grid",

gridTemplateColumns:
  "1fr 1fr",

gap:
  "10px",

marginTop:
  "10px",
};

const noteWrapStyle = {
marginTop:
  "10px",
};

const textareaStyle = {
width:
  "100%",

boxSizing:
  "border-box",

padding:
  "9px",

border:
  "1px solid #94a3b8",

borderRadius:
  "4px",

resize:
  "vertical",
};

const addButtonStyle = {
width:
  "100%",

marginTop:
  "10px",

padding:
  "10px",

border:
  "none",

borderRadius:
  "5px",

backgroundColor:
  "#7c3aed",

color:
  "white",

fontWeight:
  "bold",

cursor:
  "pointer",
};

const rateHeaderStyle = {
display:
  "grid",

gridTemplateColumns:
  "1.3fr 0.8fr 0.8fr 0.7fr 0.7fr 1fr 0.7fr 0.7fr",

gap:
  "6px",

padding:
  "8px",

backgroundColor:
  "#f1f5f9",

color:
  "#334155",

fontSize:
  "8px",

fontWeight:
  "bold",

textAlign:
  "center",
};

const rateRowStyle = {
display:
  "grid",

gridTemplateColumns:
  "1.3fr 0.8fr 0.8fr 0.7fr 0.7fr 1fr 0.7fr 0.7fr",

gap:
  "6px",

padding:
  "8px",

alignItems:
  "center",

borderTop:
  "1px solid #e2e8f0",
};

const activeToggleStyle = {
display:
  "flex",

alignItems:
  "center",

justifyContent:
  "center",

gap:
  "4px",

fontSize:
  "8px",

fontWeight:
  "bold",

color:
  "#166534",
};

const effectiveStyle = {
textAlign:
  "center",

fontSize:
  "8px",

color:
  "#64748b",

lineHeight:
  "1.4",
};

const saveButtonStyle = {
border:
  "none",

borderRadius:
  "4px",

padding:
  "8px",

backgroundColor:
  "#0284c7",

color:
  "white",

fontSize:
  "8px",

fontWeight:
  "bold",

cursor:
  "pointer",
};

const deleteButtonStyle = {
border:
  "none",

borderRadius:
  "4px",

padding:
  "8px",

backgroundColor:
  "#dc2626",

color:
  "white",

fontSize:
  "8px",

fontWeight:
  "bold",

cursor:
  "pointer",
};

const testGridStyle = {
display:
  "grid",

gridTemplateColumns:
  "1.2fr 1fr 1fr",

gap:
  "10px",

alignItems:
  "end",
};

const testResultStyle = {
minHeight:
  "36px",

padding:
  "9px",

boxSizing:
  "border-box",

border:
  "1px solid #86efac",

borderRadius:
  "4px",

backgroundColor:
  "#ecfdf5",

color:
  "#166534",

fontWeight:
  "900",
};

const testButtonStyle = {
width:
  "100%",

marginTop:
  "10px",

border:
  "none",

borderRadius:
  "5px",

padding:
  "10px",

backgroundColor:
  "#0369a1",

color:
  "white",

fontWeight:
  "bold",

cursor:
  "pointer",
};

const emptyStyle = {
padding:
  "18px",

textAlign:
  "center",

color:
  "#64748b",

fontSize:
  "10px",
};

const footerNoticeStyle = {
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

textAlign:
  "center",

fontSize:
  "9px",
};
 
