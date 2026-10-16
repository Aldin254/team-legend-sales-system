"use client";

import { useEffect, useMemo, useState } from "react";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function rpc(name, token, body) {
  if (!URL || !KEY || !token) {
    throw new Error("Admin session unavailable.");
  }

  const response = await fetch(
    `${URL}/rest/v1/rpc/${name}`,
    {
      method: "POST",
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    }
  );

  const result = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    throw new Error(
      result?.message ||
      result?.details ||
      "Database request failed."
    );
  }

  return result;
}

const money = (n) =>
  n == null
    ? "—"
    : `KES ${Number(n).toLocaleString("en-KE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;

export default function Admin24HourShiftControl({
  user,
  shops = [],
  onChanged,
}) {
  const token = user?.access_token;

  const options = useMemo(
    () =>
      shops.filter(
        (s) =>
          String(s.shop_type || "")
            .trim()
            .toUpperCase() === "24_HOUR" &&
          s.is_active !== false
      ),
    [shops]
  );

  const [shopId, setShopId] = useState("");
  const [status, setStatus] = useState(null);
  const [roster, setRoster] = useState(null);

  const [selection, setSelection] = useState("AUTO");
  const [reason, setReason] = useState("");

  const [loading, setLoading] = useState(false);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    setShopId((old) =>
      options.some((s) => s.id === old)
        ? old
        : options[0]?.id || ""
    );
  }, [options]);

  // ======================================
  // LOAD RECOVERY STATUS
  // ======================================

  useEffect(() => {
    if (!shopId || !token) {
      setStatus(null);
      return;
    }

    let cancelled = false;

    setLoading(true);
    setError("");

    rpc(
      "tl_admin_24h_recovery_status_v1",
      token,
      {
        p_shop_id: shopId,
      }
    )
      .then((data) => {
        if (!cancelled) {
          setStatus(data);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setStatus(null);
          setError(e.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [shopId, token, version]);

  const selectedShift =
    selection === "AUTO"
      ? status?.auto_shift || "—"
      : selection === "SHIFT 1 TODAY"
      ? "SHIFT 1"
      : "SHIFT 2";

  const selectedDate =
    selection === "AUTO"
      ? status?.auto_date || ""
      : status?.today_date || "";

  const source = status?.source;
  const active = status?.active_recovery === true;

  const sameSlot =
    source?.status === "OPEN" &&
    source?.business_date === selectedDate &&
    source?.shift_name === selectedShift;

  // ======================================
  // EFFECTIVE DUTY ROTA ONLY
  // ======================================

  useEffect(() => {
    if (!shopId || !token || !selectedDate) {
      setRoster(null);
      return;
    }

    let cancelled = false;

    setRoster(null);
    setRosterLoading(true);

    rpc(
      "tl_admin_24h_rota_staff_v1",
      token,
      {
        p_shop_id: shopId,
        p_duty_date: selectedDate,
      }
    )
      .then((data) => {
        if (cancelled) return;

        if (!Array.isArray(data?.employees)) {
          throw new Error(
            "Invalid Duty Rota response."
          );
        }

        setRoster(data);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setRosterLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [shopId, token, selectedDate, version]);

  const canSave =
    active &&
    !!source &&
    Array.isArray(roster?.employees) &&
    reason.trim().length >= 10 &&
    reason.trim().length <= 500 &&
    !loading &&
    !rosterLoading &&
    !saving;

  // ======================================
  // FINALIZE RECOVERY
  // ======================================

  async function finalize() {
    if (!canSave) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const latest = await rpc(
        "tl_admin_24h_recovery_status_v1",
        token,
        {
          p_shop_id: shopId,
        }
      );

      if (
        !latest?.active_recovery ||
        !latest?.source ||
        latest.session_id !== status.session_id
      ) {
        throw new Error(
          "Recovery changed. Refresh the report."
        );
      }

      const nextShift =
        selection === "AUTO"
          ? latest.auto_shift
          : selection === "SHIFT 1 TODAY"
          ? "SHIFT 1"
          : "SHIFT 2";

      const nextDate =
        selection === "AUTO"
          ? latest.auto_date
          : latest.today_date;

      const effective = await rpc(
        "tl_admin_24h_rota_staff_v1",
        token,
        {
          p_shop_id: shopId,
          p_duty_date: nextDate,
        }
      );

      if (!Array.isArray(effective?.employees)) {
        throw new Error(
          "Unable to verify Duty Rota."
        );
      }

      const names =
        effective.employees
          .map((e) => e.name)
          .join(", ") || "VACANT";

      const confirmed = window.confirm(
        [
          "FINALIZE 24-HOUR RECOVERY",
          `Shop: ${latest.shop_name}`,
          `Recovered: ${latest.source.shift_name} — ${latest.source.business_date}`,
          `Corrected closing: ${money(
            latest.source.closing_balance
          )}`,
          `Next: ${nextShift} — ${nextDate}`,
          `Duty Rota: ${names}`,
          "",
          "The corrected balance and handover readings will carry forward.",
          "Old expenses and financial history stay on the recovered record.",
        ].join("\n")
      );

      if (!confirmed) return;

      // No registration-based cashier ID.
      // Shift identity must never be guessed
      // from the login profiles directory.

      const result = await rpc(
        "tl_admin_24h_finish_and_open_v1",
        token,
        {
          p_shop_id: shopId,
          p_selection: selection,
          p_cashier_id: null,
          p_reason: reason.trim(),
        }
      );

      if (result?.ok !== true) {
        throw new Error(
          "Finalization not confirmed."
        );
      }

      setMessage(
        `${result.shift_name} — ${result.business_date} OPEN`
      );

      setReason("");
      setVersion((n) => n + 1);

      onChanged?.();
    } catch (e) {
      setError(
        e?.message ||
          "Unable to finalize recovery."
      );
    } finally {
      setSaving(false);
    }
  }

  if (!options.length) return null;

  // ======================================
  // DISPLAY
  // ======================================

  return (
    <section style={styles.panel}>
      <div style={styles.header}>
        24-HOUR ADMIN SHIFT CONTROL
      </div>

      <div style={styles.content}>
        <div style={styles.grid}>
          <div>
            <label style={styles.label}>
              SHOP
            </label>

            <select
              style={styles.field}
              value={shopId}
              disabled={saving}
              onChange={(e) => {
                setShopId(e.target.value);
                setStatus(null);
                setRoster(null);
                setSelection("AUTO");
                setReason("");
                setError("");
                setMessage("");
              }}
            >
              {options.map((s) => (
                <option
                  key={s.id}
                  value={s.id}
                >
                  {s.shop_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={styles.label}>
              LAST SHIFT
            </label>

            <div style={styles.readonly}>
              {source
                ? `${source.shift_name} — ${source.business_date}`
                : loading
                ? "Loading..."
                : "—"}
            </div>
          </div>
        </div>

        {source && (
          <div style={styles.summary}>
            <Figure
              label="STATUS"
              value={
                active
                  ? "ADMIN RECOVERY"
                  : source.status
              }
            />

            <Figure
              label="BALANCE B/F"
              value={money(
                source.opening_balance
              )}
            />

            <Figure
              label="EXPENSES"
              value={money(
                source.total_expenses
              )}
            />

            <Figure
              label="CORRECTED CLOSING"
              value={money(
                source.closing_balance
              )}
            />
          </div>
        )}

        <div style={styles.labelHeading}>
          SELECT NEXT SHIFT
        </div>

        <div style={styles.choices}>
          {[
            [
              "AUTO",
              "AUTOMATIC SHIFT SELECTION",
            ],
            [
              "SHIFT 1 TODAY",
              "SHIFT 1 TODAY",
            ],
            [
              "SHIFT 2 TODAY",
              "SHIFT 2 TODAY",
            ],
          ].map(([value, title]) => (
            <button
              key={value}
              type="button"
              disabled={saving}
              onClick={() => {
                setSelection(value);
                setError("");
              }}
              style={{
                ...styles.choice,

                background:
                  selection === value
                    ? "#073b5c"
                    : "#f8fafc",

                color:
                  selection === value
                    ? "white"
                    : "#334155",

                borderColor:
                  selection === value
                    ? "#d4af37"
                    : "#cbd5e1",
              }}
            >
              {title}
            </button>
          ))}
        </div>

        <div style={styles.summary}>
          <Figure
            label="SELECTED SHIFT"
            value={selectedShift}
          />

          <Figure
            label="BUSINESS DATE"
            value={selectedDate || "—"}
          />

          <Figure
            label={
              sameSlot
                ? "CORRECTED BALANCE"
                : "OPENING BALANCE B/F"
            }
            value={money(
              source?.closing_balance
            )}
          />
        </div>

        <div style={styles.staff}>
          <label style={styles.label}>
            DUTY ROTA — STAFF ASSIGNED
          </label>

          <div style={styles.staffText}>
            {rosterLoading
              ? "Loading..."
              : roster?.employees?.length
              ? roster.employees
                  .map((e) => e.name)
                  .join(" · ")
              : roster
              ? "VACANT"
              : "—"}
          </div>
        </div>

        <div style={styles.staff}>
          <label style={styles.label}>
            ADMIN REASON
          </label>

          <textarea
            rows={2}
            maxLength={500}
            style={styles.field}
            value={reason}
            disabled={saving}
            onChange={(e) => {
              setReason(e.target.value);
              setError("");
            }}
          />
        </div>

        {error && (
          <div
            role="alert"
            style={styles.error}
          >
            {error}
          </div>
        )}

        {message && (
          <div
            role="status"
            style={styles.success}
          >
            {message}
          </div>
        )}

        <div style={styles.actions}>
          <button
            type="button"
            disabled={!canSave}
            onClick={finalize}
            style={{
              ...styles.save,
              opacity: canSave
                ? 1
                : 0.5,
            }}
          >
            {saving
              ? "SAVING..."
              : "FINALIZE RECOVERY & OPEN SHIFT"}
          </button>

          <button
            type="button"
            disabled={
              saving ||
              loading ||
              rosterLoading
            }
            onClick={() => {
              setError("");
              setVersion((v) => v + 1);
            }}
            style={styles.refresh}
          >
            REFRESH
          </button>
        </div>
      </div>
    </section>
  );
}

function Figure({ label, value }) {
  return (
    <div style={styles.figure}>
      <small style={styles.small}>
        {label}
      </small>

      <strong style={styles.big}>
        {value ?? "—"}
      </strong>
    </div>
  );
}

// ======================================
// STYLES
// ======================================

const styles = {
  panel: {
    background: "white",
    border: "1px solid #cbd5e1",
    borderRadius: 9,
    overflow: "hidden",
    marginBottom: 16,
  },

  header: {
    background: "#073b5c",
    color: "white",
    padding: "14px 16px",
    fontSize: 14,
    fontWeight: 900,
  },

  content: {
    padding: 14,
  },

  grid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(180px,1fr))",
    gap: 10,
  },

  label: {
    display: "block",
    fontSize: 11,
    color: "#334155",
    fontWeight: 800,
    marginBottom: 6,
  },

  labelHeading: {
    marginTop: 18,
    marginBottom: 11,
    color: "#073b5c",
    fontSize: 12,
    fontWeight: 900,
  },

  field: {
    width: "100%",
    boxSizing: "border-box",
    padding: 11,
    border: "1px solid #cbd5e1",
    borderRadius: 7,
    background: "white",
    color: "#0f172a",
    fontSize: 12,
    fontFamily: "inherit",
  },

  readonly: {
    padding: 11,
    background: "#f1f5f9",
    border: "1px solid #cbd5e1",
    borderRadius: 7,
    fontWeight: 800,
    fontSize: 12,
  },

  summary: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(140px,1fr))",
    gap: 9,
    marginTop: 14,
  },

  figure: {
    display: "grid",
    gap: 5,
    background: "#f1f5f9",
    border: "1px solid #e2e8f0",
    padding: 11,
    borderRadius: 7,
  },

  small: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: 800,
  },

  big: {
    color: "#073b5c",
    fontSize: 13,
    fontWeight: 900,
  },

  choices: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(165px,1fr))",
    gap: 10,
  },

  choice: {
    minHeight: 69,
    border: "1px solid",
    borderRadius: 8,
    padding: "12px 9px",
    fontSize: 11,
    fontWeight: 900,
    cursor: "pointer",
  },

  staff: {
    marginTop: 14,
  },

  staffText: {
    padding: 11,
    border: "1px solid #cbd5e1",
    borderRadius: 7,
    background: "#f8fafc",
    fontSize: 12,
    fontWeight: 800,
  },

  actions: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr",
    gap: 9,
    marginTop: 16,
  },

  save: {
    background: "#0f766e",
    color: "white",
    border: 0,
    borderRadius: 7,
    padding: 13,
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },

  refresh: {
    background: "#475569",
    color: "white",
    border: 0,
    borderRadius: 7,
    padding: 13,
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },

  error: {
    marginTop: 12,
    background: "#fef2f2",
    color: "#991b1b",
    padding: 11,
    borderRadius: 6,
  },

  success: {
    marginTop: 12,
    background: "#ecfdf5",
    color: "#166534",
    padding: 11,
    borderRadius: 6,
  },
};
