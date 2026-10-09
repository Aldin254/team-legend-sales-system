"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const colors = {
  navy: "#111C30",
  border: "#cbd5e1",
  text: "#0f172a",
  muted: "#64748b",
  green: "#15803d",
  red: "#b91c1c",
};

function money(value) {
  return `KES ${Number(value || 0).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function nairobiTime(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-KE", {
    timeZone: "Africa/Nairobi",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function AdminBonusControlPanel({
  user,
  selectedDate,
}) {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const accessToken =
    user?.access_token || null;

  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);

  const [selectedEmployeeId, setSelectedEmployeeId] =
    useState("");

  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const requestIdRef = useRef(0);

  // ==========================================
  // SUPABASE RPC
  // ==========================================

  const rpc = useCallback(
    async (functionName, payload = {}) => {
      if (!supabaseUrl || !supabaseAnonKey || !accessToken) {
        throw new Error(
          "Admin session or Supabase configuration is missing."
        );
      }

      const response = await fetch(
        `${String(supabaseUrl).replace(/\/+$/, "")}/rest/v1/rpc/${functionName}`,
        {
          method: "POST",

          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },

          body: JSON.stringify(payload),
          cache: "no-store",
        }
      );

      const raw = await response.text();

      let result = null;

      try {
        result = raw ? JSON.parse(raw) : null;
      } catch {
        result = null;
      }

      if (!response.ok) {
        throw new Error(
          result?.message ||
          result?.details ||
          result?.hint ||
          `Bonus request failed (${response.status}).`
        );
      }

      return result;
    },
    [supabaseUrl, supabaseAnonKey, accessToken]
  );

  // ==========================================
  // LOAD BONUS DATA
  // ==========================================

  const loadData = useCallback(
    async (silent = false) => {
      const requestId = ++requestIdRef.current;

      if (!silent) {
        setLoading(true);
        setSnapshot(null);
      }

      setError("");

      try {
        if (!selectedDate) {
          throw new Error("Choose a duty date.");
        }

        const result = await rpc(
          "tl_admin_bonus_control_snapshot",
          {
            p_bonus_date: selectedDate,
          }
        );

        if (requestId === requestIdRef.current) {
          setSnapshot(result || null);
        }
      } catch (err) {
        if (requestId === requestIdRef.current) {
          setError(
            err?.message || "Unable to load Bonus Control."
          );
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [rpc, selectedDate]
  );

  useEffect(() => {
    setSelectedEmployeeId("");
    setReason("");
    setSuccess("");
    loadData();

    return () => {
      requestIdRef.current += 1;
    };
  }, [loadData]);

  // ==========================================
  // EMPLOYEES AND HISTORY
  // ==========================================

  const employees = useMemo(
    () =>
      Array.isArray(snapshot?.employees)
        ? snapshot.employees
        : [],
    [snapshot]
  );

  const manageable = useMemo(
    () =>
      employees.filter(
        (employee) => employee.can_manage === true
      ),
    [employees]
  );

  const history = Array.isArray(snapshot?.history)
    ? snapshot.history
    : [];

  const isBonusDay =
    snapshot?.bonus_day === true;

  const selectedEmployee =
    manageable.find(
      (employee) =>
        employee.employee_id === selectedEmployeeId
    ) || null;

  useEffect(() => {
    setSelectedEmployeeId((current) =>
      manageable.some(
        (employee) => employee.employee_id === current
      )
        ? current
        : manageable[0]?.employee_id || ""
    );
  }, [manageable]);
  // ==========================================
  // GRANT OR REVOKE BONUS
  // ==========================================

  async function applyBonus(eligible) {
    setError("");
    setSuccess("");

    if (!isBonusDay || !selectedEmployee) {
      setError(
        "Select an employee with a configured Monday or Friday Bonus."
      );
      return;
    }

    const cleanReason = reason.trim();

    if (cleanReason.length < 2 || cleanReason.length > 500) {
      setError(
        "Enter a reason between 2 and 500 characters."
      );
      return;
    }

    const action = eligible ? "GRANT" : "REVOKE";

    const confirmed = window.confirm(
      `${action} BONUS\n\nEmployee: ${selectedEmployee.employee_name}\n` +
      `Date: ${selectedDate}\nConfigured Bonus: ${money(selectedEmployee.bonus_rate)}\n` +
      `Reason: ${cleanReason}\n\nContinue?`
    );

    if (!confirmed) return;

    setApplying(true);

    try {
      await rpc("tl_admin_set_employee_bonus", {
        p_employee_id: selectedEmployee.employee_id,
        p_bonus_date: selectedDate,
        p_eligible: eligible,
        p_reason: cleanReason,
      });

      setReason("");

      setSuccess(
        `Bonus ${eligible ? "granted" : "revoked"} for ${selectedEmployee.employee_name}.`
      );

      await loadData(true);
    } catch (err) {
      setError(
        err?.message || "Unable to update Bonus."
      );
    } finally {
      setApplying(false);
    }
  }

  const buttonDisabled =
    applying ||
    loading ||
    !isBonusDay ||
    !selectedEmployee;

  // ==========================================
  // DISPLAY
  // ==========================================

  return (
    <section
      style={{
        background: "white",
        border: `1px solid ${colors.border}`,
        borderRadius: 7,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          background: colors.navy,
          color: "white",
          padding: "12px 14px",
          fontSize: 12,
          fontWeight: 900,
        }}
      >
        ADMIN BONUS CONTROL — 24-HOUR SHOPS
      </div>

      <div
        style={{
          padding: 14,
          display: "grid",
          gap: 12,
          color: colors.text,
          fontSize: 12,
        }}
      >
        {/* DATE AND REFRESH */}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <div>
            <strong>
              Duty date: {selectedDate || "—"}
            </strong>

            <div
              style={{
                color: colors.muted,
                marginTop: 4,
              }}
            >
              Uses the Duty Date selected above.
              Only existing Monday/Friday Bonus
              amounts can be granted or revoked.
            </div>
          </div>

          <button
            type="button"
            onClick={() => loadData()}
            disabled={loading || applying}
            style={secondaryButton}
          >
            {loading ? "Loading..." : "Refresh Bonus"}
          </button>
        </div>

        {/* MESSAGES */}

        {error && (
          <div role="alert" style={errorBox}>
            {error}
          </div>
        )}

        {success && (
          <div role="status" style={successBox}>
            {success}
          </div>
        )}

        {!loading && snapshot && !isBonusDay && (
          <div style={noticeBox}>
            No Bonus is scheduled for this day.
            Select a Monday or Friday in the
            Duty Date field above.
          </div>
        )}

        {loading && !snapshot && (
          <div style={noticeBox}>
            Loading Bonus Control...
          </div>
        )}

        {!loading &&
          isBonusDay &&
          manageable.length === 0 && (
            <div style={noticeBox}>
              No on-duty 24-hour shop employees
              have a configured Bonus for this date.
            </div>
          )}

        {/* EMPLOYEE SELECTION */}

        {isBonusDay && manageable.length > 0 && (
          <>
            <label
              style={{
                display: "grid",
                gap: 6,
                fontWeight: 800,
              }}
            >
              EMPLOYEE (24-HOUR SHOPS ONLY)

              <select
                value={selectedEmployeeId}
                onChange={(event) =>
                  setSelectedEmployeeId(event.target.value)
                }
                style={fieldStyle}
              >
                {manageable.map((employee) => (
                  <option
                    key={employee.employee_id}
                    value={employee.employee_id}
                  >
                    {employee.employee_name}
                    {" — "}
                    {employee.shop_name || "Shop"}
                    {" — "}
                    {money(employee.bonus_rate)}
                  </option>
                ))}
              </select>
            </label>

            {/* CURRENT BONUS STATUS */}

            {selectedEmployee && (
              <div style={noticeBox}>
                Configured Bonus:{" "}
                <strong>
                  {money(selectedEmployee.bonus_rate)}
                </strong>

                {" • "}Current status:{" "}
                <strong>
                  {selectedEmployee.bonus_eligible
                    ? "ELIGIBLE"
                    : "REVOKED"}
                </strong>

                {" • "}Admin override:{" "}
                <strong>
                  {selectedEmployee.bonus_override === null ||
                  selectedEmployee.bonus_override === undefined
                    ? "NONE"
                    : selectedEmployee.bonus_override
                    ? "GRANTED"
                    : "REVOKED"}
                </strong>
              </div>
            )}

            {/* REASON */}

            <label
              style={{
                display: "grid",
                gap: 6,
                fontWeight: 800,
              }}
            >
              REASON (REQUIRED)

              <input
                type="text"
                maxLength={500}
                value={reason}
                onChange={(event) =>
                  setReason(event.target.value)
                }
                placeholder="Reason for granting or revoking Bonus"
                style={fieldStyle}
              />
            </label>

            {/* ADMIN ACTIONS */}

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <button
                type="button"
                disabled={buttonDisabled}
                onClick={() => applyBonus(true)}
                style={{
                  ...actionButton,
                  backgroundColor: colors.green,
                  opacity: buttonDisabled ? 0.5 : 1,
                }}
              >
                {applying ? "Saving..." : "Grant Bonus"}
              </button>

              <button
                type="button"
                disabled={buttonDisabled}
                onClick={() => applyBonus(false)}
                style={{
                  ...actionButton,
                  backgroundColor: colors.red,
                  opacity: buttonDisabled ? 0.5 : 1,
                }}
              >
                {applying ? "Saving..." : "Revoke Bonus"}
              </button>
            </div>
          </>
        )}
{/* ==========================================
            BONUS AUDIT HISTORY
        ========================================== */}

        <div
          style={{
            borderTop: `1px solid ${colors.border}`,
            paddingTop: 12,
            fontWeight: 900,
          }}
        >
          BONUS AUDIT HISTORY — {selectedDate || "—"}
        </div>

        {history.length === 0 ? (
          <div style={{ color: colors.muted }}>
            No Bonus changes recorded for this date.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                borderCollapse: "collapse",
                width: "100%",
                minWidth: 650,
                textAlign: "left",
              }}
            >
              <thead>
                <tr>
                  {[
                    "Employee",
                    "Action",
                    "Amount",
                    "Reason",
                    "Admin",
                    "Nairobi time",
                  ].map((title) => (
                    <th key={title} style={cellStyle}>
                      {title}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {history.map((entry) => (
                  <tr key={entry.id}>
                    <td style={cellStyle}>
                      {entry.employee_name || "—"}
                    </td>

                    <td
                      style={{
                        ...cellStyle,
                        color: entry.eligible
                          ? colors.green
                          : colors.red,
                        fontWeight: 900,
                      }}
                    >
                      {entry.action}
                    </td>

                    <td style={cellStyle}>
                      {money(entry.configured_amount)}
                    </td>

                    <td style={cellStyle}>
                      {entry.reason || "—"}
                    </td>

                    <td style={cellStyle}>
                      {entry.admin_name || "ADMIN"}
                    </td>

                    <td style={cellStyle}>
                      {nairobiTime(entry.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

// ==========================================
// STYLES
// ==========================================

const fieldStyle = {
  width: "100%",
  minHeight: 36,
  boxSizing: "border-box",
  padding: "8px 10px",
  border: "1px solid #cbd5e1",
  borderRadius: 5,
  backgroundColor: "#ffffff",
  color: "#0f172a",
};

const secondaryButton = {
  padding: "8px 12px",
  border: "none",
  borderRadius: 5,
  backgroundColor: "#0e7490",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};

const actionButton = {
  padding: "10px 16px",
  border: "none",
  borderRadius: 5,
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};

const cellStyle = {
  padding: 9,
  borderBottom: "1px solid #e2e8f0",
  fontSize: 11,
  verticalAlign: "top",
};

const noticeBox = {
  padding: 10,
  border: "1px solid #bfdbfe",
  borderRadius: 5,
  backgroundColor: "#eff6ff",
  color: "#1e40af",
};

const errorBox = {
  padding: 10,
  border: "1px solid #fca5a5",
  borderRadius: 5,
  backgroundColor: "#fee2e2",
  color: "#991b1b",
};

const successBox = {
  padding: 10,
  border: "1px solid #86efac",
  borderRadius: 5,
  backgroundColor: "#dcfce7",
  color: "#166534",
};
