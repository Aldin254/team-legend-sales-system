"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Exclude the account-registration profile.
function isActualCashier(person) {
  const name = String(person?.name || "")
    .trim()
    .toUpperCase();

  return (
    Boolean(person?.id) &&
    name !== "" &&
    name !== "WELCOME"
  );
}

async function rpc(name, token, payload) {
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
      body: JSON.stringify(payload),
      cache: "no-store",
    }
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.message ||
      data?.details ||
      "Operation failed."
    );
  }

  return data;
}

function kes(value) {
  if (value == null) return "—";

  return `KES ${Number(value).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function Admin24HourShiftControl({
  user,
  shops = [],
  onChanged,
}) {
  const token = user?.access_token;

  const shopOptions = useMemo(
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

  const [selection, setSelection] = useState("AUTO");
  const [cashierId, setCashierId] = useState("");
  const [reason, setReason] = useState("");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [reload, setReload] = useState(0);

  // Only eligible displayed cashiers.
  // WELCOME is never included.
  const actualCashiers = useMemo(
    () =>
      (status?.cashiers || []).filter(
        isActualCashier
      ),
    [status]
  );

  useEffect(() => {
    setShopId((current) =>
      shopOptions.some((s) => s.id === current)
        ? current
        : shopOptions[0]?.id || ""
    );
  }, [shopOptions]);

  const refresh = useCallback(() => {
    setReload((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!shopId || !token) {
      setStatus(null);
      setCashierId("");
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const result = await rpc(
          "tl_admin_24h_recovery_status_v1",
          token,
          { p_shop_id: shopId }
        );

        if (cancelled) return;

        const cashiers = (
          result.cashiers || []
        ).filter(isActualCashier);

        setStatus(result);

        setCashierId((previous) => {
          // Retain an eligible selection.
          if (
            cashiers.some(
              (c) => c.id === previous
            )
          ) {
            return previous;
          }

          // Retain a genuine cashier on the
          // recovered shift, when available.
          if (
            cashiers.some(
              (c) =>
                c.id === result.source?.cashier_id
            )
          ) {
            return result.source.cashier_id;
          }

          // Do not automatically select a
          // registration profile or another
          // employee without Admin choosing.
          return "";
        });
      } catch (err) {
        if (cancelled) return;

        setStatus(null);
        setCashierId("");
        setError(err.message);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [shopId, token, reload]);

  const source = status?.source;
  const active = status?.active_recovery === true;

  const selectedShift =
    selection === "AUTO"
      ? status?.auto_shift || "—"
      : selection === "SHIFT 1 TODAY"
      ? "SHIFT 1"
      : "SHIFT 2";

  const selectedDate =
    selection === "AUTO"
      ? status?.auto_date || "—"
      : status?.today_date || "—";

  const sameSlot =
    source?.status === "OPEN" &&
    source?.shift_name === selectedShift &&
    source?.business_date === selectedDate;

  const canSave =
    active &&
    Boolean(source) &&
    reason.trim().length >= 10 &&
    reason.trim().length <= 500 &&
    !loading &&
    !saving;

  async function finishRecovery() {
    if (!canSave || !shopId || !token) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const latest = await rpc(
        "tl_admin_24h_recovery_status_v1",
        token,
        { p_shop_id: shopId }
      );

      if (
        latest.active_recovery !== true ||
        !latest.source ||
        latest.session_id !== status.session_id
      ) {
        throw new Error(
          "Recovery changed. Refresh and review again."
        );
      }

      const actualShift =
        selection === "AUTO"
          ? latest.auto_shift
          : selection === "SHIFT 1 TODAY"
          ? "SHIFT 1"
          : "SHIFT 2";

      const actualDate =
        selection === "AUTO"
          ? latest.auto_date
          : latest.today_date;

      const alreadyOpen =
        latest.source.status === "OPEN" &&
        latest.source.shift_name === actualShift &&
        latest.source.business_date === actualDate;

      // Verify selected cashier against
      // fresh, eligible cashier records.
      const latestCashiers = (
        latest.cashiers || []
      ).filter(isActualCashier);

      const verifiedCashierId =
        latestCashiers.some(
          (c) => c.id === cashierId
        )
          ? cashierId
          : null;

      const confirmation = [
        "FINALIZE ADMIN RECOVERY",
        "",
        `SHOP: ${latest.shop_name}`,
        `CORRECTED SHIFT: ${latest.source.shift_name}`,
        `CORRECTED CLOSING: ${kes(
          latest.source.closing_balance
        )}`,
        "",
        `SELECTED: ${actualShift}`,
        `DATE: ${actualDate}`,
        "",
        `CASHIER: ${
          latestCashiers.find(
            (c) => c.id === verifiedCashierId
          )?.name || "Not assigned"
        }`,
        "",
        alreadyOpen
          ? "Resume corrected shift."
          : `OPENING B/F: ${kes(
              latest.source.closing_balance
            )}`,
        "",
        "Existing financial records remain on the recovered shift.",
      ].join("\n");

      if (!window.confirm(confirmation)) {
        return;
      }

      const result = await rpc(
        "tl_admin_24h_finish_and_open_v1",
        token,
        {
          p_shop_id: shopId,
          p_selection: selection,
          p_cashier_id: verifiedCashierId,
          p_reason: reason.trim(),
        }
      );

      if (result?.ok !== true) {
        throw new Error(
          "Recovery could not be finalized."
        );
      }

      setSuccess(
        `${result.shift_name} — ${result.business_date} OPEN`
      );

      setReason("");
      refresh();

      if (typeof onChanged === "function") {
        onChanged();
      }
    } catch (err) {
      setError(err?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  if (!shopOptions.length) return null;

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
                setSelection("AUTO");
                setCashierId("");
                setReason("");
                setError("");
                setSuccess("");
              }}
            >
              {shopOptions.map((shop) => (
                <option
                  key={shop.id}
                  value={shop.id}
                >
                  {shop.shop_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={styles.label}>
              LAST SHIFT
            </label>

            <div style={styles.readOnly}>
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
            <Summary
              label="STATUS"
              value={
                active
                  ? "ADMIN RECOVERY"
                  : source.status
              }
            />

            <Summary
              label="BALANCE B/F"
              value={kes(
                source.opening_balance
              )}
            />

            <Summary
              label="EXPENSES"
              value={kes(
                source.total_expenses
              )}
            />

            <Summary
              label="CORRECTED CLOSING"
              value={kes(
                source.closing_balance
              )}
            />
          </div>
        )}

        <div style={styles.sectionTitle}>
          SELECT NEXT SHIFT
        </div>

        <div style={styles.choices}>
          {[
            {
              value: "AUTO",
              label:
                "AUTOMATIC SHIFT SELECTION",
            },
            {
              value: "SHIFT 1 TODAY",
              label: "SHIFT 1 TODAY",
            },
            {
              value: "SHIFT 2 TODAY",
              label: "SHIFT 2 TODAY",
            },
          ].map((option) => (
            <button
              type="button"
              key={option.value}
              disabled={saving}
              onClick={() => {
                setSelection(option.value);
                setError("");
              }}
              style={{
                ...styles.choice,
                background:
                  selection === option.value
                    ? "#073b5c"
                    : "#f8fafc",
                color:
                  selection === option.value
                    ? "#ffffff"
                    : "#334155",
                borderColor:
                  selection === option.value
                    ? "#d4af37"
                    : "#cbd5e1",
              }}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div style={styles.summary}>
          <Summary
            label="SELECTED SHIFT"
            value={selectedShift}
          />

          <Summary
            label="BUSINESS DATE"
            value={selectedDate}
          />

          <Summary
            label={
              sameSlot
                ? "CORRECTED BALANCE"
                : "OPENING BALANCE B/F"
            }
            value={kes(
              source?.closing_balance
            )}
          />
        </div>

        {!sameSlot && (
          <div style={styles.section}>
            <label style={styles.label}>
              CASHIER
            </label>

            <select
              style={styles.field}
              value={cashierId}
              disabled={saving}
              onChange={(e) => {
                const selected =
                  e.target.value;

                if (
                  selected === "" ||
                  actualCashiers.some(
                    (c) => c.id === selected
                  )
                ) {
                  setCashierId(selected);
                }
              }}
            >
              <option value="">
                Not assigned
              </option>

              {actualCashiers.map((cashier) => (
                <option
                  key={cashier.id}
                  value={cashier.id}
                >
                  {cashier.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div style={styles.section}>
          <label style={styles.label}>
            ADMIN REASON
          </label>

          <textarea
            rows={2}
            maxLength={500}
            style={{
              ...styles.field,
              minHeight: 65,
              resize: "vertical",
            }}
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

        {success && (
          <div
            role="status"
            style={styles.success}
          >
            {success}
          </div>
        )}

        <div style={styles.actions}>
          <button
            type="button"
            disabled={!canSave}
            onClick={finishRecovery}
            style={{
              ...styles.save,
              opacity: canSave
                ? 1
                : 0.5,
            }}
          >
            {saving
              ? "SAVING..."
              : active
              ? "FINALIZE RECOVERY & OPEN SHIFT"
              : "START ADMIN RECOVERY FIRST"}
          </button>

          <button
            type="button"
            disabled={saving || loading}
            style={styles.refresh}
            onClick={() => {
              setError("");
              refresh();
            }}
          >
            REFRESH
          </button>
        </div>
      </div>
    </section>
  );
}

function Summary({ label, value }) {
  return (
    <div style={styles.summaryItem}>
      <small style={styles.summaryLabel}>
        {label}
      </small>

      <strong style={styles.summaryValue}>
        {value ?? "—"}
      </strong>
    </div>
  );
}

const styles = {
  panel: {
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    borderRadius: 9,
    overflow: "hidden",
    marginBottom: 16,
  },

  header: {
    padding: "14px 16px",
    color: "#ffffff",
    background: "#073b5c",
    fontWeight: 900,
    fontSize: 14,
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
    fontWeight: 800,
    color: "#334155",
    marginBottom: 6,
  },

  field: {
    width: "100%",
    boxSizing: "border-box",
    padding: 11,
    border: "1px solid #cbd5e1",
    borderRadius: 7,
    color: "#0f172a",
    background: "#ffffff",
    fontSize: 12,
    fontFamily: "inherit",
  },

  readOnly: {
    padding: 11,
    border: "1px solid #cbd5e1",
    borderRadius: 7,
    background: "#f1f5f9",
    fontWeight: 800,
    fontSize: 12,
    minHeight: 17,
  },

  summary: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(140px,1fr))",
    gap: 9,
    marginTop: 14,
  },

  summaryItem: {
    padding: 11,
    background: "#f1f5f9",
    border: "1px solid #e2e8f0",
    borderRadius: 7,
    display: "grid",
    gap: 5,
  },

  summaryLabel: {
    fontSize: 10,
    fontWeight: 800,
    color: "#64748b",
  },

  summaryValue: {
    fontSize: 13,
    fontWeight: 900,
    color: "#073b5c",
  },

  sectionTitle: {
    fontSize: 12,
    fontWeight: 900,
    color: "#073b5c",
    marginTop: 18,
    marginBottom: 11,
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

  section: {
    marginTop: 14,
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
    background: "#fef2f2",
    color: "#991b1b",
    padding: 11,
    borderRadius: 6,
    marginTop: 12,
    fontSize: 12,
  },

  success: {
    background: "#ecfdf5",
    color: "#166534",
    padding: 11,
    borderRadius: 6,
    marginTop: 12,
    fontSize: 12,
    fontWeight: 800,
  },
};
