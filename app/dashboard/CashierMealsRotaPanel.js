"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

// ==========================================================
// TEAM LEGEND / NYIKA
// CASHIER MEALS & BONUSES
// EXECUTIVE LED — LIGHT MINT GREEN EDITION
// ==========================================================
//
// DEFAULT       = Solid professional navy
// CONFIRMED     = Light mint green + ✓
// DISQUALIFIED  = Elegant red + ✕
// NOT APPLICABLE = Navy, no tick
//
// Full Master Employee names.
// All benefit buttons grouped together.
// One existing shift sign-in only.
// No separate sign-in buttons.
// No changes to expense posting or Duty Rota.
//
// Existing RPC:
// tl_meals_bonus_strip_snapshot(p_shift_id)
//
// ==========================================================

const REFRESH_MS = 30000;

// ==========================================================
// FORMAT MONEY
// ==========================================================

function money(value) {
  const number = Number(value);

  if (
    !Number.isFinite(number) ||
    number <= 0
  ) {
    return "0";
  }

  return number.toLocaleString("en-KE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

// ==========================================================
// GET WEEKDAY FROM BUSINESS DATE
// ==========================================================

function getWeekday(value) {
  const date = String(value || "").slice(0, 10);

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
  ) {
    return -1;
  }

  return new Date(
    `${date}T12:00:00Z`
  ).getUTCDay();
}

// ==========================================================
// BENEFIT STATUS HELPERS
// ==========================================================

function getBenefitStatus(
  employee,
  benefit,
  globalLunchEnabled
) {
  let applicable = true;
  let enabled = false;
  let eligible = false;
  let configuredAmount = 0;
  let postedAmount = null;

  // LUNCH

  if (benefit === "LUNCH") {
    enabled =
      globalLunchEnabled &&
      employee.lunch_enabled === true;

    eligible =
      employee.lunch_eligible === true;

    configuredAmount = Number(
      employee.lunch_amount ?? 0
    );

    postedAmount =
      employee.lunch_posted_amount;
  }

  // SUPPER

  else if (benefit === "SUPPER") {
    // Supper remains OFF until launch.
    applicable = false;

    enabled = false;

    configuredAmount = Number(
      employee.supper_amount ?? 0
    );

    postedAmount =
      employee.supper_posted_amount;
  }

  // BONUS

  else if (benefit === "BONUS") {
    const weekday = getWeekday(
      employee.duty_date
    );

    if (weekday === 1) {
      enabled =
        employee.monday_enabled === true;

      eligible =
        employee.monday_bonus_eligible === true;

      configuredAmount = Number(
        employee.monday_bonus ?? 0
      );

      postedAmount =
        employee.monday_posted_amount;
    }

    else if (weekday === 5) {
      enabled =
        employee.friday_enabled === true;

      eligible =
        employee.friday_bonus_eligible === true;

      configuredAmount = Number(
        employee.friday_bonus ?? 0
      );

      postedAmount =
        employee.friday_posted_amount;
    }

    else {
      applicable = false;
    }
  }

  // CONFIRMED EXPENSE — LIGHT MINT GREEN

  if (
    postedAmount !== null &&
    postedAmount !== undefined &&
    postedAmount !== ""
  ) {
    return {
      type: "confirmed",
      icon: "✓",
      amount: money(postedAmount),
      description:
        "Accepted and posted to Expenses",
    };
  }

  // DISABLED / NOT APPLICABLE — NAVY

  if (
    !applicable ||
    !enabled ||
    !Number.isFinite(configuredAmount) ||
    configuredAmount <= 0
  ) {
    return {
      type: "normal",
      icon: "",
      amount: "0",
      description:
        "Disabled or not applicable",
    };
  }

  // ELIGIBLE, NOT YET POSTED — NAVY

  if (eligible) {
    return {
      type: "normal",
      icon: "",
      amount: money(configuredAmount),
      description:
        "Eligible, but not yet confirmed in Expenses",
    };
  }

  // DISQUALIFIED — RED

  const attendance = String(
    employee.attendance_status || ""
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

// ==========================================================
// EXECUTIVE LED BUTTON
// ==========================================================

function BenefitButton({
  label,
  status,
}) {
  return (
    <span
      className={
        `tl-executive-button tl-executive-${status.type}`
      }
      title={
        `${label}: ${status.description}`
      }
      aria-label={
        `${label} ${status.amount}. ${status.description}`
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

// ==========================================================
// MAIN CASHIER MEALS & BONUS PANEL
// ==========================================================

export default function CashierMealsRotaPanel({
  user,
  currentShift,
}) {
  const [employees, setEmployees] =
    useState([]);

  const [
    globalLunchEnabled,
    setGlobalLunchEnabled,
  ] = useState(true);

  const [error, setError] =
    useState("");

  const requestIdRef = useRef(0);

  const supabaseUrl = String(
    process.env.NEXT_PUBLIC_SUPABASE_URL || ""
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
    ).trim().toUpperCase() === "OPEN";

  // ========================================================
  // LOAD REAL AWARD STATUS
  // ========================================================

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

      const requestId =
        ++requestIdRef.current;

      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/rpc/tl_meals_bonus_strip_snapshot`,
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
          requestId !== requestIdRef.current
        ) {
          return;
        }

        setEmployees(
          result.employees
        );

        setGlobalLunchEnabled(
          result.global_lunch_enabled === true
        );

        setError("");
      }

      catch (err) {
        if (
          signal.aborted ||
          requestId !== requestIdRef.current
        ) {
          return;
        }

        console.error(
          "TEAM LEGEND MEALS ERROR:",
          err
        );

        setEmployees([]);

        setError(
          err?.message ||
          "Meals & Bonuses unavailable."
        );
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

  // ========================================================
  // AUTOMATIC REFRESH EVERY 30 SECONDS
  // ========================================================

  useEffect(() => {
    const controller =
      new AbortController();

    requestIdRef.current += 1;

    setEmployees([]);
    setError("");

    if (isShiftOpen) {
      void loadMeals(controller.signal);
    }

    const timer = setInterval(() => {
      if (
        isShiftOpen &&
        document.visibilityState === "visible"
      ) {
        void loadMeals(controller.signal);
      }
    }, REFRESH_MS);

    return () => {
      controller.abort();

      clearInterval(timer);

      requestIdRef.current += 1;
    };
  }, [
    isShiftOpen,
    loadMeals,
  ]);

  // ========================================================
  // HIDE WHEN THERE IS NO OPEN SHIFT
  // ========================================================

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

  // ========================================================
  // EXECUTIVE LED LIGHT MINT DESIGN
  // ========================================================

  return (
    <section
      className="tl-executive-meals"
      aria-label="Employee Meals and Bonuses"
    >
      <style>{`

        /* ====================================== */
        /* MAIN NAVY CONTAINER                    */
        /* ====================================== */

        .tl-executive-meals {
          margin: 6px 12px 0;
          width: auto;
          min-width: 0;
          box-sizing: border-box;
          color: #FFFFFF;
          font-family: inherit;
        }

        .tl-executive-meals .tl-executive-board {
          width: 100%;
          background: #101F30;
          border: 1px solid #29475E;
          border-left: 3px solid #D9B66C;
          border-radius: 9px;
          overflow-x: auto;
          scrollbar-width: thin;
          box-sizing: border-box;
        }

        /* ====================================== */
        /* EMPLOYEE ROW                           */
        /* ====================================== */

        .tl-executive-meals .tl-executive-row {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 14px;

          min-width: 690px;
          min-height: 49px;

          padding: 7px 13px;
          box-sizing: border-box;
        }

        .tl-executive-meals .tl-executive-row
        + .tl-executive-row {
          border-top: 1px solid #2D465B;
        }

        .tl-executive-meals .tl-executive-row:hover {
          background: rgba(
            255, 255, 255, 0.025
          );
        }

        /* ====================================== */
        /* FULL EMPLOYEE NAME                     */
        /* ====================================== */

        .tl-executive-meals .tl-executive-name {
          flex: 0 0 205px;
          color: #FFFFFF;
          font-size: 12px;
          font-weight: 850;
          line-height: 1.3;
          letter-spacing: 0.025em;
          overflow-wrap: anywhere;
        }

        /* ====================================== */
        /* GROUP THE THREE BENEFITS               */
        /* ====================================== */

        .tl-executive-meals .tl-executive-buttons {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 10px;
          flex: 0 0 auto;
        }

        /* ====================================== */
        /* DEFAULT NAVY BUTTON                    */
        /* ====================================== */

        .tl-executive-meals .tl-executive-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;

          width: 143px;
          min-height: 36px;

          padding: 5px 10px;
          box-sizing: border-box;

          border-radius: 7px;
          border: 1px solid #55768F;

          background:
            linear-gradient(
              135deg,
              #284B66 0%,
              #1D3751 100%
            );

          color: #FFFFFF;
          white-space: nowrap;

          font-variant-numeric: tabular-nums;
          box-shadow:
            inset 0 1px 0
              rgba(255,255,255,0.14),
            0 3px 8px
              rgba(0,0,0,0.13);

          user-select: none;
          cursor: default;
        }

        .tl-executive-meals .tl-executive-label {
          color: inherit;
          font-size: 11px;
          font-weight: 850;
          letter-spacing: 0.035em;
        }

        .tl-executive-meals .tl-executive-amount {
          color: inherit;
          font-size: 13px;
          font-weight: 950;
          letter-spacing: 0;
        }

        /* ====================================== */
        /* STATUS TICK / CROSS                    */
        /* ====================================== */

        .tl-executive-meals .tl-executive-check {
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

          color: #FFFFFF;
        }

        /* ====================================== */
        /* LIGHT MINT GREEN — CONFIRMED           */
        /* ====================================== */

        .tl-executive-meals
        .tl-executive-confirmed {
          background:
            linear-gradient(
              135deg,
              #AEF8D6 0%,
              #73E5B9 100%
            );

          border-color: #C8FFE6;

          color: #07392F;

          box-shadow:
            inset 0 1px 0
              rgba(255,255,255,0.55),
            0 0 12px
              rgba(114,233,184,0.26);
        }

        .tl-executive-meals
        .tl-executive-confirmed
        .tl-executive-check {
          background: #087C67;
          color: #FFFFFF;
        }

        /* ====================================== */
        /* RED — DISQUALIFIED                     */
        /* ====================================== */

        .tl-executive-meals
        .tl-executive-rejected {
          background:
            linear-gradient(
              135deg,
              #C45469 0%,
              #97374F 100%
            );

          border-color: #FFA1B0;

          color: #FFFFFF;

          box-shadow:
            inset 0 1px 0
              rgba(255,255,255,0.17);
        }

        .tl-executive-meals
        .tl-executive-rejected
        .tl-executive-check {
          background: rgba(
            255,255,255,0.18
          );
          color: #FFFFFF;
        }

        /* ====================================== */
        /* ERROR MESSAGE                         */
        /* ====================================== */

        .tl-executive-meals .tl-executive-error {
          padding: 6px 3px;
          font-size: 11px;
          font-weight: 650;
          color: #FF95A4;
        }

        /* ====================================== */
        /* MOBILE                                */
        /* ====================================== */

        @media (max-width: 650px) {
          .tl-executive-meals {
            margin: 5px 8px 0;
          }

          .tl-executive-meals .tl-executive-row {
            min-width: 650px;
            min-height: 45px;
            padding: 6px 9px;
            gap: 9px;
          }

          .tl-executive-meals .tl-executive-name {
            flex-basis: 180px;
            font-size: 11px;
          }

          .tl-executive-meals .tl-executive-buttons {
            gap: 7px;
          }

          .tl-executive-meals .tl-executive-button {
            width: 140px;
            min-height: 34px;
            padding: 4px 7px;
          }
        }

      `}</style>

      {employees.length > 0 && (
        <div className="tl-executive-board">

          {employees.map((employee) => {

            const lunch =
              getBenefitStatus(
                employee,
                "LUNCH",
                globalLunchEnabled
              );

            const supper =
              getBenefitStatus(
                employee,
                "SUPPER",
                globalLunchEnabled
              );

            const bonus =
              getBenefitStatus(
                employee,
                "BONUS",
                globalLunchEnabled
              );

            return (
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
                    status={lunch}
                  />

                  <BenefitButton
                    label="SUPPER"
                    status={supper}
                  />

                  <BenefitButton
                    label="BONUS"
                    status={bonus}
                  />

                </div>

              </div>
            );
          })}

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
