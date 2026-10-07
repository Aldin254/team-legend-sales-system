"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

const COLORS = {
  black: "#111111",
  black2: "#181818",
  black3: "#222222",
  border: "#343434",
  white: "#ffffff",
  muted: "#b8b8b8",

  green: "#22c55e",
  greenBg: "#102b1a",

  red: "#ef4444",
  redBg: "#321414",

  blue: "#3b82f6",
  blueBg: "#10213b",

  amber: "#f59e0b",
  amberBg: "#33250c",
};

function money(value) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function cleanTime(value) {
  if (!value) return "—";

  const text = String(value);

  return text.length >= 5
    ? text.slice(0, 5)
    : text;
}

function statusStyle(status) {
  if (status === "ON_TIME") {
    return {
      background: COLORS.greenBg,
      color: COLORS.green,
      border: COLORS.green,
    };
  }

  if (status === "LATE") {
    return {
      background: COLORS.redBg,
      color: "#ff6b6b",
      border: COLORS.red,
    };
  }

  if (status === "EXEMPT") {
    return {
      background: COLORS.blueBg,
      color: "#60a5fa",
      border: COLORS.blue,
    };
  }

  return {
    background: COLORS.amberBg,
    color: "#fbbf24",
    border: COLORS.amber,
  };
}

function StatusBadge({ status }) {
  const c = statusStyle(status);

  const label =
    status === "ON_TIME"
      ? "ON TIME"
      : status === "LATE"
      ? "LATE"
      : status === "EXEMPT"
      ? "EXEMPT"
      : "NOT SIGNED IN";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "999px",
        padding: "8px 15px",
        fontSize: "14px",
        fontWeight: 950,
        background: c.background,
        color: c.color,
        border: `1px solid ${c.border}`,
        whiteSpace: "nowrap",
        letterSpacing: "0.4px",
      }}
    >
      {label}
    </span>
  );
}

function BenefitBox({
  label,
  rate,
  eligible,
  signedIn,
}) {
  let value = "Pending sign-in";
  let background = COLORS.black3;
  let color = "#fbbf24";
  let border = "#454545";

  if (signedIn) {
    if (eligible && Number(rate || 0) > 0) {
      value = `${money(rate)} ✓`;
      background = COLORS.greenBg;
      color = "#4ade80";
      border = "#166534";
    } else {
      value = "KES 0";
      background = COLORS.redBg;
      color = "#ff6b6b";
      border = "#7f1d1d";
    }
  }

  return (
    <div
      style={{
        border: `1px solid ${border}`,
        borderRadius: "12px",
        padding: "14px 16px",
        background,
        minHeight: "72px",
      }}
    >
      <div
        style={{
          fontSize: "13px",
          fontWeight: 950,
          color: "#cfcfcf",
          textTransform: "uppercase",
          letterSpacing: "0.8px",
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "7px",
          fontSize: "17px",
          fontWeight: 950,
          color,
        }}
      >
        {value}
      </div>
    </div>
  );
}

export default function CashierAttendancePanel({
  user,
  currentShift,
}) {
  const [snapshot, setSnapshot] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [signingId, setSigningId] =
    useState(null);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const accessToken =
    user?.access_token || null;

  const apiBase = useMemo(
    () =>
      String(supabaseUrl || "").replace(
        /\/+$/,
        ""
      ),
    [supabaseUrl]
  );
  const rpc = useCallback(
    async (name, body = {}) => {
      if (
        !apiBase ||
        !supabaseAnonKey ||
        !accessToken
      ) {
        throw new Error(
          "Missing Supabase connection details."
        );
      }

      const response = await fetch(
        `${apiBase}/rest/v1/rpc/${name}`,
        {
          method: "POST",
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${accessToken}`,
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(body),
        }
      );

      let result = null;

      try {
        result = await response.json();
      } catch {
        result = null;
      }

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
    [
      apiBase,
      supabaseAnonKey,
      accessToken,
    ]
  );

  const loadAttendance =
    useCallback(async () => {
      if (
        !apiBase ||
        !supabaseAnonKey ||
        !accessToken
      ) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const result = await rpc(
          "tl_cashier_today_duty_snapshot",
          {}
        );

        setSnapshot(result || null);
      } catch (err) {
        setError(
          err?.message ||
            "Unable to load today's duty list."
        );
      } finally {
        setLoading(false);
      }
    }, [
      apiBase,
      supabaseAnonKey,
      accessToken,
      rpc,
    ]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const employees = Array.isArray(
    snapshot?.employees
  )
    ? snapshot.employees
    : [];

  async function signIn(employee) {
    if (!employee?.employee_id) return;

    const confirmed = window.confirm(
      `Sign in ${employee.employee_name} now?\n\n` +
        `The first sign-in time is recorded using Nairobi server time and cannot be changed by the cashier.`
    );

    if (!confirmed) return;

    setSigningId(employee.employee_id);
    setMessage("");
    setError("");

    try {
      const result = await rpc(
        "tl_attendance_sign_in",
        {
          p_employee_id:
            employee.employee_id,
        }
      );

      if (result?.already_signed_in) {
        setMessage(
          `${employee.employee_name} was already signed in at ${cleanTime(
            result.first_signin_local_time
          )}.`
        );
      } else {
        const status =
          result?.attendance_status ===
          "ON_TIME"
            ? "ON TIME"
            : result?.attendance_status ===
              "LATE"
            ? "LATE"
            : result?.attendance_status ===
              "EXEMPT"
            ? "EXEMPT"
            : result?.attendance_status ||
              "SIGNED IN";

        setMessage(
          `${employee.employee_name} signed in successfully at ${cleanTime(
            result?.first_signin_local_time
          )} — ${status}.`
        );
      }

      await loadAttendance();
    } catch (err) {
      const raw =
        err?.message ||
        "Unable to sign employee in.";

      let friendly = raw;

      if (
        raw.includes(
          "EMPLOYEE_NOT_ASSIGNED_TO_THIS_SHOP"
        )
      ) {
        friendly =
          "This employee is not assigned to this shop today.";
      }

      if (
        raw.includes(
          "EMPLOYEE_NOT_ON_DUTY"
        )
      ) {
        friendly =
          "This employee is OFF duty today and cannot sign in.";
      }

      if (
        raw.includes(
          "CASHIER_HAS_NO_SHOP"
        )
      ) {
        friendly =
          "This cashier account is not attached to a shop.";
      }

      setError(friendly);
    } finally {
      setSigningId(null);
    }
  }

  if (
    !apiBase ||
    !supabaseAnonKey ||
    !accessToken
  ) {
    return null;
  }

  return (
    <section
      style={{
        background: COLORS.black,
        border: `1px solid ${COLORS.border}`,
        borderRadius: "16px",
        overflow: "hidden",
        margin: "14px 12px 18px",
        boxShadow:
          "0 10px 30px rgba(0,0,0,0.32)",
        color: COLORS.white,
      }}
    >
      <div
        style={{
          padding: "20px 22px",
          background: "#0d0d0d",
          borderBottom:
            `1px solid ${COLORS.border}`,
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
          gap: "14px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "24px",
              fontWeight: 950,
              color: COLORS.white,
              letterSpacing: "0.2px",
            }}
          >
            Today&apos;s Duty / Sign In
          </div>

          <div
            style={{
              marginTop: "6px",
              fontSize: "14px",
              color: COLORS.muted,
              fontWeight: 700,
            }}
          >
            Nairobi Server Time • Cutoff
            10:50 AM • First sign-in is
            permanent
          </div>
        </div>

        <button
          type="button"
          onClick={loadAttendance}
          disabled={loading}
          style={{
            border:
              "1px solid #525252",
            background: "#202020",
            color: "#ffffff",
            borderRadius: "10px",
            padding: "11px 16px",
            fontWeight: 900,
            fontSize: "14px",
            cursor: loading
              ? "not-allowed"
              : "pointer",
          }}
        >
          {loading
            ? "Refreshing..."
            : "Refresh"}
        </button>
      </div>

      {snapshot ? (
        <div
          style={{
            padding: "13px 22px",
            background: COLORS.black2,
            borderBottom:
              `1px solid ${COLORS.border}`,
            display: "flex",
            gap: "24px",
            flexWrap: "wrap",
            fontSize: "14px",
            color: "#d4d4d4",
          }}
        >
          <span>
            <strong>Shop:</strong>{" "}
            {snapshot.shop_name || "—"}
          </span>

          <span>
            <strong>Date:</strong>{" "}
            {snapshot.server_date || "—"}
          </span>

          <span>
            <strong>Week:</strong>{" "}
            {snapshot.cycle_week || "—"}
          </span>

          <span>
            <strong>Day:</strong>{" "}
            {snapshot.cycle_day || "—"}
          </span>

          <span>
            <strong>Employees:</strong>{" "}
            {snapshot.employee_count ?? 0}
          </span>
        </div>
      ) : null}
{message ? (
        <div
          style={{
            margin: "14px 18px 0",
            padding: "13px 15px",
            borderRadius: "10px",
            border:
              "1px solid #166534",
            background: COLORS.greenBg,
            color: "#4ade80",
            fontSize: "15px",
            fontWeight: 900,
          }}
        >
          {message}
        </div>
      ) : null}

      {error ? (
        <div
          style={{
            margin: "14px 18px 0",
            padding: "13px 15px",
            borderRadius: "10px",
            border:
              "1px solid #7f1d1d",
            background: COLORS.redBg,
            color: "#ff6b6b",
            fontSize: "15px",
            fontWeight: 900,
          }}
        >
          {error}
        </div>
      ) : null}

      <div
        style={{
          padding: "18px",
          display: "grid",
          gap: "14px",
        }}
      >
        {loading && !snapshot ? (
          <div
            style={{
              padding: "30px",
              textAlign: "center",
              color: COLORS.muted,
              fontSize: "16px",
              fontWeight: 700,
            }}
          >
            Loading today&apos;s duty...
          </div>
        ) : null}

        {!loading &&
        employees.length === 0 ? (
          <div
            style={{
              padding: "22px",
              border:
                `1px solid ${COLORS.border}`,
              borderRadius: "12px",
              background: COLORS.black2,
              color: COLORS.muted,
              fontSize: "15px",
              fontWeight: 700,
              textAlign: "center",
            }}
          >
            No linked employees are currently
            assigned to this shop for sign-in
            today.
          </div>
        ) : null}

        {employees.map((employee) => {
          const signedIn =
            Boolean(employee.signed_in);

          const isSigning =
            signingId ===
            employee.employee_id;

          return (
            <div
              key={employee.employee_id}
              style={{
                border:
                  `1px solid ${COLORS.border}`,
                borderRadius: "14px",
                padding: "18px",
                display: "grid",
                gap: "14px",
                background: COLORS.black2,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  alignItems:
                    "flex-start",
                  gap: "14px",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "22px",
                      fontWeight: 950,
                      color: COLORS.white,
                    }}
                  >
                    {
                      employee.employee_name
                    }
                  </div>

                  <div
                    style={{
                      marginTop: "6px",
                      fontSize: "14px",
                      color: COLORS.muted,
                      fontWeight: 700,
                    }}
                  >
                    {employee.position_code ===
                    "DAILY_RELIEF"
                      ? "Daily Relief"
                      : employee.position_code ||
                        "Employee"}

                    {" • "}

                    {employee.shop_name ||
                      snapshot?.shop_name ||
                      "Shop"}

                    {" • "}

                    {employee.attendance_rule ||
                      "12_HOUR_STANDARD"}
                  </div>
                </div>

                <StatusBadge
                  status={
                    signedIn
                      ? employee.attendance_status
                      : null
                  }
                />
              </div>

              {signedIn ? (
                <div
                  style={{
                    padding: "13px 15px",
                    borderRadius: "10px",
                    background:
                      employee.attendance_status ===
                      "LATE"
                        ? COLORS.redBg
                        : COLORS.greenBg,
                    fontSize: "16px",
                    fontWeight: 900,
                    color:
                      employee.attendance_status ===
                      "LATE"
                        ? "#ff6b6b"
                        : "#4ade80",
                  }}
                >
                  Signed in at{" "}
                  {cleanTime(
                    employee.first_signin_local_time
                  )}
                </div>
              ) : (
                <div
                  style={{
                    padding: "13px 15px",
                    borderRadius: "10px",
                    background:
                      COLORS.amberBg,
                    color: "#fbbf24",
                    fontSize: "16px",
                    fontWeight: 900,
                  }}
                >
                  Waiting for today&apos;s
                  sign-in
                </div>
              )}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(160px, 1fr))",
                  gap: "10px",
                }}
              >
                <BenefitBox
                  label="Lunch"
                  rate={
                    employee.lunch_rate
                  }
                  eligible={
                    employee.lunch_eligible
                  }
                  signedIn={signedIn}
                />

                <BenefitBox
                  label="Supper"
                  rate={
                    employee.supper_rate
                  }
                  eligible={
                    employee.supper_eligible
                  }
                  signedIn={signedIn}
                />

                <BenefitBox
                  label="Bonus"
                  rate={
                    employee.bonus_rate
                  }
                  eligible={
                    employee.bonus_eligible
                  }
                  signedIn={signedIn}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  alignItems: "center",
                  gap: "12px",
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    fontSize: "13px",
                    color: "#8f8f8f",
                    fontWeight: 700,
                  }}
                >
                  Duty source:{" "}
                  {employee.duty_source ||
                    "—"}
                </div>

                <button
                  type="button"
                  disabled={
                    signedIn ||
                    isSigning
                  }
                  onClick={() =>
                    signIn(employee)
                  }
                  style={{
                    minWidth: "160px",
                    border: signedIn
                      ? "1px solid #444"
                      : "1px solid #ffffff",
                    borderRadius: "11px",
                    padding:
                      "13px 24px",
                    background: signedIn
                      ? "#292929"
                      : "#ffffff",
                    color: signedIn
                      ? "#777777"
                      : "#111111",
                    fontSize: "16px",
                    fontWeight: 950,
                    cursor:
                      signedIn ||
                      isSigning
                        ? "not-allowed"
                        : "pointer",
                    letterSpacing: "0.5px",
                  }}
                >
                  {signedIn
                    ? "SIGNED IN ✓"
                    : isSigning
                    ? "SIGNING IN..."
                    : "SIGN IN"}
                </button>
              </div>
            </div>
          );
        })}

        <div
          style={{
            borderTop:
              `1px solid ${COLORS.border}`,
            paddingTop: "14px",
            fontSize: "13px",
            lineHeight: 1.7,
            color: "#969696",
            fontWeight: 600,
          }}
        >
          Sign-in time comes from the server
          in Africa/Nairobi time, not from
          the employee&apos;s phone. Standard
          12-hour employees who sign in after
          10:50 AM lose baseline Lunch and
          Supper eligibility. Daily Relief
          employees still sign in but
          currently receive KES 0 Lunch and
          Supper.
        </div>
      </div>
    </section>
  );
}
