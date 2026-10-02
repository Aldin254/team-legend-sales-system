"use client";

import {
  useEffect,
  useState,
} from "react";

export default function CashierCloseShiftButton({
  user,
  currentShift,
}) {
  const [closing, setClosing] = useState(false);
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(() => new Date());

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const accessToken =
    user?.access_token || null;

  const shopId =
    user?.shop_id ||
    user?.shopId ||
    null;

  const shiftId =
    currentShift?.id || null;

  const shiftStatus =
    String(
      currentShift?.status || ""
    ).toUpperCase();

  // ==================================================
  // LIVE NAIROBI CLOCK
  // ==================================================

  useEffect(() => {
    setNow(new Date());

    const timer = setInterval(() => {
      setNow(new Date());
    }, 15000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  const closingWindowOpen =
    is12HourClosingWindow(now);

  // ==================================================
  // CLOSE SHIFT
  // ==================================================

  async function closeShift() {
    // ==============================================
    // 0. CASHIER TIME WINDOW CHECK
    // ==============================================

    if (
      !is12HourClosingWindow(
        new Date()
      )
    ) {
      setMessage(
        "Shift change is available only from 9:30 PM to midnight (Nairobi time)."
      );

      return;
    }

    if (
      !shiftId ||
      !shopId ||
      !accessToken ||
      !supabaseUrl ||
      !supabaseAnonKey
    ) {
      setMessage(
        "Shift or login information is missing."
      );

      return;
    }

    if (
      String(
        currentShift?.status || ""
      ).toUpperCase() !== "OPEN"
    ) {
      setMessage(
        "This shift is already closed."
      );

      return;
    }

    const confirmed =
      window.confirm(
        "Close this shift?\n\n" +
          "After closing:\n" +
          "• Cashier entries will be completed\n" +
          "• Closing Balance will carry to the next shift as Balance B/F\n" +
          "• TABLE closing will carry to the next TABLE opening"
      );

    if (!confirmed) {
      return;
    }

    try {
      setClosing(true);
      setMessage("");

      // ==============================================
      // 1. RECHECK TIME AFTER CONFIRMATION
      // ==============================================

      if (
        !is12HourClosingWindow(
          new Date()
        )
      ) {
        throw new Error(
          "Shift change is available only from 9:30 PM to midnight (Nairobi time)."
        );
      }

      // ==============================================
      // 2. LOAD ACTIVE PLATFORMS
      // ==============================================

      const platformResponse =
        await fetch(
          `${supabaseUrl}/rest/v1/shop_platforms` +
            `?shop_id=eq.${encodeURIComponent(
              shopId
            )}` +
            `&is_active=eq.true` +
            `&select=id,platform_name`,
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

      const platforms =
        await safeJson(
          platformResponse
        );

      if (!platformResponse.ok) {
        throw new Error(
          platforms?.message ||
            platforms?.details ||
            "Unable to check shop platforms."
        );
      }

      const activePlatforms =
        Array.isArray(platforms)
          ? platforms
          : [];

      if (
        activePlatforms.length === 0
      ) {
        throw new Error(
          "No active shop platforms were found."
        );
      }

      // ==============================================
      // 3. LOAD CLOSING READINGS
      // ==============================================

      const readingResponse =
        await fetch(
          `${supabaseUrl}/rest/v1/platform_readings` +
            `?shift_id=eq.${encodeURIComponent(
              shiftId
            )}` +
            `&reading_kind=eq.CLOSING` +
            `&select=id,platform_id,reading_value`,
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

      const readings =
        await safeJson(
          readingResponse
        );

      if (!readingResponse.ok) {
        throw new Error(
          readings?.message ||
            readings?.details ||
            "Unable to check closing readings."
        );
      }

      const closingReadings =
        Array.isArray(readings)
          ? readings
          : [];

      // ==============================================
      // 4. CHECK EVERY PLATFORM HAS A CLOSING READING
      //
      // IMPORTANT:
      // reading_value = 0 IS VALID.
      // We check existence by platform_id only.
      // We do NOT use truthiness on reading_value.
      // ==============================================

      const closingPlatformIds =
        new Set(
          closingReadings.map(
            (reading) =>
              reading.platform_id
          )
        );

      const missingPlatforms =
        activePlatforms.filter(
          (platform) =>
            !closingPlatformIds.has(
              platform.id
            )
        );

      if (
        missingPlatforms.length > 0
      ) {
        const names =
          missingPlatforms
            .map(
              (platform) =>
                platform.platform_name
            )
            .join(", ");

        throw new Error(
          `Cannot close shift. Closing reading is missing for: ${names}.`
        );
      }

      // ==============================================
      // 5. VALIDATE CLOSING VALUES
      //
      // ZERO IS VALID.
      // ==============================================

      for (
        const reading of closingReadings
      ) {
        if (
          reading.reading_value === null ||
          reading.reading_value === undefined ||
          reading.reading_value === ""
        ) {
          throw new Error(
            "One or more closing readings are invalid."
          );
        }

        const value =
          Number(
            reading.reading_value
          );

        if (
          Number.isNaN(value) ||
          value < 0
        ) {
          throw new Error(
            "One or more closing readings are invalid."
          );
        }
      }

      // ==============================================
      // 6. CHECK SHIFT IS STILL OPEN
      // ==============================================

      const shiftResponse =
        await fetch(
          `${supabaseUrl}/rest/v1/shifts` +
            `?id=eq.${encodeURIComponent(
              shiftId
            )}` +
            `&select=id,status,closing_balance` +
            `&limit=1`,
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

      const shiftResult =
        await safeJson(
          shiftResponse
        );

      if (!shiftResponse.ok) {
        throw new Error(
          shiftResult?.message ||
            shiftResult?.details ||
            "Unable to check shift."
        );
      }

      const latestShift =
        Array.isArray(
          shiftResult
        )
          ? shiftResult[0]
          : null;

      if (!latestShift) {
        throw new Error(
          "Shift could not be found."
        );
      }

      if (
        String(
          latestShift.status || ""
        ).toUpperCase() !==
        "OPEN"
      ) {
        throw new Error(
          "This shift is already closed."
        );
      }

      // ==============================================
      // 7. FINAL TIME CHECK
      //
      // This is intentionally immediately before
      // the PATCH that closes the shift.
      // ==============================================

      if (
        !is12HourClosingWindow(
          new Date()
        )
      ) {
        throw new Error(
          "Shift change is available only from 9:30 PM to midnight (Nairobi time)."
        );
      }

      // ==============================================
      // 8. CLOSE SHIFT
      // ==============================================

      const closeResponse =
        await fetch(
          `${supabaseUrl}/rest/v1/shifts` +
            `?id=eq.${encodeURIComponent(
              shiftId
            )}` +
            `&status=eq.OPEN`,
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
                "return=representation",
            },

            body: JSON.stringify({
              status:
                "CLOSED",

              closed_at:
                new Date().toISOString(),
            }),
          }
        );

      const closeResult =
        await safeJson(
          closeResponse
        );

      if (!closeResponse.ok) {
        throw new Error(
          closeResult?.message ||
            closeResult?.details ||
            closeResult?.hint ||
            "Unable to close shift."
        );
      }

      if (
        !Array.isArray(
          closeResult
        ) ||
        closeResult.length === 0
      ) {
        throw new Error(
          "Shift was not closed. Please try again."
        );
      }

      // ==============================================
      // 9. SUCCESS
      // ==============================================

      setMessage(
        "Shift closed successfully."
      );

      /*
       * Dashboard reload:
       *
       * page.js will then use:
       *
       * Previous Closing Balance
       *          ↓
       * Next Balance B/F
       *
       * Previous TABLE Closing
       *          ↓
       * Next TABLE Opening
       *
       * Other platform openings
       *          ↓
       * 0
       */

      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error(
        "CLOSE SHIFT ERROR:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to close shift."
      );
    } finally {
      setClosing(false);
    }
  }

  // ==================================================
  // DO NOT SHOW BUTTON FOR CLOSED SHIFT
  // ==================================================

  if (
    shiftStatus !== "OPEN"
  ) {
    return null;
  }

  // ==================================================
  // HIDE COMPLETELY OUTSIDE 9:30 PM - MIDNIGHT
  // ==================================================

  if (!closingWindowOpen) {
    return null;
  }

  // ==================================================
  // RENDER
  // ==================================================

  return (
    <div>
      {message && (
        <div
          style={{
            padding: "9px",
            marginTop: "10px",
            backgroundColor:
              message.includes(
                "successfully"
              )
                ? "#ecfdf5"
                : "#fef2f2",

            color:
              message.includes(
                "successfully"
              )
                ? "#166534"
                : "#991b1b",

            textAlign: "center",
            fontWeight: "bold",
            fontSize: "11px",
          }}
        >
          {message}
        </div>
      )}

      <button
        type="button"
        onClick={closeShift}
        disabled={closing}
        style={{
          width: "100%",
          border: "none",

          backgroundColor:
            closing
              ? "#64748b"
              : "#07912a",

          color: "white",
          padding: "13px",
          marginTop: "10px",
          textAlign: "center",
          fontWeight: "bold",
          fontSize: "13px",

          cursor:
            closing
              ? "default"
              : "pointer",
        }}
      >
        {closing
          ? "CLOSING SHIFT..."
          : "✓ CLOSE SHIFT & HAND OVER"}
      </button>
    </div>
  );
}

// ==================================================
// 12-HOUR CASHIER CLOSING WINDOW
//
// Nairobi time:
// 9:30 PM inclusive
// Midnight exclusive
// ==================================================

function is12HourClosingWindow(
  date = new Date()
) {
  const formatter =
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone:
          "Africa/Nairobi",

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

  for (const part of parts) {
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

  const hour =
    Number(
      values.hour
    );

  const minute =
    Number(
      values.minute
    );

  const minutesSinceMidnight =
    hour * 60 +
    minute;

  return (
    minutesSinceMidnight >=
      21 * 60 + 30 &&
    minutesSinceMidnight <
      24 * 60
  );
}

// ==================================================
// SAFE JSON
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
