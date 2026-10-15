"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
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
      value?.message ||
      value?.details ||
      "Database request failed."
    );
  }

  return value;
}

async function restPost(
  path,
  token,
  body,
  returnRepresentation = false
) {
  const response = await fetch(`${URL}/rest/v1/${path}`, {
    method: "POST",
    headers: {
      ...authHeaders(token),
      ...(returnRepresentation
        ? { Prefer: "return=representation" }
        : {}),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const value = await json(response);

  if (!response.ok) {
    throw new Error(
      value?.message ||
      value?.details ||
      value?.hint ||
      "Save failed."
    );
  }

  return value;
}

// ==================================================
// ADMIN RECOVERY
// ==================================================

async function getRecoveryAssignment(token) {
  const value = await restPost(
    "rpc/tl_cashier_active_shift_recovery",
    token,
    {}
  );

  if (!Array.isArray(value)) {
    throw new Error(
      "Unexpected response when checking Admin recovery."
    );
  }

  return value[0] || null;
}

async function getRecoveryTarget(
  assignment,
  shopId,
  token
) {
  if (!assignment?.target_shift_id) {
    throw new Error(
      "The Admin recovery target is missing."
    );
  }

  const rows = await restGet(
    `shifts?id=eq.${encodeURIComponent(
      assignment.target_shift_id
    )}` +
      `&shop_id=eq.${encodeURIComponent(shopId)}` +
      "&select=*&limit=1",
    token
  );

  if (!Array.isArray(rows) || !rows[0]) {
    throw new Error(
      "Recovery target not found in your shop."
    );
  }

  return rows[0];
}

// ==================================================
// NEW — STRICT 12-HOUR OPENING GATE
//
// Uses installed Stage 5B RPC.
// This function records a locked opening attempt
// whenever previous closing incidents are pending.
//
// Fail closed on missing or invalid response.
// ==================================================

async function get12HourOpeningGate(token) {
  const result = await restPost(
    "rpc/tl_cashier_12h_opening_gate_v1",
    token,
    {}
  );

  if (
    !result ||
    result.ok !== true ||
    result.applicable !== true ||
    typeof result.locked !== "boolean"
  ) {
    throw new Error(
      "The 12-hour security check returned an invalid response."
    );
  }

  return result;
}

const cashierShop = (u) =>
  u?.shop_id || u?.shopId || null;

const cashierProfile = (u) =>
  u?.profile_id ||
  u?.id ||
  u?.user_id ||
  u?.auth_user_id ||
  null;

// ==================================================
// MAIN DASHBOARD
// ==================================================

export default function DashboardPage() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [balanceBF, setBalanceBF] = useState("");
  const [balanceLocked, setBalanceLocked] =
    useState(false);

  const [currentShift, setCurrentShift] =
    useState(null);

  const [shopType, setShopType] = useState("");
  const [closedForToday, setClosedForToday] =
    useState(false);

  const [message, setMessage] = useState("");
  const [startingShift, setStartingShift] =
    useState(false);

  // EXISTING ADMIN RECOVERY

  const [recoveryView, setRecoveryView] =
    useState(null);

  const [recoveryReady, setRecoveryReady] =
    useState(false);

  const [recoveryError, setRecoveryError] =
    useState("");

  // NEW — 12-HOUR ACCOUNTABILITY

  const [closingGate, setClosingGate] =
    useState(null);

  const [closingGateReady, setClosingGateReady] =
    useState(false);

  const [closingGateError, setClosingGateError] =
    useState("");

  const [staleOpenShift, setStaleOpenShift] =
    useState(null);

  // REFS

  const refreshPromiseRef = useRef(null);
  const wasRecoveringRef = useRef(false);
  const recoveryPollRef = useRef(false);

  const closingGatePollRef = useRef(false);
  const closingWasLockedRef = useRef(false);

  const autoStart12hRef = useRef("");

  // ==================================================
  // SAVE USER SESSION
  // ==================================================

  const saveUserSession = useCallback((nextUser) => {
    if (!nextUser) return;

    sessionStorage.setItem(
      "teamLegendUser",
      JSON.stringify(nextUser)
    );

    setUser(nextUser);
  }, []);

  // ==================================================
  // EXPIRED SESSION
  // ==================================================

  const expireSession = useCallback(() => {
    sessionStorage.removeItem("teamLegendUser");

    setUser(null);
    setCurrentShift(null);
    setRecoveryView(null);
    setClosingGate(null);

    router.replace("/");
  }, [router]);

  // ==================================================
  // REFRESH USER TOKEN
  // ==================================================

  const refreshUserSession = useCallback(
    async (u, options = {}) => {
      if (!u) {
        throw sessionExpired();
      }

      if (
        !options.force &&
        u.access_token &&
        !shouldRefreshToken(u)
      ) {
        return u;
      }

      if (!u.refresh_token) {
        throw sessionExpired();
      }

      if (!URL || !ANON) {
        throw new Error(
          "Server configuration is incomplete."
        );
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

        if (
          !response.ok ||
          !result?.access_token
        ) {
          throw sessionExpired();
        }

        const expiresAt =
          Number(result.expires_at) ||
          Math.floor(Date.now() / 1000) +
            Number(result.expires_in || 3600);

        const next = {
          ...u,

          id:
            result.user?.id ||
            u.id,

          auth_user_id:
            result.user?.id ||
            u.auth_user_id,

          access_token:
            result.access_token,

          refresh_token:
            result.refresh_token ||
            u.refresh_token,

          expires_at:
            expiresAt,

          expires_in:
            result.expires_in ||
            u.expires_in,

          token_type:
            result.token_type ||
            u.token_type ||
            "bearer",
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

  // ==================================================
  // INITIAL DASHBOARD LOAD
  //
  // PRIORITY:
  // 1. LOGIN
  // 2. ADMIN RECOVERY
  // 3. 12-HOUR CLOSING GATE
  // 4. NORMAL OPEN SHIFT
  // 5. PREVIOUS CLOSED SHIFT
  //
  // Do not show old editable 12-hour shifts.
  // ==================================================

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      setLoading(true);
      setMessage("");

      setRecoveryReady(false);

      setClosingGateReady(false);
      setClosingGateError("");
      setClosingGate(null);
      setStaleOpenShift(null);

      try {
        const raw = sessionStorage.getItem(
          "teamLegendUser"
        );

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

        const active =
          await refreshUserSession(stored);

        if (cancelled) return;

        saveUserSession(active);

        const role = String(
          active.role || ""
        )
          .trim()
          .toUpperCase();

        if (
          role === "ADMIN" ||
          role === "ACCOUNTANT"
        ) {
          return;
        }

        if (role !== "CASHIER") {
          throw new Error(
            "Account does not have system access."
          );
        }

        const shopId = cashierShop(active);
        const cashierId =
          cashierProfile(active);

        const token = active.access_token;

        if (
          !shopId ||
          !cashierId ||
          !token
        ) {
          throw new Error(
            "Cashier login information is incomplete."
          );
        }

        const type = await getShopType(
          shopId,
          token
        );

        if (cancelled) return;

        setShopType(type);

        // ======================================
        // ADMIN RECOVERY TAKES PRIORITY
        // ======================================

        const recovery =
          await getRecoveryAssignment(token);

        if (cancelled) return;

        if (recovery) {
          const target =
            await getRecoveryTarget(
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

        // ======================================
        // STRICT 12-HOUR CLOSING CHECK
        // ======================================
        //
        // Run BEFORE selecting any OPEN shift.
        // A cashier with unresolved incidents
        // must not access editable financial forms.
        //
        // Failed RPC = locked, never ignored.
        // ======================================

        if (type === "12_HOUR") {
          try {
            const gate =
              await get12HourOpeningGate(
                token
              );

            if (cancelled) return;

            closingWasLockedRef.current =
              gate.locked;

            setClosingGate(gate);
            setClosingGateError("");
            setClosingGateReady(true);

            if (gate.locked) {
              setCurrentShift(null);
              setBalanceBF("");
              setBalanceLocked(true);
              setClosedForToday(false);

              return;
            }
          } catch (err) {
            if (cancelled) return;

            setCurrentShift(null);

            setClosingGateError(
              err?.message ||
                "Unable to verify previous 12-hour closing."
            );

            setClosingGateReady(true);

            return;
          }
        } else {
          setClosingGateReady(true);
        }

        // ======================================
        // NORMAL OPEN SHIFT FOR THIS CASHIER
        // ======================================

        const mine = await restGet(
          `shifts?shop_id=eq.${encodeURIComponent(
            shopId
          )}` +
            `&cashier_id=eq.${encodeURIComponent(
              cashierId
            )}` +
            "&status=eq.OPEN" +
            "&select=*" +
            "&order=opened_at.desc" +
            "&limit=1",
          token
        );

        if (cancelled) return;

        const open = mine?.[0];

        if (open) {
          if (type === "12_HOUR") {
            // A previous business-date shift
            // cannot remain editable today.

            if (
              String(open.business_date) !==
              nairobiDate()
            ) {
              setCurrentShift(null);
              setStaleOpenShift(open);

              return;
            }

            // Recovery could have started
            // while loading the current shift.

            const newlyActive =
              await getRecoveryAssignment(
                token
              );

            if (cancelled) return;

            if (newlyActive) {
              const target =
                await getRecoveryTarget(
                  newlyActive,
                  shopId,
                  token
                );

              if (!cancelled) {
                wasRecoveringRef.current =
                  true;

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

          setBalanceBF(
            String(
              open.opening_balance ?? 0
            )
          );

          setBalanceLocked(true);
          setClosedForToday(false);

          return;
        }

        // ======================================
        // CHECK SHOP-WIDE OVERDUE OPEN SHIFT
        // ======================================

        if (type === "12_HOUR") {
          const shopOpen =
            await getShopOpenShift(
              shopId,
              token
            );

          if (cancelled) return;

          if (
            shopOpen &&
            String(
              shopOpen.business_date
            ) !== nairobiDate()
          ) {
            setCurrentShift(null);
            setStaleOpenShift(shopOpen);

            return;
          }

          // ==================================
          // ALREADY CLOSED TODAY
          // ==================================

          const completed =
            await getClosedShiftForDate(
              shopId,
              nairobiDate(),
              token
            );

          if (cancelled) return;

          if (completed) {
            setClosedForToday(true);

            setBalanceBF(
              String(
                completed.closing_balance ?? 0
              )
            );

            setBalanceLocked(true);

            return;
          }
        }

        // ======================================
        // LAST CLOSED SHIFT
        // ======================================

        const previous =
          await getLatestClosedShift(
            shopId,
            token,
            type === "12_HOUR"
          );

        if (cancelled) return;

        setBalanceBF(
          previous
            ? String(
                previous.closing_balance ?? 0
              )
            : ""
        );

        setBalanceLocked(
          Boolean(previous)
        );

        setClosedForToday(false);
      } catch (err) {
        if (
          err?.name ===
          "SessionExpiredError"
        ) {
          if (!cancelled) {
            expireSession();
          }

          return;
        }

        if (!cancelled) {
          setMessage(
            err?.message ||
              "Unable to load dashboard."
          );

          setRecoveryError(
            err?.message ||
              "Recovery verification failed."
          );

          setRecoveryReady(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [
    router,
    refreshUserSession,
    saveUserSession,
    expireSession,
  ]);

  // ==================================================
  // LIVE RECOVERY CHECK — EVERY 8 SECONDS
  //
  // Existing Admin Recovery behavior retained.
  // ==================================================

  useEffect(() => {
    if (
      String(
        user?.role || ""
      ).toUpperCase() !== "CASHIER"
    ) {
      return;
    }

    if (
      !user.access_token ||
      !cashierShop(user)
    ) {
      return;
    }

    let cancelled = false;

    async function poll() {
      if (recoveryPollRef.current) {
        return;
      }

      recoveryPollRef.current = true;

      try {
        const active =
          await getRecoveryAssignment(
            user.access_token
          );

        if (cancelled) return;

        if (active) {
          const target =
            await getRecoveryTarget(
              active,
              cashierShop(user),
              user.access_token
            );

          if (cancelled) return;

          wasRecoveringRef.current =
            true;

          setRecoveryView({
            assignment: active,
            shift: target,
          });

          setCurrentShift(null);

          setRecoveryError("");
          setRecoveryReady(true);
        } else if (
          wasRecoveringRef.current
        ) {
          window.location.reload();
        } else {
          setRecoveryView(null);
          setRecoveryError("");
          setRecoveryReady(true);
        }
      } catch (err) {
        if (!cancelled) {
          setRecoveryError(
            err?.message ||
              "Unable to verify Admin recovery."
          );

          setRecoveryReady(true);
        }
      } finally {
        recoveryPollRef.current = false;
      }
    }

    const timer = setInterval(
      poll,
      8000
    );

    const onFocus = () => {
      void poll();
    };

    window.addEventListener(
      "focus",
      onFocus
    );

    void poll();

    return () => {
      cancelled = true;

      clearInterval(timer);

      window.removeEventListener(
        "focus",
        onFocus
      );
    };
  }, [
    user?.access_token,
    user?.role,
    user?.shop_id,
    user?.shopId,
  ]);

  // ==================================================
  // NEW — LIVE 12-HOUR INCIDENT CHECK
  //
  // Rechecks every 20 seconds.
  //
  // If a new closing incident appears:
  // Hide the editable cashier report.
  //
  // If Admin resolves the incident:
  // Reload and verify opening information again.
  //
  // Database financial guards remain authoritative.
  // ==================================================

  useEffect(() => {
    if (
      shopType !== "12_HOUR" ||
      !closingGateReady ||
      !user?.access_token ||
      recoveryView
    ) {
      return;
    }

    let cancelled = false;

    async function pollGate() {
      if (
        closingGatePollRef.current
      ) {
        return;
      }

      closingGatePollRef.current =
        true;

      try {
        const gate =
          await get12HourOpeningGate(
            user.access_token
          );

        if (cancelled) return;

        const wasLocked =
          closingWasLockedRef.current;

        closingWasLockedRef.current =
          gate.locked;

        setClosingGate(gate);
        setClosingGateError("");

        if (gate.locked) {
          setCurrentShift(null);
          setBalanceBF("");
          setBalanceLocked(true);
        } else if (wasLocked) {
          // Admin verified the incident.
          // Reload previous shift history and
          // check the current business date.

          window.location.reload();
        }
      } catch (err) {
        if (!cancelled) {
          setClosingGateError(
            err?.message ||
              "12-hour closing verification unavailable."
          );

          setCurrentShift(null);
        }
      } finally {
        closingGatePollRef.current =
          false;
      }
    }

    const timer = setInterval(
      pollGate,
      20000
    );

    const onFocus = () => {
      void pollGate();
    };

    window.addEventListener(
      "focus",
      onFocus
    );

    return () => {
      cancelled = true;

      clearInterval(timer);

      window.removeEventListener(
        "focus",
        onFocus
      );
    };
  }, [
    shopType,
    closingGateReady,
    user?.access_token,
    recoveryView,
  ]);

  // ==================================================
  // AUTOMATIC TOKEN REFRESH
  // ==================================================

  useEffect(() => {
    if (!user?.access_token) return;

    let cancelled = false;

    async function refresh() {
      try {
        await refreshUserSession(user);
      } catch (err) {
        if (
          !cancelled &&
          err?.name ===
            "SessionExpiredError"
        ) {
          expireSession();
        }
      }
    }

    const timer = setInterval(
      refresh,
      60000
    );

    const onFocus = () => {
      void refresh();
    };

    const onVisibility = () => {
      if (
        document.visibilityState ===
        "visible"
      ) {
        void refresh();
      }
    };

    window.addEventListener(
      "focus",
      onFocus
    );

    document.addEventListener(
      "visibilitychange",
      onVisibility
    );

    return () => {
      cancelled = true;

      clearInterval(timer);

      window.removeEventListener(
        "focus",
        onFocus
      );

      document.removeEventListener(
        "visibilitychange",
        onVisibility
      );
    };
  }, [
    user,
    refreshUserSession,
    expireSession,
  ]);

  // ==================================================
  // LOGOUT
  // ==================================================

  function logout() {
    expireSession();
  }

  // ==================================================
  // START SHIFT
  //
  // STRICT 12-HOUR SECURITY:
  // Recheck the database before creating a shift.
  //
  // 24-HOUR SHIFT LOGIC PRESERVED.
  // ==================================================

  async function startShift() {
    if (
      !user ||
      startingShift
    ) {
      return;
    }

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

      // ======================================
      // PREVENT UNVERIFIED 12-HOUR OPENING
      // ======================================

      if (
        shopType === "12_HOUR" &&
        (
          !closingGateReady ||
          closingGateError ||
          closingGate?.locked ||
          staleOpenShift
        )
      ) {
        throw new Error(
          "Previous 12-hour closing requires Admin verification."
        );
      }

      const active =
        await refreshUserSession(
          user
        );

      const shopId =
        cashierShop(active);

      const cashierId =
        cashierProfile(active);

      const cashierName =
        active.full_name ||
        active.name ||
        active.username ||
        "Cashier";

      const token =
        active.access_token;

      if (
        !shopId ||
        !cashierId ||
        !token
      ) {
        throw new Error(
          "Incomplete cashier login."
        );
      }

      // ======================================
      // FRESH ADMIN RECOVERY CHECK
      // ======================================

      if (
        await getRecoveryAssignment(
          token
        )
      ) {
        throw new Error(
          "Admin Recovery is ACTIVE. Wait until it ends."
        );
      }

      const type =
        await getShopType(
          shopId,
          token
        );

      setShopType(type);

      // ======================================
      // FRESH 12-HOUR ACCOUNTABILITY CHECK
      // ======================================

      if (type === "12_HOUR") {
        const gate =
          await get12HourOpeningGate(
            token
          );

        closingWasLockedRef.current =
          gate.locked;

        setClosingGate(gate);
        setClosingGateReady(true);
        setClosingGateError("");

        if (gate.locked) {
          setCurrentShift(null);
          setBalanceBF("");
          setBalanceLocked(true);

          throw new Error(
            "Previous closing incomplete. Contact Admin."
          );
        }

        if (
          nairobiTime(new Date()) >=
          "23:59:00"
        ) {
          throw new Error(
            "12-hour shift opening closes at 11:59 PM Nairobi time."
          );
        }

        const closed =
          await getClosedShiftForDate(
            shopId,
            nairobiDate(),
            token
          );

        if (closed) {
          setClosedForToday(true);

          setBalanceBF(
            String(
              closed.closing_balance ?? 0
            )
          );

          setBalanceLocked(true);

          throw new Error(
            "This 12-hour shop already completed today's shift."
          );
        }
      }

      // ======================================
      // SHOP-WIDE OPEN SHIFT CHECK
      // ======================================

      const open = await restGet(
        `shifts?shop_id=eq.${encodeURIComponent(
          shopId
        )}` +
          "&status=eq.OPEN" +
          "&select=*" +
          "&order=opened_at.desc" +
          "&limit=1",
        token
      );

      if (open?.length) {
        const existing =
          open[0];

        if (
          type === "12_HOUR" &&
          String(
            existing.business_date
          ) !== nairobiDate()
        ) {
          setStaleOpenShift(
            existing
          );

          throw new Error(
            "An overdue OPEN shift must be finalized by Admin."
          );
        }

        if (
          String(
            existing.cashier_id
          ) !==
          String(cashierId)
        ) {
          throw new Error(
            "Another cashier already has an OPEN shift for this shop."
          );
        }

        if (type === "12_HOUR") {
          if (
            await getRecoveryAssignment(
              token
            )
          ) {
            throw new Error(
              "Admin recovery started."
            );
          }

          await ensure12HourOpeningReadings(
            shopId,
            existing.id,
            cashierId,
            token
          );
        }

        setCurrentShift(
          existing
        );

        setBalanceBF(
          String(
            existing.opening_balance ?? 0
          )
        );

        setBalanceLocked(true);

        return;
      }

      // ======================================
      // PREVIOUS CLOSED SHIFT
      // ======================================

      const previous =
        await getLatestClosedShift(
          shopId,
          token,
          type === "12_HOUR"
        );

      let bf;

      if (previous) {
        bf = Number(
          previous.closing_balance ?? 0
        );
      } else {
        if (
          balanceBF === "" ||
          !Number.isFinite(
            Number(balanceBF)
          ) ||
          Number(balanceBF) < 0
        ) {
          throw new Error(
            "Enter a valid opening Balance B/F."
          );
        }

        bf = Number(
          balanceBF
        );
      }

      if (
        !Number.isFinite(bf)
      ) {
        throw new Error(
          "Cannot open shift with an unverified Balance B/F."
        );
      }

      const now = new Date();

      const base = {
        shop_id: shopId,

        cashier_id:
          cashierId,

        cashier_name:
          cashierName,

        opened_at:
          now.toISOString(),

        closed_at:
          null,

        status:
          "OPEN",

        opening_balance:
          roundMoney(bf),

        total_added_float:
          0,

        total_output:
          0,

        total_expenses:
          0,

        net_income:
          roundMoney(bf),

        closing_balance:
          roundMoney(bf),

        notes:
          null,
      };

      // ======================================
      // 12-HOUR SHIFT
      // ======================================

      if (type === "12_HOUR") {
        const readings =
          await get12HourOpeningReadings(
            shopId,
            previous,
            token
          );

        if (
          await getRecoveryAssignment(
            token
          )
        ) {
          throw new Error(
            "Admin recovery started."
          );
        }

        // Fixed 11:59 PM cutoff.
        // Supabase also enforces this.

        const newShift =
          await createShift(
            {
              ...base,

              shift_name:
                "DAY",

              business_date:
                nairobiDate(),

              scheduled_start:
                nairobiTime(now),

              scheduled_end:
                "23:59:00",
            },
            token
          );

        await insertOpeningReadings(
          newShift.id,
          readings,
          cashierId,
          token
        );

        setCurrentShift(
          newShift
        );

        setBalanceBF(
          String(
            newShift.opening_balance ?? 0
          )
        );

        setBalanceLocked(true);
        setClosedForToday(false);

        return;
      }

      // ======================================
      // 24-HOUR SHIFT
      // ORIGINAL LOGIC PRESERVED
      // ======================================

      if (type === "24_HOUR") {
        const shiftName =
          determineNext24HourShift(
            previous
          );

        const readings =
          previous &&
          proper24h(
            previous.shift_name
          )
            ? await get24HourCarryForwardReadings(
                shopId,
                previous,
                token
              )
            : [];

        if (
          await getRecoveryAssignment(
            token
          )
        ) {
          throw new Error(
            "Admin recovery started."
          );
        }

        const newShift =
          await createShift(
            {
              ...base,

              cashier_name:
                "NOT ASSIGNED",

              shift_name:
                shiftName,

              business_date:
                get24HourBusinessDate(
                  shiftName
                ),

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

        setCurrentShift(
          newShift
        );

        setBalanceBF(
          String(
            newShift.opening_balance ?? 0
          )
        );

        setBalanceLocked(true);
        setClosedForToday(false);

        return;
      }

      throw new Error(
        `Unsupported shop type: ${
          type || "UNKNOWN"
        }`
      );
    } catch (err) {
      if (
        err?.name ===
        "SessionExpiredError"
      ) {
        expireSession();
      } else {
        setMessage(
          err?.message ||
            "Unable to start shift."
        );
      }
    } finally {
      setStartingShift(false);
    }
  }

  // ==================================================
  // AUTOMATIC 12-HOUR NEXT-DAY OPENING
  //
  // Only when:
  // - No Admin Recovery is active
  // - No incomplete closing incident exists
  // - No overdue OPEN shift exists
  // - No shift has closed today
  // - A previous CLOSED shift provides Balance B/F
  //
  // First-ever shift still requires manual B/F.
  // ==================================================

  useEffect(() => {
    if (
      loading ||
      !user ||
      shopType !== "12_HOUR" ||
      !recoveryReady ||
      recoveryError ||
      recoveryView ||
      !closingGateReady ||
      closingGateError ||
      closingGate?.locked ||
      staleOpenShift ||
      currentShift ||
      closedForToday ||
      !balanceLocked ||
      balanceBF === "" ||
      startingShift ||
      message
    ) {
      return;
    }

    const key =
      `${cashierShop(user)}:${nairobiDate()}`;

    if (
      autoStart12hRef.current === key
    ) {
      return;
    }

    autoStart12hRef.current =
      key;

    void startShift();
  }, [
    loading,
    user,
    shopType,
    recoveryReady,
    recoveryError,
    recoveryView,
    closingGateReady,
    closingGateError,
    closingGate,
    staleOpenShift,
    currentShift,
    closedForToday,
    balanceLocked,
    balanceBF,
    startingShift,
    message,
  ]);

  // ==================================================
  // DISPLAY
  // ==================================================

  if (loading) {
    return (
      <div style={loadingStyle}>
        Loading dashboard...
      </div>
    );
  }

  if (!user) return null;

  const role = String(
    user.role || ""
  )
    .trim()
    .toUpperCase();

  // ==========================================
  // ADMIN
  // ==========================================

  if (role === "ADMIN") {
    return (
      <AdminDashboard
        user={user}
      />
    );
  }

  // ==========================================
  // ACCOUNTANT
  // ==========================================

  if (role === "ACCOUNTANT") {
    return (
      <AccountantDashboard
        user={user}
      />
    );
  }

  // ==========================================
  // RECOVERY VERIFICATION
  // ==========================================

  if (!recoveryReady) {
    return (
      <div style={loadingStyle}>
        Checking Admin recovery...
      </div>
    );
  }

  if (recoveryError) {
    return (
      <div style={startPageStyle}>
        <div style={startCardStyle}>
          <h2>
            Recovery verification unavailable
          </h2>

          <p style={errorStyle}>
            {recoveryError}
          </p>

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

  // ==========================================
  // ADMIN RECOVERY PREVIEW — READ ONLY
  // ==========================================

  if (recoveryView) {
    return (
      <CashierRecoveryPreview
        user={user}
        recoveryAssignment={
          recoveryView.assignment
        }
        recoveryShift={
          recoveryView.shift
        }
        onLogout={logout}
      />
    );
  }

  // ==========================================
  // 12-HOUR GATE LOADING
  // ==========================================

  if (
    shopType === "12_HOUR" &&
    !closingGateReady
  ) {
    return (
      <div style={loadingStyle}>
        Checking previous closing...
      </div>
    );
  }

  // ==========================================
  // 12-HOUR VERIFICATION FAILED
  // FAIL CLOSED
  // ==========================================

  if (
    shopType === "12_HOUR" &&
    closingGateError
  ) {
    return (
      <div style={startPageStyle}>
        <div style={startCardStyle}>
          <h1 style={titleStyle}>
            TEAM LEGEND
          </h1>

          <h2 style={centeredHeadingStyle}>
            Closing verification unavailable
          </h2>

          <p style={errorStyle}>
            {closingGateError}
          </p>

          <p style={mutedStyle}>
            Financial access is temporarily
            blocked for your protection.
          </p>

          <button
            style={refreshButtonStyle}
            onClick={() =>
              window.location.reload()
            }
          >
            Retry verification
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
  // NEW — STRICT ACCOUNTABILITY LOCK
  // ==========================================

  if (
    shopType === "12_HOUR" &&
    closingGate?.locked
  ) {
    return (
      <div style={startPageStyle}>
        <div style={startCardStyle}>
          <h1 style={titleStyle}>
            TEAM LEGEND
          </h1>

          <div style={lockPillStyle}>
            PREVIOUS SHIFT INCOMPLETE
          </div>

          <h2 style={centeredHeadingStyle}>
            Contact Admin
          </h2>

          <p style={mutedStyle}>
            Closing readings from a previous
            shift have not been verified.
            Only Admin Recovery can complete
            the missing information.
          </p>

          <div style={
            lockedInformationStyle
          }>
            <div>
              <strong>
                Shop:
              </strong>{" "}
              {user.shop ||
                user.shop_name ||
                user.shopName ||
                "Your shop"}
            </div>

            <div>
              <strong>
                Outstanding closings:
              </strong>{" "}
              {closingGate.pending_incidents ??
                "—"}
            </div>

            <div>
              <strong>
                Missing readings:
              </strong>{" "}
              {closingGate.missing_readings ??
                "—"}
            </div>

            <div>
              <strong>
                Oldest pending date:
              </strong>{" "}
              {closingGate.oldest_unresolved_date ||
                "—"}
            </div>

            <div>
              <strong>
                Balance B/F:
              </strong>{" "}
              PENDING ADMIN VERIFICATION
            </div>

            <div>
              <strong>
                Financial entries:
              </strong>{" "}
              LOCKED
            </div>
          </div>

          <button
            style={refreshButtonStyle}
            onClick={() =>
              window.location.reload()
            }
          >
            Refresh status
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
  // OVERDUE 12-HOUR OPEN SHIFT
  // ==========================================

  if (
    shopType === "12_HOUR" &&
    staleOpenShift
  ) {
    return (
      <div style={startPageStyle}>
        <div style={startCardStyle}>
          <h1 style={titleStyle}>
            TEAM LEGEND
          </h1>

          <div style={lockPillStyle}>
            PREVIOUS SHIFT STILL OPEN
          </div>

          <h2 style={centeredHeadingStyle}>
            Admin finalization required
          </h2>

          <p style={mutedStyle}>
            A previous business-date shift
            remains OPEN. It cannot be used
            for the current day's financial
            entries or carried forward
            as verified.
          </p>

          <div style={
            lockedInformationStyle
          }>
            <div>
              <strong>
                Old shift date:
              </strong>{" "}
              {staleOpenShift.business_date ||
                "—"}
            </div>

            <div>
              <strong>
                Balance B/F:
              </strong>{" "}
              PENDING VERIFICATION
            </div>

            <div>
              <strong>
                Financial entries:
              </strong>{" "}
              LOCKED
            </div>
          </div>

          <button
            style={refreshButtonStyle}
            onClick={() =>
              window.location.reload()
            }
          >
            Refresh status
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
  // NORMAL CASHIER REPORT
  // ==========================================

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

  // ==========================================
  // 12-HOUR SHOP CLOSED TODAY
  // ==========================================

  if (
    shopType === "12_HOUR" &&
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

          <p style={mutedStyle}>
            This shop already completed
            today's shift.
          </p>

          <div style={
            balancePreviewStyle
          }>
            Closing Balance: KES{" "}
            {money(balanceBF)}
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

  // ==========================================
  // START SHIFT SCREEN
  // ==========================================

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
          {shopType || "SHOP"}
        </div>

        <div style={detailsStyle}>
          <div>
            <strong>
              Shop:
            </strong>{" "}
            {user.shop ||
              user.shop_name ||
              user.shopName ||
              "Shop"}
          </div>
        </div>

        {shopType === "24_HOUR" && (
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
          step="0.01"
          min="0"
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
          <p style={lockedTextStyle}>
            Carried forward from previous
            closed shift.
          </p>
        )}

        {message && (
          <div style={errorStyle}>
            {message}
          </div>
        )}

        <button
          style={{
            ...startButtonStyle,

            background:
              startingShift
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

// ==================================================
// SHOP AND SHIFT HELPERS
// ==================================================

async function getShopType(
  shopId,
  token
) {
  const result = await restGet(
    `shops?id=eq.${encodeURIComponent(
      shopId
    )}` +
      "&select=id,shop_name,shop_type,is_active&limit=1",
    token
  );

  const shop = result?.[0];

  if (!shop) {
    throw new Error(
      "Shop was not found."
    );
  }

  if (shop.is_active === false) {
    throw new Error(
      "This shop is inactive."
    );
  }

  return String(
    shop.shop_type || ""
  )
    .trim()
    .toUpperCase();
}

// ==================================================
// SHOP-WIDE OPEN SHIFT
// ==================================================

async function getShopOpenShift(
  shopId,
  token
) {
  const rows = await restGet(
    `shifts?shop_id=eq.${encodeURIComponent(
      shopId
    )}` +
      "&status=eq.OPEN" +
      "&select=*" +
      "&order=opened_at.desc" +
      "&limit=1",
    token
  );

  return rows?.[0] || null;
}

// ==================================================
// CLOSED SHIFT FOR DATE
// ==================================================

async function getClosedShiftForDate(
  shopId,
  businessDate,
  token
) {
  const rows = await restGet(
    `shifts?shop_id=eq.${encodeURIComponent(
      shopId
    )}` +
      `&business_date=eq.${encodeURIComponent(
        businessDate
      )}` +
      "&status=eq.CLOSED" +
      "&select=*" +
      "&order=closed_at.desc" +
      "&limit=1",
    token
  );

  return rows?.[0] || null;
}

// ==================================================
// LAST CLOSED SHIFT
//
// For 12H, use business-date order to avoid
// a late Admin closure making an older shift
// appear newer than the latest business date.
//
// For 24H, retain the original closed_at order.
// ==================================================

async function getLatestClosedShift(
  shopId,
  token,
  twelveHour = false
) {
  const order = twelveHour
    ? "business_date.desc,closed_at.desc"
    : "closed_at.desc";

  const rows = await restGet(
    `shifts?shop_id=eq.${encodeURIComponent(
      shopId
    )}` +
      "&status=eq.CLOSED" +
      "&select=*" +
      `&order=${order}` +
      "&limit=1",
    token
  );

  return rows?.[0] || null;
}

// ==================================================
// SHOP PLATFORMS
// ==================================================

async function getPlatforms(
  shopId,
  token
) {
  const rows = await restGet(
    `shop_platforms?shop_id=eq.${encodeURIComponent(
      shopId
    )}` +
      "&is_active=eq.true" +
      "&select=id,platform_name,display_order" +
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

// ==================================================
// PLATFORM READING
// ==================================================

async function getReading(
  shiftId,
  platformId,
  kind,
  token
) {
  const rows = await restGet(
    `platform_readings?shift_id=eq.${encodeURIComponent(
      shiftId
    )}` +
      `&platform_id=eq.${encodeURIComponent(
        platformId
      )}` +
      `&reading_kind=eq.${encodeURIComponent(
        kind
      )}` +
      "&select=reading_value" +
      "&order=recorded_at.desc" +
      "&limit=1",
    token
  );

  const raw =
    rows?.[0]?.reading_value;

  if (
    raw === "" ||
    raw == null ||
    !Number.isFinite(
      Number(raw)
    )
  ) {
    throw new Error(
      `Previous shift ${kind} reading is missing or invalid.`
    );
  }

  return roundMoney(
    Number(raw)
  );
}

// ==================================================
// 12-HOUR OPENING READINGS
// ==================================================

async function get12HourOpeningReadings(
  shopId,
  previous,
  token
) {
  const platforms =
    await getPlatforms(
      shopId,
      token
    );

  const table =
    platforms.find((p) =>
      isTable(
        p.platform_name
      )
    );

  let tableBF = 0;

  if (
    table &&
    previous?.id
  ) {
    tableBF = await getReading(
      previous.id,
      table.id,
      "CLOSING",
      token
    );
  }

  return platforms.map(
    (p) => ({
      platformId: p.id,

      value:
        isTable(p.platform_name)
          ? tableBF
          : 0,
    })
  );
}

// ==================================================
// REPAIR EXISTING 12-HOUR OPENING READINGS
//
// Only invoked for valid current-day OPEN shifts.
// Never called for locked overdue shifts.
// ==================================================

async function ensure12HourOpeningReadings(
  shopId,
  shiftId,
  cashierId,
  token
) {
  const platforms =
    await getPlatforms(
      shopId,
      token
    );

  const existing =
    await restGet(
      `platform_readings?shift_id=eq.${encodeURIComponent(
        shiftId
      )}` +
        "&reading_kind=eq.OPENING" +
        "&select=platform_id",
      token
    );

  const recorded =
    new Set(
      (existing || []).map(
        (r) => r.platform_id
      )
    );

  const missing =
    platforms.filter(
      (p) =>
        !recorded.has(p.id)
    );

  if (!missing.length) {
    return;
  }

  const tableMissing =
    missing.find((p) =>
      isTable(
        p.platform_name
      )
    );

  let tableBF = 0;

  if (tableMissing) {
    const previous =
      await getLatestClosedShift(
        shopId,
        token,
        true
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

  const readings =
    missing.map((p) => ({
      platformId: p.id,

      value:
        isTable(p.platform_name)
          ? tableBF
          : 0,
    }));

  await insertOpeningReadings(
    shiftId,
    readings,
    cashierId,
    token
  );
}

// ==================================================
// 24-HOUR PLATFORM CARRY FORWARD
// ORIGINAL LOGIC RETAINED
// ==================================================

async function get24HourCarryForwardReadings(
  shopId,
  previous,
  token
) {
  const previousName =
    normaliseShiftName(
      previous?.shift_name
    );

  const kind =
    previousName === "SHIFT 1"
      ? "HANDOVER_9PM"
      : previousName === "SHIFT 2"
      ? "CLOSING_9AM"
      : null;

  if (!kind) {
    return [];
  }

  const platforms =
    await getPlatforms(
      shopId,
      token
    );

  const rows = await restGet(
    `platform_readings?shift_id=eq.${encodeURIComponent(
      previous.id
    )}` +
      `&reading_kind=eq.${kind}` +
      "&select=platform_id,reading_value",
    token
  );

  const byPlatform =
    new Map(
      (rows || []).map(
        (r) => [
          r.platform_id,
          r.reading_value,
        ]
      )
    );

  return platforms.map(
    (p) => {
      const raw =
        byPlatform.get(
          p.id
        );

      if (
        raw === "" ||
        raw == null ||
        !Number.isFinite(
          Number(raw)
        )
      ) {
        throw new Error(
          `Previous ${previousName} is missing ${kind} for ${p.platform_name}.`
        );
      }

      return {
        platformId: p.id,
        value:
          roundMoney(
            Number(raw)
          ),
      };
    }
  );
}

// ==================================================
// CREATE SHIFT
// ==================================================

async function createShift(
  shift,
  token
) {
  const result =
    await restPost(
      "shifts",
      token,
      shift,
      true
    );

  if (
    !Array.isArray(result) ||
    !result[0]
  ) {
    throw new Error(
      "Shift was created but could not be loaded."
    );
  }

  return result[0];
}

// ==================================================
// INSERT OPENING READINGS
// ==================================================

async function insertOpeningReadings(
  shiftId,
  readings,
  cashierId,
  token
) {
  if (!readings?.length) {
    return;
  }

  const at =
    new Date().toISOString();

  await restPost(
    "platform_readings",
    token,
    readings.map((r) => ({
      shift_id:
        shiftId,

      platform_id:
        r.platformId,

      reading_kind:
        "OPENING",

      reading_value:
        roundMoney(r.value),

      recorded_at:
        at,

      recorded_by:
        cashierId,
    }))
  );
}

// ==================================================
// 24-HOUR SHIFT HELPERS
// ORIGINAL LOGIC RETAINED
// ==================================================

function normaliseShiftName(value) {
  const text =
    String(value || "")
      .trim()
      .toUpperCase()
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ");

  if (text === "SHIFT1") {
    return "SHIFT 1";
  }

  if (text === "SHIFT2") {
    return "SHIFT 2";
  }

  return text;
}

const proper24h = (name) =>
  [
    "SHIFT 1",
    "SHIFT 2",
  ].includes(
    normaliseShiftName(name)
  );

const isTable = (name) =>
  String(name || "")
    .trim()
    .toUpperCase() ===
  "TABLE";

function determineNext24HourShift(
  previous
) {
  const name =
    normaliseShiftName(
      previous?.shift_name
    );

  if (name === "SHIFT 1") {
    return "SHIFT 2";
  }

  if (name === "SHIFT 2") {
    return "SHIFT 1";
  }

  const { hour } =
    nairobiParts();

  return hour >= 9 && hour < 21
    ? "SHIFT 1"
    : "SHIFT 2";
}

function get24HourBusinessDate(
  name
) {
  const today =
    nairobiDate();

  return (
    name === "SHIFT 2" &&
    nairobiParts().hour < 9
  )
    ? datePlusDays(
        today,
        -1
      )
    : today;
}

function datePlusDays(
  dateString,
  days
) {
  const [y, m, d] =
    dateString
      .split("-")
      .map(Number);

  const date =
    new Date(
      Date.UTC(
        y,
        m - 1,
        d
      )
    );

  date.setUTCDate(
    date.getUTCDate() +
      days
  );

  return (
    `${date.getUTCFullYear()}-` +
    `${String(
      date.getUTCMonth() + 1
    ).padStart(2, "0")}-` +
    `${String(
      date.getUTCDate()
    ).padStart(2, "0")}`
  );
}

// ==================================================
// NAIROBI TIME
// ==================================================

function nairobiParts(
  date = new Date()
) {
  const fields =
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
    ).formatToParts(date);

  const out = {};

  for (const p of fields) {
    if (p.type !== "literal") {
      out[p.type] =
        p.value;
    }
  }

  return {
    year:
      +out.year,

    month:
      +out.month,

    day:
      +out.day,

    hour:
      +out.hour,

    minute:
      +out.minute,

    second:
      +out.second,
  };
}

function nairobiDate() {
  const p =
    na irobiParts();
  return (
    `${p.year}-` +
    `${String(
      p.month
    ).padStart(2, "0")}-` +
    `${String(
      p.day
    ).padStart(2, "0")}`
  );
}

function nairobiTime(date) {
  const p =
    nairobiParts(date);

  return (
    `${String(
      p.hour
    ).padStart(2, "0")}:` +
    `${String(
      p.minute
    ).padStart(2, "0")}:` +
    `${String(
      p.second
    ).padStart(2, "0")}`
  );
}

// ==================================================
// TOKEN HELPERS
// ==================================================

function shouldRefreshToken(u) {
  if (!u.access_token) {
    return true;
  }

  const stored =
    Number(u.expires_at);

  const exp =
    Number.isFinite(stored) &&
    stored > 0
      ? stored
      : jwtExpiry(
          u.access_token
        );

  return exp
    ? (
        exp -
        Math.floor(
          Date.now() / 1000
        )
      ) <= 300
    : false;
}

function jwtExpiry(token) {
  try {
    let payload =
      String(token)
        .split(".")[1]
        .replace(/-/g, "+")
        .replace(/_/g, "/");

    while (
      payload.length % 4
    ) {
      payload += "=";
    }

    return (
      Number(
        JSON.parse(
          atob(payload)
        ).exp
      ) || null
    );
  } catch {
    return null;
  }
}

function sessionExpired() {
  const err = new Error(
    "Your login session expired. Please log in again."
  );

  err.name =
    "SessionExpiredError";

  return err;
}

// ==================================================
// GENERAL HELPERS
// ==================================================

const roundMoney = (value) =>
  Math.round(
    (
      Number(value) +
      Number.EPSILON
    ) * 100
  ) / 100;

const money = (value) =>
  Number(value || 0).toLocaleString(
    "en-KE",
    {
      minimumFractionDigits:
        2,

      maximumFractionDigits:
        2,
    }
  );

// ==================================================
// STYLES
// ORIGINAL STYLES RETAINED
// ==================================================

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
  boxShadow:
    "0 4px 20px rgba(0,0,0,0.10)",
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

// ==================================================
// NEW — 12-HOUR LOCK SCREEN STYLES
// ==================================================

const centeredHeadingStyle = {
  textAlign: "center",
  color: "#0f172a",
  fontSize: 20,
};

const lockPillStyle = {
  marginTop: 15,
  marginBottom: 10,
  padding: "10px 12px",
  borderRadius: 7,
  textAlign: "center",
  fontSize: 12,
  fontWeight: 900,
  backgroundColor: "#fee2e2",
  color: "#991b1b",
};

const lockedInformationStyle = {
  display: "grid",
  gap: 10,
  padding: 15,
  borderRadius: 8,
  backgroundColor: "#f8fafc",
  border: "1px solid #e2e8f0",
  color: "#334155",
  fontSize: 12,
  overflowWrap: "anywhere",
};

const refreshButtonStyle = {
  width: "100%",
  marginTop: 18,
  border: "none",
  borderRadius: 6,
  padding: 12,
  color: "white",
  fontWeight: 800,
  fontSize: 13,
  backgroundColor: "#063c63",
  cursor: "pointer",
};
