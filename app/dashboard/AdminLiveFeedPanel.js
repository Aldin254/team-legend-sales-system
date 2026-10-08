"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

const REFRESH_MS = 15000;

export default function AdminLiveFeedPanel({
  user,
}) {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const accessToken =
    user?.access_token ||
    null;

  const [title, setTitle] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [priority, setPriority] =
    useState("NORMAL");

  const [isPinned, setIsPinned] =
    useState(false);

  const [expiresAt, setExpiresAt] =
    useState("");

  const [editingId, setEditingId] =
    useState(null);

  const [editingStartsAt, setEditingStartsAt] =
    useState(null);

  const [announcements, setAnnouncements] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [busyId, setBusyId] =
    useState(null);

  const [statusMessage, setStatusMessage] =
    useState("");

  const [statusType, setStatusType] =
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
            "Admin session is incomplete. Please log in again."
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
  // LOAD ANNOUNCEMENTS
  // ==================================================

  const loadAnnouncements =
    useCallback(
      async ({
        silent = false,
      } = {}) => {
        if (
          !accessToken
        ) {
          setAnnouncements([]);
          setLoading(false);

          return;
        }

        try {
          if (
            !silent
          ) {
            setLoading(true);
          }

          const result =
            await callRpc(
              "tl_admin_live_feed_announcements_snapshot",
              {}
            );

          setAnnouncements(
            Array.isArray(result)
              ? result
              : []
          );
        } catch (error) {
          console.error(
            "ADMIN LIVE FEED LOAD ERROR:",
            error
          );

          if (
            !silent
          ) {
            setStatusMessage(
              error?.message ||
                "Unable to load Live Feed announcements."
            );

            setStatusType(
              "error"
            );
          }
        } finally {
          if (
            !silent
          ) {
            setLoading(false);
          }
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
    loadAnnouncements();

    const timer =
      setInterval(
        () => {
          loadAnnouncements({
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
    loadAnnouncements,
  ]);

  // ==================================================
  // RESET FORM
  // ==================================================

  function resetForm() {
    setTitle("");
    setMessage("");
    setPriority(
      "NORMAL"
    );
    setIsPinned(
      false
    );
    setExpiresAt("");
    setEditingId(
      null
    );
    setEditingStartsAt(
      null
    );
  }

  // ==================================================
  // SAVE / UPDATE
  // ==================================================

  async function saveAnnouncement() {
    const cleanTitle =
      String(
        title || ""
      ).trim();

    const cleanMessage =
      String(
        message || ""
      ).trim();

    if (
      cleanMessage ===
      ""
    ) {
      setStatusMessage(
        "Enter the announcement message."
      );

      setStatusType(
        "error"
      );

      return;
    }

    if (
      cleanTitle.length >
      120
    ) {
      setStatusMessage(
        "Title cannot exceed 120 characters."
      );

      setStatusType(
        "error"
      );

      return;
    }

    if (
      cleanMessage.length >
      1000
    ) {
      setStatusMessage(
        "Message cannot exceed 1000 characters."
      );

      setStatusType(
        "error"
      );

      return;
    }

    let expiryIso =
      null;

    if (
      expiresAt
    ) {
      const expiryDate =
        new Date(
          expiresAt
        );

      if (
        Number.isNaN(
          expiryDate.getTime()
        )
      ) {
        setStatusMessage(
          "Expiry date/time is invalid."
        );

        setStatusType(
          "error"
        );

        return;
      }

      expiryIso =
        expiryDate.toISOString();
    }

    try {
      setSaving(
        true
      );

      setStatusMessage("");
      setStatusType("");

      if (
        editingId
      ) {
        await callRpc(
          "tl_admin_live_feed_update_announcement",
          {
            p_announcement_id:
              editingId,

            p_title:
              cleanTitle ||
              null,

            p_message:
              cleanMessage,

            p_priority:
              priority,

            p_is_pinned:
              isPinned,

            p_starts_at:
              editingStartsAt ||
              new Date()
                .toISOString(),

            p_expires_at:
              expiryIso,
          }
        );

        setStatusMessage(
          "Live Feed announcement updated."
        );
      } else {
        await callRpc(
          "tl_admin_live_feed_create_announcement",
          {
            p_title:
              cleanTitle ||
              null,

            p_message:
              cleanMessage,

            p_priority:
              priority,

            p_is_pinned:
              isPinned,

            p_starts_at:
              null,

            p_expires_at:
              expiryIso,
          }
        );

        setStatusMessage(
          "Announcement published to the shared Live Feed."
        );
      }

      setStatusType(
        "success"
      );

      resetForm();

      await loadAnnouncements({
        silent:
          true,
      });
    } catch (error) {
      console.error(
        "SAVE LIVE FEED ANNOUNCEMENT ERROR:",
        error
      );

      setStatusMessage(
        error?.message ||
          "Unable to save announcement."
      );

      setStatusType(
        "error"
      );
    } finally {
      setSaving(
        false
      );
    }
  }

  // ==================================================
  // EDIT
  // ==================================================

  function beginEdit(
    item
  ) {
    setEditingId(
      item.id
    );

    setEditingStartsAt(
      item.starts_at ||
        null
    );

    setTitle(
      item.title ||
        ""
    );

    setMessage(
      item.message ||
        ""
    );

    setPriority(
      String(
        item.priority ||
          "NORMAL"
      )
        .trim()
        .toUpperCase()
    );

    setIsPinned(
      Boolean(
        item.is_pinned
      )
    );

    setExpiresAt(
      toLocalDateTimeInput(
        item.expires_at
      )
    );

    setStatusMessage("");
    setStatusType("");

    if (
      typeof window !==
      "undefined"
    ) {
      window.scrollTo({
        top:
          0,
        behavior:
          "smooth",
      });
    }
  }

  // ==================================================
  // ACTIVE / INACTIVE
  // ==================================================

  async function setAnnouncementActive(
    item,
    nextActive
  ) {
    if (
      !item?.id ||
      busyId
    ) {
      return;
    }

    try {
      setBusyId(
        item.id
      );

      setStatusMessage("");
      setStatusType("");

      await callRpc(
        "tl_admin_live_feed_set_active",
        {
          p_announcement_id:
            item.id,

          p_is_active:
            nextActive,
        }
      );

      setStatusMessage(
        nextActive
          ? "Announcement reactivated."
          : "Announcement removed from the cashier Live Feed."
      );

      setStatusType(
        "success"
      );

      if (
        editingId ===
        item.id &&
        !nextActive
      ) {
        resetForm();
      }

      await loadAnnouncements({
        silent:
          true,
      });
    } catch (error) {
      console.error(
        "LIVE FEED STATUS ERROR:",
        error
      );

      setStatusMessage(
        error?.message ||
          "Unable to change announcement status."
      );

      setStatusType(
        "error"
      );
    } finally {
      setBusyId(
        null
      );
    }
  }
  // ==================================================
  // DISPLAY
  // ==================================================

  return (
    <section
      style={
        panelStyle
      }
    >
      <div
        style={
          panelHeaderStyle
        }
      >
        <div>
          <div
            style={
              panelTitleStyle
            }
          >
            LIVE FEED CONTROL
          </div>

          <div
            style={
              panelSubtitleStyle
            }
          >
            Messages published here appear in the shared cashier ticker.
          </div>
        </div>

        <div
          style={
            liveBadgeStyle
          }
        >
          ● SHARED LIVE FEED
        </div>
      </div>

      <div
        style={
          formGridStyle
        }
      >
        <div
          style={
            formCardStyle
          }
        >
          <div
            style={
              formHeadingStyle
            }
          >
            {editingId
              ? "EDIT ANNOUNCEMENT"
              : "NEW ANNOUNCEMENT"}
          </div>

          <label
            style={
              labelStyle
            }
          >
            Title — Optional
          </label>

          <input
            type="text"
            maxLength={
              120
            }
            value={
              title
            }
            onChange={(
              event
            ) =>
              setTitle(
                event
                  .target
                  .value
              )
            }
            placeholder="e.g. Weekly Banking"
            style={
              inputStyle
            }
          />

          <label
            style={
              labelStyle
            }
          >
            Message
          </label>

          <textarea
            maxLength={
              1000
            }
            value={
              message
            }
            onChange={(
              event
            ) =>
              setMessage(
                event
                  .target
                  .value
              )
            }
            placeholder="Type the message all cashiers should see..."
            rows={
              4
            }
            style={
              textareaStyle
            }
          />

          <div
            style={
              counterStyle
            }
          >
            {message.length}/1000
          </div>

          <div
            style={
              optionsGridStyle
            }
          >
            <div>
              <label
                style={
                  labelStyle
                }
              >
                Priority
              </label>

              <select
                value={
                  priority
                }
                onChange={(
                  event
                ) =>
                  setPriority(
                    event
                      .target
                      .value
                  )
                }
                style={
                  inputStyle
                }
              >
                <option
                  value="NORMAL"
                >
                  NORMAL
                </option>

                <option
                  value="IMPORTANT"
                >
                  IMPORTANT
                </option>
              </select>
            </div>

            <div>
              <label
                style={
                  labelStyle
                }
              >
                Expiry — Optional
              </label>

              <input
                type="datetime-local"
                value={
                  expiresAt
                }
                onChange={(
                  event
                ) =>
                  setExpiresAt(
                    event
                      .target
                      .value
                  )
                }
                style={
                  inputStyle
                }
              />
            </div>
          </div>

          <label
            style={
              checkboxRowStyle
            }
          >
            <input
              type="checkbox"
              checked={
                isPinned
              }
              onChange={(
                event
              ) =>
                setIsPinned(
                  event
                    .target
                    .checked
                )
              }
            />

            <span>
              PIN THIS MESSAGE
            </span>
          </label>

          <div
            style={
              hintStyle
            }
          >
            Pinned or Important announcements appear before normal rota
            messages in the cashier ticker.
          </div>

          {statusMessage && (
            <div
              style={
                statusType ===
                "success"
                  ? successStyle
                  : errorStyle
              }
            >
              {statusMessage}
            </div>
          )}

          <div
            style={
              actionRowStyle
            }
          >
            <button
              type="button"
              onClick={
                saveAnnouncement
              }
              disabled={
                saving
              }
              style={{
                ...publishButtonStyle,

                opacity:
                  saving
                    ? 0.55
                    : 1,

                cursor:
                  saving
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {saving
                ? "SAVING..."
                : editingId
                ? "UPDATE MESSAGE"
                : "PUBLISH TO LIVE FEED"}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={
                  resetForm
                }
                disabled={
                  saving
                }
                style={
                  cancelButtonStyle
                }
              >
                CANCEL EDIT
              </button>
            )}
          </div>
        </div>

        <div
          style={
            previewCardStyle
          }
        >
          <div
            style={
              formHeadingStyle
            }
          >
            TICKER PREVIEW
          </div>

          <div
            style={
              tickerPreviewStyle
            }
          >
            <span>
              ● LIVE FEED
            </span>

            <div
              style={
                previewMessageStyle
              }
            >
              {priority ===
                "IMPORTANT" &&
                "IMPORTANT: "}

              {isPinned &&
                "PINNED: "}

              {title.trim() &&
                `${title.trim()} — `}

              {message.trim() ||
                "Your announcement will appear here."}
            </div>
          </div>

          <div
            style={
              previewNoteStyle
            }
          >
            Cashier ticker background: #111C30 • Text: white
          </div>
        </div>
      </div>

      <div
        style={
          existingSectionStyle
        }
      >
        <div
          style={
            existingHeaderStyle
          }
        >
          <div>
            ANNOUNCEMENTS
          </div>

          <div
            style={
              countBadgeStyle
            }
          >
            {announcements.length}
          </div>
        </div>

        {loading ? (
          <div
            style={
              emptyStyle
            }
          >
            Loading announcements...
          </div>
        ) : announcements.length ===
          0 ? (
          <div
            style={
              emptyStyle
            }
          >
            No Live Feed announcements yet.
          </div>
        ) : (
          <div
            style={
              announcementListStyle
            }
          >
            {announcements.map(
              (
                item
              ) => (
                <AdminAnnouncementRow
                  key={
                    item.id
                  }
                  item={
                    item
                  }
                  busy={
                    busyId ===
                    item.id
                  }
                  onEdit={() =>
                    beginEdit(
                      item
                    )
                  }
                  onToggle={() =>
                    setAnnouncementActive(
                      item,
                      !item.is_active
                    )
                  }
                />
              )
            )}
          </div>
        )}
      </div>
    </section>
  );
}

// ==================================================
// ANNOUNCEMENT ROW
// ==================================================

function AdminAnnouncementRow({
  item,
  busy,
  onEdit,
  onToggle,
}) {
  const active =
    Boolean(
      item?.is_active
    );

  const priority =
    String(
      item?.priority ||
        "NORMAL"
    )
      .trim()
      .toUpperCase();

  const expired =
    Boolean(
      item?.expires_at &&
      new Date(
        item.expires_at
      ).getTime() <=
        Date.now()
    );

  let statusText =
    "ACTIVE";

  if (
    !active
  ) {
    statusText =
      "INACTIVE";
  } else if (
    expired
  ) {
    statusText =
      "EXPIRED";
  }

  return (
    <div
      style={
        announcementRowStyle
      }
    >
      <div
        style={
          rowTopStyle
        }
      >
        <div
          style={
            rowTitleWrapStyle
          }
        >
          {item.is_pinned && (
            <span
              style={
                miniBadgeStyle
              }
            >
              PINNED
            </span>
          )}

          {priority ===
            "IMPORTANT" && (
            <span
              style={
                importantBadgeStyle
              }
            >
              IMPORTANT
            </span>
          )}

          <strong>
            {item.title ||
              "ADMIN MESSAGE"}
          </strong>
        </div>

        <span
          style={{
            ...statusBadgeStyle,

            opacity:
              active &&
              !expired
                ? 1
                : 0.55,
          }}
        >
          {statusText}
        </span>
      </div>

      <div
        style={
          rowMessageStyle
        }
      >
        {item.message}
      </div>

      <div
        style={
          rowMetaStyle
        }
      >
        <span>
          Created{" "}
          {formatDateTime(
            item.created_at
          )}
        </span>

        <span>
          {item.expires_at
            ? `Expires ${formatDateTime(
                item.expires_at
              )}`
            : "No expiry"}
        </span>
      </div>

      <div
        style={
          rowActionsStyle
        }
      >
        <button
          type="button"
          onClick={
            onEdit
          }
          disabled={
            busy
          }
          style={
            editButtonStyle
          }
        >
          EDIT
        </button>

        <button
          type="button"
          onClick={
            onToggle
          }
          disabled={
            busy
          }
          style={
            active
              ? deactivateButtonStyle
              : activateButtonStyle
          }
        >
          {busy
            ? "WORKING..."
            : active
            ? "DEACTIVATE"
            : "REACTIVATE"}
        </button>
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

function toLocalDateTimeInput(
  value
) {
  if (
    !value
  ) {
    return "";
  }

  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  const pad =
    (number) =>
      String(
        number
      ).padStart(
        2,
        "0"
      );

  return (
    `${date.getFullYear()}-` +
    `${pad(
      date.getMonth() +
        1
    )}-` +
    `${pad(
      date.getDate()
    )}T` +
    `${pad(
      date.getHours()
    )}:` +
    `${pad(
      date.getMinutes()
    )}`
  );
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

        year:
          "numeric",

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
// STYLES
// ==================================================

const panelStyle = {
  width:
    "100%",

  boxSizing:
    "border-box",

  backgroundColor:
    "#0F172A",

  border:
    "1px solid #263650",

  borderRadius:
    "14px",

  overflow:
    "hidden",

  color:
    "#FFFFFF",
};


const panelHeaderStyle = {
  display:
    "flex",

  justifyContent:
    "space-between",

  alignItems:
    "center",

  gap:
    "12px",

  padding:
    "15px",

  backgroundColor:
    "#111C30",

  borderBottom:
    "1px solid rgba(255,255,255,0.12)",
};


const panelTitleStyle = {
  fontSize:
    "15px",

  fontWeight:
    950,

  color:
    "#FFFFFF",

  letterSpacing:
    "0.6px",
};


const panelSubtitleStyle = {
  marginTop:
    "4px",

  color:
    "#FFFFFF",

  opacity:
    0.72,

  fontSize:
    "10px",
};


const liveBadgeStyle = {
  padding:
    "6px 9px",

  border:
    "1px solid rgba(255,255,255,0.30)",

  borderRadius:
    "9px",

  color:
    "#FFFFFF",

  fontSize:
    "8px",

  fontWeight:
    900,

  whiteSpace:
    "nowrap",
};


const formGridStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "minmax(0, 1.6fr) minmax(260px, 1fr)",

  gap:
    "12px",

  padding:
    "12px",
};


const formCardStyle = {
  minWidth:
    0,

  padding:
    "12px",

  backgroundColor:
    "#111C30",

  border:
    "1px solid #263650",

  borderRadius:
    "10px",
};


const previewCardStyle = {
  minWidth:
    0,

  padding:
    "12px",

  backgroundColor:
    "#111C30",

  border:
    "1px solid #263650",

  borderRadius:
    "10px",
};


const formHeadingStyle = {
  marginBottom:
    "10px",

  color:
    "#FFFFFF",

  fontSize:
    "11px",

  fontWeight:
    950,

  letterSpacing:
    "0.5px",
};


const labelStyle = {
  display:
    "block",

  marginBottom:
    "5px",

  color:
    "#FFFFFF",

  fontSize:
    "10px",

  fontWeight:
    800,
};


const inputStyle = {
  width:
    "100%",

  boxSizing:
    "border-box",

  minHeight:
    "39px",

  padding:
    "9px 10px",

  marginBottom:
    "10px",

  backgroundColor:
    "#0A121F",

  color:
    "#FFFFFF",

  border:
    "1px solid #354763",

  borderRadius:
    "7px",

  outline:
    "none",

  fontSize:
    "11px",
};


const textareaStyle = {
  ...inputStyle,

  minHeight:
    "95px",

  resize:
    "vertical",

  fontFamily:
    "inherit",

  lineHeight:
    1.5,
};


const counterStyle = {
  marginTop:
    "-7px",

  marginBottom:
    "10px",

  textAlign:
    "right",

  color:
    "#FFFFFF",

  opacity:
    0.55,

  fontSize:
    "8px",
};


const optionsGridStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "repeat(2,minmax(0,1fr))",

  gap:
    "10px",
};


const checkboxRowStyle = {
  display:
    "flex",

  alignItems:
    "center",

  gap:
    "8px",

  color:
    "#FFFFFF",

  fontSize:
    "10px",

  fontWeight:
    850,

  cursor:
    "pointer",
};


const hintStyle = {
  marginTop:
    "8px",

  padding:
    "8px",

  backgroundColor:
    "#0A121F",

  border:
    "1px solid #263650",

  borderRadius:
    "7px",

  color:
    "#FFFFFF",

  opacity:
    0.75,

  fontSize:
    "9px",

  lineHeight:
    1.45,
};


const actionRowStyle = {
  display:
    "flex",

  gap:
    "8px",

  marginTop:
    "10px",
};


const publishButtonStyle = {
  flex:
    1,

  minHeight:
    "40px",

  padding:
    "10px",

  backgroundColor:
    "#111C30",

  color:
    "#FFFFFF",

  border:
    "1px solid rgba(255,255,255,0.42)",

  borderRadius:
    "7px",

  fontSize:
    "10px",

  fontWeight:
    950,
};


const cancelButtonStyle = {
  minHeight:
    "40px",

  padding:
    "10px 13px",

  backgroundColor:
    "#0A121F",

  color:
    "#FFFFFF",

  border:
    "1px solid #354763",

  borderRadius:
    "7px",

  fontSize:
    "9px",

  fontWeight:
    900,

  cursor:
    "pointer",
};


// ==================================================
// PREVIEW
// ==================================================

const tickerPreviewStyle = {
  minHeight:
    "58px",

  display:
    "flex",

  alignItems:
    "center",

  gap:
    "16px",

  overflow:
    "hidden",

  padding:
    "0 12px",

  backgroundColor:
    "#111C30",

  color:
    "#FFFFFF",

  border:
    "1px solid rgba(255,255,255,0.20)",

  borderRadius:
    "7px",

  fontSize:
    "11px",

  fontWeight:
    850,
};


const previewMessageStyle = {
  color:
    "#FFFFFF",

  whiteSpace:
    "nowrap",

  overflow:
    "hidden",

  textOverflow:
    "ellipsis",
};


const previewNoteStyle = {
  marginTop:
    "8px",

  color:
    "#FFFFFF",

  opacity:
    0.55,

  fontSize:
    "8px",
};


// ==================================================
// STATUS
// ==================================================

const successStyle = {
  marginTop:
    "10px",

  padding:
    "9px",

  backgroundColor:
    "#10261A",

  border:
    "1px solid #2F6B47",

  borderRadius:
    "7px",

  color:
    "#FFFFFF",

  fontSize:
    "9px",
};


const errorStyle = {
  marginTop:
    "10px",

  padding:
    "9px",

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
// EXISTING ANNOUNCEMENTS
// ==================================================

const existingSectionStyle = {
  padding:
    "0 12px 12px",
};


const existingHeaderStyle = {
  display:
    "flex",

  alignItems:
    "center",

  gap:
    "8px",

  marginBottom:
    "8px",

  color:
    "#FFFFFF",

  fontSize:
    "10px",

  fontWeight:
    950,
};


const countBadgeStyle = {
  minWidth:
    "22px",

  padding:
    "3px 6px",

  textAlign:
    "center",

  backgroundColor:
    "#111C30",

  border:
    "1px solid #354763",

  borderRadius:
    "10px",

  color:
    "#FFFFFF",

  fontSize:
    "8px",
};


const announcementListStyle = {
  display:
    "grid",

  gap:
    "8px",
};


const announcementRowStyle = {
  padding:
    "10px",

  backgroundColor:
    "#111C30",

  border:
    "1px solid #263650",

  borderRadius:
    "8px",

  color:
    "#FFFFFF",
};


const rowTopStyle = {
  display:
    "flex",

  justifyContent:
    "space-between",

  alignItems:
    "center",

  gap:
    "10px",
};


const rowTitleWrapStyle = {
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
};


const miniBadgeStyle = {
  padding:
    "3px 5px",

  border:
    "1px solid rgba(255,255,255,0.32)",

  borderRadius:
    "5px",

  color:
    "#FFFFFF",

  fontSize:
    "7px",

  fontWeight:
    900,
};


const importantBadgeStyle = {
  padding:
    "3px 5px",

  backgroundColor:
    "#2B1D13",

  border:
    "1px solid #7A512D",

  borderRadius:
    "5px",

  color:
    "#FFFFFF",

  fontSize:
    "7px",

  fontWeight:
    900,
};


const statusBadgeStyle = {
  padding:
    "4px 7px",

  border:
    "1px solid rgba(255,255,255,0.30)",

  borderRadius:
    "8px",

  color:
    "#FFFFFF",

  fontSize:
    "7px",

  fontWeight:
    900,

  whiteSpace:
    "nowrap",
};


const rowMessageStyle = {
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
};


const rowMetaStyle = {
  display:
    "flex",

  justifyContent:
    "space-between",

  flexWrap:
    "wrap",

  gap:
    "6px",

  marginTop:
    "8px",

  color:
    "#FFFFFF",

  opacity:
    0.55,

  fontSize:
    "8px",
};


const rowActionsStyle = {
  display:
    "flex",

  gap:
    "7px",

  marginTop:
    "9px",
};


const editButtonStyle = {
  padding:
    "7px 10px",

  backgroundColor:
    "#0A121F",

  color:
    "#FFFFFF",

  border:
    "1px solid #354763",

  borderRadius:
    "6px",

  fontSize:
    "8px",

  fontWeight:
    900,

  cursor:
    "pointer",
};


const deactivateButtonStyle = {
  padding:
    "7px 10px",

  backgroundColor:
    "#2C1619",

  color:
    "#FFFFFF",

  border:
    "1px solid #79363C",

  borderRadius:
    "6px",

  fontSize:
    "8px",

  fontWeight:
    900,

  cursor:
    "pointer",
};


const activateButtonStyle = {
  padding:
    "7px 10px",

  backgroundColor:
    "#10261A",

  color:
    "#FFFFFF",

  border:
    "1px solid #2F6B47",

  borderRadius:
    "6px",

  fontSize:
    "8px",

  fontWeight:
    900,

  cursor:
    "pointer",
};


const emptyStyle = {
  padding:
    "14px",

  textAlign:
    "center",

  backgroundColor:
    "#111C30",

  border:
    "1px solid #263650",

  borderRadius:
    "8px",

  color:
    "#FFFFFF",

  opacity:
    0.75,

  fontSize:
    "9px",
};
