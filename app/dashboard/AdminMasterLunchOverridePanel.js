"use client";

import { useCallback, useEffect, useState } from "react";

function nairobiDate() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(new Date());

  const get = (name) =>
    parts.find((part) => part.type === name)?.value || "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

export default function AdminMasterLunchOverridePanel({
  user,
  employee,
}) {
  const [date, setDate] = useState(nairobiDate);
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const employeeId = employee?.employee_id || "";

  const url = String(
    process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  ).replace(/\/+$/, "");

  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  const token = user?.access_token || "";

  const rpc = useCallback(async (name, body, signal) => {
    if (!url || !anonKey || !token) {
      throw new Error("Admin session is unavailable.");
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

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        result?.message ||
        result?.details ||
        "Unable to process Lunch override."
      );
    }

    return result;
  }, [url, anonKey, token]);

  const loadStatus = useCallback(async (signal) => {
    if (!employeeId || !date) return;

    const result = await rpc(
      "tl_admin_master_lunch_override_snapshot",
      {
        p_employee_id: employeeId,
        p_meal_date: date,
      },
      signal
    );

    if (!signal?.aborted) {
      setStatus(result);
    }
  }, [rpc, employeeId, date]);

  useEffect(() => {
    const controller = new AbortController();

    setStatus(null);
    setReason("");
    setNotice("");
    setError("");
    setLoading(true);

    loadStatus(controller.signal)
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err?.message || "Unable to load Lunch status.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [loadStatus]);

  async function saveOverride(eligible) {
    if (!employeeId || !date || saving) return;

    if (reason.trim().length < 2 ||
        reason.trim().length > 500) {
      setError("Enter a reason between 2 and 500 characters.");
      return;
    }

    const action = eligible ? "RE-ENABLE" : "HARD DISABLE";

    if (!window.confirm(
      `${action} LUNCH\n\n` +
      `Employee: ${employee.full_name}\n` +
      `Date: ${date}\n\n` +
      "Confirm this Admin decision?"
    )) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const result = await rpc(
        "tl_admin_master_lunch_override_save",
        {
          p_employee_id: employeeId,
          p_meal_date: date,
          p_eligible: eligible,
          p_reason: reason.trim(),
        }
      );

      if (result?.ok !== true) {
        throw new Error("Admin decision was not confirmed.");
      }

      setReason("");

      const errors = Array.isArray(result.posting_errors)
        ? result.posting_errors
        : [];

      setNotice(
        errors.length
          ? "Decision saved, but automatic posting reported an error. Check Supabase posting errors."
          : eligible
            ? "Lunch re-enabled. Eligible open shifts checked for posting."
            : "Lunch hard-disabled for the selected date."
      );

      await loadStatus();
    } catch (err) {
      setError(err?.message || "Unable to save Lunch decision.");
    } finally {
      setSaving(false);
    }
  }

  if (!employeeId) return null;

  const latest = status?.latest_override;
  const posted = Number(status?.posted_count || 0);
  const awarded = Number(status?.award_count || 0);

  return (
    <section className="ml-override">
      <style>{`
        .ml-override {
          margin-top: 18px;
          padding: 18px;
          border: 1px solid #b89755;
          border-radius: 11px;
          background: #101f35;
          color: #edf3fb;
        }

        .ml-override h3 {
          margin: 0 0 15px;
          color: #ecc879;
          font-size: 16px;
        }

        .ml-grid {
          display: grid;
          grid-template-columns:
            repeat(auto-fit,minmax(200px,1fr));
          gap: 13px;
        }

        .ml-override label {
          display: grid;
          gap: 7px;
          color: #cbd7e8;
          font-size: 12px;
          font-weight: 750;
        }

        .ml-override input {
          width: 100%;
          box-sizing: border-box;
          min-height: 42px;
          padding: 10px;
          background: #0a192e;
          color: white;
          border: 1px solid #64748b;
          border-radius: 7px;
        }

        .ml-status {
          margin: 13px 0;
          padding: 11px;
          background: #142943;
          border: 1px solid #304764;
          border-radius: 7px;
          font-size: 12px;
          line-height: 1.7;
        }

        .ml-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 14px;
        }

        .ml-actions button {
          flex: 1 1 170px;
          min-height: 43px;
          border-radius: 7px;
          border: 0;
          font-weight: 850;
          font-size: 12px;
          cursor: pointer;
        }

        .ml-disable {
          background: #a53e55;
          color: white;
        }

        .ml-enable {
          background: #8de5bb;
          color: #07392f;
        }

        .ml-actions button:disabled {
          opacity: .5;
          cursor: not-allowed;
        }

        .ml-message {
          font-size: 12px;
          margin-top: 11px;
          color: #b6f2d7;
        }

        .ml-error {
          color: #ffaab6;
        }
      `}</style>

      <h3>DATE-SPECIFIC LUNCH CONTROL</h3>

      <div className="ml-grid">
        <label>
          Selected Master Employee
          <input
            value={employee.full_name}
            disabled
          />
        </label>

        <label>
          Business Date
          <input
            type="date"
            value={date}
            disabled={saving}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
      </div>

      <div className="ml-status">
        {loading ? (
          "Checking Lunch status..."
        ) : (
          <>
            <div>
              Admin override:{" "}
              <strong>
                {latest
                  ? latest.eligible
                    ? "RE-ENABLED"
                    : "HARD DISABLED"
                  : "DEFAULT SETTINGS"}
              </strong>
            </div>

            <div>
              Lunch awards: <strong>{awarded}</strong>
            </div>

            <div>
              Confirmed expenses: <strong>{posted}</strong>
            </div>

            {latest?.reason && (
              <div>
                Last reason: {latest.reason}
              </div>
            )}

            {posted > 0 && (
              <div>
                Previously posted Lunch will not be
                automatically reversed.
              </div>
            )}
          </>
        )}
      </div>

      <label>
        Admin Reason
        <input
          value={reason}
          maxLength={500}
          disabled={saving}
          placeholder="Enter the reason for this decision"
          onChange={(event) => setReason(event.target.value)}
        />
      </label>

      <div className="ml-actions">
        <button
          type="button"
          className="ml-disable"
          disabled={saving || loading || !status}
          onClick={() => saveOverride(false)}
        >
          HARD DISABLE LUNCH
        </button>

        <button
          type="button"
          className="ml-enable"
          disabled={saving || loading || !status}
          onClick={() => saveOverride(true)}
        >
          RE-ENABLE LUNCH
        </button>
      </div>

      {notice && (
        <div className="ml-message" role="status">
          {notice}
        </div>
      )}

      {error && (
        <div className="ml-message ml-error" role="alert">
          {error}
        </div>
      )}
    </section>
  );
}
