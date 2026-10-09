"use client";

import { useEffect, useRef, useState } from "react";

const NAIROBI_TIME_ZONE = "Africa/Nairobi";
const CLOSING_START = "21:30:00";

export default function CashierCloseShiftButton({
  user,
  currentShift,
  onShiftClosed,
}) {
  const [closing, setClosing] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [now, setNow] = useState(() => new Date());
  const busyRef = useRef(false);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const accessToken = user?.access_token || null;

  const shopId =
    currentShift?.shop_id || user?.shop_id || user?.shopId || null;

  const shiftId = currentShift?.id || null;

  const shiftStatus = String(currentShift?.status || "")
    .trim()
    .toUpperCase();

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

  useEffect(() => {
    setMessage("");
    setMessageType("");
    setCompleted(false);
  }, [shiftId]);

  const availability = get12HourClosingAvailability(
    currentShift,
    now
  );

  // ==================================================
  // CASHIER SHIFT CLOSURE
  // ==================================================

  async function closeShift() {
    if (busyRef.current || completed) return;

    if (
      !shiftId ||
      !shopId ||
      !accessToken ||
      !supabaseUrl ||
      !supabaseAnonKey
    ) {
      setMessage("Shift or login information is missing.");
      setMessageType("error");
      return;
    }

    if (shiftStatus !== "OPEN") {
      setMessage("This shift is already closed.");
      setMessageType("error");
      return;
    }

    if (
      !get12HourClosingAvailability(
        currentShift,
        new Date()
      ).available
    ) {
      setMessage(
        "Closing opens at 9:30 PM Nairobi time on this shift's business date."
      );
      setMessageType("error");
      return;
    }

    const confirmed = window.confirm(
      "CLOSE 12-HOUR SHIFT\n\n" +
        `Business date: ${currentShift?.business_date || "-"}\n\n` +
        "All active platforms must have saved closing readings.\n" +
        "The next cashier shift follows the normal midnight opening rule.\n\n" +
        "Close this shift?"
    );

    if (!confirmed) return;

    busyRef.current = true;
    setClosing(true);
    setMessage("");
    setMessageType("");

    try {
      const headers = {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      };

      // Recheck database records before closing.
      const [
        shiftResponse,
        platformResponse,
        readingResponse,
      ] = await Promise.all([
        fetch(
          `${supabaseUrl}/rest/v1/shifts` +
            `?id=eq.${encodeURIComponent(shiftId)}` +
            `&select=id,shop_id,status,business_date,closing_balance&limit=1`,
          {
            method: "GET",
            headers,
            cache: "no-store",
          }
        ),

        fetch(
          `${supabaseUrl}/rest/v1/shop_platforms` +
            `?shop_id=eq.${encodeURIComponent(shopId)}` +
            `&is_active=eq.true&select=id,platform_name`,
          {
            method: "GET",
            headers,
            cache: "no-store",
          }
        ),

        fetch(
          `${supabaseUrl}/rest/v1/platform_readings` +
            `?shift_id=eq.${encodeURIComponent(shiftId)}` +
            `&reading_kind=eq.CLOSING` +
            `&select=id,platform_id,reading_value`,
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
        readingResult,
      ] = await Promise.all([
        safeJson(shiftResponse),
        safeJson(platformResponse),
        safeJson(readingResponse),
      ]);

      if (
        !shiftResponse.ok ||
        !platformResponse.ok ||
        !readingResponse.ok
      ) {
        throw new Error(
          shiftResult?.message ||
            platformResult?.message ||
            readingResult?.message ||
            "Unable to verify the shift and its closing readings."
        );
      }

      const freshShift = Array.isArray(shiftResult)
        ? shiftResult[0]
        : null;

      if (
        !freshShift ||
        String(freshShift.shop_id) !== String(shopId)
      ) {
        throw new Error(
          "Shift was not found in the selected shop."
        );
      }

      if (
        String(freshShift.status || "").toUpperCase() !== "OPEN"
      ) {
        throw new Error("This shift is no longer OPEN.");
      }

      if (
        !get12HourClosingAvailability(
          freshShift,
          new Date()
        ).available
      ) {
        throw new Error(
          "The 9:30 PM closing time for this shift has not arrived."
        );
      }
      // ==================================================
      // VALIDATE ALL ACTIVE PLATFORM CLOSINGS
      // ==================================================

      const platforms = Array.isArray(platformResult)
        ? platformResult
        : [];

      const readings = Array.isArray(readingResult)
        ? readingResult
        : [];

      if (platforms.length === 0) {
        throw new Error(
          "No active shop platforms were found."
        );
      }

      const closingByPlatform = new Map();

      for (const reading of readings) {
        if (reading.platform_id) {
          closingByPlatform.set(
            reading.platform_id,
            reading
          );
        }
      }

      const missing = platforms.filter(
        (platform) =>
          !closingByPlatform.has(platform.id)
      );

      if (missing.length > 0) {
        throw new Error(
          "Cannot close shift. Missing closing readings for: " +
            missing
              .map((platform) => platform.platform_name)
              .join(", ") +
            "."
        );
      }

      // Preserve existing signed-reading validation:
      // negative, zero and positive are accepted.
      // Blanks and non-finite values are rejected.
      for (const platform of platforms) {
        const raw =
          closingByPlatform.get(platform.id)?.reading_value;

        if (
          raw === null ||
          raw === undefined ||
          raw === "" ||
          !Number.isFinite(Number(raw))
        ) {
          throw new Error(
            `Invalid closing reading for ${platform.platform_name}.`
          );
        }
      }

      // ==================================================
      // CLOSE THE ORIGINAL SHIFT ONLY IF STILL OPEN
      // ==================================================

      const closeResponse = await fetch(
        `${supabaseUrl}/rest/v1/shifts` +
          `?id=eq.${encodeURIComponent(shiftId)}` +
          `&shop_id=eq.${encodeURIComponent(shopId)}` +
          `&status=eq.OPEN`,
        {
          method: "PATCH",
          headers: {
            ...headers,
            Prefer: "return=representation",
          },
          body: JSON.stringify({
            status: "CLOSED",
            closed_at: new Date().toISOString(),
          }),
        }
      );

      const closeResult = await safeJson(closeResponse);

      if (!closeResponse.ok) {
        throw new Error(
          closeResult?.message ||
            closeResult?.details ||
            closeResult?.hint ||
            "Unable to close shift."
        );
      }

      const closedShift = Array.isArray(closeResult)
        ? closeResult[0]
        : null;

      if (
        !closedShift ||
        String(closedShift.status).toUpperCase() !== "CLOSED"
      ) {
        throw new Error(
          "Shift was not closed. Refresh its status before trying again."
        );
      }

      setCompleted(true);
      setMessage("Shift closed successfully.");
      setMessageType("success");

      if (typeof onShiftClosed === "function") {
        try {
          await onShiftClosed(closedShift);
        } catch (callbackError) {
          console.error(
            "CLOSE SHIFT REFRESH ERROR:",
            callbackError
          );
        }
      }

      // Preserve existing dashboard reload after closing.
      setTimeout(
        () => window.location.reload(),
        1000
      );
    } catch (error) {
      console.error("CLOSE SHIFT ERROR:", error);

      setMessage(
        error?.message || "Unable to close shift."
      );

      setMessageType("error");
    } finally {
      busyRef.current = false;
      setClosing(false);
    }
  }

  // ==================================================
  // DISPLAY
  // ==================================================

  if (
    shiftStatus !== "OPEN" ||
    !shiftId
  ) {
    return null;
  }

  // Hide before 9:30 PM on this shift's date.
  // Remain visible afterward, even days late.
  if (
    !availability.available &&
    availability.validDate
  ) {
    return null;
  }

  return (
    <div>
      {message && (
        <div
          role="alert"
          style={{
            padding: 10,
            marginTop: 10,
            backgroundColor:
              messageType === "success"
                ? "#ecfdf5"
                : "#fef2f2",
            color:
              messageType === "success"
                ? "#166534"
                : "#991b1b",
            textAlign: "center",
            fontWeight: "bold",
            fontSize: 12,
          }}
        >
          {message}
        </div>
      )}

      <button
        type="button"
        onClick={closeShift}
        disabled={
          closing ||
          completed ||
          !availability.available
        }
        style={{
          width: "100%",
          border: "none",
          backgroundColor:
            closing ||
            completed ||
            !availability.available
              ? "#64748b"
              : "#07912a",
          color: "white",
          padding: 13,
          marginTop: 10,
          textAlign: "center",
          fontWeight: "bold",
          fontSize: 13,
          cursor:
            closing ||
            completed ||
            !availability.available
              ? "not-allowed"
              : "pointer",
        }}
      >
        {closing
          ? "CLOSING SHIFT..."
          : completed
          ? "SHIFT CLOSED ✓"
          : !availability.validDate
          ? "CONTACT ADMIN — INVALID SHIFT DATE"
          : "✓ CLOSE SHIFT & HAND OVER"}
      </button>
    </div>
  );
}
// ==================================================
// DATE-AWARE 12-HOUR CLOSING AVAILABILITY
//
// Opens at 9:30 PM on the ORIGINAL business date.
// Remains available after midnight and on later days.
// ==================================================

function get12HourClosingAvailability(
  shift,
  date = new Date()
) {
  const businessDate = String(
    shift?.business_date || ""
  ).slice(0, 10);

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(businessDate)
  ) {
    return {
      available: false,
      validDate: false,
    };
  }

  return {
    available:
      getNairobiDateTimeKey(date) >=
      `${businessDate}T${CLOSING_START}`,

    validDate: true,
  };
}

// ==================================================
// NAIROBI DATE + TIME
// ==================================================

function getNairobiDateTimeKey(
  date = new Date()
) {
  const parts = new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: NAIROBI_TIME_ZONE,
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
// SAFE JSON
// ==================================================

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
