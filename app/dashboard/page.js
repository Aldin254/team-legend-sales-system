"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import CashierReport from "./CashierReport";
import Cashier24HourReport from "./Cashier24HourReport";
import AdminDashboard from "./AdminDashboard";

export default function DashboardPage() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [balanceBF, setBalanceBF] = useState("");
  const [balanceLocked, setBalanceLocked] = useState(false);

  const [currentShift, setCurrentShift] = useState(null);

  const [message, setMessage] = useState("");
  const [startingShift, setStartingShift] = useState(false);

  const [shopType, setShopType] = useState("");
  const [closedForToday, setClosedForToday] = useState(false);

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // ==================================================
  // INITIAL LOAD
  // ==================================================

  useEffect(() => {
    let cancelled = false;

    async function initialise() {
      try {
        setLoading(true);
        setMessage("");

        const stored =
          sessionStorage.getItem("teamLegendUser");

        if (!stored) {
          router.replace("/");
          return;
        }

        let parsedUser;

        try {
          parsedUser = JSON.parse(stored);
        } catch {
          sessionStorage.removeItem("teamLegendUser");
          router.replace("/");
          return;
        }

        if (cancelled) {
          return;
        }

        setUser(parsedUser);

        const role =
          String(parsedUser?.role || "")
            .trim()
            .toUpperCase();

        // ------------------------------------------
        // ADMIN
        // ------------------------------------------

        if (role === "ADMIN") {
          setLoading(false);
          return;
        }

        // ------------------------------------------
        // CASHIER
        // ------------------------------------------

        if (role !== "CASHIER") {
          throw new Error(
            "This account does not have cashier access."
          );
        }

        const shopId =
          parsedUser?.shop_id ||
          parsedUser?.shopId ||
          null;

        const cashierId =
          parsedUser?.profile_id ||
          parsedUser?.id ||
          parsedUser?.user_id ||
          parsedUser?.auth_user_id ||
          null;

        const accessToken =
          parsedUser?.access_token ||
          null;

        if (
          !shopId ||
          !cashierId ||
          !accessToken
        ) {
          throw new Error(
            "Cashier login information is incomplete."
          );
        }

        // ------------------------------------------
        // SHOP TYPE
        // ------------------------------------------

        const loadedShopType =
          await getShopType({
            shopId,
            accessToken,
            supabaseUrl,
            supabaseAnonKey,
          });

        if (cancelled) {
          return;
        }

        setShopType(loadedShopType);

        // ------------------------------------------
        // CURRENT OPEN SHIFT FOR THIS CASHIER
        // ------------------------------------------

        const openShiftResponse =
          await fetch(
            `${supabaseUrl}/rest/v1/shifts` +
              `?shop_id=eq.${encodeURIComponent(shopId)}` +
              `&cashier_id=eq.${encodeURIComponent(cashierId)}` +
              `&status=eq.OPEN` +
              `&select=*` +
              `&order=opened_at.desc` +
              `&limit=1`,
            {
              method: "GET",

              headers: authHeaders(
                supabaseAnonKey,
                accessToken
              ),

              cache: "no-store",
            }
          );

        const openShiftResult =
          await safeJson(openShiftResponse);

        if (!openShiftResponse.ok) {
          throw new Error(
            openShiftResult?.message ||
              openShiftResult?.details ||
              "Unable to check current shift."
          );
        }

        const openShift =
          Array.isArray(openShiftResult) &&
          openShiftResult.length > 0
            ? openShiftResult[0]
            : null;

        // ==========================================
        // EXISTING OPEN SHIFT
        // ==========================================

        if (openShift) {
          if (cancelled) {
            return;
          }

          // ----------------------------------------
          // REPAIR EXISTING 12-HOUR OPENINGS
          //
          // This covers shifts that were created
          // before automatic opening creation.
          //
          // Existing readings are NEVER overwritten.
          //
          // Missing non-TABLE = 0
          // Missing TABLE =
          // previous CLOSED shift TABLE closing.
          // ----------------------------------------

          if (
            loadedShopType ===
            "12_HOUR"
          ) {
            await ensure12HourOpeningReadings({
              shopId,

              shiftId:
                openShift.id,

              cashierId,

              accessToken,
              supabaseUrl,
              supabaseAnonKey,
            });
          }

          if (cancelled) {
            return;
          }

          setCurrentShift(openShift);

          setBalanceBF(
            String(
              openShift.opening_balance ??
                0
            )
          );

          setBalanceLocked(true);
          setClosedForToday(false);
          setLoading(false);

          return;
        }

        // ------------------------------------------
        // 12-HOUR SHOP:
        // ONLY ONE COMPLETED SHIFT PER BUSINESS DATE
        // ------------------------------------------

        const businessDate =
          getNairobiBusinessDate();

        if (
          loadedShopType ===
          "12_HOUR"
        ) {
          const todayClosed =
            await getClosedShiftForDate({
              shopId,
              businessDate,
              accessToken,
              supabaseUrl,
              supabaseAnonKey,
            });

          if (todayClosed) {
            if (cancelled) {
              return;
            }

            setClosedForToday(true);

            setBalanceBF(
              String(
                todayClosed.closing_balance ??
                  0
              )
            );

            setBalanceLocked(true);
            setLoading(false);

            return;
          }
        }

        // ------------------------------------------
        // PREVIOUS CLOSED SHIFT
        // ------------------------------------------

        const previousShift =
          await getLatestClosedShift({
            shopId,
            accessToken,
            supabaseUrl,
            supabaseAnonKey,
          });

        if (cancelled) {
          return;
        }

        if (previousShift) {
          // B/F = PREVIOUS SHIFT CLOSING BALANCE
          setBalanceBF(
            String(
              previousShift.closing_balance ??
                0
            )
          );

          setBalanceLocked(true);
        } else {
          setBalanceBF("");
          setBalanceLocked(false);
        }

        setClosedForToday(false);
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

    initialise();

    return () => {
      cancelled = true;
    };
  }, [
    router,
    supabaseUrl,
    supabaseAnonKey,
  ]);

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
    if (
      !user ||
      startingShift
    ) {
      return;
    }

    if (closedForToday) {
      setMessage(
        "This 12-hour shop has already completed today's shift."
      );

      return;
    }

    const shopId =
      user?.shop_id ||
      user?.shopId ||
      null;

    const cashierId =
      user?.profile_id ||
      user?.id ||
      user?.user_id ||
      user?.auth_user_id ||
      null;

    const cashierName =
      user?.full_name ||
      user?.name ||
      user?.username ||
      "Cashier";

    const accessToken =
      user?.access_token ||
      null;

    if (
      !shopId ||
      !cashierId ||
      !accessToken
    ) {
      setMessage(
        "Cashier login information is incomplete."
      );

      return;
    }

    try {
      setStartingShift(true);
      setMessage("");

      // ------------------------------------------
      // FRESH SHOP TYPE
      // ------------------------------------------

      const loadedShopType =
        await getShopType({
          shopId,
          accessToken,
          supabaseUrl,
          supabaseAnonKey,
        });

      setShopType(loadedShopType);

      // ------------------------------------------
      // 12-HOUR SAME-DAY LOCK
      // ------------------------------------------

      const today =
        getNairobiBusinessDate();

      if (
        loadedShopType ===
        "12_HOUR"
      ) {
        const todayClosed =
          await getClosedShiftForDate({
            shopId,
            businessDate: today,
            accessToken,
            supabaseUrl,
            supabaseAnonKey,
          });

        if (todayClosed) {
          setClosedForToday(true);

          setBalanceBF(
            String(
              todayClosed.closing_balance ??
                0
            )
          );

          setBalanceLocked(true);

          throw new Error(
            "This 12-hour shop has already completed today's shift."
          );
        }
      }

      // ------------------------------------------
      // SHOP-WIDE OPEN SHIFT CHECK
      // ------------------------------------------

      const openResponse =
        await fetch(
          `${supabaseUrl}/rest/v1/shifts` +
            `?shop_id=eq.${encodeURIComponent(shopId)}` +
            `&status=eq.OPEN` +
            `&select=*` +
            `&order=opened_at.desc` +
            `&limit=1`,
          {
            method: "GET",

            headers: authHeaders(
              supabaseAnonKey,
              accessToken
            ),

            cache: "no-store",
          }
        );

      const openResult =
        await safeJson(openResponse);

      if (!openResponse.ok) {
        throw new Error(
          openResult?.message ||
            openResult?.details ||
            "Unable to check open shifts."
        );
      }

      if (
        Array.isArray(openResult) &&
        openResult.length > 0
      ) {
        const existingOpen =
          openResult[0];

        const existingCashier =
          String(
            existingOpen.cashier_id ||
              ""
          );

        if (
          existingCashier ===
          String(cashierId)
        ) {
          // Repair existing 12-hour shift before
          // displaying it.
          if (
            loadedShopType ===
            "12_HOUR"
          ) {
            await ensure12HourOpeningReadings({
              shopId,

              shiftId:
                existingOpen.id,

              cashierId,

              accessToken,
              supabaseUrl,
              supabaseAnonKey,
            });
          }

          setCurrentShift(
            existingOpen
          );

          setBalanceBF(
            String(
              existingOpen.opening_balance ??
                0
            )
          );

          setBalanceLocked(true);

          return;
        }

        throw new Error(
          "This shop already has an open shift. It must be closed before another shift can start."
        );
      }

      // ------------------------------------------
      // PREVIOUS CLOSED SHIFT
      // ------------------------------------------

      const previousShift =
        await getLatestClosedShift({
          shopId,
          accessToken,
          supabaseUrl,
          supabaseAnonKey,
        });

      let openingBalance;

      if (previousShift) {
        // B/F ALWAYS comes from previous
        // shift Closing Balance.
        //
        // Zero is valid.
        openingBalance =
          Number(
            previousShift.closing_balance ??
              0
          );
      } else {
        if (
          balanceBF === "" ||
          balanceBF === null ||
          balanceBF === undefined
        ) {
          throw new Error(
            "Enter the opening Balance B/F."
          );
        }

        openingBalance =
          Number(balanceBF);

        if (
          Number.isNaN(openingBalance) ||
          openingBalance < 0
        ) {
          throw new Error(
            "Enter a valid Balance B/F."
          );
        }
      }

      // ==========================================
      // 12-HOUR SHIFT
      // ==========================================

      if (
        loadedShopType ===
        "12_HOUR"
      ) {
        const now =
          new Date();

        const end =
          new Date(
            now.getTime() +
              12 *
                60 *
                60 *
                1000
          );

        const businessDate =
          getNairobiBusinessDate();

        // ----------------------------------------
        // PREPARE AUTOMATIC PLATFORM OPENINGS
        //
        // NON-TABLE = 0
        // TABLE = PREVIOUS TABLE CLOSING
        //
        // Previous TABLE value 0 remains 0.
        // ----------------------------------------

        const openingReadings =
          await get12HourOpeningReadings({
            shopId,
            previousShift,
            accessToken,
            supabaseUrl,
            supabaseAnonKey,
          });

        // ----------------------------------------
        // CREATE SHIFT
        // ----------------------------------------

        const newShift =
          await createShift({
            shift: {
              shop_id:
                shopId,

              cashier_id:
                cashierId,

              cashier_name:
                cashierName,

              shift_name:
                "DAY",

              business_date:
                businessDate,

              scheduled_start:
                formatNairobiTime(
                  now
                ),

              scheduled_end:
                formatNairobiTime(
                  end
                ),

              opened_at:
                now.toISOString(),

              closed_at:
                null,

              status:
                "OPEN",

              // B/F = previous Closing Balance.
              opening_balance:
                roundMoney(
                  openingBalance
                ),

              total_added_float:
                0,

              total_output:
                0,

              total_expenses:
                0,

              net_income:
                roundMoney(
                  openingBalance
                ),

              closing_balance:
                roundMoney(
                  openingBalance
                ),

              notes:
                null,
            },

            accessToken,
            supabaseUrl,
            supabaseAnonKey,
          });

        // ----------------------------------------
        // SAVE ALL AUTOMATIC OPENINGS
        // ----------------------------------------

        await insert12HourOpeningReadings({
          shiftId:
            newShift.id,

          readings:
            openingReadings,

          cashierId,
          accessToken,
          supabaseUrl,
          supabaseAnonKey,
        });

        setCurrentShift(newShift);

        setBalanceBF(
          String(
            newShift.opening_balance ??
              0
          )
        );

        setBalanceLocked(true);
        setClosedForToday(false);
        setMessage("");

        return;
      }

      // ==========================================
      // 24-HOUR SHIFT
      // ==========================================

      if (
        loadedShopType ===
        "24_HOUR"
      ) {
        const nextShiftName =
          determineNext24HourShift(
            previousShift
          );

        const businessDate =
          get24HourBusinessDate(
            nextShiftName
          );

        const schedule =
          nextShiftName ===
          "SHIFT 1"
            ? {
                start:
                  "09:00:00",
                end:
                  "21:00:00",
              }
            : {
                start:
                  "21:00:00",
                end:
                  "09:00:00",
              };

        // ----------------------------------------
        // PLATFORM HANDOVER FROM PREVIOUS 24H SHIFT
        // ----------------------------------------

        let carryForwardReadings =
          [];

        if (
          previousShift &&
          isProper24HourShift(
            previousShift.shift_name
          )
        ) {
          carryForwardReadings =
            await get24HourCarryForwardReadings({
              shopId,
              previousShift,
              accessToken,
              supabaseUrl,
              supabaseAnonKey,
            });
        }

        const now =
          new Date();

        const newShift =
          await createShift({
            shift: {
              shop_id:
                shopId,

              cashier_id:
                cashierId,

              cashier_name:
                cashierName,

              shift_name:
                nextShiftName,

              business_date:
                businessDate,

              scheduled_start:
                schedule.start,

              scheduled_end:
                schedule.end,

              opened_at:
                now.toISOString(),

              closed_at:
                null,

              status:
                "OPEN",

              opening_balance:
                roundMoney(
                  openingBalance
                ),

              total_added_float:
                0,

              total_output:
                0,

              total_expenses:
                0,

              net_income:
                roundMoney(
                  openingBalance
                ),

              closing_balance:
                roundMoney(
                  openingBalance
                ),

              notes:
                null,
            },

            accessToken,
            supabaseUrl,
            supabaseAnonKey,
          });

        if (
          carryForwardReadings.length >
          0
        ) {
          await insert24HourOpeningReadings({
            shiftId:
              newShift.id,

            readings:
              carryForwardReadings,

            cashierId,
            accessToken,
            supabaseUrl,
            supabaseAnonKey,
          });
        }

        setCurrentShift(newShift);

        setBalanceBF(
          String(
            newShift.opening_balance ??
              0
          )
        );

        setBalanceLocked(true);
        setClosedForToday(false);
        setMessage("");

        return;
      }

      throw new Error(
        `Unsupported shop type: ${
          loadedShopType ||
          "UNKNOWN"
        }`
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
      <div style={loadingStyle}>
        Loading dashboard...
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // ==================================================
  // ADMIN
  // ==================================================

  if (
    String(
      user?.role || ""
    )
      .trim()
      .toUpperCase() ===
    "ADMIN"
  ) {
    return (
      <AdminDashboard
        user={user}
        onLogout={logout}
      />
    );
  }

  // ==================================================
  // OPEN SHIFT
  // ==================================================

  if (currentShift) {
    if (
      shopType ===
      "24_HOUR"
    ) {
      return (
        <Cashier24HourReport
          user={user}
          currentShift={
            currentShift
          }
        />
      );
    }

    return (
      <CashierReport
        user={user}
        currentShift={
          currentShift
        }
      />
    );
  }

  // ==================================================
  // 12-HOUR SHOP ALREADY CLOSED TODAY
  // ==================================================

  if (
    shopType ===
      "12_HOUR" &&
    closedForToday
  ) {
    return (
      <div style={startPageStyle}>
        <div style={startCardStyle}>
          <h1 style={titleStyle}>
            TEAM LEGEND
          </h1>

          <h2>
            Shift Completed
          </h2>

          <div style={shopBadgeStyle}>
            12-HOUR SHOP
          </div>

          <p style={mutedStyle}>
            This shop has already completed today's shift.
          </p>

          <div style={balancePreviewStyle}>
            Closing Balance: KES{" "}
            {money(balanceBF)}
          </div>

          <button
            type="button"
            onClick={logout}
            style={logoutStartButtonStyle}
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  // ==================================================
  // START SHIFT SCREEN
  // ==================================================

  return (
    <div style={startPageStyle}>
      <div style={startCardStyle}>
        <h1 style={titleStyle}>
          TEAM LEGEND
        </h1>

        <div style={subtitleStyle}>
          Start Cashier Shift
        </div>

        <div style={shopBadgeStyle}>
          {shopType ===
          "24_HOUR"
            ? "24-HOUR SHOP"
            : shopType ===
              "12_HOUR"
            ? "12-HOUR SHOP"
            : "SHOP"}
        </div>

        <div style={detailsStyle}>
          <div>
            <strong>
              Cashier:
            </strong>{" "}
            {user?.full_name ||
              user?.name ||
              user?.username ||
              "Cashier"}
          </div>

          <div>
            <strong>
              Shop:
            </strong>{" "}
            {user?.shop ||
              user?.shop_name ||
              user?.shopName ||
              "Shop"}
          </div>
        </div>

        {shopType ===
          "24_HOUR" && (
          <div style={infoStyle}>
            <strong>
              24-Hour Shift System
            </strong>

            <div>
              Shift 1: 9:00 AM – 9:00 PM
            </div>

            <div>
              Shift 2: 9:00 PM – 9:00 AM
            </div>
          </div>
        )}

        <label style={labelStyle}>
          Balance B/F
        </label>

        <input
          type="number"
          min="0"
          step="0.01"
          value={balanceBF}
          disabled={balanceLocked}
          onChange={(event) =>
            setBalanceBF(
              event.target.value
            )
          }
          style={{
            ...inputStyle,

            backgroundColor:
              balanceLocked
                ? "#f1f5f9"
                : "white",
          }}
        />

        {balanceLocked && (
          <div style={lockedTextStyle}>
            Balance B/F carried forward from the previous closed shift.
          </div>
        )}

        {message && (
          <div style={errorStyle}>
            {message}
          </div>
        )}

        <button
          type="button"
          onClick={startShift}
          disabled={startingShift}
          style={{
            ...startButtonStyle,

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

        <button
          type="button"
          onClick={logout}
          style={logoutStartButtonStyle}
        >
          Logout
        </button>
      </div>
    </div>
  );
}

// ==================================================
// GET SHOP TYPE
// ==================================================

async function getShopType({
  shopId,
  accessToken,
  supabaseUrl,
  supabaseAnonKey,
}) {
  const response =
    await fetch(
      `${supabaseUrl}/rest/v1/shops` +
        `?id=eq.${encodeURIComponent(shopId)}` +
        `&select=id,shop_name,shop_type,is_active` +
        `&limit=1`,
      {
        method: "GET",

        headers: authHeaders(
          supabaseAnonKey,
          accessToken
        ),

        cache: "no-store",
      }
    );

  const result =
    await safeJson(response);

  if (!response.ok) {
    throw new Error(
      result?.message ||
        result?.details ||
        "Unable to load shop type."
    );
  }

  if (
    !Array.isArray(result) ||
    result.length === 0
  ) {
    throw new Error(
      "Shop was not found."
    );
  }

  if (
    result[0]?.is_active ===
    false
  ) {
    throw new Error(
      "This shop is inactive."
    );
  }

  return String(
    result[0]?.shop_type ||
      ""
  )
    .trim()
    .toUpperCase();
}

// ==================================================
// GET CLOSED SHIFT FOR BUSINESS DATE
// ==================================================

async function getClosedShiftForDate({
  shopId,
  businessDate,
  accessToken,
  supabaseUrl,
  supabaseAnonKey,
}) {
  const response =
    await fetch(
      `${supabaseUrl}/rest/v1/shifts` +
        `?shop_id=eq.${encodeURIComponent(shopId)}` +
        `&business_date=eq.${encodeURIComponent(businessDate)}` +
        `&status=eq.CLOSED` +
        `&select=*` +
        `&order=closed_at.desc` +
        `&limit=1`,
      {
        method: "GET",

        headers: authHeaders(
          supabaseAnonKey,
          accessToken
        ),

        cache: "no-store",
      }
    );

  const result =
    await safeJson(response);

  if (!response.ok) {
    throw new Error(
      result?.message ||
        result?.details ||
        "Unable to check completed shifts."
    );
  }

  return Array.isArray(result) &&
    result.length > 0
    ? result[0]
    : null;
}

// ==================================================
// GET LATEST CLOSED SHIFT
// ==================================================

async function getLatestClosedShift({
  shopId,
  accessToken,
  supabaseUrl,
  supabaseAnonKey,
}) {
  const response =
    await fetch(
      `${supabaseUrl}/rest/v1/shifts` +
        `?shop_id=eq.${encodeURIComponent(shopId)}` +
        `&status=eq.CLOSED` +
        `&select=*` +
        `&order=closed_at.desc` +
        `&limit=1`,
      {
        method: "GET",

        headers: authHeaders(
          supabaseAnonKey,
          accessToken
        ),

        cache: "no-store",
      }
    );

  const result =
    await safeJson(response);

  if (!response.ok) {
    throw new Error(
      result?.message ||
        result?.details ||
        "Unable to load previous shift."
    );
  }

  return Array.isArray(result) &&
    result.length > 0
    ? result[0]
    : null;
}

// ==================================================
// REPAIR EXISTING 12-HOUR OPEN SHIFT OPENINGS
// ==================================================

async function ensure12HourOpeningReadings({
  shopId,
  shiftId,
  cashierId,
  accessToken,
  supabaseUrl,
  supabaseAnonKey,
}) {
  if (
    !shopId ||
    !shiftId ||
    !cashierId
  ) {
    throw new Error(
      "Unable to prepare automatic opening readings."
    );
  }

  // ----------------------------------------------
  // 1. LOAD ACTIVE PLATFORMS
  // ----------------------------------------------

  const platformResponse =
    await fetch(
      `${supabaseUrl}/rest/v1/shop_platforms` +
        `?shop_id=eq.${encodeURIComponent(shopId)}` +
        `&is_active=eq.true` +
        `&select=id,platform_name,display_order` +
        `&order=display_order.asc`,
      {
        method: "GET",

        headers: authHeaders(
          supabaseAnonKey,
          accessToken
        ),

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
        "Unable to load shop platforms."
    );
  }

  const platforms =
    Array.isArray(
      platformResult
    )
      ? platformResult
      : [];

  if (
    platforms.length === 0
  ) {
    throw new Error(
      "No active platforms were found for this shop."
    );
  }

  // ----------------------------------------------
  // 2. LOAD EXISTING OPENINGS
  // ----------------------------------------------

  const existingResponse =
    await fetch(
      `${supabaseUrl}/rest/v1/platform_readings` +
        `?shift_id=eq.${encodeURIComponent(shiftId)}` +
        `&reading_kind=eq.OPENING` +
        `&select=id,platform_id,reading_value,recorded_at`,
      {
        method: "GET",

        headers: authHeaders(
          supabaseAnonKey,
          accessToken
        ),

        cache: "no-store",
      }
    );

  const existingResult =
    await safeJson(
      existingResponse
    );

  if (!existingResponse.ok) {
    throw new Error(
      existingResult?.message ||
        existingResult?.details ||
        "Unable to check automatic opening readings."
    );
  }

  const existingReadings =
    Array.isArray(
      existingResult
    )
      ? existingResult
      : [];

  const existingPlatformIds =
    new Set(
      existingReadings.map(
        (reading) =>
          reading.platform_id
      )
    );

  // ----------------------------------------------
  // 3. FIND ONLY MISSING PLATFORMS
  // ----------------------------------------------

  const missingPlatforms =
    platforms.filter(
      (platform) =>
        !existingPlatformIds.has(
          platform.id
        )
    );

  if (
    missingPlatforms.length === 0
  ) {
    return;
  }

  const missingTable =
    missingPlatforms.find(
      (platform) =>
        isTablePlatform(
          platform.platform_name
        )
    ) || null;

  let tableOpening = 0;

  // ----------------------------------------------
  // 4. TABLE COMES FROM PREVIOUS CLOSED SHIFT
  // ----------------------------------------------

  if (missingTable) {
    const previousShift =
      await getLatestClosedShift({
        shopId,
        accessToken,
        supabaseUrl,
        supabaseAnonKey,
      });

    if (previousShift?.id) {
      const tableResponse =
        await fetch(
          `${supabaseUrl}/rest/v1/platform_readings` +
            `?shift_id=eq.${encodeURIComponent(previousShift.id)}` +
            `&platform_id=eq.${encodeURIComponent(missingTable.id)}` +
            `&reading_kind=eq.CLOSING` +
            `&select=id,platform_id,reading_value,recorded_at` +
            `&order=recorded_at.desc` +
            `&limit=1`,
          {
            method: "GET",

            headers: authHeaders(
              supabaseAnonKey,
              accessToken
            ),

            cache: "no-store",
          }
        );

      const tableResult =
        await safeJson(
          tableResponse
        );

      if (!tableResponse.ok) {
        throw new Error(
          tableResult?.message ||
            tableResult?.details ||
            "Unable to load previous TABLE closing."
        );
      }

      if (
        !Array.isArray(
          tableResult
        ) ||
        tableResult.length === 0
      ) {
        throw new Error(
          "Previous shift TABLE closing is missing. Contact Admin."
        );
      }

      const rawValue =
        tableResult[0]
          ?.reading_value;

      if (
        rawValue === null ||
        rawValue === undefined ||
        rawValue === ""
      ) {
        throw new Error(
          "Previous shift TABLE closing is missing. Contact Admin."
        );
      }

      const numericValue =
        Number(rawValue);

      if (
        Number.isNaN(
          numericValue
        ) ||
        numericValue < 0
      ) {
        throw new Error(
          "Previous shift TABLE closing is invalid. Contact Admin."
        );
      }

      // Zero remains zero.
      tableOpening =
        roundMoney(
          numericValue
        );
    } else {
      // First-ever shift.
      tableOpening = 0;
    }
  }

  // ----------------------------------------------
  // 5. BUILD ONLY MISSING OPENINGS
  //
  // NON-TABLE = 0
  // TABLE = previous TABLE closing
  // ----------------------------------------------

  const recordedAt =
    new Date().toISOString();

  const payload =
    missingPlatforms.map(
      (platform) => ({
        shift_id:
          shiftId,

        platform_id:
          platform.id,

        reading_kind:
          "OPENING",

        reading_value:
          isTablePlatform(
            platform.platform_name
          )
            ? tableOpening
            : 0,

        recorded_at:
          recordedAt,

        recorded_by:
          cashierId,
      })
    );

  // ----------------------------------------------
  // 6. INSERT ONLY MISSING ROWS
  // ----------------------------------------------

  const insertResponse =
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
            "return=minimal",
        },

        body:
          JSON.stringify(
            payload
          ),
      }
    );

  if (!insertResponse.ok) {
    const insertResult =
      await safeJson(
        insertResponse
      );

    throw new Error(
      insertResult?.message ||
        insertResult?.details ||
        insertResult?.hint ||
        "Unable to create missing automatic opening readings."
    );
  }
}

// ==================================================
// 12-HOUR AUTOMATIC PLATFORM OPENINGS
// ==================================================

async function get12HourOpeningReadings({
  shopId,
  previousShift,
  accessToken,
  supabaseUrl,
  supabaseAnonKey,
}) {
  const platformResponse =
    await fetch(
      `${supabaseUrl}/rest/v1/shop_platforms` +
        `?shop_id=eq.${encodeURIComponent(shopId)}` +
        `&is_active=eq.true` +
        `&select=id,platform_name,display_order` +
        `&order=display_order.asc`,
      {
        method: "GET",

        headers: authHeaders(
          supabaseAnonKey,
          accessToken
        ),

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
        "Unable to load 12-hour shop platforms."
    );
  }

  const platforms =
    Array.isArray(platformResult)
      ? platformResult
      : [];

  if (
    platforms.length === 0
  ) {
    throw new Error(
      "No active platforms were found for this shop."
    );
  }

  const tablePlatform =
    platforms.find(
      (platform) =>
        isTablePlatform(
          platform.platform_name
        )
    ) || null;

  let tableOpening = 0;

  if (
    tablePlatform &&
    previousShift?.id
  ) {
    const readingResponse =
      await fetch(
        `${supabaseUrl}/rest/v1/platform_readings` +
          `?shift_id=eq.${encodeURIComponent(previousShift.id)}` +
          `&platform_id=eq.${encodeURIComponent(tablePlatform.id)}` +
          `&reading_kind=eq.CLOSING` +
          `&select=id,platform_id,reading_value,recorded_at` +
          `&order=recorded_at.desc` +
          `&limit=1`,
        {
          method: "GET",

          headers: authHeaders(
            supabaseAnonKey,
            accessToken
          ),

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

    // Previous shift exists and this shop has TABLE.
    // Therefore TABLE closing must exist.
    //
    // A saved value of ZERO is valid.
    if (
      !Array.isArray(
        readingResult
      ) ||
      readingResult.length === 0
    ) {
      throw new Error(
        "Previous shift TABLE closing is missing. Contact Admin."
      );
    }

    const rawValue =
      readingResult[0]
        ?.reading_value;

    if (
      rawValue === null ||
      rawValue === undefined ||
      rawValue === ""
    ) {
      throw new Error(
        "Previous shift TABLE closing is missing. Contact Admin."
      );
    }

    const numericValue =
      Number(rawValue);

    if (
      Number.isNaN(
        numericValue
      ) ||
      numericValue < 0
    ) {
      throw new Error(
        "Previous shift TABLE closing is invalid. Contact Admin."
      );
    }

    tableOpening =
      roundMoney(
        numericValue
      );
  }

  return platforms.map(
    (platform) => ({
      platformId:
        platform.id,

      platformName:
        platform.platform_name,

      value:
        isTablePlatform(
          platform.platform_name
        )
          ? tableOpening
          : 0,
    })
  );
}

// ==================================================
// INSERT ALL 12-HOUR OPENING READINGS
// ==================================================

async function insert12HourOpeningReadings({
  shiftId,
  readings,
  cashierId,
  accessToken,
  supabaseUrl,
  supabaseAnonKey,
}) {
  if (
    !Array.isArray(readings) ||
    readings.length === 0
  ) {
    return;
  }

  const recordedAt =
    new Date().toISOString();

  const payload =
    readings.map(
      (reading) => ({
        shift_id:
          shiftId,

        platform_id:
          reading.platformId,

        reading_kind:
          "OPENING",

        reading_value:
          roundMoney(
            reading.value
          ),

        recorded_at:
          recordedAt,

        recorded_by:
          cashierId,
      })
    );

  const response =
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
            "return=minimal",
        },

        body:
          JSON.stringify(
            payload
          ),
      }
    );

  if (!response.ok) {
    const result =
      await safeJson(response);

    throw new Error(
      result?.message ||
        result?.details ||
        result?.hint ||
        "Shift was created, but automatic 12-hour opening readings could not be saved."
    );
  }
}
// ==================================================
// 24-HOUR PLATFORM CARRY FORWARD
// ==================================================

async function get24HourCarryForwardReadings({
  shopId,
  previousShift,
  accessToken,
  supabaseUrl,
  supabaseAnonKey,
}) {
  const previousName =
    normaliseShiftName(
      previousShift?.shift_name
    );

  let requiredKind;

  if (
    previousName ===
    "SHIFT 1"
  ) {
    requiredKind =
      "HANDOVER_9PM";
  } else if (
    previousName ===
    "SHIFT 2"
  ) {
    requiredKind =
      "CLOSING_9AM";
  } else {
    return [];
  }

  // ----------------------------------------------
  // ACTIVE SHOP PLATFORMS
  // ----------------------------------------------

  const platformResponse =
    await fetch(
      `${supabaseUrl}/rest/v1/shop_platforms` +
        `?shop_id=eq.${encodeURIComponent(shopId)}` +
        `&is_active=eq.true` +
        `&select=id,platform_name,display_order` +
        `&order=display_order.asc`,
      {
        method: "GET",

        headers: authHeaders(
          supabaseAnonKey,
          accessToken
        ),

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
        "Unable to load platforms for handover."
    );
  }

  const platforms =
    Array.isArray(platformResult)
      ? platformResult
      : [];

  if (
    platforms.length === 0
  ) {
    return [];
  }

  // ----------------------------------------------
  // REQUIRED HANDOVER READINGS
  // ----------------------------------------------

  const readingResponse =
    await fetch(
      `${supabaseUrl}/rest/v1/platform_readings` +
        `?shift_id=eq.${encodeURIComponent(previousShift.id)}` +
        `&reading_kind=eq.${encodeURIComponent(requiredKind)}` +
        `&select=id,platform_id,reading_kind,reading_value,recorded_at`,
      {
        method: "GET",

        headers: authHeaders(
          supabaseAnonKey,
          accessToken
        ),

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
        "Unable to load previous handover readings."
    );
  }

  const readings =
    Array.isArray(readingResult)
      ? readingResult
      : [];

  const readingMap =
    new Map();

  for (
    const reading of readings
  ) {
    readingMap.set(
      reading.platform_id,
      reading
    );
  }

  const missing =
    platforms.filter(
      (platform) =>
        !readingMap.has(
          platform.id
        )
    );

  if (
    missing.length > 0
  ) {
    throw new Error(
      `Previous ${previousName} is missing ${requiredKind} reading(s) for: ${missing
        .map(
          (platform) =>
            platform.platform_name
        )
        .join(", ")}.`
    );
  }

  return platforms.map(
    (platform) => {
      const reading =
        readingMap.get(
          platform.id
        );

      const rawValue =
        reading?.reading_value;

      if (
        rawValue === null ||
        rawValue === undefined ||
        rawValue === ""
      ) {
        throw new Error(
          `Previous ${previousName} has an invalid ${requiredKind} reading for ${platform.platform_name}.`
        );
      }

      const numericValue =
        Number(rawValue);

      if (
        Number.isNaN(
          numericValue
        ) ||
        numericValue < 0
      ) {
        throw new Error(
          `Previous ${previousName} has an invalid ${requiredKind} reading for ${platform.platform_name}.`
        );
      }

      return {
        platformId:
          platform.id,

        platformName:
          platform.platform_name,

        // Zero remains zero.
        value:
          numericValue,
      };
    }
  );
}

// ==================================================
// CREATE SHIFT
// ==================================================

async function createShift({
  shift,
  accessToken,
  supabaseUrl,
  supabaseAnonKey,
}) {
  const response =
    await fetch(
      `${supabaseUrl}/rest/v1/shifts`,
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

        body:
          JSON.stringify(
            shift
          ),
      }
    );

  const result =
    await safeJson(response);

  if (!response.ok) {
    throw new Error(
      result?.message ||
        result?.details ||
        result?.hint ||
        "Unable to create shift."
    );
  }

  if (
    !Array.isArray(result) ||
    result.length === 0
  ) {
    throw new Error(
      "Shift was created but could not be loaded."
    );
  }

  return result[0];
}

// ==================================================
// INSERT ALL 24-HOUR OPENING READINGS
// ==================================================

async function insert24HourOpeningReadings({
  shiftId,
  readings,
  cashierId,
  accessToken,
  supabaseUrl,
  supabaseAnonKey,
}) {
  if (
    !Array.isArray(readings) ||
    readings.length === 0
  ) {
    return;
  }

  const recordedAt =
    new Date().toISOString();

  const payload =
    readings.map(
      (reading) => ({
        shift_id:
          shiftId,

        platform_id:
          reading.platformId,

        reading_kind:
          "OPENING",

        reading_value:
          roundMoney(
            reading.value
          ),

        recorded_at:
          recordedAt,

        recorded_by:
          cashierId,
      })
    );

  const response =
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
            "return=minimal",
        },

        body:
          JSON.stringify(
            payload
          ),
      }
    );

  if (!response.ok) {
    const result =
      await safeJson(response);

    throw new Error(
      result?.message ||
        result?.details ||
        result?.hint ||
        "New shift was created, but platform handover readings could not be copied."
    );
  }
}

// ==================================================
// DETERMINE NEXT 24-HOUR SHIFT
// ==================================================

function determineNext24HourShift(
  previousShift
) {
  const previousName =
    normaliseShiftName(
      previousShift?.shift_name
    );

  if (
    previousName ===
    "SHIFT 1"
  ) {
    return "SHIFT 2";
  }

  if (
    previousName ===
    "SHIFT 2"
  ) {
    return "SHIFT 1";
  }

  const parts =
    getNairobiDateParts();

  const minutes =
    parts.hour * 60 +
    parts.minute;

  if (
    minutes >=
      9 * 60 &&
    minutes <
      21 * 60
  ) {
    return "SHIFT 1";
  }

  if (
    minutes >=
    21 * 60
  ) {
    return "SHIFT 2";
  }

  return "SHIFT 2";
}

// ==================================================
// 24-HOUR BUSINESS DATE
// ==================================================

function get24HourBusinessDate(
  shiftName
) {
  const parts =
    getNairobiDateParts();

  const today =
    datePartsToString(
      parts.year,
      parts.month,
      parts.day
    );

  if (
    shiftName !==
    "SHIFT 2"
  ) {
    return today;
  }

  if (
    parts.hour < 9
  ) {
    return addDaysToDateString(
      today,
      -1
    );
  }

  return today;
}

// ==================================================
// IS PROPER 24-HOUR SHIFT
// ==================================================

function isProper24HourShift(
  value
) {
  const name =
    normaliseShiftName(value);

  return (
    name === "SHIFT 1" ||
    name === "SHIFT 2"
  );
}

// ==================================================
// NAIROBI DATE
// ==================================================

function getNairobiBusinessDate() {
  const parts =
    getNairobiDateParts();

  return datePartsToString(
    parts.year,
    parts.month,
    parts.day
  );
}

function getNairobiDateParts() {
  const formatter =
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone:
          "Africa/Nairobi",

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",

        hour:
          "2-digit",

        minute:
          "2-digit",

        second:
          "2-digit",

        hourCycle:
          "h23",
      }
    );

  const parts =
    formatter.formatToParts(
      new Date()
    );

  const map = {};

  for (
    const part of parts
  ) {
    if (
      part.type !==
      "literal"
    ) {
      map[part.type] =
        part.value;
    }
  }

  return {
    year:
      Number(map.year),

    month:
      Number(map.month),

    day:
      Number(map.day),

    hour:
      Number(map.hour),

    minute:
      Number(map.minute),

    second:
      Number(map.second),
  };
}

function datePartsToString(
  year,
  month,
  day
) {
  return `${String(year).padStart(
    4,
    "0"
  )}-${String(month).padStart(
    2,
    "0"
  )}-${String(day).padStart(
    2,
    "0"
  )}`;
}

function addDaysToDateString(
  dateString,
  days
) {
  const [
    year,
    month,
    day,
  ] =
    String(dateString)
      .split("-")
      .map(Number);

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

  date.setUTCDate(
    date.getUTCDate() +
      days
  );

  return `${date.getUTCFullYear()}-${String(
    date.getUTCMonth() +
      1
  ).padStart(
    2,
    "0"
  )}-${String(
    date.getUTCDate()
  ).padStart(
    2,
    "0"
  )}`;
}

// ==================================================
// NAIROBI TIME
// ==================================================

function formatNairobiTime(
  date
) {
  const formatter =
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
    );

  const parts =
    formatter.formatToParts(
      date
    );

  const map = {};

  for (
    const part of parts
  ) {
    if (
      part.type !==
      "literal"
    ) {
      map[part.type] =
        part.value;
    }
  }

  return `${map.hour}:${map.minute}:${map.second}`;
}

// ==================================================
// GENERAL HELPERS
// ==================================================

function isTablePlatform(
  value
) {
  return (
    String(value || "")
      .trim()
      .toUpperCase() ===
    "TABLE"
  );
}

function normaliseShiftName(
  value
) {
  const text =
    String(value || "")
      .trim()
      .toUpperCase()
      .replace(
        /[_-]+/g,
        " "
      )
      .replace(
        /\s+/g,
        " "
      );

  if (
    text === "SHIFT 1" ||
    text === "SHIFT1"
  ) {
    return "SHIFT 1";
  }

  if (
    text === "SHIFT 2" ||
    text === "SHIFT2"
  ) {
    return "SHIFT 2";
  }

  return text;
}

function authHeaders(
  anonKey,
  accessToken
) {
  return {
    apikey:
      anonKey,

    Authorization:
      `Bearer ${accessToken}`,

    "Content-Type":
      "application/json",
  };
}

async function safeJson(
  response
) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function roundMoney(
  value
) {
  return (
    Math.round(
      (Number(value) +
        Number.EPSILON) *
        100
    ) / 100
  );
}

function money(
  value
) {
  return Number(
    value || 0
  ).toLocaleString(
    "en-KE",
    {
      minimumFractionDigits:
        2,

      maximumFractionDigits:
        2,
    }
  );
}

// ==================================================
// STYLES
// ==================================================

const loadingStyle = {
  minHeight:
    "100vh",

  display:
    "flex",

  alignItems:
    "center",

  justifyContent:
    "center",

  backgroundColor:
    "#edf2f7",

  fontFamily:
    "Arial, sans-serif",
};

const startPageStyle = {
  minHeight:
    "100vh",

  backgroundColor:
    "#edf2f7",

  display:
    "flex",

  alignItems:
    "center",

  justifyContent:
    "center",

  padding:
    "20px",

  fontFamily:
    "Arial, sans-serif",
};

const startCardStyle = {
  width:
    "100%",

  maxWidth:
    "470px",

  backgroundColor:
    "white",

  borderRadius:
    "12px",

  padding:
    "28px",

  boxShadow:
    "0 4px 20px rgba(0,0,0,0.10)",
};

const titleStyle = {
  margin:
    "0 0 6px 0",

  color:
    "#063c63",

  textAlign:
    "center",
};

const subtitleStyle = {
  textAlign:
    "center",

  color:
    "#64748b",

  marginBottom:
    "16px",
};

const shopBadgeStyle = {
  backgroundColor:
    "#063c63",

  color:
    "white",

  padding:
    "9px 12px",

  borderRadius:
    "6px",

  textAlign:
    "center",

  fontWeight:
    "bold",

  marginBottom:
    "18px",
};

const detailsStyle = {
  display:
    "grid",

  gap:
    "7px",

  padding:
    "12px",

  backgroundColor:
    "#f8fafc",

  borderRadius:
    "7px",

  marginBottom:
    "15px",
};

const infoStyle = {
  display:
    "grid",

  gap:
    "5px",

  backgroundColor:
    "#ecfdf5",

  color:
    "#166534",

  border:
    "1px solid #86efac",

  borderRadius:
    "7px",

  padding:
    "12px",

  marginBottom:
    "15px",
};

const labelStyle = {
  display:
    "block",

  fontWeight:
    "bold",

  marginBottom:
    "6px",
};

const inputStyle = {
  width:
    "100%",

  boxSizing:
    "border-box",

  padding:
    "11px",

  border:
    "1px solid #94a3b8",

  borderRadius:
    "6px",

  fontSize:
    "16px",
};

const lockedTextStyle = {
  color:
    "#64748b",

  fontSize:
    "12px",

  marginTop:
    "6px",
};

const errorStyle = {
  backgroundColor:
    "#fef2f2",

  color:
    "#991b1b",

  padding:
    "10px",

  borderRadius:
    "6px",

  marginTop:
    "12px",
};

const startButtonStyle = {
  width:
    "100%",

  marginTop:
    "18px",

  border:
    "none",

  borderRadius:
    "6px",

  padding:
    "12px",

  color:
    "white",

  fontWeight:
    "bold",

  fontSize:
    "15px",
};

const logoutStartButtonStyle = {
  width:
    "100%",

  marginTop:
    "10px",

  border:
    "1px solid #cbd5e1",

  borderRadius:
    "6px",

  padding:
    "11px",

  backgroundColor:
    "white",

  color:
    "#334155",

  fontWeight:
    "bold",

  cursor:
    "pointer",
};

const mutedStyle = {
  color:
    "#64748b",

  textAlign:
    "center",

  lineHeight:
    "1.6",
};

const balancePreviewStyle = {
  backgroundColor:
    "#ecfdf5",

  color:
    "#166534",

  padding:
    "12px",

  borderRadius:
    "7px",

  textAlign:
    "center",

  fontWeight:
    "bold",

  marginTop:
    "15px",
};
