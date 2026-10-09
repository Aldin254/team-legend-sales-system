"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const STAGE_LABEL = {
  OPENING: "Opening",
  CLOSING: "Closing",
  HANDOVER_9PM: "9 PM",
  MIDNIGHT_CLOSE: "Midnight",
  CLOSING_9AM: "9 AM",
};

const money = (v) =>
  Number(v || 0).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const num = (v) =>
  v === "" || v == null || !Number.isFinite(Number(v))
    ? null
    : Number(v);

const keyOf = (pid, kind) => `${pid}:${kind}`;

const manual = (e) =>
  ["", "MANUAL"].includes(
    String(e.source_type || "").trim().toUpperCase()
  ) &&
  e.is_private === false &&
  e.source_record_id == null;

const sum = (xs) =>
  xs.reduce((a, x) => a + Number(x.amount || 0), 0);

const stages = (type, name, platform) => {
  if (type === "12_HOUR") return ["OPENING", "CLOSING"];
  if (type !== "24_HOUR") return [];

  const n = String(name || "")
    .toUpperCase()
    .replace(/[_\s-]/g, "");

  if (n === "SHIFT1") {
    return ["OPENING", "HANDOVER_9PM"];
  }

  if (n === "SHIFT2") {
    return String(platform || "").toUpperCase() === "TABLE"
      ? ["OPENING", "CLOSING_9AM"]
      : ["OPENING", "MIDNIGHT_CLOSE", "CLOSING_9AM"];
  }

  return [];
};

export default function AdminRecoveryReportEditor({
  user,
  recovery,
  shop,
}) {
  const [report, setReport] = useState(null);
  const [draftBF, setDraftBF] = useState("");
  const [readingDrafts, setReadingDrafts] = useState({});
  const [expenseDrafts, setExpenseDrafts] = useState({});
  const [newExpense, setNewExpense] = useState({
    description: "",
    amount: "",
  });
  const [newExpenseId, setNewExpenseId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [comparison, setComparison] = useState(null);
  const [reload, setReload] = useState(0);
  const saving = useRef(false);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = user?.access_token;

  const sessionId = recovery?.session_id;
  const shiftId = recovery?.target_shift_id;
  const shopId = shop?.id;
  const type = String(shop?.shop_type || "").toUpperCase();

  const headers = useMemo(
    () => ({
      apikey: anon,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    }),
    [anon, token]
  );

  // ==========================================
  // LOAD HISTORICAL CASHIER FIGURES
  // ==========================================

  useEffect(() => {
    if (!url || !anon || !token || !sessionId || !shiftId || !shopId) {
      return;
    }

    let cancelled = false;

    async function load() {
      setError("");

      try {
        const sid = encodeURIComponent(shiftId);
        const shopQuery = encodeURIComponent(shopId);

        const queries = [
          `shifts?id=eq.${sid}&shop_id=eq.${shopQuery}&select=*&limit=1`,

          `shop_platforms?shop_id=eq.${shopQuery}` +
            `&select=id,platform_name,is_active,display_order` +
            `&order=display_order.asc`,

          `platform_readings?shift_id=eq.${sid}` +
            `&select=id,platform_id,reading_kind,reading_value`,

          `shift_income_entries?shift_id=eq.${sid}` +
            `&select=id,entry_type,amount`,

          `expenses?shift_id=eq.${sid}` +
            `&select=id,description,amount,source_type,source_record_id,is_private` +
            `&order=created_at.asc`,
        ];

        const responses = await Promise.all(
          queries.map((q) =>
            fetch(`${url}/rest/v1/${q}`, {
              headers,
              cache: "no-store",
            })
          )
        );

        const results = await Promise.all(
          responses.map(async (r) => {
            try {
              return await r.json();
            } catch {
              return null;
            }
          })
        );

        const fail = responses.findIndex((r) => !r.ok);

        if (fail !== -1) {
          throw new Error(
            results[fail]?.message ||
              "Unable to load recovery figures."
          );
        }

        const shift = results[0]?.[0];

        if (!shift || shift.shop_id !== shopId) {
          throw new Error(
            "The target shift was not found in this shop."
          );
        }

        const savedReadings = Array.isArray(results[2])
          ? results[2]
          : [];

        const activeIds = new Set(
          savedReadings.map((r) => r.platform_id)
        );

        const platforms = (results[1] || []).filter(
          (p) => p.is_active || activeIds.has(p.id)
        );

        const expenses = Array.isArray(results[4])
          ? results[4]
          : [];

        if (cancelled) return;

        setReport({
          shift,
          platforms,
          readings: savedReadings,
          floats: results[3] || [],
          expenses,
        });

        setDraftBF(String(shift.opening_balance ?? 0));

        setReadingDrafts(
          Object.fromEntries(
            savedReadings.map((r) => [
              keyOf(r.platform_id, r.reading_kind),
              String(r.reading_value),
            ])
          )
        );

        setExpenseDrafts(
          Object.fromEntries(
            expenses.filter(manual).map((e) => [
              e.id,
              {
                description: e.description,
                amount: String(e.amount),
              },
            ])
          )
        );
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [url, anon, token, sessionId, shiftId, shopId, reload, headers]);

  const readingIndex = useMemo(
    () =>
      new Map(
        (report?.readings || []).map((r) => [
          keyOf(r.platform_id, r.reading_kind),
          r,
        ])
      ),
    [report]
  );

  const shift = report?.shift;

  const savedExpenses = (report?.expenses || []).filter(manual);

  const totalFloat = sum(
    (report?.floats || []).filter((e) =>
      ["COMPANY_FLOAT", "MSHWARI_FLOAT"].includes(e.entry_type)
    )
  );

  // ==========================================
  // ATOMIC ADMIN CORRECTION
  // ==========================================

  async function change(action, data, prompt) {
    if (!shift || saving.current) return false;

    const sessionReason = String(recovery?.reason || "").trim();

    if (sessionReason.length < 10) {
      setError(
        "The recovery reason is missing. Refresh the session."
      );
      return false;
    }

    if (!window.confirm(prompt)) return false;

    saving.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    setComparison(null);

    try {
      const response = await fetch(
        `${url}/rest/v1/rpc/tl_admin_apply_recovery_correction`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            p_session_id: sessionId,
            p_action: action,
            p_reason: sessionReason,
            p_data: data,
          }),
        }
      );

      const result = await response.json().catch(() => null);

      if (!response.ok || result?.ok !== true) {
        throw new Error(
          result?.message ||
            result?.details ||
            "Correction failed."
        );
      }

      setComparison(result);
      setMessage("Correction saved and audited.");
      setReload((x) => x + 1);

      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  async function saveBF() {
    const value = num(draftBF);

    if (value === null) {
      setError("Enter a valid B/F amount.");
      return;
    }

    await change(
      "SET_BF",
      { value },
      `Save Balance B/F: KES ${money(value)}?`
    );
  }

  async function saveReading(platform, kind) {
    const value = num(
      readingDrafts[keyOf(platform.id, kind)]
    );

    if (value === null) {
      setError(
        `Enter a valid ${platform.platform_name} reading.`
      );
      return;
    }

    await change(
      "SET_READING",
      {
        platform_id: platform.id,
        reading_kind: kind,
        value,
      },
      `Save ${platform.platform_name} ${STAGE_LABEL[kind]}: ${money(value)}?`
    );
  }

  async function saveExpense(expense) {
    const draft = expenseDrafts[expense.id] || {};
    const amount = num(draft.amount);
    const description = String(
      draft.description || ""
    ).trim();

    if (!description || amount === null || amount <= 0) {
      setError(
        "Enter a description and positive expense amount."
      );
      return;
    }

    await change(
      "SAVE_MANUAL_EXPENSE",
      {
        expense_id: expense.id,
        description,
        amount,
      },
      `Update ${description} for KES ${money(amount)}?`
    );
  }

  async function addExpense() {
    const description = newExpense.description.trim();
    const amount = num(newExpense.amount);

    if (!description || amount === null || amount <= 0) {
      setError(
        "Enter a description and positive expense amount."
      );
      return;
    }

    const id =
      newExpenseId ||
      globalThis.crypto?.randomUUID?.();

    if (!id) {
      setError(
        "Cannot generate a unique expense ID in this browser."
      );
      return;
    }

    setNewExpenseId(id);

    const success = await change(
      "SAVE_MANUAL_EXPENSE",
      {
        create: true,
        expense_id: id,
        description,
        amount,
      },
      `Add expense ${description} for KES ${money(amount)}?`
    );

    if (success) {
      setNewExpense({
        description: "",
        amount: "",
      });
      setNewExpenseId("");
    }
  }

  // ==========================================
  // PLATFORM OUTPUT PREVIEW
  // ==========================================

  function outputFor(p) {
    const kinds = stages(
      type,
      shift.shift_name,
      p.platform_name
    );

    const value = (kind) =>
      num(
        readingIndex.get(
          keyOf(p.id, kind)
        )?.reading_value
      );

    const opening = value("OPENING");
    if (opening == null) return null;

    if (kinds.includes("CLOSING")) {
      const x = value("CLOSING");
      return x == null ? null : x - opening;
    }

    if (kinds.includes("HANDOVER_9PM")) {
      const x = value("HANDOVER_9PM");
      return x == null ? null : x - opening;
    }

    if (kinds.includes("CLOSING_9AM")) {
      const closing = value("CLOSING_9AM");

      if (closing == null) return null;

      if (
        String(p.platform_name).toUpperCase() === "TABLE"
      ) {
        return closing - opening;
      }

      const midnight = value("MIDNIGHT_CLOSE");

      return midnight == null
        ? null
        : midnight - opening + closing;
    }

    return null;
  }

  if (!sessionId || !shopId || !shiftId) return null;

  const columns = stages(
    type,
    shift?.shift_name,
    "PILOT"
  );

  // ==========================================
  // DISPLAY
  // ==========================================

  return (
    <section style={panel}>
      <h3 style={title}>
        RECOVERY REPORT — ADMIN CORRECTIONS
      </h3>

      <div style={{ padding: 12 }}>
        {!report && !error && (
          <p>Loading report...</p>
        )}

        {error && (
          <div style={errorBox}>
            {error}
          </div>
        )}

        {message && (
          <div style={successBox}>
            {message}
          </div>
        )}

        {shift && (
          <>
            <div style={grid}>
              <Summary
                label="SHOP"
                value={shop.shop_name}
              />

              <Summary
                label="SHIFT"
                value={`${shift.shift_name} · ${shift.business_date}`}
              />

              <Summary
                label="CASHIER"
                value={shift.cashier_name || "-"}
              />

              <Summary
                label="STATUS"
                value={shift.status}
              />
            </div>

            <h4 style={section}>
              INCOME STATEMENT
            </h4>

            <div style={bfRow}>
              <strong>Balance B/F</strong>

              <input
                aria-label="Balance B/F"
                type="number"
                step="0.01"
                style={input}
                value={draftBF}
                disabled={busy}
                onChange={(e) =>
                  setDraftBF(e.target.value)
                }
              />

              <button
                type="button"
                style={green}
                disabled={busy}
                onClick={saveBF}
              >
                SAVE B/F
              </button>
            </div>

            <h4 style={section}>
              PLATFORM READINGS
            </h4>

            <div style={{ overflowX: "auto" }}>
              <table style={table}>
                <thead>
                  <tr>
                    <th style={cell}>
                      PLATFORM
                    </th>

                    {columns.map((c) => (
                      <th key={c} style={cell}>
                        {STAGE_LABEL[c]}
                      </th>
                    ))}

                    <th style={cell}>
                      OUTPUT
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {report.platforms.map((p) => {
                    const permitted = stages(
                      type,
                      shift.shift_name,
                      p.platform_name
                    );

                    const out = outputFor(p);

                    return (
                      <tr key={p.id}>
                        <td style={cell}>
                          <strong>
                            {p.platform_name}
                          </strong>
                        </td>

                        {columns.map((kind) => {
                          if (!permitted.includes(kind)) {
                            return (
                              <td key={kind} style={cell}>
                                —
                              </td>
                            );
                          }

                          const k = keyOf(p.id, kind);
                          const saved = readingIndex.get(k);

                          const disabled =
                            busy ||
                            (!p.is_active && !saved);

                          return (
                            <td key={kind} style={cell}>
                              <div style={entry}>
                                <input
                                  aria-label={`${p.platform_name} ${kind}`}
                                  type="number"
                                  step="0.01"
                                  style={input}
                                  value={readingDrafts[k] ?? ""}
                                  disabled={disabled}
                                  onChange={(e) =>
                                    setReadingDrafts((old) => ({
                                      ...old,
                                      [k]: e.target.value,
                                    }))
                                  }
                                />

                                <button
                                  type="button"
                                  style={green}
                                  disabled={disabled}
                                  onClick={() =>
                                    saveReading(p, kind)
                                  }
                                >
                                  SAVE
                                </button>
                              </div>
                            </td>
                          );
                        })}

                        <td style={cell}>
                          {out == null
                            ? "—"
                            : money(out)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <h4 style={section}>
              MANUAL EXPENSES
            </h4>

            {savedExpenses.map((e) => {
              const draft =
                expenseDrafts[e.id] || {
                  description: "",
                  amount: "",
                };

              return (
                <div key={e.id} style={expenseRow}>
                  <input
                    style={input}
                    aria-label="Description"
                    value={draft.description}
                    disabled={busy}
                    onChange={(x) =>
                      setExpenseDrafts((old) => ({
                        ...old,
                        [e.id]: {
                          ...draft,
                          description: x.target.value,
                        },
                      }))
                    }
                  />

                  <input
                    style={input}
                    aria-label="Amount"
                    type="number"
                    step="0.01"
                    value={draft.amount}
                    disabled={busy}
                    onChange={(x) =>
                      setExpenseDrafts((old) => ({
                        ...old,
                        [e.id]: {
                          ...draft,
                          amount: x.target.value,
                        },
                      }))
                    }
                  />

                  <button
                    type="button"
                    style={green}
                    disabled={busy}
                    onClick={() => saveExpense(e)}
                  >
                    SAVE
                  </button>

                  <button
                    type="button"
                    style={red}
                    disabled={busy}
                    onClick={() =>
                      change(
                        "DELETE_MANUAL_EXPENSE",
                        { expense_id: e.id },
                        `Delete ${e.description}?`
                      )
                    }
                  >
                    DELETE
                  </button>
                </div>
              );
            })}

            <div style={expenseRow}>
              <input
                style={input}
                placeholder="New expense"
                value={newExpense.description}
                disabled={busy}
                onChange={(e) =>
                  setNewExpense((d) => ({
                    ...d,
                    description: e.target.value,
                  }))
                }
              />

              <input
                style={input}
                type="number"
                step="0.01"
                placeholder="Amount"
                value={newExpense.amount}
                disabled={busy}
                onChange={(e) =>
                  setNewExpense((d) => ({
                    ...d,
                    amount: e.target.value,
                  }))
                }
              />

              <button
                type="button"
                style={green}
                disabled={busy}
                onClick={addExpense}
              >
                ADD
              </button>
            </div>

            <h4 style={section}>
              FINANCIAL SUMMARY — READ ONLY
            </h4>

            <div style={grid}>
              <Summary
                label="TOTAL FLOAT"
                value={`KES ${money(totalFloat)}`}
              />

              <Summary
                label="OUTPUT"
                value={`KES ${money(shift.total_output)}`}
              />

              <Summary
                label="EXPENSES"
                value={`KES ${money(shift.total_expenses)}`}
              />

              <Summary
                label="NET INCOME"
                value={`KES ${money(shift.net_income)}`}
              />

              <Summary
                label="CLOSING B/F"
                value={`KES ${money(shift.closing_balance)}`}
              />
            </div>

            {comparison?.return_shift_balance_difference != null &&
              Math.abs(
                Number(comparison.return_shift_balance_difference)
              ) > 0.004 && (
                <div style={errorBox}>
                  Carry-forward review: KES{" "}
                  {money(
                    comparison.return_shift_balance_difference
                  )}{" "}
                  difference. No automatic changes to the
                  next shift.
                </div>
              )}

            <button
              type="button"
              style={dark}
              onClick={() =>
                setReload((v) => v + 1)
              }
              disabled={busy}
            >
              REFRESH REPORT
            </button>
          </>
        )}
      </div>
    </section>
  );
}

// ==========================================
// COMPONENTS / STYLES
// ==========================================

function Summary({ label, value }) {
  return (
    <div style={summary}>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

const panel = {
  marginTop: 12,
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
};

const title = {
  margin: 0,
  background: "#0f766e",
  color: "white",
  padding: 12,
  fontSize: 14,
};

const section = {
  background: "#f1f5f9",
  padding: "8px 10px",
  marginTop: 16,
  fontSize: 12,
};

const grid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(130px,1fr))",
  gap: 8,
  margin: "10px 0",
};

const summary = {
  display: "grid",
  gap: 5,
  padding: 10,
  border: "1px solid #e2e8f0",
  borderRadius: 5,
};

const bfRow = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 8,
};

const input = {
  width: "100%",
  minWidth: 65,
  boxSizing: "border-box",
  padding: 8,
  border: "1px solid #94a3b8",
  borderRadius: 5,
};

const table = {
  width: "100%",
  minWidth: 660,
  borderCollapse: "collapse",
  fontSize: 12,
};

const cell = {
  padding: 6,
  borderBottom: "1px solid #e2e8f0",
  textAlign: "left",
};

const entry = {
  display: "flex",
  alignItems: "center",
  gap: 5,
  minWidth: 145,
};

const expenseRow = {
  display: "grid",
  gridTemplateColumns:
    "minmax(130px,2fr) minmax(85px,1fr) auto auto",
  gap: 7,
  marginBottom: 7,
};

const green = {
  border: 0,
  background: "#0f766e",
  color: "white",
  padding: 9,
  borderRadius: 5,
  cursor: "pointer",
};

const red = {
  ...green,
  background: "#b91c1c",
};

const dark = {
  ...green,
  background: "#334155",
  marginTop: 12,
};

const errorBox = {
  padding: 10,
  background: "#fef2f2",
  color: "#991b1b",
  margin: "10px 0",
};

const successBox = {
  padding: 10,
  background: "#ecfdf5",
  color: "#166534",
  margin: "10px 0",
};
