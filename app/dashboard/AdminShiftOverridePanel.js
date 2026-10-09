"use client";

import { useEffect, useMemo, useState } from "react";
import AdminRecoveryReportEditor from "./AdminRecoveryReportEditor";

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
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [version, setVersion] = useState(0);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = user?.access_token;

  const headers = useMemo(() => ({
    apikey: key,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }), [key, token]);

  const shop = shops.find((s) => s.id === shopId);
  const target = targetShifts.find((s) => s.id === targetId);

  const otherOpen = openShifts.filter((s) => s.id !== targetId);
  const multipleOpen = otherOpen.length > 1;
  const returnShift = otherOpen.length === 1 ? otherOpen[0] : null;

  async function request(path, body) {
    const response = await fetch(`${url}/rest/v1/${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
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
        setShopId((old) =>
          list.some((s) => s.id === old)
            ? old
            : list[0]?.id || ""
        );
      } catch (e) {
        if (!stopped) setError(e.message);
      } finally {
        if (!stopped) setLoading(false);
      }
    }

    loadShops();

    return () => {
      stopped = true;
    };
  }, [url, key, token]);

  useEffect(() => {
    if (!shopId || !businessDate || !token) return;

    let stopped = false;

    async function loadStatus() {
      setLoading(true);
      setError("");

      try {
        const sid = encodeURIComponent(shopId);
        const date = encodeURIComponent(businessDate);

        const [targets, opens, sessions] = await Promise.all([
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
          request("rpc/tl_admin_get_shift_recovery", {
            p_shop_id: shopId,
          }),
        ]);

        if (stopped) return;

        const list = Array.isArray(targets) ? targets : [];

        setTargetShifts(list);
        setOpenShifts(Array.isArray(opens) ? opens : []);
        setRecovery(
          Array.isArray(sessions) ? sessions[0] || null : null
        );
        setTargetId((old) =>
          list.some((s) => s.id === old) ? old : ""
        );
      } catch (e) {
        if (!stopped) {
          setError(e.message);
          setTargetShifts([]);
          setOpenShifts([]);
          setRecovery(null);
        }
      } finally {
        if (!stopped) setLoading(false);
      }
    }

    loadStatus();

    return () => {
      stopped = true;
    };
  }, [shopId, businessDate, version, url, key, token]);

  function refresh() {
    setMessage("");
    setVersion((v) => v + 1);
  }

  async function startRecovery() {
    if (busy || loading || error || recovery) return;

    if (!target || !shop) {
      setError("Select the historical shift.");
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
      // Never rely only on an earlier OPEN-shift check.
      const opens = await request(
        `shifts?shop_id=eq.${encodeURIComponent(shopId)}` +
        "&status=eq.OPEN" +
        "&select=id,shift_name,business_date,status,opened_at"
      );

      const others = opens.filter((s) => s.id !== target.id);

      if (others.length > 1) {
        throw new Error(
          "More than one OPEN shift exists. Resolve this first."
        );
      }

      const automaticReturn = others[0] || null;

      const confirmed = window.confirm(
        "START ADMIN RECOVERY?\n\n" +
        `Shop: ${shop.shop_name}\n` +
        `Target: ${describe(target)}\n` +
        `Return: ${
          automaticReturn
            ? describe(automaticReturn)
            : "Normal shift selection"
        }`
      );

      if (!confirmed) return;

      await request("rpc/tl_admin_start_shift_recovery", {
        p_shop_id: shopId,
        p_target_shift_id: target.id,
        p_return_shift_id: automaticReturn?.id || null,
        p_reason: reason.trim(),
      });

      setReason("");
      setMessage("Recovery started.");
      refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function endRecovery() {
    if (!recovery?.session_id || busy) return;

    const confirmed = window.confirm(
      "END RECOVERY?\n\n" +
      "The cashier will return to normal shift selection."
    );

    if (!confirmed) return;

    setBusy(true);
    setError("");

    try {
      await request("rpc/tl_admin_end_shift_recovery", {
        p_session_id: recovery.session_id,
        p_note: null,
      });

      setMessage("Recovery ended.");
      refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={panel}>
      <div style={heading}>
        ADMIN SHIFT RECOVERY — 12H & 24H
      </div>

      <div style={{ padding: 14 }}>
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
                setError("");
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
              }}
            />
          </div>
        </div>

        <div style={stats}>
          <Info title="SHOP" value={shop?.shop_name || "-"} />
          <Info title="TYPE" value={shop?.shop_type || "-"} />
          <Info title="OPEN" value={openShifts.length} />
          <Info
            title="RECOVERY"
            value={recovery ? "ACTIVE" : "NONE"}
          />
        </div>

        {error && <div style={errorBox}>{error}</div>}
        {message && <div style={successBox}>{message}</div>}
        {loading && <p>Loading shifts...</p>}

        {recovery ? (
          <div style={inner}>
            <strong>
              {recovery.target_shift_name} —{" "}
              {recovery.target_business_date}
            </strong>

            <div>Status: {recovery.target_status}</div>
            <div>Reason: {recovery.reason}</div>

            <div>
              Return:{" "}
              {recovery.return_shift_name
                ? `${recovery.return_shift_name} | ${recovery.return_business_date}`
                : "Normal shift selection"}
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={endRecovery}
              style={{ ...button, background: "#0f766e" }}
            >
              END RECOVERY SESSION
            </button>
          </div>
        ) : (
          <div style={inner}>
            <label style={label}>SHIFT TO RECOVER</label>

            <select
              style={field}
              value={targetId}
              disabled={busy || loading || !!error}
              onChange={(e) => setTargetId(e.target.value)}
            >
              <option value="">Select shift...</option>
              {targetShifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {describe(s)}
                </option>
              ))}
            </select>

            {!loading && targetShifts.length === 0 && (
              <small>No shifts found for this date.</small>
            )}

            <div style={{ margin: "10px 0", fontSize: 12 }}>
              <strong>Automatic return: </strong>
              {multipleOpen
                ? "Multiple OPEN shifts — resolve first"
                : returnShift
                ? describe(returnShift)
                : "Normal shift selection"}
            </div>

            <label style={label}>REASON (ONE ONLY)</label>
            <textarea
              rows={2}
              style={field}
              value={reason}
              disabled={busy}
              onChange={(e) => setReason(e.target.value)}
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
              START RECOVERY
            </button>
          </div>
        )}

        {recovery && shop && (
          <AdminRecoveryReportEditor
            key={recovery.session_id}
            user={user}
            recovery={recovery}
            shop={shop}
          />
        )}

        <button
          type="button"
          style={{ ...button, background: "#334155" }}
          disabled={busy}
          onClick={refresh}
        >
          REFRESH SHIFT STATUS
        </button>
      </div>
    </section>
  );
}

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
    if (p.type !== "literal") values[p.type] = p.value;
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
  gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
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
  gridTemplateColumns: "repeat(4,minmax(0,1fr))",
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
