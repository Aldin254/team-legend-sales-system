"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Shared 12H/24H panel. Existing Supabase financial RPCs are unchanged.
const AUTO_RESET_MS = 30000;

export default function CashierAccountsReturnPanel({ user, currentShift, onReturnChanged }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = user?.access_token || null;
  const shiftId = currentShift?.id || null;
  const shiftStatus = String(currentShift?.status || "").toUpperCase();
  const shiftClosed = ["CLOSED", "COMPLETED"].includes(shiftStatus);

  const [amount, setAmount] = useState("");
  const [fee, setFee] = useState(0);
  const [feeLoading, setFeeLoading] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [prepared, setPrepared] = useState(null);
  const [receipt, setReceipt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [notice, setNotice] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(30);

  const completedRef = useRef(null);
  const cancelBusyRef = useRef(false);
  const timeoutRef = useRef(null);
  const intervalRef = useRef(null);
  const notify = (text, type = "error") => setNotice({ text, type });

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  const clearTimers = useCallback(() => {
    clearTimeout(timeoutRef.current);
    clearInterval(intervalRef.current);
    timeoutRef.current = null;
    intervalRef.current = null;
  }, []);

  const callRpc = useCallback(async (name, body = {}) => {
    if (!url || !anonKey || !token) {
      throw new Error("Cashier session is incomplete. Please log in again.");
    }

    const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
      method: "POST",
      cache: "no-store",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const result = await safeJson(response);

    if (!response.ok) {
      throw new Error(
        result?.message ||
        result?.details ||
        result?.hint ||
        `Unable to run ${name}.`
      );
    }

    return result;
  }, [url, anonKey, token]);

  // LOAD RETURN HISTORY
  const loadHistory = useCallback(async ({ silent = false } = {}) => {
    if (!shiftId || !token) {
      setHistory([]);
      setHistoryLoading(false);
      return;
    }

    try {
      if (!silent) setHistoryLoading(true);

      const result = await callRpc(
        "tl_cashier_return_history",
        { p_shift_id: shiftId }
      );

      const rows = Array.isArray(result) ? result : [];
      setHistory(rows);

      const pending = rows.find(
        r => String(r?.status || "").toUpperCase() === "PENDING_MANUAL_SEND"
      );

      setPrepared(old => {
        const matching = old?.transaction_id && rows.find(
          r =>
            String(r.id) === String(old.transaction_id) &&
            String(r.status || "").toUpperCase() === "PENDING_MANUAL_SEND"
        );

        const row = matching || pending;
        if (!row) return null;

        return {
          ...(matching ? old : {}),
          transaction_id: row.id,
          transaction_no: row.transaction_no,
          return_slot: row.return_slot,
          amount: row.amount,
          estimated_fee: row.estimated_fee,
          cashier_total_expected_deduction: roundMoney(
            Number(row.amount || 0) + Number(row.estimated_fee || 0)
          ),
          company_destination: row.company_destination || old?.company_destination,
          company_account_name: row.company_account_name || old?.company_account_name,
          company_account_type: row.company_account_type || old?.company_account_type,
          account_reference: row.account_reference || old?.account_reference,
          collection_method: row.collection_method || old?.collection_method,
          paybill_number: row.paybill_number || old?.paybill_number,
          bank_account_number: row.bank_account_number || old?.bank_account_number,
          created_at: row.created_at || old?.created_at,
        };
      });

      const signature = rows
        .filter(
          r => String(r?.status || "").toUpperCase() === "COMPLETED"
        )
        .map(r => `${r.id}:${r.completed_at || r.updated_at || ""}`)
        .sort()
        .join("|");

      if (completedRef.current === null) {
        completedRef.current = signature;
      } else if (completedRef.current !== signature) {
        completedRef.current = signature;

        if (typeof onReturnChanged === "function") {
          onReturnChanged();
        }
      }
    } catch (error) {
      console.error("FLOAT RETURN HISTORY:", error);

      if (!silent) {
        notify(error?.message || "Unable to load transactions.");
      }
    } finally {
      if (!silent) setHistoryLoading(false);
    }
  }, [shiftId, token, callRpc, onReturnChanged]);

  // REFRESH EVERY 5 SECONDS
  useEffect(() => {
    loadHistory();

    const timer = setInterval(() => {
      loadHistory({ silent: true });
    }, 5000);

    return () => clearInterval(timer);
  }, [loadHistory]);

  // RETURN POSITIONS
  const activeHistory = useMemo(
    () => history.filter(
      r => !["FAILED", "CANCELLED", "REVERSED"].includes(
        String(r?.status || "").toUpperCase()
      )
    ),
    [history]
  );

  const slotsUsed = activeHistory.length;
  const slotsFull = slotsUsed >= 3;

  const awaiting = activeHistory.find(
    r => String(r?.status || "").toUpperCase() ===
      "AWAITING_ACCOUNTANT_CONFIRMATION"
  ) || null;

  const hasPrepared = Boolean(prepared?.transaction_id);
  const unresolved = hasPrepared || Boolean(awaiting);

  // CANCEL PENDING RETURN
  const cancelPending = useCallback(
    async (transactionId, automatic = false) => {
      if (!transactionId || !shiftId || cancelBusyRef.current) {
        return;
      }

      cancelBusyRef.current = true;
      clearTimers();

      try {
        await callRpc(
          "tl_cashier_cancel_pending_return",
          {
            p_transaction_id: transactionId,
            p_shift_id: shiftId,
          }
        );

        setPrepared(null);
        setAmount("");
        setFee(0);
        setReceipt("");
        setSecondsLeft(30);
        setHistoryOpen(false);

        await loadHistory({ silent: true });

        if (typeof onReturnChanged === "function") {
          onReturnChanged();
        }
      } catch (error) {
        console.error("CANCEL FLOAT RETURN:", error);

        await loadHistory({ silent: true });

        const description = String(
          error?.message || ""
        ).toLowerCase();

        const changed = [
          "already changed",
          "no longer",
          "cannot be cancelled",
        ].some(x => description.includes(x));

        if (automatic && !changed) {
          notify(
            error?.message || "Unable to cancel unused return."
          );
        }
      } finally {
        cancelBusyRef.current = false;
      }
    },
    [shiftId, callRpc, clearTimers, loadHistory, onReturnChanged]
  );

  // UNUSED AMOUNT RESET — 30 SECONDS
  useEffect(() => {
    if (!amount || hasPrepared || preparing || submitting) {
      return;
    }

    const timer = setTimeout(() => {
      setAmount("");
      setFee(0);
    }, AUTO_RESET_MS);

    return () => clearTimeout(timer);
  }, [amount, hasPrepared, preparing, submitting]);

  // PREPARED RETURN AUTO-CANCEL
  useEffect(() => {
    clearTimers();

    if (!hasPrepared || !prepared?.transaction_id || submitting) {
      setSecondsLeft(30);
      return;
    }

    const transactionId = prepared.transaction_id;
    const started = Date.now();

    setSecondsLeft(30);

    intervalRef.current = setInterval(() => {
      setSecondsLeft(
        Math.max(
          0,
          Math.ceil(
            (AUTO_RESET_MS - (Date.now() - started)) / 1000
          )
        )
      );
    }, 1000);

    timeoutRef.current = setTimeout(() => {
      cancelPending(transactionId, true);
    }, AUTO_RESET_MS);

    return clearTimers;
  }, [
    hasPrepared,
    prepared?.transaction_id,
    receipt,
    submitting,
    cancelPending,
    clearTimers,
  ]);

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  // LIVE TRANSACTION FEE
  useEffect(() => {
    const numericAmount = Number(amount);

    if (
      !amount ||
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0 ||
      hasPrepared
    ) {
      setFee(0);
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

        if (!cancelled) {
          const value = Number(result ?? 0);

          setFee(
            Number.isFinite(value)
              ? roundMoney(value)
              : 0
          );
        }
      } catch (error) {
        console.error("RETURN FEE:", error);

        if (!cancelled) setFee(0);
      } finally {
        if (!cancelled) setFeeLoading(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [amount, hasPrepared, callRpc]);

  // PREVIEW
  const previewAmount = hasPrepared
    ? Number(prepared?.amount ?? 0)
    : Number(amount || 0);

  const previewFee = hasPrepared
    ? Number(prepared?.estimated_fee ?? 0)
    : Number(fee || 0);

  const previewTotal = hasPrepared
    ? Number(
        prepared?.cashier_total_expected_deduction ?? 0
      )
    : roundMoney(previewAmount + previewFee);

  const route = getReturnRoute(prepared);

  // PREPARE FLOAT RETURN
  async function prepareReturn() {
    if (preparing || unresolved) return;

    if (shiftClosed) {
      notify("Shift closed.");
      return;
    }

    if (slotsFull) {
      notify("All 3 Float Return positions are used.");
      return;
    }

    const value = Number(amount);

    if (
      !amount ||
      !Number.isFinite(value) ||
      roundMoney(value) <= 0
    ) {
      notify("Enter a valid amount greater than zero.");
      return;
    }

    if (!shiftId) {
      notify("No open shift was found.");
      return;
    }

    try {
      setPreparing(true);
      setNotice(null);

      const result = await callRpc(
        "tl_cashier_prepare_manual_return",
        {
          p_shift_id: shiftId,
          p_amount: roundMoney(value),
          p_note: null,
        }
      );

      setPrepared({
        ...result,
        created_at:
          result?.created_at ||
          new Date().toISOString(),
      });

      setReceipt("");
      setSecondsLeft(30);
      setHistoryOpen(true);

      await loadHistory({ silent: true });
    } catch (error) {
      console.error("PREPARE RETURN:", error);

      notify(
        error?.message || "Unable to prepare return."
      );
    } finally {
      setPreparing(false);
    }
  }

  // SUBMIT M-PESA RECEIPT
  async function submitReceipt() {
    if (!prepared?.transaction_id || submitting) {
      return;
    }

    const clean = String(receipt || "")
      .trim()
      .toUpperCase();

    if (!/^[A-Z0-9]{6,30}$/.test(clean)) {
      notify(
        "Enter a valid M-Pesa receipt (6–30 letters or numbers)."
      );
      return;
    }

    const destination = route.isIm
      ? `I&M PayBill ${
          prepared.paybill_number ||
          prepared.company_destination ||
          "-"
        }, Account ${
          prepared.bank_account_number ||
          prepared.account_reference ||
          "-"
        }, Account Name ${
          prepared.company_account_name || "-"
        }`
      : `Legend Accounts M-Pesa ${
          formatPhone(prepared.company_destination)
        }${
          prepared.company_account_name
            ? `, Account Name ${prepared.company_account_name}`
            : ""
        }`;

    const confirmed = window.confirm(
      `Confirm you sent KES ${money(
        prepared.amount
      )} to ${destination}.\n\n` +
      `M-Pesa receipt: ${clean}\n\n` +
      "Legend Accounts must confirm receiving the money."
    );

    if (!confirmed) return;

    clearTimers();

    try {
      setSubmitting(true);
      setNotice(null);

      const result = await callRpc(
        "tl_cashier_submit_return_receipt",
        {
          p_transaction_id: prepared.transaction_id,
          p_receipt_no: clean,
        }
      );

      setPrepared(null);
      setAmount("");
      setFee(0);
      setReceipt("");
      setSecondsLeft(30);
      setHistoryOpen(true);

      notify(
        `Receipt ${
          result?.receipt_no || clean
        } submitted.`,
        "success"
      );

      await loadHistory({ silent: true });

      if (typeof onReturnChanged === "function") {
        onReturnChanged();
      }
    } catch (error) {
      console.error("SUBMIT RETURN RECEIPT:", error);

      notify(
        error?.message || "Unable to submit receipt."
      );
    } finally {
      setSubmitting(false);
    }
  }

  // DISPLAY
  if (!currentShift) return null;

  return (
    <section className="tl-float-return">
      <style>{styles}</style>

      <div className="tl-float-head">
        <strong>SEND FLOAT TO LEGEND ACCOUNTS</strong>

        <span>{slotsUsed}/3 RETURNS</span>
      </div>

      <div className="tl-float-body">
        {shiftClosed && (
          <div className="tl-float-warning">
            SHIFT CLOSED
          </div>
        )}

        {slotsFull && (
          <div className="tl-float-warning">
            3/3 RETURNS USED
          </div>
        )}

        {awaiting && !hasPrepared && (
          <div className="tl-float-pending">
            <strong>WAITING FOR LEGEND ACCOUNTS</strong>

            <span>
              KES {money(awaiting.amount)}
            </span>

            <span>
              Receipt:{" "}
              {awaiting.manual_receipt_no || "-"}
            </span>
          </div>
        )}

        <label htmlFor="tl-return-amount">
          AMOUNT TO SEND (KES)
        </label>

        <input
          id="tl-return-amount"
          className="tl-float-input"
          type="number"
          min="0.01"
          step="0.01"
          value={
            hasPrepared
              ? prepared?.amount ?? ""
              : amount
          }
          disabled={
            shiftClosed ||
            slotsFull ||
            unresolved ||
            preparing
          }
          onChange={e => {
            setAmount(e.target.value);
            setNotice(null);
          }}
          placeholder="Enter amount"
        />

        <div className="tl-float-preview">
          <Preview
            title="AMOUNT TO ACCOUNTS"
            value={previewAmount}
          />

          <Preview
            title={
              hasPrepared
                ? route.feeTitle
                : "TRANSACTION FEE"
            }
            value={previewFee}
            loading={feeLoading}
          />

          <Preview
            title="TOTAL EXPENSE"
            value={previewTotal}
            strong
          />
        </div>

        {notice && (
          <div
            role="status"
            aria-live="polite"
            className={`tl-float-notice ${notice.type}`}
          >
            {notice.text}
          </div>
        )}

        {!hasPrepared && (
          <button
            className="tl-float-main"
            type="button"
            onClick={prepareReturn}
            disabled={
              preparing ||
              shiftClosed ||
              slotsFull ||
              unresolved ||
              feeLoading
            }
          >
            {preparing
              ? "PREPARING..."
              : "PREPARE FLOAT RETURN"}
          </button>
        )}

        {hasPrepared && (
          <div className="tl-float-prepared">
            <div className="tl-float-prepared-head">
              <strong>
                RETURN {prepared.return_slot || ""} —{" "}
                {route.title}
              </strong>

              <span>
                AUTO-CANCEL {secondsLeft}s
              </span>
            </div>

            <Detail
              label="TRANSACTION"
              value={
                prepared.transaction_no || "-"
              }
            />

            {route.isIm ? (
              <>
                <Detail
                  label="I&M PAYBILL"
                  value={
                    prepared.paybill_number ||
                    prepared.company_destination ||
                    "-"
                  }
                  strong
                />

                <Detail
                  label="I&M ACCOUNT"
                  value={
                    prepared.bank_account_number ||
                    prepared.account_reference ||
                    "-"
                  }
                  strong
                />

                <Detail
                  label="VERIFY ACCOUNT NAME"
                  value={
                    prepared.company_account_name || "-"
                  }
                  strong
                />

                {prepared.account_reference &&
                  prepared.bank_account_number &&
                  String(prepared.account_reference) !==
                    String(prepared.bank_account_number) && (
                    <Detail
                      label="REFERENCE"
                      value={prepared.account_reference}
                    />
                  )}
              </>
            ) : (
              <>
                <Detail
                  label="M-PESA NUMBER"
                  value={formatPhone(
                    prepared.company_destination
                  )}
                  strong
                />

                {prepared.company_account_name && (
                  <Detail
                    label="VERIFY RECIPIENT NAME"
                    value={
                      prepared.company_account_name
                    }
                    strong
                  />
                )}
              </>
            )}

            <Detail
              label="AMOUNT"
              value={`KES ${money(prepared.amount)}`}
            />

            <Detail
              label={route.feeTitle}
              value={`KES ${money(
                prepared.estimated_fee
              )}`}
            />

            <Detail
              label="TOTAL EXPENSE AFTER CONFIRMATION"
              value={`KES ${money(
                prepared.cashier_total_expected_deduction
              )}`}
              strong
            />

            <label htmlFor="tl-return-receipt">
              M-PESA RECEIPT NUMBER
            </label>

            <input
              id="tl-return-receipt"
              className="tl-float-input"
              type="text"
              maxLength={30}
              value={receipt}
              disabled={submitting}
              autoComplete="off"
              placeholder="e.g. TABC123XYZ"
              onChange={e => {
                setReceipt(
                  e.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, "")
                );
                setNotice(null);
              }}
            />

            <button
              className="tl-float-main"
              type="button"
              onClick={submitReceipt}
              disabled={submitting}
            >
              {submitting
                ? "SUBMITTING..."
                : "CONFIRM M-PESA SENT"}
            </button>
          </div>
        )}

        <button
          className="tl-float-toggle"
          type="button"
          onClick={() =>
            setHistoryOpen(open => !open)
          }
          aria-expanded={historyOpen}
        >
          {historyOpen ? "▲" : "▼"}{" "}
          TRANSACTIONS THIS SHIFT ({history.length})
        </button>

        {historyOpen && (
          <div className="tl-float-history">
            {historyLoading
              ? "Loading..."
              : history.length === 0
              ? "No transactions"
              : history.map(t => (
                  <HistoryRow
                    key={t.id}
                    transaction={t}
                  />
                ))}
          </div>
        )}
      </div>
    </section>
  );
}

// DISPLAY HELPERS
function Preview({
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
      <span>{title}</span>

      <strong>
        {loading ? "..." : `KES ${money(value)}`}
      </strong>
    </div>
  );
}

function Detail({
  label,
  value,
  strong = false,
}) {
  return (
    <div className="tl-float-detail">
      <span>{label}</span>

      <strong
        className={strong ? "highlight" : ""}
      >
        {value}
      </strong>
    </div>
  );
}

function HistoryRow({ transaction: t }) {
  const status = String(
    t?.status || ""
  ).toUpperCase();

  const amount = Number(t?.amount || 0);

  const fee = Number(
    t?.actual_fee ??
    t?.estimated_fee ??
    0
  );

  const tone =
    status === "COMPLETED"
      ? "completed"
      : status === "AWAITING_ACCOUNTANT_CONFIRMATION"
      ? "waiting"
      : status === "PENDING_MANUAL_SEND"
      ? "pending"
      : "failed";

  return (
    <div className="tl-float-history-row">
      <div className="tl-float-history-top">
        <div>
          <strong>
            RETURN {t.return_slot || "-"}
          </strong>

          <small>
            {t.transaction_no || "-"}
          </small>
        </div>

        <span
          className={`tl-float-status ${tone}`}
        >
          {friendlyStatus(status)}
        </span>
      </div>

      <div className="tl-float-preview">
        <Preview
          title="AMOUNT"
          value={amount}
        />

        <Preview
          title="FEE"
          value={fee}
        />

        <Preview
          title="TOTAL"
          value={roundMoney(amount + fee)}
        />
      </div>

      <div className="tl-float-history-foot">
        <span>
          Receipt:{" "}
          {t.manual_receipt_no || "Not submitted"}
        </span>

        <span>
          {formatDateTime(t.created_at)}
        </span>
      </div>
    </div>
  );
}

// PAYMENT ROUTING
function getReturnRoute(t) {
  const name = [
    t?.collection_method,
    t?.payment_method,
    t?.company_account_type,
    t?.company_account_name,
  ]
    .filter(Boolean)
    .join(" ")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  const destination = String(
    t?.paybill_number ||
    t?.company_destination ||
    ""
  ).trim();

  const account = String(
    t?.bank_account_number ||
    t?.account_reference ||
    ""
  ).trim();

  const isIm =
    ["MPESATOIM", "IMBANK", "IMPAYMENT", "IANDBANK"]
      .some(x => name.includes(x)) ||
    name === "IM" ||
    (
      account !== "" &&
      /^\d{5,7}$/.test(destination)
    );

  return isIm
    ? {
        isIm: true,
        title: "M-PESA → I&M",
        feeTitle: "M-PESA → I&M FEE",
      }
    : {
        isIm: false,
        title: "M-PESA → M-PESA",
        feeTitle: "M-PESA FEE",
      };
}

// GENERAL HELPERS
async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function money(value) {
  const n = Number(value ?? 0);

  return (
    Number.isFinite(n) ? n : 0
  ).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function roundMoney(value) {
  return Math.round(
    (Number(value) + Number.EPSILON) * 100
  ) / 100;
}

function formatPhone(value) {
  const phone = String(value || "").trim();

  return phone.startsWith("254") &&
    phone.length === 12
    ? `0${phone.slice(3)}`
    : phone || "-";
}

function formatDateTime(value) {
  if (!value) return "-";

  try {
    return new Intl.DateTimeFormat("en-KE", {
      timeZone: "Africa/Nairobi",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(value));
  } catch {
    return "-";
  }
}

function friendlyStatus(status) {
  return ({
    PENDING_MANUAL_SEND: "SEND MONEY",
    AWAITING_ACCOUNTANT_CONFIRMATION: "WAITING ACCOUNTS",
    COMPLETED: "COMPLETED ✓",
    FAILED: "FAILED",
    CANCELLED: "CANCELLED",
    REVERSED: "REVERSED",
  })[status] || status || "-";
}

// COMPLETE STYLING
const styles = `
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
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
}

.tl-float-return * {
  box-sizing: border-box;
}

.tl-float-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  padding: 14px 16px;
  background: #152639;
  border-left: 3px solid #d9b66c;
  border-bottom: 1px solid #2a3d52;
  font-size: 14px;
}

.tl-float-head span {
  background: #0a1725;
  color: #d9b66c;
  border: 1px solid #65563b;
  border-radius: 7px;
  padding: 6px 9px;
  font-size: 10px;
  font-weight: 850;
  white-space: nowrap;
}

.tl-float-body {
  padding: 14px;
  min-width: 0;
}

.tl-float-body label {
  display: block;
  margin: 0 0 8px;
  color: #c4d0dc;
  font-size: 11px;
  font-weight: 850;
  letter-spacing: .04em;
}

.tl-float-input {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  margin-bottom: 12px;
  padding: 11px 12px;
  background: #0a1725;
  color: #f0f5fa;
  border: 1px solid #40556b;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 750;
  outline: none;
}

.tl-float-input:disabled {
  background: #172638;
  color: #9eafbf;
  cursor: not-allowed;
}

.tl-float-input:focus {
  border-color: #d9b66c;
}

.tl-float-return input[type=number] {
  appearance: textfield;
  -moz-appearance: textfield;
}

.tl-float-return input[type=number]::-webkit-inner-spin-button,
.tl-float-return input[type=number]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.tl-float-preview {
  display: grid;
  grid-template-columns: repeat(3, minmax(0,1fr));
  gap: 8px;
  margin-bottom: 12px;
}

.tl-float-preview-box {
  min-width: 0;
  padding: 11px 7px;
  text-align: center;
  background: #0a1725;
  border: 1px solid #304359;
  border-radius: 8px;
  overflow-wrap: anywhere;
}

.tl-float-preview-box.strong {
  background: #15352f;
  border-color: #307d6c;
}

.tl-float-preview-box span {
  display: block;
  font-size: 9px;
  font-weight: 850;
  color: #91a5b8;
  line-height: 1.4;
}

.tl-float-preview-box strong {
  display: block;
  margin-top: 8px;
  font-size: 14px;
  font-weight: 850;
  font-variant-numeric: tabular-nums;
}

.tl-float-preview-box.strong strong {
  color: #a8ebd1;
}

.tl-float-warning,
.tl-float-notice {
  padding: 10px 12px;
  margin-bottom: 12px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 750;
  line-height: 1.5;
}

.tl-float-warning {
  background: #322a1d;
  color: #ffe3a8;
  border: 1px solid #695638;
}

.tl-float-notice.success {
  background: #10332e;
  color: #a8ebd1;
  border: 1px solid #2a6354;
}

.tl-float-notice.error {
  background: #38202a;
  color: #ffc3ce;
  border: 1px solid #774155;
}

.tl-float-pending {
  display: grid;
  gap: 7px;
  padding: 12px;
  margin-bottom: 12px;
  background: #322a1d;
  border: 1px solid #695638;
  border-radius: 9px;
  color: #f0e4c8;
  font-size: 11px;
}

.tl-float-pending strong {
  color: #ffe3a8;
}

.tl-float-main,
.tl-float-toggle {
  width: 100%;
  min-height: 44px;
  padding: 11px 13px;
  border-radius: 8px;
  font-family: inherit;
  font-size: 12px;
  font-weight: 850;
  cursor: pointer;
}

.tl-float-main {
  background: #1c695d;
  color: white;
  border: 1px solid #2b8b7c;
  margin-bottom: 12px;
}

.tl-float-toggle {
  background: #0a1725;
  color: #c4d0dc;
  border: 1px solid #304359;
  font-size: 10px;
}

.tl-float-return button:disabled {
  opacity: .5;
  cursor: not-allowed;
}

.tl-float-prepared {
  min-width: 0;
  margin: 12px 0;
  padding: 13px;
  background: #132337;
  border: 1px solid #6a593a;
  border-radius: 10px;
}

.tl-float-prepared-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
  font-size: 12px;
}

.tl-float-prepared-head span {
  padding: 6px 8px;
  background: #322a1d;
  color: #ffe3a8;
  border: 1px solid #695638;
  border-radius: 7px;
  font-size: 10px;
  font-weight: 850;
}

.tl-float-detail {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid #2a3d52;
  font-size: 11px;
  line-height: 1.5;
}

.tl-float-detail span {
  flex: 1;
  color: #91a5b8;
}

.tl-float-detail strong {
  flex: 1.2;
  min-width: 0;
  text-align: right;
  overflow-wrap: anywhere;
}

.tl-float-detail strong.highlight {
  color: #d9b66c;
}

.tl-float-prepared label {
  margin-top: 14px;
}

.tl-float-history {
  display: grid;
  gap: 9px;
  margin-top: 10px;
}

.tl-float-history-row {
  padding: 12px;
  background: #0a1725;
  border: 1px solid #304359;
  border-radius: 9px;
}

.tl-float-history-top,
.tl-float-history-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 11px;
}

.tl-float-history-top small {
  display: block;
  margin-top: 5px;
  color: #91a5b8;
}

.tl-float-history-foot {
  color: #91a5b8;
  font-size: 10px;
}

.tl-float-history-row .tl-float-preview {
  margin-top: 11px;
}

.tl-float-status {
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

@container float-panel (max-width:450px) {
  .tl-float-head {
    padding: 12px;
    font-size: 12px;
  }

  .tl-float-body {
    padding: 11px;
  }

  .tl-float-preview {
    gap: 6px;
  }

  .tl-float-preview-box {
    padding: 10px 5px;
  }

  .tl-float-preview-box span {
    font-size: 8px;
  }

  .tl-float-preview-box strong {
    font-size: 11px;
  }

  .tl-float-detail {
    font-size: 10px;
  }
}

@container float-panel (max-width:300px) {
  .tl-float-preview {
    grid-template-columns: repeat(2, minmax(0,1fr));
  }

  .tl-float-preview-box.strong {
    grid-column: 1 / -1;
  }
}
`;
