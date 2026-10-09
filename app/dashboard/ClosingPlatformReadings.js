"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const NAIROBI_TIME_ZONE = "Africa/Nairobi";
const CLOSING_START = "21:30:00";

export default function ClosingPlatformReadings({
  user,
  currentShift,
  refreshKey = 0,
  onReadingsChanged,
}) {
  const [snapshot, setSnapshot] = useState(null);
  const [draft, setDraft] = useState({ shiftId: null, values: {} });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [now, setNow] = useState(() => new Date());

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const accessToken = user?.access_token || null;
  const shopId = user?.shop_id || user?.shopId || currentShift?.shop_id || null;

  const cashierId =
    user?.profile_id ||
    user?.id ||
    user?.user_id ||
    user?.auth_user_id ||
    null;

  const shiftId = currentShift?.id || null;

  // Avoid showing data from a previously selected shift.
  const data = snapshot?.shiftId === shiftId ? snapshot : null;
  const platforms = data?.platforms || [];
  const openingRows = data?.openings || {};
  const closingRows = data?.closings || {};
  const closingValues = draft.shiftId === shiftId ? draft.values : {};
  const shift = data?.shift || currentShift;
  const status = String(shift?.status || "").trim().toUpperCase();
  const isOpen = status === "OPEN";

  const availability = useMemo(
    () => get12HourClosingAvailability(shift, now),
    [shift, now]
  );

  // ==================================================
  // LIVE NAIROBI CLOCK
  // ==================================================

  useEffect(() => {
    setNow(new Date());

    const timer = setInterval(
      () => setNow(new Date()),
      15000
    );

    return () => clearInterval(timer);
  }, []);

  // Reset local values when a different shift is selected.
  useEffect(() => {
    setSnapshot(null);
    setDraft({ shiftId, values: {} });
    setLoading(true);
    setLoadError("");
    setMessage("");
    setMessageType("");
  }, [shiftId]);

  // ==================================================
  // LOAD SHIFT, PLATFORMS AND READINGS
  // Loading does not change financial totals.
  // ==================================================

  const fetchBundle = useCallback(async () => {
    if (!shiftId || !shopId || !accessToken || !supabaseUrl || !supabaseAnonKey) {
      throw new Error("Shift or login information is missing.");
    }

    const headers = {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };

    const [shiftResponse, platformResponse, readingResponse] =
      await Promise.all([
        fetch(
          `${supabaseUrl}/rest/v1/shifts` +
            `?id=eq.${encodeURIComponent(shiftId)}&select=*&limit=1`,
          {
            method: "GET",
            headers,
            cache: "no-store",
          }
        ),

        fetch(
          `${supabaseUrl}/rest/v1/shop_platforms` +
            `?shop_id=eq.${encodeURIComponent(shopId)}` +
            `&is_active=eq.true` +
            `&select=id,shop_id,platform_name,reading_type,display_order` +
            `&order=display_order.asc`,
          {
            method: "GET",
            headers,
            cache: "no-store",
          }
        ),

        fetch(
          `${supabaseUrl}/rest/v1/platform_readings` +
            `?shift_id=eq.${encodeURIComponent(shiftId)}` +
            `&select=id,platform_id,reading_kind,reading_value,recorded_at` +
            `&order=recorded_at.asc`,
          {
            method: "GET",
            headers,
            cache: "no-store",
          }
        ),
      ]);

    const [shiftResult, platformResult, readingResult] =
      await Promise.all([
        safeJson(shiftResponse),
        safeJson(platformResponse),
        safeJson(readingResponse),
      ]);

    if (!shiftResponse.ok) {
      throw new Error(
        shiftResult?.message || "Unable to load shift."
      );
    }

    if (!platformResponse.ok) {
      throw new Error(
        platformResult?.message || "Unable to load platforms."
      );
    }

    if (!readingResponse.ok) {
      throw new Error(
        readingResult?.message || "Unable to load readings."
      );
    }

    const freshShift = Array.isArray(shiftResult)
      ? shiftResult[0]
      : null;

    if (
      !freshShift ||
      String(freshShift.shop_id) !== String(shopId)
    ) {
      throw new Error(
        "Selected shift does not belong to this shop."
      );
    }

    const activePlatforms =
      Array.isArray(platformResult) ? platformResult : [];

    const rows = Array.isArray(readingResult)
      ? readingResult
      : [];

    const openings = {};
    const closings = {};

    for (const row of rows) {
      if (!row.platform_id) continue;

      if (row.reading_kind === "OPENING") {
        openings[row.platform_id] = row;
      }

      if (row.reading_kind === "CLOSING") {
        closings[row.platform_id] = row;
      }
    }

    return {
      shiftId,
      shift: freshShift,
      platforms: activePlatforms,
      openings,
      closings,
    };
  }, [
    shiftId,
    shopId,
    accessToken,
    supabaseUrl,
    supabaseAnonKey,
  ]);

  // ==================================================
  // INITIAL LOAD AND REFRESH
  // ==================================================

  useEffect(() => {
    if (!shiftId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadData() {
      try {
        const fresh = await fetchBundle();

        if (cancelled) return;

        setSnapshot(fresh);
        setLoadError("");

        // Saved readings stay locked.
        // Unsaved typing survives a manual refresh.
        setDraft((previous) => {
          const previousValues =
            previous.shiftId === shiftId
              ? previous.values
              : {};

          const next = {};

          for (const platform of fresh.platforms) {
            next[platform.id] = fresh.closings[platform.id]
              ? String(
                  fresh.closings[platform.id].reading_value ?? ""
                )
              : previousValues[platform.id] ?? "";
          }

          return { shiftId, values: next };
        });
      } catch (error) {
        console.error("12H CLOSING LOAD ERROR:", error);

        if (!cancelled) {
          setLoadError(
            error?.message || "Unable to load closing readings."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [fetchBundle, shiftId, refreshKey, refreshIndex]);

  // ==================================================
  // SAVED COUNT AND LIVE OUTPUT
  // ==================================================

  const savedCount = platforms.filter(
    (platform) => Boolean(closingRows[platform.id]?.id)
  ).length;

  const allSaved =
    platforms.length > 0 &&
    savedCount === platforms.length;

  const displayedTotalOutput = useMemo(
    () =>
      calculateTotalOutput({
        platforms,
        openings: openingRows,
        closings: closingRows,
        pending: closingValues,
      }),
    [platforms, openingRows, closingRows, closingValues]
  );

  function updateClosingValue(platformId, value) {
    if (!isOpen || closingRows[platformId]?.id || saving) {
      return;
    }

    setDraft((previous) => ({
      shiftId,
      values: {
        ...(previous.shiftId === shiftId
          ? previous.values
          : {}),
        [platformId]: value,
      },
    }));

    setMessage("");
    setMessageType("");
  }

  // ==================================================
  // SAVE CLOSING READINGS
  // ==================================================
async function saveClosingReadings() {
    if (saving) return;

    if (!shiftId || !cashierId || !accessToken) {
      setMessage("Shift or login information is missing.");
      setMessageType("error");
      return;
    }

    if (!isOpen) {
      setMessage("Shift is CLOSED. Contact Admin for recovery.");
      setMessageType("error");
      return;
    }

    if (!availability.available) {
      setMessage(availability.message);
      setMessageType("error");
      return;
    }

    setSaving(true);
    setMessage("");
    setMessageType("");

    let readingsSaved = false;

    try {
      // Verify the shift's current database state.
      const fresh = await fetchBundle();

      if (
        String(fresh.shift.status || "").toUpperCase() !== "OPEN"
      ) {
        throw new Error("This shift is no longer OPEN.");
      }

      if (
        !get12HourClosingAvailability(
          fresh.shift,
          new Date()
        ).available
      ) {
        throw new Error(
          "9:30 PM closing time for this shift has not arrived."
        );
      }

      if (fresh.platforms.length === 0) {
        throw new Error("No active platforms were found.");
      }

      const unsaved = fresh.platforms.filter(
        (platform) => !fresh.closings[platform.id]?.id
      );

      if (unsaved.length === 0) {
        setSnapshot(fresh);
        setMessage("All closing readings have already been saved.");
        setMessageType("success");
        return;
      }

      const payload = [];

      for (const platform of unsaved) {
        const openingRow = fresh.openings[platform.id];

        if (!openingRow) {
          throw new Error(
            `Opening reading is missing for ${platform.platform_name}.`
          );
        }

        const opening = numericOrNull(
          openingRow.reading_value
        );

        const closing = numericOrNull(
          closingValues[platform.id]
        );

        if (opening === null) {
          throw new Error(
            `Invalid opening reading for ${platform.platform_name}.`
          );
        }

        if (closing === null || closing < 0) {
          throw new Error(
            `Enter a valid closing reading for ${platform.platform_name}.`
          );
        }

        if (closing < opening) {
          throw new Error(
            `${platform.platform_name} closing cannot be below opening (${opening}).`
          );
        }

        payload.push({
          shift_id: shiftId,
          platform_id: platform.id,
          reading_kind: "CLOSING",
          reading_value: roundMoney(closing),
          recorded_at: new Date().toISOString(),
          recorded_by: cashierId,
        });
      }

      // Save new readings in one request.
      const response = await fetch(
        `${supabaseUrl}/rest/v1/platform_readings`,
        {
          method: "POST",
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify(payload),
        }
      );

      const inserted = await safeJson(response);

      if (!response.ok) {
        throw new Error(
          inserted?.message ||
            inserted?.details ||
            inserted?.hint ||
            "Unable to save closing readings."
        );
      }

      if (
        !Array.isArray(inserted) ||
        inserted.length !== payload.length
      ) {
        throw new Error(
          "Reading save response was incomplete. Refresh before retrying."
        );
      }

      readingsSaved = true;

      const newClosings = { ...fresh.closings };

      for (const row of inserted) {
        newClosings[row.platform_id] = row;
      }

      setSnapshot({
        ...fresh,
        closings: newClosings,
      });

      // Important: totals change only after a save.
      // Page refreshes must not overwrite shift totals.
      const newTotal = calculateTotalOutput({
        platforms: fresh.platforms,
        openings: fresh.openings,
        closings: newClosings,
        pending: {},
      });

      await syncShiftTotalOutput(newTotal);

      setMessage(
        "Closing readings saved and shift output updated successfully."
      );
      setMessageType("success");
    } catch (error) {
      console.error("12H CLOSING SAVE ERROR:", error);

      setMessage(
        readingsSaved
          ? `Readings were saved, but shift output was not confirmed: ${
              error?.message || "Contact Admin to reconcile the output."
            }`
          : error?.message ||
              "Unable to save closing readings."
      );

      setMessageType("error");
    } finally {
      setSaving(false);

      if (readingsSaved) {
        setRefreshIndex((value) => value + 1);

        if (typeof onReadingsChanged === "function") {
          try {
            await onReadingsChanged();
          } catch (error) {
            console.error("READINGS REFRESH ERROR:", error);
          }
        }
      }
    }
  }

  // ==================================================
  // UPDATE TOTAL OUTPUT — ONLY IF SHIFT REMAINS OPEN
  // ==================================================

  async function syncShiftTotalOutput(totalOutput) {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/shifts` +
        `?id=eq.${encodeURIComponent(shiftId)}` +
        `&status=eq.OPEN`,
      {
        method: "PATCH",
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          total_output: roundMoney(totalOutput),
        }),
      }
    );

    const result = await safeJson(response);

    if (!response.ok) {
      throw new Error(
        result?.message ||
          result?.details ||
          "Unable to update total output."
      );
    }

    if (
      !Array.isArray(result) ||
      result.length === 0
    ) {
      throw new Error(
        "Shift closed before its total output could be updated."
      );
    }
  }

  // ==================================================
  // DISPLAY
  // ==================================================

  if (!currentShift) return null;

  if (loading && !data) {
    return (
      <div style={panelStyle}>
        Loading closing readings...
      </div>
    );
  }

  const hasSavedClosingReadings =
    Object.keys(closingRows).length > 0;

  // Closing opens at 9:30 PM on the shift's date.
  // Once opened, the section does not expire.
  if (
    !availability.available &&
    availability.validDate &&
    isOpen &&
    !hasSavedClosingReadings
  ) {
    return null;
  }

  return (
    <div style={panelStyle}>
      <h2 style={{ margin: "0 0 6px" }}>
        Closing Platform Readings
      </h2>

      <p
        style={{
          margin: "0 0 8px",
          color: "#64748b",
        }}
      >
        Business date: {shift?.business_date || "-"}.
        Closing opens at 9:30 PM Nairobi time and
        remains available while the shift is OPEN.
      </p>

      <div
        style={{
          marginBottom: 14,
          color: "#64748b",
        }}
      >
        Output = Closing minus Opening.
        Existing 12-hour reading rules remain.
      </div>

      {(loadError || message) && (
        <div
          style={noticeStyle(
            !loadError && messageType === "success"
          )}
          role="alert"
        >
          {loadError || message}
        </div>
      )}

      {!availability.validDate && (
        <div style={noticeStyle(false)}>
          {availability.message}
        </div>
      )}

      {!isOpen && (
        <div style={noticeStyle(false)}>
          This shift is CLOSED. Readings are view-only
          until Admin authorizes recovery.
        </div>
      )}

      <div
        style={{
          marginBottom: 16,
          color: "#15803d",
          fontWeight: "bold",
        }}
      >
        Saved: {savedCount} / {platforms.length}
      </div>

      <div style={outputStyle}>
        <div
          style={{
            color: "#64748b",
            fontSize: 13,
          }}
        >
          Total Output
        </div>

        <div
          style={{
            fontSize: 22,
            fontWeight: "bold",
            marginTop: 5,
          }}
        >
          {displayedTotalOutput.toLocaleString(
            "en-KE",
            {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }
          )}
        </div>
      </div>

      {platforms.length === 0 ? (
        <div style={noticeStyle(false)}>
          No active platforms are assigned to this shop.
        </div>
      ) : (
        <>
          {platforms.map((platform) => {
            const opening = numericOrNull(
              openingRows[platform.id]?.reading_value
            );

            const savedRow = closingRows[platform.id];
            const saved = Boolean(savedRow?.id);

            const displayedValue = saved
              ? savedRow.reading_value ?? ""
              : closingValues[platform.id] ?? "";

            const closing = numericOrNull(displayedValue);

            const valid =
              opening !== null &&
              closing !== null &&
              closing >= 0 &&
              closing >= opening;

            const output = valid
              ? roundMoney(closing - opening)
              : null;

            return (
              <div
                key={platform.id}
                style={{ marginBottom: 18 }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 15,
                    marginBottom: 7,
                  }}
                >
                  <label style={{ fontWeight: "bold" }}>
                    {platform.platform_name}
                  </label>

                  {saved && (
                    <span
                      style={{
                        color: "#15803d",
                        fontWeight: "bold",
                      }}
                    >
                      Saved ✓
                    </span>
                  )}
                </div>

                <div
                  style={{
                    color: "#64748b",
                    fontSize: 12,
                    marginBottom: 6,
                  }}
                >
                  Opening: {opening ?? "Missing"}
                  {" • "}
                  Output:{" "}
                  {output === null
                    ? "—"
                    : output.toLocaleString("en-KE", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                </div>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={displayedValue}
                  disabled={
                    saving ||
                    saved ||
                    !isOpen ||
                    !availability.available ||
                    Boolean(loadError)
                  }
                  onChange={(event) =>
                    updateClosingValue(
                      platform.id,
                      event.target.value
                    )
                  }
                  placeholder={`Enter ${platform.platform_name} closing reading`}
                  style={{
                    width: "100%",
                    padding: 13,
                    boxSizing: "border-box",
                    border: saved
                      ? "1px solid #86efac"
                      : "1px solid #cbd5e1",
                    borderRadius: 8,
                    fontSize: 16,
                    backgroundColor: saved
                      ? "#f0fdf4"
                      : "white",
                  }}
                />
              </div>
            );
          })}

          {allSaved ? (
            <div style={noticeStyle(true)}>
              All closing readings saved ✓
            </div>
          ) : (
            <button
              type="button"
              onClick={saveClosingReadings}
              disabled={
                saving ||
                loading ||
                !isOpen ||
                !availability.available ||
                Boolean(loadError)
              }
              style={{
                ...buttonStyle,
                backgroundColor:
                  saving ||
                  !isOpen ||
                  !availability.available ||
                  Boolean(loadError)
                    ? "#94a3b8"
                    : "#168d32",
              }}
            >
              {saving
                ? "Saving..."
                : "Save Closing Readings"}
            </button>
          )}

          <button
            type="button"
            disabled={saving}
            onClick={() =>
              setRefreshIndex((value) => value + 1)
            }
            style={{
              ...buttonStyle,
              backgroundColor: "#0e7490",
              marginTop: 9,
            }}
          >
            Refresh Readings
          </button>
        </>
      )}
    </div>
  );
}
// ==================================================
// DATE-AWARE 12-HOUR CLOSING
//
// Opens at 9:30 PM on the ORIGINAL business date.
// No automatic closing deadline.
// ==================================================

function get12HourClosingAvailability(
  shift,
  now = new Date()
) {
  const businessDate = String(
    shift?.business_date || ""
  ).slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) {
    return {
      available: false,
      validDate: false,
      message:
        "Business date is missing or invalid. Contact Admin.",
    };
  }

  return {
    available:
      getNairobiDateTimeKey(now) >=
      `${businessDate}T${CLOSING_START}`,

    validDate: true,

    message:
      `Closing opens at 9:30 PM on ${businessDate}.`,
  };
}

// ==================================================
// NAIROBI DATE AND TIME
// ==================================================

function getNairobiDateTimeKey(
  date = new Date()
) {
  const parts = new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: NAIROBI_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }
  ).formatToParts(date);

  const fields = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      fields[part.type] = part.value;
    }
  }

  return (
    `${fields.year}-${fields.month}-${fields.day}` +
    `T${fields.hour}:${fields.minute}:${fields.second}`
  );
}

// ==================================================
// 12-HOUR OUTPUT CALCULATION
//
// Output = Closing - Opening
// Cashier validation remains unchanged:
// Closing must be nonnegative and >= Opening.
// ==================================================

function calculateTotalOutput({
  platforms,
  openings,
  closings,
  pending = {},
}) {
  let total = 0;

  for (const platform of platforms) {
    const opening = numericOrNull(
      openings[platform.id]?.reading_value
    );

    const saved = closings[platform.id];

    const closing = numericOrNull(
      saved
        ? saved.reading_value
        : pending[platform.id]
    );

    if (
      opening === null ||
      closing === null ||
      closing < 0 ||
      closing < opening
    ) {
      continue;
    }

    total += closing - opening;
  }

  return roundMoney(total);
}

// ==================================================
// HELPERS
// ==================================================

function numericOrNull(value) {
  if (
    value === "" ||
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const numeric = Number(value);

  return Number.isFinite(numeric)
    ? numeric
    : null;
}

function roundMoney(value) {
  return (
    Math.round(
      (Number(value) + Number.EPSILON) * 100
    ) / 100
  );
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

// ==================================================
// STYLES
// ==================================================

const panelStyle = {
  marginTop: 24,
  backgroundColor: "white",
  padding: 25,
  borderRadius: 12,
  boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
  maxWidth: 700,
};

const outputStyle = {
  padding: 16,
  backgroundColor: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  marginBottom: 22,
};

const buttonStyle = {
  width: "100%",
  padding: 14,
  border: "none",
  borderRadius: 8,
  color: "white",
  fontWeight: "bold",
  fontSize: 16,
  cursor: "pointer",
};

function noticeStyle(good) {
  return {
    padding: 12,
    marginBottom: 16,
    borderRadius: 8,
    backgroundColor: good
      ? "#ecfdf5"
      : "#fff7ed",
    color: good
      ? "#166534"
      : "#9a3412",
  };
}
