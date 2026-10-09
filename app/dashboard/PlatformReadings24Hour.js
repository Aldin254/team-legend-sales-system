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
  const [now, setNow] = useState(() => new Date());

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const shopId =
    currentShift?.shop_id || user?.shop_id || user?.shopId || null;

  const cashierId =
    user?.profile_id ||
    user?.id ||
    user?.user_id ||
    user?.auth_user_id ||
    null;

  const accessToken = user?.access_token || null;
  const shiftId = currentShift?.id || null;
  const shiftName = normaliseShiftName(currentShift?.shift_name);
  const isShift1 = shiftName === "SHIFT 1";
  const isShift2 = shiftName === "SHIFT 2";
  const isOpen =
    String(currentShift?.status || "").trim().toUpperCase() === "OPEN";

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

  // Reset unsaved inputs when the selected shift changes.
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

    let cancelled = false;

    async function loadData() {
      try {
        const [platformResponse, readingResponse] =
          await Promise.all([
            fetch(
              `${supabaseUrl}/rest/v1/shop_platforms` +
                `?shop_id=eq.${encodeURIComponent(shopId)}` +
                `&is_active=eq.true` +
                `&select=id,shop_id,platform_name,reading_type,display_order,is_active` +
                `&order=display_order.asc`,
              {
                method: "GET",
                headers: requestHeaders,
                cache: "no-store",
              }
            ),

            fetch(
              `${supabaseUrl}/rest/v1/platform_readings` +
                `?shift_id=eq.${encodeURIComponent(shiftId)}` +
                `&select=id,shift_id,platform_id,reading_kind,reading_value,recorded_at,recorded_by` +
                `&order=recorded_at.asc`,
              {
                method: "GET",
                headers: requestHeaders,
                cache: "no-store",
              }
            ),
          ]);

        const [platformData, readingData] =
          await Promise.all([
            safeJson(platformResponse),
            safeJson(readingResponse),
          ]);

        if (!platformResponse.ok) {
          throw new Error(
            platformData?.message ||
              platformData?.details ||
              "Unable to load shop platforms."
          );
        }

        if (!readingResponse.ok) {
          throw new Error(
            readingData?.message ||
              readingData?.details ||
              "Unable to load platform readings."
          );
        }

        if (cancelled) return;

        const readingMap = {};

        for (
          const row of Array.isArray(readingData)
            ? readingData
            : []
        ) {
          if (!row.platform_id || !row.reading_kind) {
            continue;
          }

          if (!readingMap[row.platform_id]) {
            readingMap[row.platform_id] = {};
          }

          readingMap[row.platform_id][row.reading_kind] = row;
        }

        setPlatforms(
          Array.isArray(platformData) ? platformData : []
        );

        setRows(readingMap);
      } catch (error) {
        console.error("24H PLATFORM LOAD ERROR:", error);

        if (!cancelled) {
          setMessage(
            error?.message ||
              "Unable to load 24-hour platform readings."
          );

          setMessageType("error");
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
  // SAVED STATUS
  // ==================================================

  const resettablePlatforms = useMemo(
    () => platforms.filter((platform) => !isTable(platform)),
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
  // Once a stage opens, it never expires by time alone.
  // ==================================================

  const showShift1Handover =
    isShift1 &&
    (
      shift1HandoverSaved ||
      isStageAvailable(currentShift, "HANDOVER_9PM", now)
    );

  const showMidnightStage =
    isShift2 &&
    (
      midnightSaved ||
      isStageAvailable(currentShift, "MIDNIGHT_CLOSE", now)
    );

  const showClosing9amStage =
    isShift2 &&
    (
      closing9amSaved ||
      isStageAvailable(currentShift, "CLOSING_9AM", now)
    );

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
  // INPUT
  // ==================================================

  function updateValue(platformId, readingKind, value) {
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
  // SAVE A READING STAGE
  // ==================================================

  async function saveStage(readingKind) {
    if (saving) return;

    if (!shiftId || !cashierId || !accessToken) {
      setMessage("Shift or login information is missing.");
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
      (isShift1 && readingKind === "HANDOVER_9PM") ||
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
        `${stageLabel(readingKind)} is not yet available for this shift.`
      );
      setMessageType("error");
      return;
    }

    // TABLE does not receive a midnight reading.
    const stagePlatforms =
      readingKind === "MIDNIGHT_CLOSE"
        ? resettablePlatforms
        : platforms;

    if (stagePlatforms.length === 0) {
      setMessage("No platforms are available for this stage.");
      setMessageType("error");
      return;
    }

    const unsaved = stagePlatforms.filter(
      (platform) =>
        !rows[platform.id]?.[readingKind]?.id
    );

    if (unsaved.length === 0) {
      setMessage(
        `${stageLabel(readingKind)} readings are already saved.`
      );
      setMessageType("success");
      return;
    }

    const pendingRecords = [];

    for (const platform of unsaved) {
      const raw = values[platform.id]?.[readingKind];

      if (
        raw === "" ||
        raw === null ||
        raw === undefined
      ) {
        setMessage(
          `Enter ${stageLabel(readingKind)} for ${platform.platform_name}.`
        );
        setMessageType("error");
        return;
      }

      const numericValue = Number(raw);

      // Negative, zero and positive readings are valid.
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
      // Recheck the shift before saving.
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

      const freshData = await safeJson(freshResponse);

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
        String(freshShift.status).toUpperCase() !== "OPEN"
      ) {
        throw new Error(
          "This shift is no longer OPEN. Contact Admin."
        );
      }

      if (
        String(freshShift.shop_id) !== String(shopId)
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

      const recordedAt = new Date().toISOString();

      const payload = pendingRecords.map(
        ({ platform, numericValue }) => ({
          shift_id: shiftId,
          platform_id: platform.id,
          reading_kind: readingKind,
          reading_value: roundMoney(numericValue),
          recorded_at: recordedAt,
          recorded_by: cashierId,
        })
      );

      // Save all unsaved platform readings in one request.
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
          ...(newRows[savedRow.platform_id] || {}),
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
        `${stageLabel(readingKind)} readings saved and locked successfully.`
      );
      setMessageType("success");
    } catch (error) {
      console.error("24H READING SAVE ERROR:", error);

      setMessage(
        readingsWereSaved
          ? `Readings were saved, but the shift output could not be confirmed: ${
              error?.message || "Refresh and contact Admin."
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
  // UPDATE SHIFT TOTAL OUTPUT
  // ==================================================

  async function syncShiftTotalOutput(totalOutputValue) {
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
          total_output: roundMoney(totalOutputValue),
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
    <div
      style={{
        marginTop: 0,
        width: "100%",
        boxSizing: "border-box",
        backgroundColor: "white",
        padding: 25,
        borderRadius: 12,
        boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
      }}
    >
      {/* HEADER */}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 20,
          flexWrap: "wrap",
          marginBottom: 20,
        }}
      >
        <div>
          <h2
            style={{
              margin: "0 0 6px 0",
            }}
          >
            Platform Sales – 24-Hour Shift System
          </h2>

          <div
            style={{
              color: "#64748b",
            }}
          >
            {shiftName || "24-Hour Shift"}
          </div>

          <div
            style={{
              color: "#64748b",
              fontSize: 12,
              marginTop: 4,
            }}
          >
            Business date:{" "}
            {currentShift.business_date || "—"}
          </div>
        </div>

        <div
          style={{
            padding: "12px 18px",
            backgroundColor: "#ecfdf5",
            color: "#166534",
            borderRadius: 8,
            fontWeight: "bold",
          }}
        >
          Current Shift Output: KES {money(totalOutput)}
        </div>
      </div>

      {/* CLOSED SHIFT NOTICE */}

      {!isOpen && (
        <div style={warningStyle}>
          This shift is CLOSED. Readings are view-only
          until Admin authorizes recovery.
        </div>
      )}

      {/* INVALID SHIFT NOTICE */}

      {!isShift1 && !isShift2 && (
        <div style={warningStyle}>
          This shift does not have a valid SHIFT 1
          or SHIFT 2 name.
        </div>
      )}

      {/* MESSAGES */}

      {message && (
        <div
          style={{
            ...warningStyle,
            backgroundColor:
              messageType === "success"
                ? "#ecfdf5"
                : "#fef2f2",
            color:
              messageType === "success"
                ? "#166534"
                : "#991b1b",
          }}
        >
          {message}
        </div>
      )}

      {platforms.length === 0 ? (
        <div>
          No active platforms are assigned to this shop.
        </div>
      ) : (
        <>
          {/* ======================================
              SHIFT 1
          ====================================== */}

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

          {/* ======================================
              SHIFT 2
          ====================================== */}

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

              {(midnightSaved || showClosing9amStage) && (
                <div
                  style={{
                    padding: 14,
                    margin: "18px 0",
                    backgroundColor: "#eff6ff",
                    color: "#1e3a8a",
                    borderRadius: 8,
                    fontWeight: "bold",
                  }}
                >
                  12:00 AM — resetting platforms start
                  again from 0. TABLE continues unchanged
                  and has no midnight reading.
                </div>
              )}

              {/* 9 AM HANDOVER */}

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
      Boolean(rows[platform.id]?.[readingKind]?.id)
  ).length;

  const allSaved =
    platforms.length > 0 &&
    savedCount === platforms.length;

  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 10,
        padding: 18,
        marginBottom: 18,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 15,
          marginBottom: 6,
        }}
      >
        <strong>
          {title}
        </strong>

        <span
          style={{
            color: allSaved ? "#15803d" : "#64748b",
            fontSize: 13,
            fontWeight: "bold",
          }}
        >
          {savedCount} / {platforms.length}
          {allSaved ? " ✓" : ""}
        </span>
      </div>

      <div
        style={{
          color: "#64748b",
          fontSize: 13,
          marginBottom: 15,
        }}
      >
        {description}
      </div>

      {/* INDIVIDUAL PLATFORM INPUTS */}

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
          : values[platform.id]?.[readingKind] ?? "";

        return (
          <div
            key={platform.id}
            style={{
              display: "grid",
              gridTemplateColumns:
                "minmax(120px,1fr) minmax(150px,220px)",
              gap: 12,
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <div
              style={{
                fontWeight: "bold",
              }}
            >
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
                width: "100%",
                boxSizing: "border-box",
                padding: 11,
                border: readOnly
                  ? "1px solid #86efac"
                  : "1px solid #cbd5e1",
                borderRadius: 7,
                backgroundColor: readOnly
                  ? "#f0fdf4"
                  : "white",
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
              width: "100%",
              marginTop: 8,
              padding: 12,
              border: "none",
              borderRadius: 7,
              backgroundColor: saving
                ? "#94a3b8"
                : "#168d32",
              color: "white",
              fontWeight: "bold",
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
// 11:59 PM readings must actually be SAVED
// before the 9 AM readings.
//
// Negative, zero and positive figures remain valid.
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
// Signed arithmetic preserved.
// ==================================================

function calculateShiftOutput({
  platforms,
  rows,
  shiftName,
}) {
  let total = 0;

  for (const platform of platforms) {
    const platformRows = rows[platform.id] || {};

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

      if (isTable(platform)) {
        if (
          opening !== null &&
          closing9am !== null
        ) {
          total += closing9am - opening;
        }

        continue;
      }

      const midnight = numericOrNull(
        platformRows.MIDNIGHT_CLOSE?.reading_value
      );

      if (
        opening !== null &&
        midnight !== null &&
        closing9am !== null
      ) {
        total += midnight - opening + closing9am;
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
// DATE-AWARE NAIROBI STAGE UNLOCKS
//
// SHIFT 1:
// 9 PM on business date
//
// SHIFT 2:
// 11:59 PM on business date
// 9 AM on following day
//
// Once unlocked, the stage stays available.
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
    !/^\d{4}-\d{2}-\d{2}$/.test(businessDate)
  ) {
    return false;
  }

  let unlockAt;

  if (
    name === "SHIFT 1" &&
    readingKind === "HANDOVER_9PM"
  ) {
    unlockAt = `${businessDate}T21:00:00`;
  } else if (
    name === "SHIFT 2" &&
    readingKind === "MIDNIGHT_CLOSE"
  ) {
    unlockAt = `${businessDate}T23:59:00`;
  } else if (
    name === "SHIFT 2" &&
    readingKind === "CLOSING_9AM"
  ) {
    unlockAt =
      `${addStageDays(businessDate, 1)}T09:00:00`;
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

function addStageDays(dateString, days) {
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
// HELPERS
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

function roundMoney(value) {
  return (
    Math.round(
      (Number(value) + Number.EPSILON) * 100
    ) / 100
  );
}

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

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function Panel({ children }) {
  return (
    <div
      style={{
        marginTop: 24,
        padding: 25,
        backgroundColor: "white",
        borderRadius: 12,
      }}
    >
      {children}
    </div>
  );
}

const warningStyle = {
  padding: 12,
  marginBottom: 18,
  borderRadius: 8,
  backgroundColor: "#fef2f2",
  color: "#991b1b",
};
