"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

// TEAM LEGEND / NYIKA
// MASTER EMPLOYEE SALARY MANAGEMENT
//
// One Master Employee = One Salary Card
// No Salary Slots
// No separate employee creation
// Names and salaries from Master Employees
// Existing advances and PINs preserved
//
// Cashier salary payments are handled separately.

const blankDraft = () => ({
  employeeId: "",
  deduction: "0",
  pin: "",
  advanceAmount: "",
  advanceNote: "",
  correctedBalance: "0",
  correctionReason: "",
});

// ============================================
// MONEY HELPERS
// ============================================

const money = (value) =>
  (
    Number.isFinite(Number(value))
      ? Number(value)
      : 0
  ).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function parseMoney(value, allowZero = true) {
  const raw = String(value ?? "").trim();

  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) {
    return null;
  }

  const number = Number(raw);

  if (
    !Number.isFinite(number) ||
    number > 1000000000 ||
    (!allowZero && number <= 0)
  ) {
    return null;
  }

  return number;
}

function newDraft(employee) {
  return {
    ...blankDraft(),

    employeeId: employee.employee_id,

    deduction: String(
      employee.weekly_advance_deduction ?? 0
    ),

    correctedBalance: String(
      employee.advance_balance ?? 0
    ),
  };
}

function newRequestId() {
  if (
    typeof crypto === "undefined" ||
    !crypto.randomUUID
  ) {
    throw new Error(
      "Your browser cannot generate a safe salary request ID."
    );
  }

  return crypto.randomUUID();
}

// ============================================
// STYLES
// ============================================

const panelStyle = {
  backgroundColor: "#ffffff",
  borderRadius: 8,
  overflow: "hidden",
  boxShadow: "0 1px 6px rgba(0,0,0,.12)",
  color: "#0f172a",
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "9px 10px",
  border: "1px solid #cbd5e1",
  borderRadius: 5,
  fontSize: 12,
  backgroundColor: "#ffffff",
  color: "#0f172a",
};

const disabledInputStyle = {
  ...inputStyle,
  backgroundColor: "#f1f5f9",
  color: "#334155",
  cursor: "not-allowed",
};

const buttonStyle = {
  padding: "10px 13px",
  border: "none",
  borderRadius: 5,
  fontSize: 11,
  fontWeight: 800,
  cursor: "pointer",
  color: "#ffffff",
};

const areaStyle = {
  padding: 12,
  border: "1px solid #e2e8f0",
  borderRadius: 7,
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(205px, 1fr))",
  gap: 10,
};

// ============================================
// FIELD COMPONENT
// ============================================

function Field({ label, children }) {
  return (
    <label
      style={{
        display: "grid",
        gap: 5,
        minWidth: 0,
      }}
    >
      <span
        style={{
          fontWeight: 800,
          color: "#475569",
          fontSize: 10,
        }}
      >
        {label}
      </span>

      {children}
    </label>
  );
}

// ============================================
// STATUS COMPONENT
// ============================================

function Status({
  title,
  value,
  danger = false,
}) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: 9,
        borderRadius: 5,

        backgroundColor: danger
          ? "#fef2f2"
          : "#f8fafc",

        border: `1px solid ${
          danger ? "#ef4444" : "#cbd5e1"
        }`,
      }}
    >
      <div
        style={{
          fontSize: 9,
          fontWeight: 800,
          color: "#64748b",
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontSize: 12,
          fontWeight: 800,

          color: danger
            ? "#991b1b"
            : "#0f172a",

          marginTop: 4,
        }}
      >
        {value}
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function AdminSalaryManagementPanel({
  user,
}) {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const accessToken =
    user?.access_token || null;

  // ==========================================
  // STATE
  // ==========================================

  const [employees, setEmployees] =
    useState([]);

  const [
    selectedEmployeeId,
    setSelectedEmployeeId,
  ] = useState("");

  const [draft, setDraft] =
    useState(blankDraft);

  const [loading, setLoading] =
    useState(true);

  const [busyAction, setBusyAction] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [isError, setIsError] =
    useState(false);

  // Reuse financial request IDs after
  // uncertain network failures.
  // This helps prevent duplicate advances.

  const pendingFinancialIds =
    useRef(new Map());

  // ==========================================
  // SUPABASE HEADERS
  // ==========================================

  const headers = useMemo(
    () => ({
      apikey: supabaseAnonKey,

      Authorization:
        `Bearer ${accessToken}`,

      "Content-Type":
        "application/json",
    }),
    [
      supabaseAnonKey,
      accessToken,
    ]
  );

  // ==========================================
  // RPC HELPER
  // ==========================================

  const rpc = useCallback(
    async (
      functionName,
      body = {},
      signal
    ) => {
      if (
        !supabaseUrl ||
        !supabaseAnonKey ||
        !accessToken
      ) {
        throw new Error(
          "Admin session is missing. Sign in again."
        );
      }

      const response = await fetch(
        `${String(supabaseUrl).replace(
          /\/+$/,
          ""
        )}/rest/v1/rpc/${functionName}`,
        {
          method: "POST",

          headers,

          body: JSON.stringify(body),

          cache: "no-store",

          ...(signal
            ? { signal }
            : {}),
        }
      );

      const result = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.message ||
          result?.details ||
          result?.hint ||
          `${functionName} failed.`
        );
      }

      return result;
    },
    [
      supabaseUrl,
      supabaseAnonKey,
      accessToken,
      headers,
    ]
  );

  // ==========================================
  // LOAD MASTER EMPLOYEE SALARIES
  // ==========================================

  const loadEmployees = useCallback(
    async (
      signal,
      quiet = false
    ) => {
      if (!quiet) {
        setLoading(true);
      }

      try {
        const result = await rpc(
          "tl_salary_master_admin_list",
          {},
          signal
        );

        if (!Array.isArray(result)) {
          throw new Error(
            "Unexpected Master Employee salary response."
          );
        }

        if (signal?.aborted) {
          return;
        }

        setEmployees(result);

        setSelectedEmployeeId(
          (previous) =>
            result.some(
              (employee) =>
                employee.employee_id ===
                previous
            )
              ? previous
              : result[0]?.employee_id ||
                ""
        );

        if (!quiet) {
          setMessage("");
          setIsError(false);
        }
      } catch (error) {
        if (
          signal?.aborted ||
          error?.name === "AbortError"
        ) {
          return;
        }

        setIsError(true);

        setMessage(
          error?.message ||
          "Could not load employee salaries."
        );
      } finally {
        if (
          !signal?.aborted &&
          !quiet
        ) {
          setLoading(false);
        }
      }
    },
    [rpc]
  );

  // ==========================================
  // INITIAL LOAD + AUTO REFRESH
  // ==========================================

  useEffect(() => {
    const controller =
      new AbortController();

    loadEmployees(
      controller.signal
    );

    // New Master Employees appear without
    // separate salary registration.
    //
    // Background refresh does not overwrite
    // partially edited employee fields.

    const timer = setInterval(
      () => {
        if (
          document.visibilityState ===
          "visible"
        ) {
          loadEmployees(
            controller.signal,
            true
          );
        }
      },
      20000
    );

    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [loadEmployees]);

  // ==========================================
  // SELECTED EMPLOYEE
  // ==========================================

  const selected = employees.find(
    (employee) =>
      employee.employee_id ===
      selectedEmployeeId
  );

  useEffect(() => {
    if (
      selected &&
      draft.employeeId !==
        selected.employee_id
    ) {
      setDraft(
        newDraft(selected)
      );
    }
  }, [
    selected,
    draft.employeeId,
  ]);

  function update(
    field,
    value
  ) {
    setDraft(
      (previous) => ({
        ...previous,
        [field]: value,
      })
    );
  }

  function switchEmployee(id) {
    setSelectedEmployeeId(id);

    const employee = employees.find(
      (person) =>
        person.employee_id === id
    );

    if (employee) {
      setDraft(
        newDraft(employee)
      );
    }

    setMessage("");
    setIsError(false);
  }

  // ==========================================
  // PERFORM ADMIN ACTION
  // ==========================================

  async function perform(
    action,
    data = {}
  ) {
    if (
      !selected ||
      busyAction
    ) {
      return false;
    }

    const financial =
      action === "ADD_ADVANCE" ||
      action === "CORRECT_BALANCE";

    const requestKey = financial
      ? `${selected.employee_id}:${action}:${JSON.stringify(
          data
        )}`
      : null;

    let requestId = null;

    if (financial) {
      requestId =
        pendingFinancialIds.current.get(
          requestKey
        );

      if (!requestId) {
        requestId =
          newRequestId();

        pendingFinancialIds.current.set(
          requestKey,
          requestId
        );
      }
    }

    setBusyAction(action);

    setMessage("");
    setIsError(false);

    try {
      const result = await rpc(
        "tl_salary_master_admin_action",
        {
          p_employee_id:
            selected.employee_id,

          p_action:
            action,

          p_data:
            data,

          p_request_id:
            requestId,
        }
      );

      if (
        result?.success !== true
      ) {
        throw new Error(
          "The database did not confirm the salary action."
        );
      }

      await loadEmployees(
        undefined,
        true
      );

      if (requestKey) {
        pendingFinancialIds.current.delete(
          requestKey
        );
      }

      setDraft(
        (previous) => ({
          ...previous,

          deduction: String(
            result.weekly_advance_deduction ??
              previous.deduction
          ),

          correctedBalance: String(
            result.advance_balance ??
              previous.correctedBalance
          ),

          pin: "",
          advanceAmount: "",
          advanceNote: "",
          correctionReason: "",
        })
      );

      setMessage(
        result.already_applied
          ? "This request was already recorded; it was not applied twice."
          : "Salary action saved successfully."
      );

      return true;
    } catch (error) {
      setIsError(true);

      setMessage(
        error?.message ||
        "Unable to save salary action."
      );

      return false;
    } finally {
      setBusyAction("");
    }
  }

  // ==========================================
  // SAVE SALARY SETTINGS
  // ==========================================

  async function saveSettings() {
    if (!selected) {
      return;
    }

    const deduction = parseMoney(
      draft.deduction
    );

    if (deduction === null) {
      setMessage(
        "Enter a valid weekly deduction (0 or more, up to 2 decimals)."
      );

      setIsError(true);
      return;
    }

    if (
      draft.pin &&
      !/^\d{4}$/.test(draft.pin)
    ) {
      setMessage(
        "Salary PIN must contain exactly four digits."
      );

      setIsError(true);
      return;
    }

    const changingPin =
      draft.pin.length === 4;

    if (
      changingPin &&
      !window.confirm(
        `SET SALARY PIN\n\n${selected.employee_name}\n\nReplace this employee's private Salary PIN?`
      )
    ) {
      return;
    }

    await perform(
      "SAVE_SETTINGS",
      {
        weekly_advance_deduction:
          deduction,

        pin:
          draft.pin || "",
      }
    );
  }

  // ==========================================
  // ADD EMPLOYEE ADVANCE
  // ==========================================

  async function addAdvance() {
    if (!selected) {
      return;
    }

    const amount = parseMoney(
      draft.advanceAmount,
      false
    );

    if (amount === null) {
      setIsError(true);

      setMessage(
        "Enter a valid advance greater than zero (up to 2 decimals)."
      );

      return;
    }

    const current = Number(
      selected.advance_balance || 0
    );

    const approved =
      window.confirm(
        `GIVE SALARY ADVANCE\n\n` +
        `Employee: ${selected.employee_name}` +
        `\nCurrent balance: KES ${money(current)}` +
        `\nNew advance: KES ${money(amount)}` +
        `\nExpected balance: KES ${money(current + amount)}` +
        `\n\nRecord this advance?`
      );

    if (!approved) {
      return;
    }

    await perform(
      "ADD_ADVANCE",
      {
        amount,

        note:
          draft.advanceNote.trim() ||
          null,
      }
    );
  }

  // ==========================================
  // CORRECT ADVANCE BALANCE
  // ==========================================

  async function correctBalance() {
    if (!selected) {
      return;
    }

    const balance = parseMoney(
      draft.correctedBalance
    );

    const note =
      draft.correctionReason.trim();

    if (balance === null) {
      setIsError(true);

      setMessage(
        "Enter a valid corrected advance balance."
      );

      return;
    }

    if (note.length < 6) {
      setIsError(true);

      setMessage(
        "Provide a reason with at least six characters."
      );

      return;
    }

    const confirmed =
      window.confirm(
        `CORRECT ADVANCE BALANCE\n\n` +
        `Employee: ${selected.employee_name}` +
        `\nCurrent balance: KES ${money(
          selected.advance_balance
        )}` +
        `\nCorrected balance: KES ${money(
          balance
        )}` +
        `\nReason: ${note}` +
        `\n\nThis correction will be audited. Continue?`
      );

    if (!confirmed) {
      return;
    }

    await perform(
      "CORRECT_BALANCE",
      {
        balance,
        note,
      }
    );
  }

  // ==========================================
  // ADMIN UNLOCK SALARY PIN
  // ==========================================

  async function unlockPin() {
    if (
      !selected ||
      !selected.pin_locked
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `UNLOCK SALARY PIN\n\n` +
        `${selected.employee_name}` +
        `\nFailed attempts: ${selected.pin_failed_attempts} / 3` +
        "\n\nReset failed attempts and unlock the PIN?"
      );

    if (!confirmed) {
      return;
    }

    await perform(
      "UNLOCK_PIN",
      {}
    );
  }

  // ==========================================
  // DISPLAY STATE
  // ==========================================

  const busy =
    Boolean(busyAction);

  const ready = Boolean(
    selected &&
    draft.employeeId ===
      selected.employee_id
  );

  const salaryMissing =
    selected?.weekly_salary == null;

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <section style={panelStyle}>
      {/* MAIN TITLE */}

      <div
        style={{
          background: "#4f46e5",
          color: "#ffffff",
          padding: 14,
          fontSize: 17,
          fontWeight: 800,
        }}
      >
        EMPLOYEE SALARY MANAGEMENT
      </div>

      {/* INFORMATION */}

      <div
        style={{
          padding: "10px 15px",
          background: "#eef2ff",
          color: "#3730a3",
          fontSize: 11,
        }}
      >
        All active employees come from
        the Master Employee List automatically.
        One employee, one salary card.
        Names and weekly salary are read-only.
        Salary PINs and advance balances
        remain private.
      </div>

      {/* EMPLOYEE DROPDOWN */}

      <div
        style={{
          ...gridStyle,

          padding: 15,
          background: "#f8fafc",

          alignItems: "end",

          borderBottom:
            "1px solid #e2e8f0",
        }}
      >
        <Field
          label="SELECT EMPLOYEE — MASTER EMPLOYEE LIST"
        >
          <select
            value={selectedEmployeeId}
            onChange={(event) =>
              switchEmployee(
                event.target.value
              )
            }
            disabled={
              loading || busy
            }
            style={inputStyle}
          >
            {employees.length === 0 && (
              <option value="">
                No active employees
              </option>
            )}

            {employees.map(
              (employee) => (
                <option
                  key={
                    employee.employee_id
                  }
                  value={
                    employee.employee_id
                  }
                >
                  {employee.employee_name}
                  {" — "}
                  {employee.shop_category ||
                    "Unassigned"}
                </option>
              )
            )}
          </select>
        </Field>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 10,
          }}
        >
          <strong
            style={{
              fontSize: 12,
              color: "#475569",
            }}
          >
            {employees.length} ACTIVE
            MASTER EMPLOYEES
          </strong>

          <button
            type="button"
            onClick={() =>
              loadEmployees()
            }
            disabled={
              busy || loading
            }
            style={{
              ...buttonStyle,
              background: "#334155",
            }}
          >
            {loading
              ? "LOADING..."
              : "REFRESH"}
          </button>
        </div>
      </div>

      {/* MESSAGES */}

      {message && (
        <div
          role={
            isError
              ? "alert"
              : "status"
          }
          style={{
            margin:
              "12px 15px 0",

            padding: 10,
            borderRadius: 5,
            fontSize: 12,

            background:
              isError
                ? "#fef2f2"
                : "#ecfdf5",

            color:
              isError
                ? "#991b1b"
                : "#166534",
          }}
        >
          {message}
        </div>
      )}

      {/* LOADING */}

      {loading &&
        employees.length === 0 && (
          <div
            style={{
              padding: 30,
              textAlign: "center",
              color: "#64748b",
            }}
          >
            Loading Master Employee
            salaries...
          </div>
        )}

      {/* SINGLE EMPLOYEE CARD */}

      {selected && ready && (
        <div
          style={{
            padding: 15,
          }}
        >
          <div
            style={{
              border: `2px solid ${
                selected.pin_locked
                  ? "#dc2626"
                  : "#16a34a"
              }`,

              borderRadius: 7,
              overflow: "hidden",

              maxWidth: 950,
              margin: "0 auto",
            }}
          >
            {/* CARD HEADER */}

            <div
              style={{
                background: "#0f172a",
                color: "#ffffff",

                padding: "11px 13px",

                fontSize: 12,
                fontWeight: 800,

                display: "flex",
                flexWrap: "wrap",

                justifyContent:
                  "space-between",

                gap: 8,
              }}
            >
              <span>
                {selected.employee_name}
                {" — "}
                {selected.shop_category ||
                  "Unassigned"}
              </span>

              <span>
                MASTER EMPLOYEE · ACTIVE
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gap: 13,
                padding: 12,
              }}
            >
              {/* MASTER EMPLOYEE DETAILS */}

              <div style={gridStyle}>
                <Field
                  label="EMPLOYEE NAME — MASTER (READ ONLY)"
                >
                  <input
                    value={
                      selected.employee_name ||
                      ""
                    }
                    readOnly
                    style={
                      disabledInputStyle
                    }
                  />
                </Field>

                <Field
                  label="SHOP / CATEGORY — MASTER (READ ONLY)"
                >
                  <input
                    value={
                      selected.shop_category ||
                      "Unassigned"
                    }
                    readOnly
                    style={
                      disabledInputStyle
                    }
                  />
                </Field>

                <Field
                  label="WEEKLY SALARY — MASTER (READ ONLY)"
                >
                  <input
                    value={
                      salaryMissing
                        ? "NOT SET IN MASTER"
                        : `KES ${money(
                            selected.weekly_salary
                          )}`
                    }
                    readOnly
                    style={
                      disabledInputStyle
                    }
                  />
                </Field>

                {/* WEEKLY DEDUCTION */}

                <Field
                  label="WEEKLY ADVANCE DEDUCTION (KES)"
                >
                  <input
                    type="number"
                    min="0"
                    step="0.01"

                    value={
                      draft.deduction
                    }

                    onChange={(event) =>
                      update(
                        "deduction",
                        event.target.value
                      )
                    }

                    disabled={busy}
                    style={inputStyle}
                  />
                </Field>

                {/* SALARY PIN */}

                <Field
                  label={
                    selected.pin_set
                      ? "NEW 4-DIGIT PIN (OPTIONAL)"
                      : "4-DIGIT SALARY PIN"
                  }
                >
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="new-password"
                    maxLength={4}

                    value={
                      draft.pin
                    }

                    placeholder={
                      selected.pin_set
                        ? "Leave blank to keep current PIN"
                        : "Enter new PIN"
                    }

                    onChange={(event) =>
                      update(
                        "pin",
                        event.target.value
                          .replace(
                            /\D/g,
                            ""
                          )
                          .slice(0, 4)
                      )
                    }

                    disabled={busy}
                    style={inputStyle}
                  />
                </Field>
              </div>

              {/* SALARY STATUS GRID */}

              <div
                style={{
                  ...gridStyle,

                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(130px, 1fr))",

                  gap: 7,
                }}
              >
                <Status
                  title="ADVANCE BALANCE"
                  value={`KES ${money(
                    selected.advance_balance
                  )}`}
                />

                <Status
                  title="ADVANCE"
                  value={
                    Number(
                      selected.advance_balance ||
                      0
                    ) > 0
                      ? "YES"
                      : "NO"
                  }
                />

                <Status
                  title="PIN"
                  value={
                    selected.pin_set
                      ? "SET ✓"
                      : "NOT SET"
                  }
                />

                <Status
                  title="FAILED PIN"
                  value={`${
                    selected.pin_failed_attempts ||
                    0
                  } / 3`}
                />

                <Status
                  title="PIN STATUS"
                  value={
                    selected.pin_locked
                      ? "LOCKED"
                      : "OPEN"
                  }
                  danger={
                    selected.pin_locked
                  }
                />

                <Status
                  title="SALARY START WEEK"
                  value={
                    selected.salary_start_week ||
                    "—"
                  }
                />
              </div>

              {/* MISSING MASTER SALARY */}

              {salaryMissing && (
                <div
                  role="alert"
                  style={{
                    color: "#991b1b",
                    background:
                      "#fef2f2",

                    padding: 10,
                    fontSize: 12,
                  }}
                >
                  Weekly salary is missing
                  in Master Employees.
                  Set it there before
                  salary payment.
                </div>
              )}

              {/* SAVE SETTINGS */}

              <button
                type="button"
                onClick={
                  saveSettings
                }
                disabled={
                  busy ||
                  salaryMissing
                }
                style={{
                  ...buttonStyle,

                  background:
                    busy
                      ? "#94a3b8"
                      : "#0873b9",
                }}
              >
                {busyAction ===
                "SAVE_SETTINGS"
                  ? "SAVING..."
                  : "SAVE SALARY SETTINGS"}
              </button>

              {/* ====================================
                  EMPLOYEE ADVANCE
              ==================================== */}

              <div
                style={{
                  ...areaStyle,

                  borderColor:
                    "#f59e0b",

                  background:
                    "#fffbeb",
                }}
              >
                <strong
                  style={{
                    color: "#92400e",
                    fontSize: 12,
                  }}
                >
                  EMPLOYEE ADVANCE
                </strong>

                <div
                  style={{
                    color: "#78350f",
                    fontSize: 11,
                    margin:
                      "6px 0 10px",
                  }}
                >
                  Current outstanding
                  balance:{" "}
                  <strong>
                    KES{" "}
                    {money(
                      selected.advance_balance
                    )}
                  </strong>
                </div>

                <div
                  style={
                    gridStyle
                  }
                >
                  <Field
                    label="ADD ADVANCE (KES)"
                  >
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"

                      value={
                        draft.advanceAmount
                      }

                      onChange={(event) =>
                        update(
                          "advanceAmount",
                          event.target.value
                        )
                      }

                      disabled={busy}

                      placeholder="Amount"
                      style={
                        inputStyle
                      }
                    />
                  </Field>

                  <Field
                    label="ADVANCE NOTE (OPTIONAL)"
                  >
                    <input
                      value={
                        draft.advanceNote
                      }

                      onChange={(event) =>
                        update(
                          "advanceNote",
                          event.target.value
                        )
                      }

                      disabled={busy}

                      placeholder="Reason / note"

                      style={
                        inputStyle
                      }
                    />
                  </Field>

                  <div
                    style={{
                      display: "flex",
                      alignItems:
                        "end",
                    }}
                  >
                    <button
                      type="button"

                      onClick={
                        addAdvance
                      }

                      disabled={
                        busy
                      }

                      style={{
                        ...buttonStyle,

                        background:
                          "#d97706",

                        width:
                          "100%",
                      }}
                    >
                      {busyAction ===
                      "ADD_ADVANCE"
                        ? "SAVING..."
                        : "ADD ADVANCE"}
                    </button>
                  </div>
                </div>
              </div>

              {/* ====================================
                  ADVANCE BALANCE CORRECTION
              ==================================== */}

              <div
                style={{
                  ...areaStyle,
                  background:
                    "#f8fafc",
                }}
              >
                <strong
                  style={{
                    fontSize: 12,
                  }}
                >
                  CORRECT ADVANCE BALANCE
                  {" · "}
                  ADMIN AUDIT
                </strong>

                <p
                  style={{
                    margin:
                      "6px 0 10px",

                    fontSize: 11,

                    color:
                      "#64748b",
                  }}
                >
                  Use only to fix an
                  incorrect balance.
                  This replaces the
                  balance; it does not
                  add a new advance.
                  A reason and confirmation
                  are required.
                </p>

                <div
                  style={
                    gridStyle
                  }
                >
                  <Field
                    label="CORRECT BALANCE TO (KES)"
                  >
                    <input
                      type="number"
                      min="0"
                      step="0.01"

                      value={
                        draft.correctedBalance
                      }

                      onChange={(event) =>
                        update(
                          "correctedBalance",
                          event.target.value
                        )
                      }

                      disabled={busy}

                      style={
                        inputStyle
                      }
                    />
                  </Field>

                  <Field
                    label="REQUIRED REASON FOR CORRECTION"
                  >
                    <input
                      value={
                        draft.correctionReason
                      }

                      onChange={(event) =>
                        update(
                          "correctionReason",
                          event.target.value
                        )
                      }

                      disabled={busy}

                      placeholder="Explain the correction"

                      style={
                        inputStyle
                      }
                    />
                  </Field>

                  <div
                    style={{
                      display: "flex",
                      alignItems:
                        "end",
                    }}
                  >
                    <button
                      type="button"

                      onClick={
                        correctBalance
                      }

                      disabled={
                        busy
                      }

                      style={{
                        ...buttonStyle,

                        background:
                          "#475569",

                        width:
                          "100%",
                      }}
                    >
                      {busyAction ===
                      "CORRECT_BALANCE"
                        ? "CORRECTING..."
                        : "SAVE BALANCE CORRECTION"}
                    </button>
                  </div>
                </div>
              </div>

              {/* ====================================
                  PIN LOCK / ADMIN UNLOCK
              ==================================== */}

              {selected.pin_locked && (
                <div
                  style={{
                    ...areaStyle,

                    background:
                      "#fee2e2",

                    borderColor:
                      "#ef4444",
                  }}
                >
                  <strong
                    style={{
                      color:
                        "#991b1b",

                      fontSize: 12,
                    }}
                  >
                    SALARY PIN LOCKED
                  </strong>

                  <p
                    style={{
                      color:
                        "#991b1b",

                      fontSize: 11,
                    }}
                  >
                    Three incorrect PIN
                    attempts.
                    Admin must unlock
                    the employee's PIN.
                  </p>

                  <button
                    type="button"

                    onClick={
                      unlockPin
                    }

                    disabled={
                      busy
                    }

                    style={{
                      ...buttonStyle,

                      background:
                        "#dc2626",
                    }}
                  >
                    {busyAction ===
                    "UNLOCK_PIN"
                      ? "UNLOCKING..."
                      : "ADMIN UNLOCK PIN"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}

      <footer
        style={{
          borderTop:
            "1px solid #e2e8f0",

          background:
            "#f8fafc",

          padding: 12,

          fontSize: 11,

          color:
            "#64748b",

          textAlign:
            "center",
        }}
      >
        Salaries earned Monday–Sunday
        become payable the following
        Monday, subject to the cashier
        Salary PIN and payment workflow.
        Cashier payment migration is a
        separate step; this Admin panel
        does not pay salaries.
      </footer>
    </section>
  );
}
