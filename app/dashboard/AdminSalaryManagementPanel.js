"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// TEAM LEGEND — ADMIN SALARY MANAGEMENT
// One shared Admin Reason and one Advance panel.
// Existing Supabase RPC actions and PIN controls are preserved.

const emptyDraft = () => ({
  employeeId: "",
  deduction: "0",
  pin: "",
  manualShopId: "",
  adminReason: "",
  advanceMode: "CORRECT",
  advanceInput: "0",
});

function makeDraft(employee) {
  return {
    ...emptyDraft(),
    employeeId: employee.employee_id,
    deduction: String(employee.weekly_advance_deduction ?? 0),
    manualShopId: employee.manual_salary_shop_id || "",
    advanceInput: String(employee.advance_balance ?? 0),
  };
}

function money(value) {
  const number = Number(value ?? 0);
  return (Number.isFinite(number) ? number : 0).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseMoney(value, allowZero = true) {
  const text = String(value ?? "").trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null;
  const number = Number(text);
  if (
    !Number.isFinite(number) ||
    number > 1000000000 ||
    (!allowZero && number <= 0)
  ) return null;
  return number;
}

function requestUuid() {
  if (typeof crypto === "undefined" || !crypto.randomUUID) {
    throw new Error("Secure request ID generation is unavailable.");
  }
  return crypto.randomUUID();
}

export default function AdminSalaryManagementPanel({ user }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const accessToken = user?.access_token || null;

  const [employees, setEmployees] = useState([]);
  const [shops, setShops] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [draft, setDraft] = useState(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [shopsLoading, setShopsLoading] = useState(true);
  const [busyAction, setBusyAction] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  // Reuse request IDs when a financial request has an uncertain outcome.
  const pendingFinancialIds = useRef(new Map());

  const headers = useMemo(
    () => ({
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    }),
    [supabaseAnonKey, accessToken]
  );

  const rpc = useCallback(
    async (functionName, body = {}, signal) => {
      if (!supabaseUrl || !supabaseAnonKey || !accessToken) {
        throw new Error("Admin session is missing. Sign in again.");
      }

      const response = await fetch(
        `${String(supabaseUrl).replace(/\/+$/, "")}/rest/v1/rpc/${functionName}`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          cache: "no-store",
          ...(signal ? { signal } : {}),
        }
      );
      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.message || result?.details || result?.hint ||
            `${functionName} failed.`
        );
      }
      return result;
    },
    [supabaseUrl, supabaseAnonKey, accessToken, headers]
  );

  const loadEmployees = useCallback(
    async (signal, quiet = false) => {
      if (!quiet) setLoading(true);
      try {
        const result = await rpc("tl_salary_master_admin_list", {}, signal);
        if (!Array.isArray(result)) {
          throw new Error("Unexpected Master Employee salary response.");
        }
        if (signal?.aborted) return;

        setEmployees(result);
        setSelectedEmployeeId((previous) =>
          result.some((employee) => employee.employee_id === previous)
            ? previous
            : result[0]?.employee_id || ""
        );
        if (!quiet) {
          setMessage("");
          setIsError(false);
        }
      } catch (error) {
        if (signal?.aborted || error?.name === "AbortError") return;
        setIsError(true);
        setMessage(error?.message || "Could not load employee salaries.");
      } finally {
        if (!signal?.aborted && !quiet) setLoading(false);
      }
    },
    [rpc]
  );

  const loadPaymentShops = useCallback(
    async (signal) => {
      setShopsLoading(true);
      try {
        const result = await rpc("tl_salary_master_payment_shops", {}, signal);
        if (!Array.isArray(result)) throw new Error("Invalid payment shop list.");
        if (!signal?.aborted) setShops(result);
      } catch (error) {
        if (signal?.aborted || error?.name === "AbortError") return;
        setIsError(true);
        setMessage(error?.message || "Unable to load salary payment shops.");
      } finally {
        if (!signal?.aborted) setShopsLoading(false);
      }
    },
    [rpc]
  );

  useEffect(() => {
    const controller = new AbortController();
    loadEmployees(controller.signal);
    loadPaymentShops(controller.signal);

    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        loadEmployees(controller.signal, true);
      }
    }, 20000);

    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [loadEmployees, loadPaymentShops]);

  const selected = employees.find(
    (employee) => employee.employee_id === selectedEmployeeId
  );

  useEffect(() => {
    if (selected && draft.employeeId !== selected.employee_id) {
      setDraft(makeDraft(selected));
    }
  }, [selected, draft.employeeId]);

  function update(field, value) {
    setDraft((previous) => ({ ...previous, [field]: value }));
    setMessage("");
    setIsError(false);
  }

  function switchEmployee(id) {
    setSelectedEmployeeId(id);
    const employee = employees.find((person) => person.employee_id === id);
    setDraft(employee ? makeDraft(employee) : emptyDraft());
    setMessage("");
    setIsError(false);
  }

  // All existing salary actions retain their original RPC names/payloads.
  async function perform(action, data = {}) {
    if (!selected || busyAction) return false;

    const financial = action === "ADD_ADVANCE" || action === "CORRECT_BALANCE";
    const requestKey = financial
      ? `${selected.employee_id}:${action}:${JSON.stringify(data)}`
      : null;

    let requestId = null;
    if (financial) {
      requestId = pendingFinancialIds.current.get(requestKey);
      if (!requestId) {
        requestId = requestUuid();
        pendingFinancialIds.current.set(requestKey, requestId);
      }
    }

    setBusyAction(action);
    setMessage("");
    setIsError(false);

    try {
      const result = await rpc("tl_salary_master_admin_action", {
        p_employee_id: selected.employee_id,
        p_action: action,
        p_data: data,
        p_request_id: requestId,
      });

      if (result?.success !== true) {
        throw new Error("The database did not confirm the salary action.");
      }

      await loadEmployees(undefined, true);
      if (requestKey) pendingFinancialIds.current.delete(requestKey);

      const fallbackBalance =
        action === "CORRECT_BALANCE"
          ? data.balance
          : action === "ADD_ADVANCE"
          ? Number(selected.advance_balance || 0) + Number(data.amount || 0)
          : Number(selected.advance_balance || 0);

      setDraft((previous) => ({
        ...previous,
        deduction: String(
          result.weekly_advance_deduction ?? previous.deduction
        ),
        pin: "",
        ...(financial
          ? {
              advanceMode: "CORRECT",
              advanceInput: String(result.advance_balance ?? fallbackBalance),
              adminReason: "",
            }
          : {}),
      }));

      setMessage(
        result.already_applied
          ? "This request was already recorded. It was not applied twice."
          : action === "ADD_ADVANCE"
          ? "Advance added successfully."
          : action === "CORRECT_BALANCE"
          ? "Advance balance corrected successfully."
          : "Salary settings saved successfully."
      );
      return true;
    } catch (error) {
      setIsError(true);
      setMessage(error?.message || "Unable to save salary action.");
      return false;
    } finally {
      setBusyAction("");
    }
  }

  // The one Admin Reason field is shared by payment routing and advance edits.
  async function saveManualShop() {
    if (!selected || busyAction || shopsLoading) return;

    const shopId = draft.manualShopId || null;
    const previousShopId = selected.manual_salary_shop_id || null;

    if (shopId === previousShopId) {
      setIsError(false);
      setMessage("No change to the Salary Payment Shop.");
      return;
    }
    if (shopId && !shops.some((shop) => shop.id === shopId)) {
      setIsError(true);
      setMessage("Select an active payment shop.");
      return;
    }

    const reason = draft.adminReason.trim();
    if (reason.length < 3) {
      setIsError(true);
      setMessage("Enter an Admin reason of at least 3 characters.");
      return;
    }

    const selectedShop = shops.find((shop) => shop.id === shopId);
    const destination = shopId
      ? selectedShop?.shop_name
      : "AUTO — Follow Duty/Rota";

    if (!window.confirm(
      `CHANGE SALARY PAYMENT SHOP\n\n` +
      `Employee: ${selected.employee_name}\n` +
      `Previous: ${selected.manual_salary_shop_name || "AUTO — Duty/Rota"}\n` +
      `New: ${destination}\nReason: ${reason}\n\nSave this change?`
    )) return;

    const employeeId = selected.employee_id;
    setBusyAction("SAVE_ROUTING");
    setMessage("");
    setIsError(false);

    try {
      const result = await rpc("tl_salary_master_set_payment_shop", {
        p_employee_id: employeeId,
        p_manual_shop_id: shopId,
        p_reason: reason,
      });
      if (result?.success !== true) {
        throw new Error("The database did not confirm the payment shop change.");
      }

      setEmployees((previous) => previous.map((person) =>
        person.employee_id === employeeId
          ? {
              ...person,
              manual_salary_shop_id: shopId,
              manual_salary_shop_name: shopId ? destination : null,
              salary_routing_mode: shopId ? "MANUAL" : "ROTA",
            }
          : person
      ));
      setDraft((previous) => ({ ...previous, adminReason: "" }));
      setMessage(shopId
        ? `Salary Payment Shop saved: ${destination}.`
        : "Salary Payment Shop restored to AUTO.");
      await loadEmployees(undefined, true);
    } catch (error) {
      setIsError(true);
      setMessage(error?.message || "Unable to save Salary Payment Shop.");
    } finally {
      setBusyAction("");
    }
  }

  async function saveSettings() {
    if (!selected || busyAction) return;
    const deduction = parseMoney(draft.deduction);
    if (deduction === null) {
      setIsError(true);
      setMessage("Enter a valid weekly deduction.");
      return;
    }
    if (draft.pin && !/^\d{4}$/.test(draft.pin)) {
      setIsError(true);
      setMessage("Salary PIN must be exactly 4 digits.");
      return;
    }
    if (draft.pin.length === 4 && !window.confirm(
      `SET SALARY PIN\n\n${selected.employee_name}\n\nReplace the private PIN?`
    )) return;

    await perform("SAVE_SETTINGS", {
      weekly_advance_deduction: deduction,
      pin: draft.pin || "",
    });
  }

  function changeAdvanceMode(mode) {
    setDraft((previous) => ({
      ...previous,
      advanceMode: mode,
      advanceInput: mode === "CORRECT"
        ? String(selected?.advance_balance ?? 0)
        : "",
    }));
    setMessage("");
    setIsError(false);
  }

  // One input and one Save button, with distinct secure database actions.
  async function saveAdvance() {
    if (!selected || busyAction) return;

    const correcting = draft.advanceMode === "CORRECT";
    const amount = parseMoney(draft.advanceInput, correcting);
    if (amount === null) {
      setIsError(true);
      setMessage(correcting
        ? "Enter a valid corrected advance balance (zero is allowed)."
        : "Enter an advance greater than zero.");
      return;
    }

    const current = Number(selected.advance_balance || 0);
    const reason = draft.adminReason.trim();

    if (correcting && reason.length < 6) {
      setIsError(true);
      setMessage("Enter an Admin reason of at least 6 characters.");
      return;
    }
    if (correcting && Math.round(current * 100) === Math.round(amount * 100)) {
      setIsError(true);
      setMessage("The advance balance has not changed.");
      return;
    }

    const confirmed = window.confirm(correcting
      ? `CORRECT ADVANCE BALANCE\n\n` +
        `Employee: ${selected.employee_name}\n` +
        `Current balance: KES ${money(current)}\n` +
        `New balance: KES ${money(amount)}\n` +
        `Reason: ${reason}\n\nSave audited correction?`
      : `ADD SALARY ADVANCE\n\n` +
        `Employee: ${selected.employee_name}\n` +
        `Current balance: KES ${money(current)}\n` +
        `Advance to add: KES ${money(amount)}\n` +
        `Expected balance: KES ${money(current + amount)}\n\n` +
        `Record this new advance?`
    );
    if (!confirmed) return;

    if (correcting) {
      await perform("CORRECT_BALANCE", { balance: amount, note: reason });
    } else {
      await perform("ADD_ADVANCE", { amount, note: reason || null });
    }
  }

  async function unlockPin() {
    if (!selected || !selected.pin_locked || busyAction) return;
    if (!window.confirm(
      `UNLOCK SALARY PIN\n\n${selected.employee_name}\n` +
      `Failed attempts: ${selected.pin_failed_attempts || 0} / 3\n\nUnlock PIN?`
    )) return;
    await perform("UNLOCK_PIN", {});
  }

  const busy = Boolean(busyAction);
  const ready = Boolean(selected && draft.employeeId === selected.employee_id);
  const salaryMissing = selected?.weekly_salary == null;
  const savedManualShopId = selected?.manual_salary_shop_id || null;
  const draftManualShopId = draft.manualShopId || null;
  const routingChanged = savedManualShopId !== draftManualShopId;
  const savedRoutingText = selected?.manual_salary_shop_id
    ? `MANUAL — ${selected.manual_salary_shop_name || "Assigned shop"}`
    : "AUTO — Duty/Rota";
  return (
    <section style={panelStyle}>
      <div style={mainHeaderStyle}>EMPLOYEE SALARY MANAGEMENT</div>

      <div style={employeeSelectorStyle}>
        <Field label="SELECT EMPLOYEE">
          <select
            value={selectedEmployeeId}
            disabled={loading || busy}
            onChange={(event) => switchEmployee(event.target.value)}
            style={inputStyle}
          >
            {employees.length === 0 && (
              <option value="">No active employees</option>
            )}
            {employees.map((employee) => (
              <option key={employee.employee_id} value={employee.employee_id}>
                {employee.employee_name} — {employee.shop_category || "Unassigned"}
              </option>
            ))}
          </select>
        </Field>

        <div style={selectorActionsStyle}>
          <strong>{employees.length} ACTIVE EMPLOYEES</strong>
          <button
            type="button"
            onClick={() => loadEmployees()}
            disabled={busy || loading}
            style={{ ...buttonStyle, backgroundColor: "#334155" }}
          >
            {loading ? "LOADING..." : "REFRESH"}
          </button>
        </div>
      </div>

      {message && (
        <div role={isError ? "alert" : "status"} style={{
          ...messageStyle,
          backgroundColor: isError ? "#fef2f2" : "#ecfdf5",
          color: isError ? "#991b1b" : "#166534",
        }}>
          {message}
        </div>
      )}

      {loading && employees.length === 0 && (
        <div style={emptyStyle}>Loading employee salaries...</div>
      )}

      {selected && ready && (
        <div style={cardOuterStyle}>
          <div style={{
            ...salaryCardStyle,
            borderColor: selected.pin_locked ? "#dc2626" : "#16a34a",
          }}>
            <div style={cardHeaderStyle}>
              <strong>
                {selected.employee_name} — {selected.shop_category || "Unassigned"}
              </strong>
              <span>MASTER EMPLOYEE · ACTIVE</span>
            </div>

            <div style={cardBodyStyle}>
              <div style={gridStyle}>
                <Field label="EMPLOYEE NAME">
                  <input
                    value={selected.employee_name || ""}
                    readOnly
                    style={disabledInputStyle}
                  />
                </Field>
                <Field label="SHOP / CATEGORY">
                  <input
                    value={selected.shop_category || "Unassigned"}
                    readOnly
                    style={disabledInputStyle}
                  />
                </Field>
                <Field label="WEEKLY SALARY">
                  <input
                    value={salaryMissing
                      ? "NOT SET IN MASTER"
                      : `KES ${money(selected.weekly_salary)}`}
                    readOnly
                    style={disabledInputStyle}
                  />
                </Field>
                <Field label="WEEKLY ADVANCE DEDUCTION (KES)">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft.deduction}
                    onChange={(event) => update("deduction", event.target.value)}
                    disabled={busy}
                    style={inputStyle}
                  />
                </Field>
                <Field label={selected.pin_set ? "CHANGE SALARY PIN" : "4-DIGIT SALARY PIN"}>
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="new-password"
                    maxLength={4}
                    value={draft.pin}
                    placeholder={selected.pin_set ? "Leave blank to keep PIN" : "Enter PIN"}
                    onChange={(event) => update(
                      "pin",
                      event.target.value.replace(/\D/g, "").slice(0, 4)
                    )}
                    disabled={busy}
                    style={inputStyle}
                  />
                </Field>
              </div>

              <div style={reasonPanelStyle}>
                <Field label="ADMIN REASON">
                  <input
                    type="text"
                    value={draft.adminReason}
                    onChange={(event) => update("adminReason", event.target.value)}
                    disabled={busy}
                    placeholder="Reason for shop change, advance or correction"
                    style={inputStyle}
                  />
                </Field>
              </div>

              <div style={routingPanelStyle}>
                <div style={sectionHeadingStyle}>SALARY PAYMENT SHOP</div>
                <div style={routingFieldsStyle}>
                  <Field label="PAYMENT SHOP — AUTO / MANUAL">
                    <select
                      value={draft.manualShopId}
                      onChange={(event) => update("manualShopId", event.target.value)}
                      disabled={busy || shopsLoading}
                      style={inputStyle}
                    >
                      <option value="">AUTO — FOLLOW DUTY/ROTA</option>
                      {shops.map((shop) => (
                        <option key={shop.id} value={shop.id}>
                          {shop.shop_name} — MANUAL
                        </option>
                      ))}
                      {draft.manualShopId && !shops.some(
                        (shop) => shop.id === draft.manualShopId
                      ) && (
                        <option value={draft.manualShopId} disabled>
                          Previous shop unavailable
                        </option>
                      )}
                    </select>
                  </Field>
                  <button
                    type="button"
                    onClick={saveManualShop}
                    disabled={busy || shopsLoading || !routingChanged}
                    style={{
                      ...buttonStyle,
                      width: "100%",
                      backgroundColor: "#4f46e5",
                      opacity: routingChanged ? 1 : 0.6,
                    }}
                  >
                    {busyAction === "SAVE_ROUTING" ? "SAVING..." : "SAVE PAYMENT SHOP"}
                  </button>
                </div>
                <div style={savedRoutingStyle}>{savedRoutingText}</div>
              </div>

              <div style={statusGridStyle}>
                <Status title="ADVANCE BALANCE" value={`KES ${money(selected.advance_balance)}`} />
                <Status title="ADVANCE" value={Number(selected.advance_balance || 0) > 0 ? "YES" : "NO"} />
                <Status title="PIN" value={selected.pin_set ? "SET ✓" : "NOT SET"} />
                <Status title="FAILED PIN" value={`${selected.pin_failed_attempts || 0} / 3`} />
                <Status
                  title="PIN STATUS"
                  value={selected.pin_locked ? "LOCKED" : "OPEN"}
                  danger={Boolean(selected.pin_locked)}
                />
                <Status title="SALARY START WEEK" value={selected.salary_start_week || "—"} />
              </div>

              {salaryMissing && (
                <div role="alert" style={warningStyle}>
                  Weekly salary is missing in Master Employees.
                </div>
              )}

              <button
                type="button"
                onClick={saveSettings}
                disabled={busy || salaryMissing}
                style={{
                  ...buttonStyle,
                  width: "100%",
                  backgroundColor: busy ? "#94a3b8" : "#0873b9",
                }}
              >
                {busyAction === "SAVE_SETTINGS" ? "SAVING..." : "SAVE SALARY SETTINGS"}
              </button>

              {/* ONE ADVANCE PANEL: CORRECT EXISTING BALANCE OR ADD NEW ADVANCE */}
              <div style={advancePanelStyle}>
                <div style={sectionHeadingStyle}>EMPLOYEE ADVANCE</div>
                <div style={advanceBalanceStyle}>
                  CURRENT BALANCE: <strong>KES {money(selected.advance_balance)}</strong>
                </div>

                <div style={advanceFieldsStyle}>
                  <Field label="ACTION">
                    <select
                      value={draft.advanceMode}
                      onChange={(event) => changeAdvanceMode(event.target.value)}
                      disabled={busy}
                      style={inputStyle}
                    >
                      <option value="CORRECT">CORRECT BALANCE</option>
                      <option value="ADD">ADD ADVANCE</option>
                    </select>
                  </Field>

                  <Field label={draft.advanceMode === "CORRECT"
                    ? "EDIT ADVANCE BALANCE (KES)"
                    : "NEW ADVANCE (KES)"}>
                    <input
                      type="number"
                      min={draft.advanceMode === "CORRECT" ? "0" : "0.01"}
                      step="0.01"
                      value={draft.advanceInput}
                      onChange={(event) => update("advanceInput", event.target.value)}
                      disabled={busy}
                      placeholder="0.00"
                      style={inputStyle}
                    />
                  </Field>

                  <button
                    type="button"
                    onClick={saveAdvance}
                    disabled={busy}
                    style={{
                      ...buttonStyle,
                      width: "100%",
                      backgroundColor: draft.advanceMode === "CORRECT"
                        ? "#475569" : "#d97706",
                    }}
                  >
                    {busyAction === "CORRECT_BALANCE" || busyAction === "ADD_ADVANCE"
                      ? "SAVING..."
                      : draft.advanceMode === "CORRECT"
                      ? "SAVE BALANCE CORRECTION"
                      : "ADD ADVANCE"}
                  </button>
                </div>
              </div>

              {selected.pin_locked && (
                <div style={pinPanelStyle}>
                  <div style={{ ...sectionHeadingStyle, color: "#991b1b" }}>
                    SALARY PIN LOCKED
                  </div>
                  <button
                    type="button"
                    onClick={unlockPin}
                    disabled={busy}
                    style={{ ...buttonStyle, backgroundColor: "#dc2626" }}
                  >
                    {busyAction === "UNLOCK_PIN" ? "UNLOCKING..." : "ADMIN UNLOCK PIN"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Field({ label, children }) {
  return (
    <label style={fieldStyle}>
      <span style={fieldLabelStyle}>{label}</span>
      {children}
    </label>
  );
}

function Status({ title, value, danger = false }) {
  return (
    <div style={{
      ...statusStyle,
      backgroundColor: danger ? "#fef2f2" : "#f8fafc",
      borderColor: danger ? "#ef4444" : "#cbd5e1",
    }}>
      <div style={statusTitleStyle}>{title}</div>
      <div style={{
        ...statusValueStyle,
        color: danger ? "#991b1b" : "#0f172a",
      }}>{value}</div>
    </div>
  );
}

// ==================================================
// STYLES — LARGER LABELS, NO HELPER PARAGRAPHS
// ==================================================

const panelStyle = {
  backgroundColor: "#ffffff",
  borderRadius: 8,
  overflow: "hidden",
  boxShadow: "0 1px 6px rgba(0,0,0,.12)",
  color: "#0f172a",
};

const mainHeaderStyle = {
  backgroundColor: "#4f46e5",
  color: "#ffffff",
  padding: "15px 16px",
  fontSize: 18,
  fontWeight: 900,
};

const employeeSelectorStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(260px, 2fr) minmax(170px, 1fr)",
  gap: 12,
  padding: 15,
  alignItems: "end",
  backgroundColor: "#f8fafc",
  borderBottom: "1px solid #e2e8f0",
};

const selectorActionsStyle = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 10,
  fontSize: 12,
  color: "#475569",
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(195px, 1fr))",
  gap: 12,
};

const fieldStyle = {
  display: "grid",
  gap: 6,
  minWidth: 0,
};

const fieldLabelStyle = {
  color: "#475569",
  fontWeight: 800,
  fontSize: 12,
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 11px",
  border: "1px solid #cbd5e1",
  borderRadius: 5,
  fontSize: 13,
  minHeight: 41,
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
  padding: "11px 14px",
  border: "none",
  borderRadius: 5,
  fontSize: 12,
  fontWeight: 850,
  cursor: "pointer",
  color: "#ffffff",
};

const messageStyle = {
  margin: "12px 15px 0",
  padding: 12,
  borderRadius: 5,
  fontSize: 12,
  fontWeight: 700,
};

const emptyStyle = {
  padding: 30,
  textAlign: "center",
  color: "#64748b",
};

const cardOuterStyle = {
  padding: 15,
};

const salaryCardStyle = {
  border: "2px solid #16a34a",
  borderRadius: 7,
  overflow: "hidden",
  maxWidth: 1050,
  margin: "0 auto",
};

const cardHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  flexWrap: "wrap",
  backgroundColor: "#0f172a",
  color: "#ffffff",
  padding: "12px 14px",
  fontSize: 13,
  fontWeight: 800,
};

const cardBodyStyle = {
  display: "grid",
  gap: 14,
  padding: 14,
};

const sectionHeadingStyle = {
  fontSize: 14,
  fontWeight: 900,
  color: "#0f172a",
  marginBottom: 10,
};

const reasonPanelStyle = {
  padding: 12,
  backgroundColor: "#f8fafc",
  border: "1px solid #cbd5e1",
  borderRadius: 7,
};

const routingPanelStyle = {
  padding: 12,
  backgroundColor: "#eef2ff",
  border: "1px solid #a5b4fc",
  borderRadius: 7,
};

const routingFieldsStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(200px, 2fr) minmax(160px, 1fr)",
  gap: 12,
  alignItems: "end",
};

const savedRoutingStyle = {
  marginTop: 9,
  padding: 9,
  backgroundColor: "#ffffff",
  border: "1px solid #c7d2fe",
  borderRadius: 5,
  fontSize: 12,
  fontWeight: 800,
  color: "#3730a3",
};

const statusGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
  gap: 8,
};

const statusStyle = {
  textAlign: "center",
  padding: 10,
  borderRadius: 5,
  border: "1px solid #cbd5e1",
};

const statusTitleStyle = {
  fontSize: 11,
  fontWeight: 800,
  color: "#64748b",
};

const statusValueStyle = {
  fontSize: 14,
  fontWeight: 900,
  marginTop: 5,
};

const warningStyle = {
  color: "#991b1b",
  backgroundColor: "#fef2f2",
  padding: 11,
  fontSize: 12,
  borderRadius: 5,
};

const advancePanelStyle = {
  padding: 13,
  border: "1px solid #f59e0b",
  backgroundColor: "#fffbeb",
  borderRadius: 7,
};

const advanceBalanceStyle = {
  fontSize: 13,
  color: "#78350f",
  marginBottom: 12,
};

const advanceFieldsStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(170px, 1fr) minmax(200px, 1fr) minmax(160px, 1fr)",
  gap: 12,
  alignItems: "end",
};

const pinPanelStyle = {
  padding: 12,
  backgroundColor: "#fee2e2",
  border: "1px solid #ef4444",
  borderRadius: 7,
};
