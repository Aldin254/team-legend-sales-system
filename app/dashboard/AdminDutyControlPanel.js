"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import AdminDutyControlPanelLegacy from "./AdminDutyControlPanelLegacy";

const DAYS = [
  [1, "Monday"],
  [2, "Tuesday"],
  [3, "Wednesday"],
  [4, "Thursday"],
  [5, "Friday"],
  [6, "Saturday"],
  [7, "Sunday"],
];

const fieldStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px",
  borderRadius: 9,
  border: "1px solid #cbd5e1",
  color: "#111827",
  background: "white",
  fontSize: 13,
};

const cardStyle = {
  display: "grid",
  gap: 12,
  padding: 16,
  background: "white",
  borderRadius: 14,
  border: "1px solid #e5e7eb",
};

const buttonStyle = {
  border: 0,
  borderRadius: 9,
  padding: "10px 14px",
  fontSize: 12,
  fontWeight: 800,
  background: "#111827",
  color: "white",
  cursor: "pointer",
};

function todayKenya() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const obj = Object.fromEntries(
    parts.map((p) => [p.type, p.value])
  );

  return `${obj.year}-${obj.month}-${obj.day}`;
}

function Field({ label, children }) {
  return (
    <label
      style={{
        display: "grid",
        gap: 5,
        color: "#374151",
        fontSize: 12,
        fontWeight: 800,
      }}
    >
      {label}
      {children}
    </label>
  );
}

function MasterDutySection({
  supabaseUrl,
  supabaseAnonKey,
  accessToken,
  onChanged,
}) {
  const [date, setDate] = useState(todayKenya);

  const [employees, setEmployees] = useState([]);
  const [plan, setPlan] = useState([]);
  const [preview, setPreview] = useState([]);
  const [weeklyRules, setWeeklyRules] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [failed, setFailed] = useState(false);

  const [employeeId, setEmployeeId] = useState("");
  const [status, setStatus] = useState("OFF_DUTY");
  const [dutyShop, setDutyShop] = useState("");

  const [weeklyShop, setWeeklyShop] = useState("");
  const [cycleWeek, setCycleWeek] = useState("1");
  const [weekday, setWeekday] = useState("1");
  const [offGroup, setOffGroup] = useState("1");
  const [reliefId, setReliefId] = useState("");

  const base = String(supabaseUrl || "").replace(
    /\/+$/,
    ""
  );

  // ================================================
  // SUPABASE RPC
  // ================================================

  const rpc = useCallback(
    async (name, args = {}) => {
      if (!base || !supabaseAnonKey || !accessToken) {
        throw new Error(
          "Supabase connection details are missing."
        );
      }

      const response = await fetch(
        `${base}/rest/v1/rpc/${name}`,
        {
          method: "POST",
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(args),
        }
      );

      const result = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.message ||
            result?.details ||
            `${name} failed (${response.status})`
        );
      }

      return result;
    },
    [base, supabaseAnonKey, accessToken]
  );

  // ================================================
  // LOAD MASTER EMPLOYEES AND DUTY
  // ================================================

  const load = useCallback(async () => {
    if (!base || !supabaseAnonKey || !accessToken) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const [
        people,
        daily,
        effective,
        weekly,
      ] = await Promise.all([
        rpc("tl_admin_master_employee_list"),

        rpc("tl_admin_master_duty_plan_for_date", {
          p_duty_date: date,
        }),

        rpc("tl_admin_master_duty_preview_v2", {
          p_duty_date: date,
        }),

        rpc("tl_admin_master_24h_weekly_list"),
      ]);

      setEmployees(
        Array.isArray(people) ? people : []
      );

      setPlan(
        Array.isArray(daily) ? daily : []
      );

      setPreview(
        Array.isArray(effective) ? effective : []
      );

      setWeeklyRules(
        Array.isArray(weekly) ? weekly : []
      );

      setFailed(false);
    } catch (e) {
      setFailed(true);

      setNotice(
        e?.message || "Unable to load Master Duty Rota."
      );
    } finally {
      setLoading(false);
    }
  }, [
    base,
    supabaseAnonKey,
    accessToken,
    rpc,
    date,
  ]);

  useEffect(() => {
    load();
  }, [load]);

  // ================================================
  // MASTER EMPLOYEES
  // ================================================

  const active = useMemo(
    () =>
      employees.filter(
        (e) => e.employment_status === "ACTIVE"
      ),
    [employees]
  );

  const relief = useMemo(
    () =>
      active.filter(
        (e) => e.assignment_type === "NOT_FIXED"
      ),
    [active]
  );

  // ================================================
  // SHOPS
  // ================================================

  const shops = useMemo(() => {
    const byId = new Map();

    active.forEach((e) => {
      if (e.shop_id) {
        byId.set(
          e.shop_id,
          e.shop_name || e.shop_id
        );
      }
    });

    return [...byId]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) =>
        a.name.localeCompare(b.name)
      );
  }, [active]);

  const shops24 = useMemo(() => {
    const byId = new Map();

    active.forEach((e) => {
      if (
        e.shop_type === "24_HOUR" &&
        e.shop_id
      ) {
        byId.set(
          e.shop_id,
          e.shop_name || e.shop_id
        );
      }
    });

    return [...byId]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) =>
        a.name.localeCompare(b.name)
      );
  }, [active]);

  useEffect(() => {
    if (!weeklyShop && shops24.length) {
      setWeeklyShop(shops24[0].id);
    }
  }, [shops24, weeklyShop]);

  // ================================================
  // LOAD EXISTING WEEKLY RULE
  // ================================================

  useEffect(() => {
    const rule = weeklyRules.find(
      (r) =>
        r.shop_id === weeklyShop &&
        Number(r.cycle_week) ===
          Number(cycleWeek) &&
        Number(r.weekday_iso) ===
          Number(weekday)
    );

    setOffGroup(
      String(rule?.off_group_number ?? 1)
    );

    setReliefId(
      rule?.relief_employee_id || ""
    );
  }, [
    weeklyRules,
    weeklyShop,
    cycleWeek,
    weekday,
  ]);

  const selected = active.find(
    (e) => e.employee_id === employeeId
  );

  const group1 = active.find(
    (e) =>
      e.shop_id === weeklyShop &&
      Number(e.group_number) === 1
  );

  const group2 = active.find(
    (e) =>
      e.shop_id === weeklyShop &&
      Number(e.group_number) === 2
  );

  // ================================================
  // SELECT EMPLOYEE
  // ================================================

  function chooseEmployee(id) {
    setEmployeeId(id);

    const person = active.find(
      (e) => e.employee_id === id
    );

    const existing = plan.find(
      (p) => p.employee_id === id
    );

    const resolved = preview.find(
      (p) => p.employee_id === id
    );

    const nextStatus =
      existing?.confirmed_status ||
      ([
        "ON_DUTY",
        "OFF_DUTY",
        "UNASSIGNED",
      ].includes(resolved?.effective_status)
        ? resolved.effective_status
        : person?.assignment_type === "NOT_FIXED"
        ? "UNASSIGNED"
        : "ON_DUTY");

    setStatus(nextStatus);

    setDutyShop(
      nextStatus === "ON_DUTY"
        ? existing?.confirmed_shop_id ||
            resolved?.effective_shop_id ||
            person?.shop_id ||
            ""
        : ""
    );
  }

  // ================================================
  // CONFIRM DAILY DUTY
  // ================================================

  async function confirmDaily(event) {
    event.preventDefault();

    if (!selected) return;

    if (
      status === "ON_DUTY" &&
      !dutyShop
    ) {
      setFailed(true);
      setNotice("Choose a working shop.");
      return;
    }

    if (
      status === "UNASSIGNED" &&
      selected.assignment_type !== "NOT_FIXED"
    ) {
      setFailed(true);
      setNotice(
        "NO SHOP ASSIGNED is only for Not Fixed employees."
      );
      return;
    }

    if (
      !window.confirm(
        `Confirm ${selected.full_name}: ${status} on ${date}?`
      )
    ) {
      return;
    }

    setSaving(true);

    try {
      await rpc("tl_admin_master_duty_set", {
        p_employee_id: employeeId,
        p_duty_date: date,
        p_status: status,
        p_shop_id:
          status === "ON_DUTY"
            ? dutyShop
            : null,
      });

      await load();

      setFailed(false);
      setNotice("Daily duty confirmed.");

      onChanged?.();
    } catch (e) {
      setFailed(true);

      setNotice(
        e?.message ||
          "Daily duty confirmation failed."
      );
    } finally {
      setSaving(false);
    }
  }

  // ================================================
  // CONFIRM WEEKLY GROUP OFF / RELIEF
  // ================================================

  async function confirmWeekly(event) {
    event.preventDefault();

    if (!weeklyShop) return;

    if (
      !window.confirm(
        "Save repeating 24-hour Group OFF / relief rule?"
      )
    ) {
      return;
    }

    setSaving(true);

    try {
      await rpc(
        "tl_admin_master_24h_weekly_set",
        {
          p_shop_id: weeklyShop,
          p_cycle_week: Number(cycleWeek),
          p_weekday_iso: Number(weekday),
          p_off_group: Number(offGroup),
          p_relief_employee_id:
            reliefId || null,
        }
      );

      await load();

      setFailed(false);

      setNotice(
        "Weekly group and relief rule saved."
      );

      onChanged?.();
    } catch (e) {
      setFailed(true);

      setNotice(
        e?.message || "Weekly rule failed."
      );
    } finally {
      setSaving(false);
    }
  }

  // ================================================
  // SWAP GROUPS
  // ================================================

  async function swapGroups() {
    if (!group1 || !group2) return;

    if (
      !window.confirm(
        `Permanently swap ${group1.full_name} and ${group2.full_name} between Groups 1 and 2?`
      )
    ) {
      return;
    }

    setSaving(true);

    try {
      await rpc("tl_admin_set_24h_groups", {
        p_shop_id: weeklyShop,

        p_group1_employee_id:
          group2.employee_id,

        p_group2_employee_id:
          group1.employee_id,
      });

      await load();

      setFailed(false);
      setNotice("Group positions swapped.");

      onChanged?.();
    } catch (e) {
      setFailed(true);

      setNotice(
        e?.message || "Could not swap groups."
      );
    } finally {
      setSaving(false);
    }
  }

  // ================================================
  // RENDER MASTER ROTA
  // ================================================

  return (
    <section
      style={{
        display: "grid",
        gap: 14,
        minWidth: 0,
        color: "#111827",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <strong style={{ fontSize: 18 }}>
            Master Employee Duty Rota
          </strong>

          <div
            style={{
              fontSize: 12,
              color: "#64748b",
              marginTop: 3,
            }}
          >
            Employee list · future planning ·
            relief · 24-hour groups
          </div>
        </div>

        <button
          type="button"
          style={buttonStyle}
          disabled={loading || saving}
          onClick={load}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {notice && (
        <div
          style={{
            padding: 11,
            borderRadius: 9,
            fontSize: 12,
            fontWeight: 750,

            background: failed
              ? "#fef2f2"
              : "#f0fdf4",

            color: failed
              ? "#991b1b"
              : "#166534",
          }}
        >
          {notice}
        </div>
      )}

      {/* DAILY DUTY */}

      <form
        onSubmit={confirmDaily}
        style={cardStyle}
      >
        <strong>
          1. Confirm an employee's duty for a date
        </strong>

        <Field label="Date (Kenya)">
          <input
            type="date"
            style={fieldStyle}
            min={todayKenya()}
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setEmployeeId("");
            }}
            required
          />
        </Field>

        <Field label="Master Employee">
          <select
            style={fieldStyle}
            value={employeeId}
            onChange={(e) =>
              chooseEmployee(e.target.value)
            }
            required
          >
            <option value="">
              Select employee
            </option>

            {active.map((e) => (
              <option
                key={e.employee_id}
                value={e.employee_id}
              >
                {e.full_name} —{" "}
                {e.assignment_type === "NOT_FIXED"
                  ? "Not Fixed"
                  : e.shop_name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Duty status">
          <select
            style={fieldStyle}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);

              if (
                e.target.value !== "ON_DUTY"
              ) {
                setDutyShop("");
              } else {
                setDutyShop(
                  selected?.shop_id || ""
                );
              }
            }}
          >
            <option value="ON_DUTY">
              WORKING — at selected shop
            </option>

            <option value="OFF_DUTY">
              OFF — no salary panel
            </option>

            {selected?.assignment_type ===
              "NOT_FIXED" && (
              <option value="UNASSIGNED">
                NO SHOP ASSIGNED — available relief
              </option>
            )}
          </select>
        </Field>

        {status === "ON_DUTY" && (
          <Field label="Working shop">
            <select
              style={fieldStyle}
              value={dutyShop}
              onChange={(e) =>
                setDutyShop(e.target.value)
              }
              required
            >
              <option value="">
                Select shop
              </option>

              {shops.map((s) => (
                <option
                  key={s.id}
                  value={s.id}
                >
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        <button
          type="submit"
          style={buttonStyle}
          disabled={
            saving ||
            loading ||
            !employeeId
          }
        >
          {saving
            ? "Saving..."
            : "Confirm daily duty"}
        </button>
      </form>

      {/* 24-HOUR WEEKLY ROTA */}

      <form
        onSubmit={confirmWeekly}
        style={cardStyle}
      >
        <strong>
          2. Confirm 24-hour Group OFF / relief
        </strong>

        <Field label="24-hour shop">
          <select
            style={fieldStyle}
            value={weeklyShop}
            onChange={(e) =>
              setWeeklyShop(e.target.value)
            }
            required
          >
            <option value="">
              Select shop
            </option>

            {shops24.map((s) => (
              <option
                key={s.id}
                value={s.id}
              >
                {s.name}
              </option>
            ))}
          </select>
        </Field>

        <div
          style={{
            padding: 10,
            background: "#f8fafc",
            borderRadius: 9,
            fontSize: 12,
          }}
        >
          <div>
            <strong>Group 1:</strong>{" "}
            {group1?.full_name ||
              "Not assigned"}
          </div>

          <div>
            <strong>Group 2:</strong>{" "}
            {group2?.full_name ||
              "Not assigned"}
          </div>

          <button
            type="button"
            style={{
              ...buttonStyle,
              marginTop: 9,
              background: "#475569",
            }}
            onClick={swapGroups}
            disabled={
              saving ||
              !group1 ||
              !group2
            }
          >
            Swap Group 1 / Group 2 permanently
          </button>
        </div>

        <Field label="Two-week cycle">
          <select
            style={fieldStyle}
            value={cycleWeek}
            onChange={(e) =>
              setCycleWeek(e.target.value)
            }
          >
            <option value="1">
              Week 1
            </option>

            <option value="2">
              Week 2
            </option>
          </select>
        </Field>

        <Field label="Day">
          <select
            style={fieldStyle}
            value={weekday}
            onChange={(e) =>
              setWeekday(e.target.value)
            }
          >
            {DAYS.map(([n, day]) => (
              <option
                key={n}
                value={n}
              >
                {day}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Group OFF">
          <select
            style={fieldStyle}
            value={offGroup}
            onChange={(e) =>
              setOffGroup(e.target.value)
            }
          >
            <option value="1">
              Group 1 OFF
            </option>

            <option value="2">
              Group 2 OFF
            </option>
          </select>
        </Field>

        <Field label="Relief employee (optional)">
          <select
            style={fieldStyle}
            value={reliefId}
            onChange={(e) =>
              setReliefId(e.target.value)
            }
          >
            <option value="">
              No relief assigned
            </option>

            {relief.map((e) => (
              <option
                key={e.employee_id}
                value={e.employee_id}
              >
                {e.full_name}
              </option>
            ))}
          </select>
        </Field>

        <button
          type="submit"
          style={buttonStyle}
          disabled={
            saving ||
            loading ||
            !weeklyShop
          }
        >
          {saving
            ? "Saving..."
            : "Confirm repeating weekly rule"}
        </button>
      </form>

      {/* DUTY PREVIEW */}

      <div style={cardStyle}>
        <strong>
          3. Effective Duty Preview — {date}
        </strong>

        <div
          style={{
            color: "#64748b",
            fontSize: 12,
          }}
        >
          Live Salary Panels are not connected
          yet. Unconfirmed employees may need review.
        </div>

        <div
          style={{
            display: "grid",
            gap: 6,
            maxHeight: 300,
            overflowY: "auto",
          }}
        >
          {preview.map((p) => (
            <div
              key={p.employee_id}
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                gap: 8,
                flexWrap: "wrap",
                border:
                  "1px solid #e5e7eb",
                borderRadius: 8,
                padding: 9,
                fontSize: 12,
              }}
            >
              <strong>
                {p.employee_name}
              </strong>

              <span>
                {p.effective_status}

                {p.effective_shop_name
                  ? ` — ${p.effective_shop_name}`
                  : ""}
              </span>
            </div>
          ))}

          {!loading &&
            preview.length === 0 && (
              <span style={{ fontSize: 12 }}>
                No duty preview available.
              </span>
            )}
        </div>
      </div>
    </section>
  );
}

// =====================================================
// MAIN DUTY CONTROL
// MASTER ROTA + ORIGINAL DUTY CONTROL
// =====================================================

export default function AdminDutyControlPanel(props) {
  return (
    <div
      style={{
        display: "grid",
        gap: 18,
        width: "100%",
        minWidth: 0,
      }}
    >
      <MasterDutySection {...props} />

      <AdminDutyControlPanelLegacy {...props} />
    </div>
  );
}
