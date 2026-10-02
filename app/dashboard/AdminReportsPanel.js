"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

export default function AdminReportsPanel({
  user,
}) {
  const [shops, setShops] = useState([]);
  const [shifts, setShifts] = useState([]);

  const [selectedShopId, setSelectedShopId] =
    useState("");

  const [
    selectedBusinessDate,
    setSelectedBusinessDate,
  ] = useState("");

  const [
    selectedShiftId,
    setSelectedShiftId,
  ] = useState("");

  const [report, setReport] = useState(null);

  const [loadingShops, setLoadingShops] =
    useState(false);

  const [loadingShifts, setLoadingShifts] =
    useState(false);

  const [loadingReport, setLoadingReport] =
    useState(false);

  const [message, setMessage] = useState("");

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const accessToken =
    user?.access_token || null;

  // ==================================================
  // HEADERS
  // ==================================================

  const authHeaders =
    useMemo(() => {
      return {
        apikey:
          supabaseAnonKey,

        Authorization:
          `Bearer ${accessToken}`,

        "Content-Type":
          "application/json",
      };
    }, [
      supabaseAnonKey,
      accessToken,
    ]);

  // ==================================================
  // SELECTED SHOP
  // ==================================================

  const selectedShop =
    useMemo(() => {
      return (
        shops.find(
          (shop) =>
            String(shop.id) ===
            String(selectedShopId)
        ) || null
      );
    }, [
      shops,
      selectedShopId,
    ]);

  // ==================================================
  // AVAILABLE BUSINESS DATES
  // ==================================================

  const businessDates =
    useMemo(() => {
      const dates = [
        ...new Set(
          shifts
            .map(
              (shift) =>
                shift.business_date
            )
            .filter(Boolean)
        ),
      ];

      return dates.sort(
        (a, b) =>
          String(b).localeCompare(
            String(a)
          )
      );
    }, [shifts]);

  // ==================================================
  // SHIFTS FOR SELECTED DATE
  // ==================================================

  const dateShifts =
    useMemo(() => {
      if (!selectedBusinessDate) {
        return [];
      }

      return shifts.filter(
        (shift) =>
          String(
            shift.business_date ||
              ""
          ) ===
          String(
            selectedBusinessDate
          )
      );
    }, [
      shifts,
      selectedBusinessDate,
    ]);

  // ==================================================
  // LOAD SHOPS
  // ==================================================

  const loadShops =
    useCallback(
      async () => {
        if (
          !supabaseUrl ||
          !supabaseAnonKey ||
          !accessToken
        ) {
          setMessage(
            "Database or login information is missing."
          );

          return;
        }

        try {
          setLoadingShops(true);
          setMessage("");

          const response =
            await fetch(
              `${supabaseUrl}/rest/v1/shops` +
                `?select=id,shop_name,shop_type,is_active,timezone` +
                `&is_active=eq.true` +
                `&order=shop_name.asc`,
              {
                method: "GET",

                headers:
                  authHeaders,

                cache:
                  "no-store",
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
                "Unable to load shops."
            );
          }

          const loaded =
            Array.isArray(result)
              ? result
              : [];

          setShops(loaded);

          if (
            loaded.length > 0
          ) {
            setSelectedShopId(
              (current) => {
                const stillExists =
                  loaded.some(
                    (shop) =>
                      String(
                        shop.id
                      ) ===
                      String(
                        current
                      )
                  );

                if (stillExists) {
                  return current;
                }

                return loaded[0].id;
              }
            );
          } else {
            setSelectedShopId(
              ""
            );
          }
        } catch (error) {
          console.error(
            "LOAD ADMIN REPORT SHOPS ERROR:",
            error
          );

          setMessage(
            error?.message ||
              "Unable to load shops."
          );
        } finally {
          setLoadingShops(false);
        }
      },
      [
        supabaseUrl,
        supabaseAnonKey,
        accessToken,
        authHeaders,
      ]
    );

  // ==================================================
  // LOAD SHIFTS
  // ==================================================

  const loadShifts =
    useCallback(
      async () => {
        if (
          !selectedShopId ||
          !supabaseUrl ||
          !supabaseAnonKey ||
          !accessToken
        ) {
          setShifts([]);
          setSelectedBusinessDate("");
          setSelectedShiftId("");
          setReport(null);

          return;
        }

        try {
          setLoadingShifts(true);
          setMessage("");

          const response =
            await fetch(
              `${supabaseUrl}/rest/v1/shifts` +
                `?shop_id=eq.${encodeURIComponent(
                  selectedShopId
                )}` +
                `&select=` +
                `id,shop_id,cashier_id,cashier_name,shift_name,` +
                `business_date,scheduled_start,scheduled_end,` +
                `opened_at,closed_at,status,opening_balance,` +
                `total_added_float,total_output,total_expenses,` +
                `net_income,closing_balance,notes,` +
                `admin_manual_totals,admin_override_note,` +
                `admin_override_at,admin_override_by` +
                `&order=business_date.desc,opened_at.desc` +
                `&limit=300`,
              {
                method: "GET",

                headers:
                  authHeaders,

                cache:
                  "no-store",
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
                "Unable to load shifts."
            );
          }

          const loaded =
            Array.isArray(result)
              ? result
              : [];

          setShifts(loaded);

          if (
            loaded.length === 0
          ) {
            setSelectedBusinessDate(
              ""
            );

            setSelectedShiftId(
              ""
            );

            setReport(null);
          }
        } catch (error) {
          console.error(
            "LOAD ADMIN REPORT SHIFTS ERROR:",
            error
          );

          setMessage(
            error?.message ||
              "Unable to load shifts."
          );
        } finally {
          setLoadingShifts(false);
        }
      },
      [
        selectedShopId,
        supabaseUrl,
        supabaseAnonKey,
        accessToken,
        authHeaders,
      ]
    );

  // ==================================================
  // LOAD FULL REPORT
  // ==================================================

  const loadReport =
    useCallback(
      async () => {
        if (
          !selectedShiftId ||
          !selectedShopId ||
          !supabaseUrl ||
          !supabaseAnonKey ||
          !accessToken
        ) {
          setReport(null);
          return;
        }

        try {
          setLoadingReport(true);
          setMessage("");

          const shiftResponse =
            await fetch(
              `${supabaseUrl}/rest/v1/shifts` +
                `?id=eq.${encodeURIComponent(
                  selectedShiftId
                )}` +
                `&select=*` +
                `&limit=1`,
              {
                method: "GET",

                headers:
                  authHeaders,

                cache:
                  "no-store",
              }
            );

          const [
            shiftResult,
            platformResult,
            readingResult,
            floatResult,
            expenseResult,
            savingsResult,
          ] =
            await Promise.all([
              safeJson(
                shiftResponse
              ),

              fetch(
                `${supabaseUrl}/rest/v1/shop_platforms` +
                  `?shop_id=eq.${encodeURIComponent(
                    selectedShopId
                  )}` +
                  `&select=id,shop_id,platform_name,reading_type,display_order,is_active` +
                  `&order=display_order.asc`,
                {
                  method: "GET",

                  headers:
                    authHeaders,

                  cache:
                    "no-store",
                }
              ).then(
                safeJson
              ),

              fetch(
                `${supabaseUrl}/rest/v1/platform_readings` +
                  `?shift_id=eq.${encodeURIComponent(
                    selectedShiftId
                  )}` +
                  `&reading_kind=in.(OPENING,CLOSING)` +
                  `&select=id,shift_id,platform_id,reading_kind,reading_value,recorded_at,recorded_by` +
                  `&order=recorded_at.asc`,
                {
                  method: "GET",

                  headers:
                    authHeaders,

                  cache:
                    "no-store",
                }
              ).then(
                safeJson
              ),

              fetch(
                `${supabaseUrl}/rest/v1/shift_income_entries` +
                  `?shift_id=eq.${encodeURIComponent(
                    selectedShiftId
                  )}` +
                  `&entry_type=in.(COMPANY_FLOAT,MSHWARI_FLOAT)` +
                  `&select=id,shift_id,entry_type,description,amount,created_at` +
                  `&order=created_at.asc`,
                {
                  method: "GET",

                  headers:
                    authHeaders,

                  cache:
                    "no-store",
                }
              ).then(
                safeJson
              ),

              fetch(
                `${supabaseUrl}/rest/v1/expenses` +
                  `?shift_id=eq.${encodeURIComponent(
                    selectedShiftId
                  )}` +
                  `&select=id,shift_id,description,amount,created_at,created_by` +
                  `&order=created_at.asc`,
                {
                  method: "GET",

                  headers:
                    authHeaders,

                  cache:
                    "no-store",
                }
              ).then(
                safeJson
              ),

              fetch(
                `${supabaseUrl}/rest/v1/shift_savings` +
                  `?shift_id=eq.${encodeURIComponent(
                    selectedShiftId
                  )}` +
                  `&select=id,shift_id,description,amount,payment_status,created_at` +
                  `&order=created_at.asc`,
                {
                  method: "GET",

                  headers:
                    authHeaders,

                  cache:
                    "no-store",
                }
              ).then(
                safeJson
              ),
            ]);

          if (
            !shiftResponse.ok
          ) {
            throw new Error(
              shiftResult?.message ||
                shiftResult?.details ||
                "Unable to load selected shift."
            );
          }

          if (
            !Array.isArray(
              shiftResult
            ) ||
            shiftResult.length ===
              0
          ) {
            throw new Error(
              "Selected shift could not be found."
            );
          }

          const shift =
            shiftResult[0];

          const platforms =
            Array.isArray(
              platformResult
            )
              ? platformResult
              : [];

          const readings =
            Array.isArray(
              readingResult
            )
              ? readingResult
              : [];

          const floats =
            Array.isArray(
              floatResult
            )
              ? floatResult
              : [];

          const expenses =
            Array.isArray(
              expenseResult
            )
              ? expenseResult
              : [];

          const savings =
            Array.isArray(
              savingsResult
            )
              ? savingsResult
              : [];

          // ========================================
          // LATEST READING FOR EACH PLATFORM/KIND
          // ========================================

          const readingMap = {};

          for (
            const reading
            of readings
          ) {
            const key =
              `${reading.platform_id}-${reading.reading_kind}`;

            const existing =
              readingMap[key];

            if (!existing) {
              readingMap[key] =
                reading;

              continue;
            }

            const existingTime =
              new Date(
                existing.recorded_at ||
                  0
              ).getTime();

            const currentTime =
              new Date(
                reading.recorded_at ||
                  0
              ).getTime();

            if (
              currentTime >=
              existingTime
            ) {
              readingMap[key] =
                reading;
            }
          }

          // ========================================
          // PLATFORM REPORT ROWS
          // ========================================

          const platformRows =
            platforms.map(
              (platform) => {
                const opening =
                  readingMap[
                    `${platform.id}-OPENING`
                  ] || null;

                const closing =
                  readingMap[
                    `${platform.id}-CLOSING`
                  ] || null;

                const output =
                  opening &&
                  closing
                    ? roundMoney(
                        Number(
                          closing.reading_value ||
                            0
                        ) -
                          Number(
                            opening.reading_value ||
                              0
                          )
                      )
                    : null;

                return {
                  ...platform,

                  opening,
                  closing,
                  output,
                };
              }
            );

          // ========================================
          // FLOAT GROUPS
          // ========================================

          const companyFloats =
            floats.filter(
              (entry) =>
                entry.entry_type ===
                "COMPANY_FLOAT"
            );

          const mshwariFloats =
            floats.filter(
              (entry) =>
                entry.entry_type ===
                "MSHWARI_FLOAT"
            );

          // ========================================
          // SAVINGS TOTALS
          // ========================================

          let totalSavings = 0;
          let paidSavings = 0;
          let pendingSavings = 0;

          for (
            const saving
            of savings
          ) {
            const amount =
              Number(
                saving.amount || 0
              );

            totalSavings += amount;

            if (
              String(
                saving.payment_status ||
                  ""
              ).toUpperCase() ===
              "PAID"
            ) {
              paidSavings += amount;
            } else {
              pendingSavings += amount;
            }
          }

          setReport({
            shift,

            platformRows,

            companyFloats,

            mshwariFloats,

            expenses,

            savings,

            totalSavings:
              roundMoney(
                totalSavings
              ),

            paidSavings:
              roundMoney(
                paidSavings
              ),

            pendingSavings:
              roundMoney(
                pendingSavings
              ),
          });
        } catch (error) {
          console.error(
            "LOAD ADMIN FULL REPORT ERROR:",
            error
          );

          setMessage(
            error?.message ||
              "Unable to load report."
          );

          setReport(null);
        } finally {
          setLoadingReport(false);
        }
      },
      [
        selectedShiftId,
        selectedShopId,
        supabaseUrl,
        supabaseAnonKey,
        accessToken,
        authHeaders,
      ]
    );

  // ==================================================
  // INITIAL LOAD
  // ==================================================

  useEffect(() => {
    loadShops();
  }, [loadShops]);

  // ==================================================
  // SHOP CHANGED
  // ==================================================

  useEffect(() => {
    setSelectedBusinessDate("");
    setSelectedShiftId("");
    setReport(null);

    loadShifts();
  }, [
    selectedShopId,
    loadShifts,
  ]);

  // ==================================================
  // CHOOSE LATEST BUSINESS DATE
  // ==================================================

  useEffect(() => {
    if (
      businessDates.length === 0
    ) {
      setSelectedBusinessDate("");
      return;
    }

    setSelectedBusinessDate(
      (current) => {
        if (
          businessDates.includes(
            current
          )
        ) {
          return current;
        }

        return businessDates[0];
      }
    );
  }, [businessDates]);

  // ==================================================
  // CHOOSE LATEST SHIFT FOR DATE
  // ==================================================

  useEffect(() => {
    if (
      dateShifts.length === 0
    ) {
      setSelectedShiftId("");
      setReport(null);
      return;
    }

    setSelectedShiftId(
      (current) => {
        const exists =
          dateShifts.some(
            (shift) =>
              String(
                shift.id
              ) ===
              String(
                current
              )
          );

        if (exists) {
          return current;
        }

        return dateShifts[0].id;
      }
    );
  }, [dateShifts]);

  // ==================================================
  // LOAD REPORT WHEN SHIFT CHANGES
  // ==================================================

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  // ==================================================
  // DISPLAY
  // ==================================================

  return (
    <section style={pageStyle}>
      <div style={titleBarStyle}>
        VIEW REPORTS
      </div>

      <div style={filterWrapStyle}>
        <div style={filterFieldStyle}>
          <label style={labelStyle}>
            SHOP
          </label>

          <select
            value={
              selectedShopId
            }
            disabled={
              loadingShops
            }
            onChange={(event) =>
              setSelectedShopId(
                event.target.value
              )
            }
            style={selectStyle}
          >
            {shops.length ===
              0 && (
              <option value="">
                No shops available
              </option>
            )}

            {shops.map(
              (shop) => (
                <option
                  key={shop.id}
                  value={shop.id}
                >
                  {shop.shop_name}
                  {shop.shop_type
                    ? ` (${shop.shop_type})`
                    : ""}
                </option>
              )
            )}
          </select>
        </div>

        <div style={filterFieldStyle}>
          <label style={labelStyle}>
            BUSINESS DATE
          </label>

          <select
            value={
              selectedBusinessDate
            }
            disabled={
              loadingShifts ||
              businessDates.length ===
                0
            }
            onChange={(event) =>
              setSelectedBusinessDate(
                event.target.value
              )
            }
            style={selectStyle}
          >
            {businessDates.length ===
              0 && (
              <option value="">
                No reports
              </option>
            )}

            {businessDates.map(
              (date) => (
                <option
                  key={date}
                  value={date}
                >
                  {formatBusinessDate(
                    date
                  )}
                </option>
              )
            )}
          </select>
        </div>

        <div style={filterFieldStyle}>
          <label style={labelStyle}>
            SHIFT
          </label>

          <select
            value={
              selectedShiftId
            }
            disabled={
              loadingShifts ||
              dateShifts.length ===
                0
            }
            onChange={(event) =>
              setSelectedShiftId(
                event.target.value
              )
            }
            style={selectStyle}
          >
            {dateShifts.length ===
              0 && (
              <option value="">
                No shifts
              </option>
            )}

            {dateShifts.map(
              (shift) => (
                <option
                  key={shift.id}
                  value={shift.id}
                >
                  {shift.shift_name ||
                    "SHIFT"}{" "}
                  |{" "}
                  {shift.status ||
                    "-"}{" "}
                  |{" "}
                  {shift.cashier_name ||
                    "Cashier"}{" "}
                  |{" "}
                  {formatTime(
                    shift.opened_at
                  )}
                </option>
              )
            )}
          </select>
        </div>

        <button
          type="button"
          onClick={
            loadReport
          }
          disabled={
            loadingReport ||
            !selectedShiftId
          }
          style={refreshButtonStyle}
        >
          {loadingReport
            ? "LOADING..."
            : "REFRESH REPORT"}
        </button>
      </div>

      {message && (
        <div style={errorStyle}>
          {message}
        </div>
      )}

      {loadingReport && (
        <div style={loadingStyle}>
          Loading report...
        </div>
      )}

      {!loadingReport &&
        !report &&
        !message && (
          <div style={emptyStyle}>
            Select a shop, business date and shift
            to view its report.
          </div>
        )}

      {!loadingReport &&
        report && (
          <ReportDisplay
            shop={
              selectedShop
            }
            report={
              report
            }
          />
        )}
    </section>
  );
}

// ==================================================
// REPORT DISPLAY
// ==================================================

function ReportDisplay({
  shop,
  report,
}) {
  const {
    shift,
    platformRows,
    companyFloats,
    mshwariFloats,
    expenses,
    savings,
    totalSavings,
    paidSavings,
    pendingSavings,
  } = report;

  const totalSales =
    roundMoney(
      Number(
        shift.opening_balance ||
          0
      ) +
        Number(
          shift.total_added_float ||
            0
        ) +
        Number(
          shift.total_output ||
            0
        )
    );

  return (
    <div style={reportStyle}>
      {/* ======================================= */}
      {/* REPORT HEADER */}
      {/* ======================================= */}

      <div style={reportHeaderStyle}>
        <div style={shopCardStyle}>
          <strong style={bigTextStyle}>
            {shop?.shop_name ||
              "Shop"}
          </strong>

          <span>
            DAILY SALES REPORT
          </span>

          <small>
            {shop?.shop_type ||
              ""}
          </small>
        </div>

        <InfoCard
          label="CASHIER"
          value={
            shift.cashier_name ||
            "-"
          }
        />

        <InfoCard
          label="BUSINESS DATE"
          value={formatBusinessDate(
            shift.business_date
          )}
        />

        <InfoCard
          label="SHIFT"
          value={
            shift.shift_name ||
            "-"
          }
        />

        <InfoCard
          label="STATUS"
          value={
            shift.status ||
            "-"
          }
        />
      </div>

      <div style={timeGridStyle}>
        <InfoLine
          label="Opened"
          value={formatDateTime(
            shift.opened_at
          )}
        />

        <InfoLine
          label="Closed"
          value={
            shift.closed_at
              ? formatDateTime(
                  shift.closed_at
                )
              : "Still Open"
          }
        />

        <InfoLine
          label="Scheduled"
          value={`${formatStoredTime(
            shift.scheduled_start
          )} - ${formatStoredTime(
            shift.scheduled_end
          )}`}
        />

        <InfoLine
          label="Calculation Mode"
          value={
            shift.admin_manual_totals
              ? "ADMIN MANUAL"
              : "AUTOMATIC"
          }
        />
      </div>

      {shift.admin_manual_totals && (
        <div style={manualBannerStyle}>
          This report contains Admin manual totals.
        </div>
      )}

      {/* ======================================= */}
      {/* SUMMARY */}
      {/* ======================================= */}

      <div style={summaryGridStyle}>
        <SummaryCard
          label="TOTAL SALES"
          value={
            totalSales
          }
          background="#0891b2"
        />

        <SummaryCard
          label="TOTAL EXPENSES"
          value={
            shift.total_expenses
          }
          background="#be123c"
        />

        <SummaryCard
          label="NET INCOME"
          value={
            shift.net_income
          }
          background="#7c3aed"
        />

        <SummaryCard
          label="CLOSING BALANCE"
          value={
            shift.closing_balance
          }
          background="#0369a1"
        />
      </div>

      {/* ======================================= */}
      {/* INCOME + PLATFORM */}
      {/* ======================================= */}

      <div style={twoColumnStyle}>
        <div style={sectionStyle}>
          <SectionTitle
            background="#0891b2"
          >
            INCOME STATEMENT
          </SectionTitle>

          <MoneyRow
            label="Balance B/F"
            value={
              shift.opening_balance
            }
          />

          {Array.from(
            { length: 3 },
            (_, index) => (
              <MoneyRow
                key={`company-${index}`}
                label={`Added Float ${
                  index + 1
                } From Company`}
                value={
                  companyFloats[
                    index
                  ]?.amount || 0
                }
              />
            )
          )}

          {Array.from(
            { length: 3 },
            (_, index) => (
              <MoneyRow
                key={`mshwari-${index}`}
                label={`Added Float ${
                  index + 1
                } From M-Shwari`}
                value={
                  mshwariFloats[
                    index
                  ]?.amount || 0
                }
              />
            )
          )}

          <MoneyRow
            label="TOTAL ADDED"
            value={
              Number(
                shift.opening_balance ||
                  0
              ) +
              Number(
                shift.total_added_float ||
                  0
              )
            }
            strong
          />
        </div>

        <div style={sectionStyle}>
          <SectionTitle
            background="#15803d"
          >
            PLATFORM SALES
          </SectionTitle>

          <div style={platformHeaderStyle}>
            <div>
              PLATFORM
            </div>

            <div>
              OPENING
            </div>

            <div>
              CLOSING
            </div>

            <div>
              SALES
            </div>
          </div>

          {platformRows.map(
            (platform) => (
              <div
                key={platform.id}
                style={platformRowStyle}
              >
                <strong>
                  {
                    platform.platform_name
                  }
                </strong>

                <span>
                  {platform.opening
                    ? money(
                        platform
                          .opening
                          .reading_value
                      )
                    : "-"}
                </span>

                <span>
                  {platform.closing
                    ? money(
                        platform
                          .closing
                          .reading_value
                      )
                    : "-"}
                </span>

                <strong>
                  {platform.output ===
                  null
                    ? "-"
                    : money(
                        platform.output
                      )}
                </strong>
              </div>
            )
          )}

          <MoneyRow
            label="TOTAL PLATFORM OUTPUT"
            value={
              shift.total_output
            }
            strong
          />
        </div>
      </div>

      {/* ======================================= */}
      {/* EXPENSES */}
      {/* ======================================= */}

      <div style={sectionStyle}>
        <SectionTitle
          background="#be123c"
        >
          EXPENSES
        </SectionTitle>

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

        {expenses.length ===
          0 && (
          <div style={emptyRowStyle}>
            No expenses recorded.
          </div>
        )}

        {expenses.map(
          (expense, index) => (
            <div
              key={expense.id}
              style={expenseRowStyle}
            >
              <span>
                {index + 1}
              </span>

              <span>
                {expense.description ||
                  "-"}
              </span>

              <strong>
                {money(
                  expense.amount
                )}
              </strong>
            </div>
          )
        )}

        <MoneyRow
          label="TOTAL EXPENSES"
          value={
            shift.total_expenses
          }
          strong
        />
      </div>

      {/* ======================================= */}
      {/* SAVINGS / BANKING */}
      {/* ======================================= */}

      <div style={sectionStyle}>
        <SectionTitle
          background="#0e7490"
        >
          SAVINGS / BANKING
        </SectionTitle>

        <div style={savingsSummaryStyle}>
          <InfoLine
            label="Total Savings"
            value={`KES ${money(
              totalSavings
            )}`}
          />

          <InfoLine
            label="Paid"
            value={`KES ${money(
              paidSavings
            )}`}
          />

          <InfoLine
            label="Pending"
            value={`KES ${money(
              pendingSavings
            )}`}
          />
        </div>

        <div style={savingsHeaderStyle}>
          <div>
            DESCRIPTION
          </div>

          <div>
            AMOUNT
          </div>

          <div>
            STATUS
          </div>
        </div>

        {savings.length ===
          0 && (
          <div style={emptyRowStyle}>
            No Savings / Banking records.
          </div>
        )}

        {savings.map(
          (saving) => (
            <div
              key={saving.id}
              style={savingsRowStyle}
            >
              <span>
                {saving.description ||
                  "-"}
              </span>

              <strong>
                KES{" "}
                {money(
                  saving.amount
                )}
              </strong>

              <span
                style={
                  String(
                    saving.payment_status
                  ).toUpperCase() ===
                  "PAID"
                    ? paidBadgeStyle
                    : pendingBadgeStyle
                }
              >
                {saving.payment_status ||
                  "PENDING"}
              </span>
            </div>
          )
        )}

        <div style={savingsNoticeStyle}>
          Savings / Banking does not reduce Closing Balance.
        </div>
      </div>

      {/* ======================================= */}
      {/* FINAL TOTALS */}
      {/* ======================================= */}

      <div style={finalTotalsStyle}>
        <MoneySummary
          label="BALANCE B/F"
          value={
            shift.opening_balance
          }
        />

        <MoneySummary
          label="ADDED FLOAT"
          value={
            shift.total_added_float
          }
        />

        <MoneySummary
          label="PLATFORM OUTPUT"
          value={
            shift.total_output
          }
        />

        <MoneySummary
          label="EXPENSES"
          value={
            shift.total_expenses
          }
        />

        <MoneySummary
          label="NET INCOME"
          value={
            shift.net_income
          }
        />

        <MoneySummary
          label="CLOSING BALANCE"
          value={
            shift.closing_balance
          }
          strong
        />
      </div>

      {shift.admin_override_note && (
        <div style={adminNoteStyle}>
          <strong>
            Admin Note:
          </strong>{" "}
          {shift.admin_override_note}
        </div>
      )}

      <div style={readOnlyNoticeStyle}>
        READ ONLY REPORT — figures cannot be edited from View Reports.
      </div>
    </div>
  );
}

// ==================================================
// SMALL COMPONENTS
// ==================================================

function InfoCard({
  label,
  value,
}) {
  return (
    <div style={infoCardStyle}>
      <small>
        {label}
      </small>

      <strong>
        {value}
      </strong>
    </div>
  );
}

function InfoLine({
  label,
  value,
}) {
  return (
    <div style={infoLineStyle}>
      <small>
        {label}
      </small>

      <strong>
        {value}
      </strong>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  background,
}) {
  return (
    <div
      style={{
        ...summaryCardStyle,

        borderTop:
          `5px solid ${background}`,
      }}
    >
      <div
        style={{
          ...summaryTitleStyle,

          backgroundColor:
            background,
        }}
      >
        {label}
      </div>

      <strong style={summaryValueStyle}>
        KES{" "}
        {money(value)}
      </strong>
    </div>
  );
}

function SectionTitle({
  children,
  background,
}) {
  return (
    <div
      style={{
        ...sectionTitleStyle,

        backgroundColor:
          background,
      }}
    >
      {children}
    </div>
  );
}

function MoneyRow({
  label,
  value,
  strong = false,
}) {
  return (
    <div
      style={{
        ...moneyRowStyle,

        ...(strong
          ? strongMoneyRowStyle
          : {}),
      }}
    >
      <span>
        {label}
      </span>

      <strong>
        KES{" "}
        {money(value)}
      </strong>
    </div>
  );
}

function MoneySummary({
  label,
  value,
  strong = false,
}) {
  return (
    <div
      style={{
        ...moneySummaryStyle,

        ...(strong
          ? strongSummaryStyle
          : {}),
      }}
    >
      <small>
        {label}
      </small>

      <strong>
        KES{" "}
        {money(value)}
      </strong>
    </div>
  );
}

// ==================================================
// HELPERS
// ==================================================

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
      minimumFractionDigits:
        2,

      maximumFractionDigits:
        2,
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

function formatBusinessDate(
  value
) {
  if (!value) {
    return "-";
  }

  try {
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
      new Date(
        `${value}T12:00:00+03:00`
      )
    );
  } catch {
    return value;
  }
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  try {
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

        hour:
          "2-digit",

        minute:
          "2-digit",
      }
    ).format(
      new Date(value)
    );
  } catch {
    return String(value);
  }
}

function formatTime(value) {
  if (!value) {
    return "-";
  }

  try {
    return new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone:
          "Africa/Nairobi",

        hour:
          "2-digit",

        minute:
          "2-digit",
      }
    ).format(
      new Date(value)
    );
  } catch {
    return "-";
  }
}

function formatStoredTime(
  value
) {
  if (!value) {
    return "-";
  }

  return String(value).slice(
    0,
    5
  );
}

// ==================================================
// STYLES
// ==================================================

const pageStyle = {
  marginTop:
    "20px",

  backgroundColor:
    "#ffffff",

  border:
    "1px solid #cbd5e1",

  borderRadius:
    "8px",

  overflow:
    "hidden",
};

const titleBarStyle = {
  backgroundColor:
    "#0f172a",

  color:
    "white",

  padding:
    "12px 16px",

  fontSize:
    "15px",

  fontWeight:
    "bold",
};

const filterWrapStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "1.2fr 1fr 2fr 0.8fr",

  gap:
    "10px",

  alignItems:
    "end",

  padding:
    "15px",

  backgroundColor:
    "#f8fafc",

  borderBottom:
    "1px solid #e2e8f0",
};

const filterFieldStyle = {
  minWidth:
    0,
};

const labelStyle = {
  display:
    "block",

  marginBottom:
    "5px",

  fontSize:
    "9px",

  fontWeight:
    "bold",

  color:
    "#334155",
};

const selectStyle = {
  width:
    "100%",

  boxSizing:
    "border-box",

  padding:
    "9px",

  border:
    "1px solid #94a3b8",

  borderRadius:
    "5px",

  backgroundColor:
    "white",
};

const refreshButtonStyle = {
  padding:
    "10px",

  border:
    "none",

  borderRadius:
    "5px",

  backgroundColor:
    "#0369a1",

  color:
    "white",

  fontWeight:
    "bold",

  cursor:
    "pointer",
};

const reportStyle = {
  padding:
    "15px",
};

const reportHeaderStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "1.5fr 1fr 1fr 1fr 0.8fr",

  gap:
    "8px",

  marginBottom:
    "10px",
};

const shopCardStyle = {
  backgroundColor:
    "#0e7490",

  color:
    "white",

  minHeight:
    "72px",

  display:
    "flex",

  flexDirection:
    "column",

  alignItems:
    "center",

  justifyContent:
    "center",

  borderRadius:
    "5px",

  textAlign:
    "center",
};

const bigTextStyle = {
  fontSize:
    "20px",
};

const infoCardStyle = {
  minHeight:
    "72px",

  padding:
    "8px",

  backgroundColor:
    "#f1f5f9",

  border:
    "1px solid #cbd5e1",

  borderRadius:
    "5px",

  display:
    "flex",

  flexDirection:
    "column",

  justifyContent:
    "center",

  alignItems:
    "center",

  textAlign:
    "center",

  gap:
    "5px",
};

const timeGridStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "repeat(4,1fr)",

  gap:
    "8px",

  marginBottom:
    "12px",
};

const infoLineStyle = {
  display:
    "flex",

  flexDirection:
    "column",

  gap:
    "3px",

  padding:
    "8px",

  border:
    "1px solid #e2e8f0",

  backgroundColor:
    "#f8fafc",

  borderRadius:
    "4px",
};

const manualBannerStyle = {
  padding:
    "9px",

  marginBottom:
    "12px",

  backgroundColor:
    "#fef3c7",

  color:
    "#92400e",

  border:
    "1px solid #fde68a",

  borderRadius:
    "5px",

  textAlign:
    "center",

  fontWeight:
    "bold",
};

const summaryGridStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "repeat(4,1fr)",

  gap:
    "8px",

  marginBottom:
    "14px",
};

const summaryCardStyle = {
  border:
    "1px solid #cbd5e1",

  borderRadius:
    "5px",

  overflow:
    "hidden",

  textAlign:
    "center",

  backgroundColor:
    "white",
};

const summaryTitleStyle = {
  color:
    "white",

  padding:
    "7px",

  fontSize:
    "10px",

  fontWeight:
    "bold",
};

const summaryValueStyle = {
  display:
    "block",

  padding:
    "10px",

  fontSize:
    "16px",
};

const twoColumnStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "1fr 1.3fr",

  gap:
    "12px",

  marginBottom:
    "12px",
};

const sectionStyle = {
  border:
    "1px solid #cbd5e1",

  borderRadius:
    "5px",

  overflow:
    "hidden",

  marginBottom:
    "12px",
};

const sectionTitleStyle = {
  color:
    "white",

  padding:
    "8px 10px",

  fontWeight:
    "bold",

  fontSize:
    "11px",
};

const moneyRowStyle = {
  display:
    "flex",

  justifyContent:
    "space-between",

  gap:
    "10px",

  padding:
    "8px 10px",

  borderTop:
    "1px solid #e2e8f0",

  fontSize:
    "10px",
};

const strongMoneyRowStyle = {
  backgroundColor:
    "#f1f5f9",

  fontWeight:
    "bold",
};

const platformHeaderStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "1.2fr 1fr 1fr 1fr",

  gap:
    "8px",

  padding:
    "7px",

  backgroundColor:
    "#dcfce7",

  color:
    "#166534",

  fontWeight:
    "bold",

  fontSize:
    "8px",

  textAlign:
    "center",
};

const platformRowStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "1.2fr 1fr 1fr 1fr",

  gap:
    "8px",

  padding:
    "8px",

  borderTop:
    "1px solid #e2e8f0",

  fontSize:
    "10px",

  textAlign:
    "right",
};

const expenseHeaderStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "0.4fr 3fr 1fr",

  gap:
    "8px",

  padding:
    "7px",

  backgroundColor:
    "#ffe4e6",

  color:
    "#9f1239",

  fontWeight:
    "bold",

  fontSize:
    "8px",
};

const expenseRowStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "0.4fr 3fr 1fr",

  gap:
    "8px",

  padding:
    "8px",

  borderTop:
    "1px solid #e2e8f0",

  fontSize:
    "10px",
};

const savingsSummaryStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "repeat(3,1fr)",

  gap:
    "8px",

  padding:
    "10px",
};

const savingsHeaderStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "2fr 1fr 1fr",

  gap:
    "8px",

  padding:
    "7px",

  backgroundColor:
    "#cffafe",

  color:
    "#155e75",

  fontWeight:
    "bold",

  fontSize:
    "8px",
};

const savingsRowStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "2fr 1fr 1fr",

  gap:
    "8px",

  alignItems:
    "center",

  padding:
    "8px",

  borderTop:
    "1px solid #e2e8f0",

  fontSize:
    "10px",
};

const paidBadgeStyle = {
  padding:
    "5px",

  backgroundColor:
    "#dcfce7",

  color:
    "#166534",

  borderRadius:
    "4px",

  textAlign:
    "center",

  fontWeight:
    "bold",
};

const pendingBadgeStyle = {
  padding:
    "5px",

  backgroundColor:
    "#fef3c7",

  color:
    "#92400e",

  borderRadius:
    "4px",

  textAlign:
    "center",

  fontWeight:
    "bold",
};

const savingsNoticeStyle = {
  padding:
    "7px",

  backgroundColor:
    "#ecfeff",

  color:
    "#155e75",

  textAlign:
    "center",

  fontSize:
    "8px",
};

const finalTotalsStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "repeat(6,1fr)",

  gap:
    "7px",

  marginTop:
    "12px",
};

const moneySummaryStyle = {
  padding:
    "9px",

  border:
    "1px solid #cbd5e1",

  borderRadius:
    "5px",

  backgroundColor:
    "#f8fafc",

  display:
    "flex",

  flexDirection:
    "column",

  gap:
    "4px",

  textAlign:
    "center",

  fontSize:
    "9px",
};

const strongSummaryStyle = {
  backgroundColor:
    "#dcfce7",

  color:
    "#166534",

  border:
    "1px solid #86efac",
};

const adminNoteStyle = {
  marginTop:
    "12px",

  padding:
    "9px",

  backgroundColor:
    "#fef3c7",

  color:
    "#92400e",

  borderRadius:
    "5px",
};

const readOnlyNoticeStyle = {
  marginTop:
    "12px",

  padding:
    "9px",

  backgroundColor:
    "#e0e7ff",

  color:
    "#3730a3",

  textAlign:
    "center",

  fontWeight:
    "bold",

  fontSize:
    "9px",
};

const emptyRowStyle = {
  padding:
    "12px",

  textAlign:
    "center",

  color:
    "#64748b",

  backgroundColor:
    "#f8fafc",
};

const loadingStyle = {
  padding:
    "20px",

  textAlign:
    "center",

  color:
    "#64748b",
};

const emptyStyle = {
  padding:
    "25px",

  textAlign:
    "center",

  color:
    "#64748b",
};

const errorStyle = {
  margin:
    "12px",

  padding:
    "10px",

  backgroundColor:
    "#fef2f2",

  color:
    "#991b1b",

  borderRadius:
    "5px",
};
