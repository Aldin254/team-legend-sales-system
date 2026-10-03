"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import CashierSavingsPanel from "./CashierSavingsPanel";
import CashierManagementPanel from "./CashierManagementPanel";
import CashierAccountsPanel from "./CashierAccountsPanel";
import CashierCloseShiftButton from "./CashierCloseShiftButton";

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

  const [savingClosing, setSavingClosing] = useState(false);
  const [savingFloats, setSavingFloats] = useState(false);
  const [savingExpenses, setSavingExpenses] = useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  // Live clock used for 9:30 PM Nairobi closing window.
  const [now, setNow] = useState(() => new Date());

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
  // NAIROBI CLOCK
  // ==================================================

  useEffect(() => {
    setNow(new Date());

    const timer = setInterval(() => {
      setNow(new Date());
    }, 15000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  const closingWindowOpen =
    is12HourClosingWindow(now);

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
        // SHIFT

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

        // PLATFORMS

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

        // READINGS

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
              "Unable to load readings."
          );
        }

        const loadedReadings =
          Array.isArray(readingResult)
            ? readingResult
            : [];

        // FLOATS

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

        // EXPENSES

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

        // OPENING VALUES
        // These are display-only for the new 12-hour workflow.

        setOpeningInputs((previous) => {
          const next = {
            ...previous,
          };

          for (const platform of loadedPlatforms) {
            const saved =
              loadedReadings.find(
                (row) =>
                  row.platform_id === platform.id &&
                  row.reading_kind === "OPENING"
              );

            if (saved) {
              next[platform.id] =
                String(
                  saved.reading_value ?? ""
                );
            } else if (
              next[platform.id] === undefined
            ) {
              next[platform.id] = "";
            }
          }

          return next;
        });

        // CLOSING INPUTS

        setClosingInputs((previous) => {
          const next = {
            ...previous,
          };

          for (const platform of loadedPlatforms) {
            const saved =
              loadedReadings.find(
                (row) =>
                  row.platform_id === platform.id &&
                  row.reading_kind === "CLOSING"
              );

            if (saved) {
              next[platform.id] =
                String(
                  saved.reading_value ?? ""
                );
            } else if (
              next[platform.id] === undefined
            ) {
              next[platform.id] = "";
            }
          }

          return next;
        });

        // FLOAT INPUTS

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

        // EXPENSE INPUTS

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
  // OPENING / CLOSING STATUS
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

  /*
   * Before 9:30 PM the Closing column is completely hidden.
   *
   * If closings have already been saved, we keep them visible and
   * locked so a completed entry does not disappear from the report.
   */
  const showClosing =
    closingWindowOpen ||
    savedClosingCount > 0;

  const platformGridColumns =
    showClosing
      ? "1.25fr 1fr 1fr 1fr"
      : "1.25fr 1fr 1fr";

  // ==================================================
  // FLOAT DATA
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
  // PLATFORM ROWS
  // ==================================================
  // All platform readings may be negative, zero, or positive.
  // Output is always Closing - Opening.

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
            Number.isFinite(opening) &&
            Number.isFinite(closing)
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
            Number.isNaN(value) ||
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
            shift_id: shiftId,
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
            Number.isNaN(value) ||
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
            shift_id: shiftId,
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

      const response = await fetch(
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

          body: JSON.stringify(
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
          floatData.companyTotal +
            floatData.mshwariTotal +
            rowsToSave.reduce(
              (sum, row) =>
                sum +
                Number(
                  row.amount || 0
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

            body: JSON.stringify({
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

      await loadReport();
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
        Number(
          rawAmount
        );

      if (
        !hasAmount ||
        Number.isNaN(amount) ||
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

      const response = await fetch(
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

          body: JSON.stringify(
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
              expense.amount ||
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
                  expense.amount ||
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

            body: JSON.stringify({
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

      await loadReport();
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
  // SAVE CLOSING READINGS
  // 12-HOUR CASHIER WINDOW: 9:30 PM - MIDNIGHT NAIROBI
  // ==================================================
async function saveClosingReadings() {
    // Handler protection — not only UI hiding.
    if (
      !is12HourClosingWindow(
        new Date()
      )
    ) {
      setMessage(
        "Closing readings can only be saved from 9:30 PM to midnight Nairobi time."
      );

      setMessageType("error");
      return;
    }

    if (!allOpeningsSaved) {
      setMessage(
        "Automatic opening readings are incomplete. Contact Admin before closing this shift."
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
        "Closing readings are already saved."
      );

      setMessageType("success");
      return;
    }

    /*
     * SIGNED PLATFORM READING RULE
     *
     * Every platform may contain:
     * - a negative reading
     * - zero
     * - a positive reading
     *
     * Closing does NOT have to be greater than Opening.
     *
     * Examples:
     * Opening 350, Closing -200 = Output -550
     * Opening -200, Closing 400 = Output +600
     * Opening 0, Closing -500 = Output -500
     */

    for (const platform of unsavedPlatforms) {
      const openingRow =
        readings.find(
          (row) =>
            row.platform_id ===
              platform.id &&
            row.reading_kind ===
              "OPENING"
        );

      if (!openingRow) {
        setMessage(
          `Opening reading for ${platform.platform_name} is missing. Contact Admin.`
        );

        setMessageType("error");
        return;
      }

      const openingRaw =
        openingRow.reading_value;

      const closingRaw =
        closingInputs[
          platform.id
        ];

      const opening =
        Number(openingRaw);

      const closing =
        Number(closingRaw);

      /*
       * IMPORTANT:
       * We check for blank values explicitly.
       *
       * Do NOT use:
       * if (!closingRaw)
       *
       * because zero is a valid reading.
       */

      if (
        closingRaw === "" ||
        closingRaw === undefined ||
        closingRaw === null ||
        !Number.isFinite(closing) ||
        !Number.isFinite(opening)
      ) {
        setMessage(
          `Enter a valid closing reading for ${platform.platform_name}.`
        );

        setMessageType("error");
        return;
      }
    }

    try {
      setSavingClosing(true);
      setMessage("");

      // Recheck immediately before writing.
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
        new Date().toISOString();

      for (const platform of unsavedPlatforms) {
        const closingValue =
          Number(
            closingInputs[
              platform.id
            ]
          );

        const response =
          await fetch(
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
              },

              body: JSON.stringify({
                shift_id:
                  shiftId,

                platform_id:
                  platform.id,

                reading_kind:
                  "CLOSING",

                /*
                 * Preserve the actual signed reading.
                 * Negative, zero and positive are all valid.
                 */
                reading_value:
                  roundMoney(
                    closingValue
                  ),

                recorded_at:
                  recordedAt,

                recorded_by:
                  cashierId,
              }),
            }
          );

        if (!response.ok) {
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

      /*
       * CALCULATE TOTAL PLATFORM OUTPUT
       *
       * Output for every platform:
       *
       * Closing - Opening
       *
       * No Math.max().
       * No zero clamp.
       * No closing >= opening requirement.
       */

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

        const existingClosingRow =
          readings.find(
            (row) =>
              row.platform_id ===
                platform.id &&
              row.reading_kind ===
                "CLOSING"
          );

        const openingRaw =
          openingRow?.reading_value;

        const closingRaw =
          existingClosingRow
            ? existingClosingRow.reading_value
            : closingInputs[
                platform.id
              ];

        /*
         * Never use:
         *
         * value || fallback
         *
         * Zero and negative numbers are both legitimate readings.
         */

        const openingMissing =
          openingRaw === null ||
          openingRaw === undefined ||
          openingRaw === "";

        const closingMissing =
          closingRaw === null ||
          closingRaw === undefined ||
          closingRaw === "";

        if (
          openingMissing ||
          closingMissing
        ) {
          throw new Error(
            `Platform readings for ${platform.platform_name} are incomplete.`
          );
        }

        const opening =
          Number(openingRaw);

        const closing =
          Number(closingRaw);

        if (
          !Number.isFinite(opening) ||
          !Number.isFinite(closing)
        ) {
          throw new Error(
            `Platform readings for ${platform.platform_name} are invalid.`
          );
        }

        totalOutput +=
          closing -
          opening;
      }

      totalOutput =
        roundMoney(
          totalOutput
        );

      /*
       * Negative total_output is valid.
       *
       * Example:
       * Total platform losses = -500
       *
       * The shift calculation is allowed to use -500.
       */

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

            body: JSON.stringify({
              total_output:
                totalOutput,
            }),
          }
        );

      if (!shiftResponse.ok) {
        const shiftResult =
          await safeJson(
            shiftResponse
          );

        throw new Error(
          shiftResult?.message ||
            shiftResult?.details ||
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

      setMessageType("error");
    } finally {
      setSavingClosing(false);
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

  /*
   * Total Sales is allowed to become negative.
   *
   * B/F + Company Float + M-Shwari Float
   * + signed platform output
   */

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
            />

            <InfoCard
              title="DAY"
              value={reportDay}
            />

            <InfoCard
              title="SHIFT"
              value={
                shift?.shift_name ||
                "DAY"
              }
              subvalue={
                `${displayTime(
                  shift?.scheduled_start
                )} - ${displayTime(
                  shift?.scheduled_end
                )}`
              }
              tone="green"
            />

            <InfoCard
              title="STATUS"
              value={shiftStatus}
              tone="green"
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

          <div style={reportGridStyle}>
            {/* INCOME */}

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
                    savedEntry={entry}
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
                    savedEntry={entry}
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
                  onClick={
                    saveFloats
                  }
                  disabled={
                    savingFloats
                  }
                  style={greenActionStyle}
                >
                  {savingFloats
                    ? "Saving..."
                    : "Save Added Float"}
                </button>
              </div>
            </section>

            {/* PLATFORM */}

            <section style={panelStyle}>
              <PanelTitle
                title="PLATFORM SALES"
                tone="green"
              />

              <div style={platformStatusStyle}>
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
                (platform) => (
                  <div
                    key={platform.id}
                    style={{
                      ...platformRowStyle,
                      gridTemplateColumns:
                        platformGridColumns,
                    }}
                  >
                    <div>
                      <strong>
                        {platform.platform_name}
                      </strong>

                      {platform.openingSaved && (
                        <div style={savedTextStyle}>
                          Opening ✓
                        </div>
                      )}

                      {showClosing &&
                        platform.closingSaved && (
                          <div style={savedTextStyle}>
                            Closing ✓
                          </div>
                        )}
                    </div>

                    {/* OPENING IS ALWAYS LOCKED */}

                    {platform.openingSaved ? (
                      <SavedReadingBox
                        value={
                          platform.opening
                        }
                      />
                    ) : (
                      <div style={missingReadingStyle}>
                        Missing
                      </div>
                    )}

                    {/* CLOSING IS COMPLETELY HIDDEN BEFORE 9:30 PM */}

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
                            ] ?? ""
                          }
                          disabled={
                            !closingWindowOpen ||
                            !allOpeningsSaved ||
                            savingClosing
                          }
                          onChange={(value) =>
                            setClosingInputs(
                              (previous) => ({
                                ...previous,
                                [platform.id]:
                                  value,
                              })
                            )
                          }
                        />
                      )
                    )}

                    <div style={outputBoxStyle}>
                      {money(
                        platform.output
                      )}
                    </div>
                  </div>
                )
              )}

              <div style={platformActionsStyle}>
                {!allOpeningsSaved && (
                  <div style={warningStyle}>
                    Automatic opening readings are incomplete. Contact Admin.
                  </div>
                )}

                {!showClosing &&
                  allOpeningsSaved && (
                    <div style={waitingStyle}>
                      Closing readings will become available at 9:30 PM Nairobi time.
                    </div>
                  )}

                {showClosing &&
                  closingWindowOpen &&
                  allOpeningsSaved &&
                  !allClosingsSaved && (
                    <button
                      onClick={
                        saveClosingReadings
                      }
                      disabled={
                        savingClosing
                      }
                      style={blueActionStyle}
                    >
                      {savingClosing
                        ? "Saving Closing Readings..."
                        : "Save Closing Readings"}
                    </button>
                  )}

                {allOpeningsSaved && (
                  <div style={completeStyle}>
                    Opening Readings Saved ✓
                  </div>
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
                <div>DESCRIPTION</div>
                <div>AMOUNT (KES)</div>
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
                            {saved.description}
                          </div>

                          <div style={savedExpenseStyle}>
                            {money(
                              saved.amount
                            )} ✓
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
                            value={
                              expenseInputs[
                                index
                              ]
                                ?.amount ||
                              ""
                            }
                            placeholder="0.00"
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
                  onClick={
                    saveExpenses
                  }
                  disabled={
                    savingExpenses
                  }
                  style={redActionStyle}
                >
                  {savingExpenses
                    ? "Saving..."
                    : "Save Expenses"}
                </button>
              </div>
            </section>
          </div>

          {/* SUMMARY */}

          <div style={summaryGridStyle}>
            <SummaryBox
              title="TOTAL SALES"
              amount={totalSales}
              tone="blue"
            />

            <SummaryBox
              title="TOTAL EXPENSES"
              amount={
                totalExpenses
              }
              tone="red"
            />

            {/* CLOSING BALANCE IS DISPLAY ONLY / LOCKED */}

            <SummaryBox
              title="CLOSING BALANCE"
              amount={
                closingBalance
              }
              tone="navy"
            />
          </div>

          {/* LOWER PANELS */}

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

          <CashierCloseShiftButton
            user={user}
            currentShift={shift}
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
        color: "white",
        borderRadius: "8px",
        padding: "12px",
        textAlign: "center",
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
    tone === "green"
      ? "#087c33"
      : tone === "red"
      ? "#b60000"
      : "#0873b9";

  return (
    <div
      style={{
        backgroundColor:
          background,
        color: "white",
        padding: "9px",
        fontWeight: "bold",
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
          value={value}
          disabled={disabled}
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

/*
 * PLATFORM READING INPUT
 *
 * IMPORTANT:
 * There is intentionally NO min="0".
 *
 * All platform readings may be:
 * negative, zero or positive.
 */
function ReadingInput({
  value,
  onChange,
  disabled,
}) {
  return (
    <input
      type="number"
      step="any"
      value={value}
      disabled={disabled}
      onChange={(event) =>
        onChange(
          event.target.value
        )
      }
      style={moneyInputStyle}
    />
  );
}

function SavedReadingBox({
  value,
}) {
  return (
    <div style={savedMoneyStyle}>
      {money(value)}
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
      : "#0789dd";

  return (
    <div
      style={{
        backgroundColor:
          background,
        color: "white",
        padding: "13px",
        borderRadius: "7px",
        textAlign: "center",
        fontWeight: "bold",
      }}
    >
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
    value ?? 0
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
  return String(
    value || ""
  )
    .split(".")[0]
    .slice(0, 5);
}

// ==================================================
// 12-HOUR CASHIER CLOSING WINDOW
// NAIROBI: 21:30 INCLUSIVE TO MIDNIGHT EXCLUSIVE
// ==================================================

function is12HourClosingWindow(
  date = new Date()
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
        hourCycle:
          "h23",
      }
    );

  const parts =
    formatter.formatToParts(
      date
    );

  const hour =
    Number(
      parts.find(
        (part) =>
          part.type === "hour"
      )?.value || 0
    );

  const minute =
    Number(
      parts.find(
        (part) =>
          part.type === "minute"
      )?.value || 0
    );

  const totalMinutes =
    hour * 60 +
    minute;

  return (
    totalMinutes >=
      21 * 60 + 30 &&
    totalMinutes <
      24 * 60
  );
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
};

const bodyStyle = {
  display: "flex",
};

const sidebarStyle = {
  width: "190px",
  backgroundColor: "#073555",
  minHeight:
    "calc(100vh - 70px)",
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

const reportGridStyle = {
  display: "grid",
  gridTemplateColumns:
    "1fr 1.2fr 1.1fr",
  gap: "10px",
};

const panelStyle = {
  backgroundColor: "white",
  borderRadius: "6px",
  overflow: "hidden",
};

const tableHeaderStyle = {
  display: "grid",
  gridTemplateColumns:
    "1.6fr 1fr",
  padding: "9px",
  backgroundColor: "#eef4f8",
  fontSize: "11px",
  fontWeight: "bold",
};

const incomeRowStyle = {
  display: "grid",
  gridTemplateColumns:
    "1.6fr 1fr",
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

const missingReadingStyle = {
  padding: "7px",
  border: "1px solid #fecaca",
  backgroundColor: "#fef2f2",
  color: "#991b1b",
  borderRadius: "4px",
  textAlign: "center",
  fontWeight: "bold",
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

const platformStatusStyle = {
  display: "flex",
  justifyContent: "space-between",
  padding: "6px 9px",
  fontSize: "10px",
};

const platformHeaderStyle = {
  display: "grid",
  padding: "8px",
  textAlign: "center",
  backgroundColor: "#eaf6ef",
  fontSize: "10px",
  fontWeight: "bold",
};

const platformRowStyle = {
  display: "grid",
  gap: "6px",
  padding: "5px 8px",
  alignItems: "center",
  fontSize: "11px",
};

const savedTextStyle = {
  fontSize: "8px",
  color: "#15803d",
};

const outputBoxStyle = {
  padding: "7px",
  textAlign: "right",
  fontWeight: "bold",
};

const platformActionsStyle = {
  padding: "8px",
  display: "grid",
  gap: "5px",
};

const completeStyle = {
  padding: "7px",
  textAlign: "center",
  backgroundColor: "#ecfdf5",
  color: "#166534",
  fontWeight: "bold",
};

const waitingStyle = {
  padding: "8px",
  textAlign: "center",
  backgroundColor: "#eff6ff",
  color: "#1e40af",
  borderRadius: "5px",
  fontWeight: "bold",
  fontSize: "11px",
};

const warningStyle = {
  padding: "8px",
  textAlign: "center",
  backgroundColor: "#fef2f2",
  color: "#991b1b",
  borderRadius: "5px",
  fontWeight: "bold",
  fontSize: "11px",
};

const greenActionStyle = {
  width: "100%",
  padding: "9px",
  border: "none",
  backgroundColor: "#07912a",
  color: "white",
  borderRadius: "5px",
  fontWeight: "bold",
};

const blueActionStyle = {
  ...greenActionStyle,
  backgroundColor: "#0873b9",
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
    "repeat(3,1fr)",
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
