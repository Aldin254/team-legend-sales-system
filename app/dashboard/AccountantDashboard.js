"use client";

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

export default function AccountantDashboard({
  user,
}) {
  const router = useRouter();

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const accessToken =
    user?.access_token ||
    null;

  const accountantName =
    user?.full_name ||
    user?.name ||
    user?.username ||
    "Legend Accounts";

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  const [
    declinedSendMessage,
    setDeclinedSendMessage,
  ] = useState("");

  const [report, setReport] =
    useState(null);

  const [
    reportOpenError,
    setReportOpenError,
  ] = useState("");

  const [shops, setShops] =
    useState([]);

  const [recipients, setRecipients] =
    useState([]);

  const [
    transactions,
    setTransactions,
  ] = useState([]);

  const [expenses, setExpenses] =
    useState([]);

  // ==================================================
  // PAYMENT ROUTE
  // ==================================================

  const [
    floatSendMethod,
    setFloatSendMethod,
  ] = useState(
    "MPESA_TO_MPESA"
  );

  // ==================================================
  // SEND FLOAT
  // ==================================================

  const [
    selectedRecipientId,
    setSelectedRecipientId,
  ] = useState("");

  const [
    sendAmount,
    setSendAmount,
  ] = useState("");

  const [
    preparingSend,
    setPreparingSend,
  ] = useState(false);

  const [
    preparedSend,
    setPreparedSend,
  ] = useState(null);

  const [
    sendReceipt,
    setSendReceipt,
  ] = useState("");

  const [
    completingSend,
    setCompletingSend,
  ] = useState(false);

  const [
    preparedSecondsLeft,
    setPreparedSecondsLeft,
  ] = useState(30);

  // ==================================================
  // EXPENSES / TRANSACTION ACTIONS
  // ==================================================

  const [
    expenseDescription,
    setExpenseDescription,
  ] = useState("");

  const [
    expenseAmount,
    setExpenseAmount,
  ] = useState("");

  const [
    savingExpense,
    setSavingExpense,
  ] = useState(false);

  const [
    confirmingTransactionId,
    setConfirmingTransactionId,
  ] = useState(null);

  const [
    cancellingTransactionId,
    setCancellingTransactionId,
  ] = useState(null);

  const [
    closingDay,
    setClosingDay,
  ] = useState(false);

  // ==================================================
  // TIMER REFS
  // ==================================================

  const inactivityTimerRef =
    useRef(null);

  const preparedTimeoutRef =
    useRef(null);

  const preparedIntervalRef =
    useRef(null);

  const autoCancelInFlightRef =
    useRef(false);

  // ==================================================
  // CLEAR PREPARED TIMERS
  // ==================================================

  const clearPreparedTimers =
    useCallback(
      () => {
        if (
          preparedTimeoutRef.current
        ) {
          clearTimeout(
            preparedTimeoutRef.current
          );

          preparedTimeoutRef.current =
            null;
        }

        if (
          preparedIntervalRef.current
        ) {
          clearInterval(
            preparedIntervalRef.current
          );

          preparedIntervalRef.current =
            null;
        }
      },
      []
    );

  // ==================================================
  // AUTH HEADERS
  // ==================================================

  const authHeaders =
    useCallback(
      () => ({
        apikey:
          supabaseAnonKey,

        Authorization:
          `Bearer ${accessToken}`,

        "Content-Type":
          "application/json",
      }),
      [
        supabaseAnonKey,
        accessToken,
      ]
    );

  // ==================================================
  // LOGOUT
  // ==================================================

  function logout() {
    sessionStorage.removeItem(
      "teamLegendUser"
    );

    router.replace("/");
  }

  // ==================================================
  // RPC
  // ==================================================

  const callRpc =
    useCallback(
      async (
        functionName,
        body = {}
      ) => {
        if (
          !supabaseUrl ||
          !supabaseAnonKey ||
          !accessToken
        ) {
          throw new Error(
            "Account session is incomplete."
          );
        }

        const response =
          await fetch(
            `${supabaseUrl}/rest/v1/rpc/${functionName}`,
            {
              method:
                "POST",

              headers:
                authHeaders(),

              body:
                JSON.stringify(
                  body
                ),

              cache:
                "no-store",
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
              result?.hint ||
              `Unable to run ${functionName}.`
          );
        }

        return result;
      },
      [
        supabaseUrl,
        supabaseAnonKey,
        accessToken,
        authHeaders,
      ]
    );

  // ==================================================
  // LOAD CURRENT FLOAT SEND METHOD
  // ==================================================

  const loadFloatSendMethod =
    useCallback(
      async () => {
        if (
          !supabaseUrl ||
          !supabaseAnonKey ||
          !accessToken
        ) {
          return null;
        }

        const response =
          await fetch(
            `${supabaseUrl}/rest/v1/payment_system_settings` +
              `?id=eq.1` +
              `&select=float_send_method` +
              `&limit=1`,
            {
              method:
                "GET",

              headers:
                authHeaders(),

              cache:
                "no-store",
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
              "Unable to load payment route."
          );
        }

        const row =
          Array.isArray(
            result
          )
            ? result[0]
            : null;

        if (
          !row?.float_send_method
        ) {
          return null;
        }

        return normalizeFloatSendMethod(
          row.float_send_method
        );
      },
      [
        supabaseUrl,
        supabaseAnonKey,
        accessToken,
        authHeaders,
      ]
    );

  // ==================================================
  // LOAD SHOPS
  // ==================================================

  const loadShops =
    useCallback(
      async () => {
        const response =
          await fetch(
            `${supabaseUrl}/rest/v1/shops` +
              `?is_active=eq.true` +
              `&select=id,shop_name,shop_type,is_active` +
              `&order=shop_name.asc`,
            {
              method:
                "GET",

              headers:
                authHeaders(),

              cache:
                "no-store",
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
              "Unable to load shops."
          );
        }

        return Array.isArray(
          result
        )
          ? result
          : [];
      },
      [
        supabaseUrl,
        authHeaders,
      ]
    );

  // ==================================================
  // LOAD RECIPIENTS
  // ==================================================

  const loadRecipients =
    useCallback(
      async () => {
        const response =
          await fetch(
            `${supabaseUrl}/rest/v1/mpesa_cashier_recipients` +
              `?is_active=eq.true` +
              `&select=` +
              `id,shop_id,slot_number,recipient_name,phone_number,linked_profile_id,is_active` +
              `&order=shop_id.asc,slot_number.asc`,
            {
              method:
                "GET",

              headers:
                authHeaders(),

              cache:
                "no-store",
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
              "Unable to load approved M-Pesa recipients."
          );
        }

        return Array.isArray(
          result
        )
          ? result
          : [];
      },
      [
        supabaseUrl,
        authHeaders,
      ]
    );

  // ==================================================
  // LOAD TRANSACTIONS
  // ==================================================

  const loadTransactions =
    useCallback(
      async () => {
        const response =
          await fetch(
            `${supabaseUrl}/rest/v1/accountant_transactions` +
              `?select=*` +
              `&order=created_at.desc` +
              `&limit=300`,
            {
              method:
                "GET",

              headers:
                authHeaders(),

              cache:
                "no-store",
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
              "Unable to load Accountant transactions."
          );
        }

        return Array.isArray(
          result
        )
          ? result
          : [];
      },
      [
        supabaseUrl,
        authHeaders,
      ]
    );

  // ==================================================
  // LOAD EXPENSES
  // ==================================================

  const loadExpenses =
    useCallback(
      async (
        reportId
      ) => {
        if (!reportId) {
          return [];
        }

        const response =
          await fetch(
            `${supabaseUrl}/rest/v1/accountant_expenses` +
              `?accountant_report_id=eq.${encodeURIComponent(
                reportId
              )}` +
              `&select=*` +
              `&order=slot_number.asc`,
            {
              method:
                "GET",

              headers:
                authHeaders(),

              cache:
                "no-store",
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
              "Unable to load Accountant expenses."
          );
        }

        return Array.isArray(
          result
        )
          ? result
          : [];
      },
      [
        supabaseUrl,
        authHeaders,
      ]
    );

  // ==================================================
  // OPEN TODAY
  // ==================================================

  const openToday =
    useCallback(
      async () => {
        return await callRpc(
          "tl_accountant_open_today",
          {}
        );
      },
      [
        callRpc,
      ]
    );

  // ==================================================
  // REFRESH ALL
  // ==================================================

  const refreshData =
    useCallback(
      async (
        options = {}
      ) => {
        const silent =
          options?.silent ===
          true;

        if (!silent) {
          setRefreshing(
            true
          );
        }

        try {
          setMessage("");

          const [
            loadedShops,
            loadedRecipients,
            loadedTransactions,
          ] =
            await Promise.all([
              loadShops(),
              loadRecipients(),
              loadTransactions(),
            ]);

          setShops(
            loadedShops
          );

          setRecipients(
            loadedRecipients
          );

          setTransactions(
            loadedTransactions
          );

          try {
            const loadedMethod =
              await loadFloatSendMethod();

            if (
              loadedMethod
            ) {
              setFloatSendMethod(
                loadedMethod
              );
            }
          } catch (routeError) {
            console.warn(
              "FLOAT SEND METHOD REFRESH ERROR:",
              routeError
            );
          }

          let loadedReport =
            null;

          let openError =
            "";

          try {
            loadedReport =
              await openToday();
          } catch (error) {
            openError =
              error?.message ||
              "Unable to open today's Accountant report.";
          }

          setReportOpenError(
            openError
          );

          setReport(
            loadedReport
          );

          const loadedExpenses =
            await loadExpenses(
              loadedReport?.id
            );

          setExpenses(
            loadedExpenses
          );
        } catch (error) {
          console.error(
            "ACCOUNTANT REFRESH ERROR:",
            error
          );

          setMessage(
            error?.message ||
              "Unable to load Accountant dashboard."
          );
        } finally {
          if (!silent) {
            setRefreshing(
              false
            );
          }

          setLoading(
            false
          );
        }
      },
      [
        loadShops,
        loadRecipients,
        loadTransactions,
        loadFloatSendMethod,
        openToday,
        loadExpenses,
      ]
    );

  // ==================================================
  // INITIAL LOAD
  // ==================================================

  useEffect(() => {
    refreshData();
  }, [
    refreshData,
  ]);

  // ==================================================
  // LIVE REFRESH
  // ==================================================

  useEffect(() => {
    const timer =
      setInterval(
        () => {
          refreshData({
            silent:
              true,
          });
        },
        15000
      );

    return () => {
      clearInterval(
        timer
      );
    };
  }, [
    refreshData,
  ]);

  // ==================================================
  // 30-SECOND GENERAL INACTIVITY
  //
  // Clears only an unused selection.
  // A prepared transaction has its own safe auto-cancel.
  // ==================================================

  useEffect(() => {
    let disposed =
      false;

    const clearTimer =
      () => {
        if (
          inactivityTimerRef.current
        ) {
          clearTimeout(
            inactivityTimerRef.current
          );

          inactivityTimerRef.current =
            null;
        }
      };

    const runInactivityRefresh =
      async () => {
        if (
          disposed
        ) {
          return;
        }

        if (
          !preparedSend &&
          !preparingSend &&
          !completingSend
        ) {
          setSelectedRecipientId(
            ""
          );

          setSendAmount(
            ""
          );

          setSendReceipt(
            ""
          );

          setDeclinedSendMessage(
            ""
          );

          setMessage(
            ""
          );
        }

        await refreshData({
          silent:
            true,
        });
      };

    const armTimer =
      () => {
        clearTimer();

        inactivityTimerRef.current =
          setTimeout(
            async () => {
              await runInactivityRefresh();

              if (
                !disposed
              ) {
                armTimer();
              }
            },
            INACTIVITY_MS
          );
      };

    const activityHandler =
      () => {
        armTimer();
      };

    window.addEventListener(
      "pointerdown",
      activityHandler
    );

    window.addEventListener(
      "keydown",
      activityHandler
    );

    window.addEventListener(
      "touchstart",
      activityHandler
    );

    armTimer();

    return () => {
      disposed =
        true;

      clearTimer();

      window.removeEventListener(
        "pointerdown",
        activityHandler
      );

      window.removeEventListener(
        "keydown",
        activityHandler
      );

      window.removeEventListener(
        "touchstart",
        activityHandler
      );
    };
  }, [
    refreshData,
    preparedSend,
    preparingSend,
    completingSend,
  ]);

  // ==================================================
  // 30-SECOND PREPARED TRANSFER AUTO-CANCEL
  //
  // Prevents unfinished transactions accumulating.
  // Typing/changing the reference restarts the timer.
  // ==================================================

  useEffect(() => {
    clearPreparedTimers();

    if (
      !preparedSend?.transaction_id ||
      completingSend ||
      cancellingTransactionId ===
        preparedSend?.transaction_id
    ) {
      setPreparedSecondsLeft(
        30
      );

      return;
    }

    const transactionId =
      preparedSend.transaction_id;

    const startedAt =
      Date.now();

    setPreparedSecondsLeft(
      30
    );

    preparedIntervalRef.current =
      setInterval(
        () => {
          const elapsed =
            Date.now() -
            startedAt;

          const remaining =
            Math.max(
              0,
              Math.ceil(
                (
                  PREPARED_TIMEOUT_MS -
                  elapsed
                ) /
                  1000
              )
            );

          setPreparedSecondsLeft(
            remaining
          );
        },
        1000
      );

    preparedTimeoutRef.current =
      setTimeout(
        async () => {
          if (
            autoCancelInFlightRef.current
          ) {
            return;
          }

          autoCancelInFlightRef.current =
            true;

          clearPreparedTimers();

          try {
            await callRpc(
              "tl_accountant_cancel_pending_transaction",
              {
                p_transaction_id:
                  transactionId,
              }
            );

            setPreparedSend(
              (
                previous
              ) =>
                String(
                  previous?.transaction_id ||
                    ""
                ) ===
                String(
                  transactionId
                )
                  ? null
                  : previous
            );

            setSelectedRecipientId(
              ""
            );

            setSendAmount(
              ""
            );

            setSendReceipt(
              ""
            );

            setDeclinedSendMessage(
              ""
            );

            setMessage(
              ""
            );

            setSuccessMessage(
              "Unused prepared float transfer cancelled automatically after 30 seconds of inactivity."
            );

            await refreshData({
              silent:
                true,
            });
          } catch (error) {
            console.error(
              "AUTO CANCEL PREPARED FLOAT ERROR:",
              error
            );

            const text =
              String(
                error?.message ||
                  ""
              )
                .trim()
                .toLowerCase();

            const statusChanged =
              text.includes(
                "already changed"
              ) ||
              text.includes(
                "no longer"
              ) ||
              text.includes(
                "cannot be cancelled"
              );

            await refreshData({
              silent:
                true,
            });

            if (
              statusChanged
            ) {
              setPreparedSend(
                null
              );

              setSelectedRecipientId(
                ""
              );

              setSendAmount(
                ""
              );

              setSendReceipt(
                ""
              );
            } else {
              setMessage(
                error?.message ||
                  "Unable to automatically cancel the unfinished transfer."
              );
            }
          } finally {
            autoCancelInFlightRef.current =
              false;

            setPreparedSecondsLeft(
              30
            );
          }
        },
        PREPARED_TIMEOUT_MS
      );

    return () => {
      clearPreparedTimers();
    };
  }, [
    preparedSend?.transaction_id,
    sendReceipt,
    completingSend,
    cancellingTransactionId,
    callRpc,
    refreshData,
    clearPreparedTimers,
  ]);

  // ==================================================
  // CLEAN TIMER REFS ON UNMOUNT
  // ==================================================

  useEffect(() => {
    return () => {
      clearPreparedTimers();

      if (
        inactivityTimerRef.current
      ) {
        clearTimeout(
          inactivityTimerRef.current
        );
      }
    };
  }, [
    clearPreparedTimers,
  ]);

  // ==================================================
  // SHOP MAP
  // ==================================================

  const shopMap =
    useMemo(
      () => {
        const map =
          new Map();

        for (
          const shop of shops
        ) {
          map.set(
            shop.id,
            shop
          );
        }

        return map;
      },
      [
        shops,
      ]
    );

  // ==================================================
  // SORTED RECIPIENTS
  // ==================================================

  const sortedRecipients =
    useMemo(
      () => {
        return [
          ...recipients,
        ].sort(
          (
            a,
            b
          ) => {
            const shopA =
              String(
                shopMap.get(
                  a.shop_id
                )?.shop_name ||
                  ""
              );

            const shopB =
              String(
                shopMap.get(
                  b.shop_id
                )?.shop_name ||
                  ""
              );

            const shopCompare =
              shopA.localeCompare(
                shopB
              );

            if (
              shopCompare !==
              0
            ) {
              return shopCompare;
            }

            return (
              Number(
                a.slot_number ||
                  0
              ) -
              Number(
                b.slot_number ||
                  0
              )
            );
          }
        );
      },
      [
        recipients,
        shopMap,
      ]
    );

  // ==================================================
  // SELECTED RECIPIENT
  // ==================================================

  const selectedRecipient =
    useMemo(
      () =>
        recipients.find(
          (item) =>
            String(
              item.id
            ) ===
            String(
              selectedRecipientId
            )
        ) ||
        null,
      [
        recipients,
        selectedRecipientId,
      ]
    );

  // ==================================================
  // PAYMENT ROUTES
  // ==================================================

  const currentSendRoute =
    useMemo(
      () =>
        getAccountantSendRoute(
          null,
          floatSendMethod
        ),
      [
        floatSendMethod,
      ]
    );

  const preparedSendRoute =
    useMemo(
      () =>
        getAccountantSendRoute(
          preparedSend,
          floatSendMethod
        ),
      [
        preparedSend,
        floatSendMethod,
      ]
    );

  // ==================================================
  // PENDING CASHIER RETURNS
  // ==================================================

  const pendingReturns =
    useMemo(
      () =>
        transactions
          .filter(
            (tx) =>
              tx.flow ===
                "CASHIER_TO_ACCOUNTANT" &&
              (
                tx.status ===
                  "CREATED" ||
                tx.status ===
                  "PENDING_MANUAL_SEND" ||
                tx.status ===
                  "AWAITING_ACCOUNTANT_CONFIRMATION" ||
                tx.status ===
                  "PENDING_MPESA" ||
                tx.status ===
                  "CHECKING"
              )
          )
          .sort(
            (
              a,
              b
            ) =>
              new Date(
                b.created_at
              ).getTime() -
              new Date(
                a.created_at
              ).getTime()
          ),
      [
        transactions,
      ]
    );

  // ==================================================
  // PENDING ACCOUNTANT SENDS
  // ==================================================

  const pendingAccountantSends =
    useMemo(
      () =>
        transactions
          .filter(
            (tx) =>
              tx.flow ===
                "ACCOUNTANT_TO_CASHIER" &&
              (
                tx.status ===
                  "CREATED" ||
                tx.status ===
                  "PENDING_MANUAL_SEND" ||
                tx.status ===
                  "PENDING_MPESA" ||
                tx.status ===
                  "CHECKING"
              )
          )
          .sort(
            (
              a,
              b
            ) =>
              new Date(
                b.created_at
              ).getTime() -
              new Date(
                a.created_at
              ).getTime()
          ),
      [
        transactions,
      ]
    );

  // ==================================================
  // CARRIED FORWARD
  // ==================================================

  const todayNairobi =
    nairobiDateKey(
      new Date()
    );

  const carriedForwardTransactions =
    useMemo(
      () => {
        const unresolvedStatuses =
          new Set([
            "CREATED",
            "PENDING_MANUAL_SEND",
            "AWAITING_ACCOUNTANT_CONFIRMATION",
            "PENDING_MPESA",
            "CHECKING",
          ]);

        return transactions
          .filter(
            (tx) => {
              const status =
                String(
                  tx.status ||
                    ""
                )
                  .trim()
                  .toUpperCase();

              if (
                !unresolvedStatuses.has(
                  status
                )
              ) {
                return false;
              }

              const transactionDate =
                nairobiDateKey(
                  tx.created_at
                );

              if (
                !transactionDate
              ) {
                return false;
              }

              return (
                transactionDate <
                todayNairobi
              );
            }
          )
          .sort(
            (
              a,
              b
            ) =>
              new Date(
                a.created_at
              ).getTime() -
              new Date(
                b.created_at
              ).getTime()
          );
      },
      [
        transactions,
        todayNairobi,
      ]
    );

  const hasCarriedForward =
    carriedForwardTransactions.length >
    0;

  // ==================================================
  // NEXT EXPENSE SLOT
  // ==================================================

  const nextExpenseSlot =
    useMemo(
      () => {
        const used =
          new Set(
            expenses.map(
              (expense) =>
                Number(
                  expense.slot_number
                )
            )
          );

        for (
          let slot = 1;
          slot <= 20;
          slot += 1
        ) {
          if (
            !used.has(
              slot
            )
          ) {
            return slot;
          }
        }

        return null;
      },
      [
        expenses,
      ]
    );

  // ==================================================
  // REPORT STATUS
  // ==================================================

  const reportClosed =
    String(
      report?.status ||
        ""
    )
      .trim()
      .toUpperCase() ===
    "CLOSED";

  const newActivityLocked =
    hasCarriedForward ||
    reportClosed ||
    !report;

  // ==================================================
  // PREPARE FLOAT SEND
  // ==================================================

  async function prepareFloatSend() {
    if (
      preparingSend ||
      preparedSend
    ) {
      return;
    }

    if (
      hasCarriedForward
    ) {
      setMessage(
        "Resolve all carried-forward transactions before sending new float today."
      );

      return;
    }

    if (!report) {
      setMessage(
        "Today's Accountant report is not open yet."
      );

      return;
    }

    const amount =
      Number(
        sendAmount
      );

    setDeclinedSendMessage(
      ""
    );

    if (
      !selectedRecipientId
    ) {
      setMessage(
        "Select the shop and cashier receiving the float."
      );

      return;
    }

    if (
      !Number.isFinite(
        amount
      ) ||
      amount <= 0
    ) {
      setMessage(
        "Enter a valid float amount."
      );

      return;
    }

    try {
      setPreparingSend(
        true
      );

      setMessage("");
      setSuccessMessage("");
      setDeclinedSendMessage("");

      let routeAtPrepare =
        floatSendMethod;

      try {
        const latestMethod =
          await loadFloatSendMethod();

        if (
          latestMethod
        ) {
          routeAtPrepare =
            latestMethod;

          setFloatSendMethod(
            latestMethod
          );
        }
      } catch (routeError) {
        console.warn(
          "LATEST FLOAT ROUTE CHECK ERROR:",
          routeError
        );
      }

      const result =
        await callRpc(
          "tl_accountant_prepare_manual_send",
          {
            p_recipient_id:
              selectedRecipientId,

            p_amount:
              roundMoney(
                amount
              ),

            p_note:
              null,
          }
        );

      const returnedSlot =
        Number(
          result?.company_float_slot
        );

      if (
        !result ||
        result?.success ===
          false ||
        !result?.transaction_id ||
        !Number.isInteger(
          returnedSlot
        ) ||
        returnedSlot < 1 ||
        returnedSlot > 3
      ) {
        throw new Error(
          result?.message ||
            result?.error ||
            "The float transfer was declined."
        );
      }

      const preparedRouteCode =
        normalizeFloatSendMethod(
          result?.float_send_method ||
            result?.payment_method ||
            result?.send_method ||
            routeAtPrepare
        );

      const prepared = {
        ...result,

        float_send_method:
          preparedRouteCode,

        created_at:
          result?.created_at ||
          new Date().toISOString(),
      };

      setPreparedSend(
        prepared
      );

      setSendReceipt(
        ""
      );

      setPreparedSecondsLeft(
        30
      );

      setDeclinedSendMessage(
        ""
      );

      const route =
        getAccountantSendRoute(
          prepared,
          preparedRouteCode
        );

      setSuccessMessage(
        route.isIm
          ? `Transfer prepared for Company Float ${returnedSlot}. Send from I&M to the cashier's M-Pesa number, then enter the transaction reference.`
          : `Transfer prepared for Company Float ${returnedSlot}. Send through M-Pesa, then enter the M-Pesa receipt.`
      );

      await refreshData({
        silent:
          true,
      });
    } catch (error) {
      console.error(
        "PREPARE FLOAT ERROR:",
        error
      );

      const errorMessage =
        error?.message ||
        "Unable to prepare float transfer.";

      setPreparedSend(
        null
      );

      setSendReceipt(
        ""
      );

      setSuccessMessage(
        ""
      );

      setMessage(
        ""
      );

      setDeclinedSendMessage(
        `DECLINED — ${errorMessage} No float was approved or posted. Do not send the money.`
      );

      await refreshData({
        silent:
          true,
      });
    } finally {
      setPreparingSend(
        false
      );
    }
  }

  // ==================================================
  // COMPLETE FLOAT SEND
  // ==================================================

  async function completeFloatSend() {
    if (
      !preparedSend?.transaction_id ||
      completingSend
    ) {
      return;
    }

    const receipt =
      String(
        sendReceipt ||
          ""
      )
        .trim()
        .toUpperCase();

    const route =
      getAccountantSendRoute(
        preparedSend,
        floatSendMethod
      );

    if (!receipt) {
      setMessage(
        route.isIm
          ? "Enter the I&M transaction/reference number."
          : "Enter the M-Pesa receipt number."
      );

      return;
    }

    const receiptLabel =
      route.isIm
        ? "Transaction reference"
        : "M-Pesa receipt";

    const confirmSend =
      window.confirm(
        `Confirm that KES ${money(
          preparedSend.amount
        )} was sent successfully to ${
          preparedSend.recipient_name ||
          "the cashier"
        }.\n\nRoute: ${
          route.routeTitle
        }\n${receiptLabel}: ${receipt}`
      );

    if (
      !confirmSend
    ) {
      return;
    }

    clearPreparedTimers();

    try {
      setCompletingSend(
        true
      );

      setMessage("");
      setSuccessMessage("");
      setDeclinedSendMessage("");

      const result =
        await callRpc(
          "tl_accountant_complete_manual_send",
          {
            p_transaction_id:
              preparedSend.transaction_id,

            p_receipt_no:
              receipt,
          }
        );

      setPreparedSend(
        null
      );

      setSelectedRecipientId(
        ""
      );

      setSendAmount(
        ""
      );

      setSendReceipt(
        ""
      );

      setPreparedSecondsLeft(
        30
      );

      setDeclinedSendMessage(
        ""
      );

      setSuccessMessage(
        `Float completed. KES ${money(
          result?.cashier_float_received
        )} has been posted to the cashier's Company Float ${
          result?.company_float_slot ||
          ""
        }.`
      );

      await refreshData({
        silent:
          true,
      });
    } catch (error) {
      console.error(
        "COMPLETE FLOAT ERROR:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to complete float transfer."
      );
    } finally {
      setCompletingSend(
        false
      );
    }
  }

  // ==================================================
  // CANCEL CURRENT PREPARED SEND
  // ==================================================

  async function cancelPreparedFloatSend() {
    if (
      !preparedSend?.transaction_id ||
      cancellingTransactionId
    ) {
      return;
    }

    const transactionId =
      preparedSend.transaction_id;

    const confirmed =
      window.confirm(
        `Cancel transaction ${
          preparedSend.transaction_no ||
          ""
        }?\n\n` +
          `Cashier: ${
            preparedSend.recipient_name ||
            "-"
          }\n` +
          `Amount: KES ${money(
            preparedSend.amount
          )}\n\n` +
          `Only cancel if the money was NOT sent.`
      );

    if (
      !confirmed
    ) {
      return;
    }

    clearPreparedTimers();

    try {
      setCancellingTransactionId(
        transactionId
      );

      setMessage("");
      setSuccessMessage("");
      setDeclinedSendMessage("");

      const result =
        await callRpc(
          "tl_accountant_cancel_pending_transaction",
          {
            p_transaction_id:
              transactionId,
          }
        );

      setPreparedSend(
        null
      );

      setSelectedRecipientId(
        ""
      );

      setSendAmount(
        ""
      );

      setSendReceipt(
        ""
      );

      setPreparedSecondsLeft(
        30
      );

      setSuccessMessage(
        `Transaction ${
          result?.transaction_no ||
          preparedSend.transaction_no ||
          ""
        } cancelled. No float was sent.`
      );

      await refreshData({
        silent:
          true,
      });
    } catch (error) {
      console.error(
        "CANCEL PREPARED FLOAT ERROR:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to cancel the prepared transfer."
      );
    } finally {
      setCancellingTransactionId(
        null
      );
    }
  }

  // ==================================================
  // CONFIRM CASHIER RETURN
  // ==================================================

  async function confirmCashierReturn(
    transaction
  ) {
    if (
      !transaction?.id ||
      confirmingTransactionId
    ) {
      return;
    }

    if (
      transaction.status !==
      "AWAITING_ACCOUNTANT_CONFIRMATION"
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Confirm that Legend Accounts received KES ${money(
          transaction.amount
        )} from ${
          transaction.cashier_name ||
          "cashier"
        }.\n\nReceipt: ${
          transaction.manual_receipt_no ||
          "-"
        }\n\nAfter confirmation, the cashier expense will be posted automatically.`
      );

    if (
      !confirmed
    ) {
      return;
    }

    try {
      setConfirmingTransactionId(
        transaction.id
      );

      setMessage("");
      setSuccessMessage("");

      const result =
        await callRpc(
          "tl_accountant_confirm_manual_return",
          {
            p_transaction_id:
              transaction.id,
          }
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
      console.error(
        "CONFIRM RETURN ERROR:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to confirm cashier return."
      );
    } finally {
      setConfirmingTransactionId(
        null
      );
    }
  }

  // ==================================================
  // CANCEL ANY UNFINISHED TRANSACTION
  // ==================================================

  async function cancelPendingTransaction(
    transaction
  ) {
    if (
      !transaction?.id ||
      cancellingTransactionId
    ) {
      return;
    }

    const cashier =
      transaction.recipient_name_snapshot ||
      transaction.cashier_name ||
      "-";

    const confirmed =
      window.confirm(
        `Cancel transaction ${
          transaction.transaction_no
        }?\n\n` +
          `Cashier: ${cashier}\n` +
          `Amount: KES ${money(
            transaction.amount
          )}\n\n` +
          `Only cancel this transaction if the money was NOT sent.`
      );

    if (
      !confirmed
    ) {
      return;
    }

    try {
      setCancellingTransactionId(
        transaction.id
      );

      setMessage("");
      setSuccessMessage("");

      const result =
        await callRpc(
          "tl_accountant_cancel_pending_transaction",
          {
            p_transaction_id:
              transaction.id,
          }
        );

      setSuccessMessage(
        `Transaction ${
          result?.transaction_no ||
          transaction.transaction_no
        } cancelled successfully.`
      );

      await refreshData({
        silent:
          true,
      });
    } catch (error) {
      console.error(
        "CANCEL TRANSACTION ERROR:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to cancel transaction."
      );
    } finally {
      setCancellingTransactionId(
        null
      );
    }
  }

  // ==================================================
  // ADD ACCOUNTANT EXPENSE
  // ==================================================

  async function addExpense() {
    if (
      savingExpense
    ) {
      return;
    }

    if (
      hasCarriedForward
    ) {
      setMessage(
        "Resolve all carried-forward transactions before entering today's expenses."
      );

      return;
    }

    const description =
      String(
        expenseDescription ||
          ""
      ).trim();

    const amount =
      Number(
        expenseAmount
      );

    if (
      !description
    ) {
      setMessage(
        "Enter the expense description."
      );

      return;
    }

    if (
      !Number.isFinite(
        amount
      ) ||
      amount <= 0
    ) {
      setMessage(
        "Enter a valid expense amount."
      );

      return;
    }

    try {
      setSavingExpense(
        true
      );

      setMessage("");
      setSuccessMessage("");

      const result =
        await callRpc(
          "tl_accountant_add_expense",
          {
            p_description:
              description,

            p_amount:
              roundMoney(
                amount
              ),
          }
        );

      setExpenseDescription(
        ""
      );

      setExpenseAmount(
        ""
      );

      setSuccessMessage(
        `Expense ${
          result?.slot_number ||
          ""
        } saved and locked.`
      );

      await refreshData();
    } catch (error) {
      console.error(
        "ACCOUNTANT EXPENSE ERROR:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to save Accountant expense."
      );
    } finally {
      setSavingExpense(
        false
      );
    }
  }

  // ==================================================
  // CLOSE DAY
  // ==================================================

  async function closeAccountantDay() {
    if (
      closingDay ||
      !report?.report_date
    ) {
      return;
    }

    if (
      hasCarriedForward
    ) {
      setMessage(
        "Resolve all carried-forward transactions before closing today's Accountant report."
      );

      return;
    }

    const confirmed =
      window.confirm(
        `Close Accountant report for ${
          report.report_date
        }?\n\nClosing Balance: KES ${money(
          report.closing_balance
        )}\n\nAfter closing, today's Accountant entries will be locked.`
      );

    if (
      !confirmed
    ) {
      return;
    }

    try {
      setClosingDay(
        true
      );

      setMessage("");
      setSuccessMessage("");

      const result =
        await callRpc(
          "tl_accountant_close_day",
          {
            p_report_date:
              report.report_date,
          }
        );

      setSuccessMessage(
        `Accountant day closed. Closing Balance: KES ${money(
          result?.closing_balance
        )}.`
      );

      await refreshData();
    } catch (error) {
      console.error(
        "CLOSE ACCOUNTANT DAY ERROR:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to close Accountant day."
      );
    } finally {
      setClosingDay(
        false
      );
    }
  }

  // ==================================================
  // LOADING
  // ==================================================

  if (
    loading
  ) {
    return (
      <div style={loadingStyle}>
        Loading Legend Accounts...
      </div>
    );
  }

  // ==================================================
  // PAGE
  // ==================================================

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <div style={brandStyle}>
            TEAM LEGEND ACCOUNTS
          </div>

          <div style={sloganStyle}>
            FLOAT • REFUNDS • EXPENSES • CONTROL
          </div>
        </div>

        <div style={headerRightStyle}>
          <div style={welcomeStyle}>
            <small>
              SIGNED IN
            </small>

            <strong>
              {accountantName}
            </strong>
          </div>

          <button
            type="button"
            onClick={() =>
              refreshData()
            }
            disabled={
              refreshing
            }
            style={refreshButtonStyle}
          >
            {refreshing
              ? "Refreshing..."
              : "Refresh"}
          </button>

          <button
            type="button"
            onClick={
              logout
            }
            style={logoutButtonStyle}
          >
            Logout
          </button>
        </div>
      </header>

      <div style={contentStyle}>
        {message && (
          <div style={errorStyle}>
            {message}
          </div>
        )}

        {successMessage && (
          <div style={successStyle}>
            {successMessage}
          </div>
        )}

        {reportOpenError && (
          <div style={warningStyle}>
            <strong>
              Today's Accountant report could not be opened.
            </strong>

            <div style={warningTextStyle}>
              {reportOpenError}
            </div>
          </div>
        )}

        {/* CARRIED FORWARD */}

        {hasCarriedForward && (
          <section style={carriedForwardPanelStyle}>
            <div style={carriedForwardHeaderStyle}>
              <div>
                <div style={carriedForwardTitleStyle}>
                  ⚠ CARRIED FORWARD — ACTION REQUIRED
                </div>

                <div style={carriedForwardSubtitleStyle}>
                  {
                    carriedForwardTransactions.length
                  }{" "}
                  unresolved transaction
                  {carriedForwardTransactions.length ===
                  1
                    ? ""
                    : "s"}{" "}
                  from a previous day.
                </div>
              </div>

              <div style={carriedForwardBadgeStyle}>
                RESOLVE FIRST
              </div>
            </div>

            <div style={carriedForwardNoticeStyle}>
              Resolve previous transactions before sending new
              float, entering new expenses, or closing today.
            </div>

            <div style={tableWrapStyle}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <TableHead>
                      Original Date
                    </TableHead>

                    <TableHead>
                      Transaction
                    </TableHead>

                    <TableHead>
                      Type
                    </TableHead>

                    <TableHead>
                      Shop
                    </TableHead>

                    <TableHead>
                      Cashier
                    </TableHead>

                    <TableHead right>
                      Amount
                    </TableHead>

                    <TableHead right>
                      Fee
                    </TableHead>

                    <TableHead>
                      Receipt
                    </TableHead>

                    <TableHead>
                      Status
                    </TableHead>

                    <TableHead>
                      Action
                    </TableHead>
                  </tr>
                </thead>

                <tbody>
                  {carriedForwardTransactions.map(
                    (
                      transaction
                    ) => (
                      <tr
                        key={
                          transaction.id
                        }
                      >
                        <TableCell>
                          {formatDateTime(
                            transaction.created_at
                          )}
                        </TableCell>

                        <TableCell>
                          {
                            transaction.transaction_no
                          }
                        </TableCell>

                        <TableCell>
                          {transaction.flow ===
                          "ACCOUNTANT_TO_CASHIER"
                            ? "TO CASHIER"
                            : "FROM CASHIER"}
                        </TableCell>

                        <TableCell>
                          {shopMap.get(
                            transaction.shop_id
                          )?.shop_name ||
                            "Shop"}
                        </TableCell>

                        <TableCell>
                          {transaction.recipient_name_snapshot ||
                            transaction.cashier_name ||
                            "-"}
                        </TableCell>

                        <TableCell right>
                          KES{" "}
                          {money(
                            transaction.amount
                          )}
                        </TableCell>

                        <TableCell right>
                          KES{" "}
                          {money(
                            transaction.actual_fee ??
                              transaction.estimated_fee
                          )}
                        </TableCell>

                        <TableCell>
                          {transaction.mpesa_receipt_number ||
                            transaction.manual_receipt_no ||
                            "-"}
                        </TableCell>

                        <TableCell>
                          <StatusText
                            status={
                              transaction.status
                            }
                          />
                        </TableCell>

                        <TableCell>
                          {transaction.status ===
                          "AWAITING_ACCOUNTANT_CONFIRMATION" ? (
                            <button
                              type="button"
                              onClick={() =>
                                confirmCashierReturn(
                                  transaction
                                )
                              }
                              disabled={
                                confirmingTransactionId ===
                                transaction.id
                              }
                              style={smallConfirmButtonStyle}
                            >
                              {confirmingTransactionId ===
                              transaction.id
                                ? "Confirming..."
                                : "Confirm Received"}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                cancelPendingTransaction(
                                  transaction
                                )
                              }
                              disabled={
                                cancellingTransactionId ===
                                transaction.id
                              }
                              style={cancelTransactionButtonStyle}
                            >
                              {cancellingTransactionId ===
                              transaction.id
                                ? "Cancelling..."
                                : "Cancel Transaction"}
                            </button>
                          )}
                        </TableCell>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* DAILY REPORT */}

        <section style={panelStyle}>
          <div style={panelHeaderStyle}>
            <div>
              <div style={panelTitleStyle}>
                DAILY ACCOUNTANT REPORT
              </div>

              <div style={panelSubtitleStyle}>
                Africa/Nairobi calendar day
              </div>
            </div>

            <div
              style={{
                ...statusBadgeStyle,

                backgroundColor:
                  reportClosed
                    ? "#475569"
                    : report
                    ? "#15803d"
                    : "#d97706",
              }}
            >
              {report?.status ||
                (reportOpenError
                  ? "WAITING"
                  : "OPEN")}
            </div>
          </div>

          <div style={summaryGridStyle}>
            <SummaryCard
              label="REPORT DATE"
              value={
                report?.report_date ||
                "-"
              }
            />

            <SummaryCard
              label="BALANCE B/F"
              value={`KES ${money(
                report?.opening_balance
              )}`}
            />

            <SummaryCard
              label="FLOAT SENT"
              value={`KES ${money(
                report?.total_float_sent
              )}`}
            />

            <SummaryCard
              label="FLOAT RECEIVED"
              value={`KES ${money(
                report?.total_float_received
              )}`}
            />

            <SummaryCard
              label="TRANSACTION FEES"
              value={`KES ${money(
                report?.total_transaction_fees
              )}`}
            />

            <SummaryCard
              label="ACCOUNTANT EXPENSES"
              value={`KES ${money(
                report?.total_expenses
              )}`}
            />

            <SummaryCard
              label="CLOSING BALANCE"
              value={`KES ${money(
                report?.closing_balance
              )}`}
              strong
            />
          </div>

          <div style={bfNoticeStyle}>
            Balance B/F is controlled by Admin. After day closing,
            the closing balance automatically becomes the next
            Accountant day's B/F.
          </div>
        </section>

        {/* SEND FLOAT */}

        <section style={panelStyle}>
          <div style={panelHeaderStyle}>
            <div>
              <div style={panelTitleStyle}>
                SEND FLOAT TO CASHIER
              </div>

              <div style={panelSubtitleStyle}>
                Accountant → Cashier
              </div>
            </div>

            <div style={routeBadgeStyle}>
              {currentSendRoute.routeTitle}
            </div>
          </div>

          {hasCarriedForward && (
            <div style={activityLockedStyle}>
              🔒 New float transfers are temporarily locked.
              Resolve the carried-forward transaction(s) first.
            </div>
          )}

          <div style={formGridStyle}>
            <div>
              <label style={labelStyle}>
                Shop / Cashier
              </label>

              <select
                value={
                  selectedRecipientId
                }
                disabled={
                  newActivityLocked ||
                  Boolean(
                    preparedSend
                  )
                }
                onChange={(event) => {
                  setSelectedRecipientId(
                    event.target.value
                  );

                  setDeclinedSendMessage(
                    ""
                  );

                  setMessage(
                    ""
                  );
                }}
                style={inputStyle}
              >
                <option value="">
                  Select approved recipient
                </option>

                {sortedRecipients.map(
                  (
                    recipient
                  ) => {
                    const shop =
                      shopMap.get(
                        recipient.shop_id
                      );

                    return (
                      <option
                        key={
                          recipient.id
                        }
                        value={
                          recipient.id
                        }
                      >
                        {shop?.shop_name ||
                          "Shop"}{" "}
                        —{" "}
                        {recipient.recipient_name}{" "}
                        —{" "}
                        {maskPhone(
                          recipient.phone_number
                        )}
                      </option>
                    );
                  }
                )}
              </select>
            </div>

            <div>
              <label style={labelStyle}>
                Float Amount
              </label>

              <input
                type="number"
                min="1"
                step="0.01"
                value={
                  sendAmount
                }
                disabled={
                  newActivityLocked ||
                  Boolean(
                    preparedSend
                  )
                }
                onChange={(event) => {
                  setSendAmount(
                    event.target.value
                  );

                  setDeclinedSendMessage(
                    ""
                  );

                  setMessage(
                    ""
                  );
                }}
                placeholder="e.g. 3000"
                style={inputStyle}
              />
            </div>
          </div>

          {selectedRecipient && (
            <div style={recipientPreviewStyle}>
              <strong>
                Selected authorized recipient:
              </strong>{" "}
              {selectedRecipient.recipient_name}
              {" • "}
              {shopMap.get(
                selectedRecipient.shop_id
              )?.shop_name ||
                "Shop"}
              {" • "}
              {maskPhone(
                selectedRecipient.phone_number
              )}
            </div>
          )}

          {!preparedSend && (
            <div style={idleNoteStyle}>
              Unused cashier and amount selection clears after
              30 seconds of inactivity.
            </div>
          )}

          {declinedSendMessage && (
            <div style={declinedTransferStyle}>
              <div style={declinedTransferTitleStyle}>
                TRANSFER DECLINED
              </div>

              <div>
                {declinedSendMessage}
              </div>
            </div>
          )}

          {!preparedSend && (
            <button
              type="button"
              onClick={
                prepareFloatSend
              }
              disabled={
                preparingSend ||
                newActivityLocked
              }
              style={{
                ...primaryButtonStyle,

                opacity:
                  preparingSend ||
                  newActivityLocked
                    ? 0.6
                    : 1,
              }}
            >
              {preparingSend
                ? "Preparing..."
                : `Prepare ${currentSendRoute.routeTitle} Transfer`}
            </button>
          )}

          {preparedSend && (
            <div style={preparedTransferStyle}>
              <div style={preparedTopStyle}>
                <div style={preparedTitleStyle}>
                  MANUAL{" "}
                  {preparedSendRoute.routeTitle}{" "}
                  SEND
                </div>

                <div style={preparedCountdownStyle}>
                  AUTO-CANCEL:{" "}
                  {preparedSecondsLeft}s
                </div>
              </div>

              <TransactionDetail
                label="Transaction"
                value={
                  preparedSend.transaction_no ||
                  "-"
                }
              />

              <TransactionDetail
                label="Recipient"
                value={
                  preparedSend.recipient_name ||
                  "-"
                }
              />

              <TransactionDetail
                label="M-Pesa Number"
                value={
                  formatPhoneForDisplay(
                    preparedSend.phone_number
                  )
                }
              />

              <TransactionDetail
                label="Company Float Slot"
                value={`Float ${
                  preparedSend.company_float_slot ||
                  "-"
                }`}
              />

              <TransactionDetail
                label="Amount To Send"
                value={`KES ${money(
                  preparedSend.amount
                )}`}
              />

              <TransactionDetail
                label={
                  preparedSendRoute.feeTitle
                }
                value={`KES ${money(
                  preparedSend.estimated_fee
                )}`}
              />

              <TransactionDetail
                label="Total Company Deduction"
                value={`KES ${money(
                  preparedSend.total_expected_deduction
                )}`}
                strong
              />

              <div style={sendInstructionStyle}>
                {preparedSendRoute.isIm ? (
                  <>
                    Send exactly{" "}
                    <strong>
                      KES{" "}
                      {money(
                        preparedSend.amount
                      )}
                    </strong>{" "}
                    from <strong>I&M</strong> to cashier M-Pesa{" "}
                    <strong>
                      {formatPhoneForDisplay(
                        preparedSend.phone_number
                      )}
                    </strong>
                    . Enter the I&M transaction/reference below.
                  </>
                ) : (
                  <>
                    Send exactly{" "}
                    <strong>
                      KES{" "}
                      {money(
                        preparedSend.amount
                      )}
                    </strong>{" "}
                    to M-Pesa{" "}
                    <strong>
                      {formatPhoneForDisplay(
                        preparedSend.phone_number
                      )}
                    </strong>
                    . Enter the successful M-Pesa receipt below.
                  </>
                )}
              </div>

              <label style={labelStyle}>
                {preparedSendRoute.receiptLabel}
              </label>

              <input
                type="text"
                value={
                  sendReceipt
                }
                disabled={
                  completingSend
                }
                onChange={(
                  event
                ) =>
                  setSendReceipt(
                    event.target.value
                      .toUpperCase()
                  )
                }
                placeholder={
                  preparedSendRoute.isIm
                    ? "Enter I&M transaction/reference"
                    : "e.g. TABC123XYZ"
                }
                style={inputStyle}
              />

              <button
                type="button"
                onClick={
                  completeFloatSend
                }
                disabled={
                  completingSend
                }
                style={{
                  ...completeButtonStyle,

                  opacity:
                    completingSend
                      ? 0.6
                      : 1,
                }}
              >
                {completingSend
                  ? "Completing..."
                  : preparedSendRoute.confirmButton}
              </button>

              <button
                type="button"
                onClick={() =>
                  cancelPreparedFloatSend()
                }
                disabled={
                  completingSend ||
                  cancellingTransactionId ===
                      preparedSend.transaction_id
                }
                style={cancelPreparedButtonStyle}
              >
                {cancellingTransactionId ===
                preparedSend.transaction_id
                  ? "Cancelling..."
                  : "Cancel Prepared Transfer"}
              </button>

              <div style={preparedSafetyNoteStyle}>
                If no receipt/reference is entered for 30 seconds,
                this unfinished prepared transfer is automatically
                cancelled so it does not remain as an unfinished
                transaction.
              </div>
            </div>
          )}

          {pendingAccountantSends.length >
            0 &&
            !preparedSend && (
              <div style={pendingNoticeStyle}>
                <strong>
                  {
                    pendingAccountantSends.length
                  }{" "}
                  unfinished Accountant float transfer(s)
                </strong>

                <div style={pendingNoticeTextStyle}>
                  If these were tests and no money was sent, cancel
                  them below.
                </div>

                <div style={pendingSendListStyle}>
                  {pendingAccountantSends.map(
                    (
                      transaction
                    ) => (
                      <div
                        key={
                          transaction.id
                        }
                        style={pendingSendRowStyle}
                      >
                        <div>
                          <strong>
                            {transaction.transaction_no ||
                              "Transaction"}
                          </strong>

                          <div style={pendingSendMetaStyle}>
                            {transaction.recipient_name_snapshot ||
                              transaction.cashier_name ||
                              "Cashier"}{" "}
                            • KES{" "}
                            {money(
                              transaction.amount
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            cancelPendingTransaction(
                              transaction
                            )
                          }
                          disabled={
                            cancellingTransactionId ===
                            transaction.id
                          }
                          style={cancelSmallButtonStyle}
                        >
                          {cancellingTransactionId ===
                          transaction.id
                            ? "Cancelling..."
                            : "Cancel"}
                        </button>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
        </section>

        {/* CASHIER RETURNS */}

        <section style={panelStyle}>
          <div style={panelHeaderStyle}>
            <div>
              <div style={panelTitleStyle}>
                FLOAT RECEIVED FROM CASHIERS
              </div>

              <div style={panelSubtitleStyle}>
                Cashier → Legend Accounts
              </div>
            </div>

            <div style={countBadgeStyle}>
              {
                pendingReturns.length
              }{" "}
              PENDING
            </div>
          </div>

          {pendingReturns.length ===
          0 ? (
            <div style={emptyStyle}>
              No pending cashier returns.
            </div>
          ) : (
            <div style={tableWrapStyle}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <TableHead>
                      Time
                    </TableHead>

                    <TableHead>
                      Transaction
                    </TableHead>

                    <TableHead>
                      Shop
                    </TableHead>

                    <TableHead>
                      Cashier
                    </TableHead>

                    <TableHead right>
                      Amount
                    </TableHead>

                    <TableHead right>
                      Fee
                    </TableHead>

                    <TableHead>
                      Receipt
                    </TableHead>

                    <TableHead>
                      Status
                    </TableHead>

                    <TableHead>
                      Action
                    </TableHead>
                  </tr>
                </thead>

                <tbody>
                  {pendingReturns.map(
                    (
                      transaction
                    ) => (
                      <tr
                        key={
                          transaction.id
                        }
                      >
                        <TableCell>
                          {formatDateTime(
                            transaction.created_at
                          )}
                        </TableCell>

                        <TableCell>
                          {
                            transaction.transaction_no
                          }
                        </TableCell>

                        <TableCell>
                          {shopMap.get(
                            transaction.shop_id
                          )?.shop_name ||
                            "Shop"}
                        </TableCell>

                        <TableCell>
                          {transaction.cashier_name ||
                            "-"}
                        </TableCell>

                        <TableCell right>
                          KES{" "}
                          {money(
                            transaction.amount
                          )}
                        </TableCell>

                        <TableCell right>
                          KES{" "}
                          {money(
                            transaction.actual_fee ??
                              transaction.estimated_fee
                          )}
                        </TableCell>

                        <TableCell>
                          {transaction.mpesa_receipt_number ||
                            transaction.manual_receipt_no ||
                            "-"}
                        </TableCell>

                        <TableCell>
                          <StatusText
                            status={
                              transaction.status
                            }
                          />
                        </TableCell>

                        <TableCell>
                          {transaction.status ===
                          "AWAITING_ACCOUNTANT_CONFIRMATION" ? (
                            <button
                              type="button"
                              onClick={() =>
                                confirmCashierReturn(
                                  transaction
                                )
                              }
                              disabled={
                                confirmingTransactionId ===
                                transaction.id
                              }
                              style={smallConfirmButtonStyle}
                            >
                              {confirmingTransactionId ===
                              transaction.id
                                ? "Confirming..."
                                : "Confirm Received"}
                            </button>
                          ) : (
                            <span style={mutedSmallStyle}>
                              Waiting for cashier / resolution
                            </span>
                          )}
                        </TableCell>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ACCOUNTANT EXPENSES */}

        <section style={panelStyle}>
          <div style={panelHeaderStyle}>
            <div>
              <div style={panelTitleStyle}>
                ACCOUNTANT EXPENSES
              </div>

              <div style={panelSubtitleStyle}>
                20 sequential daily expense positions
              </div>
            </div>

            <div style={countBadgeStyle}>
              {expenses.length}/20
            </div>
          </div>

          {hasCarriedForward && (
            <div style={activityLockedStyle}>
              🔒 Today's new expenses are temporarily locked
              until all carried-forward transactions are resolved.
            </div>
          )}

          <div style={expensesGridStyle}>
            {Array.from({
              length:
                20,
            }).map(
              (
                _,
                index
              ) => {
                const slot =
                  index + 1;

                const saved =
                  expenses.find(
                    (
                      expense
                    ) =>
                      Number(
                        expense.slot_number
                      ) ===
                      slot
                  );

                const active =
                  !saved &&
                  nextExpenseSlot ===
                    slot &&
                  !newActivityLocked;

                return (
                  <div
                    key={
                      slot
                    }
                    style={{
                      ...expenseRowStyle,

                      backgroundColor:
                        saved
                          ? "#f0fdf4"
                          : active
                          ? "#ffffff"
                          : "#f8fafc",
                    }}
                  >
                    <div style={expenseNumberStyle}>
                      Expense{" "}
                      {slot}
                    </div>

                    {saved ? (
                      <>
                        <div style={savedExpenseDescriptionStyle}>
                          {
                            saved.description
                          }
                        </div>

                        <div style={savedExpenseAmountStyle}>
                          KES{" "}
                          {money(
                            saved.amount
                          )}{" "}
                          ✓
                        </div>
                      </>
                    ) : active ? (
                      <>
                        <input
                          type="text"
                          value={
                            expenseDescription
                          }
                          onChange={(
                            event
                          ) =>
                            setExpenseDescription(
                              event.target.value
                            )
                          }
                          placeholder="Description"
                          style={expenseInputStyle}
                        />

                        <input
                          type="number"
                          min="1"
                          step="0.01"
                          value={
                            expenseAmount
                          }
                          onChange={(
                            event
                          ) =>
                            setExpenseAmount(
                              event.target.value
                            )
                          }
                          placeholder="Amount"
                          style={expenseAmountInputStyle}
                        />

                        <button
                          type="button"
                          onClick={
                            addExpense
                          }
                          disabled={
                            savingExpense
                          }
                          style={smallSaveButtonStyle}
                        >
                          {savingExpense
                            ? "Saving..."
                            : "Save"}
                        </button>
                      </>
                    ) : (
                      <div style={lockedExpenseStyle}>
                        LOCKED
                      </div>
                    )}
                  </div>
                );
              }
            )}
          </div>
        </section>

        {/* TRANSACTION HISTORY */}

        <section style={panelStyle}>
          <div style={panelHeaderStyle}>
            <div>
              <div style={panelTitleStyle}>
                TRANSACTION HISTORY
              </div>

              <div style={panelSubtitleStyle}>
                Latest float transactions
              </div>
            </div>
          </div>

          {transactions.length ===
          0 ? (
            <div style={emptyStyle}>
              No transactions recorded yet.
            </div>
          ) : (
            <div style={tableWrapStyle}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <TableHead>
                      Date / Time
                    </TableHead>

                    <TableHead>
                      Transaction
                    </TableHead>

                    <TableHead>
                      Type
                    </TableHead>

                    <TableHead>
                      Shop
                    </TableHead>

                    <TableHead>
                      Cashier
                    </TableHead>

                    <TableHead right>
                      Amount
                    </TableHead>

                    <TableHead right>
                      Fee
                    </TableHead>

                    <TableHead>
                      Receipt
                    </TableHead>

                    <TableHead>
                      Status
                    </TableHead>
                  </tr>
                </thead>

                <tbody>
                  {transactions.map(
                    (
                      transaction
                    ) => (
                      <tr
                        key={
                          transaction.id
                        }
                      >
                        <TableCell>
                          {formatDateTime(
                            transaction.created_at
                          )}
                        </TableCell>

                        <TableCell>
                          {
                            transaction.transaction_no
                          }
                        </TableCell>

                        <TableCell>
                          {transaction.flow ===
                          "ACCOUNTANT_TO_CASHIER"
                            ? "SENT"
                            : "RECEIVED"}
                        </TableCell>

                        <TableCell>
                          {shopMap.get(
                            transaction.shop_id
                          )?.shop_name ||
                            "Shop"}
                        </TableCell>

                        <TableCell>
                          {transaction.recipient_name_snapshot ||
                            transaction.cashier_name ||
                            "-"}
                        </TableCell>

                        <TableCell right>
                          KES{" "}
                          {money(
                            transaction.amount
                          )}
                        </TableCell>

                        <TableCell right>
                          KES{" "}
                          {money(
                            transaction.actual_fee ??
                              transaction.estimated_fee
                          )}
                        </TableCell>

                        <TableCell>
                          {transaction.mpesa_receipt_number ||
                            transaction.manual_receipt_no ||
                            "-"}
                        </TableCell>

                        <TableCell>
                          <StatusText
                            status={
                              transaction.status
                            }
                          />
                        </TableCell>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* DAY CLOSING */}

        <section style={closingPanelStyle}>
          <div>
            <div style={closingTitleStyle}>
              ACCOUNTANT DAY CLOSING
            </div>

            <div style={closingTextStyle}>
              Carried-forward and today's unresolved float
              transactions must be completed before the day can close.
            </div>
          </div>

          <div style={closingRightStyle}>
            <div style={closingBalanceStyle}>
              Closing Balance

              <strong>
                KES{" "}
                {money(
                  report?.closing_balance
                )}
              </strong>
            </div>

            <button
              type="button"
              onClick={
                closeAccountantDay
              }
              disabled={
                closingDay ||
                reportClosed ||
                !report ||
                hasCarriedForward
              }
              style={{
                ...closeDayButtonStyle,

                opacity:
                  closingDay ||
                  reportClosed ||
                  !report ||
                  hasCarriedForward
                    ? 0.6
                    : 1,
              }}
            >
              {reportClosed
                ? "DAY CLOSED ✓"
                : closingDay
                ? "Closing..."
                : hasCarriedForward
                ? "RESOLVE CARRIED FORWARD FIRST"
                : "Close Accountant Day"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
// ==================================================
// SUMMARY CARD
// ==================================================

function SummaryCard({
  label,
  value,
  strong = false,
}) {
  return (
    <div
      style={{
        ...summaryCardStyle,

        ...(strong
          ? summaryStrongStyle
          : {}),
      }}
    >
      <div style={summaryLabelStyle}>
        {label}
      </div>

      <div
        style={{
          ...summaryValueStyle,

          ...(strong
            ? summaryStrongValueStyle
            : {}),
        }}
      >
        {value}
      </div>
    </div>
  );
}

// ==================================================
// TRANSACTION DETAIL
// ==================================================

function TransactionDetail({
  label,
  value,
  strong = false,
}) {
  return (
    <div style={transactionDetailStyle}>
      <span>
        {label}
      </span>

      <strong
        style={
          strong
            ? transactionStrongStyle
            : undefined
        }
      >
        {value}
      </strong>
    </div>
  );
}

// ==================================================
// TABLE HELPERS
// ==================================================

function TableHead({
  children,
  right = false,
}) {
  return (
    <th
      style={{
        ...tableHeadStyle,

        textAlign:
          right
            ? "right"
            : "left",
      }}
    >
      {children}
    </th>
  );
}

function TableCell({
  children,
  right = false,
}) {
  return (
    <td
      style={{
        ...tableCellStyle,

        textAlign:
          right
            ? "right"
            : "left",
      }}
    >
      {children}
    </td>
  );
}

function StatusText({
  status,
}) {
  const normalized =
    String(
      status ||
        ""
    )
      .trim()
      .toUpperCase();

  let backgroundColor =
    "#e2e8f0";

  let color =
    "#334155";

  if (
    normalized ===
    "COMPLETED"
  ) {
    backgroundColor =
      "#dcfce7";

    color =
      "#166534";
  } else if (
    normalized ===
      "CREATED" ||
    normalized ===
      "AWAITING_ACCOUNTANT_CONFIRMATION" ||
    normalized ===
      "PENDING_MANUAL_SEND" ||
    normalized ===
      "PENDING_MPESA" ||
    normalized ===
      "CHECKING"
  ) {
    backgroundColor =
      "#fef3c7";

    color =
      "#92400e";
  } else if (
    normalized ===
      "FAILED" ||
    normalized ===
      "CANCELLED"
  ) {
    backgroundColor =
      "#fee2e2";

    color =
      "#991b1b";
  } else if (
    normalized ===
    "REVERSED"
  ) {
    backgroundColor =
      "#e0e7ff";

    color =
      "#3730a3";
  }

  return (
    <span
      style={{
        ...statusTextStyle,
        backgroundColor,
        color,
      }}
    >
      {friendlyStatus(
        normalized
      )}
    </span>
  );
}

// ==================================================
// PAYMENT ROUTE HELPERS
// ==================================================

function normalizeFloatSendMethod(
  value
) {
  const clean =
    String(
      value ||
        ""
    )
      .trim()
      .toUpperCase();

  const compact =
    clean.replace(
      /[^A-Z0-9]/g,
      ""
    );

  if (
    clean ===
      "IM_TO_MPESA" ||
    compact ===
      "IMTOMPESA"
  ) {
    return "IM_TO_MPESA";
  }

  return "MPESA_TO_MPESA";
}

function getAccountantSendRoute(
  transaction,
  fallbackMethod
) {
  const method =
    normalizeFloatSendMethod(
      transaction?.float_send_method ||
        transaction?.payment_method ||
        transaction?.send_method ||
        fallbackMethod
    );

  if (
    method ===
    "IM_TO_MPESA"
  ) {
    return {
      code:
        "IM_TO_MPESA",

      isIm:
        true,

      routeTitle:
        "I&M → M-PESA",

      feeTitle:
        "I&M → M-PESA FEE",

      receiptLabel:
        "I&M Transaction / Reference",

      confirmButton:
        "Confirm I&M → M-Pesa Sent",
    };
  }

  return {
    code:
      "MPESA_TO_MPESA",

    isIm:
      false,

    routeTitle:
      "M-PESA → M-PESA",

    feeTitle:
      "M-PESA FEE",

    receiptLabel:
      "M-Pesa Receipt",

    confirmButton:
      "Confirm M-Pesa Sent",
  };
}

// ==================================================
// HELPERS
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

function money(
  value
) {
  return Number(
    value ||
      0
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

function roundMoney(
  value
) {
  return (
    Math.round(
      (
        Number(
          value
        ) +
        Number.EPSILON
      ) *
        100
    ) /
    100
  );
}

function maskPhone(
  value
) {
  const phone =
    String(
      value ||
        ""
    );

  if (
    phone.length <
    8
  ) {
    return "****";
  }

  return (
    phone.slice(
      0,
      5
    ) +
    "****" +
    phone.slice(
      -3
    )
  );
}

function formatPhoneForDisplay(
  value
) {
  const phone =
    String(
      value ||
        ""
    );

  if (
    phone.startsWith(
      "254"
    ) &&
    phone.length ===
      12
  ) {
    return (
      "0" +
      phone.slice(
        3
      )
    );
  }

  return phone || "-";
}

function formatDateTime(
  value
) {
  if (
    !value
  ) {
    return "-";
  }

  try {
    return new Intl.DateTimeFormat(
      "en-KE",
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

        hourCycle:
          "h23",
      }
    ).format(
      new Date(
        value
      )
    );
  } catch {
    return value;
  }
}

function nairobiDateKey(
  value
) {
  if (
    !value
  ) {
    return "";
  }

  try {
    const parts =
      new Intl.DateTimeFormat(
        "en-US",
        {
          timeZone:
            "Africa/Nairobi",

          year:
            "numeric",

          month:
            "2-digit",

          day:
            "2-digit",
        }
      ).formatToParts(
        new Date(
          value
        )
      );

    const year =
      parts.find(
        (part) =>
          part.type ===
          "year"
      )?.value;

    const month =
      parts.find(
        (part) =>
          part.type ===
          "month"
      )?.value;

    const day =
      parts.find(
        (part) =>
          part.type ===
          "day"
      )?.value;

    if (
      !year ||
      !month ||
      !day
    ) {
      return "";
    }

    return `${year}-${month}-${day}`;
  } catch {
    return "";
  }
}

function friendlyStatus(
  value
) {
  switch (
    value
  ) {
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

// ==================================================
// STYLES
// ==================================================

const pageStyle = {
  minHeight:
    "100vh",

  backgroundColor:
    "#eef2f7",

  fontFamily:
    "Arial, sans-serif",

  color:
    "#0f172a",
};

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
    "#eef2f7",

  fontFamily:
    "Arial, sans-serif",

  fontWeight:
    "bold",
};

const headerStyle = {
  minHeight:
    "72px",

  background:
    "linear-gradient(90deg,#064e3b,#0f766e)",

  color:
    "white",

  padding:
    "10px 22px",

  display:
    "flex",

  justifyContent:
    "space-between",

  alignItems:
    "center",

  boxSizing:
    "border-box",

  gap:
    "20px",
};

const brandStyle = {
  fontWeight:
    "900",

  fontSize:
    "21px",
};

const sloganStyle = {
  marginTop:
    "4px",

  fontSize:
    "9px",

  letterSpacing:
    "2px",

  color:
    "#ccfbf1",
};

const headerRightStyle = {
  display:
    "flex",

  alignItems:
    "center",

  gap:
    "10px",

  flexWrap:
    "wrap",

  justifyContent:
    "flex-end",
};

const welcomeStyle = {
  display:
    "flex",

  flexDirection:
    "column",

  alignItems:
    "flex-end",

  fontSize:
    "11px",

  gap:
    "2px",

  marginRight:
    "8px",
};

const refreshButtonStyle = {
  border:
    "1px solid rgba(255,255,255,0.45)",

  borderRadius:
    "5px",

  padding:
    "8px 12px",

  backgroundColor:
    "transparent",

  color:
    "white",

  fontWeight:
    "bold",

  cursor:
    "pointer",
};

const logoutButtonStyle = {
  border:
    "none",

  borderRadius:
    "5px",

  padding:
    "8px 13px",

  backgroundColor:
    "#e11d48",

  color:
    "white",

  fontWeight:
    "bold",

  cursor:
    "pointer",
};

const contentStyle = {
  width:
    "100%",

  maxWidth:
    "1450px",

  margin:
    "0 auto",

  padding:
    "20px",

  boxSizing:
    "border-box",
};

const panelStyle = {
  backgroundColor:
    "white",

  border:
    "1px solid #cbd5e1",

  borderRadius:
    "8px",

  padding:
    "16px",

  marginBottom:
    "16px",

  boxShadow:
    "0 2px 8px rgba(15,23,42,0.05)",
};

const panelHeaderStyle = {
  display:
    "flex",

  justifyContent:
    "space-between",

  alignItems:
    "center",

  gap:
    "12px",

  marginBottom:
    "14px",
};

const panelTitleStyle = {
  fontSize:
    "14px",

  fontWeight:
    "900",

  color:
    "#0f172a",
};

const panelSubtitleStyle = {
  marginTop:
    "3px",

  fontSize:
    "10px",

  color:
    "#64748b",
};

const routeBadgeStyle = {
  backgroundColor:
    "#0f766e",

  color:
    "white",

  padding:
    "6px 10px",

  borderRadius:
    "20px",

  fontSize:
    "9px",

  fontWeight:
    "900",

  whiteSpace:
    "nowrap",
};

const statusBadgeStyle = {
  color:
    "white",

  padding:
    "6px 10px",

  borderRadius:
    "20px",

  fontWeight:
    "bold",

  fontSize:
    "10px",
};

const countBadgeStyle = {
  backgroundColor:
    "#0f766e",

  color:
    "white",

  padding:
    "6px 10px",

  borderRadius:
    "20px",

  fontSize:
    "10px",

  fontWeight:
    "bold",
};

const summaryGridStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "repeat(auto-fit,minmax(165px,1fr))",

  gap:
    "10px",
};

const summaryCardStyle = {
  border:
    "1px solid #e2e8f0",

  borderRadius:
    "6px",

  padding:
    "12px",

  backgroundColor:
    "#f8fafc",
};

const summaryStrongStyle = {
  backgroundColor:
    "#ecfdf5",

  border:
    "1px solid #86efac",
};

const summaryLabelStyle = {
  color:
    "#64748b",

  fontSize:
    "9px",

  fontWeight:
    "bold",

  marginBottom:
    "6px",
};

const summaryValueStyle = {
  fontSize:
    "15px",

  fontWeight:
    "bold",

  color:
    "#0f172a",
};

const summaryStrongValueStyle = {
  color:
    "#166534",

  fontSize:
    "17px",
};

const bfNoticeStyle = {
  marginTop:
    "12px",

  padding:
    "9px",

  backgroundColor:
    "#f8fafc",

  color:
    "#64748b",

  borderRadius:
    "5px",

  fontSize:
    "10px",

  textAlign:
    "center",
};

const formGridStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "repeat(auto-fit,minmax(240px,1fr))",

  gap:
    "12px",
};

const labelStyle = {
  display:
    "block",

  marginBottom:
    "5px",

  fontSize:
    "11px",

  fontWeight:
    "bold",
};

const inputStyle = {
  width:
    "100%",

  boxSizing:
    "border-box",

  padding:
    "10px",

  border:
    "1px solid #94a3b8",

  borderRadius:
    "5px",

  backgroundColor:
    "white",

  fontSize:
    "13px",
};

const recipientPreviewStyle = {
  marginTop:
    "10px",

  padding:
    "9px",

  backgroundColor:
    "#f0fdfa",

  color:
    "#115e59",

  border:
    "1px solid #99f6e4",

  borderRadius:
    "5px",

  fontSize:
    "11px",
};

const idleNoteStyle = {
  marginTop:
    "8px",

  padding:
    "7px 9px",

  backgroundColor:
    "#f8fafc",

  color:
    "#64748b",

  borderRadius:
    "5px",

  fontSize:
    "9px",
};

const declinedTransferStyle = {
  marginTop:
    "12px",

  padding:
    "12px",

  backgroundColor:
    "#fef2f2",

  border:
    "2px solid #dc2626",

  color:
    "#991b1b",

  borderRadius:
    "6px",

  fontSize:
    "11px",

  fontWeight:
    "bold",
};

const declinedTransferTitleStyle = {
  marginBottom:
    "6px",

  fontSize:
    "12px",

  fontWeight:
    "900",

  color:
    "#b91c1c",
};

const primaryButtonStyle = {
  marginTop:
    "12px",

  padding:
    "10px 16px",

  border:
    "none",

  borderRadius:
    "5px",

  backgroundColor:
    "#0f766e",

  color:
    "white",

  fontWeight:
    "bold",

  cursor:
    "pointer",
};

const preparedTransferStyle = {
  marginTop:
    "14px",

  padding:
    "14px",

  border:
    "2px solid #0f766e",

  borderRadius:
    "7px",

  backgroundColor:
    "#f0fdfa",
};

const preparedTopStyle = {
  display:
    "flex",

  justifyContent:
    "space-between",

  alignItems:
    "center",

  gap:
    "10px",

  marginBottom:
    "10px",

  flexWrap:
    "wrap",
};

const preparedTitleStyle = {
  color:
    "#115e59",

  fontWeight:
    "900",

  fontSize:
    "12px",
};

const preparedCountdownStyle = {
  padding:
    "5px 8px",

  borderRadius:
    "12px",

  backgroundColor:
    "#fef3c7",

  color:
    "#92400e",

  fontSize:
    "8px",

  fontWeight:
    "900",

  whiteSpace:
    "nowrap",
};

const transactionDetailStyle = {
  display:
    "flex",

  justifyContent:
    "space-between",

  gap:
    "14px",

  padding:
    "7px 0",

  borderBottom:
    "1px solid #ccfbf1",

  fontSize:
    "11px",
};

const transactionStrongStyle = {
  color:
    "#166534",

  fontSize:
    "13px",
};

const sendInstructionStyle = {
  margin:
    "12px 0",

  padding:
    "10px",

  backgroundColor:
    "#fef3c7",

  color:
    "#92400e",

  borderRadius:
    "5px",

  lineHeight:
    "1.5",

  fontSize:
    "11px",
};

const completeButtonStyle = {
  marginTop:
    "10px",

  width:
    "100%",

  padding:
    "11px",

  border:
    "none",

  borderRadius:
    "5px",

  backgroundColor:
    "#15803d",

  color:
    "white",

  fontWeight:
    "bold",

  cursor:
    "pointer",
};

const cancelPreparedButtonStyle = {
  marginTop:
    "8px",

  width:
    "100%",

  padding:
    "10px",

  border:
    "none",

  borderRadius:
    "5px",

  backgroundColor:
    "#dc2626",

  color:
    "white",

  fontWeight:
    "bold",

  cursor:
    "pointer",
};

const preparedSafetyNoteStyle = {
  marginTop:
    "8px",

  padding:
    "8px",

  borderRadius:
    "5px",

  backgroundColor:
    "#fff7ed",

  color:
    "#9a3412",

  fontSize:
    "9px",

  lineHeight:
    "1.4",
};

const pendingNoticeStyle = {
  marginTop:
    "12px",

  padding:
    "10px",

  backgroundColor:
    "#fff7ed",

  border:
    "1px solid #fed7aa",

  color:
    "#9a3412",

  borderRadius:
    "5px",

  fontSize:
    "10px",
};

const pendingNoticeTextStyle = {
  marginTop:
    "4px",
};

const pendingSendListStyle = {
  display:
    "grid",

  gap:
    "6px",

  marginTop:
    "9px",
};

const pendingSendRowStyle = {
  display:
    "flex",

  justifyContent:
    "space-between",

  alignItems:
    "center",

  gap:
    "10px",

  padding:
    "8px",

  backgroundColor:
    "white",

  border:
    "1px solid #fed7aa",

  borderRadius:
    "5px",
};

const pendingSendMetaStyle = {
  marginTop:
    "3px",

  fontSize:
    "9px",

  color:
    "#9a3412",
};

const cancelSmallButtonStyle = {
  border:
    "none",

  borderRadius:
    "4px",

  padding:
    "7px 10px",

  backgroundColor:
    "#dc2626",

  color:
    "white",

  fontSize:
    "9px",

  fontWeight:
    "bold",

  cursor:
    "pointer",
};

const tableWrapStyle = {
  overflowX:
    "auto",
};

const tableStyle = {
  width:
    "100%",

  borderCollapse:
    "collapse",

  minWidth:
    "850px",
};

const tableHeadStyle = {
  padding:
    "8px",

  borderBottom:
    "2px solid #cbd5e1",

  backgroundColor:
    "#f8fafc",

  color:
    "#475569",

  fontSize:
    "9px",

  whiteSpace:
    "nowrap",
};

const tableCellStyle = {
  padding:
    "9px 8px",

  borderBottom:
    "1px solid #e2e8f0",

  fontSize:
    "10px",

  whiteSpace:
    "nowrap",
};

const statusTextStyle = {
  display:
    "inline-block",

  padding:
    "4px 7px",

  borderRadius:
    "12px",

  fontSize:
    "8px",

  fontWeight:
    "bold",

  whiteSpace:
    "nowrap",
};

const smallConfirmButtonStyle = {
  border:
    "none",

  borderRadius:
    "4px",

  padding:
    "7px 9px",

  backgroundColor:
    "#15803d",

  color:
    "white",

  fontSize:
    "9px",

  fontWeight:
    "bold",

  cursor:
    "pointer",
};

const mutedSmallStyle = {
  color:
    "#94a3b8",

  fontSize:
    "9px",
};

const emptyStyle = {
  padding:
    "18px",

  textAlign:
    "center",

  color:
    "#64748b",

  backgroundColor:
    "#f8fafc",

  borderRadius:
    "5px",

  fontSize:
    "11px",
};

const expensesGridStyle = {
  display:
    "grid",

  gap:
    "6px",
};

const expenseRowStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "85px minmax(180px,1fr) 150px 80px",

  gap:
    "8px",

  alignItems:
    "center",

  border:
    "1px solid #e2e8f0",

  borderRadius:
    "5px",

  padding:
    "7px",

  minWidth:
    "620px",
};

const expenseNumberStyle = {
  fontSize:
    "10px",

  fontWeight:
    "bold",

  color:
    "#475569",
};

const expenseInputStyle = {
  padding:
    "8px",

  border:
    "1px solid #94a3b8",

  borderRadius:
    "4px",

  fontSize:
    "11px",
};

const expenseAmountInputStyle = {
  padding:
    "8px",

  border:
    "1px solid #94a3b8",

  borderRadius:
    "4px",

  fontSize:
    "11px",
};

const smallSaveButtonStyle = {
  padding:
    "8px",

  border:
    "none",

  borderRadius:
    "4px",

  backgroundColor:
    "#0f766e",

  color:
    "white",

  fontSize:
    "9px",

  fontWeight:
    "bold",

  cursor:
    "pointer",
};

const savedExpenseDescriptionStyle = {
  fontSize:
    "10px",

  color:
    "#166534",

  fontWeight:
    "bold",
};

const savedExpenseAmountStyle = {
  fontSize:
    "10px",

  color:
    "#166534",

  textAlign:
    "right",

  fontWeight:
    "bold",
};

const lockedExpenseStyle = {
  gridColumn:
    "2 / 5",

  color:
    "#94a3b8",

  fontSize:
    "9px",

  fontWeight:
    "bold",
};

const closingPanelStyle = {
  backgroundColor:
    "#0f172a",

  color:
    "white",

  borderRadius:
    "8px",

  padding:
    "18px",

  display:
    "flex",

  justifyContent:
    "space-between",

  alignItems:
    "center",

  gap:
    "20px",

  flexWrap:
    "wrap",

  marginBottom:
    "20px",
};

const closingTitleStyle = {
  fontSize:
    "14px",

  fontWeight:
    "900",
};

const closingTextStyle = {
  marginTop:
    "5px",

  color:
    "#cbd5e1",

  fontSize:
    "10px",
};

const closingRightStyle = {
  display:
    "flex",

  alignItems:
    "center",

  gap:
    "14px",

  flexWrap:
    "wrap",
};

const closingBalanceStyle = {
  display:
    "flex",

  flexDirection:
    "column",

  gap:
    "3px",

  fontSize:
    "9px",

  color:
    "#cbd5e1",
};

const closeDayButtonStyle = {
  padding:
    "10px 15px",

  border:
    "none",

  borderRadius:
    "5px",

  backgroundColor:
    "#dc2626",

  color:
    "white",

  fontWeight:
    "bold",

  cursor:
    "pointer",
};

const errorStyle = {
  marginBottom:
    "12px",

  padding:
    "10px",

  borderRadius:
    "5px",

  backgroundColor:
    "#fef2f2",

  border:
    "1px solid #fecaca",

  color:
    "#991b1b",

  fontSize:
    "11px",
};

const successStyle = {
  marginBottom:
    "12px",

  padding:
    "10px",

  borderRadius:
    "5px",

  backgroundColor:
    "#f0fdf4",

  border:
    "1px solid #86efac",

  color:
    "#166534",

  fontSize:
    "11px",
};

const warningStyle = {
  marginBottom:
    "12px",

  padding:
    "12px",

  borderRadius:
    "5px",

  backgroundColor:
    "#fffbeb",

  border:
    "1px solid #fde68a",

  color:
    "#92400e",

  fontSize:
    "11px",
};

const warningTextStyle = {
  marginTop:
    "5px",
};

const carriedForwardPanelStyle = {
  backgroundColor:
    "#fff7ed",

  border:
    "2px solid #f97316",

  borderRadius:
    "8px",

  padding:
    "16px",

  marginBottom:
    "16px",

  boxShadow:
    "0 2px 8px rgba(154,52,18,0.08)",
};

const carriedForwardHeaderStyle = {
  display:
    "flex",

  justifyContent:
    "space-between",

  alignItems:
    "center",

  gap:
    "12px",

  marginBottom:
    "10px",

  flexWrap:
    "wrap",
};

const carriedForwardTitleStyle = {
  color:
    "#9a3412",

  fontSize:
    "14px",

  fontWeight:
    "900",
};

const carriedForwardSubtitleStyle = {
  marginTop:
    "4px",

  color:
    "#c2410c",

  fontSize:
    "10px",
};

const carriedForwardBadgeStyle = {
  backgroundColor:
    "#ea580c",

  color:
    "white",

  borderRadius:
    "20px",

  padding:
    "6px 10px",

  fontSize:
    "9px",

  fontWeight:
    "900",
};

const carriedForwardNoticeStyle = {
  padding:
    "9px",

  marginBottom:
    "12px",

  backgroundColor:
    "#ffedd5",

  color:
    "#9a3412",

  borderRadius:
    "5px",

  fontSize:
    "10px",

  fontWeight:
    "bold",
};

const activityLockedStyle = {
  marginBottom:
    "12px",

  padding:
    "10px",

  backgroundColor:
    "#fff7ed",

  border:
    "1px solid #fdba74",

  borderRadius:
    "5px",

  color:
    "#9a3412",

  fontSize:
    "10px",

  fontWeight:
    "bold",
};

const cancelTransactionButtonStyle = {
  border:
    "none",

  borderRadius:
    "4px",

  padding:
    "7px 9px",

  backgroundColor:
    "#dc2626",

  color:
    "white",

  fontSize:
    "9px",

  fontWeight:
    "bold",

  cursor:
    "pointer",
};
