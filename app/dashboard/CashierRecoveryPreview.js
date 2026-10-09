"use client";

import { useEffect, useMemo, useState } from "react";

const LABELS = {
  OPENING: "Opening",
  CLOSING: "Closing",
  HANDOVER_9PM: "9 PM handover",
  MIDNIGHT_CLOSE: "Midnight",
  CLOSING_9AM: "9 AM closing",
};

// Read-only historical cashier report.
// This component performs no database writes.

export default function CashierRecoveryPreview({
  user,
  recoveryAssignment,
  recoveryShift,
  onLogout,
}) {
  const [report, setReport] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshIndex, setRefreshIndex] = useState(0);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const token = user?.access_token || null;
  const shopId = user?.shop_id || user?.shopId || null;
  const shiftId = recoveryShift?.id || null;

  // ==========================================
  // READ RECOVERY REPORT
  // ==========================================

  useEffect(() => {
    if (!url || !key || !token || !shopId || !shiftId) {
      setMessage("Recovery login information is missing.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    let fetching = false;

    async function refreshReport() {
      if (fetching) return;

      fetching = true;

      const headers = {
        apikey: key,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };

      const base = `${url}/rest/v1`;

      const sid = encodeURIComponent(shiftId);
      const shid = encodeURIComponent(shopId);

      try {
        const links = [
          `${base}/shifts?id=eq.${sid}&shop_id=eq.${shid}&select=*&limit=1`,

          `${base}/shop_platforms?shop_id=eq.${shid}` +
            `&select=id,platform_name,display_order` +
            `&order=display_order.asc`,

          `${base}/platform_readings?shift_id=eq.${sid}` +
            `&select=id,platform_id,reading_kind,reading_value`,

          `${base}/expenses?shift_id=eq.${sid}&is_private=eq.false` +
            `&select=id,description,amount,source_type,created_at` +
            `&order=created_at.asc`,
        ];

        const responses = await Promise.all(
          links.map((link) =>
            fetch(link, {
              headers,
              cache: "no-store",
            })
          )
        );

        const results = await Promise.all(
          responses.map(safeJson)
        );

        const failed = responses.findIndex(
          (response) => !response.ok
        );

        if (failed !== -1) {
          throw new Error(
            results[failed]?.message ||
              "Unable to refresh recovered shift."
          );
        }

        const shift = Array.isArray(results[0])
          ? results[0][0]
          : null;

        if (!shift || shift.id !== shiftId) {
          throw new Error(
            "The assigned historical shift was not found."
          );
        }

        if (cancelled) return;

        setReport({
          shift,
          platforms: Array.isArray(results[1])
            ? results[1]
            : [],
          readings: Array.isArray(results[2])
            ? results[2]
            : [],
          expenses: Array.isArray(results[3])
            ? results[3]
            : [],
        });

        setMessage("");
      } catch (error) {
        if (!cancelled) {
          setMessage(
            error?.message ||
              "Unable to load recovery details."
          );
        }
      } finally {
        fetching = false;

        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    setLoading(true);
    refreshReport();

    const interval = setInterval(
      refreshReport,
      8000
    );

    window.addEventListener(
      "focus",
      refreshReport
    );

    return () => {
      cancelled = true;
      clearInterval(interval);

      window.removeEventListener(
        "focus",
        refreshReport
      );
    };
  }, [
    url,
    key,
    token,
    shopId,
    shiftId,
    refreshIndex,
  ]);

  const shift = report?.shift || recoveryShift;

  const shopType = String(
    user?.shop_type || ""
  ).toUpperCase();

  const shiftName = String(
    shift?.shift_name || ""
  )
    .toUpperCase()
    .replace(/[_\s-]+/g, "");

  const inferred24 =
    shopType === "24_HOUR" ||
    (
      shopType !== "12_HOUR" &&
      (
        shiftName === "SHIFT1" ||
        shiftName === "SHIFT2"
      )
    );

  const allKinds = inferred24
    ? shiftName === "SHIFT1"
      ? ["OPENING", "HANDOVER_9PM"]
      : ["OPENING", "MIDNIGHT_CLOSE", "CLOSING_9AM"]
    : ["OPENING", "CLOSING"];

  const readingIndex = useMemo(() => {
    const index = new Map();

    for (const row of report?.readings || []) {
      index.set(
        `${row.platform_id}:${row.reading_kind}`,
        row.reading_value
      );
    }

    return index;
  }, [report]);

  if (!recoveryAssignment || !shift) {
    return null;
  }

  // ==========================================
  // CASHIER DISPLAY
  // ==========================================

  return (
    <main style={pageStyle}>
      <div style={contentStyle}>
        <header style={topStyle}>
          <strong>
            TEAM LEGEND ·{" "}
            {user?.shop_name ||
              user?.shop ||
              "CASHIER REPORT"}
          </strong>

          <span>
            ADMIN RECOVERY · READ ONLY
          </span>
        </header>

        <div style={dateBarStyle}>
          <strong>
            {shift.shift_name || "SHIFT"}
          </strong>

          <span>
            {shift.business_date || "-"}
          </span>

          <span>
            {shift.status || "-"}
          </span>

          <span>
            {shift.cashier_name || "Cashier"}
          </span>

          <button
            type="button"
            onClick={onLogout}
            style={darkButtonStyle}
          >
            Logout
          </button>
        </div>

        {message && (
          <div role="alert" style={errorStyle}>
            {message}
          </div>
        )}

        {loading && !report && (
          <p>Loading recovered shift...</p>
        )}

        {report && (
          <>
            <h3 style={sectionStyle}>
              INCOME STATEMENT
            </h3>

            <div style={summaryStyle}>
              <Info
                title="Balance B/F"
                value={money(shift.opening_balance)}
              />

              <Info
                title="Added Float Total"
                value={money(shift.total_added_float)}
              />

              <Info
                title="Platform Sales"
                value={money(shift.total_output)}
              />
            </div>

            <h3 style={sectionStyle}>
              PLATFORM READINGS
            </h3>

            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={cellStyle}>
                      Platform
                    </th>

                    {allKinds.map((kind) => (
                      <th key={kind} style={cellStyle}>
                        {LABELS[kind]}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {report.platforms.map((platform) => {
                    const isTable =
                      String(
                        platform.platform_name || ""
                      )
                        .trim()
                        .toUpperCase() === "TABLE";

                    return (
                      <tr key={platform.id}>
                        <td style={cellStyle}>
                          <strong>
                            {platform.platform_name}
                          </strong>
                        </td>

                        {allKinds.map((kind) => (
                          <td key={kind} style={cellStyle}>
                            {inferred24 &&
                            shiftName === "SHIFT2" &&
                            isTable &&
                            kind === "MIDNIGHT_CLOSE"
                              ? "—"
                              : showReading(
                                  readingIndex,
                                  platform.id,
                                  kind
                                )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <h3
              style={{
                ...sectionStyle,
                background: "#b91c1c",
              }}
            >
              EXPENSES
            </h3>

            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={cellStyle}>
                      Description
                    </th>

                    <th style={cellStyle}>
                      Amount (KES)
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {report.expenses.length === 0 && (
                    <tr>
                      <td
                        style={cellStyle}
                        colSpan={2}
                      >
                        No public expense records
                      </td>
                    </tr>
                  )}

                  {report.expenses.map((expense) => (
                    <tr key={expense.id}>
                      <td style={cellStyle}>
                        {expense.description}
                      </td>

                      <td style={cellStyle}>
                        {money(expense.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={summaryStyle}>
              <Info
                title="Total Expenses"
                value={money(shift.total_expenses)}
              />

              <Info
                title="Net Income"
                value={money(shift.net_income)}
              />

              <Info
                title="Closing Balance"
                value={money(shift.closing_balance)}
              />
            </div>
          </>
        )}

        <div style={footerStyle}>
          <span>
            Viewing historical shift · Financial actions disabled
          </span>

          <button
            type="button"
            style={darkButtonStyle}
            onClick={() =>
              setRefreshIndex((n) => n + 1)
            }
          >
            Refresh
          </button>
        </div>
      </div>
    </main>
  );
}

// ==========================================
// HELPERS
// ==========================================

function Info({ title, value }) {
  return (
    <div style={infoStyle}>
      <span style={infoLabelStyle}>
        {title}
      </span>

      <strong>
        KES {value}
      </strong>
    </div>
  );
}

function showReading(index, platformId, kind) {
  const value = index.get(
    `${platformId}:${kind}`
  );

  return value == null
    ? "—"
    : money(value);
}

function money(value) {
  const n = Number(value);

  return (
    Number.isFinite(n) ? n : 0
  ).toLocaleString("en-KE", {
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

// ==========================================
// STYLES
// ==========================================

const pageStyle = {
  minHeight: "100vh",
  background: "#edf2f7",
  padding: 12,
  fontFamily: "Arial, sans-serif",
  boxSizing: "border-box",
};

const contentStyle = {
  maxWidth: 1180,
  margin: "auto",
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 12,
};

const topStyle = {
  background: "#064966",
  color: "white",
  padding: 16,
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  justifyContent: "space-between",
};

const dateBarStyle = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 18,
  padding: 12,
  background: "#e0f2fe",
  marginTop: 8,
};

const sectionStyle = {
  background: "#0f766e",
  color: "white",
  padding: "9px 12px",
  fontSize: 13,
  marginBottom: 7,
  marginTop: 16,
};

const summaryStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(150px,1fr))",
  gap: 7,
  marginTop: 12,
};

const infoStyle = {
  padding: 12,
  border: "1px solid #e2e8f0",
  borderRadius: 6,
  display: "grid",
  gap: 6,
};

const infoLabelStyle = {
  fontSize: 11,
  color: "#64748b",
};

const tableStyle = {
  width: "100%",
  minWidth: 480,
  borderCollapse: "collapse",
  fontSize: 12,
};

const cellStyle = {
  borderBottom: "1px solid #e2e8f0",
  padding: "8px 10px",
  textAlign: "left",
};

const darkButtonStyle = {
  border: 0,
  background: "#334155",
  color: "white",
  padding: "8px 12px",
  borderRadius: 5,
  cursor: "pointer",
};

const errorStyle = {
  padding: 12,
  background: "#fef2f2",
  color: "#991b1b",
};

const footerStyle = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 10,
  justifyContent: "space-between",
  padding: 12,
  color: "#475569",
  fontSize: 12,
};
