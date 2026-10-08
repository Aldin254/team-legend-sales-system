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
    user?.access_token ||
    null;

  const [feed, setFeed] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  // ==================================================
  // AUTH HEADERS
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
            "Cashier session is incomplete. Please log in again."
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
  // LOAD LIVE FEED
  // ==================================================

  const loadFeed =
    useCallback(
      async ({
        silent = false,
      } = {}) => {
        if (
          !accessToken
        ) {
          setFeed(null);
          setLoading(false);

          return;
        }

        try {
          if (
            silent
          ) {
            setRefreshing(
              true
            );
          } else {
            setLoading(
              true
            );
          }

          const result =
            await callRpc(
              "tl_cashier_live_feed_snapshot",
              {}
            );

          setFeed(
            result ||
              null
          );

          setError("");
        } catch (err) {
          console.error(
            "CASHIER LIVE FEED ERROR:",
            err
          );

          if (
            !silent
          ) {
            setError(
              err?.message ||
                "Unable to load Live Feed."
            );
          }
        } finally {
          setLoading(
            false
          );

          setRefreshing(
            false
          );
        }
      },
      [
        accessToken,
        callRpc,
      ]
    );

  // ==================================================
  // INITIAL + LIGHTWEIGHT AUTO REFRESH
  // ==================================================

  useEffect(() => {
    loadFeed();

    const timer =
      setInterval(
        () => {
          loadFeed({
            silent:
              true,
          });
        },
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
  // DATA
  // ==================================================

  const today =
    feed?.today ||
    null;

  const tomorrow =
    feed?.tomorrow ||
    null;

  const announcements =
    useMemo(
      () =>
        Array.isArray(
          feed?.announcements
        )
          ? feed.announcements
          : [],
      [
        feed?.announcements,
      ]
    );

  const todayEvents =
    useMemo(
      () =>
        Array.isArray(
          today?.events
        )
          ? today.events
          : [],
      [
        today?.events,
      ]
    );

  const tomorrowEvents =
    useMemo(
      () =>
        Array.isArray(
          tomorrow?.events
        )
          ? tomorrow.events
          : [],
      [
        tomorrow?.events,
      ]
    );

  // ==================================================
  // DISPLAY
  // ==================================================

  return (
    <section style={panelStyle}>
      <div style={headerStyle}>
        <div>
          <div style={headerTopStyle}>
            <span style={liveDotStyle} />

            <span style={titleStyle}>
              LIVE FEED
            </span>
          </div>

          <div style={subtitleStyle}>
            Shared Team Legend duty updates and Admin announcements
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            loadFeed({
              silent:
                true,
            })
          }
          disabled={
            refreshing
          }
          style={{
            ...refreshButtonStyle,

            opacity:
              refreshing
                ? 0.55
                : 1,

            cursor:
              refreshing
                ? "not-allowed"
                : "pointer",
          }}
        >
          {refreshing
            ? "REFRESHING..."
            : "REFRESH"}
        </button>
      </div>

      {loading ? (
        <div style={loadingStyle}>
          Loading Live Feed...
        </div>
      ) : error ? (
        <div style={errorStyle}>
          {error}
        </div>
      ) : (
        <>
          {announcements.length >
            0 && (
            <div style={announcementSectionStyle}>
              <div style={sectionHeadingStyle}>
                ADMIN ANNOUNCEMENTS
              </div>

              <div style={announcementGridStyle}>
                {announcements.map(
                  (item) => (
                    <AnnouncementCard
                      key={
                        item.id
                      }
                      announcement={
                        item
                      }
                    />
                  )
                )}
              </div>
            </div>
          )}

          <div style={dayGridStyle}>
            <DayCard
              label="TODAY"
              day={
                today
              }
              events={
                todayEvents
              }
            />

            <DayCard
              label="TOMORROW"
              day={
                tomorrow
              }
              events={
                tomorrowEvents
              }
            />
          </div>

          {announcements.length ===
            0 &&
            todayEvents.length ===
              0 &&
            tomorrowEvents.length ===
              0 && (
              <div style={allClearStyle}>
                <div style={allClearTitleStyle}>
                  NO LIVE UPDATES
                </div>

                <div style={allClearTextStyle}>
                  There are no Admin announcements or duty changes currently
                  listed.
                </div>
              </div>
            )}

          <div style={footerStyle}>
            <span>
              Shared feed for all cashiers
            </span>

            <span>
              Updates automatically every 30 seconds
            </span>
          </div>
        </>
      )}
    </section>
  );
}
// ==================================================
// DAY CARD
// ==================================================

function DayCard({
  label,
  day,
  events,
}) {
  const eventCount =
    Array.isArray(
      events
    )
      ? events.length
      : 0;

  return (
    <div style={dayCardStyle}>
      <div style={dayCardHeaderStyle}>
        <div>
          <div style={dayLabelStyle}>
            {label}
          </div>

          <div style={dayNameStyle}>
            {formatDayHeading(
              day
            )}
          </div>
        </div>

        <div style={weekBadgeStyle}>
          WEEK{" "}
          {day?.cycle_week ||
            "-"}
        </div>
      </div>

      <div style={dayMetaStyle}>
        <span>
          {formatDate(
            day?.date
          )}
        </span>

        <span>
          {eventCount}{" "}
          {eventCount === 1
            ? "UPDATE"
            : "UPDATES"}
        </span>
      </div>

      {eventCount ===
      0 ? (
        <div style={emptyDayStyle}>
          <div style={emptyDayTitleStyle}>
            NO ROTA CHANGES
          </div>

          <div style={emptyDayTextStyle}>
            No OFF-day or relief updates listed.
          </div>
        </div>
      ) : (
        <div style={eventListStyle}>
          {events.map(
            (
              event,
              index
            ) => (
              <DutyEventCard
                key={
                  event.override_id ||
                  event.blueprint_id ||
                  `${label}-${index}`
                }
                event={
                  event
                }
              />
            )
          )}
        </div>
      )}
    </div>
  );
}

// ==================================================
// DUTY EVENT
// ==================================================

function DutyEventCard({
  event,
}) {
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

  const reasonCategory =
    formatReason(
      event?.reason_category
    );

  const reasonText =
    cleanText(
      event?.reason_text
    );

  const isTemporary =
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

  const isSwap =
    eventType ===
      "TEMPORARY_SWAP" ||
    actionType ===
      "SWAP";

  const isMove =
    !isOff &&
    (
      eventType ===
        "TEMPORARY_DUTY_CHANGE" ||
      actionType ===
        "MOVE" ||
      actionType ===
        "SHOP_MOVE"
    );

  let heading =
    "DUTY UPDATE";

  let mainText =
    "";

  if (
    isSwap
  ) {
    heading =
      "TEMPORARY DUTY CHANGE";

    mainText =
      `${employeeName || "Employee"} has a temporary duty change${
        shopName
          ? ` at ${shopName}`
          : ""
      }.`;
  } else if (
    isOff &&
    reliefName
  ) {
    heading =
      isTemporary
        ? "TEMPORARY OFF / RELIEF"
        : "OFF DAY / RELIEF";

    mainText =
      `${employeeName || "Employee"} is OFF. ${reliefName} is covering${
        shopName
          ? ` at ${shopName}`
          : ""
      }.`;
  } else if (
    isOff
  ) {
    heading =
      isTemporary
        ? "TEMPORARY OFF"
        : "OFF DAY";

    mainText =
      `${employeeName || "Employee"} is OFF${
        shopName
          ? ` from ${shopName}`
          : ""
      }.`;
  } else if (
    isMove
  ) {
    heading =
      "TEMPORARY SHOP MOVE";

    mainText =
      `${employeeName || "Employee"} is assigned${
        shopName
          ? ` to ${shopName}`
          : " to another duty location"
      }.`;
  } else {
    heading =
      isTemporary
        ? "TEMPORARY DUTY CHANGE"
        : "DUTY UPDATE";

    mainText =
      `${employeeName || "Employee"} has a duty update${
        shopName
          ? ` at ${shopName}`
          : ""
      }.`;
  }

  return (
    <div
      style={{
        ...eventCardStyle,

        ...(isTemporary
          ? temporaryEventStyle
          : {}),
      }}
    >
      <div style={eventTopStyle}>
        <div style={eventHeadingStyle}>
          {heading}
        </div>

        {isTemporary && (
          <span style={temporaryBadgeStyle}>
            ADMIN CHANGE
          </span>
        )}
      </div>

      <div style={eventMainStyle}>
        {mainText}
      </div>

      {(reasonCategory ||
        reasonText) && (
        <div style={reasonStyle}>
          {reasonCategory && (
            <strong>
              {reasonCategory}
            </strong>
          )}

          {reasonCategory &&
            reasonText &&
            ": "}

          {reasonText}
        </div>
      )}
    </div>
  );
}

// ==================================================
// ANNOUNCEMENT CARD
// ==================================================

function AnnouncementCard({
  announcement,
}) {
  const priority =
    String(
      announcement?.priority ||
        "NORMAL"
    )
      .trim()
      .toUpperCase();

  const important =
    priority ===
    "IMPORTANT";

  const pinned =
    Boolean(
      announcement?.is_pinned
    );

  const title =
    cleanText(
      announcement?.title
    );

  const message =
    cleanText(
      announcement?.message
    );

  return (
    <div
      style={{
        ...announcementCardStyle,

        ...(important
          ? importantAnnouncementStyle
          : {}),
      }}
    >
      <div style={announcementTopStyle}>
        <div style={announcementTitleStyle}>
          {pinned && (
            <span style={pinStyle}>
              PINNED
            </span>
          )}

          <span>
            {title ||
              (
                important
                  ? "IMPORTANT ANNOUNCEMENT"
                  : "ADMIN MESSAGE"
              )}
          </span>
        </div>

        {important && (
          <span style={importantBadgeStyle}>
            IMPORTANT
          </span>
        )}
      </div>

      <div style={announcementMessageStyle}>
        {message}
      </div>

      <div style={announcementBottomStyle}>
        <span>
          {formatDateTime(
            announcement?.created_at
          )}
        </span>

        {announcement?.expires_at && (
          <span>
            Expires{" "}
            {formatDateTime(
              announcement.expires_at
            )}
          </span>
        )}
      </div>
    </div>
  );
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

  return (
    text ||
    ""
  );
}

function formatReason(
  value
) {
  const text =
    cleanText(
      value
    );

  if (
    !text
  ) {
    return "";
  }

  return text
    .replace(
      /_/g,
      " "
    )
    .toLowerCase()
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
}

function formatDayHeading(
  day
) {
  const dayName =
    cleanText(
      day?.day_name
    );

  return (
    dayName ||
    "-"
  );
}

function formatDate(
  value
) {
  if (
    !value
  ) {
    return "-";
  }

  try {
    return new Intl.DateTimeFormat(
      "en-KE",
      {
        timeZone:
          "Africa/Nairobi",

        day:
          "2-digit",

        month:
          "short",

        year:
          "numeric",
      }
    ).format(
      new Date(
        `${value}T12:00:00+03:00`
      )
    );
  } catch {
    return String(
      value
    );
  }
}

function formatDateTime(
  value
) {
  if (
    !value
  ) {
    return "-";
  }

  try {
    return new Intl.DateTimeFormat(
      "en-KE",
      {
        timeZone:
          "Africa/Nairobi",

        day:
          "2-digit",

        month:
          "short",

        hour:
          "2-digit",

        minute:
          "2-digit",

        hourCycle:
          "h23",
      }
    ).format(
      new Date(
        value
      )
    );
  } catch {
    return "-";
  }
}
// ==================================================
// PROFESSIONAL MATTE BLACK STYLES
// ==================================================

const panelStyle = {
  width:
    "100%",

  boxSizing:
    "border-box",

  background:
    "linear-gradient(180deg, #11161C 0%, #0B0F13 100%)",

  border:
    "1px solid #303840",

  borderRadius:
    "14px",

  color:
    "#FFFFFF",

  overflow:
    "hidden",

  marginBottom:
    "14px",

  boxShadow:
    "0 10px 28px rgba(0,0,0,0.22)",
};


// ==================================================
// HEADER
// ==================================================

const headerStyle = {
  display:
    "flex",

  justifyContent:
    "space-between",

  alignItems:
    "center",

  gap:
    "12px",

  padding:
    "13px 15px",

  background:
    "linear-gradient(145deg, rgba(215,179,106,0.15), rgba(17,22,28,0.98))",

  borderBottom:
    "1px solid rgba(215,179,106,0.34)",

  borderLeft:
    "4px solid #D7B36A",
};


const headerTopStyle = {
  display:
    "flex",

  alignItems:
    "center",

  gap:
    "7px",
};


const liveDotStyle = {
  width:
    "8px",

  height:
    "8px",

  borderRadius:
    "50%",

  backgroundColor:
    "#42C773",

  boxShadow:
    "0 0 10px rgba(66,199,115,0.55)",

  flexShrink:
    0,
};


const titleStyle = {
  color:
    "#FFFFFF",

  fontSize:
    "15px",

  fontWeight:
    950,

  letterSpacing:
    "0.7px",
};


const subtitleStyle = {
  marginTop:
    "3px",

  color:
    "#AAB2BC",

  fontSize:
    "10px",

  fontWeight:
    650,
};


const refreshButtonStyle = {
  flexShrink:
    0,

  padding:
    "7px 10px",

  backgroundColor:
    "#0D1115",

  color:
    "#FFFFFF",

  border:
    "1px solid rgba(215,179,106,0.45)",

  borderRadius:
    "7px",

  fontSize:
    "8px",

  fontWeight:
    900,
};


// ==================================================
// ADMIN ANNOUNCEMENTS
// ==================================================

const announcementSectionStyle = {
  padding:
    "12px 12px 0",
};


const sectionHeadingStyle = {
  marginBottom:
    "7px",

  color:
    "#AAB2BC",

  fontSize:
    "9px",

  fontWeight:
    900,

  letterSpacing:
    "0.7px",
};


const announcementGridStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "repeat(auto-fit, minmax(280px, 1fr))",

  gap:
    "8px",
};


const announcementCardStyle = {
  padding:
    "10px",

  backgroundColor:
    "#0D1115",

  border:
    "1px solid #343C45",

  borderRadius:
    "8px",
};


const importantAnnouncementStyle = {
  background:
    "linear-gradient(145deg, rgba(215,179,106,0.13), #0D1115)",

  border:
    "1px solid rgba(215,179,106,0.55)",
};


const announcementTopStyle = {
  display:
    "flex",

  justifyContent:
    "space-between",

  alignItems:
    "flex-start",

  gap:
    "8px",
};


const announcementTitleStyle = {
  display:
    "flex",

  alignItems:
    "center",

  flexWrap:
    "wrap",

  gap:
    "6px",

  color:
    "#FFFFFF",

  fontSize:
    "10px",

  fontWeight:
    950,
};


const pinStyle = {
  padding:
    "3px 5px",

  color:
    "#D7B36A",

  border:
    "1px solid rgba(215,179,106,0.45)",

  borderRadius:
    "5px",

  fontSize:
    "7px",

  fontWeight:
    900,
};


const importantBadgeStyle = {
  padding:
    "4px 6px",

  backgroundColor:
    "#2B1D13",

  color:
    "#FFFFFF",

  border:
    "1px solid #7A512D",

  borderRadius:
    "8px",

  fontSize:
    "7px",

  fontWeight:
    900,

  whiteSpace:
    "nowrap",
};


const announcementMessageStyle = {
  marginTop:
    "8px",

  color:
    "#FFFFFF",

  fontSize:
    "10px",

  lineHeight:
    1.5,

  whiteSpace:
    "pre-wrap",

  overflowWrap:
    "anywhere",
};


const announcementBottomStyle = {
  display:
    "flex",

  justifyContent:
    "space-between",

  flexWrap:
    "wrap",

  gap:
    "6px",

  marginTop:
    "9px",

  color:
    "#78828D",

  fontSize:
    "8px",
};


// ==================================================
// TODAY / TOMORROW GRID
// ==================================================

const dayGridStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "repeat(2, minmax(0, 1fr))",

  gap:
    "10px",

  padding:
    "12px",
};


const dayCardStyle = {
  minWidth:
    0,

  backgroundColor:
    "#0D1115",

  border:
    "1px solid #343C45",

  borderRadius:
    "10px",

  padding:
    "10px",
};


const dayCardHeaderStyle = {
  display:
    "flex",

  justifyContent:
    "space-between",

  alignItems:
    "center",

  gap:
    "10px",
};


const dayLabelStyle = {
  color:
    "#D7B36A",

  fontSize:
    "8px",

  fontWeight:
    950,

  letterSpacing:
    "0.8px",
};


const dayNameStyle = {
  marginTop:
    "2px",

  color:
    "#FFFFFF",

  fontSize:
    "14px",

  fontWeight:
    950,
};


const weekBadgeStyle = {
  padding:
    "5px 7px",

  backgroundColor:
    "#151A20",

  color:
    "#FFFFFF",

  border:
    "1px solid rgba(215,179,106,0.35)",

  borderRadius:
    "9px",

  fontSize:
    "8px",

  fontWeight:
    900,

  whiteSpace:
    "nowrap",
};


const dayMetaStyle = {
  display:
    "flex",

  justifyContent:
    "space-between",

  gap:
    "8px",

  padding:
    "7px 0",

  marginBottom:
    "7px",

  borderBottom:
    "1px solid #292F36",

  color:
    "#AAB2BC",

  fontSize:
    "8px",

  fontWeight:
    700,
};


// ==================================================
// DUTY EVENTS
// ==================================================

const eventListStyle = {
  display:
    "grid",

  gap:
    "7px",
};


const eventCardStyle = {
  padding:
    "9px",

  backgroundColor:
    "#080B0E",

  border:
    "1px solid #343C45",

  borderRadius:
    "7px",
};


const temporaryEventStyle = {
  border:
    "1px solid rgba(215,179,106,0.45)",

  background:
    "linear-gradient(145deg, rgba(215,179,106,0.08), #080B0E)",
};


const eventTopStyle = {
  display:
    "flex",

  justifyContent:
    "space-between",

  alignItems:
    "center",

  gap:
    "8px",
};


const eventHeadingStyle = {
  color:
    "#D7B36A",

  fontSize:
    "8px",

  fontWeight:
    950,

  letterSpacing:
    "0.4px",
};


const temporaryBadgeStyle = {
  padding:
    "3px 5px",

  backgroundColor:
    "#221C10",

  color:
    "#FFFFFF",

  border:
    "1px solid #705921",

  borderRadius:
    "6px",

  fontSize:
    "7px",

  fontWeight:
    900,

  whiteSpace:
    "nowrap",
};


const eventMainStyle = {
  marginTop:
    "6px",

  color:
    "#FFFFFF",

  fontSize:
    "10px",

  fontWeight:
    750,

  lineHeight:
    1.45,
};


const reasonStyle = {
  marginTop:
    "6px",

  paddingTop:
    "6px",

  borderTop:
    "1px solid #292F36",

  color:
    "#AAB2BC",

  fontSize:
    "8px",

  lineHeight:
    1.4,
};


// ==================================================
// EMPTY STATES
// ==================================================

const emptyDayStyle = {
  padding:
    "12px",

  textAlign:
    "center",

  backgroundColor:
    "#080B0E",

  border:
    "1px solid #292F36",

  borderRadius:
    "7px",
};


const emptyDayTitleStyle = {
  color:
    "#FFFFFF",

  fontSize:
    "9px",

  fontWeight:
    900,
};


const emptyDayTextStyle = {
  marginTop:
    "4px",

  color:
    "#78828D",

  fontSize:
    "8px",
};


const allClearStyle = {
  margin:
    "0 12px 12px",

  padding:
    "12px",

  textAlign:
    "center",

  backgroundColor:
    "#0D1115",

  border:
    "1px solid #343C45",

  borderRadius:
    "8px",
};


const allClearTitleStyle = {
  color:
    "#FFFFFF",

  fontSize:
    "10px",

  fontWeight:
    950,
};


const allClearTextStyle = {
  marginTop:
    "4px",

  color:
    "#AAB2BC",

  fontSize:
    "9px",
};


// ==================================================
// STATUS
// ==================================================

const loadingStyle = {
  margin:
    "12px",

  padding:
    "16px",

  textAlign:
    "center",

  backgroundColor:
    "#0D1115",

  border:
    "1px solid #343C45",

  borderRadius:
    "8px",

  color:
    "#FFFFFF",

  fontSize:
    "10px",

  fontWeight:
    800,
};


const errorStyle = {
  margin:
    "12px",

  padding:
    "10px",

  backgroundColor:
    "#2C1619",

  border:
    "1px solid #79363C",

  borderRadius:
    "7px",

  color:
    "#FFFFFF",

  fontSize:
    "9px",
};


// ==================================================
// FOOTER
// ==================================================

const footerStyle = {
  display:
    "flex",

  justifyContent:
    "space-between",

  flexWrap:
    "wrap",

  gap:
    "8px",

  padding:
    "8px 12px",

  borderTop:
    "1px solid #292F36",

  backgroundColor:
    "#090C10",

  color:
    "#69737E",

  fontSize:
    "7px",

  fontWeight:
    700,
};
