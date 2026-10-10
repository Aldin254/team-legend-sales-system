"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const OFF_REASONS = [
  ["REQUESTED_OFF", "Requested Off"],
  ["SICK", "Sick"],
  ["EMERGENCY", "Emergency"],
  ["FAMILY_MATTER", "Family Matter"],
  ["MANAGEMENT_APPROVED", "Management Approved"],
  ["OTHER", "Other"],
];

const ENTRY_TYPES = [
  ["RELIEF_COVER", "Relief Cover"],
  ["EMPLOYEE_OFF", "Employee Off"],
  ["INCOMPLETE", "Incomplete / Review"],
];

const DAYS = [
  [1, "Monday"],
  [2, "Tuesday"],
  [3, "Wednesday"],
  [4, "Thursday"],
  [5, "Friday"],
  [6, "Saturday"],
  [7, "Sunday"],
];

function safeJson(response) {
  return response
    .json()
    .catch(() => null);
}

function formatDate(value) {
  if (!value) return "—";

  try {
    return new Intl.DateTimeFormat("en-KE", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Africa/Nairobi",
    }).format(new Date(`${value}T12:00:00Z`));
  } catch {
    return value;
  }
}

function displayValue(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  return value;
}

function badgeColors(type) {
  switch (type) {
    case "LINKED":
      return {
        background: "#dcfce7",
        color: "#166534",
        border: "#bbf7d0",
      };

    case "PARTIALLY_LINKED":
      return {
        background: "#dbeafe",
        color: "#1d4ed8",
        border: "#bfdbfe",
      };

    case "UNLINKED":
      return {
        background: "#fef3c7",
        color: "#92400e",
        border: "#fde68a",
      };

    case "NEEDS_REVIEW":
    case "INCOMPLETE":
      return {
        background: "#fee2e2",
        color: "#b91c1c",
        border: "#fecaca",
      };

    case "EMPLOYEE_OFF":
      return {
        background: "#f3f4f6",
        color: "#374151",
        border: "#d1d5db",
      };

    case "TEMPORARY":
      return {
        background: "#ede9fe",
        color: "#6d28d9",
        border: "#ddd6fe",
      };

    default:
      return {
        background: "#f3f4f6",
        color: "#374151",
        border: "#e5e7eb",
      };
  }
}

function Badge({ children, type }) {
  const c = badgeColors(type);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "4px 9px",
        fontSize: 11,
        fontWeight: 800,
        lineHeight: 1.2,
        background: c.background,
        color: c.color,
        border: `1px solid ${c.border}`,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function ActionButton({
  children,
  onClick,
  disabled = false,
  danger = false,
  secondary = false,
}) {
  let background = "#111827";
  let color = "#ffffff";
  let border = "#111827";

  if (secondary) {
    background = "#ffffff";
    color = "#111827";
    border = "#d1d5db";
  }

  if (danger) {
    background = "#b91c1c";
    color = "#ffffff";
    border = "#b91c1c";
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        border: `1px solid ${border}`,
        background,
        color,
        borderRadius: 9,
        padding: "9px 12px",
        fontSize: 12,
        fontWeight: 800,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {children}
    </button>
  );
}

function Field({ label, children }) {
  return (
    <label
      style={{
        display: "grid",
        gap: 6,
        fontSize: 12,
        fontWeight: 800,
        color: "#374151",
      }}
    >
      <span>{label}</span>
      {children}
    </label>
  );
}

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #d1d5db",
  borderRadius: 9,
  padding: "10px 11px",
  fontSize: 13,
  background: "#ffffff",
  color: "#111827",
  outline: "none",
};

export default function AdminDutyControlPanel({
  supabaseUrl,
  supabaseAnonKey,
  accessToken,
  onChanged,
}) {
  const [data, setData] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const [view, setView] = useState("WEEK1");

  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});

  const apiBase = useMemo(
    () => String(supabaseUrl || "").replace(/\/+$/, ""),
    [supabaseUrl]
  );

  const rpc = useCallback(
    async (name, body = {}) => {
      if (!apiBase || !supabaseAnonKey || !accessToken) {
        throw new Error("Missing Supabase connection details.");
      }

      const response = await fetch(
        `${apiBase}/rest/v1/rpc/${name}`,
        {
          method: "POST",
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      );

      const result = await safeJson(response);

      if (!response.ok) {
        throw new Error(
          result?.message ||
            result?.details ||
            result?.hint ||
            `Request failed (${response.status})`
        );
      }

      return result;
    },
    [apiBase, supabaseAnonKey, accessToken]
  );

  const load = useCallback(async () => {
    if (!apiBase || !supabaseAnonKey || !accessToken) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const result = await rpc(
        "tl_admin_workforce_control_snapshot",
        {}
      );

      setData(result || null);
    } catch (error) {
      setMessage(error?.message || "Failed to load Duty Control.");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }, [apiBase, supabaseAnonKey, accessToken, rpc]);

  useEffect(() => {
    load();
  }, [load]);

  const employees = Array.isArray(data?.employees)
    ? data.employees
    : [];

  const dutyEmployees = employees.filter(
    (employee) => employee.role !== "ACCOUNTANT"
  );

  const shops = Array.isArray(data?.shops)
    ? data.shops
    : [];

  const week1 = Array.isArray(data?.rota?.week1)
    ? data.rota.week1
    : [];

  const week2 = Array.isArray(data?.rota?.week2)
    ? data.rota.week2
    : [];

  const reviewRows = Array.isArray(data?.rota?.needs_review)
    ? data.rota.needs_review
    : [];

  const temporaryRows = Array.isArray(
    data?.temporary_changes?.changes
  )
    ? data.temporary_changes.changes
    : [];

  const fullRows = useMemo(
    () => [...week1, ...week2],
    [week1, week2]
  );

  const fullRowById = useMemo(() => {
    const map = new Map();

    fullRows.forEach((row) => {
      if (row?.id) map.set(row.id, row);
    });

    return map;
  }, [fullRows]);

  const groupedTemporaryChanges = useMemo(() => {
    const groups = new Map();

    temporaryRows.forEach((row) => {
      const key = row.change_group_id || row.id;

      if (!groups.has(key)) {
        groups.set(key, {
          change_group_id: key,
          duty_date: row.duty_date,
          rows: [],
        });
      }

      groups.get(key).rows.push(row);
    });

    return Array.from(groups.values());
  }, [temporaryRows]);

  function employeeLabel(employee) {
    if (!employee) return "Unknown Employee";

    if (employee.position_code === "DAILY_RELIEF") {
      return `${employee.full_name} — Daily Relief`;
    }

    if (employee.home_shop_name) {
      return `${employee.full_name} — ${employee.home_shop_name}`;
    }

    return employee.full_name;
  }

  function employeeName(id) {
    return (
      employees.find((employee) => employee.employee_id === id)
        ?.full_name || ""
    );
  }

  function shopName(id) {
    return (
      shops.find((shop) => shop.shop_id === id)?.shop_name || ""
    );
  }

  function closeModal() {
    if (saving) return;

    setModal(null);
    setForm({});
  }

  function openMove() {
    setForm({
      duty_date: data?.server_date || "",
      employee_id: "",
      shop_id: "",
      reason: "",
    });

    setModal("MOVE");
  }

  function openOff() {
    setForm({
      duty_date: data?.server_date || "",
      employee_id: "",
      relief_employee_id: "",
      reason_category: "REQUESTED_OFF",
      reason_text: "",
    });

    setModal("OFF");
  }

  function openSwap() {
    setForm({
      duty_date: data?.server_date || "",
      employee_a: "",
      employee_b: "",
      reason: "",
    });

    setModal("SWAP");
  }

  function openEdit(row) {
    const source = fullRowById.get(row?.id) || row;

    setForm({
      row_id: source?.id || "",
      entry_type: source?.entry_type || "RELIEF_COVER",

      duty_name:
        source?.duty_name ||
        source?.duty_employee_name ||
        "",

      off_name:
        source?.off_name ||
        source?.off_employee_name ||
        "",

      shop_name:
        source?.shop_name || "",

      duty_employee_id:
        source?.duty_employee_id || "",

      off_employee_id:
        source?.off_employee_id || "",

      shop_id:
        source?.shop_id || "",

      notes:
        source?.notes || "",
    });

    setModal("EDIT");
  }

  function openAdd(cycleWeek) {
    setForm({
      cycle_week: cycleWeek,
      weekday_iso: 1,
      entry_type: "RELIEF_COVER",

      duty_name: "",
      off_name: "",
      shop_name: "",

      duty_employee_id: "",
      off_employee_id: "",
      shop_id: "",

      notes: "",
    });

    setModal("ADD");
  }

  function openDeactivate(row) {
    setForm({
      row_id: row?.id || "",
      reason: "",
    });

    setModal("DEACTIVATE");
  }

  function openCancel(group) {
    setForm({
      change_group_id: group?.change_group_id || "",
      reason: "",
    });

    setModal("CANCEL");
  }

  function linkEmployee(idField, nameField, id) {
    const name = employeeName(id);

    setForm((current) => ({
      ...current,
      [idField]: id,
      ...(id && name ? { [nameField]: name } : {}),
    }));
  }

  function linkShop(id) {
    const name = shopName(id);

    setForm((current) => ({
      ...current,
      shop_id: id,
      ...(id && name ? { shop_name: name } : {}),
    }));
  }
  async function submitAction() {
    setSaving(true);
    setMessage("");

    try {
      if (modal === "MOVE") {
        if (!form.duty_date) throw new Error("Select a date.");
        if (!form.employee_id) throw new Error("Select an employee.");
        if (!form.shop_id) throw new Error("Select the destination shop.");
        if (!String(form.reason || "").trim()) {
          throw new Error("Reason is required.");
        }

        await rpc("tl_admin_move_employee", {
          p_duty_date: form.duty_date,
          p_employee_id: form.employee_id,
          p_shop_id: form.shop_id,
          p_reason: form.reason.trim(),
        });

        setMessage("Temporary shop move saved.");
      }

      if (modal === "OFF") {
        if (!form.duty_date) throw new Error("Select a date.");
        if (!form.employee_id) throw new Error("Select the employee.");
        if (!String(form.reason_text || "").trim()) {
          throw new Error("Reason is required.");
        }

        await rpc("tl_admin_mark_employee_off", {
          p_duty_date: form.duty_date,
          p_employee_id: form.employee_id,
          p_relief_employee_id:
            form.relief_employee_id || null,
          p_reason_category: form.reason_category,
          p_reason_text: form.reason_text.trim(),
        });

        setMessage("Employee OFF change saved.");
      }

      if (modal === "SWAP") {
        if (!form.duty_date) throw new Error("Select a date.");
        if (!form.employee_a) {
          throw new Error("Select Employee A.");
        }
        if (!form.employee_b) {
          throw new Error("Select Employee B.");
        }
        if (form.employee_a === form.employee_b) {
          throw new Error("Choose two different employees.");
        }
        if (!String(form.reason || "").trim()) {
          throw new Error("Reason is required.");
        }

        await rpc("tl_admin_swap_employees", {
          p_duty_date: form.duty_date,
          p_employee_a: form.employee_a,
          p_employee_b: form.employee_b,
          p_reason: form.reason.trim(),
        });

        setMessage("Employee swap saved.");
      }

      if (modal === "EDIT") {
        await rpc("tl_admin_update_rota_blueprint_row", {
          p_row_id: form.row_id,
          p_entry_type: form.entry_type,

          p_duty_name:
            String(form.duty_name || "").trim() || null,

          p_off_name:
            String(form.off_name || "").trim() || null,

          p_shop_name:
            String(form.shop_name || "").trim() || null,

          p_duty_employee_id:
            form.duty_employee_id || null,

          p_off_employee_id:
            form.off_employee_id || null,

          p_shop_id:
            form.shop_id || null,

          p_notes:
            String(form.notes || "").trim() || null,
        });

        setMessage("Permanent rota row updated.");
      }

      if (modal === "ADD") {
        await rpc("tl_admin_add_rota_blueprint_row", {
          p_cycle_week: Number(form.cycle_week),
          p_weekday_iso: Number(form.weekday_iso),
          p_entry_type: form.entry_type,

          p_duty_name:
            String(form.duty_name || "").trim() || null,

          p_off_name:
            String(form.off_name || "").trim() || null,

          p_shop_name:
            String(form.shop_name || "").trim() || null,

          p_duty_employee_id:
            form.duty_employee_id || null,

          p_off_employee_id:
            form.off_employee_id || null,

          p_shop_id:
            form.shop_id || null,

          p_notes:
            String(form.notes || "").trim() || null,
        });

        setMessage("Permanent rota row added.");
      }

      if (modal === "DEACTIVATE") {
        if (!String(form.reason || "").trim()) {
          throw new Error("Reason is required.");
        }

        await rpc(
          "tl_admin_deactivate_rota_blueprint_row",
          {
            p_row_id: form.row_id,
            p_reason: form.reason.trim(),
          }
        );

        setMessage("Rota row deactivated.");
      }

      if (modal === "CANCEL") {
        if (!String(form.reason || "").trim()) {
          throw new Error("Cancellation reason is required.");
        }

        await rpc("tl_admin_cancel_duty_change", {
          p_change_group_id: form.change_group_id,
          p_reason: form.reason.trim(),
        });

        setMessage("Temporary duty change cancelled.");
      }

      setMessageType("success");
      setModal(null);
      setForm({});

      await load();

      if (typeof onChanged === "function") {
        onChanged();
      }
    } catch (error) {
      setMessage(error?.message || "Action failed.");
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  }

  function renderRotaRow(row, allowEdit = true) {
    const fullRow = fullRowById.get(row?.id) || row;

    const duty =
      fullRow?.duty_employee_name ||
      fullRow?.duty_name ||
      "—";

    const off =
      fullRow?.off_employee_name ||
      fullRow?.off_name ||
      "—";

    const shop = fullRow?.shop_name || "—";

    const employeeOff =
      fullRow?.entry_type === "EMPLOYEE_OFF";

    return (
      <div
        key={row?.id || `${row?.row_order}-${duty}`}
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          padding: 11,
          display: "grid",
          gap: 8,
          background:
            fullRow?.entry_type === "INCOMPLETE"
              ? "#fff7ed"
              : "#ffffff",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            alignItems: "flex-start",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "grid",
              gap: 3,
              minWidth: 0,
            }}
          >
            {employeeOff ? (
              <>
                <strong
                  style={{
                    fontSize: 13,
                    color: "#111827",
                  }}
                >
                  {duty}
                </strong>

                <span
                  style={{
                    fontSize: 12,
                    color: "#6b7280",
                  }}
                >
                  Employee OFF
                </span>
              </>
            ) : (
              <>
                <strong
                  style={{
                    fontSize: 13,
                    color: "#111827",
                  }}
                >
                  {duty}
                </strong>

                <span
                  style={{
                    fontSize: 12,
                    color: "#4b5563",
                  }}
                >
                  covers{" "}
                  <strong>
                    {off}
                  </strong>{" "}
                  at{" "}
                  <strong>
                    {shop}
                  </strong>
                </span>
              </>
            )}
          </div>

          <div
            style={{
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <Badge type={fullRow?.entry_type}>
              {fullRow?.entry_type || "—"}
            </Badge>

            <Badge type={fullRow?.mapping_status}>
              {fullRow?.mapping_status || "—"}
            </Badge>

            {allowEdit && fullRow?.id ? (
              <ActionButton
                secondary
                onClick={() => openEdit(fullRow)}
              >
                Edit
              </ActionButton>
            ) : null}
          </div>
        </div>

        {fullRow?.notes ? (
          <div
            style={{
              fontSize: 11,
              color: "#6b7280",
              lineHeight: 1.5,
            }}
          >
            {fullRow.notes}
          </div>
        ) : null}
      </div>
    );
  }

  function renderWeek(rows, cycleWeek) {
    return (
      <div style={{ display: "grid", gap: 14 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontWeight: 900,
                fontSize: 16,
                color: "#111827",
              }}
            >
              Week {cycleWeek}
            </div>

            <div
              style={{
                color: "#6b7280",
                fontSize: 12,
                marginTop: 2,
              }}
            >
              Permanent repeating rota
            </div>
          </div>

          <ActionButton
            onClick={() => openAdd(cycleWeek)}
          >
            + Add Row
          </ActionButton>
        </div>

        {DAYS.map(([dayNumber, dayLabel]) => {
          const dayRows = rows.filter(
            (row) => Number(row.weekday_iso) === dayNumber
          );

          return (
            <div
              key={`${cycleWeek}-${dayNumber}`}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                overflow: "hidden",
                background: "#ffffff",
              }}
            >
              <div
                style={{
                  padding: "10px 12px",
                  background: "#f9fafb",
                  borderBottom: "1px solid #e5e7eb",
                  fontWeight: 900,
                  fontSize: 13,
                  color: "#111827",
                }}
              >
                {dayLabel}
              </div>

              <div
                style={{
                  padding: 10,
                  display: "grid",
                  gap: 8,
                }}
              >
                {dayRows.length ? (
                  dayRows.map((row) =>
                    renderRotaRow(row, true)
                  )
                ) : (
                  <div
                    style={{
                      color: "#9ca3af",
                      fontSize: 12,
                    }}
                  >
                    No rota rows.
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function renderModalBody() {
    if (!modal) return null;

    if (modal === "MOVE") {
      return (
        <>
          <Field label="Date">
            <input
              type="date"
              style={inputStyle}
              value={form.duty_date || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  duty_date: e.target.value,
                })
              }
            />
          </Field>

          <Field label="Employee">
            <select
              style={inputStyle}
              value={form.employee_id || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  employee_id: e.target.value,
                })
              }
            >
              <option value="">Select employee</option>

              {dutyEmployees.map((employee) => (
                <option
                  key={employee.employee_id}
                  value={employee.employee_id}
                >
                  {employeeLabel(employee)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Move To Shop">
            <select
              style={inputStyle}
              value={form.shop_id || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  shop_id: e.target.value,
                })
              }
            >
              <option value="">Select shop</option>

              {shops.map((shop) => (
                <option
                  key={shop.shop_id}
                  value={shop.shop_id}
                >
                  {shop.shop_name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Reason">
            <textarea
              rows={3}
              style={inputStyle}
              value={form.reason || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  reason: e.target.value,
                })
              }
            />
          </Field>
        </>
      );
    }

    if (modal === "OFF") {
      return (
        <>
          <Field label="Date">
            <input
              type="date"
              style={inputStyle}
              value={form.duty_date || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  duty_date: e.target.value,
                })
              }
            />
          </Field>

          <Field label="Employee Going OFF">
            <select
              style={inputStyle}
              value={form.employee_id || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  employee_id: e.target.value,
                  relief_employee_id:
                    e.target.value ===
                    form.relief_employee_id
                      ? ""
                      : form.relief_employee_id,
                })
              }
            >
              <option value="">Select employee</option>

              {dutyEmployees.map((employee) => (
                <option
                  key={employee.employee_id}
                  value={employee.employee_id}
                >
                  {employeeLabel(employee)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Relief Employee (Optional)">
            <select
              style={inputStyle}
              value={form.relief_employee_id || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  relief_employee_id: e.target.value,
                })
              }
            >
              <option value="">
                No relief employee
              </option>

              {dutyEmployees
                .filter(
                  (employee) =>
                    employee.employee_id !==
                    form.employee_id
                )
                .map((employee) => (
                  <option
                    key={employee.employee_id}
                    value={employee.employee_id}
                  >
                    {employeeLabel(employee)}
                  </option>
                ))}
            </select>
          </Field>

          <Field label="Reason Category">
            <select
              style={inputStyle}
              value={
                form.reason_category ||
                "REQUESTED_OFF"
              }
              onChange={(e) =>
                setForm({
                  ...form,
                  reason_category: e.target.value,
                })
              }
            >
              {OFF_REASONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Reason / Explanation">
            <textarea
              rows={3}
              style={inputStyle}
              value={form.reason_text || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  reason_text: e.target.value,
                })
              }
            />
          </Field>
        </>
      );
    }

    if (modal === "SWAP") {
      return (
        <>
          <Field label="Date">
            <input
              type="date"
              style={inputStyle}
              value={form.duty_date || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  duty_date: e.target.value,
                })
              }
            />
          </Field>

          <Field label="Employee A">
            <select
              style={inputStyle}
              value={form.employee_a || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  employee_a: e.target.value,
                })
              }
            >
              <option value="">Select employee</option>

              {dutyEmployees.map((employee) => (
                <option
                  key={employee.employee_id}
                  value={employee.employee_id}
                >
                  {employeeLabel(employee)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Employee B">
            <select
              style={inputStyle}
              value={form.employee_b || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  employee_b: e.target.value,
                })
              }
            >
              <option value="">Select employee</option>

              {dutyEmployees.map((employee) => (
                <option
                  key={employee.employee_id}
                  value={employee.employee_id}
                >
                  {employeeLabel(employee)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Reason">
            <textarea
              rows={3}
              style={inputStyle}
              value={form.reason || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  reason: e.target.value,
                })
              }
            />
          </Field>
        </>
      );
    }
if (modal === "EDIT" || modal === "ADD") {
      return (
        <>
          {modal === "ADD" ? (
            <>
              <Field label="Week">
                <select
                  style={inputStyle}
                  value={form.cycle_week || 1}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      cycle_week: Number(
                        e.target.value
                      ),
                    })
                  }
                >
                  <option value={1}>Week 1</option>
                  <option value={2}>Week 2</option>
                </select>
              </Field>

              <Field label="Day">
                <select
                  style={inputStyle}
                  value={form.weekday_iso || 1}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      weekday_iso: Number(
                        e.target.value
                      ),
                    })
                  }
                >
                  {DAYS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          ) : null}

          <Field label="Rota Row Type">
            <select
              style={inputStyle}
              value={
                form.entry_type || "RELIEF_COVER"
              }
              onChange={(e) =>
                setForm({
                  ...form,
                  entry_type: e.target.value,
                })
              }
            >
              {ENTRY_TYPES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Duty / Relief Name">
            <input
              style={inputStyle}
              value={form.duty_name || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  duty_name: e.target.value,
                })
              }
              placeholder="e.g. Bether"
            />
          </Field>

          <Field label="Link Duty Employee (Optional)">
            <select
              style={inputStyle}
              value={form.duty_employee_id || ""}
              onChange={(e) =>
                linkEmployee(
                  "duty_employee_id",
                  "duty_name",
                  e.target.value
                )
              }
            >
              <option value="">
                Keep as unlinked name
              </option>

              {dutyEmployees.map((employee) => (
                <option
                  key={employee.employee_id}
                  value={employee.employee_id}
                >
                  {employeeLabel(employee)}
                </option>
              ))}
            </select>
          </Field>

          {form.entry_type !== "EMPLOYEE_OFF" ? (
            <>
              <Field label="Employee OFF Name">
                <input
                  style={inputStyle}
                  value={form.off_name || ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      off_name: e.target.value,
                    })
                  }
                  placeholder="Employee who is off"
                />
              </Field>

              <Field label="Link OFF Employee (Optional)">
                <select
                  style={inputStyle}
                  value={form.off_employee_id || ""}
                  onChange={(e) =>
                    linkEmployee(
                      "off_employee_id",
                      "off_name",
                      e.target.value
                    )
                  }
                >
                  <option value="">
                    Keep as unlinked name
                  </option>

                  {dutyEmployees.map((employee) => (
                    <option
                      key={employee.employee_id}
                      value={employee.employee_id}
                    >
                      {employeeLabel(employee)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Shop Name">
                <input
                  style={inputStyle}
                  value={form.shop_name || ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      shop_name: e.target.value,
                    })
                  }
                  placeholder="e.g. Kings"
                />
              </Field>

              <Field label="Link Shop (Optional)">
                <select
                  style={inputStyle}
                  value={form.shop_id || ""}
                  onChange={(e) =>
                    linkShop(e.target.value)
                  }
                >
                  <option value="">
                    Keep as unlinked shop
                  </option>

                  {shops.map((shop) => (
                    <option
                      key={shop.shop_id}
                      value={shop.shop_id}
                    >
                      {shop.shop_name}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          ) : null}

          <Field label="Notes">
            <textarea
              rows={3}
              style={inputStyle}
              value={form.notes || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  notes: e.target.value,
                })
              }
            />
          </Field>

          {modal === "EDIT" ? (
            <div
              style={{
                borderTop: "1px solid #e5e7eb",
                paddingTop: 12,
              }}
            >
              <ActionButton
                danger
                onClick={() =>
                  openDeactivate({
                    id: form.row_id,
                  })
                }
              >
                Deactivate This Rota Row
              </ActionButton>
            </div>
          ) : null}
        </>
      );
    }

    if (
      modal === "DEACTIVATE" ||
      modal === "CANCEL"
    ) {
      return (
        <Field
          label={
            modal === "CANCEL"
              ? "Cancellation Reason"
              : "Reason"
          }
        >
          <textarea
            rows={4}
            style={inputStyle}
            value={form.reason || ""}
            onChange={(e) =>
              setForm({
                ...form,
                reason: e.target.value,
              })
            }
          />
        </Field>
      );
    }

    return null;
  }

  const summary = data?.rota?.summary || {};

  const today = data?.rota?.today || {};
  const tomorrow = data?.rota?.tomorrow || {};

  const todayRows = Array.isArray(today?.rows)
    ? today.rows
    : [];

  const tomorrowRows = Array.isArray(tomorrow?.rows)
    ? tomorrow.rows
    : [];

  if (!apiBase || !supabaseAnonKey || !accessToken) {
    return (
      <div
        style={{
          border: "1px solid #fecaca",
          background: "#fef2f2",
          color: "#991b1b",
          borderRadius: 12,
          padding: 14,
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        Duty Control cannot load because the Supabase
        connection details are missing.
      </div>
    );
  }

  return (
    <>
      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          background: "#ffffff",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: 16,
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 19,
                fontWeight: 950,
                color: "#111827",
              }}
            >
              Duty & Rota Control
            </div>

            <div
              style={{
                marginTop: 3,
                fontSize: 12,
                color: "#6b7280",
              }}
            >
              2-week rota • temporary moves • OFF
              days • relief • swaps
            </div>
          </div>

          <ActionButton
            secondary
            onClick={load}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </ActionButton>
        </div>

        {message ? (
          <div
            style={{
              margin: "12px 16px 0",
              borderRadius: 10,
              padding: "10px 12px",
              fontSize: 12,
              fontWeight: 800,
              background:
                messageType === "error"
                  ? "#fef2f2"
                  : "#ecfdf5",
              color:
                messageType === "error"
                  ? "#991b1b"
                  : "#166534",
              border:
                messageType === "error"
                  ? "1px solid #fecaca"
                  : "1px solid #bbf7d0",
            }}
          >
            {message}
          </div>
        ) : null}

        <div
          style={{
            padding: 16,
            display: "grid",
            gap: 16,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(120px, 1fr))",
              gap: 8,
            }}
          >
            {[
              ["Total", summary.total_rows ?? 0],
              ["Linked", summary.linked_rows ?? 0],
              [
                "Partial",
                summary.partially_linked_rows ?? 0,
              ],
              ["Unlinked", summary.unlinked_rows ?? 0],
              [
                "Needs Review",
                summary.needs_review_rows ?? 0,
              ],
            ].map(([label, value]) => (
              <div
                key={label}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 11,
                  padding: 11,
                  background: "#f9fafb",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: "#6b7280",
                    fontWeight: 800,
                  }}
                >
                  {label}
                </div>

                <div
                  style={{
                    marginTop: 3,
                    fontSize: 19,
                    fontWeight: 950,
                    color: "#111827",
                  }}
                >
                  {value}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <ActionButton onClick={openMove}>
              Move Employee
            </ActionButton>

            <ActionButton onClick={openOff}>
              Mark OFF / Relief
            </ActionButton>

            <ActionButton onClick={openSwap}>
              Swap Employees
            </ActionButton>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 12,
            }}
          >
            <div
              style={{
                border: "1px solid #dbeafe",
                background: "#eff6ff",
                borderRadius: 12,
                padding: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  flexWrap: "wrap",
                  marginBottom: 9,
                }}
              >
                <div>
                  <div
                    style={{
                      fontWeight: 950,
                      color: "#1e3a8a",
                    }}
                  >
                    Today
                  </div>

                  <div
                    style={{
                      fontSize: 12,
                      color: "#1d4ed8",
                    }}
                  >
                    {formatDate(today.date)} • Week{" "}
                    {today.cycle_week || "—"} • Day{" "}
                    {today.cycle_day || "—"}
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 7,
                }}
              >
                {todayRows.length ? (
                  todayRows.map((row) =>
                    renderRotaRow(row, false)
                  )
                ) : (
                  <div
                    style={{
                      fontSize: 12,
                      color: "#6b7280",
                    }}
                  >
                    No rota rows today.
                  </div>
                )}
              </div>
            </div>

            <div
              style={{
                border: "1px solid #ddd6fe",
                background: "#f5f3ff",
                borderRadius: 12,
                padding: 12,
              }}
            >
              <div
                style={{
                  fontWeight: 950,
                  color: "#5b21b6",
                }}
              >
                Tomorrow
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: "#6d28d9",
                  marginBottom: 9,
                }}
              >
                {formatDate(tomorrow.date)} • Week{" "}
                {tomorrow.cycle_week || "—"} • Day{" "}
                {tomorrow.cycle_day || "—"}
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 7,
                }}
              >
                {tomorrowRows.length ? (
                  tomorrowRows.map((row) =>
                    renderRotaRow(row, false)
                  )
                ) : (
                  <div
                    style={{
                      fontSize: 12,
                      color: "#6b7280",
                    }}
                  >
                    No rota rows tomorrow.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              borderBottom: "1px solid #e5e7eb",
              paddingBottom: 10,
            }}
          >
            {[
              ["WEEK1", "Week 1"],
              ["WEEK2", "Week 2"],
              ["REVIEW", `Needs Review (${reviewRows.length})`],
              [
                "CHANGES",
                `Temporary Changes (${groupedTemporaryChanges.length})`,
              ],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setView(key)}
                style={{
                  border:
                    view === key
                      ? "1px solid #111827"
                      : "1px solid #d1d5db",
                  borderRadius: 9,
                  padding: "8px 11px",
                  background:
                    view === key ? "#111827" : "#ffffff",
                  color:
                    view === key ? "#ffffff" : "#374151",
                  fontSize: 12,
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {loading && !data ? (
            <div
              style={{
                textAlign: "center",
                padding: 30,
                color: "#6b7280",
                fontSize: 13,
              }}
            >
              Loading Duty Control...
            </div>
          ) : null}

          {view === "WEEK1"
            ? renderWeek(week1, 1)
            : null}

          {view === "WEEK2"
            ? renderWeek(week2, 2)
            : null}

          {view === "REVIEW" ? (
            <div
              style={{
                display: "grid",
                gap: 9,
              }}
            >
              <div>
                <div
                  style={{
                    fontWeight: 950,
                    fontSize: 16,
                  }}
                >
                  Rota Rows Needing Review
                </div>

                <div
                  style={{
                    fontSize: 12,
                    color: "#6b7280",
                    marginTop: 3,
                  }}
                >
                  These are the incomplete rows from
                  the original rota. Nothing is guessed.
                </div>
              </div>

              {reviewRows.length ? (
                reviewRows.map((row) =>
                  renderRotaRow(row, true)
                )
              ) : (
                <div
                  style={{
                    padding: 18,
                    border: "1px solid #bbf7d0",
                    background: "#f0fdf4",
                    borderRadius: 10,
                    fontSize: 12,
                    color: "#166534",
                    fontWeight: 800,
                  }}
                >
                  No rota rows currently need review.
                </div>
              )}
            </div>
          ) : null}

          {view === "CHANGES" ? (
            <div
              style={{
                display: "grid",
                gap: 10,
              }}
            >
              <div>
                <div
                  style={{
                    fontWeight: 950,
                    fontSize: 16,
                  }}
                >
                  Temporary Duty Changes
                </div>

                <div
                  style={{
                    marginTop: 3,
                    fontSize: 12,
                    color: "#6b7280",
                  }}
                >
                  These override the normal rota only
                  for their selected date.
                </div>
              </div>

              {groupedTemporaryChanges.length ? (
                groupedTemporaryChanges.map((group) => (
                  <div
                    key={group.change_group_id}
                    style={{
                      border: "1px solid #ddd6fe",
                      background: "#faf5ff",
                      borderRadius: 12,
                      padding: 12,
                      display: "grid",
                      gap: 9,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent:
                          "space-between",
                        gap: 10,
                        flexWrap: "wrap",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontWeight: 950,
                            fontSize: 13,
                          }}
                        >
                          {formatDate(
                            group.duty_date
                          )}
                        </div>

                        <Badge type="TEMPORARY">
                          TEMPORARY
                        </Badge>
                      </div>

                      <ActionButton
                        danger
                        onClick={() =>
                          openCancel(group)
                        }
                      >
                        Cancel Change
                      </ActionButton>
                    </div>

                    {group.rows.map((row) => (
                      <div
                        key={row.id}
                        style={{
                          borderTop:
                            "1px solid #e9d5ff",
                          paddingTop: 8,
                          fontSize: 12,
                          lineHeight: 1.6,
                        }}
                      >
                        <strong>
                          {row.employee_name}
                        </strong>

                        {" — "}

                        {row.action_type}

                        {row.effective_shop_name
                          ? ` → ${row.effective_shop_name}`
                          : ""}

                        {row.relief_employee_name
                          ? ` • Relief: ${row.relief_employee_name}`
                          : ""}

                        {row.reason_text ? (
                          <div
                            style={{
                              color: "#6b7280",
                            }}
                          >
                            {row.reason_text}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ))
              ) : (
                <div
                  style={{
                    padding: 18,
                    background: "#f9fafb",
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    fontSize: 12,
                    color: "#6b7280",
                  }}
                >
                  No active temporary duty changes.
                </div>
              )}
            </div>
          ) : null}
        </div>
      </section>

      {modal ? (
        <div
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              closeModal();
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(17,24,39,0.55)",
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
            padding: "40px 16px",
            overflowY: "auto",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 540,
              background: "#ffffff",
              borderRadius: 16,
              boxShadow:
                "0 24px 60px rgba(0,0,0,0.25)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "14px 16px",
                borderBottom:
                  "1px solid #e5e7eb",
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                alignItems: "center",
              }}
            >
              <strong
                style={{
                  fontSize: 16,
                  color: "#111827",
                }}
              >
                {modal === "MOVE"
                  ? "Move Employee"
                  : modal === "OFF"
                  ? "Mark Employee OFF"
                  : modal === "SWAP"
                  ? "Swap Employees"
                  : modal === "EDIT"
                  ? "Edit Permanent Rota"
                  : modal === "ADD"
                  ? "Add Permanent Rota Row"
                  : modal === "DEACTIVATE"
                  ? "Deactivate Rota Row"
                  : "Cancel Temporary Change"}
              </strong>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                style={{
                  border: 0,
                  background: "transparent",
                  fontSize: 22,
                  cursor: "pointer",
                  color: "#6b7280",
                }}
              >
                ×
              </button>
            </div>

            <div
              style={{
                padding: 16,
                display: "grid",
                gap: 13,
              }}
            >
              {renderModalBody()}
            </div>

            <div
              style={{
                padding: "12px 16px",
                borderTop:
                  "1px solid #e5e7eb",
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                background: "#f9fafb",
              }}
            >
              <ActionButton
                secondary
                onClick={closeModal}
                disabled={saving}
              >
                Cancel
              </ActionButton>

              <ActionButton
                danger={
                  modal === "DEACTIVATE" ||
                  modal === "CANCEL"
                }
                onClick={submitAction}
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : modal === "DEACTIVATE"
                  ? "Deactivate"
                  : modal === "CANCEL"
                  ? "Cancel Change"
                  : "Save"}
              </ActionButton>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
