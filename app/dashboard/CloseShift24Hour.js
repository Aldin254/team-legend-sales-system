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
  const [closing, setClosing] = useState(false);

  const [now, setNow] = useState(new Date());

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

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

  const shiftName =
    normalizeShiftName(
      shiftData?.shift_name ||
        currentShift?.shift_name
    );

  // ==================================================
  // UPDATE CLOCK
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

  // ==================================================
  // LOAD SHIFT + PLATFORMS + READINGS
  // ==================================================

  useEffect(() => {
    if (
      !shiftId ||
      !shopId ||
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

        // ------------------------------------------
        // CURRENT SHIFT
        // ------------------------------------------

        const shiftResponse = await fetch(
          `${supabaseUrl}/rest/v1/shifts` +
            `?id=eq.${encodeURIComponent(shiftId)}` +
            `&select=*` +
            `&limit=1`,
          {
            method: "GET",

            headers: {
              apikey: supabaseAnonKey,

              Authorization:
                `Bearer ${accessToken}`,

              "Content-Type":
                "application/json",
            },

            cache: "no-store",
          }
        );

        const shiftResult =
          await safeJson(shiftResponse);

        if (!shiftResponse.ok) {
          throw new Error(
            shiftResult?.message ||
              shiftResult?.details ||
              "Unable to load current shift."
          );
        }

        const latestShift =
          Array.isArray(shiftResult) &&
          shiftResult.length > 0
            ? shiftResult[0]
            : null;

        if (!latestShift) {
          throw new Error(
            "Current shift could not be found."
          );
        }

        // ------------------------------------------
        // ACTIVE PLATFORMS
        // ------------------------------------------

        const platformResponse = await fetch(
          `${supabaseUrl}/rest/v1/shop_platforms` +
            `?shop_id=eq.${encodeURIComponent(shopId)}` +
            `&is_active=eq.true` +
            `&select=id,platform_name,display_order` +
            `&order=display_order.asc`,
          {
            method: "GET",

            headers: {
              apikey: supabaseAnonKey,

              Authorization:
                `Bearer ${accessToken}`,

              "Content-Type":
                "application/json",
            },

            cache: "no-store",
          }
        );

        const platformResult =
          await safeJson(platformResponse);

        if (!platformResponse.ok) {
          throw new Error(
            platformResult?.message ||
              platformResult?.details ||
              "Unable to load shop platforms."
          );
        }

        // ------------------------------------------
        // ALL CURRENT SHIFT READINGS
        // ------------------------------------------

        const readingsResponse = await fetch(
          `${supabaseUrl}/rest/v1/platform_readings` +
            `?shift_id=eq.${encodeURIComponent(shiftId)}` +
            `&select=id,platform_id,reading_kind,reading_value,recorded_at`,
          {
            method: "GET",

            headers: {
              apikey: supabaseAnonKey,

              Authorization:
                `Bearer ${accessToken}`,

              "Content-Type":
                "application/json",
            },

            cache: "no-store",
          }
        );

        const readingsResult =
          await safeJson(readingsResponse);

        if (!readingsResponse.ok) {
          throw new Error(
            readingsResult?.message ||
              readingsResult?.details ||
              "Unable to load platform readings."
          );
        }

        if (cancelled) {
          return;
        }

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
      } catch (error) {
        console.error(
          "24H CLOSE LOAD ERROR:",
          error
        );

        if (!cancelled) {
          setMessage(
            error?.message ||
              "Unable to prepare shift handover."
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
    shiftId,
    shopId,
    accessToken,
    supabaseUrl,
    supabaseAnonKey,
    refreshKey,
  ]);

  // ==================================================
  // CURRENT HANDOVER WINDOW
  // ==================================================

  const handoverWindow =
    useMemo(() => {
      return get24HourHandoverWindow(now);
    }, [now]);

  // ==================================================
  // REQUIRED READINGS
  // ==================================================

  const readingStatus =
    useMemo(() => {
      return calculateReadingStatus({
        platforms,
        readings,
        shiftName,
      });
    }, [
      platforms,
      readings,
      shiftName,
    ]);

  // The current time window must belong specifically
  // to the currently open shift.
  //
  // SHIFT 1 -> evening only
  // SHIFT 2 -> morning only

  const correctWindow =
    handoverWindow.allowed &&
    handoverWindow.closingShift ===
      shiftName;

  const canClose =
    correctWindow &&
    readingStatus.complete &&
    String(
      shiftData?.status ||
        currentShift?.status ||
        ""
    ).toUpperCase() === "OPEN";

  // ==================================================
  // REFRESH DATA BEFORE HANDOVER
  // ==================================================

  async function getFreshHandoverData() {
    // ------------------------------------------
    // SHIFT
    // ------------------------------------------

    const shiftResponse = await fetch(
      `${supabaseUrl}/rest/v1/shifts` +
        `?id=eq.${encodeURIComponent(shiftId)}` +
        `&select=*` +
        `&limit=1`,
      {
        method: "GET",

        headers: {
          apikey: supabaseAnonKey,

          Authorization:
            `Bearer ${accessToken}`,

          "Content-Type":
            "application/json",
        },

        cache: "no-store",
      }
    );

    const shiftResult =
      await safeJson(shiftResponse);

    if (!shiftResponse.ok) {
      throw new Error(
        shiftResult?.message ||
          shiftResult?.details ||
          "Unable to verify current shift."
      );
    }

    const freshShift =
      Array.isArray(shiftResult) &&
      shiftResult.length > 0
        ? shiftResult[0]
        : null;

    if (!freshShift) {
      throw new Error(
        "Current shift could not be found."
      );
    }

    // ------------------------------------------
    // PLATFORMS
    // ------------------------------------------

    const platformResponse = await fetch(
      `${supabaseUrl}/rest/v1/shop_platforms` +
        `?shop_id=eq.${encodeURIComponent(shopId)}` +
        `&is_active=eq.true` +
        `&select=id,platform_name,display_order` +
        `&order=display_order.asc`,
      {
        method: "GET",

        headers: {
          apikey: supabaseAnonKey,

          Authorization:
            `Bearer ${accessToken}`,

          "Content-Type":
            "application/json",
        },

        cache: "no-store",
      }
    );

    const platformResult =
      await safeJson(platformResponse);

    if (!platformResponse.ok) {
      throw new Error(
        platformResult?.message ||
          platformResult?.details ||
          "Unable to verify active platforms."
      );
    }

    // ------------------------------------------
    // READINGS
    // ------------------------------------------

    const readingsResponse = await fetch(
      `${supabaseUrl}/rest/v1/platform_readings` +
        `?shift_id=eq.${encodeURIComponent(shiftId)}` +
        `&select=id,platform_id,reading_kind,reading_value,recorded_at`,
      {
        method: "GET",

        headers: {
          apikey: supabaseAnonKey,

          Authorization:
            `Bearer ${accessToken}`,

          "Content-Type":
            "application/json",
        },

        cache: "no-store",
      }
    );

    const readingsResult =
      await safeJson(readingsResponse);

    if (!readingsResponse.ok) {
      throw new Error(
        readingsResult?.message ||
          readingsResult?.details ||
          "Unable to verify platform readings."
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
  // ==================================================

  async function closeShift() {
    if (
      !shiftId ||
      !shopId
    ) {
      setMessage(
        "Current shift information is missing."
      );

      setMessageType("error");
      return;
    }

    if (!accessToken) {
      setMessage(
        "Authentication is missing. Please log in again."
      );

      setMessageType("error");
      return;
    }

    try {
      setClosing(true);
      setMessage("");
      setMessageType("");

      // ------------------------------------------
      // SECURITY CHECK #1:
      // CHECK NAIROBI TIME AGAIN ON CLICK
      // ------------------------------------------

      const freshWindow =
        get24HourHandoverWindow(
          new Date()
        );

      if (!freshWindow.allowed) {
        throw new Error(
          "Shift handover is disabled. Handover is allowed only from 9:00 AM–11:00 AM or 9:00 PM–11:00 PM Nairobi time."
        );
      }

      // ------------------------------------------
      // GET FRESH DATABASE STATE
      // ------------------------------------------

      const fresh =
        await getFreshHandoverData();

      const freshShiftName =
        normalizeShiftName(
          fresh.shift.shift_name
        );

      // ------------------------------------------
      // SECURITY CHECK #2:
      // CORRECT SHIFT FOR CURRENT WINDOW
      // ------------------------------------------

      if (
        freshWindow.closingShift !==
        freshShiftName
      ) {
        throw new Error(
          `${freshShiftName || "This shift"} cannot be handed over during the current time window.`
        );
      }

      if (
        String(
          fresh.shift.status || ""
        ).toUpperCase() !== "OPEN"
      ) {
        throw new Error(
          "This shift is no longer open."
        );
      }

      // ------------------------------------------
      // SECURITY CHECK #3:
      // REQUIRED PLATFORM READINGS
      // ------------------------------------------

      const freshReadingStatus =
        calculateReadingStatus({
          platforms:
            fresh.platforms,

          readings:
            fresh.readings,

          shiftName:
            freshShiftName,
        });

      if (
        !freshReadingStatus.complete
      ) {
        throw new Error(
          freshReadingStatus.message
        );
      }

      // ------------------------------------------
      // CLOSE SHIFT
      // ------------------------------------------

      const closedAt =
        new Date().toISOString();

      const closeResponse =
        await fetch(
          `${supabaseUrl}/rest/v1/shifts` +
            `?id=eq.${encodeURIComponent(shiftId)}`,
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

            body:
              JSON.stringify({
                status:
                  "CLOSED",

                closed_at:
                  closedAt,
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

      const closedShift =
        Array.isArray(
          closeResult
        ) &&
        closeResult.length > 0
          ? closeResult[0]
          : {
              ...fresh.shift,

              status:
                "CLOSED",

              closed_at:
                closedAt,
            };

      setShiftData(
        closedShift
      );

      setMessage(
        `${freshShiftName} closed successfully. ${freshWindow.nextShift} can now begin.`
      );

      setMessageType(
        "success"
      );

      if (
        typeof onShiftClosed ===
        "function"
      ) {
        await onShiftClosed(
          closedShift
        );
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

      setMessageType(
        "error"
      );
    } finally {
      setClosing(false);
    }
  }

  // ==================================================
  // DISPLAY
  // ==================================================

  if (!currentShift) {
    return null;
  }

  const status =
    String(
      shiftData?.status ||
        currentShift?.status ||
        "OPEN"
    ).toUpperCase();

  const netIncome =
    Number(
      shiftData?.net_income ??
        currentShift?.net_income ??
        0
    );

  const closingBalance =
    Number(
      shiftData?.closing_balance ??
        currentShift?.closing_balance ??
        0
    );

  return (
    <div
      style={{
        marginTop: "24px",

        backgroundColor:
          "white",

        padding: "25px",

        borderRadius:
          "12px",

        boxShadow:
          "0 2px 10px rgba(0,0,0,0.08)",

        maxWidth:
          "900px",
      }}
    >
      <h2
        style={{
          margin:
            "0 0 6px 0",
        }}
      >
        Close Shift & Hand Over
      </h2>

      <div
        style={{
          color:
            "#64748b",

          marginBottom:
            "20px",
        }}
      >
        {shiftName ||
          "24-Hour Shift"}
      </div>

      {/* TIME WINDOW */}

      <div
        style={{
          padding:
            "15px",

          marginBottom:
            "16px",

          borderRadius:
            "9px",

          backgroundColor:
            correctWindow
              ? "#ecfdf5"
              : "#fff7ed",

          color:
            correctWindow
              ? "#166534"
              : "#9a3412",
        }}
      >
        <div
          style={{
            fontWeight:
              "bold",

            marginBottom:
              "4px",
          }}
        >
          {correctWindow
            ? "Handover window OPEN ✓"
            : "Handover window CLOSED"}
        </div>

        <div
          style={{
            fontSize:
              "14px",
          }}
        >
          {getWindowMessage({
            shiftName,
            handoverWindow,
          })}
        </div>

        <div
          style={{
            marginTop:
              "5px",

            fontSize:
              "13px",
          }}
        >
          Nairobi time:{" "}
          {formatNairobiTime(
            now
          )}
        </div>
      </div>

      {/* READINGS STATUS */}

      <div
        style={{
          padding:
            "15px",

          marginBottom:
            "18px",

          borderRadius:
            "9px",

          backgroundColor:
            readingStatus.complete
              ? "#ecfdf5"
              : "#fff7ed",

          color:
            readingStatus.complete
              ? "#166534"
              : "#9a3412",
        }}
      >
        <strong>
          Platform readings:{" "}
          {readingStatus.complete
            ? "Complete ✓"
            : "Incomplete"}
        </strong>

        {!readingStatus.complete && (
          <div
            style={{
              marginTop:
                "5px",

              fontSize:
                "14px",
            }}
          >
            {
              readingStatus.message
            }
          </div>
        )}
      </div>

      {/* TOTALS */}

      <div
        style={{
          display:
            "grid",

          gridTemplateColumns:
            "repeat(2, minmax(0, 1fr))",

          gap:
            "12px",

          marginBottom:
            "20px",
        }}
      >
        <TotalCard
          title="Net Income"
          value={netIncome}
        />

        <TotalCard
          title="Closing Balance"
          value={
            closingBalance
          }
        />
      </div>

      {message && (
        <div
          style={{
            padding:
              "12px",

            marginBottom:
              "16px",

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

      {loading && (
        <div
          style={{
            marginBottom:
              "12px",

            color:
              "#64748b",

            fontSize:
              "13px",
          }}
        >
          Refreshing shift information...
        </div>
      )}

      {status ===
      "CLOSED" ? (
        <div
          style={{
            padding:
              "14px",

            backgroundColor:
              "#ecfdf5",

            color:
              "#166534",

            borderRadius:
              "8px",

            textAlign:
              "center",

            fontWeight:
              "bold",
          }}
        >
          {shiftName} Closed ✓
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={
              closeShift
            }
            disabled={
              closing ||
              loading ||
              !canClose
            }
            style={{
              width:
                "100%",

              padding:
                "15px",

              border:
                "none",

              borderRadius:
                "8px",

              backgroundColor:
                closing ||
                loading ||
                !canClose
                  ? "#94a3b8"
                  : "#168d32",

              color:
                "white",

              fontWeight:
                "bold",

              fontSize:
                "16px",

              cursor:
                closing ||
                loading ||
                !canClose
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            {closing
              ? "Completing Handover..."
              : loading
              ? "Refreshing..."
              : correctWindow
              ? `Close ${shiftName} & Hand Over`
              : "Shift Change Disabled"}
          </button>

          {!correctWindow && (
            <div
              style={{
                marginTop:
                  "10px",

                textAlign:
                  "center",

                color:
                  "#64748b",

                fontSize:
                  "13px",
              }}
            >
              {shiftName === "SHIFT 1"
                ? "SHIFT 1 change works only from 9:00 PM to before 11:00 PM Nairobi time."
                : shiftName === "SHIFT 2"
                ? "SHIFT 2 change works only from 9:00 AM to before 11:00 AM Nairobi time."
                : "Shift change is currently unavailable."}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ==================================================
// REQUIRED READING CHECK
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

  const readingSet =
    new Set();

  for (
    const row of Array.isArray(
      readings
    )
      ? readings
      : []
  ) {
    if (
      !row.platform_id ||
      !row.reading_kind
    ) {
      continue;
    }

    readingSet.add(
      `${row.platform_id}:${row.reading_kind}`
    );
  }

  // ------------------------------------------
  // SHIFT 1
  // Every platform needs 9PM handover.
  // ------------------------------------------

  if (
    shiftName ===
    "SHIFT 1"
  ) {
    const missing =
      platforms.filter(
        (platform) =>
          !readingSet.has(
            `${platform.id}:HANDOVER_9PM`
          )
      );

    if (
      missing.length > 0
    ) {
      return {
        complete: false,

        message:
          `Save the 9 PM handover reading for: ${missing
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

  // ------------------------------------------
  // SHIFT 2
  //
  // Non-TABLE:
  // MIDNIGHT_CLOSE + CLOSING_9AM
  //
  // TABLE:
  // CLOSING_9AM only
  // ------------------------------------------

  if (
    shiftName ===
    "SHIFT 2"
  ) {
    const missingMidnight =
      platforms.filter(
        (platform) =>
          !isTable(
            platform
          ) &&
          !readingSet.has(
            `${platform.id}:MIDNIGHT_CLOSE`
          )
      );

    if (
      missingMidnight.length > 0
    ) {
      return {
        complete: false,

        message:
          `Save the 11:59 PM closing reading for: ${missingMidnight
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

    if (
      missing9am.length > 0
    ) {
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
// NAIROBI HANDOVER WINDOW
//
// MORNING:
// 09:00 <= time < 11:00
//
// EVENING:
// 21:00 <= time < 23:00
// ==================================================

function get24HourHandoverWindow(
  date
) {
  const parts =
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
    ).formatToParts(date);

  const hour =
    Number(
      parts.find(
        (part) =>
          part.type ===
          "hour"
      )?.value || 0
    );

  const minute =
    Number(
      parts.find(
        (part) =>
          part.type ===
          "minute"
      )?.value || 0
    );

  const second =
    Number(
      parts.find(
        (part) =>
          part.type ===
          "second"
      )?.value || 0
    );

  const secondsNow =
    hour * 3600 +
    minute * 60 +
    second;

  // 09:00:00 inclusive
  const morningStart =
    9 * 3600;

  // 11:00:00 exclusive
  const morningEnd =
    11 * 3600;

  // 21:00:00 inclusive
  const eveningStart =
    21 * 3600;

  // 23:00:00 exclusive
  const eveningEnd =
    23 * 3600;

  if (
    secondsNow >=
      morningStart &&
    secondsNow <
      morningEnd
  ) {
    return {
      allowed: true,

      window:
        "MORNING",

      closingShift:
        "SHIFT 2",

      nextShift:
        "SHIFT 1",
    };
  }

  if (
    secondsNow >=
      eveningStart &&
    secondsNow <
      eveningEnd
  ) {
    return {
      allowed: true,

      window:
        "EVENING",

      closingShift:
        "SHIFT 1",

      nextShift:
        "SHIFT 2",
    };
  }

  return {
    allowed: false,

    window: null,

    closingShift: null,

    nextShift: null,
  };
}

// ==================================================
// WINDOW MESSAGE
// ==================================================

function getWindowMessage({
  shiftName,
  handoverWindow,
}) {
  if (
    handoverWindow.allowed
  ) {
    if (
      handoverWindow.closingShift ===
      shiftName
    ) {
      return `${shiftName} may be handed over now.`;
    }

    return `The current window is for ${handoverWindow.closingShift}, not ${shiftName}.`;
  }

  if (
    shiftName ===
    "SHIFT 1"
  ) {
    return "SHIFT 1 handover opens from 9:00 PM until before 11:00 PM.";
  }

  if (
    shiftName ===
    "SHIFT 2"
  ) {
    return "SHIFT 2 handover opens from 9:00 AM until before 11:00 AM.";
  }

  return "Shift handover is currently unavailable.";
}

// ==================================================
// TOTAL CARD
// ==================================================

function TotalCard({
  title,
  value,
}) {
  const numeric =
    Number(value);

  const safeValue =
    Number.isFinite(
      numeric
    )
      ? numeric
      : 0;

  return (
    <div
      style={{
        backgroundColor:
          "#f8fafc",

        padding:
          "16px",

        borderRadius:
          "9px",

        border:
          "1px solid #e2e8f0",
      }}
    >
      <div
        style={{
          color:
            "#64748b",

          fontSize:
            "13px",
        }}
      >
        {title}
      </div>

      <div
        style={{
          marginTop:
            "6px",

          fontSize:
            "20px",

          fontWeight:
            "bold",
        }}
      >
        KES{" "}
        {safeValue.toLocaleString(
          "en-KE",
          {
            minimumFractionDigits:
              2,

            maximumFractionDigits:
              2,
          }
        )}
      </div>
    </div>
  );
}

// ==================================================
// HELPERS
// ==================================================

function normalizeShiftName(
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
      "SHIFT1" ||
    text ===
      "SHIFT 1"
  ) {
    return "SHIFT 1";
  }

  if (
    text ===
      "SHIFT2" ||
    text ===
      "SHIFT 2"
  ) {
    return "SHIFT 2";
  }

  return text;
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
    "TABLE"
  );
}

function formatNairobiTime(
  date
) {
  return new Intl.DateTimeFormat(
    "en-KE",
    {
      timeZone:
        "Africa/Nairobi",

      hour:
        "2-digit",

      minute:
        "2-digit",

      second:
        "2-digit",

      hour12:
        true,
    }
  ).format(date);
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
