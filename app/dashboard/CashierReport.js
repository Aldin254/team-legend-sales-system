"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useRouter } from "next/navigation";

export default function CashierReport({
  user,
  currentShift,
}) {
  const router = useRouter();

  const [shift, setShift] = useState(
    currentShift || null
  );

  const [platforms, setPlatforms] = useState([]);
  const [readings, setReadings] = useState([]);
  const [incomeEntries, setIncomeEntries] = useState([]);
  const [expenses, setExpenses] = useState([]);

  const [openingInputs, setOpeningInputs] = useState({});
  const [closingInputs, setClosingInputs] = useState({});

  const [loading, setLoading] = useState(true);

  const [savingOpening, setSavingOpening] = useState(false);
  const [savingClosing, setSavingClosing] = useState(false);

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
  // LOAD REPORT DATA
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
        // PLATFORMS
        // ------------------------------------------

        const platformResponse = await fetch(
          `${supabaseUrl}/rest/v1/shop_platforms` +
            `?shop_id=eq.${encodeURIComponent(shopId)}` +
            `&is_active=eq.true` +
            `&select=id,platform_name,reading_type,display_order` +
            `&order=display_order.asc`,
          {
            method: "GET",
            headers: authHeaders(
              supabaseAnonKey,
              accessToken
            ),
            cache: "no-store",
          }
        );

        const platformResult =
          await safeJson(platformResponse);

        if (!platformResponse.ok) {
          throw new Error(
            platformResult?.message ||
              platformResult?.details ||
              "Unable to load platforms."
          );
        }

        const loadedPlatforms =
          Array.isArray(platformResult)
            ? platformResult
            : [];

        // ------------------------------------------
        // PLATFORM READINGS
        // ------------------------------------------

        const readingResponse = await fetch(
          `${supabaseUrl}/rest/v1/platform_readings` +
            `?shift_id=eq.${encodeURIComponent(shiftId)}` +
            `&select=id,platform_id,reading_kind,reading_value,recorded_at`,
          {
            method: "GET",
            headers: authHeaders(
              supabaseAnonKey,
              accessToken
            ),
            cache: "no-store",
          }
        );

        const readingResult =
          await safeJson(readingResponse);

        if (!readingResponse.ok) {
          throw new Error(
            readingResult?.message ||
              readingResult?.details ||
              "Unable to load platform readings."
          );
        }

        const loadedReadings =
          Array.isArray(readingResult)
            ? readingResult
            : [];

        // ------------------------------------------
        // FLOAT / INCOME
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

        // ------------------------------------------
        // SAVE DATA
        // ------------------------------------------

        setShift(
          latestShift ||
            currentShift
        );

        setPlatforms(
          loadedPlatforms
        );

        setReadings(
          loadedReadings
        );

        setIncomeEntries(
          Array.isArray(incomeResult)
            ? incomeResult
            : []
        );

        setExpenses(
          Array.isArray(expenseResult)
            ? expenseResult
            : []
        );

        // ------------------------------------------
        // PRESERVE UNSAVED OPENING INPUTS
        // ------------------------------------------

        setOpeningInputs((previous) => {
          const next = {
            ...previous,
          };

          for (const platform of loadedPlatforms) {
            const savedOpening =
              loadedReadings.find(
                (row) =>
                  row.platform_id === platform.id &&
                  row.reading_kind === "OPENING"
              );

            if (savedOpening) {
              next[platform.id] =
                String(
                  savedOpening.reading_value ?? ""
                );
            } else if (
              next[platform.id] === undefined
            ) {
              next[platform.id] = "";
            }
          }

          return next;
        });

        // ------------------------------------------
        // PRESERVE UNSAVED CLOSING INPUTS
        // ------------------------------------------

        setClosingInputs((previous) => {
          const next = {
            ...previous,
          };

          for (const platform of loadedPlatforms) {
            const savedClosing =
              loadedReadings.find(
                (row) =>
                  row.platform_id === platform.id &&
                  row.reading_kind === "CLOSING"
              );

            if (savedClosing) {
              next[platform.id] =
                String(
                  savedClosing.reading_value ?? ""
                );
            } else if (
              next[platform.id] === undefined
            ) {
              next[platform.id] = "";
            }
          }

          return next;
        });
      } catch (error) {
        console.error(
          "CASHIER REPORT ERROR:",
          error
        );
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
  // AUTO REFRESH
  // ==================================================

  useEffect(() => {
    loadReport();

    const timer = setInterval(
      loadReport,
      5000
    );

    return () => {
      clearInterval(timer);
    };
  }, [loadReport]);

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
  // SAVED READING COUNTS
  // ==================================================

  const savedOpeningIds =
    useMemo(() => {
      return new Set(
        readings
          .filter(
            (row) =>
              row.reading_kind === "OPENING"
          )
          .map(
            (row) =>
              row.platform_id
          )
      );
    }, [readings]);

  const savedClosingIds =
    useMemo(() => {
      return new Set(
        readings
          .filter(
            (row) =>
              row.reading_kind === "CLOSING"
          )
          .map(
            (row) =>
              row.platform_id
          )
      );
    }, [readings]);

  const savedOpeningCount =
    platforms.filter(
      (platform) =>
        savedOpeningIds.has(
          platform.id
        )
    ).length;

  const savedClosingCount =
    platforms.filter(
      (platform) =>
        savedClosingIds.has(
          platform.id
        )
    ).length;

  const allOpeningsSaved =
    platforms.length > 0 &&
    savedOpeningCount ===
      platforms.length;

  const allClosingsSaved =
    platforms.length > 0 &&
    savedClosingCount ===
      platforms.length;

  // ==================================================
  // FLOAT TOTALS
  // ==================================================

  const floatData =
    useMemo(() => {
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
        companyEntries.reduce(
          (sum, entry) =>
            sum +
            Number(
              entry.amount || 0
            ),
          0
        );

      const mshwariTotal =
        mshwariEntries.reduce(
          (sum, entry) =>
            sum +
            Number(
              entry.amount || 0
            ),
          0
        );

      return {
        companyEntries,
        mshwariEntries,

        companyTotal:
          roundMoney(
            companyTotal
          ),

        mshwariTotal:
          roundMoney(
            mshwariTotal
          ),
      };
    }, [incomeEntries]);

  // ==================================================
  // PLATFORM ROWS
  // ==================================================

  const platformRows =
    useMemo(() => {
      return platforms.map(
        (platform) => {
          const openingRow =
            readings.find(
              (row) =>
                row.platform_id ===
                  platform.id &&
                row.reading_kind ===
                  "OPENING"
            );

          const closingRow =
            readings.find(
              (row) =>
                row.platform_id ===
                  platform.id &&
                row.reading_kind ===
                  "CLOSING"
            );

          const openingRaw =
            openingRow
              ? openingRow.reading_value
              : openingInputs[
                  platform.id
                ];

          const closingRaw =
            closingRow
              ? closingRow.reading_value
              : closingInputs[
                  platform.id
                ];

          const opening =
            openingRaw === "" ||
            openingRaw === undefined ||
            openingRaw === null
              ? null
              : Number(openingRaw);

          const closing =
            closingRaw === "" ||
            closingRaw === undefined ||
            closingRaw === null
              ? null
              : Number(closingRaw);

          let output = 0;

          if (
            opening !== null &&
            closing !== null &&
            !Number.isNaN(opening) &&
            !Number.isNaN(closing) &&
            closing >= opening
          ) {
            output =
              roundMoney(
                closing -
                  opening
              );
          }

          return {
            ...platform,

            opening,
            closing,
            output,

            openingSaved:
              Boolean(
                openingRow
              ),

            closingSaved:
              Boolean(
                closingRow
              ),
          };
        }
      );
    }, [
      platforms,
      readings,
      openingInputs,
      closingInputs,
    ]);

  // ==================================================
  // SAVE OPENING READINGS
  // ==================================================

  async function saveOpeningReadings() {
    if (
      !shiftId ||
      !accessToken ||
      !cashierId
    ) {
      setMessage(
        "Login or shift information is missing."
      );

      setMessageType("error");
      return;
    }

    const unsavedPlatforms =
      platforms.filter(
        (platform) =>
          !savedOpeningIds.has(
            platform.id
          )
      );

    if (
      unsavedPlatforms.length === 0
    ) {
      setMessage(
        "All opening readings are already saved."
      );

      setMessageType("success");
      return;
    }

    for (const platform of unsavedPlatforms) {
      const raw =
        openingInputs[
          platform.id
        ];

      const value =
        Number(raw);

      if (
        raw === "" ||
        raw === undefined ||
        Number.isNaN(value) ||
        value < 0
      ) {
        setMessage(
          `Enter a valid opening reading for ${platform.platform_name}.`
        );

        setMessageType("error");
        return;
      }
    }

    try {
      setSavingOpening(true);
      setMessage("");
      setMessageType("");

      const recordedAt =
        new Date().toISOString();

      for (const platform of unsavedPlatforms) {
        const value =
          Number(
            openingInputs[
              platform.id
            ]
          );

        const response = await fetch(
          `${supabaseUrl}/rest/v1/platform_readings`,
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

            body: JSON.stringify({
              shift_id:
                shiftId,

              platform_id:
                platform.id,

              reading_kind:
                "OPENING",

              reading_value:
                roundMoney(
                  value
                ),

              recorded_at:
                recordedAt,

              recorded_by:
                cashierId,
            }),
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
              result?.hint ||
              `Unable to save ${platform.platform_name}.`
          );
        }
      }

      setMessage(
        "Opening readings saved successfully."
      );

      setMessageType(
        "success"
      );

      await loadReport();
    } catch (error) {
      console.error(
        "SAVE OPENING ERROR:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to save opening readings."
      );

      setMessageType("error");
    } finally {
      setSavingOpening(false);
    }
  }

  // ==================================================
  // SAVE CLOSING READINGS
  // ==================================================

  async function saveClosingReadings() {
    if (!allOpeningsSaved) {
      setMessage(
        "Save all opening readings first."
      );

      setMessageType("error");
      return;
    }

    const unsavedPlatforms =
      platforms.filter(
        (platform) =>
          !savedClosingIds.has(
            platform.id
          )
      );

    if (
      unsavedPlatforms.length === 0
    ) {
      setMessage(
        "All closing readings are already saved."
      );

      setMessageType("success");
      return;
    }

    for (const platform of unsavedPlatforms) {
      const openingRow =
        readings.find(
          (row) =>
            row.platform_id ===
              platform.id &&
            row.reading_kind ===
              "OPENING"
        );

      const opening =
        Number(
          openingRow?.reading_value
        );

      const rawClosing =
        closingInputs[
          platform.id
        ];

      const closing =
        Number(
          rawClosing
        );

      if (
        rawClosing === "" ||
        rawClosing === undefined ||
        Number.isNaN(closing) ||
        closing < 0
      ) {
        setMessage(
          `Enter a valid closing reading for ${platform.platform_name}.`
        );

        setMessageType("error");
        return;
      }

      if (
        Number.isNaN(opening)
      ) {
        setMessage(
          `Opening reading is missing for ${platform.platform_name}.`
        );

        setMessageType("error");
        return;
      }

      if (
        closing < opening
      ) {
        setMessage(
          `${platform.platform_name} closing reading cannot be lower than opening ${money(
            opening
          )}.`
        );

        setMessageType("error");
        return;
      }
    }

    try {
      setSavingClosing(true);
      setMessage("");
      setMessageType("");

      const recordedAt =
        new Date().toISOString();

      for (const platform of unsavedPlatforms) {
        const closing =
          Number(
            closingInputs[
              platform.id
            ]
          );

        const response = await fetch(
          `${supabaseUrl}/rest/v1/platform_readings`,
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

            body: JSON.stringify({
              shift_id:
                shiftId,

              platform_id:
                platform.id,

              reading_kind:
                "CLOSING",

              reading_value:
                roundMoney(
                  closing
                ),

              recorded_at:
                recordedAt,

              recorded_by:
                cashierId,
            }),
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
              result?.hint ||
              `Unable to save ${platform.platform_name} closing reading.`
          );
        }
      }

      // ------------------------------------------
      // CALCULATE TOTAL PLATFORM OUTPUT
      // ------------------------------------------

      let totalOutput = 0;

      for (const platform of platforms) {
        const openingRow =
          readings.find(
            (row) =>
              row.platform_id ===
                platform.id &&
              row.reading_kind ===
                "OPENING"
          );

        const savedClosing =
          readings.find(
            (row) =>
              row.platform_id ===
                platform.id &&
              row.reading_kind ===
                "CLOSING"
          );

        const opening =
          Number(
            openingRow?.reading_value ||
              0
          );

        const closing =
          savedClosing
            ? Number(
                savedClosing.reading_value ||
                  0
              )
            : Number(
                closingInputs[
                  platform.id
                ] || 0
              );

        totalOutput +=
          closing -
          opening;
      }

      totalOutput =
        roundMoney(
          totalOutput
        );

      // ------------------------------------------
      // UPDATE SHIFT TOTAL OUTPUT
      // ------------------------------------------

      const shiftResponse = await fetch(
        `${supabaseUrl}/rest/v1/shifts` +
          `?id=eq.${encodeURIComponent(
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

            Prefer:
              "return=representation",
          },

          body: JSON.stringify({
            total_output:
              totalOutput,
          }),
        }
      );

      const shiftResult =
        await safeJson(
          shiftResponse
        );

      if (!shiftResponse.ok) {
        throw new Error(
          shiftResult?.message ||
            shiftResult?.details ||
            "Closing readings were saved, but total sales could not be updated."
        );
      }

      setMessage(
        "Closing readings saved successfully."
      );

      setMessageType(
        "success"
      );

      await loadReport();
    } catch (error) {
      console.error(
        "SAVE CLOSING ERROR:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to save closing readings."
      );

      setMessageType("error");
    } finally {
      setSavingClosing(false);
    }
  }

  // ==================================================
  // SHIFT TOTALS
  // ==================================================

  const openingBalance =
    Number(
      shift?.opening_balance ||
        0
    );

  const savedTotalOutput =
    Number(
      shift?.total_output ||
        0
    );

  const totalExpenses =
    Number(
      shift?.total_expenses ||
        0
    );

  const closingBalance =
    Number(
      shift?.closing_balance ||
        0
    );

  const totalAdded =
    roundMoney(
      openingBalance +
        floatData.companyTotal +
        floatData.mshwariTotal
    );

  // TOTAL SALES =
  // B/F + COMPANY FLOAT + M-SHWARI + PLATFORM OUTPUT

  const totalSales =
    roundMoney(
      openingBalance +
        floatData.companyTotal +
        floatData.mshwariTotal +
        savedTotalOutput
    );

  // ==================================================
  // DATE / DAY
  // ==================================================

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

  // ==================================================
  // EXPENSE SLOTS
  // ==================================================

  const expenseSlots =
    Array.from(
      { length: 10 },
      (_, index) =>
        expenses[index] ||
        null
    );

  // ==================================================
  // FLOAT SLOTS
  // ==================================================

  const companySlots =
    Array.from(
      { length: 3 },
      (_, index) =>
        floatData.companyEntries[
          index
        ] || null
    );

  const mshwariSlots =
    Array.from(
      { length: 3 },
      (_, index) =>
        floatData.mshwariEntries[
          index
        ] || null
    );

  // ==================================================
  // LOADING
  // ==================================================

  if (
    loading &&
    !shift
  ) {
    return (
      <div style={loadingStyle}>
        Loading cashier report...
      </div>
    );
  }

  if (!shift) {
    return null;
  }

  // ==================================================
  // PAGE
  // ==================================================

  return (
    <div style={pageStyle}>
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
            <div>
              Welcome,{" "}
              <strong>
                {cashierName.toUpperCase()}
              </strong>
            </div>

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
        {/* SIDEBAR */}

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

        {/* MAIN */}

        <main style={mainStyle}>
          {/* TOP CARDS */}

          <div style={topGridStyle}>
            <TopCard
              title={shopName.toUpperCase()}
              subtitle="DAILY SALES REPORT"
              footer="12-HOUR SHOP"
            />

            <InfoCard
              title="CASHIER ON DUTY"
              value={cashierName}
              tone="brown"
            />

            <InfoCard
              title="DATE"
              value={reportDate}
              tone="blue"
            />

            <InfoCard
              title="DAY"
              value={reportDay}
              tone="blue"
            />

            <InfoCard
              title="SHIFT"
              value={
                shift?.shift_name ||
                "DAY"
              }
              subvalue={
                shift?.scheduled_start &&
                shift?.scheduled_end
                  ? `${displayTime(
                      shift.scheduled_start
                    )} - ${displayTime(
                      shift.scheduled_end
                    )}`
                  : "12 Hours"
              }
              tone="green"
            />

            <InfoCard
              title="STATUS"
              value={shiftStatus}
              tone={
                shiftStatus ===
                "OPEN"
                  ? "green"
                  : "red"
              }
            />
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

          {/* MAIN REPORT */}

          <div style={reportGridStyle}>
            {/* INCOME STATEMENT */}

            <section style={panelStyle}>
              <PanelTitle
                title="INCOME STATEMENT"
                tone="blue"
              />

              <div style={tableHeaderStyle}>
                <div>
                  DESCRIPTION
                </div>

                <div
                  style={{
                    textAlign:
                      "right",
                  }}
                >
                  AMOUNT (KES)
                </div>
              </div>

              <IncomeRow
                label="Balance B/F (Previous Shift)"
                amount={
                  openingBalance
                }
              />

              {companySlots.map(
                (entry, index) => (
                  <IncomeRow
                    key={`company-${index}`}
                    label={`Added Float ${
                      index + 1
                    } From Company`}
                    amount={
                      entry?.amount ||
                      0
                    }
                  />
                )
              )}

              {mshwariSlots.map(
                (entry, index) => (
                  <IncomeRow
                    key={`mshwari-${index}`}
                    label={`Added Float ${
                      index + 1
                    } From M-Shwari`}
                    amount={
                      entry?.amount ||
                      0
                    }
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
            </section>

            {/* PLATFORM SALES */}

            <section style={panelStyle}>
              <PanelTitle
                title="PLATFORM SALES"
                tone="green"
              />

              <div style={platformStatusStyle}>
                <span>
                  Opening:{" "}
                  <strong>
                    {savedOpeningCount} / {platforms.length}
                  </strong>
                </span>

                <span>
                  Closing:{" "}
                  <strong>
                    {savedClosingCount} / {platforms.length}
                  </strong>
                </span>
              </div>

              <div style={platformHeaderStyle}>
                <div>
                  SHOP / PLATFORM
                </div>

                <div>
                  OPENING
                  <br />
                  (KES)
                </div>

                <div>
                  CLOSING
                  <br />
                  (KES)
                </div>

                <div>
                  SALES
                  <br />
                  (KES)
                </div>
              </div>

              {platformRows.map(
                (platform) => (
                  <div
                    key={platform.id}
                    style={platformRowStyle}
                  >
                    <div
                      style={{
                        fontWeight:
                          "bold",
                      }}
                    >
                      {platform.platform_name}

                      {platform.openingSaved && (
                        <div style={savedTextStyle}>
                          Opening ✓
                        </div>
                      )}

                      {platform.closingSaved && (
                        <div style={savedTextStyle}>
                          Closing ✓
                        </div>
                      )}
                    </div>

                    {platform.openingSaved ? (
                      <SavedReadingBox
                        value={
                          platform.opening
                        }
                      />
                    ) : (
                      <ReadingInput
                        value={
                          openingInputs[
                            platform.id
                          ] ?? ""
                        }
                        disabled={
                          savingOpening
                        }
                        onChange={(value) => {
                          setOpeningInputs(
                            (previous) => ({
                              ...previous,
                              [platform.id]:
                                value,
                            })
                          );

                          setMessage("");
                        }}
                      />
                    )}

                    {platform.closingSaved ? (
                      <SavedReadingBox
                        value={
                          platform.closing
                        }
                      />
                    ) : (
                      <ReadingInput
                        value={
                          closingInputs[
                            platform.id
                          ] ?? ""
                        }
                        disabled={
                          !allOpeningsSaved ||
                          savingClosing
                        }
                        placeholder={
                          allOpeningsSaved
                            ? "0.00"
                            : "Wait"
                        }
                        onChange={(value) => {
                          setClosingInputs(
                            (previous) => ({
                              ...previous,
                              [platform.id]:
                                value,
                            })
                          );

                          setMessage("");
                        }}
                      />
                    )}

                    <div style={outputBoxStyle}>
                      {money(
                        platform.output
                      )}
                    </div>
                  </div>
                )
              )}

              {/* NO TOTAL INCOME ROW */}

              <div style={platformActionsStyle}>
                {!allOpeningsSaved ? (
                  <button
                    type="button"
                    onClick={
                      saveOpeningReadings
                    }
                    disabled={
                      savingOpening
                    }
                    style={greenActionStyle}
                  >
                    {savingOpening
                      ? "Saving Opening..."
                      : `Save Opening Readings (${savedOpeningCount}/${platforms.length})`}
                  </button>
                ) : (
                  <div style={completeStyle}>
                    Opening Readings Saved ✓
                  </div>
                )}

                {allOpeningsSaved &&
                  !allClosingsSaved && (
                    <button
                      type="button"
                      onClick={
                        saveClosingReadings
                      }
                      disabled={
                        savingClosing
                      }
                      style={blueActionStyle}
                    >
                      {savingClosing
                        ? "Saving Closing..."
                        : `Save Closing Readings (${savedClosingCount}/${platforms.length})`}
                    </button>
                  )}

                {allClosingsSaved && (
                  <div style={completeStyle}>
                    Closing Readings Saved ✓
                  </div>
                )}
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

                <div>
                  DESCRIPTION
                </div>

                <div>
                  AMOUNT (KES)
                </div>
              </div>

              {expenseSlots.map(
                (expense, index) => (
                  <div
                    key={`expense-${index}`}
                    style={expenseRowStyle}
                  >
                    <div
                      style={{
                        textAlign:
                          "center",
                      }}
                    >
                      {index + 1}
                    </div>

                    <div style={expenseBoxStyle}>
                      {expense?.description ||
                        ""}
                    </div>

                    <div
                      style={{
                        ...expenseBoxStyle,
                        textAlign:
                          "right",
                      }}
                    >
                      {money(
                        expense?.amount ||
                          0
                      )}
                    </div>
                  </div>
                )
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
            </section>
          </div>

          {/* ======================================
              SUMMARY — ONLY 3 FIGURES
          ====================================== */}

          <div style={summaryGridStyle}>
            <SummaryBox
              title="TOTAL SALES"
              amount={totalSales}
              tone="blue"
              icon="▥"
            />

            <SummaryBox
              title="TOTAL EXPENSES"
              amount={
                totalExpenses
              }
              tone="red"
              icon="▣"
            />

            <SummaryBox
              title="CLOSING BALANCE"
              amount={
                closingBalance
              }
              tone="navy"
              icon="●"
            />
          </div>

          {/* LOWER SECTIONS */}

          <div style={lowerPlaceholderStyle}>
            <div>
              <strong>
                SAVINGS / BANKING
              </strong>

              <div style={placeholderTextStyle}>
                Will be connected next.
              </div>
            </div>

            <div>
              <strong>
                MANAGEMENT STATUS
              </strong>

              <div style={placeholderTextStyle}>
                Will be connected next.
              </div>
            </div>

            <div>
              <strong>
                ACCOUNTS INFORMATION
              </strong>

              <div style={placeholderTextStyle}>
                Will be connected next.
              </div>
            </div>
          </div>

          <div style={closePreviewStyle}>
            ✓ CLOSE SHIFT & HAND OVER
          </div>
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
  active = false,
}) {
  return (
    <div
      style={{
        padding: "18px",
        display: "flex",
        alignItems: "center",
        gap: "14px",

        backgroundColor:
          active
            ? "#1687ee"
            : "transparent",

        color: "white",

        fontWeight:
          active
            ? "bold"
            : "normal",

        borderBottom:
          "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <span
        style={{
          width: "25px",
          textAlign: "center",
          fontSize: "20px",
        }}
      >
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
      <div
        style={{
          fontSize: "30px",
          fontWeight: "900",
          lineHeight: 1,
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontSize: "17px",
          fontWeight: "bold",
          marginTop: "5px",
        }}
      >
        {subtitle}
      </div>

      <div
        style={{
          marginTop: "7px",
          backgroundColor:
            "#0876bd",
          display: "inline-block",
          borderRadius: "10px",
          padding: "3px 18px",
          fontSize: "11px",
        }}
      >
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
      ? "linear-gradient(135deg,#078314,#0dad28)"
      : tone === "red"
      ? "linear-gradient(135deg,#a50707,#d21414)"
      : tone === "brown"
      ? "linear-gradient(135deg,#7b3a05,#a75b12)"
      : "linear-gradient(135deg,#064a82,#087cc4)";

  return (
    <div
      style={{
        background,
        color: "white",
        borderRadius: "8px",
        padding: "12px 14px",
        minHeight: "78px",
        display: "flex",
        flexDirection: "column",
        justifyContent:
          "center",
      }}
    >
      <div
        style={{
          fontSize: "12px",
          fontWeight: "bold",
          textAlign: "center",
          marginBottom: "9px",
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontSize: "17px",
          fontWeight: "bold",
          textAlign: "center",
        }}
      >
        {value}
      </div>

      {subvalue && (
        <div
          style={{
            textAlign: "center",
            fontSize: "10px",
            marginTop: "4px",
          }}
        >
          {subvalue}
        </div>
      )}
    </div>
  );
}

function PanelTitle({
  title,
  tone,
}) {
  const background =
    tone === "green"
      ? "#087c33"
      : tone === "red"
      ? "#b60000"
      : "#0873b9";

  return (
    <div
      style={{
        background,
        color: "white",
        padding: "9px 12px",
        fontSize: "16px",
        fontWeight: "bold",
      }}
    >
      {title}
    </div>
  );
}

function IncomeRow({
  label,
  amount,
}) {
  return (
    <div style={incomeRowStyle}>
      <div>
        {label}
      </div>

      <div style={amountBoxStyle}>
        {money(amount)}
      </div>
    </div>
  );
}

function ReadingInput({
  value,
  onChange,
  disabled,
  placeholder = "0.00",
}) {
  return (
    <input
      type="number"
      min="0"
      step="0.01"
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(event) =>
        onChange(
          event.target.value
        )
      }
      style={{
        width: "100%",
        boxSizing: "border-box",
        border:
          "1px solid #94a3b8",
        borderRadius: "4px",
        padding: "7px",
        textAlign: "right",
        backgroundColor:
          disabled
            ? "#e5e7eb"
            : "white",
        fontSize: "12px",
      }}
    />
  );
}

function SavedReadingBox({
  value,
}) {
  return (
    <div
      style={{
        ...readingBoxStyle,
        backgroundColor:
          "#ecfdf5",
        border:
          "1px solid #86efac",
      }}
    >
      {money(value)}
    </div>
  );
}

function SummaryBox({
  title,
  amount,
  tone,
  icon,
}) {
  const background =
    tone === "red"
      ? "linear-gradient(135deg,#ef1f37,#ff4a59)"
      : tone === "green"
      ? "linear-gradient(135deg,#078c21,#14ac2c)"
      : tone === "navy"
      ? "linear-gradient(135deg,#07406f,#086193)"
      : "linear-gradient(135deg,#0879d8,#1796f6)";

  return (
    <div
      style={{
        background,
        color: "white",
        borderRadius: "7px",
        padding: "13px",
        display: "grid",
        gridTemplateColumns:
          "55px 1fr",
        alignItems: "center",
        gap: "10px",
      }}
    >
      <div
        style={{
          fontSize: "40px",
          textAlign: "center",
          fontWeight: "bold",
        }}
      >
        {icon}
      </div>

      <div>
        <div
          style={{
            fontWeight: "bold",
            textAlign: "center",
            marginBottom: "8px",
          }}
        >
          {title}
        </div>

        <div
          style={{
            backgroundColor: "white",
            color: "#111827",
            borderRadius: "5px",
            padding: "9px",
            fontSize: "21px",
            fontWeight: "900",
            textAlign: "center",
          }}
        >
          KES {money(amount)}
        </div>
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
    apikey: anonKey,
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

function money(value) {
  return Number(
    value || 0
  ).toLocaleString(
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
      day: "2-digit",
      month: "short",
      year: "numeric",
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
      weekday: "long",
    }
  ).format(
    new Date(value)
  );
}

function displayTime(value) {
  if (!value) {
    return "";
  }

  return String(value)
    .split(".")[0]
    .slice(0, 5);
}

// ==================================================
// STYLES
// ==================================================

const pageStyle = {
  minHeight: "100vh",
  backgroundColor: "#edf2f7",
  fontFamily:
    "Arial, Helvetica, sans-serif",
};

const loadingStyle = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily:
    "Arial, sans-serif",
};

const topHeaderStyle = {
  minHeight: "74px",
  background:
    "linear-gradient(90deg,#052d4b,#063c63)",
  color: "white",
  display: "flex",
  justifyContent:
    "space-between",
  alignItems: "center",
  padding: "10px 22px",
  boxSizing: "border-box",
};

const brandWrapStyle = {
  display: "flex",
  alignItems: "center",
  gap: "13px",
};

const crownStyle = {
  fontSize: "49px",
  lineHeight: 1,
};

const brandStyle = {
  fontSize: "31px",
  fontWeight: "900",
  letterSpacing: "1px",
};

const taglineStyle = {
  fontSize: "11px",
  letterSpacing: "4px",
  marginTop: "3px",
};

const headerRightStyle = {
  display: "flex",
  alignItems: "center",
  gap: "18px",
  textAlign: "right",
  fontSize: "13px",
};

const headerShopStyle = {
  marginTop: "5px",
};

const logoutButtonStyle = {
  backgroundColor:
    "transparent",
  color: "white",
  border:
    "1px solid rgba(255,255,255,0.45)",
  padding: "9px 15px",
  borderRadius: "7px",
  fontWeight: "bold",
  cursor: "pointer",
};

const bodyStyle = {
  display: "flex",
  minHeight:
    "calc(100vh - 74px)",
};

const sidebarStyle = {
  width: "190px",
  flexShrink: 0,
  background:
    "linear-gradient(180deg,#083b60,#062b47)",
};

const mainStyle = {
  flex: 1,
  padding: "12px",
  minWidth: 0,
};

const topGridStyle = {
  display: "grid",
  gridTemplateColumns:
    "2.2fr 1fr 1fr 1fr 1fr 1fr",
  gap: "7px",
  marginBottom: "12px",
};

const shopCardStyle = {
  background:
    "linear-gradient(135deg,#064777,#075e97)",
  color: "white",
  borderRadius: "8px",
  padding: "13px",
  textAlign: "center",
  minHeight: "78px",
};

const reportGridStyle = {
  display: "grid",
  gridTemplateColumns:
    "1fr 1.18fr 1.08fr",
  gap: "12px",
  alignItems: "start",
};

const panelStyle = {
  backgroundColor: "white",
  borderRadius: "6px",
  overflow: "hidden",
  boxShadow:
    "0 1px 5px rgba(0,0,0,0.12)",
};

const tableHeaderStyle = {
  display: "grid",
  gridTemplateColumns:
    "1.6fr 1fr",
  gap: "8px",
  padding: "10px 12px",
  backgroundColor: "#eef4f8",
  fontSize: "12px",
  fontWeight: "bold",
};

const incomeRowStyle = {
  display: "grid",
  gridTemplateColumns:
    "1.6fr 1fr",
  gap: "8px",
  alignItems: "center",
  padding: "5px 12px",
  borderTop:
    "1px solid #e1e7ec",
  fontSize: "12px",
};

const amountBoxStyle = {
  border:
    "1px solid #cbd5e1",
  borderRadius: "4px",
  backgroundColor: "#fafafa",
  padding: "7px 9px",
  textAlign: "right",
};

const incomeTotalStyle = {
  display: "flex",
  justifyContent:
    "space-between",
  padding: "12px",
  backgroundColor: "#dcfce7",
  borderTop:
    "1px solid #bbf7d0",
  fontSize: "13px",
};

const platformStatusStyle = {
  display: "flex",
  justifyContent:
    "space-between",
  padding: "7px 10px",
  backgroundColor: "#f8fafc",
  color: "#475569",
  fontSize: "11px",
};

const platformHeaderStyle = {
  display: "grid",
  gridTemplateColumns:
    "1.25fr 1fr 1fr 1fr",
  textAlign: "center",
  backgroundColor: "#eaf6ef",
  padding: "9px 8px",
  fontSize: "11px",
  fontWeight: "bold",
};

const platformRowStyle = {
  display: "grid",
  gridTemplateColumns:
    "1.25fr 1fr 1fr 1fr",
  gap: "7px",
  alignItems: "center",
  padding: "5px 8px",
  borderTop:
    "1px solid #e1e7ec",
  fontSize: "12px",
};

const savedTextStyle = {
  color: "#15803d",
  fontSize: "9px",
  marginTop: "2px",
};

const readingBoxStyle = {
  border:
    "1px solid #d1d5db",
  borderRadius: "4px",
  padding: "7px",
  backgroundColor: "#f9fafb",
  textAlign: "right",
};

const outputBoxStyle = {
  borderRadius: "4px",
  padding: "7px",
  backgroundColor: "#f1f5f9",
  textAlign: "right",
  fontWeight: "bold",
};

const platformActionsStyle = {
  padding: "9px",
  display: "grid",
  gap: "7px",
};

const greenActionStyle = {
  width: "100%",
  padding: "9px",
  border: "none",
  borderRadius: "5px",
  backgroundColor: "#07912a",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
};

const blueActionStyle = {
  width: "100%",
  padding: "9px",
  border: "none",
  borderRadius: "5px",
  backgroundColor: "#0873b9",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
};

const completeStyle = {
  textAlign: "center",
  padding: "8px",
  borderRadius: "5px",
  backgroundColor: "#ecfdf5",
  color: "#166534",
  fontSize: "11px",
  fontWeight: "bold",
};

const expenseHeaderStyle = {
  display: "grid",
  gridTemplateColumns:
    "40px 1.5fr 1fr",
  gap: "7px",
  padding: "9px",
  backgroundColor: "#fff0f0",
  textAlign: "center",
  fontSize: "11px",
  fontWeight: "bold",
};

const expenseRowStyle = {
  display: "grid",
  gridTemplateColumns:
    "40px 1.5fr 1fr",
  gap: "7px",
  alignItems: "center",
  padding: "4px 8px",
  borderTop:
    "1px solid #ececec",
  fontSize: "12px",
};

const expenseBoxStyle = {
  border:
    "1px solid #d1d5db",
  borderRadius: "4px",
  minHeight: "16px",
  padding: "6px 8px",
  backgroundColor: "#fff",
};

const expenseTotalStyle = {
  display: "flex",
  justifyContent:
    "space-between",
  padding: "11px 12px",
  backgroundColor: "#c50000",
  color: "white",
  fontSize: "13px",
};

const summaryGridStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(3,1fr)",
  gap: "10px",
  marginTop: "12px",
};

const lowerPlaceholderStyle = {
  display: "grid",
  gridTemplateColumns:
    "1fr 1.25fr 1fr",
  gap: "12px",
  marginTop: "12px",
};

const placeholderTextStyle = {
  marginTop: "9px",
  color: "#64748b",
  fontSize: "12px",
};

const closePreviewStyle = {
  marginTop: "12px",
  padding: "15px",
  backgroundColor: "#07912a",
  color: "white",
  fontSize: "18px",
  fontWeight: "bold",
  textAlign: "center",
  borderRadius: "8px",
};

const messageStyle = {
  padding: "10px 13px",
  marginBottom: "10px",
  borderRadius: "6px",
  fontSize: "12px",
};
