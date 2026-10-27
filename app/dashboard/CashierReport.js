"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import CashierSafaricomWithdrawalPanel
  from "./CashierSafaricomWithdrawalPanel";
import CashierSavingsPanel from "./CashierSavingsPanel";
import CashierSalaryPanel from "./CashierSalaryPanel";
import CashierAccountsPanel from "./CashierAccountsPanel";
import CashierAccountsReturnPanel from "./CashierAccountsReturnPanel";
import CashierCloseShiftButton from "./CashierCloseShiftButton";
import CashierLiveFeedPanel from "./CashierLiveFeedPanel";
import CashierMealsRotaPanel from "./CashierMealsRotaPanel";
import {
  pageStyle, loadingStyle, topHeaderStyle, brandWrapStyle,
  crownStyle, brandStyle, taglineStyle, headerRightStyle,
  headerShopStyle, logoutButtonStyle, bodyStyle, sidebarStyle,
  mainStyle, topGridStyle, shopCardStyle, shopTitleStyle,
  shopSubtitleStyle, smallTextStyle, infoValueStyle, infoTitleStyle,
  infoSubvalueStyle, reportGridStyle, panelStyle, tableHeaderStyle,
  incomeRowStyle, amountBoxStyle, moneyInputStyle, savedMoneyStyle,
  lockedMoneyStyle, missingReadingStyle, readOnlyInlineStyle,
  incomeTotalStyle,
  panelButtonWrapStyle, platformStatusStyle, platformHeaderStyle,
  platformRowStyle, savedTextStyle, outputBoxStyle, platformActionsStyle,
  completeStyle, waitingStyle, warningStyle, blueActionStyle,
  redActionStyle, expenseHeaderStyle, expenseRowStyle, expenseInputStyle,
  savedExpenseStyle, expenseTotalStyle, summaryGridStyle, summaryValueStyle,
  lowerGridStyle, shiftGreetingStyle, messageStyle, getSidebarItemStyle,
  sidebarIconStyle, getInfoCardStyle, getInfoCardAccentStyle,
  getPanelTitleStyle, getSummaryBoxStyle,
} from "./CashierProfessionalTheme";

const EXPENSE_ROW_COUNT = 10;
const PLATFORM_CONFIG_TTL_MS = 5 * 60 * 1000;

const emptyExpenses = () =>
  Array.from(
    { length: EXPENSE_ROW_COUNT },
    () => ({ description: "", amount: "" })
  );

export default function CashierReport({ user, currentShift }) {
  const router = useRouter();

  const [operationsPanel, setOperationsPanel] = useState("salary");
  const [shift, setShift] = useState(currentShift || null);
  const [platforms, setPlatforms] = useState([]);
  const [readings, setReadings] = useState([]);
  const [incomeEntries, setIncomeEntries] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [openingInputs, setOpeningInputs] = useState({});
  const [closingInputs, setClosingInputs] = useState({});
  const [expenseInputs, setExpenseInputs] = useState(emptyExpenses);
  const [loading, setLoading] = useState(true);
  const [savingClosing, setSavingClosing] = useState(false);
  const [savingExpenses, setSavingExpenses] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [now, setNow] = useState(() => new Date());

  const requestIdRef = useRef(0);
  const reportControllerRef = useRef(null);
  const expenseSavingRef = useRef(false);
  const platformConfigCacheRef = useRef(null);
  const lastReportRefreshRef = useRef(0);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const accessToken = user?.access_token || null;
  const shiftId = currentShift?.id || null;
  const shopId =
    currentShift?.shop_id ||
    user?.shop_id ||
    user?.shopId ||
    null;

  const cashierId =
    user?.profile_id ||
    user?.id ||
    user?.user_id ||
    user?.auth_user_id ||
    null;

  const shopName =
    user?.shop ||
    user?.shop_name ||
    user?.shopName ||
    "SHOP";

 // ==========================================
  // CASHIER NAME FROM DUTY ROTA
  // ==========================================

  const [dutyCashierName, setDutyCashierName] =
    useState("LOADING ROTA...");

  const cashierName = dutyCashierName;

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;

    async function loadDutyCashier() {
      if (cancelled || inFlight) return;

      if (
        !shiftId ||
        !accessToken ||
        !supabaseUrl ||
        !supabaseAnonKey
      ) {
        if (!cancelled) {
          setDutyCashierName("ROTA UNAVAILABLE");
        }
        return;
      }

      inFlight = true;

      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/rpc/tl_cashier_rota_display`,
          {
            method: "POST",
            headers: {
              apikey: supabaseAnonKey,
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              p_shift_id: shiftId,
            }),
            cache: "no-store",
          }
        );

        const result = await safeJson(response);

        if (!response.ok) {
          throw new Error(
            result?.message ||
              result?.details ||
              "Unable to load Duty Rota."
          );
        }

        if (
          !result ||
          typeof result.display_name !== "string"
        ) {
          throw new Error(
            "Invalid Duty Rota response."
          );
        }

        if (!cancelled) {
          setDutyCashierName(
            result.display_name.trim() ||
              "NOT ASSIGNED"
          );
        }
      } catch (error) {
        console.error(
          "12-HOUR DUTY ROTA ERROR:",
          error
        );

        if (!cancelled) {
          setDutyCashierName("ROTA UNAVAILABLE");
        }
      } finally {
        inFlight = false;
      }
    }

    setDutyCashierName("LOADING ROTA...");
    void loadDutyCashier();

    // Refresh automatically every 60 seconds.
    const timer = setInterval(() => {
      void loadDutyCashier();
    }, 60000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [
    shiftId,
    accessToken,
    supabaseUrl,
    supabaseAnonKey,
  ]);

  const activeShift =
    shift?.id === shiftId ? shift : currentShift;

  const shiftStatus =
    String(activeShift?.status || "").trim().toUpperCase();

  const isShiftOpen = shiftStatus === "OPEN";

  const closingWindowOpen =
    is12HourClosingAvailable(activeShift, now);

  // Temporary messages disappear after 5 seconds.
  useEffect(() => {
    if (!message) return;

    const timer = setTimeout(() => {
      setMessage("");
      setMessageType("");
    }, 5000);

    return () => clearTimeout(timer);
  }, [message, messageType]);

  useEffect(() => {
    setNow(new Date());

    const timer = setInterval(
      () => setNow(new Date()),
      15000
    );

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    requestIdRef.current += 1;
    reportControllerRef.current?.abort();
    reportControllerRef.current = null;

    platformConfigCacheRef.current = null;
    setShift(currentShift || null);
    setPlatforms([]);
    setReadings([]);
    setIncomeEntries([]);
    setExpenses([]);
    setOpeningInputs({});
    setClosingInputs({});
    setExpenseInputs(emptyExpenses());
    setLoading(true);
    setMessage("");
    setMessageType("");
  }, [shiftId]);

  // ==========================================
  // LOAD CASHIER REPORT
  // ==========================================

  const loadReport = useCallback(async (priority = true) => {
    // Background polls never overlap. A financial-action refresh takes priority.
    if (!priority && reportControllerRef.current) return;

    reportControllerRef.current?.abort();
    const controller = new AbortController();
    reportControllerRef.current = controller;
    const requestId = ++requestIdRef.current;
    const isCurrent = () =>
      !controller.signal.aborted &&
      reportControllerRef.current === controller &&
      requestIdRef.current === requestId;

    if (
      !shiftId ||
      !shopId ||
      !accessToken ||
      !supabaseUrl ||
      !supabaseAnonKey
    ) {
      if (reportControllerRef.current === controller) {
        reportControllerRef.current = null;
      }
      setLoading(false);
      return;
    }

    const headers = authHeaders(
      supabaseAnonKey,
      accessToken
    );

    const base = `${supabaseUrl}/rest/v1`;
    const encodedId = encodeURIComponent(shiftId);

    try {
      // Shop platform assignments change infrequently. Cache only this
      // configuration; shift, readings, floats and expenses stay fresh.
      const configKey = `${supabaseUrl}|${shopId}|${accessToken}`;
      const cachedConfig = platformConfigCacheRef.current;
      const useCachedConfig =
        cachedConfig?.key === configKey &&
        Date.now() - cachedConfig.fetchedAt < PLATFORM_CONFIG_TTL_MS;

      const requests = [
        fetch(
          `${base}/shifts?id=eq.${encodedId}&select=*&limit=1`,
          { headers, cache: "no-store", signal: controller.signal }
        ),
        useCachedConfig
          ? Promise.resolve(null)
          : fetch(
              `${base}/shop_platforms?shop_id=eq.${encodeURIComponent(shopId)}` +
                `&is_active=eq.true&select=id,platform_name,reading_type,display_order` +
                `&order=display_order.asc`,
              { headers, cache: "no-store", signal: controller.signal }
            ),
        fetch(
          `${base}/platform_readings?shift_id=eq.${encodedId}` +
            `&select=id,platform_id,reading_kind,reading_value,recorded_at`,
          { headers, cache: "no-store", signal: controller.signal }
        ),
        fetch(
          `${base}/shift_income_entries?shift_id=eq.${encodedId}` +
            `&select=id,entry_type,description,amount,created_at&order=created_at.asc`,
          { headers, cache: "no-store", signal: controller.signal }
        ),
        fetch(
          `${base}/expenses?shift_id=eq.${encodedId}` +
            `&select=id,description,amount,created_at,source_type,source_record_id,is_private` +
            `&order=created_at.asc,id.asc`,
          { headers, cache: "no-store", signal: controller.signal }
        ),
      ];
      const responses = await Promise.all(requests);
      const results = await Promise.all(
        responses.map((response, index) =>
          index === 1 && useCachedConfig
            ? Promise.resolve(cachedConfig.data)
            : safeJson(response)
        )
      );
      const errors = [
        "Unable to load shift.",
        "Unable to load platforms.",
        "Unable to load readings.",
        "Unable to load float entries.",
        "Unable to load expenses.",
      ];
      responses.forEach((response, index) => {
        if (response && !response.ok) {
          throw new Error(
            results[index]?.message || results[index]?.details || errors[index]
          );
        }
      });
      if (!isCurrent()) return;
      if (!useCachedConfig && Array.isArray(results[1])) {
        platformConfigCacheRef.current = {
          key: configKey,
          data: results[1],
          fetchedAt: Date.now(),
        };
      }

      const latestShift = Array.isArray(results[0])
        ? results[0][0]
        : null;

      if (
        !latestShift ||
        String(latestShift.shop_id) !== String(shopId)
      ) {
        throw new Error(
          "The selected shift was not found in this shop."
        );
      }

      if (!isCurrent()) return;

      const nextPlatforms = Array.isArray(results[1])
        ? results[1]
        : [];

      const nextReadings = Array.isArray(results[2])
        ? results[2]
        : [];

      const nextIncome = Array.isArray(results[3])
        ? results[3]
        : [];

      const nextExpenses = Array.isArray(results[4])
        ? results[4]
        : [];

      const manual = nextExpenses.filter(
        isManualPublicExpense
      );

      const openingMap = new Map();
      const closingMap = new Map();

      for (const row of nextReadings) {
        if (row.reading_kind === "OPENING") {
          openingMap.set(row.platform_id, row);
        }

        if (row.reading_kind === "CLOSING") {
          closingMap.set(row.platform_id, row);
        }
      }

      lastReportRefreshRef.current = Date.now();
      setShift(latestShift);
      setPlatforms(nextPlatforms);
      setReadings(nextReadings);
      setIncomeEntries(nextIncome);
      setExpenses(nextExpenses);

      setOpeningInputs((old) => {
        const next = {};

        for (const platform of nextPlatforms) {
          const saved = openingMap.get(platform.id);

          next[platform.id] = saved
            ? String(saved.reading_value ?? "")
            : old[platform.id] ?? "";
        }

        return next;
      });

      setClosingInputs((old) => {
        const next = {};

        for (const platform of nextPlatforms) {
          const saved = closingMap.get(platform.id);

          next[platform.id] = saved
            ? String(saved.reading_value ?? "")
            : old[platform.id] ?? "";
        }

        return next;
      });

      setExpenseInputs((old) =>
        Array.from(
          { length: EXPENSE_ROW_COUNT },
          (_, index) =>
            manual[index]
              ? {
                  description:
                    manual[index].description || "",
                  amount: String(
                    manual[index].amount ?? ""
                  ),
                }
              : old[index] || {
                  description: "",
                  amount: "",
                }
        )
      );
    } catch (error) {
      if (!isCurrent() || error?.name === "AbortError") return;
      console.error("CASHIER REPORT ERROR:", error);

      if (isCurrent()) {
        setMessage(
          error?.message ||
          "Unable to load cashier report."
        );
        setMessageType("error");
      }
    } finally {
      if (isCurrent()) setLoading(false);
      if (reportControllerRef.current === controller) {
        reportControllerRef.current = null;
      }
    }
  }, [
    shiftId,
    shopId,
    accessToken,
    supabaseUrl,
    supabaseAnonKey,
  ]);

  useEffect(() => {
    // Initial load and action-triggered refreshes take priority.
    void loadReport(true);

    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") {
        void loadReport(false);
      }
    };
    const onVisibilityChange = () => {
      // Avoid an immediate duplicate after a recent successful refresh.
      if (document.visibilityState === "visible" &&
          Date.now() - lastReportRefreshRef.current >= 30000) {
        void loadReport(false);
      }
    };

    const timer = setInterval(refreshIfVisible, 30000);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      requestIdRef.current += 1;
      reportControllerRef.current?.abort();
      reportControllerRef.current = null;
    };
  }, [loadReport]);

  function logout() {
    sessionStorage.removeItem("teamLegendUser");
    router.replace("/");
  }

  // ==========================================
  // REPORT VALUES
  // ==========================================

  const savedOpeningIds = useMemo(
    () =>
      new Set(
        readings
          .filter((r) => r.reading_kind === "OPENING")
          .map((r) => r.platform_id)
      ),
    [readings]
  );

  const savedClosingIds = useMemo(
    () =>
      new Set(
        readings
          .filter((r) => r.reading_kind === "CLOSING")
          .map((r) => r.platform_id)
      ),
    [readings]
  );

  const savedOpeningCount = platforms.filter(
    (p) => savedOpeningIds.has(p.id)
  ).length;

  const savedClosingCount = platforms.filter(
    (p) => savedClosingIds.has(p.id)
  ).length;

  const allOpeningsSaved =
    platforms.length > 0 &&
    savedOpeningCount === platforms.length;

  const allClosingsSaved =
    platforms.length > 0 &&
    savedClosingCount === platforms.length;

  // Keep all four platform columns visible for every 12-hour shop.
  // Closing inputs remain disabled until the existing closing window opens.
  const showClosing = true;

  const platformGridColumns = "1.25fr 1fr 1fr 1fr";

  const floatData = useMemo(() => {
    const companyEntries = incomeEntries.filter(
      (e) => e.entry_type === "COMPANY_FLOAT"
    );

    const mshwariEntries = incomeEntries.filter(
      (e) => e.entry_type === "MSHWARI_FLOAT"
    );

    return {
      companyEntries,
      mshwariEntries,
      companyTotal: roundMoney(
        companyEntries.reduce(
          (sum, e) => sum + Number(e.amount || 0),
          0
        )
      ),
      mshwariTotal: roundMoney(
        mshwariEntries.reduce(
          (sum, e) => sum + Number(e.amount || 0),
          0
        )
      ),
    };
  }, [incomeEntries]);

  const companySlots = Array.from(
    { length: 3 },
    (_, i) => floatData.companyEntries[i] || null
  );

  const mshwariSlots = Array.from(
    { length: 3 },
    (_, i) => floatData.mshwariEntries[i] || null
  );

  const manualExpenses = useMemo(
    () => expenses.filter(isManualPublicExpense),
    [expenses]
  );

  const activeExpenseIndex = Math.min(
    manualExpenses.length,
    EXPENSE_ROW_COUNT
  );

  const platformRows = useMemo(
    () =>
      platforms.map((platform) => {
        const openingRow = readings.find(
          (r) =>
            r.platform_id === platform.id &&
            r.reading_kind === "OPENING"
        );

        const closingRow = readings.find(
          (r) =>
            r.platform_id === platform.id &&
            r.reading_kind === "CLOSING"
        );

        const opening = numericOrNull(
          openingRow
            ? openingRow.reading_value
            : openingInputs[platform.id]
        );

        const closing = numericOrNull(
          closingRow
            ? closingRow.reading_value
            : closingInputs[platform.id]
        );

        return {
          ...platform,
          opening,
          closing,
          output:
            opening !== null && closing !== null
              ? roundMoney(closing - opening)
              : 0,
          openingSaved: Boolean(openingRow),
          closingSaved: Boolean(closingRow),
        };
      }),
    [
      platforms,
      readings,
      openingInputs,
      closingInputs,
    ]
  );

  // ==========================================
  // VERIFY OPEN SHIFT BEFORE WRITING
  // ==========================================

  async function verifyShiftOpen() {
    if (
      !shiftId ||
      !shopId ||
      !accessToken ||
      !supabaseUrl ||
      !supabaseAnonKey
    ) {
      throw new Error(
        "Shift or login information is missing."
      );
    }

    const response = await fetch(
      `${supabaseUrl}/rest/v1/shifts?id=eq.${encodeURIComponent(shiftId)}` +
        `&select=id,shop_id,status,business_date&limit=1`,
      {
        headers: authHeaders(
          supabaseAnonKey,
          accessToken
        ),
        cache: "no-store",
      }
    );

    const result = await safeJson(response);

    if (!response.ok) {
      throw new Error(
        result?.message ||
        "Unable to verify shift status."
      );
    }

    const fresh = Array.isArray(result)
      ? result[0]
      : null;

    if (
      !fresh ||
      String(fresh.shop_id) !== String(shopId) ||
      String(fresh.status || "").toUpperCase() !== "OPEN"
    ) {
      throw new Error(
        "This shift is not OPEN. Contact Admin for recovery."
      );
    }

    return fresh;
  }
  // ==========================================
  // SAVE ONE EXPENSE AT A TIME
  // ==========================================

  async function saveExpenses() {
    if (savingExpenses || expenseSavingRef.current) {
      return;
    }

    if (!isShiftOpen) {
      setMessage(
        "This shift is closed. Contact Admin for corrections."
      );
      setMessageType("error");
      return;
    }

    if (loading) return;

    if (activeExpenseIndex >= EXPENSE_ROW_COUNT) {
      setMessage(
        "All 10 expense rows have already been saved."
      );
      setMessageType("error");
      return;
    }

    const index = activeExpenseIndex;

    const description = String(
      expenseInputs[index]?.description || ""
    ).trim();

    const raw = expenseInputs[index]?.amount;

    const hasAmount =
      raw !== "" &&
      raw !== null &&
      raw !== undefined;

    const amount = Number(raw);

    if (!description) {
      setMessage(
        `Enter the description for expense ${index + 1}.`
      );
      setMessageType("error");
      return;
    }

    if (
      !hasAmount ||
      !Number.isFinite(amount) ||
      roundMoney(amount) <= 0
    ) {
      setMessage(
        `Enter a valid amount for expense ${index + 1}.`
      );
      setMessageType("error");
      return;
    }

    let posted = false;
    expenseSavingRef.current = true;

    try {
      setSavingExpenses(true);
      setMessage("");
      setMessageType("");

      await verifyShiftOpen();

      // Confirm the expected expense row is next.
      const beforeResponse = await fetch(
        `${supabaseUrl}/rest/v1/expenses?shift_id=eq.${encodeURIComponent(shiftId)}` +
          `&select=id,source_type,source_record_id,is_private`,
        {
          headers: authHeaders(
            supabaseAnonKey,
            accessToken
          ),
          cache: "no-store",
        }
      );

      const beforeRows = await safeJson(beforeResponse);

      if (
        !beforeResponse.ok ||
        !Array.isArray(beforeRows)
      ) {
        throw new Error(
          "Unable to verify existing expense rows."
        );
      }

      const savedCount = beforeRows.filter(
        isManualPublicExpense
      ).length;

      if (savedCount !== index) {
        throw new Error(
          "Expense rows changed elsewhere. Refresh before saving."
        );
      }

      const response = await fetch(
        `${supabaseUrl}/rest/v1/expenses`,
        {
          method: "POST",
          headers: {
            ...authHeaders(
              supabaseAnonKey,
              accessToken
            ),
            Prefer: "return=representation",
          },
          body: JSON.stringify({
            shift_id: shiftId,
            description,
            amount: roundMoney(amount),
            created_by: cashierId,
            source_type: "MANUAL",
            is_private: false,
          }),
        }
      );

      const inserted = await safeJson(response);

      if (!response.ok) {
        throw new Error(
          inserted?.message ||
          inserted?.details ||
          "Unable to save expense."
        );
      }

      if (
        !Array.isArray(inserted) ||
        inserted.length !== 1
      ) {
        throw new Error(
          "Expense save response was incomplete. Refresh before retrying."
        );
      }

      posted = true;

      // Recalculate from all saved expenses.
      const summaryResponse = await fetch(
        `${supabaseUrl}/rest/v1/expenses?shift_id=eq.${encodeURIComponent(shiftId)}` +
          `&select=amount`,
        {
          headers: authHeaders(
            supabaseAnonKey,
            accessToken
          ),
          cache: "no-store",
        }
      );

      const summaryRows =
        await safeJson(summaryResponse);

      if (
        !summaryResponse.ok ||
        !Array.isArray(summaryRows)
      ) {
        throw new Error(
          "Expense saved, but the total must be reconciled."
        );
      }

      const newExpenseTotal = roundMoney(
        summaryRows.reduce(
          (sum, row) =>
            sum + Number(row.amount || 0),
          0
        )
      );

      const shiftResponse = await fetch(
        `${supabaseUrl}/rest/v1/shifts?id=eq.${encodeURIComponent(shiftId)}&status=eq.OPEN`,
        {
          method: "PATCH",
          headers: {
            ...authHeaders(
              supabaseAnonKey,
              accessToken
            ),
            Prefer: "return=representation",
          },
          body: JSON.stringify({
            total_expenses: newExpenseTotal,
          }),
        }
      );

      const updated = await safeJson(shiftResponse);

      if (
        !shiftResponse.ok ||
        !Array.isArray(updated) ||
        !updated.length
      ) {
        throw new Error(
          "Expense saved, but the shift total was not updated."
        );
      }

      // No unnecessary yellow confirmation banner.
      setMessage("");
      setMessageType("");

    } catch (error) {
      setMessage(
        posted
          ? `Expense saved. Do not resubmit; Admin must check totals. ${error?.message || ""}`
          : error?.message ||
            "Unable to save expense."
      );
      setMessageType("error");

    } finally {
      setSavingExpenses(false);
      await loadReport();
      expenseSavingRef.current = false;
    }
  }

  // ==========================================
  // SAVE CLOSING READINGS
  // ==========================================

  async function saveClosingReadings() {
    if (savingClosing) return;

    if (!isShiftOpen) {
      setMessage(
        "This shift is closed. Contact Admin for recovery."
      );
      setMessageType("error");
      return;
    }

    if (
      !is12HourClosingAvailable(
        activeShift,
        new Date()
      )
    ) {
      setMessage(
        "Closing readings open at 9:30 PM on this shift's business date."
      );
      setMessageType("error");
      return;
    }

    if (!allOpeningsSaved) {
      setMessage(
        "Automatic opening readings are incomplete. Contact Admin."
      );
      setMessageType("error");
      return;
    }

    if (!platforms.length) {
      setMessage(
        "No active platforms were found."
      );
      setMessageType("error");
      return;
    }

    let posted = false;

    try {
      setSavingClosing(true);
      setMessage("");
      setMessageType("");

      const freshShift = await verifyShiftOpen();

      if (
        !is12HourClosingAvailable(
          freshShift,
          new Date()
        )
      ) {
        throw new Error(
          "Closing time for this shift has not arrived."
        );
      }

      const response = await fetch(
        `${supabaseUrl}/rest/v1/platform_readings?shift_id=eq.${encodeURIComponent(shiftId)}` +
          `&select=id,platform_id,reading_kind,reading_value`,
        {
          headers: authHeaders(
            supabaseAnonKey,
            accessToken
          ),
          cache: "no-store",
        }
      );

      const freshRows = await safeJson(response);

      if (
        !response.ok ||
        !Array.isArray(freshRows)
      ) {
        throw new Error(
          freshRows?.message ||
          "Unable to verify existing readings."
        );
      }

      const freshOpenings = new Map(
        freshRows
          .filter(
            (r) => r.reading_kind === "OPENING"
          )
          .map((r) => [r.platform_id, r])
      );

      const freshClosings = new Map(
        freshRows
          .filter(
            (r) => r.reading_kind === "CLOSING"
          )
          .map((r) => [r.platform_id, r])
      );

      const unsaved = platforms.filter(
        (p) => !freshClosings.has(p.id)
      );

      if (!unsaved.length) {
        setMessage(
          "Closing readings are already saved."
        );
        setMessageType("success");
        await loadReport();
        return;
      }

      const recordedAt = new Date().toISOString();

      const payload = unsaved.map((platform) => {
        const opening = numericOrNull(
          freshOpenings.get(platform.id)
            ?.reading_value
        );

        const closing = numericOrNull(
          closingInputs[platform.id]
        );

        if (opening === null) {
          throw new Error(
            `Opening reading for ${platform.platform_name} is missing. Contact Admin.`
          );
        }

        // Negative, zero and positive readings are valid.
        if (closing === null) {
          throw new Error(
            `Enter a valid closing reading for ${platform.platform_name}.`
          );
        }

        return {
          shift_id: shiftId,
          platform_id: platform.id,
          reading_kind: "CLOSING",
          reading_value: roundMoney(closing),
          recorded_at: recordedAt,
          recorded_by: cashierId,
        };
      });

      const insertResponse = await fetch(
        `${supabaseUrl}/rest/v1/platform_readings`,
        {
          method: "POST",
          headers: {
            ...authHeaders(
              supabaseAnonKey,
              accessToken
            ),
            Prefer: "return=representation",
          },
          body: JSON.stringify(payload),
        }
      );

      const insertedRows =
        await safeJson(insertResponse);

      if (!insertResponse.ok) {
        throw new Error(
          insertedRows?.message ||
          insertedRows?.details ||
          "Unable to save readings."
        );
      }

      if (
        !Array.isArray(insertedRows) ||
        insertedRows.length !== payload.length
      ) {
        throw new Error(
          "Reading save response was incomplete. Refresh before retrying."
        );
      }

      posted = true;

      for (const row of insertedRows) {
        freshClosings.set(row.platform_id, row);
      }

      let totalOutput = 0;

      for (const platform of platforms) {
        const opening = numericOrNull(
          freshOpenings.get(platform.id)
            ?.reading_value
        );

        const closing = numericOrNull(
          freshClosings.get(platform.id)
            ?.reading_value
        );

        if (
          opening !== null &&
          closing !== null
        ) {
          totalOutput += closing - opening;
        }
      }

      const patchResponse = await fetch(
        `${supabaseUrl}/rest/v1/shifts?id=eq.${encodeURIComponent(shiftId)}&status=eq.OPEN`,
        {
          method: "PATCH",
          headers: {
            ...authHeaders(
              supabaseAnonKey,
              accessToken
            ),
            Prefer: "return=representation",
          },
          body: JSON.stringify({
            total_output: roundMoney(totalOutput),
          }),
        }
      );

      const patchResult =
        await safeJson(patchResponse);

      if (
        !patchResponse.ok ||
        !Array.isArray(patchResult) ||
        !patchResult.length
      ) {
        throw new Error(
          "Readings saved, but sales total could not be updated."
        );
      }

      setMessage(
        "Closing readings saved successfully."
      );
      setMessageType("success");

    } catch (error) {
      setMessage(
        posted
          ? `Readings were saved. Do not re-enter them; Admin must check the output. ${error?.message || ""}`
          : error?.message ||
            "Unable to save closing readings."
      );
      setMessageType("error");

    } finally {
      setSavingClosing(false);
      await loadReport();
    }
  }

  // ==========================================
  // CASHIER SUMMARY
  // ==========================================

  const openingBalance = Number(
    activeShift?.opening_balance || 0
  );

  const savedTotalOutput = Number(
    activeShift?.total_output || 0
  );

  const totalExpenses = Number(
    activeShift?.total_expenses || 0
  );

  const closingBalance = Number(
    activeShift?.closing_balance || 0
  );

  const totalAdded = roundMoney(
    openingBalance +
    floatData.companyTotal +
    floatData.mshwariTotal
  );

  const totalSales = roundMoney(
    totalAdded + savedTotalOutput
  );

  const reportDate = formatReportDate(
    activeShift?.business_date ||
    activeShift?.opened_at ||
    new Date()
  );
  const reportDay = formatReportDay(
    activeShift?.business_date ||
    activeShift?.opened_at ||
    new Date()
  );

  const shiftNumber = getShiftNumber(activeShift);

  const shiftGreeting = getShiftGreeting(
    now,
    shiftStatus,
    shiftNumber
  );

  if (loading && !activeShift) {
    return (
      <div style={loadingStyle}>
        Loading cashier report...
      </div>
    );
  }

  if (!activeShift) return null;
  // ==========================================
  // DASHBOARD
  // ==========================================

  return (
    <div className="tl-cashier-12h" style={pageStyle}>
      <style>{`
        .tl-cashier-12h input[type="number"] {
          appearance: textfield;
          -moz-appearance: textfield;
        }

        .tl-cashier-12h input[type="number"]::-webkit-inner-spin-button,
        .tl-cashier-12h input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }

        @media (max-width: 950px) {
          .tl-cashier-lower-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 650px) {
          .tl-cashier-lower-grid {
            grid-template-columns:
              minmax(0, 1fr) !important;
          }
        }

        @media (max-width: 650px) {
          .tl-cashier-salary-withdrawal-row {
            grid-template-columns: minmax(0, 1fr) !important;
          }
        }
      `}</style>

      <header style={topHeaderStyle}>
        <div style={brandWrapStyle}>
          <div style={crownStyle}>♛</div>

          <div>
            <div style={brandStyle}>
              TEAM LEGEND
            </div>

            <div style={taglineStyle}>
              DISCIPLINE • FOCUS • RESULTS
            </div>
          </div>
        </div>

        <div style={headerRightStyle}>
          <div>
            Welcome,{" "}
            <strong>
              {cashierName.toUpperCase()}
            </strong>

            <div style={headerShopStyle}>
              {shopName.toUpperCase()}
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            style={logoutButtonStyle}
          >
            Logout
          </button>
        </div>
      </header>

      <CashierLiveFeedPanel user={user} />
      <CashierMealsRotaPanel
  user={user}
  currentShift={activeShift}
/>
      <div style={bodyStyle}>
        <aside style={sidebarStyle}>
          <SidebarItem
            active
            icon="⌂"
            label="Cashier Report"
          />
          <SidebarItem
            icon="▤"
            label="View Reports"
          />
          <SidebarItem
            icon="▥"
            label="Management"
          />
          <SidebarItem
            icon="▦"
            label="Accounts"
          />
          <SidebarItem
            icon="⚙"
            label="Settings"
          />
        </aside>

        <main style={mainStyle}>
          {/* TOP INFORMATION */}

          <div style={topGridStyle}>
            <TopCard
              title={shopName.toUpperCase()}
              subtitle="DAILY SALES REPORT"
              footer="12-HOUR SHOP"
            />

            <InfoCard
              title="CASHIER ON DUTY"
              value={cashierName}
              tone="brown"
            />

            <InfoCard
              title="DATE"
              value={reportDate}
            />

            <InfoCard
              title="DAY"
              value={reportDay}
            />

            <InfoCard
              title="SHIFT"
              value={activeShift.shift_name || "DAY"}
              subvalue={
                `${displayTime(activeShift.scheduled_start)} - ` +
                displayTime(activeShift.scheduled_end)
              }
              tone="green"
            />

            <InfoCard
              title="STATUS"
              value={shiftStatus}
              tone="green"
            />
          </div>

         
<div
  style={{
    ...shiftGreetingStyle,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
    width: "100%",
    boxSizing: "border-box",
  }}
>
  {shiftGreeting}
</div>


          {message && (
            <div
              style={{
                ...messageStyle,
                backgroundColor:
                  messageType === "success"
                    ? "#ecfdf5"
                    : "#fef2f2",
                color:
                  messageType === "success"
                    ? "#166534"
                    : "#991b1b",
              }}
            >
              {message}
            </div>
          )}

          <div style={reportGridStyle}>
            {/* INCOME STATEMENT */}

            <section style={panelStyle}>
              <PanelTitle
                title="INCOME STATEMENT"
                tone="blue"
              />

              <div style={tableHeaderStyle}>
                <div>DESCRIPTION</div>
                <div>AMOUNT (KES)</div>
              </div>

              <IncomeDisplayRow
                label="Balance B/F (Previous Shift)"
                amount={openingBalance}
              />

              {companySlots.map((entry, i) => (
                <ReadOnlyFloatRow
                  key={`company-${i}`}
                  label={
                    `Added Float ${i + 1} From Company`
                  }
                  entry={entry}
                />
              ))}

              {mshwariSlots.map((entry, i) => (
                <ReadOnlyFloatRow
                  key={`mshwari-${i}`}
                  label={
                    `Added Float ${i + 1} From M-Shwari`
                  }
                  entry={entry}
                />
              ))}

              <div style={incomeTotalStyle}>
                <strong>TOTAL ADDED</strong>
                <strong>{money(totalAdded)}</strong>
              </div>
            </section>

            {/* PLATFORM SALES */}

            <section style={panelStyle}>
              <PanelTitle
                title="PLATFORM SALES"
                tone="green"
              />

              <div style={platformStatusStyle}>
                <span>
                  Opening: {savedOpeningCount}/
                  {platforms.length}
                </span>

                {showClosing && (
                  <span>
                    Closing: {savedClosingCount}/
                    {platforms.length}
                  </span>
                )}
              </div>

              <div
                style={{
                  ...platformHeaderStyle,
                  gridTemplateColumns:
                    platformGridColumns,
                }}
              >
                <div>SHOP / PLATFORM</div>
                <div>OPENING</div>

                {showClosing && (
                  <div>CLOSING</div>
                )}

                <div>SALES</div>
              </div>

              {platformRows.map((platform) => (
                <div
                  key={platform.id}
                  style={{
                    ...platformRowStyle,
                    gridTemplateColumns:
                      platformGridColumns,
                  }}
                >
                  <div>
                    <strong>
                      {platform.platform_name}
                    </strong>

                    {platform.openingSaved && (
                      <div style={savedTextStyle}>
                        Opening ✓
                      </div>
                    )}

                    {showClosing &&
                      platform.closingSaved && (
                        <div style={savedTextStyle}>
                          Closing ✓
                        </div>
                      )}
                  </div>

                  {platform.openingSaved ? (
                    <SavedReadingBox
                      value={platform.opening}
                    />
                  ) : (
                    <div style={missingReadingStyle}>
                      Missing
                    </div>
                  )}

                  {showClosing && (
                    platform.closingSaved ? (
                      <SavedReadingBox
                        value={platform.closing}
                      />
                    ) : (
                      <ReadingInput
                        value={
                          closingInputs[platform.id] ?? ""
                        }
                        disabled={
                          !closingWindowOpen ||
                          !allOpeningsSaved ||
                          !isShiftOpen ||
                          savingClosing
                        }
                        onChange={(value) =>
                          setClosingInputs((old) => ({
                            ...old,
                            [platform.id]: value,
                          }))
                        }
                      />
                    )
                  )}

                  <div style={outputBoxStyle}>
                    {money(platform.output)}
                  </div>
                </div>
              ))}

              <div style={platformActionsStyle}>
                {!allOpeningsSaved && (
                  <div style={warningStyle}>
                    Automatic opening readings
                    are incomplete. Contact Admin.
                  </div>
                )}

                {showClosing &&
                  closingWindowOpen &&
                  isShiftOpen &&
                  allOpeningsSaved &&
                  !allClosingsSaved && (
                    <button
                      type="button"
                      onClick={saveClosingReadings}
                      disabled={
                        savingClosing || loading
                      }
                      style={blueActionStyle}
                    >
                      {savingClosing
                        ? "Saving Closing Readings..."
                        : "Save Closing Readings"}
                    </button>
                  )}

                {allOpeningsSaved && (
                  <div style={completeStyle}>
                    Opening Readings Saved ✓
                  </div>
                )}

                {allClosingsSaved && (
                  <div style={completeStyle}>
                    Closing Readings Saved ✓
                  </div>
                )}

                {!isShiftOpen && (
                  <div style={warningStyle}>
                    Shift closed. Contact Admin
                    for corrections.
                  </div>
                )}
              </div>
            </section>

            {/* EXPENSES */}

            <section style={panelStyle}>
              <PanelTitle
                title="EXPENSES"
                tone="red"
              />

              <div style={expenseHeaderStyle}>
                <div>NO.</div>
                <div>DESCRIPTION</div>
                <div>AMOUNT (KES)</div>
              </div>

              {Array.from(
                { length: EXPENSE_ROW_COUNT },
                (_, index) => {
                  const saved =
                    manualExpenses[index];

                  const canEdit =
                    isShiftOpen &&
                    !savingExpenses &&
                    !loading &&
                    index === activeExpenseIndex;

                  return (
                    <div
                      key={index}
                      style={expenseRowStyle}
                    >
                      <div>{index + 1}</div>

                      {saved ? (
                        <>
                          <div
                            style={savedExpenseStyle}
                          >
                            {saved.description}
                          </div>

                          <div
                            style={savedExpenseStyle}
                          >
                            {money(saved.amount)} ✓
                          </div>
                        </>
                      ) : (
                        <>
                          <input
                            value={
                              expenseInputs[index]
                                ?.description || ""
                            }
                            disabled={!canEdit}
                            placeholder={
                              index ===
                              activeExpenseIndex
                                ? "Description"
                                : "Locked"
                            }
                            onChange={(event) => {
                              const value =
                                event.target.value;

                              setExpenseInputs(
                                (old) =>
                                  old.map(
                                    (item, i) =>
                                      i === index
                                        ? {
                                            ...item,
                                            description:
                                              value,
                                          }
                                        : item
                                  )
                              );
                            }}
                            style={{
                              ...expenseInputStyle,
                              opacity: canEdit
                                ? 1
                                : 0.65,
                            }}
                          />

                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={
                              expenseInputs[index]
                                ?.amount ?? ""
                            }
                            disabled={!canEdit}
                            placeholder="0.00"
                            onChange={(event) => {
                              const value =
                                event.target.value;

                              setExpenseInputs(
                                (old) =>
                                  old.map(
                                    (item, i) =>
                                      i === index
                                        ? {
                                            ...item,
                                            amount:
                                              value,
                                          }
                                        : item
                                  )
                              );
                            }}
                            style={{
                              ...expenseInputStyle,
                              opacity: canEdit
                                ? 1
                                : 0.65,
                            }}
                          />
                        </>
                      )}
                    </div>
                  );
                }
              )}

              <div style={expenseTotalStyle}>
                <strong>
                  TOTAL EXPENSES
                </strong>
                <strong>
                  {money(totalExpenses)}
                </strong>
              </div>

              <div style={panelButtonWrapStyle}>
                <button
                  type="button"
                  onClick={saveExpenses}
                  disabled={
                    savingExpenses ||
                    !isShiftOpen ||
                    loading ||
                    activeExpenseIndex >=
                      EXPENSE_ROW_COUNT
                  }
                  style={{
                    ...redActionStyle,
                    opacity:
                      savingExpenses ||
                      !isShiftOpen ||
                      activeExpenseIndex >=
                        EXPENSE_ROW_COUNT
                        ? 0.6
                        : 1,
                  }}
                >
                  {savingExpenses
                    ? "Saving..."
                    : activeExpenseIndex >=
                      EXPENSE_ROW_COUNT
                    ? "All Expenses Saved"
                    : `Save Expense ${
                        activeExpenseIndex + 1
                      }`}
                </button>
              </div>
            </section>
          </div>

          {/* SUMMARY */}

          <div style={summaryGridStyle}>
            <SummaryBox
              title="TOTAL SALES"
              amount={totalSales}
              tone="blue"
            />

            <SummaryBox
              title="TOTAL EXPENSES"
              amount={totalExpenses}
              tone="red"
            />

            <SummaryBox
              title="CLOSING BALANCE"
              amount={closingBalance}
              tone="navy"
            />
          </div>

          {/* LOWER PANELS */}

          <div
            className="tl-cashier-lower-grid"
            style={lowerGridStyle}
          >
            <CashierSavingsPanel
              user={user}
              currentShift={activeShift}
              bankingActive={operationsPanel === "banking"}
            />

            {/* Dashboard organization only: keep existing transaction components mounted. */}
            <section style={{ gridColumn: "1 / -1", minWidth: 0, width: "100%" }}>
              <div style={{
                background: "#152639", border: "1px solid #2a3d52",
                borderLeft: "3px solid #d9b66c", borderRadius: 12,
                padding: 14, marginBottom: 12,
              }}>
                <label htmlFor="tl-cashier-operations-choice" style={{
                  display: "block", color: "#f0f5fa", fontWeight: 850,
                  fontSize: 13, marginBottom: 9,
                }}>
                  TRANSACTION CONTROL
                </label>
                <select
                  id="tl-cashier-operations-choice"
                  value={operationsPanel}
                  onChange={(event) => setOperationsPanel(event.target.value)}
                  style={{
                    width: "100%", minHeight: 44, padding: "10px 12px",
                    color: "#f0f5fa", background: "#0a1725",
                    border: "1px solid #40556b", borderRadius: 8,
                    fontSize: 13, fontWeight: 750,
                  }}
                >
                  <option value="salary">Salary</option>
                  <option value="banking">Banking</option>
                  <option value="accounts">Accounts Information</option>
                  <option value="safaricom">Safaricom Withdrawal</option>
                  <option value="return">Send Float to Legend Accounts</option>
                </select>
              </div>

              <div id="tl-cashier-banking-slot" style={{ display: operationsPanel === "banking" ? "block" : "none" }} />
              <div style={{ display: operationsPanel === "salary" ? "block" : "none" }}>
                <CashierSalaryPanel user={user} currentShift={activeShift} />
              </div>
              <div style={{ display: operationsPanel === "accounts" ? "block" : "none" }}>
                <CashierAccountsPanel user={user} />
              </div>
              <div style={{ display: operationsPanel === "safaricom" ? "block" : "none" }}>
                <CashierSafaricomWithdrawalPanel
                  user={user}
                  currentShift={activeShift}
                  onWithdrawalChanged={() => void loadReport(true)}
                />
              </div>
              <div style={{ display: operationsPanel === "return" ? "block" : "none" }}>
                <CashierAccountsReturnPanel
                  user={user}
                  currentShift={activeShift}
                  onReturnChanged={() => void loadReport(true)}
                />
              </div>
            </section>

          </div>

          <CashierCloseShiftButton
            user={user}
            currentShift={activeShift}
          />
        </main>
      </div>
    </div>
  );
}
// ==========================================
// DISPLAY COMPONENTS
// ==========================================

function SidebarItem({
  icon,
  label,
  active,
}) {
  return (
    <div style={getSidebarItemStyle(active)}>
      <span style={sidebarIconStyle}>
        {icon}
      </span>

      <span>{label}</span>
    </div>
  );
}

function TopCard({
  title,
  subtitle,
  footer,
}) {
  return (
    <div style={shopCardStyle}>
      <div style={shopTitleStyle}>
        {title}
      </div>

      <div style={shopSubtitleStyle}>
        {subtitle}
      </div>

      <div style={smallTextStyle}>
        {footer}
      </div>
    </div>
  );
}

function InfoCard({
  title,
  value,
  subvalue,
  tone,
}) {
  return (
    <div style={getInfoCardStyle(tone)}>
      <div style={infoTitleStyle}>
        {title}
      </div>

      <div style={infoValueStyle}>
        {value}
      </div>

      {subvalue ? (
        <div style={infoSubvalueStyle}>
          {subvalue}
        </div>
      ) : null}

      <div
        style={getInfoCardAccentStyle(tone)}
      />
    </div>
  );
}

function PanelTitle({ title, tone }) {
  return (
    <div style={getPanelTitleStyle(tone)}>
      {title}
    </div>
  );
}

function IncomeDisplayRow({
  label,
  amount,
}) {
  return (
    <div style={incomeRowStyle}>
      <div>{label}</div>

      <div style={amountBoxStyle}>
        {money(amount)}
      </div>
    </div>
  );
}

function ReadOnlyFloatRow({
  label,
  entry,
}) {
  return (
    <div style={incomeRowStyle}>
      <div>
        {label}{" "}
        <span style={readOnlyInlineStyle}>
          {entry ? "✓" : "🔒"}
        </span>
      </div>

      <div
        style={
          entry
            ? savedMoneyStyle
            : lockedMoneyStyle
        }
      >
        {entry
          ? money(entry.amount)
          : "0.00"}
      </div>
    </div>
  );
}

function ReadingInput({
  value,
  onChange,
  disabled,
}) {
  return (
    <input
      type="number"
      step="0.01"
      value={value}
      disabled={disabled}
      onChange={(event) =>
        onChange(event.target.value)
      }
      style={moneyInputStyle}
    />
  );
}

function SavedReadingBox({ value }) {
  return (
    <div style={savedMoneyStyle}>
      {money(value)}
    </div>
  );
}

function SummaryBox({
  title,
  amount,
  tone,
}) {
  return (
    <div style={getSummaryBoxStyle(tone)}>
      {title}

      <div style={summaryValueStyle}>
        KES {money(amount)}
      </div>
    </div>
  );
}

// ==========================================
// SUPABASE HELPERS
// ==========================================

function authHeaders(
  anonKey,
  token
) {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function isManualPublicExpense(expense) {
  const source = String(
    expense?.source_type || ""
  ).trim().toUpperCase();

  return (
    (source === "" || source === "MANUAL") &&
    expense?.is_private !== true &&
    expense?.source_record_id == null
  );
}

// ==========================================
// NUMBER HELPERS
// ==========================================

function numericOrNull(value) {
  if (
    value === "" ||
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function money(value) {
  const number = Number(value ?? 0);

  return (
    Number.isFinite(number)
      ? number
      : 0
  ).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function roundMoney(value) {
  return (
    Math.round(
      (Number(value) + Number.EPSILON) * 100
    ) / 100
  );
}

// ==========================================
// DATE-AWARE 12-HOUR CLOSING
// ==========================================

// After 9:30 PM on the original business date,
// closing remains available until the shift closes.
function is12HourClosingAvailable(
  shift,
  now = new Date()
) {
  const businessDate = String(
    shift?.business_date || ""
  ).slice(0, 10);

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(businessDate)
  ) {
    return false;
  }

  const parts = new Intl.DateTimeFormat(
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
  ).formatToParts(now);

  const fields = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      fields[part.type] = part.value;
    }
  }

  const dateTimeKey =
    `${fields.year}-${fields.month}-${fields.day}` +
    `T${fields.hour}:${fields.minute}:${fields.second}`;

  return (
    dateTimeKey >=
    `${businessDate}T21:30:00`
  );
}

// ==========================================
// REPORT DATE HELPERS
// ==========================================

function reportDateValue(value) {
  const dateString = String(
    value || ""
  );

  if (
    /^\d{4}-\d{2}-\d{2}$/.test(dateString)
  ) {
    return new Date(
      `${dateString}T12:00:00+03:00`
    );
  }

  return new Date(value);
}

function formatReportDate(value) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: "Africa/Nairobi",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  ).format(reportDateValue(value));
}

function formatReportDay(value) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: "Africa/Nairobi",
      weekday: "long",
    }
  ).format(reportDateValue(value));
}

function displayTime(value) {
  return String(value || "")
    .split(".")[0]
    .slice(0, 5);
}

// ==========================================
// SHIFT INFORMATION
// ==========================================

function getShiftNumber(current) {
  const match = String(
    current?.shift_name ||
    current?.name ||
    ""
  )
    .toUpperCase()
    .match(/(?:SHIFT\s*)?([12])/);

  return match ? match[1] : "1";
}

function getShiftGreeting(
  date,
  status,
  number
) {
  const state = String(
    status || ""
  ).toUpperCase();

  if (
    state === "CLOSED" ||
    state === "COMPLETED"
  ) {
    return (
      `Good Bye 👋 — Shift ${number} Closed`
    );
  }

  const hour = Number(
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone: "Africa/Nairobi",
        hour: "2-digit",
        hourCycle: "h23",
      }
    ).format(date || new Date())
  );

  if (hour >= 5 && hour < 12) {
    return (
      `Good Morning 🌞 — Welcome to Shift ${number}`
    );
  }

  if (hour >= 12 && hour < 17) {
    return (
      `Good Afternoon ☀️ — Welcome to Shift ${number}`
    );
  }

  return (
    `Good Evening 🌙 — Welcome to Shift ${number}`
  );
}
