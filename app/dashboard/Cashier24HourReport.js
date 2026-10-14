"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import CashierSavingsPanel from "./CashierSavingsPanel";
import CashierSalaryPanel from "./CashierSalaryPanel";
import CashierLiveFeedPanel from "./CashierLiveFeedPanel";
import CashierMealsRotaPanel from "./CashierMealsRotaPanel";
import CashierAccountsPanel from "./CashierAccountsPanel";
import CashierAccountsReturnPanel from "./CashierAccountsReturnPanel";

import PlatformReadings24Hour from "./PlatformReadings24Hour";
import CloseShift24Hour from "./CloseShift24Hour";

// ==================================================
// TEAM LEGEND / NYIKA
// 24-HOUR PROFESSIONAL CASHIER REPORT
//
// Meals & Bonuses:
// - Shared CashierMealsRotaPanel
// - Directly below Live Feed
// - No extra employee sign-in
// - 24-hour staff exempt from 10:50 cutoff
// - Expense posting remains in Supabase
//
// Existing financial logic retained.
// ==================================================

export default function Cashier24HourReport({
  user,
  currentShift,
}) {
  const router = useRouter();

  const [shift, setShift] = useState(
    currentShift || null
  );

  const [
    incomeEntries,
    setIncomeEntries,
  ] = useState([]);

  const [expenses, setExpenses] = useState([]);

  const [refreshKey, setRefreshKey] = useState(0);

  const [floatInputs, setFloatInputs] = useState({
    company: ["", "", ""],
    mshwari: ["", "", ""],
  });

  const [expenseInputs, setExpenseInputs] = useState(
    Array.from(
      { length: 10 },
      () => ({
        description: "",
        amount: "",
      })
    )
  );

  const [loading, setLoading] = useState(true);
  const [savingFloats, setSavingFloats] = useState(false);
  const [savingExpenses, setSavingExpenses] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [now, setNow] = useState(() => new Date());

  // ==================================================
  // SUPABASE
  // ==================================================

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const accessToken =
    user?.access_token || null;

  const shopId =
    user?.shop_id ||
    user?.shopId ||
    currentShift?.shop_id ||
    null;

  const cashierId =
    user?.profile_id ||
    user?.id ||
    user?.user_id ||
    user?.auth_user_id ||
    null;

  const shiftId = currentShift?.id || null;

  const shopName =
    user?.shop ||
    user?.shop_name ||
    user?.shopName ||
    "SHOP";

  // ==================================================
  // CASHIER NAME
  // ==================================================

  const sharedAccountName =
    user?.full_name ||
    user?.name ||
    user?.username ||
    "Cashier";

  const cashierName =
    String(
      shift?.cashier_name ||
      currentShift?.cashier_name ||
      sharedAccountName ||
      "Cashier"
    ).trim() || "Cashier";

  // ==================================================
  // LIVE NAIROBI GREETING CLOCK
  // ==================================================

  useEffect(() => {
    setNow(new Date());

    const timer = setInterval(() => {
      setNow(new Date());
    }, 15000);

    return () => clearInterval(timer);
  }, []);

  // ==================================================
  // LOAD CASHIER REPORT
  // ==================================================

  const loadReport = useCallback(async () => {
    if (
      !shiftId ||
      !shopId ||
      !accessToken ||
      !supabaseUrl ||
      !supabaseAnonKey
    ) {
      setLoading(false);
      return;
    }

    try {
      // ------------------------------------------
      // SHIFT
      // ------------------------------------------

      const shiftResponse = await fetch(
        `${supabaseUrl}/rest/v1/shifts` +
        `?id=eq.${encodeURIComponent(shiftId)}` +
        `&select=*` +
        `&limit=1`,
        {
          method: "GET",
          headers: authHeaders(
            supabaseAnonKey,
            accessToken
          ),
          cache: "no-store",
        }
      );

      const shiftResult = await safeJson(
        shiftResponse
      );

      if (!shiftResponse.ok) {
        throw new Error(
          shiftResult?.message ||
          shiftResult?.details ||
          "Unable to load shift."
        );
      }

      const latestShift =
        Array.isArray(shiftResult) &&
        shiftResult.length > 0
          ? shiftResult[0]
          : null;

      // ------------------------------------------
      // FLOATS
      // ------------------------------------------

      const incomeResponse = await fetch(
        `${supabaseUrl}/rest/v1/shift_income_entries` +
        `?shift_id=eq.${encodeURIComponent(shiftId)}` +
        `&select=id,entry_type,description,amount,created_at` +
        `&order=created_at.asc`,
        {
          method: "GET",
          headers: authHeaders(
            supabaseAnonKey,
            accessToken
          ),
          cache: "no-store",
        }
      );

      const incomeResult = await safeJson(
        incomeResponse
      );

      if (!incomeResponse.ok) {
        throw new Error(
          incomeResult?.message ||
          incomeResult?.details ||
          "Unable to load float entries."
        );
      }

      const loadedIncome =
        Array.isArray(incomeResult)
          ? incomeResult
          : [];

      // ------------------------------------------
      // EXPENSES
      //
      // All expenses count toward totals.
      // Only MANUAL expenses occupy the
      // cashier's ten manual expense rows.
      // ------------------------------------------

      const expenseResponse = await fetch(
        `${supabaseUrl}/rest/v1/expenses` +
        `?shift_id=eq.${encodeURIComponent(shiftId)}` +
        `&select=id,description,amount,created_at,source_type,source_record_id,is_private` +
        `&order=created_at.asc`,
        {
          method: "GET",
          headers: authHeaders(
            supabaseAnonKey,
            accessToken
          ),
          cache: "no-store",
        }
      );

      const expenseResult = await safeJson(
        expenseResponse
      );

      if (!expenseResponse.ok) {
        throw new Error(
          expenseResult?.message ||
          expenseResult?.details ||
          "Unable to load expenses."
        );
      }

      const loadedExpenses =
        Array.isArray(expenseResult)
          ? expenseResult
          : [];

      const loadedManualExpenses =
        loadedExpenses.filter((expense) => {
          const sourceType = String(
            expense?.source_type || ""
          )
            .trim()
            .toUpperCase();

          const manualSource =
            sourceType === "" ||
            sourceType === "MANUAL";

          return (
            manualSource &&
            expense?.is_private !== true
          );
        });

      // ------------------------------------------
      // UPDATE STATE
      // ------------------------------------------

      setShift(latestShift || currentShift);
      setIncomeEntries(loadedIncome);
      setExpenses(loadedExpenses);

      // ------------------------------------------
      // FLOAT INPUTS
      // ------------------------------------------

      const companyRows = loadedIncome.filter(
        (entry) =>
          entry.entry_type === "COMPANY_FLOAT"
      );

      const mshwariRows = loadedIncome.filter(
        (entry) =>
          entry.entry_type === "MSHWARI_FLOAT"
      );

      setFloatInputs((previous) => {
        const company = [...previous.company];
        const mshwari = [...previous.mshwari];

        for (let i = 0; i < 3; i += 1) {
          if (companyRows[i]) {
            company[i] = String(
              companyRows[i].amount ?? ""
            );
          }

          if (mshwariRows[i]) {
            mshwari[i] = String(
              mshwariRows[i].amount ?? ""
            );
          }
        }

        return { company, mshwari };
      });

      // ------------------------------------------
      // MANUAL EXPENSE INPUTS
      // ------------------------------------------

      setExpenseInputs((previous) => {
        const next = Array.from(
          { length: 10 },
          (_, index) => ({
            description:
              previous[index]?.description || "",
            amount:
              previous[index]?.amount || "",
          })
        );

        for (let i = 0; i < 10; i += 1) {
          if (loadedManualExpenses[i]) {
            next[i] = {
              description:
                loadedManualExpenses[i]
                  .description || "",

              amount: String(
                loadedManualExpenses[i].amount ??
                ""
              ),
            };
          }
        }

        return next;
      });
    } catch (error) {
      console.error(
        "24H CASHIER REPORT ERROR:",
        error
      );

      setMessage(
        error?.message ||
        "Unable to load 24-hour cashier report."
      );

      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }, [
    shiftId,
    shopId,
    accessToken,
    supabaseUrl,
    supabaseAnonKey,
    currentShift,
  ]);

  // ==================================================
  // REFRESH COMPLETE REPORT
  // ==================================================

  const refresh24HourReport = useCallback(
    async () => {
      await loadReport();

      setRefreshKey(
        (previous) => previous + 1
      );
    },
    [loadReport]
  );

  // ==================================================
  // AUTO REFRESH EVERY 5 SECONDS
  // ==================================================

  useEffect(() => {
    refresh24HourReport();

    const timer = setInterval(() => {
      refresh24HourReport();
    }, 5000);

    return () => clearInterval(timer);
  }, [refresh24HourReport]);

  // ==================================================
  // LOGOUT
  // ==================================================

  function logout() {
    sessionStorage.removeItem("teamLegendUser");
    router.replace("/");
  }

  // ==================================================
  // FLOAT DATA
  // ==================================================

  const companyEntries = incomeEntries.filter(
    (entry) =>
      entry.entry_type === "COMPANY_FLOAT"
  );

  const mshwariEntries = incomeEntries.filter(
    (entry) =>
      entry.entry_type === "MSHWARI_FLOAT"
  );

  const companyTotal = roundMoney(
    companyEntries.reduce(
      (sum, entry) =>
        sum + Number(entry.amount ?? 0),
      0
    )
  );

  const mshwariTotal = roundMoney(
    mshwariEntries.reduce(
      (sum, entry) =>
        sum + Number(entry.amount ?? 0),
      0
    )
  );

  const companySlots = Array.from(
    { length: 3 },
    (_, index) =>
      companyEntries[index] || null
  );

  const mshwariSlots = Array.from(
    { length: 3 },
    (_, index) =>
      mshwariEntries[index] || null
  );

  // ==================================================
  // MANUAL EXPENSES
  // ==================================================

  const manualExpenses = expenses.filter(
    (expense) => {
      const sourceType = String(
        expense?.source_type || ""
      )
        .trim()
        .toUpperCase();

      return (
        (
          sourceType === "" ||
          sourceType === "MANUAL"
        ) &&
        expense?.is_private !== true
      );
    }
  );

  // ==================================================
  // SAVE M-SHWARI FLOATS
  //
  // COMPANY FLOAT IS NEVER CREATED BY CASHIER.
  // Accountant transfer backend is the writer.
  // ==================================================

  async function saveFloats() {
    const rowsToSave = [];

    for (let i = 0; i < 3; i += 1) {
      const mshwariUnlocked =
        i === 0 ||
        Boolean(mshwariSlots[i - 1]);

      if (
        mshwariUnlocked &&
        !mshwariSlots[i]
      ) {
        const raw = floatInputs.mshwari[i];

        if (
          raw !== "" &&
          raw !== undefined
        ) {
          const value = Number(raw);

          if (
            !Number.isFinite(value) ||
            value <= 0
          ) {
            setMessage(
              `Enter a valid M-Shwari Float ${i + 1}.`
            );

            setMessageType("error");
            return;
          }

          rowsToSave.push({
            shift_id: shiftId,
            entry_type: "MSHWARI_FLOAT",
            description:
              `Float ${i + 1} from M-Shwari`,
            amount: roundMoney(value),
          });
        }
      }
    }

    if (rowsToSave.length === 0) {
      setMessage(
        "Enter at least one active M-Shwari float amount."
      );
      setMessageType("error");
      return;
    }

    try {
      setSavingFloats(true);
      setMessage("");

      const response = await fetch(
        `${supabaseUrl}/rest/v1/shift_income_entries`,
        {
          method: "POST",
          headers: {
            apikey: supabaseAnonKey,
            Authorization:
              `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },

          body: JSON.stringify(rowsToSave),
        }
      );

      const result = await safeJson(response);

      if (!response.ok) {
        throw new Error(
          result?.message ||
          result?.details ||
          "Unable to save M-Shwari float."
        );
      }

      const newFloatTotal = roundMoney(
        companyTotal +
        mshwariTotal +
        rowsToSave.reduce(
          (sum, row) =>
            sum + Number(row.amount ?? 0),
          0
        )
      );

      const shiftResponse = await fetch(
        `${supabaseUrl}/rest/v1/shifts?id=eq.${encodeURIComponent(shiftId)}`,
        {
          method: "PATCH",

          headers: {
            apikey: supabaseAnonKey,
            Authorization:
              `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            total_added_float: newFloatTotal,
          }),
        }
      );

      if (!shiftResponse.ok) {
        throw new Error(
          "M-Shwari float saved but shift total could not be updated."
        );
      }

      setMessage(
        "M-Shwari float saved successfully."
      );

      setMessageType("success");

      await refresh24HourReport();
    } catch (error) {
      setMessage(
        error?.message ||
        "Unable to save M-Shwari float."
      );
      setMessageType("error");
    } finally {
      setSavingFloats(false);
    }
  }

  // ==================================================
  // SAVE MANUAL EXPENSES
  // ==================================================

  async function saveExpenses() {
    const nextIndex = manualExpenses.length;

    if (nextIndex >= 10) {
      setMessage(
        "All 10 manual expense rows have already been saved."
      );
      setMessageType("success");
      return;
    }

    const description = String(
      expenseInputs[nextIndex]?.description ||
      ""
    ).trim();

    const rawAmount =
      expenseInputs[nextIndex]?.amount;

    if (description === "") {
      setMessage(
        `Enter the description for expense ${nextIndex + 1}.`
      );
      setMessageType("error");
      return;
    }

    if (
      rawAmount === "" ||
      rawAmount === null ||
      rawAmount === undefined
    ) {
      setMessage(
        `Enter the amount for expense ${nextIndex + 1}.`
      );
      setMessageType("error");
      return;
    }

    const amount = Number(rawAmount);

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      setMessage(
        `Enter a valid amount for expense ${nextIndex + 1}.`
      );
      setMessageType("error");
      return;
    }

    const rowToSave = {
      shift_id: shiftId,
      description,
      amount: roundMoney(amount),
      created_by: cashierId,
      source_type: "MANUAL",
      is_private: false,
    };

    try {
      setSavingExpenses(true);
      setMessage("");

      const response = await fetch(
        `${supabaseUrl}/rest/v1/expenses`,
        {
          method: "POST",

          headers: {
            apikey: supabaseAnonKey,
            Authorization:
              `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },

          body: JSON.stringify(rowToSave),
        }
      );

      const result = await safeJson(response);

      if (!response.ok) {
        throw new Error(
          result?.message ||
          result?.details ||
          "Unable to save expense."
        );
      }

      const existingExpenseTotal =
        expenses.reduce(
          (sum, expense) =>
            sum +
            Number(expense.amount ?? 0),
          0
        );

      const newExpenseTotal = roundMoney(
        existingExpenseTotal + amount
      );

      const shiftResponse = await fetch(
        `${supabaseUrl}/rest/v1/shifts?id=eq.${encodeURIComponent(shiftId)}`,
        {
          method: "PATCH",

          headers: {
            apikey: supabaseAnonKey,
            Authorization:
              `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            total_expenses: newExpenseTotal,
          }),
        }
      );

      if (!shiftResponse.ok) {
        throw new Error(
          "Expense saved but shift total could not be updated."
        );
      }

      setMessage(
        nextIndex < 9
          ? `Expense ${nextIndex + 1} saved. Expense ${nextIndex + 2} is now available.`
          : "Expense 10 saved successfully."
      );

      setMessageType("success");

      await refresh24HourReport();
    } catch (error) {
      setMessage(
        error?.message ||
        "Unable to save expense."
      );
      setMessageType("error");
    } finally {
      setSavingExpenses(false);
    }
  }

  // ==================================================
  // TOTALS
  // ==================================================

  const openingBalance = Number(
    shift?.opening_balance ?? 0
  );

  const totalOutput = Number(
    shift?.total_output ?? 0
  );

  const totalExpenses = Number(
    shift?.total_expenses ?? 0
  );

  const closingBalance = Number(
    shift?.closing_balance ?? 0
  );

  const totalAdded = roundMoney(
    openingBalance +
    companyTotal +
    mshwariTotal
  );

  const totalSales = roundMoney(
    openingBalance +
    companyTotal +
    mshwariTotal +
    totalOutput
  );

  const reportDate = formatReportDate(
    shift?.opened_at ||
    new Date().toISOString()
  );

  const reportDay = formatReportDay(
    shift?.opened_at ||
    new Date().toISOString()
  );

  const shiftStatus = String(
    shift?.status || "OPEN"
  ).toUpperCase();

  const shiftName = normaliseShiftName(
    shift?.shift_name
  );

  const shiftLabel =
    shiftName === "SHIFT 1"
      ? "SHIFT 1"
      : shiftName === "SHIFT 2"
      ? "SHIFT 2"
      : shift?.shift_name ||
        "24-HOUR SHIFT";

  // ==================================================
  // GREETING
  // ==================================================

  const shiftIsClosed =
    shiftStatus === "CLOSED" ||
    shiftStatus === "COMPLETED";

  const greetingShiftNumber =
    shiftName === "SHIFT 2"
      ? "2"
      : "1";

  const nairobiHour = getNairobiHour(now);

  let shiftGreeting;

  if (shiftIsClosed) {
    shiftGreeting =
      `Good Bye 👋 — Shift ${greetingShiftNumber} Closed`;
  } else if (
    nairobiHour >= 5 &&
    nairobiHour < 12
  ) {
    shiftGreeting =
      `Good Morning 🌞 — Welcome to Shift ${greetingShiftNumber}`;
  } else if (
    nairobiHour >= 12 &&
    nairobiHour < 17
  ) {
    shiftGreeting =
      `Good Afternoon ☀️ — Welcome to Shift ${greetingShiftNumber}`;
  } else {
    shiftGreeting =
      `Good Evening 🌙 — Welcome to Shift ${greetingShiftNumber}`;
  }

  // ==================================================
  // LOADING
  // ==================================================

  if (loading && !shift) {
    return (
      <div style={loadingStyle}>
        Loading 24-hour cashier report...
      </div>
    );
  }

  if (!shift) return null;

  // ==================================================
  // MAIN DASHBOARD
  // ==================================================

  return (
    <div style={pageStyle}>
    <style>{`
  /* 24-HOUR PLATFORM READINGS:
     REMOVE NUMBER INPUT ARROWS */

  .tl24-clean-platform-inputs input[type="number"] {
    -moz-appearance: textfield;
    appearance: textfield;
  }

  .tl24-clean-platform-inputs input[type="number"]::-webkit-inner-spin-button,
  .tl24-clean-platform-inputs input[type="number"]::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
`}</style>
      {/* TOP HEADER */}

      <header style={topHeaderStyle}>
        <div style={brandWrapStyle}>
          <div style={crownStyle}>
            ♛
          </div>

          <div>
            <div style={brandStyle}>
              TEAM LEGEND
            </div>

            <div style={taglineStyle}>
              DISCIPLINE • FOCUS • RESULTS
            </div>
          </div>
        </div>

        <div style={headerRightStyle}>
          <div>
            Welcome,{" "}
            <strong>
              {cashierName.toUpperCase()}
            </strong>

            <div style={headerShopStyle}>
              {shopName.toUpperCase()}
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            style={logoutButtonStyle}
          >
            Logout
          </button>
        </div>
      </header>

      {/* SHARED LIVE FEED */}

      <CashierLiveFeedPanel
        user={user}
      />

      {/* ===================================== */}
      {/* MEALS & BONUSES - 24-HOUR SHOP        */}
      {/* Uses shared Executive LED panel       */}
      {/* No second employee sign-in            */}
      {/* ===================================== */}

      <CashierMealsRotaPanel
        user={user}
        currentShift={shift || currentShift}
      />

      {/* MAIN BODY */}

      <div style={bodyStyle}>
        <aside style={sidebarStyle}>
          <SidebarItem
            active
            icon="⌂"
            label="Cashier Report"
          />

          <SidebarItem
            icon="▤"
            label="View Reports"
          />

          <SidebarItem
            icon="▦"
            label="Accounts"
          />

          <SidebarItem
            icon="⚙"
            label="Settings"
          />
        </aside>

        <main style={mainStyle}>
          {/* TOP INFORMATION */}

          <div style={topGridStyle}>
            <TopCard
              title={shopName.toUpperCase()}
              subtitle="DAILY SALES REPORT"
              footer="24-HOUR SHOP"
            />

            <InfoCard
              title="CASHIER ON DUTY"
              value={cashierName}
              tone="brown"
            />

            <InfoCard
              title="DATE"
              value={reportDate}
            />

            <InfoCard
              title="DAY"
              value={reportDay}
            />

            <InfoCard
              title="SHIFT"
              value={shiftLabel}
              subvalue={
                `${displayTime(shift?.scheduled_start)} - ` +
                displayTime(shift?.scheduled_end)
              }
              tone="green"
            />

            <InfoCard
              title="STATUS"
              value={shiftStatus}
              tone="green"
            />
          </div>

          {/* GREETING */}

          <div
            style={{
              ...greetingBannerStyle,
              ...(shiftIsClosed
                ? greetingGoodbyeStyle
                : greetingWelcomeStyle),
            }}
          >
            {shiftGreeting}
          </div>

          {/* SHIFT BANNER */}

          <div style={shiftBannerStyle}>
            <strong>
              {shiftName === "SHIFT 1"
                ? "SHIFT 1 — DAY SHIFT"
                : shiftName === "SHIFT 2"
                ? "SHIFT 2 — NIGHT SHIFT"
                : "24-HOUR SHIFT"}
            </strong>

            <span>
              {shiftName === "SHIFT 1"
                ? "9:00 AM – 9:00 PM"
                : shiftName === "SHIFT 2"
                ? "9:00 PM – 9:00 AM"
                : ""}
            </span>
          </div>

          {/* MESSAGES */}

          {message && (
            <div
              style={{
                ...messageStyle,
                backgroundColor:
                  messageType === "success"
                    ? C.greenBg
                    : C.redBg,

                color:
                  messageType === "success"
                    ? "#b5f2dc"
                    : "#ffc3ce",

                borderColor:
                  messageType === "success"
                    ? "#2c645a"
                    : "#774155",
              }}
            >
              {message}
            </div>
          )}

          {/* INCOME AND EXPENSES */}

          <div style={upperGridStyle}>
            {/* INCOME STATEMENT */}

            <section style={panelStyle}>
              <PanelTitle
                title="INCOME STATEMENT"
                tone="blue"
              />

              <div style={tableHeaderStyle}>
                <div>DESCRIPTION</div>
                <div>AMOUNT (KES)</div>
              </div>

              <IncomeDisplayRow
                label="Balance B/F (Previous Shift)"
                amount={openingBalance}
              />

              {companySlots.map((entry, index) => (
                <ReadOnlyCompanyFloatRow
                  key={`company-${index}`}
                  label={
                    `Added Float ${index + 1} From Company`
                  }
                  entry={entry}
                />
              ))}

              {mshwariSlots.map((entry, index) => {
                const mshwariUnlocked =
                  index === 0 ||
                  Boolean(
                    mshwariSlots[index - 1]
                  );

                return (
                  <EditableFloatRow
                    key={`mshwari-${index}`}
                    label={
                      `Added Float ${index + 1} From M-Shwari`
                    }
                    savedEntry={entry}
                    value={
                      floatInputs.mshwari[index] ||
                      ""
                    }
                    disabled={
                      savingFloats ||
                      !mshwariUnlocked
                    }
                    onChange={(value) => {
                      setFloatInputs(
                        (previous) => {
                          const mshwari = [
                            ...previous.mshwari,
                          ];

                          mshwari[index] = value;

                          return {
                            ...previous,
                            mshwari,
                          };
                        }
                      );
                    }}
                  />
                );
              })}

              <div style={incomeTotalStyle}>
                <strong>TOTAL ADDED</strong>

                <strong>
                  {money(totalAdded)}
                </strong>
              </div>

              <div style={companyFloatNoticeStyle}>
                Company Float 1, 2 and 3 are read-only.
                They are posted automatically by
                Legend Accounts.
              </div>

              <div style={panelButtonWrapStyle}>
                <button
                  type="button"
                  onClick={saveFloats}
                  disabled={savingFloats}
                  style={{
                    ...greenActionStyle,

                    backgroundColor:
                      savingFloats
                        ? C.border
                        : "#247b93",
                  }}
                >
                  {savingFloats
                    ? "Saving..."
                    : "Save M-Shwari Float"}
                </button>
              </div>
            </section>

            {/* EXPENSES */}

            <section style={panelStyle}>
              <PanelTitle
                title="EXPENSES"
                tone="red"
              />

              <div style={expenseHeaderStyle}>
                <div>NO.</div>
                <div>DESCRIPTION</div>
                <div>AMOUNT (KES)</div>
              </div>

              {Array.from(
                { length: 10 },
                (_, index) => {
                  const saved =
                    manualExpenses[index];

                  const rowUnlocked =
                    index === 0 ||
                    Boolean(
                      manualExpenses[index - 1]
                    );

                  const rowDisabled =
                    savingExpenses ||
                    !rowUnlocked;

                  return (
                    <div
                      key={index}
                      style={expenseRowStyle}
                    >
                      <div>{index + 1}</div>

                      {saved ? (
                        <>
                          <div
                            style={savedExpenseStyle}
                          >
                            {saved.description}
                          </div>

                          <div
                            style={savedExpenseStyle}
                          >
                            {money(saved.amount)} ✓
                          </div>
                        </>
                      ) : (
                        <>
                          <input
                            value={
                              expenseInputs[index]
                                ?.description || ""
                            }
                            placeholder={
                              rowUnlocked
                                ? "Description"
                                : "Locked"
                            }
                            disabled={rowDisabled}
                            onChange={(event) => {
                              const value =
                                event.target.value;

                              setExpenseInputs(
                                (previous) => {
                                  const next =
                                    previous.map(
                                      (row) => ({
                                        ...row,
                                      })
                                    );

                                  next[index].description =
                                    value;

                                  return next;
                                }
                              );
                            }}
                            style={{
                              ...expenseInputStyle,

                              backgroundColor:
                                rowDisabled
                                  ? "#0d1926"
                                  : C.field,

                              cursor:
                                rowDisabled
                                  ? "not-allowed"
                                  : "text",
                            }}
                          />

                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={
                              expenseInputs[index]
                                ?.amount || ""
                            }
                            placeholder={
                              rowUnlocked
                                ? "0.00"
                                : "Locked"
                            }
                            disabled={rowDisabled}
                            onChange={(event) => {
                              const value =
                                event.target.value;

                              setExpenseInputs(
                                (previous) => {
                                  const next =
                                    previous.map(
                                      (row) => ({
                                        ...row,
                                      })
                                    );

                                  next[index].amount =
                                    value;

                                  return next;
                                }
                              );
                            }}
                            style={{
                              ...expenseInputStyle,

                              backgroundColor:
                                rowDisabled
                                  ? "#0d1926"
                                  : C.field,

                              cursor:
                                rowDisabled
                                  ? "not-allowed"
                                  : "text",
                            }}
                          />
                        </>
                      )}
                    </div>
                  );
                }
              )}

              <div style={expenseTotalStyle}>
                <strong>
                  TOTAL EXPENSES
                </strong>

                <strong>
                  {money(totalExpenses)}
                </strong>
              </div>

              <div style={automaticExpenseNoticeStyle}>
                Cashier → Legend Accounts transfers
                are added to Total Expenses
                automatically after Accounts
                confirms receipt.
              </div>

              <div style={panelButtonWrapStyle}>
                <button
                  type="button"
                  onClick={saveExpenses}
                  disabled={
                    savingExpenses ||
                    manualExpenses.length >= 10
                  }
                  style={{
                    ...redActionStyle,

                    backgroundColor:
                      savingExpenses ||
                      manualExpenses.length >= 10
                        ? C.border
                        : "#9d4359",
                  }}
                >
                  {savingExpenses
                    ? "Saving..."
                    : manualExpenses.length >= 10
                    ? "All Expenses Saved"
                    : `Save Expense ${
                        manualExpenses.length + 1
                      }`}
                </button>
              </div>
            </section>
          </div>

          {/* ===================================== */}
          {/* 24-HOUR OPERATIONS LAYOUT            */}
          {/* ===================================== */}

          <div style={operationsGridStyle}>
          <div
  className="tl24-clean-platform-inputs"
  style={platformColumnStyle}
>
              <PlatformReadings24Hour
                user={user}
                currentShift={
                  shift || currentShift
                }
                refreshKey={refreshKey}
                onReadingsChanged={
                  refresh24HourReport
                }
              />
            </div>

            <div style={sidePanelsStyle}>
              <CashierSavingsPanel
                user={user}
                currentShift={
                  shift || currentShift
                }
              />

              <CashierSalaryPanel
                user={user}
                currentShift={
                  shift || currentShift
                }
                onSalaryPaid={
                  refresh24HourReport
                }
              />

              <CashierAccountsPanel
                user={user}
              />

              <CashierAccountsReturnPanel
                user={user}
                currentShift={
                  shift || currentShift
                }
                onReturnChanged={
                  refresh24HourReport
                }
              />
            </div>
          </div>

          {/* SUMMARY */}

          <div style={summaryGridStyle}>
            <SummaryBox
              title="TOTAL OUTPUT"
              amount={totalOutput}
              tone="green"
            />

            <SummaryBox
              title="TOTAL SALES"
              amount={totalSales}
              tone="blue"
            />

            <SummaryBox
              title="TOTAL EXPENSES"
              amount={totalExpenses}
              tone="red"
            />

            <SummaryBox
              title="CLOSING BALANCE"
              amount={closingBalance}
              tone="navy"
            />
          </div>

          {/* CLOSE SHIFT */}

          <CloseShift24Hour
            user={user}
            currentShift={
              shift || currentShift
            }
            refreshKey={refreshKey}
            onShiftClosed={() => {
              router.refresh();
              window.location.reload();
            }}
          />

          {/* IMPORTANT INFORMATION */}

          <section style={informationStyle}>
            <div style={informationTitleStyle}>
              IMPORTANT INFORMATION
            </div>

            <div style={informationBodyStyle}>
              <div>
                1. Shift 1 runs from 9:00 AM
                to 9:00 PM.
              </div>

              <div>
                2. Shift 2 runs from 9:00 PM
                to 9:00 AM.
              </div>

              <div>
                3. Resettable platforms are
                recorded at 11:59 PM and reset
                to zero at midnight.
              </div>

              <div>
                4. TABLE does not reset at
                midnight and has no midnight
                reading.
              </div>

              <div>
                5. TABLE is handed over continuously
                at 9:00 AM and 9:00 PM.
              </div>

              <div>
                6. Company Float 1, 2 and 3
                are controlled by Legend Accounts
                and are read-only for the cashier.
              </div>

              <div>
                7. Cashier → Legend Accounts
                returns automatically become
                expenses after Accounts confirms
                receipt.
              </div>

              <div>
                8. Weekly salary payments
                automatically create a private
                expense after PIN confirmation.
              </div>

              <div>
                9. Cashier handover is only
                available during the authorised
                morning or evening handover window.
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

// ==================================================
// DISPLAY COMPONENTS
// ==================================================

function SidebarItem({
  icon,
  label,
  active,
}) {
  return (
    <div style={getSidebarItemStyle(active)}>
      <span
        style={{
          fontSize: 17,
          opacity: 0.9,
          width: 22,
          textAlign: "center",
        }}
      >
        {icon}
      </span>

      <span>{label}</span>
    </div>
  );
}

function TopCard({
  title,
  subtitle,
  footer,
}) {
  return (
    <div style={shopCardStyle}>
      <div style={shopTitleStyle}>
        {title}
      </div>

      <strong style={shopSubtitleStyle}>
        {subtitle}
      </strong>

      <div style={smallTextStyle}>
        {footer}
      </div>
    </div>
  );
}

function InfoCard({
  title,
  value,
  subvalue,
  tone,
}) {
  return (
    <div style={getInfoCardStyle(tone)}>
      <strong style={infoTitleStyle}>
        {title}
      </strong>

      <div style={infoValueStyle}>
        {value}
      </div>

      {subvalue ? (
        <small style={infoSubvalueStyle}>
          {subvalue}
        </small>
      ) : null}
    </div>
  );
}

function PanelTitle({
  title,
  tone,
}) {
  return (
    <div style={getPanelTitleStyle(tone)}>
      {title}
    </div>
  );
}

function IncomeDisplayRow({
  label,
  amount,
}) {
  return (
    <div style={incomeRowStyle}>
      <div>{label}</div>

      <div style={amountBoxStyle}>
        {money(amount)}
      </div>
    </div>
  );
}

function ReadOnlyCompanyFloatRow({
  label,
  entry,
}) {
  return (
    <div style={incomeRowStyle}>
      <div>
        {label}{" "}

        <span style={readOnlyInlineStyle}>
          {entry ? "✓" : "🔒"}
        </span>
      </div>

      <div
        style={
          entry
            ? savedMoneyStyle
            : lockedMoneyStyle
        }
      >
        {entry
          ? money(entry.amount)
          : "0.00"}
      </div>
    </div>
  );
}

function EditableFloatRow({
  label,
  savedEntry,
  value,
  onChange,
  disabled,
}) {
  const locked =
    Boolean(savedEntry) ||
    disabled;

  return (
    <div style={incomeRowStyle}>
      <div>
        {label}{" "}

        {savedEntry && (
          <span style={savedInlineStyle}>
            ✓
          </span>
        )}
      </div>

      {savedEntry ? (
        <div style={savedMoneyStyle}>
          {money(savedEntry.amount)}
        </div>
      ) : (
        <input
          type="number"
          min="0"
          step="0.01"
          value={value}
          disabled={disabled}
          placeholder={
            disabled
              ? "Locked"
              : "0.00"
          }
          onChange={(event) =>
            onChange(event.target.value)
          }
          style={{
            ...moneyInputStyle,

            backgroundColor:
              locked
                ? "#0d1926"
                : C.field,

            cursor:
              locked
                ? "not-allowed"
                : "text",
          }}
        />
      )}
    </div>
  );
}

function SummaryBox({
  title,
  amount,
  tone,
}) {
  return (
    <div style={getSummaryBoxStyle(tone)}>
      <div>{title}</div>

      <div style={summaryValueStyle}>
        KES {money(amount)}
      </div>
    </div>
  );
}

// ==================================================
// SUPABASE HELPERS
// ==================================================

function authHeaders(
  anonKey,
  accessToken
) {
  return {
    apikey: anonKey,
    Authorization:
      `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

// ==================================================
// NUMBER HELPERS
// ==================================================

function money(value) {
  const numeric = Number(
    value ?? 0
  );

  const safeValue =
    Number.isFinite(numeric)
      ? numeric
      : 0;

  return safeValue.toLocaleString(
    "en-KE",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  );
}

function roundMoney(value) {
  return (
    Math.round(
      (Number(value) +
        Number.EPSILON) * 100
    ) / 100
  );
}

// ==================================================
// DATE HELPERS
// ==================================================

function formatReportDate(value) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: "Africa/Nairobi",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  ).format(new Date(value));
}

function formatReportDay(value) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: "Africa/Nairobi",
      weekday: "long",
    }
  ).format(new Date(value));
}

function displayTime(value) {
  return String(value || "")
    .split(".")[0]
    .slice(0, 5);
}

function normaliseShiftName(value) {
  const text = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

  if (
    text === "SHIFT 1" ||
    text === "SHIFT1"
  ) {
    return "SHIFT 1";
  }

  if (
    text === "SHIFT 2" ||
    text === "SHIFT2"
  ) {
    return "SHIFT 2";
  }

  return text;
}

function getNairobiHour(
  date = new Date()
) {
  const formatter = new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: "Africa/Nairobi",
      hour: "2-digit",
      hourCycle: "h23",
    }
  );

  const parts =
    formatter.formatToParts(date);

  const hourPart = parts.find(
    (part) => part.type === "hour"
  );

  const hour = Number(
    hourPart?.value ?? 0
  );

  return Number.isFinite(hour)
    ? hour
    : 0;
}

// ==================================================
// 24-HOUR PROFESSIONAL THEME
// Same Navy / Gold / Teal family
// ==================================================

const C = {
  canvas: "#08121e",
  canvasDeep: "#050c15",
  header: "#0d1b2b",
  sidebar: "#0b1827",
  panel: "#101f30",
  panelRaised: "#15263a",
  field: "#0a1725",
  border: "#2a3d52",
  borderSoft: "#223448",
  text: "#f0f5fa",
  subtext: "#c4d0dc",
  muted: "#91a5b8",
  gold: "#d9b66c",
  teal: "#40c9ac",
  blue: "#7db8fa",
  red: "#fb8b96",
  greenBg: "#10332e",
  blueBg: "#142d48",
  redBg: "#38202a",
};

const pageStyle = {
  width: "100%",
  minHeight: "100vh",

  background:
    `linear-gradient(150deg, ${C.canvas} 0%, ${C.canvasDeep} 100%)`,

  color: C.text,

  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',

  fontSize: 13,
  lineHeight: 1.5,
  boxSizing: "border-box",
};

const loadingStyle = {
  ...pageStyle,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  fontSize: 16,
  fontWeight: 700,
};

const topHeaderStyle = {
  background: C.header,
  color: C.text,
  borderBottom: `1px solid ${C.border}`,
  boxShadow: "0 5px 24px rgba(0,0,0,.15)",
  padding: "15px clamp(16px,2.5vw,32px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: 16,
};

const brandWrapStyle = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  minWidth: 0,
};

const crownStyle = {
  fontSize: 31,
  lineHeight: 1,
  color: C.gold,
  textShadow:
    "0 1px 10px rgba(217,182,108,.12)",
};

const brandStyle = {
  color: C.text,
  fontSize: "clamp(18px,2vw,24px)",
  fontWeight: 850,
  letterSpacing: ".04em",
  lineHeight: 1.15,
};

const taglineStyle = {
  marginTop: 5,
  color: C.gold,
  fontSize: 9,
  letterSpacing: ".2em",
  fontWeight: 700,
};

const headerRightStyle = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  justifyContent: "flex-end",
  gap: 16,
  color: C.subtext,
  fontSize: 12,
  textAlign: "right",
};

const headerShopStyle = {
  color: C.muted,
  fontSize: 10,
  letterSpacing: ".1em",
  marginTop: 3,
};

const logoutButtonStyle = {
  border: `1px solid ${C.border}`,
  background: C.panelRaised,
  color: C.text,
  borderRadius: 8,
  padding: "9px 16px",
  fontSize: 12,
  fontWeight: 750,
  cursor: "pointer",
};

const bodyStyle = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "stretch",
  gap: 0,
  width: "100%",
};

const sidebarStyle = {
  flex: "0 1 172px",
  minWidth: 145,
  background: C.sidebar,
  borderRight:
    `1px solid ${C.borderSoft}`,
  padding: "18px 10px",
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  gap: 5,
};

const mainStyle = {
  flex: "1 1 680px",
  minWidth: 0,
  padding: "clamp(12px,2vw,25px)",
  boxSizing: "border-box",
};

const topGridStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(min(100%,150px),1fr))",
  gap: 10,
  marginBottom: 12,
};

const baseTopCard = {
  borderRadius: 11,
  minWidth: 0,
  minHeight: 94,
  padding: "14px 15px",
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
};

const shopCardStyle = {
  ...baseTopCard,
  background:
    "linear-gradient(145deg,#17283a,#102031)",
  border: `1px solid ${C.border}`,
  borderTop: `2px solid ${C.gold}`,
};

const shopTitleStyle = {
  color: C.text,
  fontSize: "clamp(15px,1.5vw,19px)",
  fontWeight: 850,
  letterSpacing: ".04em",
  overflowWrap: "anywhere",
};

const shopSubtitleStyle = {
  marginTop: 4,
  color: C.subtext,
  fontSize: 10,
  letterSpacing: ".1em",
  fontWeight: 700,
};

const smallTextStyle = {
  marginTop: 5,
  color: C.muted,
  fontSize: 10,
};

const infoTitleStyle = {
  color: C.muted,
  fontSize: 10,
  letterSpacing: ".12em",
  textTransform: "uppercase",
  fontWeight: 750,
};

const infoValueStyle = {
  color: C.text,
  fontSize: "clamp(13px,1.4vw,17px)",
  lineHeight: 1.3,
  fontWeight: 800,
  marginTop: 6,
  overflowWrap: "anywhere",
};

const infoSubvalueStyle = {
  color: C.subtext,
  fontSize: 10,
  marginTop: 4,
  fontVariantNumeric: "tabular-nums",
};

const greetingBannerStyle = {
  boxSizing: "border-box",
  width: "100%",
  padding: "10px 14px",
  borderRadius: 8,
  marginBottom: 10,
  textAlign: "center",
  fontSize: 13,
  fontWeight: 750,
  letterSpacing: ".015em",
};

const greetingWelcomeStyle = {
  background: "#101e2d",
  color: C.subtext,
  border:
    `1px solid ${C.borderSoft}`,
  borderLeft:
    `3px solid ${C.gold}`,
};

const greetingGoodbyeStyle = {
  background: C.redBg,
  color: "#ffc3ce",
  border: "1px solid #774155",
  borderLeft:
    `3px solid ${C.red}`,
};

const shiftBannerStyle = {
  background: C.blueBg,
  color: C.subtext,
  border: `1px solid ${C.border}`,
  borderLeft:
    `3px solid ${C.blue}`,
  padding: "10px 14px",
  borderRadius: 8,
  marginBottom: 12,
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "space-between",
  gap: 10,
  fontSize: 12,
};

const upperGridStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(min(100%,340px),1fr))",
  gap: 14,
  alignItems: "start",
};

const panelStyle = {
  minWidth: 0,
  background: C.panel,
  border:
    `1px solid ${C.border}`,
  borderRadius: 12,
  boxShadow:
    "0 8px 25px rgba(0,0,0,.10)",
  overflowX: "auto",
  overflowY: "hidden",
  paddingBottom: 11,
};

const tableHeaderStyle = {
  display: "grid",
  gridTemplateColumns:
    "minmax(0,1.5fr) minmax(100px,.9fr)",
  gap: 8,
  alignItems: "center",
  padding: "10px 12px",
  borderBottom:
    `1px solid ${C.borderSoft}`,
  background: C.field,
  color: C.muted,
  fontSize: 9,
  letterSpacing: ".08em",
  fontWeight: 800,
};

const incomeRowStyle = {
  display: "grid",
  gridTemplateColumns:
    "minmax(0,1.5fr) minmax(100px,.9fr)",
  gap: 9,
  alignItems: "center",
  padding: "8px 12px",
  minHeight: 38,
  borderBottom:
    `1px solid ${C.borderSoft}`,
  color: C.subtext,
  fontSize: 11,
};

const moneyCell = {
  padding: "7px 9px",
  minHeight: 29,
  boxSizing: "border-box",
  borderRadius: 6,
  fontSize: 11,
  lineHeight: 1.4,
  fontWeight: 750,
  fontVariantNumeric: "tabular-nums",
  textAlign: "right",
};

const amountBoxStyle = {
  ...moneyCell,
  color: C.text,
  background: C.field,
  border:
    `1px solid ${C.borderSoft}`,
};

const moneyInputStyle = {
  ...moneyCell,
  display: "block",
  width: "100%",
  minWidth: 65,
  outlineOffset: 2,
  background: C.field,
  color: C.text,
  border:
    `1px solid ${C.border}`,
  fontFamily: "inherit",
};

const savedMoneyStyle = {
  ...moneyCell,
  color: "#8ce3c4",
  background: C.greenBg,
  border: "1px solid #2a6354",
};

const lockedMoneyStyle = {
  ...moneyCell,
  color: C.muted,
  background: "#0d1926",
  border:
    `1px solid ${C.borderSoft}`,
};

const savedInlineStyle = {
  color: C.teal,
  fontWeight: 800,
};

const readOnlyInlineStyle = {
  marginLeft: 5,
  color: C.gold,
  fontWeight: 700,
};

const incomeTotalStyle = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "space-between",
  gap: 8,
  margin: "9px 10px 0",
  padding: "11px 12px",
  background: "#152f30",
  border: "1px solid #2c645a",
  borderRadius: 7,
  color: "#b5f2dc",
  fontSize: 12,
  fontVariantNumeric: "tabular-nums",
};

const quietNote = {
  margin: "9px 11px 0",
  borderRadius: 7,
  padding: "9px 10px",
  color: C.muted,
  fontSize: 10,
  lineHeight: 1.6,
};

const companyFloatNoticeStyle = {
  ...quietNote,
  background: C.field,
  border:
    `1px solid ${C.borderSoft}`,
};

const automaticExpenseNoticeStyle = {
  ...quietNote,
  background: C.field,
  border:
    `1px solid ${C.borderSoft}`,
};

const panelButtonWrapStyle = {
  padding: "10px 11px 3px",
};

const greenActionStyle = {
  width: "100%",
  display: "block",
  padding: "11px 12px",
  border: "1px solid #3e99ac",
  background: "#247b93",
  color: "#fff",
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};

const redActionStyle = {
  ...greenActionStyle,
  border: "1px solid #c45b72",
  background: "#9d4359",
};

const expenseHeaderStyle = {
  display: "grid",
  gridTemplateColumns:
    "25px minmax(0,1.4fr) minmax(76px,.85fr)",
  gap: 6,
  padding: "10px 12px",
  background: C.field,
  borderBottom:
    `1px solid ${C.borderSoft}`,
  color: C.muted,
  fontSize: 9,
  letterSpacing: ".05em",
  fontWeight: 800,
};

const expenseRowStyle = {
  display: "grid",
  gridTemplateColumns:
    "25px minmax(0,1.4fr) minmax(76px,.85fr)",
  gap: 6,
  alignItems: "center",
  padding: "6px 11px",
  borderBottom:
    `1px solid ${C.borderSoft}`,
  fontSize: 11,
  color: C.muted,
};

const expenseInputStyle = {
  display: "block",
  width: "100%",
  minWidth: 0,
  minHeight: 32,
  boxSizing: "border-box",
  padding: "6px 8px",
  borderRadius: 6,
  border:
    `1px solid ${C.border}`,
  outlineOffset: 2,
  background: C.field,
  color: C.text,
  fontSize: 11,
  fontFamily: "inherit",
};

const savedExpenseStyle = {
  background: C.greenBg,
  border: "1px solid #2a6354",
  color: "#a8ebd1",
  padding: "7px 8px",
  borderRadius: 6,
  fontSize: 11,
  overflowWrap: "anywhere",
};

const expenseTotalStyle = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "space-between",
  gap: 7,
  margin: "11px 10px 0",
  padding: "11px 12px",
  background: "#34202d",
  border: "1px solid #774155",
  borderRadius: 7,
  color: "#ffc3ce",
  fontSize: 12,
  fontVariantNumeric: "tabular-nums",
};

// ==================================================
// 24-HOUR OPERATIONS LAYOUT
// ==================================================

const operationsGridStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(min(100%,420px),1fr))",
  alignItems: "start",
  gap: 14,
  marginTop: 14,
};

const platformColumnStyle = {
  minWidth: 0,
  width: "100%",
};

const sidePanelsStyle = {
  minWidth: 0,
  width: "100%",
  display: "grid",
  gridTemplateColumns:
    "minmax(0, 1fr)",
  alignContent: "start",
  gap: 14,
};

const summaryGridStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(min(100%,225px),1fr))",
  gap: 12,
  margin: "15px 0",
};

const summaryValueStyle = {
  marginTop: 7,
  fontSize: "clamp(17px,1.9vw,24px)",
  letterSpacing: "-.035em",
  fontWeight: 850,
  color: C.text,
  fontVariantNumeric: "tabular-nums",
  overflowWrap: "anywhere",
};

const messageStyle = {
  padding: "10px 14px",
  borderRadius: 8,
  border:
    `1px solid ${C.border}`,
  fontSize: 12,
  fontWeight: 700,
  marginBottom: 12,
  overflowWrap: "anywhere",
};

const informationStyle = {
  background: C.panel,
  marginTop: 14,
  borderRadius: 12,
  overflow: "hidden",
  border:
    `1px solid ${C.border}`,
  boxShadow:
    "0 8px 25px rgba(0,0,0,.10)",
};

const informationTitleStyle = {
  background: C.panelRaised,
  color: C.text,
  padding: "12px 14px",
  borderBottom:
    `1px solid ${C.border}`,
  borderLeft:
    `3px solid ${C.gold}`,
  fontWeight: 850,
  fontSize: 11,
  letterSpacing: ".08em",
};

const informationBodyStyle = {
  padding: "14px",
  fontSize: 11,
  lineHeight: 1.9,
  color: C.subtext,
};

// ==================================================
// THEME HELPERS
// ==================================================

function toneColor(tone) {
  const t = String(
    tone || ""
  ).toLowerCase();

  if (t === "red") return C.red;
  if (t === "green") return C.teal;
  if (t === "blue") return C.blue;
  if (t === "brown") return C.gold;
  if (t === "navy") return C.gold;

  return C.gold;
}

function getSidebarItemStyle(
  active = false
) {
  return {
    display: "flex",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    padding: "11px 10px",

    background:
      active
        ? "#163846"
        : "transparent",

    color:
      active
        ? "#eefaf7"
        : C.subtext,

    border:
      active
        ? "1px solid #326775"
        : "1px solid transparent",

    borderLeft:
      active
        ? `3px solid ${C.teal}`
        : "3px solid transparent",

    fontSize: 11,
    fontWeight:
      active ? 800 : 650,
    minWidth: 0,
  };
}

function getInfoCardStyle(tone) {
  return {
    ...baseTopCard,
    background: C.panel,
    border:
      `1px solid ${C.border}`,
    borderTop:
      `2px solid ${toneColor(tone)}`,
    overflow: "hidden",
  };
}

function getPanelTitleStyle(tone) {
  return {
    color: C.text,
    background: "#152639",
    borderBottom:
      `1px solid ${C.border}`,
    borderLeft:
      `3px solid ${toneColor(tone)}`,
    padding: "12px 13px",
    fontSize: 11,
    fontWeight: 850,
    letterSpacing: ".1em",
  };
}

function getSummaryBoxStyle(tone) {
  return {
    background:
      "linear-gradient(130deg,#15283b,#101e2e)",
    border:
      `1px solid ${C.border}`,
    borderLeft:
      `3px solid ${toneColor(tone)}`,
    borderRadius: 10,
    padding: "15px 16px",
    fontSize: 10,
    fontWeight: 750,
    letterSpacing: ".09em",
    color: C.muted,
    minWidth: 0,
  };
}
