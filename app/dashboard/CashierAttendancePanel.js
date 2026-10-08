"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

const COLORS = {
  black: "#0C0F12",
  black2: "#12171C",
  black3: "#181E24",
  border: "#343C45",

  white: "#FFFFFF",
  text: "#E7EBEF",
  muted: "#A6AFB8",

  green: "#4ADE80",
  greenBg: "#10261A",

  red: "#F87171",
  redBg: "#2C1619",

  blue: "#60A5FA",
  blueBg: "#111F31",

  amber: "#FBBF24",
  amberBg: "#33250C",
};


function money(value) {
  return new Intl.NumberFormat(
    "en-KE",
    {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }
  ).format(
    Number(value || 0)
  );
}


function cleanTime(value) {
  if (!value) {
    return "—";
  }

  const text =
    String(value);

  return text.length >= 5
    ? text.slice(0, 5)
    : text;
}


function statusStyle(status) {
  if (status === "ON_TIME") {
    return {
      background:
        COLORS.greenBg,
      color:
        COLORS.green,
      border:
        "#286746",
    };
  }

  if (status === "LATE") {
    return {
      background:
        COLORS.redBg,
      color:
        COLORS.red,
      border:
        "#79363C",
    };
  }

  if (status === "EXEMPT") {
    return {
      background:
        COLORS.blueBg,
      color:
        COLORS.blue,
      border:
        "#2C5078",
    };
  }

 return {
  background: "#0D1115",
  color: "#FFFFFF",
  border: "#454E58",
};
}


function StatusBadge({
  status,
}) {
  const style =
    statusStyle(status);

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
        display:
          "inline-flex",

        alignItems:
          "center",

        justifyContent:
          "center",

        borderRadius:
          "999px",

        padding:
          "6px 12px",

        fontSize:
          "13px",

        fontWeight:
          950,

        background:
          style.background,

        color:
          style.color,

        border:
          `1px solid ${style.border}`,

        whiteSpace:
          "nowrap",

        letterSpacing:
          "0.35px",
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
  let value =
    "Pending sign-in";

 let background =
  "#0D1115";

let color =
  "#FFFFFF";

let border =
  "#454E58";
  if (signedIn) {
    if (
      eligible &&
      Number(rate || 0) > 0
    ) {
      value =
        `${money(rate)} ✓`;

      background =
        COLORS.greenBg;

      color =
        COLORS.green;

      border =
        "#286746";
    } else {
      value =
        "KES 0";

      background =
        COLORS.redBg;

      color =
        COLORS.red;

      border =
        "#79363C";
    }
  }

  return (
    <div
      style={{
        border:
          `1px solid ${border}`,

        borderRadius:
          "10px",

        padding:
          "10px 12px",

        background,

        minHeight:
          "58px",

        boxSizing:
          "border-box",
      }}
    >
      <div
        style={{
          fontSize:
            "12px",

          fontWeight:
            950,

          color:
            "#C5CBD1",

          textTransform:
            "uppercase",

          letterSpacing:
            "0.65px",
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop:
            "4px",

          fontSize:
            "15px",

          fontWeight:
            950,

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
  const [
    snapshot,
    setSnapshot,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    signingId,
    setSigningId,
  ] = useState(null);

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState("");

  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env
      .NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const accessToken =
    user?.access_token || null;

  const apiBase =
    useMemo(
      () =>
        String(
          supabaseUrl || ""
        ).replace(
          /\/+$/,
          ""
        ),
      [supabaseUrl]
    );
  const rpc =
    useCallback(
      async (
        name,
        body = {}
      ) => {
        if (
          !apiBase ||
          !supabaseAnonKey ||
          !accessToken
        ) {
          throw new Error(
            "Missing Supabase connection details."
          );
        }

        const response =
          await fetch(
            `${apiBase}/rest/v1/rpc/${name}`,
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
                  body
                ),
            }
          );

        let result =
          null;

        try {
          result =
            await response.json();
        } catch {
          result =
            null;
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
    useCallback(
      async () => {
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
          const result =
            await rpc(
              "tl_cashier_today_duty_snapshot",
              {}
            );

          setSnapshot(
            result || null
          );
        } catch (err) {
          setError(
            err?.message ||
              "Unable to load today's duty list."
          );
        } finally {
          setLoading(false);
        }
      },
      [
        apiBase,
        supabaseAnonKey,
        accessToken,
        rpc,
      ]
    );


  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);


  const employees =
    Array.isArray(
      snapshot?.employees
    )
      ? snapshot.employees
      : [];


  async function signIn(
    employee
  ) {
    if (
      !employee
        ?.employee_id
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Sign in ${employee.employee_name} now?\n\n` +
          `The first sign-in time is recorded using Nairobi server time and cannot be changed by the cashier.`
      );

    if (!confirmed) {
      return;
    }

    setSigningId(
      employee.employee_id
    );

    setMessage("");
    setError("");

    try {
      const result =
        await rpc(
          "tl_attendance_sign_in",
          {
            p_employee_id:
              employee.employee_id,
          }
        );

      if (
        result?.already_signed_in
      ) {
        setMessage(
          `${employee.employee_name} was already signed in at ${cleanTime(
            result.first_signin_local_time
          )}.`
        );
      } else {
        const status =
          result
            ?.attendance_status ===
          "ON_TIME"
            ? "ON TIME"
            : result
                ?.attendance_status ===
              "LATE"
            ? "LATE"
            : result
                ?.attendance_status ===
              "EXEMPT"
            ? "EXEMPT"
            : result
                ?.attendance_status ||
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

      let friendly =
        raw;

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

      setError(
        friendly
      );
    } finally {
      setSigningId(
        null
      );
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
        background:
          COLORS.black,

        border:
          `1px solid ${COLORS.border}`,

        borderRadius:
          "13px",

        overflow:
          "hidden",

        margin:
          "10px 12px 12px",

        boxShadow:
          "0 8px 26px rgba(0,0,0,0.28)",

        color:
          COLORS.white,
      }}
    >
      {/* HEADER */}

      <div
        style={{
          padding:
            "14px 18px",

          background:
            "#0B0E11",

          borderBottom:
            `1px solid ${COLORS.border}`,

          display:
            "flex",

          justifyContent:
            "space-between",

          alignItems:
            "center",

          gap:
            "12px",

          flexWrap:
            "wrap",
        }}
      >
        <div>
          <div
            style={{
              fontSize:
                "22px",

              fontWeight:
                950,

              color:
                COLORS.white,

              lineHeight:
                1.1,
            }}
          >
            Today&apos;s Duty / Sign In
          </div>

          <div
            style={{
              marginTop:
                "4px",

              fontSize:
                "13px",

              color:
                COLORS.muted,

              fontWeight:
                700,
            }}
          >
            Nairobi Server Time • Cutoff 10:50 AM • First sign-in is permanent
          </div>
        </div>

        <button
          type="button"
          onClick={
            loadAttendance
          }
          disabled={
            loading
          }
          style={{
            border:
              "1px solid #4A535C",

            background:
              "#1A2026",

            color:
              "#FFFFFF",

            borderRadius:
              "9px",

            padding:
              "9px 14px",

            fontWeight:
              900,

            fontSize:
              "13px",

            cursor:
              loading
                ? "not-allowed"
                : "pointer",
          }}
        >
          {loading
            ? "Refreshing..."
            : "Refresh"}
        </button>
      </div>


      {/* SHOP / DATE / WEEK INFO */}

      {snapshot ? (
        <div
          style={{
            padding:
              "9px 18px",

            background:
              COLORS.black2,

            borderBottom:
              `1px solid ${COLORS.border}`,

            display:
              "flex",

            gap:
              "18px",

            flexWrap:
              "wrap",

            fontSize:
              "13px",

            color:
              "#CFD5DB",

            fontWeight:
              700,
          }}
        >
          <span>
            <strong>
              Shop:
            </strong>{" "}
            {snapshot.shop_name ||
              "—"}
          </span>

          <span>
            <strong>
              Date:
            </strong>{" "}
            {snapshot.server_date ||
              "—"}
          </span>

          <span>
            <strong>
              Week:
            </strong>{" "}
            {snapshot.cycle_week ||
              "—"}
          </span>

          <span>
            <strong>
              Day:
            </strong>{" "}
            {snapshot.cycle_day ||
              "—"}
          </span>

          <span>
            <strong>
              Employees:
            </strong>{" "}
            {snapshot
              .employee_count ??
              employees.length}
          </span>
        </div>
      ) : null}
{message ? (
        <div
          style={{
            margin:
              "10px 15px 0",

            padding:
              "10px 12px",

            borderRadius:
              "9px",

            border:
              "1px solid #286746",

            background:
              COLORS.greenBg,

            color:
              COLORS.green,

            fontSize:
              "14px",

            fontWeight:
              900,
          }}
        >
          {message}
        </div>
      ) : null}


      {error ? (
        <div
          style={{
            margin:
              "10px 15px 0",

            padding:
              "10px 12px",

            borderRadius:
              "9px",

            border:
              "1px solid #79363C",

            background:
              COLORS.redBg,

            color:
              COLORS.red,

            fontSize:
              "14px",

            fontWeight:
              900,
          }}
        >
          {error}
        </div>
      ) : null}


      <div
        style={{
          padding:
            "13px 15px",

          display:
            "grid",

          gap:
            "10px",
        }}
      >
        {loading &&
        !snapshot ? (
          <div
            style={{
              padding:
                "22px",

              textAlign:
                "center",

              color:
                COLORS.muted,

              fontSize:
                "15px",

              fontWeight:
                750,
            }}
          >
            Loading today&apos;s duty...
          </div>
        ) : null}


        {!loading &&
        employees.length ===
          0 ? (
          <div
            style={{
              padding:
                "18px",

              border:
                `1px solid ${COLORS.border}`,

              borderRadius:
                "10px",

              background:
                COLORS.black2,

              color:
                COLORS.muted,

              fontSize:
                "14px",

              fontWeight:
                750,

              textAlign:
                "center",
            }}
          >
            No linked employees are currently assigned to this shop for sign-in today.
          </div>
        ) : null}


        {employees.map(
          (employee) => {
            const signedIn =
              Boolean(
                employee.signed_in
              );

            const isSigning =
              signingId ===
              employee.employee_id;

            return (
              <div
                key={
                  employee.employee_id
                }
                style={{
                  border:
                    `1px solid ${COLORS.border}`,

                  borderRadius:
                    "11px",

                  padding:
                    "13px",

                  display:
                    "grid",

                  gap:
                    "9px",

                  background:
                    COLORS.black2,
                }}
              >
                {/* EMPLOYEE TOP ROW */}

                <div
                  style={{
                    display:
                      "flex",

                    justifyContent:
                      "space-between",

                    alignItems:
                      "flex-start",

                    gap:
                      "12px",

                    flexWrap:
                      "wrap",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize:
                          "20px",

                        fontWeight:
                          950,

                        color:
                          COLORS.white,

                        lineHeight:
                          1.1,
                      }}
                    >
                      {
                        employee.employee_name
                      }
                    </div>

                    <div
                      style={{
                        marginTop:
                          "4px",

                        fontSize:
                          "13px",

                        color:
                          COLORS.muted,

                        fontWeight:
                          750,
                      }}
                    >
                      {employee.position_code ===
                      "DAILY_RELIEF"
                        ? "DAILY RELIEF"
                        : employee.position_code ||
                          "EMPLOYEE"}

                      {" • "}

                      {employee.shop_name ||
                        snapshot?.shop_name ||
                        "SHOP"}

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


                {/* SIGN-IN STATUS STRIP */}

                {signedIn ? (
                  <div
                    style={{
                      padding:
                        "9px 11px",

                      borderRadius:
                        "8px",

                      background:
                        employee.attendance_status ===
                        "LATE"
                          ? COLORS.redBg
                          : COLORS.greenBg,

                      fontSize:
                        "14px",

                      fontWeight:
                        900,

                      color:
                        employee.attendance_status ===
                        "LATE"
                          ? COLORS.red
                          : COLORS.green,
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
                        "9px 11px",

                      borderRadius:
                        "8px",

                      background:
  "#0D1115",

color:
  "#FFFFFF",

border:
  "1px solid #454E58",
                      fontSize:
                        "14px",

                      fontWeight:
                        900,
                    }}
                  >
                    Waiting for today&apos;s sign-in
                  </div>
                )}


                {/* BENEFITS */}

                <div
                  style={{
                    display:
                      "grid",

                    gridTemplateColumns:
                      "repeat(3, minmax(150px, 1fr))",

                    gap:
                      "8px",
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
                    signedIn={
                      signedIn
                    }
                  />

                  <BenefitBox
                    label="Supper"
                    rate={
                      employee.supper_rate
                    }
                    eligible={
                      employee.supper_eligible
                    }
                    signedIn={
                      signedIn
                    }
                  />

                  <BenefitBox
                    label="Bonus"
                    rate={
                      employee.bonus_rate
                    }
                    eligible={
                      employee.bonus_eligible
                    }
                    signedIn={
                      signedIn
                    }
                  />
                </div>


                {/* BOTTOM ROW */}

                <div
                  style={{
                    display:
                      "flex",

                    justifyContent:
                      "space-between",

                    alignItems:
                      "center",

                    gap:
                      "10px",

                    flexWrap:
                      "wrap",
                  }}
                >
                  <div
                    style={{
                      fontSize:
                        "12px",

                      color:
                        "#8F99A3",

                      fontWeight:
                        750,
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
                      signIn(
                        employee
                      )
                    }
                    style={{
                      minWidth:
                        "145px",

                      border:
                        signedIn
                          ? "1px solid #444B52"
                          : "1px solid #FFFFFF",

                      borderRadius:
                        "9px",

                      padding:
                        "10px 19px",

                      background:
                        signedIn
                          ? "#242A30"
                          : "#FFFFFF",

                      color:
                        signedIn
                          ? "#737B83"
                          : "#111111",

                      fontSize:
                        "15px",

                      fontWeight:
                        950,

                      cursor:
                        signedIn ||
                        isSigning
                          ? "not-allowed"
                          : "pointer",

                      letterSpacing:
                        "0.4px",
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
          }
        )}


        {/* FOOTER NOTE */}

        <div
          style={{
            borderTop:
              `1px solid ${COLORS.border}`,

            paddingTop:
              "9px",

            fontSize:
              "12px",

            lineHeight:
              1.5,

            color:
              "#929CA6",

            fontWeight:
              650,
          }}
        >
          Sign-in time comes from the server in Africa/Nairobi time, not from the employee&apos;s phone. Standard 12-hour employees who sign in after 10:50 AM lose baseline Lunch and Supper eligibility. Daily Relief employees still sign in but currently receive KES 0 Lunch and Supper.
        </div>
      </div>
    </section>
  );
}
