"use client";

import {
  jsx as _jsx,
  jsxs as _jsxs,
  Fragment as _Fragment,
} from "react/jsx-runtime";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

const INACTIVITY_MS = 30000;
const PREPARED_TIMEOUT_MS = 30000;
const SECTION_COLLAPSE_MS = 30000;

export default function AccountantDashboard({ user }) {
  const router = useRouter();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const accessToken = user?.access_token || null;
  const accountantName =
    user?.full_name ||
    user?.name ||
    user?.username ||
    "Legend Accounts";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(""), 5000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  const [declinedSendMessage, setDeclinedSendMessage] = useState("");
  const [report, setReport] = useState(null);
  const [reportOpenError, setReportOpenError] = useState("");
  const [shops, setShops] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [expenses, setExpenses] = useState([]);

const [savingsPaymentSnapshot, setSavingsPaymentSnapshot] = useState({
  pending_requests: [],
  recent_requests: [],
});

const [savingsPaymentForms, setSavingsPaymentForms] = useState({});

const [confirmingSavingsPaymentId, setConfirmingSavingsPaymentId] =
  useState(null);

const [rejectingSavingsPaymentId, setRejectingSavingsPaymentId] =
  useState(null);
  // Never assume M-PESA→M-PESA before the Admin route loads.
  const [floatSendMethod, setFloatSendMethod] = useState("");
  const [selectedRecipientId, setSelectedRecipientId] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [preparingSend, setPreparingSend] = useState(false);
  const [preparedSend, setPreparedSend] = useState(null);
  const [sendReceipt, setSendReceipt] = useState("");
  const [completingSend, setCompletingSend] = useState(false);
  const [preparedSecondsLeft, setPreparedSecondsLeft] = useState(30);

  const [expenseDescription, setExpenseDescription] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [savingExpense, setSavingExpense] = useState(false);
  const [confirmingTransactionId, setConfirmingTransactionId] = useState(null);
  const [cancellingTransactionId, setCancellingTransactionId] = useState(null);
  const [closingDay, setClosingDay] = useState(false);
  const [showSavingsPayments, setShowSavingsPayments] = useState(true);
  const [showTransactionHistory, setShowTransactionHistory] = useState(true);
  const [showAllExpenses, setShowAllExpenses] = useState(false);

  const savingsCollapseTimerRef = useRef(null);
  const historyCollapseTimerRef = useRef(null);
  const savingsHasFocusRef = useRef(false);
  const inactivityTimerRef = useRef(null);
  const preparedTimeoutRef = useRef(null);
  const preparedIntervalRef = useRef(null);
  const autoCancelInFlightRef = useRef(false);

  const clearPreparedTimers = useCallback(() => {
    if (preparedTimeoutRef.current) {
      clearTimeout(preparedTimeoutRef.current);
      preparedTimeoutRef.current = null;
    }
    if (preparedIntervalRef.current) {
      clearInterval(preparedIntervalRef.current);
      preparedIntervalRef.current = null;
    }
  }, []);

  const authHeaders = useCallback(
    () => ({
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    }),
    [supabaseAnonKey, accessToken]
  );

  function logout() {
    sessionStorage.removeItem("teamLegendUser");
    router.replace("/");
  }

  const callRpc = useCallback(
    async (functionName, body = {}) => {
      if (!supabaseUrl || !supabaseAnonKey || !accessToken) {
        throw new Error("Account session is incomplete.");
      }
      const response = await fetch(
        `${supabaseUrl}/rest/v1/rpc/${functionName}`,
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify(body),
          cache: "no-store",
        }
      );
      const result = await safeJson(response);
      if (!response.ok) {
        throw new Error(
          result?.message ||
            result?.details ||
            result?.hint ||
            `Unable to run ${functionName}.`
        );
      }
      return result;
    },
    [supabaseUrl, supabaseAnonKey, accessToken, authHeaders]
  );

  const loadFloatSendMethod = useCallback(async () => {
    if (!supabaseUrl || !supabaseAnonKey || !accessToken) return null;
    const response = await fetch(
      `${supabaseUrl}/rest/v1/payment_system_settings` +
        "?id=eq.1&select=float_send_method&limit=1",
      {
        method: "GET",
        headers: authHeaders(),
        cache: "no-store",
      }
    );
    const result = await safeJson(response);
    if (!response.ok) {
      throw new Error(
        result?.message ||
          result?.details ||
          "Unable to load payment route."
      );
    }
    const row = Array.isArray(result) ? result[0] : null;
    const method = normalizeFloatSendMethod(row?.float_send_method);
    if (!method) {
      throw new Error(
        "The active Accountant payment route is unavailable."
      );
    }
    return method;
  }, [supabaseUrl, supabaseAnonKey, accessToken, authHeaders]);

  const loadShops = useCallback(async () => {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/shops` +
        "?is_active=eq.true" +
        "&select=id,shop_name,shop_type,is_active" +
        "&order=shop_name.asc",
      {
        method: "GET",
        headers: authHeaders(),
        cache: "no-store",
      }
    );
    const result = await safeJson(response);
    if (!response.ok) {
      throw new Error(
        result?.message || result?.details || "Unable to load shops."
      );
    }
    return Array.isArray(result) ? result : [];
  }, [supabaseUrl, authHeaders]);

  // Existing Duty Rota / Shop Payment Accounts behavior is unchanged.
  const loadRecipients = useCallback(async () => {
    const result = await callRpc(
      "tl_accountant_shop_payment_recipients",
      {}
    );
    if (!Array.isArray(result)) {
      throw new Error("Unable to load shop payment accounts.");
    }
    return result.map((row) => ({
      ...row,
      id: row.id,
      shop_id: row.shop_id,
      phone_number: String(row.phone_number || ""),
      cashier_name: String(row.cashier_name || "NOT ASSIGNED"),
      duty_ready: row.duty_ready === true,
      allow_mpesa_to_mpesa: row.allow_mpesa_to_mpesa !== false,
      allow_im_to_mpesa: row.allow_im_to_mpesa !== false,
    }));
  }, [callRpc]);

  const loadTransactions = useCallback(async () => {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/accountant_transactions` +
        "?select=*&order=created_at.desc&limit=300",
      {
        method: "GET",
        headers: authHeaders(),
        cache: "no-store",
      }
    );
    const result = await safeJson(response);
    if (!response.ok) {
      throw new Error(
        result?.message ||
          result?.details ||
          "Unable to load Accountant transactions."
      );
    }
    return Array.isArray(result) ? result : [];
  }, [supabaseUrl, authHeaders]);

  // The saved database snapshot is authoritative for each new transfer.
  const loadPreparedTransaction = useCallback(
    async (transactionId) => {
      if (!transactionId) {
        throw new Error("Prepared transaction ID is missing.");
      }

      const response = await fetch(
        `${supabaseUrl}/rest/v1/accountant_transactions` +
          `?id=eq.${encodeURIComponent(transactionId)}` +
          "&select=id,status,flow,amount,estimated_fee,payment_route_snapshot,recipient_phone_snapshot,recipient_name_snapshot,shop_id,created_at&limit=1",
        {
          method: "GET",
          headers: authHeaders(),
          cache: "no-store",
        }
      );

      const result = await safeJson(response);
      if (!response.ok) {
        throw new Error(
          result?.message ||
            result?.details ||
            "Unable to verify the prepared transfer."
        );
      }

      const transaction = Array.isArray(result) ? result[0] : null;
      if (
        !transaction ||
        transaction.flow !== "ACCOUNTANT_TO_CASHIER" ||
        transaction.status !== "PENDING_MANUAL_SEND"
      ) {
        throw new Error(
          "Prepared transfer is no longer pending. Do not send money."
        );
      }

      const route = normalizeFloatSendMethod(
        transaction.payment_route_snapshot
      );
      if (!route) {
        throw new Error(
          "Prepared transfer has no saved payment route. Do not send money."
        );
      }

      if (
        transaction.estimated_fee == null ||
        !Number.isFinite(Number(transaction.estimated_fee)) ||
        Number(transaction.estimated_fee) < 0
      ) {
        throw new Error(
          "Prepared transfer has no valid saved fee. Do not send money."
        );
      }

      return { ...transaction, payment_route_snapshot: route };
    },
    [supabaseUrl, authHeaders]
  );

  const loadExpenses = useCallback(
    async (reportId) => {
      if (!reportId) return [];
      const response = await fetch(
        `${supabaseUrl}/rest/v1/accountant_expenses` +
          `?accountant_report_id=eq.${encodeURIComponent(reportId)}` +
          "&select=*&order=slot_number.asc",
        {
          method: "GET",
          headers: authHeaders(),
          cache: "no-store",
        }
      );
      const result = await safeJson(response);
      if (!response.ok) {
        throw new Error(
          result?.message ||
            result?.details ||
            "Unable to load Accountant expenses."
        );
      }
      return Array.isArray(result) ? result : [];
    },
    [supabaseUrl, authHeaders]
  );

  const loadSavingsPayments = useCallback(async () => {
  const result = await callRpc(
    "tl_accountant_savings_payment_snapshot_private",
    {}
  );

  const pending = result?.pending_requests;
  const recent = result?.recent_requests;

  if (
    !Array.isArray(pending) ||
    !Array.isArray(recent) ||
    [...pending, ...recent].some(
      (r) => String(r?.category || "").toUpperCase() === "BANKING"
    )
  ) {
    throw new Error("Private Savings snapshot is not configured.");
  }

  return {
    pending_requests: pending,
    recent_requests: recent,
  };
}, [callRpc]);

  const openToday = useCallback(
    async () => await callRpc("tl_accountant_open_today", {}),
    [callRpc]
  );

  const refreshData = useCallback(
    async (options = {}) => {
      const silent = options?.silent === true;
      if (!silent) setRefreshing(true);

      try {
        setMessage("");
        const [
          loadedShops,
          loadedRecipients,
          loadedTransactions,
          loadedSavingsPayments,
        ] = await Promise.all([
          loadShops(),
          loadRecipients().catch((error) => {
            console.error("SHOP PAYMENT ROTA ERROR:", error);
            setMessage(
              error?.message || "Shop payment accounts unavailable."
            );
            return [];
          }),
          loadTransactions(),
          loadSavingsPayments().catch((error) => {
            console.error("PRIVATE SAVINGS SNAPSHOT ERROR:", error);
           return {
  pending_requests: [],
  recent_requests: [],
          };
          }),
        ]);

        setShops(loadedShops);
        setRecipients(loadedRecipients);
        setTransactions(loadedTransactions);
        setSavingsPaymentSnapshot(loadedSavingsPayments);

        setSavingsPaymentForms((previous) => {
          const next = { ...previous };
          for (const request of loadedSavingsPayments.pending_requests) {
            if (!next[request.id]) {
              next[request.id] = {
                provider: "",
                reference: "",
                externalId: "",
                fee: "0",
                rejectionReason: "",
              };
            }
          }
          return next;
        });

        try {
          const loadedMethod = await loadFloatSendMethod();
          setFloatSendMethod(loadedMethod);
        } catch (routeError) {
          setFloatSendMethod("");
          console.warn("FLOAT SEND METHOD REFRESH ERROR:", routeError);
        }

        let loadedReport = null;
        let openError = "";
        try {
          loadedReport = await openToday();
        } catch (error) {
          openError =
            error?.message || "Unable to open today's Accountant report.";
        }
        setReportOpenError(openError);
        setReport(loadedReport);
        setExpenses(await loadExpenses(loadedReport?.id));
      } catch (error) {
        console.error("ACCOUNTANT REFRESH ERROR:", error);
        setMessage(
          error?.message || "Unable to load Accountant dashboard."
        );
      } finally {
        if (!silent) setRefreshing(false);
        setLoading(false);
      }
    },
    [
      loadShops,
      loadRecipients,
      loadTransactions,
      loadSavingsPayments,
      loadFloatSendMethod,
      openToday,
      loadExpenses,
    ]
  );

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  useEffect(() => {
    const timer = setInterval(() => refreshData({ silent: true }), 15000);
    return () => clearInterval(timer);
  }, [refreshData]);

  useEffect(() => {
    let disposed = false;

    const clearTimer = () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
    };

    const runInactivityRefresh = async () => {
      if (disposed) return;
      if (!preparedSend && !preparingSend && !completingSend) {
        setSelectedRecipientId("");
        setSendAmount("");
        setSendReceipt("");
        setDeclinedSendMessage("");
        setMessage("");
      }
      await refreshData({ silent: true });
    };

    const armTimer = () => {
      clearTimer();
      inactivityTimerRef.current = setTimeout(async () => {
        await runInactivityRefresh();
        if (!disposed) armTimer();
      }, INACTIVITY_MS);
    };

    const activityHandler = () => armTimer();
    window.addEventListener("pointerdown", activityHandler);
    window.addEventListener("keydown", activityHandler);
    window.addEventListener("touchstart", activityHandler);
    armTimer();

    return () => {
      disposed = true;
      clearTimer();
      window.removeEventListener("pointerdown", activityHandler);
      window.removeEventListener("keydown", activityHandler);
      window.removeEventListener("touchstart", activityHandler);
    };
  }, [refreshData, preparedSend, preparingSend, completingSend]);

  useEffect(() => {
    clearPreparedTimers();
    if (
      !preparedSend?.transaction_id ||
      completingSend ||
      cancellingTransactionId === preparedSend.transaction_id
    ) {
      setPreparedSecondsLeft(30);
      return;
    }

    const transactionId = preparedSend.transaction_id;
    const startedAt = Date.now();
    setPreparedSecondsLeft(30);

    preparedIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      setPreparedSecondsLeft(
        Math.max(
          0,
          Math.ceil((PREPARED_TIMEOUT_MS - elapsed) / 1000)
        )
      );
    }, 1000);

    preparedTimeoutRef.current = setTimeout(async () => {
      if (autoCancelInFlightRef.current) return;
      autoCancelInFlightRef.current = true;
      clearPreparedTimers();

      try {
        await callRpc("tl_accountant_cancel_pending_transaction", {
          p_transaction_id: transactionId,
        });

        setPreparedSend((previous) =>
          String(previous?.transaction_id || "") === String(transactionId)
            ? null
            : previous
        );
        setSelectedRecipientId("");
        setSendAmount("");
        setSendReceipt("");
        setDeclinedSendMessage("");
        setMessage("");
        setSuccessMessage(
          "Unused prepared float transfer cancelled automatically after 30 seconds of inactivity."
        );
        await refreshData({ silent: true });
      } catch (error) {
        console.error("AUTO CANCEL PREPARED FLOAT ERROR:", error);
        const text = String(error?.message || "").trim().toLowerCase();
        const statusChanged = [
          "already changed",
          "no longer",
          "cannot be cancelled",
        ].some((x) => text.includes(x));

        await refreshData({ silent: true });

        if (statusChanged) {
          setPreparedSend(null);
          setSelectedRecipientId("");
          setSendAmount("");
          setSendReceipt("");
        } else {
          setMessage(
            error?.message ||
              "Unable to automatically cancel the unfinished transfer."
          );
        }
      } finally {
        autoCancelInFlightRef.current = false;
        setPreparedSecondsLeft(30);
      }
    }, PREPARED_TIMEOUT_MS);

    return () => clearPreparedTimers();
  }, [
    preparedSend?.transaction_id,
    sendReceipt,
    completingSend,
    cancellingTransactionId,
    callRpc,
    refreshData,
    clearPreparedTimers,
  ]);

  useEffect(
    () => () => {
      clearPreparedTimers();
      if (inactivityTimerRef.current)
        clearTimeout(inactivityTimerRef.current);
    },
    [clearPreparedTimers]
  );

  const clearSavingsCollapseTimer = useCallback(() => {
    if (savingsCollapseTimerRef.current) {
      clearTimeout(savingsCollapseTimerRef.current);
      savingsCollapseTimerRef.current = null;
    }
  }, []);

  const armSavingsCollapseTimer = useCallback(() => {
    clearSavingsCollapseTimer();
    if (
      savingsHasFocusRef.current ||
      confirmingSavingsPaymentId ||
      rejectingSavingsPaymentId
    ) return;
    savingsCollapseTimerRef.current = setTimeout(
      () => setShowSavingsPayments(false),
      SECTION_COLLAPSE_MS
    );
  }, [
    clearSavingsCollapseTimer,
    confirmingSavingsPaymentId,
    rejectingSavingsPaymentId,
  ]);

  const clearHistoryCollapseTimer = useCallback(() => {
    if (historyCollapseTimerRef.current) {
      clearTimeout(historyCollapseTimerRef.current);
      historyCollapseTimerRef.current = null;
    }
  }, []);

  const armHistoryCollapseTimer = useCallback(() => {
    clearHistoryCollapseTimer();
    historyCollapseTimerRef.current = setTimeout(
      () => setShowTransactionHistory(false),
      SECTION_COLLAPSE_MS
    );
  }, [clearHistoryCollapseTimer]);

  useEffect(() => {
    if (showSavingsPayments) armSavingsCollapseTimer();
    else clearSavingsCollapseTimer();
    return clearSavingsCollapseTimer;
  }, [
    showSavingsPayments,
    armSavingsCollapseTimer,
    clearSavingsCollapseTimer,
  ]);

  useEffect(() => {
    if (showTransactionHistory) armHistoryCollapseTimer();
    else clearHistoryCollapseTimer();
    return clearHistoryCollapseTimer;
  }, [
    showTransactionHistory,
    armHistoryCollapseTimer,
    clearHistoryCollapseTimer,
  ]);

  const shopMap = useMemo(() => {
    const map = new Map();
    for (const shop of shops) {
      map.set(shop.id, shop);
    }
    return map;
  }, [shops]);

  const sortedRecipients = useMemo(
    () =>
      [...recipients].sort((a, b) => {
        const nameA = String(
          a.shop_name || shopMap.get(a.shop_id)?.shop_name || ""
        );
        const nameB = String(
          b.shop_name || shopMap.get(b.shop_id)?.shop_name || ""
        );
        return nameA.localeCompare(nameB);
      }),
    [recipients, shopMap]
  );

  const selectedRecipient = useMemo(
    () =>
      recipients.find(
        (item) => String(item.id) === String(selectedRecipientId)
      ) || null,
    [recipients, selectedRecipientId]
  );

  const currentSendRoute = useMemo(
    () => getAccountantSendRoute(null, floatSendMethod),
    [floatSendMethod]
  );

  const preparedSendRoute = useMemo(
    () => getAccountantSendRoute(preparedSend, null),
    [preparedSend]
  );

  const pendingSavingsPayments = useMemo(
    () =>
      Array.isArray(savingsPaymentSnapshot?.pending_requests)
        ? savingsPaymentSnapshot.pending_requests
        : [],
    [savingsPaymentSnapshot]
  );

  const recentSavingsPayments = useMemo(
    () =>
      Array.isArray(savingsPaymentSnapshot?.recent_requests)
        ? savingsPaymentSnapshot.recent_requests
        : [],
    [savingsPaymentSnapshot]
  );

  function updateSavingsPaymentForm(requestId, field, value) {
    setSavingsPaymentForms((previous) => ({
      ...previous,
      [requestId]: {
        provider: previous[requestId]?.provider || "",
        reference: previous[requestId]?.reference || "",
        externalId: previous[requestId]?.externalId || "",
        fee: previous[requestId]?.fee ?? "0",
        rejectionReason: previous[requestId]?.rejectionReason || "",
        [field]: value,
      },
    }));
    setMessage("");
    setSuccessMessage("");
  }

  const pendingReturns = useMemo(
    () =>
      transactions
        .filter(
          (tx) =>
            tx.flow === "CASHIER_TO_ACCOUNTANT" &&
            [
              "CREATED",
              "PENDING_MANUAL_SEND",
              "AWAITING_ACCOUNTANT_CONFIRMATION",
              "PENDING_MPESA",
              "CHECKING",
            ].includes(tx.status)
        )
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
        ),
    [transactions]
  );

  const pendingAccountantSends = useMemo(
    () =>
      transactions
        .filter(
          (tx) =>
            tx.flow === "ACCOUNTANT_TO_CASHIER" &&
            [
              "CREATED",
              "PENDING_MANUAL_SEND",
              "PENDING_MPESA",
              "CHECKING",
            ].includes(tx.status)
        )
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
        ),
    [transactions]
  );

  const todayNairobi = nairobiDateKey(new Date());

  const carriedForwardTransactions = useMemo(() => {
    const unresolvedStatuses = new Set([
      "CREATED",
      "PENDING_MANUAL_SEND",
      "AWAITING_ACCOUNTANT_CONFIRMATION",
      "PENDING_MPESA",
      "CHECKING",
    ]);
    return transactions
      .filter((tx) => {
        const status = String(tx.status || "").trim().toUpperCase();
        if (!unresolvedStatuses.has(status)) return false;
        const transactionDate = nairobiDateKey(tx.created_at);
        return Boolean(
          transactionDate && transactionDate < todayNairobi
        );
      })
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() -
          new Date(b.created_at).getTime()
      );
  }, [transactions, todayNairobi]);

  const hasCarriedForward = carriedForwardTransactions.length > 0;

  const nextExpenseSlot = useMemo(() => {
    const used = new Set(expenses.map((e) => Number(e.slot_number)));
    for (let slot = 1; slot <= 20; slot++) {
      if (!used.has(slot)) return slot;
    }
    return null;
  }, [expenses]);

  const reportClosed =
    String(report?.status || "").trim().toUpperCase() === "CLOSED";
  const newActivityLocked = hasCarriedForward || reportClosed || !report;

  async function prepareFloatSend() {
    if (preparingSend || preparedSend) return;

    if (hasCarriedForward) {
      setMessage(
        "Resolve all carried-forward transactions before sending new float today."
      );
      return;
    }
    if (!report) {
      setMessage("Today's Accountant report is not open yet.");
      return;
    }

    const amount = Number(sendAmount);
    setDeclinedSendMessage("");

    if (!selectedRecipientId || !selectedRecipient) {
      setMessage("Select a registered shop payment account.");
      return;
    }
    if (!selectedRecipient.duty_ready) {
      setMessage("Duty Rota cashier is not verified for this shop.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage("Enter a valid float amount.");
      return;
    }

    let preparedTransactionId = null;

    try {
      setPreparingSend(true);
      setMessage("");
      setSuccessMessage("");
      setDeclinedSendMessage("");

      // Admin mode is rechecked immediately before preparation.
      // Supabase locks it and saves the definitive route.
      const latestMethod = await loadFloatSendMethod();
      setFloatSendMethod(latestMethod);

      if (
        (latestMethod === "IM_TO_MPESA" &&
          !selectedRecipient.allow_im_to_mpesa) ||
        (latestMethod === "MPESA_TO_MPESA" &&
          !selectedRecipient.allow_mpesa_to_mpesa)
      ) {
        throw new Error("This payment route is disabled for the shop.");
      }

      const result = await callRpc(
        "tl_accountant_prepare_manual_send",
        {
          p_recipient_id: selectedRecipientId,
          p_amount: roundMoney(amount),
          p_note: null,
        }
      );

      const returnedSlot = Number(result?.company_float_slot);

      if (
        !result ||
        result?.success === false ||
        !result?.transaction_id ||
        !Number.isInteger(returnedSlot) ||
        returnedSlot < 1 ||
        returnedSlot > 3
      ) {
        throw new Error(
          result?.message ||
            result?.error ||
            "The float transfer was declined."
        );
      }

      preparedTransactionId = result.transaction_id;

      // Verify the saved route, fee, amount and recipient from Supabase.
      const snapshot = await loadPreparedTransaction(
        preparedTransactionId
      );
      const capturedRoute = snapshot.payment_route_snapshot;

      if (
        (capturedRoute === "IM_TO_MPESA" &&
          !selectedRecipient.allow_im_to_mpesa) ||
        (capturedRoute === "MPESA_TO_MPESA" &&
          !selectedRecipient.allow_mpesa_to_mpesa)
      ) {
        throw new Error(
          "The chosen shop does not allow this captured payment route."
        );
      }

      const savedAmount = Number(snapshot.amount);
      const savedFee = Number(snapshot.estimated_fee);

      if (!Number.isFinite(savedAmount) || savedAmount <= 0) {
        throw new Error(
          "Saved transfer amount is invalid. Do not send money."
        );
      }

      const prepared = {
        ...result,
        amount: savedAmount,
        estimated_fee: savedFee,
        total_expected_deduction: roundMoney(
          savedAmount + savedFee
        ),
        payment_route_snapshot: capturedRoute,
        float_send_method: capturedRoute,
        phone_number:
          snapshot.recipient_phone_snapshot || result.phone_number,
        recipient_name:
          snapshot.recipient_name_snapshot ||
          result.recipient_name ||
          selectedRecipient.cashier_name,
        shop_name:
          shopMap.get(
            snapshot.shop_id || selectedRecipient.shop_id
          )?.shop_name ||
          selectedRecipient.shop_name ||
          "Shop",
        created_at:
          snapshot.created_at ||
          result.created_at ||
          new Date().toISOString(),
      };

      setPreparedSend(prepared);
      setSendReceipt("");
      setPreparedSecondsLeft(30);
      setDeclinedSendMessage("");

      setSuccessMessage(
        `Float ${returnedSlot} prepared — ${prepared.shop_name} • ` +
          `${prepared.recipient_name} • ` +
          `${formatPhoneForDisplay(prepared.phone_number)}.`
      );

      await refreshData({ silent: true });
    } catch (error) {
      console.error("PREPARE FLOAT ERROR:", error);
      const errorMessage =
        error?.message || "Unable to prepare float transfer.";

      setPreparedSend(null);
      setSendReceipt("");
      setSuccessMessage("");
      setMessage("");

      let cancellation = "";

      if (preparedTransactionId) {
        try {
          await callRpc("tl_accountant_cancel_pending_transaction", {
            p_transaction_id: preparedTransactionId,
          });
          cancellation = " The unconfirmed preparation was cancelled.";
        } catch (cancelError) {
          console.error(
            "UNVERIFIED PREPARED TRANSFER CANCEL ERROR:",
            cancelError
          );
          cancellation =
            " A pending transfer may remain; check the pending list and do NOT send money.";
        }
      }

      setDeclinedSendMessage(
        `DECLINED — ${errorMessage}${cancellation} Do not send the money.`
      );
      await refreshData({ silent: true });
    } finally {
      setPreparingSend(false);
    }
  }

  async function completeFloatSend() {
    if (!preparedSend?.transaction_id || completingSend) return;

    const receipt = String(sendReceipt || "").trim().toUpperCase();
    const route = getAccountantSendRoute(preparedSend, null);

    if (!route.code) {
      setMessage(
        "Saved payment route is missing. Do not send money."
      );
      return;
    }

    if (!receipt) {
      setMessage(
        route.isIm
          ? "Enter the I&M transaction/reference number."
          : "Enter the M-Pesa receipt number."
      );
      return;
    }

    const receiptLabel = route.isIm
      ? "Transaction reference"
      : "M-Pesa receipt";

    const confirmed = window.confirm(
      `CONFIRM FLOAT SENT\n\n` +
        `Shop: ${preparedSend.shop_name || "Shop"}\n` +
        `Cashier: ${preparedSend.recipient_name || "-"}\n` +
        `M-Pesa: ${formatPhoneForDisplay(preparedSend.phone_number)}\n` +
        `Amount: KES ${money(preparedSend.amount)}\n` +
        `Route: ${route.routeTitle}\n` +
        `${receiptLabel}: ${receipt}`
    );
    if (!confirmed) return;

    clearPreparedTimers();

    try {
      setCompletingSend(true);
      setMessage("");
      setSuccessMessage("");
      setDeclinedSendMessage("");

      const result = await callRpc(
        "tl_accountant_complete_manual_send",
        {
          p_transaction_id: preparedSend.transaction_id,
          p_receipt_no: receipt,
        }
      );

      setPreparedSend(null);
      setSelectedRecipientId("");
      setSendAmount("");
      setSendReceipt("");
      setPreparedSecondsLeft(30);
      setDeclinedSendMessage("");

      setSuccessMessage(
        `Float sent — ${preparedSend.shop_name || "Shop"} • ` +
          `${preparedSend.recipient_name || "Cashier"} • ` +
          `${formatPhoneForDisplay(preparedSend.phone_number)} • ` +
          `KES ${money(result?.cashier_float_received)} • ${receipt}.`
      );
      await refreshData({ silent: true });
    } catch (error) {
      console.error("COMPLETE FLOAT ERROR:", error);
      setMessage(
        error?.message || "Unable to complete float transfer."
      );
    } finally {
      setCompletingSend(false);
    }
  }

  async function cancelPreparedFloatSend() {
    if (!preparedSend?.transaction_id || cancellingTransactionId) return;

    const transactionId = preparedSend.transaction_id;
    const confirmed = window.confirm(
      `Cancel transaction ${preparedSend.transaction_no || ""}?\n\n` +
        `Shop: ${preparedSend.shop_name || "Shop"}\n` +
        `Cashier: ${preparedSend.recipient_name || "-"}\n` +
        `M-Pesa: ${formatPhoneForDisplay(preparedSend.phone_number)}\n` +
        `Amount: KES ${money(preparedSend.amount)}\n\n` +
        "Only cancel if the money was NOT sent."
    );
    if (!confirmed) return;

    clearPreparedTimers();

    try {
      setCancellingTransactionId(transactionId);
      setMessage("");
      setSuccessMessage("");
      setDeclinedSendMessage("");

      const result = await callRpc(
        "tl_accountant_cancel_pending_transaction",
        { p_transaction_id: transactionId }
      );

      setPreparedSend(null);
      setSelectedRecipientId("");
      setSendAmount("");
      setSendReceipt("");
      setPreparedSecondsLeft(30);

      setSuccessMessage(
        `Transaction ${
          result?.transaction_no ||
          preparedSend.transaction_no ||
          ""
        } cancelled. No float was sent.`
      );
      await refreshData({ silent: true });
    } catch (error) {
      console.error("CANCEL PREPARED FLOAT ERROR:", error);
      setMessage(
        error?.message || "Unable to cancel the prepared transfer."
      );
    } finally {
      setCancellingTransactionId(null);
    }
  }

  async function confirmCashierReturn(transaction) {
    if (
      !transaction?.id ||
      confirmingTransactionId ||
      cancellingTransactionId
    ) return;
    if (
      transaction.status !==
      "AWAITING_ACCOUNTANT_CONFIRMATION"
    ) return;

    const confirmed = window.confirm(
      `Confirm that Legend Accounts received KES ${money(
        transaction.amount
      )} from ${transaction.cashier_name || "cashier"}.\n\n` +
        `Receipt: ${transaction.manual_receipt_no || "-"}\n\n` +
        "After confirmation, the cashier expense will be posted automatically."
    );
    if (!confirmed) return;

    try {
      setConfirmingTransactionId(transaction.id);
      setMessage("");
      setSuccessMessage("");

      const result = await callRpc(
        "tl_accountant_confirm_manual_return",
        { p_transaction_id: transaction.id }
      );

      setSuccessMessage(
        `Return confirmed. Accountant received KES ${money(
          result?.amount_received_by_accountant
        )}; cashier expense posted KES ${money(
          result?.cashier_total_expense
        )}.`
      );
      await refreshData();
    } catch (error) {
      console.error("CONFIRM RETURN ERROR:", error);
      setMessage(
        error?.message || "Unable to confirm cashier return."
      );
    } finally {
      setConfirmingTransactionId(null);
    }
  }

  async function cancelPendingTransaction(transaction) {
    if (
      !transaction?.id ||
      cancellingTransactionId ||
      confirmingTransactionId
    ) return;

    const cashier =
      transaction.recipient_name_snapshot ||
      transaction.cashier_name ||
      "-";
    const cancellingReturn =
      transaction.flow === "CASHIER_TO_ACCOUNTANT";

    const confirmed = window.confirm(
      `Cancel transaction ${transaction.transaction_no}?\n\n` +
        `Cashier: ${cashier}\n` +
        `Amount: KES ${money(transaction.amount)}\n\n` +
        (cancellingReturn
          ? "Only cancel if the Accountant did NOT receive this money."
          : "Only cancel if the money was NOT sent.")
    );
    if (!confirmed) return;

    try {
      setCancellingTransactionId(transaction.id);
      setMessage("");
      setSuccessMessage("");

      const result = await callRpc(
        "tl_accountant_cancel_pending_transaction",
        { p_transaction_id: transaction.id }
      );

      setSuccessMessage(
        `Transaction ${
          result?.transaction_no || transaction.transaction_no
        } cancelled successfully.`
      );
      await refreshData({ silent: true });
    } catch (error) {
      console.error("CANCEL TRANSACTION ERROR:", error);
      setMessage(
        error?.message || "Unable to cancel transaction."
      );
    } finally {
      setCancellingTransactionId(null);
    }
  }

  async function confirmSavingsPayment(request) {
    if (
      !request?.id ||
      String(request?.category || "").toUpperCase() === "BANKING" ||
      confirmingSavingsPaymentId ||
      rejectingSavingsPaymentId
    ) return;

    const form = savingsPaymentForms[request.id] || {};
    const provider = String(
      form.provider ||
        (floatSendMethod === "IM_TO_MPESA" ? "I&M" : "M-PESA")
    ).trim().toUpperCase();

    const reference = String(form.reference || "").trim().toUpperCase();
    const externalId = String(form.externalId || "").trim();
    const fee = Number(form.fee || 0);

    if (provider !== "M-PESA" && provider !== "I&M") {
      setMessage("Select M-Pesa or I&M as the payment source.");
      return;
    }
    if (!reference && !externalId) {
      setMessage(
        `Enter the payment reference for ${request.category}.`
      );
      return;
    }
    if (!Number.isFinite(fee) || fee < 0) {
      setMessage(
        "Enter a valid transaction fee. Use 0 if there was no fee."
      );
      return;
    }

    const confirmed = window.confirm(
      `Confirm ${request.category} payment?\n\n` +
        `Shop: ${request.shop_name || "Shop"}\n` +
        `Employee: ${request.employee_name || "Cashier"}\n` +
        `Amount: KES ${money(request.amount)}\n` +
        `Source: ${provider}\n` +
        `Reference: ${reference || externalId}\n\n` +
        "This will deduct the principal from the saved balance. It will NOT create another cashier expense."
    );
    if (!confirmed) return;

    try {
      setConfirmingSavingsPaymentId(request.id);
      setMessage("");
      setSuccessMessage("");

      const result = await callRpc(
        "tl_accountant_confirm_savings_payment",
        {
          p_request_id: request.id,
          p_payment_method:
            provider === "I&M"
              ? "IM_TO_PAYBILL"
              : "MPESA_TO_PAYBILL",
          p_payment_provider: provider,
          p_payment_reference: reference,
          p_external_transaction_id: externalId || null,
          p_transaction_fee: roundMoney(fee),
        }
      );

      setSavingsPaymentForms((previous) => {
        const next = { ...previous };
        delete next[request.id];
        return next;
      });

      setSuccessMessage(
        `${request.category} payment confirmed. KES ${money(
          result?.amount_paid ?? request.amount
        )} deducted from Savings. Remaining balance: KES ${money(
          result?.balance_after
        )}.`
      );
      await refreshData({ silent: true });
    } catch (error) {
      console.error("CONFIRM SAVINGS PAYMENT ERROR:", error);
      setMessage(
        error?.message || "Unable to confirm the Savings payment."
      );
    } finally {
      setConfirmingSavingsPaymentId(null);
    }
  }

  async function rejectSavingsPayment(request) {
    if (
      !request?.id ||
      String(request?.category || "").toUpperCase() === "BANKING" ||
      confirmingSavingsPaymentId ||
      rejectingSavingsPaymentId
    ) return;

    const form = savingsPaymentForms[request.id] || {};
    const reason = String(form.rejectionReason || "").trim();
    if (!reason) {
      setMessage(
        `Enter a reason before rejecting the ${request.category} payment.`
      );
      return;
    }

    const confirmed = window.confirm(
      `Reject ${request.category} payment request?\n\n` +
        `Amount: KES ${money(request.amount)}\n` +
        `Reason: ${reason}\n\n` +
        "No Savings, Expense or Float balance will change."
    );
    if (!confirmed) return;

    try {
      setRejectingSavingsPaymentId(request.id);
      setMessage("");
      setSuccessMessage("");

      await callRpc(
        "tl_accountant_reject_savings_payment",
        {
          p_request_id: request.id,
          p_reason: reason,
        }
      );

      setSavingsPaymentForms((previous) => {
        const next = { ...previous };
        delete next[request.id];
        return next;
      });

      setSuccessMessage(
        `${request.category} payment request rejected. No money was moved.`
      );
      await refreshData({ silent: true });
    } catch (error) {
      console.error("REJECT SAVINGS PAYMENT ERROR:", error);
      setMessage(
        error?.message || "Unable to reject the Savings payment."
      );
    } finally {
      setRejectingSavingsPaymentId(null);
    }
  }

  async function addExpense() {
    if (savingExpense) return;
    if (hasCarriedForward) {
      setMessage(
        "Resolve all carried-forward transactions before entering today's expenses."
      );
      return;
    }

    const description = String(expenseDescription || "").trim();
    const amount = Number(expenseAmount);

    if (!description) {
      setMessage("Enter the expense description.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage("Enter a valid expense amount.");
      return;
    }

    try {
      setSavingExpense(true);
      setMessage("");
      setSuccessMessage("");

      const result = await callRpc(
        "tl_accountant_add_expense",
        {
          p_description: description,
          p_amount: roundMoney(amount),
        }
      );

      setExpenseDescription("");
      setExpenseAmount("");
      setSuccessMessage(
        `Expense ${result?.slot_number || ""} saved and locked.`
      );
      await refreshData();
    } catch (error) {
      console.error("ACCOUNTANT EXPENSE ERROR:", error);
      setMessage(
        error?.message || "Unable to save Accountant expense."
      );
    } finally {
      setSavingExpense(false);
    }
  }

  async function closeAccountantDay() {
    if (closingDay || !report?.report_date) return;
    if (hasCarriedForward) {
      setMessage(
        "Resolve all carried-forward transactions before closing today's Accountant report."
      );
      return;
    }

    const confirmed = window.confirm(
      `Close Accountant report for ${report.report_date}?\n\n` +
        `Closing Balance: KES ${money(report.closing_balance)}\n\n` +
        "After closing, today's Accountant entries will be locked."
    );
    if (!confirmed) return;

    try {
      setClosingDay(true);
      setMessage("");
      setSuccessMessage("");

      const result = await callRpc(
        "tl_accountant_close_day",
        { p_report_date: report.report_date }
      );

      setSuccessMessage(
        `Accountant day closed. Closing Balance: KES ${money(
          result?.closing_balance
        )}.`
      );
      await refreshData();
    } catch (error) {
      console.error("CLOSE ACCOUNTANT DAY ERROR:", error);
      setMessage(
        error?.message || "Unable to close Accountant day."
      );
    } finally {
      setClosingDay(false);
    }
  }
  if (loading)
    return _jsx("div", {
      style: loadingStyle,
      children: "Loading Legend Accounts...",
    });

  return _jsxs("main", {
    style: pageStyle,
    children: [
      _jsxs("header", {
        style: headerStyle,
        children: [
          _jsxs("div", {
            children: [
              _jsx("div", {
                style: brandStyle,
                children: "TEAM LEGEND ACCOUNTS",
              }),
              _jsx("div", {
                style: sloganStyle,
                children: "FLOAT • REFUNDS • EXPENSES • CONTROL",
              }),
            ],
          }),
          _jsxs("div", {
            style: headerRightStyle,
            children: [
              _jsxs("div", {
                style: welcomeStyle,
                children: [
                  _jsx("small", { children: "SIGNED IN" }),
                  _jsx("strong", { children: accountantName }),
                ],
              }),
              _jsx("button", {
                type: "button",
                onClick: () => refreshData(),
                disabled: refreshing,
                style: refreshButtonStyle,
                children: refreshing ? "Refreshing..." : "Refresh",
              }),
              _jsx("button", {
                type: "button",
                onClick: logout,
                style: logoutButtonStyle,
                children: "Logout",
              }),
            ],
          }),
        ],
      }),

      _jsxs("div", {
        style: contentStyle,
        children: [
          message &&
            _jsx("div", {
              style: errorStyle,
              children: message,
            }),

          successMessage &&
            _jsx("div", {
              style: successStyle,
              children: successMessage,
            }),

          reportOpenError &&
            _jsxs("div", {
              style: warningStyle,
              children: [
                _jsx("strong", {
                  children:
                    "Today's Accountant report could not be opened.",
                }),
                _jsx("div", {
                  style: warningTextStyle,
                  children: reportOpenError,
                }),
              ],
            }),

          // CARRIED FORWARD
          hasCarriedForward &&
            _jsxs("section", {
              style: carriedForwardPanelStyle,
              children: [
                _jsxs("div", {
                  style: carriedForwardHeaderStyle,
                  children: [
                    _jsxs("div", {
                      children: [
                        _jsx("div", {
                          style: carriedForwardTitleStyle,
                          children:
                            "⚠ CARRIED FORWARD — ACTION REQUIRED",
                        }),
                        _jsxs("div", {
                          style: carriedForwardSubtitleStyle,
                          children: [
                            carriedForwardTransactions.length,
                            " unresolved transaction",
                            carriedForwardTransactions.length === 1
                              ? ""
                              : "s",
                            " from a previous day.",
                          ],
                        }),
                      ],
                    }),
                    _jsx("div", {
                      style: carriedForwardBadgeStyle,
                      children: "RESOLVE FIRST",
                    }),
                  ],
                }),

                _jsx("div", {
                  style: carriedForwardNoticeStyle,
                  children:
                    "Resolve previous transactions before sending new float, entering new expenses, or closing today.",
                }),

                _jsx("div", {
                  style: tableWrapStyle,
                  children: _jsxs("table", {
                    style: tableStyle,
                    children: [
                      _jsx("thead", {
                        children: _jsxs("tr", {
                          children: [
                            _jsx(TableHead, {
                              children: "Original Date",
                            }),
                            _jsx(TableHead, {
                              children: "Transaction",
                            }),
                            _jsx(TableHead, { children: "Type" }),
                            _jsx(TableHead, { children: "Shop" }),
                            _jsx(TableHead, { children: "Cashier" }),
                            _jsx(TableHead, {
                              right: true,
                              children: "Amount",
                            }),
                            _jsx(TableHead, {
                              right: true,
                              children: "Fee",
                            }),
                            _jsx(TableHead, { children: "Receipt" }),
                            _jsx(TableHead, { children: "Status" }),
                            _jsx(TableHead, { children: "Action" }),
                          ],
                        }),
                      }),
                      _jsx("tbody", {
                        children: carriedForwardTransactions.map(
                          (transaction) =>
                            _jsxs(
                              "tr",
                              {
                                children: [
                                  _jsx(TableCell, {
                                    children: formatDateTime(
                                      transaction.created_at
                                    ),
                                  }),
                                  _jsx(TableCell, {
                                    children: transaction.transaction_no,
                                  }),
                                  _jsx(TableCell, {
                                    children:
                                      transaction.flow ===
                                      "ACCOUNTANT_TO_CASHIER"
                                        ? "TO CASHIER"
                                        : "FROM CASHIER",
                                  }),
                                  _jsx(TableCell, {
                                    children:
                                      shopMap.get(transaction.shop_id)
                                        ?.shop_name || "Shop",
                                  }),
                                  _jsx(TableCell, {
                                    children:
                                      transaction.recipient_name_snapshot ||
                                      transaction.cashier_name ||
                                      "-",
                                  }),
                                  _jsx(TableCell, {
                                    right: true,
                                    children: `KES ${money(
                                      transaction.amount
                                    )}`,
                                  }),
                                  _jsx(TableCell, {
                                    right: true,
                                    children: `KES ${money(
                                      transaction.actual_fee ??
                                        transaction.estimated_fee
                                    )}`,
                                  }),
                                  _jsx(TableCell, {
                                    children:
                                      transaction.mpesa_receipt_number ||
                                      transaction.manual_receipt_no ||
                                      "-",
                                  }),
                                  _jsx(TableCell, {
                                    children: _jsx(StatusText, {
                                      status: transaction.status,
                                    }),
                                  }),
                                  _jsx(TableCell, {
                                    children:
                                      transaction.status ===
                                      "AWAITING_ACCOUNTANT_CONFIRMATION"
                                        ? _jsxs("div", {
                                            style: {
                                              display: "flex",
                                              gap: 6,
                                              flexWrap: "wrap",
                                            },
                                            children: [
                                              _jsx("button", {
                                                type: "button",
                                                onClick: () =>
                                                  confirmCashierReturn(
                                                    transaction
                                                  ),
                                                disabled: Boolean(
                                                  confirmingTransactionId ||
                                                    cancellingTransactionId
                                                ),
                                                style:
                                                  smallConfirmButtonStyle,
                                                children:
                                                  confirmingTransactionId ===
                                                  transaction.id
                                                    ? "Confirming..."
                                                    : "Confirm Received",
                                              }),
                                              _jsx("button", {
                                                type: "button",
                                                onClick: () =>
                                                  cancelPendingTransaction(
                                                    transaction
                                                  ),
                                                disabled: Boolean(
                                                  confirmingTransactionId ||
                                                    cancellingTransactionId
                                                ),
                                                style:
                                                  cancelTransactionButtonStyle,
                                                children:
                                                  cancellingTransactionId ===
                                                  transaction.id
                                                    ? "Cancelling..."
                                                    : "Cancel",
                                              }),
                                            ],
                                          })
                                        : _jsx("button", {
                                            type: "button",
                                            onClick: () =>
                                              cancelPendingTransaction(
                                                transaction
                                              ),
                                            disabled: Boolean(
                                              confirmingTransactionId ||
                                                cancellingTransactionId
                                            ),
                                            style:
                                              cancelTransactionButtonStyle,
                                            children:
                                              cancellingTransactionId ===
                                              transaction.id
                                                ? "Cancelling..."
                                                : "Cancel Transaction",
                                          }),
                                  }),
                                ],
                              },
                              transaction.id
                            )
                        ),
                      }),
                    ],
                  }),
                }),
              ],
            }),

          // DAILY ACCOUNTANT REPORT
          _jsxs("section", {
            style: panelStyle,
            children: [
              _jsxs("div", {
                style: panelHeaderStyle,
                children: [
                  _jsx("div", {
                    style: panelTitleStyle,
                    children: "DAILY ACCOUNTANT REPORT",
                  }),
                  _jsx("div", {
                    style: {
                      ...statusBadgeStyle,
                      backgroundColor: reportClosed
                        ? "#475569"
                        : report
                        ? "#15803d"
                        : "#d97706",
                    },
                    children:
                      report?.status ||
                      (reportOpenError ? "WAITING" : "OPEN"),
                  }),
                ],
              }),
              _jsxs("div", {
                style: summaryGridStyle,
                children: [
                  _jsx(SummaryCard, {
                    label: "REPORT DATE",
                    value: report?.report_date || "-",
                  }),
                  _jsx(SummaryCard, {
                    label: "BALANCE B/F",
                    value: `KES ${money(report?.opening_balance)}`,
                  }),
                  _jsx(SummaryCard, {
                    label: "FLOAT SENT",
                    value: `KES ${money(report?.total_float_sent)}`,
                  }),
                  _jsx(SummaryCard, {
                    label: "FLOAT RECEIVED",
                    value: `KES ${money(report?.total_float_received)}`,
                  }),
                  _jsx(SummaryCard, {
                    label: "TRANSACTION FEES",
                    value: `KES ${money(
                      report?.total_transaction_fees
                    )}`,
                  }),
                  _jsx(SummaryCard, {
                    label: "ACCOUNTANT EXPENSES",
                    value: `KES ${money(report?.total_expenses)}`,
                  }),
                  _jsx(SummaryCard, {
                    label: "CLOSING BALANCE",
                    value: `KES ${money(report?.closing_balance)}`,
                    strong: true,
                  }),
                ],
              }),
            ],
          }),

          // SEND FLOAT TO CASHIER — USES DUTY ROTA
          _jsxs("section", {
            style: panelStyle,
            children: [
              _jsxs("div", {
                style: panelHeaderStyle,
                children: [
                  _jsx("div", {
                    style: panelTitleStyle,
                    children: "SEND FLOAT TO CASHIER",
                  }),
                  _jsx("div", {
                    style: routeBadgeStyle,
                    children: currentSendRoute.routeTitle,
                  }),
                ],
              }),

              hasCarriedForward &&
                _jsx("div", {
                  style: activityLockedStyle,
                  children:
                    "🔒 New float transfers are temporarily locked. Resolve the carried-forward transaction(s) first.",
                }),

              !floatSendMethod &&
                _jsx("div", {
                  style: activityLockedStyle,
                  children:
                    "Payment route unavailable. Refresh and do not send float until the active Admin route loads.",
                }),

              _jsxs("div", {
                style: formGridStyle,
                children: [
                  _jsxs("div", {
                    children: [
                      _jsx("label", {
                        style: labelStyle,
                        children: "Shop / Duty Rota",
                      }),
                      _jsxs("select", {
                        value: selectedRecipientId,
                        disabled:
                          newActivityLocked ||
                          Boolean(preparedSend) ||
                          !floatSendMethod,
                        onChange: (event) => {
                          setSelectedRecipientId(event.target.value);
                          setDeclinedSendMessage("");
                          setMessage("");
                        },
                        style: inputStyle,
                        children: [
                          _jsx("option", {
                            value: "",
                            children: "Select shop",
                          }),
                          sortedRecipients.map((recipient) => {
                            const methodEnabled =
                              floatSendMethod === "IM_TO_MPESA"
                                ? recipient.allow_im_to_mpesa
                                : floatSendMethod === "MPESA_TO_MPESA"
                                ? recipient.allow_mpesa_to_mpesa
                                : false;
                            return _jsx(
                              "option",
                              {
                                value: recipient.id,
                                disabled:
                                  !recipient.duty_ready || !methodEnabled,
                                children: `${
                                  recipient.shop_name || "Shop"
                                } — ${recipient.cashier_name} — ${maskPhone(
                                  recipient.phone_number
                                )}`,
                              },
                              recipient.id
                            );
                          }),
                        ],
                      }),
                    ],
                  }),
                  _jsxs("div", {
                    children: [
                      _jsx("label", {
                        style: labelStyle,
                        children: "Float Amount",
                      }),
                      _jsx("input", {
                        type: "number",
                        min: "1",
                        step: "0.01",
                        value: sendAmount,
                        disabled:
                          newActivityLocked ||
                          Boolean(preparedSend) ||
                          !floatSendMethod,
                        onChange: (event) => {
                          setSendAmount(event.target.value);
                          setDeclinedSendMessage("");
                          setMessage("");
                        },
                        placeholder: "e.g. 3000",
                        style: inputStyle,
                      }),
                    ],
                  }),
                ],
              }),

              selectedRecipient &&
                _jsxs("div", {
                  style: recipientPreviewStyle,
                  children: [
                    _jsx("strong", {
                      children: selectedRecipient.shop_name || "Shop",
                    }),
                    " • ",
                    selectedRecipient.cashier_name,
                    " • ",
                    formatPhoneForDisplay(
                      selectedRecipient.phone_number
                    ),
                  ],
                }),

              declinedSendMessage &&
                _jsxs("div", {
                  style: declinedTransferStyle,
                  children: [
                    _jsx("div", {
                      style: declinedTransferTitleStyle,
                      children: "TRANSFER DECLINED",
                    }),
                    _jsx("div", {
                      children: declinedSendMessage,
                    }),
                  ],
                }),

              !preparedSend &&
                _jsx("button", {
                  type: "button",
                  onClick: prepareFloatSend,
                  disabled:
                    preparingSend ||
                    newActivityLocked ||
                    !floatSendMethod,
                  style: {
                    ...primaryButtonStyle,
                    opacity:
                      preparingSend ||
                      newActivityLocked ||
                      !floatSendMethod
                        ? 0.6
                        : 1,
                  },
                  children: preparingSend
                    ? "Preparing..."
                    : `Prepare ${currentSendRoute.routeTitle} Transfer`,
                }),

              // SAVED ROUTE AND SAVED FEE ARE ALWAYS DISPLAYED
              preparedSend &&
                _jsxs("div", {
                  style: preparedTransferStyle,
                  children: [
                    _jsxs("div", {
                      style: preparedTopStyle,
                      children: [
                        _jsx("div", {
                          style: preparedTitleStyle,
                          children: `MANUAL ${preparedSendRoute.routeTitle} SEND`,
                        }),
                        _jsx("div", {
                          style: preparedCountdownStyle,
                          children: `AUTO-CANCEL: ${preparedSecondsLeft}s`,
                        }),
                      ],
                    }),
                    _jsx(TransactionDetail, {
                      label: "Transaction",
                      value: preparedSend.transaction_no || "-",
                    }),
                    _jsx(TransactionDetail, {
                      label: "Shop",
                      value: preparedSend.shop_name || "Shop",
                    }),
                    _jsx(TransactionDetail, {
                      label: "Cashier — Duty Rota",
                      value: preparedSend.recipient_name || "-",
                    }),
                    _jsx(TransactionDetail, {
                      label: "M-Pesa Number",
                      value: formatPhoneForDisplay(
                        preparedSend.phone_number
                      ),
                    }),
                    _jsx(TransactionDetail, {
                      label: "Company Float Slot",
                      value: `Float ${
                        preparedSend.company_float_slot || "-"
                      }`,
                    }),
                    _jsx(TransactionDetail, {
                      label: "Amount To Send",
                      value: `KES ${money(preparedSend.amount)}`,
                    }),
                    _jsx(TransactionDetail, {
                      label: preparedSendRoute.feeTitle,
                      value: `KES ${money(preparedSend.estimated_fee)}`,
                    }),
                    _jsx(TransactionDetail, {
                      label: "Total Company Deduction",
                      value: `KES ${money(
                        preparedSend.total_expected_deduction
                      )}`,
                      strong: true,
                    }),
                    _jsx("div", {
                      style: sendInstructionStyle,
                      children: preparedSendRoute.isIm
                        ? `Send exactly KES ${money(
                            preparedSend.amount
                          )} from I&M to shop M-Pesa ${formatPhoneForDisplay(
                            preparedSend.phone_number
                          )}. Enter the I&M transaction/reference below.`
                        : `Send exactly KES ${money(
                            preparedSend.amount
                          )} to M-Pesa ${formatPhoneForDisplay(
                            preparedSend.phone_number
                          )}. Enter the successful M-Pesa receipt below.`,
                    }),
                    _jsx("label", {
                      style: labelStyle,
                      children: preparedSendRoute.receiptLabel,
                    }),
                    _jsx("input", {
                      type: "text",
                      value: sendReceipt,
                      disabled: completingSend,
                      onChange: (event) =>
                        setSendReceipt(
                          event.target.value.toUpperCase()
                        ),
                      placeholder: preparedSendRoute.isIm
                        ? "Enter I&M transaction/reference"
                        : "e.g. TABC123XYZ",
                      style: inputStyle,
                    }),
                    _jsx("button", {
                      type: "button",
                      onClick: completeFloatSend,
                      disabled:
                        completingSend || !preparedSendRoute.code,
                      style: {
                        ...completeButtonStyle,
                        opacity:
                          completingSend || !preparedSendRoute.code
                            ? 0.6
                            : 1,
                      },
                      children: completingSend
                        ? "Completing..."
                        : preparedSendRoute.confirmButton,
                    }),
                    _jsx("button", {
                      type: "button",
                      onClick: cancelPreparedFloatSend,
                      disabled:
                        completingSend ||
                        cancellingTransactionId ===
                          preparedSend.transaction_id,
                      style: cancelPreparedButtonStyle,
                      children:
                        cancellingTransactionId ===
                        preparedSend.transaction_id
                          ? "Cancelling..."
                          : "Cancel Prepared Transfer",
                    }),
                    _jsx("div", {
                      style: preparedSafetyNoteStyle,
                      children:
                        "If no receipt/reference is entered for 30 seconds, this unfinished prepared transfer is automatically cancelled.",
                    }),
                  ],
                }),

              pendingAccountantSends.length > 0 &&
                !preparedSend &&
                _jsxs("div", {
                  style: pendingNoticeStyle,
                  children: [
                    _jsx("strong", {
                      children: `${pendingAccountantSends.length} unfinished Accountant float transfer(s)`,
                    }),
                    _jsx("div", {
                      style: pendingNoticeTextStyle,
                      children:
                        "If no money was sent, cancel the transaction below.",
                    }),
                    _jsx("div", {
                      style: pendingSendListStyle,
                      children: pendingAccountantSends.map(
                        (transaction) =>
                          _jsxs(
                            "div",
                            {
                              style: pendingSendRowStyle,
                              children: [
                                _jsxs("div", {
                                  children: [
                                    _jsx("strong", {
                                      children:
                                        transaction.transaction_no ||
                                        "Transaction",
                                    }),
                                    _jsx("div", {
                                      style: pendingSendMetaStyle,
                                      children: `${
                                        transaction.recipient_name_snapshot ||
                                        transaction.cashier_name ||
                                        "Cashier"
                                      } • KES ${money(
                                        transaction.amount
                                      )}`,
                                    }),
                                  ],
                                }),
                                _jsx("button", {
                                  type: "button",
                                  onClick: () =>
                                    cancelPendingTransaction(
                                      transaction
                                    ),
                                  disabled:
                                    cancellingTransactionId ===
                                    transaction.id,
                                  style: cancelSmallButtonStyle,
                                  children:
                                    cancellingTransactionId ===
                                    transaction.id
                                      ? "Cancelling..."
                                      : "Cancel",
                                }),
                              ],
                            },
                            transaction.id
                          )
                      ),
                    }),
                  ],
                }),
            ],
          }),

          // FLOAT RECEIVED FROM CASHIERS
          _jsxs("section", {
            style: panelStyle,
            children: [
              _jsxs("div", {
                style: panelHeaderStyle,
                children: [
                  _jsx("div", {
                    style: panelTitleStyle,
                    children: "FLOAT RECEIVED FROM CASHIERS",
                  }),
                  _jsx("div", {
                    style: countBadgeStyle,
                    children: `${pendingReturns.length} PENDING`,
                  }),
                ],
              }),
              pendingReturns.length === 0
                ? _jsx("div", {
                    style: emptyStyle,
                    children: "No pending cashier returns.",
                  })
                : _jsx("div", {
                    style: tableWrapStyle,
                    children: _jsxs("table", {
                      style: tableStyle,
                      children: [
                        _jsx("thead", {
                          children: _jsxs("tr", {
                            children: [
                              _jsx(TableHead, { children: "Time" }),
                              _jsx(TableHead, {
                                children: "Transaction",
                              }),
                              _jsx(TableHead, { children: "Shop" }),
                              _jsx(TableHead, { children: "Cashier" }),
                              _jsx(TableHead, {
                                right: true,
                                children: "Amount",
                              }),
                              _jsx(TableHead, {
                                right: true,
                                children: "Fee",
                              }),
                              _jsx(TableHead, { children: "Receipt" }),
                              _jsx(TableHead, { children: "Status" }),
                              _jsx(TableHead, { children: "Action" }),
                            ],
                          }),
                        }),
                        _jsx("tbody", {
                          children: pendingReturns.map(
                            (transaction) =>
                              _jsxs(
                                "tr",
                                {
                                  children: [
                                    _jsx(TableCell, {
                                      children: formatDateTime(
                                        transaction.created_at
                                      ),
                                    }),
                                    _jsx(TableCell, {
                                      children:
                                        transaction.transaction_no,
                                    }),
                                    _jsx(TableCell, {
                                      children:
                                        shopMap.get(transaction.shop_id)
                                          ?.shop_name || "Shop",
                                    }),
                                    _jsx(TableCell, {
                                      children:
                                        transaction.cashier_name || "-",
                                    }),
                                    _jsx(TableCell, {
                                      right: true,
                                      children: `KES ${money(
                                        transaction.amount
                                      )}`,
                                    }),
                                    _jsx(TableCell, {
                                      right: true,
                                      children: `KES ${money(
                                        transaction.actual_fee ??
                                          transaction.estimated_fee
                                      )}`,
                                    }),
                                    _jsx(TableCell, {
                                      children:
                                        transaction.mpesa_receipt_number ||
                                        transaction.manual_receipt_no ||
                                        "-",
                                    }),
                                    _jsx(TableCell, {
                                      children: _jsx(StatusText, {
                                        status: transaction.status,
                                      }),
                                    }),
                                    _jsx(TableCell, {
                                      children:
                                        transaction.status ===
                                        "AWAITING_ACCOUNTANT_CONFIRMATION"
                                          ? _jsxs("div", {
                                              style: {
                                                display: "flex",
                                                gap: 6,
                                                flexWrap: "wrap",
                                              },
                                              children: [
                                                _jsx("button", {
                                                  type: "button",
                                                  onClick: () =>
                                                    confirmCashierReturn(
                                                      transaction
                                                    ),
                                                  disabled: Boolean(
                                                    confirmingTransactionId ||
                                                      cancellingTransactionId
                                                  ),
                                                  style:
                                                    smallConfirmButtonStyle,
                                                  children:
                                                    confirmingTransactionId ===
                                                    transaction.id
                                                      ? "Confirming..."
                                                      : "Confirm Received",
                                                }),
                                                _jsx("button", {
                                                  type: "button",
                                                  onClick: () =>
                                                    cancelPendingTransaction(
                                                      transaction
                                                    ),
                                                  disabled: Boolean(
                                                    confirmingTransactionId ||
                                                      cancellingTransactionId
                                                  ),
                                                  style:
                                                    cancelTransactionButtonStyle,
                                                  children:
                                                    cancellingTransactionId ===
                                                    transaction.id
                                                      ? "Cancelling..."
                                                      : "Cancel",
                                                }),
                                              ],
                                            })
                                          : _jsx("span", {
                                              style: mutedSmallStyle,
                                              children:
                                                "Waiting for cashier / resolution",
                                            }),
                                    }),
                                  ],
                                },
                                transaction.id
                              )
                          ),
                        }),
                      ],
                    }),
                  }),
            ],
          }),

          // SAVINGS AND BANKING PAYMENTS
          _jsxs("section", {
            style: savingsPaymentPanelStyle,
            onFocusCapture: (event) => {
              const tag = event.target?.tagName;
              if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) {
                savingsHasFocusRef.current = true;
                clearSavingsCollapseTimer();
              }
            },
            onBlurCapture: (event) => {
              const tag = event.target?.tagName;
              if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) {
                const next = event.relatedTarget;
                if (
                  next &&
                  event.currentTarget.contains(next) &&
                  ["INPUT", "TEXTAREA", "SELECT"].includes(
                    next.tagName
                  )
                ) return;
                savingsHasFocusRef.current = false;
                if (showSavingsPayments)
                  armSavingsCollapseTimer();
              }
            },
            onPointerDownCapture: () => {
              if (showSavingsPayments) armSavingsCollapseTimer();
            },
            onScrollCapture: () => {
              if (showSavingsPayments) armSavingsCollapseTimer();
            },
            onWheelCapture: () => {
              if (showSavingsPayments) armSavingsCollapseTimer();
            },
            onTouchMoveCapture: () => {
              if (showSavingsPayments) armSavingsCollapseTimer();
            },
            children: [
              _jsxs("div", {
                style: panelHeaderStyle,
                children: [
                  _jsx("div", {
                    style: panelTitleStyle,
                    children: "SAVINGS / BANKING PAYMENTS",
                  }),
                  _jsxs("div", {
                    style: sectionHeaderActionsStyle,
                    children: [
                     _jsx("div", {
  style: savingsPendingBadgeStyle,
  children: `${pendingSavingsPayments.length} PENDING`,
}),
                      _jsx("button", {
                        type: "button",
                        style: sectionToggleStyle,
                        "aria-expanded": showSavingsPayments,
                        onClick: () =>
                          setShowSavingsPayments((v) => !v),
                        children: showSavingsPayments
                          ? "Hide ▲"
                          : "Show ▼",
                      }),
                    ],
                  }),
                ],
              }),

              showSavingsPayments &&
                _jsxs(_Fragment, {
                  children: [
                   
                    pendingSavingsPayments.length === 0
                      ? _jsx("div", {
                          style: emptyStyle,
                          children:
                            "No other Savings payments pending.",
                        })
                      : _jsx("div", {
                          style: savingsRequestListStyle,
                          children: pendingSavingsPayments.map(
                            (request) => {
                              const form =
                                savingsPaymentForms[request.id] || {};
                              const provider =
                                form.provider ||
                                (floatSendMethod === "IM_TO_MPESA"
                                  ? "I&M"
                                  : "M-PESA");
                              const confirming =
                                confirmingSavingsPaymentId ===
                                request.id;
                              const rejecting =
                                rejectingSavingsPaymentId ===
                                request.id;
                              const busy = confirming || rejecting;

                              return _jsxs(
                                "div",
                                {
                                  style: savingsRequestCardStyle,
                                  children: [
                                    _jsxs("div", {
                                      style:
                                        savingsRequestHeaderStyle,
                                      children: [
                                        _jsxs("div", {
                                          children: [
                                            _jsx("div", {
                                              style:
                                                savingsCategoryStyle,
                                              children:
                                                request.category,
                                            }),
                                            _jsx("div", {
                                              style: savingsMetaStyle,
                                              children: `${
                                                request.shop_name ||
                                                "Shop"
                                              } • ${
                                                request.employee_name ||
                                                "Cashier"
                                              } • ${formatDateTime(
                                                request.requested_at
                                              )}`,
                                            }),
                                          ],
                                        }),
                                        _jsx("div", {
                                          style: savingsAmountStyle,
                                          children: `KES ${money(
                                            request.amount
                                          )}`,
                                        }),
                                      ],
                                    }),

                                    _jsxs("div", {
                                      style:
                                        savingsBalanceGridStyle,
                                      children: [
                                        _jsxs("div", {
                                          style:
                                            savingsMiniCardStyle,
                                          children: [
                                            _jsx("span", {
                                              children:
                                                "Saved Balance",
                                            }),
                                            _jsx("strong", {
                                              children: `KES ${money(
                                                request.saved_balance
                                              )}`,
                                            }),
                                          ],
                                        }),
                                        _jsxs("div", {
                                          style:
                                            savingsMiniCardStyle,
                                          children: [
                                            _jsx("span", {
                                              children:
                                                "Total Reserved",
                                            }),
                                            _jsx("strong", {
                                              children: `KES ${money(
                                                request.total_reserved
                                              )}`,
                                            }),
                                          ],
                                        }),
                                        _jsxs("div", {
                                          style:
                                            savingsMiniCardStyle,
                                          children: [
                                            _jsx("span", {
                                              children: "Status",
                                            }),
                                            _jsx(
                                              SavingsStatusText,
                                              {
                                                status:
                                                  request.status,
                                              }
                                            ),
                                          ],
                                        }),
                                      ],
                                    }),

                                    _jsxs("div", {
                                      style:
                                        savingsDestinationStyle,
                                      children: [
                                        _jsx("div", {
                                          style:
                                            savingsDestinationTitleStyle,
                                          children:
                                            "PAYMENT DESTINATION",
                                        }),
                                        _jsxs("div", {
                                          style:
                                            savingsDestinationGridStyle,
                                          children: [
                                            _jsx(TransactionDetail, {
                                              label: "Name",
                                              value:
                                                request.destination_name ||
                                                "-",
                                            }),
                                            _jsx(TransactionDetail, {
                                              label: "Account",
                                              value:
                                                request.destination_account ||
                                                "-",
                                            }),
                                            _jsx(TransactionDetail, {
                                              label:
                                                "PayBill / Till",
                                              value:
                                                request.destination_paybill_till ||
                                                "-",
                                            }),
                                            _jsx(TransactionDetail, {
                                              label:
                                                "Bank / Provider",
                                              value:
                                                request.destination_bank ||
                                                "-",
                                            }),
                                          ],
                                        }),
                                      ],
                                    }),

                                    _jsxs("div", {
                                      style:
                                        savingsPaymentFormStyle,
                                      children: [
                                        _jsxs("div", {
                                          children: [
                                            _jsx("label", {
                                              style: labelStyle,
                                              children:
                                                "Payment Source",
                                            }),
                                            _jsxs("select", {
                                              value: provider,
                                              disabled: busy,
                                              onChange: (event) =>
                                                updateSavingsPaymentForm(
                                                  request.id,
                                                  "provider",
                                                  event.target.value
                                                ),
                                              style: inputStyle,
                                              children: [
                                                _jsx("option", {
                                                  value: "M-PESA",
                                                  children:
                                                    "M-PESA",
                                                }),
                                                _jsx("option", {
                                                  value: "I&M",
                                                  children: "I&M",
                                                }),
                                              ],
                                            }),
                                          ],
                                        }),
                                        _jsxs("div", {
                                          children: [
                                            _jsx("label", {
                                              style: labelStyle,
                                              children:
                                                "Payment Reference *",
                                            }),
                                            _jsx("input", {
                                              type: "text",
                                              value:
                                                form.reference ||
                                                "",
                                              disabled: busy,
                                              onChange: (event) =>
                                                updateSavingsPaymentForm(
                                                  request.id,
                                                  "reference",
                                                  event.target.value
                                                ),
                                              placeholder:
                                                provider === "I&M"
                                                  ? "I&M transaction reference"
                                                  : "M-Pesa receipt / reference",
                                              style: inputStyle,
                                            }),
                                          ],
                                        }),
                                        _jsxs("div", {
                                          children: [
                                            _jsx("label", {
                                              style: labelStyle,
                                              children:
                                                "External / API ID",
                                            }),
                                            _jsx("input", {
                                              type: "text",
                                              value:
                                                form.externalId ||
                                                "",
                                              disabled: busy,
                                              onChange: (event) =>
                                                updateSavingsPaymentForm(
                                                  request.id,
                                                  "externalId",
                                                  event.target.value
                                                ),
                                              placeholder:
                                                "Optional now / API later",
                                              style: inputStyle,
                                            }),
                                          ],
                                        }),
                                        _jsxs("div", {
                                          children: [
                                            _jsx("label", {
                                              style: labelStyle,
                                              children: "Fee (KES)",
                                            }),
                                            _jsx("input", {
                                              type: "number",
                                              min: "0",
                                              step: "0.01",
                                              value:
                                                form.fee ?? "0",
                                              disabled: busy,
                                              onChange: (event) =>
                                                updateSavingsPaymentForm(
                                                  request.id,
                                                  "fee",
                                                  event.target.value
                                                ),
                                              style: inputStyle,
                                            }),
                                          ],
                                        }),
                                      ],
                                    }),

                                    _jsxs("div", {
                                      style:
                                        savingsPaymentActionsStyle,
                                      children: [
                                        _jsx("button", {
                                          type: "button",
                                          onClick: () =>
                                            confirmSavingsPayment(
                                              request
                                            ),
                                          disabled: busy,
                                          style:
                                            savingsConfirmButtonStyle,
                                          children: confirming
                                            ? "Confirming..."
                                            : `Confirm ${request.category} Paid`,
                                        }),
                                        _jsx("input", {
                                          type: "text",
                                          value:
                                            form.rejectionReason ||
                                            "",
                                          disabled: busy,
                                          onChange: (event) =>
                                            updateSavingsPaymentForm(
                                              request.id,
                                              "rejectionReason",
                                              event.target.value
                                            ),
                                          placeholder:
                                            "Reason if rejecting",
                                          style:
                                            savingsRejectReasonStyle,
                                        }),
                                        _jsx("button", {
                                          type: "button",
                                          onClick: () =>
                                            rejectSavingsPayment(
                                              request
                                            ),
                                          disabled: busy,
                                          style:
                                            savingsRejectButtonStyle,
                                          children: rejecting
                                            ? "Rejecting..."
                                            : "Reject",
                                        }),
                                      ],
                                    }),
                                  ],
                                },
                                request.id
                              );
                            }
                          ),
                        }),

                    _jsxs("div", {
                      style: savingsRecentWrapStyle,
                      children: [
                        _jsx("div", {
                          style: savingsRecentTitleStyle,
                          children:
                            "RECENT OTHER SAVINGS PAYMENTS",
                        }),
                        recentSavingsPayments.length === 0
                          ? _jsx("div", {
                              style: mutedSmallStyle,
                              children:
                                "No completed or rejected Savings payments yet.",
                            })
                          : _jsx("div", {
                              style: tableWrapStyle,
                              children: _jsxs("table", {
                                style: tableStyle,
                                children: [
                                  _jsx("thead", {
                                    children: _jsxs("tr", {
                                      children: [
                                        _jsx(TableHead, {
                                          children:
                                            "Date / Time",
                                        }),
                                        _jsx(TableHead, {
                                          children: "Category",
                                        }),
                                        _jsx(TableHead, {
                                          children: "Shop",
                                        }),
                                        _jsx(TableHead, {
                                          children: "Employee",
                                        }),
                                        _jsx(TableHead, {
                                          right: true,
                                          children: "Amount",
                                        }),
                                       _jsx(TableHead, {
                                          children: "Route",
                                        }),
                                        _jsx(TableHead, {
                                          children: "Reference",
                                        }),
                                        _jsx(TableHead, {
                                          children: "Status",
                                        }),
                                      ],
                                    }),
                                  }),
                                  _jsx("tbody", {
                                    children: recentSavingsPayments
                                      .slice(0, 20)
                                      .map((request) =>
                                        _jsxs(
                                          "tr",
                                          {
                                            children: [
                                              _jsx(TableCell, {
                                                children:
                                                  formatDateTime(
                                                    request.confirmed_at ||
                                                      request.rejected_at ||
                                                      request.requested_at
                                                  ),
                                              }),
                                              _jsx(TableCell, {
                                                children:
                                                  request.category,
                                              }),
                                              _jsx(TableCell, {
                                                children:
                                                  request.shop_name ||
                                                  "Shop",
                                              }),
                                              _jsx(TableCell, {
                                                children:
                                                  request.employee_name ||
                                                  "-",
                                              }),
                                              _jsx(TableCell, {
                                                right: true,
                                                children: `KES ${money(
                                                  request.amount
                                                )}`,
                                              }),
                                              _jsx(TableCell, {
                                                children:
                                                  request.payment_provider ||
                                                  request.payment_method ||
                                                  "-",
                                              }),
                                              _jsx(TableCell, {
                                                children:
                                                  request.payment_reference ||
                                                  request.external_transaction_id ||
                                                  request.rejection_reason ||
                                                  "-",
                                              }),
                                              _jsx(TableCell, {
                                                children: _jsx(
                                                  SavingsStatusText,
                                                  {
                                                    status:
                                                      request.status,
                                                  }
                                                ),
                                              }),
                                            ],
                                          },
                                          request.id
                                        )
                                      ),
                                  }),
                                ],
                              }),
                            }),
                      ],
                    }),
                  ],
                }),
            ],
          }),

          // ACCOUNTANT EXPENSES
          _jsxs("section", {
            style: panelStyle,
            children: [
              _jsxs("div", {
                style: panelHeaderStyle,
                children: [
                  _jsx("div", {
                    style: panelTitleStyle,
                    children: "ACCOUNTANT EXPENSES",
                  }),
                  _jsxs("div", {
                    style: sectionHeaderActionsStyle,
                    children: [
                      _jsx("div", {
                        style: countBadgeStyle,
                        children: `${expenses.length}/20`,
                      }),
                      _jsx("button", {
                        type: "button",
                        style: sectionToggleStyle,
                        "aria-expanded": showAllExpenses,
                        onClick: () =>
                          setShowAllExpenses((v) => !v),
                        children: showAllExpenses
                          ? "Show Current ▲"
                          : "Show All 20 ▼",
                      }),
                    ],
                  }),
                ],
              }),

              hasCarriedForward &&
                _jsx("div", {
                  style: activityLockedStyle,
                  children:
                    "🔒 Today's new expenses are temporarily locked until all carried-forward transactions are resolved.",
                }),

              _jsx("div", {
                style: expensesGridStyle,
                children: (
                  showAllExpenses
                    ? Array.from(
                        { length: 20 },
                        (_, index) => index + 1
                      )
                    : [
                        nextExpenseSlot ??
                          (expenses.length
                            ? Math.max(
                                ...expenses.map(
                                  (e) =>
                                    Number(e.slot_number) || 1
                                )
                              )
                            : 1),
                      ]
                ).map((slot) => {
                  const saved = expenses.find(
                    (e) => Number(e.slot_number) === slot
                  );
                  const active =
                    !saved &&
                    nextExpenseSlot === slot &&
                    !newActivityLocked;

                  return _jsxs(
                    "div",
                    {
                      style: {
                        ...expenseRowStyle,
                        backgroundColor: saved
                          ? "#f0fdf4"
                          : active
                          ? "#ffffff"
                          : "#f8fafc",
                      },
                      children: [
                        _jsx("div", {
                          style: expenseNumberStyle,
                          children: `Expense ${slot}`,
                        }),
                        saved
                          ? _jsxs(_Fragment, {
                              children: [
                                _jsx("div", {
                                  style:
                                    savedExpenseDescriptionStyle,
                                  children: saved.description,
                                }),
                                _jsx("div", {
                                  style: savedExpenseAmountStyle,
                                  children: `KES ${money(
                                    saved.amount
                                  )} ✓`,
                                }),
                              ],
                            })
                          : active
                          ? _jsxs(_Fragment, {
                              children: [
                                _jsx("input", {
                                  type: "text",
                                  value: expenseDescription,
                                  onChange: (event) =>
                                    setExpenseDescription(
                                      event.target.value
                                    ),
                                  placeholder: "Description",
                                  style: expenseInputStyle,
                                }),
                                _jsx("input", {
                                  type: "number",
                                  min: "1",
                                  step: "0.01",
                                  value: expenseAmount,
                                  onChange: (event) =>
                                    setExpenseAmount(
                                      event.target.value
                                    ),
                                  placeholder: "Amount",
                                  style: expenseAmountInputStyle,
                                }),
                                _jsx("button", {
                                  type: "button",
                                  onClick: addExpense,
                                  disabled: savingExpense,
                                  style: smallSaveButtonStyle,
                                  children: savingExpense
                                    ? "Saving..."
                                    : "Save",
                                }),
                              ],
                            })
                          : _jsx("div", {
                              style: lockedExpenseStyle,
                              children: "LOCKED",
                            }),
                      ],
                    },
                    slot
                  );
                }),
              }),
            ],
          }),

          // TRANSACTION HISTORY
          _jsxs("section", {
            style: panelStyle,
            onScrollCapture: () => {
              if (showTransactionHistory)
                armHistoryCollapseTimer();
            },
            onWheelCapture: () => {
              if (showTransactionHistory)
                armHistoryCollapseTimer();
            },
            onTouchMoveCapture: () => {
              if (showTransactionHistory)
                armHistoryCollapseTimer();
            },
            onPointerDownCapture: () => {
              if (showTransactionHistory)
                armHistoryCollapseTimer();
            },
            children: [
              _jsxs("div", {
                style: panelHeaderStyle,
                children: [
                  _jsx("div", {
                    style: panelTitleStyle,
                    children: "TRANSACTION HISTORY",
                  }),
                  _jsxs("div", {
                    style: sectionHeaderActionsStyle,
                    children: [
                      _jsx("div", {
                        style: countBadgeStyle,
                        children: `${transactions.length} RECORDS`,
                      }),
                      _jsx("button", {
                        type: "button",
                        style: sectionToggleStyle,
                        "aria-expanded": showTransactionHistory,
                        onClick: () =>
                          setShowTransactionHistory((v) => !v),
                        children: showTransactionHistory
                          ? "Hide ▲"
                          : "Show ▼",
                      }),
                    ],
                  }),
                ],
              }),

              showTransactionHistory &&
                (transactions.length === 0
                  ? _jsx("div", {
                      style: emptyStyle,
                      children:
                        "No transactions recorded yet.",
                    })
                  : _jsx("div", {
                      style: tableWrapStyle,
                      children: _jsxs("table", {
                        style: tableStyle,
                        children: [
                          _jsx("thead", {
                            children: _jsxs("tr", {
                              children: [
                                _jsx(TableHead, {
                                  children: "Date / Time",
                                }),
                                _jsx(TableHead, {
                                  children: "Transaction",
                                }),
                                _jsx(TableHead, {
                                  children: "Type",
                                }),
                                _jsx(TableHead, {
                                  children: "Shop",
                                }),
                                _jsx(TableHead, {
                                  children: "Cashier",
                                }),
                                _jsx(TableHead, {
                                  right: true,
                                  children: "Amount",
                                }),
                                _jsx(TableHead, {
                                  right: true,
                                  children: "Fee",
                                }),
                                _jsx(TableHead, {
                                  children: "Receipt",
                                }),
                                _jsx(TableHead, {
                                  children: "Status",
                                }),
                              ],
                            }),
                          }),
                          _jsx("tbody", {
                            children: transactions.map(
                              (transaction) =>
                                _jsxs(
                                  "tr",
                                  {
                                    children: [
                                      _jsx(TableCell, {
                                        children: formatDateTime(
                                          transaction.created_at
                                        ),
                                      }),
                                      _jsx(TableCell, {
                                        children:
                                          transaction.transaction_no,
                                      }),
                                      _jsx(TableCell, {
                                        children:
                                          transaction.flow ===
                                          "ACCOUNTANT_TO_CASHIER"
                                            ? "SENT"
                                            : "RECEIVED",
                                      }),
                                      _jsx(TableCell, {
                                        children:
                                          shopMap.get(
                                            transaction.shop_id
                                          )?.shop_name || "Shop",
                                      }),
                                      _jsx(TableCell, {
                                        children:
                                          transaction.recipient_name_snapshot ||
                                          transaction.cashier_name ||
                                          "-",
                                      }),
                                      _jsx(TableCell, {
                                        right: true,
                                        children: `KES ${money(
                                          transaction.amount
                                        )}`,
                                      }),
                                      _jsx(TableCell, {
                                        right: true,
                                        children: `KES ${money(
                                          transaction.actual_fee ??
                                            transaction.estimated_fee
                                        )}`,
                                      }),
                                      _jsx(TableCell, {
                                        children:
                                          transaction.mpesa_receipt_number ||
                                          transaction.manual_receipt_no ||
                                          "-",
                                      }),
                                      _jsx(TableCell, {
                                        children: _jsx(StatusText, {
                                          status:
                                            transaction.status,
                                        }),
                                      }),
                                    ],
                                  },
                                  transaction.id
                                )
                            ),
                          }),
                        ],
                      }),
                    })),
            ],
          }),

          // ACCOUNTANT DAY CLOSING
          _jsxs("section", {
            style: closingPanelStyle,
            children: [
              _jsxs("div", {
                children: [
                  _jsx("div", {
                    style: closingTitleStyle,
                    children: "ACCOUNTANT DAY CLOSING",
                  }),
                  _jsx("div", {
                    style: closingTextStyle,
                    children:
                      "Carried-forward and today's unresolved float transactions must be completed before the day can close.",
                  }),
                ],
              }),
              _jsxs("div", {
                style: closingRightStyle,
                children: [
                  _jsxs("div", {
                    style: closingBalanceStyle,
                    children: [
                      "Closing Balance",
                      _jsx("strong", {
                        children: `KES ${money(
                          report?.closing_balance
                        )}`,
                      }),
                    ],
                  }),
                  _jsx("button", {
                    type: "button",
                    onClick: closeAccountantDay,
                    disabled:
                      closingDay ||
                      reportClosed ||
                      !report ||
                      hasCarriedForward,
                    style: {
                      ...closeDayButtonStyle,
                      opacity:
                        closingDay ||
                        reportClosed ||
                        !report ||
                        hasCarriedForward
                          ? 0.6
                          : 1,
                    },
                    children: reportClosed
                      ? "DAY CLOSED ✓"
                      : closingDay
                      ? "Closing..."
                      : hasCarriedForward
                      ? "RESOLVE CARRIED FORWARD FIRST"
                      : "Close Accountant Day",
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

// ======================================================
// DISPLAY HELPERS
// ======================================================

function SummaryCard({ label, value, strong = false }) {
  return _jsxs("div", {
    style: {
      ...summaryCardStyle,
      ...(strong ? summaryStrongStyle : {}),
    },
    children: [
      _jsx("div", {
        style: summaryLabelStyle,
        children: label,
      }),
      _jsx("div", {
        style: {
          ...summaryValueStyle,
          ...(strong ? summaryStrongValueStyle : {}),
        },
        children: value,
      }),
    ],
  });
}

function TransactionDetail({ label, value, strong = false }) {
  return _jsxs("div", {
    style: transactionDetailStyle,
    children: [
      _jsx("span", {
        children: label,
      }),
      _jsx("strong", {
        style: strong ? transactionStrongStyle : undefined,
        children: value,
      }),
    ],
  });
}

function TableHead({ children, right = false }) {
  return _jsx("th", {
    style: {
      ...tableHeadStyle,
      textAlign: right ? "right" : "left",
    },
    children,
  });
}

function TableCell({ children, right = false }) {
  return _jsx("td", {
    style: {
      ...tableCellStyle,
      textAlign: right ? "right" : "left",
    },
    children,
  });
}

function StatusText({ status }) {
  const normalized = String(status || "").trim().toUpperCase();
  let backgroundColor = "#e2e8f0";
  let color = "#334155";

  if (normalized === "COMPLETED") {
    backgroundColor = "#dcfce7";
    color = "#166534";
  } else if (
    [
      "CREATED",
      "AWAITING_ACCOUNTANT_CONFIRMATION",
      "PENDING_MANUAL_SEND",
      "PENDING_MPESA",
      "CHECKING",
    ].includes(normalized)
  ) {
    backgroundColor = "#fef3c7";
    color = "#92400e";
  } else if (["FAILED", "CANCELLED"].includes(normalized)) {
    backgroundColor = "#fee2e2";
    color = "#991b1b";
  } else if (normalized === "REVERSED") {
    backgroundColor = "#e0e7ff";
    color = "#3730a3";
  }

  return _jsx("span", {
    style: {
      ...statusTextStyle,
      backgroundColor,
      color,
    },
    children: friendlyStatus(normalized),
  });
}

function SavingsStatusText({ status }) {
  const normalized = String(status || "").trim().toUpperCase();
  let backgroundColor = "#fef3c7";
  let color = "#92400e";

  if (normalized === "CONFIRMED") {
    backgroundColor = "#dcfce7";
    color = "#166534";
  } else if (
    ["REJECTED", "FAILED", "CANCELLED"].includes(normalized)
  ) {
    backgroundColor = "#fee2e2";
    color = "#991b1b";
  } else if (normalized === "PROCESSING") {
    backgroundColor = "#dbeafe";
    color = "#1d4ed8";
  }

  return _jsx("span", {
    style: {
      ...statusTextStyle,
      backgroundColor,
      color,
    },
    children: normalized || "PENDING",
  });
}

function normalizeFloatSendMethod(value) {
  const clean = String(value || "").trim().toUpperCase();
  return clean === "IM_TO_MPESA" || clean === "MPESA_TO_MPESA"
    ? clean
    : "";
}

function getAccountantSendRoute(transaction, fallbackMethod) {
  // A prepared transfer never follows a later Admin mode change.
  const method = transaction
    ? normalizeFloatSendMethod(transaction.payment_route_snapshot)
    : normalizeFloatSendMethod(fallbackMethod);

  if (method === "IM_TO_MPESA") {
    return {
      code: "IM_TO_MPESA",
      isIm: true,
      routeTitle: "I&M → M-PESA",
      feeTitle: "I&M → M-PESA FEE",
      receiptLabel: "I&M Transaction / Reference",
      confirmButton: "Confirm I&M → M-Pesa Sent",
    };
  }

  if (method === "MPESA_TO_MPESA") {
    return {
      code: "MPESA_TO_MPESA",
      isIm: false,
      routeTitle: "M-PESA → M-PESA",
      feeTitle: "M-PESA FEE",
      receiptLabel: "M-Pesa Receipt",
      confirmButton: "Confirm M-Pesa Sent",
    };
  }

  return {
    code: "",
    isIm: false,
    routeTitle: "PAYMENT ROUTE UNAVAILABLE",
    feeTitle: "FEE UNAVAILABLE",
    receiptLabel: "Receipt (disabled)",
    confirmButton: "Route unavailable",
  };
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function money(value) {
  return Number(value || 0).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function roundMoney(value) {
  return Math.round(
    (Number(value) + Number.EPSILON) * 100
  ) / 100;
}

function maskPhone(value) {
  const phone = String(value || "");
  return phone.length < 8
    ? "****"
    : phone.slice(0, 5) + "****" + phone.slice(-3);
}

function formatPhoneForDisplay(value) {
  const phone = String(value || "");
  return phone.startsWith("254") && phone.length === 12
    ? "0" + phone.slice(3)
    : phone || "-";
}

function formatDateTime(value) {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat("en-KE", {
      timeZone: "Africa/Nairobi",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function nairobiDateKey(value) {
  if (!value) return "";
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Africa/Nairobi",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(value));
    const year = parts.find((p) => p.type === "year")?.value;
    const month = parts.find((p) => p.type === "month")?.value;
    const day = parts.find((p) => p.type === "day")?.value;
    return year && month && day
      ? `${year}-${month}-${day}`
      : "";
  } catch {
    return "";
  }
}

function friendlyStatus(value) {
  switch (value) {
    case "CREATED":
      return "CREATED";
    case "PENDING_MANUAL_SEND":
      return "PENDING SEND";
    case "AWAITING_ACCOUNTANT_CONFIRMATION":
      return "AWAITING CONFIRMATION";
    case "PENDING_MPESA":
      return "PENDING M-PESA";
    case "CHECKING":
      return "CHECKING";
    case "COMPLETED":
      return "COMPLETED ✓";
    case "FAILED":
      return "FAILED";
    case "CANCELLED":
      return "CANCELLED";
    case "REVERSED":
      return "REVERSED";
    default:
      return value || "-";
  }
}

// ======================================================
// COMPLETE EXISTING ACCOUNTANT THEME
// ======================================================

const pageStyle = {
  fontSize: "13px",
  minHeight: "100vh",
  backgroundColor: "#eef2f7",
  fontFamily: "Arial, sans-serif",
  color: "#0f172a",
};

const loadingStyle = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "#eef2f7",
  fontFamily: "Arial, sans-serif",
  fontWeight: "bold",
};

const headerStyle = {
  minHeight: "72px",
  background: "linear-gradient(90deg,#064e3b,#0f766e)",
  color: "white",
  padding: "10px 22px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  boxSizing: "border-box",
  gap: "20px",
};

const brandStyle = {
  fontWeight: "900",
  fontSize: "21px",
};

const sloganStyle = {
  marginTop: "4px",
  fontSize: "11px",
  letterSpacing: "2px",
  color: "#ccfbf1",
};

const headerRightStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const welcomeStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const refreshButtonStyle = {
  border: "1px solid rgba(255,255,255,0.45)",
  borderRadius: "5px",
  padding: "8px 12px",
  backgroundColor: "transparent",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
};

const logoutButtonStyle = {
  border: "none",
  borderRadius: "5px",
  padding: "8px 13px",
  backgroundColor: "#e11d48",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
};

const contentStyle = {
  width: "100%",
  maxWidth: "1450px",
  margin: "0 auto",
  padding: "20px",
  boxSizing: "border-box",
};

const panelStyle = {
  backgroundColor: "white",
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  padding: "16px",
  marginBottom: "16px",
  boxShadow: "0 2px 8px rgba(15,23,42,0.05)",
};

const panelHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  marginBottom: "14px",
  flexWrap: "wrap",
};

const panelTitleStyle = {
  fontSize: "15px",
  fontWeight: "900",
  color: "#0f172a",
};

const sectionHeaderActionsStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexWrap: "wrap",
};

const sectionToggleStyle = {
  border: "1px solid #94a3b8",
  backgroundColor: "#f8fafc",
  color: "#0f172a",
  borderRadius: "5px",
  padding: "7px 11px",
  fontSize: "12px",
  fontWeight: "bold",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const routeBadgeStyle = {
  backgroundColor: "#0f766e",
  color: "white",
  padding: "6px 10px",
  borderRadius: "20px",
  fontSize: "11px",
  fontWeight: "900",
  whiteSpace: "nowrap",
};

const statusBadgeStyle = {
  color: "white",
  padding: "6px 10px",
  borderRadius: "20px",
  fontWeight: "bold",
  fontSize: "12px",
};

const countBadgeStyle = {
  backgroundColor: "#0f766e",
  color: "white",
  padding: "6px 10px",
  borderRadius: "20px",
  fontSize: "12px",
  fontWeight: "bold",
};

const summaryGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(165px,1fr))",
  gap: "10px",
};

const summaryCardStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: "6px",
  padding: "12px",
  backgroundColor: "#f8fafc",
};

const summaryStrongStyle = {
  backgroundColor: "#ecfdf5",
  border: "1px solid #86efac",
};

const summaryLabelStyle = {
  color: "#64748b",
  fontSize: "11px",
  fontWeight: "bold",
  marginBottom: "6px",
};

const summaryValueStyle = {
  fontSize: "16px",
  fontWeight: "bold",
  color: "#0f172a",
};

const summaryStrongValueStyle = {
  color: "#166534",
  fontSize: "18px",
};

const formGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
  gap: "12px",
};

const labelStyle = {
  display: "block",
  marginBottom: "5px",
  fontSize: "12px",
  fontWeight: "bold",
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px",
  border: "1px solid #94a3b8",
  borderRadius: "5px",
  backgroundColor: "white",
  fontSize: "14px",
};

const recipientPreviewStyle = {
  marginTop: "10px",
  padding: "9px",
  backgroundColor: "#f0fdfa",
  color: "#115e59",
  border: "1px solid #99f6e4",
  borderRadius: "5px",
  fontSize: "12px",
};

const declinedTransferStyle = {
  marginTop: "12px",
  padding: "12px",
  backgroundColor: "#fef2f2",
  border: "2px solid #dc2626",
  color: "#991b1b",
  borderRadius: "6px",
  fontSize: "12px",
  fontWeight: "bold",
};

const declinedTransferTitleStyle = {
  marginBottom: "6px",
  fontSize: "13px",
  fontWeight: "900",
  color: "#b91c1c",
};

const primaryButtonStyle = {
  marginTop: "12px",
  padding: "10px 16px",
  border: "none",
  borderRadius: "5px",
  backgroundColor: "#0f766e",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
};

const preparedTransferStyle = {
  marginTop: "14px",
  padding: "14px",
  border: "2px solid #0f766e",
  borderRadius: "7px",
  backgroundColor: "#f0fdfa",
};

const preparedTopStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "10px",
  marginBottom: "10px",
  flexWrap: "wrap",
};

const preparedTitleStyle = {
  color: "#115e59",
  fontWeight: "900",
  fontSize: "13px",
};

const preparedCountdownStyle = {
  padding: "5px 8px",
  borderRadius: "12px",
  backgroundColor: "#fef3c7",
  color: "#92400e",
  fontSize: "11px",
  fontWeight: "900",
  whiteSpace: "nowrap",
};

const transactionDetailStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "14px",
  padding: "7px 0",
  borderBottom: "1px solid #ccfbf1",
  fontSize: "12px",
};

const transactionStrongStyle = {
  color: "#166534",
  fontSize: "14px",
};

const sendInstructionStyle = {
  margin: "12px 0",
  padding: "10px",
  backgroundColor: "#fef3c7",
  color: "#92400e",
  borderRadius: "5px",
  lineHeight: "1.5",
  fontSize: "12px",
};

const completeButtonStyle = {
  marginTop: "10px",
  width: "100%",
  padding: "11px",
  border: "none",
  borderRadius: "5px",
  backgroundColor: "#15803d",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
};

const cancelPreparedButtonStyle = {
  marginTop: "8px",
  width: "100%",
  padding: "10px",
  border: "none",
  borderRadius: "5px",
  backgroundColor: "#dc2626",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
};

const preparedSafetyNoteStyle = {
  marginTop: "8px",
  padding: "8px",
  borderRadius: "5px",
  backgroundColor: "#fff7ed",
  color: "#9a3412",
  fontSize: "11px",
  lineHeight: "1.4",
};

const pendingNoticeStyle = {
  marginTop: "12px",
  padding: "10px",
  backgroundColor: "#fff7ed",
  border: "1px solid #fed7aa",
  color: "#9a3412",
  borderRadius: "5px",
  fontSize: "12px",
};

const pendingNoticeTextStyle = {
  marginTop: "4px",
};

const pendingSendListStyle = {
  display: "grid",
  gap: "6px",
  marginTop: "9px",
};

const pendingSendRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "10px",
  padding: "8px",
  backgroundColor: "white",
  border: "1px solid #fed7aa",
  borderRadius: "5px",
};

const pendingSendMetaStyle = {
  marginTop: "3px",
  fontSize: "11px",
  color: "#9a3412",
};

const cancelSmallButtonStyle = {
  border: "none",
  borderRadius: "4px",
  padding: "7px 10px",
  backgroundColor: "#dc2626",
  color: "white",
  fontSize: "11px",
  fontWeight: "bold",
  cursor: "pointer",
};

const tableWrapStyle = {
  overflowX: "auto",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: "850px",
};

const tableHeadStyle = {
  padding: "8px",
  borderBottom: "2px solid #cbd5e1",
  backgroundColor: "#f8fafc",
  color: "#475569",
  fontSize: "11px",
  whiteSpace: "nowrap",
};

const tableCellStyle = {
  padding: "9px 8px",
  borderBottom: "1px solid #e2e8f0",
  fontSize: "12px",
  whiteSpace: "nowrap",
};

const statusTextStyle = {
  display: "inline-block",
  padding: "4px 7px",
  borderRadius: "12px",
  fontSize: "11px",
  fontWeight: "bold",
  whiteSpace: "nowrap",
};

const smallConfirmButtonStyle = {
  border: "none",
  borderRadius: "4px",
  padding: "7px 9px",
  backgroundColor: "#15803d",
  color: "white",
  fontSize: "11px",
  fontWeight: "bold",
  cursor: "pointer",
};

const mutedSmallStyle = {
  color: "#94a3b8",
  fontSize: "11px",
};

const emptyStyle = {
  padding: "18px",
  textAlign: "center",
  color: "#64748b",
  backgroundColor: "#f8fafc",
  borderRadius: "5px",
  fontSize: "12px",
};

const savingsPaymentPanelStyle = {
  ...panelStyle,
  border: "2px solid #0f766e",
};

const savingsPendingBadgeStyle = {
  backgroundColor: "#b45309",
  color: "white",
  padding: "6px 10px",
  borderRadius: "20px",
  fontSize: "12px",
  fontWeight: "900",
};

const savingsRequestListStyle = {
  display: "grid",
  gap: "12px",
};

const savingsRequestCardStyle = {
  border: "1px solid #99f6e4",
  borderRadius: "7px",
  padding: "12px",
  backgroundColor: "#f0fdfa",
};

const savingsRequestHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "12px",
  flexWrap: "wrap",
  marginBottom: "10px",
};

const savingsCategoryStyle = {
  fontSize: "14px",
  fontWeight: "900",
  color: "#115e59",
};

const savingsMetaStyle = {
  marginTop: "3px",
  color: "#64748b",
  fontSize: "11px",
};

const savingsAmountStyle = {
  padding: "7px 10px",
  borderRadius: "5px",
  backgroundColor: "#0f766e",
  color: "white",
  fontSize: "14px",
  fontWeight: "900",
};

const savingsBalanceGridStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(150px,1fr))",
  gap: "8px",
  marginBottom: "10px",
};

const savingsMiniCardStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "5px",
  padding: "8px",
  border: "1px solid #ccfbf1",
  borderRadius: "5px",
  backgroundColor: "white",
  fontSize: "11px",
  color: "#64748b",
};

const savingsDestinationStyle = {
  padding: "10px",
  marginBottom: "10px",
  borderRadius: "5px",
  backgroundColor: "white",
  border: "1px solid #cbd5e1",
};

const savingsDestinationTitleStyle = {
  marginBottom: "6px",
  color: "#475569",
  fontSize: "11px",
  fontWeight: "900",
};

const savingsDestinationGridStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(190px,1fr))",
  columnGap: "18px",
};

const savingsPaymentFormStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(180px,1fr))",
  gap: "8px",
  marginBottom: "10px",
};

const savingsPaymentActionsStyle = {
  display: "grid",
  gridTemplateColumns:
    "minmax(180px,0.8fr) minmax(220px,1fr) 120px",
  gap: "8px",
  alignItems: "center",
};

const savingsConfirmButtonStyle = {
  border: "none",
  borderRadius: "5px",
  padding: "10px",
  backgroundColor: "#15803d",
  color: "white",
  fontWeight: "900",
  fontSize: "12px",
  cursor: "pointer",
};

const savingsRejectReasonStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "9px",
  border: "1px solid #fca5a5",
  borderRadius: "5px",
  fontSize: "12px",
};

const savingsRejectButtonStyle = {
  border: "none",
  borderRadius: "5px",
  padding: "10px",
  backgroundColor: "#dc2626",
  color: "white",
  fontWeight: "900",
  fontSize: "12px",
  cursor: "pointer",
};

const savingsRecentWrapStyle = {
  marginTop: "16px",
  paddingTop: "12px",
  borderTop: "1px solid #cbd5e1",
};

const savingsRecentTitleStyle = {
  marginBottom: "8px",
  color: "#334155",
  fontSize: "11px",
  fontWeight: "900",
};

const expensesGridStyle = {
  display: "grid",
  gap: "6px",
};

const expenseRowStyle = {
  display: "grid",
  gridTemplateColumns:
    "85px minmax(180px,1fr) 150px 80px",
  gap: "8px",
  alignItems: "center",
  border: "1px solid #e2e8f0",
  borderRadius: "5px",
  padding: "7px",
  minWidth: "620px",
};

const expenseNumberStyle = {
  fontSize: "12px",
  fontWeight: "bold",
  color: "#475569",
};

const expenseInputStyle = {
  padding: "8px",
  border: "1px solid #94a3b8",
  borderRadius: "4px",
  fontSize: "12px",
};

const expenseAmountInputStyle = {
  padding: "8px",
  border: "1px solid #94a3b8",
  borderRadius: "4px",
  fontSize: "12px",
};

const smallSaveButtonStyle = {
  padding: "8px",
  border: "none",
  borderRadius: "4px",
  backgroundColor: "#0f766e",
  color: "white",
  fontSize: "11px",
  fontWeight: "bold",
  cursor: "pointer",
};

const savedExpenseDescriptionStyle = {
  fontSize: "12px",
  color: "#166534",
  fontWeight: "bold",
};

const savedExpenseAmountStyle = {
  fontSize: "12px",
  color: "#166534",
  textAlign: "right",
  fontWeight: "bold",
};

const lockedExpenseStyle = {
  gridColumn: "2 / 5",
  color: "#94a3b8",
  fontSize: "11px",
  fontWeight: "bold",
};

const closingPanelStyle = {
  backgroundColor: "#0f172a",
  color: "white",
  borderRadius: "8px",
  padding: "18px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "20px",
  flexWrap: "wrap",
  marginBottom: "20px",
};

const closingTitleStyle = {
  fontSize: "15px",
  fontWeight: "900",
};

const closingTextStyle = {
  marginTop: "5px",
  color: "#cbd5e1",
  fontSize: "12px",
};

const closingRightStyle = {
  display: "flex",
  alignItems: "center",
  gap: "14px",
  flexWrap: "wrap",
};

const closingBalanceStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "3px",
  fontSize: "11px",
  color: "#cbd5e1",
};

const closeDayButtonStyle = {
  padding: "10px 15px",
  border: "none",
  borderRadius: "5px",
  backgroundColor: "#dc2626",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
};

const errorStyle = {
  marginBottom: "12px",
  padding: "10px",
  borderRadius: "5px",
  backgroundColor: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#991b1b",
  fontSize: "12px",
};

const successStyle = {
  marginBottom: "12px",
  padding: "10px",
  borderRadius: "5px",
  backgroundColor: "#f0fdf4",
  border: "1px solid #86efac",
  color: "#166534",
  fontSize: "12px",
};

const warningStyle = {
  marginBottom: "12px",
  padding: "12px",
  borderRadius: "5px",
  backgroundColor: "#fffbeb",
  border: "1px solid #fde68a",
  color: "#92400e",
  fontSize: "12px",
};

const warningTextStyle = {
  marginTop: "5px",
};

const carriedForwardPanelStyle = {
  backgroundColor: "#fff7ed",
  border: "2px solid #f97316",
  borderRadius: "8px",
  padding: "16px",
  marginBottom: "16px",
  boxShadow: "0 2px 8px rgba(154,52,18,0.08)",
};

const carriedForwardHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  marginBottom: "10px",
  flexWrap: "wrap",
};

const carriedForwardTitleStyle = {
  color: "#9a3412",
  fontSize: "15px",
  fontWeight: "900",
};

const carriedForwardSubtitleStyle = {
  marginTop: "4px",
  color: "#c2410c",
  fontSize: "12px",
};

const carriedForwardBadgeStyle = {
  backgroundColor: "#ea580c",
  color: "white",
  borderRadius: "20px",
  padding: "6px 10px",
  fontSize: "11px",
  fontWeight: "900",
};

const carriedForwardNoticeStyle = {
  padding: "9px",
  marginBottom: "12px",
  backgroundColor: "#ffedd5",
  color: "#9a3412",
  borderRadius: "5px",
  fontSize: "12px",
  fontWeight: "bold",
};

const activityLockedStyle = {
  marginBottom: "12px",
  padding: "10px",
  backgroundColor: "#fff7ed",
  border: "1px solid #fdba74",
  borderRadius: "5px",
  color: "#9a3412",
  fontSize: "12px",
  fontWeight: "bold",
};

const cancelTransactionButtonStyle = {
  border: "none",
  borderRadius: "4px",
  padding: "7px 9px",
  backgroundColor: "#dc2626",
  color: "white",
  fontSize: "11px",
  fontWeight: "bold",
  cursor: "pointer",
};
