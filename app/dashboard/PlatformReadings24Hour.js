"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const TABLE_NAME = "TABLE";

// ==================================================
// TEAM LEGEND PROFESSIONAL DARK THEME
// ==================================================

const THEME = {
  background: "#101e2d",
  backgroundDeep: "#0b1725",
  backgroundRaised: "#16283a",
  backgroundInput: "#0b1928",
  border: "#304255",
  borderSoft: "#25394d",

  text: "#f0f4f8",
  secondary: "#c3cfdb",
  muted: "#95a8ba",

  gold: "#e0bd70",
  green: "#37c99c",
  greenDark: "#176b56",
  greenBackground: "#102e2a",

  red: "#fb94a0",
  redBackground: "#39232d",

  blue: "#7cb9f4",
  blueBackground: "#132d43",
};

const shellStyle = {
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  padding: "clamp(12px, 1.6vw, 22px)",

  background:
    "linear-gradient(145deg, #142538 0%, #0e1c2b 100%)",

  color: THEME.text,

  border: `1px solid ${THEME.border}`,
  borderRadius: 11,

  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',

  fontSize: 12,
  lineHeight: 1.6,

  boxShadow: "0 8px 26px rgba(0,0,0,0.15)",
};

const headerStyle = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: 14,

  paddingBottom: 15,
  marginBottom: 15,

  borderBottom: `1px solid ${THEME.border}`,
};

const headingStyle = {
  margin: 0,
  fontSize: "clamp(14px,1.4vw,18px)",
  fontWeight: 850,
  color: THEME.gold,
  letterSpacing: ".025em",
};

const shiftLabelStyle = {
  marginTop: 7,
  fontSize: 11,
  fontWeight: 750,
  color: THEME.text,
};

const dateLabelStyle = {
  marginTop: 4,
  fontSize: 10,
  color: THEME.muted,
};

const outputBadgeStyle = {
  padding: "10px 13px",

  background: THEME.greenBackground,
  border: "1px solid #286b59",
  borderLeft: `3px solid ${THEME.green}`,

  borderRadius: 8,
  color: "#a8ebd1",

  fontSize: 12,
  fontWeight: 800,
  fontVariantNumeric: "tabular-nums",

  overflowWrap: "anywhere",
};

const stageStyle = {
  marginBottom: 14,
  padding: "clamp(11px,1.4vw,17px)",

  background: THEME.backgroundDeep,

  border: `1px solid ${THEME.border}`,
  borderRadius: 9,

  boxShadow: "0 4px 15px rgba(0,0,0,.08)",
};

const stageHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 10,

  paddingBottom: 9,
  marginBottom: 9,

  borderBottom: `1px solid ${THEME.borderSoft}`,
};

const stageTitleStyle = {
  fontSize: 12,
  fontWeight: 850,
  color: THEME.gold,
};

const stageDescriptionStyle = {
  color: THEME.muted,
  fontSize: 11,
  lineHeight: 1.6,
  marginBottom: 13,
};

const platformRowStyle = {
  display: "grid",

  gridTemplateColumns:
    "minmax(0,1fr) minmax(100px,38%)",

  gap: 9,
  alignItems: "center",

  padding: "7px 0",
  borderBottom: `1px solid ${THEME.borderSoft}`,
};

const platformNameStyle = {
  color: THEME.secondary,
  fontSize: 11,
  fontWeight: 750,
  overflowWrap: "anywhere",
};

const readingInputStyle = {
  width: "100%",
  minWidth: 0,
  minHeight: 35,
  boxSizing: "border-box",

  padding: "8px 10px",

  background: THEME.backgroundInput,
  color: THEME.text,

  border: `1px solid ${THEME.border}`,
  borderRadius: 6,

  fontFamily: "inherit",
  fontSize: 12,
  fontWeight: 700,

  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
  outlineColor: THEME.gold,
};

const saveButtonStyle = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",

  marginTop: 15,
  padding: "11px 14px",

  border: "1px solid #36b991",
  borderRadius: 7,

  background:
    "linear-gradient(90deg, #239979 0%, #27bd86 100%)",

  color: "#ffffff",
  fontFamily: "inherit",
  fontSize: 12,
  fontWeight: 850,

  cursor: "pointer",
  textAlign: "center",

  boxShadow: "0 3px 10px rgba(0,0,0,0.1)",
};

const warningStyle = {
  padding: "11px 13px",
  marginBottom: 14,

  background: THEME.redBackground,
  color: THEME.red,

  border: "1px solid #724353",
  borderLeft: `3px solid ${THEME.red}`,
  borderRadius: 7,

  fontSize: 11,
  lineHeight: 1.6,
};

const resetNoticeStyle = {
  padding: "11px 13px",
  margin: "14px 0",

  background: THEME.blueBackground,

  color: "#a9cff4",

  border: "1px solid #315572",
  borderLeft: `3px solid ${THEME.blue}`,
  borderRadius: 7,

  fontSize: 11,
  fontWeight: 700,
  lineHeight: 1.6,
};

// ==================================================
// MAIN COMPONENT
// ==================================================

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

  const [now, setNow] = useState(() => new Date());

  // Platform definitions change rarely. Recheck periodically and whenever
  // the shop/session changes; saved financial readings still refresh normally.
  const platformCacheRef = useRef(null);
  const PLATFORM_CACHE_MS = 5 * 60 * 1000;

  // ==================================================
  // SUPABASE
  // ==================================================

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const shopId =
    currentShift?.shop_id ||
    user?.shop_id ||
    user?.shopId ||
    null;

  const cashierId =
    user?.profile_id ||
    user?.id ||
    user?.user_id ||
    user?.auth_user_id ||
    null;

  const accessToken = user?.access_token || null;

  const shiftId = currentShift?.id || null;

  const shiftName = normaliseShiftName(
    currentShift?.shift_name
  );

  const isShift1 = shiftName === "SHIFT 1";
  const isShift2 = shiftName === "SHIFT 2";

  const isOpen =
    String(currentShift?.status || "")
      .trim()
      .toUpperCase() === "OPEN";

  const requestHeaders = {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  // ==================================================
  // LIVE NAIROBI CLOCK
  // ==================================================

  useEffect(() => {
    setNow(new Date());

    const timer = setInterval(
      () => setNow(new Date()),
      15000
    );

    return () => clearInterval(timer);
  }, []);

  // ==================================================
  // RESET INPUTS ON SHIFT CHANGE
  // ==================================================

  useEffect(() => {
    setPlatforms([]);
    setRows({});
    setValues({});

    setLoading(true);

    setMessage("");
    setMessageType("");
  }, [shiftId]);

  // ==================================================
  // LOAD PLATFORMS AND SAVED READINGS
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

    const controller = new AbortController();
    let cancelled = false;

    async function loadData() {
      try {
        const cacheKey = `${supabaseUrl}:${shopId}:${accessToken}`;
        const cached = platformCacheRef.current;
        const useCachedPlatforms =
          cached?.key === cacheKey &&
          Date.now() - cached.loadedAt < PLATFORM_CACHE_MS;

        const platformPromise = useCachedPlatforms
          ? Promise.resolve(cached.data)
          : fetch(
              `${supabaseUrl}/rest/v1/shop_platforms` +
                `?shop_id=eq.${encodeURIComponent(shopId)}` +
                `&is_active=eq.true` +
                `&select=id,shop_id,platform_name,reading_type,display_order,is_active` +
                `&order=display_order.asc`,
              {
                method: "GET",
                headers: requestHeaders,
                cache: "no-store",
                signal: controller.signal,
              }
            ).then(async (response) => {
              const data = await safeJson(response);
              if (!response.ok) {
                throw new Error(
                  data?.message || data?.details ||
                    "Unable to load shop platforms."
                );
              }
              return Array.isArray(data) ? data : [];
            });

        const readingsPromise = fetch(
          `${supabaseUrl}/rest/v1/platform_readings` +
            `?shift_id=eq.${encodeURIComponent(shiftId)}` +
            `&select=id,shift_id,platform_id,reading_kind,reading_value,recorded_at,recorded_by` +
            `&order=recorded_at.asc`,
          {
            method: "GET",
            headers: requestHeaders,
            cache: "no-store",
            signal: controller.signal,
          }
        ).then(async (response) => {
          const data = await safeJson(response);
          if (!response.ok) {
            throw new Error(
              data?.message || data?.details ||
                "Unable to load platform readings."
            );
          }
          return Array.isArray(data) ? data : [];
        });

        const [platformData, readingData] = await Promise.all([
          platformPromise,
          readingsPromise,
        ]);

        if (cancelled) return;

        if (!useCachedPlatforms) {
          platformCacheRef.current = {
            key: cacheKey,
            data: platformData,
            loadedAt: Date.now(),
          };
        }

        const readingMap = {};
        for (const row of readingData) {
          if (!row.platform_id || !row.reading_kind) continue;
          if (!readingMap[row.platform_id]) {
            readingMap[row.platform_id] = {};
          }
          readingMap[row.platform_id][row.reading_kind] = row;
        }

        setPlatforms(platformData);
        setRows(readingMap);
      } catch (error) {
        if (cancelled || error?.name === "AbortError") return;
        console.error("24H PLATFORM LOAD ERROR:", error);
        setMessage(
          error?.message || "Unable to load 24-hour platform readings."
        );
        setMessageType("error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();

    return () => {
      cancelled = true;
      controller.abort();
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
  // ==================================================
  // SAVED STATUS
  // ==================================================

  const resettablePlatforms = useMemo(
    () =>
      platforms.filter(
        (platform) => !isTable(platform)
      ),
    [platforms]
  );

  const shift1HandoverSaved = useMemo(
    () =>
      isStageCompletelySaved({
        platforms,
        rows,
        readingKind: "HANDOVER_9PM",
      }),
    [platforms, rows]
  );

  const midnightSaved = useMemo(
    () =>
      isStageCompletelySaved({
        platforms: resettablePlatforms,
        rows,
        readingKind: "MIDNIGHT_CLOSE",
      }),
    [resettablePlatforms, rows]
  );

  const closing9amSaved = useMemo(
    () =>
      isStageCompletelySaved({
        platforms,
        rows,
        readingKind: "CLOSING_9AM",
      }),
    [platforms, rows]
  );

  // ==================================================
  // DATE-AWARE VISIBILITY
  //
  // Once a stage opens, it stays available.
  // ==================================================

  const showShift1Handover =
    isShift1 &&
    (
      shift1HandoverSaved ||
      isStageAvailable(
        currentShift,
        "HANDOVER_9PM",
        now
      )
    );

  const showMidnightStage =
    isShift2 &&
    (
      midnightSaved ||
      isStageAvailable(
        currentShift,
        "MIDNIGHT_CLOSE",
        now
      )
    );

  const showClosing9amStage =
    isShift2 &&
    (
      closing9amSaved ||
      isStageAvailable(
        currentShift,
        "CLOSING_9AM",
        now
      )
    );

  // ==================================================
  // TOTAL OUTPUT
  // ==================================================

  const totalOutput = useMemo(
    () =>
      calculateShiftOutput({
        platforms,
        rows,
        shiftName,
      }),
    [platforms, rows, shiftName]
  );

  // ==================================================
  // INPUT UPDATE
  // ==================================================

  function updateValue(
    platformId,
    readingKind,
    value
  ) {
    if (
      !isOpen ||
      rows[platformId]?.[readingKind]?.id
    ) {
      return;
    }

    setValues((old) => ({
      ...old,

      [platformId]: {
        ...(old[platformId] || {}),
        [readingKind]: value,
      },
    }));

    setMessage("");
    setMessageType("");
  }

  // ==================================================
  // SAVE READING STAGE
  // ==================================================

  async function saveStage(readingKind) {
    if (saving) return;

    if (
      !shiftId ||
      !cashierId ||
      !accessToken
    ) {
      setMessage(
        "Shift or login information is missing."
      );
      setMessageType("error");
      return;
    }

    if (!isOpen) {
      setMessage(
        "This shift is closed. Contact Admin for recovery."
      );
      setMessageType("error");
      return;
    }

    const allowedKind =
      (
        isShift1 &&
        readingKind === "HANDOVER_9PM"
      ) ||
      (
        isShift2 &&
        (
          readingKind === "MIDNIGHT_CLOSE" ||
          readingKind === "CLOSING_9AM"
        )
      );

    if (
      !allowedKind ||
      !isStageAvailable(
        currentShift,
        readingKind,
        new Date()
      )
    ) {
      setMessage(
        `${stageLabel(
          readingKind
        )} is not yet available for this shift.`
      );

      setMessageType("error");
      return;
    }

    // TABLE never receives a midnight reading.

    const stagePlatforms =
      readingKind === "MIDNIGHT_CLOSE"
        ? resettablePlatforms
        : platforms;

    if (stagePlatforms.length === 0) {
      setMessage(
        "No platforms are available for this stage."
      );
      setMessageType("error");
      return;
    }

    const unsaved = stagePlatforms.filter(
      (platform) =>
        !rows[platform.id]?.[readingKind]?.id
    );

    if (unsaved.length === 0) {
      setMessage(
        `${stageLabel(
          readingKind
        )} readings are already saved.`
      );

      setMessageType("success");
      return;
    }

    const pendingRecords = [];

    for (const platform of unsaved) {
      const raw =
        values[platform.id]?.[readingKind];

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

        setMessageType("error");
        return;
      }

      const numericValue = Number(raw);

      // Negative, zero and positive values valid.

      if (!Number.isFinite(numericValue)) {
        setMessage(
          `Enter a valid reading for ${platform.platform_name}.`
        );

        setMessageType("error");
        return;
      }

      const validationError = validateReading({
        platform,
        readingKind,
        rows,
        shiftName,
      });

      if (validationError) {
        setMessage(validationError);
        setMessageType("error");
        return;
      }

      pendingRecords.push({
        platform,
        numericValue,
      });
    }

    setSaving(readingKind);
    setMessage("");
    setMessageType("");

    let readingsWereSaved = false;

    try {
      // Verify shift status again before saving.

      const freshResponse = await fetch(
        `${supabaseUrl}/rest/v1/shifts` +
          `?id=eq.${encodeURIComponent(shiftId)}` +
          `&select=id,shop_id,status,business_date,shift_name&limit=1`,
        {
          method: "GET",
          headers: requestHeaders,
          cache: "no-store",
        }
      );

      const freshData =
        await safeJson(freshResponse);

      if (!freshResponse.ok) {
        throw new Error(
          freshData?.message ||
            "Unable to verify shift status."
        );
      }

      const freshShift = Array.isArray(freshData)
        ? freshData[0]
        : null;

      if (
        !freshShift ||
        String(freshShift.status).toUpperCase() !==
          "OPEN"
      ) {
        throw new Error(
          "This shift is no longer OPEN. Contact Admin."
        );
      }

      if (
        String(freshShift.shop_id) !==
        String(shopId)
      ) {
        throw new Error(
          "This shift does not belong to the selected shop."
        );
      }

      if (
        !isStageAvailable(
          freshShift,
          readingKind,
          new Date()
        )
      ) {
        throw new Error(
          "The scheduled time for this shift stage has not arrived."
        );
      }

      const recordedAt =
        new Date().toISOString();

      const payload = pendingRecords.map(
        ({ platform, numericValue }) => ({
          shift_id: shiftId,
          platform_id: platform.id,
          reading_kind: readingKind,
          reading_value: roundMoney(
            numericValue
          ),
          recorded_at: recordedAt,
          recorded_by: cashierId,
        })
      );

      // Save all readings in one request.

      const response = await fetch(
        `${supabaseUrl}/rest/v1/platform_readings`,
        {
          method: "POST",
          headers: {
            ...requestHeaders,
            Prefer: "return=representation",
          },
          body: JSON.stringify(payload),
        }
      );

      const result = await safeJson(response);

      if (!response.ok) {
        throw new Error(
          result?.message ||
            result?.details ||
            result?.hint ||
            "Unable to save platform readings."
        );
      }

      if (
        !Array.isArray(result) ||
        result.length !== payload.length
      ) {
        throw new Error(
          "Reading save response was incomplete. Refresh before retrying."
        );
      }

      readingsWereSaved = true;

      const newRows = { ...rows };

      for (const savedRow of result) {
        newRows[savedRow.platform_id] = {
          ...(newRows[savedRow.platform_id] ||
            {}),

          [readingKind]: savedRow,
        };
      }

      setRows(newRows);

      const newOutput = calculateShiftOutput({
        platforms,
        rows: newRows,
        shiftName,
      });

      await syncShiftTotalOutput(newOutput);

      setMessage(
        `${stageLabel(
          readingKind
        )} readings saved and locked successfully.`
      );

      setMessageType("success");
    } catch (error) {
      console.error(
        "24H READING SAVE ERROR:",
        error
      );

      setMessage(
        readingsWereSaved
          ? `Readings were saved, but the shift output could not be confirmed: ${
              error?.message ||
              "Refresh and contact Admin."
            }`
          : error?.message ||
              "Unable to save platform readings."
      );

      setMessageType("error");
    } finally {
      setSaving("");

      if (
        readingsWereSaved &&
        typeof onReadingsChanged === "function"
      ) {
        try {
          await onReadingsChanged();
        } catch (error) {
          console.error(
            "24H PARENT REFRESH ERROR:",
            error
          );
        }
      }
    }
  }

  // ==================================================
  // SYNC SHIFT OUTPUT
  // ==================================================

  async function syncShiftTotalOutput(
    totalOutputValue
  ) {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/shifts` +
        `?id=eq.${encodeURIComponent(shiftId)}` +
        `&status=eq.OPEN`,
      {
        method: "PATCH",
        headers: {
          ...requestHeaders,
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          total_output: roundMoney(
            totalOutputValue
          ),
        }),
      }
    );

    const result = await safeJson(response);

    if (!response.ok) {
      throw new Error(
        result?.message ||
          result?.details ||
          "Unable to update shift output."
      );
    }

    if (
      !Array.isArray(result) ||
      result.length === 0
    ) {
      throw new Error(
        "Shift was closed before total output could be updated."
      );
    }
  }

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
    <div style={shellStyle}>
      {/* HEADER */}

      <div style={headerStyle}>
        <div>
          <h2 style={headingStyle}>
            PLATFORM SALES — 24-HOUR SHIFT
          </h2>

          <div style={shiftLabelStyle}>
            {shiftName || "24-Hour Shift"}
          </div>

          <div style={dateLabelStyle}>
            Business date:{" "}
            {currentShift.business_date || "—"}
          </div>
        </div>

        <div style={outputBadgeStyle}>
          Current Shift Output: KES{" "}
          {money(totalOutput)}
        </div>
      </div>

      {/* CLOSED SHIFT NOTICE */}

      {!isOpen && (
        <div style={warningStyle}>
          This shift is CLOSED. Readings are
          view-only until Admin authorizes
          recovery.
        </div>
      )}

      {/* INVALID SHIFT NOTICE */}

      {!isShift1 && !isShift2 && (
        <div style={warningStyle}>
          This shift does not have a valid SHIFT 1
          or SHIFT 2 name.
        </div>
      )}

      {/* SUCCESS AND ERROR MESSAGES */}

      {message && (
        <div
          style={{
            ...warningStyle,

            background:
              messageType === "success"
                ? THEME.greenBackground
                : THEME.redBackground,

            color:
              messageType === "success"
                ? "#a8ebd1"
                : THEME.red,

            border:
              messageType === "success"
                ? "1px solid #286b59"
                : "1px solid #724353",

            borderLeft:
              messageType === "success"
                ? `3px solid ${THEME.green}`
                : `3px solid ${THEME.red}`,
          }}
        >
          {message}
        </div>
      )}

      {platforms.length === 0 ? (
        <div
          style={{
            padding: 14,
            background: THEME.backgroundDeep,
            border: `1px solid ${THEME.border}`,
            borderRadius: 7,
            color: THEME.muted,
            fontSize: 11,
          }}
        >
          No active platforms are assigned to
          this shop.
        </div>
      ) : (
        <>
          {/* =====================================
              SHIFT 1
          ===================================== */}

          {isShift1 && (
            <>
              <Stage
                title="9:00 AM Opening"
                description="These are the platform figures received at the 9 AM opening."
                platforms={platforms}
                rows={rows}
                values={values}
                readingKind="OPENING"
                saving={saving}
                onChange={updateValue}
                onSave={saveStage}
                forceReadOnly
                hideSaveButton
              />

              {showShift1Handover && (
                <Stage
                  title="9:00 PM Handover"
                  description="Record the 9 PM readings. This stage stays available if the shift is overdue."
                  platforms={platforms}
                  rows={rows}
                  values={values}
                  readingKind="HANDOVER_9PM"
                  saving={saving}
                  onChange={updateValue}
                  onSave={saveStage}
                  disableEditing={!isOpen}
                />
              )}
            </>
          )}

          {/* =====================================
              SHIFT 2
          ===================================== */}

          {isShift2 && (
            <>
              <Stage
                title="9:00 PM Opening / Handover"
                description="These are the saved figures received from Shift 1."
                platforms={platforms}
                rows={rows}
                values={values}
                readingKind="OPENING"
                saving={saving}
                onChange={updateValue}
                onSave={saveStage}
                forceReadOnly
                hideSaveButton
              />

              {/* 11:59 PM READINGS */}

              {showMidnightStage && (
                <Stage
                  title="11:59 PM Day Closing"
                  description="Record resettable platform readings before midnight. TABLE is excluded. Late entry remains available."
                  platforms={resettablePlatforms}
                  rows={rows}
                  values={values}
                  readingKind="MIDNIGHT_CLOSE"
                  saving={saving}
                  onChange={updateValue}
                  onSave={saveStage}
                  disableEditing={!isOpen}
                />
              )}

              {/* MIDNIGHT RESET NOTICE */}

              {(midnightSaved ||
                showClosing9amStage) && (
                <div style={resetNoticeStyle}>
                  12:00 AM — resetting platforms
                  start again from 0. TABLE
                  continues unchanged and has no
                  midnight reading.
                </div>
              )}

              {/* 9:00 AM HANDOVER */}

              {showClosing9amStage && (
                <Stage
                  title="9:00 AM Shift Handover"
                  description="Record the final 9 AM readings. Resettable platforms restart at midnight; TABLE remains continuous. Late entry remains available."
                  platforms={platforms}
                  rows={rows}
                  values={values}
                  readingKind="CLOSING_9AM"
                  saving={saving}
                  onChange={updateValue}
                  onSave={saveStage}
                  disableEditing={!isOpen}
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
// STAGE COMPONENT
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
  disableEditing = false,
}) {
  const savedCount = platforms.filter(
    (platform) =>
      Boolean(
        rows[platform.id]?.[readingKind]?.id
      )
  ).length;

  const allSaved =
    platforms.length > 0 &&
    savedCount === platforms.length;

  return (
    <div style={stageStyle}>
      {/* STAGE HEADER */}

      <div style={stageHeaderStyle}>
        <strong style={stageTitleStyle}>
          {title}
        </strong>

        <span
          style={{
            color: allSaved
              ? THEME.green
              : THEME.muted,

            fontSize: 11,
            fontWeight: 850,
          }}
        >
          {savedCount} / {platforms.length}
          {allSaved ? " ✓" : ""}
        </span>
      </div>

      {/* DESCRIPTION */}

      <div style={stageDescriptionStyle}>
        {description}
      </div>

      {/* PLATFORM READINGS */}

      {platforms.map((platform) => {
        const savedRow =
          rows[platform.id]?.[readingKind];

        const saved = Boolean(savedRow?.id);

        const readOnly =
          forceReadOnly ||
          saved ||
          disableEditing;

        const displayValue = saved
          ? savedRow.reading_value ?? ""
          : values[platform.id]?.[readingKind] ??
            "";

        return (
          <div
            key={platform.id}
            style={platformRowStyle}
          >
            <div style={platformNameStyle}>
              {platform.platform_name}
            </div>

            <input
              type="number"
              step="0.01"
              value={displayValue}
              disabled={
                Boolean(saving) ||
                readOnly
              }
              onChange={(event) =>
                onChange(
                  platform.id,
                  readingKind,
                  event.target.value
                )
              }
              style={{
                ...readingInputStyle,

                border: readOnly
                  ? "1px solid #2e6b57"
                  : `1px solid ${THEME.border}`,

                background: readOnly
                  ? THEME.greenBackground
                  : THEME.backgroundInput,

                color: readOnly
                  ? "#a8ebd1"
                  : THEME.text,

                cursor: readOnly
                  ? "not-allowed"
                  : "text",

                opacity: 1,
                WebkitTextFillColor: readOnly
                  ? "#a8ebd1"
                  : THEME.text,
              }}
            />
          </div>
        );
      })}

      {/* SAVE BUTTON */}

      {!allSaved &&
        !hideSaveButton &&
        !disableEditing && (
          <button
            type="button"
            onClick={() => onSave(readingKind)}
            disabled={Boolean(saving)}
            style={{
              ...saveButtonStyle,

              background: saving
                ? "#46576a"
                : saveButtonStyle.background,

              borderColor: saving
                ? "#526478"
                : "#36b991",

              cursor: saving
                ? "not-allowed"
                : "pointer",
            }}
          >
            {saving === readingKind
              ? "Saving..."
              : `Save ${title}`}
          </button>
        )}
    </div>
  );
}

// ==================================================
// VALIDATE READING SEQUENCE
//
// 11:59 PM readings must be saved before
// the 9:00 AM readings.
//
// Negative, zero and positive readings valid.
// ==================================================

function validateReading({
  platform,
  readingKind,
  rows,
  shiftName,
}) {
  if (
    shiftName === "SHIFT 2" &&
    readingKind === "CLOSING_9AM" &&
    !isTable(platform) &&
    !rows[platform.id]?.MIDNIGHT_CLOSE?.id
  ) {
    return (
      `${platform.platform_name} 11:59 PM reading must be saved ` +
      "before the 9 AM closing reading."
    );
  }

  return "";
}

// ==================================================
// CALCULATE SHIFT OUTPUT
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
// SIGNED ARITHMETIC PRESERVED
// ==================================================

function calculateShiftOutput({
  platforms,
  rows,
  shiftName,
}) {
  let total = 0;

  for (const platform of platforms) {
    const platformRows =
      rows[platform.id] || {};

    const opening = numericOrNull(
      platformRows.OPENING?.reading_value
    );

    if (shiftName === "SHIFT 1") {
      const handover = numericOrNull(
        platformRows.HANDOVER_9PM?.reading_value
      );

      if (
        opening !== null &&
        handover !== null
      ) {
        total += handover - opening;
      }

      continue;
    }

    if (shiftName === "SHIFT 2") {
      const closing9am = numericOrNull(
        platformRows.CLOSING_9AM?.reading_value
      );

      // TABLE is continuous.

      if (isTable(platform)) {
        if (
          opening !== null &&
          closing9am !== null
        ) {
          total += closing9am - opening;
        }

        continue;
      }

      // Resettable platforms.

      const midnight = numericOrNull(
        platformRows.MIDNIGHT_CLOSE
          ?.reading_value
      );

      if (
        opening !== null &&
        midnight !== null &&
        closing9am !== null
      ) {
        total +=
          midnight -
          opening +
          closing9am;
      }
    }
  }

  return roundMoney(total);
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
    !Array.isArray(platforms) ||
    platforms.length === 0
  ) {
    return false;
  }

  return platforms.every(
    (platform) =>
      Boolean(
        rows[platform.id]?.[readingKind]?.id
      )
  );
}

// ==================================================
// NAIROBI STAGE UNLOCKS
//
// SHIFT 1:
// 9 PM on business date
//
// SHIFT 2:
// 11:59 PM on business date
// 9 AM on following day
//
// Stage availability never expires by time.
// ==================================================

function isStageAvailable(
  shift,
  readingKind,
  date = new Date()
) {
  const name = normaliseShiftName(
    shift?.shift_name
  );

  const businessDate = String(
    shift?.business_date || ""
  ).slice(0, 10);

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      businessDate
    )
  ) {
    return false;
  }

  let unlockAt;

  if (
    name === "SHIFT 1" &&
    readingKind === "HANDOVER_9PM"
  ) {
    unlockAt =
      `${businessDate}T21:00:00`;
  } else if (
    name === "SHIFT 2" &&
    readingKind === "MIDNIGHT_CLOSE"
  ) {
    unlockAt =
      `${businessDate}T23:59:00`;
  } else if (
    name === "SHIFT 2" &&
    readingKind === "CLOSING_9AM"
  ) {
    unlockAt =
      `${addStageDays(
        businessDate,
        1
      )}T09:00:00`;
  } else {
    return false;
  }

  const time = getNairobiTimeParts(date);

  const pad = (value) =>
    String(value).padStart(2, "0");

  const nowKey =
    `${time.year}-` +
    `${pad(time.month)}-` +
    `${pad(time.day)}T` +
    `${pad(time.hour)}:` +
    `${pad(time.minute)}:` +
    `${pad(time.second)}`;

  return nowKey >= unlockAt;
}

// ==================================================
// ADD DAYS WITHOUT TIMEZONE DRIFT
// ==================================================

function addStageDays(
  dateString,
  days
) {
  const [year, month, day] = dateString
    .split("-")
    .map(Number);

  return new Date(
    Date.UTC(
      year,
      month - 1,
      day + days
    )
  )
    .toISOString()
    .slice(0, 10);
}

// ==================================================
// NAIROBI DATE AND TIME
// ==================================================

function getNairobiTimeParts(
  date = new Date()
) {
  const parts = new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: "Africa/Nairobi",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }
  ).formatToParts(date);

  const values = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

// ==================================================
// TABLE CHECK
// ==================================================

function isTable(platform) {
  return (
    String(
      platform?.platform_name || ""
    )
      .trim()
      .toUpperCase() === TABLE_NAME
  );
}

// ==================================================
// NORMALISE SHIFT NAME
// ==================================================

function normaliseShiftName(value) {
  const text = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

  if (
    text === "SHIFT 1" ||
    text === "SHIFT1"
  ) {
    return "SHIFT 1";
  }

  if (
    text === "SHIFT 2" ||
    text === "SHIFT2"
  ) {
    return "SHIFT 2";
  }

  return text;
}

// ==================================================
// STAGE LABEL
// ==================================================

function stageLabel(kind) {
  if (kind === "OPENING") {
    return "Opening";
  }

  if (kind === "HANDOVER_9PM") {
    return "9 PM handover";
  }

  if (kind === "MIDNIGHT_CLOSE") {
    return "11:59 PM closing";
  }

  if (kind === "CLOSING_9AM") {
    return "9 AM handover";
  }

  return kind;
}

// ==================================================
// NUMBER HELPER
// ==================================================

function numericOrNull(value) {
  if (
    value === "" ||
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

// ==================================================
// ROUND MONEY
// ==================================================

function roundMoney(value) {
  return (
    Math.round(
      (Number(value) + Number.EPSILON) * 100
    ) / 100
  );
}

// ==================================================
// MONEY FORMAT
// ==================================================

function money(value) {
  const numeric = Number(value);

  return (
    Number.isFinite(numeric)
      ? numeric
      : 0
  ).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ==================================================
// SAFE JSON
// ==================================================

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

// ==================================================
// LOADING PANEL
// ==================================================

function Panel({ children }) {
  return (
    <div
      style={{
        ...shellStyle,

        display: "flex",
        alignItems: "center",
        justifyContent: "center",

        minHeight: 120,
        color: THEME.secondary,
        fontSize: 12,
      }}
    >
      {children}
    </div>
  );
}
