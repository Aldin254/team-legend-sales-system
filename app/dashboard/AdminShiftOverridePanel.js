"use client";

import { useEffect, useMemo, useState } from "react";

import AdminRecoveryReportEditor from "./AdminRecoveryReportEditor";
import Admin24HourShiftControl from "./Admin24HourShiftControl";

const ZONE = "Africa/Nairobi";

export default function AdminShiftOverridePanel({ user }) {
  const [shops, setShops] = useState([]);
  const [shopId, setShopId] = useState("");
  const [businessDate, setBusinessDate] = useState(todayNairobi);
  const [targetShifts, setTargetShifts] = useState([]);
  const [openShifts, setOpenShifts] = useState([]);
  const [targetId, setTargetId] = useState("");
  const [recovery, setRecovery] = useState(null);
  const [reason, setReason] = useState("");
  const [endNote, setEndNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [version, setVersion] = useState(0);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = user?.access_token;

  const headers = useMemo(
    () => ({
      apikey: key,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    }),
    [key, token]
  );

  const shop = shops.find((s) => s.id === shopId);

  const shopType = String(shop?.shop_type || "")
    .trim()
    .toUpperCase();

  const is12HourShop = shopType === "12_HOUR";
  const is24HourShop = shopType === "24_HOUR";

  const target = targetShifts.find((s) => s.id === targetId);

  const otherOpen = openShifts.filter((s) => s.id !== targetId);
  const multipleOpen = otherOpen.length > 1;
  const returnShift = otherOpen.length === 1 ? otherOpen[0] : null;

  // ==========================================
  // SUPABASE REQUEST
  // ==========================================

  async function request(path, body) {
    if (!url || !key || !token) {
      throw new Error("Admin login information is missing.");
    }

    const response = await fetch(`${url}/rest/v1/${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers,
      ...(body === undefined
        ? {}
        : { body: JSON.stringify(body) }),
      cache: "no-store",
    });

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
          setError("Admin login information is missing.");
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

        const list = Array.isArray(result) ? result : [];

        setShops(list);

        setShopId((current) =>
          list.some((s) => s.id === current)
            ? current
            : list[0]?.id || ""
        );
      } catch (e) {
        if (!stopped) {
          setError(e?.message || "Unable to load shops.");
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
  // LOAD SHIFT AND RECOVERY
  //
  // 12H: EXISTING DATE-SCOPED SELECTION
  // 24H: LAST OPEN SHIFT FIRST
  // ==========================================

  useEffect(() => {
    if (!shopId || !token || (!businessDate && is12HourShop)) {
      return;
    }

    let stopped = false;

    async function loadStatus() {
      setLoading(true);
      setError("");

      try {
        const sid = encodeURIComponent(shopId);
        const date = encodeURIComponent(businessDate);

        const targetsPath = is24HourShop
          ? `shifts?shop_id=eq.${sid}` +
            "&select=id,shop_id,shift_name,business_date,status,opened_at,cashier_name" +
            "&order=opened_at.desc.nullslast&limit=30"
          : `shifts?shop_id=eq.${sid}` +
            `&business_date=eq.${date}` +
            "&select=id,shop_id,shift_name,business_date,status,opened_at,cashier_name" +
            "&order=opened_at.desc";

        const [targets, opens, sessions] = await Promise.all([
          request(targetsPath),

          request(
            `shifts?shop_id=eq.${sid}&status=eq.OPEN` +
              "&select=id,shop_id,shift_name,business_date,status,opened_at,cashier_name" +
              "&order=opened_at.desc"
          ),

          request("rpc/tl_admin_get_shift_recovery", {
            p_shop_id: shopId,
          }),
        ]);

        if (stopped) return;

        const rows = Array.isArray(targets) ? targets : [];
        const live = Array.isArray(opens) ? opens : [];

        const list = is24HourShop
          ? [
              ...live.filter(
                (s) => !rows.some((t) => t.id === s.id)
              ),
              ...rows,
            ]
          : rows;

        const currentRecovery = Array.isArray(sessions)
          ? sessions[0] || null
          : sessions?.session_id
          ? sessions
          : null;

        setTargetShifts(list);
        setOpenShifts(live);
        setRecovery(currentRecovery);

        setTargetId((current) => {
          if (list.some((s) => s.id === current)) {
            return current;
          }

          if (is24HourShop) {
            return live[0]?.id || list[0]?.id || "";
          }

          return "";
        });
      } catch (e) {
        if (!stopped) {
          setError(e?.message || "Unable to load recovery.");
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
    is24HourShop,
    is12HourShop,
    version,
    url,
    key,
    token,
  ]);

  useEffect(() => {
    setEndNote("");
  }, [recovery?.session_id]);

  // ==========================================
  // REFRESH
  // ==========================================

  function refresh() {
    setVersion((v) => v + 1);
  }

  // ==========================================
  // START ADMIN RECOVERY
  // ==========================================

  async function startRecovery() {
    if (busy || loading || error || recovery) return;

    if (!target || !shop) {
      setError("Select the shift to recover.");
      return;
    }

    if (reason.trim().length < 10) {
      setError("Enter a reason of at least 10 characters.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
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

      const others = opens.filter((s) => s.id !== target.id);

      if (others.length > 1) {
        throw new Error(
          "More than one OPEN shift exists. Resolve this first."
        );
      }

      if (is24HourShop && others.length > 0) {
        throw new Error(
          "Recover the current OPEN 24-hour shift first."
        );
      }

      const automaticReturn = others[0] || null;

      const confirmed = window.confirm(
        "START ADMIN RECOVERY?\n\n" +
          `Shop: ${shop.shop_name}\n` +
          `Target: ${describe(target)}\n` +
          (is12HourShop
            ? `Return: ${
                automaticReturn
                  ? describe(automaticReturn)
                  : "Normal shift selection"
              }`
            : "Correct this shift, then select the next shift.")
      );

      if (!confirmed) return;

      await request("rpc/tl_admin_start_shift_recovery", {
        p_shop_id: shopId,
        p_target_shift_id: target.id,
        p_return_shift_id: is12HourShop
          ? automaticReturn?.id || null
          : null,
        p_reason: reason.trim(),
      });

      setReason("");
      setEndNote("");
      setMessage("Recovery started.");
      refresh();
    } catch (e) {
      setError(e?.message || "Unable to start Recovery.");
    } finally {
      setBusy(false);
    }
  }

  // ==========================================
  // END RECOVERY — 12-HOUR ONLY
  //
  // ORIGINAL 12-HOUR VALIDATION PRESERVED
  // ==========================================

  async function endRecovery() {
    if (!is12HourShop || !recovery?.session_id || busy) {
      return;
    }

    const note = endNote.trim();

    const confirmed = window.confirm(
      "END ADMIN RECOVERY?\n\n" +
        `Shop: ${shop?.shop_name || "Shop"}\n` +
        `Target: ${
          recovery.target_shift_name || "Shift"
        } | ${recovery.target_business_date || "—"}\n\n` +
        `Verification note:\n${
          note || "(No note entered)"
        }\n\n` +
        "If an incomplete closing is pending, Supabase must verify the readings and closing balance before ending this session."
    );

    if (!confirmed) return;

    setBusy(true);
    setError("");
    setMessage("");

    try {
      await request("rpc/tl_admin_end_shift_recovery", {
        p_session_id: recovery.session_id,
        p_note: note || null,
      });

      setEndNote("");

      setMessage(
        "Recovery verified and ended where required. The cashier can refresh to resume the current-day shift."
      );

      refresh();
    } catch (e) {
      setError(
        e?.message || "Unable to verify and end Recovery."
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
        ADMIN SHIFT RECOVERY — 12H &amp; 24H
      </div>

      <div style={{ padding: 14 }}>
        {/* SHOP SELECTION */}

        <div style={grid}>
          <div>
            <label style={label}>SHOP</label>

            <select
              style={field}
              value={shopId}
              disabled={busy}
              onChange={(e) => {
                setShopId(e.target.value);
                setTargetId("");
                setRecovery(null);
                setEndNote("");
                setError("");
                setMessage("");
              }}
            >
              {shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.shop_name} — {s.shop_type}
                  {!s.is_active ? " (INACTIVE)" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* ORIGINAL 12-HOUR DATE CONTROL */}

          {is12HourShop && (
            <div>
              <label style={label}>BUSINESS DATE</label>

              <input
                type="date"
                style={field}
                value={businessDate}
                disabled={busy}
                onChange={(e) => {
                  setBusinessDate(e.target.value);
                  setTargetId("");
                  setError("");
                  setMessage("");
                }}
              />
            </div>
          )}
        </div>

        {/* STATUS */}

        <div style={stats}>
          <Info
            title="SHOP"
            value={shop?.shop_name || "-"}
          />

          <Info
            title="TYPE"
            value={shop?.shop_type || "-"}
          />

          <Info
            title="OPEN"
            value={openShifts.length}
          />

          <Info
            title="RECOVERY"
            value={recovery ? "ACTIVE" : "NONE"}
          />
        </div>

        {error && (
          <div role="alert" style={errorBox}>
            {error}
          </div>
        )}

        {message && (
          <div role="status" style={successBox}>
            {message}
          </div>
        )}

        {loading && <p>Loading shifts...</p>}

        {/* =====================================
            ACTIVE RECOVERY
            ===================================== */}

        {recovery ? (
          <div style={inner}>
            <strong>
              {recovery.target_shift_name} —{" "}
              {recovery.target_business_date}
            </strong>

            <div>
              Status: {recovery.target_status}
            </div>

            <div>
              Reason: {recovery.reason}
            </div>

            {/* ONLY 12-HOUR SHOPS HAVE THE
                ORIGINAL END RECOVERY CONTROL */}

            {is12HourShop && (
              <>
                <div>
                  Return:{" "}
                  {recovery.return_shift_name
                    ? `${recovery.return_shift_name} | ${recovery.return_business_date}`
                    : "Normal shift selection"}
                </div>

                <div style={verificationSection}>
                  <label
                    htmlFor="tl-admin-recovery-end-note"
                    style={verificationLabel}
                  >
                    ADMIN VERIFICATION NOTE
                  </label>

                  <textarea
                    id="tl-admin-recovery-end-note"
                    rows={3}
                    style={verificationInput}
                    value={endNote}
                    disabled={busy}
                    maxLength={2000}
                    onChange={(e) => {
                      setEndNote(e.target.value);
                      setError("");
                    }}
                    placeholder="Example: Verified all six closing readings, expenses and final Balance B/F for this shop."
                  />

                  <div style={verificationHelp}>
                    For an incomplete 12-hour closing,
                    enter at least 10 characters.
                    Supabase will verify the readings
                    and balance before unlocking.
                  </div>

                  <div style={verificationCount}>
                    {endNote.trim().length} characters
                  </div>
                </div>

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
              </>
            )}
          </div>
        ) : (
          /* =====================================
             START RECOVERY
             ===================================== */

          <div style={inner}>
            <label style={label}>
              {is24HourShop
                ? "LAST SHIFT TO RECOVER"
                : "SHIFT TO RECOVER"}
            </label>

            <select
              style={field}
              value={targetId}
              disabled={busy || loading || !!error}
              onChange={(e) => {
                setTargetId(e.target.value);
              }}
            >
              <option value="">
                Select shift...
              </option>

              {targetShifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {describe(s)}
                </option>
              ))}
            </select>

            {!loading && targetShifts.length === 0 && (
              <small>No shifts found.</small>
            )}

            {is12HourShop && (
              <div
                style={{
                  margin: "10px 0",
                  fontSize: 12,
                }}
              >
                <strong>Automatic return:</strong>{" "}
                {multipleOpen
                  ? "Multiple OPEN shifts — resolve first"
                  : returnShift
                  ? describe(returnShift)
                  : "Normal shift selection"}
              </div>
            )}

            <label style={label}>
              REASON (ONE ONLY)
            </label>

            <textarea
              rows={2}
              style={field}
              value={reason}
              disabled={busy}
              onChange={(e) => {
                setReason(e.target.value);
              }}
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
                (is24HourShop &&
                  otherOpen.length > 0) ||
                reason.trim().length < 10
              }
            >
              {busy
                ? "STARTING..."
                : "START RECOVERY"}
            </button>
          </div>
        )}

        {/* =====================================
            STEP 1: FINANCIAL CORRECTIONS
            SAME EXISTING REPORT EDITOR
            ===================================== */}

        {recovery && shop && (
          <AdminRecoveryReportEditor
            key={recovery.session_id}
            user={user}
            recovery={recovery}
            shop={shop}
          />
        )}

        {/* =====================================
            STEP 2: 24-HOUR SHIFT SELECTION

            THIS IS SHOWN AFTER THE
            FINANCIAL RECOVERY REPORT.

            EXACTLY THREE OPTIONS.

            NO SEPARATE END RECOVERY BUTTON.
            ===================================== */}

        {is24HourShop && recovery && shop && (
          <Admin24HourShiftControl
            key={`${shopId}:${recovery.session_id}`}
            user={user}
            shops={[shop]}
            onChanged={() => {
              setMessage(
                "24-hour recovery finalized. Shift status updated."
              );
              refresh();
            }}
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
// HELPERS
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
    `${shift.shift_name} | ${shift.business_date} | ` +
    `${shift.status} | ${String(shift.id).slice(-8)}`
  );
}

function todayNairobi() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = {};

  for (const p of parts) {
    if (p.type !== "literal") {
      values[p.type] = p.value;
    }
  }

  return `${values.year}-${values.month}-${values.day}`;
}

async function json(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

// ==========================================
// STYLES
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
