"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

// ============================================================
// TEAM LEGEND / NYIKA
// CASHIER MEALS & BONUSES — EXECUTIVE LED DESIGN 2
// ============================================================
//
// ✓ LAGOON GREEN = Award confirmed in Expenses.
// ✕ RED          = Employee not qualified.
// — GREY         = Disabled or not applicable.
// … SLATE        = Qualified but expense not posted.
//
// Uses existing Master Employee Duty Rota.
// Uses existing shift sign-in.
// No additional employee sign-in.
// No expense inserts or financial modifications.
// No changes to Salary shop routing.
// Full Master Employee names.
//
// RPC:
// tl_meals_bonus_strip_snapshot(p_shift_id)
//
// ============================================================

const REFRESH_INTERVAL = 30000;

// ============================================================
// MONEY FORMAT
// ============================================================

function money(value) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    return "0";
  }

  return number.toLocaleString("en-KE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

// ============================================================
// BUSINESS DATE / WEEKDAY
// ============================================================

function weekdayFromDate(value) {
  const date = String(value || "").slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return -1;
  }

  return new Date(
    `${date}T12:00:00Z`
  ).getUTCDay();
}

// ============================================================
// STATUS HELPERS
// ============================================================

function confirmedStatus(postedAmount) {
  return {
    kind: "confirmed",
    symbol: "✓",
    amount: money(postedAmount),
    description: "Confirmed and posted to Expenses",
  };
}

function rejectedStatus(reason) {
  return {
    kind: "rejected",
    symbol: "✕",
    amount: "0",
    description: reason || "Not qualified",
  };
}

function disabledStatus(reason) {
  return {
    kind: "disabled",
    symbol: "—",
    amount: "0",
    description: reason || "Not applicable",
  };
}

function pendingStatus(amount) {
  return {
    kind: "pending",
    symbol: "…",
    amount: money(amount),
    description:
      "Qualified; automatic expense not yet confirmed",
  };
}

function isPosted(value) {
  return (
    value !== null &&
    value !== undefined &&
    value !== ""
  );
}

function disqualificationReason(row) {
  const status = String(
    row?.attendance_status || ""
  ).toUpperCase();

  if (status === "LATE") {
    return "Not qualified — shift opened after 10:50 AM";
  }

  if (status === "NOT_SIGNED_IN") {
    return "Not qualified — shift sign-in missing";
  }

  return "Not qualified under current Duty Rota rules";
}

// ============================================================
// BENEFIT STATUS
// ============================================================

function getBenefitStatus(
  row,
  benefit,
  globalLunchEnabled
) {
  const day = weekdayFromDate(row?.duty_date);

  let applicable = true;
  let enabled = false;
  let eligible = false;

  let configuredAmount = 0;
  let postedAmount = null;

  // ----------------------------------------------------------
  // LUNCH
  // ----------------------------------------------------------

  if (benefit === "LUNCH") {
    enabled =
      globalLunchEnabled &&
      row.lunch_enabled === true;

    configuredAmount = Number(
      row.lunch_amount || 0
    );

    eligible =
      row.lunch_eligible === true;

    postedAmount =
      row.lunch_posted_amount;
  }

  // ----------------------------------------------------------
  // SUPPER
  // ----------------------------------------------------------

  else if (benefit === "SUPPER") {
    // Supper remains globally OFF.
    applicable = false;

    enabled = false;

    configuredAmount = Number(
      row.supper_amount || 0
    );

    postedAmount =
      row.supper_posted_amount;
  }

  // ----------------------------------------------------------
  // MONDAY / FRIDAY BONUS
  // ----------------------------------------------------------

  else if (benefit === "BONUS") {
    if (day === 1) {
      enabled =
        row.monday_enabled === true;

      configuredAmount = Number(
        row.monday_bonus || 0
      );

      eligible =
        row.monday_bonus_eligible === true;

      postedAmount =
        row.monday_posted_amount;
    }

    else if (day === 5) {
      enabled =
        row.friday_enabled === true;

      configuredAmount = Number(
        row.friday_bonus || 0
      );

      eligible =
        row.friday_bonus_eligible === true;

      postedAmount =
        row.friday_posted_amount;
    }

    else {
      applicable = false;
      enabled = false;
    }
  }

  // ----------------------------------------------------------
  // 1. CONFIRMED EXPENSE
  // ----------------------------------------------------------
  // Existing posted expenses remain confirmed even if
  // Admin subsequently changes the benefit setting.

  if (isPosted(postedAmount)) {
    return confirmedStatus(postedAmount);
  }

  // ----------------------------------------------------------
  // 2. DISABLED OR NON-APPLICABLE
  // ----------------------------------------------------------

  if (!applicable) {
    return disabledStatus(
      benefit === "SUPPER"
        ? "Supper currently disabled"
        : "Bonus not scheduled for this day"
    );
  }

  if (!enabled) {
    return disabledStatus(
      "Benefit disabled in Admin settings"
    );
  }

  if (
    !Number.isFinite(configuredAmount) ||
    configuredAmount <= 0
  ) {
    return disabledStatus(
      "No benefit amount configured"
    );
  }

  // ----------------------------------------------------------
  // 3. QUALIFIED BUT NOT POSTED
  // ----------------------------------------------------------

  if (eligible) {
    return pendingStatus(configuredAmount);
  }

  // ----------------------------------------------------------
  // 4. NOT QUALIFIED
  // ----------------------------------------------------------

  return rejectedStatus(
    disqualificationReason(row)
  );
}

// ============================================================
// EXECUTIVE LED STATUS CAPSULE
// ============================================================

function BenefitLED({
  label,
  status,
}) {
  return (
    <span
      className={
        `tl-benefit-led tl-benefit-led-${status.kind}`
      }
      title={
        `${label}: ${status.description}`
      }
      aria-label={
        `${label} ${status.amount}. ` +
        status.description
      }
    >
      <span
        className="tl-benefit-led-symbol"
        aria-hidden="true"
      >
        {status.symbol}
      </span>

      <span className="tl-benefit-led-label">
        {label}
      </span>

      <strong className="tl-benefit-led-number">
        {status.amount}
      </strong>
    </span>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function CashierMealsRotaPanel({
  user,
  currentShift,
}) {
  const [employees, setEmployees] = useState([]);

  const [
    globalLunchEnabled,
    setGlobalLunchEnabled,
  ] = useState(true);

  const [error, setError] = useState("");

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

  // ==========================================================
  // LOAD MEALS & BONUS SNAPSHOT
  // ==========================================================

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
          !Array.isArray(result?.employees)
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

        setEmployees(result.employees);

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
          "TEAM LEGEND MEALS & BONUS ERROR:",
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

  // ==========================================================
  // AUTOMATIC REFRESH
  // ==========================================================

  useEffect(() => {
    const controller =
      new AbortController();

    requestIdRef.current += 1;

    setEmployees([]);
    setError("");

    if (!isShiftOpen || !shiftId) {
      return () => {
        controller.abort();
        requestIdRef.current += 1;
      };
    }

    void loadMeals(controller.signal);

    const interval = setInterval(() => {
      if (
        document.visibilityState === "visible"
      ) {
        void loadMeals(controller.signal);
      }
    }, REFRESH_INTERVAL);

    return () => {
      controller.abort();

      clearInterval(interval);

      requestIdRef.current += 1;
    };
  }, [
    shiftId,
    isShiftOpen,
    loadMeals,
  ]);

  // ==========================================================
  // HIDE IF NO OPEN SHIFT
  // ==========================================================

  if (
    !shiftId ||
    !isShiftOpen ||
    !supabaseUrl ||
    !supabaseAnonKey ||
    !accessToken
  ) {
    return null;
  }

  if (!employees.length && !error) {
    return null;
  }

  // ==========================================================
  // EXECUTIVE LED DESIGN 2
  // ==========================================================

  return (
    <section className="tl-meals-executive">

      <style>{`

        /* ===================================== */
        /* MAIN SLIM STRIP                       */
        /* ===================================== */

        .tl-meals-executive {
          width: auto;
          min-width: 0;

          margin: 5px 12px 0;

          color: #F0F5FA;

          font-family: inherit;

          box-sizing: border-box;
        }

        .tl-meals-executive .tl-meals-board {
          width: 100%;

          background: #0D1E2E;

          border: 1px solid #2B4558;
          border-left: 3px solid #D9B66C;

          border-radius: 8px;

          overflow-x: auto;

          scrollbar-width: thin;

          box-sizing: border-box;
        }

        /* ===================================== */
        /* EMPLOYEE ROW                          */
        /* ===================================== */

        .tl-meals-executive .tl-meals-row {
          display: grid;

          grid-template-columns:
            minmax(175px, 1.8fr)
            repeat(3, minmax(115px, 1fr));

          align-items: center;

          gap: 10px;

          padding: 6px 12px;

          min-height: 36px;

          box-sizing: border-box;
        }

        .tl-meals-executive .tl-meals-row
        + .tl-meals-row {
          border-top: 1px solid #283F52;
        }

        .tl-meals-executive .tl-meals-row:hover {
          background: rgba(
            255,255,255,0.018
          );
        }

        /* ===================================== */
        /* FULL EMPLOYEE NAME                    */
        /* ===================================== */

        .tl-meals-executive .tl-meals-name {
          color: #FFFFFF;

          font-size: 12px;

          font-weight: 850;

          letter-spacing: 0.025em;

          line-height: 1.35;

          overflow-wrap: anywhere;
        }

        /* ===================================== */
        /* EXECUTIVE LED BUTTON                  */
        /* ===================================== */

        .tl-meals-executive .tl-benefit-led {
          display: inline-flex;

          align-items: center;
          justify-content: center;

          gap: 6px;

          min-width: 110px;

          width: fit-content;

          min-height: 28px;

          padding: 5px 10px;

          box-sizing: border-box;

          border-radius: 6px;

          border: 1px solid transparent;

          white-space: nowrap;

          font-size: 10px;

          line-height: 1.2;

          letter-spacing: 0.035em;

          font-weight: 800;

          cursor: default;

          user-select: none;

          font-variant-numeric:
            tabular-nums;

          box-shadow:
            inset 0 1px 0
            rgba(255,255,255,0.13);

          transition:
            background 0.2s ease,
            border-color 0.2s ease,
            box-shadow 0.2s ease;
        }

        .tl-meals-executive
        .tl-benefit-led-symbol {
          display: inline-flex;

          align-items: center;
          justify-content: center;

          font-size: 15px;

          font-weight: 950;

          line-height: 1;

          color: #FFFFFF;
        }

        .tl-meals-executive
        .tl-benefit-led-label {
          font-size: 10px;

          font-weight: 850;

          color: #FFFFFF;

          letter-spacing: 0.045em;
        }

        .tl-meals-executive
        .tl-benefit-led-number {
          font-size: 12px;

          font-weight: 950;

          color: #FFFFFF;

          letter-spacing: 0;

          font-variant-numeric:
            tabular-nums;
        }

        /* ===================================== */
        /* LAGOON GREEN — CONFIRMED              */
        /* ===================================== */

        .tl-meals-executive
        .tl-benefit-led-confirmed {
          background:
            linear-gradient(
              135deg,
              #087C76 0%,
              #095E5C 100%
            );

          border-color: #39E9CB;

          box-shadow:
            inset 0 1px 0
              rgba(255,255,255,0.22),

            0 0 9px
              rgba(32,201,177,0.22);
        }

        /* Subtle premium LED glow */

        @keyframes tlLagoonGlow {
          0%, 100% {
            box-shadow:
              inset 0 1px 0
                rgba(255,255,255,0.22),
              0 0 5px
                rgba(32,201,177,0.12);
          }

          50% {
            box-shadow:
              inset 0 1px 0
                rgba(255,255,255,0.22),
              0 0 12px
                rgba(32,201,177,0.34);
          }
        }

        .tl-meals-executive
        .tl-benefit-led-confirmed {
          animation:
            tlLagoonGlow 7s ease-in-out infinite;
        }

        /* ===================================== */
        /* ELEGANT RED — DISQUALIFIED            */
        /* ===================================== */

        .tl-meals-executive
        .tl-benefit-led-rejected {
          background:
            linear-gradient(
              135deg,
              #933A4D 0%,
              #682938 100%
            );

          border-color: #FA92A0;

          box-shadow:
            inset 0 1px 0
              rgba(255,255,255,0.11);
        }

        /* ===================================== */
        /* MUTED GREY — DISABLED                 */
        /* ===================================== */

        .tl-meals-executive
        .tl-benefit-led-disabled {
          background: #243345;

          border-color: #536273;

          opacity: 0.75;
        }

        /* ===================================== */
        /* SLATE — QUALIFIED / NOT POSTED        */
        /* ===================================== */

        .tl-meals-executive
        .tl-benefit-led-pending {
          background:
            linear-gradient(
              135deg,
              #344659,
              #263849
            );

          border-color: #8293A6;
        }

        /* ===================================== */
        /* ERROR DISPLAY                        */
        /* ===================================== */

        .tl-meals-executive .tl-meals-error {
          font-size: 11px;

          font-weight: 600;

          color: #FB8B96;

          padding: 6px 3px;
        }

        /* ===================================== */
        /* ACCESSIBILITY                        */
        /* ===================================== */

        @media (
          prefers-reduced-motion: reduce
        ) {
          .tl-meals-executive
          .tl-benefit-led {
            animation: none !important;
            transition: none !important;
          }
        }

        /* ===================================== */
        /* SMALL SCREENS                         */
        /* ===================================== */

        @media (max-width: 650px) {

          .tl-meals-executive {
            margin: 5px 8px 0;
          }

          .tl-meals-executive
          .tl-meals-row {
            grid-template-columns:
              minmax(155px, 1.6fr)
              repeat(3, minmax(108px, 1fr));

            gap: 8px;

            padding: 5px 9px;
          }

          .tl-meals-executive
          .tl-meals-name {
            font-size: 11px;
          }

          .tl-meals-executive
          .tl-benefit-led {
            min-width: 103px;

            padding: 5px 7px;

            min-height: 27px;
          }

        }

      `}</style>

      {employees.length > 0 && (
        <div className="tl-meals-board">

          {employees.map((employee) => {

            const lunchStatus =
              getBenefitStatus(
                employee,
                "LUNCH",
                globalLunchEnabled
              );

            const supperStatus =
              getBenefitStatus(
                employee,
                "SUPPER",
                globalLunchEnabled
              );

            const bonusStatus =
              getBenefitStatus(
                employee,
                "BONUS",
                globalLunchEnabled
              );

            return (
              <div
                className="tl-meals-row"
                key={employee.employee_id}
              >

                {/* FULL MASTER EMPLOYEE NAME */}

                <span className="tl-meals-name">
                  {employee.full_name}
                </span>

                {/* LUNCH */}

                <BenefitLED
                  label="LUNCH"
                  status={lunchStatus}
                />

                {/* SUPPER */}

                <BenefitLED
                  label="SUPPER"
                  status={supperStatus}
                />

                {/* MONDAY / FRIDAY BONUS */}

                <BenefitLED
                  label="BONUS"
                  status={bonusStatus}
                />

              </div>
            );
          })}

        </div>
      )}

      {error && (
        <div
          className="tl-meals-error"
          role="alert"
        >
          {error}
        </div>
      )}

    </section>
  );
}
