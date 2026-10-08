"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

// ==========================================================
// HELPERS
// ==========================================================

function nairobiToday() {
  try {
    const parts =
      new Intl.DateTimeFormat(
        "en-CA",
        {
          timeZone:
            "Africa/Nairobi",
          year:
            "numeric",
          month:
            "2-digit",
          day:
            "2-digit",
        }
      ).formatToParts(
        new Date()
      );

    const values = {};

    for (const part of parts) {
      if (
        part.type !==
        "literal"
      ) {
        values[
          part.type
        ] = part.value;
      }
    }

    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    return new Date()
      .toISOString()
      .slice(0, 10);
  }
}

function money(value) {
  const number =
    Number(value || 0);

  return new Intl.NumberFormat(
    "en-KE",
    {
      minimumFractionDigits:
        2,
      maximumFractionDigits:
        2,
    }
  ).format(number);
}

function displayTime(value) {
  if (!value) {
    return "—";
  }

  return String(value)
    .slice(0, 8);
}

// ==========================================================
// COMPONENT
// ==========================================================

export default function AdminAttendanceControlPanel({
  user,
}) {
  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env
      .NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const accessToken =
    user?.access_token ||
    null;

  const [
    selectedDate,
    setSelectedDate,
  ] = useState(
    nairobiToday()
  );

  const [
    snapshot,
    setSnapshot,
  ] = useState(null);

  const [
    history,
    setHistory,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    applying,
    setApplying,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  const [
    selectedEmployeeId,
    setSelectedEmployeeId,
  ] = useState("");

  const [
    selectedAction,
    setSelectedAction,
  ] = useState(
    "REVOKE_LUNCH"
  );

  const [
    reason,
    setReason,
  ] = useState("");

  // ========================================================
  // RPC
  // ========================================================

  const rpc =
    useCallback(
      async (
        functionName,
        payload = {}
      ) => {
        if (
          !supabaseUrl ||
          !supabaseAnonKey ||
          !accessToken
        ) {
          throw new Error(
            "Admin session or Supabase configuration is missing."
          );
        }

        const response =
          await fetch(
            `${supabaseUrl}/rest/v1/rpc/${functionName}`,
            {
              method:
                "POST",

              headers: {
                apikey:
                  supabaseAnonKey,

                Authorization:
                  `Bearer ${accessToken}`,

                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify(
                  payload
                ),
            }
          );

        const text =
          await response.text();

        let data = null;

        if (text) {
          try {
            data =
              JSON.parse(
                text
              );
          } catch {
            data =
              text;
          }
        }

        if (!response.ok) {
          const message =
            data?.message ||
            data?.error_description ||
            data?.hint ||
            text ||
            "Request failed.";

          throw new Error(
            message
          );
        }

        return data;
      },
      [
        accessToken,
        supabaseAnonKey,
        supabaseUrl,
      ]
    );

  // ========================================================
  // LOAD
  // ========================================================

  const loadData =
    useCallback(
      async (
        silent = false
      ) => {
        if (!silent) {
          setLoading(
            true
          );
        }

        setError("");

        try {
          const [
            snapshotData,
            historyData,
          ] =
            await Promise.all([
              rpc(
                "tl_admin_attendance_control_snapshot",
                {
                  p_duty_date:
                    selectedDate,
                }
              ),

              rpc(
                "tl_admin_meal_override_history",
                {
                  p_employee_id:
                    null,

                  p_meal_date:
                    selectedDate,
                }
              ),
            ]);

          setSnapshot(
            snapshotData ||
              null
          );

          setHistory(
            Array.isArray(
              historyData
            )
              ? historyData
              : []
          );
        } catch (err) {
          setError(
            err?.message ||
              "Unable to load attendance control."
          );
        } finally {
          if (!silent) {
            setLoading(
              false
            );
          }
        }
      },
      [
        rpc,
        selectedDate,
      ]
    );

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Optional light refresh.
  useEffect(() => {
    const timer =
      setInterval(
        () => {
          loadData(true);
        },
        30000
      );

    return () =>
      clearInterval(
        timer
      );
  }, [loadData]);

  // ========================================================
  // EMPLOYEES
  // ========================================================

  const employees =
    useMemo(() => {
      return Array.isArray(
        snapshot?.employees
      )
        ? snapshot.employees
        : [];
    }, [snapshot]);

  const selectedEmployee =
    useMemo(() => {
      return (
        employees.find(
          (employee) =>
            employee.employee_id ===
            selectedEmployeeId
        ) || null
      );
    }, [
      employees,
      selectedEmployeeId,
    ]);

  useEffect(() => {
    if (
      !selectedEmployeeId &&
      employees.length > 0
    ) {
      setSelectedEmployeeId(
        employees[0]
          .employee_id
      );
    }
  }, [
    employees,
    selectedEmployeeId,
  ]);

  // ========================================================
  // ACTION MAPPING
  // ========================================================

  function getActionPayload() {
    switch (
      selectedAction
    ) {
      case "GRANT_LUNCH":
        return {
          mealType:
            "LUNCH",
          eligible:
            true,
        };

      case "REVOKE_LUNCH":
        return {
          mealType:
            "LUNCH",
          eligible:
            false,
        };

      case "GRANT_SUPPER":
        return {
          mealType:
            "SUPPER",
          eligible:
            true,
        };

      case "REVOKE_SUPPER":
        return {
          mealType:
            "SUPPER",
          eligible:
            false,
        };

      case "GRANT_BOTH":
        return {
          mealType:
            "BOTH",
          eligible:
            true,
        };

      case "REVOKE_BOTH":
        return {
          mealType:
            "BOTH",
          eligible:
            false,
        };

      default:
        return null;
    }
  }

  // ========================================================
  // APPLY
  // ========================================================

  async function applyOverride() {
    setError("");
    setSuccess("");

    if (
      !selectedEmployeeId
    ) {
      setError(
        "Select an employee."
      );
      return;
    }

    if (
      reason.trim().length <
      2
    ) {
      setError(
        "Enter a reason for the meal override."
      );
      return;
    }

    const action =
      getActionPayload();

    if (!action) {
      setError(
        "Select an action."
      );
      return;
    }

    const employeeName =
      selectedEmployee
        ?.employee_name ||
      "this employee";

    const actionName =
      selectedAction
        .replaceAll(
          "_",
          " "
        );

    const confirmed =
      window.confirm(
        `${actionName}\n\nEmployee: ${employeeName}\nDate: ${selectedDate}\nReason: ${reason.trim()}\n\nContinue?`
      );

    if (!confirmed) {
      return;
    }

    setApplying(true);

    try {
      await rpc(
        "tl_admin_set_employee_meal",
        {
          p_employee_id:
            selectedEmployeeId,

          p_meal_date:
            selectedDate,

          p_meal_type:
            action.mealType,

          p_eligible:
            action.eligible,

          p_reason:
            reason.trim(),
        }
      );

      setSuccess(
        `${actionName} applied successfully for ${employeeName}.`
      );

      setReason("");

      await loadData(true);
    } catch (err) {
      setError(
        err?.message ||
          "Unable to apply meal override."
      );
    } finally {
      setApplying(
        false
      );
    }
  }

  // ========================================================
  // RENDER
  // ========================================================

  return (
    <div style={panelStyle}>
      {/* ================================================ */}
      {/* HEADER */}
      {/* ================================================ */}

      <div style={panelHeaderStyle}>
        <div>
          <div style={panelTitleStyle}>
            ATTENDANCE CONTROL
          </div>

          <div style={panelSubtitleStyle}>
            Sign-in monitoring • 24-hour exemptions • Lunch / Supper control
          </div>
        </div>

        <div style={headerBadgeStyle}>
          ADMIN ONLY
        </div>
      </div>

      {/* ================================================ */}
      {/* DATE */}
      {/* ================================================ */}

      <div style={toolbarStyle}>
        <div style={fieldGroupStyle}>
          <label style={labelStyle}>
            DUTY DATE
          </label>

          <input
            type="date"
            value={
              selectedDate
            }
            onChange={(
              event
            ) => {
              setSelectedDate(
                event.target
                  .value
              );

              setSelectedEmployeeId(
                ""
              );

              setSuccess(
                ""
              );
            }}
            style={inputStyle}
          />
        </div>

        <button
          type="button"
          onClick={() =>
            loadData()
          }
          style={refreshButtonStyle}
        >
          Refresh
        </button>
      </div>

      {/* ================================================ */}
      {/* MESSAGES */}
      {/* ================================================ */}

      {error && (
        <div style={errorStyle}>
          {error}
        </div>
      )}

      {success && (
        <div style={successStyle}>
          {success}
        </div>
      )}

      {/* ================================================ */}
      {/* SUMMARY */}
      {/* ================================================ */}

      <div style={summaryGridStyle}>
        <SummaryBox
          label="Duty Date"
          value={
            snapshot
              ?.duty_date ||
            selectedDate
          }
        />

        <SummaryBox
          label="On Duty"
          value={
            snapshot
              ?.employee_count ??
            employees.length
          }
        />

        <SummaryBox
          label="24HR Exempt"
          value={
            employees.filter(
              (employee) =>
                employee
                  .sign_in_required ===
                false
            ).length
          }
        />

        <SummaryBox
          label="Overrides Today"
          value={
            history.length
          }
        />
      </div>

      {/* ================================================ */}
      {/* TABLE */}
      {/* ================================================ */}

      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>
          EMPLOYEES ON DUTY
        </div>

        {loading ? (
          <div style={emptyStyle}>
            Loading attendance...
          </div>
        ) : employees.length ===
          0 ? (
          <div style={emptyStyle}>
            No on-duty employees found for this date.
          </div>
        ) : (
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>
                    Employee
                  </th>

                  <th style={thStyle}>
                    Shop
                  </th>

                  <th style={thStyle}>
                    Sign-In
                  </th>

                  <th style={thStyle}>
                    Time
                  </th>

                  <th style={thStyle}>
                    Lunch
                  </th>

                  <th style={thStyle}>
                    Supper
                  </th>

                  <th style={thStyle}>
                    Select
                  </th>
                </tr>
              </thead>

              <tbody>
                {employees.map(
                  (employee) => {
                    const selected =
                      selectedEmployeeId ===
                      employee.employee_id;

                    const exempt =
                      employee.sign_in_required ===
                      false;

                    return (
                      <tr
                        key={
                          employee.employee_id
                        }
                        style={
                          selected
                            ? selectedRowStyle
                            : undefined
                        }
                      >
                        <td style={tdStyle}>
                          <strong>
                            {
                              employee.employee_name
                            }
                          </strong>
                        </td>

                        <td style={tdStyle}>
                          <div>
                            {
                              employee.shop_name ||
                              "—"
                            }
                          </div>

                          {employee.shop_type ===
                            "24_HOUR" && (
                            <div style={smallMutedStyle}>
                              24-HOUR SHOP
                            </div>
                          )}
                        </td>

                        <td style={tdStyle}>
                          {exempt ? (
                            <Badge
                              text="EXEMPT"
                              type="blue"
                            />
                          ) : employee.signed_in ? (
                            <Badge
                              text={
                                employee.attendance_status ||
                                "SIGNED IN"
                              }
                              type={
                                employee.attendance_status ===
                                "LATE"
                                  ? "red"
                                  : "green"
                              }
                            />
                          ) : (
                            <Badge
                              text="NOT SIGNED IN"
                              type="orange"
                            />
                          )}

                          {exempt && (
                            <div style={smallMutedStyle}>
                              {employee.shop_type ===
                              "24_HOUR"
                                ? "24HR SHOP"
                                : "EXEMPT RULE"}
                            </div>
                          )}
                        </td>

                        <td style={tdStyle}>
                          {exempt
                            ? "—"
                            : displayTime(
                                employee.first_signin_local_time
                              )}
                        </td>

                        <td style={tdStyle}>
                          <MealState
                            eligible={
                              employee.lunch_eligible
                            }
                            overridden={
                              employee.lunch_override !==
                                null &&
                              employee.lunch_override !==
                                undefined
                            }
                            amount={
                              employee.lunch_rate
                            }
                          />
                        </td>

                        <td style={tdStyle}>
                          <MealState
                            eligible={
                              employee.supper_eligible
                            }
                            overridden={
                              employee.supper_override !==
                                null &&
                              employee.supper_override !==
                                undefined
                            }
                            amount={
                              employee.supper_rate
                            }
                          />
                        </td>

                        <td style={tdStyle}>
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedEmployeeId(
                                employee.employee_id
                              )
                            }
                            style={{
                              ...selectButtonStyle,

                              ...(selected
                                ? selectedButtonStyle
                                : {}),
                            }}
                          >
                            {selected
                              ? "SELECTED"
                              : "MANAGE"}
                          </button>
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ================================================ */}
      {/* MEAL CONTROL */}
      {/* ================================================ */}

      <div style={mealControlStyle}>
        <div style={sectionTitleStyle}>
          LUNCH / SUPPER OVERRIDE
        </div>

        <div style={selectedEmployeeStyle}>
          <span>
            Selected Employee
          </span>

          <strong>
            {selectedEmployee
              ?.employee_name ||
              "None selected"}
          </strong>

          {selectedEmployee && (
            <span style={selectedShopStyle}>
              {selectedEmployee.shop_name}
              {selectedEmployee.shop_type ===
              "24_HOUR"
                ? " • 24HR SIGN-IN EXEMPT"
                : ""}
            </span>
          )}
        </div>

        <div style={controlGridStyle}>
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>
              ACTION
            </label>

            <select
              value={
                selectedAction
              }
              onChange={(
                event
              ) =>
                setSelectedAction(
                  event.target
                    .value
                )
              }
              style={inputStyle}
            >
              <option value="GRANT_LUNCH">
                Grant Lunch
              </option>

              <option value="REVOKE_LUNCH">
                Revoke Lunch
              </option>

              <option value="GRANT_SUPPER">
                Grant Supper
              </option>

              <option value="REVOKE_SUPPER">
                Revoke Supper
              </option>

              <option value="GRANT_BOTH">
                Grant Lunch + Supper
              </option>

              <option value="REVOKE_BOTH">
                Revoke Lunch + Supper
              </option>
            </select>
          </div>

          <div style={reasonGroupStyle}>
            <label style={labelStyle}>
              REASON
            </label>

            <input
              type="text"
              value={reason}
              maxLength={500}
              placeholder="Example: Disciplinary action / Admin approved meal"
              onChange={(
                event
              ) =>
                setReason(
                  event.target
                    .value
                )
              }
              style={inputStyle}
            />
          </div>

          <button
            type="button"
            disabled={
              applying ||
              !selectedEmployee
            }
            onClick={
              applyOverride
            }
            style={{
              ...applyButtonStyle,

              opacity:
                applying ||
                !selectedEmployee
                  ? 0.55
                  : 1,
            }}
          >
            {applying
              ? "Applying..."
              : "Apply Override"}
          </button>
        </div>

        <div style={controlNoteStyle}>
          Admin overrides do not erase the original attendance result.
          The latest Admin meal decision becomes the effective Lunch or
          Supper status and remains in the audit history.
        </div>
      </div>

      {/* ================================================ */}
      {/* HISTORY */}
      {/* ================================================ */}

      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>
          OVERRIDE HISTORY
        </div>

        {history.length ===
        0 ? (
          <div style={emptyStyle}>
            No meal overrides recorded for {selectedDate}.
          </div>
        ) : (
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>
                    Employee
                  </th>

                  <th style={thStyle}>
                    Meal
                  </th>

                  <th style={thStyle}>
                    Action
                  </th>

                  <th style={thStyle}>
                    Reason
                  </th>

                  <th style={thStyle}>
                    Admin
                  </th>

                  <th style={thStyle}>
                    Time
                  </th>
                </tr>
              </thead>

              <tbody>
                {history.map(
                  (item) => (
                    <tr
                      key={
                        item.id
                      }
                    >
                      <td style={tdStyle}>
                        {
                          item.employee_name
                        }
                      </td>

                      <td style={tdStyle}>
                        {
                          item.meal_type
                        }
                      </td>

                      <td style={tdStyle}>
                        <Badge
                          text={
                            item.action
                          }
                          type={
                            item.eligible
                              ? "green"
                              : "red"
                          }
                        />
                      </td>

                      <td style={tdStyle}>
                        {
                          item.reason
                        }
                      </td>

                      <td style={tdStyle}>
                        {
                          item.admin_name ||
                          "ADMIN"
                        }
                      </td>

                      <td style={tdStyle}>
                        {item.created_at
                          ? new Date(
                              item.created_at
                            ).toLocaleString(
                              "en-KE",
                              {
                                timeZone:
                                  "Africa/Nairobi",
                              }
                            )
                          : "—"}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================================
// SMALL COMPONENTS
// ==========================================================

function SummaryBox({
  label,
  value,
}) {
  return (
    <div style={summaryBoxStyle}>
      <div style={summaryLabelStyle}>
        {label}
      </div>

      <div style={summaryValueStyle}>
        {value}
      </div>
    </div>
  );
}

function Badge({
  text,
  type,
}) {
  const styles = {
    green: {
      backgroundColor:
        "#dcfce7",
      color:
        "#166534",
      border:
        "1px solid #86efac",
    },

    red: {
      backgroundColor:
        "#fee2e2",
      color:
        "#991b1b",
      border:
        "1px solid #fca5a5",
    },

    orange: {
      backgroundColor:
        "#ffedd5",
      color:
        "#9a3412",
      border:
        "1px solid #fdba74",
    },

    blue: {
      backgroundColor:
        "#dbeafe",
      color:
        "#1e40af",
      border:
        "1px solid #93c5fd",
    },
  };

  return (
    <span
      style={{
        ...badgeStyle,
        ...(styles[type] ||
          styles.blue),
      }}
    >
      {text}
    </span>
  );
}

function MealState({
  eligible,
  overridden,
  amount,
}) {
  return (
    <div>
      <Badge
        text={
          eligible
            ? "ELIGIBLE"
            : "REVOKED"
        }
        type={
          eligible
            ? "green"
            : "red"
        }
      />

      <div style={smallMutedStyle}>
        KES {money(amount)}

        {overridden
          ? " • ADMIN"
          : ""}
      </div>
    </div>
  );
}

// ==========================================================
// STYLES
// ==========================================================

const panelStyle = {
  width:
    "100%",

  display:
    "flex",

  flexDirection:
    "column",

  gap:
    "14px",
};

const panelHeaderStyle = {
  padding:
    "16px 18px",

  backgroundColor:
    "#111C30",

  borderRadius:
    "7px",

  color:
    "#ffffff",

  display:
    "flex",

  justifyContent:
    "space-between",

  alignItems:
    "center",

  gap:
    "12px",
};

const panelTitleStyle = {
  fontSize:
    "15px",

  fontWeight:
    "900",
};

const panelSubtitleStyle = {
  marginTop:
    "4px",

  fontSize:
    "10px",

  color:
    "#cbd5e1",
};

const headerBadgeStyle = {
  padding:
    "7px 11px",

  border:
    "1px solid rgba(255,255,255,0.25)",

  borderRadius:
    "20px",

  fontSize:
    "9px",

  fontWeight:
    "900",
};

const toolbarStyle = {
  backgroundColor:
    "#ffffff",

  border:
    "1px solid #cbd5e1",

  borderRadius:
    "7px",

  padding:
    "12px",

  display:
    "flex",

  alignItems:
    "flex-end",

  gap:
    "10px",

  flexWrap:
    "wrap",
};

const fieldGroupStyle = {
  display:
    "flex",

  flexDirection:
    "column",

  gap:
    "5px",
};

const reasonGroupStyle = {
  display:
    "flex",

  flexDirection:
    "column",

  gap:
    "5px",

  flex:
    1,

  minWidth:
    "220px",
};

const labelStyle = {
  fontSize:
    "9px",

  fontWeight:
    "900",

  color:
    "#475569",
};

const inputStyle = {
  minHeight:
    "36px",

  boxSizing:
    "border-box",

  padding:
    "8px 10px",

  border:
    "1px solid #cbd5e1",

  borderRadius:
    "5px",

  backgroundColor:
    "#ffffff",

  color:
    "#0f172a",

  fontSize:
    "11px",

  outline:
    "none",
};

const refreshButtonStyle = {
  minHeight:
    "36px",

  padding:
    "8px 15px",

  border:
    "none",

  borderRadius:
    "5px",

  backgroundColor:
    "#0e7490",

  color:
    "#ffffff",

  fontWeight:
    "900",

  fontSize:
    "10px",

  cursor:
    "pointer",
};

const summaryGridStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "repeat(auto-fit,minmax(150px,1fr))",

  gap:
    "10px",
};

const summaryBoxStyle = {
  padding:
    "12px",

  backgroundColor:
    "#ffffff",

  border:
    "1px solid #cbd5e1",

  borderRadius:
    "7px",
};

const summaryLabelStyle = {
  color:
    "#64748b",

  fontSize:
    "9px",

  fontWeight:
    "bold",
};

const summaryValueStyle = {
  marginTop:
    "5px",

  fontSize:
    "18px",

  fontWeight:
    "900",

  color:
    "#0f172a",
};

const sectionStyle = {
  backgroundColor:
    "#ffffff",

  border:
    "1px solid #cbd5e1",

  borderRadius:
    "7px",

  overflow:
    "hidden",
};

const sectionTitleStyle = {
  padding:
    "11px 14px",

  backgroundColor:
    "#111C30",

  color:
    "#ffffff",

  fontWeight:
    "900",

  fontSize:
    "11px",
};

const tableWrapStyle = {
  overflowX:
    "auto",
};

const tableStyle = {
  width:
    "100%",

  borderCollapse:
    "collapse",

  minWidth:
    "850px",
};

const thStyle = {
  padding:
    "10px",

  backgroundColor:
    "#f8fafc",

  borderBottom:
    "1px solid #cbd5e1",

  color:
    "#475569",

  textAlign:
    "left",

  fontSize:
    "9px",

  fontWeight:
    "900",
};

const tdStyle = {
  padding:
    "10px",

  borderBottom:
    "1px solid #e2e8f0",

  color:
    "#0f172a",

  fontSize:
    "10px",

  verticalAlign:
    "middle",
};

const selectedRowStyle = {
  backgroundColor:
    "#f0f9ff",
};

const badgeStyle = {
  display:
    "inline-block",

  padding:
    "4px 7px",

  borderRadius:
    "20px",

  fontSize:
    "8px",

  fontWeight:
    "900",
};

const smallMutedStyle = {
  marginTop:
    "4px",

  color:
    "#64748b",

  fontSize:
    "8px",

  fontWeight:
    "bold",
};

const selectButtonStyle = {
  padding:
    "6px 10px",

  border:
    "1px solid #94a3b8",

  borderRadius:
    "4px",

  backgroundColor:
    "#ffffff",

  color:
    "#334155",

  fontSize:
    "8px",

  fontWeight:
    "900",

  cursor:
    "pointer",
};

const selectedButtonStyle = {
  backgroundColor:
    "#0e7490",

  border:
    "1px solid #0e7490",

  color:
    "#ffffff",
};

const mealControlStyle = {
  padding:
    "0 0 14px",

  backgroundColor:
    "#ffffff",

  border:
    "1px solid #cbd5e1",

  borderRadius:
    "7px",

  overflow:
    "hidden",
};

const selectedEmployeeStyle = {
  margin:
    "14px",

  padding:
    "10px",

  border:
    "1px solid #e2e8f0",

  borderRadius:
    "5px",

  display:
    "flex",

  alignItems:
    "center",

  gap:
    "10px",

  flexWrap:
    "wrap",

  fontSize:
    "10px",
};

const selectedShopStyle = {
  marginLeft:
    "auto",

  color:
    "#64748b",

  fontSize:
    "9px",

  fontWeight:
    "bold",
};

const controlGridStyle = {
  padding:
    "0 14px",

  display:
    "flex",

  alignItems:
    "flex-end",

  gap:
    "10px",

  flexWrap:
    "wrap",
};

const applyButtonStyle = {
  minHeight:
    "36px",

  padding:
    "8px 16px",

  border:
    "none",

  borderRadius:
    "5px",

  backgroundColor:
    "#b45309",

  color:
    "#ffffff",

  fontWeight:
    "900",

  fontSize:
    "10px",

  cursor:
    "pointer",
};

const controlNoteStyle = {
  margin:
    "12px 14px 0",

  padding:
    "9px",

  backgroundColor:
    "#fffbeb",

  border:
    "1px solid #fde68a",

  borderRadius:
    "5px",

  color:
    "#92400e",

  fontSize:
    "9px",

  lineHeight:
    "1.5",
};

const emptyStyle = {
  padding:
    "20px",

  color:
    "#64748b",

  textAlign:
    "center",

  fontSize:
    "10px",
};

const errorStyle = {
  padding:
    "10px 12px",

  backgroundColor:
    "#fee2e2",

  border:
    "1px solid #fca5a5",

  borderRadius:
    "5px",

  color:
    "#991b1b",

  fontSize:
    "10px",

  fontWeight:
    "bold",
};

const successStyle = {
  padding:
    "10px 12px",

  backgroundColor:
    "#dcfce7",

  border:
    "1px solid #86efac",

  borderRadius:
    "5px",

  color:
    "#166534",

  fontSize:
    "10px",

  fontWeight:
    "bold",
};
