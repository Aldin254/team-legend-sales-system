"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const blue = "#073b5c";
const field = {
  width: "100%", boxSizing: "border-box", padding: "9px 10px",
  border: "1px solid #cbd5e1", borderRadius: 7, background: "#fff",
  color: "#0f172a", fontSize: 13,
};
const btn = {
  padding: "8px 12px", borderRadius: 7, border: `1px solid ${blue}`,
  background: blue, color: "#fff", fontSize: 12,
  fontWeight: 750, cursor: "pointer",
};
const lightBtn = { ...btn, background: "#fff", color: blue };

function nairobiToday() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const p = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

function isMonday(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.getUTCDay() === 1;
}

export default function AdminDutyControlPanel({
  supabaseUrl, supabaseAnonKey, accessToken, onChanged,
}) {
  const [week, setWeek] = useState(1);
  const [master, setMaster] = useState([]);
  const [shops, setShops] = useState([]);
  const [rules, setRules] = useState([]);
  const [version, setVersion] = useState(null);
  const [anchor, setAnchor] = useState("");
  const [savedAnchor, setSavedAnchor] = useState("");
  const [editor, setEditor] = useState(null);
  const [reliever, setReliever] = useState("");
  const [covered, setCovered] = useState("");
  const [mode, setMode] = useState("MOVE");
  const [fromDate, setFromDate] = useState(nairobiToday);
  const [toDate, setToDate] = useState(nairobiToday);
  const [personA, setPersonA] = useState("");
  const [target, setTarget] = useState("");
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

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
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.message || data?.details || `${name} failed (${response.status})`);
    }
    return data;
  }, [baseUrl, supabaseAnonKey, accessToken]);

  const load = useCallback(async (signal) => {
    const [rota, people, shopOptions] = await Promise.all([
      rpc("tl_rota_relief_get", {}, signal),
      rpc("tl_admin_master_employee_list", {}, signal),
      rpc("tl_admin_master_employee_shops_v1", {}, signal),
    ]);
    if (!rota || !Array.isArray(rota.pairs) || !Array.isArray(people) ||
        !Array.isArray(shopOptions)) {
      throw new Error("Master rota data not available.");
    }
    if (signal?.aborted) return;
    setRules(rota.pairs);
    setVersion(Number(rota.version));
    setSavedAnchor(rota.anchor_monday);
    setAnchor(rota.anchor_monday);
    setMaster(people);
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
      .catch((e) => { if (e.name !== "AbortError") setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [baseUrl, supabaseAnonKey, accessToken, load]);

  // New Master employees appear without manually adding them to the rota.
  useEffect(() => {
    if (!baseUrl || !supabaseAnonKey || !accessToken) return;
    const timer = setInterval(() => {
      rpc("tl_admin_master_employee_list")
        .then((people) => { if (Array.isArray(people)) setMaster(people); })
        .catch(() => {});
    }, 60000);
    return () => clearInterval(timer);
  }, [baseUrl, supabaseAnonKey, accessToken, rpc]);

  const available = useMemo(
    () => master.filter((p) => p.employment_status === "ACTIVE")
      .sort((a, b) => String(a.full_name).localeCompare(String(b.full_name))),
    [master]
  );
  const peopleById = useMemo(
    () => new Map(master.map((p) => [p.employee_id, p])), [master]
  );
  const shopById = useMemo(
    () => new Map(shops.map((s) => [s.id, s.name])), [shops]
  );
  const category = (person) => {
    if (!person) return "";
    if (person.shop_id) return shopById.get(person.shop_id) || "Shop";
    if (person.job_title === "TEAM_LEADER") return "Team Leader";
    if (person.job_title === "ACCOUNTANT") return "Accountant";
    return "Reliever";
  };
  const name = (id) => peopleById.get(id)?.full_name || "Unknown employee";
  const personOptions = available.map((p) => (
    <option key={p.employee_id} value={p.employee_id}>
      {p.full_name} — {category(p)}
    </option>
  ));
  const byDay = useMemo(() => {
    const days = Array.from({ length: 7 }, () => []);
    for (const pair of rules) {
      const index = Number(pair.cycle_day) - (week - 1) * 7;
      if (index >= 0 && index < 7) days[index].push(pair);
    }
    return days;
  }, [rules, week]);

  function beginAdd(day) {
    setEditor({ day, originalCovered: null });
    setReliever("");
    setCovered("");
    setError("");
    setNotice("");
  }
  function beginEdit(day, pair) {
    setEditor({ day, originalCovered: pair.covered_employee_id });
    setReliever(pair.reliever_employee_id);
    setCovered(pair.covered_employee_id);
    setError("");
    setNotice("");
  }
  function validReason() {
    if (reason.trim().length < 3) {
      setError("Reason required.");
      return false;
    }
    return true;
  }

  async function save(nameOfRpc, args, message) {
    if (busy || !validReason()) return false;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await rpc(nameOfRpc, {
        ...args, p_reason: reason.trim(), p_expected_version: version,
      });
      if (result?.success !== true) throw new Error("Save not confirmed.");
      await load();
      setReason("");
      setEditor(null);
      setPreview(null);
      setNotice(message);
      onChanged?.();
      return true;
    } catch (e) {
      setError(e.message || "Save failed.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function savePair() {
    if (!editor) return;
    if (!reliever || !covered || reliever === covered) {
      setError("Choose two different employees.");
      return;
    }
    await save("tl_rota_relief_set", {
      p_week: week, p_day: editor.day + 1,
      p_reliever_employee_id: reliever,
      p_covered_employee_id: covered,
    }, "Saved.");
  }

  async function removePair(day, pair) {
    if (!window.confirm(`Remove ${name(pair.reliever_employee_id)} → ${name(pair.covered_employee_id)}?`)) return;
    await save("tl_rota_relief_remove", {
      p_week: week, p_day: day + 1,
      p_covered_employee_id: pair.covered_employee_id,
    }, "Removed.");
  }

  async function setMonday() {
    if (!isMonday(anchor)) {
      setError("Choose a Monday.");
      return;
    }
    if (rules.length) {
      setError("Start date is locked after assignments are saved.");
      return;
    }
    if (anchor === savedAnchor) return;
    await save("tl_rota_relief_anchor_set", {
      p_anchor_monday: anchor,
    }, "Start saved.");
  }

  async function applyTemporary() {
    if (!fromDate || !toDate || fromDate > toDate) {
      setError("Check dates.");
      return;
    }
    if (!personA || !target || personA === target) {
      setError("Choose two different employees.");
      return;
    }
    if (!window.confirm(`Apply ${mode.toLowerCase()} ${fromDate} to ${toDate}?`)) return;
    if (mode === "MOVE") {
      await save("tl_rota_relief_move", {
        p_start_date: fromDate, p_end_date: toDate,
        p_reliever_id: personA,
        p_to_covered_employee_id: target,
      }, "Move saved.");
    } else {
      await save("tl_rota_relief_swap", {
        p_start_date: fromDate, p_end_date: toDate,
        p_reliever_a: personA,
        p_reliever_b: target,
      }, "Swap saved.");
    }
  }

  async function viewDate() {
    setError("");
    try {
      const result = await rpc("tl_rota_relief_preview", {
        p_start_date: fromDate, p_days: 1,
      });
      setPreview(Array.isArray(result) ? result : []);
    } catch (e) {
      setError(e.message || "Preview failed.");
    }
  }

  if (!baseUrl || !supabaseAnonKey || !accessToken) {
    return <div role="alert">Admin login required.</div>;
  }
  if (loading) return <div>Loading rota...</div>;

  return (
    <section style={{ border: "1px solid #cbd5e1", borderRadius: 12,
      background: "#fff", overflow: "hidden", color: "#0f172a" }}>
      <div style={{ padding: 14, background: blue, color: "#fff",
        display: "flex", flexWrap: "wrap", alignItems: "center", gap: 9 }}>
        <strong style={{ marginRight: 10 }}>DUTY / ROTA</strong>
        {[1, 2].map((w) => (
          <button key={w} type="button" onClick={() => { setWeek(w); setEditor(null); }}
            style={{ ...lightBtn, background: week === w ? "#a5f3fc" : "#fff" }}>
            Week {w}
          </button>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6,
          alignItems: "center", flexWrap: "wrap", fontSize: 12 }}>
          <span>Start</span>
          <input aria-label="Cycle start Monday" type="date" value={anchor}
            disabled={busy || rules.length > 0} onChange={(e) => setAnchor(e.target.value)}
            style={{ ...field, width: 146 }} />
          {!rules.length && anchor !== savedAnchor && (
            <button type="button" onClick={setMonday} disabled={busy} style={lightBtn}>Set</button>
          )}
          <button type="button" style={lightBtn} disabled={busy}
            onClick={async () => { try { await load(); setNotice("Refreshed."); setError(""); }
              catch (e) { setError(e.message); } }}>↻</button>
        </div>
      </div>

      <div style={{ padding: 12, display: "grid", gap: 8 }}>
        {DAYS.map((dayName, day) => (
          <div key={dayName} style={{ border: "1px solid #e2e8f0",
            borderRadius: 9, padding: "10px 12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between",
              alignItems: "center", gap: 8 }}>
              <strong>{dayName}</strong>
              <button type="button" style={{ ...lightBtn, padding: "4px 10px" }}
                onClick={() => beginAdd(day)} disabled={busy}>+ Add</button>
            </div>
            {byDay[day].length === 0 && <div style={{ color: "#94a3b8", fontSize: 12 }}>—</div>}
            {byDay[day].map((pair) => (
              <div key={pair.covered_employee_id} style={{ display: "flex",
                alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                <span style={{ flex: 1, fontSize: 13 }}>
                  <b>{name(pair.reliever_employee_id)}</b> relieves <b>{name(pair.covered_employee_id)}</b>
                  <span style={{ color: "#64748b", fontSize: 11 }}>
                    {` · ${category(peopleById.get(pair.covered_employee_id))}`}
                  </span>
                </span>
                <button type="button" style={{ ...lightBtn, padding: "4px 8px" }}
                  disabled={busy} onClick={() => beginEdit(day, pair)}>Edit</button>
                <button type="button" style={{ ...lightBtn, padding: "4px 8px" }}
                  disabled={busy} onClick={() => removePair(day, pair)}>×</button>
              </div>
            ))}
            {editor?.day === day && (
              <div style={{ display: "grid", gap: 8, marginTop: 10,
                gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))",
                padding: 10, background: "#f8fafc", borderRadius: 8 }}>
                <label style={{ fontSize: 12 }}>Reliever
                  <select value={reliever} onChange={(e) => setReliever(e.target.value)}
                    style={field} disabled={busy}>
                    <option value="">Choose employee</option>{personOptions}
                  </select>
                </label>
                <label style={{ fontSize: 12 }}>Relieves
                  <select value={covered} onChange={(e) => setCovered(e.target.value)}
                    style={field} disabled={busy || !!editor.originalCovered}>
                    <option value="">Choose employee</option>{personOptions}
                  </select>
                </label>
                <div style={{ display: "flex", alignItems: "end", gap: 6 }}>
                  <button type="button" style={btn} disabled={busy} onClick={savePair}>Save</button>
                  <button type="button" style={lightBtn} disabled={busy}
                    onClick={() => setEditor(null)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ borderTop: "1px solid #e2e8f0", padding: 14, display: "grid", gap: 10 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <strong style={{ marginRight: 5 }}>Temporary</strong>
          {[
            ["MOVE", "Move"], ["SWAP", "Swap"],
          ].map(([key, label]) => (
            <button key={key} type="button" style={{ ...lightBtn,
              background: mode === key ? "#cffafe" : "#fff" }}
              onClick={() => { setMode(key); setTarget(""); setPreview(null); }}>
              {label}
            </button>
          ))}
        </div>
        <div style={{ display: "grid", gap: 9,
          gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))" }}>
          <label style={{ fontSize: 12 }}>From
            <input type="date" style={field} value={fromDate} min={nairobiToday()}
              onChange={(e) => { setFromDate(e.target.value);
                if (e.target.value > toDate) setToDate(e.target.value); setPreview(null); }} />
          </label>
          <label style={{ fontSize: 12 }}>To
            <input type="date" style={field} value={toDate} min={fromDate}
              onChange={(e) => { setToDate(e.target.value); setPreview(null); }} />
          </label>
          <label style={{ fontSize: 12 }}>Cashier
            <select value={personA} style={field} onChange={(e) => setPersonA(e.target.value)}>
              <option value="">Choose employee</option>{personOptions}
            </select>
          </label>
          <label style={{ fontSize: 12 }}>{mode === "MOVE" ? "Moved to (relieve)" : "Swapped with"}
            <select value={target} style={field} onChange={(e) => setTarget(e.target.value)}>
              <option value="">Choose employee</option>{personOptions}
            </select>
          </label>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" style={btn} disabled={busy} onClick={applyTemporary}>
            Apply {mode === "MOVE" ? "Move" : "Swap"}
          </button>
          <button type="button" style={lightBtn} disabled={busy} onClick={viewDate}>View date</button>
        </div>
        {preview && (
          <div style={{ background: "#f8fafc", padding: 10, borderRadius: 7,
            display: "grid", gap: 5, fontSize: 12 }}>
            <strong>{fromDate}</strong>
            {preview.length ? preview.map((pair, index) => (
              <div key={`${pair.covered_employee_id}-${index}`}>
                {name(pair.reliever_employee_id)} relieves {name(pair.covered_employee_id)}
                {pair.temporary ? " · Temporary" : ""}
              </div>
            )) : <span>—</span>}
          </div>
        )}
      </div>

      <div style={{ borderTop: "1px solid #e2e8f0", padding: 14,
        display: "grid", gap: 8 }}>
        <label htmlFor="rota-reason" style={{ fontSize: 12, fontWeight: 800 }}>Reason</label>
        <textarea id="rota-reason" rows={2} style={{ ...field, resize: "vertical" }}
          value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for change" disabled={busy} />
        {notice && <span role="status" style={{ color: "#15803d", fontSize: 12 }}>{notice}</span>}
        {error && <span role="alert" style={{ color: "#b91c1c", fontSize: 12 }}>{error}</span>}
      </div>
    </section>
  );
}
