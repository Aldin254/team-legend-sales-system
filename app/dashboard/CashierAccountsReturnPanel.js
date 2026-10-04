"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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
    user?.access_token ||
    null;

  const shiftId =
    currentShift?.id ||
    null;

  const shiftStatus =
    String(
      currentShift?.status ||
        ""
    )
      .trim()
      .toUpperCase();

  const shiftClosed =
    shiftStatus === "CLOSED" ||
    shiftStatus === "COMPLETED";

  const [amount, setAmount] =
    useState("");

  const [feePreview, setFeePreview] =
    useState(0);

  const [feeLoading, setFeeLoading] =
    useState(false);

  const [preparing, setPreparing] =
    useState(false);

  const [preparedReturn, setPreparedReturn] =
    useState(null);

  const [receipt, setReceipt] =
    useState("");

  const [submittingReceipt, setSubmittingReceipt] =
    useState(false);

  const [history, setHistory] =
    useState([]);

  const [historyLoading, setHistoryLoading] =
    useState(true);

  const [historyOpen, setHistoryOpen] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [messageType, setMessageType] =
    useState("");

  const [
    secondsLeft,
    setSecondsLeft,
  ] = useState(30);

  const completionSignatureRef =
    useRef(null);

  const cancelInFlightRef =
    useRef(false);

  const preparedTimeoutRef =
    useRef(null);

  const preparedIntervalRef =
    useRef(null);

  // ==================================================
  // CLEAR PREPARED RETURN TIMERS
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
            "Cashier session is incomplete. Please log in again."
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
  // LOAD CURRENT SHIFT RETURN HISTORY
  // ==================================================

  const loadHistory =
    useCallback(
      async ({
        silent = false,
      } = {}) => {
        if (
          !shiftId ||
          !accessToken
        ) {
          setHistory([]);
          setHistoryLoading(false);

          return;
        }

        try {
          if (!silent) {
            setHistoryLoading(
              true
            );
          }

          const result =
            await callRpc(
              "tl_cashier_return_history",
              {
                p_shift_id:
                  shiftId,
              }
            );

          const rows =
            Array.isArray(
              result
            )
              ? result
              : [];

          setHistory(
            rows
          );

          // ------------------------------------------
          // RESTORE UNFINISHED MANUAL SEND
          // ------------------------------------------

          const pendingSend =
            rows.find(
              (item) =>
                String(
                  item?.status ||
                    ""
                )
                  .trim()
                  .toUpperCase() ===
                "PENDING_MANUAL_SEND"
            );

          setPreparedReturn(
            (
              previous
            ) => {
              if (
                previous?.transaction_id
              ) {
                const existingRow =
                  rows.find(
                    (item) =>
                      String(
                        item.id
                      ) ===
                        String(
                          previous.transaction_id
                        ) &&
                      String(
                        item.status ||
                          ""
                      )
                        .trim()
                        .toUpperCase() ===
                        "PENDING_MANUAL_SEND"
                  );

                if (
                  existingRow
                ) {
                  return {
                    ...previous,

                    created_at:
                      previous.created_at ||
                      existingRow.created_at ||
                      null,
                  };
                }
              }

              if (
                pendingSend
              ) {
                return {
                  transaction_id:
                    pendingSend.id,

                  transaction_no:
                    pendingSend.transaction_no,

                  status:
                    pendingSend.status,

                  return_slot:
                    pendingSend.return_slot,

                  amount:
                    pendingSend.amount,

                  estimated_fee:
                    pendingSend.estimated_fee,

                  cashier_total_expected_deduction:
                    roundMoney(
                      Number(
                        pendingSend.amount ??
                          0
                      ) +
                        Number(
                          pendingSend.estimated_fee ??
                            0
                        )
                    ),

                  company_destination:
                    pendingSend.company_destination,

                  created_at:
                    pendingSend.created_at ||
                    null,
                };
              }

              return null;
            }
          );

          // ------------------------------------------
          // DETECT NEWLY COMPLETED RETURNS
          // ------------------------------------------

          const completedSignature =
            rows
              .filter(
                (item) =>
                  String(
                    item?.status ||
                      ""
                  )
                    .trim()
                    .toUpperCase() ===
                  "COMPLETED"
              )
              .map(
                (item) =>
                  `${item.id}:${item.completed_at || item.updated_at || ""}`
              )
              .sort()
              .join("|");

          if (
            completionSignatureRef.current ===
            null
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
              typeof onReturnChanged ===
              "function"
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

            setMessageType(
              "error"
            );
          }
        } finally {
          if (!silent) {
            setHistoryLoading(
              false
            );
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
  // INITIAL + LIVE HISTORY REFRESH
  // ==================================================

  useEffect(() => {
    loadHistory();

    const timer =
      setInterval(
        () => {
          loadHistory({
            silent:
              true,
          });
        },
        5000
      );

    return () => {
      clearInterval(
        timer
      );
    };
  }, [
    loadHistory,
  ]);

  // ==================================================
  // RETURN POSITIONS USED
  //
  // FAILED / CANCELLED / REVERSED DO NOT CONSUME
  // A RETURN POSITION.
  // ==================================================

  const activeHistory =
    useMemo(
      () =>
        history.filter(
          (item) => {
            const status =
              String(
                item?.status ||
                  ""
              )
                .trim()
                .toUpperCase();

            return ![
              "FAILED",
              "CANCELLED",
              "REVERSED",
            ].includes(
              status
            );
          }
        ),
      [
        history,
      ]
    );

  const returnPositionsUsed =
    activeHistory.length;

  const allReturnPositionsUsed =
    returnPositionsUsed >=
    3;

  // ==================================================
  // UNRESOLVED TRANSACTION
  // ==================================================

  const awaitingConfirmation =
    useMemo(
      () =>
        activeHistory.find(
          (item) =>
            String(
              item?.status ||
                ""
            )
              .trim()
              .toUpperCase() ===
            "AWAITING_ACCOUNTANT_CONFIRMATION"
        ) ||
        null,
      [
        activeHistory,
      ]
    );

  const hasPendingReceipt =
    Boolean(
      preparedReturn?.transaction_id
    );

  const unresolvedTransaction =
    hasPendingReceipt ||
    Boolean(
      awaitingConfirmation
    );

  // ==================================================
  // CANCEL UNFINISHED PENDING RETURN
  // ==================================================

  const cancelPendingReturn =
    useCallback(
      async (
        transactionId,
        {
          automatic = false,
        } = {}
      ) => {
        if (
          !transactionId ||
          !shiftId ||
          cancelInFlightRef.current
        ) {
          return;
        }

        cancelInFlightRef.current =
          true;

        clearPreparedTimers();

        try {
          await callRpc(
            "tl_cashier_cancel_pending_return",
            {
              p_transaction_id:
                transactionId,

              p_shift_id:
                shiftId,
            }
          );

          setPreparedReturn(
            null
          );

          setAmount("");
          setFeePreview(0);
          setReceipt("");

          setSecondsLeft(
            30
          );

          setHistoryOpen(
            false
          );

          if (
            automatic
          ) {
            setMessage(
              "Unused float return cleared automatically after 30 seconds of inactivity."
            );

            setMessageType(
              "success"
            );
          }

          await loadHistory({
            silent:
              true,
          });

          if (
            typeof onReturnChanged ===
            "function"
          ) {
            onReturnChanged();
          }
        } catch (error) {
          console.error(
            "CANCEL PENDING RETURN ERROR:",
            error
          );

          // The transaction may have changed status
          // at exactly the same time, for example if
          // the receipt was submitted.
          await loadHistory({
            silent:
              true,
          });

          const text =
            String(
              error?.message ||
                ""
            )
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

          if (
            automatic &&
            !statusChanged
          ) {
            setMessage(
              error?.message ||
                "Unable to clear the unused float return."
            );

            setMessageType(
              "error"
            );
          }
        } finally {
          cancelInFlightRef.current =
            false;
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
  // 30-SECOND AMOUNT INPUT RESET
  //
  // If cashier types an amount but never presses
  // Prepare Float Return, clear it after 30 seconds.
  // Any amount change restarts the 30-second timer.
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

    const timer =
      setTimeout(
        () => {
          setAmount("");
          setFeePreview(0);

          setMessage(
            "Unused amount cleared automatically after 30 seconds of inactivity."
          );

          setMessageType(
            "success"
          );
        },
        AUTO_RESET_MS
      );

    return () => {
      clearTimeout(
        timer
      );
    };
  }, [
    amount,
    hasPendingReceipt,
    preparing,
    submittingReceipt,
  ]);

  // ==================================================
  // 30-SECOND PREPARED RETURN AUTO-CANCEL
  //
  // Any receipt typing restarts the 30-second timer.
  //
  // Once receipt submission starts, this timer stops.
  // Backend also guarantees only PENDING_MANUAL_SEND
  // can ever be cancelled.
  // ==================================================

  useEffect(() => {
    clearPreparedTimers();

    if (
      !hasPendingReceipt ||
      !preparedReturn?.transaction_id ||
      submittingReceipt
    ) {
      setSecondsLeft(
        30
      );

      return;
    }

    const transactionId =
      preparedReturn.transaction_id;

    const startedAt =
      Date.now();

    setSecondsLeft(
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
                  AUTO_RESET_MS -
                  elapsed
                ) /
                  1000
              )
            );

          setSecondsLeft(
            remaining
          );
        },
        1000
      );

    preparedTimeoutRef.current =
      setTimeout(
        () => {
          cancelPendingReturn(
            transactionId,
            {
              automatic:
                true,
            }
          );
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
  // CLEAN UP TIMERS ON UNMOUNT
  // ==================================================

  useEffect(() => {
    return () => {
      clearPreparedTimers();
    };
  }, [
    clearPreparedTimers,
  ]);

  // ==================================================
  // FEE PREVIEW
  // ==================================================

  useEffect(() => {
    const numericAmount =
      Number(
        amount
      );

    if (
      amount === "" ||
      !Number.isFinite(
        numericAmount
      ) ||
      numericAmount <= 0 ||
      hasPendingReceipt
    ) {
      setFeePreview(
        0
      );

      setFeeLoading(
        false
      );

      return;
    }

    let cancelled =
      false;

    const timer =
      setTimeout(
        async () => {
          try {
            setFeeLoading(
              true
            );

            const result =
              await callRpc(
                "tl_mpesa_fee_for_amount",
                {
                  p_flow:
                    "CASHIER_RETURN",

                  p_amount:
                    roundMoney(
                      numericAmount
                    ),
                }
              );

            if (
              cancelled
            ) {
              return;
            }

            const fee =
              Number(
                result ??
                  0
              );

            setFeePreview(
              Number.isFinite(
                fee
              )
                ? roundMoney(
                    fee
                  )
                : 0
            );
          } catch (error) {
            console.error(
              "RETURN FEE PREVIEW ERROR:",
              error
            );

            if (
              !cancelled
            ) {
              setFeePreview(
                0
              );
            }
          } finally {
            if (
              !cancelled
            ) {
              setFeeLoading(
                false
              );
            }
          }
        },
        350
      );

    return () => {
      cancelled =
        true;

      clearTimeout(
        timer
      );
    };
  }, [
    amount,
    hasPendingReceipt,
    callRpc,
  ]);

  // ==================================================
  // VALUES FOR THREE PREVIEW BOXES
  // ==================================================

  const previewAmount =
    hasPendingReceipt
      ? Number(
          preparedReturn?.amount ??
            0
        )
      : Number(
          amount ||
            0
        );

  const previewFee =
    hasPendingReceipt
      ? Number(
          preparedReturn?.estimated_fee ??
            0
        )
      : Number(
          feePreview ??
            0
        );

  const previewTotal =
    hasPendingReceipt
      ? Number(
          preparedReturn?.cashier_total_expected_deduction ??
            0
        )
      : roundMoney(
          previewAmount +
            previewFee
        );

  // ==================================================
  // PREPARE RETURN
  // ==================================================

  async function prepareReturn() {
    if (
      preparing ||
      unresolvedTransaction
    ) {
      return;
    }

    if (
      allReturnPositionsUsed
    ) {
      setMessage(
        "This shift already has all 3 Float Return positions used."
      );

      setMessageType(
        "error"
      );

      return;
    }

    const numericAmount =
      Number(
        amount
      );

    if (
      amount === "" ||
      !Number.isFinite(
        numericAmount
      ) ||
      numericAmount <= 0
    ) {
      setMessage(
        "Enter a valid amount greater than zero."
      );

      setMessageType(
        "error"
      );

      return;
    }

    if (
      !shiftId
    ) {
      setMessage(
        "No open shift was found."
      );

      setMessageType(
        "error"
      );

      return;
    }

    try {
      setPreparing(
        true
      );

      setMessage("");
      setMessageType("");

      const result =
        await callRpc(
          "tl_cashier_prepare_manual_return",
          {
            p_shift_id:
              shiftId,

            p_amount:
              roundMoney(
                numericAmount
              ),

            p_note:
              null,
          }
        );

      setPreparedReturn({
        ...result,

        created_at:
          result?.created_at ||
          new Date().toISOString(),
      });

      setReceipt("");

      setSecondsLeft(
        30
      );

      setHistoryOpen(
        true
      );

      setMessage(
        "Return prepared. Send the exact amount to Legend Accounts, then enter the M-Pesa receipt number."
      );

      setMessageType(
        "success"
      );

      await loadHistory({
        silent:
          true,
      });
    } catch (error) {
      console.error(
        "PREPARE CASHIER RETURN ERROR:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to prepare the return."
      );

      setMessageType(
        "error"
      );
    } finally {
      setPreparing(
        false
      );
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

    const cleanReceipt =
      String(
        receipt ||
          ""
      )
        .trim()
        .toUpperCase();

    if (
      cleanReceipt.length <
        6 ||
      cleanReceipt.length >
        30 ||
      !/^[A-Z0-9]+$/.test(
        cleanReceipt
      )
    ) {
      setMessage(
        "Enter a valid M-Pesa receipt number using 6–30 letters or numbers."
      );

      setMessageType(
        "error"
      );

      return;
    }

    const confirmed =
      window.confirm(
        `Confirm that you sent KES ${money(
          preparedReturn.amount
        )} to Legend Accounts.\n\nM-Pesa receipt: ${cleanReceipt}\n\nAfter this, Legend Accounts must confirm receiving the money.`
      );

    if (
      !confirmed
    ) {
      return;
    }

    // Stop auto-cancel immediately before submission.
    clearPreparedTimers();

    try {
      setSubmittingReceipt(
        true
      );

      setMessage("");
      setMessageType("");

      const result =
        await callRpc(
          "tl_cashier_submit_return_receipt",
          {
            p_transaction_id:
              preparedReturn.transaction_id,

            p_receipt_no:
              cleanReceipt,
          }
        );

      setPreparedReturn(
        null
      );

      setAmount("");
      setFeePreview(0);
      setReceipt("");

      setSecondsLeft(
        30
      );

      setHistoryOpen(
        true
      );

      setMessage(
        `Receipt ${result?.receipt_no || cleanReceipt} submitted. Waiting for Legend Accounts to confirm receipt.`
      );

      setMessageType(
        "success"
      );

      await loadHistory({
        silent:
          true,
      });

      if (
        typeof onReturnChanged ===
        "function"
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

      setMessageType(
        "error"
      );
    } finally {
      setSubmittingReceipt(
        false
      );
    }
  }

  // ==================================================
  // DISPLAY
  // ==================================================

  if (
    !currentShift
  ) {
    return null;
  }

  return (
    <section style={panelStyle}>
      <div style={headerStyle}>
        <div>
          <div style={titleStyle}>
            SEND FLOAT TO LEGEND ACCOUNTS
          </div>

          <div style={subtitleStyle}>
            Cashier → Legend Accounts
          </div>
        </div>

        <div style={slotBadgeStyle}>
          {returnPositionsUsed}/3 RETURNS
        </div>
      </div>

      {shiftClosed && (
        <div style={warningStyle}>
          This shift is closed. No new return can be started.
        </div>
      )}

      {allReturnPositionsUsed && (
        <div style={warningStyle}>
          All 3 Float Return positions have been used for this shift.
        </div>
      )}

      {awaitingConfirmation &&
        !hasPendingReceipt && (
          <div style={awaitingStyle}>
            <strong>
              WAITING FOR LEGEND ACCOUNTS
            </strong>

            <div style={noticeTextStyle}>
              Return{" "}
              {awaitingConfirmation.return_slot ||
                ""}{" "}
              for KES{" "}
              {money(
                awaitingConfirmation.amount
              )}{" "}
              is waiting for Accountant confirmation.
            </div>

            <div style={noticeTextStyle}>
              Receipt:{" "}
              <strong>
                {awaitingConfirmation.manual_receipt_no ||
                  "-"}
              </strong>
            </div>

            <div style={noticeTextStyle}>
              Once confirmed, the amount plus M-Pesa fee will automatically
              appear in this shift&apos;s expenses.
            </div>
          </div>
        )}

      {/* ========================================== */}
      {/* AMOUNT INPUT */}
      {/* ========================================== */}

      <label style={labelStyle}>
        Amount To Send (KES)
      </label>

      <input
        type="number"
        min="0.01"
        step="0.01"
        value={
          hasPendingReceipt
            ? preparedReturn?.amount ??
              ""
            : amount
        }
        disabled={
          shiftClosed ||
          allReturnPositionsUsed ||
          unresolvedTransaction ||
          preparing
        }
        onChange={(
          event
        ) => {
          setAmount(
            event.target.value
          );

          setMessage("");
          setMessageType("");
        }}
        placeholder="Enter amount"
        style={{
          ...inputStyle,

          backgroundColor:
            unresolvedTransaction ||
            shiftClosed
              ? "#f1f5f9"
              : "white",
        }}
      />

      {!hasPendingReceipt &&
        amount !== "" && (
          <div style={autoResetNoteStyle}>
            Unused amount will clear automatically after 30 seconds of
            inactivity.
          </div>
        )}

      {/* ========================================== */}
      {/* THREE SMALL BOXES */}
      {/* ========================================== */}

      <div style={previewGridStyle}>
        <PreviewBox
          title="AMOUNT TO ACCOUNTS"
          value={
            previewAmount
          }
        />

        <PreviewBox
          title="M-PESA FEE"
          value={
            previewFee
          }
          loading={
            feeLoading
          }
        />

        <PreviewBox
          title="TOTAL EXPENSE"
          value={
            previewTotal
          }
          strong
        />
      </div>

      <div style={expenseNoticeStyle}>
        After Legend Accounts confirms receiving the money,
        <strong>
          {" "}
          KES {money(previewTotal)}
        </strong>{" "}
        will be posted automatically as a cashier expense.
      </div>

      {message && (
        <div
          style={
            messageType ===
            "success"
              ? successStyle
              : errorStyle
          }
        >
          {message}
        </div>
      )}

      {/* ========================================== */}
      {/* PREPARE BUTTON */}
      {/* ========================================== */}

      {!hasPendingReceipt && (
        <button
          type="button"
          onClick={
            prepareReturn
          }
          disabled={
            preparing ||
            shiftClosed ||
            allReturnPositionsUsed ||
            unresolvedTransaction ||
            feeLoading
          }
          style={{
            ...primaryButtonStyle,

            opacity:
              preparing ||
              shiftClosed ||
              allReturnPositionsUsed ||
              unresolvedTransaction ||
              feeLoading
                ? 0.55
                : 1,

            cursor:
              preparing ||
              shiftClosed ||
              allReturnPositionsUsed ||
              unresolvedTransaction ||
              feeLoading
                ? "not-allowed"
                : "pointer",
          }}
        >
          {preparing
            ? "Preparing..."
            : "Prepare Float Return"}
        </button>
      )}

      {/* ========================================== */}
      {/* MANUAL M-PESA SEND */}
      {/* ========================================== */}

      {hasPendingReceipt && (
        <div style={preparedStyle}>
          <div style={preparedHeaderStyle}>
            <div style={preparedTitleStyle}>
              RETURN{" "}
              {preparedReturn.return_slot ||
                ""}{" "}
              — SEND THROUGH M-PESA
            </div>

            <div style={countdownStyle}>
              AUTO-CLOSE: {secondsLeft}s
            </div>
          </div>

          <div style={preparedTimeoutNoteStyle}>
            If no receipt is submitted, this unfinished return will cancel
            automatically after 30 seconds of inactivity.
          </div>

          <DetailRow
            label="Transaction"
            value={
              preparedReturn.transaction_no ||
              "-"
            }
          />

          <DetailRow
            label="Send To"
            value={
              formatPhone(
                preparedReturn.company_destination
              )
            }
          />

          <DetailRow
            label="Amount"
            value={`KES ${money(
              preparedReturn.amount
            )}`}
          />

          <DetailRow
            label="M-Pesa Fee"
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

          <div style={sendInstructionStyle}>
            Send exactly{" "}
            <strong>
              KES{" "}
              {money(
                preparedReturn.amount
              )}
            </strong>{" "}
            to the Legend Accounts number shown above.
            After M-Pesa confirms the transfer, enter the receipt below.
          </div>

          <label style={labelStyle}>
            M-Pesa Receipt Number
          </label>

          <input
            type="text"
            value={
              receipt
            }
            disabled={
              submittingReceipt
            }
            onChange={(
              event
            ) => {
              setReceipt(
                event.target.value
                  .toUpperCase()
                  .replace(
                    /[^A-Z0-9]/g,
                    ""
                  )
              );

              setMessage("");
              setMessageType("");
            }}
            maxLength={30}
            placeholder="e.g. TABC123XYZ"
            style={inputStyle}
          />

          <button
            type="button"
            onClick={
              submitReceipt
            }
            disabled={
              submittingReceipt
            }
            style={{
              ...receiptButtonStyle,

              opacity:
                submittingReceipt
                  ? 0.6
                  : 1,
            }}
          >
            {submittingReceipt
              ? "Submitting..."
              : "Confirm M-Pesa Sent"}
          </button>
        </div>
      )}

      {/* ========================================== */}
      {/* SHIFT TRANSACTION HISTORY */}
      {/* ========================================== */}

      <button
        type="button"
        onClick={() =>
          setHistoryOpen(
            (
              previous
            ) =>
              !previous
          )
        }
        style={historyToggleStyle}
      >
        <span>
          {historyOpen
            ? "▲"
            : "▼"}
        </span>

        <span>
          TRANSACTIONS THIS SHIFT ({history.length})
        </span>
      </button>

      {historyOpen && (
        <div style={historyWrapStyle}>
          {historyLoading ? (
            <div style={emptyStyle}>
              Loading transactions...
            </div>
          ) : history.length ===
            0 ? (
            <div style={emptyStyle}>
              No Cashier → Accounts transactions in this shift.
            </div>
          ) : (
            history.map(
              (transaction) => (
                <HistoryRow
                  key={
                    transaction.id
                  }
                  transaction={
                    transaction
                  }
                />
              )
            )
          )}
        </div>
      )}
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
      style={{
        ...previewBoxStyle,

        ...(strong
          ? previewStrongStyle
          : {}),
      }}
    >
      <div style={previewTitleStyle}>
        {title}
      </div>

      <div
        style={{
          ...previewValueStyle,

          ...(strong
            ? previewStrongValueStyle
            : {}),
        }}
      >
        {loading
          ? "..."
          : `KES ${money(
              value
            )}`}
      </div>
    </div>
  );
}

// ==================================================
// DETAIL ROW
// ==================================================

function DetailRow({
  label,
  value,
  strong = false,
}) {
  return (
    <div style={detailRowStyle}>
      <span>
        {label}
      </span>

      <strong
        style={
          strong
            ? detailStrongStyle
            : undefined
        }
      >
        {value}
      </strong>
    </div>
  );
}

// ==================================================
// HISTORY ROW
// ==================================================

function HistoryRow({
  transaction,
}) {
  const status =
    String(
      transaction?.status ||
        ""
    )
      .trim()
      .toUpperCase();

  const fee =
    Number(
      transaction?.actual_fee ??
        transaction?.estimated_fee ??
        0
    );

  const amount =
    Number(
      transaction?.amount ??
        0
    );

  const total =
    roundMoney(
      amount +
        fee
    );

  const statusStyle =
    getStatusStyle(
      status
    );

  return (
    <div style={historyRowStyle}>
      <div style={historyTopStyle}>
        <div>
          <strong>
            RETURN{" "}
            {transaction.return_slot ||
              "-"}
          </strong>

          <div style={transactionNoStyle}>
            {transaction.transaction_no ||
              "-"}
          </div>
        </div>

        <span
          style={{
            ...historyStatusStyle,

            backgroundColor:
              statusStyle.backgroundColor,

            color:
              statusStyle.color,
          }}
        >
          {friendlyStatus(
            status
          )}
        </span>
      </div>

      <div style={historyBoxesStyle}>
        <HistoryValue
          title="AMOUNT"
          value={`KES ${money(
            amount
          )}`}
        />

        <HistoryValue
          title="FEE"
          value={`KES ${money(
            fee
          )}`}
        />

        <HistoryValue
          title="TOTAL"
          value={`KES ${money(
            total
          )}`}
        />
      </div>

      <div style={historyBottomStyle}>
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

// ==================================================
// HISTORY VALUE
// ==================================================

function HistoryValue({
  title,
  value,
}) {
  return (
    <div style={historyValueStyle}>
      <span>
        {title}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
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
  const numeric =
    Number(
      value ??
        0
    );

  return (
    Number.isFinite(
      numeric
    )
      ? numeric
      : 0
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

function formatPhone(
  value
) {
  const phone =
    String(
      value ||
        ""
    ).trim();

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

  return (
    phone ||
    "-"
  );
}

function formatDateTime(
  value
) {
  if (!value) {
    return "-";
  }

  try {
    return new Intl.DateTimeFormat(
      "en-KE",
      {
        timeZone:
          "Africa/Nairobi",

        day:
          "2-digit",

        month:
          "short",

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
    return "-";
  }
}

function friendlyStatus(
  status
) {
  switch (
    status
  ) {
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
      return (
        status ||
        "-"
      );
  }
}

function getStatusStyle(
  status
) {
  if (
    status ===
    "COMPLETED"
  ) {
    return {
      backgroundColor:
        "#dcfce7",

      color:
        "#166534",
    };
  }

  if (
    status ===
    "AWAITING_ACCOUNTANT_CONFIRMATION"
  ) {
    return {
      backgroundColor:
        "#fef3c7",

      color:
        "#92400e",
    };
  }

  if (
    status ===
    "PENDING_MANUAL_SEND"
  ) {
    return {
      backgroundColor:
        "#dbeafe",

      color:
        "#1d4ed8",
    };
  }

  return {
    backgroundColor:
      "#fee2e2",

    color:
      "#991b1b",
  };
}

// ==================================================
// STYLES
// ==================================================

const panelStyle = {
  backgroundColor:
    "white",

  borderRadius:
    "7px",

  padding:
    "14px",

  boxShadow:
    "0 1px 5px rgba(0,0,0,0.12)",

  border:
    "1px solid #cbd5e1",
};

const headerStyle = {
  display:
    "flex",

  justifyContent:
    "space-between",

  alignItems:
    "center",

  gap:
    "10px",

  marginBottom:
    "12px",
};

const titleStyle = {
  fontWeight:
    "900",

  fontSize:
    "13px",

  color:
    "#0f172a",
};

const subtitleStyle = {
  marginTop:
    "3px",

  color:
    "#64748b",

  fontSize:
    "9px",
};

const slotBadgeStyle = {
  backgroundColor:
    "#0f766e",

  color:
    "white",

  padding:
    "5px 8px",

  borderRadius:
    "12px",

  fontWeight:
    "bold",

  fontSize:
    "8px",

  whiteSpace:
    "nowrap",
};

const labelStyle = {
  display:
    "block",

  marginBottom:
    "5px",

  fontWeight:
    "bold",

  fontSize:
    "10px",
};

const inputStyle = {
  width:
    "100%",

  boxSizing:
    "border-box",

  padding:
    "9px",

  border:
    "1px solid #94a3b8",

  borderRadius:
    "5px",

  fontSize:
    "12px",

  marginBottom:
    "10px",
};

const autoResetNoteStyle = {
  marginTop:
    "-5px",

  marginBottom:
    "10px",

  padding:
    "6px 8px",

  backgroundColor:
    "#f8fafc",

  color:
    "#64748b",

  borderRadius:
    "4px",

  fontSize:
    "8px",
};

const previewGridStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "repeat(3,minmax(0,1fr))",

  gap:
    "7px",

  marginBottom:
    "10px",
};

const previewBoxStyle = {
  backgroundColor:
    "#f8fafc",

  border:
    "1px solid #e2e8f0",

  borderRadius:
    "5px",

  padding:
    "9px",

  textAlign:
    "center",
};

const previewStrongStyle = {
  backgroundColor:
    "#fff7ed",

  border:
    "1px solid #fdba74",
};

const previewTitleStyle = {
  color:
    "#64748b",

  fontSize:
    "7px",

  fontWeight:
    "bold",
};

const previewValueStyle = {
  marginTop:
    "5px",

  color:
    "#0f172a",

  fontSize:
    "11px",

  fontWeight:
    "900",
};

const previewStrongValueStyle = {
  color:
    "#c2410c",
};

const expenseNoticeStyle = {
  padding:
    "8px",

  marginBottom:
    "10px",

  backgroundColor:
    "#f8fafc",

  borderRadius:
    "5px",

  color:
    "#475569",

  fontSize:
    "9px",

  lineHeight:
    "1.4",
};

const primaryButtonStyle = {
  width:
    "100%",

  padding:
    "10px",

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

  fontSize:
    "10px",

  marginBottom:
    "10px",
};

const preparedStyle = {
  marginTop:
    "10px",

  marginBottom:
    "10px",

  padding:
    "12px",

  backgroundColor:
    "#f0fdfa",

  border:
    "2px solid #0f766e",

  borderRadius:
    "6px",
};

const preparedHeaderStyle = {
  display:
    "flex",

  justifyContent:
    "space-between",

  alignItems:
    "center",

  gap:
    "10px",

  marginBottom:
    "7px",
};

const preparedTitleStyle = {
  color:
    "#115e59",

  fontWeight:
    "900",

  fontSize:
    "11px",
};

const countdownStyle = {
  padding:
    "4px 7px",

  backgroundColor:
    "#fef3c7",

  color:
    "#92400e",

  borderRadius:
    "10px",

  fontSize:
    "7px",

  fontWeight:
    "900",

  whiteSpace:
    "nowrap",
};

const preparedTimeoutNoteStyle = {
  marginBottom:
    "8px",

  padding:
    "7px",

  backgroundColor:
    "#ecfeff",

  color:
    "#155e75",

  border:
    "1px solid #a5f3fc",

  borderRadius:
    "4px",

  fontSize:
    "8px",
};

const detailRowStyle = {
  display:
    "flex",

  justifyContent:
    "space-between",

  gap:
    "12px",

  padding:
    "6px 0",

  borderBottom:
    "1px solid #ccfbf1",

  fontSize:
    "9px",
};

const detailStrongStyle = {
  color:
    "#166534",
};

const sendInstructionStyle = {
  margin:
    "10px 0",

  padding:
    "9px",

  backgroundColor:
    "#fef3c7",

  color:
    "#92400e",

  borderRadius:
    "5px",

  fontSize:
    "9px",

  lineHeight:
    "1.5",
};

const receiptButtonStyle = {
  width:
    "100%",

  padding:
    "10px",

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

const historyToggleStyle = {
  width:
    "100%",

  display:
    "flex",

  alignItems:
    "center",

  justifyContent:
    "center",

  gap:
    "7px",

  padding:
    "9px",

  border:
    "1px solid #cbd5e1",

  borderRadius:
    "5px",

  backgroundColor:
    "#f8fafc",

  color:
    "#334155",

  fontWeight:
    "bold",

  fontSize:
    "9px",

  cursor:
    "pointer",
};

const historyWrapStyle = {
  marginTop:
    "7px",

  display:
    "grid",

  gap:
    "7px",
};

const historyRowStyle = {
  border:
    "1px solid #e2e8f0",

  borderRadius:
    "5px",

  padding:
    "9px",

  backgroundColor:
    "#ffffff",
};

const historyTopStyle = {
  display:
    "flex",

  justifyContent:
    "space-between",

  gap:
    "10px",

  alignItems:
    "center",

  fontSize:
    "9px",
};

const transactionNoStyle = {
  marginTop:
    "2px",

  color:
    "#64748b",

  fontSize:
    "8px",
};

const historyStatusStyle = {
  padding:
    "4px 6px",

  borderRadius:
    "10px",

  fontSize:
    "7px",

  fontWeight:
    "bold",

  whiteSpace:
    "nowrap",
};

const historyBoxesStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "repeat(3,minmax(0,1fr))",

  gap:
    "5px",

  marginTop:
    "8px",
};

const historyValueStyle = {
  display:
    "flex",

  flexDirection:
    "column",

  gap:
    "3px",

  padding:
    "6px",

  backgroundColor:
    "#f8fafc",

  borderRadius:
    "4px",

  fontSize:
    "8px",
};

const historyBottomStyle = {
  marginTop:
    "7px",

  display:
    "flex",

  justifyContent:
    "space-between",

  flexWrap:
    "wrap",

  gap:
    "6px",

  color:
    "#64748b",

  fontSize:
    "8px",
};

const awaitingStyle = {
  padding:
    "9px",

  marginBottom:
    "10px",

  backgroundColor:
    "#fffbeb",

  border:
    "1px solid #fde68a",

  color:
    "#92400e",

  borderRadius:
    "5px",

  fontSize:
    "9px",
};

const noticeTextStyle = {
  marginTop:
    "4px",
};

const warningStyle = {
  padding:
    "9px",

  marginBottom:
    "10px",

  backgroundColor:
    "#fff7ed",

  border:
    "1px solid #fdba74",

  color:
    "#9a3412",

  borderRadius:
    "5px",

  fontSize:
    "9px",
};

const successStyle = {
  padding:
    "9px",

  marginBottom:
    "10px",

  backgroundColor:
    "#f0fdf4",

  border:
    "1px solid #86efac",

  color:
    "#166534",

  borderRadius:
    "5px",

  fontSize:
    "9px",
};

const errorStyle = {
  padding:
    "9px",

  marginBottom:
    "10px",

  backgroundColor:
    "#fef2f2",

  border:
    "1px solid #fecaca",

  color:
    "#991b1b",

  borderRadius:
    "5px",

  fontSize:
    "9px",
};

const emptyStyle = {
  padding:
    "12px",

  textAlign:
    "center",

  color:
    "#64748b",

  backgroundColor:
    "#f8fafc",

  borderRadius:
    "5px",

  fontSize:
    "9px",
};
