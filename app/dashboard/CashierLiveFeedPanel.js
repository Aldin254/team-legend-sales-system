"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

// TEAM LEGEND / NYIKA — SHARED CASHIER LIVE FEED
// Time-aware half-day duties and resilient Supabase refresh.
// Existing Rota, Admin announcements and database unchanged.

const REFRESH_MS = 30000;
const CLOCK_REFRESH_MS = 10000;
const FETCH_TIMEOUT_MS = 15000;

// ==================================================
// GENERAL HELPERS
// ==================================================

function cleanText(value) {
  return String(value ?? "").trim();
}

function upper(value) {
  return cleanText(value).toUpperCase();
}

function dateOnly(value) {
  return cleanText(value).slice(0, 10);
}

function nairobiClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const part = (key) =>
    parts.find((p) => p.type === key)?.value || "00";

  return {
    date:
      `${part("year")}-${part("month")}-${part("day")}`,
    minute:
      Number(part("hour")) * 60 +
      Number(part("minute")),
  };
}

function addDays(day, amount) {
  const d = new Date(`${day}T12:00:00Z`);

  if (Number.isNaN(d.getTime())) {
    return day;
  }

  d.setUTCDate(d.getUTCDate() + amount);

  return d.toISOString().slice(0, 10);
}

function dateLabel(day) {
  const d = new Date(`${day}T12:00:00Z`);

  if (Number.isNaN(d.getTime())) {
    return day;
  }

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(d).toUpperCase();
}

function eventKey(day, id) {
  return (
    `${dateOnly(day)}|` +
    `${cleanText(id)}`
  );
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

// ==================================================
// HALF-DAY TIME PARSER
//
// Expected temporary event message:
// Half-day at NYIKA01:
// MELVIN NDUKU 09:00 - 15:00;
// IRENE KATHULE 15:00 - 22:00
//
// No employee's duty time is guessed.
// ==================================================

function parseHalfDay(message) {
  const raw = cleanText(message);

  const header =
    /^(half[\s-]*day\s+at\s+[^:]+:)\s*/i.exec(raw);

  if (!header) {
    return null;
  }

  const segments = raw
    .slice(header[0].length)
    .split(/\s*[;；|\n]\s*/)
    .filter(Boolean);

  if (!segments.length) {
    return null;
  }

  const duties = [];

  for (const segment of segments) {
    const match =
      /^(.+?)\s+([01]?\d|2[0-3]):([0-5]\d)\s*[-–—]\s*([01]?\d|2[0-3]):([0-5]\d)\s*$/
        .exec(segment);

    if (!match) {
      return null;
    }

    const start =
      Number(match[2]) * 60 +
      Number(match[3]);

    const end =
      Number(match[4]) * 60 +
      Number(match[5]);

    if (
      end <= start ||
      !cleanText(match[1])
    ) {
      return null;
    }

    duties.push({
      name: cleanText(match[1]),
      start,
      end,
      startText:
        `${match[2].padStart(2, "0")}:${match[3]}`,
      endText:
        `${match[4].padStart(2, "0")}:${match[5]}`,
    });
  }

  return {
    heading: header[1],
    duties,
  };
}

// ==================================================
// TEMPORARY DUTY MESSAGE
// ==================================================

function temporaryMessage(
  event,
  label,
  eventDate,
  clock
) {
  const type = upper(event?.type);
  const description =
    cleanText(event?.message);

  if (!description) {
    return "";
  }

  const heading =
    type === "MOVE"
      ? "TEMPORARY MOVE"
      : type === "SWAP"
        ? "TEMPORARY SWAP"
        : "HALF-DAY";

  // Future assignments remain visible in full.
  if (
    type !== "HALF_DAY" ||
    eventDate !== clock.date
  ) {
    return (
      `${label}: ${heading} — ${description}`
    );
  }

  const parsed = parseHalfDay(description);

  // Preserve unrecognised event formats.
  // A structured Supabase response would be needed
  // to time-filter any different message format.
  if (!parsed) {
    return (
      `${label}: ${heading} — ${description}`
    );
  }

  const shop = parsed.heading
    .replace(
      /^half[\s-]*day\s+at\s+/i,
      ""
    )
    .replace(/:$/, "");

  const active = parsed.duties.find(
    (d) =>
      clock.minute >= d.start &&
      clock.minute < d.end
  );

  if (active) {
    return (
      `${label}: HALF-DAY AT ${shop} — ` +
      `${active.name} ` +
      `${active.startText} - ${active.endText} ` +
      "(ON DUTY)"
    );
  }

  const next = parsed.duties.find(
    (d) => clock.minute < d.start
  );

  if (next) {
    return (
      `${label}: HALF-DAY AT ${shop} — ` +
      `${next.name} starts at ${next.startText}`
    );
  }

  // All assignments for today have finished.
  return "";
}

// ==================================================
// ORIGINAL REGULAR DUTY MESSAGE
// ==================================================

function buildDutyMessage(event, dayLabel) {
  const source = upper(event?.source);
  const eventType =
    upper(event?.event_type);
  const actionType =
    upper(event?.action_type);
  const effectiveStatus =
    upper(event?.effective_status);

  const employeeName = cleanText(
    event?.employee_off ||
    event?.employee_name
  );

  const reliefName = cleanText(
    event?.relief_employee
  );

  const shopName = cleanText(
    event?.shop_name
  );

  const reason = cleanText(
    event?.reason_text
  );

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
    ["MOVE", "SHOP_MOVE"].includes(actionType) ||
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
// TICKER ITEM
// ==================================================

function TickerItem({ text }) {
  return (
    <div style={tickerItemStyle}>
      <span style={separatorStyle}>◆</span>
      <span>{text}</span>
    </div>
  );
}

// ==================================================
// MAIN LIVE FEED PANEL
// ==================================================

export default function CashierLiveFeedPanel({
  user,
}) {
  const supabaseUrl = String(
    process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  ).replace(/\/+$/, "");

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  const accessToken =
    user?.access_token || "";

  const [feed, setFeed] = useState(null);

  const [
    temporaryEvents,
    setTemporaryEvents,
  ] = useState([]);

  const [loading, setLoading] =
    useState(true);

  const [hasLoaded, setHasLoaded] =
    useState(false);

  const [
    connectionProblem,
    setConnectionProblem,
  ] = useState("");

  const [clockTime, setClockTime] =
    useState(() => new Date());

  const inFlight = useRef(false);

  // ==================================================
  // SUPABASE RPC
  // ==================================================

  const callRpc = useCallback(
    async (name, signal) => {
      if (
        !supabaseUrl ||
        !supabaseAnonKey ||
        !accessToken
      ) {
        throw new Error(
          "Cashier session or Supabase connection is missing."
        );
      }

      const response = await fetch(
        `${supabaseUrl}/rest/v1/rpc/${name}`,
        {
          method: "POST",
          headers: {
            apikey: supabaseAnonKey,
            Authorization:
              `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
          cache: "no-store",
          signal,
        }
      );

      const value = await safeJson(response);

      if (!response.ok) {
        throw new Error(
          value?.message ||
          value?.details ||
          `${name} failed (HTTP ${response.status}).`
        );
      }

      if (value?.success !== true) {
        throw new Error(
          `${name} returned an unsuccessful response.`
        );
      }

      return value;
    },
    [
      supabaseUrl,
      supabaseAnonKey,
      accessToken,
    ]
  );

  // ==================================================
  // TIME-AWARE REFRESH
  //
  // Update the Nairobi clock independently of fetch.
  // Half-Day transitions do not need a database call.
  // ==================================================

  useEffect(() => {
    const interval = setInterval(
      () => setClockTime(new Date()),
      CLOCK_REFRESH_MS
    );

    return () => {
      clearInterval(interval);
    };
  }, []);

  // ==================================================
  // LOAD LIVE FEED — RESILIENT NETWORK HANDLING
  // ==================================================

  useEffect(() => {
    let cancelled = false;
    let activeController = null;

    if (
      !supabaseUrl ||
      !supabaseAnonKey ||
      !accessToken
    ) {
      setFeed(null);
      setTemporaryEvents([]);
      setConnectionProblem(
        "Cashier login or Supabase configuration is missing."
      );
      setHasLoaded(false);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    setConnectionProblem("");
    inFlight.current = false;

    async function loadFeed() {
      if (
        cancelled ||
        inFlight.current
      ) {
        return;
      }

      // Reduce unnecessary requests from background tabs.
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      ) {
        return;
      }

      inFlight.current = true;

      const controller =
        new AbortController();

      activeController = controller;

      const timeout = setTimeout(
        () => controller.abort(),
        FETCH_TIMEOUT_MS
      );

      try {
        const [
          regular,
          temporary,
        ] = await Promise.allSettled([
          callRpc(
            "tl_cashier_live_feed_snapshot",
            controller.signal
          ),
          callRpc(
            "tl_cashier_live_feed_temporary",
            controller.signal
          ),
        ]);

        if (cancelled) {
          return;
        }

        const goodRegular =
          regular.status === "fulfilled";

        const goodTemporary =
          temporary.status === "fulfilled" &&
          Array.isArray(
            temporary.value?.events
          );

        // Only replace data when that source succeeded.
        // A failed source keeps its previously loaded data.

        if (goodRegular) {
          setFeed(regular.value);
        }

        if (goodTemporary) {
          setTemporaryEvents(
            temporary.value.events
          );
        }

        if (
          goodRegular ||
          goodTemporary
        ) {
          setHasLoaded(true);
        }

        if (
          goodRegular &&
          goodTemporary
        ) {
          setConnectionProblem("");
        } else {
          const failed = [
            !goodRegular ? "regular" : null,
            !goodTemporary ? "temporary" : null,
          ]
            .filter(Boolean)
            .join(" and ");

          const reason =
            !goodRegular &&
            regular.status === "rejected"
              ? regular.reason?.message
              : !goodTemporary &&
                temporary.status === "rejected"
                ? temporary.reason?.message
                : "Unexpected response";

          console.warn(
            `Live Feed ${failed} request failed; preserving previous data.`,
            reason
          );

          setConnectionProblem(
            `${failed} Live Feed source unavailable. Retrying automatically.`
          );
        }
      } catch (err) {
        if (!cancelled) {
          console.warn(
            "Live Feed temporarily unavailable:",
            err
          );

          setConnectionProblem(
            "Live Feed connection interrupted. Retrying automatically."
          );
        }
      } finally {
        clearTimeout(timeout);

        if (
          activeController === controller
        ) {
          activeController = null;
        }

        inFlight.current = false;

        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadFeed();

    const interval = setInterval(
      () => void loadFeed(),
      REFRESH_MS
    );

    const onVisible = () => {
      if (
        document.visibilityState === "visible"
      ) {
        void loadFeed();
      }
    };

    document.addEventListener(
      "visibilitychange",
      onVisible
    );

    return () => {
      cancelled = true;
      clearInterval(interval);

      document.removeEventListener(
        "visibilitychange",
        onVisible
      );

      activeController?.abort();
    };
  }, [
    callRpc,
    supabaseUrl,
    supabaseAnonKey,
    accessToken,
  ]);

  // ==================================================
  // CURRENT NAIROBI DATE AND TIME
  // ==================================================

  const clock = useMemo(
    () => nairobiClock(clockTime),
    [clockTime]
  );

  // ==================================================
  // BUILD SHARED MOVING FEED
  // ==================================================

  const tickerItems = useMemo(() => {
    const items = [];

    const todayDate = clock.date;
    const tomorrowDate =
      addDays(todayDate, 1);

    const lastDate =
      addDays(todayDate, 6);

    // ==================================================
    // ADMIN ANNOUNCEMENTS
    // ==================================================

    const announcements = Array.isArray(
      feed?.announcements
    )
      ? feed.announcements
      : [];

    for (const announcement of announcements) {
      const title =
        cleanText(announcement?.title);

      const message =
        cleanText(announcement?.message);

      let text = "";

      if (
        upper(announcement?.priority) ===
        "IMPORTANT"
      ) {
        text += "IMPORTANT: ";
      }

      if (
        announcement?.is_pinned === true
      ) {
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
    // TEMPORARY DUTY EVENTS
    // ==================================================

    const sortedTemporary = [
      ...temporaryEvents,
    ]
      .filter((event) => {
        const date =
          dateOnly(event?.duty_date);

        return (
          date >= todayDate &&
          date <= lastDate &&
          ["MOVE", "SWAP", "HALF_DAY"].includes(
            upper(event?.type)
          )
        );
      })
      .sort((a, b) => {
        const dateComparison =
          dateOnly(a.duty_date)
            .localeCompare(
              dateOnly(b.duty_date)
            );

        if (dateComparison !== 0) {
          return dateComparison;
        }

        return upper(a.type)
          .localeCompare(
            upper(b.type)
          );
      });

    // Prevent duplicate temporary Moves.

    const temporaryMoveKeys = new Set(
      sortedTemporary
        .filter(
          (event) =>
            upper(event?.type) === "MOVE" &&
            event?.change_id
        )
        .map(
          (event) =>
            eventKey(
              event.duty_date,
              event.change_id
            )
        )
    );

    const seenTemporary = new Set();

    function addTemporaryForDate(
      date,
      label
    ) {
      for (const event of sortedTemporary) {
        if (
          dateOnly(event.duty_date) !== date
        ) {
          continue;
        }

        const key = [
          date,
          upper(event.type),
          cleanText(event.change_id) ||
            cleanText(event.message),
        ].join("|");

        if (seenTemporary.has(key)) {
          continue;
        }

        seenTemporary.add(key);

        const message =
          temporaryMessage(
            event,
            label,
            date,
            clock
          );

        if (message) {
          items.push(message);
        }
      }
    }

    // ==================================================
    // REGULAR OFF DAYS / RELIEF / MOVES / SWAPS
    // ==================================================

    function addRegular(
      events,
      label,
      date
    ) {
      for (const event of events) {
        const action =
          upper(event?.action_type);

        const eventType =
          upper(event?.event_type);

        const isMove =
          [
            "MOVE",
            "SHOP_MOVE",
          ].includes(action) ||
          eventType ===
            "TEMPORARY_DUTY_CHANGE";

        const changeId =
          event?.change_group_id ||
          event?.change_id;

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
          buildDutyMessage(
            event,
            label
          );

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

    // Do not display stale yesterday events
    // after midnight if Supabase is unavailable.

    if (
      !feed?.today?.date ||
      dateOnly(feed.today.date) === todayDate
    ) {
      addRegular(
        Array.isArray(feed?.today?.events)
          ? feed.today.events
          : [],
        "TODAY",
        todayDate
      );
    }

    // ==================================================
    // TOMORROW
    // ==================================================

    addTemporaryForDate(
      tomorrowDate,
      "TOMORROW"
    );

    if (
      !feed?.tomorrow?.date ||
      dateOnly(feed.tomorrow.date) ===
        tomorrowDate
    ) {
      addRegular(
        Array.isArray(feed?.tomorrow?.events)
          ? feed.tomorrow.events
          : [],
        "TOMORROW",
        tomorrowDate
      );
    }

    // ==================================================
    // FUTURE TEMPORARY EVENTS — DAYS 3–7
    // ==================================================

    const futureDates = [
      ...new Set(
        sortedTemporary.map(
          (event) =>
            dateOnly(event.duty_date)
        )
      ),
    ]
      .filter(
        (date) =>
          date > tomorrowDate
      )
      .sort();

    for (const date of futureDates) {
      addTemporaryForDate(
        date,
        dateLabel(date)
      );
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
    clock,
    feed,
    temporaryEvents,
  ]);

  // ==================================================
  // DISPLAY — SAME NAVY THEME
  // ==================================================

  const showTicker =
    hasLoaded ||
    Boolean(feed) ||
    temporaryEvents.length > 0;

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
            120s
            linear
            infinite;

          will-change: transform;
        }

        .team-legend-live-feed-track:hover {
          animation-play-state: paused;
        }
      `}</style>

      <section style={panelStyle}>
        <div style={labelStyle}>
          <span
            style={{
              ...liveDotStyle,

              backgroundColor:
                connectionProblem
                  ? "#f59e0b"
                  : "#22C55E",

              boxShadow:
                connectionProblem
                  ? "0 0 9px rgba(245,158,11,.65)"
                  : liveDotStyle.boxShadow,
            }}
          />

          <span>LIVE FEED</span>

          {connectionProblem &&
            showTicker && (
              <span
                style={retryLabelStyle}
                title={connectionProblem}
              >
                RETRYING
              </span>
            )}
        </div>

        <div
          style={tickerWindowStyle}
          aria-live="off"
        >
          {loading && !showTicker ? (
            <div style={staticMessageStyle}>
              Loading live feed...
            </div>
          ) : !showTicker ? (
            <div
              style={staticMessageStyle}
              role="status"
            >
              Live Feed temporarily unavailable —
              reconnecting
            </div>
          ) : (
            <div className="team-legend-live-feed-track">
              {tickerItems.map(
                (item, index) => (
                  <TickerItem
                    key={`${index}-${item}`}
                    text={item}
                  />
                )
              )}

              {tickerItems.map(
                (item, index) => (
                  <TickerItem
                    key={`copy-${index}-${item}`}
                    text={item}
                  />
                )
              )}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

// ==================================================
// ORIGINAL NAVY LIVE FEED STYLES
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

const retryLabelStyle = {
  color: "#fbbf24",
  fontSize: "9px",
  fontWeight: 900,
  letterSpacing: ".2px",
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
