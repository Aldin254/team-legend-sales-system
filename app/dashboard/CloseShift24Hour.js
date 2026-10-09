"use client";

import { useEffect, useMemo, useState } from "react";

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
  const [now, setNow] = useState(() => new Date());
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const accessToken = user?.access_token || null;
  const shopId =
    currentShift?.shop_id || user?.shop_id || user?.shopId || null;
  const shiftId = currentShift?.id || null;

  // Avoid showing the previous shift while the parent switches shifts.
  const effectiveShift =
    shiftData?.id === shiftId ? shiftData : currentShift;
  const shiftName = normalizeShiftName(effectiveShift?.shift_name);
  const status = String(effectiveShift?.status || "").toUpperCase();

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(timer);
  }, []);

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
  // Refreshes do not hide the panel every five seconds.
  // ==================================================

  useEffect(() => {
    if (!shiftId || !shopId || !accessToken || !supabaseUrl || !supabaseAnonKey) {
      setLoadError("Shift or login information is missing.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    const headers = {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };

    async function loadData() {
      try {
        const [shiftResponse, platformResponse, readingsResponse] =
          await Promise.all([
            fetch(
              `${supabaseUrl}/rest/v1/shifts` +
                `?id=eq.${encodeURIComponent(shiftId)}&select=*&limit=1`,
              { method: "GET", headers, cache: "no-store" }
            ),
            fetch(
              `${supabaseUrl}/rest/v1/shop_platforms` +
                `?shop_id=eq.${encodeURIComponent(shopId)}` +
                `&is_active=eq.true` +
                `&select=id,platform_name,display_order` +
                `&order=display_order.asc`,
              { method: "GET", headers, cache: "no-store" }
            ),
            fetch(
              `${supabaseUrl}/rest/v1/platform_readings` +
                `?shift_id=eq.${encodeURIComponent(shiftId)}` +
                `&select=id,platform_id,reading_kind,reading_value,recorded_at`,
              { method: "GET", headers, cache: "no-store" }
            ),
          ]);

        const [shiftResult, platformResult, readingsResult] =
          await Promise.all([
            safeJson(shiftResponse),
            safeJson(platformResponse),
            safeJson(readingsResponse),
          ]);

        if (!shiftResponse.ok) {
          throw new Error(shiftResult?.message || "Unable to load shift.");
        }
        if (!platformResponse.ok) {
          throw new Error(
            platformResult?.message || "Unable to load shop platforms."
          );
        }
        if (!readingsResponse.ok) {
          throw new Error(
            readingsResult?.message || "Unable to load platform readings."
          );
        }

        const latestShift = Array.isArray(shiftResult)
          ? shiftResult[0]
          : null;
        if (!latestShift || String(latestShift.shop_id) !== String(shopId)) {
          throw new Error("Selected shift was not found in this shop.");
        }
        if (cancelled) return;

        setShiftData(latestShift);
        setPlatforms(Array.isArray(platformResult) ? platformResult : []);
        setReadings(Array.isArray(readingsResult) ? readingsResult : []);
        setLoadError("");
      } catch (error) {
        console.error("24H CLOSE LOAD ERROR:", error);
        if (!cancelled) {
          setLoadError(error?.message || "Unable to prepare shift handover.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, [shiftId, shopId, accessToken, supabaseUrl, supabaseAnonKey, refreshKey]);

  // The business date determines when this particular shift may close.
  const handover = useMemo(
    () => getShiftHandoverAvailability(effectiveShift, now),
    [effectiveShift, now]
  );

  const readingStatus = useMemo(
    () => calculateReadingStatus({ platforms, readings, shiftName }),
    [platforms, readings, shiftName]
  );

  const canClose =
    !loading &&
    !loadError &&
    !closing &&
    status === "OPEN" &&
    handover.available &&
    readingStatus.complete;

  // ==================================================
  // REFRESH DATABASE STATE IMMEDIATELY BEFORE CLOSURE
  // ==================================================

  async function getFreshHandoverData() {
    const headers = {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };

    const [shiftResponse, platformResponse, readingsResponse] =
      await Promise.all([
        fetch(
          `${supabaseUrl}/rest/v1/shifts` +
            `?id=eq.${encodeURIComponent(shiftId)}&select=*&limit=1`,
          { method: "GET", headers, cache: "no-store" }
        ),
        fetch(
          `${supabaseUrl}/rest/v1/shop_platforms` +
            `?shop_id=eq.${encodeURIComponent(shopId)}` +
            `&is_active=eq.true` +
            `&select=id,platform_name,display_order` +
            `&order=display_order.asc`,
          { method: "GET", headers, cache: "no-store" }
        ),
        fetch(
          `${supabaseUrl}/rest/v1/platform_readings` +
            `?shift_id=eq.${encodeURIComponent(shiftId)}` +
            `&select=id,platform_id,reading_kind,reading_value,recorded_at`,
          { method: "GET", headers, cache: "no-store" }
        ),
      ]);

    const [shiftResult, platformResult, readingsResult] =
      await Promise.all([
        safeJson(shiftResponse),
        safeJson(platformResponse),
        safeJson(readingsResponse),
      ]);

    if (!shiftResponse.ok || !platformResponse.ok || !readingsResponse.ok) {
      throw new Error(
        shiftResult?.message ||
          platformResult?.message ||
          readingsResult?.message ||
          "Unable to verify shift and platform readings."
      );
    }

    const freshShift = Array.isArray(shiftResult) ? shiftResult[0] : null;
    if (!freshShift || String(freshShift.shop_id) !== String(shopId)) {
      throw new Error("Shift was not found in the selected shop.");
    }

    return {
      shift: freshShift,
      platforms: Array.isArray(platformResult) ? platformResult : [],
      readings: Array.isArray(readingsResult) ? readingsResult : [],
    };
  }
  // ==================================================
  // CLOSE / HAND OVER SHIFT
  // No expiry after the original scheduled handover.
  // ==================================================

  async function closeShift() {
    if (closing) return;

    if (!shiftId || !shopId || !accessToken) {
      setMessage("Shift or login information is missing.");
      setMessageType("error");
      return;
    }

    try {
      setClosing(true);
      setMessage("");
      setMessageType("");

      const fresh = await getFreshHandoverData();
      const freshName = normalizeShiftName(fresh.shift.shift_name);

      if (String(fresh.shift.status || "").toUpperCase() !== "OPEN") {
        throw new Error("This shift is no longer OPEN.");
      }

      if (freshName !== "SHIFT 1" && freshName !== "SHIFT 2") {
        throw new Error("This is not a valid 24-hour shift.");
      }

      const freshAvailability = getShiftHandoverAvailability(
        fresh.shift,
        new Date()
      );
      if (!freshAvailability.available) {
        throw new Error(freshAvailability.message);
      }

      const freshReadings = calculateReadingStatus({
        platforms: fresh.platforms,
        readings: fresh.readings,
        shiftName: freshName,
      });
      if (!freshReadings.complete) {
        throw new Error(freshReadings.message);
      }

      const confirmed = window.confirm(
        `CLOSE ${freshName}\n\n` +
          `Business date: ${fresh.shift.business_date || "-"}\n` +
          `Shop shift ID: ${fresh.shift.id}\n\n` +
          "All required platform readings have been saved. " +
          "Confirm closing this shift?"
      );
      if (!confirmed) return;

      const closedAt = new Date().toISOString();
      const response = await fetch(
        `${supabaseUrl}/rest/v1/shifts` +
          `?id=eq.${encodeURIComponent(shiftId)}&status=eq.OPEN`,
        {
          method: "PATCH",
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify({ status: "CLOSED", closed_at: closedAt }),
        }
      );

      const result = await safeJson(response);
      if (!response.ok) {
        throw new Error(
          result?.message ||
            result?.details ||
            result?.hint ||
            "Unable to close shift."
        );
      }

      const closedShift = Array.isArray(result) ? result[0] : null;
      if (!closedShift || String(closedShift.status).toUpperCase() !== "CLOSED") {
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

      if (typeof onShiftClosed === "function") {
        try {
          await onShiftClosed(closedShift);
        } catch (callbackError) {
          console.error("SHIFT CLOSED, BUT PARENT REFRESH FAILED:", callbackError);
        }
      }
    } catch (error) {
      console.error("24H CLOSE SHIFT ERROR:", error);
      setMessage(error?.message || "Unable to complete shift handover.");
      setMessageType("error");
    } finally {
      setClosing(false);
    }
  }

  // ==================================================
  // DISPLAY
  // Before handover: hidden. After handover: remains.
  // Closed shifts: show confirmation regardless of time.
  // ==================================================

  if (!currentShift) return null;

  if (status === "OPEN" && !handover.available && handover.validDate) {
    return null;
  }

  const netIncome = Number(effectiveShift?.net_income || 0);
  const closingBalance = Number(effectiveShift?.closing_balance || 0);

  return (
    <div
      style={{
        marginTop: 24,
        backgroundColor: "white",
        padding: 25,
        borderRadius: 12,
        boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
        maxWidth: 900,
      }}
    >
      <h2 style={{ margin: "0 0 6px 0" }}>Close Shift & Hand Over</h2>
      <div style={{ color: "#64748b", marginBottom: 16 }}>
        {shiftName || "24-Hour Shift"} | Business date: {effectiveShift?.business_date || "-"}
      </div>

      <div
        style={{
          padding: 15,
          marginBottom: 16,
          borderRadius: 9,
          backgroundColor: handover.available ? "#ecfdf5" : "#fff7ed",
          color: handover.available ? "#166534" : "#9a3412",
        }}
      >
        <div style={{ fontWeight: "bold", marginBottom: 5 }}>
          {handover.available
            ? "Handover available ✓"
            : "Handover not available"}
        </div>
        <div style={{ fontSize: 14 }}>{handover.message}</div>
        <div style={{ fontSize: 12, marginTop: 6 }}>
          Nairobi time: {formatNairobiTime(now)}
        </div>
      </div>

      <div
        style={{
          padding: 15,
          marginBottom: 18,
          borderRadius: 9,
          backgroundColor: readingStatus.complete ? "#ecfdf5" : "#fff7ed",
          color: readingStatus.complete ? "#166534" : "#9a3412",
        }}
      >
        <strong>
          Platform readings: {readingStatus.complete ? "Complete ✓" : "Incomplete"}
        </strong>
        {!readingStatus.complete && (
          <div style={{ marginTop: 5, fontSize: 14 }}>
            {readingStatus.message}
          </div>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2,minmax(0,1fr))",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <TotalCard title="Net Income" value={netIncome} />
        <TotalCard title="Closing Balance" value={closingBalance} />
      </div>

      {(loadError || message) && (
        <div
          role="alert"
          style={{
            padding: 12,
            marginBottom: 16,
            borderRadius: 8,
            backgroundColor: messageType === "success" && !loadError
              ? "#ecfdf5"
              : "#fef2f2",
            color: messageType === "success" && !loadError
              ? "#166534"
              : "#991b1b",
          }}
        >
          {loadError || message}
        </div>
      )}

      {loading && <div style={{ marginBottom: 12 }}>Loading shift status...</div>}

      {status === "CLOSED" ? (
        <div
          style={{
            padding: 14,
            backgroundColor: "#ecfdf5",
            color: "#166534",
            borderRadius: 8,
            textAlign: "center",
            fontWeight: "bold",
          }}
        >
          {shiftName} Closed ✓
        </div>
      ) : (
        <button
          type="button"
          onClick={closeShift}
          disabled={!canClose}
          style={{
            width: "100%",
            padding: 15,
            border: "none",
            borderRadius: 8,
            backgroundColor: canClose ? "#168d32" : "#94a3b8",
            color: "white",
            fontSize: 16,
            fontWeight: "bold",
            cursor: canClose ? "pointer" : "not-allowed",
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
// REQUIRED PLATFORM READINGS — SAME BUSINESS RULES
// ==================================================

function calculateReadingStatus({ platforms, readings, shiftName }) {
  if (!Array.isArray(platforms) || platforms.length === 0) {
    return { complete: false, message: "No active platforms were found." };
  }

  const readingSet = new Set();
  for (const row of Array.isArray(readings) ? readings : []) {
    if (row.platform_id && row.reading_kind) {
      readingSet.add(`${row.platform_id}:${row.reading_kind}`);
    }
  }

  if (shiftName === "SHIFT 1") {
    const missing = platforms.filter(
      (platform) => !readingSet.has(`${platform.id}:HANDOVER_9PM`)
    );
    return missing.length
      ? {
          complete: false,
          message: `Save the 9 PM handover reading for: ${missing
            .map((platform) => platform.platform_name)
            .join(", ")}.`,
        }
      : { complete: true, message: "" };
  }

  if (shiftName === "SHIFT 2") {
    const missingMidnight = platforms.filter(
      (platform) =>
        !isTable(platform) &&
        !readingSet.has(`${platform.id}:MIDNIGHT_CLOSE`)
    );
    if (missingMidnight.length) {
      return {
        complete: false,
        message: `Save the 11:59 PM reading for: ${missingMidnight
          .map((platform) => platform.platform_name)
          .join(", ")}.`,
      };
    }

    const missing9am = platforms.filter(
      (platform) => !readingSet.has(`${platform.id}:CLOSING_9AM`)
    );
    if (missing9am.length) {
      return {
        complete: false,
        message: `Save the 9 AM handover reading for: ${missing9am
          .map((platform) => platform.platform_name)
          .join(", ")}.`,
      };
    }
    return { complete: true, message: "" };
  }

  return {
    complete: false,
    message: "This shift must be SHIFT 1 or SHIFT 2.",
  };
}

// ==================================================
// NAIROBI BUSINESS-DATE-AWARE CLOSURE UNLOCK
// SHIFT 1: business date at 9 PM
// SHIFT 2: next calendar date at 9 AM
// Stays available after its opening time.
// ==================================================

function getShiftHandoverAvailability(shift, date = new Date()) {
  const name = normalizeShiftName(shift?.shift_name);
  const businessDate = String(shift?.business_date || "").slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) {
    return {
      available: false,
      validDate: false,
      message: "Shift business date is missing or invalid. Contact Admin.",
    };
  }

  let availableAt;
  let label;

  if (name === "SHIFT 1") {
    availableAt = `${businessDate}T21:00:00`;
    label = `9:00 PM on ${businessDate}`;
  } else if (name === "SHIFT 2") {
    const nextDay = addCalendarDays(businessDate, 1);
    availableAt = `${nextDay}T09:00:00`;
    label = `9:00 AM on ${nextDay}`;
  } else {
    return {
      available: false,
      validDate: false,
      message: "Only SHIFT 1 or SHIFT 2 is supported.",
    };
  }

  const available = getNairobiDateTimeKey(date) >= availableAt;

  return {
    available,
    validDate: true,
    message: available
      ? `This shift's handover became available at ${label} (Nairobi time). ` +
        "You may close it late once all required readings are complete."
      : `Handover becomes available at ${label} (Nairobi time).`,
  };
}

function getNairobiDateTimeKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const fields = {};
  for (const part of parts) {
    if (part.type !== "literal") fields[part.type] = part.value;
  }

  return `${fields.year}-${fields.month}-${fields.day}` +
    `T${fields.hour}:${fields.minute}:${fields.second}`;
}

function addCalendarDays(dateString, days) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

function normalizeShiftName(value) {
  const name = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
  if (name === "SHIFT1") return "SHIFT 1";
  if (name === "SHIFT2") return "SHIFT 2";
  return name;
}

function isTable(platform) {
  return String(platform?.platform_name || "").trim().toUpperCase() === "TABLE";
}

function formatNairobiTime(date) {
  return new Intl.DateTimeFormat("en-KE", {
    timeZone: "Africa/Nairobi",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);
}

function TotalCard({ title, value }) {
  const number = Number(value);
  const safeValue = Number.isFinite(number) ? number : 0;
  return (
    <div
      style={{
        backgroundColor: "#f8fafc",
        padding: 16,
        borderRadius: 9,
        border: "1px solid #e2e8f0",
      }}
    >
      <div style={{ color: "#64748b", fontSize: 13 }}>{title}</div>
      <div style={{ marginTop: 6, fontSize: 20, fontWeight: "bold" }}>
        KES {safeValue.toLocaleString("en-KE", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </div>
    </div>
  );
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
