"use client";

import { useCallback, useEffect, useState } from "react";

export default function CashierOverview({
  user,
  currentShift,
}) {
  const [summary, setSummary] = useState({
    openingBalance: 0,
    companyFloat: 0,
    mshwariFloat: 0,
    totalOutput: 0,
    totalExpenses: 0,
    netIncome: 0,
    closingBalance: 0,
  });

  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const accessToken =
    user?.access_token || null;

  const shiftId =
    currentShift?.id || null;

  // --------------------------------------------------
  // LOAD LATEST CASHIER SUMMARY
  // --------------------------------------------------

  const loadOverview = useCallback(
    async (showLoading = false) => {
      if (
        !shiftId ||
        !accessToken ||
        !supabaseUrl ||
        !supabaseAnonKey
      ) {
        setLoading(false);
        return;
      }

      try {
        if (showLoading) {
          setLoading(true);
        }

        // --------------------------------------------
        // GET LATEST SHIFT TOTALS
        // --------------------------------------------

        const shiftResponse = await fetch(
          `${supabaseUrl}/rest/v1/shifts` +
            `?id=eq.${encodeURIComponent(shiftId)}` +
            `&select=id,status,opening_balance,total_output,total_expenses,net_income,closing_balance` +
            `&limit=1`,
          {
            method: "GET",
            headers: {
              apikey: supabaseAnonKey,
              Authorization:
                `Bearer ${accessToken}`,
              "Content-Type":
                "application/json",
            },
            cache: "no-store",
          }
        );

        let shiftResult = null;

        try {
          shiftResult =
            await shiftResponse.json();
        } catch {
          shiftResult = null;
        }

        if (!shiftResponse.ok) {
          throw new Error(
            shiftResult?.message ||
              shiftResult?.details ||
              "Unable to load shift totals."
          );
        }

        const latestShift =
          Array.isArray(shiftResult) &&
          shiftResult.length > 0
            ? shiftResult[0]
            : null;

        if (!latestShift) {
          return;
        }

        // --------------------------------------------
        // GET COMPANY + M-SHWARI FLOAT
        // --------------------------------------------

        const floatResponse = await fetch(
          `${supabaseUrl}/rest/v1/shift_income_entries` +
            `?shift_id=eq.${encodeURIComponent(shiftId)}` +
            `&select=entry_type,amount`,
          {
            method: "GET",
            headers: {
              apikey: supabaseAnonKey,
              Authorization:
                `Bearer ${accessToken}`,
              "Content-Type":
                "application/json",
            },
            cache: "no-store",
          }
        );

        let floatResult = null;

        try {
          floatResult =
            await floatResponse.json();
        } catch {
          floatResult = null;
        }

        if (!floatResponse.ok) {
          throw new Error(
            floatResult?.message ||
              floatResult?.details ||
              "Unable to load float totals."
          );
        }

        const entries =
          Array.isArray(floatResult)
            ? floatResult
            : [];

        let companyFloat = 0;
        let mshwariFloat = 0;

        for (const entry of entries) {
          const value =
            Number(entry.amount || 0);

          if (
            entry.entry_type ===
            "COMPANY_FLOAT"
          ) {
            companyFloat += value;
          }

          if (
            entry.entry_type ===
            "MSHWARI_FLOAT"
          ) {
            mshwariFloat += value;
          }
        }

        setSummary({
          openingBalance:
            Number(
              latestShift.opening_balance || 0
            ),

          companyFloat:
            roundMoney(companyFloat),

          mshwariFloat:
            roundMoney(mshwariFloat),

          totalOutput:
            Number(
              latestShift.total_output || 0
            ),

          totalExpenses:
            Number(
              latestShift.total_expenses || 0
            ),

          netIncome:
            Number(
              latestShift.net_income || 0
            ),

          closingBalance:
            Number(
              latestShift.closing_balance || 0
            ),
        });

        setLastUpdated(
          new Date()
        );
      } catch (error) {
        console.error(
          "CASHIER OVERVIEW ERROR:",
          error
        );
      } finally {
        setLoading(false);
      }
    },
    [
      shiftId,
      accessToken,
      supabaseUrl,
      supabaseAnonKey,
    ]
  );

  // --------------------------------------------------
  // INITIAL LOAD + AUTO REFRESH
  // --------------------------------------------------

  useEffect(() => {
    if (!shiftId) {
      setLoading(false);
      return;
    }

    loadOverview(true);

    const timer =
      setInterval(() => {
        loadOverview(false);
      }, 5000);

    return () => {
      clearInterval(timer);
    };
  }, [
    shiftId,
    loadOverview,
  ]);

  // --------------------------------------------------
  // DISPLAY
  // --------------------------------------------------

  if (!currentShift) {
    return null;
  }

  return (
    <div
      style={{
        marginTop: "20px",
        marginBottom: "20px",
        backgroundColor: "white",
        padding: "22px",
        borderRadius: "12px",
        boxShadow:
          "0 2px 10px rgba(0,0,0,0.08)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "15px",
          marginBottom: "18px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
            }}
          >
            Shift Overview
          </h2>

          <p
            style={{
              margin:
                "5px 0 0",
              color: "#64748b",
              fontSize: "13px",
            }}
          >
            Current shift figures
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            loadOverview(true)
          }
          disabled={loading}
          style={{
            padding: "8px 14px",
            borderRadius: "7px",
            border:
              "1px solid #cbd5e1",
            backgroundColor: "white",
            cursor: loading
              ? "not-allowed"
              : "pointer",
            fontWeight: "bold",
          }}
        >
          {loading
            ? "Refreshing..."
            : "Refresh"}
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(145px, 1fr))",
          gap: "12px",
        }}
      >
        <OverviewCard
          title="Balance B/F"
          value={
            summary.openingBalance
          }
        />

        <OverviewCard
          title="Company Float"
          value={
            summary.companyFloat
          }
        />

        <OverviewCard
          title="M-Shwari Float"
          value={
            summary.mshwariFloat
          }
        />

        <OverviewCard
          title="Total Output"
          value={
            summary.totalOutput
          }
        />

        <OverviewCard
          title="Expenses"
          value={
            summary.totalExpenses
          }
        />

        <OverviewCard
          title="Net Income"
          value={
            summary.netIncome
          }
          important
        />

        <OverviewCard
          title="Closing Balance"
          value={
            summary.closingBalance
          }
          important
        />
      </div>

      {lastUpdated && (
        <div
          style={{
            marginTop: "12px",
            color: "#94a3b8",
            fontSize: "11px",
            textAlign: "right",
          }}
        >
          Updated{" "}
          {new Intl.DateTimeFormat(
            "en-KE",
            {
              timeZone:
                "Africa/Nairobi",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            }
          ).format(lastUpdated)}
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------
// OVERVIEW CARD
// --------------------------------------------------

function OverviewCard({
  title,
  value,
  important = false,
}) {
  return (
    <div
      style={{
        padding: "15px",
        borderRadius: "10px",
        border: important
          ? "2px solid #16a34a"
          : "1px solid #e2e8f0",
        backgroundColor: important
          ? "#f0fdf4"
          : "#f8fafc",
      }}
    >
      <div
        style={{
          fontSize: "12px",
          color: "#64748b",
          marginBottom: "6px",
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontSize: important
            ? "19px"
            : "17px",
          fontWeight: "bold",
          color: important
            ? "#166534"
            : "#0f172a",
        }}
      >
        KES{" "}
        {Number(
          value || 0
        ).toLocaleString(
          "en-KE",
          {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------
// MONEY
// --------------------------------------------------

function roundMoney(value) {
  return (
    Math.round(
      (Number(value) +
        Number.EPSILON) *
        100
    ) / 100
  );
}
