"use client";

import { useEffect, useMemo, useState } from "react";

const TABLE_NAME = "TABLE";

export default function PlatformReadings24Hour({
  user,
  currentShift,
  refreshKey = 0,
  onReadingsChanged,
}) {
  const [platforms, setPlatforms] = useState([]);
  const [rows, setRows] = useState({});
  const [values, setValues] = useState({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  // Live clock so stages appear automatically
  // without requiring a page refresh.
  const [now, setNow] = useState(() => new Date());

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const shopId =
    user?.shop_id ||
    user?.shopId ||
    null;

  const cashierId =
    user?.profile_id ||
    user?.id ||
    user?.user_id ||
    user?.auth_user_id ||
    null;

  const accessToken =
    user?.access_token ||
    null;

  const shiftId =
    currentShift?.id ||
    null;

  const shiftName =
    normaliseShiftName(
      currentShift?.shift_name
    );

  const isShift1 =
    shiftName === "SHIFT 1";

  const isShift2 =
    shiftName === "SHIFT 2";

  // ==================================================
  // LIVE NAIROBI CLOCK
  // ==================================================

  useEffect(() => {
    setNow(new Date());

    const timer =
      setInterval(() => {
        setNow(new Date());
      }, 15000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  const nairobiTime =
    useMemo(
      () =>
        getNairobiTimeParts(
          now
        ),
      [now]
    );

  // ==================================================
  // LOAD PLATFORMS + ALL READINGS
  //
  // refreshKey is intentionally included in the
  // dependency list.
  //
  // Cashier24HourReport increments refreshKey every
  // 5 seconds. This makes Admin platform corrections
  // automatically appear on the cashier screen.
  // ==================================================

  useEffect(() => {
    if (
      !shopId ||
      !shiftId ||
      !accessToken ||
      !supabaseUrl ||
      !supabaseAnonKey
    ) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadData() {
      try {
        // Only show the full loading panel on the
        // first load. Background refreshes should
        // not make the platform panel flash.
        if (
          platforms.length === 0
        ) {
          setLoading(true);
        }

        // ------------------------------------------
        // ACTIVE PLATFORMS
        // ------------------------------------------

        const platformResponse =
          await fetch(
            `${supabaseUrl}/rest/v1/shop_platforms` +
              `?shop_id=eq.${encodeURIComponent(
                shopId
              )}` +
              `&is_active=eq.true` +
              `&select=id,shop_id,platform_name,reading_type,display_order,is_active` +
              `&order=display_order.asc`,
            {
              method: "GET",

              headers: {
                apikey:
                  supabaseAnonKey,

                Authorization:
                  `Bearer ${accessToken}`,

                "Content-Type":
                  "application/json",
              },

              cache: "no-store",
            }
          );

        const platformData =
          await safeJson(
            platformResponse
          );

        if (!platformResponse.ok) {
          throw new Error(
            platformData?.message ||
              platformData?.details ||
              "Unable to load shop platforms."
          );
        }

        const activePlatforms =
          Array.isArray(
            platformData
          )
            ? platformData
            : [];

        // ------------------------------------------
        // ALL READINGS FOR CURRENT SHIFT
        // ------------------------------------------

        const readingResponse =
          await fetch(
            `${supabaseUrl}/rest/v1/platform_readings` +
              `?shift_id=eq.${encodeURIComponent(
                shiftId
              )}` +
              `&select=id,shift_id,platform_id,reading_kind,reading_value,recorded_at,recorded_by` +
              `&order=recorded_at.asc`,
            {
              method: "GET",

              headers: {
                apikey:
                  supabaseAnonKey,

                Authorization:
                  `Bearer ${accessToken}`,

                "Content-Type":
                  "application/json",
              },

              cache: "no-store",
            }
          );

        const readingData =
          await safeJson(
            readingResponse
          );

        if (!readingResponse.ok) {
          throw new Error(
            readingData?.message ||
              readingData?.details ||
              "Unable to load platform readings."
          );
        }

        if (cancelled) {
          return;
        }

        const readingMap = {};

        for (
          const row of Array.isArray(
            readingData
          )
            ? readingData
            : []
        ) {
          if (
            !row.platform_id ||
            !row.reading_kind
          ) {
            continue;
          }

          if (
            !readingMap[
              row.platform_id
            ]
          ) {
            readingMap[
              row.platform_id
            ] = {};
          }

          readingMap[
            row.platform_id
          ][row.reading_kind] =
            row;
        }

        setPlatforms(
          activePlatforms
        );

        setRows(
          readingMap
        );

        const initialValues = {};

        for (
          const platform of activePlatforms
        ) {
          const platformRows =
            readingMap[
              platform.id
            ] || {};

          initialValues[
            platform.id
          ] = {
            OPENING:
              platformRows
                .OPENING
                ?.reading_value ??
              "",

            HANDOVER_9PM:
              platformRows
                .HANDOVER_9PM
                ?.reading_value ??
              "",

            MIDNIGHT_CLOSE:
              platformRows
                .MIDNIGHT_CLOSE
                ?.reading_value ??
              "",

            CLOSING_9AM:
              platformRows
                .CLOSING_9AM
                ?.reading_value ??
              "",
          };
        }

        setValues(
          initialValues
        );

        // Clear an old loading error once a
        // background refresh succeeds.
        setMessage((previous) =>
          messageType === "error"
            ? ""
            : previous
        );

        setMessageType((previous) =>
          previous === "error"
            ? ""
            : previous
        );
      } catch (error) {
        console.error(
          "24H PLATFORM LOAD ERROR:",
          error
        );

        if (!cancelled) {
          setMessage(
            error?.message ||
              "Unable to load 24-hour platform readings."
          );

          setMessageType(
            "error"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [
    shopId,
    shiftId,
    accessToken,
    supabaseUrl,
    supabaseAnonKey,
    refreshKey,
  ]);

  // ==================================================
  // STAGE SAVED STATUS
  // ==================================================

  const shift1HandoverSaved =
    useMemo(
      () =>
        isStageCompletelySaved({
          platforms,
          rows,
          readingKind:
            "HANDOVER_9PM",
        }),
      [
        platforms,
        rows,
      ]
    );

  const resettablePlatforms =
    useMemo(
      () =>
        platforms.filter(
          (platform) =>
            !isTable(
              platform
            )
        ),
      [platforms]
    );

  const midnightSaved =
    useMemo(
      () =>
        isStageCompletelySaved({
          platforms:
            resettablePlatforms,
          rows,
          readingKind:
            "MIDNIGHT_CLOSE",
        }),
      [
        resettablePlatforms,
        rows,
      ]
    );

  const closing9amSaved =
    useMemo(
      () =>
        isStageCompletelySaved({
          platforms,
          rows,
          readingKind:
            "CLOSING_9AM",
        }),
      [
        platforms,
        rows,
      ]
    );

  // ==================================================
  // TIMED VISIBILITY
  // ==================================================

  const showShift1Handover =
    isShift1 &&
    (
      shift1HandoverSaved ||
      isShift1NinePmStageOpen(
        nairobiTime
      )
    );

  const showMidnightStage =
    isShift2 &&
    (
      midnightSaved ||
      isShift2MidnightStageOpen(
        nairobiTime
      )
    );

  const showClosing9amStage =
    isShift2 &&
    (
      closing9amSaved ||
      isShift2NineAmStageOpen(
        nairobiTime
      )
    );

  // ==================================================
  // INPUT
  // ==================================================

  function updateValue(
    platformId,
    readingKind,
    value
  ) {
    if (
      rows[
        platformId
      ]?.[readingKind]?.id
    ) {
      return;
    }

    setValues(
      (previous) => ({
        ...previous,

        [platformId]: {
          ...(
            previous[
              platformId
            ] || {}
          ),

          [readingKind]:
            value,
        },
      })
    );

    setMessage("");
    setMessageType("");
  }

  // ==================================================
  // SAVE A READING STAGE
  // ==================================================

  async function saveStage(
    readingKind
  ) {
    if (
      !shiftId ||
      !cashierId ||
      !accessToken
    ) {
      setMessage(
        "Shift or login information is missing."
      );

      setMessageType(
        "error"
      );

      return;
    }

    const freshTime =
      getNairobiTimeParts(
        new Date()
      );

    if (
      readingKind ===
        "HANDOVER_9PM" &&
      shiftName ===
        "SHIFT 1" &&
      !isShift1NinePmStageOpen(
        freshTime
      )
    ) {
      setMessage(
        "9 PM handover readings become available at exactly 9:00 PM Nairobi time."
      );

      setMessageType(
        "error"
      );

      return;
    }

    if (
      readingKind ===
        "MIDNIGHT_CLOSE" &&
      shiftName ===
        "SHIFT 2" &&
      !isShift2MidnightStageOpen(
        freshTime
      )
    ) {
      setMessage(
        "11:59 PM closing readings become available at exactly 11:59 PM Nairobi time."
      );

      setMessageType(
        "error"
      );

      return;
    }

    if (
      readingKind ===
        "CLOSING_9AM" &&
      shiftName ===
        "SHIFT 2" &&
      !isShift2NineAmStageOpen(
        freshTime
      )
    ) {
      setMessage(
        "9 AM handover readings become available at exactly 9:00 AM Nairobi time."
      );

      setMessageType(
        "error"
      );

      return;
    }

    // TABLE never receives a midnight reading.
    const stagePlatforms =
      readingKind ===
      "MIDNIGHT_CLOSE"
        ? platforms.filter(
            (platform) =>
              !isTable(
                platform
              )
          )
        : platforms;

    const unsaved =
      stagePlatforms.filter(
        (platform) =>
          !rows[
            platform.id
          ]?.[readingKind]
      );

    if (
      unsaved.length === 0
    ) {
      setMessage(
        `${stageLabel(
          readingKind
        )} readings have already been saved.`
      );

      setMessageType(
        "success"
      );

      return;
    }

    const records = [];

    for (
      const platform of unsaved
    ) {
      const raw =
        values[
          platform.id
        ]?.[readingKind];

      if (
        raw === "" ||
        raw === null ||
        raw === undefined
      ) {
        setMessage(
          `Enter ${stageLabel(
            readingKind
          )} for ${platform.platform_name}.`
        );

        setMessageType(
          "error"
        );

        return;
      }

      const numericValue =
        Number(raw);

      // ------------------------------------------
      // UNIVERSAL SIGNED READING RULE
      //
      // Negative = valid
      // Zero     = valid
      // Positive = valid
      // ------------------------------------------

      if (
        !Number.isFinite(
          numericValue
        )
      ) {
        setMessage(
          `Enter a valid reading for ${platform.platform_name}.`
        );

        setMessageType(
          "error"
        );

        return;
      }

      const validationError =
        validateReading({
          platform,
          readingKind,
          values,
          shiftName,
        });

      if (
        validationError
      ) {
        setMessage(
          validationError
        );

        setMessageType(
          "error"
        );

        return;
      }

      records.push({
        platform,
        numericValue,
      });
    }

    try {
      setSaving(
        readingKind
      );

      setMessage("");
      setMessageType("");

      const recordedAt =
        new Date().toISOString();

      const newRows = {
        ...rows,
      };

      for (
        const record of records
      ) {
        const response =
          await fetch(
            `${supabaseUrl}/rest/v1/platform_readings`,
            {
              method: "POST",

              headers: {
                apikey:
                  supabaseAnonKey,

                Authorization:
                  `Bearer ${accessToken}`,

                "Content-Type":
                  "application/json",

                Prefer:
                  "return=representation",
              },

              body:
                JSON.stringify({
                  shift_id:
                    shiftId,

                  platform_id:
                    record.platform.id,

                  reading_kind:
                    readingKind,

                  reading_value:
                    roundMoney(
                      record.numericValue
                    ),

                  recorded_at:
                    recordedAt,

                  recorded_by:
                    cashierId,
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
              `Unable to save ${record.platform.platform_name}.`
          );
        }

        if (
          Array.isArray(
            result
          ) &&
          result.length > 0
        ) {
          if (
            !newRows[
              record.platform.id
            ]
          ) {
            newRows[
              record.platform.id
            ] = {};
          }

          newRows[
            record.platform.id
          ][readingKind] =
            result[0];
        }
      }

      setRows(
        newRows
      );

      const totalOutput =
        calculateShiftOutput({
          platforms,
          rows:
            newRows,
          shiftName,
        });

      await syncShiftTotalOutput(
        totalOutput
      );

      setMessage(
        `${stageLabel(
          readingKind
        )} readings saved and locked successfully.`
      );

      setMessageType(
        "success"
      );

      if (
        typeof onReadingsChanged ===
        "function"
      ) {
        await onReadingsChanged();
      }
    } catch (error) {
      console.error(
        "24H READING SAVE ERROR:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to save platform readings."
      );

      setMessageType(
        "error"
      );
    } finally {
      setSaving("");
    }
  }

  // ==================================================
  // UPDATE SHIFT TOTAL OUTPUT
  // ==================================================

  async function syncShiftTotalOutput(
    totalOutput
  ) {
    const response =
      await fetch(
        `${supabaseUrl}/rest/v1/shifts` +
          `?id=eq.${encodeURIComponent(
            shiftId
          )}`,
        {
          method: "PATCH",

          headers: {
            apikey:
              supabaseAnonKey,

            Authorization:
              `Bearer ${accessToken}`,

            "Content-Type":
              "application/json",

            Prefer:
              "return=minimal",
          },

          body:
            JSON.stringify({
              total_output:
                roundMoney(
                  totalOutput
                ),
            }),
        }
      );

    if (!response.ok) {
      const result =
        await safeJson(
          response
        );

      throw new Error(
        result?.message ||
          result?.details ||
          "Unable to update shift total output."
      );
    }
  }

  // ==================================================
  // TOTAL
  // ==================================================

  const totalOutput =
    useMemo(
      () =>
        calculateShiftOutput({
          platforms,
          rows,
          shiftName,
        }),
      [
        platforms,
        rows,
        shiftName,
      ]
    );

  // ==================================================
  // DISPLAY
  // ==================================================

  if (!currentShift) {
    return null;
  }

  if (loading) {
    return (
      <Panel>
        Loading 24-hour platform readings...
      </Panel>
    );
  }

 return (
  <div
    style={{
      marginTop: "0",

      width: "100%",

      boxSizing: "border-box",

      backgroundColor: "white",

      padding: "25px",

      borderRadius: "12px",

      boxShadow:
        "0 2px 10px rgba(0,0,0,0.08)",
    }}
  >
      <div
        style={{
          display:
            "flex",

          justifyContent:
            "space-between",

          alignItems:
            "flex-start",

          gap:
            "20px",

          flexWrap:
            "wrap",

          marginBottom:
            "20px",
        }}
      >
        <div>
          <h2
            style={{
              margin:
                "0 0 6px 0",
            }}
          >
            Platform Sales – 24-Hour Shift System
          </h2>

          <div
            style={{
              color:
                "#64748b",
            }}
          >
            {shiftName ||
              "24-Hour Shift"}
          </div>
        </div>

        <div
          style={{
            padding:
              "12px 18px",

            backgroundColor:
              "#ecfdf5",

            color:
              "#166534",

            borderRadius:
              "8px",

            fontWeight:
              "bold",
          }}
        >
          Current Shift Output: KES{" "}
          {money(
            totalOutput
          )}
        </div>
      </div>

      {!isShift1 &&
        !isShift2 && (
          <div
            style={{
              padding:
                "12px",

              marginBottom:
                "18px",

              backgroundColor:
                "#fef2f2",

              color:
                "#991b1b",

              borderRadius:
                "8px",
            }}
          >
            This 24-hour shift does not have a valid SHIFT 1 or SHIFT 2 name.
          </div>
        )}

      {message && (
        <div
          style={{
            padding:
              "12px",

            marginBottom:
              "18px",

            borderRadius:
              "8px",

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

      {platforms.length ===
      0 ? (
        <div>
          No active platforms are assigned to this shop.
        </div>
      ) : (
        <>
          {/* ====================================== */}
          {/* SHIFT 1 */}
          {/* ====================================== */}

          {isShift1 && (
            <>
              <Stage
                title="9:00 AM Opening"
                description="These are the platform figures received at the 9 AM opening."
                platforms={
                  platforms
                }
                rows={rows}
                values={
                  values
                }
                readingKind="OPENING"
                saving={
                  saving
                }
                onChange={
                  updateValue
                }
                onSave={
                  saveStage
                }
                forceReadOnly
                hideSaveButton
              />

              {showShift1Handover && (
                <Stage
                  title="9:00 PM Handover"
                  description="Record the 9 PM readings. These close Shift 1 and hand the platforms to Shift 2."
                  platforms={
                    platforms
                  }
                  rows={rows}
                  values={
                    values
                  }
                  readingKind="HANDOVER_9PM"
                  saving={
                    saving
                  }
                  onChange={
                    updateValue
                  }
                  onSave={
                    saveStage
                  }
                />
              )}
            </>
          )}

          {/* ====================================== */}
          {/* SHIFT 2 */}
          {/* ====================================== */}

          {isShift2 && (
            <>
              <Stage
                title="9:00 PM Opening / Handover"
                description="These are the saved figures received from Shift 1."
                platforms={
                  platforms
                }
                rows={rows}
                values={
                  values
                }
                readingKind="OPENING"
                saving={
                  saving
                }
                onChange={
                  updateValue
                }
                onSave={
                  saveStage
                }
                forceReadOnly
                hideSaveButton
              />

              {showMidnightStage && (
                <Stage
                  title="11:59 PM Day Closing"
                  description="Record the resettable platform readings before the midnight reset. TABLE is excluded."
                  platforms={
                    resettablePlatforms
                  }
                  rows={rows}
                  values={
                    values
                  }
                  readingKind="MIDNIGHT_CLOSE"
                  saving={
                    saving
                  }
                  onChange={
                    updateValue
                  }
                  onSave={
                    saveStage
                  }
                />
              )}

              {(
                midnightSaved ||
                showClosing9amStage
              ) && (
                <div
                  style={{
                    padding:
                      "14px",

                    margin:
                      "18px 0",

                    backgroundColor:
                      "#eff6ff",

                    color:
                      "#1e3a8a",

                    borderRadius:
                      "8px",

                    fontWeight:
                      "bold",
                  }}
                >
                  12:00 AM — resetting platforms start again from 0. TABLE continues unchanged and has no midnight reading.
                </div>
              )}

              {showClosing9amStage && (
                <Stage
                  title="9:00 AM Shift Handover"
                  description="Record the final 9 AM readings. Resetting platforms show the figure accumulated since midnight. TABLE remains continuous."
                  platforms={
                    platforms
                  }
                  rows={rows}
                  values={
                    values
                  }
                  readingKind="CLOSING_9AM"
                  saving={
                    saving
                  }
                  onChange={
                    updateValue
                  }
                  onSave={
                    saveStage
                  }
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

// ==================================================
// STAGE
// ==================================================

function Stage({
  title,
  description,
  platforms,
  rows,
  values,
  readingKind,
  saving,
  onChange,
  onSave,
  forceReadOnly = false,
  hideSaveButton = false,
}) {
  const savedCount =
    platforms.filter(
      (platform) =>
        Boolean(
          rows[
            platform.id
          ]?.[readingKind]?.id
        )
    ).length;

  const allSaved =
    platforms.length > 0 &&
    savedCount ===
      platforms.length;

  return (
    <div
      style={{
        border:
          "1px solid #e2e8f0",

        borderRadius:
          "10px",

        padding:
          "18px",

        marginBottom:
          "18px",
      }}
    >
      <div
        style={{
          display:
            "flex",

          justifyContent:
            "space-between",

          gap:
            "15px",

          marginBottom:
            "6px",
        }}
      >
        <strong>
          {title}
        </strong>

        <span
          style={{
            color:
              allSaved
                ? "#15803d"
                : "#64748b",

            fontSize:
              "13px",

            fontWeight:
              "bold",
          }}
        >
          {savedCount} /{" "}
          {platforms.length}
          {allSaved
            ? " ✓"
            : ""}
        </span>
      </div>

      <div
        style={{
          color:
            "#64748b",

          fontSize:
            "13px",

          marginBottom:
            "15px",
        }}
      >
        {description}
      </div>

      {platforms.map(
        (platform) => {
          const saved =
            Boolean(
              rows[
                platform.id
              ]?.[
                readingKind
              ]?.id
            );

          const readOnly =
            forceReadOnly ||
            saved;

          return (
            <div
              key={
                platform.id
              }
              style={{
                display:
                  "grid",

                gridTemplateColumns:
                  "minmax(120px, 1fr) minmax(150px, 220px)",

                gap:
                  "12px",

                alignItems:
                  "center",

                marginBottom:
                  "10px",
              }}
            >
              <div
                style={{
                  fontWeight:
                    "bold",
                }}
              >
                {
                  platform.platform_name
                }
              </div>

              <input
                type="number"
                step="0.01"
                value={
                  values[
                    platform.id
                  ]?.[
                    readingKind
                  ] ?? ""
                }
                disabled={
                  Boolean(
                    saving
                  ) ||
                  readOnly
                }
                onChange={(
                  event
                ) =>
                  onChange(
                    platform.id,
                    readingKind,
                    event.target.value
                  )
                }
                style={{
                  width:
                    "100%",

                  boxSizing:
                    "border-box",

                  padding:
                    "11px",

                  border:
                    readOnly
                      ? "1px solid #86efac"
                      : "1px solid #cbd5e1",

                  borderRadius:
                    "7px",

                  backgroundColor:
                    readOnly
                      ? "#f0fdf4"
                      : "white",
                }}
              />
            </div>
          );
        }
      )}

      {!allSaved &&
        !hideSaveButton && (
          <button
            type="button"
            onClick={() =>
              onSave(
                readingKind
              )
            }
            disabled={
              Boolean(
                saving
              )
            }
            style={{
              width:
                "100%",

              marginTop:
                "8px",

              padding:
                "12px",

              border:
                "none",

              borderRadius:
                "7px",

              backgroundColor:
                saving
                  ? "#94a3b8"
                  : "#168d32",

              color:
                "white",

              fontWeight:
                "bold",

              cursor:
                saving
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            {saving ===
            readingKind
              ? "Saving..."
              : `Save ${title}`}
          </button>
        )}
    </div>
  );
}

// ==================================================
// VALIDATE READING
//
// UNIVERSAL PLATFORM RULE:
// Any finite signed number is valid.
//
// There is NO:
// - value >= 0 rule
// - closing >= opening rule
// - TABLE cannot go backwards rule
//
// The only sequencing rule retained is:
// resettable SHIFT 2 platforms must have their
// 11:59 PM reading before their 9 AM reading.
// ==================================================

function validateReading({
  platform,
  readingKind,
  values,
  shiftName,
}) {
  const platformValues =
    values[
      platform.id
    ] || {};

  const table =
    isTable(
      platform
    );

  const midnight =
    numericOrNull(
      platformValues.MIDNIGHT_CLOSE
    );

  if (
    shiftName ===
      "SHIFT 2" &&
    readingKind ===
      "CLOSING_9AM" &&
    !table &&
    midnight === null
  ) {
    return `${platform.platform_name} 11:59 PM reading must be saved before the 9 AM closing reading.`;
  }

  return "";
}

// ==================================================
// CALCULATE SHIFT OUTPUT
//
// SIGNED ARITHMETIC:
//
// SHIFT 1:
// 9 PM - 9 AM opening
//
// SHIFT 2 RESETTABLE:
// (11:59 PM - 9 PM opening) + 9 AM
//
// SHIFT 2 TABLE:
// 9 AM - 9 PM opening
//
// Negative results are valid.
// ==================================================

function calculateShiftOutput({
  platforms,
  rows,
  shiftName,
}) {
  let total = 0;

  for (
    const platform of platforms
  ) {
    const platformRows =
      rows[
        platform.id
      ] || {};

    const opening =
      numericOrNull(
        platformRows
          .OPENING
          ?.reading_value
      );

    if (
      shiftName ===
      "SHIFT 1"
    ) {
      const handover =
        numericOrNull(
          platformRows
            .HANDOVER_9PM
            ?.reading_value
        );

      if (
        opening !== null &&
        handover !== null
      ) {
        total +=
          handover -
          opening;
      }

      continue;
    }

    if (
      shiftName ===
      "SHIFT 2"
    ) {
      const closing9am =
        numericOrNull(
          platformRows
            .CLOSING_9AM
            ?.reading_value
        );

      if (
        isTable(
          platform
        )
      ) {
        if (
          opening !== null &&
          closing9am !==
            null
        ) {
          total +=
            closing9am -
            opening;
        }

        continue;
      }

      const midnight =
        numericOrNull(
          platformRows
            .MIDNIGHT_CLOSE
            ?.reading_value
        );

      if (
        opening !== null &&
        midnight !== null &&
        closing9am !== null
      ) {
        total +=
          (
            midnight -
            opening
          ) +
          closing9am;
      }
    }
  }

  return roundMoney(
    total
  );
}

// ==================================================
// STAGE SAVED HELPER
// ==================================================

function isStageCompletelySaved({
  platforms,
  rows,
  readingKind,
}) {
  if (
    !Array.isArray(
      platforms
    ) ||
    platforms.length === 0
  ) {
    return false;
  }

  return platforms.every(
    (platform) =>
      Boolean(
        rows[
          platform.id
        ]?.[
          readingKind
        ]?.id
      )
  );
}

// ==================================================
// NAIROBI TIME
// ==================================================

function getNairobiTimeParts(
  date = new Date()
) {
  const formatter =
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone:
          "Africa/Nairobi",

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",

        hour:
          "2-digit",

        minute:
          "2-digit",

        second:
          "2-digit",

        hourCycle:
          "h23",
      }
    );

  const parts =
    formatter.formatToParts(
      date
    );

  const values = {};

  for (
    const part of parts
  ) {
    if (
      part.type !==
      "literal"
    ) {
      values[
        part.type
      ] =
        part.value;
    }
  }

  return {
    year:
      Number(
        values.year
      ),

    month:
      Number(
        values.month
      ),

    day:
      Number(
        values.day
      ),

    hour:
      Number(
        values.hour
      ),

    minute:
      Number(
        values.minute
      ),

    second:
      Number(
        values.second
      ),
  };
}

// ==================================================
// SHIFT 1 - 9 PM STAGE
// ==================================================

function isShift1NinePmStageOpen(
  time
) {
  return (
    time.hour >= 21
  );
}

// ==================================================
// SHIFT 2 - 11:59 PM STAGE
// ==================================================

function isShift2MidnightStageOpen(
  time
) {
  if (
    time.hour === 23 &&
    time.minute >= 59
  ) {
    return true;
  }

  return (
    time.hour >= 0 &&
    time.hour < 9
  );
}

// ==================================================
// SHIFT 2 - 9 AM STAGE
// ==================================================

function isShift2NineAmStageOpen(
  time
) {
  return (
    time.hour >= 9
  );
}

// ==================================================
// HELPERS
// ==================================================

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

function normaliseShiftName(
  value
) {
  const text =
    String(
      value || ""
    )
      .trim()
      .toUpperCase()
      .replace(
        /[_-]+/g,
        " "
      )
      .replace(
        /\s+/g,
        " "
      );

  if (
    text ===
      "SHIFT 1" ||
    text ===
      "SHIFT1"
  ) {
    return "SHIFT 1";
  }

  if (
    text ===
      "SHIFT 2" ||
    text ===
      "SHIFT2"
  ) {
    return "SHIFT 2";
  }

  return text;
}

function stageLabel(
  kind
) {
  if (
    kind ===
    "OPENING"
  ) {
    return "Opening";
  }

  if (
    kind ===
    "HANDOVER_9PM"
  ) {
    return "9 PM handover";
  }

  if (
    kind ===
    "MIDNIGHT_CLOSE"
  ) {
    return "11:59 PM closing";
  }

  if (
    kind ===
    "CLOSING_9AM"
  ) {
    return "9 AM handover";
  }

  return kind;
}

function numericOrNull(
  value
) {
  if (
    value === "" ||
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const number =
    Number(value);

  return Number.isFinite(
    number
  )
    ? number
    : null;
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

function money(
  value
) {
  const numeric =
    Number(value);

  const safeValue =
    Number.isFinite(
      numeric
    )
      ? numeric
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

async function safeJson(
  response
) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function Panel({
  children,
}) {
  return (
    <div
      style={{
        marginTop:
          "24px",

        padding:
          "25px",

        backgroundColor:
          "white",

        borderRadius:
          "12px",
      }}
    >
      {children}
    </div>
  );
}
