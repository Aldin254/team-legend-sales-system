"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import CashierReport from "./CashierReport";
import Cashier24HourReport from "./Cashier24HourReport";
import CashierRecoveryPreview from "./CashierRecoveryPreview";
import AdminDashboard from "./AdminDashboard";
import AccountantDashboard from "./AccountantDashboard";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const authHeaders = (token) => ({
  apikey: ANON,
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
});

async function json(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function restGet(path, token) {
  const response = await fetch(`${URL}/rest/v1/${path}`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  const value = await json(response);

  if (!response.ok) {
    throw new Error(
      value?.message || value?.details || "Database request failed."
    );
  }
  return value;
}

async function restPost(path, token, body, returnRepresentation = false) {
  const response = await fetch(`${URL}/rest/v1/${path}`, {
    method: "POST",
    headers: {
      ...authHeaders(token),
      ...(returnRepresentation ? { Prefer: "return=representation" } : {}),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const value = await json(response);
  if (!response.ok) {
    throw new Error(
      value?.message || value?.details || value?.hint || "Save failed."
    );
  }
  return value;
}

async function getRecoveryAssignment(token) {
  const value = await restPost(
    "rpc/tl_cashier_active_shift_recovery",
    token,
    {}
  );

  if (!Array.isArray(value)) {
    throw new Error("Unexpected response when checking Admin recovery.");
  }

  return value[0] || null;
}

async function getRecoveryTarget(assignment, shopId, token) {
  if (!assignment?.target_shift_id) {
    throw new Error("The Admin recovery target is missing.");
  }

  const rows = await restGet(
    `shifts?id=eq.${encodeURIComponent(assignment.target_shift_id)}` +
      `&shop_id=eq.${encodeURIComponent(shopId)}&select=*&limit=1`,
    token
  );

  if (!Array.isArray(rows) || !rows[0]) {
    throw new Error("Recovery target not found in your shop.");
  }

  return rows[0];
}

const cashierShop = (u) =>
  u?.shop_id || u?.shopId || null;

const cashierProfile = (u) =>
  u?.profile_id || u?.id || u?.user_id || u?.auth_user_id || null;

export default function DashboardPage() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [balanceBF, setBalanceBF] = useState("");
  const [balanceLocked, setBalanceLocked] = useState(false);
  const [currentShift, setCurrentShift] = useState(null);
  const [shopType, setShopType] = useState("");
  const [closedForToday, setClosedForToday] = useState(false);
  const [message, setMessage] = useState("");
  const [startingShift, setStartingShift] = useState(false);

  const [recoveryView, setRecoveryView] = useState(null);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [recoveryError, setRecoveryError] = useState("");

  const refreshPromiseRef = useRef(null);
  const wasRecoveringRef = useRef(false);
  const recoveryPollRef = useRef(false);

  // ==========================================
  // SAVE USER SESSION
  // ==========================================

  const saveUserSession = useCallback((nextUser) => {
    if (!nextUser) return;

    sessionStorage.setItem(
      "teamLegendUser",
      JSON.stringify(nextUser)
    );

    setUser(nextUser);
  }, []);

  // ==========================================
  // EXPIRED SESSION
  // ==========================================

  const expireSession = useCallback(() => {
    sessionStorage.removeItem("teamLegendUser");
    setUser(null);
    setCurrentShift(null);
    setRecoveryView(null);
    router.replace("/");
  }, [router]);

  // ==========================================
  // REFRESH USER TOKEN
  // ==========================================

  const refreshUserSession = useCallback(
    async (u, options = {}) => {
      if (!u) throw sessionExpired();

      if (
        !options.force &&
        u.access_token &&
        !shouldRefreshToken(u)
      ) {
        return u;
      }

      if (!u.refresh_token) throw sessionExpired();

      if (!URL || !ANON) {
        throw new Error("Server configuration is incomplete.");
      }

      if (refreshPromiseRef.current) {
        return refreshPromiseRef.current;
      }

      const task = (async () => {
        const response = await fetch(
          `${URL}/auth/v1/token?grant_type=refresh_token`,
          {
            method: "POST",
            headers: {
              apikey: ANON,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              refresh_token: u.refresh_token,
            }),
            cache: "no-store",
          }
        );

        const result = await json(response);

        if (!response.ok || !result?.access_token) {
          throw sessionExpired();
        }

        const expiresAt =
          Number(result.expires_at) ||
          Math.floor(Date.now() / 1000) +
            Number(result.expires_in || 3600);

        const next = {
          ...u,
          id: result.user?.id || u.id,
          auth_user_id: result.user?.id || u.auth_user_id,
          access_token: result.access_token,
          refresh_token: result.refresh_token || u.refresh_token,
          expires_at: expiresAt,
          expires_in: result.expires_in || u.expires_in,
          token_type:
            result.token_type || u.token_type || "bearer",
        };

        saveUserSession(next);
        return next;
      })();

      refreshPromiseRef.current = task;

      try {
        return await task;
      } finally {
        refreshPromiseRef.current = null;
      }
    },
    [saveUserSession]
  );

  // ==========================================
  // INITIAL DASHBOARD LOAD
  // CHECK RECOVERY BEFORE NORMAL SHIFT
  // ==========================================

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      setLoading(true);
      setMessage("");
      setRecoveryReady(false);

      try {
        const raw = sessionStorage.getItem("teamLegendUser");

        if (!raw) {
          router.replace("/");
          return;
        }

        let stored;

        try {
          stored = JSON.parse(raw);
        } catch {
          expireSession();
          return;
        }

        const active = await refreshUserSession(stored);
        if (cancelled) return;

        saveUserSession(active);

        const role = String(active.role || "")
          .trim()
          .toUpperCase();

        if (role === "ADMIN" || role === "ACCOUNTANT") {
          return;
        }

        if (role !== "CASHIER") {
          throw new Error("Account does not have system access.");
        }

        const shopId = cashierShop(active);
        const cashierId = cashierProfile(active);
        const token = active.access_token;

        if (!shopId || !cashierId || !token) {
          throw new Error("Cashier login information is incomplete.");
        }

        const type = await getShopType(shopId, token);
        if (cancelled) return;

        setShopType(type);

        // ADMIN RECOVERY TAKES PRIORITY

        const recovery = await getRecoveryAssignment(token);
        if (cancelled) return;

        if (recovery) {
          const target = await getRecoveryTarget(
            recovery,
            shopId,
            token
          );

          if (cancelled) return;

          wasRecoveringRef.current = true;

          setRecoveryView({
            assignment: recovery,
            shift: target,
          });

          setCurrentShift(null);
          setClosedForToday(false);
          setRecoveryError("");
          setRecoveryReady(true);
          return;
        }

        setRecoveryReady(true);
        setRecoveryView(null);
        setRecoveryError("");

        // NORMAL OPEN SHIFT FOR THIS CASHIER

        const mine = await restGet(
          `shifts?shop_id=eq.${encodeURIComponent(shopId)}` +
            `&cashier_id=eq.${encodeURIComponent(cashierId)}` +
            `&status=eq.OPEN&select=*&order=opened_at.desc&limit=1`,
          token
        );

        if (cancelled) return;

        const open = mine?.[0];

        if (open) {
          if (type === "12_HOUR") {
            // Recheck before automatically repairing readings.

            const newlyActive = await getRecoveryAssignment(token);

            if (newlyActive) {
              const target = await getRecoveryTarget(
                newlyActive,
                shopId,
                token
              );

              if (!cancelled) {
                wasRecoveringRef.current = true;

                setRecoveryView({
                  assignment: newlyActive,
                  shift: target,
                });
              }
              return;
            }

            await ensure12HourOpeningReadings(
              shopId,
              open.id,
              cashierId,
              token
            );
          }

          if (cancelled) return;

          setCurrentShift(open);
          setBalanceBF(String(open.opening_balance ?? 0));
          setBalanceLocked(true);
          setClosedForToday(false);
          return;
        }

        // 12-HOUR SHOP ALREADY CLOSED TODAY

        if (type === "12_HOUR") {
          const completed = await getClosedShiftForDate(
            shopId,
            nairobiDate(),
            token
          );

          if (cancelled) return;

          if (completed) {
            setClosedForToday(true);
            setBalanceBF(
              String(completed.closing_balance ?? 0)
            );
            setBalanceLocked(true);
            return;
          }
        }

        // LAST CLOSED SHIFT

        const previous = await getLatestClosedShift(
          shopId,
          token
        );

        if (cancelled) return;

        setBalanceBF(
          previous
            ? String(previous.closing_balance ?? 0)
            : ""
        );

        setBalanceLocked(Boolean(previous));
        setClosedForToday(false);
      } catch (e) {
        if (e?.name === "SessionExpiredError") {
          if (!cancelled) expireSession();
          return;
        }

        if (!cancelled) {
          setMessage(
            e?.message || "Unable to load dashboard."
          );

          setRecoveryError(
            e?.message || "Recovery verification failed."
          );

          setRecoveryReady(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    initialize();

    return () => {
      cancelled = true;
    };
  }, [
    router,
    refreshUserSession,
    saveUserSession,
    expireSession,
  ]);
  // ==========================================
  // LIVE RECOVERY CHECK — EVERY 8 SECONDS
  // ==========================================

  useEffect(() => {
    if (
      String(user?.role || "").toUpperCase() !== "CASHIER"
    ) {
      return;
    }

    if (!user.access_token || !cashierShop(user)) {
      return;
    }

    let cancelled = false;

    async function poll() {
      if (recoveryPollRef.current) return;
      recoveryPollRef.current = true;

      try {
        const active = await getRecoveryAssignment(
          user.access_token
        );

        if (cancelled) return;

        if (active) {
          const target = await getRecoveryTarget(
            active,
            cashierShop(user),
            user.access_token
          );

          if (cancelled) return;

          wasRecoveringRef.current = true;

          setRecoveryView({
            assignment: active,
            shift: target,
          });

          setRecoveryError("");
          setRecoveryReady(true);
        } else if (wasRecoveringRef.current) {
          // Admin ended recovery.
          // Reload to select the normal OPEN shift.

          window.location.reload();
        } else {
          setRecoveryView(null);
          setRecoveryError("");
          setRecoveryReady(true);
        }
      } catch (e) {
        if (!cancelled) {
          setRecoveryError(
            e?.message ||
              "Unable to verify Admin recovery."
          );

          setRecoveryReady(true);
        }
      } finally {
        recoveryPollRef.current = false;
      }
    }

    const timer = setInterval(poll, 8000);

    const onFocus = () => {
      void poll();
    };

    window.addEventListener("focus", onFocus);
    void poll();

    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [
    user?.access_token,
    user?.role,
    user?.shop_id,
    user?.shopId,
  ]);

  // ==========================================
  // AUTOMATIC TOKEN REFRESH
  // ==========================================

  useEffect(() => {
    if (!user?.access_token) return;

    let cancelled = false;

    async function refresh() {
      try {
        await refreshUserSession(user);
      } catch (e) {
        if (
          !cancelled &&
          e?.name === "SessionExpiredError"
        ) {
          expireSession();
        }
      }
    }

    const timer = setInterval(refresh, 60000);

    const onFocus = () => {
      void refresh();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener(
      "visibilitychange",
      onVisibility
    );

    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener(
        "visibilitychange",
        onVisibility
      );
    };
  }, [user, refreshUserSession, expireSession]);

  // ==========================================
  // LOGOUT
  // ==========================================

  function logout() {
    expireSession();
  }

  // ==========================================
  // START NORMAL SHIFT
  // ==========================================

  async function startShift() {
    if (!user || startingShift) return;

    setStartingShift(true);
    setMessage("");

    try {
      if (
        !recoveryReady ||
        recoveryView ||
        recoveryError
      ) {
        throw new Error(
          "Admin recovery is active or cannot be verified."
        );
      }

      if (closedForToday) {
        throw new Error(
          "This 12-hour shop has already closed today."
        );
      }

      const active = await refreshUserSession(user);

      const shopId = cashierShop(active);
      const cashierId = cashierProfile(active);

      const cashierName =
        active.full_name ||
        active.name ||
        active.username ||
        "Cashier";

      const token = active.access_token;

      if (!shopId || !cashierId || !token) {
        throw new Error("Incomplete cashier login.");
      }

      // FRESH RECOVERY CHECK BEFORE OPENING

      if (await getRecoveryAssignment(token)) {
        throw new Error(
          "Admin Recovery is ACTIVE. Wait until it ends."
        );
      }

      const type = await getShopType(shopId, token);
      setShopType(type);

      // 12-HOUR SAME-DAY LOCK

      if (type === "12_HOUR") {
        const closed = await getClosedShiftForDate(
          shopId,
          nairobiDate(),
          token
        );

        if (closed) {
          setClosedForToday(true);
          setBalanceBF(
            String(closed.closing_balance ?? 0)
          );
          setBalanceLocked(true);

          throw new Error(
            "This 12-hour shop already completed today's shift."
          );
        }
      }

      // SHOP-WIDE OPEN SHIFT CHECK

      const open = await restGet(
        `shifts?shop_id=eq.${encodeURIComponent(shopId)}` +
          `&status=eq.OPEN&select=*&order=opened_at.desc&limit=1`,
        token
      );

      if (open?.length) {
        const existing = open[0];

        if (
          String(existing.cashier_id) !== String(cashierId)
        ) {
          throw new Error(
            "Another cashier already has an OPEN shift for this shop."
          );
        }

        if (type === "12_HOUR") {
          if (await getRecoveryAssignment(token)) {
            throw new Error("Admin recovery started.");
          }

          await ensure12HourOpeningReadings(
            shopId,
            existing.id,
            cashierId,
            token
          );
        }

        setCurrentShift(existing);
        setBalanceBF(
          String(existing.opening_balance ?? 0)
        );
        setBalanceLocked(true);
        return;
      }

      // PREVIOUS CLOSED SHIFT

      const previous = await getLatestClosedShift(
        shopId,
        token
      );

      let bf;

      if (previous) {
        bf = Number(previous.closing_balance ?? 0);
      } else {
        if (
          balanceBF === "" ||
          !Number.isFinite(Number(balanceBF)) ||
          Number(balanceBF) < 0
        ) {
          throw new Error(
            "Enter a valid opening Balance B/F."
          );
        }

        bf = Number(balanceBF);
      }

      const now = new Date();

      const base = {
        shop_id: shopId,
        cashier_id: cashierId,
        cashier_name: cashierName,
        opened_at: now.toISOString(),
        closed_at: null,
        status: "OPEN",
        opening_balance: roundMoney(bf),
        total_added_float: 0,
        total_output: 0,
        total_expenses: 0,
        net_income: roundMoney(bf),
        closing_balance: roundMoney(bf),
        notes: null,
      };

      // ======================================
      // 12-HOUR SHIFT
      // ======================================

      if (type === "12_HOUR") {
        const readings = await get12HourOpeningReadings(
          shopId,
          previous,
          token
        );

        if (await getRecoveryAssignment(token)) {
          throw new Error("Admin recovery started.");
        }

        const end = new Date(
          now.getTime() + 12 * 3600000
        );

        const newShift = await createShift(
          {
            ...base,
            shift_name: "DAY",
            business_date: nairobiDate(),
            scheduled_start: nairobiTime(now),
            scheduled_end: nairobiTime(end),
          },
          token
        );

        await insertOpeningReadings(
          newShift.id,
          readings,
          cashierId,
          token
        );

        setCurrentShift(newShift);
        setBalanceBF(
          String(newShift.opening_balance ?? 0)
        );
        setBalanceLocked(true);
        setClosedForToday(false);
        return;
      }

      // ======================================
      // 24-HOUR SHIFT
      // ======================================

      if (type === "24_HOUR") {
        const shiftName =
          determineNext24HourShift(previous);

        const readings =
          previous && proper24h(previous.shift_name)
            ? await get24HourCarryForwardReadings(
                shopId,
                previous,
                token
              )
            : [];

        if (await getRecoveryAssignment(token)) {
          throw new Error("Admin recovery started.");
        }

        const newShift = await createShift(
          {
            ...base,
            cashier_name: "NOT ASSIGNED",
            shift_name: shiftName,
            business_date:
              get24HourBusinessDate(shiftName),
            scheduled_start:
              shiftName === "SHIFT 1"
                ? "09:00:00"
                : "21:00:00",
            scheduled_end:
              shiftName === "SHIFT 1"
                ? "21:00:00"
                : "09:00:00",
          },
          token
        );

        await insertOpeningReadings(
          newShift.id,
          readings,
          cashierId,
          token
        );

        setCurrentShift(newShift);
        setBalanceBF(
          String(newShift.opening_balance ?? 0)
        );
        setBalanceLocked(true);
        setClosedForToday(false);
        return;
      }

      throw new Error(
        `Unsupported shop type: ${type || "UNKNOWN"}`
      );
    } catch (e) {
      if (e?.name === "SessionExpiredError") {
        expireSession();
      } else {
        setMessage(
          e?.message || "Unable to start shift."
        );
      }
    } finally {
      setStartingShift(false);
    }
  }

  // ==========================================
  // DISPLAY
  // ==========================================

  if (loading) {
    return (
      <div style={loadingStyle}>
        Loading dashboard...
      </div>
    );
  }

  if (!user) return null;

  const role = String(user.role || "")
    .trim()
    .toUpperCase();

  if (role === "ADMIN") {
    return <AdminDashboard user={user} />;
  }

  if (role === "ACCOUNTANT") {
    return <AccountantDashboard user={user} />;
  }

  if (!recoveryReady) {
    return (
      <div style={loadingStyle}>
        Checking Admin recovery...
      </div>
    );
  }

  // IF RECOVERY CHECK FAILS, DO NOT DISPLAY
  // EDITABLE CASHIER FINANCIAL CONTROLS

  if (recoveryError) {
    return (
      <div style={startPageStyle}>
        <div style={startCardStyle}>
          <h2>Recovery verification unavailable</h2>
          <p style={errorStyle}>{recoveryError}</p>
          <p style={mutedStyle}>
            The website will automatically retry.
          </p>
          <button
            style={logoutButton}
            onClick={logout}
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  // HISTORICAL SHIFT — READ ONLY

  if (recoveryView) {
    return (
      <CashierRecoveryPreview
        user={user}
        recoveryAssignment={recoveryView.assignment}
        recoveryShift={recoveryView.shift}
        onLogout={logout}
      />
    );
  }

  // NORMAL 24-HOUR OR 12-HOUR REPORT

  if (currentShift) {
    return shopType === "24_HOUR" ? (
      <Cashier24HourReport
        user={user}
        currentShift={currentShift}
      />
    ) : (
      <CashierReport
        user={user}
        currentShift={currentShift}
      />
    );
  }

  // 12-HOUR SHOP CLOSED TODAY

  if (shopType === "12_HOUR" && closedForToday) {
    return (
      <div style={startPageStyle}>
        <div style={startCardStyle}>
          <h1 style={titleStyle}>TEAM LEGEND</h1>
          <h2>Shift Completed</h2>
          <p style={mutedStyle}>
            This shop already completed today's shift.
          </p>
          <div style={balancePreviewStyle}>
            Closing Balance: KES {money(balanceBF)}
          </div>
          <button
            style={logoutButton}
            onClick={logout}
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  // START SHIFT SCREEN

  return (
    <div style={startPageStyle}>
      <div style={startCardStyle}>
        <h1 style={titleStyle}>TEAM LEGEND</h1>
        <div style={subtitleStyle}>
          Start Cashier Shift
        </div>
        <div style={shopBadgeStyle}>
          {shopType || "SHOP"}
        </div>

        <div style={detailsStyle}>
          <div>
            <strong>Cashier:</strong>{" "}
            {user.full_name ||
              user.name ||
              user.username ||
              "Cashier"}
          </div>
          <div>
            <strong>Shop:</strong>{" "}
            {user.shop ||
              user.shop_name ||
              user.shopName ||
              "Shop"}
          </div>
        </div>

        {shopType === "24_HOUR" && (
          <div style={infoStyle}>
            <strong>24-Hour Shift System</strong>
            <div>Shift 1: 9:00 AM – 9:00 PM</div>
            <div>Shift 2: 9:00 PM – 9:00 AM</div>
          </div>
        )}

        <label style={labelStyle}>
          Balance B/F
        </label>

        <input
          type="number"
          step="0.01"
          min="0"
          value={balanceBF}
          disabled={balanceLocked}
          onChange={(e) => setBalanceBF(e.target.value)}
          style={{
            ...inputStyle,
            backgroundColor: balanceLocked
              ? "#f1f5f9"
              : "white",
          }}
        />

        {balanceLocked && (
          <p style={lockedTextStyle}>
            Carried forward from previous closed shift.
          </p>
        )}

        {message && (
          <div style={errorStyle}>{message}</div>
        )}

        <button
          style={{
            ...startButtonStyle,
            background: startingShift
              ? "#94a3b8"
              : "#07912a",
          }}
          disabled={startingShift}
          onClick={startShift}
        >
          {startingShift
            ? "Starting Shift..."
            : "Start Shift"}
        </button>

        <button
          style={logoutButton}
          onClick={logout}
        >
          Logout
        </button>
      </div>
    </div>
  );
}
// ==========================================
// SHOP AND SHIFT HELPERS
// ==========================================

async function getShopType(shopId, token) {
  const result = await restGet(
    `shops?id=eq.${encodeURIComponent(shopId)}` +
      "&select=id,shop_name,shop_type,is_active&limit=1",
    token
  );

  const shop = result?.[0];

  if (!shop) throw new Error("Shop was not found.");

  if (shop.is_active === false) {
    throw new Error("This shop is inactive.");
  }

  return String(shop.shop_type || "")
    .trim()
    .toUpperCase();
}

async function getClosedShiftForDate(
  shopId,
  businessDate,
  token
) {
  const rows = await restGet(
    `shifts?shop_id=eq.${encodeURIComponent(shopId)}` +
      `&business_date=eq.${encodeURIComponent(businessDate)}` +
      "&status=eq.CLOSED&select=*&order=closed_at.desc&limit=1",
    token
  );

  return rows?.[0] || null;
}

async function getLatestClosedShift(shopId, token) {
  const rows = await restGet(
    `shifts?shop_id=eq.${encodeURIComponent(shopId)}` +
      "&status=eq.CLOSED&select=*&order=closed_at.desc&limit=1",
    token
  );

  return rows?.[0] || null;
}

async function getPlatforms(shopId, token) {
  const rows = await restGet(
    `shop_platforms?shop_id=eq.${encodeURIComponent(shopId)}` +
      "&is_active=eq.true&select=id,platform_name,display_order" +
      "&order=display_order.asc",
    token
  );

  if (!rows?.length) {
    throw new Error(
      "No active platforms found for this shop."
    );
  }

  return rows;
}

async function getReading(
  shiftId,
  platformId,
  kind,
  token
) {
  const rows = await restGet(
    `platform_readings?shift_id=eq.${encodeURIComponent(shiftId)}` +
      `&platform_id=eq.${encodeURIComponent(platformId)}` +
      `&reading_kind=eq.${encodeURIComponent(kind)}` +
      "&select=reading_value&order=recorded_at.desc&limit=1",
    token
  );

  const raw = rows?.[0]?.reading_value;

  if (
    raw === "" ||
    raw == null ||
    !Number.isFinite(Number(raw))
  ) {
    throw new Error(
      `Previous shift ${kind} reading is missing or invalid.`
    );
  }

  return roundMoney(Number(raw));
}

// ==========================================
// 12-HOUR OPENING READINGS
// ==========================================

async function get12HourOpeningReadings(
  shopId,
  previous,
  token
) {
  const platforms = await getPlatforms(shopId, token);

  const table = platforms.find((p) =>
    isTable(p.platform_name)
  );

  let tableBF = 0;

  if (table && previous?.id) {
    tableBF = await getReading(
      previous.id,
      table.id,
      "CLOSING",
      token
    );
  }

  return platforms.map((p) => ({
    platformId: p.id,
    value: isTable(p.platform_name) ? tableBF : 0,
  }));
}

// ==========================================
// REPAIR EXISTING 12-HOUR OPENING READINGS
// ==========================================

async function ensure12HourOpeningReadings(
  shopId,
  shiftId,
  cashierId,
  token
) {
  const platforms = await getPlatforms(shopId, token);

  const existing = await restGet(
    `platform_readings?shift_id=eq.${encodeURIComponent(shiftId)}` +
      "&reading_kind=eq.OPENING&select=platform_id",
    token
  );

  const recorded = new Set(
    (existing || []).map((r) => r.platform_id)
  );

  const missing = platforms.filter(
    (p) => !recorded.has(p.id)
  );

  if (!missing.length) return;

  const tableMissing = missing.find((p) =>
    isTable(p.platform_name)
  );

  let tableBF = 0;

  if (tableMissing) {
    const previous = await getLatestClosedShift(
      shopId,
      token
    );

    if (previous?.id) {
      tableBF = await getReading(
        previous.id,
        tableMissing.id,
        "CLOSING",
        token
      );
    }
  }

  const readings = missing.map((p) => ({
    platformId: p.id,
    value: isTable(p.platform_name) ? tableBF : 0,
  }));

  await insertOpeningReadings(
    shiftId,
    readings,
    cashierId,
    token
  );
}

// ==========================================
// 24-HOUR PLATFORM CARRY FORWARD
// ==========================================

async function get24HourCarryForwardReadings(
  shopId,
  previous,
  token
) {
  const previousName = normaliseShiftName(
    previous?.shift_name
  );

  const kind =
    previousName === "SHIFT 1"
      ? "HANDOVER_9PM"
      : previousName === "SHIFT 2"
      ? "CLOSING_9AM"
      : null;

  if (!kind) return [];

  const platforms = await getPlatforms(shopId, token);

  const rows = await restGet(
    `platform_readings?shift_id=eq.${encodeURIComponent(previous.id)}` +
      `&reading_kind=eq.${kind}` +
      "&select=platform_id,reading_value",
    token
  );

  const byPlatform = new Map(
    (rows || []).map((r) => [
      r.platform_id,
      r.reading_value,
    ])
  );

  return platforms.map((p) => {
    const raw = byPlatform.get(p.id);

    if (
      raw === "" ||
      raw == null ||
      !Number.isFinite(Number(raw))
    ) {
      throw new Error(
        `Previous ${previousName} is missing ${kind} for ${p.platform_name}.`
      );
    }

    return {
      platformId: p.id,
      value: roundMoney(Number(raw)),
    };
  });
}

// ==========================================
// CREATE SHIFT
// ==========================================

async function createShift(shift, token) {
  const result = await restPost(
    "shifts",
    token,
    shift,
    true
  );

  if (!Array.isArray(result) || !result[0]) {
    throw new Error(
      "Shift was created but could not be loaded."
    );
  }

  return result[0];
}

// ==========================================
// INSERT OPENING READINGS
// ==========================================

async function insertOpeningReadings(
  shiftId,
  readings,
  cashierId,
  token
) {
  if (!readings?.length) return;

  const at = new Date().toISOString();

  await restPost(
    "platform_readings",
    token,
    readings.map((r) => ({
      shift_id: shiftId,
      platform_id: r.platformId,
      reading_kind: "OPENING",
      reading_value: roundMoney(r.value),
      recorded_at: at,
      recorded_by: cashierId,
    }))
  );
}

// ==========================================
// 24-HOUR SHIFT HELPERS
// ==========================================

function normaliseShiftName(value) {
  const text = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

  if (text === "SHIFT1") return "SHIFT 1";
  if (text === "SHIFT2") return "SHIFT 2";

  return text;
}

const proper24h = (name) =>
  ["SHIFT 1", "SHIFT 2"].includes(
    normaliseShiftName(name)
  );

const isTable = (name) =>
  String(name || "").trim().toUpperCase() === "TABLE";

function determineNext24HourShift(previous) {
  const name = normaliseShiftName(
    previous?.shift_name
  );

  if (name === "SHIFT 1") return "SHIFT 2";
  if (name === "SHIFT 2") return "SHIFT 1";

  const { hour } = nairobiParts();

  return hour >= 9 && hour < 21
    ? "SHIFT 1"
    : "SHIFT 2";
}

function get24HourBusinessDate(name) {
  const today = nairobiDate();

  return name === "SHIFT 2" &&
    nairobiParts().hour < 9
    ? datePlusDays(today, -1)
    : today;
}

function datePlusDays(dateString, days) {
  const [y, m, d] = dateString
    .split("-")
    .map(Number);

  const date = new Date(
    Date.UTC(y, m - 1, d)
  );

  date.setUTCDate(
    date.getUTCDate() + days
  );

  return `${date.getUTCFullYear()}-${String(
    date.getUTCMonth() + 1
  ).padStart(2, "0")}-${String(
    date.getUTCDate()
  ).padStart(2, "0")}`;
}

// ==========================================
// NAIROBI TIME
// ==========================================

function nairobiParts(date = new Date()) {
  const fields = new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: "Africa/Nairobi",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }
  ).formatToParts(date);

  const out = {};

  for (const p of fields) {
    if (p.type !== "literal") {
      out[p.type] = p.value;
    }
  }

  return {
    year: +out.year,
    month: +out.month,
    day: +out.day,
    hour: +out.hour,
    minute: +out.minute,
    second: +out.second,
  };
}

function nairobiDate() {
  const p = nairobiParts();

  return `${p.year}-${String(
    p.month
  ).padStart(2, "0")}-${String(
    p.day
  ).padStart(2, "0")}`;
}

function nairobiTime(date) {
  const p = nairobiParts(date);

  return `${String(p.hour).padStart(2, "0")}:${String(
    p.minute
  ).padStart(2, "0")}:${String(
    p.second
  ).padStart(2, "0")}`;
}

// ==========================================
// TOKEN HELPERS
// ==========================================

function shouldRefreshToken(u) {
  if (!u.access_token) return true;

  const stored = Number(u.expires_at);

  const exp =
    Number.isFinite(stored) && stored > 0
      ? stored
      : jwtExpiry(u.access_token);

  return exp
    ? exp - Math.floor(Date.now() / 1000) <= 300
    : false;
}

function jwtExpiry(token) {
  try {
    let payload = String(token)
      .split(".")[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    while (payload.length % 4) {
      payload += "=";
    }

    return (
      Number(JSON.parse(atob(payload)).exp) ||
      null
    );
  } catch {
    return null;
  }
}

function sessionExpired() {
  const e = new Error(
    "Your login session expired. Please log in again."
  );

  e.name = "SessionExpiredError";
  return e;
}

// ==========================================
// GENERAL HELPERS
// ==========================================

const roundMoney = (value) =>
  Math.round(
    (Number(value) + Number.EPSILON) * 100
  ) / 100;

const money = (value) =>
  Number(value || 0).toLocaleString(
    "en-KE",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  );

// ==========================================
// STYLES
// ==========================================

const loadingStyle = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "#edf2f7",
  fontFamily: "Arial, sans-serif",
};

const startPageStyle = {
  minHeight: "100vh",
  backgroundColor: "#edf2f7",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
  fontFamily: "Arial, sans-serif",
};

const startCardStyle = {
  width: "100%",
  maxWidth: 470,
  backgroundColor: "white",
  borderRadius: 12,
  padding: 28,
  boxShadow: "0 4px 20px rgba(0,0,0,0.10)",
};

const titleStyle = {
  margin: "0 0 6px",
  color: "#063c63",
  textAlign: "center",
};

const subtitleStyle = {
  textAlign: "center",
  color: "#64748b",
  marginBottom: 16,
};

const shopBadgeStyle = {
  backgroundColor: "#063c63",
  color: "white",
  padding: "9px 12px",
  borderRadius: 6,
  textAlign: "center",
  fontWeight: "bold",
  marginBottom: 18,
};

const detailsStyle = {
  display: "grid",
  gap: 7,
  padding: 12,
  backgroundColor: "#f8fafc",
  borderRadius: 7,
  marginBottom: 15,
};

const infoStyle = {
  display: "grid",
  gap: 5,
  backgroundColor: "#ecfdf5",
  color: "#166534",
  border: "1px solid #86efac",
  borderRadius: 7,
  padding: 12,
  marginBottom: 15,
};

const labelStyle = {
  display: "block",
  fontWeight: "bold",
  marginBottom: 6,
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: 11,
  border: "1px solid #94a3b8",
  borderRadius: 6,
  fontSize: 16,
};

const lockedTextStyle = {
  color: "#64748b",
  fontSize: 12,
  marginTop: 6,
};

const errorStyle = {
  backgroundColor: "#fef2f2",
  color: "#991b1b",
  padding: 10,
  marginTop: 12,
};

const startButtonStyle = {
  width: "100%",
  marginTop: 18,
  border: "none",
  borderRadius: 6,
  padding: 12,
  color: "white",
  fontWeight: "bold",
  fontSize: 15,
};

const logoutButton = {
  width: "100%",
  marginTop: 10,
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  padding: 11,
  backgroundColor: "white",
  color: "#334155",
  fontWeight: "bold",
  cursor: "pointer",
};

const mutedStyle = {
  color: "#64748b",
  textAlign: "center",
  lineHeight: 1.6,
};

const balancePreviewStyle = {
  backgroundColor: "#ecfdf5",
  color: "#166534",
  padding: 12,
  borderRadius: 7,
  textAlign: "center",
  fontWeight: "bold",
  marginTop: 15,
};
