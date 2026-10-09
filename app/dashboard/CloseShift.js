"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const NAIROBI_TIME_ZONE = "Africa/Nairobi";
const HANDOVER_START = "21:30:00";

export default function CloseShift({
  user,
  currentShift,
  onShiftClosed,
  refreshKey = 0,
}) {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [closing, setClosing] = useState(false);
  const [reloadIndex, setReloadIndex] = useState(0);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [now, setNow] = useState(() => new Date());
  const closingRef = useRef(false);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const accessToken = user?.access_token || null;
  const shopId = currentShift?.shop_id || user?.shop_id || user?.shopId || null;
  const shiftId = currentShift?.id || null;

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(timer);
  }, []);

  // Avoid displaying readings from a previously selected shift.
  const currentSnapshot = snapshot?.shift?.id === shiftId ? snapshot : null;
  const effectiveShift = currentSnapshot?.shift || currentShift;
  const status = String(effectiveShift?.status || "").trim().toUpperCase();
  const availability = useMemo(
    () => get12HourCloseAvailability(effectiveShift, now),
    [effectiveShift, now]
  );
  const platformCount = currentSnapshot?.platformCount || 0;
  const closingCount = currentSnapshot?.closingCount || 0;
  const allClosingsSaved = platformCount > 0 && closingCount === platformCount;

  const fetchCurrentData = useCallback(async () => {
    if (!shiftId || !shopId || !accessToken || !supabaseUrl || !supabaseAnonKey) {
      throw new Error("Shift or login information is missing.");
    }

    const headers = {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };

    const [shiftResponse, platformResponse, readingsResponse] = await Promise.all([
      fetch(
        `${supabaseUrl}/rest/v1/shifts?id=eq.${encodeURIComponent(shiftId)}` +
          `&select=*&limit=1`,
        { method: "GET", headers, cache: "no-store" }
      ),
      fetch(
        `${supabaseUrl}/rest/v1/shop_platforms?shop_id=eq.${encodeURIComponent(shopId)}` +
          `&is_active=eq.true&select=id`,
        { method: "GET", headers, cache: "no-store" }
      ),
      fetch(
        `${supabaseUrl}/rest/v1/platform_readings?shift_id=eq.${encodeURIComponent(shiftId)}` +
          `&reading_kind=eq.CLOSING&select=id,platform_id`,
        { method: "GET", headers, cache: "no-store" }
      ),
    ]);

    const [shiftResult, platformResult, readingsResult] = await Promise.all([
      safeJson(shiftResponse),
      safeJson(platformResponse),
      safeJson(readingsResponse),
    ]);

    if (!shiftResponse.ok) {
      throw new Error(shiftResult?.message || shiftResult?.details || "Unable to load shift.");
    }
    if (!platformResponse.ok) {
      throw new Error(platformResult?.message || platformResult?.details || "Unable to load platforms.");
    }
    if (!readingsResponse.ok) {
      throw new Error(readingsResult?.message || readingsResult?.details || "Unable to load closing readings.");
    }

    const shift = Array.isArray(shiftResult) ? shiftResult[0] : null;
    if (!shift || String(shift.shop_id) !== String(shopId)) {
      throw new Error("Selected shift was not found in this shop.");
    }

    const platforms = Array.isArray(platformResult) ? platformResult : [];
    const readingRows = Array.isArray(readingsResult) ? readingsResult : [];
    const activeIds = new Set(platforms.map((item) => item.id));
    const savedIds = new Set(
      readingRows.filter((row) => activeIds.has(row.platform_id)).map((row) => row.platform_id)
    );

    return { shift, platformCount: activeIds.size, closingCount: savedIds.size };
  }, [shiftId, shopId, accessToken, supabaseUrl, supabaseAnonKey]);

  // Refresh on shift change or when the parent reports a reading change.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError("");

    fetchCurrentData()
      .then((data) => {
        if (!cancelled) {
          setSnapshot(data);
          setLoadError("");
        }
      })
      .catch((error) => {
        console.error("12H CLOSE LOAD ERROR:", error);
        if (!cancelled) setLoadError(error?.message || "Unable to load closing data.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [fetchCurrentData, refreshKey, reloadIndex]);

  const canClose =
    !closing &&
    !loading &&
    !loadError &&
    Boolean(currentSnapshot) &&
    status === "OPEN" &&
    availability.available &&
    allClosingsSaved;
  async function closeShift() {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    setMessage("");
    setMessageType("");

    try {
      // The original business date sets the opening time, not the current clock day.
      const fresh = await fetchCurrentData();
      if (String(fresh.shift.status || "").toUpperCase() !== "OPEN") {
        throw new Error("This shift is no longer OPEN.");
      }

      const freshAvailability = get12HourCloseAvailability(fresh.shift, new Date());
      if (!freshAvailability.available) {
        throw new Error(freshAvailability.message);
      }

      if (fresh.platformCount === 0 || fresh.closingCount !== fresh.platformCount) {
        throw new Error(
          `All platform closing readings must be saved first. ` +
          `Saved ${fresh.closingCount} of ${fresh.platformCount}.`
        );
      }

      if (!window.confirm(
        `CLOSE 12-HOUR SHIFT\n\n` +
          `Business date: ${fresh.shift.business_date || "-"}\n` +
          `Closing readings: ${fresh.closingCount}/${fresh.platformCount}\n\n` +
          `Confirm closing this shift?`
      )) return;

      const closedAt = new Date().toISOString();
      const response = await fetch(
        `${supabaseUrl}/rest/v1/shifts?id=eq.${encodeURIComponent(shiftId)}` +
          `&status=eq.OPEN`,
        {
          method: "PATCH",
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify({ status: "CLOSED", closed_at: closedAt }),
        }
      );

      const result = await safeJson(response);
      if (!response.ok) {
        throw new Error(result?.message || result?.details || result?.hint || "Unable to close shift.");
      }

      const closedShift = Array.isArray(result) ? result[0] : null;
      if (!closedShift || String(closedShift.status || "").toUpperCase() !== "CLOSED") {
        throw new Error("Shift was not updated. Refresh its status before retrying.");
      }

      setSnapshot({ ...fresh, shift: closedShift });
      setMessage("Shift closed successfully. The next cashier shift follows the normal midnight opening rule.");
      setMessageType("success");

      if (typeof onShiftClosed === "function") {
        try { await onShiftClosed(closedShift); }
        catch (error) { console.error("CLOSED SHIFT REFRESH ERROR:", error); }
      }
    } catch (error) {
      console.error("12H CLOSE ERROR:", error);
      setMessage(error?.message || "Unable to close shift.");
      setMessageType("error");
      // Ensure displayed reading counts can be refreshed after a conflict.
      setReloadIndex((value) => value + 1);
    } finally {
      closingRef.current = false;
      setClosing(false);
    }
  }

  if (!currentShift) return null;

  // The panel opens at 9:30 PM on the business date and remains available.
  if (status === "OPEN" && !availability.available && availability.validDate) {
    return null;
  }

  const netIncome = Number(effectiveShift?.net_income || 0);
  const closingBalance = Number(effectiveShift?.closing_balance || 0);

  return (
    <div style={panelStyle}>
      <h2 style={{ margin: "0 0 7px" }}>Shift Change / Handover</h2>
      <p style={{ margin: "0 0 15px", color: "#64748b" }}>
        Business date: {effectiveShift?.business_date || "-"}. The 12-hour handover
        opens at 9:30 PM Nairobi time and does not expire while the shift remains open.
      </p>

      <div style={noticeStyle(availability.available)}>
        <strong>{availability.available ? "Handover available ✓" : "Handover unavailable"}</strong>
        <div style={{ marginTop: 5, fontSize: 13 }}>{availability.message}</div>
        <div style={{ marginTop: 5, fontSize: 12 }}>
          Nairobi time: {formatNairobiTime(now)}
        </div>
      </div>

      <div style={noticeStyle(allClosingsSaved)}>
        Closing readings: <strong>{closingCount} / {platformCount}</strong>
        {allClosingsSaved ? " ✓" : " — Complete all readings before closing."}
      </div>

      <div style={totalsGridStyle}>
        <TotalCard title="Net Income" value={netIncome} />
        <TotalCard title="Closing Balance" value={closingBalance} />
      </div>

      {(loadError || message) && (
        <div role="alert" style={noticeStyle(!loadError && messageType === "success")}>
          {loadError || message}
        </div>
      )}

      {status === "CLOSED" ? (
        <div style={noticeStyle(true)}>Shift Closed ✓</div>
      ) : (
        <>
          <button
            type="button"
            onClick={closeShift}
            disabled={!canClose}
            style={{ ...actionStyle, background: canClose ? "#dc2626" : "#94a3b8" }}
          >
            {closing ? "Closing Shift..." : loading ? "Checking Readings..." :
              !allClosingsSaved ? "Save Closing Readings First" :
              !availability.available ? "Handover Not Yet Available" :
              "Close Shift & Hand Over"}
          </button>

          <button
            type="button"
            disabled={closing || loading}
            onClick={() => setReloadIndex((value) => value + 1)}
            style={{ ...actionStyle, background: "#0e7490", marginTop: 9 }}
          >
            Refresh Closing Readings
          </button>
        </>
      )}
    </div>
  );
}
function get12HourCloseAvailability(shift, date = new Date()) {
  const businessDate = String(shift?.business_date || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) {
    return {
      available: false,
      validDate: false,
      message: "Shift business date is missing or invalid. Contact Admin.",
    };
  }

  const unlockAt = `${businessDate}T${HANDOVER_START}`;
  const available = getNairobiDateTimeKey(date) >= unlockAt;
  return {
    available,
    validDate: true,
    message: available
      ? `Closing became available at 9:30 PM on ${businessDate}. ` +
        "It remains available if this shift is overdue."
      : `Closing becomes available at 9:30 PM on ${businessDate} (Nairobi time).`,
  };
}

function getNairobiDateTimeKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: NAIROBI_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const result = {};
  for (const part of parts) {
    if (part.type !== "literal") result[part.type] = part.value;
  }
  return `${result.year}-${result.month}-${result.day}` +
    `T${result.hour}:${result.minute}:${result.second}`;
}

function formatNairobiTime(date) {
  return new Intl.DateTimeFormat("en-KE", {
    timeZone: NAIROBI_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);
}

function TotalCard({ title, value }) {
  const numeric = Number(value);
  const safeValue = Number.isFinite(numeric) ? numeric : 0;
  return (
    <div style={{ background: "#f8fafc", padding: 16, borderRadius: 9,
      border: "1px solid #e2e8f0" }}>
      <div style={{ color: "#64748b", fontSize: 13 }}>{title}</div>
      <div style={{ marginTop: 6, fontSize: 20, fontWeight: "bold" }}>
        KES {safeValue.toLocaleString("en-KE", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </div>
    </div>
  );
}

async function safeJson(response) {
  try { return await response.json(); }
  catch { return null; }
}

const panelStyle = {
  marginTop: 24,
  background: "white",
  padding: 25,
  borderRadius: 12,
  boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
  maxWidth: 700,
};

const totalsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2,minmax(0,1fr))",
  gap: 12,
  marginBottom: 20,
};

const actionStyle = {
  width: "100%",
  padding: 14,
  border: "none",
  borderRadius: 8,
  color: "white",
  fontWeight: "bold",
  fontSize: 15,
  cursor: "pointer",
};

function noticeStyle(good) {
  return {
    padding: 14,
    borderRadius: 8,
    marginBottom: 15,
    backgroundColor: good ? "#ecfdf5" : "#fff7ed",
    color: good ? "#166534" : "#9a3412",
  };
}
