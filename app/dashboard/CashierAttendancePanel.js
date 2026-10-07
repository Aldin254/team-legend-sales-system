"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

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
      background: "#dcfce7",
      color: "#166534",
      border: "#bbf7d0",
    };
  }

  if (status === "LATE") {
    return {
      background: "#fee2e2",
      color: "#b91c1c",
      border: "#fecaca",
    };
  }

  if (status === "EXEMPT") {
    return {
      background: "#dbeafe",
      color: "#1d4ed8",
      border: "#bfdbfe",
    };
  }

  return {
    background: "#f3f4f6",
    color: "#4b5563",
    border: "#e5e7eb",
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
        borderRadius: 999,
        padding: "5px 9px",
        fontSize: 11,
        fontWeight: 900,
        background: c.background,
        color: c.color,
        border: `1px solid ${c.border}`,
        whiteSpace: "nowrap",
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
  let background = "#f9fafb";
  let color = "#6b7280";

  if (signedIn) {
    if (eligible && Number(rate || 0) > 0) {
      value = `${money(rate)} ✓`;
      background = "#f0fdf4";
      color = "#166534";
    } else {
      value = "KES 0";
      background = "#fef2f2";
      color = "#991b1b";
    }
  }

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 9,
        padding: "8px 10px",
        background,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 900,
          color: "#6b7280",
          textTransform: "uppercase",
          letterSpacing: 0.4,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: 3,
          fontSize: 12,
          fontWeight: 900,
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
        border: "1px solid #e5e7eb",
        borderRadius: 14,
        background: "#ffffff",
        overflow: "hidden",
        marginBottom: 16,
      }}
    >
      <div
        style={{
          padding: "14px 16px",
          borderBottom:
            "1px solid #e5e7eb",
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 17,
              fontWeight: 950,
              color: "#111827",
            }}
          >
            Today&apos;s Duty / Sign In
          </div>

          <div
            style={{
              marginTop: 3,
              fontSize: 11,
              color: "#6b7280",
            }}
          >
            Nairobi server time • Cutoff
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
              "1px solid #d1d5db",
            background: "#ffffff",
            borderRadius: 8,
            padding: "8px 11px",
            fontWeight: 800,
            fontSize: 11,
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
            padding: "10px 16px",
            background: "#f9fafb",
            borderBottom:
              "1px solid #e5e7eb",
            display: "flex",
            gap: 14,
            flexWrap: "wrap",
            fontSize: 11,
            color: "#4b5563",
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
            margin: "12px 14px 0",
            padding: "10px 12px",
            borderRadius: 9,
            border:
              "1px solid #bbf7d0",
            background: "#f0fdf4",
            color: "#166534",
            fontSize: 12,
            fontWeight: 800,
          }}
        >
          {message}
        </div>
      ) : null}

      {error ? (
        <div
          style={{
            margin: "12px 14px 0",
            padding: "10px 12px",
            borderRadius: 9,
            border:
              "1px solid #fecaca",
            background: "#fef2f2",
            color: "#991b1b",
            fontSize: 12,
            fontWeight: 800,
          }}
        >
          {error}
        </div>
      ) : null}

      <div
        style={{
          padding: 14,
          display: "grid",
          gap: 10,
        }}
      >
{loading && !snapshot ? (
          <div
            style={{
              padding: 24,
              textAlign: "center",
              color: "#6b7280",
              fontSize: 12,
            }}
          >
            Loading today&apos;s duty...
          </div>
        ) : null}

        {!loading &&
        employees.length === 0 ? (
          <div
            style={{
              padding: 18,
              border:
                "1px solid #e5e7eb",
              borderRadius: 10,
              background: "#f9fafb",
              color: "#6b7280",
              fontSize: 12,
              textAlign: "center",
            }}
          >
            No linked employees are
            currently assigned to this shop
            for sign-in today.
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
                  "1px solid #e5e7eb",
                borderRadius: 12,
                padding: 12,
                display: "grid",
                gap: 10,
                background: "#ffffff",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  alignItems:
                    "flex-start",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 950,
                      color: "#111827",
                    }}
                  >
                    {
                      employee.employee_name
                    }
                  </div>

                  <div
                    style={{
                      marginTop: 3,
                      fontSize: 11,
                      color: "#6b7280",
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
                    padding:
                      "9px 10px",
                    borderRadius: 9,
                    background:
                      employee.attendance_status ===
                      "LATE"
                        ? "#fef2f2"
                        : "#f0fdf4",
                    fontSize: 12,
                    fontWeight: 800,
                    color:
                      employee.attendance_status ===
                      "LATE"
                        ? "#991b1b"
                        : "#166534",
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
                    padding:
                      "9px 10px",
                    borderRadius: 9,
                    background:
                      "#fff7ed",
                    color: "#9a3412",
                    fontSize: 12,
                    fontWeight: 800,
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
                    "repeat(auto-fit, minmax(120px, 1fr))",
                  gap: 7,
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
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: "#9ca3af",
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
                    border: 0,
                    borderRadius: 9,
                    padding:
                      "9px 14px",
                    background: signedIn
                      ? "#d1d5db"
                      : "#111827",
                    color: signedIn
                      ? "#6b7280"
                      : "#ffffff",
                    fontSize: 12,
                    fontWeight: 900,
                    cursor:
                      signedIn ||
                      isSigning
                        ? "not-allowed"
                        : "pointer",
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
              "1px solid #e5e7eb",
            paddingTop: 10,
            fontSize: 10,
            lineHeight: 1.6,
            color: "#6b7280",
          }}
        >
          Sign-in time comes from the
          server in Africa/Nairobi time,
          not the employee&apos;s phone.
          Standard 12-hour employees who
          sign in after 10:50 AM lose
          baseline Lunch and Supper
          eligibility. Daily Relief
          employees still sign in but
          currently receive KES 0 Lunch
          and Supper.
        </div>
      </div>
    </section>
  );
}
