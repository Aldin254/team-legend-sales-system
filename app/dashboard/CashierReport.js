"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import CashierSavingsPanel from "./CashierSavingsPanel";
import CashierSalaryPanel from "./CashierSalaryPanel";
import CashierAccountsPanel from "./CashierAccountsPanel";
import CashierAccountsReturnPanel from "./CashierAccountsReturnPanel";
import CashierCloseShiftButton from "./CashierCloseShiftButton";
import CashierAttendancePanel from "./CashierAttendancePanel";
import CashierLiveFeedPanel from "./CashierLiveFeedPanel";
import {
  pageStyle,
  loadingStyle,
  topHeaderStyle,
  brandWrapStyle,
  crownStyle,
  brandStyle,
  taglineStyle,
  headerRightStyle,
  headerShopStyle,
  logoutButtonStyle,
  bodyStyle,
  sidebarStyle,
  mainStyle,
  topGridStyle,
  shopCardStyle,
  shopTitleStyle,
  shopSubtitleStyle,
  smallTextStyle,
  infoValueStyle,
  infoTitleStyle,
  infoSubvalueStyle,
  reportGridStyle,
  panelStyle,
  tableHeaderStyle,
  incomeRowStyle,
  amountBoxStyle,
  moneyInputStyle,
  savedMoneyStyle,
  lockedMoneyStyle,
  missingReadingStyle,
  savedInlineStyle,
  readOnlyInlineStyle,
  incomeTotalStyle,
  companyFloatNoticeStyle,
  automaticExpenseNoticeStyle,
  panelButtonWrapStyle,
  platformStatusStyle,
  platformHeaderStyle,
  platformRowStyle,
  savedTextStyle,
  outputBoxStyle,
  platformActionsStyle,
  completeStyle,
  waitingStyle,
  warningStyle,
  greenActionStyle,
  blueActionStyle,
  redActionStyle,
  expenseHeaderStyle,
  expenseRowStyle,
  expenseInputStyle,
  savedExpenseStyle,
  expenseTotalStyle,
  summaryGridStyle,
  summaryValueStyle,
  lowerGridStyle,
  shiftGreetingStyle,
  messageStyle,
  getSidebarItemStyle,
  sidebarIconStyle,
  getInfoCardStyle,
  getInfoCardAccentStyle,
  getPanelTitleStyle,
  getSummaryBoxStyle,
} from "./CashierProfessionalTheme";
export default function CashierReport({
  user,
  currentShift,
}) {
  const router = useRouter();

  const [shift, setShift] =
    useState(
      currentShift || null
    );

  const [
    platforms,
    setPlatforms,
  ] = useState([]);

  const [
    readings,
    setReadings,
  ] = useState([]);

  const [
    incomeEntries,
    setIncomeEntries,
  ] = useState([]);

  const [
    expenses,
    setExpenses,
  ] = useState([]);

  const [
    openingInputs,
    setOpeningInputs,
  ] = useState({});

  const [
    closingInputs,
    setClosingInputs,
  ] = useState({});

  const [
    expenseInputs,
    setExpenseInputs,
  ] = useState(
    Array.from(
      {
        length: 10,
      },
      () => ({
        description: "",
        amount: "",
      })
    )
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    savingClosing,
    setSavingClosing,
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

  const cashierName =
    user?.full_name ||
    user?.name ||
    user?.username ||
    "Cashier";

  // ==================================================
  // NAIROBI CLOCK
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

  const closingWindowOpen =
    is12HourClosingWindow(
      now
    );

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
          // PLATFORMS
          // ------------------------------------------

          const platformResponse =
            await fetch(
              `${supabaseUrl}/rest/v1/shop_platforms` +
                `?shop_id=eq.${encodeURIComponent(
                  shopId
                )}` +
                `&is_active=eq.true` +
                `&select=id,platform_name,reading_type,display_order` +
                `&order=display_order.asc`,
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

          const platformResult =
            await safeJson(
              platformResponse
            );

          if (
            !platformResponse.ok
          ) {
            throw new Error(
              platformResult?.message ||
                platformResult?.details ||
                "Unable to load platforms."
            );
          }

          const loadedPlatforms =
            Array.isArray(
              platformResult
            )
              ? platformResult
              : [];

          // ------------------------------------------
          // PLATFORM READINGS
          // ------------------------------------------

          const readingResponse =
            await fetch(
              `${supabaseUrl}/rest/v1/platform_readings` +
                `?shift_id=eq.${encodeURIComponent(
                  shiftId
                )}` +
                `&select=id,platform_id,reading_kind,reading_value,recorded_at`,
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

          const readingResult =
            await safeJson(
              readingResponse
            );

          if (
            !readingResponse.ok
          ) {
            throw new Error(
              readingResult?.message ||
                readingResult?.details ||
                "Unable to load readings."
            );
          }

          const loadedReadings =
            Array.isArray(
              readingResult
            )
              ? readingResult
              : [];

          // ------------------------------------------
          // FLOATS
          // COMPANY + M-SHWARI ARE DISPLAY-ONLY HERE.
          // M-SHWARI IS CREATED BY SAVINGS WITHDRAWAL.
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

          setPlatforms(
            loadedPlatforms
          );

          setReadings(
            loadedReadings
          );

          setIncomeEntries(
            loadedIncome
          );

          setExpenses(
            loadedExpenses
          );

          // ------------------------------------------
          // OPENING VALUES
          // ------------------------------------------

          setOpeningInputs(
            (
              previous
            ) => {
              const next = {
                ...previous,
              };

              for (
                const platform of
                loadedPlatforms
              ) {
                const saved =
                  loadedReadings.find(
                    (
                      row
                    ) =>
                      row.platform_id ===
                        platform.id &&
                      row.reading_kind ===
                        "OPENING"
                  );

                if (
                  saved
                ) {
                  next[
                    platform.id
                  ] =
                    String(
                      saved.reading_value ??
                        ""
                    );
                } else if (
                  next[
                    platform.id
                  ] ===
                  undefined
                ) {
                  next[
                    platform.id
                  ] =
                    "";
                }
              }

              return next;
            }
          );

          // ------------------------------------------
          // CLOSING INPUTS
          // ------------------------------------------

          setClosingInputs(
            (
              previous
            ) => {
              const next = {
                ...previous,
              };

              for (
                const platform of
                loadedPlatforms
              ) {
                const saved =
                  loadedReadings.find(
                    (
                      row
                    ) =>
                      row.platform_id ===
                        platform.id &&
                      row.reading_kind ===
                        "CLOSING"
                  );

                if (
                  saved
                ) {
                  next[
                    platform.id
                  ] =
                    String(
                      saved.reading_value ??
                        ""
                    );
                } else if (
                  next[
                    platform.id
                  ] ===
                  undefined
                ) {
                  next[
                    platform.id
                  ] =
                    "";
                }
              }

              return next;
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
                    length: 10,
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
            "CASHIER REPORT ERROR:",
            error
          );

          setMessage(
            error?.message ||
              "Unable to load cashier report."
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
  // AUTO REFRESH
  // ==================================================

  useEffect(() => {
    loadReport();

    const timer =
      setInterval(
        loadReport,
        5000
      );

    return () => {
      clearInterval(
        timer
      );
    };
  }, [
    loadReport,
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
  // OPENING / CLOSING STATUS
  // ==================================================

  const savedOpeningIds =
    useMemo(
      () =>
        new Set(
          readings
            .filter(
              (
                row
              ) =>
                row.reading_kind ===
                "OPENING"
            )
            .map(
              (
                row
              ) =>
                row.platform_id
            )
        ),
      [
        readings,
      ]
    );

  const savedClosingIds =
    useMemo(
      () =>
        new Set(
          readings
            .filter(
              (
                row
              ) =>
                row.reading_kind ===
                "CLOSING"
            )
            .map(
              (
                row
              ) =>
                row.platform_id
            )
        ),
      [
        readings,
      ]
    );

  const savedOpeningCount =
    platforms.filter(
      (
        platform
      ) =>
        savedOpeningIds.has(
          platform.id
        )
    ).length;

  const savedClosingCount =
    platforms.filter(
      (
        platform
      ) =>
        savedClosingIds.has(
          platform.id
        )
    ).length;

  const allOpeningsSaved =
    platforms.length >
      0 &&
    savedOpeningCount ===
      platforms.length;

  const allClosingsSaved =
    platforms.length >
      0 &&
    savedClosingCount ===
      platforms.length;

  const showClosing =
    closingWindowOpen ||
    savedClosingCount >
      0;

  const platformGridColumns =
    showClosing
      ? "1.25fr 1fr 1fr 1fr"
      : "1.25fr 1fr 1fr";

  // ==================================================
  // FLOAT DATA
  // ==================================================

  const floatData =
    useMemo(
      () => {
        const companyEntries =
          incomeEntries.filter(
            (
              entry
            ) =>
              entry.entry_type ===
              "COMPANY_FLOAT"
          );

        const mshwariEntries =
          incomeEntries.filter(
            (
              entry
            ) =>
              entry.entry_type ===
              "MSHWARI_FLOAT"
          );

        const companyTotal =
          companyEntries.reduce(
            (
              sum,
              entry
            ) =>
              sum +
              Number(
                entry.amount ??
                  0
              ),
            0
          );

        const mshwariTotal =
          mshwariEntries.reduce(
            (
              sum,
              entry
            ) =>
              sum +
              Number(
                entry.amount ??
                  0
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
      },
      [
        incomeEntries,
      ]
    );

  const companySlots =
    Array.from(
      {
        length: 3,
      },
      (
        _,
        index
      ) =>
        floatData
          .companyEntries[
          index
        ] ||
        null
    );

  const mshwariSlots =
    Array.from(
      {
        length: 3,
      },
      (
        _,
        index
      ) =>
        floatData
          .mshwariEntries[
          index
        ] ||
        null
    );

  // ==================================================
  // MANUAL EXPENSES
  // ==================================================

  const manualExpenses =
    useMemo(
      () =>
        expenses.filter(
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
        ),
      [
        expenses,
      ]
    );

  // ==================================================
  // PLATFORM ROWS
  // ==================================================

  const platformRows =
    useMemo(
      () =>
        platforms.map(
          (
            platform
          ) => {
            const openingRow =
              readings.find(
                (
                  row
                ) =>
                  row.platform_id ===
                    platform.id &&
                  row.reading_kind ===
                    "OPENING"
              );

            const closingRow =
              readings.find(
                (
                  row
                ) =>
                  row.platform_id ===
                    platform.id &&
                  row.reading_kind ===
                    "CLOSING"
              );

            const openingRaw =
              openingRow
                ? openingRow
                    .reading_value
                : openingInputs[
                    platform.id
                  ];

            const closingRaw =
              closingRow
                ? closingRow
                    .reading_value
                : closingInputs[
                    platform.id
                  ];

            const opening =
              openingRaw ===
                "" ||
              openingRaw ===
                undefined ||
              openingRaw ===
                null
                ? null
                : Number(
                    openingRaw
                  );

            const closing =
              closingRaw ===
                "" ||
              closingRaw ===
                undefined ||
              closingRaw ===
                null
                ? null
                : Number(
                    closingRaw
                  );

            let output =
              0;

            if (
              opening !==
                null &&
              closing !==
                null &&
              !Number.isNaN(
                opening
              ) &&
              !Number.isNaN(
                closing
              )
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
        ),
      [
        platforms,
        readings,
        openingInputs,
        closingInputs,
      ]
    );

  // ==================================================
  // SAVE MANUAL EXPENSES
  // ==================================================

  async function saveExpenses() {
    const rowsToSave =
      [];

    for (
      let i = 0;
      i < 10;
      i += 1
    ) {
      if (
        manualExpenses[
          i
        ]
      ) {
        continue;
      }

      const description =
        String(
          expenseInputs[
            i
          ]?.description ||
            ""
        ).trim();

      const rawAmount =
        expenseInputs[
          i
        ]?.amount;

      const hasDescription =
        description !==
        "";

      const hasAmount =
        rawAmount !== "" &&
        rawAmount !==
          undefined &&
        rawAmount !==
          null;

      if (
        !hasDescription &&
        !hasAmount
      ) {
        continue;
      }

      if (
        !hasDescription
      ) {
        setMessage(
          `Enter the description for expense ${
            i + 1
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
        !hasAmount ||
        !Number.isFinite(
          amount
        ) ||
        amount <= 0
      ) {
        setMessage(
          `Enter a valid amount for expense ${
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
      });
    }

    if (
      rowsToSave.length ===
      0
    ) {
      setMessage(
        "Enter at least one manual expense."
      );

      setMessageType(
        "error"
      );

      return;
    }

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
            "Unable to save expenses."
        );
      }

      const existingExpenseTotal =
        expenses.reduce(
          (
            sum,
            expense
          ) =>
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
              (
                sum,
                expense
              ) =>
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
          "Expenses saved but shift total could not be updated."
        );
      }

      setMessage(
        "Expenses saved successfully."
      );

      setMessageType(
        "success"
      );

      await loadReport();
    } catch (error) {
      setMessage(
        error?.message ||
          "Unable to save expenses."
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
  // SAVE CLOSING READINGS
  // ==================================================

  async function saveClosingReadings() {
    if (
      !is12HourClosingWindow(
        new Date()
      )
    ) {
      setMessage(
        "Closing readings can only be saved from 9:30 PM to midnight Nairobi time."
      );

      setMessageType(
        "error"
      );

      return;
    }

    if (
      !allOpeningsSaved
    ) {
      setMessage(
        "Automatic opening readings are incomplete. Contact Admin before closing this shift."
      );

      setMessageType(
        "error"
      );

      return;
    }

    const unsavedPlatforms =
      platforms.filter(
        (
          platform
        ) =>
          !savedClosingIds.has(
            platform.id
          )
      );

    if (
      unsavedPlatforms.length ===
      0
    ) {
      setMessage(
        "Closing readings are already saved."
      );

      setMessageType(
        "success"
      );

      return;
    }

    for (
      const platform of
      unsavedPlatforms
    ) {
      const openingRow =
        readings.find(
          (
            row
          ) =>
            row.platform_id ===
              platform.id &&
            row.reading_kind ===
              "OPENING"
        );

      if (
        !openingRow
      ) {
        setMessage(
          `Opening reading for ${platform.platform_name} is missing. Contact Admin.`
        );

        setMessageType(
          "error"
        );

        return;
      }

      const opening =
        Number(
          openingRow
            .reading_value
        );

      const closingRaw =
        closingInputs[
          platform.id
        ];

      const closing =
        Number(
          closingRaw
        );

      if (
        closingRaw ===
          "" ||
        closingRaw ===
          undefined ||
        closingRaw ===
          null ||
        Number.isNaN(
          closing
        ) ||
        Number.isNaN(
          opening
        )
      ) {
        setMessage(
          `Enter a valid closing reading for ${platform.platform_name}.`
        );

        setMessageType(
          "error"
        );

        return;
      }
    }

    try {
      setSavingClosing(
        true
      );

      setMessage(
        ""
      );

      if (
        !is12HourClosingWindow(
          new Date()
        )
      ) {
        throw new Error(
          "The cashier closing window has ended. Closing readings can only be saved from 9:30 PM to midnight Nairobi time."
        );
      }

      const recordedAt =
        new Date()
          .toISOString();

      for (
        const platform of
        unsavedPlatforms
      ) {
        const response =
          await fetch(
            `${supabaseUrl}/rest/v1/platform_readings`,
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
              },

              body:
                JSON.stringify({
                  shift_id:
                    shiftId,

                  platform_id:
                    platform.id,

                  reading_kind:
                    "CLOSING",

                  reading_value:
                    roundMoney(
                      Number(
                        closingInputs[
                          platform.id
                        ]
                      )
                    ),

                  recorded_at:
                    recordedAt,

                  recorded_by:
                    cashierId,
                }),
            }
          );

        if (
          !response.ok
        ) {
          const result =
            await safeJson(
              response
            );

          throw new Error(
            result?.message ||
              result?.details ||
              `Unable to save ${platform.platform_name}.`
          );
        }
      }

      let totalOutput =
        0;

      for (
        const platform of
        platforms
      ) {
        const openingRow =
          readings.find(
            (
              row
            ) =>
              row.platform_id ===
                platform.id &&
              row.reading_kind ===
                "OPENING"
          );

        const existingClosingRow =
          readings.find(
            (
              row
            ) =>
              row.platform_id ===
                platform.id &&
              row.reading_kind ===
                "CLOSING"
          );

        const openingRaw =
          openingRow
            ?.reading_value;

        const closingRaw =
          existingClosingRow
            ? existingClosingRow
                .reading_value
            : closingInputs[
                platform.id
              ];

        const opening =
          openingRaw ===
            null ||
          openingRaw ===
            undefined ||
          openingRaw ===
            ""
            ? 0
            : Number(
                openingRaw
              );

        const closing =
          closingRaw ===
            null ||
          closingRaw ===
            undefined ||
          closingRaw ===
            ""
            ? 0
            : Number(
                closingRaw
              );

        totalOutput +=
          closing -
          opening;
      }

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
                total_output:
                  roundMoney(
                    totalOutput
                  ),
              }),
          }
        );

      if (
        !shiftResponse.ok
      ) {
        throw new Error(
          "Closing readings saved but sales total could not be updated."
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
      setMessage(
        error?.message ||
          "Unable to save closing readings."
      );

      setMessageType(
        "error"
      );
    } finally {
      setSavingClosing(
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

  const savedTotalOutput =
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
        floatData.companyTotal +
        floatData.mshwariTotal
    );

  const totalSales =
    roundMoney(
      openingBalance +
        floatData.companyTotal +
        floatData.mshwariTotal +
        savedTotalOutput
    );

  const reportDate =
    formatReportDate(
      shift?.opened_at ||
        new Date()
          .toISOString()
    );

  const reportDay =
    formatReportDay(
      shift?.opened_at ||
        new Date()
          .toISOString()
    );

  const shiftStatus =
    String(
      shift?.status ||
        "OPEN"
    ).toUpperCase();

  const shiftNumber =
    getShiftNumber(
      shift
    );

  const shiftGreeting =
    getShiftGreeting(
      now,
      shiftStatus,
      shiftNumber
    );

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
        Loading cashier report...
      </div>
    );
  }

  if (
    !shift
  ) {
    return null;
  }

  // ==================================================
  // DISPLAY
  // ==================================================

  return (
    <div
      style={
        pageStyle
      }
    >
      <header
        style={
          topHeaderStyle
        }
      >
        <div
          style={
            brandWrapStyle
          }
        >
          <div
            style={
              crownStyle
            }
          >
            ♛
          </div>

          <div>
            <div
              style={
                brandStyle
              }
            >
              TEAM LEGEND
            </div>

            <div
              style={
                taglineStyle
              }
            >
              DISCIPLINE • FOCUS • RESULTS
            </div>
          </div>
        </div>

        <div
          style={
            headerRightStyle
          }
        >
          <div>
            Welcome,{" "}

            <strong>
              {cashierName.toUpperCase()}
            </strong>

            <div
              style={
                headerShopStyle
              }
            >
              {shopName.toUpperCase()}
            </div>
          </div>

          <button
            type="button"
            onClick={
              logout
            }
            style={
              logoutButtonStyle
            }
          >
            Logout
          </button>
        </div>
      </header>

<CashierLiveFeedPanel
  user={user}
/>

<CashierAttendancePanel
  user={user}
  currentShift={currentShift}
/>

<div
  style={
    bodyStyle
  }
>
        <aside
          style={
            sidebarStyle
          }
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

        <main
          style={
            mainStyle
          }
        >
    <div
  style={{
    ...topGridStyle
  }}
>
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
                shift?.shift_name ||
                "DAY"
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

          <div
            style={
              shiftGreetingStyle
            }
          >
            {shiftGreeting}
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

          <div
            style={
              reportGridStyle
            }
          >
            {/* ===================================== */}
            {/* INCOME */}
            {/* ===================================== */}

            <section
              style={
                panelStyle
              }
            >
              <PanelTitle
                title="INCOME STATEMENT"
                tone="blue"
              />

              <div
                style={
                  tableHeaderStyle
                }
              >
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

              {/* COMPANY FLOAT - READ ONLY */}

              {companySlots.map(
                (
                  entry,
                  index
                ) => (
                  <ReadOnlyFloatRow
                    key={`company-${index}`}
                    label={`Added Float ${
                      index + 1
                    } From Company`}
                    entry={
                      entry
                    }
                  />
                )
              )}

              {/* M-SHWARI FLOAT - READ ONLY */}

              {mshwariSlots.map(
                (
                  entry,
                  index
                ) => (
                  <ReadOnlyFloatRow
                    key={`mshwari-${index}`}
                    label={`Added Float ${
                      index + 1
                    } From M-Shwari`}
                    entry={
                      entry
                    }
                  />
                )
              )}

              <div
                style={
                  incomeTotalStyle
                }
              >
                <strong>
                  TOTAL ADDED
                </strong>

                <strong>
                  {money(
                    totalAdded
                  )}
                </strong>
              </div>

              <div
                style={
                  companyFloatNoticeStyle
                }
              >
                Company Float and M-Shwari Float 1, 2 and 3 are
                read-only. Company Float is posted by Legend
                Accounts. M-Shwari Float is added automatically
                after a Savings withdrawal.
              </div>
            </section>

            {/* ===================================== */}
            {/* PLATFORM */}
            {/* ===================================== */}

            <section
              style={
                panelStyle
              }
            >
              <PanelTitle
                title="PLATFORM SALES"
                tone="green"
              />

              <div
                style={
                  platformStatusStyle
                }
              >
                <span>
                  Opening:{" "}
                  {savedOpeningCount}/
                  {platforms.length}
                </span>

                {showClosing && (
                  <span>
                    Closing:{" "}
                    {savedClosingCount}/
                    {platforms.length}
                  </span>
                )}
              </div>

              <div
                style={{
                  ...platformHeaderStyle,

                  gridTemplateColumns:
                    platformGridColumns,
                }}
              >
                <div>
                  SHOP / PLATFORM
                </div>

                <div>
                  OPENING
                </div>

                {showClosing && (
                  <div>
                    CLOSING
                  </div>
                )}

                <div>
                  SALES
                </div>
              </div>

              {platformRows.map(
                (
                  platform
                ) => (
                  <div
                    key={
                      platform.id
                    }
                    style={{
                      ...platformRowStyle,

                      gridTemplateColumns:
                        platformGridColumns,
                    }}
                  >
                    <div>
                      <strong>
                        {
                          platform.platform_name
                        }
                      </strong>

                      {platform.openingSaved && (
                        <div
                          style={
                            savedTextStyle
                          }
                        >
                          Opening ✓
                        </div>
                      )}

                      {showClosing &&
                        platform.closingSaved && (
                          <div
                            style={
                              savedTextStyle
                            }
                          >
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
                      <div
                        style={
                          missingReadingStyle
                        }
                      >
                        Missing
                      </div>
                    )}

                    {showClosing && (
                      platform.closingSaved ? (
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
                            ] ??
                            ""
                          }
                          disabled={
                            !closingWindowOpen ||
                            !allOpeningsSaved ||
                            savingClosing
                          }
                          onChange={(
                            value
                          ) =>
                            setClosingInputs(
                              (
                                previous
                              ) => ({
                                ...previous,

                                [platform.id]:
                                  value,
                              })
                            )
                          }
                        />
                      )
                    )}

                    <div
                      style={
                        outputBoxStyle
                      }
                    >
                      {money(
                        platform.output
                      )}
                    </div>
                  </div>
                )
              )}

              <div
                style={
                  platformActionsStyle
                }
              >
                {!allOpeningsSaved && (
                  <div
                    style={
                      warningStyle
                    }
                  >
                    Automatic opening readings are incomplete.
                    Contact Admin.
                  </div>
                )}

                {!showClosing &&
                  allOpeningsSaved && (
                    <div
                      style={
                        waitingStyle
                      }
                    >
                      Closing readings will become available at
                      9:30 PM Nairobi time.
                    </div>
                  )}

                {showClosing &&
                  closingWindowOpen &&
                  allOpeningsSaved &&
                  !allClosingsSaved && (
                    <button
                      type="button"
                      onClick={
                        saveClosingReadings
                      }
                      disabled={
                        savingClosing
                      }
                      style={
                        blueActionStyle
                      }
                    >
                      {savingClosing
                        ? "Saving Closing Readings..."
                        : "Save Closing Readings"}
                    </button>
                  )}

                {allOpeningsSaved && (
                  <div
                    style={
                      completeStyle
                    }
                  >
                    Opening Readings Saved ✓
                  </div>
                )}

                {allClosingsSaved && (
                  <div
                    style={
                      completeStyle
                    }
                  >
                    Closing Readings Saved ✓
                  </div>
                )}
              </div>
            </section>

            {/* ===================================== */}
            {/* EXPENSES */}
            {/* ===================================== */}

            <section
              style={
                panelStyle
              }
            >
              <PanelTitle
                title="EXPENSES"
                tone="red"
              />

              <div
                style={
                  expenseHeaderStyle
                }
              >
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
                {
                  length: 10,
                },
                (
                  _,
                  index
                ) => {
                  const saved =
                    manualExpenses[
                      index
                    ];

                  return (
                    <div
                      key={
                        index
                      }
                      style={
                        expenseRowStyle
                      }
                    >
                      <div>
                        {index + 1}
                      </div>

                      {saved ? (
                        <>
                          <div
                            style={
                              savedExpenseStyle
                            }
                          >
                            {
                              saved.description
                            }
                          </div>

                          <div
                            style={
                              savedExpenseStyle
                            }
                          >
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
                            onChange={(
                              event
                            ) => {
                              const value =
                                event
                                  .target
                                  .value;

                              setExpenseInputs(
                                (
                                  previous
                                ) => {
                                  const next =
                                    previous.map(
                                      (
                                        row
                                      ) => ({
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
                            style={
                              expenseInputStyle
                            }
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
                            onChange={(
                              event
                            ) => {
                              const value =
                                event
                                  .target
                                  .value;

                              setExpenseInputs(
                                (
                                  previous
                                ) => {
                                  const next =
                                    previous.map(
                                      (
                                        row
                                      ) => ({
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
                            style={
                              expenseInputStyle
                            }
                          />
                        </>
                      )}
                    </div>
                  );
                }
              )}

              <div
                style={
                  expenseTotalStyle
                }
              >
                <strong>
                  TOTAL EXPENSES
                </strong>

                <strong>
                  {money(
                    totalExpenses
                  )}
                </strong>
              </div>

              <div
                style={
                  automaticExpenseNoticeStyle
                }
              >
                Savings are added automatically to Total Expenses
                when saved. Cashier → Legend Accounts transfers are
                added after Accounts confirms receipt.
              </div>

              <div
                style={
                  panelButtonWrapStyle
                }
              >
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

                    opacity:
                      savingExpenses
                        ? 0.6
                        : 1,
                  }}
                >
                  {savingExpenses
                    ? "Saving..."
                    : "Save Expenses"}
                </button>
              </div>
            </section>
          </div>

          {/* ======================================= */}
          {/* SUMMARY */}
          {/* ======================================= */}

          <div
            style={
              summaryGridStyle
            }
          >
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

          {/* ======================================= */}
          {/* LOWER PANELS */}
          {/* ======================================= */}

          <div
            style={
              lowerGridStyle
            }
          >
            <CashierSavingsPanel
              user={
                user
              }
              currentShift={
                shift ||
                currentShift
              }
            />

            <CashierSalaryPanel
              user={
                user
              }
              currentShift={
                shift ||
                currentShift
              }
            />

            <CashierAccountsPanel
              user={
                user
              }
            />

            <CashierAccountsReturnPanel
              user={
                user
              }
              currentShift={
                shift ||
                currentShift
              }
              onReturnChanged={
                loadReport
              }
            />
          </div>

          <CashierCloseShiftButton
            user={
              user
            }
            currentShift={
              shift
            }
          />
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
      style={getSidebarItemStyle(active)}
    >
      <span style={sidebarIconStyle}>
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

      <div style={shopSubtitleStyle}>
        {subtitle}
      </div>

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
      <div style={infoTitleStyle}>
        {title}
      </div>

      <div style={infoValueStyle}>
        {value}
      </div>

      {subvalue ? (
        <div style={infoSubvalueStyle}>
          {subvalue}
        </div>
      ) : null}

      <div
        style={getInfoCardAccentStyle(tone)}
      />
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
    <div
      style={
        incomeRowStyle
      }
    >
      <div>
        {label}
      </div>

      <div
        style={
          amountBoxStyle
        }
      >
        {money(
          amount
        )}
      </div>
    </div>
  );
}

// ==================================================
// COMPANY + M-SHWARI FLOAT
// BOTH ARE READ ONLY
// ==================================================

function ReadOnlyFloatRow({
  label,
  entry,
}) {
  return (
    <div
      style={
        incomeRowStyle
      }
    >
      <div>
        {label}{" "}

        <span
          style={
            readOnlyInlineStyle
          }
        >
          {entry
            ? "✓"
            : "🔒"}
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
          ? money(
              entry.amount
            )
          : "0.00"}
      </div>
    </div>
  );
}

function ReadingInput({
  value,
  onChange,
  disabled,
}) {
  return (
    <input
      type="number"
      value={
        value
      }
      disabled={
        disabled
      }
      onChange={(
        event
      ) =>
        onChange(
          event.target.value
        )
      }
      style={
        moneyInputStyle
      }
    />
  );
}

function SavedReadingBox({
  value,
}) {
  return (
    <div
      style={
        savedMoneyStyle
      }
    >
      {money(
        value
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
      {title}

      <div style={summaryValueStyle}>
        KES {money(amount)}
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
      value ??
        0
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
      (
        Number(
          value
        ) +
        Number.EPSILON
      ) *
        100
    ) /
    100
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
    new Date(
      value
    )
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
    new Date(
      value
    )
  );
}

function displayTime(
  value
) {
  return String(
    value ||
      ""
  )
    .split(
      "."
    )[0]
    .slice(
      0,
      5
    );
}

// ==================================================
// SHIFT GREETING
// ==================================================

function getShiftNumber(
  shift
) {
  const raw =
    String(
      shift?.shift_name ||
        shift?.name ||
        ""
    ).toUpperCase();

  const match =
    raw.match(
      /(?:SHIFT\s*)?([12])/
    );

  return match
    ? match[1]
    : "1";
}

function getShiftGreeting(
  date,
  shiftStatus,
  shiftNumber
) {
  const status =
    String(
      shiftStatus ||
        ""
    ).toUpperCase();

  if (
    status ===
      "CLOSED" ||
    status ===
      "COMPLETED"
  ) {
    return `Good Bye 👋 — Shift ${shiftNumber} Closed`;
  }

  const formatter =
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone:
          "Africa/Nairobi",

        hour:
          "2-digit",

        hourCycle:
          "h23",
      }
    );

  const hour =
    Number(
      formatter.format(
        date ||
          new Date()
      )
    );

  if (
    hour >= 5 &&
    hour < 12
  ) {
    return `Good Morning 🌞 — Welcome to Shift ${shiftNumber}`;
  }

  if (
    hour >= 12 &&
    hour < 17
  ) {
    return `Good Afternoon ☀️ — Welcome to Shift ${shiftNumber}`;
  }

  return `Good Evening 🌙 — Welcome to Shift ${shiftNumber}`;
}

// ==================================================
// CLOSING WINDOW
// ==================================================

function is12HourClosingWindow(
  date =
    new Date()
) {
  const formatter =
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone:
          "Africa/Nairobi",

        hour:
          "2-digit",

        minute:
          "2-digit",

        second:
          "2-digit",

        hourCycle:
          "h23",
      }
    );

  const parts =
    formatter.formatToParts(
      date
    );

  const values = {};

  for (
    const part of
    parts
  ) {
    if (
      part.type !==
      "literal"
    ) {
      values[
        part.type
      ] =
        part.value;
    }
  }

  const hour =
    Number(
      values.hour
    );

  const minute =
    Number(
      values.minute
    );

  const minutesSinceMidnight =
    hour * 60 +
    minute;

  return (
    minutesSinceMidnight >=
      21 * 60 + 30 &&
    minutesSinceMidnight <
      24 * 60
  );
}

// ==================================================
// STYLES
// ==================================================

