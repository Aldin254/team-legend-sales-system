"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PlatformReadings from "./PlatformReadings";
export default function Dashboard() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [balanceBF, setBalanceBF] = useState("");
  const [shiftStarted, setShiftStarted] = useState(false);
  const [currentShift, setCurrentShift] = useState(null);

  const [message, setMessage] = useState("");
  const [startingShift, setStartingShift] = useState(false);
  const [checkingShift, setCheckingShift] = useState(false);

  // --------------------------------------------------
  // LOAD LOGIN SESSION
  // --------------------------------------------------

  useEffect(() => {
    try {
      const savedUser = sessionStorage.getItem("teamLegendUser");

      if (!savedUser) {
        router.replace("/");
        return;
      }

      const parsedUser = JSON.parse(savedUser);

      if (!parsedUser || !parsedUser.role) {
        sessionStorage.removeItem("teamLegendUser");
        router.replace("/");
        return;
      }

      setUser(parsedUser);
      setLoading(false);
    } catch (error) {
      console.error("Unable to read login session:", error);

      sessionStorage.removeItem("teamLegendUser");
      router.replace("/");
    }
  }, [router]);

  // --------------------------------------------------
  // FIND EXISTING OPEN SHIFT
  // --------------------------------------------------

  async function getOpenShift(currentUser) {
    if (!currentUser) {
      return null;
    }

    const role = String(currentUser.role || "").toUpperCase();

    if (role === "ADMIN") {
      return null;
    }

    const shopId =
      currentUser.shop_id ||
      currentUser.shopId ||
      null;

    const cashierId =
      currentUser.profile_id ||
      currentUser.id ||
      currentUser.user_id ||
      currentUser.auth_user_id ||
      null;

    const accessToken =
      currentUser.access_token ||
      null;

    if (!shopId || !cashierId || !accessToken) {
      return null;
    }

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        "Supabase database configuration is missing."
      );
    }

    const url =
      `${supabaseUrl}/rest/v1/shifts` +
      `?shop_id=eq.${encodeURIComponent(shopId)}` +
      `&cashier_id=eq.${encodeURIComponent(cashierId)}` +
      `&status=eq.OPEN` +
      `&select=id,shop_id,cashier_id,cashier_name,shift_name,business_date,scheduled_start,scheduled_end,opened_at,status,opening_balance,total_added_float,total_output,total_expenses,net_income,closing_balance` +
      `&order=opened_at.desc` +
      `&limit=1`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    let result = null;

    try {
      result = await response.json();
    } catch {
      result = null;
    }

    if (!response.ok) {
      console.error("OPEN SHIFT LOOKUP ERROR:", result);

      throw new Error(
        result?.message ||
          result?.details ||
          result?.hint ||
          "Unable to check existing shift."
      );
    }

    if (Array.isArray(result) && result.length > 0) {
      return result[0];
    }

    return null;
  }

  // --------------------------------------------------
  // RESTORE EXISTING OPEN SHIFT
  // --------------------------------------------------

  useEffect(() => {
    if (!user) {
      return;
    }

    const role = String(user.role || "").toUpperCase();

    if (role === "ADMIN") {
      return;
    }

    let cancelled = false;

    async function restoreShift() {
      try {
        setCheckingShift(true);
        setMessage("");

        const existingShift = await getOpenShift(user);

        if (cancelled) {
          return;
        }

        if (existingShift) {
          setCurrentShift(existingShift);

          setBalanceBF(
            String(existingShift.opening_balance ?? "")
          );

          setShiftStarted(true);
        } else {
          setCurrentShift(null);
          setShiftStarted(false);
        }
      } catch (error) {
        console.error("RESTORE SHIFT ERROR:", error);

        if (!cancelled) {
          setMessage(
            error?.message ||
              "Unable to check current shift."
          );
        }
      } finally {
        if (!cancelled) {
          setCheckingShift(false);
        }
      }
    }

    restoreShift();

    return () => {
      cancelled = true;
    };
  }, [user]);

  // --------------------------------------------------
  // LOGOUT
  // --------------------------------------------------

  function logout() {
    sessionStorage.removeItem("teamLegendUser");
    router.replace("/");
  }

  // --------------------------------------------------
  // START SHIFT
  // --------------------------------------------------

  async function startShift() {
    const amount = Number(balanceBF);

    if (
      balanceBF === "" ||
      Number.isNaN(amount) ||
      amount < 0
    ) {
      setMessage("Please enter a valid Balance B/F.");
      return;
    }

    if (!user) {
      setMessage(
        "Login session is missing. Please log in again."
      );
      return;
    }

    const shopId =
      user.shop_id ||
      user.shopId ||
      null;

    const cashierId =
      user.profile_id ||
      user.id ||
      user.user_id ||
      user.auth_user_id ||
      null;

    const cashierName =
      user.full_name ||
      user.name ||
      user.username ||
      "Cashier";

    const accessToken =
      user.access_token ||
      null;

    if (!shopId) {
      setMessage(
        "Shop ID is missing. Please log in again."
      );
      return;
    }

    if (!cashierId) {
      setMessage(
        "Cashier ID is missing. Please log in again."
      );
      return;
    }

    if (!accessToken) {
      setMessage(
        "Login authentication is missing. Please log out and log in again."
      );
      return;
    }

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      setMessage("Database configuration is missing.");
      return;
    }

    try {
      setStartingShift(true);
      setMessage("");

      // Check once more before inserting.
      // This prevents duplicate OPEN shifts.
      const existingShift = await getOpenShift(user);

      if (existingShift) {
        setCurrentShift(existingShift);

        setBalanceBF(
          String(existingShift.opening_balance ?? "")
        );

        setShiftStarted(true);
        return;
      }

      const now = new Date();

      const businessDate =
        new Intl.DateTimeFormat("en-CA", {
          timeZone: "Africa/Nairobi",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(now);

      function nairobiTime(date) {
        return new Intl.DateTimeFormat("en-GB", {
          timeZone: "Africa/Nairobi",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hourCycle: "h23",
        }).format(date);
      }

      const scheduledStart = nairobiTime(now);

      // Mirriams currently uses a 12-hour shift.
      const scheduledEnd = nairobiTime(
        new Date(
          now.getTime() +
            12 * 60 * 60 * 1000
        )
      );

      const shiftData = {
        shop_id: shopId,
        cashier_id: cashierId,
        cashier_name: cashierName,

        shift_name: "DAY",

        business_date: businessDate,

        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd,

        opened_at: now.toISOString(),

        status: "OPEN",

        opening_balance: amount,

        total_added_float: 0,
        total_output: 0,
        total_expenses: 0,
        net_income: 0,
        closing_balance: 0,
      };

      console.log("Creating shift:", shiftData);

      const response = await fetch(
        `${supabaseUrl}/rest/v1/shifts`,
        {
          method: "POST",

          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },

          body: JSON.stringify(shiftData),
        }
      );

      let result = null;

      try {
        result = await response.json();
      } catch {
        result = null;
      }

      if (!response.ok) {
        console.error("SHIFT INSERT ERROR:", result);

        const errorMessage =
          result?.message ||
          result?.details ||
          result?.hint ||
          `Unable to open shift. Error ${response.status}`;

        setMessage(errorMessage);
        return;
      }

      const createdShift =
        Array.isArray(result) && result.length > 0
          ? result[0]
          : shiftData;

      setCurrentShift(createdShift);
      setShiftStarted(true);
      setMessage("Shift opened successfully.");
    } catch (error) {
      console.error("START SHIFT ERROR:", error);

      setMessage(
        error?.message ||
          "Unable to open shift. Please try again."
      );
    } finally {
      setStartingShift(false);
    }
  }

  // --------------------------------------------------
  // LOADING SCREEN
  // --------------------------------------------------

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Arial, sans-serif",
        }}
      >
        Loading...
      </main>
    );
  }

  if (!user) {
    return null;
  }

  // --------------------------------------------------
  // USER DETAILS
  // --------------------------------------------------

  const role =
    String(user.role || "").toUpperCase();

  const isAdmin =
    role === "ADMIN";

  const shopName =
    user.shop ||
    user.shop_name ||
    user.shopName ||
    "Assigned Shop";

  const cashierName =
    user.full_name ||
    user.name ||
    user.username ||
    "Cashier";

  const today =
    new Intl.DateTimeFormat("en-KE", {
      timeZone: "Africa/Nairobi",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date());

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#f4f7fb",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {/* HEADER */}

      <header
        style={{
          backgroundColor: "#0f172a",
          color: "white",
          padding: "18px 30px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "20px",
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>
            TEAM LEGEND
          </h2>

          <p
            style={{
              margin: "5px 0 0",
              color: "#cbd5e1",
              fontSize: "14px",
            }}
          >
            Sales Management System
          </p>
        </div>

        <button
          onClick={logout}
          style={{
            backgroundColor: "#dc2626",
            color: "white",
            border: "none",
            borderRadius: "8px",
            padding: "10px 18px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          Logout
        </button>
      </header>

      <section
        style={{
          padding: "30px",
          maxWidth: "1200px",
          margin: "0 auto",
        }}
      >
        {isAdmin ? (
          <>
            {/* ADMIN DASHBOARD */}

            <h1 style={{ marginTop: 0 }}>
              Admin Dashboard
            </h1>

            <p>
              Welcome to Team Legend Sales Management System.
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(210px, 1fr))",
                gap: "20px",
                marginTop: "30px",
              }}
            >
              <DashboardCard
                title="Shops"
                value="27"
              />

              <DashboardCard
                title="Today's Sales"
                value="KES 0"
              />

              <DashboardCard
                title="Expenses"
                value="KES 0"
              />

              <DashboardCard
                title="Closing Balance"
                value="KES 0"
              />
            </div>
          </>
        ) : (
          <>
            {/* CASHIER HEADER */}

            <div style={{ marginBottom: "25px" }}>
              <h1 style={{ margin: 0 }}>
                {shopName}
              </h1>

              <p
                style={{
                  marginTop: "7px",
                  color: "#64748b",
                }}
              >
                Cashier Dashboard
              </p>
            </div>

            {/* SHOP INFORMATION */}

            <div
              style={{
                backgroundColor: "white",
                padding: "22px",
                borderRadius: "12px",
                boxShadow:
                  "0 2px 10px rgba(0,0,0,0.08)",
                marginBottom: "20px",
              }}
            >
              <h2 style={{ marginTop: 0 }}>
                {shopName}
              </h2>

              <p>
                <strong>Cashier:</strong>{" "}
                {cashierName}
              </p>

              <p>
                <strong>Date:</strong>{" "}
                {today}
              </p>

              <p style={{ marginBottom: 0 }}>
                <strong>Status:</strong>{" "}

                <span
                  style={{
                    color: "#15803d",
                    fontWeight: "bold",
                  }}
                >
                  ACTIVE
                </span>
              </p>
            </div>

            {/* SHIFT CARD */}

            <div
              style={{
                backgroundColor: "white",
                padding: "25px",
                borderRadius: "12px",
                boxShadow:
                  "0 2px 10px rgba(0,0,0,0.08)",
                maxWidth: "600px",
              }}
            >
              <h2 style={{ marginTop: 0 }}>
                Opening Shift
              </h2>

              {checkingShift ? (
                <div
                  style={{
                    padding: "18px",
                    color: "#64748b",
                  }}
                >
                  Checking current shift...
                </div>
              ) : !shiftStarted ? (
                <>
                  <p
                    style={{
                      color: "#64748b",
                      marginBottom: "20px",
                    }}
                  >
                    Enter the opening balance before starting
                    work.
                  </p>

                  <label
                    style={{
                      display: "block",
                      fontWeight: "bold",
                      marginBottom: "8px",
                    }}
                  >
                    Balance B/F (KES)
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={balanceBF}
                    disabled={startingShift}
                    onChange={(e) => {
                      setBalanceBF(e.target.value);
                      setMessage("");
                    }}
                    placeholder="Enter opening balance"
                    style={{
                      width: "100%",
                      padding: "13px",
                      border:
                        "1px solid #cbd5e1",
                      borderRadius: "8px",
                      boxSizing: "border-box",
                      fontSize: "16px",
                      marginBottom: "18px",
                    }}
                  />

                  {message && (
                    <div
                      style={{
                        marginBottom: "16px",
                        padding: "10px",
                        backgroundColor: "#fef2f2",
                        color: "#991b1b",
                        borderRadius: "8px",
                      }}
                    >
                      {message}
                    </div>
                  )}

                  <button
                    onClick={startShift}
                    disabled={startingShift}
                    style={{
                      width: "100%",
                      padding: "14px",
                      border: "none",
                      borderRadius: "8px",
                      backgroundColor: startingShift
                        ? "#94a3b8"
                        : "#168d32",
                      color: "white",
                      fontSize: "16px",
                      fontWeight: "bold",
                      cursor: startingShift
                        ? "not-allowed"
                        : "pointer",
                    }}
                  >
                    {startingShift
                      ? "Opening Shift..."
                      : "Start Shift"}
                  </button>
                </>
              ) : (
                <div>
                  <div
                    style={{
                      padding: "14px",
                      backgroundColor: "#ecfdf5",
                      borderRadius: "8px",
                      color: "#166534",
                      marginBottom: "18px",
                    }}
                  >
                    Shift is open.
                  </div>

                  <p>
                    <strong>Shop:</strong>{" "}
                    {shopName}
                  </p>

                  <p>
                    <strong>Cashier:</strong>{" "}
                    {cashierName}
                  </p>

                  <p>
                    <strong>Balance B/F:</strong>{" "}
                    KES{" "}
                    {Number(
                      currentShift?.opening_balance ??
                        balanceBF
                    ).toLocaleString("en-KE")}
                  </p>

                  <p>
                    <strong>Scheduled Start:</strong>{" "}
                    {currentShift?.scheduled_start || "-"}
                  </p>

                  <p>
                    <strong>Scheduled End:</strong>{" "}
                    {currentShift?.scheduled_end || "-"}
                  </p>

                  <p style={{ marginBottom: 0 }}>
                    <strong>Shift Status:</strong>{" "}

                    <span
                      style={{
                        color: "#15803d",
                        fontWeight: "bold",
                      }}
                    >
                      OPEN
                    </span>
                  </p>
                </div>
              )}
            </div>
{shiftStarted && currentShift && (
  <PlatformReadings
    user={user}
    currentShift={currentShift}
  />
)}
            <p
              style={{
                marginTop: "20px",
                color: "#64748b",
                fontSize: "13px",
              }}
            >
              You can only access your assigned shop.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
function DashboardCard({ title, value }) {
  return (
    <div
      style={{
        backgroundColor: "white",
        borderRadius: "10px",
        padding: "22px",
        boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
      }}
    >
      <p
        style={{
          margin: 0,
          color: "#64748b",
        }}
      >
        {title}
      </p>

      <h2
        style={{
          margin: "8px 0 0",
        }}
      >
        {value}
      </h2>
    </div>
  );
}

