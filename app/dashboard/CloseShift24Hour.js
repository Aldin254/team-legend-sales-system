"use client";

import { useEffect, useMemo, useState } from "react";

// ==================================================
// TEAM LEGEND — PROFESSIONAL DARK THEME
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

  orange: "#f0b978",
  orangeBackground: "#35291e",
};

// ==================================================
// PROFESSIONAL STYLES
// ==================================================

const panelStyle = {
  marginTop: 16,
  marginBottom: 16,

  width: "100%",
  maxWidth: 900,
  minWidth: 0,

  boxSizing: "border-box",

  padding: "clamp(13px, 1.6vw, 22px)",

  background:
    "linear-gradient(145deg, #142538 0%, #0e1c2b 100%)",

  color: THEME.text,

  border: `1px solid ${THEME.border}`,
  borderRadius: 11,

  boxShadow: "0 8px 26px rgba(0,0,0,0.15)",

  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',

  fontSize: 12,
  lineHeight: 1.6,
};

const headingStyle = {
  margin: 0,

  fontSize: "clamp(15px, 1.5vw, 19px)",
  fontWeight: 850,

  color: THEME.gold,
  letterSpacing: ".035em",
};

const subtitleStyle = {
  marginTop: 6,
  marginBottom: 17,

  color: THEME.muted,

  fontSize: 11,

  paddingBottom: 12,
  borderBottom: `1px solid ${THEME.border}`,
};

const statusPanelBase = {
  padding: "13px 15px",

  marginBottom: 13,

  borderRadius: 8,

  fontSize: 12,
  lineHeight: 1.65,

  overflowWrap: "anywhere",
};

const availableStatusStyle = {
  ...statusPanelBase,

  background: THEME.greenBackground,

  color: "#a8ebd1",

  border: "1px solid #286b59",
  borderLeft: `3px solid ${THEME.green}`,
};

const unavailableStatusStyle = {
  ...statusPanelBase,

  background: THEME.orangeBackground,

  color: "#f2ce9b",

  border: "1px solid #785d3c",
  borderLeft: `3px solid ${THEME.orange}`,
};

const statusTitleStyle = {
  fontSize: 12,
  fontWeight: 850,

  marginBottom: 5,
};

const statusMessageStyle = {
  fontSize: 11,
  lineHeight: 1.7,
};

const timeStyle = {
  marginTop: 8,
  fontSize: 10,

  opacity: 0.9,
  fontVariantNumeric: "tabular-nums",
};

const totalsGridStyle = {
  display: "grid",

  gridTemplateColumns:
    "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",

  gap: 12,

  marginTop: 16,
  marginBottom: 17,
};

const messageBaseStyle = {
  padding: "12px 14px",

  marginBottom: 15,

  borderRadius: 8,

  fontSize: 11,
  lineHeight: 1.65,

  overflowWrap: "anywhere",
};

const successMessageStyle = {
  ...messageBaseStyle,

  background: THEME.greenBackground,

  color: "#a8ebd1",

  border: "1px solid #286b59",
  borderLeft: `3px solid ${THEME.green}`,
};

const errorMessageStyle = {
  ...messageBaseStyle,

  background: THEME.redBackground,

  color: THEME.red,

  border: "1px solid #724353",
  borderLeft: `3px solid ${THEME.red}`,
};

const closedStyle = {
  padding: "14px 16px",

  background: THEME.greenBackground,

  border: "1px solid #286b59",
  borderLeft: `3px solid ${THEME.green}`,

  color: "#a8ebd1",

  borderRadius: 8,

  fontSize: 13,
  fontWeight: 850,

  textAlign: "center",
};

const closeButtonBaseStyle = {
  width: "100%",
  boxSizing: "border-box",

  padding: "13px 15px",

  borderRadius: 8,

  color: "#ffffff",

  fontFamily: "inherit",
  fontSize: 12,
  fontWeight: 850,

  textAlign: "center",

  transition: "background 0.2s ease",
};

// ==================================================
// MAIN COMPONENT
// ==================================================

export default function CloseShift24Hour({
  user,
  currentShift,
  onShiftClosed,
  refreshKey = 0,
}) {
  const [platforms, setPlatforms] = useState([]);
  const [readings, setReadings] = useState([]);
  const [shiftData, setShiftData] = useState(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [closing, setClosing] = useState(false);

  const [now, setNow] = useState(
    () => new Date()
  );

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  // ==================================================
  // SUPABASE
  // ==================================================

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const accessToken =
    user?.access_token || null;

  const shopId =
    currentShift?.shop_id ||
    user?.shop_id ||
    user?.shopId ||
    null;

  const shiftId =
    currentShift?.id || null;

  // Avoid showing data from the previous shift.

  const effectiveShift =
    shiftData?.id === shiftId
      ? shiftData
      : currentShift;

  const shiftName = normalizeShiftName(
    effectiveShift?.shift_name
  );

  const status = String(
    effectiveShift?.status || ""
  ).toUpperCase();

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
  // RESET ON SHIFT CHANGE
  // ==================================================

  useEffect(() => {
    setLoading(true);

    setLoadError("");
    setShiftData(null);

    setPlatforms([]);
    setReadings([]);

    setMessage("");
    setMessageType("");
  }, [shiftId]);

  // ==================================================
  // LOAD SHIFT, PLATFORMS AND READINGS
  //
  // Refreshes do not hide the panel every
  // five seconds.
  // ==================================================

  useEffect(() => {
    if (
      !shiftId ||
      !shopId ||
      !accessToken ||
      !supabaseUrl ||
      !supabaseAnonKey
    ) {
      setLoadError(
        "Shift or login information is missing."
      );

      setLoading(false);
      return;
    }

    let cancelled = false;

    const headers = {
      apikey: supabaseAnonKey,

      Authorization:
        `Bearer ${accessToken}`,

      "Content-Type": "application/json",
    };

    async function loadData() {
      try {
        const [
          shiftResponse,
          platformResponse,
          readingsResponse,
        ] = await Promise.all([
          fetch(
            `${supabaseUrl}/rest/v1/shifts` +
              `?id=eq.${encodeURIComponent(
                shiftId
              )}&select=*&limit=1`,
            {
              method: "GET",
              headers,
              cache: "no-store",
            }
          ),

          fetch(
            `${supabaseUrl}/rest/v1/shop_platforms` +
              `?shop_id=eq.${encodeURIComponent(
                shopId
              )}` +
              `&is_active=eq.true` +
              `&select=id,platform_name,display_order` +
              `&order=display_order.asc`,
            {
              method: "GET",
              headers,
              cache: "no-store",
            }
          ),

          fetch(
            `${supabaseUrl}/rest/v1/platform_readings` +
              `?shift_id=eq.${encodeURIComponent(
                shiftId
              )}` +
              `&select=id,platform_id,reading_kind,reading_value,recorded_at`,
            {
              method: "GET",
              headers,
              cache: "no-store",
            }
          ),
        ]);

        const [
          shiftResult,
          platformResult,
          readingsResult,
        ] = await Promise.all([
          safeJson(shiftResponse),
          safeJson(platformResponse),
          safeJson(readingsResponse),
        ]);

        if (!shiftResponse.ok) {
          throw new Error(
            shiftResult?.message ||
              "Unable to load shift."
          );
        }

        if (!platformResponse.ok) {
          throw new Error(
            platformResult?.message ||
              "Unable to load shop platforms."
          );
        }

        if (!readingsResponse.ok) {
          throw new Error(
            readingsResult?.message ||
              "Unable to load platform readings."
          );
        }

        const latestShift =
          Array.isArray(shiftResult)
            ? shiftResult[0]
            : null;

        if (
          !latestShift ||
          String(latestShift.shop_id) !==
            String(shopId)
        ) {
          throw new Error(
            "Selected shift was not found in this shop."
          );
        }

        if (cancelled) return;

        setShiftData(latestShift);

        setPlatforms(
          Array.isArray(platformResult)
            ? platformResult
            : []
        );

        setReadings(
          Array.isArray(readingsResult)
            ? readingsResult
            : []
        );

        setLoadError("");
      } catch (error) {
        console.error(
          "24H CLOSE LOAD ERROR:",
          error
        );

        if (!cancelled) {
          setLoadError(
            error?.message ||
              "Unable to prepare shift handover."
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
    shiftId,
    shopId,
    accessToken,
    supabaseUrl,
    supabaseAnonKey,
    refreshKey,
  ]);

  // ==================================================
  // HANDOVER AVAILABILITY
  // ==================================================

  const handover = useMemo(
    () =>
      getShiftHandoverAvailability(
        effectiveShift,
        now
      ),
    [effectiveShift, now]
  );

  // ==================================================
  // READING STATUS
  // ==================================================

  const readingStatus = useMemo(
    () =>
      calculateReadingStatus({
        platforms,
        readings,
        shiftName,
      }),
    [platforms, readings, shiftName]
  );

  // ==================================================
  // CLOSE BUTTON PERMISSION
  // ==================================================

  const canClose =
    !loading &&
    !loadError &&
    !closing &&
    status === "OPEN" &&
    handover.available &&
    readingStatus.complete;

  // ==================================================
  // FRESH DATABASE VERIFICATION
  // ==================================================

  async function getFreshHandoverData() {
    const headers = {
      apikey: supabaseAnonKey,

      Authorization:
        `Bearer ${accessToken}`,

      "Content-Type": "application/json",
    };

    const [
      shiftResponse,
      platformResponse,
      readingsResponse,
    ] = await Promise.all([
      fetch(
        `${supabaseUrl}/rest/v1/shifts` +
          `?id=eq.${encodeURIComponent(
            shiftId
          )}&select=*&limit=1`,
        {
          method: "GET",
          headers,
          cache: "no-store",
        }
      ),

      fetch(
        `${supabaseUrl}/rest/v1/shop_platforms` +
          `?shop_id=eq.${encodeURIComponent(
            shopId
          )}` +
          `&is_active=eq.true` +
          `&select=id,platform_name,display_order` +
          `&order=display_order.asc`,
        {
          method: "GET",
          headers,
          cache: "no-store",
        }
      ),

      fetch(
        `${supabaseUrl}/rest/v1/platform_readings` +
          `?shift_id=eq.${encodeURIComponent(
            shiftId
          )}` +
          `&select=id,platform_id,reading_kind,reading_value,recorded_at`,
        {
          method: "GET",
          headers,
          cache: "no-store",
        }
      ),
    ]);

    const [
      shiftResult,
      platformResult,
      readingsResult,
    ] = await Promise.all([
      safeJson(shiftResponse),
      safeJson(platformResponse),
      safeJson(readingsResponse),
    ]);

    if (
      !shiftResponse.ok ||
      !platformResponse.ok ||
      !readingsResponse.ok
    ) {
      throw new Error(
        shiftResult?.message ||
          platformResult?.message ||
          readingsResult?.message ||
          "Unable to verify shift and platform readings."
      );
    }

    const freshShift =
      Array.isArray(shiftResult)
        ? shiftResult[0]
        : null;

    if (
      !freshShift ||
      String(freshShift.shop_id) !==
        String(shopId)
    ) {
      throw new Error(
        "Shift was not found in the selected shop."
      );
    }

    return {
      shift: freshShift,

      platforms:
        Array.isArray(platformResult)
          ? platformResult
          : [],

      readings:
        Array.isArray(readingsResult)
          ? readingsResult
          : [],
    };
  }

  // ==================================================
  // CLOSE / HAND OVER SHIFT
  //
  // No expiry after original scheduled handover.
  // ==================================================

  async function closeShift() {
    if (closing) return;

    if (
      !shiftId ||
      !shopId ||
      !accessToken
    ) {
      setMessage(
        "Shift or login information is missing."
      );

      setMessageType("error");
      return;
    }

    try {
      setClosing(true);

      setMessage("");
      setMessageType("");

      const fresh =
        await getFreshHandoverData();

      const freshName = normalizeShiftName(
        fresh.shift.shift_name
      );

      if (
        String(
          fresh.shift.status || ""
        ).toUpperCase() !== "OPEN"
      ) {
        throw new Error(
          "This shift is no longer OPEN."
        );
      }

      if (
        freshName !== "SHIFT 1" &&
        freshName !== "SHIFT 2"
      ) {
        throw new Error(
          "This is not a valid 24-hour shift."
        );
      }

      const freshAvailability =
        getShiftHandoverAvailability(
          fresh.shift,
          new Date()
        );

      if (!freshAvailability.available) {
        throw new Error(
          freshAvailability.message
        );
      }

      const freshReadings =
        calculateReadingStatus({
          platforms: fresh.platforms,
          readings: fresh.readings,
          shiftName: freshName,
        });

      if (!freshReadings.complete) {
        throw new Error(
          freshReadings.message
        );
      }

      // ==================================================
      // CASHIER CONFIRMATION
      // ==================================================

      const confirmed = window.confirm(
        `CLOSE ${freshName}\n\n` +
          `Business date: ${
            fresh.shift.business_date || "-"
          }\n` +
          `Shop shift ID: ${
            fresh.shift.id
          }\n\n` +
          "All required platform readings have been saved. " +
          "Confirm closing this shift?"
      );

      if (!confirmed) return;

      // ==================================================
      // CLOSE SHIFT IN SUPABASE
      // ==================================================

      const closedAt =
        new Date().toISOString();

      const response = await fetch(
        `${supabaseUrl}/rest/v1/shifts` +
          `?id=eq.${encodeURIComponent(
            shiftId
          )}&status=eq.OPEN`,
        {
          method: "PATCH",

          headers: {
            apikey: supabaseAnonKey,

            Authorization:
              `Bearer ${accessToken}`,

            "Content-Type":
              "application/json",

            Prefer:
              "return=representation",
          },

          body: JSON.stringify({
            status: "CLOSED",
            closed_at: closedAt,
          }),
        }
      );

      const result =
        await safeJson(response);

      if (!response.ok) {
        throw new Error(
          result?.message ||
            result?.details ||
            result?.hint ||
            "Unable to close shift."
        );
      }

      const closedShift =
        Array.isArray(result)
          ? result[0]
          : null;

      if (
        !closedShift ||
        String(
          closedShift.status
        ).toUpperCase() !== "CLOSED"
      ) {
        throw new Error(
          "Shift status changed before closure. Refresh and check its status."
        );
      }

      setShiftData(closedShift);

      setMessage(
        `${freshName} closed successfully. Use the normal shift-opening workflow ` +
          "for the next shift, or ask Admin to recover missed shifts."
      );

      setMessageType("success");

      if (
        typeof onShiftClosed ===
        "function"
      ) {
        try {
          await onShiftClosed(
            closedShift
          );
        } catch (callbackError) {
          console.error(
            "SHIFT CLOSED, BUT PARENT REFRESH FAILED:",
            callbackError
          );
        }
      }
    } catch (error) {
      console.error(
        "24H CLOSE SHIFT ERROR:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to complete shift handover."
      );

      setMessageType("error");
    } finally {
      setClosing(false);
    }
  }

  // ==================================================
  // DISPLAY
  //
  // Before handover: hidden.
  // After handover: remains available.
  // Closed shifts: show confirmation.
  // ==================================================

  if (!currentShift) {
    return null;
  }

  if (
    status === "OPEN" &&
    !handover.available &&
    handover.validDate
  ) {
    return null;
  }

  const netIncome = Number(
    effectiveShift?.net_income || 0
  );

  const closingBalance = Number(
    effectiveShift?.closing_balance || 0
  );

  return (
    <div style={panelStyle}>
      {/* =====================================
          HEADER
      ===================================== */}

      <h2 style={headingStyle}>
        CLOSE SHIFT & HAND OVER
      </h2>

      <div style={subtitleStyle}>
        {shiftName || "24-Hour Shift"}
        {" | "}
        Business date:{" "}
        {effectiveShift?.business_date ||
          "-"}
      </div>

      {/* =====================================
          HANDOVER STATUS
      ===================================== */}

      <div
        style={
          handover.available
            ? availableStatusStyle
            : unavailableStatusStyle
        }
      >
        <div style={statusTitleStyle}>
          {handover.available
            ? "Handover available ✓"
            : "Handover not available"}
        </div>

        <div style={statusMessageStyle}>
          {handover.message}
        </div>

        <div style={timeStyle}>
          Nairobi time:{" "}
          {formatNairobiTime(now)}
        </div>
      </div>

      {/* =====================================
          PLATFORM READINGS STATUS
      ===================================== */}

      <div
        style={
          readingStatus.complete
            ? availableStatusStyle
            : unavailableStatusStyle
        }
      >
        <div style={statusTitleStyle}>
          Platform readings:{" "}
          {readingStatus.complete
            ? "Complete ✓"
            : "Incomplete"}
        </div>

        {!readingStatus.complete && (
          <div style={statusMessageStyle}>
            {readingStatus.message}
          </div>
        )}
      </div>

      {/* =====================================
          FINANCIAL SUMMARY
      ===================================== */}

      <div style={totalsGridStyle}>
        <TotalCard
          title="Net Income"
          value={netIncome}
          tone="green"
        />

        <TotalCard
          title="Closing Balance"
          value={closingBalance}
          tone="gold"
        />
      </div>

      {/* =====================================
          SUCCESS / ERROR MESSAGE
      ===================================== */}

      {(loadError || message) && (
        <div
          role="alert"
          style={
            messageType === "success" &&
            !loadError
              ? successMessageStyle
              : errorMessageStyle
          }
        >
          {loadError || message}
        </div>
      )}

      {loading && (
        <div
          style={{
            color: THEME.muted,
            marginBottom: 12,
            fontSize: 11,
          }}
        >
          Loading shift status...
        </div>
      )}

      {/* =====================================
          CLOSED SHIFT CONFIRMATION
      ===================================== */}

      {status === "CLOSED" ? (
        <div style={closedStyle}>
          {shiftName} Closed ✓
        </div>
      ) : (
        /* =====================================
           CLOSE SHIFT BUTTON
        ===================================== */

        <button
          type="button"
          onClick={closeShift}
          disabled={!canClose}
          style={{
            ...closeButtonBaseStyle,

            background: canClose
              ? "linear-gradient(90deg, #239979 0%, #27bd86 100%)"
              : "#35495b",

            border: canClose
              ? "1px solid #36b991"
              : `1px solid ${THEME.border}`,

            color: canClose
              ? "#ffffff"
              : "#b6c4d3",

            cursor: canClose
              ? "pointer"
              : "not-allowed",

            boxShadow: canClose
              ? "0 3px 12px rgba(0,0,0,0.12)"
              : "none",
          }}
        >
          {closing
            ? "Completing Handover..."
            : loading
            ? "Loading..."
            : !handover.available
            ? "Handover Not Yet Available"
            : !readingStatus.complete
            ? "Save Required Readings First"
            : `Close ${shiftName} & Hand Over`}
        </button>
      )}
    </div>
  );
}

// ==================================================
// REQUIRED PLATFORM READINGS
//
// BUSINESS RULES PRESERVED
// ==================================================

function calculateReadingStatus({
  platforms,
  readings,
  shiftName,
}) {
  if (
    !Array.isArray(platforms) ||
    platforms.length === 0
  ) {
    return {
      complete: false,
      message:
        "No active platforms were found.",
    };
  }

  const readingSet = new Set();

  for (
    const row of Array.isArray(readings)
      ? readings
      : []
  ) {
    if (
      row.platform_id &&
      row.reading_kind
    ) {
      readingSet.add(
        `${row.platform_id}:${row.reading_kind}`
      );
    }
  }

  // ==================================================
  // SHIFT 1
  // 9 PM handover required
  // ==================================================

  if (shiftName === "SHIFT 1") {
    const missing = platforms.filter(
      (platform) =>
        !readingSet.has(
          `${platform.id}:HANDOVER_9PM`
        )
    );

    return missing.length
      ? {
          complete: false,

          message:
            `Save the 9 PM handover reading for: ${missing
              .map(
                (platform) =>
                  platform.platform_name
              )
              .join(", ")}.`,
        }
      : {
          complete: true,
          message: "",
        };
  }

  // ==================================================
  // SHIFT 2
  //
  // Resettable platforms:
  // 11:59 PM reading required
  //
  // All platforms:
  // 9 AM handover reading required
  //
  // TABLE excluded from midnight.
  // ==================================================

  if (shiftName === "SHIFT 2") {
    const missingMidnight =
      platforms.filter(
        (platform) =>
          !isTable(platform) &&
          !readingSet.has(
            `${platform.id}:MIDNIGHT_CLOSE`
          )
      );

    if (missingMidnight.length) {
      return {
        complete: false,

        message:
          `Save the 11:59 PM reading for: ${missingMidnight
            .map(
              (platform) =>
                platform.platform_name
            )
            .join(", ")}.`,
      };
    }

    const missing9am =
      platforms.filter(
        (platform) =>
          !readingSet.has(
            `${platform.id}:CLOSING_9AM`
          )
      );

    if (missing9am.length) {
      return {
        complete: false,

        message:
          `Save the 9 AM handover reading for: ${missing9am
            .map(
              (platform) =>
                platform.platform_name
            )
            .join(", ")}.`,
      };
    }

    return {
      complete: true,
      message: "",
    };
  }

  return {
    complete: false,

    message:
      "This shift must be SHIFT 1 or SHIFT 2.",
  };
}

// ==================================================
// NAIROBI BUSINESS-DATE-AWARE
// CLOSURE UNLOCK
//
// SHIFT 1:
// Business date at 9 PM
//
// SHIFT 2:
// Following calendar date at 9 AM
//
// Availability remains after unlock.
// ==================================================

function getShiftHandoverAvailability(
  shift,
  date = new Date()
) {
  const name = normalizeShiftName(
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
    return {
      available: false,
      validDate: false,

      message:
        "Shift business date is missing or invalid. Contact Admin.",
    };
  }

  let availableAt;
  let label;

  if (name === "SHIFT 1") {
    availableAt =
      `${businessDate}T21:00:00`;

    label =
      `9:00 PM on ${businessDate}`;
  } else if (name === "SHIFT 2") {
    const nextDay = addCalendarDays(
      businessDate,
      1
    );

    availableAt =
      `${nextDay}T09:00:00`;

    label =
      `9:00 AM on ${nextDay}`;
  } else {
    return {
      available: false,
      validDate: false,

      message:
        "Only SHIFT 1 or SHIFT 2 is supported.",
    };
  }

  const available =
    getNairobiDateTimeKey(date) >=
    availableAt;

  return {
    available,
    validDate: true,

    message: available
      ? `This shift's handover became available at ${label} (Nairobi time). ` +
        "You may close it late once all required readings are complete."
      : `Handover becomes available at ${label} (Nairobi time).`,
  };
}

// ==================================================
// NAIROBI DATE AND TIME KEY
// ==================================================

function getNairobiDateTimeKey(
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

  const fields = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      fields[part.type] = part.value;
    }
  }

  return (
    `${fields.year}-${fields.month}-${fields.day}` +
    `T${fields.hour}:${fields.minute}:${fields.second}`
  );
}

// ==================================================
// ADD CALENDAR DAYS
// WITHOUT TIMEZONE DRIFT
// ==================================================

function addCalendarDays(
  dateString,
  days
) {
  const [year, month, day] =
    dateString
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
// NORMALIZE SHIFT NAME
// ==================================================

function normalizeShiftName(value) {
  const name = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

  if (name === "SHIFT1") {
    return "SHIFT 1";
  }

  if (name === "SHIFT2") {
    return "SHIFT 2";
  }

  return name;
}

// ==================================================
// TABLE PLATFORM CHECK
// ==================================================

function isTable(platform) {
  return (
    String(
      platform?.platform_name || ""
    )
      .trim()
      .toUpperCase() === "TABLE"
  );
}

// ==================================================
// NAIROBI DISPLAY TIME
// ==================================================

function formatNairobiTime(date) {
  return new Intl.DateTimeFormat(
    "en-KE",
    {
      timeZone: "Africa/Nairobi",

      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",

      hour12: true,
    }
  ).format(date);
}

// ==================================================
// PROFESSIONAL FINANCIAL CARD
// ==================================================

function TotalCard({
  title,
  value,
  tone = "green",
}) {
  const number = Number(value);

  const safeValue =
    Number.isFinite(number)
      ? number
      : 0;

  const accent =
    tone === "gold"
      ? THEME.gold
      : THEME.green;

  return (
    <div
      style={{
        padding: "14px 16px",

        minWidth: 0,
        boxSizing: "border-box",

        background:
          "linear-gradient(135deg, #172b3e, #102031)",

        border:
          `1px solid ${THEME.border}`,

        borderLeft:
          `3px solid ${accent}`,

        borderRadius: 9,
      }}
    >
      <div
        style={{
          color: THEME.muted,

          fontSize: 10,
          fontWeight: 800,

          letterSpacing: ".09em",
          textTransform: "uppercase",
        }}
      >
        {title}
      </div>

      <div
        style={{
          color: THEME.text,

          fontSize:
            "clamp(17px, 1.8vw, 22px)",

          fontWeight: 850,

          marginTop: 8,

          fontVariantNumeric:
            "tabular-nums",

          overflowWrap: "anywhere",
        }}
      >
        KES{" "}
        {safeValue.toLocaleString(
          "en-KE",
          {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }
        )}
      </div>
    </div>
  );
}

// ==================================================
// SAFE JSON RESPONSE
// ==================================================

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
