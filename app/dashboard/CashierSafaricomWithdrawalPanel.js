"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

export default function CashierSafaricomWithdrawalPanel({
  user,
  currentShift,
  onWithdrawalChanged,
}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const token = user?.access_token || null;
  const shiftId = currentShift?.id || null;

  const shiftStatus = String(
    currentShift?.status || ""
  ).toUpperCase();

  const shiftClosed = shiftStatus !== "OPEN";

  const [amount, setAmount] = useState("");
  const [fee, setFee] = useState(null);
  const [feeLoading, setFeeLoading] = useState(false);
  const [feeError, setFeeError] = useState(false);

  const [receipt, setReceipt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const [notice, setNotice] = useState(null);

  const busyRef = useRef(false);
  const historyRequestRef = useRef(0);
  const historyBusyRef = useRef(false);
  const historyAbortRef = useRef(null);
  const historyScopeRef = useRef(null);
  historyScopeRef.current = JSON.stringify([shiftId, token]);

  const HISTORY_REFRESH_MS = 30000;

  const notify = useCallback((message, type = "error") => {
    setNotice({ message, type });
  }, []);

  useEffect(() => {
    if (!notice) return;

    const timer = setTimeout(() => {
      setNotice(null);
    }, 5000);

    return () => clearTimeout(timer);
  }, [notice]);

  const callRpc = useCallback(
    async (name, body = {}, signal) => {
      if (!url || !anonKey || !token) {
        throw new Error(
          "Session expired. Please log in again."
        );
      }

      const response = await fetch(
        `${url}/rest/v1/rpc/${name}`,
        {
          method: "POST",
          cache: "no-store",
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
          ...(signal ? { signal } : {}),
        }
      );

      const result = await safeJson(response);

      if (!response.ok) {
        throw new Error(
          result?.message ||
          result?.details ||
          result?.hint ||
          "Transaction failed."
        );
      }

      return result;
    },
    [url, anonKey, token]
  );

  const loadHistory = useCallback(
    async ({ silent = false } = {}) => {
      if (!shiftId || !token) {
        setHistory([]);
        setHistoryLoading(false);
        return;
      }

      // Do not overlap background history requests. The next scheduled
      // refresh will pick up changes after the current request finishes.
      if (historyBusyRef.current) return;
      historyBusyRef.current = true;

      const expectedScope = JSON.stringify([shiftId, token]);
      const requestId = ++historyRequestRef.current;
      const controller = new AbortController();
      historyAbortRef.current = controller;
      const timeout = setTimeout(() => controller.abort(), 12000);
      const isCurrent = () =>
        historyRequestRef.current === requestId &&
        historyScopeRef.current === expectedScope &&
        !controller.signal.aborted;

      try {
        if (!silent) setHistoryLoading(true);

        const result = await callRpc(
          "tl_cashier_withdrawal_history",
          { p_shift_id: shiftId },
          controller.signal
        );

        if (!isCurrent()) return;
        setHistory(Array.isArray(result) ? result : []);
      } catch (error) {
        if (isCurrent() && !silent) {
          notify(error?.message || "Unable to load transactions.");
        }
      } finally {
        clearTimeout(timeout);
        if (historyRequestRef.current === requestId) {
          historyBusyRef.current = false;
          if (historyAbortRef.current === controller) {
            historyAbortRef.current = null;
          }
          if (!silent && historyScopeRef.current === expectedScope) {
            setHistoryLoading(false);
          }
        }
      }
    },
    [shiftId, token, callRpc, notify]
  );

  // Clear private history when switching shifts or sessions.
  useEffect(() => {
    setAmount("");
    setFee(null);
    setFeeError(false);
    setReceipt("");
    setHistory([]);
    setHistoryOpen(false);
    setHistoryLoading(false);
    historyRequestRef.current += 1;
    historyBusyRef.current = false;
    if (historyAbortRef.current) {
      historyAbortRef.current.abort();
      historyAbortRef.current = null;
    }
  }, [shiftId, token]);

  // Initial load, 30-second visible-tab polling, and refresh on return.
  useEffect(() => {
    void loadHistory();

    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") {
        void loadHistory({ silent: true });
      }
    };

    const timer = setInterval(refreshIfVisible, HISTORY_REFRESH_MS);
    document.addEventListener("visibilitychange", refreshIfVisible);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshIfVisible);
      historyRequestRef.current += 1;
      historyBusyRef.current = false;
      if (historyAbortRef.current) {
        historyAbortRef.current.abort();
        historyAbortRef.current = null;
      }
    };
  }, [loadHistory]);

  // Automatic withdrawal fee.
  useEffect(() => {
    const numericAmount = Number(amount);

    if (
      !amount ||
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0 ||
      !/^\d+(\.\d{1,2})?$/.test(amount)
    ) {
      setFee(null);
      setFeeError(false);
      setFeeLoading(false);
      return;
    }

    let cancelled = false;

    setFee(null);
    setFeeError(false);
    setFeeLoading(true);

    const timer = setTimeout(async () => {
      try {
        const result = await callRpc(
          "tl_cashier_withdrawal_fee",
          {
            p_amount: numericAmount,
          }
        );

        if (cancelled) return;

        const value = Number(result);

        if (
          !Number.isFinite(value) ||
          value < 0
        ) {
          throw new Error("Invalid tariff.");
        }

        setFee(value);
        setFeeError(false);
      } catch (error) {
        if (!cancelled) {
          setFee(null);
          setFeeError(true);
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
  }, [amount, callRpc]);

  const numericAmount = Number(amount);

  const amountValid =
    /^\d+(\.\d{1,2})?$/.test(amount) &&
    Number.isFinite(numericAmount) &&
    numericAmount > 0;

  const cleanReceipt = receipt
    .trim()
    .toUpperCase();

  const receiptValid =
    /^[A-Z0-9]{6,30}$/.test(cleanReceipt);

  const canSubmit =
    Boolean(shiftId) &&
    !shiftClosed &&
    !submitting &&
    !feeLoading &&
    !feeError &&
    amountValid &&
    fee !== null &&
    receiptValid;

  async function submitWithdrawal() {
    if (!canSubmit || busyRef.current) {
      return;
    }

    const confirmed = window.confirm(
      `CONFIRM SAFARICOM WITHDRAWAL\n\n` +
      `Amount: KES ${money(numericAmount)}\n` +
      `Fee: KES ${money(fee)}\n` +
      `Receipt: ${cleanReceipt}`
    );

    if (!confirmed) return;

    busyRef.current = true;

    try {
      setSubmitting(true);
      setNotice(null);

      const result = await callRpc(
        "tl_cashier_record_withdrawal",
        {
          p_shift_id: shiftId,
          p_amount: numericAmount,
          p_receipt_no: cleanReceipt,
        }
      );

      setAmount("");
      setFee(null);
      setFeeError(false);
      setReceipt("");
      setHistoryOpen(true);

      notify(
        `Withdrawal recorded. Fee: KES ${money(
          result?.fee ?? fee
        )}`,
        "success"
      );

      await loadHistory({ silent: true });

      if (
        typeof onWithdrawalChanged === "function"
      ) {
        onWithdrawalChanged();
      }
    } catch (error) {
      notify(
        error?.message ||
        "Unable to record withdrawal."
      );
    } finally {
      busyRef.current = false;
      setSubmitting(false);
    }
  }

  if (!currentShift) return null;

  return (
    <section className="tl-sw-panel">
      <style>{styles}</style>

      <div className="tl-sw-header">
        <strong>SAFARICOM WITHDRAWAL</strong>

        <span>
          {history.length} TRANSACTIONS
        </span>
      </div>

      <div className="tl-sw-body">
        {shiftClosed && (
          <div className="tl-sw-warning">
            SHIFT CLOSED
          </div>
        )}

        <label htmlFor="tl-sw-amount">
          WITHDRAWAL AMOUNT (KES)
        </label>

        <input
          id="tl-sw-amount"
          className="tl-sw-input"
          type="number"
          min="0.01"
          step="0.01"
          inputMode="decimal"
          placeholder="Enter amount"
          value={amount}
          disabled={shiftClosed || submitting}
          onChange={(e) => {
            setAmount(e.target.value);
            setNotice(null);
          }}
        />

        <div className="tl-sw-summary">
          <div className="tl-sw-stat">
            <span>WITHDRAWAL</span>

            <strong>
              KES {money(numericAmount)}
            </strong>
          </div>

          <div className="tl-sw-stat accent">
            <span>TRANSACTION FEE</span>

            <strong>
              {feeLoading
                ? "..."
                : feeError
                ? "UNAVAILABLE"
                : fee === null
                ? "—"
                : `KES ${money(fee)}`}
            </strong>
          </div>
        </div>

        <label htmlFor="tl-sw-receipt">
          M-PESA RECEIPT
        </label>

        <input
          id="tl-sw-receipt"
          className="tl-sw-input"
          type="text"
          maxLength={30}
          autoComplete="off"
          placeholder="Receipt number"
          value={receipt}
          disabled={shiftClosed || submitting}
          onChange={(e) => {
            setReceipt(
              e.target.value
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, "")
            );

            setNotice(null);
          }}
        />

        {notice && (
          <div
            role="status"
            aria-live="polite"
            className={`tl-sw-notice ${notice.type}`}
          >
            {notice.message}
          </div>
        )}

        <button
          className="tl-sw-submit"
          type="button"
          disabled={!canSubmit}
          onClick={submitWithdrawal}
        >
          {submitting
            ? "PROCESSING..."
            : "CONFIRM WITHDRAWAL"}
        </button>

        <button
          className="tl-sw-toggle"
          type="button"
          aria-expanded={historyOpen}
          onClick={() => {
            setHistoryOpen(!historyOpen);
          }}
        >
          {historyOpen ? "▲" : "▼"}{" "}
          TRANSACTION HISTORY
        </button>

        {historyOpen && (
          <div className="tl-sw-history">
            {historyLoading ? (
              <div className="tl-sw-empty">
                Loading...
              </div>
            ) : history.length === 0 ? (
              <div className="tl-sw-empty">
                No transactions
              </div>
            ) : (
              history.map((item) => (
                <div
                  className="tl-sw-history-item"
                  key={item.id}
                >
                  <div className="tl-sw-history-top">
                    <strong>
                      KES {money(item.amount)}
                    </strong>

                    <span>
                      {formatDate(item.created_at)}
                    </span>
                  </div>

                  <div className="tl-sw-history-bottom">
                    <span>
                      {item.receipt_no}
                    </span>

                    <strong>
                      FEE KES {money(item.fee)}
                    </strong>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </section>
  );
}

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

function formatDate(value) {
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

const styles = `
.tl-sw-panel {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  container-type: inline-size;
  background: #101f30;
  color: #f0f5fa;
  border: 1px solid #2a3d52;
  border-radius: 12px;
  overflow: hidden;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
}

.tl-sw-panel * {
  box-sizing: border-box;
}

.tl-sw-header {
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

.tl-sw-header span {
  background: #0a1725;
  color: #d9b66c;
  border: 1px solid #65563b;
  border-radius: 7px;
  padding: 6px 9px;
  font-size: 10px;
  font-weight: 850;
}

.tl-sw-body {
  padding: 14px;
}

.tl-sw-body label {
  display: block;
  margin: 0 0 8px;
  color: #c4d0dc;
  font-size: 11px;
  font-weight: 850;
  letter-spacing: .04em;
}

.tl-sw-input {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  margin-bottom: 13px;
  padding: 11px 12px;
  background: #0a1725;
  color: #f0f5fa;
  border: 1px solid #40556b;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 750;
  outline: none;
}

.tl-sw-input:focus {
  border-color: #d9b66c;
}

.tl-sw-input:disabled {
  opacity: .5;
  cursor: not-allowed;
}

.tl-sw-panel input[type=number] {
  appearance: textfield;
  -moz-appearance: textfield;
}

.tl-sw-panel input[type=number]::-webkit-inner-spin-button,
.tl-sw-panel input[type=number]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.tl-sw-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px;
  margin-bottom: 14px;
}

.tl-sw-stat {
  min-width: 0;
  padding: 13px 10px;
  background: #0a1725;
  border: 1px solid #304359;
  border-radius: 9px;
  text-align: center;
}

.tl-sw-stat.accent {
  background: #15352f;
  border-color: #307d6c;
}

.tl-sw-stat span {
  display: block;
  color: #91a5b8;
  font-size: 9px;
  font-weight: 850;
  line-height: 1.4;
}

.tl-sw-stat strong {
  display: block;
  margin-top: 9px;
  font-size: 16px;
  font-weight: 850;
  overflow-wrap: anywhere;
  font-variant-numeric: tabular-nums;
}

.tl-sw-stat.accent strong {
  color: #a8ebd1;
}

.tl-sw-submit,
.tl-sw-toggle {
  width: 100%;
  min-height: 44px;
  padding: 11px 13px;
  border-radius: 8px;
  font-family: inherit;
  font-size: 12px;
  font-weight: 850;
  cursor: pointer;
}

.tl-sw-submit {
  margin-bottom: 12px;
  background: #1c695d;
  color: white;
  border: 1px solid #2b8b7c;
}

.tl-sw-toggle {
  background: #0a1725;
  color: #c4d0dc;
  border: 1px solid #304359;
  font-size: 10px;
}

.tl-sw-panel button:disabled {
  opacity: .5;
  cursor: not-allowed;
}

.tl-sw-warning,
.tl-sw-notice {
  padding: 10px 12px;
  margin-bottom: 12px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 750;
}

.tl-sw-warning {
  background: #322a1d;
  color: #ffe3a8;
  border: 1px solid #695638;
}

.tl-sw-notice.success {
  background: #10332e;
  color: #a8ebd1;
  border: 1px solid #2a6354;
}

.tl-sw-notice.error {
  background: #38202a;
  color: #ffc3ce;
  border: 1px solid #774155;
}

.tl-sw-history {
  display: grid;
  gap: 8px;
  margin-top: 10px;
}

.tl-sw-history-item {
  padding: 12px;
  background: #0a1725;
  border: 1px solid #304359;
  border-radius: 9px;
}

.tl-sw-history-top,
.tl-sw-history-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}

.tl-sw-history-top {
  font-size: 12px;
}

.tl-sw-history-top span {
  color: #91a5b8;
  font-size: 10px;
}

.tl-sw-history-bottom {
  margin-top: 10px;
  font-size: 10px;
  color: #91a5b8;
}

.tl-sw-history-bottom strong {
  color: #d9b66c;
}

.tl-sw-empty {
  padding: 15px;
  text-align: center;
  color: #91a5b8;
  font-size: 11px;
}

@container (max-width: 300px) {
  .tl-sw-header {
    padding: 12px;
    font-size: 12px;
  }

  .tl-sw-body {
    padding: 11px;
  }

  .tl-sw-stat {
    padding: 11px 6px;
  }

  .tl-sw-stat strong {
    font-size: 12px;
  }

  .tl-sw-stat span {
    font-size: 8px;
  }
}
`;
