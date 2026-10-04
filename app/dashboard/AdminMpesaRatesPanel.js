"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

export default function AdminMpesaRatesPanel({
  user,
}) {
  const [rates, setRates] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [savingId, setSavingId] =
    useState("");

  const [deletingId, setDeletingId] =
    useState("");

  const [adding, setAdding] =
    useState(false);

  const [testing, setTesting] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [messageType, setMessageType] =
    useState("");

  const [
    newFlow,
    setNewFlow,
  ] = useState("");

  const [
    newMinimum,
    setNewMinimum,
  ] = useState("");

  const [
    newMaximum,
    setNewMaximum,
  ] = useState("");

  const [
    newFee,
    setNewFee,
  ] = useState("");

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

  const [
    newNote,
    setNewNote,
  ] = useState("");

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

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const accessToken =
    user?.access_token ||
    null;

  // ==================================================
  // HEADERS
  // ==================================================

  const authHeaders =
    useMemo(() => {
      return {
        apikey:
          supabaseAnonKey,

        Authorization:
          `Bearer ${accessToken}`,

        "Content-Type":
          "application/json",
      };
    }, [
      supabaseAnonKey,
      accessToken,
    ]);

  // ==================================================
  // LOAD RATES
  // ==================================================

  const loadRates =
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
          setMessage("");

          const response =
            await fetch(
              `${supabaseUrl}/rest/v1/rpc/tl_admin_mpesa_fee_rates`,
              {
                method:
                  "POST",

                headers:
                  authHeaders,

                body:
                  JSON.stringify(
                    {}
                  ),

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
                result?.hint ||
                "Unable to load M-Pesa rates."
            );
          }

          const loaded =
            normaliseRates(
              result
            );

          setRates(
            loaded
          );

          if (
            !testFeeType &&
            loaded.length >
              0
          ) {
            const firstType =
              getRateType(
                loaded[0]
              );

            if (firstType) {
              setTestFeeType(
                firstType
              );
            }
          }
        } catch (error) {
          console.error(
            "LOAD M-PESA RATES ERROR:",
            error
          );

          setMessage(
            error?.message ||
              "Unable to load M-Pesa rates."
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
        testFeeType,
      ]
    );

  // ==================================================
  // AUTO LOAD
  // ==================================================

  useEffect(() => {
    loadRates();
  }, [loadRates]);

  // ==================================================
  // UPDATE LOCAL RATE
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
            String(id)
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

  // ==================================================
  // SAVE EXISTING RATE
  // ==================================================

  async function saveRate(
    rate
  ) {
    if (!rate?.id) {
      setMessage(
        "This rate does not have a valid ID."
      );

      setMessageType(
        "error"
      );

      return;
    }

    const feeType =
      String(
        getRateType(
          rate
        ) || ""
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

    if (!feeType) {
      setMessage(
        "Fee type is required."
      );

      setMessageType(
        "error"
      );

      return;
    }

    if (
      !Number.isFinite(
        minAmount
      ) ||
      minAmount < 0
    ) {
      setMessage(
        "Enter a valid minimum amount."
      );

      setMessageType(
        "error"
      );

      return;
    }

    if (
      !Number.isFinite(
        maxAmount
      ) ||
      maxAmount <
        minAmount
    ) {
      setMessage(
        "Maximum amount must be equal to or higher than the minimum amount."
      );

      setMessageType(
        "error"
      );

      return;
    }

    if (
      !Number.isFinite(
        fee
      ) ||
      fee < 0
    ) {
      setMessage(
        "Enter a valid M-Pesa fee."
      );

      setMessageType(
        "error"
      );

      return;
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

    if (!confirmed) {
      return;
    }

    try {
      setSavingId(
        String(
          rate.id
        )
      );

      setMessage("");

      const response =
        await fetch(
          `${supabaseUrl}/rest/v1/rpc/tl_admin_save_mpesa_fee_rate`,
          {
            method:
              "POST",

            headers:
              authHeaders,

            body:
              JSON.stringify({
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
            result?.hint ||
            "Unable to update M-Pesa rate."
        );
      }

      setMessage(
        "M-Pesa rate updated successfully."
      );

      setMessageType(
        "success"
      );

      await loadRates();
    } catch (error) {
      console.error(
        "SAVE M-PESA RATE ERROR:",
        error
      );

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

  // ==================================================
  // DELETE RATE
  // ==================================================

  async function deleteRate(
    rate
  ) {
    if (!rate?.id) {
      return;
    }

    const confirmed =
      window.confirm(
        "DELETE M-PESA RATE\n\n" +
          `${getRateType(
            rate
          ) || "M-Pesa Rate"}\n` +
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

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(
        String(
          rate.id
        )
      );

      setMessage("");

      const response =
        await fetch(
          `${supabaseUrl}/rest/v1/rpc/tl_admin_delete_mpesa_fee_rate`,
          {
            method:
              "POST",

            headers:
              authHeaders,

            body:
              JSON.stringify({
                p_id:
                  rate.id,
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
            result?.hint ||
            "Unable to delete M-Pesa rate."
        );
      }

      setMessage(
        "M-Pesa rate deleted successfully."
      );

      setMessageType(
        "success"
      );

      await loadRates();
    } catch (error) {
      console.error(
        "DELETE M-PESA RATE ERROR:",
        error
      );

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

  // ==================================================
  // ADD NEW BAND
  // ==================================================

  async function addBand() {
    const flow =
      String(
        newFlow || ""
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

    if (!flow) {
      setMessage(
        "Enter the M-Pesa fee type / flow."
      );

      setMessageType(
        "error"
      );

      return;
    }

    if (
      newMinimum ===
        "" ||
      !Number.isFinite(
        minimum
      ) ||
      minimum < 0
    ) {
      setMessage(
        "Enter a valid minimum amount."
      );

      setMessageType(
        "error"
      );

      return;
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
      setMessage(
        "Enter a valid maximum amount."
      );

      setMessageType(
        "error"
      );

      return;
    }

    if (
      newFee === "" ||
      !Number.isFinite(
        fee
      ) ||
      fee < 0
    ) {
      setMessage(
        "Enter a valid M-Pesa fee."
      );

      setMessageType(
        "error"
      );

      return;
    }

    if (
      !effectiveFrom
    ) {
      setMessage(
        "Select the date the new rate becomes effective."
      );

      setMessageType(
        "error"
      );

      return;
    }

    if (
      effectiveTo &&
      effectiveTo <
        effectiveFrom
    ) {
      setMessage(
        "Effective To cannot be earlier than Effective From."
      );

      setMessageType(
        "error"
      );

      return;
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

    if (!confirmed) {
      return;
    }

    try {
      setAdding(true);
      setMessage("");

      const response =
        await fetch(
          `${supabaseUrl}/rest/v1/rpc/tl_admin_add_mpesa_fee_band`,
          {
            method:
              "POST",

            headers:
              authHeaders,

            body:
              JSON.stringify({
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
            result?.hint ||
            "Unable to add M-Pesa fee band."
        );
      }

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

      await loadRates();
    } catch (error) {
      console.error(
        "ADD M-PESA BAND ERROR:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to add M-Pesa fee band."
      );

      setMessageType(
        "error"
      );
    } finally {
      setAdding(false);
    }
  }

  // ==================================================
  // TEST FEE
  // ==================================================

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

    if (!feeType) {
      setMessage(
        "Enter a fee type to test."
      );

      setMessageType(
        "error"
      );

      return;
    }

    if (
      testAmount ===
        "" ||
      !Number.isFinite(
        amount
      ) ||
      amount < 0
    ) {
      setMessage(
        "Enter a valid amount to test."
      );

      setMessageType(
        "error"
      );

      return;
    }

    try {
      setTesting(true);
      setTestResult(null);
      setMessage("");

      const response =
        await fetch(
          `${supabaseUrl}/rest/v1/rpc/tl_mpesa_fee_for_amount`,
          {
            method:
              "POST",

            headers:
              authHeaders,

            body:
              JSON.stringify({
                p_fee_type:
                  feeType,

                p_amount:
                  roundMoney(
                    amount
                  ),
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
            result?.hint ||
            "Unable to calculate M-Pesa fee."
        );
      }

      const calculated =
        extractNumericResult(
          result
        );

      setTestResult(
        calculated
      );

      setMessage(
        "M-Pesa fee test completed."
      );

      setMessageType(
        "success"
      );
    } catch (error) {
      console.error(
        "TEST M-PESA FEE ERROR:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to test M-Pesa fee."
      );

      setMessageType(
        "error"
      );
    } finally {
      setTesting(false);
    }
  }

  // ==================================================
  // FEE TYPES
  // ==================================================

  const feeTypes =
    useMemo(() => {
      const values =
        rates
          .map(
            (rate) =>
              getRateType(
                rate
              )
          )
          .filter(
            Boolean
          );

      return [
        ...new Set(
          values
        ),
      ];
    }, [rates]);

  // ==================================================
  // DISPLAY
  // ==================================================

  return (
    <div style={wrapperStyle}>
      {/* ========================================= */}
      {/* CONTROL HEADER */}
      {/* ========================================= */}

      <section style={heroStyle}>
        <div>
          <div style={heroTitleStyle}>
            M-PESA TRANSACTION RATES
          </div>

          <div style={heroSubtitleStyle}>
            Admin-controlled Safaricom transaction fee schedule
          </div>
        </div>

        <button
          type="button"
          onClick={
            loadRates
          }
          disabled={
            loading
          }
          style={refreshButtonStyle}
        >
          {loading
            ? "Refreshing..."
            : "Refresh Rates"}
        </button>
      </section>

      <div style={importantNoticeStyle}>
        Safaricom rates do not update automatically from Safaricom.
        When Safaricom changes its charges, update the fee bands here.
        Completed historical transactions keep their recorded fees.
      </div>

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
      {/* NEW RATE */}
      {/* ========================================= */}

      <section style={panelStyle}>
        <div style={purpleTitleStyle}>
          ADD NEW M-PESA FEE BAND
        </div>

        <div style={bodyStyle}>
          <div style={newRateGridStyle}>
            <div>
              <label style={labelStyle}>
                FEE TYPE / FLOW
              </label>

              <input
                list="mpesa-fee-types"
                value={newFlow}
                onChange={(
                  event
                ) =>
                  setNewFlow(
                    event.target
                      .value
                  )
                }
                placeholder="Example: CASHIER_RETURN"
                style={inputStyle}
              />

              <datalist id="mpesa-fee-types">
                {feeTypes.map(
                  (type) => (
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
            </div>

            <div>
              <label style={labelStyle}>
                MINIMUM AMOUNT
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={newMinimum}
                onChange={(
                  event
                ) =>
                  setNewMinimum(
                    event.target
                      .value
                  )
                }
                placeholder="0"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>
                MAXIMUM AMOUNT
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={newMaximum}
                onChange={(
                  event
                ) =>
                  setNewMaximum(
                    event.target
                      .value
                  )
                }
                placeholder="100"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>
                SAFARICOM FEE
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={newFee}
                onChange={(
                  event
                ) =>
                  setNewFee(
                    event.target
                      .value
                  )
                }
                placeholder="0"
                style={inputStyle}
              />
            </div>
          </div>

          <div style={dateGridStyle}>
            <div>
              <label style={labelStyle}>
                EFFECTIVE FROM
              </label>

              <input
                type="date"
                value={
                  effectiveFrom
                }
                onChange={(
                  event
                ) =>
                  setEffectiveFrom(
                    event.target
                      .value
                  )
                }
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>
                EFFECTIVE TO
              </label>

              <input
                type="date"
                value={
                  effectiveTo
                }
                onChange={(
                  event
                ) =>
                  setEffectiveTo(
                    event.target
                      .value
                  )
                }
                style={inputStyle}
              />

              <div style={helpStyle}>
                Leave blank if the rate has no planned end date.
              </div>
            </div>
          </div>

          <div style={noteWrapStyle}>
            <label style={labelStyle}>
              ADMIN NOTE
            </label>

            <textarea
              value={newNote}
              onChange={(
                event
              ) =>
                setNewNote(
                  event.target
                    .value
                )
              }
              rows={2}
              placeholder="Example: Safaricom tariff update effective October 2026."
              style={textareaStyle}
            />
          </div>

          <button
            type="button"
            onClick={addBand}
            disabled={adding}
            style={addButtonStyle}
          >
            {adding
              ? "ADDING RATE..."
              : "ADD M-PESA RATE"}
          </button>
        </div>
      </section>

      {/* ========================================= */}
      {/* CURRENT RATES */}
      {/* ========================================= */}

      <section style={panelStyle}>
        <div style={greenTitleStyle}>
          CURRENT M-PESA RATE BANDS
        </div>

        {loading ? (
          <div style={loadingStyle}>
            Loading M-Pesa rates...
          </div>
        ) : rates.length ===
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

                const type =
                  getRateType(
                    rate
                  );

                const minimum =
                  getMinimum(
                    rate
                  );

                const maximum =
                  getMaximum(
                    rate
                  );

                const fee =
                  getFee(
                    rate
                  );

                const active =
                  getIsActive(
                    rate
                  );

                return (
                  <div
                    key={id}
                    style={rateRowStyle}
                  >
                    <input
                      value={
                        type
                      }
                      onChange={(
                        event
                      ) =>
                        updateRateField(
                          actualId,
                          "fee_type",
                          event.target
                            .value
                        )
                      }
                      style={smallInputStyle}
                    />

                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={
                        minimum
                      }
                      onChange={(
                        event
                      ) =>
                        updateRateField(
                          actualId,
                          "min_amount",
                          event.target
                            .value
                        )
                      }
                      style={smallInputStyle}
                    />

                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={
                        maximum
                      }
                      onChange={(
                        event
                      ) =>
                        updateRateField(
                          actualId,
                          "max_amount",
                          event.target
                            .value
                        )
                      }
                      style={smallInputStyle}
                    />

                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={
                        fee
                      }
                      onChange={(
                        event
                      ) =>
                        updateRateField(
                          actualId,
                          "fee",
                          event.target
                            .value
                        )
                      }
                      style={smallInputStyle}
                    />

                    <label style={activeToggleStyle}>
                      <input
                        type="checkbox"
                        checked={
                          active
                        }
                        onChange={(
                          event
                        ) =>
                          updateRateField(
                            actualId,
                            "is_active",
                            event.target
                              .checked
                          )
                        }
                      />

                      <span>
                        {active
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
                      onClick={() =>
                        saveRate(
                          rate
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
                      onClick={() =>
                        deleteRate(
                          rate
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
      {/* RATE TESTER */}
      {/* ========================================= */}

      <section style={panelStyle}>
        <div style={blueTitleStyle}>
          M-PESA FEE TEST
        </div>

        <div style={bodyStyle}>
          <div style={testGridStyle}>
            <div>
              <label style={labelStyle}>
                FEE TYPE
              </label>

              <input
                list="mpesa-test-types"
                value={
                  testFeeType
                }
                onChange={(
                  event
                ) => {
                  setTestFeeType(
                    event.target
                      .value
                  );

                  setTestResult(
                    null
                  );
                }}
                placeholder="CASHIER_RETURN"
                style={inputStyle}
              />

              <datalist id="mpesa-test-types">
                {feeTypes.map(
                  (type) => (
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
            </div>

            <div>
              <label style={labelStyle}>
                TRANSACTION AMOUNT
              </label>

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
                    event.target
                      .value
                  );

                  setTestResult(
                    null
                  );
                }}
                placeholder="Example: 100"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>
                CALCULATED FEE
              </label>

              <div style={testResultStyle}>
                {testResult ===
                null
                  ? "KES 0.00"
                  : `KES ${money(
                      testResult
                    )}`}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={testFee}
            disabled={testing}
            style={testButtonStyle}
          >
            {testing
              ? "CHECKING..."
              : "TEST TRANSACTION FEE"}
          </button>
        </div>
      </section>

      <div style={footerNoticeStyle}>
        Rate changes should be made only when Safaricom changes
        its official transaction charges. Test a sample amount
        after every update before using the new rates in live transactions.
      </div>
    </div>
  );
}

// ==================================================
// NORMALISE RATE RESULT
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
        (item) =>
          item &&
          typeof item ===
            "object" &&
          !Array.isArray(
            item
          )
      );
  }

  return rows.map(
    (rate) => ({
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
// RATE FIELD HELPERS
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
    value !== ""
  ) {
    const numeric =
      Number(value);

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
      value ?? 0
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
      (Number(value) +
        Number.EPSILON) *
        100
    ) / 100
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
      (part) =>
        part.type ===
        "year"
    )?.value;

  const month =
    parts.find(
      (part) =>
        part.type ===
        "month"
    )?.value;

  const day =
    parts.find(
      (part) =>
        part.type ===
        "day"
    )?.value;

  return `${year}-${month}-${day}`;
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

const importantNoticeStyle = {
  padding:
    "11px",

  backgroundColor:
    "#fffbeb",

  border:
    "1px solid #fde68a",

  color:
    "#92400e",

  borderRadius:
    "6px",

  fontSize:
    "10px",

  lineHeight:
    "1.5",
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

const bodyStyle = {
  padding:
    "13px",
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

const helpStyle = {
  marginTop:
    "4px",

  color:
    "#64748b",

  fontSize:
    "8px",
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

const loadingStyle = {
  padding:
    "22px",

  textAlign:
    "center",

  color:
    "#64748b",

  fontSize:
    "10px",
};

const emptyStyle = {
  padding:
    "22px",

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
