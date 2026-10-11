"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

// =====================================================
// TEAM LEGEND / NYIKA
// ACCOUNTS INFORMATION — PROFESSIONAL V2
//
// - Fits one of three equal dashboard columns
// - Existing account details preserved
// - Rent due: 1st of each month
// - Banking due: every Monday
// - WiFi / DStv / Electricity: Admin-set date
// - Nairobi calendar dates
// - Read-only cashier information
// - No financial transactions
// =====================================================

const ACCOUNT_ORDER = [
  "RENT",
  "WIFI",
  "DSTV",
  "ELECTRICITY",
  "BANKING",
];

function showValue(value) {
  const clean = String(value ?? "").trim();
  return clean || "—";
}

// =====================================================
// NAIROBI DATE HELPERS
// =====================================================

function todayNairobi() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  return `${values.year}-${values.month}-${values.day}`;
}

function parseDateKey(key) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      String(key || "")
    )
  ) {
    return null;
  }

  const date = new Date(`${key}T12:00:00Z`);

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

function toDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function nextRentDue(today) {
  const date = parseDateKey(today);

  if (!date) return null;

  // On the 1st, show today's due date.
  if (date.getUTCDate() === 1) {
    return today;
  }

  // First day of the next month.
  return toDateKey(
    new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth() + 1,
        1
      )
    )
  );
}

function nextBankingDue(today) {
  const date = parseDateKey(today);

  if (!date) return null;

  const weekday = date.getUTCDay();

  // Monday = 1.
  // Monday itself is DUE TODAY.
  const daysUntilMonday =
    (8 - weekday) % 7;

  date.setUTCDate(
    date.getUTCDate() + daysUntilMonday
  );

  return toDateKey(date);
}

function getDueDate(account, today) {
  const category = String(
    account?.account_type || ""
  )
    .trim()
    .toUpperCase();

  if (category === "RENT") {
    return {
      date: nextRentDue(today),
      rule: "Monthly · 1st",
      automatic: true,
    };
  }

  if (category === "BANKING") {
    return {
      date: nextBankingDue(today),
      rule: "Every Monday",
      automatic: true,
    };
  }

  const configuredDate = String(
    account?.due_date || ""
  ).slice(0, 10);

  const validDate =
    parseDateKey(configuredDate);

  return {
    date: validDate ? configuredDate : null,
    rule: "Admin configured",
    automatic: false,
  };
}

function dateDifference(today, dueDate) {
  const start = parseDateKey(today);
  const finish = parseDateKey(dueDate);

  if (!start || !finish) return null;

  const startUTC = Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate()
  );

  const finishUTC = Date.UTC(
    finish.getUTCFullYear(),
    finish.getUTCMonth(),
    finish.getUTCDate()
  );

  return Math.round(
    (finishUTC - startUTC) / 86400000
  );
}

function formatDate(key) {
  const date = parseDateKey(key);

  if (!date) return "NOT SET";

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: "UTC",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  ).format(date);
}

function getDueStatus(today, dueDate) {
  if (!dueDate) {
    return {
      label: "NOT SET",
      tone: "unset",
    };
  }

  const remaining = dateDifference(
    today,
    dueDate
  );

  if (remaining === null) {
    return {
      label: "NOT SET",
      tone: "unset",
    };
  }

  if (remaining < 0) {
    return {
      label: "DATE PASSED",
      tone: "passed",
    };
  }

  if (remaining === 0) {
    return {
      label: "DUE TODAY",
      tone: "today",
    };
  }

  if (remaining <= 3) {
    return {
      label: "DUE SOON",
      tone: "soon",
    };
  }

  return {
    label: "SCHEDULED",
    tone: "normal",
  };
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export default function CashierAccountsPanel({
  user,
}) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [today, setToday] = useState(
    () => todayNairobi()
  );

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const accessToken =
    user?.access_token || null;

  const shopId =
    user?.shop_id ||
    user?.shopId ||
    null;

  // ==================================================
  // LOAD SHOP ACCOUNT INFORMATION
  // ==================================================

  const loadAccounts = useCallback(
    async (signal) => {
      setToday(todayNairobi());

      if (
        !shopId ||
        !accessToken ||
        !supabaseUrl ||
        !supabaseAnonKey
      ) {
        setAccounts([]);
        setLoading(false);
        return;
      }

      try {
        const url =
          `${String(supabaseUrl).replace(/\/+$/, "")}` +
          `/rest/v1/shop_accounts` +
          `?shop_id=eq.${encodeURIComponent(shopId)}` +
          `&is_active=eq.true` +
          `&select=id,account_type,description,` +
          `account_number,paybill_till,bank,is_active,due_date`;

        const response = await fetch(url, {
          method: "GET",
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          cache: "no-store",
          signal,
        });

        let result = null;

        try {
          result = await response.json();
        } catch {
          result = null;
        }

        if (!response.ok) {
          throw new Error(
            result?.message ||
            result?.details ||
            "Unable to load Accounts Information."
          );
        }

        if (signal?.aborted) return;

        setAccounts(
          Array.isArray(result) ? result : []
        );

        setError("");
      } catch (err) {
        if (signal?.aborted) return;

        console.error(
          "ACCOUNTS INFORMATION ERROR:",
          err
        );

        setError(
          err?.message ||
          "Unable to load account information."
        );
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [
      shopId,
      accessToken,
      supabaseUrl,
      supabaseAnonKey,
    ]
  );

  // ==================================================
  // AUTO REFRESH EVERY 5 SECONDS
  // ==================================================

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);

    void loadAccounts(controller.signal);

    const timer = setInterval(() => {
      void loadAccounts(controller.signal);
    }, 5000);

    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [loadAccounts]);

  // ==================================================
  // ORDER ACCOUNTS
  // ==================================================

  const orderedAccounts = useMemo(() => {
    return [...accounts].sort((a, b) => {
      const typeA = String(
        a.account_type || ""
      ).toUpperCase();

      const typeB = String(
        b.account_type || ""
      ).toUpperCase();

      const indexA = ACCOUNT_ORDER.indexOf(typeA);
      const indexB = ACCOUNT_ORDER.indexOf(typeB);

      const rankA =
        indexA === -1 ? 999 : indexA;

      const rankB =
        indexB === -1 ? 999 : indexB;

      if (rankA !== rankB) {
        return rankA - rankB;
      }

      return typeA.localeCompare(typeB);
    });
  }, [accounts]);

  // ==================================================
  // DISPLAY
  // ==================================================

  return (
    <section className="tl-accounts-info">
      <style>{accountsCss}</style>

      <div className="tl-accounts-title">
        <div>
          <div className="tl-accounts-heading">
            ACCOUNTS INFORMATION
          </div>

          <div className="tl-accounts-subheading">
            Payment details and upcoming due dates
          </div>
        </div>

        <span className="tl-accounts-readonly">
          READ ONLY
        </span>
      </div>

      <div className="tl-accounts-head">
        <div>DESCRIPTION</div>
        <div>ACCOUNT NUMBER</div>
        <div>PAYBILL / TILL</div>
        <div>BANK</div>
        <div>DUE DATE</div>
      </div>

      {loading ? (
        <div className="tl-accounts-empty">
          Loading accounts...
        </div>
      ) : error ? (
        <div
          className="tl-accounts-error"
          role="alert"
        >
          {error}
        </div>
      ) : orderedAccounts.length === 0 ? (
        <div className="tl-accounts-empty">
          No account information available.
        </div>
      ) : (
        orderedAccounts.map((account) => {
          const due = getDueDate(
            account,
            today
          );

          const status = getDueStatus(
            today,
            due.date
          );

          return (
            <div
              key={account.id}
              className="tl-accounts-row"
            >
              <div className="tl-accounts-type">
                {showValue(
                  account.account_type
                )}
              </div>

              <AccountValue
                label="ACCOUNT NUMBER"
                value={account.account_number}
                className="tl-accounts-number"
              />

              <AccountValue
                label="PAYBILL / TILL"
                value={account.paybill_till}
                className="tl-accounts-paybill"
              />

              <AccountValue
                label="BANK"
                value={account.bank}
                className="tl-accounts-bank"
              />

              <div className="tl-accounts-due">
                <div
                  className={`tl-accounts-due-value ${status.tone}`}
                >
                  <span className="tl-accounts-due-date">
                    {formatDate(due.date)}
                  </span>

                  <span className="tl-accounts-due-status">
                    {status.label}
                  </span>
                </div>

                <div className="tl-accounts-due-rule">
                  {due.rule}
                </div>
              </div>
            </div>
          );
        })
      )}

      <div className="tl-accounts-footer">
        Account details and specific due dates
        are configured by Admin. Rent and Banking
        follow recurring dates automatically.
        Due dates are reminders, not confirmation
        that a payment has or has not been made.
      </div>
    </section>
  );
}

// =====================================================
// ACCOUNT FIELD
// =====================================================

function AccountValue({
  label,
  value,
  className = "",
}) {
  return (
    <div
      className={`tl-accounts-field ${className}`}
    >
      <span className="tl-accounts-mobile-label">
        {label}
      </span>

      <div className="tl-accounts-value">
        {showValue(value)}
      </div>
    </div>
  );
}

// =====================================================
// PROFESSIONAL RESPONSIVE STYLES
// =====================================================

const accountsCss = `
.tl-accounts-info {
  grid-column: auto;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;

  container-type: inline-size;
  container-name: accounts-panel;

  background: #101f30;
  color: #f0f5fa;

  border: 1px solid #2a3d52;
  border-radius: 12px;
  overflow: hidden;

  box-shadow: 0 8px 25px rgba(0,0,0,.12);

  font-family: Inter, ui-sans-serif, system-ui,
    -apple-system, BlinkMacSystemFont,
    "Segoe UI", sans-serif;
}

.tl-accounts-info * {
  box-sizing: border-box;
}

.tl-accounts-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;

  padding: 16px 17px;
  background: #152639;
  border-left: 3px solid #d9b66c;
  border-bottom: 1px solid #2a3d52;
}

.tl-accounts-heading {
  color: #f0f5fa;
  font-size: 14px;
  font-weight: 850;
  letter-spacing: .05em;
}

.tl-accounts-subheading {
  color: #91a5b8;
  font-size: 10px;
  margin-top: 5px;
}

.tl-accounts-readonly {
  color: #d9b66c;
  border: 1px solid #6a593a;
  background: #2a2930;
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 9px;
  font-weight: 850;
}

.tl-accounts-head,
.tl-accounts-row {
  display: grid;
  grid-template-columns:
    minmax(0,.8fr)
    minmax(0,1.15fr)
    minmax(0,1.05fr)
    minmax(0,.85fr)
    minmax(0,1.3fr);

  gap: 7px;
  align-items: center;
  padding: 11px 12px;
}

.tl-accounts-head {
  color: #91a5b8;
  background: #0a1725;
  border-bottom: 1px solid #2a3d52;

  font-size: 9px;
  font-weight: 850;
  letter-spacing: .03em;
  text-align: center;
}

.tl-accounts-row {
  background: #101f30;
  border-bottom: 1px solid #223448;
}

.tl-accounts-row:nth-of-type(even) {
  background: #132336;
}

.tl-accounts-type {
  min-width: 0;
  color: #f0f5fa;
  font-weight: 850;
  font-size: 11px;
  overflow-wrap: anywhere;
}

.tl-accounts-field {
  min-width: 0;
}

.tl-accounts-value {
  min-width: 0;
  min-height: 35px;

  display: flex;
  align-items: center;
  justify-content: center;

  padding: 7px 6px;

  background: #0a1725;
  color: #f0f5fa;

  border: 1px solid #304359;
  border-radius: 7px;

  font-size: 11px;
  font-weight: 750;
  text-align: center;
  overflow-wrap: anywhere;
}

.tl-accounts-mobile-label {
  display: none;
}

.tl-accounts-due {
  min-width: 0;
  text-align: center;
}

.tl-accounts-due-value {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 5px;

  padding: 7px 6px;

  border-radius: 7px;
  border: 1px solid #304359;
  background: #0a1725;

  color: #dbe5ef;
}

.tl-accounts-due-date {
  font-size: 11px;
  font-weight: 850;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.tl-accounts-due-status {
  font-size: 8px;
  font-weight: 850;
  letter-spacing: .02em;
}

.tl-accounts-due-value.normal {
  color: #b6d0f1;
  border-color: #345375;
  background: #142d48;
}

.tl-accounts-due-value.soon {
  color: #ffe3a8;
  border-color: #695638;
  background: #322a1d;
}

.tl-accounts-due-value.today,
.tl-accounts-due-value.passed {
  color: #ffc3ce;
  border-color: #774155;
  background: #38202a;
}

.tl-accounts-due-value.unset {
  color: #91a5b8;
  border-color: #304359;
  background: #0a1725;
}

.tl-accounts-due-rule {
  margin-top: 5px;
  color: #91a5b8;
  font-size: 9px;
  line-height: 1.4;
}

.tl-accounts-empty,
.tl-accounts-error {
  padding: 25px 15px;
  text-align: center;
  color: #c4d0dc;
  font-size: 12px;
  line-height: 1.5;
}

.tl-accounts-error {
  color: #ffc3ce;
  background: #38202a;
}

.tl-accounts-footer {
  color: #91a5b8;
  background: #0a1725;
  border-top: 1px solid #223448;

  padding: 12px 15px;

  font-size: 10px;
  line-height: 1.6;
}

/* ==============================================
   THREE-COLUMN DASHBOARD ADAPTATION

   In the narrow Accounts panel:
   Top row = Account type + Due date
   Second row = Account / Paybill / Bank

   This prevents five cramped columns.
   ============================================== */

@container accounts-panel (max-width: 620px) {

  .tl-accounts-title {
    padding: 12px;
  }

  .tl-accounts-heading {
    font-size: 13px;
  }

  .tl-accounts-head {
    display: none;
  }

  .tl-accounts-row {
    grid-template-columns:
      repeat(3, minmax(0, 1fr));

    grid-template-rows: auto auto;
    gap: 9px;

    padding: 12px 10px;
  }

  .tl-accounts-type {
    grid-column: 1 / 3;
    grid-row: 1;

    font-size: 12px;
    padding: 5px 0;
  }

  .tl-accounts-due {
    grid-column: 3;
    grid-row: 1;
  }

  .tl-accounts-number {
    grid-column: 1;
    grid-row: 2;
  }

  .tl-accounts-paybill {
    grid-column: 2;
    grid-row: 2;
  }

  .tl-accounts-bank {
    grid-column: 3;
    grid-row: 2;
  }

  .tl-accounts-mobile-label {
    display: block;

    margin-bottom: 5px;

    color: #91a5b8;
    font-size: 8px;
    font-weight: 850;
    letter-spacing: .03em;
  }

  .tl-accounts-value {
    min-height: 34px;
    font-size: 10px;
    padding: 6px 4px;
  }

  .tl-accounts-due-date {
    font-size: 10px;
  }

  .tl-accounts-due-rule {
    font-size: 8px;
  }

  .tl-accounts-footer {
    padding: 11px;
  }
}

@container accounts-panel (max-width: 320px) {
  .tl-accounts-row {
    grid-template-columns:
      repeat(2, minmax(0, 1fr));
  }

  .tl-accounts-type {
    grid-column: 1;
  }

  .tl-accounts-due {
    grid-column: 2;
  }

  .tl-accounts-number {
    grid-column: 1;
    grid-row: 2;
  }

  .tl-accounts-paybill {
    grid-column: 2;
    grid-row: 2;
  }

  .tl-accounts-bank {
    grid-column: 1 / -1;
    grid-row: 3;
  }
}
`;
