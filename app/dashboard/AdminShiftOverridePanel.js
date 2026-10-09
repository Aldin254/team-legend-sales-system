"use client";

import { useEffect, useMemo, useState } from "react";

const NAIROBI_ZONE = "Africa/Nairobi";

export default function AdminShiftOverridePanel({ user }) {
  const [shops, setShops] = useState([]);
  const [selectedShopId, setSelectedShopId] = useState("");
  const [businessDate, setBusinessDate] = useState(() => nairobiBusinessDate());
  const [targetShifts, setTargetShifts] = useState([]);
  const [openShifts, setOpenShifts] = useState([]);
  const [targetShiftId, setTargetShiftId] = useState("");
  const [returnShiftId, setReturnShiftId] = useState("");
  const [activeRecovery, setActiveRecovery] = useState(null);
  const [reason, setReason] = useState("");
  const [endNote, setEndNote] = useState("");
  const [loadingShops, setLoadingShops] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [working, setWorking] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const accessToken = user?.access_token || null;

  const headers = useMemo(
    () => ({
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    }),
    [supabaseAnonKey, accessToken]
  );

  const selectedShop = shops.find((shop) => shop.id === selectedShopId);
  const selectedTarget = targetShifts.find(
    (shift) => shift.id === targetShiftId
  );
  const possibleReturns = openShifts.filter(
    (shift) => shift.id !== targetShiftId
  );
  const selectedReturn = possibleReturns.find(
    (shift) => shift.id === returnShiftId
  );
  const requiresReturn = possibleReturns.length > 0;

  // --------------------------------------------------
  // Load ALL 12-hour and 24-hour shops (including inactive
  // shops, if their historical shifts need correcting).
  // --------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    async function loadShops() {
      if (!supabaseUrl || !supabaseAnonKey || !accessToken) {
        if (!cancelled) {
          setLoadingShops(false);
          setMessage("Admin login information is missing.");
          setMessageType("error");
        }
        return;
      }
      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/shops` +
            `?shop_type=in.(12_HOUR,24_HOUR)` +
            `&select=id,shop_name,shop_type,is_active&order=shop_name.asc`,
          { headers, cache: "no-store" }
        );
        const result = await safeJson(response);
        if (!response.ok) {
          throw new Error(result?.message || "Unable to load shops.");
        }
        if (cancelled) return;
        const list = Array.isArray(result) ? result : [];
        setShops(list);
        setSelectedShopId((old) =>
          list.some((shop) => shop.id === old) ? old : list[0]?.id || ""
        );
      } catch (error) {
        if (!cancelled) {
          setMessage(error?.message || "Unable to load shops.");
          setMessageType("error");
        }
      } finally {
        if (!cancelled) setLoadingShops(false);
      }
    }
    loadShops();
    return () => { cancelled = true; };
  }, [supabaseUrl, supabaseAnonKey, accessToken, headers]);

  // --------------------------------------------------
  // Read exact historical shifts, all OPEN shifts and
  // current recovery via the ADMIN-ONLY overview RPC.
  // The recovery tables have no direct browser SELECT.
  // --------------------------------------------------
  useEffect(() => {
    if (!selectedShopId || !supabaseUrl || !supabaseAnonKey || !accessToken || !businessDate) {
      setLoadingStatus(false);
      setStatusError("");
      setTargetShifts([]);
      setOpenShifts([]);
      setActiveRecovery(null);
      return;
    }

    let cancelled = false;
    async function loadStatus() {
      setLoadingStatus(true);
      setStatusError("");
      try {
        const shop = encodeURIComponent(selectedShopId);
        const date = encodeURIComponent(businessDate);
        const base = `${supabaseUrl}/rest/v1`;
        const [targetResponse, openResponse, overviewResponse] =
          await Promise.all([
            fetch(
              `${base}/shifts?shop_id=eq.${shop}` +
                `&business_date=eq.${date}` +
                `&select=id,shop_id,shift_name,business_date,status,opened_at,closed_at,cashier_name` +
                `&order=opened_at.desc`,
              { headers, cache: "no-store" }
            ),
            fetch(
              `${base}/shifts?shop_id=eq.${shop}&status=eq.OPEN` +
                `&select=id,shop_id,shift_name,business_date,status,opened_at,closed_at,cashier_name` +
                `&order=opened_at.desc`,
              { headers, cache: "no-store" }
            ),
            fetch(`${base}/rpc/tl_admin_get_shift_recovery`, {
              method: "POST",
              headers,
              body: JSON.stringify({ p_shop_id: selectedShopId }),
              cache: "no-store",
            }),
          ]);

        const [targets, opens, overview] = await Promise.all([
          safeJson(targetResponse),
          safeJson(openResponse),
          safeJson(overviewResponse),
        ]);
        if (!targetResponse.ok || !openResponse.ok || !overviewResponse.ok) {
          throw new Error(
            targets?.message || opens?.message || overview?.message ||
              "Unable to load Admin recovery status. Check the overview RPC."
          );
        }
        if (cancelled) return;
        const targetList = Array.isArray(targets) ? targets : [];
        const openList = Array.isArray(opens) ? opens : [];
        setTargetShifts(targetList);
        setStatusError("");
        setOpenShifts(openList);
        setActiveRecovery(Array.isArray(overview) ? overview[0] || null : null);
        setTargetShiftId((old) =>
          targetList.some((shift) => shift.id === old) ? old : ""
        );
        setReturnShiftId((old) =>
          openList.some((shift) => shift.id === old) ? old : ""
        );
      } catch (error) {
        console.error("ADMIN RECOVERY STATUS ERROR:", error);
        if (!cancelled) {
          setStatusError(error?.message || "Unable to load recovery status.");
          setTargetShifts([]);
          setOpenShifts([]);
          setActiveRecovery(null);
          setMessage(error?.message || "Unable to load recovery status.");
          setMessageType("error");
        }
      } finally {
        if (!cancelled) setLoadingStatus(false);
      }
    }
    loadStatus();
    return () => { cancelled = true; };
  }, [selectedShopId, businessDate, reloadKey, supabaseUrl, supabaseAnonKey, accessToken, headers]);

  function refresh() {
    setMessage("");
    setMessageType("");
    setReloadKey((value) => value + 1);
  }

  // --------------------------------------------------
  // Start ADMIN recovery session (no shift is inserted,
  // reopened, or financially modified here).
  // --------------------------------------------------
async function startRecovery() {
    if (working || loadingStatus || statusError || activeRecovery) return;
    if (!selectedTarget || !selectedShop) {
      setMessage("Select the exact historical shift first.");
      setMessageType("error");
      return;
    }
    if (reason.trim().length < 10) {
      setMessage("Enter a recovery reason of at least 10 characters.");
      setMessageType("error");
      return;
    }
    if (requiresReturn && !selectedReturn) {
      setMessage("Select the OPEN shift the cashier must return to.");
      setMessageType("error");
      return;
    }
    if (!window.confirm(
      `START ADMIN RECOVERY?\n\nShop: ${selectedShop.shop_name}` +
      `\nTarget: ${describeShift(selectedTarget)}` +
      `\nReturn: ${selectedReturn ? describeShift(selectedReturn) : "Normal shift selection"}` +
      `\n\nThis records a recovery assignment; it does not reopen or edit a shift.`
    )) return;

    setWorking(true);
    setMessage("");
    try {
      const response = await fetch(
        `${supabaseUrl}/rest/v1/rpc/tl_admin_start_shift_recovery`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            p_shop_id: selectedShopId,
            p_target_shift_id: selectedTarget.id,
            p_return_shift_id: selectedReturn?.id || null,
            p_reason: reason.trim(),
          }),
        }
      );
      const result = await safeJson(response);
      if (!response.ok) {
        throw new Error(result?.message || result?.details || "Recovery could not start.");
      }
      setReason("");
      setMessage("Recovery assignment started and recorded in the Admin audit.");
      setMessageType("success");
      setReloadKey((value) => value + 1);
    } catch (error) {
      setMessage(error?.message || "Unable to start recovery.");
      setMessageType("error");
    } finally {
      setWorking(false);
    }
  }

  // --------------------------------------------------
  // End recovery assignment. The return shift ID is
  // retained in the audit record by the SQL RPC.
  // --------------------------------------------------
  async function endRecovery() {
    if (working || !activeRecovery?.session_id) return;
    if (!window.confirm(
      `END RECOVERY?\n\nTarget: ${activeRecovery.target_shift_name || "Shift"}` +
      ` (${activeRecovery.target_business_date || "-"})` +
      `\n\nThe cashier will return to normal shift selection once the dashboard is connected.`
    )) return;

    setWorking(true);
    setMessage("");
    try {
      const response = await fetch(
        `${supabaseUrl}/rest/v1/rpc/tl_admin_end_shift_recovery`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            p_session_id: activeRecovery.session_id,
            p_note: endNote.trim() || null,
          }),
        }
      );
      const result = await safeJson(response);
      if (!response.ok) {
        throw new Error(result?.message || result?.details || "Recovery could not end.");
      }
      setEndNote("");
      setMessage("Recovery ended and the audit was recorded.");
      setMessageType("success");
      setReloadKey((value) => value + 1);
    } catch (error) {
      setMessage(error?.message || "Unable to end recovery.");
      setMessageType("error");
    } finally {
      setWorking(false);
    }
  }

  return (
    <section style={panelStyle}>
      <div style={headingStyle}>ADMIN SHIFT RECOVERY — 12H & 24H</div>
      <div style={contentStyle}>
        <p style={mutedStyle}>
          Select an existing shift by business date and unique shift ID.
          Recovery sessions do not create duplicate shifts or change balances.
        </p>

        <div style={twoColumnStyle}>
          <div>
            <label style={labelStyle}>SHOP</label>
            <select
              value={selectedShopId}
              disabled={loadingShops || working}
              style={fieldStyle}
              onChange={(event) => {
                setSelectedShopId(event.target.value);
                setLoadingStatus(true);
                setStatusError("");
                setActiveRecovery(null);
                setTargetShifts([]);
                setOpenShifts([]);
                setTargetShiftId("");
                setReturnShiftId("");
                setMessage("");
              }}
            >
              {shops.length === 0 && <option value="">No shops found</option>}
              {shops.map((shop) => (
                <option key={shop.id} value={shop.id}>
                  {shop.shop_name} — {shop.shop_type}
                  {shop.is_active === false ? " (INACTIVE)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>HISTORICAL BUSINESS DATE</label>
            <input
              type="date"
              value={businessDate}
              disabled={working}
              style={fieldStyle}
              onChange={(event) => {
                setBusinessDate(event.target.value);
                setLoadingStatus(true);
                setStatusError("");
                setTargetShifts([]);
                setTargetShiftId("");
                setMessage("");
              }}
            />
          </div>
        </div>

        <div style={statsStyle}>
          <StatusBox title="SHOP" value={selectedShop?.shop_name || "-"} />
          <StatusBox title="TYPE" value={selectedShop?.shop_type || "-"} />
          <StatusBox title="OPEN SHIFTS" value={loadingStatus ? "..." : String(openShifts.length)} />
          <StatusBox title="RECOVERY" value={activeRecovery ? "ACTIVE" : "NONE"} />
        </div>

        {loadingStatus && <p style={mutedStyle}>Loading shift records...</p>}
        {message && (
          <div role="alert" style={noticeStyle(messageType === "success")}>{message}</div>
        )}

        {activeRecovery ? (
          <div style={subpanelStyle}>
            <h3 style={subheadingStyle}>Active recovery session</h3>
            <div><strong>Target:</strong> {activeRecovery.target_shift_name} — {activeRecovery.target_business_date}</div>
            <div><strong>Shift ID:</strong> <code style={wrapStyle}>{activeRecovery.target_shift_id}</code></div>
            <div><strong>Target status:</strong> {activeRecovery.target_status}</div>
            <div><strong>Return:</strong> {activeRecovery.return_shift_name
              ? `${activeRecovery.return_shift_name} — ${activeRecovery.return_business_date}`
              : "Normal shift selection"}</div>
            <div><strong>Started:</strong> {formatNairobiDateTime(activeRecovery.started_at)}</div>
            <div><strong>Reason:</strong> {activeRecovery.reason}</div>
            <label style={{ ...labelStyle, marginTop: 14 }}>END NOTE (OPTIONAL)</label>
            <textarea
              rows={2}
              value={endNote}
              disabled={working}
              onChange={(event) => setEndNote(event.target.value)}
              style={{ ...fieldStyle, resize: "vertical" }}
              placeholder="What was completed during recovery?"
            />
            <button type="button" disabled={working} onClick={endRecovery}
              style={{ ...buttonStyle, background: working ? "#94a3b8" : "#0f766e" }}>
              {working ? "Processing..." : "END RECOVERY SESSION"}
            </button>
          </div>
        ) : (
          <div style={subpanelStyle}>
            <h3 style={subheadingStyle}>Start a historical shift recovery</h3>
            <label style={labelStyle}>EXACT SHIFT TO RECOVER</label>
            <select
              value={targetShiftId}
              disabled={working || loadingStatus}
              style={fieldStyle}
              onChange={(event) => {
                setTargetShiftId(event.target.value);
                setReturnShiftId("");
              }}
            >
              <option value="">Select a recorded shift...</option>
              {targetShifts.map((shift) => (
                <option key={shift.id} value={shift.id}>{describeShift(shift)}</option>
              ))}
            </select>
            {!loadingStatus && targetShifts.length === 0 && (
              <p style={mutedStyle}>No shifts found for this business date. Choose another date.</p>
            )}
            {selectedTarget && (
              <p style={mutedStyle}>
                Exact target ID: <code style={wrapStyle}>{selectedTarget.id}</code>
              </p>
            )}

            <label style={labelStyle}>SHIFT TO RETURN TO AFTER RECOVERY</label>
            <select
              value={returnShiftId}
              disabled={working || loadingStatus || !selectedTarget}
              style={fieldStyle}
              onChange={(event) => setReturnShiftId(event.target.value)}
            >
              <option value="">
                {requiresReturn ? "Choose an OPEN return shift..." : "No other OPEN shift — normal selection"}
              </option>
              {possibleReturns.map((shift) => (
                <option key={shift.id} value={shift.id}>{describeShift(shift)}</option>
              ))}
            </select>
            {openShifts.length > 1 && (
              <p style={warningStyle}>
                Multiple OPEN shifts exist in this shop. Select the correct return shift carefully.
              </p>
            )}

            <label style={labelStyle}>ADMIN REASON (MINIMUM 10 CHARACTERS)</label>
            <textarea
              rows={3}
              value={reason}
              disabled={working || loadingStatus}
              onChange={(event) => setReason(event.target.value)}
              style={{ ...fieldStyle, resize: "vertical" }}
              placeholder="Example: Recover missing Shift 2 figures from 2 days ago"
            />
            <button type="button" onClick={startRecovery}
              disabled={working || loadingStatus || Boolean(statusError) || !selectedTarget || reason.trim().length < 10 || (requiresReturn && !selectedReturn)}
              style={{
                ...buttonStyle,
                background:
                  working || loadingStatus || Boolean(statusError) || !selectedTarget || reason.trim().length < 10 || (requiresReturn && !selectedReturn)
                    ? "#94a3b8" : "#7f1d1d",
              }}
            >
              {working ? "STARTING..." : "START ADMIN RECOVERY SESSION"}
            </button>
          </div>
        )}

        <button type="button" disabled={working || loadingStatus}
          onClick={refresh} style={{ ...buttonStyle, marginTop: 10, background: "#334155" }}>
          REFRESH SHIFT STATUS
        </button>
        <p style={mutedStyle}>
          Recovery assignments alone do not reopen CLOSED shifts, bypass Accountant approvals,
          or enable historical cashier edits. Those require the next secured backend step.
        </p>
      </div>
    </section>
  );
}
function StatusBox({ title, value }) {
  return (
    <div style={statusBoxStyle}>
      <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700 }}>{title}</div>
      <div style={{ fontSize: 13, fontWeight: 700, marginTop: 5 }}>{value}</div>
    </div>
  );
}

function describeShift(shift) {
  const name = shift?.shift_name || "SHIFT";
  const date = shift?.business_date || "?";
  const status = shift?.status || "?";
  const opened = formatNairobiDateTime(shift?.opened_at);
  const suffix = String(shift?.id || "").slice(-8);
  return `${name} | ${date} | ${status} | Opened ${opened} | ID ...${suffix}`;
}

function nairobiBusinessDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: NAIROBI_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const values = {};
  for (const part of parts) if (part.type !== "literal") values[part.type] = part.value;
  return `${values.year}-${values.month}-${values.day}`;
}

function formatNairobiDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: NAIROBI_ZONE, day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(date);
}

async function safeJson(response) {
  try { return await response.json(); } catch { return null; }
}

const panelStyle = {
  background: "white", borderRadius: 9, overflow: "hidden",
  boxShadow: "0 1px 6px rgba(0,0,0,0.12)", marginTop: 20,
};
const headingStyle = {
  background: "#7f1d1d", color: "white", padding: "14px 16px",
  fontWeight: 700, fontSize: 16,
};
const contentStyle = { padding: 16 };
const twoColumnStyle = {
  display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12,
};
const statsStyle = {
  display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(115px,1fr))",
  gap: 9, marginTop: 8, marginBottom: 14,
};
const statusBoxStyle = {
  border: "1px solid #e2e8f0", background: "#f8fafc", borderRadius: 7,
  padding: 12, textAlign: "center", overflowWrap: "anywhere",
};
const subpanelStyle = {
  border: "1px solid #e2e8f0", background: "#f8fafc", borderRadius: 9,
  padding: 15, display: "grid", gap: 8,
};
const subheadingStyle = { margin: "0 0 7px", fontSize: 15 };
const labelStyle = {
  display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4, marginTop: 8,
};
const fieldStyle = {
  display: "block", width: "100%", boxSizing: "border-box",
  background: "white", border: "1px solid #94a3b8", borderRadius: 6,
  padding: 10, marginBottom: 7, fontSize: 13,
};
const buttonStyle = {
  display: "block", width: "100%", padding: 12, borderRadius: 6,
  border: 0, color: "white", fontWeight: 700, fontSize: 12, cursor: "pointer",
};
const mutedStyle = { color: "#64748b", fontSize: 12, lineHeight: 1.6 };
const warningStyle = { color: "#991b1b", fontSize: 12 };
const wrapStyle = { overflowWrap: "anywhere" };
function noticeStyle(success) {
  return {
    background: success ? "#ecfdf5" : "#fef2f2",
    color: success ? "#166534" : "#991b1b", padding: 12,
    borderRadius: 7, fontSize: 12, marginBottom: 14,
  };
}
