
"use client";

import {
useCallback,
useEffect,
useState,
} from "react";

import { useRouter } from "next/navigation";

import CashierSavingsPanel from "./CashierSavingsPanel";
import CashierSalaryPanel from "./CashierSalaryPanel";
import CashierAttendancePanel from "./CashierAttendancePanel";
import CashierLiveFeedPanel from "./CashierLiveFeedPanel";
import CashierAccountsPanel from "./CashierAccountsPanel";
import CashierAccountsReturnPanel from "./CashierAccountsReturnPanel";

import PlatformReadings24Hour from "./PlatformReadings24Hour";
import CloseShift24Hour from "./CloseShift24Hour";

export default function Cashier24HourReport({
user,
currentShift,
}) {
const router = useRouter();

const [shift, setShift] =
useState(
currentShift || null
);

const [
incomeEntries,
setIncomeEntries,
] = useState([]);

const [
expenses,
setExpenses,
] = useState([]);

const [
refreshKey,
setRefreshKey,
] = useState(0);

const [
floatInputs,
setFloatInputs,
] = useState({
company: [
"",
"",
"",
],

mshwari: [
  "",
  "",
  "",
],

});

const [
expenseInputs,
setExpenseInputs,
] = useState(
Array.from(
{
length:
10,
},

() => ({
    description:
      "",

    amount:
      "",
  })
)

);

const [
loading,
setLoading,
] = useState(true);

const [
savingFloats,
setSavingFloats,
] = useState(false);

const [
savingExpenses,
setSavingExpenses,
] = useState(false);

const [
message,
setMessage,
] = useState("");

const [
messageType,
setMessageType,
] = useState("");

const [
now,
setNow,
] = useState(
() => new Date()
);

// ==================================================
// SUPABASE
// ==================================================

const supabaseUrl =
process.env
.NEXT_PUBLIC_SUPABASE_URL;

const supabaseAnonKey =
process.env
.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const accessToken =
user?.access_token ||
null;

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

const shiftId =
currentShift?.id ||
null;

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
).trim() ||
"Cashier";

// ==================================================
// LIVE NAIROBI GREETING CLOCK
// ==================================================

useEffect(() => {
setNow(
new Date()
);

const timer =
  setInterval(
    () => {
      setNow(
        new Date()
      );
    },
    15000
  );

return () => {
  clearInterval(
    timer
  );
};

}, []);

// ==================================================
// LOAD REPORT
// ==================================================

const loadReport =
useCallback(
async () => {
if (
!shiftId ||
!shopId ||
!accessToken ||
!supabaseUrl ||
!supabaseAnonKey
) {
setLoading(
false
);

return;
    }

    try {
      // ------------------------------------------
      // SHIFT
      // ------------------------------------------

      const shiftResponse =
        await fetch(
          `${supabaseUrl}/rest/v1/shifts` +
            `?id=eq.${encodeURIComponent(
              shiftId
            )}` +
            `&select=*` +
            `&limit=1`,
          {
            method:
              "GET",

            headers:
              authHeaders(
                supabaseAnonKey,
                accessToken
              ),

            cache:
              "no-store",
          }
        );

      const shiftResult =
        await safeJson(
          shiftResponse
        );

      if (
        !shiftResponse.ok
      ) {
        throw new Error(
          shiftResult?.message ||
            shiftResult?.details ||
            "Unable to load shift."
        );
      }

      const latestShift =
        Array.isArray(
          shiftResult
        ) &&
        shiftResult.length >
          0
          ? shiftResult[0]
          : null;

      // ------------------------------------------
      // FLOATS
      // ------------------------------------------

      const incomeResponse =
        await fetch(
          `${supabaseUrl}/rest/v1/shift_income_entries` +
            `?shift_id=eq.${encodeURIComponent(
              shiftId
            )}` +
            `&select=id,entry_type,description,amount,created_at` +
            `&order=created_at.asc`,
          {
            method:
              "GET",

            headers:
              authHeaders(
                supabaseAnonKey,
                accessToken
              ),

            cache:
              "no-store",
          }
        );

      const incomeResult =
        await safeJson(
          incomeResponse
        );

      if (
        !incomeResponse.ok
      ) {
        throw new Error(
          incomeResult?.message ||
            incomeResult?.details ||
            "Unable to load float entries."
        );
      }

      const loadedIncome =
        Array.isArray(
          incomeResult
        )
          ? incomeResult
          : [];

      // ------------------------------------------
      // EXPENSES
      //
      // All expenses remain included in totals.
      //
      // Only true MANUAL expenses populate the
      // cashier's 10 editable rows.
      //
      // Salary and Cashier -> Accounts automatic
      // expenses therefore do NOT consume a
      // manual expense position.
      // ------------------------------------------

      const expenseResponse =
        await fetch(
          `${supabaseUrl}/rest/v1/expenses` +
            `?shift_id=eq.${encodeURIComponent(
              shiftId
            )}` +
            `&select=id,description,amount,created_at,source_type,source_record_id,is_private` +
            `&order=created_at.asc`,
          {
            method:
              "GET",

            headers:
              authHeaders(
                supabaseAnonKey,
                accessToken
              ),

            cache:
              "no-store",
          }
        );

      const expenseResult =
        await safeJson(
          expenseResponse
        );

      if (
        !expenseResponse.ok
      ) {
        throw new Error(
          expenseResult?.message ||
            expenseResult?.details ||
            "Unable to load expenses."
        );
      }

      const loadedExpenses =
        Array.isArray(
          expenseResult
        )
          ? expenseResult
          : [];

      const loadedManualExpenses =
        loadedExpenses.filter(
          (
            expense
          ) => {
            const sourceType =
              String(
                expense?.source_type ||
                  ""
              )
                .trim()
                .toUpperCase();

            const manualSource =
              sourceType ===
                "" ||
              sourceType ===
                "MANUAL";

            return (
              manualSource &&
              expense?.is_private !==
                true
            );
          }
        );

      // ------------------------------------------
      // SET STATE
      // ------------------------------------------

      setShift(
        latestShift ||
          currentShift
      );

      setIncomeEntries(
        loadedIncome
      );

      // Keep ALL expenses.
      // Total Expenses must include:
      // manual + salary + cashier return expenses.
      setExpenses(
        loadedExpenses
      );

      // ------------------------------------------
      // FLOAT INPUTS
      // ------------------------------------------

      const companyRows =
        loadedIncome.filter(
          (
            entry
          ) =>
            entry.entry_type ===
            "COMPANY_FLOAT"
        );

      const mshwariRows =
        loadedIncome.filter(
          (
            entry
          ) =>
            entry.entry_type ===
            "MSHWARI_FLOAT"
        );

      setFloatInputs(
        (
          previous
        ) => {
          const company = [
            ...previous.company,
          ];

          const mshwari = [
            ...previous.mshwari,
          ];

          for (
            let i = 0;
            i < 3;
            i += 1
          ) {
            if (
              companyRows[
                i
              ]
            ) {
              company[
                i
              ] =
                String(
                  companyRows[
                    i
                  ].amount ??
                    ""
                );
            }

            if (
              mshwariRows[
                i
              ]
            ) {
              mshwari[
                i
              ] =
                String(
                  mshwariRows[
                    i
                  ].amount ??
                    ""
                );
            }
          }

          return {
            company,
            mshwari,
          };
        }
      );

      // ------------------------------------------
      // MANUAL EXPENSE INPUTS
      // ------------------------------------------

      setExpenseInputs(
        (
          previous
        ) => {
          const next =
            Array.from(
              {
                length:
                  10,
              },

              (
                _,
                index
              ) => ({
                description:
                  previous[
                    index
                  ]
                    ?.description ||
                  "",

                amount:
                  previous[
                    index
                  ]
                    ?.amount ||
                  "",
              })
            );

          for (
            let i = 0;
            i < 10;
            i += 1
          ) {
            if (
              loadedManualExpenses[
                i
              ]
            ) {
              next[i] = {
                description:
                  loadedManualExpenses[
                    i
                  ]
                    .description ||
                  "",

                amount:
                  String(
                    loadedManualExpenses[
                      i
                    ].amount ??
                      ""
                  ),
              };
            }
          }

          return next;
        }
      );
    } catch (error) {
      console.error(
        "24H CASHIER REPORT ERROR:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to load 24-hour cashier report."
      );

      setMessageType(
        "error"
      );
    } finally {
      setLoading(
        false
      );
    }
  },
  [
    shiftId,
    shopId,
    accessToken,
    supabaseUrl,
    supabaseAnonKey,
    currentShift,
  ]
);

// ==================================================
// REFRESH COMPLETE REPORT
// ==================================================

const refresh24HourReport =
  useCallback(
    async () => {
      await loadReport();

      setRefreshKey(
        (previous) =>
          previous + 1
      );
    },
    [
      loadReport,
    ]
  );

// ==================================================
// AUTO REFRESH EVERY 5 SECONDS
// ==================================================

useEffect(() => {
  refresh24HourReport();

  const timer =
    setInterval(
      () => {
        refresh24HourReport();
      },
      5000
    );

  return () => {
    clearInterval(
      timer
    );
  };
}, [
  refresh24HourReport,
]);

// ==================================================
// LOGOUT
// ==================================================

function logout() {
  sessionStorage.removeItem(
    "teamLegendUser"
  );

  router.replace(
    "/"
  );
}

// ==================================================
// FLOAT DATA
// ==================================================

const companyEntries =
  incomeEntries.filter(
    (entry) =>
      entry.entry_type ===
      "COMPANY_FLOAT"
  );

const mshwariEntries =
  incomeEntries.filter(
    (entry) =>
      entry.entry_type ===
      "MSHWARI_FLOAT"
  );

const companyTotal =
  roundMoney(
    companyEntries.reduce(
      (sum, entry) =>
        sum +
        Number(
          entry.amount ?? 0
        ),
      0
    )
  );

const mshwariTotal =
  roundMoney(
    mshwariEntries.reduce(
      (sum, entry) =>
        sum +
        Number(
          entry.amount ?? 0
        ),
      0
    )
  );

const companySlots =
  Array.from(
    {
      length: 3,
    },
    (_, index) =>
      companyEntries[index] ||
      null
  );

const mshwariSlots =
  Array.from(
    {
      length: 3,
    },
    (_, index) =>
      mshwariEntries[index] ||
      null
  );

// ==================================================
// MANUAL EXPENSES
// ==================================================

const manualExpenses =
  expenses.filter(
    (expense) => {
      const sourceType =
        String(
          expense?.source_type ||
            ""
        )
          .trim()
          .toUpperCase();

      return (
        (
          sourceType ===
            "" ||
          sourceType ===
            "MANUAL"
        ) &&
        expense?.is_private !==
          true
      );
    }
  );

// ==================================================
// SAVE M-SHWARI FLOATS
//
// COMPANY FLOAT IS NEVER CREATED BY CASHIER.
// Accountant transfer backend is the only writer.
// ==================================================

async function saveFloats() {
  const rowsToSave = [];

  for (
    let i = 0;
    i < 3;
    i += 1
  ) {
    const mshwariUnlocked =
      i === 0 ||
      Boolean(
        mshwariSlots[
          i - 1
        ]
      );

    if (
      mshwariUnlocked &&
      !mshwariSlots[i]
    ) {
      const raw =
        floatInputs.mshwari[
          i
        ];

      if (
        raw !== "" &&
        raw !== undefined
      ) {
        const value =
          Number(raw);

        if (
          !Number.isFinite(
            value
          ) ||
          value <= 0
        ) {
          setMessage(
            `Enter a valid M-Shwari Float ${
              i + 1
            }.`
          );

          setMessageType(
            "error"
          );

          return;
        }

        rowsToSave.push({
          shift_id:
            shiftId,

          entry_type:
            "MSHWARI_FLOAT",

          description:
            `Float ${
              i + 1
            } from M-Shwari`,

          amount:
            roundMoney(
              value
            ),
        });
      }
    }
  }

  if (
    rowsToSave.length ===
    0
  ) {
    setMessage(
      "Enter at least one active M-Shwari float amount."
    );

    setMessageType(
      "error"
    );

    return;
  }

  try {
    setSavingFloats(
      true
    );

    setMessage(
      ""
    );

    const response =
      await fetch(
        `${supabaseUrl}/rest/v1/shift_income_entries`,
        {
          method:
            "POST",

          headers: {
            apikey:
              supabaseAnonKey,

            Authorization:
              `Bearer ${accessToken}`,

            "Content-Type":
              "application/json",

            Prefer:
              "return=representation",
          },

          body:
            JSON.stringify(
              rowsToSave
            ),
        }
      );

    const result =
      await safeJson(
        response
      );

    if (
      !response.ok
    ) {
      throw new Error(
        result?.message ||
          result?.details ||
          "Unable to save M-Shwari float."
      );
    }

    const newFloatTotal =
      roundMoney(
        companyTotal +
          mshwariTotal +
          rowsToSave.reduce(
            (sum, row) =>
              sum +
              Number(
                row.amount ?? 0
              ),
            0
          )
      );

    const shiftResponse =
      await fetch(
        `${supabaseUrl}/rest/v1/shifts?id=eq.${encodeURIComponent(
          shiftId
        )}`,
        {
          method:
            "PATCH",

          headers: {
            apikey:
              supabaseAnonKey,

            Authorization:
              `Bearer ${accessToken}`,

            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              total_added_float:
                newFloatTotal,
            }),
        }
      );

    if (
      !shiftResponse.ok
    ) {
      throw new Error(
        "M-Shwari float saved but shift total could not be updated."
      );
    }

    setMessage(
      "M-Shwari float saved successfully."
    );

    setMessageType(
      "success"
    );

    await refresh24HourReport();
  } catch (error) {
    setMessage(
      error?.message ||
        "Unable to save M-Shwari float."
    );

    setMessageType(
      "error"
    );
  } finally {
    setSavingFloats(
      false
    );
  }
}

// ==================================================
// SAVE MANUAL EXPENSES
// ==================================================

async function saveExpenses() {
  const nextIndex =
    manualExpenses.length;

  if (
    nextIndex >= 10
  ) {
    setMessage(
      "All 10 manual expense rows have already been saved."
    );

    setMessageType(
      "success"
    );

    return;
  }

  const description =
    String(
      expenseInputs[
        nextIndex
      ]?.description ||
        ""
    ).trim();

  const rawAmount =
    expenseInputs[
      nextIndex
    ]?.amount;

  if (
    description === ""
  ) {
    setMessage(
      `Enter the description for expense ${
        nextIndex + 1
      }.`
    );

    setMessageType(
      "error"
    );

    return;
  }

  if (
    rawAmount === "" ||
    rawAmount === null ||
    rawAmount === undefined
  ) {
    setMessage(
      `Enter the amount for expense ${
        nextIndex + 1
      }.`
    );

    setMessageType(
      "error"
    );

    return;
  }

  const amount =
    Number(
      rawAmount
    );

  if (
    !Number.isFinite(
      amount
    ) ||
    amount <= 0
  ) {
    setMessage(
      `Enter a valid amount for expense ${
        nextIndex + 1
      }.`
    );

    setMessageType(
      "error"
    );

    return;
  }

  const rowToSave = {
    shift_id:
      shiftId,

    description,

    amount:
      roundMoney(
        amount
      ),

    created_by:
      cashierId,

    source_type:
      "MANUAL",

    is_private:
      false,
  };

  try {
    setSavingExpenses(
      true
    );

    setMessage(
      ""
    );

    const response =
      await fetch(
        `${supabaseUrl}/rest/v1/expenses`,
        {
          method:
            "POST",

          headers: {
            apikey:
              supabaseAnonKey,

            Authorization:
              `Bearer ${accessToken}`,

            "Content-Type":
              "application/json",

            Prefer:
              "return=representation",
          },

          body:
            JSON.stringify(
              rowToSave
            ),
        }
      );

    const result =
      await safeJson(
        response
      );

    if (
      !response.ok
    ) {
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
          Number(
            expense.amount ?? 0
          ),
        0
      );

    const newExpenseTotal =
      roundMoney(
        existingExpenseTotal +
          amount
      );

    const shiftResponse =
      await fetch(
        `${supabaseUrl}/rest/v1/shifts?id=eq.${encodeURIComponent(
          shiftId
        )}`,
        {
          method:
            "PATCH",

          headers: {
            apikey:
              supabaseAnonKey,

            Authorization:
              `Bearer ${accessToken}`,

            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              total_expenses:
                newExpenseTotal,
            }),
        }
      );

    if (
      !shiftResponse.ok
    ) {
      throw new Error(
        "Expense saved but shift total could not be updated."
      );
    }

    setMessage(
      nextIndex < 9
        ? `Expense ${
            nextIndex + 1
          } saved. Expense ${
            nextIndex + 2
          } is now available.`
        : "Expense 10 saved successfully."
    );

    setMessageType(
      "success"
    );

    await refresh24HourReport();
  } catch (error) {
    setMessage(
      error?.message ||
        "Unable to save expense."
    );

    setMessageType(
      "error"
    );
  } finally {
    setSavingExpenses(
      false
    );
  }
}

// ==================================================
// TOTALS
// ==================================================

const openingBalance =
  Number(
    shift?.opening_balance ??
      0
  );

const totalOutput =
  Number(
    shift?.total_output ??
      0
  );

const totalExpenses =
  Number(
    shift?.total_expenses ??
      0
  );

const closingBalance =
  Number(
    shift?.closing_balance ??
      0
  );

const totalAdded =
  roundMoney(
    openingBalance +
      companyTotal +
      mshwariTotal
  );

const totalSales =
  roundMoney(
    openingBalance +
      companyTotal +
      mshwariTotal +
      totalOutput
  );

const reportDate =
  formatReportDate(
    shift?.opened_at ||
      new Date().toISOString()
  );

const reportDay =
  formatReportDay(
    shift?.opened_at ||
      new Date().toISOString()
  );

const shiftStatus =
  String(
    shift?.status ||
      "OPEN"
  ).toUpperCase();

const shiftName =
  normaliseShiftName(
    shift?.shift_name
  );

const shiftLabel =
  shiftName ===
  "SHIFT 1"
    ? "SHIFT 1"
    : shiftName ===
      "SHIFT 2"
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

const nairobiHour =
  getNairobiHour(
    now
  );

let shiftGreeting;

if (
  shiftIsClosed
) {
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

if (
  loading &&
  !shift
) {
  return (
    <div
      style={
        loadingStyle
      }
    >
      Loading 24-hour cashier report...
    </div>
  );
}

if (!shift) {
  return null;
}

// ==================================================
// DISPLAY
// Part 3 begins with the main return (
// ==================================================

return (
  <div style={pageStyle}>
    <style>{`
      .tl24-main {
        box-sizing: border-box;
      }

      .tl24-main input:focus-visible,
      .tl24-main button:focus-visible {
        outline: 2px solid #2584BA;
        outline-offset: 2px;
      }

      .tl24-main button {
        transition: filter .12s ease;
      }

      .tl24-main button:hover:not(:disabled) {
        filter: brightness(.96);
      }

      @media (max-width: 1250px) {
        .tl24-top-grid {
          grid-template-columns:
            repeat(3, minmax(0, 1fr)) !important;
        }

        .tl24-top-grid > :first-child {
          grid-column: span 3;
        }

        .tl24-operations-grid {
          grid-template-columns:
            minmax(0, 1fr) !important;
        }
      }

      @media (max-width: 850px) {
        .tl24-sidebar {
          display: none !important;
        }

        .tl24-upper-grid {
          grid-template-columns:
            minmax(0, 1fr) !important;
        }

        .tl24-summary-grid {
          grid-template-columns:
            repeat(2, minmax(0, 1fr)) !important;
        }
      }

      @media (max-width: 520px) {
        .tl24-main {
          padding: 10px !important;
        }

        .tl24-top-grid {
          grid-template-columns:
            repeat(2, minmax(0, 1fr)) !important;
        }

        .tl24-top-grid > :first-child {
          grid-column: span 2;
        }

        .tl24-summary-grid {
          grid-template-columns:
            minmax(0, 1fr) !important;
        }
      }
    `}</style>

    {/* =========================================
        TOP HEADER
    ========================================= */}

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

    {/* =========================================
        SHARED LIVE FEED
    ========================================= */}

    <CashierLiveFeedPanel user={user} />

    <div
      className="tl24-body"
      style={bodyStyle}
    >
      {/* =========================================
          SIDEBAR
      ========================================= */}

      <aside
        className="tl24-sidebar"
        style={sidebarStyle}
      >
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

      {/* =========================================
          MAIN DASHBOARD
      ========================================= */}

      <main
        className="tl24-main"
        style={mainStyle}
      >
        {/* =====================================
            TOP INFORMATION CARDS
        ===================================== */}

        <div
          className="tl24-top-grid"
          style={topGridStyle}
        >
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
            subvalue={`${displayTime(
              shift?.scheduled_start
            )} - ${displayTime(
              shift?.scheduled_end
            )}`}
            tone="green"
          />

          <InfoCard
            title="STATUS"
            value={shiftStatus}
            tone="green"
          />
        </div>

        {/* =====================================
            GREETING BANNER
        ===================================== */}

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

        {/* =====================================
            SHIFT INFORMATION
        ===================================== */}

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

        {/* =====================================
            TODAY'S DUTY / BENEFITS
            24-HOUR SIGN-IN EXEMPT
        ===================================== */}

        <CashierAttendancePanel
          user={user}
          currentShift={shift || currentShift}
        />

        {/* =====================================
            STATUS MESSAGES
        ===================================== */}

        {message && (
          <div
            style={{
              ...messageStyle,
              backgroundColor:
                messageType === "success"
                  ? "#ecfdf5"
                  : "#fef2f2",
              color:
                messageType === "success"
                  ? "#166534"
                  : "#991b1b",
            }}
          >
            {message}
          </div>
        )}

        {/* =====================================
            INCOME AND EXPENSES GRID
        ===================================== */}

        <div
          className="tl24-upper-grid"
          style={upperGridStyle}
        >
          {/* ===================================
              INCOME STATEMENT
          =================================== */}

          <section style={panelStyle}>
            <PanelTitle
              title="INCOME STATEMENT"
              tone="blue"
            />

            <div style={tableHeaderStyle}>
              <div>
                DESCRIPTION
              </div>

              <div>
                AMOUNT (KES)
              </div>
            </div>

            <IncomeDisplayRow
              label="Balance B/F (Previous Shift)"
              amount={openingBalance}
            />

            {/* COMPANY FLOATS */}

            {companySlots.map(
              (entry, index) => (
                <ReadOnlyCompanyFloatRow
                  key={`company-${index}`}
                  label={`Added Float ${
                    index + 1
                  } From Company`}
                  entry={entry}
                />
              )
            )}

            {/* M-SHWARI FLOATS */}

            {mshwariSlots.map(
              (entry, index) => {
                const mshwariUnlocked =
                  index === 0 ||
                  Boolean(
                    mshwariSlots[index - 1]
                  );

                return (
                  <EditableFloatRow
                    key={`mshwari-${index}`}
                    label={`Added Float ${
                      index + 1
                    } From M-Shwari`}
                    savedEntry={entry}
                    value={
                      floatInputs.mshwari[
                        index
                      ] || ""
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

                          mshwari[index] =
                            value;

                          return {
                            ...previous,
                            mshwari,
                          };
                        }
                      );
                    }}
                  />
                );
              }
            )}

            {/* TOTAL ADDED */}

            <div style={incomeTotalStyle}>
              <strong>
                TOTAL ADDED
              </strong>

              <strong>
                {money(totalAdded)}
              </strong>
            </div>

            <div
              style={companyFloatNoticeStyle}
            >
              Company Float 1, 2 and 3 are
              read-only. They are posted
              automatically by Legend Accounts.
            </div>

            {/* SAVE M-SHWARI */}

            <div
              style={panelButtonWrapStyle}
            >
              <button
                type="button"
                onClick={saveFloats}
                disabled={savingFloats}
                style={{
                  ...greenActionStyle,
                  backgroundColor:
                    savingFloats
                      ? "#94a3b8"
                      : "#16804A",
                }}
              >
                {savingFloats
                  ? "Saving..."
                  : "Save M-Shwari Float"}
              </button>
            </div>
          </section>

          {/* ===================================
              EXPENSES
          =================================== */}

          <section style={panelStyle}>
            <PanelTitle
              title="EXPENSES"
              tone="red"
            />

            <div style={expenseHeaderStyle}>
              <div>
                NO.
              </div>

              <div>
                DESCRIPTION
              </div>

              <div>
                AMOUNT (KES)
              </div>
            </div>

            {/* EXPENSE ROWS */}

            {Array.from(
              {
                length: 10,
              },
              (_, index) => {
                const saved =
                  manualExpenses[index];

                const rowUnlocked =
                  index === 0 ||
                  Boolean(
                    manualExpenses[
                      index - 1
                    ]
                  );

                const rowDisabled =
                  savingExpenses ||
                  !rowUnlocked;

                return (
                  <div
                    key={index}
                    style={expenseRowStyle}
                  >
                    <div>
                      {index + 1}
                    </div>

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
                          {money(saved.amount)}{" "}
                          ✓
                        </div>
                      </>
                    ) : (
                      <>
                        {/* DESCRIPTION */}

                        <input
                          value={
                            expenseInputs[
                              index
                            ]?.description || ""
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

                                next[
                                  index
                                ].description =
                                  value;

                                return next;
                              }
                            );
                          }}
                          style={{
                            ...expenseInputStyle,
                            backgroundColor:
                              rowDisabled
                                ? "#f1f5f9"
                                : "white",
                            cursor:
                              rowDisabled
                                ? "not-allowed"
                                : "text",
                          }}
                        />

                        {/* AMOUNT */}

                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={
                            expenseInputs[
                              index
                            ]?.amount || ""
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

                                next[
                                  index
                                ].amount =
                                  value;

                                return next;
                              }
                            );
                          }}
                          style={{
                            ...expenseInputStyle,
                            backgroundColor:
                              rowDisabled
                                ? "#f1f5f9"
                                : "white",
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

            {/* TOTAL EXPENSES */}

            <div style={expenseTotalStyle}>
              <strong>
                TOTAL EXPENSES
              </strong>

              <strong>
                {money(totalExpenses)}
              </strong>
            </div>

            <div
              style={automaticExpenseNoticeStyle}
            >
              Cashier → Legend Accounts
              transfers are added to Total
              Expenses automatically after
              Accounts confirms receipt.
            </div>

            {/* SAVE EXPENSE */}

            <div
              style={panelButtonWrapStyle}
            >
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
                      ? "#94a3b8"
                      : "#BF3443",
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

        {/* =====================================
            PART 4 CONTINUES HERE
            24-HOUR OPERATIONS LAYOUT
        ===================================== */}

        {/* =========================================
            24-HOUR OPERATIONS LAYOUT
        ========================================= */}

        <div
          className="tl24-operations-grid"
          style={operationsGridStyle}
        >
          {/* =====================================
              PLATFORM READINGS COLUMN
          ===================================== */}

          <div style={platformColumnStyle}>
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

          {/* =====================================
              RIGHT-SIDE FINANCIAL PANELS
          ===================================== */}

          <div style={sidePanelsStyle}>

            {/* SAVINGS AND BANKING */}

            <CashierSavingsPanel
              user={user}
              currentShift={
                shift || currentShift
              }
            />

            {/* WEEKLY SALARY */}

            <CashierSalaryPanel
              user={user}
              currentShift={
                shift || currentShift
              }
              onSalaryPaid={
                refresh24HourReport
              }
            />

            {/* ACCOUNTS INFORMATION */}

            <CashierAccountsPanel
              user={user}
            />

            {/* CASHIER FLOAT RETURNS */}

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

        {/* =========================================
            FINANCIAL SUMMARY
        ========================================= */}

        <div
          className="tl24-summary-grid"
          style={summaryGridStyle}
        >
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

        {/* =========================================
            SHIFT CLOSING AND HANDOVER
        ========================================= */}

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

        {/* =========================================
            IMPORTANT INFORMATION
        ========================================= */}

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
              5. TABLE is handed over
              continuously at 9:00 AM
              and 9:00 PM.
            </div>

            <div>
              6. Company Float 1, 2 and 3
              are controlled by Legend
              Accounts and are read-only
              for the cashier.
            </div>

            <div>
              7. Cashier → Legend Accounts
              returns automatically become
              expenses after Accounts
              confirms receipt.
            </div>

            <div>
              8. Weekly salary payments
              automatically create a
              private expense after PIN
              confirmation.
            </div>

            <div>
              9. Cashier handover is only
              available during the
              authorised morning or
              evening handover window.
            </div>
          </div>
        </section>

      </main>
    </div>
  </div>
);
}

// ==================================================
// COMPONENTS
// ==================================================

function SidebarItem({
  icon,
  label,
  active,
}) {
  return (
    <div
      style={{
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        color: active
          ? "#ffffff"
          : "#CBD5E1",
        backgroundColor: active
          ? "#175E8B"
          : "transparent",
        borderRadius: "9px",
        fontSize: "13px",
        fontWeight: active ? 700 : 500,
      }}
    >
      <span>{icon}</span>
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

      <strong>
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
  const accent =
    tone === "green"
      ? "#16A34A"
      : tone === "brown"
      ? "#B77936"
      : "#2584BA";

  return (
    <div
      style={{
        backgroundColor: "#FFFFFF",
        color: "#142B40",
        border: "1px solid #DCE5EE",
        borderTop: `3px solid ${accent}`,
        borderRadius: "12px",
        padding: "15px 12px",
        textAlign: "center",
        boxShadow:
          "0 3px 12px rgba(15,39,65,0.04)",
      }}
    >
      <strong
        style={{
          color: "#64748B",
          fontSize: "11px",
          letterSpacing: ".5px",
        }}
      >
        {title}
      </strong>

      <div style={infoValueStyle}>
        {value}
      </div>

      {subvalue && (
        <small style={{ color: "#64748B" }}>
          {subvalue}
        </small>
      )}
    </div>
  );
}

function PanelTitle({
  title,
  tone,
}) {
  const accent =
    tone === "red"
      ? "#BF3443"
      : "#176B9A";

  return (
    <div
      style={{
        backgroundColor: "#FFFFFF",
        color: "#142B40",
        padding: "14px 16px",
        fontSize: "14px",
        fontWeight: 800,
        borderBottom:
          "1px solid #E2E8F0",
        borderLeft:
          `4px solid ${accent}`,
        letterSpacing: ".4px",
      }}
    >
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

// ==================================================
// COMPANY FLOAT — ALWAYS READ ONLY
// ==================================================

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
            onChange(
              event.target.value
            )
          }
          style={{
            ...moneyInputStyle,
            backgroundColor: locked
              ? "#F1F5F9"
              : "#FFFFFF",
            cursor: locked
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
  const accent =
    tone === "red"
      ? "#BF3443"
      : tone === "navy"
      ? "#183A59"
      : tone === "green"
      ? "#16804A"
      : "#176B9A";

  return (
    <div
      style={{
        backgroundColor: "#FFFFFF",
        color: "#142B40",
        padding: "18px 14px",
        borderRadius: "12px",
        border: "1px solid #DCE5EE",
        borderTop: `4px solid ${accent}`,
        textAlign: "center",
        boxShadow:
          "0 3px 12px rgba(15,39,65,0.04)",
      }}
    >
      <div
        style={{
          fontSize: "11px",
          color: "#64748B",
          fontWeight: 800,
          letterSpacing: ".5px",
        }}
      >
        {title}
      </div>

      <div style={summaryValueStyle}>
        KES {money(amount)}
      </div>
    </div>
  );
}

// ==================================================
// PART 5 BEGINS WITH HELPERS AND STYLE CONSTANTS
// ==================================================

/* ==================================================
   TEAM LEGEND — 24-HOUR CASHIER DASHBOARD
   PART 5 — HELPERS AND PROFESSIONAL STYLES
================================================== */

// ==================================================
// SUPABASE AUTHENTICATION HEADERS
// ==================================================

function authHeaders(anonKey, accessToken) {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

// ==================================================
// SAFE JSON RESPONSE
// ==================================================

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

// ==================================================
// MONEY FORMATTING
// ==================================================

function money(value) {
  const numeric = Number(value ?? 0);

  const safeValue = Number.isFinite(numeric)
    ? numeric
    : 0;

  return safeValue.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function roundMoney(value) {
  return (
    Math.round(
      (Number(value) + Number.EPSILON) * 100
    ) / 100
  );
}

// ==================================================
// NAIROBI REPORT DATE
// ==================================================

function formatReportDate(value) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

// ==================================================
// NAIROBI REPORT DAY
// ==================================================

function formatReportDay(value) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    weekday: "long",
  }).format(new Date(value));
}

// ==================================================
// DISPLAY SHIFT TIME
// ==================================================

function displayTime(value) {
  return String(value || "")
    .split(".")[0]
    .slice(0, 5);
}

// ==================================================
// NORMALISE SHIFT NAME
// ==================================================

function normaliseShiftName(value) {
  const text = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

  if (text === "SHIFT 1" || text === "SHIFT1") {
    return "SHIFT 1";
  }

  if (text === "SHIFT 2" || text === "SHIFT2") {
    return "SHIFT 2";
  }

  return text;
}

// ==================================================
// GET NAIROBI HOUR
// ==================================================

function getNairobiHour(date = new Date()) {
  const formatter = new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: "Africa/Nairobi",
      hour: "2-digit",
      hourCycle: "h23",
    }
  );

  const parts = formatter.formatToParts(date);

  const hourPart = parts.find(
    (part) => part.type === "hour"
  );

  const hour = Number(hourPart?.value ?? 0);

  return Number.isFinite(hour) ? hour : 0;
}

// ==================================================
// PROFESSIONAL DESIGN COLOUR PALETTE
// ==================================================

const palette = {
  navy: "#0B2E49",
  blue: "#156B9A",
  canvas: "#F2F5F9",
  white: "#FFFFFF",
  ink: "#172B45",
  muted: "#687B91",
  border: "#DEE6EF",
  green: "#16804A",
  red: "#BF3443",
};

// ==================================================
// PAGE
// ==================================================

const pageStyle = {
  minHeight: "100vh",
  backgroundColor: palette.canvas,
  color: palette.ink,
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
};

const loadingStyle = {
  minHeight: "100vh",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  color: palette.navy,
  fontWeight: 600,
};

// ==================================================
// HEADER
// ==================================================

const topHeaderStyle = {
  backgroundColor: palette.navy,
  color: "white",
  padding: "16px 24px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
  boxShadow: "0 2px 14px rgba(12,36,59,.10)",
};

const brandWrapStyle = {
  display: "flex",
  gap: "12px",
  alignItems: "center",
};

const crownStyle = {
  fontSize: "34px",
  lineHeight: 1,
};

const brandStyle = {
  fontSize: "24px",
  fontWeight: 850,
  letterSpacing: ".35px",
};

const taglineStyle = {
  fontSize: "9px",
  letterSpacing: "2.2px",
  color: "#C3D8E7",
  fontWeight: 700,
};

const headerRightStyle = {
  display: "flex",
  gap: "16px",
  alignItems: "center",
  textAlign: "right",
  fontSize: "12px",
};

const headerShopStyle = {
  fontSize: "10px",
  marginTop: "4px",
  color: "#BFD2E0",
  fontWeight: 700,
  letterSpacing: ".6px",
};

const logoutButtonStyle = {
  background: "rgba(255,255,255,.07)",
  color: "white",
  border: "1px solid rgba(255,255,255,.32)",
  padding: "9px 15px",
  borderRadius: "9px",
  fontWeight: 700,
  cursor: "pointer",
};

// ==================================================
// BODY AND SIDEBAR
// ==================================================

const bodyStyle = {
  display: "flex",
  minWidth: 0,
};

const sidebarStyle = {
  width: "178px",
  flexShrink: 0,
  backgroundColor: "#103A59",
  minHeight: "calc(100vh - 76px)",
  borderRight: "1px solid rgba(255,255,255,.08)",
};

const mainStyle = {
  flex: 1,
  padding: "18px",
  minWidth: 0,
  maxWidth: "100%",
};

// ==================================================
// TOP INFORMATION CARDS
// ==================================================

const topGridStyle = {
  display: "grid",
  gridTemplateColumns:
    "2fr repeat(5,minmax(0,1fr))",
  gap: "10px",
  marginBottom: "12px",
};

const shopCardStyle = {
  backgroundColor: palette.navy,
  color: "white",
  padding: "17px 14px",
  borderRadius: "12px",
  textAlign: "center",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  boxShadow: "0 2px 7px rgba(13,46,73,.09)",
};

const shopTitleStyle = {
  fontSize: "25px",
  fontWeight: 850,
  letterSpacing: ".4px",
};

const smallTextStyle = {
  fontSize: "10px",
  marginTop: "6px",
  opacity: 0.8,
  letterSpacing: ".5px",
};

const infoValueStyle = {
  fontSize: "16px",
  fontWeight: 750,
  marginTop: "9px",
  overflowWrap: "anywhere",
};

// ==================================================
// GREETING AND SHIFT BANNERS
// ==================================================

const greetingBannerStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 16px",
  borderRadius: "10px",
  marginBottom: "10px",
  textAlign: "center",
  fontSize: "15px",
  fontWeight: 750,
  letterSpacing: ".1px",
};

const greetingWelcomeStyle = {
  backgroundColor: "#EAF8F0",
  color: "#14633D",
  border: "1px solid #BFE8CF",
};

const greetingGoodbyeStyle = {
  backgroundColor: "#FFF6E9",
  color: "#975419",
  border: "1px solid #F2D8B5",
};

const shiftBannerStyle = {
  backgroundColor: "#FFFFFF",
  color: palette.navy,
  border: `1px solid ${palette.border}`,
  padding: "11px 15px",
  borderRadius: "10px",
  marginBottom: "12px",
  display: "flex",
  justifyContent: "space-between",
  gap: "10px",
  fontSize: "12px",
  boxShadow: "0 1px 4px rgba(13,46,73,.03)",
};

// ==================================================
// INCOME AND EXPENSES LAYOUT
// ==================================================

const upperGridStyle = {
  display: "grid",
  gridTemplateColumns:
    "minmax(0,1fr) minmax(0,1fr)",
  gap: "14px",
  alignItems: "stretch",
};

const panelStyle = {
  backgroundColor: "white",
  borderRadius: "12px",
  overflow: "hidden",
  border: `1px solid ${palette.border}`,
  boxShadow: "0 4px 18px rgba(15,45,73,.045)",
};

// ==================================================
// INCOME TABLE
// ==================================================

const tableHeaderStyle = {
  display: "grid",
  gridTemplateColumns: "1.6fr 1fr",
  padding: "11px 13px",
  backgroundColor: "#F2F6FA",
  color: "#52677F",
  fontSize: "10px",
  letterSpacing: ".5px",
  fontWeight: 800,
};

const incomeRowStyle = {
  display: "grid",
  gridTemplateColumns: "1.6fr 1fr",
  gap: "10px",
  padding: "6px 13px",
  alignItems: "center",
  fontSize: "12px",
  minHeight: "36px",
  color: palette.ink,
};

const amountBoxStyle = {
  padding: "9px 10px",
  border: `1px solid ${palette.border}`,
  borderRadius: "7px",
  backgroundColor: "#F8FAFC",
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
};

const moneyInputStyle = {
  width: "100%",
  boxSizing: "border-box",
  minHeight: "35px",
  padding: "8px 10px",
  border: "1px solid #C9D5E2",
  borderRadius: "7px",
  textAlign: "right",
  color: palette.ink,
  fontSize: "12px",
  fontVariantNumeric: "tabular-nums",
};

const savedMoneyStyle = {
  padding: "9px 10px",
  border: "1px solid #BCE4CE",
  backgroundColor: "#EFFAF4",
  color: "#17653F",
  borderRadius: "7px",
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
};

const lockedMoneyStyle = {
  padding: "9px 10px",
  border: `1px solid ${palette.border}`,
  backgroundColor: "#F1F5F9",
  color: "#728399",
  borderRadius: "7px",
  textAlign: "right",
  fontWeight: 650,
};

const savedInlineStyle = {
  color: palette.green,
  fontWeight: 800,
};

const readOnlyInlineStyle = {
  color: palette.blue,
  fontWeight: 800,
};

const incomeTotalStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  padding: "13px 14px",
  backgroundColor: "#EAF7F0",
  color: "#14633D",
  fontSize: "13px",
  fontVariantNumeric: "tabular-nums",
};

// ==================================================
// NOTICE BOXES
// ==================================================

const companyFloatNoticeStyle = {
  margin: "10px 12px",
  padding: "9px 12px",
  backgroundColor: "#F2F7FC",
  color: "#52677F",
  border: `1px solid ${palette.border}`,
  borderRadius: "8px",
  fontSize: "10px",
  textAlign: "center",
  lineHeight: 1.5,
};

const automaticExpenseNoticeStyle = {
  margin: "10px 12px",
  padding: "9px 12px",
  backgroundColor: "#FFF8F0",
  color: "#866143",
  border: "1px solid #F3E5D2",
  borderRadius: "8px",
  fontSize: "10px",
  textAlign: "center",
  lineHeight: 1.5,
};

// ==================================================
// ACTION BUTTONS
// ==================================================

const panelButtonWrapStyle = {
  padding: "8px 12px 13px",
};

const greenActionStyle = {
  width: "100%",
  minHeight: "39px",
  padding: "10px 12px",
  border: "none",
  backgroundColor: palette.green,
  color: "white",
  borderRadius: "8px",
  fontWeight: 750,
  fontSize: "12px",
  cursor: "pointer",
};

const redActionStyle = {
  ...greenActionStyle,
  backgroundColor: palette.red,
};

// ==================================================
// EXPENSE TABLE
// ==================================================

const expenseHeaderStyle = {
  display: "grid",
  gridTemplateColumns:
    "35px minmax(0,1.5fr) minmax(0,1fr)",
  padding: "11px 12px",
  backgroundColor: "#F9F2F3",
  color: "#7D5360",
  fontSize: "10px",
  letterSpacing: ".4px",
  fontWeight: 800,
};

const expenseRowStyle = {
  display: "grid",
  gridTemplateColumns:
    "35px minmax(0,1.5fr) minmax(0,1fr)",
  gap: "7px",
  padding: "5px 12px",
  alignItems: "center",
  minHeight: "36px",
  fontSize: "12px",
};

const expenseInputStyle = {
  width: "100%",
  boxSizing: "border-box",
  minHeight: "34px",
  padding: "8px 10px",
  border: "1px solid #CCD8E4",
  borderRadius: "7px",
  color: palette.ink,
  fontSize: "12px",
};

const savedExpenseStyle = {
  padding: "8px 10px",
  border: "1px solid #BCE4CE",
  backgroundColor: "#EFFAF4",
  color: "#17653F",
  borderRadius: "7px",
  overflowWrap: "anywhere",
};

const expenseTotalStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  padding: "13px 14px",
  backgroundColor: "#FDEEF0",
  color: "#A72A39",
  fontSize: "13px",
  fontVariantNumeric: "tabular-nums",
};

// ==================================================
// 24-HOUR OPERATIONS GRID
// ==================================================

const operationsGridStyle = {
  display: "grid",
  gridTemplateColumns:
    "minmax(0,1.22fr) minmax(0,1fr)",
  gap: "14px",
  marginTop: "14px",
  alignItems: "start",
};

const platformColumnStyle = {
  minWidth: 0,
  width: "100%",
};

const sidePanelsStyle = {
  minWidth: 0,
  width: "100%",
  display: "grid",
  gridTemplateColumns: "minmax(0,1fr)",
  gap: "12px",
  alignContent: "start",
};

// ==================================================
// FINANCIAL SUMMARY
// ==================================================

const summaryGridStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(4,minmax(0,1fr))",
  gap: "12px",
  marginTop: "14px",
};

const summaryValueStyle = {
  marginTop: "12px",
  padding: "4px 0",
  color: palette.ink,
  borderRadius: "6px",
  fontSize: "21px",
  fontWeight: 850,
  fontVariantNumeric: "tabular-nums",
  overflowWrap: "anywhere",
};

// ==================================================
// STATUS MESSAGES
// ==================================================

const messageStyle = {
  padding: "12px 14px",
  marginBottom: "12px",
  borderRadius: "9px",
  border: `1px solid ${palette.border}`,
  fontSize: "12px",
  fontWeight: 650,
};

// ==================================================
// IMPORTANT INFORMATION
// ==================================================

const informationStyle = {
  backgroundColor: "white",
  marginTop: "14px",
  borderRadius: "12px",
  overflow: "hidden",
  border: `1px solid ${palette.border}`,
  boxShadow: "0 3px 12px rgba(15,45,73,.04)",
};

const informationTitleStyle = {
  backgroundColor: palette.navy,
  color: "white",
  padding: "13px 16px",
  fontSize: "12px",
  fontWeight: 800,
  letterSpacing: ".4px",
};

const informationBodyStyle = {
  padding: "14px 18px",
  fontSize: "12px",
  lineHeight: "2",
  color: "#51657D",
};

// ==================================================
// END OF CASHIER24HOURREPORT.JS
// ==================================================
