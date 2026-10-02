"use client";

import { useEffect, useMemo, useState } from "react";

const TABLE_NAME = "TABLE";

export default function PlatformReadings24Hour({
  user,
  currentShift,
  onReadingsChanged,
}) {
  const [platforms, setPlatforms] = useState([]);
  const [rows, setRows] = useState({});
  const [values, setValues] = useState({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

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
  // LOAD PLATFORMS + ALL READINGS
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
        setLoading(true);
        setMessage("");
        setMessageType("");

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
          Array.isArray(platformData)
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
  ]);

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

      if (
        Number.isNaN(
          numericValue
        ) ||
        numericValue < 0
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
          value:
            numericValue,
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

      // Tell the parent report that platform readings
      // and shift totals have changed.
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
        marginTop:
          "24px",

        backgroundColor:
          "white",

        padding:
          "25px",

        borderRadius:
          "12px",

        boxShadow:
          "0 2px 10px rgba(0,0,0,0.08)",

        maxWidth:
          "1100px",
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
          {isShift1 && (
            <>
              <Stage
                title="9:00 AM Opening"
                description="Record the platform figures available at the 9 AM handover."
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
              />

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
            </>
          )}

          {isShift2 && (
            <>
              <Stage
                title="9:00 PM Opening / Handover"
                description="These are the figures received from Shift 1."
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
              />

              <Stage
                title="11:59 PM Day Closing"
                description="Record PILOT, WEKEZA, MBK777, SPIN, STELLAR and other resetting platforms before the midnight reset. TABLE is excluded."
                platforms={platforms.filter(
                  (platform) =>
                    !isTable(
                      platform
                    )
                )}
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

              <Stage
                title="9:00 AM Shift Handover"
                description="Record the final 9 AM readings. For resetting platforms this is the figure accumulated since midnight. TABLE is its normal continuous handover reading."
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
                min="0"
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
                  saved
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
                    saved
                      ? "1px solid #86efac"
                      : "1px solid #cbd5e1",

                  borderRadius:
                    "7px",

                  backgroundColor:
                    saved
                      ? "#f0fdf4"
                      : "white",
                }}
              />
            </div>
          );
        }
      )}

      {!allSaved && (
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
// ==================================================

function validateReading({
  platform,
  readingKind,
  value,
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

  const opening =
    numericOrNull(
      platformValues.OPENING
    );

  const handover =
    numericOrNull(
      platformValues.HANDOVER_9PM
    );

  const midnight =
    numericOrNull(
      platformValues.MIDNIGHT_CLOSE
    );

  // ==================================================
  // SHIFT 1 - 9 PM HANDOVER
  // Must be >= 9 AM opening.
  // ==================================================

  if (
    shiftName ===
      "SHIFT 1" &&
    readingKind ===
      "HANDOVER_9PM" &&
    opening !== null &&
    value < opening
  ) {
    return `${platform.platform_name} 9 PM reading cannot be lower than its 9 AM opening reading of ${opening}.`;
  }

  // ==================================================
  // SHIFT 2 - 11:59 PM CLOSE
  //
  // SHIFT 2 receives the 9 PM figure as OPENING.
  // Therefore MIDNIGHT_CLOSE must be compared to
  // OPENING, not HANDOVER_9PM.
  // TABLE never reaches this stage.
  // ==================================================

  if (
    shiftName ===
      "SHIFT 2" &&
    readingKind ===
      "MIDNIGHT_CLOSE" &&
    opening !== null &&
    value < opening
  ) {
    return `${platform.platform_name} 11:59 PM reading cannot be lower than its 9 PM opening reading of ${opening}.`;
  }

  // Defensive fallback for any future use where
  // HANDOVER_9PM exists in the same shift.
  if (
    shiftName !==
      "SHIFT 2" &&
    readingKind ===
      "MIDNIGHT_CLOSE" &&
    handover !== null &&
    value < handover
  ) {
    return `${platform.platform_name} 11:59 PM reading cannot be lower than its 9 PM reading of ${handover}.`;
  }

  // ==================================================
  // TABLE - SHIFT 2 9 AM
  //
  // TABLE is continuous. It cannot go backwards.
  // ==================================================

  if (
    readingKind ===
      "CLOSING_9AM" &&
    table &&
    opening !== null &&
    value < opening
  ) {
    return `TABLE 9 AM handover cannot be lower than its opening reading of ${opening}.`;
  }

  // ==================================================
  // RESETTABLE PLATFORMS - SHIFT 2 9 AM
  //
  // Midnight reading must already exist.
  // The 9 AM reading may be lower than the previous
  // night because the platform reset to 0 at midnight.
  // ==================================================

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

    // ==============================================
    // SHIFT 1
    //
    // 9 AM -> 9 PM
    // ==============================================

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
        handover !== null &&
        handover >=
          opening
      ) {
        total +=
          handover -
          opening;
      }

      continue;
    }

    // ==============================================
    // SHIFT 2
    // ==============================================

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

      // ------------------------------------------
      // TABLE
      //
      // Continuous:
      // 9 PM opening -> next 9 AM closing
      // ------------------------------------------

      if (
        isTable(
          platform
        )
      ) {
        if (
          opening !== null &&
          closing9am !==
            null &&
          closing9am >=
            opening
        ) {
          total +=
            closing9am -
            opening;
        }

        continue;
      }

      // ------------------------------------------
      // RESETTABLE PLATFORM
      //
      // 9 PM -> 11:59 PM
      // +
      // 12 AM -> 9 AM
      //
      // At midnight counter resets to 0.
      // ------------------------------------------

      const midnight =
        numericOrNull(
          platformRows
            .MIDNIGHT_CLOSE
            ?.reading_value
        );

      if (
        opening !== null &&
        midnight !== null &&
        closing9am !== null &&
        midnight >=
          opening
      ) {
        total +=
          midnight -
          opening +
          closing9am;
      }
    }
  }

  return roundMoney(
    total
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

  return Number.isNaN(
    number
  )
    ? null
    : number;
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
