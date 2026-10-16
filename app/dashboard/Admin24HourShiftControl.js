"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

// ==========================================
// TEAM LEGEND — 24-HOUR SHIFT CONTROL
// ==========================================

const URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function callRpc(name, token, payload) {
  if (!URL || !KEY || !token) {
    throw new Error("Admin login unavailable.");
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

  const result = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    throw new Error(
      result?.message ||
      result?.details ||
      result?.hint ||
      "Database operation failed."
    );
  }

  return result;
}

// ==========================================
// MAIN PANEL
// ==========================================

export default function Admin24HourShiftControl({
  user,
  shops = [],
  onChanged,
}) {
  const token = user?.access_token;

  const availableShops = useMemo(
    () =>
      shops.filter(
        (shop) =>
          String(shop.shop_type || "")
            .trim()
            .toUpperCase() === "24_HOUR" &&
          shop.is_active !== false
      ),
    [shops]
  );

  const [shopId, setShopId] = useState("");

  const [snapshot, setSnapshot] =
    useState(null);

  const [selection, setSelection] =
    useState("AUTO");

  const [cashierId, setCashierId] =
    useState("");

  const [reason, setReason] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [notice, setNotice] =
    useState("");

  const [reload, setReload] =
    useState(0);

  // ========================================
  // SELECT FIRST AVAILABLE SHOP
  // ========================================

  useEffect(() => {
    setShopId((current) => {
      if (
        availableShops.some(
          (shop) => shop.id === current
        )
      ) {
        return current;
      }

      return availableShops[0]?.id || "";
    });
  }, [availableShops]);

  // ========================================
  // REFRESH
  // ========================================

  const refresh = useCallback(() => {
    setReload((current) => current + 1);
  }, []);

  // ========================================
  // LOAD SHOP STATUS
  // ========================================

  useEffect(() => {
    if (!shopId || !token) {
      setSnapshot(null);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const result = await callRpc(
          "tl_admin_24h_control_snapshot_v1",
          token,
          {
            p_shop_id: shopId,
          }
        );

        if (cancelled) return;

        setSnapshot(result);

        setCashierId((current) => {
          const cashiers =
            result?.cashiers || [];

          if (
            cashiers.some(
              (person) => person.id === current
            )
          ) {
            return current;
          }

          return cashiers[0]?.id || "";
        });
      } catch (err) {
        if (cancelled) return;

        setSnapshot(null);

        setError(
          err?.message ||
            "Unable to load shop."
        );
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

  // ========================================
  // SELECTED SHIFT
  // ========================================

  const selectedShift =
    selection === "AUTO"
      ? snapshot?.auto_shift || "—"
      : selection === "SHIFT 1 TODAY"
      ? "SHIFT 1"
      : "SHIFT 2";

  const selectedDate =
    selection === "AUTO"
      ? snapshot?.auto_date || "—"
      : todayNairobi();

  const currentOpen =
    snapshot?.open_shift || null;

  const canSave =
    !loading &&
    !saving &&
    !!snapshot &&
    reason.trim().length >= 10 &&
    reason.trim().length <= 500 &&
    (Boolean(currentOpen) ||
      Boolean(cashierId));

  // ========================================
  // ADMIN SAVE
  // ========================================

  async function saveSelection() {
    if (!canSave) return;

    const confirmed = window.confirm(
      "CONFIRM ADMIN SHIFT SELECTION\n\n" +
      `Shop: ${snapshot.shop_name}\n` +
      `Shift: ${selectedShift}\n` +
      `Date: ${selectedDate}\n\n` +
      `Reason: ${reason.trim()}`
    );

    if (!confirmed) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const result = await callRpc(
        "tl_admin_24h_choose_today_v2",
        token,
        {
          p_shop_id: shopId,
          p_selection: selection,
          p_cashier_id:
            cashierId || null,
          p_reason:
            reason.trim(),
        }
      );

      if (result?.ok !== true) {
        throw new Error(
          "Shift change was not confirmed."
        );
      }

      setNotice(
        `${result.shift_name} — ` +
          `${result.business_date} — SAVED`
      );

      setReason("");

      refresh();

      if (typeof onChanged === "function") {
        onChanged();
      }
    } catch (err) {
      setError(
        err?.message ||
          "Unable to save shift selection."
      );
    } finally {
      setSaving(false);
    }
  }

  // ========================================
  // DISPLAY
  // ========================================

  if (!availableShops.length) {
    return null;
  }

  return (
    <section style={panelStyle}>
      <div style={headerStyle}>
        24-HOUR SHIFT CONTROL
      </div>

      <div style={bodyStyle}>
        {/* SHOP */}

        <div style={formGridStyle}>
          <div>
            <label style={labelStyle}>
              SHOP
            </label>

            <select
              style={fieldStyle}
              value={shopId}
              disabled={saving}
              onChange={(event) => {
                setShopId(
                  event.target.value
                );

                setSnapshot(null);
                setSelection("AUTO");
                setCashierId("");
                setReason("");
                setError("");
                setNotice("");
              }}
            >
              {availableShops.map(
                (shop) => (
                  <option
                    key={shop.id}
                    value={shop.id}
                  >
                    {shop.shop_name}
                  </option>
                )
              )}
            </select>
          </div>

          {/* CURRENT OPEN SHIFT */}

          <div>
            <label style={labelStyle}>
              CURRENT SHIFT
            </label>

            <div style={readOnlyStyle}>
              {loading
                ? "Loading..."
                : currentOpen
                ? `${currentOpen.shift_name} — ${currentOpen.business_date}`
                : "NO OPEN SHIFT"}
            </div>
          </div>
        </div>

        {/* ==================================
            THREE ADMIN OPTIONS
            ================================== */}

        <div style={choiceSectionStyle}>
          <div style={sectionTitleStyle}>
            SELECT SHIFT TO OPEN
          </div>

          <div style={choiceGridStyle}>
            <ChoiceButton
              title="AUTOMATIC SHIFT SELECTION"
              active={selection === "AUTO"}
              disabled={saving}
              onClick={() => {
                setSelection("AUTO");
                setError("");
              }}
            />

            <ChoiceButton
              title="SHIFT 1 TODAY"
              subtitle="9:00 AM – 9:00 PM"
              active={
                selection ===
                "SHIFT 1 TODAY"
              }
              disabled={saving}
              onClick={() => {
                setSelection(
                  "SHIFT 1 TODAY"
                );
                setError("");
              }}
            />

            <ChoiceButton
              title="SHIFT 2 TODAY"
              subtitle="9:00 PM – 9:00 AM"
              active={
                selection ===
                "SHIFT 2 TODAY"
              }
              disabled={saving}
              onClick={() => {
                setSelection(
                  "SHIFT 2 TODAY"
                );
                setError("");
              }}
            />
          </div>
        </div>

        {/* SELECTED SHIFT */}

        <div style={selectedBoxStyle}>
          <div>
            <span style={smallLabelStyle}>
              SELECTED SHIFT
            </span>

            <strong style={selectedValueStyle}>
              {selectedShift}
            </strong>
          </div>

          <div>
            <span style={smallLabelStyle}>
              BUSINESS DATE
            </span>

            <strong style={selectedValueStyle}>
              {selectedDate}
            </strong>
          </div>

          <div>
            <span style={smallLabelStyle}>
              BALANCE B/F
            </span>

            <strong style={selectedValueStyle}>
              {currentOpen
                ? formatMoney(
                    currentOpen.opening_balance
                  )
                : snapshot?.suggested_balance != null
                ? formatMoney(
                    snapshot.suggested_balance
                  )
                : "—"}
            </strong>
          </div>
        </div>

        {/* CASHIER FOR NEW SHIFT */}

        {!currentOpen && snapshot && (
          <div style={{ marginTop: 14 }}>
            <label style={labelStyle}>
              CASHIER
            </label>

            <select
              style={fieldStyle}
              value={cashierId}
              disabled={saving}
              onChange={(event) =>
                setCashierId(
                  event.target.value
                )
              }
            >
              <option value="">
                Select Cashier
              </option>

              {(snapshot.cashiers || []).map(
                (cashier) => (
                  <option
                    key={cashier.id}
                    value={cashier.id}
                  >
                    {cashier.name}
                  </option>
                )
              )}
            </select>
          </div>
        )}

        {/* ADMIN REASON */}

        <div style={{ marginTop: 14 }}>
          <label style={labelStyle}>
            ADMIN REASON
          </label>

          <textarea
            rows={2}
            maxLength={500}
            style={{
              ...fieldStyle,
              resize: "vertical",
              minHeight: 70,
            }}
            placeholder="Enter reason"
            value={reason}
            disabled={saving}
            onChange={(event) => {
              setReason(
                event.target.value
              );

              setError("");
            }}
          />
        </div>

        {/* ERRORS */}

        {error && (
          <div
            role="alert"
            style={errorStyle}
          >
            {error}
          </div>
        )}

        {/* SUCCESS */}

        {notice && (
          <div
            role="status"
            style={successStyle}
          >
            {notice}
          </div>
        )}

        {/* ACTIONS */}

        <div style={actionGridStyle}>
          <button
            type="button"
            style={{
              ...saveButtonStyle,
              opacity: canSave
                ? 1
                : 0.55,
            }}
            disabled={!canSave}
            onClick={saveSelection}
          >
            {saving
              ? "SAVING..."
              : currentOpen
              ? "SAVE SHIFT SELECTION"
              : "OPEN SELECTED SHIFT"}
          </button>

          <button
            type="button"
            style={refreshButtonStyle}
            disabled={
              saving || loading
            }
            onClick={() => {
              setError("");
              setNotice("");
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

// ==========================================
// CHOICE BUTTON
// ==========================================

function ChoiceButton({
  title,
  subtitle,
  active,
  disabled,
  onClick,
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        ...choiceButtonStyle,

        background: active
          ? "#073b5c"
          : "#f8fafc",

        color: active
          ? "#ffffff"
          : "#334155",

        borderColor: active
          ? "#d4af37"
          : "#cbd5e1",

        boxShadow: active
          ? "0 0 0 1px #d4af37"
          : "none",
      }}
    >
      <strong>{title}</strong>

      {subtitle && (
        <small
          style={{
            marginTop: 5,
            opacity: 0.8,
          }}
        >
          {subtitle}
        </small>
      )}
    </button>
  );
}

// ==========================================
// NAIROBI DATE
// ==========================================

function todayNairobi() {
  const parts =
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone: "Africa/Nairobi",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    ).formatToParts(new Date());

  const values = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  return (
    `${values.year}-` +
    `${values.month}-` +
    `${values.day}`
  );
}

function formatMoney(value) {
  return (
    "KES " +
    Number(value || 0).toLocaleString(
      "en-KE",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    )
  );
}

// ==========================================
// STYLES
// ==========================================

const panelStyle = {
  background: "#ffffff",
  border: "1px solid #cbd5e1",
  borderRadius: 9,
  marginBottom: 18,
  overflow: "hidden",
};

const headerStyle = {
  background:
    "linear-gradient(90deg,#073b5c,#0b5677)",
  color: "#ffffff",
  padding: "14px 16px",
  fontSize: 14,
  fontWeight: 900,
  letterSpacing: "0.4px",
};

const bodyStyle = {
  padding: 15,
};

const formGridStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(220px,1fr))",
  gap: 12,
};

const fieldStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "11px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 7,
  background: "#ffffff",
  color: "#0f172a",
  fontSize: 12,
  fontFamily: "inherit",
};

const labelStyle = {
  display: "block",
  fontSize: 11,
  fontWeight: 800,
  color: "#334155",
  marginBottom: 7,
};

const readOnlyStyle = {
  ...fieldStyle,
  background: "#f1f5f9",
  fontWeight: 850,
  minHeight: 41,
};

const choiceSectionStyle = {
  marginTop: 16,
  paddingTop: 14,
  borderTop: "1px solid #e2e8f0",
};

const sectionTitleStyle = {
  fontSize: 12,
  fontWeight: 900,
  color: "#073b5c",
  marginBottom: 12,
};

const choiceGridStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(170px,1fr))",
  gap: 10,
};

const choiceButtonStyle = {
  border: "1px solid",
  borderRadius: 8,
  padding: "16px 12px",
  minHeight: 74,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  gap: 2,
  cursor: "pointer",
  fontSize: 11,
  fontWeight: 800,
};

const selectedBoxStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(150px,1fr))",
  gap: 12,
  marginTop: 15,
  padding: 13,
  background: "#f1f5f9",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
};

const smallLabelStyle = {
  display: "block",
  fontSize: 9,
  color: "#64748b",
  fontWeight: 800,
  marginBottom: 5,
};

const selectedValueStyle = {
  fontSize: 15,
  fontWeight: 900,
  color: "#073b5c",
};

const actionGridStyle = {
  display: "grid",
  gridTemplateColumns:
    "minmax(0,2fr) minmax(90px,1fr)",
  gap: 10,
  marginTop: 17,
};

const saveButtonStyle = {
  border: 0,
  borderRadius: 7,
  background: "#0f766e",
  color: "#ffffff",
  padding: "13px 12px",
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
};

const refreshButtonStyle = {
  border: 0,
  borderRadius: 7,
  background: "#475569",
  color: "#ffffff",
  padding: "13px 12px",
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
};

const errorStyle = {
  marginTop: 12,
  padding: 11,
  borderRadius: 7,
  background: "#fef2f2",
  color: "#991b1b",
  fontSize: 12,
};

const successStyle = {
  marginTop: 12,
  padding: 11,
  borderRadius: 7,
  background: "#f0fdf4",
  color: "#166534",
  fontSize: 12,
  fontWeight: 850,
};
