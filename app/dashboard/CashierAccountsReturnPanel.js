"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

// ==================================================
// TEAM LEGEND / NYIKA
// CASHIER ACCOUNTS RETURN PANEL
// PROFESSIONAL NAVY DESIGN
//
// Existing financial workflow preserved:
//
// - Maximum 3 Float Return positions
// - Supabase transaction fee calculation
// - 30-second unused amount reset
// - 30-second prepared return auto-cancel
// - M-Pesa / I&M routing
// - Manual M-Pesa receipt confirmation
// - Accountant final confirmation
// - Automatic dashboard refresh
// - Transaction history
//
// No direct financial posting from the browser.
// ==================================================

const AUTO_RESET_MS = 30000;

export default function CashierAccountsReturnPanel({
  user,
  currentShift,
  onReturnChanged,
}) {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const accessToken =
    user?.access_token || null;

  const shiftId =
    currentShift?.id || null;

  const shiftStatus = String(
    currentShift?.status || ""
  ).trim().toUpperCase();

  const shiftClosed =
    shiftStatus === "CLOSED" ||
    shiftStatus === "COMPLETED";

  // ==================================================
  // STATE
  // ==================================================

  const [amount, setAmount] = useState("");
  const [feePreview, setFeePreview] = useState(0);
  const [feeLoading, setFeeLoading] = useState(false);
  const [preparing, setPreparing] = useState(false);

  const [preparedReturn, setPreparedReturn] =
    useState(null);

  const [receipt, setReceipt] = useState("");

  const [
    submittingReceipt,
    setSubmittingReceipt,
  ] = useState(false);

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] =
    useState(true);

  const [historyOpen, setHistoryOpen] =
    useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] =
    useState("");

  const [secondsLeft, setSecondsLeft] =
    useState(30);

  const completionSignatureRef = useRef(null);
  const cancelInFlightRef = useRef(false);
  const preparedTimeoutRef = useRef(null);
  const preparedIntervalRef = useRef(null);

  // ==================================================
  // PREPARED RETURN TIMER CLEANUP
  // ==================================================

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

  // ==================================================
  // SUPABASE AUTH
  // ==================================================

  const authHeaders = useCallback(
    () => ({
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    }),
    [supabaseAnonKey, accessToken]
  );

  const callRpc = useCallback(
    async (functionName, body = {}) => {
      if (
        !supabaseUrl ||
        !supabaseAnonKey ||
        !accessToken
      ) {
        throw new Error(
          "Cashier session is incomplete. Please log in again."
        );
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
    [
      supabaseUrl,
      supabaseAnonKey,
      accessToken,
      authHeaders,
    ]
  );

  // ==================================================
  // LOAD RETURN HISTORY
  // ==================================================

  const loadHistory = useCallback(
    async ({ silent = false } = {}) => {
      if (!shiftId || !accessToken) {
        setHistory([]);
        setHistoryLoading(false);
        return;
      }

      try {
        if (!silent) {
          setHistoryLoading(true);
        }

        const result = await callRpc(
          "tl_cashier_return_history",
          {
            p_shift_id: shiftId,
          }
        );

        const rows = Array.isArray(result)
          ? result
          : [];

        setHistory(rows);

        // ------------------------------------------
        // RESTORE UNFINISHED MANUAL SEND
        // ------------------------------------------

        const pendingSend = rows.find(
          (item) =>
            String(item?.status || "")
              .trim()
              .toUpperCase() ===
            "PENDING_MANUAL_SEND"
        );

        setPreparedReturn((previous) => {
          if (previous?.transaction_id) {
            const existingRow = rows.find(
              (item) =>
                String(item.id) ===
                  String(previous.transaction_id) &&
                String(item.status || "")
                  .trim()
                  .toUpperCase() ===
                  "PENDING_MANUAL_SEND"
            );

            if (existingRow) {
              return {
                ...previous,

                collection_method:
                  previous.collection_method ||
                  existingRow.collection_method ||
                  null,

                company_account_name:
                  previous.company_account_name ||
                  existingRow.company_account_name ||
                  null,

                company_account_type:
                  previous.company_account_type ||
                  existingRow.company_account_type ||
                  null,

                account_reference:
                  previous.account_reference ||
                  existingRow.account_reference ||
                  null,

                paybill_number:
                  previous.paybill_number ||
                  existingRow.paybill_number ||
                  null,

                bank_account_number:
                  previous.bank_account_number ||
                  existingRow.bank_account_number ||
                  null,

                created_at:
                  previous.created_at ||
                  existingRow.created_at ||
                  null,
              };
            }
          }

          if (pendingSend) {
            return {
              transaction_id: pendingSend.id,
              transaction_no:
                pendingSend.transaction_no,

              status: pendingSend.status,
              return_slot: pendingSend.return_slot,
              amount: pendingSend.amount,
              estimated_fee: pendingSend.estimated_fee,

              cashier_total_expected_deduction:
                roundMoney(
                  Number(pendingSend.amount ?? 0) +
                    Number(
                      pendingSend.estimated_fee ?? 0
                    )
                ),

              company_destination:
                pendingSend.company_destination,

              company_account_name:
                pendingSend.company_account_name || null,

              company_account_type:
                pendingSend.company_account_type || null,

              account_reference:
                pendingSend.account_reference || null,

              collection_method:
                pendingSend.collection_method || null,

              paybill_number:
                pendingSend.paybill_number || null,

              bank_account_number:
                pendingSend.bank_account_number || null,

              created_at:
                pendingSend.created_at || null,
            };
          }

          return null;
        });

        // ------------------------------------------
        // DETECT NEWLY COMPLETED RETURNS
        // ------------------------------------------

        const completedSignature = rows
          .filter(
            (item) =>
              String(item?.status || "")
                .trim()
                .toUpperCase() === "COMPLETED"
          )
          .map(
            (item) =>
              `${item.id}:${
                item.completed_at ||
                item.updated_at ||
                ""
              }`
          )
          .sort()
          .join("|");

        if (
          completionSignatureRef.current === null
        ) {
          completionSignatureRef.current =
            completedSignature;
        } else if (
          completionSignatureRef.current !==
          completedSignature
        ) {
          completionSignatureRef.current =
            completedSignature;

          if (
            typeof onReturnChanged === "function"
          ) {
            onReturnChanged();
          }
        }
      } catch (error) {
        console.error(
          "CASHIER RETURN HISTORY ERROR:",
          error
        );

        if (!silent) {
          setMessage(
            error?.message ||
              "Unable to load return transactions."
          );
          setMessageType("error");
        }
      } finally {
        if (!silent) {
          setHistoryLoading(false);
        }
      }
    },
    [
      shiftId,
      accessToken,
      callRpc,
      onReturnChanged,
    ]
  );

  // ==================================================
  // LIVE HISTORY REFRESH — EVERY 5 SECONDS
  // ==================================================

  useEffect(() => {
    loadHistory();

    const timer = setInterval(() => {
      loadHistory({ silent: true });
    }, 5000);

    return () => {
      clearInterval(timer);
    };
  }, [loadHistory]);

  // ==================================================
  // RETURN POSITIONS USED
  // ==================================================

  const activeHistory = useMemo(
    () =>
      history.filter((item) => {
        const status = String(
          item?.status || ""
        ).trim().toUpperCase();

        return ![
          "FAILED",
          "CANCELLED",
          "REVERSED",
        ].includes(status);
      }),
    [history]
  );

  const returnPositionsUsed =
    activeHistory.length;

  const allReturnPositionsUsed =
    returnPositionsUsed >= 3;

  // ==================================================
  // PENDING ACCOUNTANT CONFIRMATION
  // ==================================================

  const awaitingConfirmation = useMemo(
    () =>
      activeHistory.find(
        (item) =>
          String(item?.status || "")
            .trim()
            .toUpperCase() ===
          "AWAITING_ACCOUNTANT_CONFIRMATION"
      ) || null,
    [activeHistory]
  );

  const hasPendingReceipt = Boolean(
    preparedReturn?.transaction_id
  );

  const unresolvedTransaction =
    hasPendingReceipt ||
    Boolean(awaitingConfirmation);

  // ==================================================
  // CANCEL PENDING MANUAL RETURN
  // ==================================================

  const cancelPendingReturn = useCallback(
    async (
      transactionId,
      { automatic = false } = {}
    ) => {
      if (
        !transactionId ||
        !shiftId ||
        cancelInFlightRef.current
      ) {
        return;
      }

      cancelInFlightRef.current = true;
      clearPreparedTimers();

      try {
        await callRpc(
          "tl_cashier_cancel_pending_return",
          {
            p_transaction_id: transactionId,
            p_shift_id: shiftId,
          }
        );

        setPreparedReturn(null);
        setAmount("");
        setFeePreview(0);
        setReceipt("");
        setSecondsLeft(30);
        setHistoryOpen(false);

        if (automatic) {
          setMessage(
            "Unused float return cleared automatically after 30 seconds of inactivity."
          );
          setMessageType("success");
        }

        await loadHistory({ silent: true });

        if (
          typeof onReturnChanged === "function"
        ) {
          onReturnChanged();
        }
      } catch (error) {
        console.error(
          "CANCEL PENDING RETURN ERROR:",
          error
        );

        await loadHistory({ silent: true });

        const text = String(
          error?.message || ""
        ).toLowerCase();

        const statusChanged =
          text.includes("already changed") ||
          text.includes("no longer") ||
          text.includes("cannot be cancelled");

        if (automatic && !statusChanged) {
          setMessage(
            error?.message ||
              "Unable to clear the unused float return."
          );
          setMessageType("error");
        }
      } finally {
        cancelInFlightRef.current = false;
      }
    },
    [
      shiftId,
      callRpc,
      loadHistory,
      onReturnChanged,
      clearPreparedTimers,
    ]
  );

  // ==================================================
  // 30-SECOND UNUSED AMOUNT RESET
  // ==================================================

  useEffect(() => {
    if (
      amount === "" ||
      hasPendingReceipt ||
      preparing ||
      submittingReceipt
    ) {
      return;
    }

    const timer = setTimeout(() => {
      setAmount("");
      setFeePreview(0);

      setMessage(
        "Unused amount cleared automatically after 30 seconds of inactivity."
      );
      setMessageType("success");
    }, AUTO_RESET_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [
    amount,
    hasPendingReceipt,
    preparing,
    submittingReceipt,
  ]);

  // ==================================================
  // 30-SECOND PREPARED RETURN AUTO-CANCEL
  // ==================================================

  useEffect(() => {
    clearPreparedTimers();

    if (
      !hasPendingReceipt ||
      !preparedReturn?.transaction_id ||
      submittingReceipt
    ) {
      setSecondsLeft(30);
      return;
    }

    const transactionId =
      preparedReturn.transaction_id;

    const startedAt = Date.now();

    setSecondsLeft(30);

    preparedIntervalRef.current = setInterval(
      () => {
        const elapsed = Date.now() - startedAt;

        const remaining = Math.max(
          0,
          Math.ceil(
            (AUTO_RESET_MS - elapsed) / 1000
          )
        );

        setSecondsLeft(remaining);
      },
      1000
    );

    preparedTimeoutRef.current = setTimeout(
      () => {
        cancelPendingReturn(transactionId, {
          automatic: true,
        });
      },
      AUTO_RESET_MS
    );

    return () => {
      clearPreparedTimers();
    };
  }, [
    hasPendingReceipt,
    preparedReturn?.transaction_id,
    receipt,
    submittingReceipt,
    cancelPendingReturn,
    clearPreparedTimers,
  ]);

  // ==================================================
  // CLEAN UP PREPARED TIMERS
  // ==================================================

  useEffect(() => {
    return () => {
      clearPreparedTimers();
    };
  }, [clearPreparedTimers]);

  // ==================================================
  // LIVE TRANSACTION FEE PREVIEW
  // ==================================================

  useEffect(() => {
    const numericAmount = Number(amount);

    if (
      amount === "" ||
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0 ||
      hasPendingReceipt
    ) {
      setFeePreview(0);
      setFeeLoading(false);
      return;
    }

    let cancelled = false;

    const timer = setTimeout(async () => {
      try {
        setFeeLoading(true);

        const result = await callRpc(
          "tl_cashier_to_accountant_fee",
          {
            p_amount: roundMoney(numericAmount),
          }
        );

        if (cancelled) return;

        const fee = Number(result ?? 0);

        setFeePreview(
          Number.isFinite(fee)
            ? roundMoney(fee)
            : 0
        );
      } catch (error) {
        console.error(
          "RETURN FEE PREVIEW ERROR:",
          error
        );

        if (!cancelled) {
          setFeePreview(0);
        }
      } finally {
        if (!cancelled) {
          setFeeLoading(false);
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    amount,
    hasPendingReceipt,
    callRpc,
  ]);

  // ==================================================
  // PREVIEW AMOUNTS
  // ==================================================

  const previewAmount = hasPendingReceipt
    ? Number(preparedReturn?.amount ?? 0)
    : Number(amount || 0);

  const previewFee = hasPendingReceipt
    ? Number(preparedReturn?.estimated_fee ?? 0)
    : Number(feePreview ?? 0);

  const previewTotal = hasPendingReceipt
    ? Number(
        preparedReturn?.cashier_total_expected_deduction ??
          0
      )
    : roundMoney(
        previewAmount + previewFee
      );

  const preparedRoute = useMemo(
    () =>
      getCashierReturnRoute(preparedReturn),
    [preparedReturn]
  );

  // ==================================================
  // PREPARE FLOAT RETURN
  // ==================================================

  async function prepareReturn() {
    if (
      preparing ||
      unresolvedTransaction
    ) {
      return;
    }

    if (allReturnPositionsUsed) {
      setMessage(
        "This shift already has all 3 Float Return positions used."
      );
      setMessageType("error");
      return;
    }

    const numericAmount = Number(amount);

    if (
      amount === "" ||
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0
    ) {
      setMessage(
        "Enter a valid amount greater than zero."
      );
      setMessageType("error");
      return;
    }

    if (!shiftId) {
      setMessage("No open shift was found.");
      setMessageType("error");
      return;
    }

    try {
      setPreparing(true);
      setMessage("");
      setMessageType("");

      const result = await callRpc(
        "tl_cashier_prepare_manual_return",
        {
          p_shift_id: shiftId,
          p_amount: roundMoney(numericAmount),
          p_note: null,
        }
      );

      const prepared = {
        ...result,
        created_at:
          result?.created_at ||
          new Date().toISOString(),
      };

      setPreparedReturn(prepared);
      setReceipt("");
      setSecondsLeft(30);
      setHistoryOpen(true);

      const route =
        getCashierReturnRoute(prepared);

      if (route.isIm) {
        setMessage(
          "Return prepared. Confirm the I&M account name, send the exact amount, then enter the M-Pesa receipt number."
        );
      } else {
        setMessage(
          "Return prepared. Send the exact amount to the Legend Accounts M-Pesa number shown below, then enter the M-Pesa receipt number."
        );
      }

      setMessageType("success");

      await loadHistory({ silent: true });
    } catch (error) {
      console.error(
        "PREPARE CASHIER RETURN ERROR:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to prepare the return."
      );
      setMessageType("error");
    } finally {
      setPreparing(false);
    }
  }

  // ==================================================
  // SUBMIT M-PESA RECEIPT
  // ==================================================

  async function submitReceipt() {
    if (
      !preparedReturn?.transaction_id ||
      submittingReceipt
    ) {
      return;
    }

    const cleanReceipt = String(
      receipt || ""
    ).trim().toUpperCase();

    if (
      cleanReceipt.length < 6 ||
      cleanReceipt.length > 30 ||
      !/^[A-Z0-9]+$/.test(cleanReceipt)
    ) {
      setMessage(
        "Enter a valid M-Pesa receipt number using 6–30 letters or numbers."
      );
      setMessageType("error");
      return;
    }

    const route =
      getCashierReturnRoute(preparedReturn);

    const destinationText = route.isIm
      ? `I&M PayBill ${
          preparedReturn.paybill_number ||
          preparedReturn.company_destination ||
          "-"
        }, Account ${
          preparedReturn.bank_account_number ||
          preparedReturn.account_reference ||
          "-"
        }, Account Name ${
          preparedReturn.company_account_name ||
          "-"
        }`
      : `Legend Accounts M-Pesa ${formatPhone(
          preparedReturn.company_destination
        )}${
          preparedReturn.company_account_name
            ? `, Account Name ${preparedReturn.company_account_name}`
            : ""
        }`;

    const confirmed = window.confirm(
      `Confirm that you sent KES ${money(
        preparedReturn.amount
      )} to ${destinationText}.\n\n` +
        `M-Pesa receipt: ${cleanReceipt}\n\n` +
        "After this, Legend Accounts must confirm receiving the money."
    );

    if (!confirmed) return;

    clearPreparedTimers();

    try {
      setSubmittingReceipt(true);
      setMessage("");
      setMessageType("");

      const result = await callRpc(
        "tl_cashier_submit_return_receipt",
        {
          p_transaction_id:
            preparedReturn.transaction_id,

          p_receipt_no: cleanReceipt,
        }
      );

      setPreparedReturn(null);
      setAmount("");
      setFeePreview(0);
      setReceipt("");
      setSecondsLeft(30);
      setHistoryOpen(true);

      setMessage(
        `Receipt ${
          result?.receipt_no || cleanReceipt
        } submitted. Waiting for Legend Accounts to confirm receipt.`
      );

      setMessageType("success");

      await loadHistory({ silent: true });

      if (
        typeof onReturnChanged === "function"
      ) {
        onReturnChanged();
      }
    } catch (error) {
      console.error(
        "SUBMIT RETURN RECEIPT ERROR:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to submit the M-Pesa receipt."
      );
      setMessageType("error");
    } finally {
      setSubmittingReceipt(false);
    }
  }

  // ==================================================
  // DISPLAY
  // ==================================================

  if (!currentShift) {
    return null;
  }

  return (
    <section className="tl-float-return">
      <style>{floatReturnCss}</style>

      {/* ============================================
          HEADER
          ============================================ */}

      <div className="tl-float-header">
        <div className="tl-float-header-text">
          <div className="tl-float-heading">
            SEND FLOAT TO LEGEND ACCOUNTS
          </div>

          <div className="tl-float-subheading">
            Cashier → Legend Accounts
          </div>
        </div>

        <span className="tl-float-slot-badge">
          {returnPositionsUsed}/3 RETURNS
        </span>
      </div>

      <div className="tl-float-body">
        {/* SHIFT CLOSED */}

        {shiftClosed && (
          <div className="tl-float-alert warning">
            This shift is closed. No new return
            can be started.
          </div>
        )}

        {/* ALL RETURN SLOTS USED */}

        {allReturnPositionsUsed && (
          <div className="tl-float-alert warning">
            All 3 Float Return positions have been
            used for this shift.
          </div>
        )}

        {/* WAITING ACCOUNTANT */}

        {awaitingConfirmation &&
          !hasPendingReceipt && (
            <div className="tl-float-awaiting">
              <div className="tl-float-awaiting-heading">
                WAITING FOR LEGEND ACCOUNTS
              </div>

              <p>
                Return{" "}
                {awaitingConfirmation.return_slot || ""}{" "}
                for{" "}
                <strong>
                  KES{" "}
                  {money(
                    awaitingConfirmation.amount
                  )}
                </strong>{" "}
                is awaiting Accountant confirmation.
              </p>

              <p>
                M-Pesa receipt:{" "}
                <strong>
                  {awaitingConfirmation.manual_receipt_no ||
                    "-"}
                </strong>
              </p>

              <p>
                Once confirmed, the amount plus the
                applicable transaction fee will
                automatically appear in this
                shift&apos;s expenses.
              </p>
            </div>
          )}

        {/* AMOUNT INPUT */}

        <label className="tl-float-label">
          AMOUNT TO SEND (KES)
        </label>

        <input
          className="tl-float-input"
          type="number"
          min="0.01"
          step="0.01"
          value={
            hasPendingReceipt
              ? preparedReturn?.amount ?? ""
              : amount
          }
          disabled={
            shiftClosed ||
            allReturnPositionsUsed ||
            unresolvedTransaction ||
            preparing
          }
          onChange={(event) => {
            setAmount(event.target.value);
            setMessage("");
            setMessageType("");
          }}
          placeholder="Enter amount"
        />

        {!hasPendingReceipt &&
          amount !== "" && (
            <div className="tl-float-reset-note">
              Unused amount clears automatically
              after 30 seconds of inactivity.
            </div>
          )}

        {/* FINANCIAL PREVIEW */}

        <div className="tl-float-preview-grid">
          <PreviewBox
            title="AMOUNT TO ACCOUNTS"
            value={previewAmount}
          />

          <PreviewBox
            title={
              hasPendingReceipt
                ? preparedRoute.feeTitle
                : "TRANSACTION FEE"
            }
            value={previewFee}
            loading={feeLoading}
          />

          <PreviewBox
            title="TOTAL EXPENSE"
            value={previewTotal}
            strong
          />
        </div>

        {/* EXPENSE NOTICE */}

        <div className="tl-float-expense-notice">
          <span className="tl-float-notice-icon">
            ℹ
          </span>

          <span>
            After Legend Accounts confirms receiving
            the money,{" "}
            <strong>
              KES {money(previewTotal)}
            </strong>{" "}
            will be posted automatically as a
            cashier expense.
          </span>
        </div>

        {/* MESSAGE */}

        {message && (
          <div
            role="status"
            className={`tl-float-alert ${
              messageType === "success"
                ? "success"
                : "error"
            }`}
          >
            {message}
          </div>
        )}

        {/* PREPARE BUTTON */}

        {!hasPendingReceipt && (
          <button
            type="button"
            className="tl-float-primary-button"
            onClick={prepareReturn}
            disabled={
              preparing ||
              shiftClosed ||
              allReturnPositionsUsed ||
              unresolvedTransaction ||
              feeLoading
            }
          >
            {preparing
              ? "PREPARING..."
              : "PREPARE FLOAT RETURN"}
          </button>
        )}

        {/* ========================================
            PREPARED RETURN DETAILS
            ======================================== */}

        {hasPendingReceipt && (
          <div className="tl-float-prepared">
            <div className="tl-float-prepared-header">
              <strong>
                RETURN{" "}
                {preparedReturn.return_slot || ""}{" "}
                — {preparedRoute.routeTitle}
              </strong>

              <span className="tl-float-countdown">
                AUTO-CLOSE: {secondsLeft}s
              </span>
            </div>

            <div className="tl-float-prepared-warning">
              If no receipt is submitted, this
              unfinished return will cancel
              automatically after 30 seconds
              of inactivity.
            </div>

            <DetailRow
              label="Transaction"
              value={
                preparedReturn.transaction_no ||
                "-"
              }
            />

            {/* I&M DESTINATION */}

            {preparedRoute.isIm ? (
              <>
                <DetailRow
                  label="I&M PAYBILL"
                  value={
                    preparedReturn.paybill_number ||
                    preparedReturn.company_destination ||
                    "-"
                  }
                  strong
                />

                <DetailRow
                  label="I&M ACCOUNT NUMBER"
                  value={
                    preparedReturn.bank_account_number ||
                    preparedReturn.account_reference ||
                    "-"
                  }
                  strong
                />

                <DetailRow
                  label="BANK ACCOUNT NAME"
                  value={
                    preparedReturn.company_account_name ||
                    "-"
                  }
                  strong
                />

                {preparedReturn.account_reference &&
                  preparedReturn.bank_account_number &&
                  String(
                    preparedReturn.account_reference
                  ) !==
                    String(
                      preparedReturn.bank_account_number
                    ) && (
                    <DetailRow
                      label="REFERENCE"
                      value={
                        preparedReturn.account_reference
                      }
                    />
                  )}
              </>
            ) : (
              <>
                {/* M-PESA DESTINATION */}

                <DetailRow
                  label="M-PESA NUMBER"
                  value={formatPhone(
                    preparedReturn.company_destination
                  )}
                  strong
                />

                {preparedReturn.company_account_name && (
                  <DetailRow
                    label="ACCOUNT NAME"
                    value={
                      preparedReturn.company_account_name
                    }
                  />
                )}
              </>
            )}

            {/* PREPARED AMOUNTS */}

            <DetailRow
              label="Amount"
              value={`KES ${money(
                preparedReturn.amount
              )}`}
            />

            <DetailRow
              label={preparedRoute.feeTitle}
              value={`KES ${money(
                preparedReturn.estimated_fee
              )}`}
            />

            <DetailRow
              label="Total Expense After Confirmation"
              value={`KES ${money(
                preparedReturn.cashier_total_expected_deduction
              )}`}
              strong
            />

            {/* SEND INSTRUCTIONS */}

            <div className="tl-float-instructions">
              {preparedRoute.isIm ? (
                <>
                  Send exactly{" "}
                  <strong>
                    KES{" "}
                    {money(
                      preparedReturn.amount
                    )}
                  </strong>{" "}
                  from M-Pesa to I&M using
                  PayBill{" "}
                  <strong>
                    {preparedReturn.paybill_number ||
                      preparedReturn.company_destination ||
                      "-"}
                  </strong>{" "}
                  and Account Number{" "}
                  <strong>
                    {preparedReturn.bank_account_number ||
                      preparedReturn.account_reference ||
                      "-"}
                  </strong>
                  .

                  {preparedReturn.account_reference &&
                    preparedReturn.bank_account_number &&
                    String(
                      preparedReturn.account_reference
                    ) !==
                      String(
                        preparedReturn.bank_account_number
                      ) && (
                      <>
                        {" "}
                        Use reference{" "}
                        <strong>
                          {preparedReturn.account_reference}
                        </strong>
                        .
                      </>
                    )}

                  <div className="tl-float-name-check">
                    <strong>IMPORTANT:</strong>{" "}
                    Before completing payment, confirm
                    that the account name displayed
                    by M-Pesa matches{" "}
                    <strong>
                      {preparedReturn.company_account_name ||
                        "the bank account name shown above"}
                    </strong>
                    .
                  </div>

                  After M-Pesa confirms the transfer,
                  enter the receipt number below.
                </>
              ) : (
                <>
                  Send exactly{" "}
                  <strong>
                    KES{" "}
                    {money(
                      preparedReturn.amount
                    )}
                  </strong>{" "}
                  to Legend Accounts M-Pesa number{" "}
                  <strong>
                    {formatPhone(
                      preparedReturn.company_destination
                    )}
                  </strong>
                  .

                  {preparedReturn.company_account_name && (
                    <>
                      {" "}
                      Confirm the recipient name
                      matches{" "}
                      <strong>
                        {preparedReturn.company_account_name}
                      </strong>
                      .
                    </>
                  )}

                  {" "}
                  After M-Pesa confirms the transfer,
                  enter the receipt number below.
                </>
              )}
            </div>

            {/* RECEIPT ENTRY */}

            <label className="tl-float-label">
              M-PESA RECEIPT NUMBER
            </label>

            <input
              type="text"
              className="tl-float-input"
              value={receipt}
              disabled={submittingReceipt}
              onChange={(event) => {
                setReceipt(
                  event.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, "")
                );

                setMessage("");
                setMessageType("");
              }}
              maxLength={30}
              placeholder="e.g. TABC123XYZ"
              autoComplete="off"
            />

            <button
              type="button"
              className="tl-float-receipt-button"
              onClick={submitReceipt}
              disabled={submittingReceipt}
            >
              {submittingReceipt
                ? "SUBMITTING..."
                : "CONFIRM M-PESA SENT"}
            </button>
          </div>
        )}

        {/* ========================================
            TRANSACTION HISTORY
            ======================================== */}

        <button
          type="button"
          className="tl-float-history-toggle"
          onClick={() =>
            setHistoryOpen((previous) => !previous)
          }
          aria-expanded={historyOpen}
        >
          <span>
            {historyOpen ? "▲" : "▼"}
          </span>

          <span>
            TRANSACTIONS THIS SHIFT ({history.length})
          </span>
        </button>

        {historyOpen && (
          <div className="tl-float-history-wrap">
            {historyLoading ? (
              <div className="tl-float-empty">
                Loading transactions...
              </div>
            ) : history.length === 0 ? (
              <div className="tl-float-empty">
                No Cashier → Accounts transactions
                in this shift.
              </div>
            ) : (
              history.map((transaction) => (
                <HistoryRow
                  key={transaction.id}
                  transaction={transaction}
                />
              ))
            )}
          </div>
        )}
      </div>
    </section>
  );
}

// ==================================================
// PREVIEW BOX
// ==================================================

function PreviewBox({
  title,
  value,
  loading = false,
  strong = false,
}) {
  return (
    <div
      className={`tl-float-preview-box ${
        strong ? "strong" : ""
      }`}
    >
      <div className="tl-float-preview-title">
        {title}
      </div>

      <div className="tl-float-preview-value">
        {loading
          ? "..."
          : `KES ${money(value)}`}
      </div>
    </div>
  );
}

// ==================================================
// PREPARED TRANSACTION DETAIL
// ==================================================

function DetailRow({
  label,
  value,
  strong = false,
}) {
  return (
    <div className="tl-float-detail-row">
      <span>{label}</span>

      <strong
        className={
          strong
            ? "tl-float-detail-highlight"
            : ""
        }
      >
        {value}
      </strong>
    </div>
  );
}

// ==================================================
// TRANSACTION HISTORY ROW
// ==================================================

function HistoryRow({ transaction }) {
  const status = String(
    transaction?.status || ""
  ).trim().toUpperCase();

  const fee = Number(
    transaction?.actual_fee ??
      transaction?.estimated_fee ??
      0
  );

  const amount = Number(
    transaction?.amount ?? 0
  );

  const total = roundMoney(amount + fee);

  const statusTone =
    status === "COMPLETED"
      ? "completed"
      : status ===
        "AWAITING_ACCOUNTANT_CONFIRMATION"
      ? "waiting"
      : status === "PENDING_MANUAL_SEND"
      ? "pending"
      : "failed";

  return (
    <div className="tl-float-history-row">
      <div className="tl-float-history-top">
        <div>
          <strong>
            RETURN{" "}
            {transaction.return_slot || "-"}
          </strong>

          <div className="tl-float-transaction-no">
            {transaction.transaction_no || "-"}
          </div>
        </div>

        <span
          className={`tl-float-status ${statusTone}`}
        >
          {friendlyStatus(status)}
        </span>
      </div>

      <div className="tl-float-history-boxes">
        <HistoryValue
          title="AMOUNT"
          value={`KES ${money(amount)}`}
        />

        <HistoryValue
          title="FEE"
          value={`KES ${money(fee)}`}
        />

        <HistoryValue
          title="TOTAL"
          value={`KES ${money(total)}`}
        />
      </div>

      <div className="tl-float-history-bottom">
        <span>
          Receipt:{" "}
          <strong>
            {transaction.manual_receipt_no ||
              "Not submitted"}
          </strong>
        </span>

        <span>
          {formatDateTime(
            transaction.created_at
          )}
        </span>
      </div>
    </div>
  );
}

function HistoryValue({ title, value }) {
  return (
    <div className="tl-float-history-value">
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}

// ==================================================
// PAYMENT ROUTE HELPER — PRESERVED
// ==================================================

function getCashierReturnRoute(transaction) {
  const routeText = [
    transaction?.collection_method,
    transaction?.payment_method,
    transaction?.company_account_type,
    transaction?.company_account_name,
  ]
    .filter(Boolean)
    .join(" ")
    .toUpperCase();

  const normalized = routeText.replace(
    /[^A-Z0-9]/g,
    ""
  );

  const destination = String(
    transaction?.paybill_number ||
      transaction?.company_destination ||
      ""
  ).trim();

  const accountNumber = String(
    transaction?.bank_account_number ||
      transaction?.account_reference ||
      ""
  ).trim();

  const isIm =
    normalized.includes("MPESATOIM") ||
    normalized.includes("IMBANK") ||
    normalized.includes("IMPAYMENT") ||
    normalized.includes("IANDBANK") ||
    normalized === "IM" ||
    (
      accountNumber !== "" &&
      /^\d{5,7}$/.test(destination)
    );

  if (isIm) {
    return {
      code: "MPESA_TO_IM",
      isIm: true,
      routeTitle: "M-PESA → I&M",
      destinationLabel: "I&M PAYBILL",
      feeTitle: "M-PESA → I&M FEE",
    };
  }

  return {
    code: "MPESA_TO_MPESA",
    isIm: false,
    routeTitle: "M-PESA → M-PESA",
    destinationLabel: "M-PESA NUMBER",
    feeTitle: "M-PESA FEE",
  };
}

// ==================================================
// GENERAL HELPERS
// ==================================================

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function money(value) {
  const numeric = Number(value ?? 0);

  return (
    Number.isFinite(numeric) ? numeric : 0
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

function formatPhone(value) {
  const phone = String(value || "").trim();

  if (
    phone.startsWith("254") &&
    phone.length === 12
  ) {
    return "0" + phone.slice(3);
  }

  return phone || "-";
}

function formatDateTime(value) {
  if (!value) return "-";

  try {
    return new Intl.DateTimeFormat(
      "en-KE",
      {
        timeZone: "Africa/Nairobi",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }
    ).format(new Date(value));
  } catch {
    return "-";
  }
}

function friendlyStatus(status) {
  switch (status) {
    case "PENDING_MANUAL_SEND":
      return "SEND MONEY";

    case "AWAITING_ACCOUNTANT_CONFIRMATION":
      return "WAITING ACCOUNTS";

    case "COMPLETED":
      return "COMPLETED ✓";

    case "FAILED":
      return "FAILED";

    case "CANCELLED":
      return "CANCELLED";

    case "REVERSED":
      return "REVERSED";

    default:
      return status || "-";
  }
}

// ==================================================
// PROFESSIONAL NAVY / GOLD STYLES
//
// Adapts to one of the three equal dashboard
// columns without spanning the entire grid.
// ==================================================

const floatReturnCss = `
.tl-float-return {
  grid-column: auto;
  min-width: 0;
  width: 100%;
  box-sizing: border-box;

  container-type: inline-size;
  container-name: float-panel;

  background: #101f30;
  color: #f0f5fa;

  border: 1px solid #2a3d52;
  border-radius: 12px;
  overflow: hidden;

  box-shadow:
    0 8px 25px rgba(0,0,0,.12);

  font-family:
    Inter, ui-sans-serif, system-ui,
    -apple-system, BlinkMacSystemFont,
    "Segoe UI", sans-serif;
}

.tl-float-return * {
  box-sizing: border-box;
}

/* ==========================================
   HEADER
   ========================================== */

.tl-float-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;

  padding: 16px 17px;

  background: #152639;

  border-left:
    3px solid #d9b66c;

  border-bottom:
    1px solid #2a3d52;
}

.tl-float-header-text {
  min-width: 0;
}

.tl-float-heading {
  color: #f0f5fa;
  font-weight: 850;
  font-size: 14px;
  letter-spacing: .035em;
  line-height: 1.4;
}

.tl-float-subheading {
  margin-top: 5px;
  color: #91a5b8;
  font-size: 10px;
  font-weight: 650;
}

.tl-float-slot-badge {
  background: #0a1725;
  color: #d9b66c;

  border: 1px solid #65563b;
  border-radius: 7px;

  padding: 7px 9px;

  font-size: 10px;
  font-weight: 850;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

/* ==========================================
   BODY
   ========================================== */

.tl-float-body {
  padding: 15px;
  min-width: 0;
}

.tl-float-label {
  display: block;
  margin: 0 0 8px;

  color: #c4d0dc;
  font-size: 11px;
  font-weight: 850;
  letter-spacing: .04em;
}

.tl-float-input {
  display: block;

  width: 100%;
  min-width: 0;
  min-height: 44px;

  margin-bottom: 12px;
  padding: 11px 12px;

  background: #0a1725;
  color: #f0f5fa;

  border: 1px solid #40556b;
  border-radius: 8px;

  outline: none;
  font-family: inherit;
  font-size: 13px;
  font-weight: 750;
}

.tl-float-input:focus {
  border-color: #d9b66c;
  box-shadow:
    0 0 0 2px rgba(217,182,108,.12);
}

.tl-float-input::placeholder {
  color: #8297ac;
}

.tl-float-input:disabled {
  color: #9eafbf;
  background: #172638;
  cursor: not-allowed;
}

/* ==========================================
   30-SECOND RESET
   ========================================== */

.tl-float-reset-note {
  margin: -3px 0 12px;

  padding: 9px 10px;

  background: #0a1725;
  color: #aab9c9;

  border: 1px solid #2a3d52;
  border-radius: 7px;

  font-size: 10px;
  line-height: 1.5;
}

/* ==========================================
   AMOUNT / FEE / TOTAL
   ========================================== */

.tl-float-preview-grid {
  display: grid;

  grid-template-columns:
    repeat(3, minmax(0,1fr));

  gap: 8px;
  margin-bottom: 12px;
}

.tl-float-preview-box {
  min-width: 0;

  background: #0a1725;
  border: 1px solid #304359;
  border-radius: 8px;

  padding: 12px 8px;
  text-align: center;
}

.tl-float-preview-box.strong {
  background: #15352f;
  border-color: #307d6c;
}

.tl-float-preview-title {
  color: #91a5b8;

  font-size: 9px;
  font-weight: 850;

  letter-spacing: .03em;
  line-height: 1.4;

  overflow-wrap: anywhere;
}

.tl-float-preview-value {
  margin-top: 8px;

  color: #f0f5fa;

  font-size: 14px;
  font-weight: 850;

  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.tl-float-preview-box.strong
.tl-float-preview-value {
  color: #a8ebd1;
}

/* ==========================================
   EXPENSE NOTICE
   ========================================== */

.tl-float-expense-notice {
  display: flex;
  align-items: flex-start;
  gap: 9px;

  padding: 11px 12px;
  margin-bottom: 13px;

  color: #c4d0dc;
  background: #0a1725;

  border: 1px solid #2a3d52;
  border-radius: 8px;

  font-size: 11px;
  line-height: 1.6;
}

.tl-float-expense-notice strong {
  color: #f0f5fa;
}

.tl-float-notice-icon {
  display: inline-flex;
  justify-content: center;
  align-items: center;

  min-width: 18px;
  height: 18px;

  background: #193a53;
  border-radius: 50%;

  color: #7db8fa;
  font-size: 12px;
  font-weight: 900;
}

/* ==========================================
   ALERTS
   ========================================== */

.tl-float-alert {
  padding: 11px 12px;
  margin-bottom: 12px;

  border-radius: 8px;
  font-size: 11px;
  line-height: 1.6;
  font-weight: 750;

  overflow-wrap: anywhere;
}

.tl-float-alert.warning {
  background: #322a1d;
  border: 1px solid #695638;
  color: #ffe3a8;
}

.tl-float-alert.success {
  background: #10332e;
  border: 1px solid #2a6354;
  color: #a8ebd1;
}

.tl-float-alert.error {
  background: #38202a;
  border: 1px solid #774155;
  color: #ffc3ce;
}

/* ==========================================
   AWAITING ACCOUNTANT
   ========================================== */

.tl-float-awaiting {
  padding: 13px;
  margin-bottom: 13px;

  background: #322a1d;

  border: 1px solid #695638;
  border-radius: 9px;

  color: #f0e4c8;
  font-size: 11px;
  line-height: 1.6;
}

.tl-float-awaiting-heading {
  margin-bottom: 8px;

  color: #ffe3a8;
  font-weight: 850;
  font-size: 11px;
}

.tl-float-awaiting p {
  margin: 6px 0;
}

/* ==========================================
   ACTION BUTTONS
   ========================================== */

.tl-float-return button {
  font-family: inherit;
  cursor: pointer;
}

.tl-float-return button:disabled {
  opacity: .5;
  cursor: not-allowed;
}

.tl-float-primary-button,
.tl-float-receipt-button {
  width: 100%;
  min-height: 45px;

  padding: 11px 14px;

  color: #ffffff;
  background: #1c695d;

  border: 1px solid #2b8b7c;
  border-radius: 8px;

  font-size: 12px;
  font-weight: 850;

  letter-spacing: .03em;
  transition: background .15s ease;
}

.tl-float-primary-button {
  margin-bottom: 12px;
}

.tl-float-primary-button:not(:disabled):hover,
.tl-float-receipt-button:not(:disabled):hover {
  background: #258171;
}

/* ==========================================
   PREPARED FLOAT RETURN
   ========================================== */

.tl-float-prepared {
  min-width: 0;

  margin: 12px 0;
  padding: 13px;

  background: #132337;

  border: 1px solid #6a593a;
  border-radius: 10px;
}

.tl-float-prepared-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;

  margin-bottom: 10px;

  color: #f0f5fa;
  font-size: 12px;
  line-height: 1.5;
}

.tl-float-countdown {
  display: inline-block;

  padding: 6px 8px;

  background: #322a1d;
  color: #ffe3a8;

  border: 1px solid #695638;
  border-radius: 7px;

  font-size: 10px;
  font-weight: 850;
  white-space: nowrap;
}

.tl-float-prepared-warning {
  padding: 10px;
  margin-bottom: 10px;

  color: #c4d0dc;
  background: #0a1725;

  border: 1px solid #304359;
  border-radius: 7px;

  font-size: 10px;
  line-height: 1.6;
}

/* ==========================================
   PREPARED DETAIL ROWS
   ========================================== */

.tl-float-detail-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;

  gap: 12px;

  padding: 10px 0;

  border-bottom:
    1px solid #2a3d52;

  font-size: 11px;
  line-height: 1.5;
}

.tl-float-detail-row > span {
  color: #91a5b8;
  flex: 1;
  min-width: 0;
}

.tl-float-detail-row > strong {
  min-width: 0;
  flex: 1.2;

  color: #f0f5fa;
  font-weight: 800;
  text-align: right;

  overflow-wrap: anywhere;
}

.tl-float-detail-highlight {
  color: #d9b66c !important;
}

/* ==========================================
   SENDING INSTRUCTIONS
   ========================================== */

.tl-float-instructions {
  margin: 13px 0;
  padding: 12px;

  background: #0a1725;
  color: #d6e1ec;

  border: 1px solid #5d503c;
  border-left: 3px solid #d9b66c;
  border-radius: 8px;

  font-size: 11px;
  line-height: 1.8;

  overflow-wrap: anywhere;
}

.tl-float-instructions strong {
  color: #ffe1a1;
}

.tl-float-name-check {
  margin: 11px 0;
  padding: 11px;

  background: #322a1d;
  color: #f0e4c8;

  border: 1px solid #695638;
  border-radius: 7px;
}

/* ==========================================
   HISTORY CONTROL
   ========================================== */

.tl-float-history-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;

  width: 100%;
  min-height: 39px;

  padding: 10px;

  background: #0a1725;
  color: #c4d0dc;

  border: 1px solid #304359;
  border-radius: 8px;

  font-size: 10px;
  font-weight: 850;
}

.tl-float-history-toggle:hover {
  background: #152c42;
}

.tl-float-history-wrap {
  display: grid;
  gap: 9px;
  margin-top: 10px;
}

.tl-float-history-row {
  padding: 12px;

  background: #0a1725;
  color: #f0f5fa;

  border: 1px solid #304359;
  border-radius: 9px;
}

.tl-float-history-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;

  font-size: 11px;
}

.tl-float-transaction-no {
  margin-top: 5px;
  color: #91a5b8;
  font-size: 10px;
  overflow-wrap: anywhere;
}

/* ==========================================
   TRANSACTION STATUS
   ========================================== */

.tl-float-status {
  display: inline-block;

  padding: 7px 9px;

  border-radius: 7px;
  font-size: 9px;
  font-weight: 850;
}

.tl-float-status.completed {
  background: #10332e;
  color: #a8ebd1;
  border: 1px solid #2a6354;
}

.tl-float-status.waiting {
  background: #322a1d;
  color: #ffe3a8;
  border: 1px solid #695638;
}

.tl-float-status.pending {
  background: #142d48;
  color: #b6d0f1;
  border: 1px solid #345375;
}

.tl-float-status.failed {
  background: #38202a;
  color: #ffc3ce;
  border: 1px solid #774155;
}

/* ==========================================
   HISTORY AMOUNT BOXES
   ========================================== */

.tl-float-history-boxes {
  display: grid;
  grid-template-columns:
    repeat(3, minmax(0,1fr));

  gap: 7px;
  margin-top: 11px;
}

.tl-float-history-value {
  display: flex;
  flex-direction: column;
  gap: 7px;

  min-width: 0;
  padding: 10px 7px;

  background: #132337;
  border: 1px solid #2a3d52;
  border-radius: 7px;

  overflow-wrap: anywhere;
}

.tl-float-history-value > span {
  color: #91a5b8;
  font-size: 9px;
  font-weight: 850;
}

.tl-float-history-value > strong {
  color: #f0f5fa;
  font-size: 11px;
  font-weight: 850;
  font-variant-numeric: tabular-nums;
}

.tl-float-history-bottom {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px;

  margin-top: 11px;

  color: #91a5b8;
  font-size: 10px;
  line-height: 1.5;
}

.tl-float-history-bottom strong {
  color: #c4d0dc;
}

/* ==========================================
   EMPTY STATES
   ========================================== */

.tl-float-empty {
  padding: 19px 12px;
  text-align: center;

  background: #0a1725;
  color: #aab9c9;

  border: 1px solid #304359;
  border-radius: 8px;

  font-size: 11px;
  line-height: 1.6;
}

/* ==========================================
   COMPACT THREE-COLUMN ADAPTATION
   ========================================== */

@container float-panel (max-width: 450px) {
  .tl-float-header {
    padding: 12px;
    gap: 8px;
  }

  .tl-float-heading {
    font-size: 12px;
  }

  .tl-float-body {
    padding: 11px;
  }

  .tl-float-preview-grid {
    gap: 6px;
  }

  .tl-float-preview-box {
    padding: 10px 5px;
  }

  .tl-float-preview-title {
    font-size: 8px;
  }

  .tl-float-preview-value {
    font-size: 11px;
  }

  .tl-float-detail-row {
    font-size: 10px;
  }

  .tl-float-history-value {
    padding: 8px 5px;
  }

  .tl-float-history-value > strong {
    font-size: 10px;
  }

  .tl-float-expense-notice {
    font-size: 10px;
  }
}

@container float-panel (max-width: 300px) {
  .tl-float-preview-grid {
    grid-template-columns:
      repeat(2, minmax(0,1fr));
  }

  .tl-float-preview-box.strong {
    grid-column: 1 / -1;
  }

  .tl-float-history-boxes {
    grid-template-columns:
      repeat(2, minmax(0,1fr));
  }

  .tl-float-history-value:last-child {
    grid-column: 1 / -1;
  }
}
`;
