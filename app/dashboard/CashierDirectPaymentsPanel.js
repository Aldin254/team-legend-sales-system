"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const OPTIONS = [
  ["BANKING", "Banking"],
  ["ELECTRICITY", "Electricity"],
  ["DSTV", "DStv"],
  ["WIFI", "WiFi"],
  ["RENT", "Rent"],
];
const TIERS = Array.from({ length: 10 }, (_, i) => (i + 1) * 500);
const money = (value) => Number(value || 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const panel = { background: "#152639", border: "1px solid #2a3d52", borderLeft: "3px solid #d9b66c", borderRadius: 12, padding: 14, color: "#f0f5fa", marginTop: 10 };
const input = { boxSizing: "border-box", width: "100%", background: "#0a1725", border: "1px solid #40556b", borderRadius: 8, padding: "11px 12px", color: "#f0f5fa", fontSize: 14, minHeight: 44 };
const label = { display: "block", color: "#c4d0dc", fontSize: 12, fontWeight: 750, marginBottom: 6 };

export default function CashierDirectPaymentsPanel({ user, currentShift, category = "BANKING", onPaymentRequested }) {
  const [amount, setAmount] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [reference, setReference] = useState("");
  const [employees, setEmployees] = useState([]);
  const [balance, setBalance] = useState(null);
  const [quote, setQuote] = useState(null);
  const [requests, setRequests] = useState([]);
  const [recentRequest, setRecentRequest] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const requestRef = useRef(false);
  const shiftId = currentShift?.id;
  const token = user?.access_token;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const rpc = useCallback(async (name, args) => {
    if (!url || !key || !token) throw new Error("Payment session unavailable. Sign in again.");
    const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
      method: "POST", cache: "no-store",
      headers: { apikey: key, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
    const raw = await response.text();
    let result;
    try { result = JSON.parse(raw); } catch { result = raw; }
    if (!response.ok) throw new Error(result?.message || result?.details || result?.hint || `Payment service error (${response.status}).`);
    return result;
  }, [url, key, token]);

  const refresh = useCallback(async () => {
    if (!shiftId) return;
    const info = await rpc("tl_direct_payment_available_balance", { p_shift_id: shiftId });
    setBalance(info);
    return info;
  }, [rpc, shiftId]);

  useEffect(() => {
    let alive = true;
    setAmount(""); setEmployeeId(""); setReference(""); setQuote(null); setMessage(""); setBalance(null); setEmployees([]);
    setLoading(true);
    if (!shiftId) { setLoading(false); return () => { alive = false; }; }
    (async () => {
      try {
        const [info, directory] = await Promise.all([
          rpc("tl_direct_payment_available_balance", { p_shift_id: shiftId }),
          rpc("tl_cashier_banking_directory", { p_shift_id: shiftId }),
        ]);
        if (!alive) return;
        setBalance(info);
        setEmployees(Array.isArray(directory?.employees) ? directory.employees : []);
      } catch (e) { if (alive) setMessage(e.message); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [rpc, shiftId]);

  // Read-only request status. Database confirmation is the only settlement path.
  const loadRequests = useCallback(async () => {
    if (!shiftId || !url || !key || !token) return;
    const params = new URLSearchParams({
      select: "id,category,amount,status,requested_at,quoted_transaction_fee,payment_source",
      shift_id: `eq.${shiftId}`,
      payment_source: "eq.CLOSING_BALANCE",
      order: "requested_at.desc",
      limit: "30",
    });
    const response = await fetch(`${url}/rest/v1/savings_payment_requests?${params}`, {
      cache: "no-store", headers: { apikey: key, Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return; // RLS may restrict direct table reads; submission remains valid.
    const rows = await response.json();
    if (Array.isArray(rows)) setRequests(rows);
  }, [shiftId, url, key, token]);
  useEffect(() => {
    setRequests([]); setRecentRequest(null);
    void loadRequests();
    const timer = setInterval(() => void loadRequests(), 15000);
    return () => clearInterval(timer);
  }, [loadRequests]);
  useEffect(() => { setAmount(""); setReference(""); setQuote(null); setMessage(""); }, [category]);
  useEffect(() => { if (!message) return; const timer = setTimeout(() => setMessage(""), 5000); return () => clearTimeout(timer); }, [message]);
  useEffect(() => {
    if (!shiftId || busy) return;
    const timer = setInterval(() => { if (document.visibilityState === "visible") refresh().catch(() => {}); }, 30000);
    return () => clearInterval(timer);
  }, [shiftId, busy, refresh]);

  const numericAmount = Number(amount);
  const validAmount = amount !== "" && Number.isFinite(numericAmount) && numericAmount > 0 && Math.round(numericAmount * 100) === numericAmount * 100 && (category !== "ELECTRICITY" || TIERS.includes(numericAmount));
  const normalizedReference = reference.replace(/\s+/g, "").toUpperCase();
  const available = Number(balance?.available_for_payment);
  const maxTotal = Number.isFinite(available) ? available : 0;
  const isReady = !loading && !!shiftId && String(currentShift?.status).toUpperCase() === "OPEN" && currentShift?.admin_manual_totals !== true;
  const selectedEmployee = employees.find((e) => String(e.employee_id) === String(employeeId));
  const categoryRequests = requests.filter((r) => r.category === category);
  const recentMatch = recentRequest?.category === category
    ? categoryRequests.find((r) => r.id && r.id === recentRequest.id)
    : null;
  const visibleRequests = recentRequest?.category === category && !recentMatch
    ? [recentRequest, ...categoryRequests]
    : categoryRequests;

  async function preview(event) {
    event.preventDefault();
    if (busy || requestRef.current) return;
    if (!validAmount) { setMessage("Enter a valid amount. Electricity requires an exact KES 500–5,000 tier."); return; }
    if (category === "BANKING" && (!selectedEmployee || !/^[A-Z0-9]{8,16}$/.test(normalizedReference))) {
      setMessage("Select an employee and enter a valid 8–16 character M-Pesa reference."); return;
    }
    setBusy(true); setQuote(null); setMessage("");
    try {
      const feeResult = category === "BANKING"
        ? await rpc("tl_payment_fee_for_amount", { p_payment_method: "MPESA_TO_CONSOLIDATED", p_amount: numericAmount })
        : await rpc("tl_cashier_utility_fee_preview", { p_shift_id: shiftId, p_category: category, p_amount: numericAmount });
      if (category !== "BANKING" && (feeResult?.success !== true || String(feeResult?.category).toUpperCase() !== category || Number(feeResult?.payment_amount) !== numericAmount)) throw new Error("Fee quote could not be verified.");
      const fee = Number(category === "BANKING" ? feeResult : feeResult?.transaction_fee);
      if (!Number.isFinite(fee) || fee < 0) throw new Error("Invalid configured fee.");
      const info = await refresh();
      if (numericAmount + fee > Number(info?.available_for_payment)) throw new Error("Insufficient available Closing Balance after the KES 1,000 minimum and other pending requests.");
      setQuote({ category, amount: numericAmount, fee, employeeId, reference: normalizedReference, shiftId });
    } catch (e) { setMessage(e.message); }
    finally { setBusy(false); }
  }

  async function submit() {
    if (!quote || busy || requestRef.current) return;
    if (quote.category !== category || quote.shiftId !== shiftId || Number(amount) !== quote.amount || quote.employeeId !== employeeId || (category === "BANKING" && quote.reference !== normalizedReference)) {
      setQuote(null); setMessage("Review again."); return;
    }
    requestRef.current = true; setBusy(true); setMessage("");
    try {
      const feeResult = category === "BANKING"
        ? await rpc("tl_payment_fee_for_amount", { p_payment_method: "MPESA_TO_CONSOLIDATED", p_amount: quote.amount })
        : await rpc("tl_cashier_utility_fee_preview", { p_shift_id: shiftId, p_category: category, p_amount: quote.amount });
      const currentFee = Number(category === "BANKING" ? feeResult : feeResult?.transaction_fee);
      if (!Number.isFinite(currentFee) || currentFee !== quote.fee) throw new Error("Transaction fee changed. Review a fresh quote before submitting.");
      const result = category === "BANKING"
        ? await rpc("tl_cashier_request_direct_banking", { p_shift_id: shiftId, p_employee_id: quote.employeeId, p_amount: quote.amount, p_mpesa_reference: quote.reference })
        : await rpc("tl_cashier_request_direct_payment", { p_shift_id: shiftId, p_category: category, p_amount: quote.amount });
      setQuote(null); setAmount(""); setReference("");
      setRecentRequest({ id: result?.request_id || result?.id || null, category: quote.category, amount: quote.amount, status: "PENDING" });
      void loadRequests();
      const savedFee = result?.quoted_transaction_fee;
      setMessage(savedFee == null || Number(savedFee) !== quote.fee
        ? "Fee mismatch. Contact Admin."
        : "PENDING");
      await refresh();
      onPaymentRequested?.();
    } catch (e) { setQuote(null); setMessage(e.message); }
    finally { setBusy(false); requestRef.current = false; }
  }

  return (
    <section style={panel}>
      <div style={{ fontSize: 13, fontWeight: 850, color: "#d9b66c", marginBottom: 12 }}>
        {OPTIONS.find(([key]) => key === category)?.[1] || "Direct Payment"}
      </div>
      <form onSubmit={preview} style={{ display: "grid", gap: 12 }}>
        {category === "BANKING" && <div><label style={label}>EMPLOYEE</label><select style={input} value={employeeId} disabled={busy} onChange={(e) => { setEmployeeId(e.target.value); setQuote(null); }}><option value="">Select employee</option>{employees.map((e) => <option key={e.employee_id} value={e.employee_id}>{e.employee_name || e.full_name || "Employee"}{e.shop_name ? ` · ${e.shop_name}` : ""}</option>)}</select></div>}
        <div><label style={label}>AMOUNT (KES)</label>{category === "ELECTRICITY" ? <select style={input} value={amount} disabled={busy} onChange={(e) => { setAmount(e.target.value); setQuote(null); }}><option value="">Select electricity amount</option>{TIERS.map((tier) => <option key={tier} value={tier}>KES {money(tier)}</option>)}</select> : <input style={input} type="number" min="0.01" step="0.01" placeholder="Amount" value={amount} disabled={busy} onChange={(e) => { setAmount(e.target.value); setQuote(null); }} />}</div>
        {category === "BANKING" && <div><label style={label}>CASHIER M-PESA REFERENCE</label><input style={input} value={reference} maxLength={16} placeholder="8–16 letters or numbers" disabled={busy} onChange={(e) => { setReference(e.target.value.toUpperCase().replace(/\s+/g, "")); setQuote(null); }} /></div>}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", fontSize: 12 }}><span>Closing: <strong style={{ color: "#d9b66c" }}>KES {money(balance?.closing_balance ?? currentShift?.closing_balance)}</strong></span><span>Available: <strong style={{ color: "#72d8af" }}>KES {money(maxTotal)}</strong></span></div>

        {!quote && <button type="submit" disabled={!isReady || busy || !validAmount || (category === "BANKING" && (!employeeId || !/^[A-Z0-9]{8,16}$/.test(normalizedReference)))} style={{ ...input, background: "#174e70", cursor: "pointer", fontWeight: 800, opacity: !isReady || busy ? 0.6 : 1 }}>{busy ? "CHECKING..." : "REVIEW PAYMENT"}</button>}
      </form>
      {quote && <div style={{ marginTop: 12, border: "1px solid #d9b66c", borderRadius: 8, padding: 12, display: "grid", gap: 8 }}><strong>CONFIRM REQUEST</strong>{category === "BANKING" && <div>Employee: {selectedEmployee?.employee_name || selectedEmployee?.full_name}</div>}<div>Amount: KES {money(quote.amount)}</div><div>Fee: KES {money(quote.fee)}</div><strong>Total: KES {money(quote.amount + quote.fee)}</strong><div style={{ display: "flex", gap: 8 }}><button type="button" disabled={busy} onClick={() => setQuote(null)} style={{ ...input, flex: 1, cursor: "pointer" }}>CANCEL</button><button type="button" disabled={busy} onClick={submit} style={{ ...input, flex: 1, background: "#087e62", fontWeight: 800, cursor: "pointer" }}>{busy ? "SUBMITTING..." : "SUBMIT REQUEST"}</button></div></div>}
      {visibleRequests.length > 0 && <div style={{ marginTop: 12, borderTop: "1px solid #40556b", paddingTop: 10, display: "grid", gap: 8 }}>
        {visibleRequests.slice(0, 6).map((r, i) => {
          const state = String(r.status || "PENDING").toUpperCase();
          const pending = state === "PENDING" || state === "PROCESSING";
          const approved = state === "CONFIRMED";
          const statusLabel = pending ? "PENDING APPROVAL" : approved ? "APPROVED" : state;
          const statusColor = pending ? "#d9b66c" : approved ? "#72d8af" : "#ff9e9e";
          return <div key={r.id || i} style={{ border: "1px solid #40556b", borderRadius: 7, padding: "10px 12px", background: "#112b40", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <strong style={{ color: statusColor, fontSize: 14, letterSpacing: 0.3 }}>{statusLabel}</strong>
            <span style={{ color: "#dce7ee", fontSize: 13, fontWeight: 750 }}>KES {money(r.amount)}</span>
          </div>;
        })}
      </div>}
      {message && <div role="status" style={{ marginTop: 12, color: /submitted/i.test(message) ? "#72d8af" : "#ff9e9e", fontSize: 12 }}>{message}</div>}
    </section>
  );
}
