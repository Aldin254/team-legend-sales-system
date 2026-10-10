"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminDutyControlPanelLegacy from "./AdminDutyControlPanelLegacy";

const ROTATION_SHOPS = ["3T", "ARUSHA", "KINGS", "NYIKA02"];

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

function dateIsMonday(date) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    new Date(`${date}T12:00:00Z`).getUTCDay() === 1
  );
}

function statusText(duty) {
  if (!duty) return "Not available";

  const status = duty.effective_status;
  const shift = duty.shift_period;

  if (status === "OFF_DUTY") return "OFF";
  if (status === "UNASSIGNED") return "NO SHOP ASSIGNED";

  if (status === "NEEDS_CONFIRMATION") {
    return "NEEDS CONFIRMATION";
  }

  if (shift === "DAY") return "DAY";
  if (shift === "NIGHT") return "NIGHT";
  if (shift === "DAY_RELIEF") return "DAY RELIEF";

  if (status === "ON_DUTY") {
    return "WORKING (SHIFT NOT SPECIFIED)";
  }

  return status || "UNKNOWN";
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

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [notice, setNotice] = useState("");
  const [failed, setFailed] = useState(false);

  const [employeeId, setEmployeeId] = useState("");
  const [status, setStatus] = useState("OFF_DUTY");
  const [dutyShop, setDutyShop] = useState("");

  const base = String(supabaseUrl || "").replace(/\/+$/, "");

  const rpc = useCallback(
    async (name, args = {}) => {
      if (!base || !supabaseAnonKey || !accessToken) {
        throw new Error("Supabase connection details are missing.");
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

      const result = await response.json().catch(() => null);

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

  const load = useCallback(async () => {
    if (!base || !supabaseAnonKey || !accessToken) {
      setLoading(false);
      setFailed(true);
      setNotice("Supabase connection details are missing.");
      return;
    }

    setLoading(true);

    try {
      const [people, daily, effective] = await Promise.all([
        rpc("tl_admin_master_employee_list"),

        rpc("tl_admin_master_duty_plan_for_date", {
          p_duty_date: date,
        }),

        rpc("tl_admin_master_duty_preview_v3", {
          p_duty_date: date,
        }),
      ]);

      if (
        !Array.isArray(people) ||
        !Array.isArray(daily) ||
        !Array.isArray(effective)
      ) {
        throw new Error(
          "The Master Duty server returned an unexpected result."
        );
      }

      setEmployees(people);
      setPlan(daily);
      setPreview(effective);

      setFailed(false);
      setNotice("");
    } catch (error) {
      setFailed(true);

      setNotice(
        error?.message || "Unable to load Master Duty Rota."
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

  const active = useMemo(
    () =>
      employees.filter(
        (employee) => employee.employment_status === "ACTIVE"
      ),
    [employees]
  );

  const shops = useMemo(() => {
    const byId = new Map();

    active.forEach((employee) => {
      if (employee.shop_id) {
        byId.set(
          employee.shop_id,
          employee.shop_name || employee.shop_id
        );
      }
    });

    return [...byId]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [active]);

  const byEmployeeId = useMemo(
    () =>
      new Map(
        active.map((employee) => [
          employee.employee_id,
          employee,
        ])
      ),
    [active]
  );

  const previewByEmployeeId = useMemo(
    () =>
      new Map(
        preview.map((duty) => [
          duty.employee_id,
          duty,
        ])
      ),
    [preview]
  );

  const selected = byEmployeeId.get(employeeId);

  const monday = dateIsMonday(date);

  const cycleRow = preview.find(
    (duty) => duty.rotation_normal_off_week != null
  );

  const cycleLabel = cycleRow
    ? `WEEK ${cycleRow.rotation_normal_off_week}`
    : "";

  function chooseEmployee(id) {
    setEmployeeId(id);

    const employee = byEmployeeId.get(id);

    const existing = plan.find(
      (duty) => duty.employee_id === id
    );

    const resolved = previewByEmployeeId.get(id);

    const nextStatus =
      existing?.confirmed_status ||
      ([
        "ON_DUTY",
        "OFF_DUTY",
        "UNASSIGNED",
      ].includes(resolved?.effective_status)
        ? resolved.effective_status
        : employee?.assignment_type === "NOT_FIXED"
          ? "UNASSIGNED"
          : "ON_DUTY");

    setStatus(nextStatus);

    setDutyShop(
      nextStatus === "ON_DUTY"
        ? existing?.confirmed_shop_id ||
            resolved?.effective_shop_id ||
            employee?.shop_id ||
            ""
        : ""
    );
  }

  async function confirmDaily(event) {
    event.preventDefault();

    if (!selected || saving) return;

    if (status === "ON_DUTY" && !dutyShop) {
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

    const label =
      status === "ON_DUTY"
        ? `WORKING at ${
            shops.find((shop) => shop.id === dutyShop)?.name ||
            "selected shop"
          }`
        : status === "OFF_DUTY"
          ? "OFF"
          : "NO SHOP ASSIGNED";

    if (
      !window.confirm(
        `Confirm ${selected.full_name}: ${label} on ${date}? ` +
          "This overrides the automatic rota for this date."
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
          status === "ON_DUTY" ? dutyShop : null,
      });

      await load();

      setFailed(false);
      setNotice(
        "Daily duty confirmed. This date now has an Admin override."
      );

      onChanged?.();
    } catch (error) {
      setFailed(true);

      setNotice(
        error?.message || "Daily duty confirmation failed."
      );
    } finally {
      setSaving(false);
    }
  }

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
          <strong
            style={{
              fontSize: 18,
              color: "#e2e8f0",
            }}
          >
            Master Employee Duty Rota
          </strong>

          <div
            style={{
              fontSize: 12,
              color: "#94a3b8",
              marginTop: 3,
            }}
          >
            All employees · daily confirmations · automatic
            24-hour rotation
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
            onChange={(event) => {
              setDate(event.target.value);
              setEmployeeId("");
            }}
            required
          />
        </Field>

        <Field label="Master Employee">
          <select
            style={fieldStyle}
            value={employeeId}
            onChange={(event) =>
              chooseEmployee(event.target.value)
            }
            required
          >
            <option value="">
              Select employee
            </option>

            {active.map((employee) => (
              <option
                key={employee.employee_id}
                value={employee.employee_id}
              >
                {employee.full_name} —{" "}
                {employee.assignment_type === "NOT_FIXED"
                  ? "Not Fixed"
                  : employee.shop_name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Duty status">
          <select
            style={fieldStyle}
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);

              if (event.target.value !== "ON_DUTY") {
                setDutyShop("");
              } else {
                setDutyShop(selected?.shop_id || "");
              }
            }}
          >
            <option value="ON_DUTY">
              WORKING — at selected shop
            </option>

            <option value="OFF_DUTY">
              OFF — no duty
            </option>

            {selected?.assignment_type === "NOT_FIXED" && (
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
              onChange={(event) =>
                setDutyShop(event.target.value)
              }
              required
            >
              <option value="">
                Select shop
              </option>

              {shops.map((shop) => (
                <option
                  key={shop.id}
                  value={shop.id}
                >
                  {shop.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        <div
          style={{
            fontSize: 12,
            color: "#64748b",
          }}
        >
          A confirmed daily duty overrides the automatic
          rota for that employee and date. This form
          does not assign a DAY or NIGHT shift period.
        </div>

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

      <div style={cardStyle}>
        <strong>
          2. Automatic 24-hour DAY / NIGHT rotation
        </strong>

        <div
          style={{
            color: "#64748b",
            fontSize: 12,
          }}
        >
          {date}
          {cycleLabel
            ? ` · Normal OFF rota ${cycleLabel}`
            : ""}
          {monday
            ? " · Monday changeover"
            : ""}
        </div>

        <div
          style={{
            fontSize: 12,
            color: "#475569",
          }}
        >
          Only 3T, ARUSHA, KINGS and NYIKA02
          rotate weekly. The previous NIGHT employee
          takes the new Monday OFF and returns DAY
          on Tuesday. Manual repeating Group OFF
          controls have been removed from this
          Master section.
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(100%, 270px), 1fr))",
            gap: 10,
          }}
        >
          {ROTATION_SHOPS.map((shopName) => {
            const shopEmployees = active.filter(
              (employee) =>
                employee.shop_name === shopName &&
                employee.shop_type === "24_HOUR" &&
                employee.assignment_type === "FIXED"
            );

            const first = shopEmployees.find(
              (employee) =>
                Number(employee.group_number) === 1
            );

            const second = shopEmployees.find(
              (employee) =>
                Number(employee.group_number) === 2
            );

            const firstDuty =
              first &&
              previewByEmployeeId.get(
                first.employee_id
              );

            const secondDuty =
              second &&
              previewByEmployeeId.get(
                second.employee_id
              );

            const reference =
              firstDuty || secondDuty;

            const reliefPerson =
              byEmployeeId.get(
                reference?.rotation_monday_relief_employee_id
              );

            const shopId =
              first?.shop_id || second?.shop_id;

            const dailyRelief = monday
              ? active.filter(
                  (employee) =>
                    employee.assignment_type ===
                      "NOT_FIXED" &&
                    plan.some(
                      (planned) =>
                        planned.employee_id ===
                          employee.employee_id &&
                        planned.confirmed_status ===
                          "ON_DUTY" &&
                        planned.confirmed_shop_id ===
                          shopId
                    )
                )
              : [];

            const missingRelief =
              monday &&
              reference?.rotation_monday_relief_unassigned ===
                true;

            const reliefDuty =
              reliefPerson &&
              previewByEmployeeId.get(
                reliefPerson.employee_id
              );

            const reliefConflict =
              monday &&
              reliefPerson &&
              (reliefDuty?.effective_status !==
                "ON_DUTY" ||
                reliefDuty?.effective_shop_id !==
                  shopId);

            const anyConflict = [
              firstDuty,
              secondDuty,
            ].some(
              (duty) =>
                duty?.rotation_conflict === true
            );

            return (
              <div
                key={shopName}
                style={{
                  border: "1px solid #dbe4ed",
                  borderRadius: 11,
                  padding: 12,
                  display: "grid",
                  gap: 8,
                  background: "#f8fafc",
                }}
              >
                <strong
                  style={{
                    fontSize: 14,
                  }}
                >
                  {shopName}
                </strong>

                {[
                  [first, firstDuty, 1],
                  [second, secondDuty, 2],
                ].map(
                  ([employee, duty, group]) => (
                    <div
                      key={group}
                      style={{
                        display: "flex",
                        justifyContent:
                          "space-between",
                        gap: 8,
                        fontSize: 12,
                        alignItems: "flex-start",
                      }}
                    >
                      <div
                        style={{
                          minWidth: 0,
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 750,
                          }}
                        >
                          {employee?.full_name ||
                            `Group ${group} not assigned`}
                        </div>

                        <div
                          style={{
                            color: "#64748b",
                            fontSize: 11,
                          }}
                        >
                          Group {group}
                        </div>
                      </div>

                      <div
                        style={{
                          fontWeight: 850,
                          textAlign: "right",
                          color:
                            duty?.rotation_conflict
                              ? "#b45309"
                              : duty?.effective_status ===
                                  "OFF_DUTY"
                                ? "#b91c1c"
                                : "#166534",
                        }}
                      >
                        {statusText(duty)}

                        {duty?.duty_source ===
                          "MASTER_DAILY_CONFIRMED" && (
                          <div
                            style={{
                              fontWeight: 500,
                              fontSize: 10,
                            }}
                          >
                            Admin override
                          </div>
                        )}
                      </div>
                    </div>
                  )
                )}

                {monday && (
                  <div
                    style={{
                      borderTop:
                        "1px solid #e2e8f0",
                      paddingTop: 8,
                      fontSize: 12,
                      color:
                        (missingRelief &&
                          !dailyRelief.length) ||
                        reliefConflict
                          ? "#b91c1c"
                          : "#334155",
                    }}
                  >
                    <strong>
                      Monday DAY relief:
                    </strong>{" "}

                    {dailyRelief.length
                      ? `${dailyRelief
                          .map(
                            (person) =>
                              person.full_name
                          )
                          .join(", ")} — working confirmed, DAY period not set`
                      : missingRelief
                        ? "NEEDS ADMIN ASSIGNMENT"
                        : reliefConflict
                          ? `${reliefPerson.full_name} — CHECK ASSIGNMENT`
                          : reliefPerson?.full_name ||
                            "Not configured"}
                  </div>
                )}

                {anyConflict && (
                  <div
                    style={{
                      fontSize: 11,
                      color: "#b45309",
                      fontWeight: 750,
                    }}
                  >
                    Existing assignment conflicts
                    with rotation — Admin review
                    required.
                  </div>
                )}

                {!firstDuty &&
                  !secondDuty && (
                    <div
                      style={{
                        fontSize: 11,
                        color: "#b91c1c",
                      }}
                    >
                      No V3 preview returned
                      for this shop.
                    </div>
                  )}
              </div>
            );
          })}
        </div>

        <div
          style={{
            color: "#64748b",
            fontSize: 12,
          }}
        >
          NYIKA02 has no designated Monday
          relief employee. Admin must confirm
          coverage. A permanent Group 1 /
          Group 2 swap needs a separate
          rotation-anchor review.
        </div>
      </div>

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
          V3 preview. Salary Panels are NOT connected
          to Master Duty yet. A confirmed daily
          override may show WORKING without a
          DAY/NIGHT shift period.
        </div>

        <div
          style={{
            display: "grid",
            gap: 6,
            maxHeight: 350,
            overflowY: "auto",
          }}
        >
          {preview.map((duty) => (
            <div
              key={duty.employee_id}
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
                {duty.employee_name ||
                  byEmployeeId.get(
                    duty.employee_id
                  )?.full_name ||
                  "Unknown employee"}
              </strong>

              <span
                style={{
                  color:
                    duty.rotation_conflict
                      ? "#b45309"
                      : "#334155",
                }}
              >
                {statusText(duty)}

                {duty.effective_shop_name
                  ? ` — ${duty.effective_shop_name}`
                  : ""}

                {duty.rotation_conflict
                  ? " · REVIEW"
                  : ""}
              </span>
            </div>
          ))}

          {!loading &&
            preview.length === 0 && (
              <span
                style={{
                  fontSize: 12,
                }}
              >
                No duty preview available.
              </span>
            )}
        </div>
      </div>
    </section>
  );
}

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
