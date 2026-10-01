"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import CashierReport from "./CashierReport";

export default function Dashboard() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [balanceBF, setBalanceBF] = useState("");
  const [balanceLocked, setBalanceLocked] = useState(false);

  const [currentShift, setCurrentShift] = useState(null);

  const [message, setMessage] = useState("");
  const [startingShift, setStartingShift] = useState(false);

  // ==================================================
  // LOAD USER + CURRENT OPEN SHIFT
  // ==================================================

  useEffect(() => {
    let cancelled = false;

    async function initialiseDashboard() {
      try {
        const savedUser =
          sessionStorage.getItem("teamLegendUser");

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

        if (cancelled) {
          return;
        }

        setUser(parsedUser);

        const role = String(
          parsedUser.role || ""
        ).toUpperCase();

        // ------------------------------------------
        // ADMIN
        // ------------------------------------------

        if (role === "ADMIN") {
          setLoading(false);
          return;
        }

        const shopId =
          parsedUser.shop_id ||
          parsedUser.shopId ||
          null;

        const cashierId =
          parsedUser.profile_id ||
          parsedUser.id ||
          parsedUser.user_id ||
          parsedUser.auth_user_id ||
          null;

        const accessToken =
          parsedUser.access_token ||
          null;

        const supabaseUrl =
          process.env.NEXT_PUBLIC_SUPABASE_URL;

        const supabaseAnonKey =
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (
          !shopId ||
          !cashierId ||
          !accessToken ||
          !supabaseUrl ||
          !supabaseAnonKey
        ) {
          throw new Error(
            "Login information is incomplete. Please log in again."
          );
        }

        // ------------------------------------------
        // CHECK FOR OPEN SHIFT
        // ------------------------------------------

        const openShiftResponse = await fetch(
          `${supabaseUrl}/rest/v1/shifts` +
            `?shop_id=eq.${encodeURIComponent(shopId)}` +
            `&cashier_id=eq.${encodeURIComponent(cashierId)}` +
            `&status=eq.OPEN` +
            `&select=*` +
            `&order=opened_at.desc` +
            `&limit=1`,
          {
            method: "GET",

            headers: {
              apikey: supabaseAnonKey,
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },

            cache: "no-store",
          }
        );

        let openShiftResult = null;

        try {
          openShiftResult =
            await openShiftResponse.json();
        } catch {
          openShiftResult = null;
        }

        if (!openShiftResponse.ok) {
          throw new Error(
            openShiftResult?.message ||
              openShiftResult?.details ||
              "Unable to check existing shift."
          );
        }

        if (cancelled) {
          return;
        }

        // ------------------------------------------
        // OPEN SHIFT EXISTS
        // ------------------------------------------

        if (
          Array.isArray(openShiftResult) &&
          openShiftResult.length > 0
        ) {
          const openShift =
            openShiftResult[0];

          setCurrentShift(openShift);

          setBalanceBF(
            String(
              openShift.opening_balance ?? ""
            )
          );

          setBalanceLocked(true);

          return;
        }

        // ------------------------------------------
        // NO OPEN SHIFT
        // GET PREVIOUS CLOSED SHIFT
        // ------------------------------------------

        const previousShift =
          await getLatestClosedShift({
            supabaseUrl,
            supabaseAnonKey,
            accessToken,
            shopId,
          });

        if (cancelled) {
          return;
        }

        if (previousShift) {
          setBalanceBF(
            String(
              previousShift.closing_balance ?? 0
            )
          );

          setBalanceLocked(true);
        } else {
          setBalanceBF("");
          setBalanceLocked(false);
        }
      } catch (error) {
        console.error(
          "DASHBOARD INITIALISE ERROR:",
          error
        );

        if (!cancelled) {
          setMessage(
            error?.message ||
              "Unable to load dashboard."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    initialiseDashboard();

    return () => {
      cancelled = true;
    };
  }, [router]);

  // ==================================================
  // LOGOUT
  // ==================================================

  function logout() {
    sessionStorage.removeItem("teamLegendUser");
    router.replace("/");
  }

  // ==================================================
  // START SHIFT
  // ==================================================

  async function startShift() {
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

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!shopId) {
      setMessage(
        "Shop information is missing."
      );
      return;
    }

    if (!cashierId) {
      setMessage(
        "Cashier information is missing."
      );
      return;
    }

    if (!accessToken) {
      setMessage(
        "Authentication is missing. Please log in again."
      );
      return;
    }

    if (!supabaseUrl || !supabaseAnonKey) {
      setMessage(
        "Database configuration is missing."
      );
      return;
    }

    try {
      setStartingShift(true);
      setMessage("");

      // ------------------------------------------
      // CHECK AGAIN FOR OPEN SHIFT
      // ------------------------------------------

      const existingResponse = await fetch(
        `${supabaseUrl}/rest/v1/shifts` +
          `?shop_id=eq.${encodeURIComponent(shopId)}` +
          `&status=eq.OPEN` +
          `&select=*` +
          `&order=opened_at.desc` +
          `&limit=1`,
        {
          method: "GET",

          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },

          cache: "no-store",
        }
      );

      const existingResult =
        await safeJson(existingResponse);

      if (!existingResponse.ok) {
        throw new Error(
          existingResult?.message ||
            existingResult?.details ||
            "Unable to check current shift."
        );
      }

      if (
        Array.isArray(existingResult) &&
        existingResult.length > 0
      ) {
        setCurrentShift(existingResult[0]);
        return;
      }

      // ------------------------------------------
      // PREVIOUS CLOSED SHIFT
      // ------------------------------------------

      const previousShift =
        await getLatestClosedShift({
          supabaseUrl,
          supabaseAnonKey,
          accessToken,
          shopId,
        });

      let openingBalance = 0;

      if (previousShift) {
        openingBalance =
          Number(
            previousShift.closing_balance ?? 0
          );

        setBalanceBF(
          String(openingBalance)
        );

        setBalanceLocked(true);
      } else {
        openingBalance =
          Number(balanceBF);

        if (
          balanceBF === "" ||
          Number.isNaN(openingBalance) ||
          openingBalance < 0
        ) {
          setMessage(
            "Please enter a valid Balance B/F."
          );

          return;
        }
      }

      // ------------------------------------------
      // PREVIOUS TABLE CLOSING
      // ------------------------------------------

      let tableCarryForward = null;

      if (previousShift) {
        tableCarryForward =
          await getTableCarryForward({
            supabaseUrl,
            supabaseAnonKey,
            accessToken,
            shopId,
            previousShiftId:
              previousShift.id,
          });

        if (
          tableCarryForward.platform &&
          tableCarryForward.value === null
        ) {
          setMessage(
            "Previous TABLE closing reading is missing. Ask admin to correct it before starting the next shift."
          );

          return;
        }
      }

      // ------------------------------------------
      // CREATE SHIFT
      // ------------------------------------------

      const now = new Date();

      const end = new Date(
        now.getTime() +
          12 * 60 * 60 * 1000
      );

      const businessDate =
        new Intl.DateTimeFormat("en-CA", {
          timeZone: "Africa/Nairobi",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(now);

      const shiftData = {
        shop_id: shopId,

        cashier_id:
          cashierId,

        cashier_name:
          cashierName,

        shift_name:
          "DAY",

        business_date:
          businessDate,

        scheduled_start:
          formatNairobiTime(now),

        scheduled_end:
          formatNairobiTime(end),

        opened_at:
          now.toISOString(),

        status:
          "OPEN",

        opening_balance:
          openingBalance,

        total_added_float:
          0,

        total_output:
          0,

        total_expenses:
          0,

        net_income:
          0,

        closing_balance:
          0,
      };

      const shiftResponse = await fetch(
        `${supabaseUrl}/rest/v1/shifts`,
        {
          method: "POST",

          headers: {
            apikey: supabaseAnonKey,
            Authorization:
              `Bearer ${accessToken}`,
            "Content-Type":
              "application/json",
            Prefer:
              "return=representation",
          },

          body: JSON.stringify(
            shiftData
          ),
        }
      );

      const shiftResult =
        await safeJson(
          shiftResponse
        );

      if (!shiftResponse.ok) {
        throw new Error(
          shiftResult?.message ||
            shiftResult?.details ||
            shiftResult?.hint ||
            "Unable to start shift."
        );
      }

      if (
        !Array.isArray(shiftResult) ||
        shiftResult.length === 0
      ) {
        throw new Error(
          "Shift was created but no shift record was returned."
        );
      }

      const newShift =
        shiftResult[0];

      // ------------------------------------------
      // TABLE OPENING CARRY FORWARD
      // ------------------------------------------

      if (
        tableCarryForward?.platform &&
        tableCarryForward.value !== null
      ) {
        const tableResponse =
          await fetch(
            `${supabaseUrl}/rest/v1/platform_readings`,
            {
              method: "POST",

              headers: {
                apikey:
                  supabaseAnonKey,

                Authorization:
                  `Bearer ${accessToken}`,

                "Content-Type":
                  "application/json",

                Prefer:
                  "return=representation",
              },

              body: JSON.stringify({
                shift_id:
                  newShift.id,

                platform_id:
                  tableCarryForward.platform.id,

                reading_kind:
                  "OPENING",

                reading_value:
                  tableCarryForward.value,

                recorded_at:
                  now.toISOString(),

                recorded_by:
                  cashierId,
              }),
            }
          );

        const tableResult =
          await safeJson(
            tableResponse
          );

        if (!tableResponse.ok) {
          console.error(
            "TABLE CARRY FORWARD ERROR:",
            tableResult
          );

          setMessage(
            "Shift opened, but TABLE opening could not be carried forward. Ask admin to correct TABLE before continuing."
          );
        }
      }

      // ------------------------------------------
      // OPEN NEW CASHIER REPORT
      // ------------------------------------------

      setCurrentShift(
        newShift
      );
    } catch (error) {
      console.error(
        "START SHIFT ERROR:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to start shift."
      );
    } finally {
      setStartingShift(false);
    }
  }

  // ==================================================
  // LOADING
  // ==================================================

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontFamily:
            "Arial, sans-serif",
        }}
      >
        Loading...
      </main>
    );
  }

  if (!user) {
    return null;
  }

  const role =
    String(
      user.role || ""
    ).toUpperCase();

  const isAdmin =
    role === "ADMIN";

  // ==================================================
  // ADMIN PAGE
  // ==================================================

  if (isAdmin) {
    return (
      <main
        style={{
          minHeight: "100vh",
          backgroundColor: "#f4f7fb",
          fontFamily:
            "Arial, sans-serif",
        }}
      >
        <header
          style={{
            backgroundColor: "#0f172a",
            color: "white",
            padding: "18px 30px",
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
              }}
            >
              TEAM LEGEND
            </h2>

            <div
              style={{
                marginTop: "4px",
                color: "#cbd5e1",
              }}
            >
              Admin Dashboard
            </div>
          </div>

          <button
            onClick={logout}
            style={{
              padding: "10px 18px",
              backgroundColor:
                "#dc2626",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            Logout
          </button>
        </header>

        <section
          style={{
            maxWidth: "1100px",
            margin: "0 auto",
            padding: "30px",
          }}
        >
          <h1>
            Admin Dashboard
          </h1>

          <p>
            The full Admin management dashboard will be connected separately.
          </p>
        </section>
      </main>
    );
  }

  // ==================================================
  // CASHIER HAS OPEN SHIFT
  //
  // SHOW NEW CASHIER REPORT DESIGN
  // ==================================================

  if (
    currentShift &&
    String(
      currentShift.status || ""
    ).toUpperCase() === "OPEN"
  ) {
    return (
      <CashierReport
        user={user}
        currentShift={currentShift}
      />
    );
  }

  // ==================================================
  // NO OPEN SHIFT
  // START SHIFT SCREEN
  // ==================================================

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

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#edf2f7",
        fontFamily:
          "Arial, sans-serif",
      }}
    >
      <header
        style={{
          background:
            "linear-gradient(90deg,#052d4b,#063c63)",
          color: "white",
          padding: "18px 28px",
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "28px",
              fontWeight: "900",
            }}
          >
            ♛ TEAM LEGEND
          </div>

          <div
            style={{
              fontSize: "11px",
              letterSpacing: "3px",
              marginTop: "3px",
            }}
          >
            DISCIPLINE • FOCUS • RESULTS
          </div>
        </div>

        <button
          type="button"
          onClick={logout}
          style={{
            padding: "10px 18px",
            backgroundColor:
              "transparent",
            color: "white",
            border:
              "1px solid rgba(255,255,255,0.45)",
            borderRadius: "7px",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          Logout
        </button>
      </header>

      <section
        style={{
          maxWidth: "700px",
          margin: "0 auto",
          padding: "40px 20px",
        }}
      >
        <div
          style={{
            textAlign: "center",
            marginBottom: "25px",
          }}
        >
          <h1
            style={{
              marginBottom: "5px",
            }}
          >
            {shopName}
          </h1>

          <div
            style={{
              color: "#64748b",
            }}
          >
            Cashier: {cashierName}
          </div>
        </div>

        <div
          style={{
            backgroundColor:
              "white",

            padding:
              "28px",

            borderRadius:
              "12px",

            boxShadow:
              "0 2px 12px rgba(0,0,0,0.10)",
          }}
        >
          <h2
            style={{
              marginTop: 0,
            }}
          >
            Opening Shift
          </h2>

          <p
            style={{
              color: "#64748b",
              marginBottom: "20px",
            }}
          >
            {balanceLocked
              ? "Balance B/F has been carried forward automatically from the previous shift."
              : "Enter the opening Balance B/F to start the shift."}
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
            disabled={
              startingShift ||
              balanceLocked
            }
            onChange={(e) => {
              setBalanceBF(
                e.target.value
              );

              setMessage("");
            }}
            style={{
              width: "100%",
              boxSizing:
                "border-box",
              padding: "13px",
              fontSize: "17px",
              border:
                "1px solid #cbd5e1",
              borderRadius: "7px",
              backgroundColor:
                balanceLocked
                  ? "#f1f5f9"
                  : "white",
            }}
          />

          {balanceLocked && (
            <div
              style={{
                color: "#15803d",
                fontWeight: "bold",
                fontSize: "13px",
                marginTop: "8px",
              }}
            >
              Carried forward from previous Closing Balance ✓
            </div>
          )}

          {message && (
            <div
              style={{
                marginTop: "16px",
                padding: "12px",
                borderRadius: "7px",
                backgroundColor:
                  "#fef2f2",
                color:
                  "#991b1b",
              }}
            >
              {message}
            </div>
          )}

          <button
            type="button"
            onClick={startShift}
            disabled={startingShift}
            style={{
              width: "100%",
              marginTop: "20px",
              padding: "14px",
              border: "none",
              borderRadius: "7px",
              color: "white",
              fontWeight: "bold",
              fontSize: "16px",

              backgroundColor:
                startingShift
                  ? "#94a3b8"
                  : "#07912a",

              cursor:
                startingShift
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            {startingShift
              ? "Starting Shift..."
              : "Start Shift"}
          </button>
        </div>
      </section>
    </main>
  );
}

// ==================================================
// PREVIOUS CLOSED SHIFT
// ==================================================

async function getLatestClosedShift({
  supabaseUrl,
  supabaseAnonKey,
  accessToken,
  shopId,
}) {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/shifts` +
      `?shop_id=eq.${encodeURIComponent(shopId)}` +
      `&status=eq.CLOSED` +
      `&select=id,closing_balance,closed_at` +
      `&order=closed_at.desc` +
      `&limit=1`,
    {
      method: "GET",

      headers: {
        apikey:
          supabaseAnonKey,

        Authorization:
          `Bearer ${accessToken}`,

        "Content-Type":
          "application/json",
      },

      cache: "no-store",
    }
  );

  const result =
    await safeJson(
      response
    );

  if (!response.ok) {
    throw new Error(
      result?.message ||
        result?.details ||
        "Unable to load previous shift."
    );
  }

  if (
    Array.isArray(result) &&
    result.length > 0
  ) {
    return result[0];
  }

  return null;
}

// ==================================================
// TABLE CARRY FORWARD
// ==================================================

async function getTableCarryForward({
  supabaseUrl,
  supabaseAnonKey,
  accessToken,
  shopId,
  previousShiftId,
}) {
  const platformResponse =
    await fetch(
      `${supabaseUrl}/rest/v1/shop_platforms` +
        `?shop_id=eq.${encodeURIComponent(shopId)}` +
        `&is_active=eq.true` +
        `&select=id,platform_name,reading_type`,
      {
        method: "GET",

        headers: {
          apikey:
            supabaseAnonKey,

          Authorization:
            `Bearer ${accessToken}`,

          "Content-Type":
            "application/json",
        },

        cache: "no-store",
      }
    );

  const platformResult =
    await safeJson(
      platformResponse
    );

  if (!platformResponse.ok) {
    throw new Error(
      platformResult?.message ||
        platformResult?.details ||
        "Unable to load TABLE platform."
    );
  }

  const platforms =
    Array.isArray(platformResult)
      ? platformResult
      : [];

  const tablePlatform =
    platforms.find(
      (platform) =>
        String(
          platform.platform_name ||
            ""
        )
          .trim()
          .toUpperCase() ===
        "TABLE"
    );

  if (!tablePlatform) {
    return {
      platform: null,
      value: null,
    };
  }

  const readingResponse =
    await fetch(
      `${supabaseUrl}/rest/v1/platform_readings` +
        `?shift_id=eq.${encodeURIComponent(previousShiftId)}` +
        `&platform_id=eq.${encodeURIComponent(tablePlatform.id)}` +
        `&reading_kind=eq.CLOSING` +
        `&select=id,reading_value,recorded_at` +
        `&order=recorded_at.desc` +
        `&limit=1`,
      {
        method: "GET",

        headers: {
          apikey:
            supabaseAnonKey,

          Authorization:
            `Bearer ${accessToken}`,

          "Content-Type":
            "application/json",
        },

        cache: "no-store",
      }
    );

  const readingResult =
    await safeJson(
      readingResponse
    );

  if (!readingResponse.ok) {
    throw new Error(
      readingResult?.message ||
        readingResult?.details ||
        "Unable to load previous TABLE closing."
    );
  }

  if (
    !Array.isArray(readingResult) ||
    readingResult.length === 0
  ) {
    return {
      platform:
        tablePlatform,

      value: null,
    };
  }

  return {
    platform:
      tablePlatform,

    value:
      Number(
        readingResult[0]
          .reading_value
      ),
  };
}

// ==================================================
// SAFE JSON
// ==================================================

async function safeJson(
  response
) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

// ==================================================
// NAIROBI TIME
// ==================================================

function formatNairobiTime(
  date
) {
  const parts =
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone:
          "Africa/Nairobi",

        hour:
          "2-digit",

        minute:
          "2-digit",

        second:
          "2-digit",

        hourCycle:
          "h23",
      }
    ).formatToParts(
      date
    );

  const values = {};

  for (
    const part of parts
  ) {
    values[
      part.type
    ] =
      part.value;
  }

  return `${values.hour}:${values.minute}:${values.second}`;
}
