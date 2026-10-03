"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

const TABLE_NAME = "TABLE";

const READING_KINDS = [
  "OPENING",
  "CLOSING",
  "HANDOVER_9PM",
  "MIDNIGHT_CLOSE",
  "CLOSING_9AM",
];

export default function AdminPlatformCorrections({
  user,
  selectedShift,
  selectedShop,
  onChanged,
}) {
  const [platforms, setPlatforms] = useState([]);
  const [readings, setReadings] = useState([]);

  const [inputs, setInputs] = useState({});

  const [reason, setReason] = useState("");

  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState("");
  const [deletingId, setDeletingId] = useState("");

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const accessToken =
    user?.access_token || null;

  const adminProfileId =
    user?.profile_id || null;

  const shiftId =
    selectedShift?.id || null;

  const shopId =
    selectedShift?.shop_id ||
    selectedShop?.id ||
    null;

  // ==================================================
  // SHOP / SHIFT TYPE
  // ==================================================

  const shopType =
    normalizeShopType(
      selectedShop?.shop_type ||
        selectedShift?.shop_type ||
        ""
    );

  const shiftName =
    normalizeShiftName(
      selectedShift?.shift_name ||
        ""
    );

  const is24Hour =
    shopType === "24_HOUR" ||
    shiftName === "SHIFT1" ||
    shiftName === "SHIFT2";

  const isShift1 =
    is24Hour &&
    shiftName === "SHIFT1";

  const isShift2 =
    is24Hour &&
    shiftName === "SHIFT2";

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
  // READING MAP
  // ==================================================

  const readingMap =
    useMemo(() => {
      return buildLatestReadingMap(
        readings
      );
    }, [readings]);

  // ==================================================
  // CALCULATED OUTPUT
  // ==================================================

  const calculatedOutput =
    useMemo(() => {
      return calculateTotalOutput({
        platforms,
        readingMap,
        is24Hour,
        isShift1,
        isShift2,
      });
    }, [
      platforms,
      readingMap,
      is24Hour,
      isShift1,
      isShift2,
    ]);

  // ==================================================
  // LOAD PLATFORMS + READINGS
  // ==================================================

  const loadData =
    useCallback(
      async () => {
        if (
          !shiftId ||
          !shopId ||
          !supabaseUrl ||
          !supabaseAnonKey ||
          !accessToken
        ) {
          setPlatforms([]);
          setReadings([]);
          setInputs({});
          return;
        }

        try {
          setLoading(true);

          setMessage("");
          setMessageType("");

          // ========================================
          // 1. SHOP PLATFORMS
          // ========================================

          const platformResponse =
            await fetch(
              `${supabaseUrl}/rest/v1/shop_platforms` +
                `?shop_id=eq.${encodeURIComponent(
                  shopId
                )}` +
                `&select=id,shop_id,platform_name,reading_type,display_order,is_active` +
                `&order=display_order.asc`,
              {
                method: "GET",

                headers:
                  authHeaders,

                cache:
                  "no-store",
              }
            );

          const platformResult =
            await safeJson(
              platformResponse
            );

          if (!platformResponse.ok) {
            throw new Error(
              platformResult?.message ||
                platformResult?.details ||
                "Unable to load shop platforms."
            );
          }

          const loadedPlatforms =
            Array.isArray(
              platformResult
            )
              ? platformResult
              : [];

          setPlatforms(
            loadedPlatforms
          );

          // ========================================
          // 2. ALL SUPPORTED SHIFT READINGS
          // ========================================

          const readingResponse =
            await fetch(
              `${supabaseUrl}/rest/v1/platform_readings` +
                `?shift_id=eq.${encodeURIComponent(
                  shiftId
                )}` +
                `&reading_kind=in.(${READING_KINDS.join(
                  ","
                )})` +
                `&select=id,shift_id,platform_id,reading_kind,reading_value,recorded_at,recorded_by`,
              {
                method: "GET",

                headers:
                  authHeaders,

                cache:
                  "no-store",
              }
            );

          const readingResult =
            await safeJson(
              readingResponse
            );

          if (!readingResponse.ok) {
            throw new Error(
              readingResult?.message ||
                readingResult?.details ||
                "Unable to load platform readings."
            );
          }

          const loadedReadings =
            Array.isArray(
              readingResult
            )
              ? readingResult
              : [];

          setReadings(
            loadedReadings
          );

          // ========================================
          // 3. BUILD INPUT VALUES
          // ========================================

          const latestMap =
            buildLatestReadingMap(
              loadedReadings
            );

          const nextInputs = {};

          for (
            const platform
            of loadedPlatforms
          ) {
            for (
              const kind
              of READING_KINDS
            ) {
              const key =
                `${platform.id}-${kind}`;

              const reading =
                latestMap[key];

              nextInputs[key] =
                reading
                  ? String(
                      reading.reading_value ??
                        ""
                    )
                  : "";
            }
          }

          setInputs(
            nextInputs
          );
        } catch (error) {
          console.error(
            "LOAD ADMIN PLATFORM READINGS ERROR:",
            error
          );

          setMessage(
            error?.message ||
              "Unable to load platform readings."
          );

          setMessageType(
            "error"
          );
        } finally {
          setLoading(false);
        }
      },
      [
        shiftId,
        shopId,
        supabaseUrl,
        supabaseAnonKey,
        accessToken,
        authHeaders,
      ]
    );

  // ==================================================
  // SHIFT CHANGED
  // ==================================================

  useEffect(() => {
    setReason("");
    setMessage("");

    loadData();
  }, [loadData]);

  // ==================================================
  // VALIDATE ACTION
  // ==================================================

  function validateAction() {
    if (!shiftId) {
      setMessage(
        "Select a shift first."
      );

      setMessageType(
        "error"
      );

      return false;
    }

    if (!shopId) {
      setMessage(
        "Shop information is missing."
      );

      setMessageType(
        "error"
      );

      return false;
    }

    if (!adminProfileId) {
      setMessage(
        "Admin profile ID is missing. Please log in again."
      );

      setMessageType(
        "error"
      );

      return false;
    }

    const cleanReason =
      String(
        reason || ""
      ).trim();

    if (
      cleanReason.length < 3
    ) {
      setMessage(
        "Enter a platform correction reason first."
      );

      setMessageType(
        "error"
      );

      return false;
    }

    return true;
  }

  // ==================================================
  // SAVE READING
  //
  // UNIVERSAL PLATFORM RULE:
  // Negative = VALID
  // Zero     = VALID
  // Positive = VALID
  //
  // Only blank or non-finite values are invalid.
  // ==================================================

  async function saveReading({
    platform,
    kind,
  }) {
    if (!validateAction()) {
      return;
    }

    if (
      !readingAllowed({
        platform,
        kind,
        is24Hour,
        isShift1,
        isShift2,
      })
    ) {
      setMessage(
        `${kind} is not applicable to ${platform.platform_name} for this shift.`
      );

      setMessageType(
        "error"
      );

      return;
    }

    const inputKey =
      `${platform.id}-${kind}`;

    const rawValue =
      inputs[inputKey] ?? "";

    if (
      rawValue === "" ||
      rawValue === null ||
      rawValue === undefined
    ) {
      setMessage(
        "Enter a valid platform reading."
      );

      setMessageType(
        "error"
      );

      return;
    }

    const value =
      Number(rawValue);

    if (
      !Number.isFinite(
        value
      )
    ) {
      setMessage(
        "Enter a valid platform reading."
      );

      setMessageType(
        "error"
      );

      return;
    }

    const existing =
      readingMap[inputKey];

    const cleanReason =
      String(
        reason
      ).trim();

    const confirmed =
      window.confirm(
        "ADMIN PLATFORM CORRECTION\n\n" +
          `${platform.platform_name}\n` +
          `${readingLabel(
            kind
          )}: ${money(
            value
          )}\n\n` +
          `${
            existing
              ? "Update this reading?"
              : "Add this missing reading?"
          }`
      );

    if (!confirmed) {
      return;
    }

    try {
      setSavingKey(
        inputKey
      );

      setMessage("");
      setMessageType("");

      let changedRecord = null;
      let oldData = {};

      // ========================================
      // UPDATE EXISTING
      // ========================================

      if (existing) {
        oldData = {
          ...existing,
        };

        const response =
          await fetch(
            `${supabaseUrl}/rest/v1/platform_readings` +
              `?id=eq.${encodeURIComponent(
                existing.id
              )}`,
            {
              method:
                "PATCH",

              headers: {
                ...authHeaders,

                Prefer:
                  "return=representation",
              },

              body:
                JSON.stringify({
                  reading_value:
                    roundMoney(
                      value
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
              "Unable to update platform reading."
          );
        }

        if (
          !Array.isArray(
            result
          ) ||
          result.length === 0
        ) {
          throw new Error(
            "Updated reading was not returned."
          );
        }

        changedRecord =
          result[0];
      }

      // ========================================
      // ADD MISSING
      // ========================================

      else {
        const response =
          await fetch(
            `${supabaseUrl}/rest/v1/platform_readings`,
            {
              method:
                "POST",

              headers: {
                ...authHeaders,

                Prefer:
                  "return=representation",
              },

              body:
                JSON.stringify({
                  shift_id:
                    shiftId,

                  platform_id:
                    platform.id,

                  reading_kind:
                    kind,

                  reading_value:
                    roundMoney(
                      value
                    ),

                  recorded_at:
                    new Date().toISOString(),

                  recorded_by:
                    adminProfileId,
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
              "Unable to add platform reading."
          );
        }

        if (
          !Array.isArray(
            result
          ) ||
          result.length === 0
        ) {
          throw new Error(
            "Added reading was not returned."
          );
        }

        changedRecord =
          result[0];

        oldData = {
          record_status:
            "NOT_PRESENT",
        };
      }

      // ========================================
      // RECALCULATE OUTPUT
      // ========================================

      const newOutput =
        await syncShiftOutput();

      // ========================================
      // AUDIT
      // ========================================

      const auditOk =
        await writeAudit({
          action:
            existing
              ? "ADMIN_PLATFORM_READING_UPDATE"
              : "ADMIN_PLATFORM_READING_ADD",

          recordId:
            changedRecord.id,

          oldData,

          newData: {
            ...changedRecord,

            platform_name:
              platform.platform_name,

            correction_reason:
              cleanReason,

            shift_total_output:
              newOutput,
          },
        });

      if (!auditOk) {
        setMessage(
          "Reading was saved, but the audit log could not be written."
        );

        setMessageType(
          "error"
        );
      } else {
        setMessage(
          `${platform.platform_name} ${readingLabel(
            kind
          )} saved successfully.`
        );

        setMessageType(
          "success"
        );
      }

      setReason("");

      await loadData();

      if (
        typeof onChanged ===
        "function"
      ) {
        await onChanged();
      }
    } catch (error) {
      console.error(
        "SAVE ADMIN PLATFORM READING ERROR:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to save platform correction."
      );

      setMessageType(
        "error"
      );
    } finally {
      setSavingKey("");
    }
  }

  // ==================================================
  // DELETE READING
  // ==================================================

  async function deleteReading({
    platform,
    kind,
  }) {
    const existing =
      readingMap[
        `${platform.id}-${kind}`
      ];

    if (!existing?.id) {
      return;
    }

    if (!validateAction()) {
      return;
    }

    const cleanReason =
      String(
        reason
      ).trim();

    const confirmed =
      window.confirm(
        "ADMIN DELETE PLATFORM READING\n\n" +
          `${platform.platform_name}\n` +
          `${readingLabel(
            kind
          )}: ${money(
            existing.reading_value
          )}\n\n` +
          "Delete this reading?"
      );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(
        existing.id
      );

      setMessage("");
      setMessageType("");

      const oldData = {
        ...existing,

        platform_name:
          platform.platform_name,
      };

      const response =
        await fetch(
          `${supabaseUrl}/rest/v1/platform_readings` +
            `?id=eq.${encodeURIComponent(
              existing.id
            )}`,
          {
            method:
              "DELETE",

            headers: {
              ...authHeaders,

              Prefer:
                "return=representation",
            },
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
            "Unable to delete platform reading."
        );
      }

      // ========================================
      // RECALCULATE OUTPUT
      // ========================================

      const newOutput =
        await syncShiftOutput();

      // ========================================
      // AUDIT
      // ========================================

      const auditOk =
        await writeAudit({
          action:
            "ADMIN_PLATFORM_READING_DELETE",

          recordId:
            existing.id,

          oldData,

          newData: {
            deleted:
              true,

            platform_name:
              platform.platform_name,

            reading_kind:
              kind,

            correction_reason:
              cleanReason,

            shift_id:
              shiftId,

            shift_total_output:
              newOutput,
          },
        });

      if (!auditOk) {
        setMessage(
          "Reading was deleted, but the audit log could not be written."
        );

        setMessageType(
          "error"
        );
      } else {
        setMessage(
          `${platform.platform_name} ${readingLabel(
            kind
          )} deleted successfully.`
        );

        setMessageType(
          "success"
        );
      }

      setReason("");

      await loadData();

      if (
        typeof onChanged ===
        "function"
      ) {
        await onChanged();
      }
    } catch (error) {
      console.error(
        "DELETE ADMIN PLATFORM READING ERROR:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to delete platform reading."
      );

      setMessageType(
        "error"
      );
    } finally {
      setDeletingId("");
    }
  }

  // ==================================================
  // SYNC SHIFT TOTAL_OUTPUT
  // ==================================================

  async function syncShiftOutput() {
    const readingResponse =
      await fetch(
        `${supabaseUrl}/rest/v1/platform_readings` +
          `?shift_id=eq.${encodeURIComponent(
            shiftId
          )}` +
          `&reading_kind=in.(${READING_KINDS.join(
            ","
          )})` +
          `&select=id,platform_id,reading_kind,reading_value,recorded_at`,
        {
          method:
            "GET",

          headers:
            authHeaders,

          cache:
            "no-store",
        }
      );

    const readingResult =
      await safeJson(
        readingResponse
      );

    if (!readingResponse.ok) {
      throw new Error(
        readingResult?.message ||
          readingResult?.details ||
          "Unable to recalculate platform output."
      );
    }

    const freshReadings =
      Array.isArray(
        readingResult
      )
        ? readingResult
        : [];

    const latestMap =
      buildLatestReadingMap(
        freshReadings
      );

    const totalOutput =
      calculateTotalOutput({
        platforms,
        readingMap:
          latestMap,
        is24Hour,
        isShift1,
        isShift2,
      });

    const shiftResponse =
      await fetch(
        `${supabaseUrl}/rest/v1/shifts` +
          `?id=eq.${encodeURIComponent(
            shiftId
          )}`,
        {
          method:
            "PATCH",

          headers: {
            ...authHeaders,

            Prefer:
              "return=representation",
          },

          body:
            JSON.stringify({
              total_output:
                totalOutput,
            }),
        }
      );

    const shiftResult =
      await safeJson(
        shiftResponse
      );

    if (!shiftResponse.ok) {
      throw new Error(
        shiftResult?.message ||
          shiftResult?.details ||
          shiftResult?.hint ||
          "Reading changed, but shift Platform Output could not be updated."
      );
    }

    return totalOutput;
  }

  // ==================================================
  // WRITE AUDIT
  // ==================================================

  async function writeAudit({
    action,
    recordId,
    oldData,
    newData,
  }) {
    try {
      const response =
        await fetch(
          `${supabaseUrl}/rest/v1/audit_log`,
          {
            method:
              "POST",

            headers: {
              ...authHeaders,

              Prefer:
                "return=representation",
            },

            body:
              JSON.stringify({
                user_id:
                  adminProfileId,

                shop_id:
                  shopId,

                action,

                table_name:
                  "platform_readings",

                record_id:
                  recordId,

                old_data:
                  oldData || {},

                new_data:
                  newData || {},
              }),
          }
        );

      if (!response.ok) {
        const result =
          await safeJson(
            response
          );

        console.error(
          "PLATFORM AUDIT ERROR:",
          result
        );

        return false;
      }

      return true;
    } catch (error) {
      console.error(
        "PLATFORM AUDIT ERROR:",
        error
      );

      return false;
    }
  }

  // ==================================================
  // RENDER READING CONTROL
  // ==================================================

  function renderReadingControl({
    platform,
    kind,
  }) {
    const allowed =
      readingAllowed({
        platform,
        kind,
        is24Hour,
        isShift1,
        isShift2,
      });

    if (!allowed) {
      return (
        <div style={notApplicableStyle}>
          NOT APPLICABLE
        </div>
      );
    }

    const inputKey =
      `${platform.id}-${kind}`;

    const existing =
      readingMap[inputKey];

    const value =
      inputs[inputKey] ?? "";

    return (
      <div style={readingControlStyle}>
        <input
          type="number"
          step="0.01"
          value={value}
          onChange={(event) => {
            const nextValue =
              event.target.value;

            setInputs(
              (previous) => ({
                ...previous,

                [inputKey]:
                  nextValue,
              })
            );

            setMessage("");
          }}
          style={inputStyle}
        />

        <div
          style={
            existing
              ? savedStyle
              : missingStyle
          }
        >
          {existing
            ? `Saved: ${money(
                existing.reading_value
              )}`
            : "MISSING"}
        </div>

        <div style={buttonRowStyle}>
          <button
            type="button"
            disabled={
              savingKey ===
                inputKey ||
              Boolean(
                deletingId
              )
            }
            onClick={() =>
              saveReading({
                platform,
                kind,
              })
            }
            style={saveButtonStyle}
          >
            {savingKey ===
            inputKey
              ? "SAVING..."
              : existing
              ? "UPDATE"
              : "ADD"}
          </button>

          {existing && (
            <button
              type="button"
              disabled={
                deletingId ===
                  existing.id ||
                Boolean(
                  savingKey
                )
              }
              onClick={() =>
                deleteReading({
                  platform,
                  kind,
                })
              }
              style={deleteButtonStyle}
            >
              {deletingId ===
              existing.id
                ? "..."
                : "DELETE"}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ==================================================
  // DISPLAY
  // ==================================================

  if (!selectedShift) {
    return null;
  }

  return (
    <section style={panelStyle}>
      <div style={titleStyle}>
        PLATFORM READING CORRECTIONS
      </div>

      <div style={bodyStyle}>
        <div style={summaryGridStyle}>
          <div>
            <small>
              SHIFT PLATFORM OUTPUT
            </small>

            <strong>
              KES{" "}
              {money(
                selectedShift.total_output
              )}
            </strong>
          </div>

          <div>
            <small>
              CALCULATED FROM READINGS
            </small>

            <strong>
              KES{" "}
              {money(
                calculatedOutput
              )}
            </strong>
          </div>

          <div>
            <small>
              TOTAL MODE
            </small>

            <strong>
              {selectedShift.admin_manual_totals
                ? "MANUAL"
                : "AUTOMATIC"}
            </strong>
          </div>
        </div>

        {is24Hour && (
          <div style={modeNoticeStyle}>
            24-HOUR MODE —{" "}
            {isShift1
              ? "SHIFT 1: 9 AM → 9 PM"
              : isShift2
              ? "SHIFT 2: 9 PM → 9 AM"
              : "24-HOUR SHIFT"}
          </div>
        )}

        {selectedShift.admin_manual_totals && (
          <div style={manualWarningStyle}>
            Manual Admin Totals is ON. Platform corrections will
            update Platform Output, but the manually entered Net
            Income and Closing Balance will remain unchanged.
          </div>
        )}

        {/* ===================================== */}
        {/* 12-HOUR */}
        {/* ===================================== */}

        {!is24Hour && (
          <>
            <div style={header12Style}>
              <div>
                PLATFORM
              </div>

              <div>
                OPENING
              </div>

              <div>
                CLOSING
              </div>

              <div>
                OUTPUT
              </div>
            </div>

            {platforms.map(
              (platform) => {
                const output =
                  calculatePlatformOutput({
                    platform,
                    readingMap,
                    is24Hour,
                    isShift1,
                    isShift2,
                  });

                return (
                  <div
                    key={platform.id}
                    style={platformRow12Style}
                  >
                    <PlatformName
                      platform={
                        platform
                      }
                    />

                    {renderReadingControl({
                      platform,
                      kind:
                        "OPENING",
                    })}

                    {renderReadingControl({
                      platform,
                      kind:
                        "CLOSING",
                    })}

                    <div style={outputStyle}>
                      KES{" "}
                      {money(
                        output
                      )}
                    </div>
                  </div>
                );
              }
            )}
          </>
        )}

        {/* ===================================== */}
        {/* 24-HOUR SHIFT 1 */}
        {/* ===================================== */}

        {isShift1 && (
          <>
            <div style={header12Style}>
              <div>
                PLATFORM
              </div>

              <div>
                9 AM OPENING
              </div>

              <div>
                9 PM HANDOVER
              </div>

              <div>
                OUTPUT
              </div>
            </div>

            {platforms.map(
              (platform) => {
                const output =
                  calculatePlatformOutput({
                    platform,
                    readingMap,
                    is24Hour,
                    isShift1,
                    isShift2,
                  });

                return (
                  <div
                    key={platform.id}
                    style={platformRow12Style}
                  >
                    <PlatformName
                      platform={
                        platform
                      }
                    />

                    {renderReadingControl({
                      platform,
                      kind:
                        "OPENING",
                    })}

                    {renderReadingControl({
                      platform,
                      kind:
                        "HANDOVER_9PM",
                    })}

                    <div style={outputStyle}>
                      KES{" "}
                      {money(
                        output
                      )}
                    </div>
                  </div>
                );
              }
            )}
          </>
        )}

        {/* ===================================== */}
        {/* 24-HOUR SHIFT 2 */}
        {/* ===================================== */}

        {isShift2 && (
          <>
            <div style={header24Shift2Style}>
              <div>
                PLATFORM
              </div>

              <div>
                9 PM OPENING
              </div>

              <div>
                11:59 PM
              </div>

              <div>
                9 AM CLOSING
              </div>

              <div>
                OUTPUT
              </div>
            </div>

            {platforms.map(
              (platform) => {
                const output =
                  calculatePlatformOutput({
                    platform,
                    readingMap,
                    is24Hour,
                    isShift1,
                    isShift2,
                  });

                return (
                  <div
                    key={platform.id}
                    style={platformRow24Shift2Style}
                  >
                    <PlatformName
                      platform={
                        platform
                      }
                    />

                    {renderReadingControl({
                      platform,
                      kind:
                        "OPENING",
                    })}

                    {renderReadingControl({
                      platform,
                      kind:
                        "MIDNIGHT_CLOSE",
                    })}

                    {renderReadingControl({
                      platform,
                      kind:
                        "CLOSING_9AM",
                    })}

                    <div style={outputStyle}>
                      KES{" "}
                      {money(
                        output
                      )}
                    </div>
                  </div>
                );
              }
            )}
          </>
        )}

        <div style={reasonWrapStyle}>
          <label style={labelStyle}>
            PLATFORM CORRECTION REASON *
          </label>

          <textarea
            value={reason}
            onChange={(event) => {
              setReason(
                event.target.value
              );

              setMessage("");
            }}
            rows={2}
            placeholder="Example: Cashier entered the wrong PILOT platform reading."
            style={textareaStyle}
          />
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

        {loading && (
          <div style={loadingStyle}>
            Loading platform readings...
          </div>
        )}

        <div style={noticeStyle}>
          {isShift1
            ? "SHIFT 1 output = 9 PM Handover − 9 AM Opening. Negative, zero and positive platform readings are valid."
            : isShift2
            ? "SHIFT 2 resettable output = (11:59 PM − 9 PM Opening) + 9 AM Closing. TABLE output = 9 AM Closing − 9 PM Opening. TABLE never resets at midnight. Negative, zero and positive platform readings are valid."
            : "12-hour output = Closing − Opening. Negative, zero and positive platform readings are valid. Admin corrections are recorded in the audit log."}
        </div>
      </div>
    </section>
  );
}

// ==================================================
// PLATFORM NAME
// ==================================================

function PlatformName({
  platform,
}) {
  return (
    <div>
      <strong>
        {platform.platform_name}
      </strong>

      <div style={metaStyle}>
        {platform.is_active
          ? "Active"
          : "Inactive"}
      </div>
    </div>
  );
}

// ==================================================
// OUTPUT CALCULATION
//
// ALL RAW PLATFORM READINGS MAY BE:
// NEGATIVE / ZERO / POSITIVE
// ==================================================

function calculateTotalOutput({
  platforms,
  readingMap,
  is24Hour,
  isShift1,
  isShift2,
}) {
  let total = 0;

  for (
    const platform
    of platforms
  ) {
    total +=
      calculatePlatformOutput({
        platform,
        readingMap,
        is24Hour,
        isShift1,
        isShift2,
      });
  }

  return roundMoney(
    total
  );
}

function calculatePlatformOutput({
  platform,
  readingMap,
  is24Hour,
  isShift1,
  isShift2,
}) {
  const opening =
    readingMap[
      `${platform.id}-OPENING`
    ];

  if (!opening) {
    return 0;
  }

  const openingValue =
    finiteNumberOrNull(
      opening.reading_value
    );

  if (
    openingValue === null
  ) {
    return 0;
  }

  // ================================================
  // 12-HOUR
  // OUTPUT = CLOSING - OPENING
  // ================================================

  if (!is24Hour) {
    const closing =
      readingMap[
        `${platform.id}-CLOSING`
      ];

    if (!closing) {
      return 0;
    }

    const closingValue =
      finiteNumberOrNull(
        closing.reading_value
      );

    if (
      closingValue === null
    ) {
      return 0;
    }

    return roundMoney(
      closingValue -
        openingValue
    );
  }

  // ================================================
  // 24-HOUR SHIFT 1
  // OUTPUT = 9PM - 9AM OPENING
  // ================================================

  if (isShift1) {
    const handover =
      readingMap[
        `${platform.id}-HANDOVER_9PM`
      ];

    if (!handover) {
      return 0;
    }

    const handoverValue =
      finiteNumberOrNull(
        handover.reading_value
      );

    if (
      handoverValue === null
    ) {
      return 0;
    }

    return roundMoney(
      handoverValue -
        openingValue
    );
  }

  // ================================================
  // 24-HOUR SHIFT 2
  // ================================================

  if (isShift2) {
    const closing9AM =
      readingMap[
        `${platform.id}-CLOSING_9AM`
      ];

    if (!closing9AM) {
      return 0;
    }

    const closing9AMValue =
      finiteNumberOrNull(
        closing9AM.reading_value
      );

    if (
      closing9AMValue === null
    ) {
      return 0;
    }

    // TABLE NEVER RESETS AT MIDNIGHT

    if (isTable(platform)) {
      return roundMoney(
        closing9AMValue -
          openingValue
      );
    }

    // RESETTABLE PLATFORMS

    const midnight =
      readingMap[
        `${platform.id}-MIDNIGHT_CLOSE`
      ];

    if (!midnight) {
      return 0;
    }

    const midnightValue =
      finiteNumberOrNull(
        midnight.reading_value
      );

    if (
      midnightValue === null
    ) {
      return 0;
    }

    const beforeMidnight =
      midnightValue -
      openingValue;

    const afterMidnight =
      closing9AMValue;

    return roundMoney(
      beforeMidnight +
        afterMidnight
    );
  }

  return 0;
}

// ==================================================
// READING RULES
// ==================================================

function readingAllowed({
  platform,
  kind,
  is24Hour,
  isShift1,
  isShift2,
}) {
  // 12-HOUR

  if (!is24Hour) {
    return (
      kind === "OPENING" ||
      kind === "CLOSING"
    );
  }

  // SHIFT 1

  if (isShift1) {
    return (
      kind === "OPENING" ||
      kind === "HANDOVER_9PM"
    );
  }

  // SHIFT 2

  if (isShift2) {
    if (
      kind === "OPENING" ||
      kind === "CLOSING_9AM"
    ) {
      return true;
    }

    if (
      kind ===
      "MIDNIGHT_CLOSE"
    ) {
      return !isTable(
        platform
      );
    }
  }

  return false;
}

// ==================================================
// READING MAP
// ==================================================

function buildLatestReadingMap(
  readings
) {
  const map = {};

  for (
    const reading
    of readings || []
  ) {
    const key =
      `${reading.platform_id}-${reading.reading_kind}`;

    const existing =
      map[key];

    if (!existing) {
      map[key] =
        reading;

      continue;
    }

    const existingTime =
      new Date(
        existing.recorded_at || 0
      ).getTime();

    const readingTime =
      new Date(
        reading.recorded_at || 0
      ).getTime();

    if (
      readingTime >=
      existingTime
    ) {
      map[key] =
        reading;
    }
  }

  return map;
}

// ==================================================
// HELPERS
// ==================================================

function normalizeShopType(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

function normalizeShiftName(
  value
) {
  const normalized =
    String(
      value || ""
    )
      .trim()
      .toUpperCase()
      .replace(/[\s_-]+/g, "");

  if (
    normalized === "SHIFT1"
  ) {
    return "SHIFT1";
  }

  if (
    normalized === "SHIFT2"
  ) {
    return "SHIFT2";
  }

  return normalized;
}

function isTable(
  platform
) {
  return (
    String(
      platform?.platform_name ||
        ""
    )
      .trim()
      .toUpperCase() ===
    TABLE_NAME
  );
}

function readingLabel(
  kind
) {
  if (
    kind === "OPENING"
  ) {
    return "Opening";
  }

  if (
    kind === "CLOSING"
  ) {
    return "Closing";
  }

  if (
    kind ===
    "HANDOVER_9PM"
  ) {
    return "9 PM Handover";
  }

  if (
    kind ===
    "MIDNIGHT_CLOSE"
  ) {
    return "11:59 PM";
  }

  if (
    kind ===
    "CLOSING_9AM"
  ) {
    return "9 AM Closing";
  }

  return kind;
}

function finiteNumberOrNull(
  value
) {
  if (
    value === "" ||
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const numericValue =
    Number(value);

  return Number.isFinite(
    numericValue
  )
    ? numericValue
    : null;
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

function money(value) {
  const numericValue =
    Number(
      value ?? 0
    );

  const safeValue =
    Number.isFinite(
      numericValue
    )
      ? numericValue
      : 0;

  return safeValue.toLocaleString(
    "en-KE",
    {
      minimumFractionDigits:
        2,

      maximumFractionDigits:
        2,
    }
  );
}

function roundMoney(value) {
  return (
    Math.round(
      (Number(value) +
        Number.EPSILON) *
        100
    ) / 100
  );
}

// ==================================================
// STYLES
// ==================================================

const panelStyle = {
  marginTop: "18px",
  border:
    "1px solid #bbf7d0",
  borderRadius: "7px",
  overflow: "hidden",
  backgroundColor:
    "#ffffff",
};

const titleStyle = {
  backgroundColor:
    "#15803d",
  color: "white",
  padding:
    "10px 12px",
  fontWeight: "bold",
  fontSize: "13px",
};

const bodyStyle = {
  padding: "12px",
};

const summaryGridStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(3,1fr)",
  gap: "8px",
  marginBottom: "10px",
};

const modeNoticeStyle = {
  padding: "9px",
  marginBottom: "10px",
  backgroundColor:
    "#ecfdf5",
  border:
    "1px solid #86efac",
  color: "#166534",
  borderRadius: "5px",
  fontWeight: "bold",
  fontSize: "10px",
  textAlign: "center",
};

const manualWarningStyle = {
  padding: "9px",
  marginBottom: "10px",
  backgroundColor:
    "#fef3c7",
  border:
    "1px solid #fde68a",
  color: "#92400e",
  borderRadius: "5px",
  fontSize: "10px",
};

const header12Style = {
  display: "grid",
  gridTemplateColumns:
    "0.75fr 1.6fr 1.6fr 0.65fr",
  gap: "8px",
  padding: "8px",
  backgroundColor:
    "#dcfce7",
  color: "#166534",
  fontWeight: "bold",
  fontSize: "9px",
  textAlign: "center",
};

const platformRow12Style = {
  display: "grid",
  gridTemplateColumns:
    "0.75fr 1.6fr 1.6fr 0.65fr",
  gap: "8px",
  alignItems: "center",
  padding: "9px 8px",
  borderTop:
    "1px solid #e2e8f0",
  fontSize: "10px",
};

const header24Shift2Style = {
  display: "grid",
  gridTemplateColumns:
    "0.7fr 1.35fr 1.35fr 1.35fr 0.6fr",
  gap: "7px",
  padding: "8px",
  backgroundColor:
    "#dcfce7",
  color: "#166534",
  fontWeight: "bold",
  fontSize: "9px",
  textAlign: "center",
};

const platformRow24Shift2Style = {
  display: "grid",
  gridTemplateColumns:
    "0.7fr 1.35fr 1.35fr 1.35fr 0.6fr",
  gap: "7px",
  alignItems: "center",
  padding: "9px 8px",
  borderTop:
    "1px solid #e2e8f0",
  fontSize: "10px",
};

const readingControlStyle = {
  display: "grid",
  gridTemplateColumns:
    "1fr 0.9fr",
  gap: "5px",
};

const inputStyle = {
  width: "100%",
  boxSizing:
    "border-box",
  padding: "7px",
  border:
    "1px solid #94a3b8",
  borderRadius: "4px",
  textAlign: "right",
};

const savedStyle = {
  padding: "7px 4px",
  backgroundColor:
    "#ecfdf5",
  border:
    "1px solid #86efac",
  borderRadius: "4px",
  color: "#166534",
  textAlign: "center",
  fontSize: "8px",
};

const missingStyle = {
  padding: "7px 4px",
  backgroundColor:
    "#f8fafc",
  border:
    "1px solid #cbd5e1",
  borderRadius: "4px",
  color: "#64748b",
  textAlign: "center",
  fontSize: "8px",
};

const notApplicableStyle = {
  padding: "12px 5px",
  backgroundColor:
    "#f8fafc",
  border:
    "1px dashed #cbd5e1",
  borderRadius: "4px",
  color: "#64748b",
  textAlign: "center",
  fontWeight: "bold",
  fontSize: "8px",
};

const buttonRowStyle = {
  gridColumn:
    "1 / -1",
  display: "grid",
  gridTemplateColumns:
    "1fr 1fr",
  gap: "5px",
};

const saveButtonStyle = {
  border: "none",
  borderRadius: "4px",
  padding: "6px",
  backgroundColor:
    "#16a34a",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
  fontSize: "8px",
};

const deleteButtonStyle = {
  border: "none",
  borderRadius: "4px",
  padding: "6px",
  backgroundColor:
    "#dc2626",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
  fontSize: "8px",
};

const outputStyle = {
  padding: "9px 5px",
  backgroundColor:
    "#f0fdf4",
  border:
    "1px solid #bbf7d0",
  borderRadius: "4px",
  textAlign: "center",
  fontWeight: "bold",
  color: "#166534",
};

const metaStyle = {
  marginTop: "3px",
  fontSize: "8px",
  color: "#64748b",
};

const reasonWrapStyle = {
  marginTop: "12px",
};

const labelStyle = {
  display: "block",
  marginBottom: "5px",
  fontSize: "9px",
  fontWeight: "bold",
  color: "#334155",
};

const textareaStyle = {
  width: "100%",
  boxSizing:
    "border-box",
  padding: "8px",
  border:
    "1px solid #94a3b8",
  borderRadius: "4px",
  resize: "vertical",
};

const messageStyle = {
  marginTop: "10px",
  padding: "9px",
  borderRadius: "5px",
  fontSize: "10px",
};

const loadingStyle = {
  padding: "10px",
  textAlign: "center",
  color: "#64748b",
  fontSize: "10px",
};

const noticeStyle = {
  marginTop: "10px",
  padding: "8px",
  backgroundColor:
    "#f8fafc",
  color: "#64748b",
  textAlign: "center",
  fontSize: "9px",
};
