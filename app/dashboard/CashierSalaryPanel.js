"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// =====================================================
// TEAM LEGEND / NYIKA
// CASHIER SALARY — MASTER EMPLOYEE V3
//
// Three-column professional layout
//
// Preserved:
// - Manual Salary Shop / AUTO Duty-Rota routing
// - Master Employee V3 Supabase functions
// - Private 4-digit Salary PIN
// - Three incorrect PIN attempt limit
// - Admin PIN unlock
// - 20-second PIN timer
// - 20-second private details timer
// - 10-second PAID details timer
// - Advance deductions
// - Private salary expenses
// - Duplicate payment protection
// - Dashboard financial refresh
//
// Financial operations controlled by Supabase.
// =====================================================

export default function CashierSalaryPanel({
  user,
  currentShift,
  onSalaryPaid,
}) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pinOpenId, setPinOpenId] = useState(null);
  const [pinInputs, setPinInputs] = useState({});
  const [verifyingId, setVerifyingId] = useState(null);
  const [payingId, setPayingId] = useState(null);
  const [unlocked, setUnlocked] = useState({});
  const [recentPaid, setRecentPaid] = useState({});
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const lockTimersRef = useRef({});
  const pinTimersRef = useRef({});
  const unlockedTimersRef = useRef({});
  const listRequestRef = useRef(0);
  const verifyBusyRef = useRef(false);
  const payBusyRef = useRef(false);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const accessToken = user?.access_token || null;

  const shopId =
    currentShift?.shop_id ||
    user?.shop_id ||
    user?.shopId ||
    null;

  const shiftId = currentShift?.id || null;

  const sessionScope = JSON.stringify([
    shopId,
    shiftId,
    accessToken,
  ]);

  const activeScopeRef = useRef(sessionScope);
  activeScopeRef.current = sessionScope;

  // =====================================================
  // LOAD MASTER EMPLOYEE SALARY LIST
  // =====================================================

  const loadEmployees = useCallback(async () => {
    const requestNumber = ++listRequestRef.current;
    const expectedScope = sessionScope;

    if (
      !shopId ||
      !shiftId ||
      !accessToken ||
      !supabaseUrl ||
      !supabaseAnonKey
    ) {
      setEmployees([]);
      setLoading(false);
      return;
    }

    try {
      const result = await callRpc({
        supabaseUrl,
        accessToken,
        supabaseAnonKey,
        functionName: "tl_salary_master_cashier_list_v3",
        body: {
          p_shop_id: shopId,
          p_shift_id: shiftId,
        },
      });

      if (
        activeScopeRef.current !== expectedScope ||
        listRequestRef.current !== requestNumber
      ) {
        return;
      }

      if (!Array.isArray(result)) {
        throw new Error(
          "Invalid Master Employee salary list."
        );
      }

      setEmployees(result);
    } catch (error) {
      if (
        activeScopeRef.current !== expectedScope ||
        listRequestRef.current !== requestNumber
      ) {
        return;
      }

      console.error(
        "LOAD CASHIER SALARY V3 ERROR:",
        error
      );

      setEmployees([]);
      setMessage(
        error?.message ||
          "Unable to load salary information."
      );
      setMessageType("error");
    } finally {
      if (
        activeScopeRef.current === expectedScope &&
        listRequestRef.current === requestNumber
      ) {
        setLoading(false);
      }
    }
  }, [
    shopId,
    shiftId,
    accessToken,
    supabaseUrl,
    supabaseAnonKey,
    sessionScope,
  ]);

  // =====================================================
  // AUTO REFRESH
  // =====================================================

  useEffect(() => {
    setLoading(true);
    loadEmployees();

    const timer = setInterval(loadEmployees, 5000);

    return () => {
      clearInterval(timer);
      listRequestRef.current += 1;
    };
  }, [loadEmployees]);

  // =====================================================
  // CLEAR PRIVATE DATA WHEN SHIFT / USER CHANGES
  // =====================================================

  useEffect(() => {
    setPinOpenId(null);
    setPinInputs({});
    setUnlocked({});
    setRecentPaid({});
    setVerifyingId(null);
    setPayingId(null);

    verifyBusyRef.current = false;
    payBusyRef.current = false;

    setMessage("");
    setMessageType("");

    Object.values(lockTimersRef.current).forEach(clearTimeout);
    Object.values(pinTimersRef.current).forEach(clearTimeout);
    Object.values(unlockedTimersRef.current).forEach(clearTimeout);

    lockTimersRef.current = {};
    pinTimersRef.current = {};
    unlockedTimersRef.current = {};
  }, [sessionScope]);

  useEffect(() => {
    return () => {
      Object.values(lockTimersRef.current).forEach(clearTimeout);
      Object.values(pinTimersRef.current).forEach(clearTimeout);
      Object.values(unlockedTimersRef.current).forEach(clearTimeout);
    };
  }, []);

  // =====================================================
  // PIN TIMER
  // =====================================================

  function clearPinTimer(employeeId) {
    const timer = pinTimersRef.current[employeeId];

    if (timer) {
      clearTimeout(timer);
      delete pinTimersRef.current[employeeId];
    }
  }

  function startPinCloseTimer(employeeId) {
    clearPinTimer(employeeId);

    const expectedScope = sessionScope;

    pinTimersRef.current[employeeId] = setTimeout(() => {
      if (activeScopeRef.current !== expectedScope) return;

      setPinOpenId((current) =>
        current === employeeId ? null : current
      );

      setPinInputs((previous) => ({
        ...previous,
        [employeeId]: "",
      }));

      setMessage("");
      setMessageType("");

      delete pinTimersRef.current[employeeId];
    }, 20000);
  }

  // =====================================================
  // UNLOCKED DETAILS TIMER
  // =====================================================

  function clearUnlockedTimer(employeeId) {
    const timer = unlockedTimersRef.current[employeeId];

    if (timer) {
      clearTimeout(timer);
      delete unlockedTimersRef.current[employeeId];
    }
  }

  function startUnlockedCloseTimer(employeeId) {
    clearUnlockedTimer(employeeId);

    const expectedScope = sessionScope;

    unlockedTimersRef.current[employeeId] = setTimeout(() => {
      if (activeScopeRef.current !== expectedScope) return;

      setUnlocked((previous) => {
        const next = { ...previous };
        delete next[employeeId];
        return next;
      });

      setPinOpenId(null);

      setPinInputs((previous) => ({
        ...previous,
        [employeeId]: "",
      }));

      setMessage("");
      setMessageType("");

      delete unlockedTimersRef.current[employeeId];

      loadEmployees();
    }, 20000);
  }

  // =====================================================
  // PAID DETAILS TIMER — 10 SECONDS
  // =====================================================

  function startPaidCloseTimer(employeeId) {
    const previousTimer = lockTimersRef.current[employeeId];

    if (previousTimer) {
      clearTimeout(previousTimer);
    }

    const expectedScope = sessionScope;

    lockTimersRef.current[employeeId] = setTimeout(() => {
      if (activeScopeRef.current !== expectedScope) return;

      setUnlocked((previous) => {
        const next = { ...previous };
        delete next[employeeId];
        return next;
      });

      setRecentPaid((previous) => {
        const next = { ...previous };
        delete next[employeeId];
        return next;
      });

      setPinOpenId(null);

      setPinInputs((previous) => ({
        ...previous,
        [employeeId]: "",
      }));

      setMessage("");
      setMessageType("");

      delete lockTimersRef.current[employeeId];

      loadEmployees();
    }, 10000);
  }

  // =====================================================
  // OPEN SALARY PIN
  // =====================================================

  function openPin(row) {
    if (!shiftId || !shopId || !accessToken) {
      setMessage(
        "An active cashier shift is required to access salaries."
      );
      setMessageType("error");
      return;
    }

    if (
      verifyingId !== null ||
      payingId !== null ||
      verifyBusyRef.current ||
      payBusyRef.current
    ) {
      return;
    }

    if (row?.pin_locked) {
      setMessage(
        `${row.employee_name}'s Salary PIN is locked. Contact Admin.`
      );
      setMessageType("error");
      return;
    }

    if (
      String(row?.status || "").toUpperCase() !== "PENDING"
    ) {
      return;
    }

    for (const employeeId of Object.keys(pinTimersRef.current)) {
      clearPinTimer(employeeId);
    }

    setPinOpenId(row.employee_id);

    setPinInputs((previous) => ({
      ...previous,
      [row.employee_id]: "",
    }));

    setMessage("");
    setMessageType("");

    startPinCloseTimer(row.employee_id);
  }

  // =====================================================
  // VERIFY MASTER SALARY PIN V3
  // =====================================================

  async function verifyPin(row) {
    if (!row?.employee_id || !shiftId || !shopId) {
      setMessage("An authorized working shift is required.");
      setMessageType("error");
      return;
    }

    if (verifyBusyRef.current) return;

    const pin = String(
      pinInputs[row.employee_id] || ""
    ).trim();

    if (!/^\d{4}$/.test(pin)) {
      setMessage("Enter the 4-digit Salary PIN.");
      setMessageType("error");
      startPinCloseTimer(row.employee_id);
      return;
    }

    const expectedScope = sessionScope;

    verifyBusyRef.current = true;

    try {
      clearPinTimer(row.employee_id);
      setVerifyingId(row.employee_id);

      setMessage("");
      setMessageType("");

      const result = await callRpc({
        supabaseUrl,
        accessToken,
        supabaseAnonKey,
        functionName: "tl_salary_master_verify_pin_v3",
        body: {
          p_employee_id: row.employee_id,
          p_shift_id: shiftId,
          p_pin: pin,
        },
      });

      if (activeScopeRef.current !== expectedScope) {
        return;
      }

      if (!result?.success) {
        setMessage(
          result?.message || "Unable to unlock salary."
        );
        setMessageType("error");

        setPinInputs((previous) => ({
          ...previous,
          [row.employee_id]: "",
        }));

        await loadEmployees();

        if (result?.code === "PIN_LOCKED") {
          clearPinTimer(row.employee_id);
          setPinOpenId(null);
        } else {
          startPinCloseTimer(row.employee_id);
        }

        return;
      }

      if (result?.code === "NO_PENDING_SALARY") {
        clearPinTimer(row.employee_id);

        setMessage(
          result?.message || "No salary is currently due."
        );
        setMessageType("success");

        setPinOpenId(null);

        setPinInputs((previous) => ({
          ...previous,
          [row.employee_id]: "",
        }));

        await loadEmployees();
        return;
      }

      if (result?.code !== "PIN_OK" || !result?.session_id) {
        setMessage(
          result?.message || "Unable to open salary."
        );
        setMessageType("error");

        startPinCloseTimer(row.employee_id);
        return;
      }

      clearPinTimer(row.employee_id);

      setUnlocked((previous) => ({
        ...previous,
        [row.employee_id]: {
          ...result,
          _sessionScope: expectedScope,
        },
      }));

      setPinOpenId(null);

      setPinInputs((previous) => ({
        ...previous,
        [row.employee_id]: "",
      }));

      setMessage(
        `${row.employee_name}'s salary has been unlocked.`
      );
      setMessageType("success");

      startUnlockedCloseTimer(row.employee_id);
    } catch (error) {
      if (activeScopeRef.current !== expectedScope) {
        return;
      }

      console.error(
        "VERIFY MASTER SALARY PIN V3 ERROR:",
        error
      );

      setMessage(
        error?.message || "Unable to verify Salary PIN."
      );
      setMessageType("error");

      setPinInputs((previous) => ({
        ...previous,
        [row.employee_id]: "",
      }));

      startPinCloseTimer(row.employee_id);
    } finally {
      if (activeScopeRef.current === expectedScope) {
        verifyBusyRef.current = false;
        setVerifyingId(null);
      }
    }
  }

  // =====================================================
  // PAY MASTER EMPLOYEE SALARY V3
  // =====================================================

  async function paySalary(row) {
    const details = unlocked[row.employee_id];

    if (
      !shiftId ||
      !details?.session_id ||
      details?._sessionScope !== sessionScope
    ) {
      setMessage(
        "Salary authorization is missing. Enter the Salary PIN again."
      );
      setMessageType("error");
      return;
    }

    if (payBusyRef.current || payingId !== null) {
      return;
    }

    clearUnlockedTimer(row.employee_id);

    const confirmed = window.confirm(
      "CONFIRM WEEKLY SALARY PAYMENT\n\n" +
        `Employee: ${details.employee_name || row.employee_name}\n` +
        `Earned Week: ${formatWeek(
          details.earned_week_start,
          details.earned_week_end
        )}\n\n` +
        `Weekly Salary: KES ${money(details.gross_salary)}\n` +
        `Advance: ${details.advance || "NO"}\n` +
        `Advance Deduction: KES ${money(
          details.advance_deduction
        )}\n` +
        `Net Salary To Pay: KES ${money(details.net_salary)}\n` +
        `Advance Balance After: KES ${money(
          details.advance_balance_after
        )}\n\n` +
        "The net salary will automatically be added to Expenses as a PRIVATE salary expense.\n\n" +
        "Pay this salary?"
    );

    if (!confirmed) {
      startUnlockedCloseTimer(row.employee_id);
      return;
    }

    const expectedScope = sessionScope;

    payBusyRef.current = true;

    try {
      setPayingId(row.employee_id);
      setMessage("");
      setMessageType("");

      const result = await callRpc({
        supabaseUrl,
        accessToken,
        supabaseAnonKey,
        functionName: "tl_salary_master_pay_v3",
        body: {
          p_employee_id: row.employee_id,
          p_shift_id: shiftId,
          p_session_id: details.session_id,
        },
      });

      if (activeScopeRef.current !== expectedScope) {
        return;
      }

      if (!result?.success || result?.code !== "SALARY_PAID") {
        throw new Error(
          result?.message || "Unable to pay salary."
        );
      }

      setRecentPaid((previous) => ({
        ...previous,
        [row.employee_id]: true,
      }));

      setUnlocked((previous) => ({
        ...previous,
        [row.employee_id]: {
          ...details,
          ...result,
          _sessionScope: expectedScope,
        },
      }));

      setPinOpenId(null);

      setPinInputs((previous) => ({
        ...previous,
        [row.employee_id]: "",
      }));

      setMessage(
        `${row.employee_name}'s salary was paid successfully. Salary details will hide automatically in 10 seconds.`
      );
      setMessageType("success");

      startPaidCloseTimer(row.employee_id);

      // A refresh failure must not misreport a completed salary.

      if (typeof onSalaryPaid === "function") {
        try {
          await onSalaryPaid();
        } catch (refreshError) {
          console.error(
            "MASTER SALARY PAID - DASHBOARD REFRESH ERROR:",
            refreshError
          );
        }
      }

      if (activeScopeRef.current === expectedScope) {
        await loadEmployees();
      }
    } catch (error) {
      if (activeScopeRef.current !== expectedScope) {
        return;
      }

      console.error(
        "PAY MASTER SALARY V3 ERROR:",
        error
      );

      setMessage(
        error?.message || "Unable to complete salary payment."
      );
      setMessageType("error");

      startUnlockedCloseTimer(row.employee_id);
    } finally {
      if (activeScopeRef.current === expectedScope) {
        payBusyRef.current = false;
        setPayingId(null);
      }
    }
  }

  // =====================================================
  // DISPLAY
  // =====================================================

  return (
    <section className="tl-salary-v3">
      <style>{salaryCss}</style>

      <div className="tl-salary-title">
        <div>
          <div className="tl-salary-eyebrow">
            PRIVATE PAYROLL
          </div>
          <div className="tl-salary-heading">
            WEEKLY SALARY
          </div>
        </div>

        <span className="tl-salary-heading-chip">
          MASTER EMPLOYEE V3
        </span>
      </div>

      <div className="tl-salary-privacy">
        <span aria-hidden="true">🔒</span>
        <span>
          Salary amounts are private. Each employee
          must enter their own 4-digit Salary PIN.
        </span>
      </div>

      {message && (
        <div
          role="status"
          className={`tl-salary-message ${
            messageType === "success"
              ? "success"
              : "error"
          }`}
        >
          {message}
        </div>
      )}

      <div
        className="tl-salary-gridhead"
        aria-hidden="true"
      >
        <div>EMPLOYEE</div>
        <div>SALARY</div>
        <div>STATUS</div>
        <div>ACTION</div>
      </div>

      {loading ? (
        <div className="tl-salary-empty">
          Loading salary employees...
        </div>
      ) : employees.length === 0 ? (
        <div className="tl-salary-empty">
          No salary employees authorized for
          this working shift.
        </div>
      ) : (
        employees.map((row) => {
          const employeeId = row.employee_id;
          const storedDetails = unlocked[employeeId];

          const details =
            storedDetails?._sessionScope === sessionScope
              ? storedDetails
              : null;

          const justPaid = Boolean(
            recentPaid[employeeId] && details
          );

          const status = String(
            row.status || "NOT DUE"
          ).toUpperCase();

          const locked = Boolean(
            row.pin_locked || status === "LOCKED"
          );

          const pinOpen = pinOpenId === employeeId;

          const visibleStatus = justPaid
            ? "PAID"
            : locked
            ? "LOCKED"
            : status;

          return (
            <div
              className="tl-salary-employee"
              key={employeeId}
            >
              <div className="tl-salary-row">
                <div className="tl-salary-name">
                  {row.employee_name}
                </div>

                <div className="tl-salary-private">
                  🔒 PRIVATE
                </div>

                <SalaryStatus status={visibleStatus} />

                <div className="tl-salary-action">
                  {justPaid ? (
                    <span className="tl-salary-action-label positive">
                      PAID ✓
                    </span>
                  ) : locked ? (
                    <span className="tl-salary-action-label negative">
                      CONTACT ADMIN
                    </span>
                  ) : details ? (
                    <span className="tl-salary-action-label neutral">
                      UNLOCKED
                    </span>
                  ) : status === "PENDING" ? (
                    <button
                      type="button"
                      className="tl-salary-view"
                      onClick={() => openPin(row)}
                      disabled={
                        verifyingId !== null ||
                        payingId !== null
                      }
                    >
                      VIEW / PAY
                    </button>
                  ) : status === "PAID" ? (
                    <span className="tl-salary-action-label positive">
                      PRIVATE ✓
                    </span>
                  ) : (
                    <span className="tl-salary-action-label muted">
                      NOT DUE
                    </span>
                  )}
                </div>
              </div>

              {/* PRIVATE PIN */}

              {pinOpen && !locked && (
                <div className="tl-salary-pin-box">
                  <div className="tl-salary-pin-title">
                    Enter {row.employee_name}'s
                    4-digit Salary PIN
                  </div>

                  <div className="tl-salary-pin-grid">
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      value={pinInputs[employeeId] || ""}
                      disabled={
                        verifyingId === employeeId ||
                        payingId !== null
                      }
                      autoFocus
                      placeholder="••••"
                      autoComplete="off"
                      aria-label="4-digit Salary PIN"
                      onChange={(event) => {
                        const value = event.target.value
                          .replace(/\D/g, "")
                          .slice(0, 4);

                        setPinInputs((previous) => ({
                          ...previous,
                          [employeeId]: value,
                        }));

                        setMessage("");
                        setMessageType("");
                        startPinCloseTimer(employeeId);
                      }}
                      className="tl-salary-pin-input"
                    />

                    <button
                      type="button"
                      className="tl-salary-unlock"
                      disabled={
                        verifyingId !== null ||
                        payingId !== null
                      }
                      onClick={() => verifyPin(row)}
                    >
                      {verifyingId === employeeId
                        ? "CHECKING..."
                        : "UNLOCK"}
                    </button>

                    <button
                      type="button"
                      className="tl-salary-cancel"
                      disabled={verifyingId === employeeId}
                      onClick={() => {
                        clearPinTimer(employeeId);
                        setPinOpenId(null);

                        setPinInputs((previous) => ({
                          ...previous,
                          [employeeId]: "",
                        }));

                        setMessage("");
                        setMessageType("");
                      }}
                    >
                      CANCEL
                    </button>
                  </div>

                  <div className="tl-salary-hint">
                    Maximum 3 incorrect attempts.
                    Admin must unlock the PIN after
                    the third failure. The PIN box
                    closes after 20 seconds of inactivity.
                  </div>
                </div>
              )}

              {/* PRIVATE PAYMENT DETAILS */}

              {details && (
                <div className="tl-salary-details">
                  <div className="tl-salary-details-heading">
                    {details.employee_name ||
                      row.employee_name}
                    {" — PRIVATE SALARY DETAILS"}
                  </div>

                  <div className="tl-salary-detail-grid">
                    <DetailBox
                      title="EARNED WEEK"
                      value={formatWeek(
                        details.earned_week_start,
                        details.earned_week_end
                      )}
                    />

                    <DetailBox
                      title="WEEKLY SALARY"
                      value={`KES ${money(
                        details.gross_salary
                      )}`}
                    />

                    <DetailBox
                      title="ADVANCE"
                      value={
                        details.advance ||
                        (Number(
                          details.advance_balance_before || 0
                        ) > 0
                          ? "YES"
                          : "NO")
                      }
                    />

                    <DetailBox
                      title="ADVANCE BALANCE"
                      value={`KES ${money(
                        details.advance_balance_before
                      )}`}
                    />

                    <DetailBox
                      title="ADV. DEDUCTION"
                      value={`KES ${money(
                        details.advance_deduction
                      )}`}
                    />

                    <DetailBox
                      title="NET SALARY"
                      value={`KES ${money(
                        details.net_salary
                      )}`}
                      strong
                    />

                    <DetailBox
                      title="ADVANCE AFTER"
                      value={`KES ${money(
                        details.advance_balance_after
                      )}`}
                    />

                    <DetailBox
                      title="PAYMENT"
                      value={
                        justPaid ? "PAID ✓" : "PENDING"
                      }
                      strong
                    />
                  </div>

                  {justPaid ? (
                    <div className="tl-salary-paid-note">
                      Salary paid successfully.
                      Private details disappear
                      automatically after 10 seconds.
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="tl-salary-pay"
                        disabled={
                          payingId !== null ||
                          verifyingId !== null
                        }
                        onClick={() => paySalary(row)}
                      >
                        {payingId === employeeId
                          ? "PAYING SALARY..."
                          : "PAY SALARY"}
                      </button>

                      <div className="tl-salary-hint centered">
                        Private salary details close
                        automatically after 20 seconds
                        if no payment is made.
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}

      <div className="tl-salary-footer">
        Salary earned Monday–Sunday becomes payable
        from the following Monday. Successful payments
        are posted automatically to Expenses as
        private salary expenses.
      </div>
    </section>
  );
}

// =====================================================
// SALARY STATUS
// =====================================================

function SalaryStatus({ status }) {
  const value = String(status || "").toUpperCase();

  const tone =
    value === "PAID"
      ? "paid"
      : value === "LOCKED"
      ? "locked"
      : value === "PENDING"
      ? "pending"
      : "not-due";

  return (
    <div className={`tl-salary-status ${tone}`}>
      {value === "PAID" ? "PAID ✓" : value}
    </div>
  );
}

// =====================================================
// PRIVATE DETAIL BOX
// =====================================================

function DetailBox({
  title,
  value,
  strong = false,
}) {
  return (
    <div
      className={`tl-salary-detail ${
        strong ? "highlight" : ""
      }`}
    >
      <div className="tl-salary-detail-title">
        {title}
      </div>

      <div className="tl-salary-detail-value">
        {value}
      </div>
    </div>
  );
}

// =====================================================
// SUPABASE RPC HELPER
// =====================================================

async function callRpc({
  supabaseUrl,
  accessToken,
  supabaseAnonKey,
  functionName,
  body,
}) {
  if (
    !supabaseUrl ||
    !accessToken ||
    !supabaseAnonKey
  ) {
    throw new Error(
      "Supabase connection or login is missing."
    );
  }

  const response = await fetch(
    `${String(supabaseUrl).replace(
      /\/+$/,
      ""
    )}/rest/v1/rpc/${functionName}`,
    {
      method: "POST",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    }
  );

  const result = await safeJson(response);

  if (!response.ok) {
    throw new Error(
      result?.message ||
        result?.details ||
        result?.hint ||
        `Unable to run ${functionName}.`
    );
  }

  return result;
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

// =====================================================
// MONEY / DATES
// =====================================================

function money(value) {
  const number = Number(value ?? 0);

  return (
    Number.isFinite(number) ? number : 0
  ).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatWeek(start, end) {
  if (!start) return "-";

  return `${formatDate(start)} - ${
    end ? formatDate(end) : "-"
  }`;
}

function formatDate(value) {
  if (!value) return "-";

  const datePart = String(value).slice(0, 10);

  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);

  if (!match) return String(value);

  const date = new Date(
    Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3])
    )
  );

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

// =====================================================
// PROFESSIONAL THREE-COLUMN RESPONSIVE STYLES
// =====================================================

const salaryCss = `
.tl-salary-v3 {
  grid-column: auto;
  min-width: 0;
  width: 100%;
  box-sizing: border-box;

  container-type: inline-size;
  container-name: salary-panel;

  background: #101f30;
  color: #f0f5fa;
  border: 1px solid #2a3d52;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 8px 25px rgba(0,0,0,.12);

  font-family: Inter, ui-sans-serif, system-ui,
    -apple-system, BlinkMacSystemFont,
    "Segoe UI", sans-serif;
}

.tl-salary-v3 * {
  box-sizing: border-box;
}

.tl-salary-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding: 16px 18px;
  background: #152639;
  border-left: 3px solid #d9b66c;
  border-bottom: 1px solid #2a3d52;
}

.tl-salary-eyebrow {
  color: #d9b66c;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .12em;
}

.tl-salary-heading {
  font-size: 17px;
  font-weight: 850;
  letter-spacing: .05em;
  margin-top: 3px;
}

.tl-salary-heading-chip {
  color: #b6c4d2;
  border: 1px solid #3b4c60;
  background: #0a1725;
  padding: 7px 10px;
  border-radius: 7px;
  font-size: 10px;
  font-weight: 800;
}

.tl-salary-privacy {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #c4d0dc;
  background: #0a1725;
  padding: 12px 18px;
  border-bottom: 1px solid #223448;
  font-size: 12px;
  line-height: 1.5;
}

.tl-salary-message {
  margin: 12px 14px;
  padding: 12px 13px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 750;
  overflow-wrap: anywhere;
}

.tl-salary-message.success {
  background: #10332e;
  color: #a8ebd1;
  border: 1px solid #2a6354;
}

.tl-salary-message.error {
  background: #38202a;
  color: #ffc3ce;
  border: 1px solid #774155;
}

.tl-salary-gridhead,
.tl-salary-row {
  display: grid;
  grid-template-columns:
    minmax(130px, 1.6fr)
    minmax(100px, .8fr)
    minmax(95px, .75fr)
    minmax(126px, .9fr);
  gap: 12px;
  align-items: center;
  padding: 12px 16px;
}

.tl-salary-gridhead {
  color: #91a5b8;
  background: #0a1725;
  font-size: 10px;
  font-weight: 850;
  border-bottom: 1px solid #2a3d52;
}

.tl-salary-employee {
  border-bottom: 1px solid #223448;
}

.tl-salary-row {
  min-height: 74px;
  background: #101f30;
}

.tl-salary-name {
  min-width: 0;
  font-size: 14px;
  font-weight: 800;
  overflow-wrap: anywhere;
}

.tl-salary-private {
  color: #c5d4e4;
  background: #0a1725;
  border: 1px solid #304359;
  padding: 9px 10px;
  border-radius: 7px;
  text-align: center;
  font-weight: 800;
  font-size: 11px;
}

.tl-salary-status,
.tl-salary-action-label {
  display: block;
  width: 100%;
  padding: 10px 8px;
  border-radius: 7px;
  text-align: center;
  font-size: 11px;
  font-weight: 850;
  line-height: 1.3;
}

.tl-salary-status.pending {
  background: #322a1d;
  color: #ffe3a8;
  border: 1px solid #695638;
}

.tl-salary-status.paid {
  background: #10332e;
  color: #a8ebd1;
  border: 1px solid #2a6354;
}

.tl-salary-status.locked {
  background: #38202a;
  color: #ffc3ce;
  border: 1px solid #774155;
}

.tl-salary-status.not-due {
  background: #15263a;
  color: #b8c8d8;
  border: 1px solid #344459;
}

.tl-salary-action-label.positive {
  background: #10332e;
  color: #a8ebd1;
  border: 1px solid #2a6354;
}

.tl-salary-action-label.negative {
  background: #38202a;
  color: #ffc3ce;
  border: 1px solid #774155;
}

.tl-salary-action-label.neutral {
  background: #322a1d;
  color: #ffe3a8;
  border: 1px solid #695638;
}

.tl-salary-action-label.muted {
  background: #15263a;
  color: #b8c8d8;
  border: 1px solid #344459;
}

.tl-salary-action {
  min-width: 0;
}

.tl-salary-v3 button {
  font-family: inherit;
  cursor: pointer;
}

.tl-salary-v3 button:disabled {
  opacity: .45;
  cursor: not-allowed;
}

.tl-salary-view {
  display: block;
  width: 100%;
  min-height: 41px;
  padding: 9px 12px;
  background: #1c695d;
  color: #fff;
  border: 1px solid #2b8b7c;
  border-radius: 7px;
  font-size: 11px;
  font-weight: 850;
  white-space: nowrap;
}

.tl-salary-pin-box,
.tl-salary-details {
  margin: 4px 15px 15px;
  padding: 17px;
  border: 1px solid #6a593a;
  background: #132337;
  border-radius: 10px;
}

.tl-salary-pin-title,
.tl-salary-details-heading {
  color: #f0f5fa;
  margin-bottom: 12px;
  font-size: 13px;
  font-weight: 850;
  line-height: 1.5;
}

.tl-salary-pin-grid {
  display: grid;
  grid-template-columns:
    minmax(0, 1fr) 110px 95px;
  gap: 9px;
}

.tl-salary-pin-input {
  min-width: 0;
  width: 100%;
  min-height: 45px;
  padding: 10px;
  background: #0a1725;
  color: #fff;
  border: 1px solid #42566b;
  border-radius: 7px;
  font-size: 20px;
  font-weight: 850;
  letter-spacing: .25em;
  text-align: center;
}

.tl-salary-unlock,
.tl-salary-cancel {
  min-height: 45px;
  padding: 9px 10px;
  border-radius: 7px;
  font-size: 11px;
  font-weight: 850;
}

.tl-salary-unlock {
  background: #1c695d;
  color: #fff;
  border: 1px solid #2b8b7c;
}

.tl-salary-cancel {
  background: #172638;
  color: #c4d0dc;
  border: 1px solid #40536a;
}

.tl-salary-hint {
  color: #aab9c9;
  font-size: 11px;
  line-height: 1.6;
  margin-top: 10px;
}

.tl-salary-hint.centered {
  text-align: center;
}

.tl-salary-detail-grid {
  display: grid;
  grid-template-columns:
    repeat(auto-fit, minmax(min(100%,165px),1fr));
  gap: 9px;
}

.tl-salary-detail {
  min-width: 0;
  padding: 12px;
  background: #0a1725;
  border: 1px solid #2a3d52;
  border-radius: 8px;
  overflow-wrap: anywhere;
}

.tl-salary-detail.highlight {
  background: #15352f;
  border-color: #307d6c;
}

.tl-salary-detail-title {
  color: #91a5b8;
  font-size: 10px;
  font-weight: 850;
}

.tl-salary-detail-value {
  color: #f0f5fa;
  font-size: 14px;
  font-weight: 850;
  margin-top: 7px;
  font-variant-numeric: tabular-nums;
}

.tl-salary-detail.highlight
.tl-salary-detail-value {
  color: #a8ebd1;
}

.tl-salary-pay {
  width: 100%;
  margin-top: 14px;
  padding: 13px 15px;
  min-height: 46px;
  color: #fff;
  background: #1c695d;
  border: 1px solid #2b8b7c;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 850;
}

.tl-salary-paid-note {
  margin-top: 12px;
  padding: 11px;
  border: 1px solid #2a6354;
  background: #10332e;
  border-radius: 8px;
  color: #a8ebd1;
  font-size: 12px;
  font-weight: 750;
  text-align: center;
}

.tl-salary-empty {
  padding: 30px 18px;
  text-align: center;
  color: #c4d0dc;
  font-size: 13px;
}

.tl-salary-footer {
  padding: 14px 18px;
  border-top: 1px solid #223448;
  color: #91a5b8;
  background: #0a1725;
  font-size: 11px;
  line-height: 1.6;
}

/* ================================================
   COMPACT VIEW FOR ONE OF THREE EQUAL COLUMNS

   The panel adapts to its own width rather than
   relying only on screen width.
   ================================================ */

@container salary-panel (max-width: 540px) {

  .tl-salary-title {
    padding: 12px;
    gap: 8px;
  }

  .tl-salary-heading {
    font-size: 15px;
  }

  .tl-salary-heading-chip {
    font-size: 9px;
    padding: 5px 7px;
  }

  .tl-salary-gridhead {
    display: none;
  }

  .tl-salary-row {
    grid-template-columns:
      minmax(0, 1fr)
      minmax(0, 1fr);
    gap: 8px;
    padding: 12px;
  }

  .tl-salary-name {
    grid-column: 1;
    font-size: 12px;
  }

  .tl-salary-private {
    grid-column: 2;
  }

  .tl-salary-status {
    grid-column: 1;
  }

  .tl-salary-action {
    grid-column: 2;
  }

  .tl-salary-private,
  .tl-salary-status,
  .tl-salary-action-label {
    font-size: 9px;
    padding: 8px 5px;
  }

  .tl-salary-view {
    font-size: 10px;
    padding: 8px 5px;
    white-space: normal;
  }

  .tl-salary-privacy {
    padding: 10px 12px;
  }

  .tl-salary-pin-box,
  .tl-salary-details {
    margin: 3px 10px 12px;
    padding: 12px;
  }

  .tl-salary-pin-grid {
    grid-template-columns:
      repeat(2, minmax(0, 1fr));
    gap: 7px;
  }

  .tl-salary-pin-input {
    grid-column: 1 / -1;
  }

  .tl-salary-detail-grid {
    grid-template-columns:
      repeat(2, minmax(0, 1fr));
  }

  .tl-salary-detail {
    padding: 9px;
  }

  .tl-salary-detail-value {
    font-size: 12px;
  }
}

@media (max-width: 720px) {
  .tl-salary-title {
    padding: 12px;
  }

  .tl-salary-footer {
    padding: 12px;
  }
}
`;
