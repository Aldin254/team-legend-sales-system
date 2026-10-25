"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

// ======================================================
// TEAM LEGEND / NYIKA
// CASHIER MEALS + KENYA HOLIDAY BONUS
// EXECUTIVE LED — LIGHT MINT EDITION
// ======================================================
//
// Existing employee list comes from the Duty Rota.
// Enabled holidays appear up to 7 days in advance.
// Holiday Bonus is company-wide, not attendance-based.
//
// This stage displays holidays only.
// Holiday expense posting will be connected separately.
//
// Confirmed meal expense -> light mint green ✓
// Disqualified meal     -> red ✕
// Pending / other       -> navy, no tick
// Enabled holiday       -> navy and gold, no tick
//
// No additional employee sign-in.
// No financial writes.
// ======================================================

const REFRESH_MS = 30000;

function money(value) {
  const n = Number(value);

  if (!Number.isFinite(n) || n <= 0) {
    return "0";
  }

  return n.toLocaleString("en-KE", {
    maximumFractionDigits: 2,
  });
}

function weekday(value) {
  const date = String(
    value ?? ""
  ).slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return -1;
  }

  return new Date(
    `${date}T12:00:00Z`
  ).getUTCDay();
}

// ======================================================
// EXISTING LUNCH / SUPPER / BONUS STATUS
// ======================================================

function statusFor(
  row,
  kind,
  globalLunchEnabled
) {
  let applicable = true;
  let enabled = false;
  let eligible = false;
  let configured = 0;
  let posted = null;

  if (kind === "LUNCH") {
    enabled =
      globalLunchEnabled &&
      row.lunch_enabled === true;

    eligible =
      row.lunch_eligible === true;

    configured = Number(
      row.lunch_amount ?? 0
    );

    posted =
      row.lunch_posted_amount;
  }

  else if (kind === "SUPPER") {
    // Supper stays disabled.
    // Historical confirmed awards remain visible.

    applicable = false;

    posted =
      row.supper_posted_amount;
  }

  else if (kind === "BONUS") {
    const day = weekday(
      row.duty_date
    );

    applicable =
      day === 1 ||
      day === 5;

    if (day === 1) {
      enabled =
        row.monday_enabled === true;

      eligible =
        row.monday_bonus_eligible === true;

      configured = Number(
        row.monday_bonus ?? 0
      );

      posted =
        row.monday_posted_amount;
    }

    else if (day === 5) {
      enabled =
        row.friday_enabled === true;

      eligible =
        row.friday_bonus_eligible === true;

      configured = Number(
        row.friday_bonus ?? 0
      );

      posted =
        row.friday_posted_amount;
    }
  }

  // Confirmed expense -> green tick

  if (
    posted !== null &&
    posted !== undefined &&
    posted !== ""
  ) {
    return {
      type: "confirmed",
      icon: "✓",
      amount: money(posted),
      description:
        "Award and matching expense confirmed",
    };
  }

  // Disabled or not applicable

  if (
    !applicable ||
    !enabled ||
    !Number.isFinite(configured) ||
    configured <= 0
  ) {
    return {
      type: "normal",
      icon: "",
      amount: "0",
      description:
        "Disabled or not applicable today",
    };
  }

  // Qualified but no matching expense yet

  if (eligible) {
    return {
      type: "normal",
      icon: "",
      amount: money(configured),
      description:
        "Eligible; expense not yet confirmed",
    };
  }

  const attendance = String(
    row.attendance_status || ""
  ).toUpperCase();

  if (
    attendance === "LATE" ||
    attendance === "NOT_SIGNED_IN"
  ) {
    return {
      type: "rejected",
      icon: "✕",
      amount: "0",
      description:
        attendance === "LATE"
          ? "Not qualified: shift opened after 10:50 AM"
          : "Not qualified: shift sign-in unavailable",
    };
  }

  return {
    type: "normal",
    icon: "",
    amount: "0",
    description:
      "No confirmed benefit",
  };
}

// ======================================================
// SHARED EXECUTIVE LED BUTTON
// ======================================================

function BenefitButton({
  label,
  status,
  holiday = false,
}) {
  return (
    <span
      className={
        `tl-executive-button ` +
        `tl-executive-${status.type}` +
        (holiday
          ? " tl-executive-holiday"
          : "")
      }
      title={
        `${label}: ${status.description}`
      }
      aria-label={
        `${label} ${status.amount}. ` +
        status.description
      }
    >
      {status.icon && (
        <span
          className="tl-executive-check"
          aria-hidden="true"
        >
          {status.icon}
        </span>
      )}

      <span className="tl-executive-label">
        {label}
      </span>

      <strong className="tl-executive-amount">
        {status.amount}
      </strong>
    </span>
  );
}

// ======================================================
// HOLIDAY BUTTON LABEL
// ======================================================

function holidayLabel(event) {
  const name = String(
    event.holiday_name || "HOLIDAY"
  )
    .toUpperCase()
    .replace(/\s+DAY$/, "");

 return `🇰🇪 ${name} BONUS`;
}

// ======================================================
// MAIN PANEL
// ======================================================

export default function CashierMealsRotaPanel({
  user,
  currentShift,
}) {
  const [
    employees,
    setEmployees,
  ] = useState([]);

  const [
    holidayEvents,
    setHolidayEvents,
  ] = useState([]);

  const [
    globalLunchEnabled,
    setGlobalLunchEnabled,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const requestIdRef = useRef(0);
  const inFlightRef = useRef(false);
  const lastRequestAtRef = useRef(0);


  const supabaseUrl = String(
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
      ""
  ).replace(/\/+$/, "");

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";

  const accessToken =
    user?.access_token || "";

  const shiftId =
    currentShift?.id || "";

  const isShiftOpen =
    String(
      currentShift?.status || ""
    )
      .trim()
      .toUpperCase() === "OPEN";

  // ====================================================
  // READ MEALS + HOLIDAY SNAPSHOT
  // ====================================================

  const loadMeals = useCallback(
    async (signal) => {
      if (
        !shiftId ||
        !isShiftOpen ||
        !supabaseUrl ||
        !supabaseAnonKey ||
        !accessToken
      ) {
        return;
      }

      // One in-flight snapshot per panel. A slow response must not
      // cause a backlog of requests from the 30-second timer.
      if (inFlightRef.current || signal.aborted) return;
      inFlightRef.current = true;
      lastRequestAtRef.current = Date.now();

      const requestId =
        ++requestIdRef.current;

      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/rpc/tl_cashier_meals_holiday_snapshot`,
          {
            method: "POST",

            cache: "no-store",

            headers: {
              apikey: supabaseAnonKey,

              Authorization:
                `Bearer ${accessToken}`,

              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              p_shift_id: shiftId,
            }),

            signal,
          }
        );

        const result = await response
          .json()
          .catch(() => null);

        if (
          !response.ok ||
          result?.ok !== true ||
          !Array.isArray(
            result?.employees
          )
        ) {
          throw new Error(
            result?.message ||
            result?.details ||
            "Unable to load Meals & Bonuses."
          );
        }

        if (
          signal.aborted ||
          requestId !==
            requestIdRef.current
        ) {
          return;
        }

        setEmployees(
          result.employees
        );

        setHolidayEvents(
          Array.isArray(
            result.holiday_events
          )
            ? result.holiday_events
            : []
        );

        setGlobalLunchEnabled(
          result.global_lunch_enabled === true
        );

        setError("");
      }

      catch (err) {
        if (
          signal.aborted ||
          requestId !==
            requestIdRef.current
        ) {
          return;
        }

        console.error(
          "TEAM LEGEND MEALS / HOLIDAY:",
          err
        );

        setEmployees([]);
        setHolidayEvents([]);

        setError(
          err?.message ||
            "Meals & Bonuses unavailable."
        );
      } finally {
        // The effect cleanup invalidates this request ID when
        // the shift or credentials change.
        if (requestId === requestIdRef.current) {
          inFlightRef.current = false;
        }
      }
    },
    [
      shiftId,
      isShiftOpen,
      supabaseUrl,
      supabaseAnonKey,
      accessToken,
    ]
  );

  // ====================================================
  // AUTO REFRESH
  // ====================================================

  useEffect(() => {
    const controller = new AbortController();

    requestIdRef.current += 1;
    inFlightRef.current = false;
    lastRequestAtRef.current = 0;

    setEmployees([]);
    setHolidayEvents([]);
    setError("");

    const refresh = () => {
      if (!isShiftOpen || controller.signal.aborted) return;
      if (document.visibilityState !== "visible") return;
      void loadMeals(controller.signal);
    };

    // Initial snapshot and regular updates while the tab is visible.
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);

    // If the browser suspended timers while hidden, resume promptly.
    // Avoid duplicate RPCs when the latest request just started.
    const onVisibilityChange = () => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - lastRequestAtRef.current >= REFRESH_MS
      ) {
        refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      controller.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      requestIdRef.current += 1;
      inFlightRef.current = false;
    };
  }, [isShiftOpen, loadMeals]);

  if (
    !shiftId ||
    !isShiftOpen ||
    !supabaseUrl ||
    !supabaseAnonKey ||
    !accessToken
  ) {
    return null;
  }

  if (
    !employees.length &&
    !error
  ) {
    return null;
  }

  // ====================================================
  // EXECUTIVE LED DESIGN
  // ====================================================

  return (
    <section
      className="tl-executive-meals"
      aria-label="Employee Meals and Bonuses"
    >
      <style>{`

        .tl-executive-meals {
          margin: 6px 12px 0;
          min-width: 0;
          color: #ffffff;
          font-family: inherit;
          box-sizing: border-box;
        }

        .tl-executive-meals
        .tl-executive-board {
          width: 100%;
          overflow-x: auto;
          scrollbar-width: thin;
          background: #101f30;
          border: 1px solid #29475e;
          border-left: 3px solid #d9b66c;
          border-radius: 9px;
          box-sizing: border-box;
        }

        /* HOLIDAY GREETING */

        .tl-executive-meals
        .tl-executive-holiday-head {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
          padding: 8px 13px;
          color: #f0d398;
          background: #203149;
          border-bottom: 1px solid #38526a;
          font-size: 12px;
          font-weight: 850;
        }

        .tl-executive-meals
        .tl-executive-holiday-head span {
          white-space: nowrap;
        }

        /* EMPLOYEE ROW */

        .tl-executive-meals
        .tl-executive-row {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 14px;
          min-width: 100%;
          width: max-content;
          min-height: 49px;
          padding: 7px 13px;
          box-sizing: border-box;
        }

        .tl-executive-meals
        .tl-executive-row
        + .tl-executive-row {
          border-top: 1px solid #2d465b;
        }

        .tl-executive-meals
        .tl-executive-row:hover {
          background:
            rgba(255,255,255,.025);
        }

        /* MASTER EMPLOYEE NAME */

        .tl-executive-meals
        .tl-executive-name {
          flex: 0 0 205px;
          color: #ffffff;
          font-size: 12px;
          font-weight: 850;
          line-height: 1.3;
          letter-spacing: .025em;
          overflow-wrap: anywhere;
        }

        /* BENEFIT BUTTONS */

        .tl-executive-meals
        .tl-executive-buttons {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 10px;
          flex: 0 0 auto;
        }

        .tl-executive-meals
        .tl-executive-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;

          width: 143px;
          min-height: 36px;
          padding: 5px 10px;

          box-sizing: border-box;
          border-radius: 7px;
          border: 1px solid #55768f;

          background:
            linear-gradient(
              135deg,
              #284b66,
              #1d3751
            );

          color: #ffffff;
          white-space: nowrap;
          font-variant-numeric:
            tabular-nums;

          box-shadow:
            inset 0 1px 0
              rgba(255,255,255,.14),
            0 3px 8px
              rgba(0,0,0,.13);

          user-select: none;
          cursor: default;
        }

        .tl-executive-meals
        .tl-executive-label {
          color: inherit;
          font-size: 11px;
          font-weight: 850;
          letter-spacing: .035em;
        }

        .tl-executive-meals
        .tl-executive-amount {
          color: inherit;
          font-size: 13px;
          font-weight: 950;
          letter-spacing: 0;
        }

        /* STATUS ICON */

        .tl-executive-meals
        .tl-executive-check {
          display: inline-flex;
          align-items: center;
          justify-content: center;

          width: 21px;
          height: 21px;
          flex: 0 0 21px;

          border-radius: 50%;
          font-size: 15px;
          font-weight: 950;
          line-height: 1;
          color: #ffffff;
        }

        /* CONFIRMED: LIGHT MINT */

        .tl-executive-meals
        .tl-executive-confirmed {
          background:
            linear-gradient(
              135deg,
              #aef8d6,
              #73e5b9
            );

          border-color: #c8ffe6;
          color: #07392f;

          box-shadow:
            inset 0 1px 0
              rgba(255,255,255,.55),
            0 0 12px
              rgba(114,233,184,.26);
        }

        .tl-executive-meals
        .tl-executive-confirmed
        .tl-executive-check {
          background: #087c67;
          color: #ffffff;
        }

        /* DISQUALIFIED: RED */

        .tl-executive-meals
        .tl-executive-rejected {
          background:
            linear-gradient(
              135deg,
              #c45469,
              #97374f
            );

          border-color: #ffa1b0;
          color: #ffffff;
        }

        .tl-executive-meals
        .tl-executive-rejected
        .tl-executive-check {
          background:
            rgba(255,255,255,.18);
        }

        /* HOLIDAY BUTTON:
           GOLD EDGE, NAVY UNTIL POSTED */

        .tl-executive-meals
        .tl-executive-holiday {
          width: auto;
          min-width: 166px;
          padding: 5px 13px;

          border-color: #c09b5e;

          background:
            linear-gradient(
              135deg,
              #284b66,
              #1d3751
            );
        }

        /* ERRORS */

        .tl-executive-meals
        .tl-executive-error {
          padding: 6px 3px;
          font-size: 11px;
          font-weight: 650;
          color: #ff95a4;
        }

        /* MOBILE */

        @media (max-width: 650px) {

          .tl-executive-meals {
            margin: 5px 8px 0;
          }

          .tl-executive-meals
          .tl-executive-row {
            min-height: 45px;
            padding: 6px 9px;
            gap: 9px;
          }

          .tl-executive-meals
          .tl-executive-name {
            flex-basis: 180px;
            font-size: 11px;
          }

          .tl-executive-meals
          .tl-executive-buttons {
            gap: 7px;
          }

          .tl-executive-meals
          .tl-executive-button {
            width: 140px;
            min-height: 34px;
            padding: 4px 7px;
          }

          .tl-executive-meals
          .tl-executive-holiday {
            width: auto;
            min-width: 150px;
            padding: 4px 9px;
          }
        }

      `}</style>

      {employees.length > 0 && (
        <div className="tl-executive-board">

          {/* ACTIVE HOLIDAY GREETINGS */}

          {/* DUTY ROTA EMPLOYEES */}

          {employees.map(
            (employee) => (
              <div
                className="tl-executive-row"
                key={employee.employee_id}
              >
                <span className="tl-executive-name">
                  {employee.full_name}
                </span>

                <div className="tl-executive-buttons">

                  <BenefitButton
                    label="LUNCH"
                    status={statusFor(
                      employee,
                      "LUNCH",
                      globalLunchEnabled
                    )}
                  />

                  <BenefitButton
                    label="SUPPER"
                    status={statusFor(
                      employee,
                      "SUPPER",
                      globalLunchEnabled
                    )}
                  />

                  <BenefitButton
                    label="BONUS"
                    status={statusFor(
                      employee,
                      "BONUS",
                      globalLunchEnabled
                    )}
                  />

                  {/* ENABLED HOLIDAY BUTTONS */}

                  {holidayEvents.map((event) => (
  <div
    key={event.id}
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "12px",
      whiteSpace: "nowrap",
    }}
  >
    <BenefitButton
      holiday
      label={holidayLabel(event)}
      status={{
        type: "normal",
        icon: "",
        amount: money(event.amount),
        description:
          `${event.greeting} Scheduled for ` +
          `${event.holiday_date}. ` +
          `No confirmed holiday expense yet.`,
      }}
    />

    <span
      style={{
        color: "#E8C478",
        fontSize: "12px",
        fontWeight: 800,
      }}
    >
      {event.greeting}
    </span>
  </div>
))}

                </div>
              </div>
            )
          )}

        </div>
      )}

      {error && (
        <div
          className="tl-executive-error"
          role="alert"
        >
          {error}
        </div>
      )}

    </section>
  );
}
