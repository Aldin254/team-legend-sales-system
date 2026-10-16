"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// ======================================
// SUPABASE RPC
// ======================================

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
        result?.hint ||
        "Database request failed."
    );
  }

  return result;
}

const money = (value) =>
  value == null
    ? "—"
    : `KES ${Number(value).toLocaleString("en-KE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;

// ======================================
// MAIN COMPONENT
// ======================================

export default function Admin24HourShiftControl({
  user,
  shops = [],
  onChanged,
}) {
  const token = user?.access_token;

  const options = useMemo(
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
  const [status, setStatus] = useState(null);
  const [roster, setRoster] = useState(null);

  const [selection, setSelection] = useState("AUTO");
  const [reason, setReason] = useState("");

  const [loading, setLoading] = useState(false);
  const [rosterLoading, setRosterLoading] =
    useState(false);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [version, setVersion] = useState(0);

  const selectionTouchedRef = useRef(false);

  // ======================================
  // SELECT SHOP
  // ======================================

  useEffect(() => {
    setShopId((previous) =>
      options.some((s) => s.id === previous)
        ? previous
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
        if (cancelled) return;

        setStatus(data);

        // When reviewing the currently OPEN
        // shift today, select that same shift
        // by default.
        //
        // This allows Admin to finish Recovery
        // without creating another shift.

        if (
          !selectionTouchedRef.current &&
          data?.active_recovery === true &&
          data?.source?.status === "OPEN" &&
          data?.source?.business_date ===
            data?.today_date
        ) {
          const name = String(
            data.source.shift_name || ""
          )
            .trim()
            .toUpperCase();

          if (name === "SHIFT 1") {
            setSelection("SHIFT 1 TODAY");
          }

          if (name === "SHIFT 2") {
            setSelection("SHIFT 2 TODAY");
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setStatus(null);
          setError(
            err?.message ||
              "Unable to load shift status."
          );
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

  // ======================================
  // SELECTED SHIFT
  // ======================================

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

  const active =
    status?.active_recovery === true;

  // ======================================
  // SAME OPEN SHIFT
  //
  // ADMIN MAY:
  // - EDIT FINANCIAL FIGURES
  // - EDIT PLATFORM READINGS
  // - MAKE NO CHANGES
  //
  // ENDING RECOVERY DOES NOT REQUIRE
  // NEW CLOSING READINGS.
  // ======================================

  const sameSlot =
    active &&
    source?.status === "OPEN" &&
    String(source?.business_date) ===
      String(selectedDate) &&
    String(source?.shift_name)
      .trim()
      .toUpperCase() === selectedShift;

  // ======================================
  // DUTY ROTA
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
      .catch((err) => {
        if (!cancelled) {
          setRoster(null);
          setError(
            err?.message ||
              "Unable to load Duty Rota."
          );
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
  }, [
    shopId,
    token,
    selectedDate,
    version,
  ]);

  // ======================================
  // ACTION VALIDATION
  //
  // SAME SHIFT:
  // - NO REASON REQUIRED
  // - NO PLATFORM READINGS REQUIRED
  // - NO FINANCIAL EDIT REQUIRED
  //
  // DIFFERENT SHIFT:
  // - ADMIN REASON REQUIRED
  // - HANDOVER RULES REMAIN
  // ======================================

  const reasonText = reason.trim();

  const canSave =
    active &&
    !!source &&
    !loading &&
    !saving &&
    reasonText.length <= 500 &&
    (
      sameSlot ||
      (
        Array.isArray(roster?.employees) &&
        !rosterLoading &&
        reasonText.length >= 10
      )
    );

  // ======================================
  // FINALIZE / END RECOVERY
  // ======================================

  async function finalize() {
    if (!canSave) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      // Always verify the latest session.

      const latest = await rpc(
        "tl_admin_24h_recovery_status_v1",
        token,
        {
          p_shop_id: shopId,
        }
      );

      if (
        latest?.active_recovery !== true ||
        !latest?.source ||
        !latest?.session_id ||
        latest.session_id !== status.session_id ||
        latest.source.id !== source.id
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

      if (
        nextShift !== selectedShift ||
        nextDate !== selectedDate
      ) {
        throw new Error(
          "Shift selection changed. Refresh first."
        );
      }

      const latestSameSlot =
        latest.source.status === "OPEN" &&
        String(latest.source.business_date) ===
          String(nextDate) &&
        String(latest.source.shift_name)
          .trim()
          .toUpperCase() === nextShift;

      if (latestSameSlot !== sameSlot) {
        throw new Error(
          "Shift status changed. Refresh first."
        );
      }

      // ==================================
      // OPTION 1:
      // FINISH RECOVERY, KEEP SHIFT OPEN
      //
      // This uses the existing recovery
      // ending function.
      //
      // Does not:
      // - Close Shift 1
      // - Create Shift 2
      // - Require six platform readings
      // - Reset any reading to zero
      // - Change financial figures
      // ==================================

      if (latestSameSlot) {
        const confirmed = window.confirm(
          [
            "END ADMIN RECOVERY",
            "",
            `Shop: ${latest.shop_name}`,
            `Shift: ${latest.source.shift_name}`,
            `Business date: ${latest.source.business_date}`,
            "",
            "Keep the current shift OPEN.",
            "Keep all saved corrections.",
            "Do not change platform readings.",
            "Do not create another shift.",
            "",
            "Continue?",
          ].join("\n")
        );

        if (!confirmed) return;

        await rpc(
          "tl_admin_end_shift_recovery",
          token,
          {
            p_session_id: latest.session_id,
            p_note: reasonText || null,
          }
        );

        setMessage(
          "Recovery ended. Existing shift remains OPEN."
        );

        setReason("");
        setVersion((n) => n + 1);

        onChanged?.();

        return;
      }

      // ==================================
      // OPTION 2:
      // CLOSE SOURCE AND OPEN NEXT SHIFT
      //
      // This is a genuine financial
      // handover, not merely exiting
      // Admin Recovery.
      //
      // Existing server-side validations
      // for verified handover readings
      // remain in place.
      // ==================================

      if (
        reasonText.length < 10 ||
        reasonText.length > 500
      ) {
        throw new Error(
          "Enter an Admin reason of 10–500 characters."
        );
      }

      const effective = await rpc(
        "tl_admin_24h_rota_staff_v1",
        token,
        {
          p_shop_id: shopId,
          p_duty_date: nextDate,
        }
      );

      if (
        !Array.isArray(effective?.employees)
      ) {
        throw new Error(
          "Unable to verify Duty Rota."
        );
      }

      const names =
        effective.employees
          .map((employee) => employee.name)
          .join(", ") || "VACANT";

      const confirmed = window.confirm(
        [
          "FINALIZE & OPEN NEXT SHIFT",
          "",
          `Shop: ${latest.shop_name}`,
          `Recovered: ${latest.source.shift_name}`,
          `Date: ${latest.source.business_date}`,
          `Corrected closing: ${money(
            latest.source.closing_balance
          )}`,
          "",
          `Next: ${nextShift}`,
          `Business date: ${nextDate}`,
          `Duty Rota: ${names}`,
          "",
          "This closes the current shift",
          "and opens a different shift.",
          "",
          "Continue?",
        ].join("\n")
      );

      if (!confirmed) return;

      const result = await rpc(
        "tl_admin_24h_finish_from_rota_v1",
        token,
        {
          p_shop_id: shopId,
          p_selection: selection,
          p_reason: reasonText,
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

    } catch (err) {
      setError(
        err?.message ||
          "Unable to complete Admin Recovery."
      );
    } finally {
      setSaving(false);
    }
  }

  // ======================================
  // DISPLAY
  // ======================================

  if (!options.length) {
    return null;
  }

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
              onChange={(event) => {
                selectionTouchedRef.current = false;

                setShopId(event.target.value);
                setStatus(null);
                setRoster(null);
                setSelection("AUTO");
                setReason("");
                setError("");
                setMessage("");
              }}
            >
              {options.map((shop) => (
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
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              disabled={saving}
              onClick={() => {
                selectionTouchedRef.current = true;

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
              {label}
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
                ? "CURRENT OPENING B/F"
                : "NEXT OPENING B/F"
            }
            value={money(
              sameSlot
                ? source?.opening_balance
                : source?.closing_balance
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
                  .map((employee) => employee.name)
                  .join(" · ")
              : roster
              ? "VACANT"
              : "—"}
          </div>
        </div>

        <div style={styles.staff}>
          <label style={styles.label}>
            {sameSlot
              ? "ADMIN NOTE (OPTIONAL)"
              : "ADMIN REASON"}
          </label>

          <textarea
            rows={2}
            maxLength={500}
            style={styles.field}
            value={reason}
            disabled={saving}
            onChange={(event) => {
              setReason(event.target.value);
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
              opacity: canSave ? 1 : 0.5,
            }}
          >
            {saving
              ? "SAVING..."
              : sameSlot
              ? "END RECOVERY — KEEP SHIFT OPEN"
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

// ======================================
// FIGURE
// ======================================

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
