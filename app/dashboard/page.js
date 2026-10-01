"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import PlatformReadings from "./PlatformReadings";
import ShiftIncomeEntries from "./ShiftIncomeEntries";
import ShiftExpenses from "./ShiftExpenses";
import ShiftSavings from "./ShiftSavings";
import ClosingPlatformReadings from "./ClosingPlatformReadings";
import CloseShift from "./CloseShift";

export default function Dashboard() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [balanceBF, setBalanceBF] = useState("");
  const [balanceLocked, setBalanceLocked] = useState(false);

  const [shiftStarted, setShiftStarted] = useState(false);
  const [currentShift, setCurrentShift] = useState(null);

  const [message, setMessage] = useState("");
  const [startingShift, setStartingShift] = useState(false);

  // --------------------------------------------------
  // LOAD USER + CURRENT SHIFT
  // --------------------------------------------------

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
          setLoading(false);
          return;
        }

        // --------------------------------------------
        // CHECK FOR EXISTING OPEN SHIFT
        // --------------------------------------------

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
              Authorization:
                `Bearer ${accessToken}`,
              "Content-Type":
                "application/json",
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

        if (
          Array.isArray(openShiftResult) &&
          openShiftResult.length > 0
        ) {
          const openShift =
            openShiftResult[0];

          setCurrentShift(openShift);
          setShiftStarted(true);

          setBalanceBF(
            String(
              openShift.opening_balance ?? ""
            )
          );

          setBalanceLocked(true);

          return;
        }

        // --------------------------------------------
        // NO OPEN SHIFT:
        // GET PREVIOUS CLOSED SHIFT
        // --------------------------------------------

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
        "Login authentication is missing. Please log in again."
      );
      return;
    }

    if (
      currentShift &&
      String(
        currentShift.status || ""
      ).toUpperCase() === "OPEN"
    ) {
      setMessage(
        "An open shift already exists."
      );
      return;
    }

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      setMessage(
        "Database configuration is missing."
      );
      return;
    }

    try {
      setStartingShift(true);
      setMessage("");

      // --------------------------------------------
      // GET PREVIOUS CLOSED SHIFT
      // --------------------------------------------

      const previousShift =
        await getLatestClosedShift({
          supabaseUrl,
          supabaseAnonKey,
          accessToken,
          shopId,
        });

      let openingBalance;

      if (previousShift) {
        // ------------------------------------------
        // AUTOMATIC BALANCE B/F
        // ------------------------------------------

        openingBalance =
          Number(
            previousShift.closing_balance ?? 0
          );

        setBalanceBF(
          String(openingBalance)
        );

        setBalanceLocked(true);
      } else {
        // ------------------------------------------
        // FIRST SHIFT - MANUAL BALANCE B/F
        // ------------------------------------------

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

      // --------------------------------------------
      // PREPARE TABLE CARRY-FORWARD
      // --------------------------------------------

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

      // --------------------------------------------
      // CREATE NEW SHIFT
      // --------------------------------------------

      const businessDate =
        new Intl.DateTimeFormat("en-CA", {
          timeZone: "Africa/Nairobi",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date());

      const now = new Date();

      const end = new Date(
        now.getTime() +
          12 * 60 * 60 * 1000
      );

      const scheduledStart =
        formatNairobiTime(now);

      const scheduledEnd =
        formatNairobiTime(end);

      const shiftData = {
        shop_id: shopId,
        cashier_id: cashierId,
        cashier_name: cashierName,

        shift_name: "DAY",

        business_date:
          businessDate,

        scheduled_start:
          scheduledStart,

        scheduled_end:
          scheduledEnd,

        opened_at:
          now.toISOString(),

        status: "OPEN",

        opening_balance:
          openingBalance,

        total_added_float: 0,
        total_output: 0,
        total_expenses: 0,
        net_income: 0,
        closing_balance: 0,
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

      let shiftResult = null;

      try {
        shiftResult =
          await shiftResponse.json();
      } catch {
        shiftResult = null;
      }

      if (!shiftResponse.ok) {
        console.error(
          "SHIFT INSERT ERROR:",
          shiftResult
        );

        throw new Error(
          shiftResult?.message ||
            shiftResult?.details ||
            shiftResult?.hint ||
            `Unable to open shift. Error ${shiftResponse.status}`
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

      // --------------------------------------------
      // AUTOMATIC TABLE OPENING
      //
      // NEW TABLE OPENING =
      // PREVIOUS TABLE CLOSING
      // --------------------------------------------

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
                  tableCarryForward
                    .platform.id,

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

        let tableResult = null;

        try {
          tableResult =
            await tableResponse.json();
        } catch {
          tableResult = null;
        }

        if (!tableResponse.ok) {
          console.error(
            "TABLE CARRY FORWARD ERROR:",
            tableResult
          );

          setCurrentShift(
            newShift
          );

          setShiftStarted(true);

          setMessage(
            "Shift opened, but TABLE opening could not be carried forward. Ask admin to correct the TABLE opening before continuing."
          );

          return;
        }
      }

      setCurrentShift(
        newShift
      );

      setShiftStarted(true);

      if (
        tableCarryForward?.platform &&
        tableCarryForward.value !== null
      ) {
        setMessage(
          `Shift opened successfully. Balance B/F carried forward as KES ${Number(
            openingBalance
          ).toLocaleString(
            "en-KE",
            {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }
          )}. TABLE opening carried forward as ${Number(
            tableCarryForward.value
          ).toLocaleString(
            "en-KE",
            {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }
          )}.`
        );
      } else {
        setMessage(
          "Shift opened successfully."
        );
      }
    } catch (error) {
      console.error(
        "START SHIFT ERROR:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to open shift."
      );
    } finally {
      setStartingShift(false);
    }
  }

  // --------------------------------------------------
  // SHIFT CLOSED
  // --------------------------------------------------

  function handleShiftClosed(
    closedShift
  ) {
    setCurrentShift(
      closedShift
    );

    setShiftStarted(true);

    setMessage(
      "Shift closed successfully."
    );
  }

  // --------------------------------------------------
  // LOADING
  // --------------------------------------------------

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
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

  // --------------------------------------------------
  // USER DETAILS
  // --------------------------------------------------

  const role =
    String(
      user.role || ""
    ).toUpperCase();

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
    new Intl.DateTimeFormat(
      "en-KE",
      {
        timeZone:
          "Africa/Nairobi",

        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }
    ).format(new Date());

  const displayedBalance =
    currentShift
      ? Number(
          currentShift.opening_balance ||
            0
        )
      : Number(
          balanceBF || 0
        );

  const currentShiftStatus =
    String(
      currentShift?.status || ""
    ).toUpperCase();

  const isCurrentShiftOpen =
    currentShiftStatus ===
    "OPEN";

  const isCurrentShiftClosed =
    currentShiftStatus ===
    "CLOSED";

  // --------------------------------------------------
  // PAGE
  // --------------------------------------------------

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
            backgroundColor:
              "#dc2626",
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
            <h1
              style={{
                marginTop: 0,
              }}
            >
              Admin Dashboard
            </h1>

            <p>
              Welcome to Team Legend
              Sales Management System.
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
            <div
              style={{
                marginBottom:
                  "25px",
              }}
            >
              <h1
                style={{
                  margin: 0,
                }}
              >
                {shopName}
              </h1>

              <p
                style={{
                  marginTop:
                    "7px",
                  color:
                    "#64748b",
                }}
              >
                Cashier Dashboard
              </p>
            </div>

            {/* SHOP INFORMATION */}

            <div
              style={{
                backgroundColor:
                  "white",
                padding: "22px",
                borderRadius:
                  "12px",

                boxShadow:
                  "0 2px 10px rgba(0,0,0,0.08)",

                marginBottom:
                  "20px",
              }}
            >
              <h2
                style={{
                  marginTop: 0,
                }}
              >
                {shopName}
              </h2>

              <p>
                <strong>
                  Cashier:
                </strong>{" "}
                {cashierName}
              </p>

              <p>
                <strong>
                  Date:
                </strong>{" "}
                {today}
              </p>

              <p
                style={{
                  marginBottom: 0,
                }}
              >
                <strong>
                  Status:
                </strong>{" "}

                <span
                  style={{
                    color:
                      isCurrentShiftClosed
                        ? "#dc2626"
                        : "#15803d",

                    fontWeight:
                      "bold",
                  }}
                >
                  {isCurrentShiftClosed
                    ? "SHIFT CLOSED"
                    : "ACTIVE"}
                </span>
              </p>
            </div>

            {/* OPENING SHIFT */}

            <div
              style={{
                backgroundColor:
                  "white",

                padding: "25px",

                borderRadius:
                  "12px",

                boxShadow:
                  "0 2px 10px rgba(0,0,0,0.08)",

                maxWidth:
                  "700px",
              }}
            >
              <h2
                style={{
                  marginTop: 0,
                }}
              >
                Opening Shift
              </h2>

              {!shiftStarted ||
              !currentShift ? (
                <>
                  <p
                    style={{
                      color:
                        "#64748b",

                      marginBottom:
                        "20px",
                    }}
                  >
                    {balanceLocked
                      ? "Balance B/F has been carried forward automatically from the previous shift."
                      : "Enter the opening balance before starting work."}
                  </p>

                  <label
                    style={{
                      display:
                        "block",

                      fontWeight:
                        "bold",

                      marginBottom:
                        "8px",
                    }}
                  >
                    Balance B/F (KES)
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"

                    value={
                      balanceBF
                    }

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

                    placeholder="Enter opening balance"

                    style={{
                      width: "100%",
                      padding: "13px",

                      border:
                        "1px solid #cbd5e1",

                      borderRadius:
                        "8px",

                      boxSizing:
                        "border-box",

                      fontSize:
                        "16px",

                      marginBottom:
                        balanceLocked
                          ? "8px"
                          : "18px",

                      backgroundColor:
                        balanceLocked
                          ? "#f1f5f9"
                          : "white",
                    }}
                  />

                  {balanceLocked && (
                    <div
                      style={{
                        color:
                          "#166534",

                        fontSize:
                          "13px",

                        marginBottom:
                          "18px",

                        fontWeight:
                          "bold",
                      }}
                    >
                      Carried forward from
                      previous Closing
                      Balance ✓
                    </div>
                  )}

                  {message && (
                    <div
                      style={{
                        marginBottom:
                          "16px",

                        padding:
                          "10px",

                        backgroundColor:
                          "#fef2f2",

                        color:
                          "#991b1b",

                        borderRadius:
                          "8px",
                      }}
                    >
                      {message}
                    </div>
                  )}

                  <button
                    onClick={
                      startShift
                    }

                    disabled={
                      startingShift
                    }

                    style={{
                      width:
                        "100%",

                      padding:
                        "14px",

                      border:
                        "none",

                      borderRadius:
                        "8px",

                      backgroundColor:
                        startingShift
                          ? "#94a3b8"
                          : "#168d32",

                      color:
                        "white",

                      fontSize:
                        "16px",

                      fontWeight:
                        "bold",

                      cursor:
                        startingShift
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
                      padding:
                        "14px",

                      backgroundColor:
                        isCurrentShiftClosed
                          ? "#fef2f2"
                          : "#ecfdf5",

                      borderRadius:
                        "8px",

                      color:
                        isCurrentShiftClosed
                          ? "#991b1b"
                          : "#166534",

                      marginBottom:
                        "18px",
                    }}
                  >
                    {isCurrentShiftClosed
                      ? "Shift is closed."
                      : "Shift is open."}
                  </div>

                  <p>
                    <strong>
                      Shop:
                    </strong>{" "}
                    {shopName}
                  </p>

                  <p>
                    <strong>
                      Cashier:
                    </strong>{" "}
                    {cashierName}
                  </p>

                  <p>
                    <strong>
                      Balance B/F:
                    </strong>{" "}
                    KES{" "}
                    {displayedBalance.toLocaleString(
                      "en-KE",
                      {
                        minimumFractionDigits:
                          2,

                        maximumFractionDigits:
                          2,
                      }
                    )}
                  </p>

                  {currentShift.scheduled_start && (
                    <p>
                      <strong>
                        Scheduled Start:
                      </strong>{" "}
                      {displayShiftTime(
                        currentShift.scheduled_start
                      )}
                    </p>
                  )}

                  {currentShift.scheduled_end && (
                    <p>
                      <strong>
                        Scheduled End:
                      </strong>{" "}
                      {displayShiftTime(
                        currentShift.scheduled_end
                      )}
                    </p>
                  )}

                  <p
                    style={{
                      marginBottom: 0,
                    }}
                  >
                    <strong>
                      Shift Status:
                    </strong>{" "}

                    <span
                      style={{
                        color:
                          isCurrentShiftClosed
                            ? "#dc2626"
                            : "#15803d",

                        fontWeight:
                          "bold",
                      }}
                    >
                      {
                        currentShift.status
                      }
                    </span>
                  </p>
                </div>
              )}
            </div>

            {/* OPEN SHIFT MODULES */}

            {shiftStarted &&
              currentShift &&
              isCurrentShiftOpen && (
                <>
                  <PlatformReadings
                    user={user}
                    currentShift={
                      currentShift
                    }
                  />

                  <ShiftIncomeEntries
                    user={user}
                    currentShift={
                      currentShift
                    }
                  />

                  <ShiftExpenses
                    user={user}
                    currentShift={
                      currentShift
                    }
                  />

                  <ShiftSavings
                    user={user}
                    currentShift={
                      currentShift
                    }
                  />

                  <ClosingPlatformReadings
                    user={user}
                    currentShift={
                      currentShift
                    }
                  />

                  <CloseShift
                    user={user}
                    currentShift={
                      currentShift
                    }
                    onShiftClosed={
                      handleShiftClosed
                    }
                  />
                </>
              )}

            {/* CLOSED SHIFT SUMMARY */}

            {currentShift &&
              isCurrentShiftClosed && (
                <div
                  style={{
                    marginTop:
                      "24px",

                    backgroundColor:
                      "white",

                    padding:
                      "25px",

                    borderRadius:
                      "12px",

                    boxShadow:
                      "0 2px 10px rgba(0,0,0,0.08)",

                    maxWidth:
                      "700px",
                  }}
                >
                  <h2
                    style={{
                      marginTop:
                        0,
                    }}
                  >
                    Shift Completed
                  </h2>

                  <div
                    style={{
                      padding:
                        "14px",

                      backgroundColor:
                        "#ecfdf5",

                      color:
                        "#166534",

                      borderRadius:
                        "8px",

                      fontWeight:
                        "bold",

                      marginBottom:
                        "18px",
                    }}
                  >
                    Shift Closed ✓
                  </div>

                  <p>
                    <strong>
                      Net Income:
                    </strong>{" "}
                    KES{" "}
                    {Number(
                      currentShift.net_income ||
                        0
                    ).toLocaleString(
                      "en-KE",
                      {
                        minimumFractionDigits:
                          2,

                        maximumFractionDigits:
                          2,
                      }
                    )}
                  </p>

                  <p
                    style={{
                      marginBottom: 0,
                    }}
                  >
                    <strong>
                      Closing Balance:
                    </strong>{" "}
                    KES{" "}
                    {Number(
                      currentShift.closing_balance ||
                        0
                    ).toLocaleString(
                      "en-KE",
                      {
                        minimumFractionDigits:
                          2,

                        maximumFractionDigits:
                          2,
                      }
                    )}
                  </p>
                </div>
              )}

            <p
              style={{
                marginTop: "20px",
                color: "#64748b",
                fontSize: "13px",
              }}
            >
              You can only access your
              assigned shop.
            </p>
          </>
        )}
      </section>
    </main>
  );
}

// ==================================================
// GET LATEST CLOSED SHIFT FOR SHOP
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
      `&select=id,shop_id,closing_balance,closed_at` +
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

  let result = null;

  try {
    result =
      await response.json();
  } catch {
    result = null;
  }

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
// GET PREVIOUS TABLE CLOSING
// ==================================================

async function getTableCarryForward({
  supabaseUrl,
  supabaseAnonKey,
  accessToken,
  shopId,
  previousShiftId,
}) {
  // --------------------------------------------
  // FIND TABLE PLATFORM
  // --------------------------------------------

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

  let platformResult = null;

  try {
    platformResult =
      await platformResponse.json();
  } catch {
    platformResult = null;
  }

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

  // --------------------------------------------
  // GET PREVIOUS TABLE CLOSING
  // --------------------------------------------

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

  let readingResult = null;

  try {
    readingResult =
      await readingResponse.json();
  } catch {
    readingResult = null;
  }

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
// DASHBOARD CARD
// ==================================================

function DashboardCard({
  title,
  value,
}) {
  return (
    <div
      style={{
        backgroundColor:
          "white",

        borderRadius:
          "10px",

        padding:
          "22px",

        boxShadow:
          "0 2px 10px rgba(0,0,0,0.08)",
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
          margin:
            "8px 0 0",
        }}
      >
        {value}
      </h2>
    </div>
  );
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

// ==================================================
// DISPLAY SHIFT TIME
// ==================================================

function displayShiftTime(
  value
) {
  if (!value) {
    return "-";
  }

  return String(value)
    .split(".")[0]
    .slice(0, 8);
}
