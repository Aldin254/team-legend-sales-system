"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

const REFRESH_MS = 30000;

export default function CashierLiveFeedPanel({
  user,
}) {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const accessToken =
    user?.access_token || null;

  const [feed, setFeed] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  // ==================================================
  // AUTH
  // ==================================================

  const authHeaders =
    useCallback(
      () => ({
        apikey:
          supabaseAnonKey,

        Authorization:
          `Bearer ${accessToken}`,

        "Content-Type":
          "application/json",
      }),
      [
        supabaseAnonKey,
        accessToken,
      ]
    );

  // ==================================================
  // RPC
  // ==================================================

  const callRpc =
    useCallback(
      async (
        functionName,
        body = {}
      ) => {
        if (
          !supabaseUrl ||
          !supabaseAnonKey ||
          !accessToken
        ) {
          throw new Error(
            "Cashier session is incomplete."
          );
        }

        const response =
          await fetch(
            `${supabaseUrl}/rest/v1/rpc/${functionName}`,
            {
              method:
                "POST",

              headers:
                authHeaders(),

              body:
                JSON.stringify(
                  body
                ),

              cache:
                "no-store",
            }
          );

        const result =
          await safeJson(
            response
          );

        if (
          !response.ok
        ) {
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
  // LOAD FEED
  // ==================================================

  const loadFeed =
    useCallback(
      async () => {
        if (
          !accessToken
        ) {
          setFeed(null);
          setLoading(false);

          return;
        }

        try {
          const result =
            await callRpc(
              "tl_cashier_live_feed_snapshot",
              {}
            );

          setFeed(
            result || null
          );

          setError("");
        } catch (err) {
          console.error(
            "LIVE FEED ERROR:",
            err
          );

          setError(
            err?.message ||
              "Unable to load Live Feed."
          );
        } finally {
          setLoading(false);
        }
      },
      [
        accessToken,
        callRpc,
      ]
    );

  // ==================================================
  // INITIAL + AUTO REFRESH
  // ==================================================

  useEffect(() => {
    loadFeed();

    const timer =
      setInterval(
        loadFeed,
        REFRESH_MS
      );

    return () => {
      clearInterval(
        timer
      );
    };
  }, [
    loadFeed,
  ]);

  // ==================================================
  // BUILD MOVING FEED
  // ==================================================

  const tickerItems =
    useMemo(() => {
      const items = [];

      const today =
        feed?.today;

      const tomorrow =
        feed?.tomorrow;

      const announcements =
        Array.isArray(
          feed?.announcements
        )
          ? feed.announcements
          : [];

      const todayEvents =
        Array.isArray(
          today?.events
        )
          ? today.events
          : [];

      const tomorrowEvents =
        Array.isArray(
          tomorrow?.events
        )
          ? tomorrow.events
          : [];

      // ==============================================
      // ADMIN ANNOUNCEMENTS FIRST
      // ==============================================

      for (
        const announcement of
        announcements
      ) {
        const title =
          cleanText(
            announcement?.title
          );

        const message =
          cleanText(
            announcement?.message
          );

        const important =
          String(
            announcement?.priority ||
              ""
          )
            .trim()
            .toUpperCase() ===
          "IMPORTANT";

        const pinned =
          Boolean(
            announcement?.is_pinned
          );

        let text = "";

        if (
          important
        ) {
          text +=
            "IMPORTANT: ";
        }

        if (
          pinned
        ) {
          text +=
            "PINNED: ";
        }

        if (
          title
        ) {
          text +=
            `${title} — `;
        }

        text +=
          message;

        if (
          text.trim()
        ) {
          items.push(
            text.trim()
          );
        }
      }

      // ==============================================
      // TODAY
      // ==============================================

      for (
        const event of
        todayEvents
      ) {
        const text =
          buildDutyMessage(
            event,
            "TODAY"
          );

        if (
          text
        ) {
          items.push(
            text
          );
        }
      }

      // ==============================================
      // TOMORROW
      // ==============================================

      for (
        const event of
        tomorrowEvents
      ) {
        const text =
          buildDutyMessage(
            event,
            "TOMORROW"
          );

        if (
          text
        ) {
          items.push(
            text
          );
        }
      }

      // ==============================================
      // FALLBACK
      // ==============================================

      if (
        items.length === 0
      ) {
        items.push(
          "No new Team Legend updates at the moment."
        );
      }

      return items;
    }, [
      feed,
    ]
  );

  // ==================================================
  // DISPLAY
  // ==================================================

  return (
    <>
      <style>
        {`
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
              50.7s
              linear
              infinite;
            will-change: transform;
          }

          .team-legend-live-feed-track:hover {
            animation-play-state: paused;
          }
        `}
      </style>

      <section
        style={
          panelStyle
        }
      >
        <div
          style={
            labelStyle
          }
        >
          <span
            style={
              liveDotStyle
            }
          />

          <span>
            LIVE FEED
          </span>
        </div>

        <div
          style={
            tickerWindowStyle
          }
        >
          {loading ? (
            <div
              style={
                staticMessageStyle
              }
            >
              Loading live feed...
            </div>
          ) : error ? (
            <div
              style={
                staticMessageStyle
              }
            >
              Live Feed temporarily unavailable
            </div>
          ) : (
            <div
              className="team-legend-live-feed-track"
            >
              {tickerItems.map(
                (
                  item,
                  index
                ) => (
                  <TickerItem
                    key={
                      `${index}-${item}`
                    }
                    text={
                      item
                    }
                  />
                )
              )}

              {tickerItems.map(
                (
                  item,
                  index
                ) => (
                  <TickerItem
                    key={
                      `copy-${index}-${item}`
                    }
                    text={
                      item
                    }
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
// TICKER ITEM
// ==================================================

function TickerItem({
  text,
}) {
  return (
    <div
      style={
        tickerItemStyle
      }
    >
      <span
        style={
          separatorStyle
        }
      >
        ◆
      </span>

      <span>
        {text}
      </span>
    </div>
  );
}

// ==================================================
// BUILD DUTY MESSAGE
// ==================================================

function buildDutyMessage(
  event,
  dayLabel
) {
  const source =
    String(
      event?.source ||
        ""
    )
      .trim()
      .toUpperCase();

  const eventType =
    String(
      event?.event_type ||
        ""
    )
      .trim()
      .toUpperCase();

  const actionType =
    String(
      event?.action_type ||
        ""
    )
      .trim()
      .toUpperCase();

  const effectiveStatus =
    String(
      event?.effective_status ||
        ""
    )
      .trim()
      .toUpperCase();

  const employeeName =
    cleanText(
      event?.employee_off ||
        event?.employee_name
    );

  const reliefName =
    cleanText(
      event?.relief_employee
    );

  const shopName =
    cleanText(
      event?.shop_name
    );

  const reason =
    cleanText(
      event?.reason_text
    );

  const temporary =
    source ===
    "TEMPORARY_OVERRIDE";

  const isOff =
    effectiveStatus ===
      "OFF_DUTY" ||
    eventType ===
      "RELIEF_COVER" ||
    eventType ===
      "EMPLOYEE_OFF" ||
    eventType ===
      "TEMPORARY_OFF" ||
    eventType ===
      "TEMPORARY_OFF_WITH_RELIEF";

  const isMove =
    actionType ===
      "MOVE" ||
    actionType ===
      "SHOP_MOVE" ||
    eventType ===
      "TEMPORARY_DUTY_CHANGE";

  const isSwap =
    actionType ===
      "SWAP" ||
    eventType ===
      "TEMPORARY_SWAP";

  let message =
    `${dayLabel}: `;

  if (
    temporary
  ) {
    message +=
      "ADMIN CHANGE — ";
  }

  if (
    isOff &&
    reliefName
  ) {
    message +=
      `${employeeName || "Employee"} OFF`;

    if (
      shopName
    ) {
      message +=
        ` at ${shopName}`;
    }

    message +=
      ` • ${reliefName} covering`;

    if (
      shopName
    ) {
      message +=
        ` ${shopName}`;
    }
  } else if (
    isOff
  ) {
    message +=
      `${employeeName || "Employee"} OFF`;

    if (
      shopName
    ) {
      message +=
        ` at ${shopName}`;
    }
  } else if (
    isSwap
  ) {
    message +=
      `${employeeName || "Employee"} duty swap`;

    if (
      shopName
    ) {
      message +=
        ` at ${shopName}`;
    }
  } else if (
    isMove
  ) {
    message +=
      `${employeeName || "Employee"} moved`;

    if (
      shopName
    ) {
      message +=
        ` to ${shopName}`;
    }
  } else {
    message +=
      `${employeeName || "Employee"} duty update`;

    if (
      shopName
    ) {
      message +=
        ` at ${shopName}`;
    }
  }

  if (
    reason
  ) {
    message +=
      ` • ${reason}`;
  }

  return message;
}

// ==================================================
// HELPERS
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

function cleanText(
  value
) {
  const text =
    String(
      value ??
        ""
    ).trim();

  return text;
}

// ==================================================
// LIVE FEED STYLES
// ==================================================

const panelStyle = {
  width:
    "100%",

  minHeight:
    "60px",

  boxSizing:
    "border-box",

  display:
    "flex",

  alignItems:
    "stretch",

  backgroundColor:
    "#111C30",

  borderTop:
    "1px solid rgba(255,255,255,0.12)",

  borderBottom:
    "1px solid rgba(255,255,255,0.12)",

  overflow:
    "hidden",

  color:
    "#FFFFFF",
};

const labelStyle = {
  flexShrink:
    0,

  minWidth:
    "135px",

  display:
    "flex",

  alignItems:
    "center",

  justifyContent:
    "center",

  gap:
    "8px",

  padding:
    "0 16px",

  backgroundColor:
    "#111C30",

  color:
    "#FFFFFF",

  borderRight:
    "1px solid rgba(255,255,255,0.18)",

  fontSize:
    "13px",

  fontWeight:
    900,

  letterSpacing:
    "0.8px",

  zIndex:
    2,
};

const liveDotStyle = {
  width:
    "9px",

  height:
    "9px",

  borderRadius:
    "50%",

  backgroundColor:
    "#22C55E",

  boxShadow:
    "0 0 9px rgba(34,197,94,0.85)",

  flexShrink:
    0,
};

const tickerWindowStyle = {
  flex:
    1,

  minWidth:
    0,

  display:
    "flex",

  alignItems:
    "center",

  overflow:
    "hidden",

  position:
    "relative",

  backgroundColor:
    "#111C30",

  color:
    "#FFFFFF",
};

const tickerItemStyle = {
  display:
    "inline-flex",

  alignItems:
    "center",

  gap:
    "12px",

  paddingRight:
    "42px",

  color:
    "#FFFFFF",

  fontSize:
    "14px",

  fontWeight:
    800,

  letterSpacing:
    "0.2px",

  whiteSpace:
    "nowrap",
};

const separatorStyle = {
  color:
    "#FFFFFF",

  fontSize:
    "8px",

  opacity:
    0.8,
};

const staticMessageStyle = {
  width:
    "100%",

  padding:
    "0 18px",

  color:
    "#FFFFFF",

  fontSize:
    "14px",

  fontWeight:
    700,

  whiteSpace:
    "nowrap",
};
