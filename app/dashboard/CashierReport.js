"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import CashierSavingsPanel from "./CashierSavingsPanel";
import CashierSalaryPanel from "./CashierSalaryPanel";
import CashierAccountsPanel from "./CashierAccountsPanel";
import CashierAccountsReturnPanel from "./CashierAccountsReturnPanel";
import CashierCloseShiftButton from "./CashierCloseShiftButton";
import CashierAttendancePanel from "./CashierAttendancePanel";
import CashierLiveFeedPanel from "./CashierLiveFeedPanel";

import {
  pageStyle, loadingStyle, topHeaderStyle, brandWrapStyle,
  crownStyle, brandStyle, taglineStyle, headerRightStyle,
  headerShopStyle, logoutButtonStyle, bodyStyle, sidebarStyle,
  mainStyle, topGridStyle, shopCardStyle, shopTitleStyle,
  shopSubtitleStyle, smallTextStyle, infoValueStyle, infoTitleStyle,
  infoSubvalueStyle, reportGridStyle, panelStyle, tableHeaderStyle,
  incomeRowStyle, amountBoxStyle, moneyInputStyle, savedMoneyStyle,
  lockedMoneyStyle, missingReadingStyle, readOnlyInlineStyle,
  incomeTotalStyle, companyFloatNoticeStyle, automaticExpenseNoticeStyle,
  panelButtonWrapStyle, platformStatusStyle, platformHeaderStyle,
  platformRowStyle, savedTextStyle, outputBoxStyle, platformActionsStyle,
  completeStyle, waitingStyle, warningStyle, blueActionStyle,
  redActionStyle, expenseHeaderStyle, expenseRowStyle, expenseInputStyle,
  savedExpenseStyle, expenseTotalStyle, summaryGridStyle, summaryValueStyle,
  lowerGridStyle, shiftGreetingStyle, messageStyle, getSidebarItemStyle,
  sidebarIconStyle, getInfoCardStyle, getInfoCardAccentStyle,
  getPanelTitleStyle, getSummaryBoxStyle,
} from "./CashierProfessionalTheme";

const emptyExpenses = () =>
  Array.from({ length: 10 }, () => ({ description: "", amount: "" }));

export default function CashierReport({ user, currentShift }) {
  const router = useRouter();
  const [shift, setShift] = useState(currentShift || null);
  const [platforms, setPlatforms] = useState([]);
  const [readings, setReadings] = useState([]);
  const [incomeEntries, setIncomeEntries] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [openingInputs, setOpeningInputs] = useState({});
  const [closingInputs, setClosingInputs] = useState({});
  const [expenseInputs, setExpenseInputs] = useState(emptyExpenses);
  const [loading, setLoading] = useState(true);
  const [savingClosing, setSavingClosing] = useState(false);
  const [savingExpenses, setSavingExpenses] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [now, setNow] = useState(() => new Date());
  const requestIdRef = useRef(0);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const accessToken = user?.access_token || null;
  const shiftId = currentShift?.id || null;
  const shopId = currentShift?.shop_id || user?.shop_id || user?.shopId || null;
  const cashierId =
    user?.profile_id || user?.id || user?.user_id || user?.auth_user_id || null;
  const shopName = user?.shop || user?.shop_name || user?.shopName || "SHOP";
  const cashierName =
    user?.full_name || user?.name || user?.username || "Cashier";

  // Use data from this particular shift, never from a previous shift.
  const activeShift = shift?.id === shiftId ? shift : currentShift;
  const shiftStatus = String(activeShift?.status || "").trim().toUpperCase();
  const isShiftOpen = shiftStatus === "OPEN";
  const closingWindowOpen = is12HourClosingAvailable(activeShift, now);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Prevent unsaved inputs and old requests crossing shift IDs.
    requestIdRef.current += 1;
    setShift(currentShift || null);
    setPlatforms([]);
    setReadings([]);
    setIncomeEntries([]);
    setExpenses([]);
    setOpeningInputs({});
    setClosingInputs({});
    setExpenseInputs(emptyExpenses());
    setLoading(true);
    setMessage("");
    setMessageType("");
  }, [shiftId]);

  const loadReport = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    if (!shiftId || !shopId || !accessToken || !supabaseUrl || !supabaseAnonKey) {
      setLoading(false);
      return;
    }

    const headers = authHeaders(supabaseAnonKey, accessToken);
    const base = `${supabaseUrl}/rest/v1`;
    const encodedId = encodeURIComponent(shiftId);
    try {
      const responses = await Promise.all([
        fetch(`${base}/shifts?id=eq.${encodedId}&select=*&limit=1`, {
          headers, cache: "no-store",
        }),
        fetch(
          `${base}/shop_platforms?shop_id=eq.${encodeURIComponent(shopId)}` +
            `&is_active=eq.true&select=id,platform_name,reading_type,display_order` +
            `&order=display_order.asc`,
          { headers, cache: "no-store" }
        ),
        fetch(
          `${base}/platform_readings?shift_id=eq.${encodedId}` +
            `&select=id,platform_id,reading_kind,reading_value,recorded_at`,
          { headers, cache: "no-store" }
        ),
        fetch(
          `${base}/shift_income_entries?shift_id=eq.${encodedId}` +
            `&select=id,entry_type,description,amount,created_at&order=created_at.asc`,
          { headers, cache: "no-store" }
        ),
        fetch(
          `${base}/expenses?shift_id=eq.${encodedId}` +
            `&select=id,description,amount,created_at,source_type,source_record_id,is_private` +
            `&order=created_at.asc`,
          { headers, cache: "no-store" }
        ),
      ]);
      const results = await Promise.all(responses.map(safeJson));
      const errors = [
        "Unable to load shift.", "Unable to load platforms.",
        "Unable to load readings.", "Unable to load float entries.",
        "Unable to load expenses.",
      ];
      responses.forEach((response, index) => {
        if (!response.ok) {
          throw new Error(
            results[index]?.message || results[index]?.details || errors[index]
          );
        }
      });

      const latestShift = Array.isArray(results[0]) ? results[0][0] : null;
      if (!latestShift || String(latestShift.shop_id) !== String(shopId)) {
        throw new Error("The selected shift was not found in this shop.");
      }
      if (requestIdRef.current !== requestId) return;

      const nextPlatforms = Array.isArray(results[1]) ? results[1] : [];
      const nextReadings = Array.isArray(results[2]) ? results[2] : [];
      const nextIncome = Array.isArray(results[3]) ? results[3] : [];
      const nextExpenses = Array.isArray(results[4]) ? results[4] : [];
      const manual = nextExpenses.filter(isManualPublicExpense);
      const openingMap = new Map();
      const closingMap = new Map();
      for (const row of nextReadings) {
        if (row.reading_kind === "OPENING") openingMap.set(row.platform_id, row);
        if (row.reading_kind === "CLOSING") closingMap.set(row.platform_id, row);
      }

      setShift(latestShift);
      setPlatforms(nextPlatforms);
      setReadings(nextReadings);
      setIncomeEntries(nextIncome);
      setExpenses(nextExpenses);
      setOpeningInputs((old) => {
        const next = {};
        for (const platform of nextPlatforms) {
          const saved = openingMap.get(platform.id);
          next[platform.id] = saved
            ? String(saved.reading_value ?? "")
            : old[platform.id] ?? "";
        }
        return next;
      });
      setClosingInputs((old) => {
        const next = {};
        for (const platform of nextPlatforms) {
          const saved = closingMap.get(platform.id);
          next[platform.id] = saved
            ? String(saved.reading_value ?? "")
            : old[platform.id] ?? "";
        }
        return next;
      });
      setExpenseInputs((old) =>
        Array.from({ length: 10 }, (_, index) =>
          manual[index]
            ? {
                description: manual[index].description || "",
                amount: String(manual[index].amount ?? ""),
              }
            : old[index] || { description: "", amount: "" }
        )
      );
    } catch (error) {
      console.error("CASHIER REPORT ERROR:", error);
      if (requestIdRef.current === requestId) {
        setMessage(error?.message || "Unable to load cashier report.");
        setMessageType("error");
      }
    } finally {
      if (requestIdRef.current === requestId) setLoading(false);
    }
  }, [shiftId, shopId, accessToken, supabaseUrl, supabaseAnonKey]);

  useEffect(() => {
    loadReport();
    const timer = setInterval(loadReport, 5000);
    return () => {
      clearInterval(timer);
      requestIdRef.current += 1;
    };
  }, [loadReport]);

  function logout() {
    sessionStorage.removeItem("teamLegendUser");
    router.replace("/");
  }

  const savedOpeningIds = useMemo(
    () => new Set(readings.filter((r) => r.reading_kind === "OPENING").map((r) => r.platform_id)),
    [readings]
  );
  const savedClosingIds = useMemo(
    () => new Set(readings.filter((r) => r.reading_kind === "CLOSING").map((r) => r.platform_id)),
    [readings]
  );
  const savedOpeningCount = platforms.filter((p) => savedOpeningIds.has(p.id)).length;
  const savedClosingCount = platforms.filter((p) => savedClosingIds.has(p.id)).length;
  const allOpeningsSaved = platforms.length > 0 && savedOpeningCount === platforms.length;
  const allClosingsSaved = platforms.length > 0 && savedClosingCount === platforms.length;
  const showClosing = closingWindowOpen || savedClosingCount > 0 || shiftStatus === "CLOSED";
  const platformGridColumns = showClosing ? "1.25fr 1fr 1fr 1fr" : "1.25fr 1fr 1fr";

  const floatData = useMemo(() => {
    const companyEntries = incomeEntries.filter((e) => e.entry_type === "COMPANY_FLOAT");
    const mshwariEntries = incomeEntries.filter((e) => e.entry_type === "MSHWARI_FLOAT");
    return {
      companyEntries,
      mshwariEntries,
      companyTotal: roundMoney(companyEntries.reduce((sum, e) => sum + Number(e.amount || 0), 0)),
      mshwariTotal: roundMoney(mshwariEntries.reduce((sum, e) => sum + Number(e.amount || 0), 0)),
    };
  }, [incomeEntries]);
  const companySlots = Array.from({ length: 3 }, (_, i) => floatData.companyEntries[i] || null);
  const mshwariSlots = Array.from({ length: 3 }, (_, i) => floatData.mshwariEntries[i] || null);
  const manualExpenses = useMemo(() => expenses.filter(isManualPublicExpense), [expenses]);

  const platformRows = useMemo(
    () => platforms.map((platform) => {
      const openingRow = readings.find(
        (r) => r.platform_id === platform.id && r.reading_kind === "OPENING"
      );
      const closingRow = readings.find(
        (r) => r.platform_id === platform.id && r.reading_kind === "CLOSING"
      );
      const opening = numericOrNull(openingRow ? openingRow.reading_value : openingInputs[platform.id]);
      const closing = numericOrNull(closingRow ? closingRow.reading_value : closingInputs[platform.id]);
      return {
        ...platform,
        opening,
        closing,
        output: opening !== null && closing !== null ? roundMoney(closing - opening) : 0,
        openingSaved: Boolean(openingRow),
        closingSaved: Boolean(closingRow),
      };
    }),
    [platforms, readings, openingInputs, closingInputs]
  );

  // ==================================================
  // CHECK OPEN STATUS BEFORE CASHIER WRITES
  // Supabase must independently enforce permissions.
  // ==================================================

  async function verifyShiftOpen() {
    if (!shiftId || !shopId || !accessToken || !supabaseUrl || !supabaseAnonKey) {
      throw new Error("Shift or login information is missing.");
    }
    const response = await fetch(
      `${supabaseUrl}/rest/v1/shifts?id=eq.${encodeURIComponent(shiftId)}` +
        `&select=id,shop_id,status,business_date&limit=1`,
      {
        headers: authHeaders(supabaseAnonKey, accessToken),
        cache: "no-store",
      }
    );
    const result = await safeJson(response);
    if (!response.ok) {
      throw new Error(result?.message || "Unable to verify shift status.");
    }
    const fresh = Array.isArray(result) ? result[0] : null;
    if (!fresh || String(fresh.shop_id) !== String(shopId) ||
        String(fresh.status || "").toUpperCase() !== "OPEN") {
      throw new Error("This shift is not OPEN. Contact Admin for recovery.");
    }
    return fresh;
  }

  // ==================================================
  // SAVE MANUAL EXPENSES
  // ==================================================
async function saveExpenses() {
    if (savingExpenses) return;
    if (!isShiftOpen) {
      setMessage("This shift is closed. Contact Admin for corrections.");
      setMessageType("error");
      return;
    }
    const rowsToSave = [];
    for (let i = 0; i < 10; i += 1) {
      if (manualExpenses[i]) continue;
      const description = String(expenseInputs[i]?.description || "").trim();
      const raw = expenseInputs[i]?.amount;
      const hasAmount = raw !== "" && raw !== null && raw !== undefined;
      if (!description && !hasAmount) continue;
      if (!description) {
        setMessage(`Enter the description for expense ${i + 1}.`);
        setMessageType("error");
        return;
      }
      const amount = Number(raw);
      if (!hasAmount || !Number.isFinite(amount) || amount <= 0) {
        setMessage(`Enter a valid amount for expense ${i + 1}.`);
        setMessageType("error");
        return;
      }
      rowsToSave.push({
        shift_id: shiftId, description, amount: roundMoney(amount),
        created_by: cashierId, source_type: "MANUAL", is_private: false,
      });
    }
    if (!rowsToSave.length) {
      setMessage("Enter at least one manual expense.");
      setMessageType("error");
      return;
    }

    let posted = false;
    try {
      setSavingExpenses(true);
      setMessage("");
      setMessageType("");
      await verifyShiftOpen();
      const response = await fetch(`${supabaseUrl}/rest/v1/expenses`, {
        method: "POST",
        headers: {
          ...authHeaders(supabaseAnonKey, accessToken),
          Prefer: "return=representation",
        },
        body: JSON.stringify(rowsToSave),
      });
      const inserted = await safeJson(response);
      if (!response.ok) {
        throw new Error(inserted?.message || inserted?.details || "Unable to save expenses.");
      }
      if (!Array.isArray(inserted) || inserted.length !== rowsToSave.length) {
        throw new Error("Expense save response was incomplete. Refresh before retrying.");
      }
      posted = true;

      // Re-read persisted expenses rather than writing a stale local total.
      const summaryResponse = await fetch(
        `${supabaseUrl}/rest/v1/expenses?shift_id=eq.${encodeURIComponent(shiftId)}` +
          `&select=amount`,
        { headers: authHeaders(supabaseAnonKey, accessToken), cache: "no-store" }
      );
      const summaryRows = await safeJson(summaryResponse);
      if (!summaryResponse.ok || !Array.isArray(summaryRows)) {
        throw new Error("Expenses were saved, but the total must be reconciled.");
      }
      const newExpenseTotal = roundMoney(
        summaryRows.reduce((sum, row) => sum + Number(row.amount || 0), 0)
      );
      const shiftResponse = await fetch(
        `${supabaseUrl}/rest/v1/shifts?id=eq.${encodeURIComponent(shiftId)}&status=eq.OPEN`,
        {
          method: "PATCH",
          headers: {
            ...authHeaders(supabaseAnonKey, accessToken),
            Prefer: "return=representation",
          },
          body: JSON.stringify({ total_expenses: newExpenseTotal }),
        }
      );
      const updated = await safeJson(shiftResponse);
      if (!shiftResponse.ok || !Array.isArray(updated) || !updated.length) {
        throw new Error("Expenses saved, but the shift total was not updated.");
      }
      setMessage("Expenses saved successfully.");
      setMessageType("success");
    } catch (error) {
      setMessage(posted
        ? `Expenses were saved. Do not resubmit; Admin must check totals. ${error?.message || ""}`
        : error?.message || "Unable to save expenses.");
      setMessageType("error");
    } finally {
      setSavingExpenses(false);
      await loadReport();
    }
  }

  // ==================================================
  // SAVE CLOSING READINGS — DATE AWARE, NO EXPIRY
  // ==================================================

  async function saveClosingReadings() {
    if (savingClosing) return;
    if (!isShiftOpen) {
      setMessage("This shift is closed. Contact Admin for recovery.");
      setMessageType("error");
      return;
    }
    if (!is12HourClosingAvailable(activeShift, new Date())) {
      setMessage("Closing readings open at 9:30 PM on this shift's business date.");
      setMessageType("error");
      return;
    }
    if (!allOpeningsSaved) {
      setMessage("Automatic opening readings are incomplete. Contact Admin.");
      setMessageType("error");
      return;
    }
    if (!platforms.length) {
      setMessage("No active platforms were found.");
      setMessageType("error");
      return;
    }

    let posted = false;
    try {
      setSavingClosing(true);
      setMessage("");
      setMessageType("");
      const freshShift = await verifyShiftOpen();
      if (!is12HourClosingAvailable(freshShift, new Date())) {
        throw new Error("Closing time for this shift has not arrived.");
      }
      const response = await fetch(
        `${supabaseUrl}/rest/v1/platform_readings?shift_id=eq.${encodeURIComponent(shiftId)}` +
          `&select=id,platform_id,reading_kind,reading_value`,
        {
          headers: authHeaders(supabaseAnonKey, accessToken),
          cache: "no-store",
        }
      );
      const freshRows = await safeJson(response);
      if (!response.ok || !Array.isArray(freshRows)) {
        throw new Error(freshRows?.message || "Unable to verify existing readings.");
      }
      const freshOpenings = new Map(
        freshRows.filter((r) => r.reading_kind === "OPENING").map((r) => [r.platform_id, r])
      );
      const freshClosings = new Map(
        freshRows.filter((r) => r.reading_kind === "CLOSING").map((r) => [r.platform_id, r])
      );
      const unsaved = platforms.filter((p) => !freshClosings.has(p.id));
      if (!unsaved.length) {
        setMessage("Closing readings are already saved.");
        setMessageType("success");
        await loadReport();
        return;
      }
      const recordedAt = new Date().toISOString();
      const payload = unsaved.map((platform) => {
        const opening = numericOrNull(freshOpenings.get(platform.id)?.reading_value);
        const closing = numericOrNull(closingInputs[platform.id]);
        if (opening === null) {
          throw new Error(`Opening reading for ${platform.platform_name} is missing. Contact Admin.`);
        }
        // Signed readings remain valid: negative, zero and positive.
        if (closing === null) {
          throw new Error(`Enter a valid closing reading for ${platform.platform_name}.`);
        }
        return {
          shift_id: shiftId,
          platform_id: platform.id,
          reading_kind: "CLOSING",
          reading_value: roundMoney(closing),
          recorded_at: recordedAt,
          recorded_by: cashierId,
        };
      });
      const insertResponse = await fetch(`${supabaseUrl}/rest/v1/platform_readings`, {
        method: "POST",
        headers: {
          ...authHeaders(supabaseAnonKey, accessToken),
          Prefer: "return=representation",
        },
        body: JSON.stringify(payload),
      });
      const insertedRows = await safeJson(insertResponse);
      if (!insertResponse.ok) {
        throw new Error(insertedRows?.message || insertedRows?.details || "Unable to save readings.");
      }
      if (!Array.isArray(insertedRows) || insertedRows.length !== payload.length) {
        throw new Error("Reading save response was incomplete. Refresh before retrying.");
      }
      posted = true;
      for (const row of insertedRows) freshClosings.set(row.platform_id, row);
      let totalOutput = 0;
      for (const platform of platforms) {
        const opening = numericOrNull(freshOpenings.get(platform.id)?.reading_value);
        const closing = numericOrNull(freshClosings.get(platform.id)?.reading_value);
        if (opening !== null && closing !== null) totalOutput += closing - opening;
      }
      const patchResponse = await fetch(
        `${supabaseUrl}/rest/v1/shifts?id=eq.${encodeURIComponent(shiftId)}&status=eq.OPEN`,
        {
          method: "PATCH",
          headers: {
            ...authHeaders(supabaseAnonKey, accessToken),
            Prefer: "return=representation",
          },
          body: JSON.stringify({ total_output: roundMoney(totalOutput) }),
        }
      );
      const patchResult = await safeJson(patchResponse);
      if (!patchResponse.ok || !Array.isArray(patchResult) || !patchResult.length) {
        throw new Error("Readings saved, but sales total could not be updated.");
      }
      setMessage("Closing readings saved successfully.");
      setMessageType("success");
    } catch (error) {
      setMessage(posted
        ? `Readings were saved. Do not re-enter them; Admin must check the output. ${error?.message || ""}`
        : error?.message || "Unable to save closing readings.");
      setMessageType("error");
    } finally {
      setSavingClosing(false);
      await loadReport();
    }
  }

  const openingBalance = Number(activeShift?.opening_balance || 0);
  const savedTotalOutput = Number(activeShift?.total_output || 0);
  const totalExpenses = Number(activeShift?.total_expenses || 0);
  const closingBalance = Number(activeShift?.closing_balance || 0);
  const totalAdded = roundMoney(openingBalance + floatData.companyTotal + floatData.mshwariTotal);
  const totalSales = roundMoney(totalAdded + savedTotalOutput);
  const reportDate = formatReportDate(activeShift?.business_date || activeShift?.opened_at || new Date());
  const reportDay = formatReportDay(activeShift?.business_date || activeShift?.opened_at || new Date());
  const shiftNumber = getShiftNumber(activeShift);
  const shiftGreeting = getShiftGreeting(now, shiftStatus, shiftNumber);

  if (loading && !activeShift) {
    return <div style={loadingStyle}>Loading cashier report...</div>;
  }
  if (!activeShift) return null;
  return (
    <div style={pageStyle}>
      <header style={topHeaderStyle}>
        <div style={brandWrapStyle}>
          <div style={crownStyle}>♛</div>
          <div>
            <div style={brandStyle}>TEAM LEGEND</div>
            <div style={taglineStyle}>DISCIPLINE • FOCUS • RESULTS</div>
          </div>
        </div>
        <div style={headerRightStyle}>
          <div>
            Welcome, <strong>{cashierName.toUpperCase()}</strong>
            <div style={headerShopStyle}>{shopName.toUpperCase()}</div>
          </div>
          <button type="button" onClick={logout} style={logoutButtonStyle}>
            Logout
          </button>
        </div>
      </header>

      <CashierLiveFeedPanel user={user} />
      <CashierAttendancePanel user={user} currentShift={activeShift} />

      <div style={bodyStyle}>
        <aside style={sidebarStyle}>
          <SidebarItem active icon="⌂" label="Cashier Report" />
          <SidebarItem icon="▤" label="View Reports" />
          <SidebarItem icon="▥" label="Management" />
          <SidebarItem icon="▦" label="Accounts" />
          <SidebarItem icon="⚙" label="Settings" />
        </aside>

        <main style={mainStyle}>
          <div style={topGridStyle}>
            <TopCard title={shopName.toUpperCase()} subtitle="DAILY SALES REPORT" footer="12-HOUR SHOP" />
            <InfoCard title="CASHIER ON DUTY" value={cashierName} tone="brown" />
            <InfoCard title="DATE" value={reportDate} />
            <InfoCard title="DAY" value={reportDay} />
            <InfoCard
              title="SHIFT"
              value={activeShift.shift_name || "DAY"}
              subvalue={`${displayTime(activeShift.scheduled_start)} - ${displayTime(activeShift.scheduled_end)}`}
              tone="green"
            />
            <InfoCard title="STATUS" value={shiftStatus} tone="green" />
          </div>

          <div style={shiftGreetingStyle}>{shiftGreeting}</div>
          {message && (
            <div style={{
              ...messageStyle,
              backgroundColor: messageType === "success" ? "#ecfdf5" : "#fef2f2",
              color: messageType === "success" ? "#166534" : "#991b1b",
            }}>
              {message}
            </div>
          )}

          <div style={reportGridStyle}>
            {/* INCOME — READ ONLY COMPANY AND M-SHWARI FLOATS */}
            <section style={panelStyle}>
              <PanelTitle title="INCOME STATEMENT" tone="blue" />
              <div style={tableHeaderStyle}>
                <div>DESCRIPTION</div><div>AMOUNT (KES)</div>
              </div>
              <IncomeDisplayRow label="Balance B/F (Previous Shift)" amount={openingBalance} />
              {companySlots.map((entry, i) => (
                <ReadOnlyFloatRow key={`company-${i}`} label={`Added Float ${i + 1} From Company`} entry={entry} />
              ))}
              {mshwariSlots.map((entry, i) => (
                <ReadOnlyFloatRow key={`mshwari-${i}`} label={`Added Float ${i + 1} From M-Shwari`} entry={entry} />
              ))}
              <div style={incomeTotalStyle}>
                <strong>TOTAL ADDED</strong><strong>{money(totalAdded)}</strong>
              </div>
              <div style={companyFloatNoticeStyle}>
                Company Float and M-Shwari Float 1, 2 and 3 are read-only.
                Company Float is posted by Legend Accounts. M-Shwari Float is
                added automatically after a Savings withdrawal.
              </div>
            </section>

            {/* PLATFORM SALES */}
            <section style={panelStyle}>
              <PanelTitle title="PLATFORM SALES" tone="green" />
              <div style={platformStatusStyle}>
                <span>Opening: {savedOpeningCount}/{platforms.length}</span>
                {showClosing && <span>Closing: {savedClosingCount}/{platforms.length}</span>}
              </div>
              <div style={{ ...platformHeaderStyle, gridTemplateColumns: platformGridColumns }}>
                <div>SHOP / PLATFORM</div>
                <div>OPENING</div>
                {showClosing && <div>CLOSING</div>}
                <div>SALES</div>
              </div>
              {platformRows.map((platform) => (
                <div key={platform.id} style={{ ...platformRowStyle, gridTemplateColumns: platformGridColumns }}>
                  <div>
                    <strong>{platform.platform_name}</strong>
                    {platform.openingSaved && <div style={savedTextStyle}>Opening ✓</div>}
                    {showClosing && platform.closingSaved && <div style={savedTextStyle}>Closing ✓</div>}
                  </div>
                  {platform.openingSaved
                    ? <SavedReadingBox value={platform.opening} />
                    : <div style={missingReadingStyle}>Missing</div>}
                  {showClosing && (
                    platform.closingSaved
                      ? <SavedReadingBox value={platform.closing} />
                      : <ReadingInput
                          value={closingInputs[platform.id] ?? ""}
                          disabled={!closingWindowOpen || !allOpeningsSaved || !isShiftOpen || savingClosing}
                          onChange={(value) => setClosingInputs((old) => ({ ...old, [platform.id]: value }))}
                        />
                  )}
                  <div style={outputBoxStyle}>{money(platform.output)}</div>
                </div>
              ))}
              <div style={platformActionsStyle}>
                {!allOpeningsSaved && (
                  <div style={warningStyle}>
                    Automatic opening readings are incomplete. Contact Admin.
                  </div>
                )}
                {!showClosing && allOpeningsSaved && (
                  <div style={waitingStyle}>
                    Closing readings become available at 9:30 PM on this shift's business date.
                  </div>
                )}
                {showClosing && closingWindowOpen && isShiftOpen &&
                  allOpeningsSaved && !allClosingsSaved && (
                    <button type="button" onClick={saveClosingReadings}
                      disabled={savingClosing || loading}
                      style={blueActionStyle}>
                      {savingClosing ? "Saving Closing Readings..." : "Save Closing Readings"}
                    </button>
                  )}
                {allOpeningsSaved && <div style={completeStyle}>Opening Readings Saved ✓</div>}
                {allClosingsSaved && <div style={completeStyle}>Closing Readings Saved ✓</div>}
                {!isShiftOpen && <div style={warningStyle}>Shift closed. Contact Admin for corrections.</div>}
              </div>
            </section>

            {/* EXPENSES */}
            <section style={panelStyle}>
              <PanelTitle title="EXPENSES" tone="red" />
              <div style={expenseHeaderStyle}>
                <div>NO.</div><div>DESCRIPTION</div><div>AMOUNT (KES)</div>
              </div>
              {Array.from({ length: 10 }, (_, index) => {
                const saved = manualExpenses[index];
                return (
                  <div key={index} style={expenseRowStyle}>
                    <div>{index + 1}</div>
                    {saved ? (
                      <>
                        <div style={savedExpenseStyle}>{saved.description}</div>
                        <div style={savedExpenseStyle}>{money(saved.amount)} ✓</div>
                      </>
                    ) : (
                      <>
                        <input
                          value={expenseInputs[index]?.description || ""}
                          disabled={!isShiftOpen || savingExpenses}
                          placeholder="Description"
                          onChange={(event) => {
                            const value = event.target.value;
                            setExpenseInputs((old) => old.map((item, i) =>
                              i === index ? { ...item, description: value } : item
                            ));
                          }}
                          style={expenseInputStyle}
                        />
                        <input
                          type="number" min="0" step="0.01"
                          value={expenseInputs[index]?.amount ?? ""}
                          disabled={!isShiftOpen || savingExpenses}
                          placeholder="0.00"
                          onChange={(event) => {
                            const value = event.target.value;
                            setExpenseInputs((old) => old.map((item, i) =>
                              i === index ? { ...item, amount: value } : item
                            ));
                          }}
                          style={expenseInputStyle}
                        />
                      </>
                    )}
                  </div>
                );
              })}
              <div style={expenseTotalStyle}>
                <strong>TOTAL EXPENSES</strong><strong>{money(totalExpenses)}</strong>
              </div>
              <div style={automaticExpenseNoticeStyle}>
                Savings are added automatically to Total Expenses when saved.
                Cashier → Legend Accounts transfers are added after Accounts confirms receipt.
              </div>
              <div style={panelButtonWrapStyle}>
                <button type="button" onClick={saveExpenses}
                  disabled={savingExpenses || !isShiftOpen || loading}
                  style={{ ...redActionStyle, opacity: savingExpenses || !isShiftOpen ? 0.6 : 1 }}>
                  {savingExpenses ? "Saving..." : "Save Expenses"}
                </button>
              </div>
            </section>
          </div>

          {/* SUMMARY */}
          <div style={summaryGridStyle}>
            <SummaryBox title="TOTAL SALES" amount={totalSales} tone="blue" />
            <SummaryBox title="TOTAL EXPENSES" amount={totalExpenses} tone="red" />
            <SummaryBox title="CLOSING BALANCE" amount={closingBalance} tone="navy" />
          </div>

          {/* LOWER PANELS */}
          <div style={lowerGridStyle}>
            <CashierSavingsPanel user={user} currentShift={activeShift} />
            <CashierSalaryPanel user={user} currentShift={activeShift} />
            <CashierAccountsPanel user={user} />
            <CashierAccountsReturnPanel
              user={user}
              currentShift={activeShift}
              onReturnChanged={loadReport}
            />
          </div>

          {/* The ONE cashier shift-close action. */}
          <CashierCloseShiftButton user={user} currentShift={activeShift} />
        </main>
      </div>
    </div>
  );
}

// ==================================================
// SMALL COMPONENTS
// ==================================================
function SidebarItem({ icon, label, active }) {
  return (
    <div style={getSidebarItemStyle(active)}>
      <span style={sidebarIconStyle}>{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function TopCard({ title, subtitle, footer }) {
  return (
    <div style={shopCardStyle}>
      <div style={shopTitleStyle}>{title}</div>
      <div style={shopSubtitleStyle}>{subtitle}</div>
      <div style={smallTextStyle}>{footer}</div>
    </div>
  );
}

function InfoCard({ title, value, subvalue, tone }) {
  return (
    <div style={getInfoCardStyle(tone)}>
      <div style={infoTitleStyle}>{title}</div>
      <div style={infoValueStyle}>{value}</div>
      {subvalue ? <div style={infoSubvalueStyle}>{subvalue}</div> : null}
      <div style={getInfoCardAccentStyle(tone)} />
    </div>
  );
}

function PanelTitle({ title, tone }) {
  return <div style={getPanelTitleStyle(tone)}>{title}</div>;
}

function IncomeDisplayRow({ label, amount }) {
  return (
    <div style={incomeRowStyle}>
      <div>{label}</div>
      <div style={amountBoxStyle}>{money(amount)}</div>
    </div>
  );
}

function ReadOnlyFloatRow({ label, entry }) {
  return (
    <div style={incomeRowStyle}>
      <div>{label} <span style={readOnlyInlineStyle}>{entry ? "✓" : "🔒"}</span></div>
      <div style={entry ? savedMoneyStyle : lockedMoneyStyle}>
        {entry ? money(entry.amount) : "0.00"}
      </div>
    </div>
  );
}

function ReadingInput({ value, onChange, disabled }) {
  return (
    <input type="number" step="0.01" value={value} disabled={disabled}
      onChange={(event) => onChange(event.target.value)} style={moneyInputStyle} />
  );
}

function SavedReadingBox({ value }) {
  return <div style={savedMoneyStyle}>{money(value)}</div>;
}

function SummaryBox({ title, amount, tone }) {
  return (
    <div style={getSummaryBoxStyle(tone)}>
      {title}
      <div style={summaryValueStyle}>KES {money(amount)}</div>
    </div>
  );
}

// ==================================================
// HELPERS
// ==================================================

function authHeaders(anonKey, token) {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function safeJson(response) {
  try { return await response.json(); } catch { return null; }
}

function isManualPublicExpense(expense) {
  const source = String(expense?.source_type || "").trim().toUpperCase();
  return (source === "" || source === "MANUAL") && expense?.is_private !== true;
}

function numericOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function money(value) {
  const number = Number(value ?? 0);
  return (Number.isFinite(number) ? number : 0).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

// Date-aware check: once 9:30 PM of the ORIGINAL business date passes,
// the closing stage remains available while this shift is OPEN.
function is12HourClosingAvailable(shift, now = new Date()) {
  const businessDate = String(shift?.business_date || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) return false;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const fields = {};
  for (const part of parts) {
    if (part.type !== "literal") fields[part.type] = part.value;
  }
  const dateTimeKey =
    `${fields.year}-${fields.month}-${fields.day}` +
    `T${fields.hour}:${fields.minute}:${fields.second}`;
  return dateTimeKey >= `${businessDate}T21:30:00`;
}

function reportDateValue(value) {
  // A bare YYYY-MM-DD is a Nairobi calendar date, not a UTC timestamp.
  const dateString = String(value || "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return new Date(`${dateString}T12:00:00+03:00`);
  }
  return new Date(value);
}

function formatReportDate(value) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi", day: "2-digit", month: "short", year: "numeric",
  }).format(reportDateValue(value));
}

function formatReportDay(value) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi", weekday: "long",
  }).format(reportDateValue(value));
}

function displayTime(value) {
  return String(value || "").split(".")[0].slice(0, 5);
}

function getShiftNumber(current) {
  const match = String(current?.shift_name || current?.name || "")
    .toUpperCase().match(/(?:SHIFT\s*)?([12])/);
  return match ? match[1] : "1";
}

function getShiftGreeting(date, status, number) {
  const state = String(status || "").toUpperCase();
  if (state === "CLOSED" || state === "COMPLETED") {
    return `Good Bye 👋 — Shift ${number} Closed`;
  }
  const hour = Number(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi", hour: "2-digit", hourCycle: "h23",
  }).format(date || new Date()));
  if (hour >= 5 && hour < 12) return `Good Morning 🌞 — Welcome to Shift ${number}`;
  if (hour >= 12 && hour < 17) return `Good Afternoon ☀️ — Welcome to Shift ${number}`;
  return `Good Evening 🌙 — Welcome to Shift ${number}`;
}
