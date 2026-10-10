"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const navy = "#073b5c";

const field = {
  boxSizing: "border-box", width: "100%", padding: "9px 10px",
  border: "1px solid #cbd5e1", borderRadius: 7,
  background: "#fff", color: "#0f172a", fontSize: 12,
};

const primary = {
  padding: "8px 12px", border: `1px solid ${navy}`, borderRadius: 7,
  background: navy, color: "white", fontSize: 12, fontWeight: 750,
  cursor: "pointer",
};

const secondary = { ...primary, background: "white", color: navy };

function todayNairobi() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const p = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

function isMonday(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.getUTCDay() === 1 &&
    date.toISOString().slice(0, 10) === value;
}

function cycleDay(dateString, anchor) {
  if (!dateString || !anchor) return null;
  const one = Date.parse(`${dateString}T12:00:00Z`);
  const two = Date.parse(`${anchor}T12:00:00Z`);
  if (!Number.isFinite(one) || !Number.isFinite(two)) return null;
  const diff = Math.round((one - two) / 86400000);
  return ((diff % 14) + 14) % 14;
}

function readableTime(time) {
  return String(time || "").slice(0, 5);
}

export default function AdminDutyControlPanel({
  supabaseUrl, supabaseAnonKey, accessToken, onChanged,
}) {
  const [week, setWeek] = useState(1);
  const [people, setPeople] = useState([]);
  const [shops, setShops] = useState([]);
  const [rules, setRules] = useState([]);
  const [offs, setOffs] = useState([]);
  const [halfDays, setHalfDays] = useState([]);
  const [version, setVersion] = useState(null);
  const [anchor, setAnchor] = useState("");
  const [savedAnchor, setSavedAnchor] = useState("");
  const [editor, setEditor] = useState(null);
  const [reliever, setReliever] = useState("");
  const [covered, setCovered] = useState("");
  const [offEmployee, setOffEmployee] = useState("");
  const [mode, setMode] = useState("MOVE");
  const [fromDate, setFromDate] = useState(todayNairobi);
  const [toDate, setToDate] = useState(todayNairobi);
  const [personA, setPersonA] = useState("");
  const [target, setTarget] = useState("");
  const [halfShop, setHalfShop] = useState("");
  const [handover, setHandover] = useState("");
  const [openTime, setOpenTime] = useState("09:00");
  const [handoverTime, setHandoverTime] = useState("15:00");
  const [closeTime, setCloseTime] = useState("22:00");
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const baseUrl = useMemo(
    () => String(supabaseUrl || "").replace(/\/+$/, ""),
    [supabaseUrl]
  );

  const rpc = useCallback(async (name, args = {}, signal) => {
    if (!baseUrl || !supabaseAnonKey || !accessToken) {
      throw new Error("Admin login required.");
    }

    const response = await fetch(`${baseUrl}/rest/v1/rpc/${name}`, {
      method: "POST", cache: "no-store",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
      ...(signal ? { signal } : {}),
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        body?.message || body?.details ||
        `${name} failed (${response.status})`
      );
    }

    return body;
  }, [baseUrl, supabaseAnonKey, accessToken]);

  const load = useCallback(async (signal) => {
    const [rota, extras, master, shopOptions] = await Promise.all([
      rpc("tl_rota_relief_get", {}, signal),
      rpc("tl_rota_extra_get", {
        p_start_date: todayNairobi(), p_days: 62,
      }, signal),
      rpc("tl_admin_master_employee_list", {}, signal),
      rpc("tl_admin_master_employee_shops_v1", {}, signal),
    ]);

    if (
      !rota || !Array.isArray(rota.pairs) ||
      !extras || !Array.isArray(extras.offs) ||
      !Array.isArray(extras.half_days) ||
      !Array.isArray(master) || !Array.isArray(shopOptions)
    ) {
      throw new Error("Master rota data unavailable.");
    }

    if (signal?.aborted) return;

    setRules(rota.pairs);
    setOffs(extras.offs);
    setHalfDays(extras.half_days);
    setVersion(Number(rota.version));
    setAnchor(rota.anchor_monday);
    setSavedAnchor(rota.anchor_monday);
    setPeople(master);
    setShops(shopOptions);
  }, [rpc]);

  useEffect(() => {
    const controller = new AbortController();

    if (!baseUrl || !supabaseAnonKey || !accessToken) {
      setLoading(false);
      return () => controller.abort();
    }

    setLoading(true);
    load(controller.signal)
      .catch((e) => {
        if (e?.name !== "AbortError") {
          setError(e?.message || "Load failed.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [baseUrl, supabaseAnonKey, accessToken, load]);

  // Automatically include names added to the Master Employee List.
  useEffect(() => {
    if (!baseUrl || !supabaseAnonKey || !accessToken) return;

    const timer = setInterval(() => {
      rpc("tl_admin_master_employee_list")
        .then((rows) => {
          if (Array.isArray(rows)) setPeople(rows);
        })
        .catch(() => {});
    }, 60000);

    return () => clearInterval(timer);
  }, [baseUrl, supabaseAnonKey, accessToken, rpc]);

  const active = useMemo(
    () => people
      .filter((p) => p.employment_status === "ACTIVE")
      .sort((a, b) =>
        String(a.full_name).localeCompare(String(b.full_name))
      ),
    [people]
  );

  const peopleById = useMemo(
    () => new Map(people.map((p) => [p.employee_id, p])),
    [people]
  );

  const shopById = useMemo(
    () => new Map(shops.map((s) => [s.id, s.name])),
    [shops]
  );

  const category = (id) => {
    const p = peopleById.get(id);
    if (!p) return "";

    if (p.shop_id) return shopById.get(p.shop_id) || "Shop";
    if (p.job_title === "TEAM_LEADER") return "Team Leader";
    if (p.job_title === "ACCOUNTANT") return "Accountant";

    return "Reliever";
  };

  const name = (id) => peopleById.get(id)?.full_name || "Unknown";

  const personOptions = active.map((p) => (
    <option key={p.employee_id} value={p.employee_id}>
      {p.full_name} — {category(p.employee_id)}
    </option>
  ));

  const byDay = useMemo(() => {
    const days = Array.from(
      { length: 7 },
      () => ({ pairs: [], offs: [] })
    );

    for (const pair of rules) {
      const index = Number(pair.cycle_day) - (week - 1) * 7;
      if (index >= 0 && index < 7) days[index].pairs.push(pair);
    }

    for (const off of offs) {
      const index = Number(off.cycle_day) - (week - 1) * 7;
      if (index >= 0 && index < 7) days[index].offs.push(off);
    }

    return days;
  }, [rules, offs, week]);

  function beginEdit(day, kind, pair = null) {
    setEditor({
      day,
      kind,
      originalCovered: pair?.covered_employee_id || null,
    });

    setReliever(pair?.reliever_employee_id || "");
    setCovered(pair?.covered_employee_id || "");
    setOffEmployee("");
    setError("");
    setNotice("");
  }

  function reasonOK() {
    if (reason.trim().length >= 3) return true;
    setError("Reason required.");
    return false;
  }

  async function save(functionName, args, successMessage) {
    if (busy || !reasonOK()) return false;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const response = await rpc(functionName, {
        ...args,
        p_reason: reason.trim(),
        p_expected_version: version,
      });

      if (response?.success !== true) {
        throw new Error("Save not confirmed.");
      }

      await load();
      setReason("");
      setEditor(null);
      setPreview(null);
      setNotice(successMessage);
      onChanged?.();

      return true;
    } catch (e) {
      setError(e?.message || "Save failed. Refresh and retry.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function savePair() {
    if (!editor || !reliever || !covered || reliever === covered) {
      setError("Choose two different employees.");
      return;
    }

    const cycle = (week - 1) * 7 + editor.day;

    if (
      offs.some(
        (o) => Number(o.cycle_day) === cycle &&
          [reliever, covered].includes(o.employee_id)
      )
    ) {
      setError("Employee is OFF that day.");
      return;
    }

    await save("tl_rota_relief_set", {
      p_week: week,
      p_day: editor.day + 1,
      p_reliever_employee_id: reliever,
      p_covered_employee_id: covered,
    }, "Relief saved.");
  }

  async function saveOff() {
    if (!editor || !offEmployee) {
      setError("Choose employee.");
      return;
    }

    await save("tl_rota_off_set", {
      p_week: week,
      p_day: editor.day + 1,
      p_employee_id: offEmployee,
    }, "OFF saved.");
  }

  async function removePair(day, pair) {
    if (
      !window.confirm(
        `Remove ${name(pair.reliever_employee_id)} → ${name(pair.covered_employee_id)}?`
      )
    ) return;

    await save("tl_rota_relief_remove", {
      p_week: week,
      p_day: day + 1,
      p_covered_employee_id: pair.covered_employee_id,
    }, "Relief removed.");
  }

  async function removeOff(day, employeeId) {
    if (!window.confirm(`Remove OFF for ${name(employeeId)}?`)) {
      return;
    }

    await save("tl_rota_off_remove", {
      p_week: week,
      p_day: day + 1,
      p_employee_id: employeeId,
    }, "OFF removed.");
  }

  async function setMonday() {
    if (!isMonday(anchor)) {
      setError("Select Monday.");
      return;
    }

    if (rules.length || offs.length) {
      setError("Cycle start is locked.");
      return;
    }

    if (anchor === savedAnchor) return;

    await save("tl_rota_relief_anchor_set", {
      p_anchor_monday: anchor,
    }, "Start saved.");
  }

  // TEMPORARY MOVE / SHOP SWAP / HALF-DAY

  async function applyTemporary() {
    if (
      !fromDate || !toDate ||
      fromDate > toDate ||
      fromDate < todayNairobi()
    ) {
      setError("Check dates.");
      return;
    }

    if (!personA) {
      setError("Choose employee.");
      return;
    }

    if (mode === "HALF") {
      if (!halfShop || !handover || personA === handover) {
        setError("Choose shop and handover cashier.");
        return;
      }

      if (
        !openTime || !handoverTime || !closeTime ||
        !(openTime < handoverTime && handoverTime < closeTime)
      ) {
        setError("Check working times.");
        return;
      }

      if (
        !window.confirm(
          `Save temporary Half-Day ${fromDate} to ${toDate}?`
        )
      ) return;

      await save("tl_rota_halfday_set", {
        p_start_date: fromDate,
        p_end_date: toDate,
        p_reliever_employee_id: personA,
        p_shop_id: halfShop,
        p_handover_employee_id: handover,
        p_open_time: openTime,
        p_handover_time: handoverTime,
        p_close_time: closeTime,
      }, "Half-Day saved.");

    } else {
      if (!target || personA === target) {
        setError("Choose two different employees.");
        return;
      }

      if (
        !window.confirm(
          `Apply ${mode} ${fromDate} to ${toDate}?`
        )
      ) return;

      if (mode === "MOVE") {
        // Ordinary Master employee moves to cover another cashier.
        // Original Master shop assignments are never modified.
        await save("tl_rota_shop_move_set", {
          p_start_date: fromDate,
          p_end_date: toDate,
          p_moving_employee_id: personA,
          p_covered_employee_id: target,
        }, "Shop move saved.");

      } else {
        await save("tl_rota_shop_swap_set", {
          p_start_date: fromDate,
          p_end_date: toDate,
          p_employee_a: personA,
          p_employee_b: target,
        }, "Shop swap saved.");
      }
    }
  }

  // VIEW DATE, INCLUDING TEMPORARY MOVES

  async function fetchDatePreview(date) {
    const [
      duty, extra, changes, shopSwaps, shopMoves,
    ] = await Promise.all([
      rpc("tl_rota_relief_preview", {
        p_start_date: date, p_days: 1,
      }),
      rpc("tl_rota_extra_get", {
        p_start_date: date, p_days: 1,
      }),
      rpc("tl_rota_temp_changes_get", {
        p_start_date: date, p_days: 1,
      }),
      rpc("tl_rota_shop_swap_get", {
        p_start_date: date, p_days: 1,
      }),
      rpc("tl_rota_shop_move_get", {
        p_start_date: date, p_days: 1,
      }),
    ]);

    if (
      !Array.isArray(changes) ||
      !Array.isArray(shopSwaps) ||
      !Array.isArray(shopMoves)
    ) {
      throw new Error("Temporary changes could not be loaded.");
    }

    const swapGroups = new Map();

    for (const swap of shopSwaps) {
      if (!swapGroups.has(swap.change_id)) {
        swapGroups.set(swap.change_id, {
          kind: "SHOP_SWAP",
          change_id: swap.change_id,
          entries: [],
        });
      }

      swapGroups.get(swap.change_id).entries.push(swap);
    }

    const moveGroups = new Map();

    for (const move of shopMoves) {
      if (!moveGroups.has(move.change_id)) {
        moveGroups.set(move.change_id, {
          kind: "SHOP_MOVE",
          change_id: move.change_id,
          entries: [],
        });
      }

      moveGroups.get(move.change_id).entries.push(move);
    }

    // Include temporary OFF employees without changing recurring OFF days.

    const dateOffs = (extra.offs || []).filter(
      (o) =>
        Number(o.cycle_day) ===
        cycleDay(date, savedAnchor)
    );

    const offIds = new Set(
      dateOffs.map((o) => o.employee_id)
    );

    for (const move of shopMoves) {
      if (!offIds.has(move.covered_employee_id)) {
        dateOffs.push({
          employee_id: move.covered_employee_id,
          temporary: true,
        });

        offIds.add(move.covered_employee_id);
      }
    }

    setPreview({
      date,
      duties: Array.isArray(duty) ? duty : [],
      offs: dateOffs,
      changes: [
        ...changes,
        ...swapGroups.values(),
        ...moveGroups.values(),
      ],
    });
  }

  async function viewDate() {
    if (!fromDate) {
      setError("Choose date.");
      return;
    }

    if (busy) return;

    setBusy(true);
    setError("");

    try {
      await fetchDatePreview(fromDate);
    } catch (e) {
      setError(e?.message || "Preview failed.");
    } finally {
      setBusy(false);
    }
  }

  // CANCEL TEMPORARY CHANGE

  async function cancelTemporary(changeId, kind) {
    if (busy || !changeId || !reasonOK()) return;

    if (
      !window.confirm(
        "Cancel this change for all remaining future dates?"
      )
    ) return;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const cancelRpc =
        kind === "SHOP_SWAP"
          ? "tl_rota_shop_swap_cancel"
          : kind === "SHOP_MOVE"
            ? "tl_rota_shop_move_cancel"
            : "tl_rota_temp_cancel";

      const result = await rpc(cancelRpc, {
        p_change_id: changeId,
        p_reason: reason.trim(),
        p_expected_version: version,
      });

      if (result?.success !== true) {
        throw new Error("Cancel not confirmed.");
      }

      await load();
      await fetchDatePreview(fromDate);

      setReason("");
      setNotice(
        "Temporary change canceled. Original rota restored."
      );

      onChanged?.();
    } catch (e) {
      setError(
        e?.message || "Cancel failed. Refresh and retry."
      );
    } finally {
      setBusy(false);
    }
  }

  function temporaryLine(entry, kind) {
    if (kind === "SHOP_MOVE") {
      const from =
        shopById.get(entry.from_shop_id) || "Original shop";

      const to =
        shopById.get(entry.to_shop_id) || "Destination shop";

      return (
        `${name(entry.moving_employee_id)}: ${from} → ${to}` +
        ` · ${name(entry.covered_employee_id)} — OFF` +
        ` · ${from} — VACANT`
      );
    }

    if (kind === "SHOP_SWAP") {
      const shopA =
        shopById.get(entry.employee_a_destination_shop) || "Shop";

      const shopB =
        shopById.get(entry.employee_b_destination_shop) || "Shop";

      return (
        `${name(entry.employee_a_id)} → ${shopA}` +
        ` · ${name(entry.employee_b_id)} → ${shopB}`
      );
    }

    if (kind === "HALF_DAY") {
      return (
        `${name(entry.reliever_employee_id)} → ` +
        `${shopById.get(entry.shop_id) || "Shop"}` +
        ` · ${readableTime(entry.open_time)}` +
        `–${readableTime(entry.handover_time)}` +
        ` → ${name(entry.handover_employee_id)}` +
        ` (until ${readableTime(entry.close_time)})`
      );
    }

    return entry.reliever_employee_id
      ? `${name(entry.reliever_employee_id)} relieves ${name(entry.covered_employee_id)}`
      : `${name(entry.covered_employee_id)} · relief removed for this date`;
  }

  if (!baseUrl || !supabaseAnonKey || !accessToken) {
    return <div role="alert">Admin login required.</div>;
  }

  if (loading) {
    return <div>Loading rota...</div>;
  }

  return (
    <section
      style={{
        border: "1px solid #cbd5e1",
        borderRadius: 12,
        background: "white",
        overflow: "hidden",
        color: "#0f172a",
      }}
    >
      <div
        style={{
          padding: 14,
          background: navy,
          color: "white",
          display: "flex",
          gap: 9,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <strong style={{ marginRight: 8 }}>DUTY / ROTA</strong>

        {[1, 2].map((w) => (
          <button
            key={w}
            type="button"
            style={{
              ...secondary,
              background: week === w ? "#a5f3fc" : "white",
            }}
            onClick={() => {
              setWeek(w);
              setEditor(null);
            }}
          >
            Week {w}
          </button>
        ))}

        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
          }}
        >
          <span>Start</span>

          <input
            type="date"
            aria-label="Cycle start Monday"
            style={{ ...field, width: 150 }}
            value={anchor}
            disabled={
              busy || rules.length > 0 || offs.length > 0
            }
            onChange={(e) => setAnchor(e.target.value)}
          />

          {!rules.length &&
            !offs.length &&
            anchor !== savedAnchor && (
              <button
                type="button"
                style={secondary}
                disabled={busy}
                onClick={setMonday}
              >
                Set
              </button>
            )}

          <button
            type="button"
            style={secondary}
            disabled={busy}
            onClick={() =>
              load()
                .then(() => {
                  setError("");
                  setNotice("Refreshed.");
                })
                .catch((e) => setError(e.message))
            }
          >
            ↻
          </button>
        </div>
      </div>

      {/* EXISTING COMPACT WEEKLY ROTA */}

      <div style={{ padding: 12, display: "grid", gap: 8 }}>
        {DAYS.map((dayName, day) => (
          <div
            key={dayName}
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 9,
              padding: "10px 12px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
              }}
            >
              <strong>{dayName}</strong>

              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  style={{ ...secondary, padding: "4px 9px" }}
                  disabled={busy}
                  onClick={() => beginEdit(day, "RELIEF")}
                >
                  + Relief
                </button>

                <button
                  type="button"
                  style={{ ...secondary, padding: "4px 9px" }}
                  disabled={busy}
                  onClick={() => beginEdit(day, "OFF")}
                >
                  + OFF
                </button>
              </div>
            </div>

            {byDay[day].pairs.length === 0 &&
              byDay[day].offs.length === 0 && (
                <span
                  style={{ color: "#94a3b8", fontSize: 12 }}
                >
                  —
                </span>
              )}

            {byDay[day].pairs.map((pair) => (
              <div
                key={`relief-${pair.covered_employee_id}`}
                style={{
                  display: "flex",
                  gap: 7,
                  alignItems: "center",
                  marginTop: 7,
                  flexWrap: "wrap",
                }}
              >
                <span style={{ flex: 1, fontSize: 13 }}>
                  <b>{name(pair.reliever_employee_id)}</b>
                  {" "}relieves{" "}
                  <b>{name(pair.covered_employee_id)}</b>

                  <span
                    style={{ fontSize: 11, color: "#64748b" }}
                  >
                    {" "}· {category(pair.covered_employee_id)}
                  </span>
                </span>

                <button
                  type="button"
                  style={{ ...secondary, padding: "3px 8px" }}
                  disabled={busy}
                  onClick={() => beginEdit(day, "RELIEF", pair)}
                >
                  Edit
                </button>

                <button
                  type="button"
                  style={{ ...secondary, padding: "3px 8px" }}
                  disabled={busy}
                  onClick={() => removePair(day, pair)}
                >
                  ×
                </button>
              </div>
            ))}

            {byDay[day].offs.map((off) => (
              <div
                key={`off-${off.employee_id}`}
                style={{
                  display: "flex",
                  gap: 7,
                  alignItems: "center",
                  marginTop: 7,
                  flexWrap: "wrap",
                }}
              >
                <span style={{ flex: 1, fontSize: 13 }}>
                  <b>{name(off.employee_id)}</b>{" "}
                  <b style={{ color: "#b91c1c" }}>— OFF</b>
                </span>

                <button
                  type="button"
                  style={{ ...secondary, padding: "3px 8px" }}
                  disabled={busy}
                  onClick={() => removeOff(day, off.employee_id)}
                >
                  ×
                </button>
              </div>
            ))}

            {editor?.day === day && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit,minmax(180px,1fr))",
                  gap: 8,
                  background: "#f8fafc",
                  marginTop: 10,
                  padding: 10,
                  borderRadius: 8,
                }}
              >
                {editor.kind === "RELIEF" ? (
                  <>
                    <label style={{ fontSize: 12 }}>
                      Reliever

                      <select
                        style={field}
                        value={reliever}
                        disabled={busy}
                        onChange={(e) =>
                          setReliever(e.target.value)
                        }
                      >
                        <option value="">Choose employee</option>
                        {personOptions}
                      </select>
                    </label>

                    <label style={{ fontSize: 12 }}>
                      Relieves

                      <select
                        style={field}
                        value={covered}
                        disabled={busy || !!editor.originalCovered}
                        onChange={(e) =>
                          setCovered(e.target.value)
                        }
                      >
                        <option value="">Choose employee</option>
                        {personOptions}
                      </select>
                    </label>
                  </>
                ) : (
                  <label style={{ fontSize: 12 }}>
                    Employee OFF

                    <select
                      style={field}
                      value={offEmployee}
                      disabled={busy}
                      onChange={(e) =>
                        setOffEmployee(e.target.value)
                      }
                    >
                      <option value="">Choose employee</option>
                      {personOptions}
                    </select>
                  </label>
                )}

                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    alignItems: "end",
                  }}
                >
                  <button
                    type="button"
                    style={primary}
                    disabled={busy}
                    onClick={
                      editor.kind === "OFF" ? saveOff : savePair
                    }
                  >
                    Save
                  </button>

                  <button
                    type="button"
                    style={secondary}
                    disabled={busy}
                    onClick={() => setEditor(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* TEMPORARY MOVE / SWAP / HALF-DAY */}

      <div
        style={{
          borderTop: "1px solid #e2e8f0",
          padding: 14,
          display: "grid",
          gap: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 7,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <strong>Temporary</strong>

          {[
            ["MOVE", "Move"],
            ["SWAP", "Swap"],
            ["HALF", "Half-Day"],
          ].map(([key, label]) => (
            <button
              type="button"
              key={key}
              style={{
                ...secondary,
                background: mode === key ? "#cffafe" : "white",
              }}
              onClick={() => {
                setMode(key);
                setPreview(null);
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gap: 9,
            gridTemplateColumns:
              "repeat(auto-fit,minmax(180px,1fr))",
          }}
        >
          <label style={{ fontSize: 12 }}>
            From

            <input
              type="date"
              style={field}
              value={fromDate}
              min={todayNairobi()}
              onChange={(e) => {
                setFromDate(e.target.value);
                if (e.target.value > toDate) {
                  setToDate(e.target.value);
                }
                setPreview(null);
              }}
            />
          </label>

          <label style={{ fontSize: 12 }}>
            To

            <input
              type="date"
              style={field}
              value={toDate}
              min={fromDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPreview(null);
              }}
            />
          </label>

          <label style={{ fontSize: 12 }}>
            {mode === "HALF" ? "Opening employee" : "Cashier"}

            <select
              style={field}
              value={personA}
              onChange={(e) => setPersonA(e.target.value)}
            >
              <option value="">Choose employee</option>
              {personOptions}
            </select>
          </label>

          {mode === "HALF" ? (
            <>
              <label style={{ fontSize: 12 }}>
                Shop

                <select
                  style={field}
                  value={halfShop}
                  onChange={(e) => setHalfShop(e.target.value)}
                >
                  <option value="">Choose shop</option>
                  {shops.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ fontSize: 12 }}>
                Handover cashier

                <select
                  style={field}
                  value={handover}
                  onChange={(e) => setHandover(e.target.value)}
                >
                  <option value="">Choose employee</option>
                  {personOptions}
                </select>
              </label>
            </>
          ) : (
            <label style={{ fontSize: 12 }}>
              {mode === "MOVE"
                ? "Moved to (relieve)"
                : "Swapped with"}

              <select
                style={field}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              >
                <option value="">Choose employee</option>
                {personOptions}
              </select>
            </label>
          )}
        </div>

        {mode === "HALF" && (
          <div
            style={{
              display: "grid",
              gap: 9,
              gridTemplateColumns: "repeat(3,minmax(0,1fr))",
            }}
          >
            <label style={{ fontSize: 12 }}>
              Open
              <input
                aria-label="Opening time"
                type="time"
                style={field}
                value={openTime}
                onChange={(e) => setOpenTime(e.target.value)}
              />
            </label>

            <label style={{ fontSize: 12 }}>
              Handover
              <input
                aria-label="Handover time"
                type="time"
                style={field}
                value={handoverTime}
                onChange={(e) => setHandoverTime(e.target.value)}
              />
            </label>

            <label style={{ fontSize: 12 }}>
              Close
              <input
                aria-label="Closing time"
                type="time"
                style={field}
                value={closeTime}
                onChange={(e) => setCloseTime(e.target.value)}
              />
            </label>
          </div>
        )}

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            style={primary}
            disabled={busy}
            onClick={applyTemporary}
          >
            Apply{" "}
            {mode === "HALF"
              ? "Half-Day"
              : mode === "MOVE"
                ? "Move"
                : "Swap"}
          </button>

          <button
            type="button"
            style={secondary}
            disabled={busy}
            onClick={viewDate}
          >
            View date
          </button>
        </div>

        {/* DATE PREVIEW AND TEMPORARY CANCEL */}

        {preview && (
          <div
            style={{
              background: "#f8fafc",
              padding: 10,
              borderRadius: 8,
              display: "grid",
              gap: 7,
              fontSize: 12,
            }}
          >
            <strong>{preview.date}</strong>

            {preview.duties.map((p, i) => (
              <div key={`d-${i}`}>
                {name(p.reliever_employee_id)} relieves{" "}
                {name(p.covered_employee_id)}
                {p.temporary ? " · Temporary" : ""}
              </div>
            ))}

            {preview.offs.map((o) => (
              <div key={`o-${o.employee_id}`}>
                {name(o.employee_id)} — OFF
                {o.temporary ? " · Temporary" : ""}
              </div>
            ))}

            {preview.changes.length > 0 ? (
              <div
                style={{
                  borderTop: "1px solid #cbd5e1",
                  paddingTop: 9,
                  display: "grid",
                  gap: 8,
                }}
              >
                <strong>Saved temporary changes</strong>

                {preview.changes.map((change) => (
                  <div
                    key={`${change.kind}-${change.change_id}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 8,
                      border: "1px solid #e2e8f0",
                      background: "white",
                      padding: 8,
                      borderRadius: 7,
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gap: 3,
                        flex: 1,
                      }}
                    >
                      <b>
                        {change.kind === "HALF_DAY"
                          ? "Half-Day"
                          : change.kind === "SHOP_SWAP"
                            ? "Shop Swap"
                            : change.kind === "SHOP_MOVE"
                              ? "Shop Move"
                              : "Relief Move / Swap"}
                      </b>

                      {(change.entries || []).map(
                        (entry, index) => (
                          <span key={index}>
                            {temporaryLine(entry, change.kind)}
                          </span>
                        )
                      )}
                    </div>

                    <button
                      type="button"
                      style={{
                        ...secondary,
                        padding: "5px 10px",
                      }}
                      disabled={
                        busy || preview.date < todayNairobi()
                      }
                      onClick={() =>
                        cancelTemporary(
                          change.change_id,
                          change.kind
                        )
                      }
                    >
                      Cancel
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <span style={{ color: "#64748b" }}>
                No temporary changes for this date.
              </span>
            )}
          </div>
        )}

        {!!halfDays.length && (
          <span
            style={{ color: "#64748b", fontSize: 11 }}
          >
            Upcoming Half-Days: {halfDays.length}
          </span>
        )}
      </div>

      {/* ONE SHARED REASON FIELD */}

      <div
        style={{
          borderTop: "1px solid #e2e8f0",
          padding: 14,
          display: "grid",
          gap: 8,
        }}
      >
        <label
          htmlFor="rota-reason"
          style={{ fontSize: 12, fontWeight: 800 }}
        >
          Reason
        </label>

        <textarea
          id="rota-reason"
          rows={2}
          style={{ ...field, resize: "vertical" }}
          placeholder="Reason for change"
          value={reason}
          disabled={busy}
          onChange={(e) => setReason(e.target.value)}
        />

        {notice && (
          <span
            role="status"
            style={{ color: "#15803d", fontSize: 12 }}
          >
            {notice}
          </span>
        )}

        {error && (
          <span
            role="alert"
            style={{ color: "#b91c1c", fontSize: 12 }}
          >
            {error}
          </span>
        )}
      </div>
    </section>
  );
}
