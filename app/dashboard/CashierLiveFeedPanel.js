"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

const REFRESH_MS = 30000;

// ==================================================
// TEAM LEGEND — SHARED CASHIER LIVE FEED
// Admin announcements, OFF days, relief,
// temporary Moves, Swaps and Half-Day duties.
// ==================================================

export default function CashierLiveFeedPanel({
  user,
}) {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const accessToken =
    user?.access_token || null;

  const [feed, setFeed] = useState(null);
  const [temporaryEvents, setTemporaryEvents] =
    useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [partialWarnings, setPartialWarnings] =
    useState([]);

  // ==================================================
  // AUTH
  // ==================================================

  const authHeaders = useCallback(
    () => ({
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    }),
    [supabaseAnonKey, accessToken]
  );

  // ==================================================
  // SUPABASE RPC
  // ==================================================

  const callRpc = useCallback(
    async (functionName, body = {}, signal) => {
      if (
        !supabaseUrl ||
        !supabaseAnonKey ||
        !accessToken
      ) {
        throw new Error(
          "Cashier session is incomplete."
        );
      }

      const response = await fetch(
        `${supabaseUrl}/rest/v1/rpc/${functionName}`,
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify(body),
          cache: "no-store",
          ...(signal ? { signal } : {}),
        }
      );

      const result = await safeJson(response);

      if (!response.ok) {
        throw new Error(
          result?.message ||
            result?.details ||
            result?.hint ||
            `Unable to run ${functionName}.`
        );
      }

      return result;
    },
    [
      supabaseUrl,
      supabaseAnonKey,
      accessToken,
      authHeaders,
    ]
  );

  // ==================================================
  // LOAD REGULAR + TEMPORARY LIVE FEED
  // AUTOMATIC REFRESH EVERY 30 SECONDS
  // ==================================================

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;

    const controller = new AbortController();

    if (!accessToken) {
      setFeed(null);
      setTemporaryEvents([]);
      setPartialWarnings([]);
      setLoading(false);
      setError("Cashier session unavailable.");

      return () => {
        controller.abort();
      };
    }

    setLoading(true);
    setError("");

    async function loadFeed() {
      if (cancelled || inFlight) return;

      inFlight = true;

      try {
        const [regularResult, temporaryResult] =
          await Promise.allSettled([
            callRpc(
              "tl_cashier_live_feed_snapshot",
              {},
              controller.signal
            ),
            callRpc(
              "tl_cashier_live_feed_temporary",
              {},
              controller.signal
            ),
          ]);

        if (cancelled) return;

        const regularOK =
          regularResult.status === "fulfilled" &&
          regularResult.value?.success === true;

        const temporaryOK =
          temporaryResult.status === "fulfilled" &&
          temporaryResult.value?.success === true &&
          Array.isArray(
            temporaryResult.value?.events
          );

        if (!regularOK) {
          console.error(
            "REGULAR LIVE FEED ERROR:",
            regularResult.status === "rejected"
              ? regularResult.reason
              : regularResult.value
          );
        }

        if (!temporaryOK) {
          console.error(
            "TEMPORARY LIVE FEED ERROR:",
            temporaryResult.status === "rejected"
              ? temporaryResult.reason
              : temporaryResult.value
          );
        }

        if (!regularOK && !temporaryOK) {
          throw new Error(
            "Unable to load Live Feed."
          );
        }

        setFeed(
          regularOK
            ? regularResult.value
            : null
        );

        setTemporaryEvents(
          temporaryOK
            ? temporaryResult.value.events
            : []
        );

        const warnings = [];

        if (!regularOK) {
          warnings.push(
            "Regular Duty Rota updates unavailable."
          );
        }

        if (!temporaryOK) {
          warnings.push(
            "Temporary Duty Rota updates unavailable."
          );
        }

        setPartialWarnings(warnings);
        setError("");
      } catch (err) {
        if (!cancelled) {
          console.error(
            "LIVE FEED ERROR:",
            err
          );

          setError(
            err?.message ||
              "Unable to load Live Feed."
          );
        }
      } finally {
        inFlight = false;

        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadFeed();

    const timer = setInterval(() => {
      void loadFeed();
    }, REFRESH_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
      controller.abort();
    };
  }, [accessToken, callRpc]);

  // ==================================================
  // BUILD MOVING FEED
  // ==================================================

  const tickerItems = useMemo(() => {
    const items = [];

    const today = feed?.today;
    const tomorrow = feed?.tomorrow;

    const todayDate =
      dateOnly(today?.date) ||
      todayNairobi();

    const tomorrowDate =
      dateOnly(tomorrow?.date) ||
      addDays(todayDate, 1);

    const announcements =
      Array.isArray(feed?.announcements)
        ? feed.announcements
        : [];

    const todayEvents =
      Array.isArray(today?.events)
        ? today.events
        : [];

    const tomorrowEvents =
      Array.isArray(tomorrow?.events)
        ? tomorrow.events
        : [];

    // ==================================================
    // ADMIN ANNOUNCEMENTS FIRST
    // ==================================================

    for (const announcement of announcements) {
      const title =
        cleanText(announcement?.title);

      const message =
        cleanText(announcement?.message);

      const important =
        upper(announcement?.priority) ===
        "IMPORTANT";

      const pinned =
        announcement?.is_pinned === true;

      let text = "";

      if (important) {
        text += "IMPORTANT: ";
      }

      if (pinned) {
        text += "PINNED: ";
      }

      if (title) {
        text += `${title} — `;
      }

      text += message;

      if (text.trim()) {
        items.push(text.trim());
      }
    }

    // ==================================================
    // PREPARE TEMPORARY ASSIGNMENTS
    // ==================================================

    const sortedTemporary = [
      ...temporaryEvents,
    ]
      .filter((event) => {
        const date =
          dateOnly(event?.duty_date);

        const type =
          upper(event?.type);

        return (
          date >= todayDate &&
          ["MOVE", "SWAP", "HALF_DAY"].includes(type)
        );
      })
      .sort((a, b) => {
        const dateComparison =
          dateOnly(a.duty_date).localeCompare(
            dateOnly(b.duty_date)
          );

        if (dateComparison !== 0) {
          return dateComparison;
        }

        return upper(a.type).localeCompare(
          upper(b.type)
        );
      });

    // The original Live Feed already includes
    // some Moves. Avoid showing those twice.

    const temporaryMoveKeys = new Set();

    for (const event of sortedTemporary) {
      if (
        upper(event?.type) === "MOVE" &&
        event?.change_id
      ) {
        temporaryMoveKeys.add(
          eventKey(
            event.duty_date,
            event.change_id
          )
        );
      }
    }

    const seenTemporary = new Set();

    function addTemporaryForDate(date, label) {
      for (const event of sortedTemporary) {
        if (
          dateOnly(event.duty_date) !== date
        ) {
          continue;
        }

        const key = [
          dateOnly(event.duty_date),
          upper(event.type),
          cleanText(event.change_id) ||
            cleanText(event.message),
        ].join("|");

        if (seenTemporary.has(key)) {
          continue;
        }

        seenTemporary.add(key);

        const type = upper(event.type);

        const typeLabel =
          type === "MOVE"
            ? "TEMPORARY MOVE"
            : type === "SWAP"
              ? "TEMPORARY SWAP"
              : "HALF-DAY";

        const description =
          cleanText(event.message);

        if (!description) continue;

        items.push(
          `${label}: ${typeLabel} — ${description}`
        );
      }
    }

    // ==================================================
    // NORMAL OFF DAYS AND RELIEF ASSIGNMENTS
    // ==================================================

    function addRegularEvents(events, label, date) {
      for (const event of events) {
        const action =
          upper(event?.action_type);

        const eventType =
          upper(event?.event_type);

        const isMove =
          action === "MOVE" ||
          action === "SHOP_MOVE" ||
          eventType === "TEMPORARY_DUTY_CHANGE";

        const changeId =
          event?.change_group_id ||
          event?.change_id;

        // The same temporary Move is shown
        // using the more informative new source.

        if (
          isMove &&
          changeId &&
          temporaryMoveKeys.has(
            eventKey(
              event?.duty_date || date,
              changeId
            )
          )
        ) {
          continue;
        }

        const text =
          buildDutyMessage(event, label);

        if (text) {
          items.push(text);
        }
      }
    }

    // ==================================================
    // TODAY
    // ==================================================

    addTemporaryForDate(
      todayDate,
      "TODAY"
    );

    addRegularEvents(
      todayEvents,
      "TODAY",
      todayDate
    );

    // ==================================================
    // TOMORROW
    // ==================================================

    addTemporaryForDate(
      tomorrowDate,
      "TOMORROW"
    );

    addRegularEvents(
      tomorrowEvents,
      "TOMORROW",
      tomorrowDate
    );

    // ==================================================
    // FUTURE TEMPORARY CHANGES
    // DAYS 3–7
    // ==================================================

    const futureDates = [
      ...new Set(
        sortedTemporary
          .map((event) =>
            dateOnly(event.duty_date)
          )
          .filter(
            (date) =>
              date !== todayDate &&
              date !== tomorrowDate
          )
      ),
    ].sort();

    for (const date of futureDates) {
      addTemporaryForDate(
        date,
        futureDateLabel(date)
      );
    }

    // ==================================================
    // SOURCE WARNINGS
    // ==================================================

    for (const warning of partialWarnings) {
      items.push(warning);
    }

    // ==================================================
    // FALLBACK
    // ==================================================

    if (items.length === 0) {
      items.push(
        "No new Team Legend updates at the moment."
      );
    }

    return items;
  }, [
    feed,
    temporaryEvents,
    partialWarnings,
  ]);

  // ==================================================
  // DISPLAY — ORIGINAL THEME PRESERVED
  // ==================================================

  return (
    <>
      <style>{`
        @keyframes teamLegendLiveFeedScroll {
          0% {
            transform: translateX(100vw);
          }

          100% {
            transform: translateX(-100%);
          }
        }

        .team-legend-live-feed-track {
          display: inline-flex;
          align-items: center;
          width: max-content;
          white-space: nowrap;
          animation:
            teamLegendLiveFeedScroll
            120s linear infinite;
          will-change: transform;
        }

        .team-legend-live-feed-track:hover {
          animation-play-state: paused;
        }
      `}</style>

      <section style={panelStyle}>
        <div style={labelStyle}>
          <span style={liveDotStyle} />

          <span>
            LIVE FEED
          </span>
        </div>

        <div style={tickerWindowStyle}>
          {loading ? (
            <div style={staticMessageStyle}>
              Loading live feed...
            </div>
          ) : error ? (
            <div style={staticMessageStyle}>
              Live Feed temporarily unavailable
            </div>
          ) : (
            <div className="team-legend-live-feed-track">
              {tickerItems.map((item, index) => (
                <TickerItem
                  key={`${index}-${item}`}
                  text={item}
                />
              ))}

              {tickerItems.map((item, index) => (
                <TickerItem
                  key={`copy-${index}-${item}`}
                  text={item}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

// ==================================================
// TICKER ITEM
// ==================================================

function TickerItem({ text }) {
  return (
    <div style={tickerItemStyle}>
      <span style={separatorStyle}>
        ◆
      </span>

      <span>
        {text}
      </span>
    </div>
  );
}

// ==================================================
// BUILD REGULAR DUTY MESSAGE
// ==================================================

function buildDutyMessage(event, dayLabel) {
  const source =
    upper(event?.source);

  const eventType =
    upper(event?.event_type);

  const actionType =
    upper(event?.action_type);

  const effectiveStatus =
    upper(event?.effective_status);

  const employeeName =
    cleanText(
      event?.employee_off ||
        event?.employee_name
    );

  const reliefName =
    cleanText(event?.relief_employee);

  const shopName =
    cleanText(event?.shop_name);

  const reason =
    cleanText(event?.reason_text);

  const temporary =
    source === "TEMPORARY_OVERRIDE";

  const isOff =
    effectiveStatus === "OFF_DUTY" ||
    [
      "RELIEF_COVER",
      "EMPLOYEE_OFF",
      "TEMPORARY_OFF",
      "TEMPORARY_OFF_WITH_RELIEF",
    ].includes(eventType);

  const isMove =
    [
      "MOVE",
      "SHOP_MOVE",
    ].includes(actionType) ||
    eventType === "TEMPORARY_DUTY_CHANGE";

  const isSwap =
    actionType === "SWAP" ||
    eventType === "TEMPORARY_SWAP";

  let message = `${dayLabel}: `;

  if (temporary) {
    message += "ADMIN CHANGE — ";
  }

  if (isOff && reliefName) {
    message +=
      `${employeeName || "Employee"} OFF`;

    if (shopName) {
      message += ` at ${shopName}`;
    }

    message +=
      ` • ${reliefName} covering`;

    if (shopName) {
      message += ` ${shopName}`;
    }
  } else if (isOff) {
    message +=
      `${employeeName || "Employee"} OFF`;

    if (shopName) {
      message += ` at ${shopName}`;
    }
  } else if (isSwap) {
    message +=
      `${employeeName || "Employee"} duty swap`;

    if (shopName) {
      message += ` at ${shopName}`;
    }
  } else if (isMove) {
    message +=
      `${employeeName || "Employee"} moved`;

    if (shopName) {
      message += ` to ${shopName}`;
    }
  } else {
    message +=
      `${employeeName || "Employee"} duty update`;

    if (shopName) {
      message += ` at ${shopName}`;
    }
  }

  if (reason) {
    message += ` • ${reason}`;
  }

  return message;
}

// ==================================================
// DATE HELPERS
// ==================================================

function todayNairobi() {
  const parts =
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone: "Africa/Nairobi",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    ).formatToParts(new Date());

  const values = Object.fromEntries(
    parts
      .filter(
        (part) => part.type !== "literal"
      )
      .map((part) => [
        part.type,
        part.value,
      ])
  );

  return (
    `${values.year}-` +
    `${values.month}-` +
    `${values.day}`
  );
}

function dateOnly(value) {
  return String(value || "").slice(0, 10);
}

function addDays(dateString, days) {
  const date = new Date(
    `${dateString}T12:00:00Z`
  );

  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  date.setUTCDate(
    date.getUTCDate() + days
  );

  return date.toISOString().slice(0, 10);
}

function futureDateLabel(dateString) {
  const date = new Date(
    `${dateString}T12:00:00Z`
  );

  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: "UTC",
      weekday: "short",
      day: "2-digit",
      month: "short",
    }
  )
    .format(date)
    .toUpperCase();
}

function eventKey(date, changeId) {
  return (
    `${dateOnly(date)}|` +
    `${cleanText(changeId)}`
  );
}

// ==================================================
// GENERAL HELPERS
// ==================================================

function upper(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function cleanText(value) {
  return String(value ?? "").trim();
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

// ==================================================
// LIVE FEED STYLES — UNCHANGED
// ==================================================

const panelStyle = {
  width: "100%",
  minHeight: "60px",
  boxSizing: "border-box",
  display: "flex",
  alignItems: "stretch",
  backgroundColor: "#111C30",
  borderTop:
    "1px solid rgba(255,255,255,0.12)",
  borderBottom:
    "1px solid rgba(255,255,255,0.12)",
  overflow: "hidden",
  color: "#FFFFFF",
};

const labelStyle = {
  flexShrink: 0,
  minWidth: "135px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  padding: "0 16px",
  backgroundColor: "#111C30",
  color: "#FFFFFF",
  borderRight:
    "1px solid rgba(255,255,255,0.18)",
  fontSize: "13px",
  fontWeight: 900,
  letterSpacing: "0.8px",
  zIndex: 2,
};

const liveDotStyle = {
  width: "9px",
  height: "9px",
  borderRadius: "50%",
  backgroundColor: "#22C55E",
  boxShadow:
    "0 0 9px rgba(34,197,94,0.85)",
  flexShrink: 0,
};

const tickerWindowStyle = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  overflow: "hidden",
  position: "relative",
  backgroundColor: "#111C30",
  color: "#FFFFFF",
};

const tickerItemStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "12px",
  paddingRight: "42px",
  color: "#FFFFFF",
  fontSize: "14px",
  fontWeight: 800,
  letterSpacing: "0.2px",
  whiteSpace: "nowrap",
};

const separatorStyle = {
  color: "#FFFFFF",
  fontSize: "8px",
  opacity: 0.8,
};

const staticMessageStyle = {
  width: "100%",
  padding: "0 18px",
  color: "#FFFFFF",
  fontSize: "14px",
  fontWeight: 700,
  whiteSpace: "nowrap",
};
