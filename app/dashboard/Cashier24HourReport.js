"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import CashierSavingsPanel from "./CashierSavingsPanel";
import CashierManagementPanel from "./CashierManagementPanel";
import CashierAccountsPanel from "./CashierAccountsPanel";

import PlatformReadings24Hour from "./PlatformReadings24Hour";
import CloseShift24Hour from "./CloseShift24Hour";

export default function Cashier24HourReport({
  user,
  currentShift,
}) {
  const router = useRouter();

  const [shift, setShift] = useState(
    currentShift || null
  );

  const [incomeEntries, setIncomeEntries] = useState([]);
  const [expenses, setExpenses] = useState([]);

  // Changes whenever the complete 24-hour report refreshes.
  // PlatformReadings24Hour and CloseShift24Hour use this
  // to reload their own database information.
  const [refreshKey, setRefreshKey] = useState(0);

  const [floatInputs, setFloatInputs] = useState({
    company: ["", "", ""],
    mshwari: ["", "", ""],
  });

  const [expenseInputs, setExpenseInputs] = useState(
    Array.from({ length: 10 }, () => ({
      description: "",
      amount: "",
    }))
  );

  const [loading, setLoading] = useState(true);

  const [savingFloats, setSavingFloats] = useState(false);
  const [savingExpenses, setSavingExpenses] = useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

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

  const cashierId =
    user?.profile_id ||
    user?.id ||
    user?.user_id ||
    user?.auth_user_id ||
    null;

  const shiftId =
    currentShift?.id || null;

  const shopName =
    user?.shop ||
    user?.shop_name ||
    user?.shopName ||
    "SHOP";

  const cashierName =
    user?.full_name ||
    user?.name ||
    user?.username ||
    "Cashier";

  // ==================================================
  // LOAD REPORT
  // ==================================================

  const loadReport = useCallback(
    async () => {
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

        const shiftResult =
          await safeJson(shiftResponse);

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

        const incomeResult =
          await safeJson(incomeResponse);

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
        // ------------------------------------------

        const expenseResponse = await fetch(
          `${supabaseUrl}/rest/v1/expenses` +
            `?shift_id=eq.${encodeURIComponent(shiftId)}` +
            `&select=id,description,amount,created_at` +
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

        const expenseResult =
          await safeJson(expenseResponse);

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

        setShift(
          latestShift ||
            currentShift
        );

        setIncomeEntries(
          loadedIncome
        );

        setExpenses(
          loadedExpenses
        );

        // ------------------------------------------
        // FLOAT INPUTS
        // ------------------------------------------

        const companyRows =
          loadedIncome.filter(
            (entry) =>
              entry.entry_type ===
              "COMPANY_FLOAT"
          );

        const mshwariRows =
          loadedIncome.filter(
            (entry) =>
              entry.entry_type ===
              "MSHWARI_FLOAT"
          );

        setFloatInputs((previous) => {
          const company = [
            ...previous.company,
          ];

          const mshwari = [
            ...previous.mshwari,
          ];

          for (let i = 0; i < 3; i += 1) {
            if (companyRows[i]) {
              company[i] =
                String(
                  companyRows[i].amount ??
                    ""
                );
            }

            if (mshwariRows[i]) {
              mshwari[i] =
                String(
                  mshwariRows[i].amount ??
                    ""
                );
            }
          }

          return {
            company,
            mshwari,
          };
        });

        // ------------------------------------------
        // EXPENSE INPUTS
        // ------------------------------------------

        setExpenseInputs((previous) => {
          const next =
            Array.from(
              { length: 10 },
              (_, index) => ({
                description:
                  previous[index]?.description ||
                  "",

                amount:
                  previous[index]?.amount ||
                  "",
              })
            );

          for (let i = 0; i < 10; i += 1) {
            if (loadedExpenses[i]) {
              next[i] = {
                description:
                  loadedExpenses[i].description ||
                  "",

                amount:
                  String(
                    loadedExpenses[i].amount ??
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
  // REFRESH COMPLETE 24-HOUR REPORT
  // ==================================================

  const refresh24HourReport =
    useCallback(async () => {
      await loadReport();

      setRefreshKey(
        (previous) => previous + 1
      );
    }, [loadReport]);

  // ==================================================
  // AUTO REFRESH
  //
  // Every 5 seconds:
  // 1. Reload shift totals / floats / expenses.
  // 2. Increment refreshKey.
  // 3. PlatformReadings24Hour reloads readings.
  // 4. CloseShift24Hour reloads its information.
  //
  // This allows Admin corrections to appear on the
  // cashier screen without a manual browser refresh.
  // ==================================================

  useEffect(() => {
    refresh24HourReport();

    const timer =
      setInterval(() => {
        refresh24HourReport();
      }, 5000);

    return () => {
      clearInterval(timer);
    };
  }, [refresh24HourReport]);

  // ==================================================
  // LOGOUT
  // ==================================================

  function logout() {
    sessionStorage.removeItem(
      "teamLegendUser"
    );

    router.replace("/");
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
      { length: 3 },
      (_, index) =>
        companyEntries[index] ||
        null
    );

  const mshwariSlots =
    Array.from(
      { length: 3 },
      (_, index) =>
        mshwariEntries[index] ||
        null
    );

  // ==================================================
  // SAVE FLOATS
  // ==================================================

  async function saveFloats() {
    const rowsToSave = [];

    for (let i = 0; i < 3; i += 1) {
      if (!companySlots[i]) {
        const raw =
          floatInputs.company[i];

        if (
          raw !== "" &&
          raw !== undefined
        ) {
          const value =
            Number(raw);

          if (
            !Number.isFinite(value) ||
            value <= 0
          ) {
            setMessage(
              `Enter a valid Company Float ${
                i + 1
              }.`
            );

            setMessageType("error");
            return;
          }

          rowsToSave.push({
            shift_id:
              shiftId,

            entry_type:
              "COMPANY_FLOAT",

            description:
              `Float ${i + 1} from company`,

            amount:
              roundMoney(value),
          });
        }
      }

      if (!mshwariSlots[i]) {
        const raw =
          floatInputs.mshwari[i];

        if (
          raw !== "" &&
          raw !== undefined
        ) {
          const value =
            Number(raw);

          if (
            !Number.isFinite(value) ||
            value <= 0
          ) {
            setMessage(
              `Enter a valid M-Shwari Float ${
                i + 1
              }.`
            );

            setMessageType("error");
            return;
          }

          rowsToSave.push({
            shift_id:
              shiftId,

            entry_type:
              "MSHWARI_FLOAT",

            description:
              `Float ${i + 1} from M-Shwari`,

            amount:
              roundMoney(value),
          });
        }
      }
    }

    if (
      rowsToSave.length === 0
    ) {
      setMessage(
        "Enter at least one float amount."
      );

      setMessageType("error");
      return;
    }

    try {
      setSavingFloats(true);
      setMessage("");

      const response =
        await fetch(
          `${supabaseUrl}/rest/v1/shift_income_entries`,
          {
            method: "POST",

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

      if (!response.ok) {
        throw new Error(
          result?.message ||
            result?.details ||
            "Unable to save float."
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
            method: "PATCH",

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

      if (!shiftResponse.ok) {
        throw new Error(
          "Float saved but shift total could not be updated."
        );
      }

      setMessage(
        "Float saved successfully."
      );

      setMessageType(
        "success"
      );

      await refresh24HourReport();
    } catch (error) {
      setMessage(
        error?.message ||
          "Unable to save float."
      );

      setMessageType("error");
    } finally {
      setSavingFloats(false);
    }
  }

  // ==================================================
  // SAVE EXPENSES
  // ==================================================

  async function saveExpenses() {
    const rowsToSave = [];

    for (let i = 0; i < 10; i += 1) {
      if (expenses[i]) {
        continue;
      }

      const description =
        String(
          expenseInputs[i]
            ?.description ||
            ""
        ).trim();

      const rawAmount =
        expenseInputs[i]
          ?.amount;

      const hasDescription =
        description !== "";

      const hasAmount =
        rawAmount !== "" &&
        rawAmount !== undefined;

      if (
        !hasDescription &&
        !hasAmount
      ) {
        continue;
      }

      if (!hasDescription) {
        setMessage(
          `Enter the description for expense ${
            i + 1
          }.`
        );

        setMessageType("error");
        return;
      }

      const amount =
        Number(rawAmount);

      if (
        !hasAmount ||
        !Number.isFinite(amount) ||
        amount <= 0
      ) {
        setMessage(
          `Enter a valid amount for expense ${
            i + 1
          }.`
        );

        setMessageType("error");
        return;
      }

      rowsToSave.push({
        shift_id:
          shiftId,

        description,

        amount:
          roundMoney(
            amount
          ),

        created_by:
          cashierId,
      });
    }

    if (
      rowsToSave.length === 0
    ) {
      setMessage(
        "Enter at least one expense."
      );

      setMessageType("error");
      return;
    }

    try {
      setSavingExpenses(true);
      setMessage("");

      const response =
        await fetch(
          `${supabaseUrl}/rest/v1/expenses`,
          {
            method: "POST",

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

      if (!response.ok) {
        throw new Error(
          result?.message ||
            result?.details ||
            "Unable to save expenses."
        );
      }

      const existingExpenseTotal =
        expenses.reduce(
          (sum, expense) =>
            sum +
            Number(
              expense.amount ??
                0
            ),
          0
        );

      const newExpenseTotal =
        roundMoney(
          existingExpenseTotal +
            rowsToSave.reduce(
              (sum, expense) =>
                sum +
                Number(
                  expense.amount ??
                    0
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
            method: "PATCH",

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

      if (!shiftResponse.ok) {
        throw new Error(
          "Expenses saved but shift total could not be updated."
        );
      }

      setMessage(
        "Expenses saved successfully."
      );

      setMessageType(
        "success"
      );

      await refresh24HourReport();
    } catch (error) {
      setMessage(
        error?.message ||
          "Unable to save expenses."
      );

      setMessageType("error");
    } finally {
      setSavingExpenses(false);
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
    shiftName === "SHIFT 1"
      ? "SHIFT 1"
      : shiftName === "SHIFT 2"
      ? "SHIFT 2"
      : shift?.shift_name ||
        "24-HOUR SHIFT";

  // ==================================================
  // LOADING
  // ==================================================

  if (
    loading &&
    !shift
  ) {
    return (
      <div style={loadingStyle}>
        Loading 24-hour cashier report...
      </div>
    );
  }

  if (!shift) {
    return null;
  }

  // ==================================================
  // DISPLAY
  // ==================================================

  return (
    <div style={pageStyle}>
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
            icon="▥"
            label="Management"
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
          <div style={topGridStyle}>
            <TopCard
              title={
                shopName.toUpperCase()
              }
              subtitle="DAILY SALES REPORT"
              footer="24-HOUR SHOP"
            />

            <InfoCard
              title="CASHIER ON DUTY"
              value={
                cashierName
              }
              tone="brown"
            />

            <InfoCard
              title="DATE"
              value={
                reportDate
              }
            />

            <InfoCard
              title="DAY"
              value={
                reportDay
              }
            />

            <InfoCard
              title="SHIFT"
              value={
                shiftLabel
              }
              subvalue={`${displayTime(
                shift?.scheduled_start
              )} - ${displayTime(
                shift?.scheduled_end
              )}`}
              tone="green"
            />

            <InfoCard
              title="STATUS"
              value={
                shiftStatus
              }
              tone="green"
            />
          </div>

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

          {message && (
            <div
              style={{
                ...messageStyle,

                backgroundColor:
                  messageType ===
                  "success"
                    ? "#ecfdf5"
                    : "#fef2f2",

                color:
                  messageType ===
                  "success"
                    ? "#166534"
                    : "#991b1b",
              }}
            >
              {message}
            </div>
          )}

          <div style={upperGridStyle}>
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
                amount={
                  openingBalance
                }
              />

              {companySlots.map(
                (entry, index) => (
                  <EditableFloatRow
                    key={`company-${index}`}
                    label={`Added Float ${
                      index + 1
                    } From Company`}
                    savedEntry={
                      entry
                    }
                    value={
                      floatInputs.company[
                        index
                      ] || ""
                    }
                    disabled={
                      savingFloats
                    }
                    onChange={(value) => {
                      setFloatInputs(
                        (previous) => {
                          const company = [
                            ...previous.company,
                          ];

                          company[
                            index
                          ] =
                            value;

                          return {
                            ...previous,
                            company,
                          };
                        }
                      );
                    }}
                  />
                )
              )}

              {mshwariSlots.map(
                (entry, index) => (
                  <EditableFloatRow
                    key={`mshwari-${index}`}
                    label={`Added Float ${
                      index + 1
                    } From M-Shwari`}
                    savedEntry={
                      entry
                    }
                    value={
                      floatInputs.mshwari[
                        index
                      ] || ""
                    }
                    disabled={
                      savingFloats
                    }
                    onChange={(value) => {
                      setFloatInputs(
                        (previous) => {
                          const mshwari = [
                            ...previous.mshwari,
                          ];

                          mshwari[
                            index
                          ] =
                            value;

                          return {
                            ...previous,
                            mshwari,
                          };
                        }
                      );
                    }}
                  />
                )
              )}

              <div style={incomeTotalStyle}>
                <strong>
                  TOTAL ADDED
                </strong>

                <strong>
                  {money(
                    totalAdded
                  )}
                </strong>
              </div>

              <div style={panelButtonWrapStyle}>
                <button
                  type="button"
                  onClick={
                    saveFloats
                  }
                  disabled={
                    savingFloats
                  }
                  style={{
                    ...greenActionStyle,

                    backgroundColor:
                      savingFloats
                        ? "#94a3b8"
                        : "#07912a",
                  }}
                >
                  {savingFloats
                    ? "Saving..."
                    : "Save Added Float"}
                </button>
              </div>
            </section>

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

              {Array.from(
                { length: 10 },
                (_, index) => {
                  const saved =
                    expenses[index];

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
                          <div style={savedExpenseStyle}>
                            {
                              saved.description
                            }
                          </div>

                          <div style={savedExpenseStyle}>
                            {money(
                              saved.amount
                            )}{" "}
                            ✓
                          </div>
                        </>
                      ) : (
                        <>
                          <input
                            value={
                              expenseInputs[
                                index
                              ]
                                ?.description ||
                              ""
                            }
                            placeholder="Description"
                            disabled={
                              savingExpenses
                            }
                            onChange={(event) => {
                              const value =
                                event.target
                                  .value;

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
                            style={expenseInputStyle}
                          />

                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={
                              expenseInputs[
                                index
                              ]
                                ?.amount ||
                              ""
                            }
                            placeholder="0.00"
                            disabled={
                              savingExpenses
                            }
                            onChange={(event) => {
                              const value =
                                event.target
                                  .value;

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
                            style={expenseInputStyle}
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
                  {money(
                    totalExpenses
                  )}
                </strong>
              </div>

              <div style={panelButtonWrapStyle}>
                <button
                  type="button"
                  onClick={
                    saveExpenses
                  }
                  disabled={
                    savingExpenses
                  }
                  style={{
                    ...redActionStyle,

                    backgroundColor:
                      savingExpenses
                        ? "#94a3b8"
                        : "#c50000",
                  }}
                >
                  {savingExpenses
                    ? "Saving..."
                    : "Save Expenses"}
                </button>
              </div>
            </section>
          </div>

          <PlatformReadings24Hour
            user={user}
            currentShift={
              shift ||
              currentShift
            }
            refreshKey={
              refreshKey
            }
            onReadingsChanged={
              refresh24HourReport
            }
          />

          <div style={summaryGridStyle}>
            <SummaryBox
              title="TOTAL OUTPUT"
              amount={
                totalOutput
              }
              tone="green"
            />

            <SummaryBox
              title="TOTAL SALES"
              amount={
                totalSales
              }
              tone="blue"
            />

            <SummaryBox
              title="TOTAL EXPENSES"
              amount={
                totalExpenses
              }
              tone="red"
            />

            <SummaryBox
              title="CLOSING BALANCE"
              amount={
                closingBalance
              }
              tone="navy"
            />
          </div>

          <div style={lowerGridStyle}>
            <CashierSavingsPanel
              user={user}
              currentShift={
                shift ||
                currentShift
              }
            />

            <CashierManagementPanel
              user={user}
              currentShift={
                shift ||
                currentShift
              }
            />

            <CashierAccountsPanel
              user={user}
            />
          </div>

          <CloseShift24Hour
            user={user}
            currentShift={
              shift ||
              currentShift
            }
            refreshKey={
              refreshKey
            }
            onShiftClosed={() => {
              router.refresh();

              window.location.reload();
            }}
          />

          <section style={informationStyle}>
            <div style={informationTitleStyle}>
              IMPORTANT INFORMATION
            </div>

            <div style={informationBodyStyle}>
              <div>
                1. Shift 1 runs from 9:00 AM to 9:00 PM.
              </div>

              <div>
                2. Shift 2 runs from 9:00 PM to 9:00 AM.
              </div>

              <div>
                3. Resettable platforms are recorded at 11:59 PM and reset to zero at midnight.
              </div>

              <div>
                4. TABLE does not reset at midnight and has no midnight reading.
              </div>

              <div>
                5. TABLE is handed over continuously at 9:00 AM and 9:00 PM.
              </div>

              <div>
                6. Record all expenses before completing the shift handover.
              </div>

              <div>
                7. Cashier handover is only available during the authorised morning or evening handover window.
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
        padding: "18px",
        display: "flex",
        gap: "12px",
        color: "white",
        backgroundColor:
          active
            ? "#1687ee"
            : "transparent",
      }}
    >
      <span>
        {icon}
      </span>

      <span>
        {label}
      </span>
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
  const background =
    tone === "green"
      ? "#07912a"
      : tone === "brown"
      ? "#99500d"
      : "#0873b9";

  return (
    <div
      style={{
        backgroundColor:
          background,
        color:
          "white",
        borderRadius:
          "8px",
        padding:
          "12px",
        textAlign:
          "center",
      }}
    >
      <strong>
        {title}
      </strong>

      <div style={infoValueStyle}>
        {value}
      </div>

      <small>
        {subvalue}
      </small>
    </div>
  );
}

function PanelTitle({
  title,
  tone,
}) {
  const background =
    tone === "red"
      ? "#b60000"
      : "#0873b9";

  return (
    <div
      style={{
        backgroundColor:
          background,
        color:
          "white",
        padding:
          "9px",
        fontWeight:
          "bold",
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
      <div>
        {label}
      </div>

      <div style={amountBoxStyle}>
        {money(
          amount
        )}
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
          {money(
            savedEntry.amount
          )}
        </div>
      ) : (
        <input
          type="number"
          min="0"
          step="0.01"
          value={value}
          disabled={
            disabled
          }
          onChange={(event) =>
            onChange(
              event.target.value
            )
          }
          style={moneyInputStyle}
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
  const background =
    tone === "red"
      ? "#ef233c"
      : tone === "navy"
      ? "#075b95"
      : tone === "green"
      ? "#078a3b"
      : "#0789dd";

  return (
    <div
      style={{
        backgroundColor:
          background,
        color:
          "white",
        padding:
          "13px",
        borderRadius:
          "7px",
        textAlign:
          "center",
        fontWeight:
          "bold",
      }}
    >
      {title}

      <div style={summaryValueStyle}>
        KES{" "}
        {money(
          amount
        )}
      </div>
    </div>
  );
}

// ==================================================
// HELPERS
// ==================================================

function authHeaders(
  anonKey,
  accessToken
) {
  return {
    apikey:
      anonKey,

    Authorization:
      `Bearer ${accessToken}`,

    "Content-Type":
      "application/json",
  };
}

async function safeJson(
  response
) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function money(
  value
) {
  const numeric =
    Number(
      value ?? 0
    );

  const safeValue =
    Number.isFinite(
      numeric
    )
      ? numeric
      : 0;

  return safeValue.toLocaleString(
    "en-KE",
    {
      minimumFractionDigits:
        2,

      maximumFractionDigits:
        2,
    }
  );
}

function roundMoney(
  value
) {
  return (
    Math.round(
      (Number(value) +
        Number.EPSILON) *
        100
    ) / 100
  );
}

function formatReportDate(
  value
) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone:
        "Africa/Nairobi",

      day:
        "2-digit",

      month:
        "short",

      year:
        "numeric",
    }
  ).format(
    new Date(value)
  );
}

function formatReportDay(
  value
) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone:
        "Africa/Nairobi",

      weekday:
        "long",
    }
  ).format(
    new Date(value)
  );
}

function displayTime(
  value
) {
  return String(
    value || ""
  )
    .split(".")[0]
    .slice(0, 5);
}

function normaliseShiftName(
  value
) {
  const text =
    String(
      value || ""
    )
      .trim()
      .toUpperCase()
      .replace(
        /[_-]+/g,
        " "
      )
      .replace(
        /\s+/g,
        " "
      );

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

// ==================================================
// STYLES
// ==================================================

const pageStyle = {
  minHeight: "100vh",
  backgroundColor: "#edf2f7",
  fontFamily: "Arial, sans-serif",
};

const loadingStyle = {
  minHeight: "100vh",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
};

const topHeaderStyle = {
  backgroundColor: "#063c63",
  color: "white",
  padding: "12px 22px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const brandWrapStyle = {
  display: "flex",
  gap: "12px",
  alignItems: "center",
};

const crownStyle = {
  fontSize: "45px",
};

const brandStyle = {
  fontSize: "30px",
  fontWeight: "900",
};

const taglineStyle = {
  fontSize: "10px",
  letterSpacing: "3px",
};

const headerRightStyle = {
  display: "flex",
  gap: "18px",
  alignItems: "center",
  textAlign: "right",
};

const headerShopStyle = {
  fontSize: "12px",
};

const logoutButtonStyle = {
  background: "transparent",
  color: "white",
  border: "1px solid white",
  padding: "8px 14px",
  borderRadius: "6px",
  cursor: "pointer",
};

const bodyStyle = {
  display: "flex",
};

const sidebarStyle = {
  width: "190px",
  backgroundColor: "#073555",
  minHeight: "calc(100vh - 70px)",
};

const mainStyle = {
  flex: 1,
  padding: "12px",
  minWidth: 0,
};

const topGridStyle = {
  display: "grid",
  gridTemplateColumns:
    "2fr repeat(5,1fr)",
  gap: "7px",
  marginBottom: "10px",
};

const shopCardStyle = {
  backgroundColor: "#08628f",
  color: "white",
  padding: "12px",
  borderRadius: "8px",
  textAlign: "center",
};

const shopTitleStyle = {
  fontSize: "27px",
  fontWeight: "900",
};

const smallTextStyle = {
  fontSize: "10px",
  marginTop: "4px",
};

const infoValueStyle = {
  fontSize: "17px",
  fontWeight: "bold",
  marginTop: "8px",
};

const shiftBannerStyle = {
  backgroundColor: "#ecfdf5",
  color: "#166534",
  border: "1px solid #86efac",
  padding: "10px 14px",
  borderRadius: "7px",
  marginBottom: "10px",
  display: "flex",
  justifyContent: "space-between",
  gap: "10px",
};

const upperGridStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "10px",
};

const panelStyle = {
  backgroundColor: "white",
  borderRadius: "6px",
  overflow: "hidden",
};

const tableHeaderStyle = {
  display: "grid",
  gridTemplateColumns: "1.6fr 1fr",
  padding: "9px",
  backgroundColor: "#eef4f8",
  fontSize: "11px",
  fontWeight: "bold",
};

const incomeRowStyle = {
  display: "grid",
  gridTemplateColumns: "1.6fr 1fr",
  gap: "8px",
  padding: "5px 9px",
  alignItems: "center",
  fontSize: "11px",
};

const amountBoxStyle = {
  padding: "7px",
  border: "1px solid #ddd",
  textAlign: "right",
};

const moneyInputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "7px",
  border: "1px solid #94a3b8",
  borderRadius: "4px",
  textAlign: "right",
};

const savedMoneyStyle = {
  padding: "7px",
  border: "1px solid #86efac",
  backgroundColor: "#ecfdf5",
  borderRadius: "4px",
  textAlign: "right",
};

const savedInlineStyle = {
  color: "#15803d",
  fontWeight: "bold",
};

const incomeTotalStyle = {
  display: "flex",
  justifyContent: "space-between",
  padding: "11px",
  backgroundColor: "#dcfce7",
};

const panelButtonWrapStyle = {
  padding: "8px",
};

const greenActionStyle = {
  width: "100%",
  padding: "9px",
  border: "none",
  backgroundColor: "#07912a",
  color: "white",
  borderRadius: "5px",
  fontWeight: "bold",
  cursor: "pointer",
};

const redActionStyle = {
  ...greenActionStyle,
  backgroundColor: "#c50000",
};

const expenseHeaderStyle = {
  display: "grid",
  gridTemplateColumns:
    "35px 1.5fr 1fr",
  padding: "8px",
  backgroundColor: "#fff0f0",
  fontSize: "10px",
  fontWeight: "bold",
};

const expenseRowStyle = {
  display: "grid",
  gridTemplateColumns:
    "35px 1.5fr 1fr",
  gap: "6px",
  padding: "4px 8px",
  alignItems: "center",
};

const expenseInputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "6px",
  border: "1px solid #cbd5e1",
  borderRadius: "4px",
};

const savedExpenseStyle = {
  padding: "6px",
  border: "1px solid #86efac",
  backgroundColor: "#ecfdf5",
  borderRadius: "4px",
};

const expenseTotalStyle = {
  display: "flex",
  justifyContent: "space-between",
  padding: "10px",
  backgroundColor: "#c50000",
  color: "white",
};

const summaryGridStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(4,1fr)",
  gap: "10px",
  marginTop: "10px",
};

const summaryValueStyle = {
  marginTop: "8px",
  padding: "9px",
  backgroundColor: "white",
  color: "#111",
  borderRadius: "5px",
  fontSize: "20px",
};

const lowerGridStyle = {
  display: "grid",
  gridTemplateColumns:
    "1fr 1.25fr 1fr",
  gap: "10px",
  marginTop: "10px",
  alignItems: "start",
};

const messageStyle = {
  padding: "9px",
  marginBottom: "8px",
  borderRadius: "5px",
};

const informationStyle = {
  backgroundColor: "white",
  marginTop: "12px",
  borderRadius: "7px",
  overflow: "hidden",
  border: "1px solid #cbd5e1",
};

const informationTitleStyle = {
  backgroundColor: "#063c63",
  color: "white",
  padding: "10px 14px",
  fontWeight: "bold",
};

const informationBodyStyle = {
  padding: "14px",
  fontSize: "12px",
  lineHeight: "1.9",
  color: "#334155",
};
