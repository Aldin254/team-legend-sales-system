"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const READING_LABELS = {
  OPENING: "Opening",
  CLOSING: "Closing",
  HANDOVER_9PM: "9 PM handover",
  MIDNIGHT_CLOSE: "11:59 PM closing",
  CLOSING_9AM: "9 AM closing",
};

export default function AdminRecoveryReportEditor({ user, recovery, shop }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [bfInput, setBfInput] = useState("");
  const [readingInputs, setReadingInputs] = useState({});
  const [expenseInputs, setExpenseInputs] = useState({});
  const [newExpense, setNewExpense] = useState({ description: "", amount: "" });
  const [newExpenseId, setNewExpenseId] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState("error");
  const [lastComparison, setLastComparison] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const busyRef = useRef(false);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = user?.access_token || null;
  const sessionId = recovery?.session_id || null;
  const shiftId = recovery?.target_shift_id || null;
  const shopId = shop?.id || null;
  const shopType = String(shop?.shop_type || "").trim().toUpperCase();

  const headers = useMemo(() => ({
    apikey: anonKey,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }), [anonKey, token]);

  const loadReport = useCallback(async () => {
    if (!sessionId || !shiftId || !shopId || !supabaseUrl || !anonKey || !token) {
      throw new Error("Recovery session, shop, or Admin login is missing.");
    }

    const base = `${supabaseUrl}/rest/v1`;
    const id = encodeURIComponent(shiftId);
    const sid = encodeURIComponent(shopId);

    const requests = [
      `${base}/shifts?id=eq.${id}&shop_id=eq.${sid}&select=*&limit=1`,
      `${base}/shop_platforms?shop_id=eq.${sid}` +
        `&select=id,platform_name,is_active,display_order&order=display_order.asc`,
      `${base}/platform_readings?shift_id=eq.${id}` +
        `&select=id,platform_id,reading_kind,reading_value,recorded_at`,
      `${base}/shift_income_entries?shift_id=eq.${id}` +
        `&select=id,entry_type,description,amount,created_at&order=created_at.asc`,
      `${base}/expenses?shift_id=eq.${id}` +
        `&select=id,description,amount,source_type,source_record_id,is_private,created_at` +
        `&order=created_at.asc`,
    ];

    const responses = await Promise.all(requests.map((url) =>
      fetch(url, { method: "GET", headers, cache: "no-store" })
    ));

    const values = await Promise.all(responses.map(safeJson));
    const errors = [
      "Unable to load the selected shift.",
      "Unable to load shop platforms.",
      "Unable to load platform readings.",
      "Unable to load float entries.",
      "Unable to load expenses.",
    ];

    for (let i = 0; i < responses.length; i += 1) {
      if (!responses[i].ok) {
        throw new Error(values[i]?.message || values[i]?.details || errors[i]);
      }
    }

    const shift = Array.isArray(values[0]) ? values[0][0] : null;
    if (!shift || String(shift.shop_id) !== String(shopId)) {
      throw new Error("Historical shift not found in this shop.");
    }

    const readings = Array.isArray(values[2]) ? values[2] : [];
    const allPlatforms = Array.isArray(values[1]) ? values[1] : [];
    const usedIds = new Set(readings.map((row) => row.platform_id));

    const platforms = allPlatforms.filter(
      (p) => p.is_active || usedIds.has(p.id)
    );

    return {
      shift,
      platforms,
      readings,
      floats: Array.isArray(values[3]) ? values[3] : [],
      expenses: Array.isArray(values[4]) ? values[4] : [],
    };
  }, [sessionId, shiftId, shopId, supabaseUrl, anonKey, token, headers]);

  useEffect(() => {
    let cancelled = false;

    setData(null);
    setError("");
    setLoading(true);

    loadReport()
      .then((fresh) => {
        if (cancelled) return;

        setData(fresh);
        setBfInput(String(fresh.shift.opening_balance ?? 0));

        const nextReadings = {};
        for (const row of fresh.readings) {
          nextReadings[readingKey(row.platform_id, row.reading_kind)] =
            String(row.reading_value ?? "");
        }
        setReadingInputs(nextReadings);

        const nextExpenses = {};
        for (const expense of fresh.expenses.filter(isEditableExpense)) {
          nextExpenses[expense.id] = {
            description: expense.description || "",
            amount: String(expense.amount ?? ""),
          };
        }
        setExpenseInputs(nextExpenses);
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message || "Unable to load report.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [loadReport, reloadKey]);

  useEffect(() => {
    setNotice("");
    setLastComparison(null);
    setReason("");
    setNewExpense({ description: "", amount: "" });
    setNewExpenseId("");
  }, [sessionId, shiftId]);

  const shift = data?.shift || null;

  const readingByKey = useMemo(() => {
    const map = new Map();
    for (const row of data?.readings || []) {
      map.set(readingKey(row.platform_id, row.reading_kind), row);
    }
    return map;
  }, [data]);

  const manualExpenses = (data?.expenses || []).filter(isEditableExpense);
  const protectedExpenses = (data?.expenses || []).filter(
    (e) => !isEditableExpense(e)
  );

  const companyFloats = (data?.floats || []).filter(
    (e) => e.entry_type === "COMPANY_FLOAT"
  );
  const mshwariFloats = (data?.floats || []).filter(
    (e) => e.entry_type === "MSHWARI_FLOAT"
  );

  async function applyCorrection(action, payload, confirmation) {
    if (busyRef.current || !shift) return false;

    if (reason.trim().length < 10) {
      setNotice("Enter a correction reason of at least 10 characters.");
      setNoticeType("error");
      return false;
    }

    if (confirmation && !window.confirm(confirmation)) return false;

    busyRef.current = true;
    setBusy(true);
    setNotice("");
    setLastComparison(null);

    try {
      const response = await fetch(
        `${supabaseUrl}/rest/v1/rpc/tl_admin_apply_recovery_correction`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            p_session_id: sessionId,
            p_action: action,
            p_reason: reason.trim(),
            p_data: payload,
          }),
        }
      );

      const result = await safeJson(response);

      if (!response.ok || result?.ok !== true) {
        throw new Error(
          result?.message || result?.details || "Correction not confirmed."
        );
      }

      setLastComparison(result);
      setNotice("Correction saved. Totals recalculated and Admin audit recorded.");
      setNoticeType("success");
      setReloadKey((value) => value + 1);
      return true;
    } catch (e) {
      setNotice(e?.message || "Unable to save correction. Refresh before retrying.");
      setNoticeType("error");
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function saveBF() {
    const value = parseMoney(bfInput);
    if (value === null) {
      setNotice("Enter a valid signed Balance B/F.");
      setNoticeType("error");
      return;
    }
    await applyCorrection("SET_BF", { value }, "Save this Balance B/F correction?");
  }

  async function saveReading(platform, kind) {
    const key = readingKey(platform.id, kind);
    const value = parseMoney(readingInputs[key]);

    if (value === null) {
      setNotice(
        `Enter a valid signed ${READING_LABELS[kind]} reading for ${platform.platform_name}.`
      );
      setNoticeType("error");
      return;
    }

    await applyCorrection(
      "SET_READING",
      { platform_id: platform.id, reading_kind: kind, value },
      `Save ${READING_LABELS[kind]} = ${money(value)} for ${platform.platform_name}?`
    );
  }

  async function saveExpense(expense) {
    const input = expenseInputs[expense.id] || {};
    const amount = parseMoney(input.amount);
    const description = String(input.description || "").trim();

    if (!description || amount === null || amount <= 0) {
      setNotice("Manual expense requires a description and positive amount.");
      setNoticeType("error");
      return;
    }

    await applyCorrection(
      "SAVE_MANUAL_EXPENSE",
      { expense_id: expense.id, description, amount },
      `Update manual expense: ${description} (KES ${money(amount)})?`
    );
  }

  async function addExpense() {
    const description = newExpense.description.trim();
    const amount = parseMoney(newExpense.amount);

    if (!description || amount === null || amount <= 0) {
      setNotice("Enter a new expense description and positive amount.");
      setNoticeType("error");
      return;
    }

    const id = newExpenseId || globalThis.crypto?.randomUUID?.();

    if (!id) {
      setNotice("This browser cannot create a unique expense ID securely.");
      setNoticeType("error");
      return;
    }

    setNewExpenseId(id);

    const success = await applyCorrection(
      "SAVE_MANUAL_EXPENSE",
      { create: true, expense_id: id, description, amount },
      `Add new manual expense: ${description} (KES ${money(amount)})?`
    );

    if (success) {
      setNewExpense({ description: "", amount: "" });
      setNewExpenseId("");
    }
  }

  async function deleteExpense(expense) {
    await applyCorrection(
      "DELETE_MANUAL_EXPENSE",
      { expense_id: expense.id },
      `DELETE manual expense "${expense.description}"? This is audited.`
    );
  }

  if (!sessionId || !shiftId || !shopId) return null;
  return (
    <section style={panelStyle}>
      <div style={headingStyle}>RECOVERY REPORT — ADMIN CORRECTIONS</div>

      <div style={contentStyle}>
        <p style={mutedStyle}>
          Exact historical shift: {recovery.target_shift_name || shift?.shift_name || "Shift"} ·{" "}
          {recovery.target_business_date || shift?.business_date || "-"} ·{" "}
          <code>{String(shiftId).slice(-8)}</code>
        </p>

        {loading ? <p>Loading cashier report...</p> : null}
        {error && <p style={noticeStyle(false)} role="alert">{error}</p>}

        {shift && !loading && !error && (
          <>
            <div style={statsStyle}>
              <Stat title="SHOP" value={shop.shop_name} />
              <Stat title="CASHIER" value={shift.cashier_name || "-"} />
              <Stat title="STATUS" value={shift.status} />
              <Stat title="DATE" value={shift.business_date} />
            </div>

            <label style={labelStyle}>
              CORRECTION REASON — REQUIRED FOR EACH SAVE
            </label>
            <textarea
              rows={2}
              style={inputStyle}
              value={reason}
              disabled={busy}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain the mistake being corrected (minimum 10 characters)"
            />

            {notice && (
              <div role="alert" style={noticeStyle(noticeType === "success")}>
                {notice}
              </div>
            )}

            {lastComparison?.return_shift_balance_difference != null &&
              Math.abs(Number(lastComparison.return_shift_balance_difference)) >= 0.005 && (
                <div style={warningStyle}>
                  Carry-forward review: the corrected closing balance differs from the
                  selected return shift's B/F by KES{" "}
                  {money(lastComparison.return_shift_balance_difference)}.
                  This is a comparison, not an automatic adjustment; the return shift
                  may not be the immediate successor. Review before ending recovery.
                </div>
              )}

            {/* INCOME */}

            <h3 style={sectionStyle}>INCOME STATEMENT</h3>

            <div style={rowStyle}>
              <div>
                <strong>Balance B/F</strong>
                <small style={smallStyle}>Admin editable · signed</small>
              </div>

              <input
                type="number"
                step="0.01"
                value={bfInput}
                disabled={busy}
                onChange={(e) => setBfInput(e.target.value)}
                style={numberStyle}
              />

              <button
                type="button"
                onClick={saveBF}
                disabled={busy}
                style={saveStyle}
              >
                SAVE B/F
              </button>
            </div>

            <div style={twoColumnStyle}>
              <FloatPanel
                title="COMPANY FLOAT — PROTECTED P2P"
                entries={companyFloats}
              />
              <FloatPanel
                title="M-SHWARI FLOAT — PROTECTED P2P"
                entries={mshwariFloats}
              />
            </div>

            {/* PLATFORM SALES */}

            <h3 style={sectionStyle}>PLATFORM SALES</h3>

            <p style={mutedStyle}>
              Save each correction separately. Saved values and totals refresh
              automatically. Negative, zero and positive platform readings are valid.
            </p>

            {data.platforms.length === 0 && (
              <p>No platforms found for this shift.</p>
            )}

            {data.platforms.map((platform) => {
              const kinds = stagesFor(
                shopType,
                shift.shift_name,
                platform.platform_name
              );

              const savedOutput = platformOutput(
                platform.id,
                platform.platform_name,
                kinds,
                readingByKey
              );

              return (
                <div key={platform.id} style={platformStyle}>
                  <strong>{platform.platform_name}</strong>

                  {platform.is_active === false && (
                    <small style={smallStyle}>
                      Inactive platform (existing readings only)
                    </small>
                  )}

                  {kinds.length === 0 && (
                    <small style={smallStyle}>
                      Legacy shift: reading correction unavailable
                    </small>
                  )}

                  <div style={readingGridStyle}>
                    {kinds.map((kind) => {
                      const key = readingKey(platform.id, kind);
                      const saved = readingByKey.get(key);

                      return (
                        <div key={key} style={readingBoxStyle}>
                          <label style={labelStyle}>
                            {READING_LABELS[kind]}
                          </label>

                          <input
                            type="number"
                            step="0.01"
                            style={inputStyle}
                            disabled={
                              busy ||
                              (platform.is_active === false && !saved)
                            }
                            value={readingInputs[key] ?? ""}
                            onChange={(e) =>
                              setReadingInputs((old) => ({
                                ...old,
                                [key]: e.target.value,
                              }))
                            }
                            placeholder={saved ? "Saved" : "Missing"}
                          />

                          <button
                            type="button"
                            style={saveStyle}
                            disabled={
                              busy ||
                              (platform.is_active === false && !saved)
                            }
                            onClick={() => saveReading(platform, kind)}
                          >
                            {saved ? "UPDATE READING" : "SAVE READING"}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div style={mutedStyle}>
                    Saved platform output:{" "}
                    {savedOutput === null
                      ? "Incomplete"
                      : `KES ${money(savedOutput)}`}
                  </div>
                </div>
              );
            })}

            {/* MANUAL EXPENSES */}

            <h3 style={sectionStyle}>MANUAL CASHIER EXPENSES</h3>

            <p style={mutedStyle}>
              Only unlinked, public MANUAL expenses can be edited or deleted.
              Savings, Banking, salary and automated expenses remain protected.
            </p>

            {manualExpenses.length === 0 && (
              <p style={mutedStyle}>No manual expenses yet.</p>
            )}

            {manualExpenses.map((expense) => {
              const input = expenseInputs[expense.id] || {
                description: "",
                amount: "",
              };

              return (
                <div key={expense.id} style={expenseRowStyle}>
                  <input
                    style={inputStyle}
                    aria-label="Expense description"
                    value={input.description}
                    disabled={busy}
                    onChange={(e) =>
                      setExpenseInputs((old) => ({
                        ...old,
                        [expense.id]: {
                          ...input,
                          description: e.target.value,
                        },
                      }))
                    }
                  />

                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    style={inputStyle}
                    aria-label="Expense amount"
                    value={input.amount}
                    disabled={busy}
                    onChange={(e) =>
                      setExpenseInputs((old) => ({
                        ...old,
                        [expense.id]: {
                          ...input,
                          amount: e.target.value,
                        },
                      }))
                    }
                  />

                  <button
                    type="button"
                    style={saveStyle}
                    disabled={busy}
                    onClick={() => saveExpense(expense)}
                  >
                    SAVE
                  </button>

                  <button
                    type="button"
                    style={deleteStyle}
                    disabled={busy}
                    onClick={() => deleteExpense(expense)}
                  >
                    DELETE
                  </button>
                </div>
              );
            })}

            <div style={expenseRowStyle}>
              <input
                style={inputStyle}
                placeholder="New manual expense"
                disabled={busy}
                value={newExpense.description}
                onChange={(e) =>
                  setNewExpense((old) => ({
                    ...old,
                    description: e.target.value,
                  }))
                }
              />

              <input
                type="number"
                step="0.01"
                min="0"
                style={inputStyle}
                placeholder="Amount"
                disabled={busy}
                value={newExpense.amount}
                onChange={(e) =>
                  setNewExpense((old) => ({
                    ...old,
                    amount: e.target.value,
                  }))
                }
              />

              <button
                type="button"
                style={saveStyle}
                disabled={busy}
                onClick={addExpense}
              >
                ADD EXPENSE
              </button>
            </div>

            <div style={mutedStyle}>
              {protectedExpenses.length} protected expense records:
              KES {money(sumAmount(protectedExpenses))} total.
            </div>

            {/* AUTOMATIC SUMMARY */}

            <h3 style={sectionStyle}>
              AUTOMATIC FINANCIAL SUMMARY — READ ONLY
            </h3>

            <div style={statsStyle}>
              <Stat
                title="TOTAL FLOAT"
                value={`KES ${money(
                  sumAmount(companyFloats) + sumAmount(mshwariFloats)
                )}`}
              />
              <Stat
                title="PLATFORM OUTPUT"
                value={`KES ${money(shift.total_output)}`}
              />
              <Stat
                title="TOTAL EXPENSES"
                value={`KES ${money(shift.total_expenses)}`}
              />
              <Stat
                title="NET INCOME"
                value={`KES ${money(shift.net_income)}`}
              />
              <Stat
                title="CLOSING BALANCE"
                value={`KES ${money(shift.closing_balance)}`}
              />
            </div>

            <p style={mutedStyle}>
              Closing Balance = B/F + confirmed Company/M-Shwari floats
              + platform output − all expenses. Protected entries and
              closing balance cannot be directly edited here.
            </p>

            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              disabled={busy}
              style={refreshStyle}
            >
              REFRESH REPORT
            </button>
          </>
        )}
      </div>
    </section>
  );
}
function readingKey(platformId, kind) {
  return `${platformId}:${kind}`;
}

function stagesFor(shopType, shiftName, platformName) {
  if (shopType === "12_HOUR") {
    return ["OPENING", "CLOSING"];
  }

  if (shopType !== "24_HOUR") return [];

  const name = String(shiftName || "")
    .trim()
    .toUpperCase()
    .replace(/[_\s-]+/g, "");

  if (name === "SHIFT1") {
    return ["OPENING", "HANDOVER_9PM"];
  }

  if (name === "SHIFT2") {
    return String(platformName || "").trim().toUpperCase() === "TABLE"
      ? ["OPENING", "CLOSING_9AM"]
      : ["OPENING", "MIDNIGHT_CLOSE", "CLOSING_9AM"];
  }

  return [];
}

function platformOutput(platformId, platformName, kinds, readings) {
  const get = (kind) =>
    parseMoney(
      readings.get(readingKey(platformId, kind))?.reading_value
    );

  const opening = get("OPENING");
  if (opening === null) return null;

  if (kinds.includes("CLOSING")) {
    const closing = get("CLOSING");
    return closing === null ? null : closing - opening;
  }

  if (kinds.includes("HANDOVER_9PM")) {
    const handover = get("HANDOVER_9PM");
    return handover === null ? null : handover - opening;
  }

  if (kinds.includes("CLOSING_9AM")) {
    const closing = get("CLOSING_9AM");
    if (closing === null) return null;

    if (
      String(platformName).trim().toUpperCase() === "TABLE"
    ) {
      return closing - opening;
    }

    const midnight = get("MIDNIGHT_CLOSE");

    return midnight === null
      ? null
      : midnight - opening + closing;
  }

  return null;
}

function parseMoney(value) {
  if (
    value === "" ||
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function isEditableExpense(expense) {
  const source = String(expense?.source_type || "")
    .trim()
    .toUpperCase();

  return (
    (source === "" || source === "MANUAL") &&
    expense?.is_private === false &&
    expense?.source_record_id == null
  );
}

function sumAmount(rows) {
  return rows.reduce(
    (sum, row) => sum + Number(row.amount || 0),
    0
  );
}

function money(value) {
  const number = Number(value);

  return (Number.isFinite(number) ? number : 0)
    .toLocaleString("en-KE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function FloatPanel({ title, entries }) {
  return (
    <div style={floatStyle}>
      <strong>{title} 🔒</strong>

      {[0, 1, 2].map((index) => (
        <div key={index} style={floatRowStyle}>
          <span>Added Float {index + 1}</span>

          <strong>
            KES {money(entries[index]?.amount ?? 0)}
          </strong>
        </div>
      ))}

      {entries.length > 3 && (
        <small>
          Additional records: {entries.length - 3}
        </small>
      )}

      <div style={floatRowStyle}>
        <strong>TOTAL</strong>
        <strong>KES {money(sumAmount(entries))}</strong>
      </div>
    </div>
  );
}

function Stat({ title, value }) {
  return (
    <div style={statStyle}>
      <div style={smallStyle}>{title}</div>
      <strong>{value ?? "-"}</strong>
    </div>
  );
}

const panelStyle = {
  marginTop: 18,
  background: "white",
  borderRadius: 9,
  overflow: "hidden",
  boxShadow: "0 1px 6px rgba(0,0,0,0.12)",
};

const headingStyle = {
  background: "#0f766e",
  color: "white",
  padding: 14,
  fontWeight: 700,
};

const contentStyle = {
  padding: 16,
};

const sectionStyle = {
  fontSize: 14,
  padding: "10px 12px",
  background: "#f1f5f9",
  borderRadius: 6,
  marginTop: 24,
  marginBottom: 12,
};

const statsStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(135px,1fr))",
  gap: 9,
  marginBottom: 14,
};

const statStyle = {
  padding: 12,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 7,
};

const smallStyle = {
  display: "block",
  fontSize: 11,
  color: "#64748b",
  marginBottom: 5,
};

const mutedStyle = {
  fontSize: 12,
  color: "#64748b",
  lineHeight: 1.6,
};

const labelStyle = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  marginBottom: 5,
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #94a3b8",
  background: "white",
  padding: 10,
  borderRadius: 6,
  fontSize: 13,
};

const numberStyle = {
  ...inputStyle,
  maxWidth: 185,
};

const twoColumnStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(215px,1fr))",
  gap: 12,
};

const rowStyle = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 12,
  padding: 12,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 7,
};

const floatStyle = {
  padding: 12,
  border: "1px solid #e2e8f0",
  borderRadius: 7,
  background: "#f8fafc",
};

const floatRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  padding: "8px 0",
  borderBottom: "1px solid #e2e8f0",
  fontSize: 12,
};

const platformStyle = {
  padding: 12,
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  marginBottom: 12,
};

const readingGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(165px,1fr))",
  gap: 9,
  marginTop: 10,
};

const readingBoxStyle = {
  padding: 10,
  background: "#f8fafc",
  borderRadius: 6,
  display: "grid",
  gap: 6,
};

const expenseRowStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(120px,2fr) minmax(80px,1fr) auto auto",
  gap: 7,
  marginBottom: 8,
};

const saveStyle = {
  padding: "10px 12px",
  background: "#0f766e",
  border: 0,
  color: "white",
  fontWeight: 700,
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 11,
};

const deleteStyle = {
  ...saveStyle,
  background: "#b91c1c",
};

const refreshStyle = {
  ...saveStyle,
  background: "#334155",
  marginTop: 18,
};

const warningStyle = {
  background: "#fff7ed",
  color: "#9a3412",
  padding: 12,
  fontSize: 12,
  borderRadius: 6,
  marginBottom: 14,
};

function noticeStyle(success) {
  return {
    background: success ? "#ecfdf5" : "#fef2f2",
    color: success ? "#166534" : "#991b1b",
    padding: 12,
    borderRadius: 6,
    fontSize: 12,
    marginBottom: 14,
  };
}
