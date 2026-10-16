"use client";

import { useEffect, useState } from "react";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const base = {
  background: "#fff",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: 14,
  marginBottom: 16,
  color: "#0f172a",
};
const field = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #94a3b8",
  borderRadius: 6,
  padding: 10,
  background: "#fff",
  color: "#0f172a",
  fontSize: 12,
};
const label = { display: "block", fontWeight: 800, fontSize: 11, marginBottom: 5 };
const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 };
const action = {
  padding: "11px 14px",
  border: 0,
  borderRadius: 6,
  background: "#073b5c",
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
};

async function rpc(name, token, payload) {
  if (!URL || !KEY || !token) throw new Error("Admin session unavailable.");
  const response = await fetch(`${URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(result?.message || result?.details || `${name} failed.`);
  }
  return result;
}

export default function Admin24HourShiftControl({ user, shops = [], onChanged }) {
  const twentyFour = shops.filter(
    (s) => String(s.shop_type).toUpperCase() === "24_HOUR" && s.is_active !== false
  );
  const [shopId, setShopId] = useState("");
  const [data, setData] = useState(null);
  const [mode, setMode] = useState("AUTO");
  const [date, setDate] = useState("");
  const [shift, setShift] = useState("SHIFT 1");
  const [cashierId, setCashierId] = useState("");
  const [balance, setBalance] = useState("");
  const [readings, setReadings] = useState({});
  const [markMissed, setMarkMissed] = useState(false);
  const [confirmTest, setConfirmTest] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const token = user?.access_token;

  useEffect(() => {
    if (!twentyFour.some((s) => s.id === shopId)) {
      setShopId(twentyFour[0]?.id || "");
    }
  }, [shops, shopId]);

  useEffect(() => {
    if (!shopId || !token) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    rpc("tl_admin_24h_control_snapshot_v1", token, { p_shop_id: shopId })
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setDate(result.auto_date || "");
        setShift(result.auto_shift || "SHIFT 1");
        setCashierId(result.cashiers?.[0]?.id || "");
        setBalance(
          result.suggested_balance == null
            ? ""
            : String(result.suggested_balance)
        );
        setReadings(Object.fromEntries(
          (result.platforms || []).map((p) => [
            p.id,
            p.suggested_value == null ? "" : String(p.suggested_value),
          ])
        ));
        setMarkMissed(false);
        setConfirmTest(false);
      })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [shopId, token, reload]);

  const canSubmit =
    !!data && !data.open_shift && !busy && !loading &&
    !!cashierId && reason.trim().length >= 10 &&
    balance.trim() !== "" && Number.isFinite(Number(balance)) &&
    (data.platforms || []).length > 0 &&
    (data.platforms || []).every((p) =>
      readings[p.id] !== undefined &&
      String(readings[p.id]).trim() !== "" &&
      Number.isFinite(Number(readings[p.id]))
    );

  function refresh() { setReload((v) => v + 1); }

  async function openShift() {
    if (!canSubmit) return;
    const selected = mode === "AUTO"
      ? `${data.auto_shift} • ${data.auto_date}`
      : `${shift} • ${date}`;
    if (!window.confirm(`OPEN VERIFIED 24-HOUR SHIFT?\n\n${selected}\n\n${reason.trim()}`)) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await rpc("tl_admin_24h_open_verified_shift_v1", token, {
        p_shop_id: shopId,
        p_mode: mode,
        p_business_date: mode === "MANUAL" ? date : null,
        p_shift_name: mode === "MANUAL" ? shift : null,
        p_cashier_id: cashierId,
        p_opening_balance: Number(balance),
        p_readings: (data.platforms || []).map((p) => ({
          platform_id: p.id,
          value: Number(readings[p.id]),
        })),
        p_mark_missed: markMissed,
        p_reason: reason.trim(),
      });
      setMessage(`${result.shift_name} • ${result.business_date} OPEN`);
      setReason("");
      refresh();
      onChanged?.();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function flagTestShift() {
    if (!data?.open_shift || !confirmTest || reason.trim().length < 10 || busy) return;
    if (!window.confirm(
      `FLAG TEST SHIFT?\n\n${data.open_shift.shift_name} • ${data.open_shift.business_date}\n\nAll readings remain saved. This is an Admin audit action.`
    )) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await rpc("tl_admin_24h_flag_test_shift_v1", token, {
        p_shop_id: shopId,
        p_shift_id: data.open_shift.id,
        p_confirm_test_readings: true,
        p_reason: reason.trim(),
      });
      setMessage("TEST SHIFT FLAGGED");
      setReason("");
      refresh();
      onChanged?.();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  if (!twentyFour.length) return null;

  return (
    <section style={base}>
      <div style={{
        margin: -14, marginBottom: 14, padding: "13px 15px",
        background: "#073b5c", color: "white", fontWeight: 900, fontSize: 14,
      }}>
        24-HOUR SHIFT CONTROL
      </div>

      <div style={grid}>
        <div>
          <label style={label}>SHOP</label>
          <select style={field} value={shopId} disabled={busy}
            onChange={(e) => { setShopId(e.target.value); setData(null); setReason(""); setMessage(""); }}>
            {twentyFour.map((s) => <option key={s.id} value={s.id}>{s.shop_name}</option>)}
          </select>
        </div>
        <div>
          <label style={label}>NAIROBI SCHEDULE</label>
          <div style={{ ...field, background: "#f1f5f9", fontWeight: 800 }}>
            {data ? `${data.auto_shift} • ${data.auto_date}` : "—"}
          </div>
        </div>
      </div>

      {loading && <p>Loading...</p>}
      {error && <div role="alert" style={{ padding: 10, color: "#991b1b", background: "#fef2f2", marginTop: 12 }}>{error}</div>}
      {message && <div role="status" style={{ padding: 10, color: "#166534", background: "#f0fdf4", marginTop: 12 }}>{message}</div>}

      {data?.open_shift ? (
        <div style={{ marginTop: 14, padding: 12, background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 7 }}>
          <strong>OPEN: {data.open_shift.shift_name} • {data.open_shift.business_date}</strong>
          <div style={{ marginTop: 10 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700 }}>
              <input type="checkbox" checked={confirmTest} disabled={busy}
                onChange={(e) => setConfirmTest(e.target.checked)} />
              READINGS ARE TEST ONLY — NO REAL FINANCIAL ACTIVITY
            </label>
          </div>
          <div style={{ marginTop: 10 }}>
            <label style={label}>ADMIN REASON</label>
            <textarea style={field} rows={2} maxLength={500} value={reason} disabled={busy}
              onChange={(e) => setReason(e.target.value)} />
          </div>
          <button type="button" style={{ ...action, background: "#9f1239", marginTop: 12 }}
            disabled={busy || !confirmTest || reason.trim().length < 10}
            onClick={flagTestShift}>
            {busy ? "SAVING..." : "FLAG TEST SHIFT"}
          </button>
        </div>
      ) : data && (
        <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              ["AUTO", "AUTOMATIC"],
              ["MANUAL", "ADMIN MANUAL"],
            ].map(([value, text]) => (
              <button type="button" key={value} disabled={busy}
                onClick={() => {
                  if (value === "MANUAL") {
                    setBalance("");
                    setReadings(Object.fromEntries((data.platforms || []).map((p) => [p.id, ""])));
                  }
                  if (value === "AUTO") refresh();
                  setMode(value);
                }}
                style={{ ...action, background: mode === value ? "#073b5c" : "#64748b" }}>
                {text}
              </button>
            ))}
          </div>

          {mode === "MANUAL" && (
            <div style={grid}>
              <div>
                <label style={label}>BUSINESS DATE</label>
                <input type="date" style={field} value={date} disabled={busy}
                  onChange={(e) => { setDate(e.target.value); setBalance(""); setReadings({}); }} />
              </div>
              <div>
                <label style={label}>SHIFT</label>
                <select style={field} value={shift} disabled={busy}
                  onChange={(e) => { setShift(e.target.value); setBalance(""); setReadings({}); }}>
                  <option value="SHIFT 1">SHIFT 1 — 9AM–9PM</option>
                  <option value="SHIFT 2">SHIFT 2 — 9PM–9AM</option>
                </select>
              </div>
            </div>
          )}

          <div style={grid}>
            <div>
              <label style={label}>CASHIER</label>
              <select style={field} value={cashierId} disabled={busy}
                onChange={(e) => setCashierId(e.target.value)}>
                <option value="">Select cashier</option>
                {(data.cashiers || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={label}>VERIFIED BALANCE B/F (KES)</label>
              <input type="number" step="0.01" style={field} value={balance} disabled={busy}
                onChange={(e) => setBalance(e.target.value)} />
            </div>
          </div>

          <div style={{ border: "1px solid #cbd5e1", borderRadius: 6, padding: 10 }}>
            <strong style={{ fontSize: 12 }}>VERIFIED OPENING READINGS</strong>
            <div style={{ ...grid, marginTop: 10 }}>
              {(data.platforms || []).map((p) => (
                <div key={p.id}>
                  <label style={label}>{p.name}</label>
                  <input type="number" step="0.01" style={field}
                    value={readings[p.id] ?? ""} disabled={busy}
                    onChange={(e) => setReadings((old) => ({ ...old, [p.id]: e.target.value }))} />
                </div>
              ))}
            </div>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700 }}>
            <input type="checkbox" checked={markMissed} disabled={busy}
              onChange={(e) => setMarkMissed(e.target.checked)} />
            CONFIRM ANY MISSED SHIFTS WERE NOT OPERATED
          </label>

          <div>
            <label style={label}>ADMIN REASON</label>
            <textarea style={field} rows={2} maxLength={500} value={reason} disabled={busy}
              onChange={(e) => setReason(e.target.value)} />
          </div>

          <button type="button" style={{ ...action, background: "#0f766e" }}
            disabled={!canSubmit} onClick={openShift}>
            {busy ? "OPENING..." : "VERIFY & OPEN SHIFT"}
          </button>
        </div>
      )}

      <button type="button" disabled={busy || loading}
        onClick={refresh} style={{ ...action, background: "#475569", marginTop: 12 }}>
        REFRESH
      </button>
    </section>
  );
}
