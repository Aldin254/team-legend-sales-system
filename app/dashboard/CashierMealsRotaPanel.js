"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

// TEAM LEGEND
// Meals & Bonuses — read-only Duty Rota strip.
// Uses existing SHIFT SIGN-IN.
// No second Sign In button.
// No expense posting in this component.

function money(value) {
  const amount = Number(value);

  return Number.isFinite(amount) &&
    amount > 0
    ? amount.toLocaleString("en-KE", {
        maximumFractionDigits: 2,
      })
    : "0";
}

function eligibleBonus(row) {
  const day = String(
    row?.duty_date || ""
  ).slice(0, 10);

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(day)
  ) {
    return 0;
  }

  const weekday = new Date(
    `${day}T12:00:00Z`
  ).getUTCDay();

  if (
    weekday === 1 &&
    row.monday_bonus_eligible === true
  ) {
    return row.monday_bonus;
  }

  if (
    weekday === 5 &&
    row.friday_bonus_eligible === true
  ) {
    return row.friday_bonus;
  }

  return 0;
}

export default function CashierMealsRotaPanel({
  user,
  currentShift,
}) {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  const shiftId = currentShift?.id || "";

  const isOpen =
    String(
      currentShift?.status || ""
    ).toUpperCase() === "OPEN";

  const url = String(
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
      ""
  ).replace(/\/+$/, "");

  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";

  const token = user?.access_token || "";

  const load = useCallback(
    async (signal) => {
      if (
        !shiftId ||
        !isOpen ||
        !url ||
        !key ||
        !token
      ) {
        return;
      }

      try {
        const response = await fetch(
          `${url}/rest/v1/rpc/tl_meals_rota_duty_snapshot`,
          {
            method: "POST",
            cache: "no-store",
            headers: {
              apikey: key,
              Authorization: `Bearer ${token}`,
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
              "Unable to load Meals & Bonuses."
          );
        }

        if (!signal?.aborted) {
          setRows(result.employees);
          setError("");
        }
      } catch (err) {
        if (signal?.aborted) return;

        console.error(
          "Meals / Bonus Duty Rota:",
          err
        );

        setRows([]);

        setError(
          err?.message ||
            "Meals & Bonuses unavailable."
        );
      }
    },
    [
      shiftId,
      isOpen,
      url,
      key,
      token,
    ]
  );

  useEffect(() => {
    const controller =
      new AbortController();

    setRows([]);
    setError("");

    if (isOpen) {
      void load(controller.signal);
    }

    const interval = setInterval(
      () => {
        if (
          document.visibilityState ===
          "visible"
        ) {
          void load(controller.signal);
        }
      },
      30000
    );

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [load, isOpen]);

  if (
    !shiftId ||
    !isOpen ||
    (!rows.length && !error)
  ) {
    return null;
  }

  return (
    <div className="tl-meals-strip">
      <style>{`
        .tl-meals-strip {
          margin: 5px 12px 0;
          color: #f0f5fa;
          font-family: inherit;
        }

        .tl-meals-lines {
          border: 1px solid #2b4558;
          border-left: 3px solid #d9b66c;
          border-radius: 7px;
          background: #0e2230;
          overflow-x: auto;
        }

        .tl-meals-line {
          display: grid;
          grid-template-columns:
            minmax(190px, 2fr)
            repeat(3, minmax(90px, 1fr));
          align-items: center;
          gap: 12px;
          padding: 7px 12px;
          min-height: 33px;
          font-size: 12px;
          white-space: nowrap;
        }

        .tl-meals-line +
        .tl-meals-line {
          border-top: 1px solid #294052;
        }

        .tl-meals-name {
          font-weight: 850;
          color: #f0f5fa;
        }

        .tl-meals-value {
          color: #bfceda;
          display: flex;
          gap: 7px;
          align-items: center;
        }

        .tl-meals-value strong {
          color: #d9b66c;
          font-weight: 850;
          font-variant-numeric:
            tabular-nums;
        }

        .tl-meals-error {
          color: #fb8b96;
          padding: 5px 0;
          font-size: 11px;
        }

        @media (max-width: 640px) {
          .tl-meals-strip {
            margin-left: 8px;
            margin-right: 8px;
          }

          .tl-meals-line {
            grid-template-columns:
              minmax(165px, 2fr)
              repeat(3, minmax(85px, 1fr));
            gap: 10px;
            font-size: 11px;
            padding: 6px 9px;
          }
        }
      `}</style>

      {rows.length > 0 && (
        <div className="tl-meals-lines">
          {rows.map((row) => (
            <div
              className="tl-meals-line"
              key={row.employee_id}
            >
              <span className="tl-meals-name">
                {row.full_name}
              </span>

              <span className="tl-meals-value">
                Lunch{" "}
                <strong>
                  {money(
                    row.lunch_eligible
                      ? row.lunch_amount
                      : 0
                  )}
                </strong>
              </span>

              <span className="tl-meals-value">
                Supper{" "}
                <strong>
                  {money(
                    row.supper_eligible
                      ? row.supper_amount
                      : 0
                  )}
                </strong>
              </span>

              <span className="tl-meals-value">
                Bonus{" "}
                <strong>
                  {money(
                    eligibleBonus(row)
                  )}
                </strong>
              </span>
            </div>
          ))}
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
    </div>
  );
}
