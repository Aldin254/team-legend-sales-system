"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

const REFRESH_MS = 15000;

// ==================================================
// TEAM LEGEND — ADMIN LIVE FEED
// PROFESSIONAL CLEAN THEME
// ==================================================

export default function AdminLiveFeedPanel({ user }) {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const accessToken = user?.access_token || null;

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [isPinned, setIsPinned] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [editingStartsAt, setEditingStartsAt] =
    useState(null);

  const [announcements, setAnnouncements] =
    useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const [statusMessage, setStatusMessage] =
    useState("");

  const [statusType, setStatusType] =
    useState("");

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
  // RPC
  // ==================================================

  const callRpc = useCallback(
    async (functionName, body = {}) => {
      if (
        !supabaseUrl ||
        !supabaseAnonKey ||
        !accessToken
      ) {
        throw new Error(
          "Admin session is incomplete. Please log in again."
        );
      }

      const response = await fetch(
        `${supabaseUrl}/rest/v1/rpc/${functionName}`,
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify(body),
          cache: "no-store",
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
  // LOAD ANNOUNCEMENTS
  // ==================================================

  const loadAnnouncements = useCallback(
    async ({ silent = false } = {}) => {
      if (!accessToken) {
        setAnnouncements([]);
        setLoading(false);
        return;
      }

      try {
        if (!silent) {
          setLoading(true);
        }

        const result = await callRpc(
          "tl_admin_live_feed_announcements_snapshot",
          {}
        );

        setAnnouncements(
          Array.isArray(result) ? result : []
        );
      } catch (error) {
        console.error(
          "ADMIN LIVE FEED LOAD ERROR:",
          error
        );

        if (!silent) {
          setStatusMessage(
            error?.message ||
              "Unable to load Live Feed announcements."
          );
          setStatusType("error");
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [accessToken, callRpc]
  );

  // ==================================================
  // INITIAL LOAD AND AUTO REFRESH
  // ==================================================

  useEffect(() => {
    loadAnnouncements();

    const timer = setInterval(() => {
      loadAnnouncements({ silent: true });
    }, REFRESH_MS);

    return () => clearInterval(timer);
  }, [loadAnnouncements]);

  // ==================================================
  // RESET FORM
  // ==================================================

  function resetForm() {
    setTitle("");
    setMessage("");
    setPriority("NORMAL");
    setIsPinned(false);
    setExpiresAt("");
    setEditingId(null);
    setEditingStartsAt(null);
  }

  // ==================================================
  // PUBLISH / UPDATE ANNOUNCEMENT
  // ==================================================

  async function saveAnnouncement() {
    if (saving) return;

    const cleanTitle = String(title || "").trim();
    const cleanMessage = String(message || "").trim();

    if (!cleanMessage) {
      setStatusMessage(
        "Enter the announcement message."
      );
      setStatusType("error");
      return;
    }

    if (cleanTitle.length > 120) {
      setStatusMessage(
        "Title cannot exceed 120 characters."
      );
      setStatusType("error");
      return;
    }

    if (cleanMessage.length > 1000) {
      setStatusMessage(
        "Message cannot exceed 1000 characters."
      );
      setStatusType("error");
      return;
    }

    let expiryIso = null;

    if (expiresAt) {
      const expiryDate = new Date(expiresAt);

      if (Number.isNaN(expiryDate.getTime())) {
        setStatusMessage(
          "Expiry date/time is invalid."
        );
        setStatusType("error");
        return;
      }

      expiryIso = expiryDate.toISOString();
    }

    try {
      setSaving(true);
      setStatusMessage("");
      setStatusType("");

      if (editingId) {
        await callRpc(
          "tl_admin_live_feed_update_announcement",
          {
            p_announcement_id: editingId,
            p_title: cleanTitle || null,
            p_message: cleanMessage,
            p_priority: priority,
            p_is_pinned: isPinned,
            p_starts_at:
              editingStartsAt ||
              new Date().toISOString(),
            p_expires_at: expiryIso,
          }
        );

        setStatusMessage(
          "Announcement updated successfully."
        );
      } else {
        await callRpc(
          "tl_admin_live_feed_create_announcement",
          {
            p_title: cleanTitle || null,
            p_message: cleanMessage,
            p_priority: priority,
            p_is_pinned: isPinned,
            p_starts_at: null,
            p_expires_at: expiryIso,
          }
        );

        setStatusMessage(
          "Announcement published successfully."
        );
      }

      setStatusType("success");

      resetForm();

      await loadAnnouncements({ silent: true });
    } catch (error) {
      console.error(
        "SAVE LIVE FEED ANNOUNCEMENT ERROR:",
        error
      );

      setStatusMessage(
        error?.message ||
          "Unable to save announcement."
      );
      setStatusType("error");
    } finally {
      setSaving(false);
    }
  }

  // ==================================================
  // EDIT ANNOUNCEMENT
  // ==================================================

  function beginEdit(item) {
    setEditingId(item.id);

    setEditingStartsAt(
      item.starts_at || null
    );

    setTitle(item.title || "");
    setMessage(item.message || "");

    setPriority(
      String(item.priority || "NORMAL")
        .trim()
        .toUpperCase()
    );

    setIsPinned(Boolean(item.is_pinned));

    setExpiresAt(
      toLocalDateTimeInput(item.expires_at)
    );

    setStatusMessage("");
    setStatusType("");

    if (typeof window !== "undefined") {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  }

  // ==================================================
  // ACTIVATE / DEACTIVATE
  // ==================================================

  async function setAnnouncementActive(
    item,
    nextActive
  ) {
    if (!item?.id || busyId) return;

    try {
      setBusyId(item.id);
      setStatusMessage("");
      setStatusType("");

      await callRpc(
        "tl_admin_live_feed_set_active",
        {
          p_announcement_id: item.id,
          p_is_active: nextActive,
        }
      );

      setStatusMessage(
        nextActive
          ? "Announcement reactivated."
          : "Announcement deactivated."
      );

      setStatusType("success");

      if (
        editingId === item.id &&
        !nextActive
      ) {
        resetForm();
      }

      await loadAnnouncements({ silent: true });
    } catch (error) {
      console.error(
        "LIVE FEED STATUS ERROR:",
        error
      );

      setStatusMessage(
        error?.message ||
          "Unable to change announcement status."
      );
      setStatusType("error");
    } finally {
      setBusyId(null);
    }
  }

  // ==================================================
  // DASHBOARD
  // ==================================================

  return (
    <section style={panelStyle}>

      {/* HEADER */}

      <div style={panelHeaderStyle}>
        <div style={panelTitleStyle}>
          LIVE FEED CONTROL
        </div>

        <div style={liveBadgeStyle}>
          ● LIVE FEED
        </div>
      </div>

      {/* EDITOR AND PREVIEW */}

      <div style={formGridStyle}>

        {/* ANNOUNCEMENT EDITOR */}

        <div style={formCardStyle}>

          <div style={formHeadingStyle}>
            {editingId
              ? "EDIT ANNOUNCEMENT"
              : "NEW ANNOUNCEMENT"}
          </div>

          {/* TITLE */}

          <label style={labelStyle}>
            TITLE
          </label>

          <input
            type="text"
            maxLength={120}
            value={title}
            onChange={(event) =>
              setTitle(event.target.value)
            }
            placeholder="Announcement title (optional)"
            style={inputStyle}
          />

          {/* MESSAGE */}

          <label style={labelStyle}>
            MESSAGE
          </label>

          <textarea
            maxLength={1000}
            value={message}
            onChange={(event) =>
              setMessage(event.target.value)
            }
            placeholder="Enter announcement..."
            rows={4}
            style={textareaStyle}
          />

          {/* PRIORITY AND EXPIRY */}

          <div style={optionsGridStyle}>
            <div>
              <label style={labelStyle}>
                PRIORITY
              </label>

              <select
                value={priority}
                onChange={(event) =>
                  setPriority(event.target.value)
                }
                style={inputStyle}
              >
                <option value="NORMAL">
                  NORMAL
                </option>

                <option value="IMPORTANT">
                  IMPORTANT
                </option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>
                EXPIRY
              </label>

              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(event) =>
                  setExpiresAt(event.target.value)
                }
                style={inputStyle}
              />
            </div>
          </div>

          {/* PIN */}

          <label style={checkboxRowStyle}>
            <input
              type="checkbox"
              checked={isPinned}
              onChange={(event) =>
                setIsPinned(event.target.checked)
              }
            />

            <span>PIN MESSAGE</span>
          </label>

          {/* STATUS */}

          {statusMessage && (
            <div
              role="status"
              style={
                statusType === "success"
                  ? successStyle
                  : errorStyle
              }
            >
              {statusMessage}
            </div>
          )}

          {/* PUBLISH */}

          <div style={actionRowStyle}>
            <button
              type="button"
              onClick={saveAnnouncement}
              disabled={saving}
              style={{
                ...publishButtonStyle,
                opacity: saving ? 0.55 : 1,
                cursor: saving
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
                onClick={resetForm}
                disabled={saving}
                style={cancelButtonStyle}
              >
                CANCEL EDIT
              </button>
            )}
          </div>

        </div>

        {/* TICKER PREVIEW */}

        <div style={previewCardStyle}>
          <div style={formHeadingStyle}>
            TICKER PREVIEW
          </div>

          <div style={tickerPreviewStyle}>
            <span style={previewLiveStyle}>
              ● LIVE FEED
            </span>

            <div style={previewMessageStyle}>
              {priority === "IMPORTANT" &&
                "IMPORTANT: "}

              {isPinned &&
                "PINNED: "}

              {title.trim() &&
                `${title.trim()} — `}

              {message.trim() ||
                "Preview"}
            </div>
          </div>
        </div>
      </div>

      {/* EXISTING ANNOUNCEMENTS */}

      <div style={existingSectionStyle}>

        <div style={existingHeaderStyle}>
          <span>ANNOUNCEMENTS</span>

          <span style={countBadgeStyle}>
            {announcements.length}
          </span>
        </div>

        {loading ? (
          <div style={emptyStyle}>
            Loading announcements...
          </div>
        ) : announcements.length === 0 ? (
          <div style={emptyStyle}>
            No announcements.
          </div>
        ) : (
          <div style={announcementListStyle}>
            {announcements.map((item) => (
              <AdminAnnouncementRow
                key={item.id}
                item={item}
                busy={busyId === item.id}
                onEdit={() => beginEdit(item)}
                onToggle={() =>
                  setAnnouncementActive(
                    item,
                    !item.is_active
                  )
                }
              />
            ))}
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
  const active = Boolean(item?.is_active);

  const priority = String(
    item?.priority || "NORMAL"
  )
    .trim()
    .toUpperCase();

  const expired = Boolean(
    item?.expires_at &&
      new Date(item.expires_at).getTime() <=
        Date.now()
  );

  let statusText = "ACTIVE";

  if (!active) {
    statusText = "INACTIVE";
  } else if (expired) {
    statusText = "EXPIRED";
  }

  return (
    <div style={announcementRowStyle}>

      <div style={rowTopStyle}>

        <div style={rowTitleWrapStyle}>
          {item.is_pinned && (
            <span style={miniBadgeStyle}>
              PINNED
            </span>
          )}

          {priority === "IMPORTANT" && (
            <span style={importantBadgeStyle}>
              IMPORTANT
            </span>
          )}

          <strong>
            {item.title || "ADMIN MESSAGE"}
          </strong>
        </div>

        <span
          style={{
            ...statusBadgeStyle,
            opacity:
              active && !expired ? 1 : 0.6,
          }}
        >
          {statusText}
        </span>
      </div>

      <div style={rowMessageStyle}>
        {item.message}
      </div>

      <div style={rowMetaStyle}>
        <span>
          Created{" "}
          {formatDateTime(item.created_at)}
        </span>

        {item.expires_at && (
          <span>
            Expires{" "}
            {formatDateTime(item.expires_at)}
          </span>
        )}
      </div>

      <div style={rowActionsStyle}>
        <button
          type="button"
          onClick={onEdit}
          disabled={busy}
          style={editButtonStyle}
        >
          EDIT
        </button>

        <button
          type="button"
          onClick={onToggle}
          disabled={busy}
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

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function toLocalDateTimeInput(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (number) =>
    String(number).padStart(2, "0");

  return (
    `${date.getFullYear()}-` +
    `${pad(date.getMonth() + 1)}-` +
    `${pad(date.getDate())}T` +
    `${pad(date.getHours())}:` +
    `${pad(date.getMinutes())}`
  );
}

function formatDateTime(value) {
  if (!value) return "-";

  try {
    return new Intl.DateTimeFormat(
      "en-KE",
      {
        timeZone: "Africa/Nairobi",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }
    ).format(new Date(value));
  } catch {
    return "-";
  }
}

// ==================================================
// PROFESSIONAL DARK NAVY STYLES
// ==================================================

const panelStyle = {
  width: "100%",
  boxSizing: "border-box",
  backgroundColor: "#0F172A",
  border: "1px solid #263650",
  borderRadius: "14px",
  overflow: "hidden",
  color: "#FFFFFF",
};

const panelHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  padding: "15px",
  backgroundColor: "#111C30",
  borderBottom: "1px solid rgba(255,255,255,0.12)",
};

const panelTitleStyle = {
  fontSize: "16px",
  fontWeight: 950,
  color: "#FFFFFF",
  letterSpacing: "0.6px",
};

const liveBadgeStyle = {
  padding: "6px 10px",
  border: "1px solid rgba(255,255,255,0.30)",
  borderRadius: "9px",
  color: "#FFFFFF",
  fontSize: "11px",
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const formGridStyle = {
  display: "grid",
  gridTemplateColumns:
    "minmax(0, 1.6fr) minmax(260px, 1fr)",
  gap: "12px",
  padding: "12px",
};

const formCardStyle = {
  minWidth: 0,
  padding: "14px",
  backgroundColor: "#111C30",
  border: "1px solid #263650",
  borderRadius: "10px",
};

const previewCardStyle = {
  minWidth: 0,
  padding: "14px",
  backgroundColor: "#111C30",
  border: "1px solid #263650",
  borderRadius: "10px",
};

const formHeadingStyle = {
  marginBottom: "12px",
  color: "#FFFFFF",
  fontSize: "13px",
  fontWeight: 950,
  letterSpacing: "0.5px",
};

const labelStyle = {
  display: "block",
  marginBottom: "6px",
  color: "#FFFFFF",
  fontSize: "12px",
  fontWeight: 800,
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  minHeight: "42px",
  padding: "10px 11px",
  marginBottom: "12px",
  backgroundColor: "#0A121F",
  color: "#FFFFFF",
  border: "1px solid #354763",
  borderRadius: "7px",
  outline: "none",
  fontSize: "13px",
  fontFamily: "inherit",
};

const textareaStyle = {
  ...inputStyle,
  minHeight: "105px",
  resize: "vertical",
  fontFamily: "inherit",
  lineHeight: 1.6,
};

const optionsGridStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(2,minmax(0,1fr))",
  gap: "12px",
};

const checkboxRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  color: "#FFFFFF",
  fontSize: "12px",
  fontWeight: 850,
  cursor: "pointer",
};

const actionRowStyle = {
  display: "flex",
  gap: "10px",
  marginTop: "16px",
};

const publishButtonStyle = {
  flex: 1,
  minHeight: "43px",
  padding: "11px",
  backgroundColor: "#111C30",
  color: "#FFFFFF",
  border: "1px solid rgba(255,255,255,0.42)",
  borderRadius: "7px",
  fontSize: "12px",
  fontWeight: 950,
  cursor: "pointer",
};

const cancelButtonStyle = {
  minHeight: "43px",
  padding: "11px 14px",
  backgroundColor: "#0A121F",
  color: "#FFFFFF",
  border: "1px solid #354763",
  borderRadius: "7px",
  fontSize: "12px",
  fontWeight: 900,
  cursor: "pointer",
};

// ==================================================
// TICKER PREVIEW
// ==================================================

const tickerPreviewStyle = {
  minHeight: "64px",
  display: "flex",
  alignItems: "center",
  gap: "15px",
  overflow: "hidden",
  padding: "0 14px",
  backgroundColor: "#111C30",
  color: "#FFFFFF",
  border: "1px solid rgba(255,255,255,0.20)",
  borderRadius: "7px",
  fontSize: "13px",
  fontWeight: 850,
};

const previewLiveStyle = {
  whiteSpace: "nowrap",
  color: "#FFFFFF",
  fontWeight: 900,
  fontSize: "12px",
};

const previewMessageStyle = {
  color: "#FFFFFF",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

// ==================================================
// STATUS
// ==================================================

const successStyle = {
  marginTop: "12px",
  padding: "11px",
  backgroundColor: "#10261A",
  border: "1px solid #2F6B47",
  borderRadius: "7px",
  color: "#FFFFFF",
  fontSize: "12px",
};

const errorStyle = {
  marginTop: "12px",
  padding: "11px",
  backgroundColor: "#2C1619",
  border: "1px solid #79363C",
  borderRadius: "7px",
  color: "#FFFFFF",
  fontSize: "12px",
};

// ==================================================
// EXISTING ANNOUNCEMENTS
// ==================================================

const existingSectionStyle = {
  padding: "0 12px 12px",
};

const existingHeaderStyle = {
  display: "flex",
  alignItems: "center",
  gap: "9px",
  marginBottom: "10px",
  color: "#FFFFFF",
  fontSize: "13px",
  fontWeight: 950,
};

const countBadgeStyle = {
  minWidth: "25px",
  padding: "4px 8px",
  textAlign: "center",
  backgroundColor: "#111C30",
  border: "1px solid #354763",
  borderRadius: "10px",
  color: "#FFFFFF",
  fontSize: "11px",
};

const announcementListStyle = {
  display: "grid",
  gap: "10px",
};

const announcementRowStyle = {
  padding: "13px",
  backgroundColor: "#111C30",
  border: "1px solid #263650",
  borderRadius: "8px",
  color: "#FFFFFF",
};

const rowTopStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "10px",
};

const rowTitleWrapStyle = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "7px",
  color: "#FFFFFF",
  fontSize: "13px",
};

const miniBadgeStyle = {
  padding: "4px 7px",
  border: "1px solid rgba(255,255,255,0.32)",
  borderRadius: "5px",
  color: "#FFFFFF",
  fontSize: "10px",
  fontWeight: 900,
};

const importantBadgeStyle = {
  padding: "4px 7px",
  backgroundColor: "#2B1D13",
  border: "1px solid #7A512D",
  borderRadius: "5px",
  color: "#FFFFFF",
  fontSize: "10px",
  fontWeight: 900,
};

const statusBadgeStyle = {
  padding: "5px 8px",
  border: "1px solid rgba(255,255,255,0.30)",
  borderRadius: "8px",
  color: "#FFFFFF",
  fontSize: "10px",
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const rowMessageStyle = {
  marginTop: "10px",
  color: "#FFFFFF",
  fontSize: "13px",
  lineHeight: 1.6,
  whiteSpace: "pre-wrap",
};

const rowMetaStyle = {
  display: "flex",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: "8px",
  marginTop: "10px",
  color: "#CBD5E1",
  fontSize: "11px",
};

const rowActionsStyle = {
  display: "flex",
  gap: "8px",
  marginTop: "12px",
};

const editButtonStyle = {
  padding: "9px 13px",
  backgroundColor: "#0A121F",
  color: "#FFFFFF",
  border: "1px solid #354763",
  borderRadius: "6px",
  fontSize: "11px",
  fontWeight: 900,
  cursor: "pointer",
};

const deactivateButtonStyle = {
  padding: "9px 13px",
  backgroundColor: "#2C1619",
  color: "#FFFFFF",
  border: "1px solid #79363C",
  borderRadius: "6px",
  fontSize: "11px",
  fontWeight: 900,
  cursor: "pointer",
};

const activateButtonStyle = {
  padding: "9px 13px",
  backgroundColor: "#10261A",
  color: "#FFFFFF",
  border: "1px solid #2F6B47",
  borderRadius: "6px",
  fontSize: "11px",
  fontWeight: 900,
  cursor: "pointer",
};

const emptyStyle = {
  padding: "16px",
  textAlign: "center",
  backgroundColor: "#111C30",
  border: "1px solid #263650",
  borderRadius: "8px",
  color: "#CBD5E1",
  fontSize: "12px",
};
