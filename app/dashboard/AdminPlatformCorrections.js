"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

export default function AdminPlatformCorrections({
  user,
  selectedShift,
  selectedShop,
  onChanged,
}) {
  const [platforms, setPlatforms] = useState([]);
  const [readings, setReadings] = useState([]);

  const [openingInputs, setOpeningInputs] = useState({});
  const [closingInputs, setClosingInputs] = useState({});

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

  // audit_log.user_id -> profiles.id
  const adminProfileId =
    user?.profile_id || null;

  const shiftId =
    selectedShift?.id || null;

  const shopId =
    selectedShift?.shop_id ||
    selectedShop?.id ||
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
  // READING MAP
  // ==================================================

  const readingMap =
    useMemo(() => {
      const map = {};

      for (const reading of readings) {
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
    }, [readings]);

  // ==================================================
  // CALCULATED OUTPUT
  // ==================================================

  const calculatedOutput =
    useMemo(() => {
      let total = 0;

      for (const platform of platforms) {
        const opening =
          readingMap[
            `${platform.id}-OPENING`
          ];

        const closing =
          readingMap[
            `${platform.id}-CLOSING`
          ];

        if (
          !opening ||
          !closing
        ) {
          continue;
        }

        total +=
          Number(
            closing.reading_value || 0
          ) -
          Number(
            opening.reading_value || 0
          );
      }

      return roundMoney(
        total
      );
    }, [
      platforms,
      readingMap,
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
          setOpeningInputs({});
          setClosingInputs({});
          return;
        }

        try {
          setLoading(true);

          // ========================================
          // SHOP PLATFORMS
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

          if (
            !platformResponse.ok
          ) {
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
          // SHIFT READINGS
          // ========================================

          const readingResponse =
            await fetch(
              `${supabaseUrl}/rest/v1/platform_readings` +
                `?shift_id=eq.${encodeURIComponent(
                  shiftId
                )}` +
                `&reading_kind=in.(OPENING,CLOSING)` +
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

          if (
            !readingResponse.ok
          ) {
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
          // BUILD LATEST READING MAP LOCALLY
          // ========================================

          const latestMap = {};

          for (
            const reading
            of loadedReadings
          ) {
            const key =
              `${reading.platform_id}-${reading.reading_kind}`;

            const existing =
              latestMap[key];

            if (!existing) {
              latestMap[key] =
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
              latestMap[key] =
                reading;
            }
          }

          // ========================================
          // LOAD INPUT VALUES
          // ========================================

          const openingValues = {};
          const closingValues = {};

          for (
            const platform
            of loadedPlatforms
          ) {
            const opening =
              latestMap[
                `${platform.id}-OPENING`
              ];

            const closing =
              latestMap[
                `${platform.id}-CLOSING`
              ];

            openingValues[
              platform.id
            ] =
              opening
                ? String(
                    opening.reading_value ??
                      ""
                  )
                : "";

            closingValues[
              platform.id
            ] =
              closing
                ? String(
                    closing.reading_value ??
                      ""
                  )
                : "";
          }

          setOpeningInputs(
            openingValues
          );

          setClosingInputs(
            closingValues
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
  // ==================================================

  async function saveReading({
    platform,
    kind,
  }) {
    if (!validateAction()) {
      return;
    }

    const isOpening =
      kind ===
      "OPENING";

    const rawValue =
      isOpening
        ? openingInputs[
            platform.id
          ]
        : closingInputs[
            platform.id
          ];

    const value =
      Number(
        rawValue
      );

    if (
      rawValue === "" ||
      Number.isNaN(
        value
      ) ||
      value < 0
    ) {
      setMessage(
        "Enter a valid reading of zero or greater."
      );

      setMessageType(
        "error"
      );

      return;
    }

    const existing =
      readingMap[
        `${platform.id}-${kind}`
      ];

    const cleanReason =
      String(
        reason
      ).trim();

    const actionKey =
      `${platform.id}-${kind}`;

    const confirmed =
      window.confirm(
        "ADMIN PLATFORM CORRECTION\n\n" +
          `${platform.platform_name}\n` +
          `${kind}: ${money(
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
        actionKey
      );

      setMessage("");
      setMessageType("");

      let changedRecord = null;
      let oldData = {};

      // ========================================
      // UPDATE EXISTING READING
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
      // ADD MISSING READING
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
      // RECALCULATE TOTAL OUTPUT
      // ========================================

      const newOutput =
        await syncShiftOutput();

      // ========================================
      // AUDIT LOG
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
          `${platform.platform_name} ${kind} reading saved successfully.`
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
          `${kind}: ${money(
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
          `${platform.platform_name} ${kind} reading deleted successfully.`
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
    // Load fresh readings after the change.

    const readingResponse =
      await fetch(
        `${supabaseUrl}/rest/v1/platform_readings` +
          `?shift_id=eq.${encodeURIComponent(
            shiftId
          )}` +
          `&reading_kind=in.(OPENING,CLOSING)` +
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

    if (
      !readingResponse.ok
    ) {
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

    // Keep latest OPENING/CLOSING for each platform.

    const latestMap = {};

    for (
      const reading
      of freshReadings
    ) {
      const key =
        `${reading.platform_id}-${reading.reading_kind}`;

      const existing =
        latestMap[key];

      if (!existing) {
        latestMap[key] =
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
        latestMap[key] =
          reading;
      }
    }

    let total = 0;

    for (
      const platform
      of platforms
    ) {
      const opening =
        latestMap[
          `${platform.id}-OPENING`
        ];

      const closing =
        latestMap[
          `${platform.id}-CLOSING`
        ];

      if (
        !opening ||
        !closing
      ) {
        continue;
      }

      total +=
        Number(
          closing.reading_value || 0
        ) -
        Number(
          opening.reading_value || 0
        );
    }

    const totalOutput =
      roundMoney(
        total
      );

    // Update shifts.total_output.
    // Existing shift trigger recalculates Net Income
    // and Closing Balance unless Manual Admin Totals is ON.

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
    const isOpening =
      kind ===
      "OPENING";

    const existing =
      readingMap[
        `${platform.id}-${kind}`
      ];

    const value =
      isOpening
        ? openingInputs[
            platform.id
          ] ?? ""
        : closingInputs[
            platform.id
          ] ?? "";

    const setValues =
      isOpening
        ? setOpeningInputs
        : setClosingInputs;

    const actionKey =
      `${platform.id}-${kind}`;

    return (
      <div style={readingControlStyle}>
        <input
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={(event) => {
            const nextValue =
              event.target.value;

            setValues(
              (previous) => ({
                ...previous,

                [platform.id]:
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
                actionKey ||
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
            actionKey
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

        {selectedShift.admin_manual_totals && (
          <div style={manualWarningStyle}>
            Manual Admin Totals is ON. Platform corrections will
            update Platform Output, but the manually entered Net
            Income and Closing Balance will remain unchanged.
          </div>
        )}

        <div style={headerStyle}>
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
            const opening =
              readingMap[
                `${platform.id}-OPENING`
              ];

            const closing =
              readingMap[
                `${platform.id}-CLOSING`
              ];

            const output =
              opening &&
              closing
                ? roundMoney(
                    Number(
                      closing.reading_value ||
                        0
                    ) -
                      Number(
                        opening.reading_value ||
                          0
                      )
                  )
                : 0;

            return (
              <div
                key={platform.id}
                style={platformRowStyle}
              >
                <div>
                  <strong>
                    {
                      platform.platform_name
                    }
                  </strong>

                  <div style={metaStyle}>
                    {platform.is_active
                      ? "Active"
                      : "Inactive"}
                  </div>
                </div>

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
            placeholder="Example: Cashier entered the wrong PILOT closing reading."
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
          Admin can add, update or delete Opening and Closing
          readings. Platform Output is recalculated automatically
          and every correction is written to the audit log.
        </div>
      </div>
    </section>
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

function money(value) {
  return Number(
    value || 0
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
  marginTop:
    "18px",

  border:
    "1px solid #bbf7d0",

  borderRadius:
    "7px",

  overflow:
    "hidden",

  backgroundColor:
    "#ffffff",
};

const titleStyle = {
  backgroundColor:
    "#15803d",

  color:
    "white",

  padding:
    "10px 12px",

  fontWeight:
    "bold",

  fontSize:
    "13px",
};

const bodyStyle = {
  padding:
    "12px",
};

const summaryGridStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "repeat(3,1fr)",

  gap:
    "8px",

  marginBottom:
    "10px",
};

const manualWarningStyle = {
  padding:
    "9px",

  marginBottom:
    "10px",

  backgroundColor:
    "#fef3c7",

  border:
    "1px solid #fde68a",

  color:
    "#92400e",

  borderRadius:
    "5px",

  fontSize:
    "10px",
};

const headerStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "0.75fr 1.6fr 1.6fr 0.65fr",

  gap:
    "8px",

  padding:
    "8px",

  backgroundColor:
    "#dcfce7",

  color:
    "#166534",

  fontWeight:
    "bold",

  fontSize:
    "9px",

  textAlign:
    "center",
};

const platformRowStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "0.75fr 1.6fr 1.6fr 0.65fr",

  gap:
    "8px",

  alignItems:
    "center",

  padding:
    "9px 8px",

  borderTop:
    "1px solid #e2e8f0",

  fontSize:
    "10px",
};

const readingControlStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "1fr 0.9fr",

  gap:
    "5px",
};

const inputStyle = {
  width:
    "100%",

  boxSizing:
    "border-box",

  padding:
    "7px",

  border:
    "1px solid #94a3b8",

  borderRadius:
    "4px",

  textAlign:
    "right",
};

const savedStyle = {
  padding:
    "7px 4px",

  backgroundColor:
    "#ecfdf5",

  border:
    "1px solid #86efac",

  borderRadius:
    "4px",

  color:
    "#166534",

  textAlign:
    "center",

  fontSize:
    "8px",
};

const missingStyle = {
  padding:
    "7px 4px",

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
};

const buttonRowStyle = {
  gridColumn:
    "1 / -1",

  display:
    "grid",

  gridTemplateColumns:
    "1fr 1fr",

  gap:
    "5px",
};

const saveButtonStyle = {
  border:
    "none",

  borderRadius:
    "4px",

  padding:
    "6px",

  backgroundColor:
    "#16a34a",

  color:
    "white",

  fontWeight:
    "bold",

  cursor:
    "pointer",

  fontSize:
    "8px",
};

const deleteButtonStyle = {
  border:
    "none",

  borderRadius:
    "4px",

  padding:
    "6px",

  backgroundColor:
    "#dc2626",

  color:
    "white",

  fontWeight:
    "bold",

  cursor:
    "pointer",

  fontSize:
    "8px",
};

const outputStyle = {
  padding:
    "9px 5px",

  backgroundColor:
    "#f0fdf4",

  border:
    "1px solid #bbf7d0",

  borderRadius:
    "4px",

  textAlign:
    "center",

  fontWeight:
    "bold",

  color:
    "#166534",
};

const metaStyle = {
  marginTop:
    "3px",

  fontSize:
    "8px",

  color:
    "#64748b",
};

const reasonWrapStyle = {
  marginTop:
    "12px",
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

  color:
    "#334155",
};

const textareaStyle = {
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

  resize:
    "vertical",
};

const messageStyle = {
  marginTop:
    "10px",

  padding:
    "9px",

  borderRadius:
    "5px",

  fontSize:
    "10px",
};

const loadingStyle = {
  padding:
    "10px",

  textAlign:
    "center",

  color:
    "#64748b",

  fontSize:
    "10px",
};

const noticeStyle = {
  marginTop:
    "10px",

  padding:
    "8px",

  backgroundColor:
    "#f8fafc",

  color:
    "#64748b",

  textAlign:
    "center",

  fontSize:
    "9px",
};
