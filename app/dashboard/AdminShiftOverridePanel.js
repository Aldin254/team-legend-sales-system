"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import AdminRecoveryReportEditor from "./AdminRecoveryReportEditor";
import Admin24HourShiftControl from "./Admin24HourShiftControl";

const ZONE = "Africa/Nairobi";

export default function AdminShiftOverridePanel({ user }) {
  const [shops, setShops] = useState([]);
  const [shopId, setShopId] = useState("");
  const [businessDate, setBusinessDate] =
    useState(todayNairobi);

  const [targetShifts, setTargetShifts] =
    useState([]);

  const [openShifts, setOpenShifts] =
    useState([]);

  const [targetId, setTargetId] =
    useState("");

  const [recovery, setRecovery] =
    useState(null);

  const [reason, setReason] =
    useState("");

  // NEW:
  // Admin verification note entered before
  // ending an active Recovery session.
  const [endNote, setEndNote] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [version, setVersion] =
    useState(0);

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const token =
    user?.access_token;

  const headers = useMemo(
    () => ({
      apikey: key,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    }),
    [key, token]
  );

  const shop = shops.find(
    (s) => s.id === shopId
  );

  const target = targetShifts.find(
    (s) => s.id === targetId
  );

  const otherOpen = openShifts.filter(
    (s) => s.id !== targetId
  );

  const multipleOpen =
    otherOpen.length > 1;

  const returnShift =
    otherOpen.length === 1
      ? otherOpen[0]
      : null;

  const is12HourShop =
    String(shop?.shop_type || "")
      .trim()
      .toUpperCase() === "12_HOUR";

  // ==========================================
  // SUPABASE REQUEST
  // ==========================================

  async function request(path, body) {
    const response = await fetch(
      `${url}/rest/v1/${path}`,
      {
        method:
          body === undefined
            ? "GET"
            : "POST",

        headers,

        ...(body === undefined
          ? {}
          : {
              body: JSON.stringify(body),
            }),

        cache: "no-store",
      }
    );

    const result = await json(response);

    if (!response.ok) {
      throw new Error(
        result?.message ||
        result?.details ||
        "Database request failed."
      );
    }

    return result;
  }

  // ==========================================
  // LOAD SHOPS
  // ==========================================

  useEffect(() => {
    let stopped = false;

    async function loadShops() {
      if (!url || !key || !token) {
        if (!stopped) {
          setError(
            "Admin login information is missing."
          );

          setLoading(false);
        }

        return;
      }

      try {
        const result = await request(
          "shops?shop_type=in.(12_HOUR,24_HOUR)" +
          "&select=id,shop_name,shop_type,is_active" +
          "&order=shop_name.asc"
        );

        if (stopped) return;

        const list = Array.isArray(result)
          ? result
          : [];

        setShops(list);

        setShopId((old) =>
          list.some((s) => s.id === old)
            ? old
            : list[0]?.id || ""
        );
      } catch (e) {
        if (!stopped) {
          setError(
            e?.message ||
            "Unable to load shops."
          );
        }
      } finally {
        if (!stopped) {
          setLoading(false);
        }
      }
    }

    void loadShops();

    return () => {
      stopped = true;
    };
  }, [url, key, token]);

  // ==========================================
  // LOAD HISTORICAL SHIFT AND RECOVERY
  // ==========================================

  useEffect(() => {
    if (
      !shopId ||
      !businessDate ||
      !token
    ) {
      return;
    }

    let stopped = false;

    async function loadStatus() {
      setLoading(true);
      setError("");

      try {
        const sid =
          encodeURIComponent(shopId);

        const date =
          encodeURIComponent(businessDate);

        const [
          targets,
          opens,
          sessions,
        ] = await Promise.all([
          request(
            `shifts?shop_id=eq.${sid}` +
            `&business_date=eq.${date}` +
            "&select=id,shop_id,shift_name,business_date," +
            "status,opened_at,cashier_name" +
            "&order=opened_at.desc"
          ),

          request(
            `shifts?shop_id=eq.${sid}&status=eq.OPEN` +
            "&select=id,shop_id,shift_name,business_date," +
            "status,opened_at,cashier_name" +
            "&order=opened_at.desc"
          ),

          request(
            "rpc/tl_admin_get_shift_recovery",
            {
              p_shop_id: shopId,
            }
          ),
        ]);

        if (stopped) return;

        const list = Array.isArray(targets)
          ? targets
          : [];

        const currentRecovery =
          Array.isArray(sessions)
            ? sessions[0] || null
            : null;

        setTargetShifts(list);

        setOpenShifts(
          Array.isArray(opens)
            ? opens
            : []
        );

        setRecovery(
          currentRecovery
        );

        setTargetId((old) =>
          list.some((s) => s.id === old)
            ? old
            : ""
        );

      } catch (e) {
        if (!stopped) {
          setError(
            e?.message ||
            "Unable to load recovery."
          );

          setTargetShifts([]);
          setOpenShifts([]);
          setRecovery(null);
        }
      } finally {
        if (!stopped) {
          setLoading(false);
        }
      }
    }

    void loadStatus();

    return () => {
      stopped = true;
    };
  }, [
    shopId,
    businessDate,
    version,
    url,
    key,
    token,
  ]);

  // ==========================================
  // RESET VERIFICATION NOTE ON SESSION CHANGE
  // ==========================================

  useEffect(() => {
    setEndNote("");
  }, [recovery?.session_id]);

  // ==========================================
  // REFRESH
  //
  // Do not erase the success message immediately
  // after starting or ending Recovery.
  // ==========================================

  function refresh() {
    setVersion((v) => v + 1);
  }

  // ==========================================
  // START ADMIN RECOVERY
  // ==========================================

  async function startRecovery() {
    if (
      busy ||
      loading ||
      error ||
      recovery
    ) {
      return;
    }

    if (!target || !shop) {
      setError(
        "Select the historical shift."
      );
      return;
    }

    if (
      reason.trim().length < 10
    ) {
      setError(
        "Enter a reason of at least 10 characters."
      );
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      // Fresh shop-wide OPEN shift check.

      const opens = await request(
        `shifts?shop_id=eq.${encodeURIComponent(shopId)}` +
        "&status=eq.OPEN" +
        "&select=id,shift_name,business_date,status,opened_at"
      );

      if (!Array.isArray(opens)) {
        throw new Error(
          "Unable to verify existing open shifts."
        );
      }

      const others = opens.filter(
        (s) => s.id !== target.id
      );

      if (others.length > 1) {
        throw new Error(
          "More than one OPEN shift exists. Resolve this first."
        );
      }

      const automaticReturn =
        others[0] || null;

      const confirmed =
        window.confirm(
          "START ADMIN RECOVERY?\n\n" +
          `Shop: ${shop.shop_name}\n` +
          `Target: ${describe(target)}\n` +
          `Return: ${
            automaticReturn
              ? describe(automaticReturn)
              : "Normal shift selection"
          }`
        );

      if (!confirmed) {
        return;
      }

      await request(
        "rpc/tl_admin_start_shift_recovery",
        {
          p_shop_id: shopId,

          p_target_shift_id:
            target.id,

          p_return_shift_id:
            automaticReturn?.id ||
            null,

          p_reason:
            reason.trim(),
        }
      );

      setReason("");
      setEndNote("");

      setMessage(
        "Recovery started."
      );

      refresh();

    } catch (e) {
      setError(
        e?.message ||
        "Unable to start Recovery."
      );
    } finally {
      setBusy(false);
    }
  }

  // ==========================================
  // END ADMIN RECOVERY
  //
  // UPDATED:
  // Send the actual Admin verification note.
  //
  // Database Stage 8 handles:
  // - Verify missing readings
  // - Verify financial reconciliation
  // - Resolve incident if valid
  // - End recovery session atomically
  //
  // If verification fails:
  // - Recovery stays ACTIVE
  // - Incident stays PENDING_ADMIN
  //
  // Other 24-hour Recovery logic unchanged.
  // ==========================================

  async function endRecovery() {
    if (
      !recovery?.session_id ||
      busy
    ) {
      return;
    }

    const note =
      endNote.trim();

    // The database determines whether a
    // 12-hour incident is pending and requires
    // a note of at least 10 characters.
    // Ordinary recoveries and 24-hour recoveries
    // retain their existing optional-note rule.

    const confirmed =
      window.confirm(
        "END ADMIN RECOVERY?\n\n" +
        `Shop: ${
          shop?.shop_name || "Shop"
        }\n` +
        `Target: ${
          recovery.target_shift_name ||
          "Shift"
        } | ${
          recovery.target_business_date ||
          "—"
        }\n\n` +
        `Verification note:\n${
          note ||
          "(No note entered)"
        }\n\n` +
        (
          is12HourShop
            ? "If an incomplete closing is pending, Supabase must verify the readings and closing balance before ending this session."
            : "The existing Recovery session will be ended."
        )
      );

    if (!confirmed) {
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      // IMPORTANT:
      // Do not send p_note:null unconditionally.
      // This note is required by the strict
      // 12-hour verification SQL.

      await request(
        "rpc/tl_admin_end_shift_recovery",
        {
          p_session_id:
            recovery.session_id,

          p_note:
            note || null,
        }
      );

      setEndNote("");

      setMessage(
        "Recovery verified and ended where required. The cashier can refresh to resume the current-day shift."
      );

      refresh();

    } catch (e) {
      // Supabase rejects ending a pending
      // 12-hour incident without verification.
      // Keep the user's note for correction.

      setError(
        e?.message ||
        "Unable to verify and end Recovery."
      );
    } finally {
      setBusy(false);
    }
  }

  // ==========================================
  // MAIN DISPLAY
  // ==========================================

  return (
    <section style={panel}>
      <div style={heading}>
        ADMIN SHIFT RECOVERY — 12H & 24H
      </div>

      <div style={{ padding: 14 }}>
        {/* ORIGINAL 24-HOUR CONTROL */}

        <Admin24HourShiftControl
          user={user}
          shops={shops}
          onChanged={refresh}
        />

        {/* SHOP AND BUSINESS DATE */}

        <div style={grid}>
          <div>
            <label style={label}>
              SHOP
            </label>

            <select
              style={field}
              value={shopId}
              disabled={busy}
              onChange={(e) => {
                setShopId(
                  e.target.value
                );

                setTargetId("");
                setRecovery(null);
                setEndNote("");
                setError("");
                setMessage("");
              }}
            >
              {shops.map((s) => (
                <option
                  key={s.id}
                  value={s.id}
                >
                  {s.shop_name} — {s.shop_type}
                  {!s.is_active
                    ? " (INACTIVE)"
                    : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={label}>
              BUSINESS DATE
            </label>

            <input
              type="date"
              style={field}
              value={businessDate}
              disabled={busy}
              onChange={(e) => {
                setBusinessDate(
                  e.target.value
                );

                setTargetId("");
                setError("");
                setMessage("");
              }}
            />
          </div>
        </div>

        {/* STATUS */}

        <div style={stats}>
          <Info
            title="SHOP"
            value={
              shop?.shop_name || "-"
            }
          />

          <Info
            title="TYPE"
            value={
              shop?.shop_type || "-"
            }
          />

          <Info
            title="OPEN"
            value={openShifts.length}
          />

          <Info
            title="RECOVERY"
            value={
              recovery
                ? "ACTIVE"
                : "NONE"
            }
          />
        </div>

        {error && (
          <div
            role="alert"
            style={errorBox}
          >
            {error}
          </div>
        )}

        {message && (
          <div
            role="status"
            style={successBox}
          >
            {message}
          </div>
        )}

        {loading && (
          <p>Loading shifts...</p>
        )}

        {/* =====================================
            ACTIVE RECOVERY
            ===================================== */}

        {recovery ? (
          <div style={inner}>
            <strong>
              {recovery.target_shift_name}
              {" — "}
              {recovery.target_business_date}
            </strong>

            <div>
              Status:{" "}
              {recovery.target_status}
            </div>

            <div>
              Reason:{" "}
              {recovery.reason}
            </div>

            <div>
              Return:{" "}
              {recovery.return_shift_name
                ? (
                    `${recovery.return_shift_name} | ` +
                    `${recovery.return_business_date}`
                  )
                : "Normal shift selection"}
            </div>

            {/* NEW VERIFICATION NOTE FIELD */}

            <div style={verificationSection}>
              <label
                htmlFor="tl-admin-recovery-end-note"
                style={verificationLabel}
              >
                {is12HourShop
                  ? "ADMIN VERIFICATION NOTE"
                  : "END RECOVERY NOTE"}
              </label>

              <textarea
                id="tl-admin-recovery-end-note"
                rows={3}
                style={verificationInput}
                value={endNote}
                disabled={busy}
                maxLength={2000}
                onChange={(e) => {
                  setEndNote(
                    e.target.value
                  );

                  setError("");
                }}
                placeholder={
                  is12HourShop
                    ? "Example: Verified all six closing readings, expenses and final Balance B/F for this shop."
                    : "Optional reason or summary of the completed recovery"
                }
              />

              <div style={verificationHelp}>
                {is12HourShop
                  ? "For an incomplete 12-hour closing, enter at least 10 characters. Supabase will verify the readings and balance before unlocking."
                  : "Optional for ordinary 24-hour Recovery."}
              </div>

              <div style={verificationCount}>
                {endNote.trim().length}
                {" characters"}
              </div>
            </div>

            {/* END RECOVERY BUTTON */}

            <button
              type="button"
              disabled={busy || loading}
              onClick={endRecovery}
              style={{
                ...button,

                background:
                  busy || loading
                    ? "#94a3b8"
                    : "#0f766e",
              }}
            >
              {busy
                ? "VERIFYING RECOVERY..."
                : "END RECOVERY SESSION"}
            </button>
          </div>
        ) : (
          /* =====================================
             START RECOVERY
             ===================================== */

          <div style={inner}>
            <label style={label}>
              SHIFT TO RECOVER
            </label>

            <select
              style={field}
              value={targetId}
              disabled={
                busy ||
                loading ||
                !!error
              }
              onChange={(e) =>
                setTargetId(
                  e.target.value
                )
              }
            >
              <option value="">
                Select shift...
              </option>

              {targetShifts.map((s) => (
                <option
                  key={s.id}
                  value={s.id}
                >
                  {describe(s)}
                </option>
              ))}
            </select>

            {!loading &&
              targetShifts.length === 0 && (
                <small>
                  No shifts found for this date.
                </small>
              )}

            <div
              style={{
                margin: "10px 0",
                fontSize: 12,
              }}
            >
              <strong>
                Automatic return:
              </strong>{" "}

              {multipleOpen
                ? "Multiple OPEN shifts — resolve first"
                : returnShift
                ? describe(returnShift)
                : "Normal shift selection"}
            </div>

            <label style={label}>
              REASON (ONE ONLY)
            </label>

            <textarea
              rows={2}
              style={field}
              value={reason}
              disabled={busy}
              onChange={(e) =>
                setReason(
                  e.target.value
                )
              }
              placeholder="Reason for recovering this shift"
            />

            <button
              type="button"
              style={button}
              onClick={startRecovery}
              disabled={
                busy ||
                loading ||
                !!error ||
                !target ||
                multipleOpen ||
                reason.trim().length < 10
              }
            >
              {busy
                ? "STARTING..."
                : "START RECOVERY"}
            </button>
          </div>
        )}

        {/* ORIGINAL RECOVERY REPORT */}

        {recovery && shop && (
          <AdminRecoveryReportEditor
            key={recovery.session_id}
            user={user}
            recovery={recovery}
            shop={shop}
          />
        )}

        {/* REFRESH */}

        <button
          type="button"
          style={{
            ...button,
            background: "#334155",
          }}
          disabled={busy}
          onClick={() => {
            setError("");
            setMessage("");
            refresh();
          }}
        >
          REFRESH SHIFT STATUS
        </button>
      </div>
    </section>
  );
}

// ==========================================
// EXISTING HELPERS
// ==========================================

function Info({ title, value }) {
  return (
    <div style={info}>
      <small>{title}</small>
      <strong>{value}</strong>
    </div>
  );
}

function describe(shift) {
  return (
    `${shift.shift_name} | ` +
    `${shift.business_date} | ` +
    `${shift.status} | ` +
    `${String(shift.id).slice(-8)}`
  );
}

function todayNairobi() {
  const parts =
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone: ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    ).formatToParts(
      new Date()
    );

  const values = {};

  for (const p of parts) {
    if (
      p.type !== "literal"
    ) {
      values[p.type] =
        p.value;
    }
  }

  return (
    `${values.year}-` +
    `${values.month}-` +
    `${values.day}`
  );
}

async function json(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

// ==========================================
// ORIGINAL STYLES
// ==========================================

const panel = {
  background: "#fff",
  borderRadius: 8,
  overflow: "hidden",
  marginTop: 16,
  border: "1px solid #e2e8f0",
};

const heading = {
  background: "#7f1d1d",
  color: "#fff",
  padding: 14,
  fontWeight: 700,
};

const grid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(200px,1fr))",
  gap: 12,
};

const field = {
  width: "100%",
  padding: 10,
  border: "1px solid #94a3b8",
  borderRadius: 6,
  boxSizing: "border-box",
  background: "white",
  marginTop: 5,
};

const label = {
  fontSize: 11,
  fontWeight: 700,
  display: "block",
};

const stats = {
  display: "grid",
  gridTemplateColumns:
    "repeat(4,minmax(0,1fr))",
  gap: 8,
  margin: "12px 0",
};

const info = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  padding: 10,
  borderRadius: 6,
  display: "grid",
  gap: 5,
};

const inner = {
  background: "#f8fafc",
  padding: 12,
  border: "1px solid #e2e8f0",
  borderRadius: 7,
  display: "grid",
  gap: 8,
  marginBottom: 12,
};

const button = {
  width: "100%",
  border: 0,
  borderRadius: 6,
  background: "#7f1d1d",
  color: "white",
  padding: 12,
  fontWeight: 700,
  cursor: "pointer",
  marginTop: 10,
};

const errorBox = {
  background: "#fef2f2",
  color: "#991b1b",
  padding: 10,
  margin: "10px 0",
};

const successBox = {
  background: "#ecfdf5",
  color: "#166534",
  padding: 10,
  margin: "10px 0",
};

// ==========================================
// NEW VERIFICATION NOTE STYLES
// ==========================================

const verificationSection = {
  display: "grid",
  gap: 8,
  marginTop: 14,
  padding: 14,
  background: "#ffffff",
  border: "1px solid #cbd5e1",
  borderRadius: 7,
};

const verificationLabel = {
  fontSize: 12,
  fontWeight: 900,
  color: "#073b5c",
  display: "block",
};

const verificationInput = {
  width: "100%",
  boxSizing: "border-box",
  minHeight: 85,
  resize: "vertical",
  border: "1px solid #94a3b8",
  borderRadius: 6,
  padding: 11,
  fontSize: 12,
  fontFamily: "inherit",
  color: "#0f172a",
  background: "#ffffff",
};

const verificationHelp = {
  fontSize: 11,
  color: "#475569",
  lineHeight: 1.5,
};

const verificationCount = {
  fontSize: 10,
  color: "#64748b",
  textAlign: "right",
};
