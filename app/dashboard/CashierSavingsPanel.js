"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

// TEAM LEGEND — Shared 12H / 24H Savings and Banking.
//
// Utility Payment Control:
// - Electricity PAY accepts exact approved amounts.
// - REQUEST PAY previews Admin-configured fee.
// - Cashier reviews principal, fee and total.
// - Fee is rechecked before submitting.
// - Backend freezes fee when request is inserted.
// - Accountant confirmation expenses fee only.
//
// Banking:
// - Existing Manual Banking workflow preserved.
// - Existing Automatic Banking mode preserved.
// - Banking tariffs remain separate.

const PAYMENT_STATUS_SECONDS = 15;
const BANKING_ROUTE = "MPESA_TO_CONSOLIDATED";

const ELECTRICITY_AMOUNTS = [
  500,
  1000,
  1500,
  2000,
  2500,
  3000,
  3500,
  4000,
  4500,
  5000,
];

const CATEGORIES = [
  { key: "WIFI", label: "WiFi", fixedPayment: true },
  { key: "DSTV", label: "DStv", fixedPayment: true },
  { key: "RENT", label: "Rent", fixedPayment: true },
  {
    key: "ELECTRICITY",
    label: "Electricity",
    fixedPayment: false,
  },
  {
    key: "BANKING",
    label: "Banking",
    fixedPayment: false,
  },
];

const C = {
  bg: "#101F30",
  raised: "#15263A",
  inset: "#0A1725",
  border: "#2A3D52",
  muted: "#91A5B8",
  text: "#F0F5FA",
  sub: "#C4D0DC",
  gold: "#D9B66C",
};

const makeInputs = () =>
  Object.fromEntries(
    CATEGORIES.map(({ key }) => [
      key,
      { save: "", pay: "", withdraw: "" },
    ])
  );

export default function CashierSavingsPanel({
  user,
  currentShift,
  bankingActive = false,
}) {
  const [bankingTarget, setBankingTarget] = useState(null);
  useEffect(() => {
    setBankingTarget(document.getElementById("tl-cashier-banking-slot"));
  }, []);
  const [categories, setCategories] = useState([]);
  // Null means the server has not supplied a verified DStv setting.
  const [dstvEnabled, setDstvEnabled] = useState(null);
  const [paymentRequests, setPaymentRequests] =
    useState([]);
  const [bankingEmployees, setBankingEmployees] =
    useState([]);
  const [bankingMode, setBankingMode] = useState(null);
  const [employeeId, setEmployeeId] = useState("");

  const [inputs, setInputs] = useState(makeInputs);
  const [utilitySaveCategory, setUtilitySaveCategory] = useState("WIFI");
  const [mshwariAction, setMshwariAction] = useState("SAVE");
  const [combinedWithdrawAmount, setCombinedWithdrawAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionKey, setActionKey] = useState("");
  const [notice, setNotice] = useState(null);

  const [
    paymentStatusOpen,
    setPaymentStatusOpen,
  ] = useState(true);

  const [
    bankingPayModal,
    setBankingPayModal,
  ] = useState(null);

  const [
    bankingModalError,
    setBankingModalError,
  ] = useState("");

  // NEW: Utility confirmation popup.
  const [
    utilityPayModal,
    setUtilityPayModal,
  ] = useState(null);

  const [
    utilityModalError,
    setUtilityModalError,
  ] = useState("");

  const busyRef = useRef(false);
  const referenceInputRef = useRef(null);
  const savingsRequestRef = useRef(null);
  const savingsGenerationRef = useRef(0);
  const savingsContextRef = useRef("");

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const token = user?.access_token || null;
  const shiftId = currentShift?.id || null;
  const savingsContext = `${shiftId || ""}|${token || ""}`;
  // Track the latest session during render so old responses cannot commit.
  savingsContextRef.current = savingsContext;

  const utilityBusy =
    actionKey.startsWith("QUOTE-UTILITY") ||
    actionKey.startsWith("PAY-UTILITY");

  // FIVE-SECOND NOTIFICATIONS

  useEffect(() => {
    if (!notice) return;

    const timer = setTimeout(
      () => setNotice(null),
      5000
    );

    return () => clearTimeout(timer);
  }, [notice]);

  // PAYMENT STATUS AUTO-COLLAPSE

  useEffect(() => {
    setPaymentStatusOpen(true);
  }, [shiftId]);

  useEffect(() => {
    if (
      !paymentStatusOpen ||
      loading ||
      paymentRequests.length === 0
    ) {
      return;
    }

    const timer = setTimeout(() => {
      setPaymentStatusOpen(false);
    }, PAYMENT_STATUS_SECONDS * 1000);

    return () => clearTimeout(timer);
  }, [
    paymentStatusOpen,
    loading,
    paymentRequests.length,
  ]);

  // BANKING REFERENCE FOCUS

  useEffect(() => {
    if (bankingPayModal) {
      referenceInputRef.current?.focus();
    }
  }, [Boolean(bankingPayModal)]);

  // CLOSE UNSENT POPUPS WHEN SHIFT CHANGES

  useEffect(() => {
    setBankingPayModal(null);
    setBankingModalError("");

    setUtilityPayModal(null);
    setUtilityModalError("");
  }, [shiftId]);

  function notify(text, type = "error") {
    setNotice({ text, type });
  }

  // SUPABASE RPC HELPER

  const callRpc = useCallback(
    async (rpc, body) => {
      if (!supabaseUrl || !anonKey || !token) {
        throw new Error(
          "Payment service unavailable. Please sign in again."
        );
      }

      const response = await fetch(
        `${supabaseUrl}/rest/v1/rpc/${rpc}`,
        {
          method: "POST",
          headers: authHeaders(anonKey, token),
          body: JSON.stringify(body),
          cache: "no-store",
        }
      );

      const result = await safeJson(response);

      if (!response.ok) {
        throw new Error(
          result?.message ||
            result?.details ||
            result?.hint ||
            "Payment operation failed."
        );
      }

      return result;
    },
    [supabaseUrl, anonKey, token]
  );

  // LOAD SAVINGS AND BANKING — GUARDED REFRESH
  // silent=true: background refresh (skip if one is running).
  // silent=false: initial refresh (priority).
  // priority=true: force a fresh read after a financial operation.
  const loadSavings = useCallback(
    async (silent = false, priority = false) => {
      if (!shiftId || !token || !supabaseUrl || !anonKey) {
        if (!silent) setLoading(false);
        return;
      }

      // Background refreshes never interrupt financial actions.
      if (silent && !priority && busyRef.current) return;
      if (silent && !priority && savingsRequestRef.current) return;

      if (savingsRequestRef.current) {
        savingsRequestRef.current.abort();
      }

      const controller = new AbortController();
      savingsRequestRef.current = controller;
      const generation = ++savingsGenerationRef.current;
      const context = savingsContext;
      const isCurrent = () =>
        !controller.signal.aborted &&
        savingsRequestRef.current === controller &&
        savingsGenerationRef.current === generation &&
        savingsContextRef.current === context;

      try {
        if (!silent) setLoading(true);
        const headers = authHeaders(anonKey, token);
        const [savingsResponse, bankingResponse] = await Promise.all([
          fetch(`${supabaseUrl}/rest/v1/rpc/tl_cashier_savings_snapshot`, {
            method: "POST",
            headers,
            body: JSON.stringify({ p_shift_id: shiftId }),
            cache: "no-store",
            signal: controller.signal,
          }),
          fetch(`${supabaseUrl}/rest/v1/rpc/tl_cashier_banking_directory`, {
            method: "POST",
            headers,
            body: JSON.stringify({ p_shift_id: shiftId }),
            cache: "no-store",
            signal: controller.signal,
          }),
        ]);

        const [savingsResult, bankingResult] = await Promise.all([
          safeJson(savingsResponse),
          safeJson(bankingResponse),
        ]);
        if (!isCurrent()) return;

        if (!savingsResponse.ok) {
          throw new Error(
            savingsResult?.message || savingsResult?.details ||
            savingsResult?.hint || "Unable to load Savings."
          );
        }
        if (!bankingResponse.ok) {
          throw new Error(
            bankingResult?.message || bankingResult?.details ||
            bankingResult?.hint || "Unable to load Banking employees."
          );
        }

        const nextCategories = Array.isArray(savingsResult?.categories)
          ? savingsResult.categories : [];
        const nextRequests = Array.isArray(savingsResult?.payment_requests)
          ? savingsResult.payment_requests : [];
        const nextEmployees = Array.isArray(bankingResult?.employees)
          ? bankingResult.employees : [];

        setCategories(nextCategories);
        setDstvEnabled(
          typeof savingsResult?.dstv_enabled === "boolean"
            ? savingsResult.dstv_enabled : null
        );
        setPaymentRequests(nextRequests);
        setBankingEmployees(nextEmployees);
        setEmployeeId((previous) => {
          if (!previous) return "";
          return nextEmployees.some(
            (employee) => String(employee.employee_id) === String(previous)
          ) ? previous : "";
        });
      } catch (error) {
        if (!isCurrent() || error?.name === "AbortError") return;
        console.error("LOAD CASHIER SAVINGS ERROR:", error);
        if (!silent) {
          setNotice({
            text: error?.message || "Unable to load Savings.",
            type: "error",
          });
        }
      } finally {
        // Only the current request can release the loading state.
        if (isCurrent()) {
          savingsRequestRef.current = null;
          if (!silent) setLoading(false);
        }
      }
    },
    [shiftId, token, supabaseUrl, anonKey, savingsContext]
  );

  // Prevent an old DStv confirmation popup remaining open after Admin locks it.
  useEffect(() => {
    if (dstvEnabled !== true && utilityPayModal?.category === "DSTV") {
      setUtilityPayModal(null);
      setUtilityModalError("");
    }
  }, [dstvEnabled, utilityPayModal?.category]);

  function dstvAllowed(row) {
    if (row.key !== "DSTV" || dstvEnabled === true) return true;
    notify("DStv is locked by Admin or its status is unavailable.");
    return false;
  }

  // BANKING MODE — PRESERVED

  const loadBankingMode = useCallback(async () => {
    if (!token || !supabaseUrl || !anonKey) {
      setBankingMode(null);
      return null;
    }

    try {
      const response = await fetch(
        `${supabaseUrl}/rest/v1/rpc/tl_banking_mode_snapshot`,
        {
          method: "POST",
          headers: authHeaders(anonKey, token),
          body: "{}",
          cache: "no-store",
        }
      );

      const data = await safeJson(response);

      if (!response.ok) {
        throw new Error(
          data?.message ||
            "Banking mode unavailable."
        );
      }

      const record = Array.isArray(data)
        ? data[0]
        : data;

      const mode = String(
        record?.mode || ""
      ).toUpperCase();

      if (
        mode !== "MANUAL" &&
        mode !== "AUTOMATIC"
      ) {
        throw new Error("Invalid Banking mode.");
      }

      const current = {
        mode,
        automaticReady:
          record?.automatic_ready === true,
      };

      setBankingMode(current);
      return current;
    } catch (error) {
      console.error(
        "LOAD BANKING MODE ERROR:",
        error
      );

      setBankingMode(null);
      return null;
    }
  }, [token, supabaseUrl, anonKey]);

 useEffect(() => {
  void loadBankingMode();

  const timer = setInterval(() => {
    if (document.visibilityState === "visible") {
      void loadBankingMode();
    }
  }, 30000);

  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      void loadBankingMode();
    }
  };

  document.addEventListener(
    "visibilitychange",
    onVisibilityChange
  );

  return () => {
    clearInterval(timer);
    document.removeEventListener(
      "visibilitychange",
      onVisibilityChange
    );
  };
}, [loadBankingMode]);

  // AUTO REFRESH — 30 SECONDS, ONLY WHILE VISIBLE
  useEffect(() => {
    // Cancel requests from the previous shift/session or unmounted panel.
    loadSavings(false);

    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadSavings(true);
      }
    }, 30000);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadSavings(true);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      savingsGenerationRef.current += 1;
      if (savingsRequestRef.current) {
        savingsRequestRef.current.abort();
        savingsRequestRef.current = null;
      }
    };
  }, [loadSavings]);

  // EMPLOYEE DIRECTORY

  const sortedEmployees = useMemo(
    () =>
      [...bankingEmployees].sort((a, b) => {
        const mobile =
          Number(Boolean(b?.is_mobile)) -
          Number(Boolean(a?.is_mobile));

        if (mobile) return mobile;

        const shop = String(
          a?.shop_name || ""
        ).localeCompare(
          String(b?.shop_name || "")
        );

        return (
          shop ||
          String(
            a?.employee_name || ""
          ).localeCompare(
            String(b?.employee_name || "")
          )
        );
      }),
    [bankingEmployees]
  );

  const selectedEmployee = useMemo(
    () =>
      bankingEmployees.find(
        (employee) =>
          String(employee.employee_id) ===
          String(employeeId)
      ) || null,
    [bankingEmployees, employeeId]
  );

  // SAVINGS CATEGORIES

  const rows = useMemo(
    () =>
      CATEGORIES.map((config) => {
        if (config.key === "BANKING") {
          return {
            ...config,
            balance: Number(
              selectedEmployee?.saved_balance || 0
            ),
            obligationAmount: null,
            pendingPaymentAmount: Number(
              selectedEmployee?.pending_payment_amount ||
                0
            ),
            availableBalance: Number(
              selectedEmployee?.available_balance ||
                0
            ),
          };
        }

        const found = categories.find(
          (item) =>
            String(
              item?.category || ""
            ).toUpperCase() === config.key
        );

        return {
          ...config,
          balance: Number(found?.balance || 0),

          obligationAmount:
            found?.obligation_amount == null
              ? null
              : Number(found.obligation_amount),

          pendingPaymentAmount: Number(
            found?.pending_payment_amount || 0
          ),

          availableBalance: Number(
            found?.available_balance || 0
          ),
        };
      }),
    [categories, selectedEmployee]
  );

  const utilityRows = rows.filter((row) => row.key !== "BANKING");
  const utilityTotalSaved = roundMoney(utilityRows.reduce((sum, row) => sum + row.balance, 0));
  const utilityAvailable = roundMoney(utilityRows.reduce((sum, row) => sum + row.availableBalance, 0));

  const totals = useMemo(
    () => ({
      saved: roundMoney(
        rows.reduce(
          (sum, row) =>
            sum + Number(row.balance || 0),
          0
        )
      ),

      reserved: roundMoney(
        rows.reduce(
          (sum, row) =>
            sum +
            Number(
              row.pendingPaymentAmount || 0
            ),
          0
        )
      ),
    }),
    [rows]
  );

  // INPUT HELPERS

  function setInput(category, field, value) {
    setInputs((old) => ({
      ...old,
      [category]: {
        ...old[category],
        [field]: value,
      },
    }));

    setNotice(null);
  }

  function clearInput(category, field) {
    setInputs((old) => ({
      ...old,
      [category]: {
        ...old[category],
        [field]: "",
      },
    }));
  }

  function selectEmployee(id) {
    setEmployeeId(id);

    setBankingPayModal(null);
    setBankingModalError("");

    setInputs((old) => ({
      ...old,
      BANKING: {
        save: "",
        pay: "",
        withdraw: "",
      },
    }));

    setNotice(null);
  }

  function bankingReady(row) {
    if (
      row.key !== "BANKING" ||
      selectedEmployee
    ) {
      return true;
    }

    notify("Select an employee for Banking.");
    return false;
  }

  // EXISTING FINANCIAL OPERATIONS

  async function postMoney({
    row,
    action,
    rpc,
    body,
    onSuccess,
  }) {
    if (busyRef.current) return;

    busyRef.current = true;

    setActionKey(`${action}-${row.key}`);
    setNotice(null);

    try {
      const result = await callRpc(rpc, body);

      onSuccess(result);
      await loadSavings(true, true);
    } catch (error) {
      console.error(
        `${action} SAVINGS ERROR:`,
        error
      );

      notify(
        error?.message ||
          `Unable to ${action.toLowerCase()} ${row.label}.`
      );
    } finally {
      busyRef.current = false;
      setActionKey("");
    }
  }

  // SAVE — UNCHANGED FINANCIAL RULE

  async function saveMoney(row) {
    if (!dstvAllowed(row)) return;

    if (
      busyRef.current ||
      !bankingReady(row)
    ) {
      return;
    }

    const raw = inputs[row.key]?.save;
    const amount = Number(raw);

    if (
      raw === "" ||
      !Number.isFinite(amount) ||
      roundMoney(amount) <= 0
    ) {
      notify(
        `Enter a valid ${row.label} save amount.`
      );
      return;
    }

    const banking = row.key === "BANKING";

    const employeeText = banking
      ? `\nEmployee: ${selectedEmployee.employee_name}`
      : "";

    const confirmed = window.confirm(
      `Save KES ${money(amount)} to ${row.label}?${employeeText}\n\n` +
        `This will immediately add KES ${money(amount)} to Expenses and Savings.`
    );

    if (!confirmed) return;

    await postMoney({
      row,
      action: "SAVE",

      rpc: banking
        ? "tl_cashier_save_banking_employee"
        : "tl_cashier_save_savings",

      body: banking
        ? {
            p_shift_id: shiftId,
            p_employee_id:
              selectedEmployee.employee_id,
            p_amount: roundMoney(amount),
          }
        : {
            p_shift_id: shiftId,
            p_category: row.key,
            p_amount: roundMoney(amount),
          },

      onSuccess: () => {
        clearInput(row.key, "save");

        notify(
          `${
            banking
              ? selectedEmployee.employee_name
              : row.label
          }: KES ${money(amount)} saved.`,
          "success"
        );
      },
    });
  }

  // BANKING TARIFF — PRESERVED

  async function fetchBankingFee(amount) {
    if (
      !supabaseUrl ||
      !anonKey ||
      !token
    ) {
      throw new Error(
        "Banking fee service unavailable."
      );
    }

    const response = await fetch(
      `${supabaseUrl}/rest/v1/rpc/tl_payment_fee_for_amount`,
      {
        method: "POST",

        headers: authHeaders(
          anonKey,
          token
        ),

        body: JSON.stringify({
          p_payment_method: BANKING_ROUTE,
          p_amount: roundMoney(amount),
        }),

        cache: "no-store",
      }
    );

    const result = await safeJson(response);

    if (!response.ok) {
      throw new Error(
        result?.message ||
          result?.details ||
          result?.hint ||
          "Unable to retrieve configured Banking fee."
      );
    }

    const fee = Number(result);

    if (
      result === null ||
      result === "" ||
      !Number.isFinite(fee) ||
      fee < 0 ||
      roundMoney(fee) !== fee
    ) {
      throw new Error(
        "Configured Banking transaction fee is invalid."
      );
    }

    return fee;
  }

  // OPEN BANKING PAYMENT POPUP

  async function openBankingPay(row, amount) {
    if (busyRef.current) return;

    busyRef.current = true;
    setActionKey("QUOTE-BANKING");
    setNotice(null);

    try {
      const currentMode =
        await loadBankingMode();

      if (!currentMode) {
        throw new Error(
          "Unable to verify Banking mode."
        );
      }

      if (currentMode.mode !== "MANUAL") {
        throw new Error(
          currentMode.automaticReady
            ? "Automatic Banking PAY is not connected yet."
            : "Automatic Banking is not ready. Contact Admin."
        );
      }

      const fee = await fetchBankingFee(
        amount
      );

      setBankingModalError("");

      setBankingPayModal({
        employeeId:
          selectedEmployee.employee_id,

        employeeName:
          selectedEmployee.employee_name,

        amount: roundMoney(amount),

        reference: "",

        quotedFee: fee,
      });
    } catch (error) {
      notify(
        error?.message ||
          "Unable to prepare Banking payment."
      );
    } finally {
      busyRef.current = false;
      setActionKey("");
    }
  }

  function closeBankingPay() {
    if (busyRef.current) return;

    setBankingPayModal(null);
    setBankingModalError("");
  }

  // CONFIRM MANUAL BANKING REQUEST

  async function submitBankingPayment() {
    if (
      busyRef.current ||
      !bankingPayModal
    ) {
      return;
    }

    const payment = bankingPayModal;

    const reference = String(
      payment.reference || ""
    )
      .replace(/\s+/g, "")
      .toUpperCase();

    if (!/^[A-Z0-9]{8,16}$/.test(reference)) {
      setBankingModalError(
        "Enter a valid M-PESA transaction reference."
      );
      return;
    }

    if (
      !selectedEmployee ||
      String(selectedEmployee.employee_id) !==
        String(payment.employeeId)
    ) {
      setBankingModalError(
        "Banking employee changed. Close and reopen the payment."
      );
      return;
    }

    if (
      payment.amount >
      Number(
        selectedEmployee.available_balance || 0
      )
    ) {
      setBankingModalError(
        "Available Banking Savings is insufficient. Close and reopen the payment."
      );
      return;
    }

    busyRef.current = true;
    setActionKey("PAY-BANKING");
    setBankingModalError("");

    try {
      const currentMode =
        await loadBankingMode();

      if (
        !currentMode ||
        currentMode.mode !== "MANUAL"
      ) {
        throw new Error(
          "Manual Banking is not currently available."
        );
      }

      const latestFee = await fetchBankingFee(
        payment.amount
      );

      if (latestFee !== payment.quotedFee) {
        setBankingPayModal((old) =>
          old
            ? {
                ...old,
                quotedFee: latestFee,
              }
            : old
        );

        setBankingModalError(
          "Admin has updated this Banking tariff. Review the new transaction fee and compare it with your M-PESA message before submitting again."
        );

        return;
      }

      const result = await callRpc(
        "tl_cashier_request_banking_payment_employee",
        {
          p_shift_id: shiftId,
          p_employee_id:
            payment.employeeId,
          p_amount: payment.amount,
          p_mpesa_reference: reference,
        }
      );

      const savedFee = Number(
        result?.quoted_transaction_fee
      );

      const feeWasReturned =
        result?.quoted_transaction_fee !== null &&
        result?.quoted_transaction_fee !== undefined &&
        result?.quoted_transaction_fee !== "";

      const feeMatched =
        feeWasReturned &&
        Number.isFinite(savedFee) &&
        savedFee === payment.quotedFee;

      clearInput("BANKING", "pay");

      setBankingPayModal(null);
      setBankingModalError("");

      if (!feeMatched) {
        notify(
          feeWasReturned
            ? `Banking request submitted. The saved fee is KES ${money(savedFee)} rather than the previewed fee. Notify Admin.`
            : "Banking request submitted. The final fee quote could not be verified in the response. Notify Admin.",
          "error"
        );
      } else {
        notify(
          `Banking request submitted. Transaction fee: KES ${money(savedFee)}.`,
          "success"
        );
      }

      await loadSavings(true, true);
    } catch (error) {
      console.error(
        "BANKING PAYMENT REQUEST ERROR:",
        error
      );

      setBankingModalError(
        error?.message ||
          "Unable to submit Banking payment."
      );
    } finally {
      busyRef.current = false;
      setActionKey("");
    }
  }

  // ==========================================
  // NEW: UTILITY PAYMENT FEE PREVIEW
  // ==========================================

  async function fetchUtilityFee(category, amount) {
    const result = await callRpc(
      "tl_cashier_utility_fee_preview",
      {
        p_shift_id: shiftId,
        p_category: category,
        p_amount: roundMoney(amount),
      }
    );

    if (
      result?.success !== true ||
      String(result?.category || "").toUpperCase() !==
        category ||
      Number(result?.payment_amount) !==
        roundMoney(amount)
    ) {
      throw new Error(
        "Unable to verify the utility payment quotation."
      );
    }

    const fee = Number(
      result?.transaction_fee
    );

    if (
      result?.transaction_fee == null ||
      !Number.isFinite(fee) ||
      fee < 0 ||
      roundMoney(fee) !== fee
    ) {
      throw new Error(
        "Admin-configured transaction fee is invalid."
      );
    }

    return fee;
  }

  // OPEN UTILITY CONFIRMATION WINDOW

  async function openUtilityPay(row, amount) {
    if (!dstvAllowed(row)) return;
    if (busyRef.current) return;

    busyRef.current = true;
    setActionKey(`QUOTE-UTILITY-${row.key}`);
    setNotice(null);

    try {
      const fee = await fetchUtilityFee(
        row.key,
        amount
      );

      setUtilityModalError("");

      setUtilityPayModal({
        shiftId,
        category: row.key,
        label: row.label,
        amount: roundMoney(amount),
        quotedFee: fee,
      });
    } catch (error) {
      console.error(
        "UTILITY FEE PREVIEW ERROR:",
        error
      );

      notify(
        error?.message ||
          "Unable to prepare payment request."
      );
    } finally {
      busyRef.current = false;
      setActionKey("");
    }
  }

  function closeUtilityPay() {
    if (busyRef.current) return;

    setUtilityPayModal(null);
    setUtilityModalError("");
  }

  // SUBMIT UTILITY PAYMENT REQUEST
  // Fee is rechecked before submission.

  async function submitUtilityPayment() {
    if (
      busyRef.current ||
      !utilityPayModal
    ) {
      return;
    }

    const payment = utilityPayModal;
    if (payment.category === "DSTV" && dstvEnabled !== true) {
      setUtilityModalError("DStv is locked by Admin.");
      return;
    }

    if (payment.shiftId !== shiftId) {
      setUtilityModalError(
        "The cashier shift has changed. Close and reopen the payment."
      );
      return;
    }

    busyRef.current = true;
    setActionKey(
      `PAY-UTILITY-${payment.category}`
    );
    setUtilityModalError("");

    let requestCreated = false;

    try {
      const latestFee = await fetchUtilityFee(
        payment.category,
        payment.amount
      );

      // Admin changed the fee while popup was open.
      // Show new fee and require a second confirmation.

      if (latestFee !== payment.quotedFee) {
        setUtilityPayModal((old) =>
          old
            ? {
                ...old,
                quotedFee: latestFee,
              }
            : old
        );

        setUtilityModalError(
          "Admin has changed the transaction fee. Review the updated amount and confirm again."
        );

        return;
      }

      // REQUEST PAY only reserves the principal.
      // It does not expense the principal again.
      // Backend freezes the actual fee.

      const result = await callRpc(
        "tl_cashier_request_savings_payment",
        {
          p_shift_id: shiftId,
          p_category: payment.category,
          p_amount: payment.amount,
        }
      );

      requestCreated = true;

      // Verify what the backend actually froze.
      // Never submit a second request automatically.

      const savedFee = Number(
        result?.quoted_transaction_fee
      );

      const validSavedFee =
        result?.quoted_transaction_fee !== null &&
        result?.quoted_transaction_fee !== undefined &&
        result?.quoted_transaction_fee !== "" &&
        Number.isFinite(savedFee) &&
        savedFee >= 0 &&
        roundMoney(savedFee) === savedFee;

      const feeMatched =
        validSavedFee &&
        savedFee === payment.quotedFee;

      if (!feeMatched) {
        setUtilityModalError(
          validSavedFee
            ? `Payment request was created, but the frozen fee is KES ${money(savedFee)} instead of KES ${money(payment.quotedFee)}. Do not submit again. Contact Admin or Accountant.`
            : "Payment request was created, but the frozen fee could not be verified. Do not submit again. Contact Admin."
        );

        // Leave modal open as an explicit warning.
        setUtilityPayModal((old) =>
          old
            ? {
                ...old,
                submitted: true,
              }
            : old
        );

        await loadSavings(true, true);
        return;
      }

      if (
        !result?.request_id ||
        result?.success !== true
      ) {
        setUtilityModalError(
          "Payment request response could not be verified. Check Payment Status before attempting again."
        );

        setUtilityPayModal((old) =>
          old
            ? {
                ...old,
                submitted: true,
              }
            : old
        );

        await loadSavings(true, true);
        return;
      }

      if (payment.category === "ELECTRICITY") {
        clearInput("ELECTRICITY", "pay");
      }

      setUtilityPayModal(null);
      setUtilityModalError("");

      notify(
        `${payment.label}: Payment request sent. Frozen transaction fee KES ${money(savedFee)}.`,
        "success"
      );

      await loadSavings(true, true);
    } catch (error) {
      console.error(
        "UTILITY PAYMENT REQUEST ERROR:",
        error
      );

      setUtilityModalError(
        requestCreated
          ? "The request may have been created. Check Payment Status before attempting again."
          : error?.message ||
              "Unable to submit utility payment."
      );
    } finally {
      busyRef.current = false;
      setActionKey("");
    }
  }

  // ==========================================
  // REQUEST PAYMENT
  // ==========================================

  async function requestPayment(row) {
    if (!dstvAllowed(row)) return;

    if (
      busyRef.current ||
      !bankingReady(row)
    ) {
      return;
    }

    if (
      row.fixedPayment &&
      (
        row.obligationAmount == null ||
        !Number.isFinite(row.obligationAmount) ||
        row.obligationAmount <= 0
      )
    ) {
      notify(
        `${row.label} fixed payment is not configured by Admin.`
      );
      return;
    }

    const amount = row.fixedPayment
      ? Number(row.obligationAmount || 0)
      : Number(inputs[row.key]?.pay || 0);

    if (
      !Number.isFinite(amount) ||
      roundMoney(amount) <= 0
    ) {
      notify(
        `Enter a valid ${row.label} payment amount.`
      );
      return;
    }

    if (
      row.key === "ELECTRICITY" &&
      !ELECTRICITY_AMOUNTS.includes(amount)
    ) {
      notify(
        "Select an approved Electricity amount."
      );
      return;
    }

    if (amount > row.availableBalance) {
      notify(
        `${row.label}: Available KES ${money(row.availableBalance)}.`
      );
      return;
    }

    // Banking remains on its original workflow.

    if (row.key === "BANKING") {
      await openBankingPay(row, amount);
      return;
    }

    // New utility confirmation popup.

    await openUtilityPay(row, amount);
  }

  // WITHDRAW TO M-SHWARI FLOAT — PRESERVED

  async function withdrawMoney(row) {
    if (!dstvAllowed(row)) return;

    if (
      busyRef.current ||
      !bankingReady(row)
    ) {
      return;
    }

    const raw =
      inputs[row.key]?.withdraw;

    const amount = Number(raw);

    if (
      raw === "" ||
      !Number.isFinite(amount) ||
      roundMoney(amount) <= 0
    ) {
      notify(
        `Enter a valid ${row.label} withdrawal amount.`
      );
      return;
    }

    if (amount > row.availableBalance) {
      notify(
        `${row.label}: Available KES ${money(row.availableBalance)}.`
      );
      return;
    }

    const banking =
      row.key === "BANKING";

    const employeeText = banking
      ? `\nEmployee: ${selectedEmployee.employee_name}`
      : "";

    const confirmed = window.confirm(
      `Withdraw KES ${money(amount)} from ${row.label} Savings?${employeeText}\n\n` +
        "The money will automatically enter the next available M-Shwari Added Float position."
    );

    if (!confirmed) return;

    await postMoney({
      row,
      action: "WITHDRAW",

      rpc: banking
        ? "tl_cashier_withdraw_banking_employee"
        : "tl_cashier_withdraw_savings",

      body: banking
        ? {
            p_shift_id: shiftId,
            p_employee_id:
              selectedEmployee.employee_id,
            p_amount: roundMoney(amount),
          }
        : {
            p_shift_id: shiftId,
            p_category: row.key,
            p_amount: roundMoney(amount),
          },

      onSuccess: (result) => {
        clearInput(
          row.key,
          "withdraw"
        );

        notify(
          `${row.label}: KES ${money(amount)} withdrawn to M-Shwari Float ${
            result?.mshwari_slot || ""
          }.`,
          "success"
        );
      },
    });
  }
  // ==========================================
// DISPLAY
  // ==========================================

  return (
    <section
  className="tl-shared-savings"
      style={s.panel}
    >
      <style>{css}</style>

      <div style={s.heading}>
        SAVINGS / BANKING
      </div>

      {notice && (
        <div
          role="status"
          aria-live="polite"
          style={{
            ...s.message,
            ...(notice.type === "success"
              ? s.success
              : s.error),
          }}
        >
          {notice.text}
        </div>
      )}

      {loading ? (
        <div style={s.loading}>
          Loading...
        </div>
      ) : (
        <>
          <div className="tl-ms-overview">
            {[
              ...["WIFI", "DSTV", "ELECTRICITY", "RENT"].map((key) => {
                const row = utilityRows.find((item) => item.key === key);
                return { key, label: row?.label || key, balance: row?.balance || 0 };
              }),
            ].map((item) => (
              <div key={item.key} className="tl-ms-balance">
                <span>{item.label}</span>
                <strong>KES {money(item.balance)}</strong>
              </div>
            ))}
            <div className="tl-ms-inline-controls">
              <label htmlFor="tl-mshwari-action">ACTION</label>
              <select id="tl-mshwari-action" aria-label="M-Shwari save or withdraw"
                value={mshwariAction} disabled={Boolean(actionKey)}
                onChange={(event) => setMshwariAction(event.target.value)}>
                <option value="SAVE">SAVE</option>
                <option value="WITHDRAW">WITHDRAW</option>
              </select>
            </div>
            {mshwariAction === "SAVE" ? (
              <>
                <div className="tl-ms-inline-controls">
                  <label htmlFor="tl-ms-save-category">CATEGORY</label>
                  <select id="tl-ms-save-category" aria-label="Savings category"
                    value={utilitySaveCategory} disabled={Boolean(actionKey)}
                    onChange={(event) => setUtilitySaveCategory(event.target.value)}>
                    {utilityRows.map((row) => <option key={row.key} value={row.key}>{row.label}</option>)}
                  </select>
                </div>
                <div className="tl-ms-inline-controls">
                  <label htmlFor="tl-ms-save-amount">AMOUNT (KES)</label>
                  <input id="tl-ms-save-amount" type="number" min="0" step="0.01" placeholder="Amount"
                    aria-label="M-Shwari save amount" disabled={Boolean(actionKey) || (utilitySaveCategory === "DSTV" && dstvEnabled !== true)}
                    value={inputs[utilitySaveCategory]?.save || ""}
                    onChange={(event) => setInput(utilitySaveCategory, "save", event.target.value)} />
                </div>
                <button className="tl-ms-inline-submit tl-ms-inline-save" type="button"
                  disabled={Boolean(actionKey) || (utilitySaveCategory === "DSTV" && dstvEnabled !== true)}
                  onClick={() => { const row = utilityRows.find((item) => item.key === utilitySaveCategory); if (row) void saveMoney(row); }}>
                  {actionKey === `SAVE-${utilitySaveCategory}` ? "Saving..." : "SAVE"}
                </button>
              </>
            ) : (
              <>
                <div className="tl-ms-inline-controls tl-ms-inline-available">
                  <label>AVAILABLE</label>
                  <strong>KES {money(utilityAvailable)}</strong>
                </div>
                <div className="tl-ms-inline-controls">
                  <label htmlFor="tl-ms-withdraw-amount">AMOUNT (KES)</label>
                  <input id="tl-ms-withdraw-amount" type="number" min="0" step="0.01" placeholder="Amount"
                    aria-label="Combined M-Shwari withdrawal amount" value={combinedWithdrawAmount}
                    onChange={(event) => setCombinedWithdrawAmount(event.target.value)} />
                </div>
                <button className="tl-ms-inline-submit tl-ms-inline-withdraw" type="button" disabled
                  title="Awaiting safe atomic combined-withdrawal backend verification">WITHDRAW</button>
              </>
            )}
            <div className="tl-ms-balance tl-ms-total">
              <span>TOTAL SAVED</span>
              <strong>KES {money(utilityTotalSaved)}</strong>
            </div>
          </div>
          {paymentRequests.length > 0 && (
            <div style={s.history}>
              <button
                type="button"
                style={s.historyToggle}
                aria-expanded={
                  paymentStatusOpen
                }
                aria-controls="tl-payment-status-list"
                onClick={() =>
                  setPaymentStatusOpen(
                    (value) => !value
                  )
                }
              >
                <span>
                  PAYMENT STATUS (
                  {paymentRequests.length})
                </span>

                <span aria-hidden="true">
                  {paymentStatusOpen
                    ? "▲"
                    : "▼"}
                </span>
              </button>

              {paymentStatusOpen && (
                <div
                  id="tl-payment-status-list"
                  style={s.historyGrid}
                >
                  {paymentRequests
                    .slice(0, 6)
                    .map((request) => (
                      <div
                        key={request.id}
                        style={s.historyRow}
                      >
                        <div style={s.historyName}>
                          <strong>
                            {request.category}
                          </strong>

                          <span style={s.historyDate}>
                            {formatDateTime(
                              request.requested_at
                            )}
                          </span>
                        </div>

                        <strong
                          style={s.historyAmount}
                        >
                          KES{" "}
                          {money(
                            request.amount
                          )}
                        </strong>

                        <StatusBadge
                          status={request.status}
                        />
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {bankingActive && bankingTarget && createPortal(
        <section className="tl-shared-savings" style={{ ...s.panel, marginTop: 0 }}>
          <style>{css}</style>
          {loading ? <div style={s.loading}>Loading Banking...</div> : (
          <div style={s.categoryGrid}>
            {rows.filter((row) => row.key === "BANKING").map((row) => {
              const banking =
                row.key === "BANKING";
              const dstvLocked = row.key === "DSTV" && dstvEnabled !== true;

              const ready =
                !banking ||
                Boolean(selectedEmployee);

              const busy =
                actionKey !== "";

              const fixedReady =
                row.obligationAmount != null &&
                Number.isFinite(
                  row.obligationAmount
                ) &&
                row.obligationAmount > 0;

              const disablePay =
                dstvLocked ||
                busy ||
                !ready ||
                row.availableBalance <= 0 ||
                (
                  row.fixedPayment &&
                  (
                    !fixedReady ||
                    row.availableBalance <
                      row.obligationAmount
                  )
                );

              const disableWithdraw =
                dstvLocked ||
                busy ||
                !ready ||
                row.availableBalance <= 0;

              const input =
                inputs[row.key] || {
                  save: "",
                  pay: "",
                  withdraw: "",
                };

              return (
                <article
                  key={row.key}
                  style={{
                    ...s.categoryCard,
                    ...(banking
                      ? s.bankingCard
                      : {}),
                  }}
                >
                  <div style={s.categoryHead}>
                    <strong style={s.categoryName}>
                      {row.label}
                    </strong>

                    {banking &&
                      bankingMode && (
                        <span style={s.fixedTag}>
                          {bankingMode.mode}
                        </span>
                      )}

                    {dstvLocked && (
                      <span style={{ ...s.fixedTag, color: "#FCA5A5", borderColor: "#7F1D1D" }}>
                        {dstvEnabled === false ? "LOCKED BY ADMIN" : "DSTV STATUS UNAVAILABLE"}
                      </span>
                    )}
                    {row.fixedPayment && (
                      <span style={s.fixedTag}>
                        FIXED
                      </span>
                    )}
                  </div>

                  <div style={s.balanceTile}>
                    <span style={s.balanceLabel}>
                      SAVED
                    </span>

                    <strong style={s.balanceAmount}>
                      KES {money(row.balance)}
                    </strong>
                  </div>

                  {banking && (
                    <select
                      aria-label="Banking employee"
                      style={s.select}
                      value={employeeId}
                      disabled={busy}
                      onChange={(event) =>
                        selectEmployee(
                          event.target.value
                        )
                      }
                    >
                      <option value="">
                        Select employee
                      </option>

                      {sortedEmployees.map(
                        (employee) => (
                          <option
                            key={
                              employee.employee_id
                            }
                            value={
                              employee.employee_id
                            }
                          >
                            {employee.is_mobile
                              ? `★ MOBILE — ${employee.employee_name}`
                              : `${
                                  employee.shop_name ||
                                  "UNASSIGNED"
                                } — ${employee.employee_name}`}
                          </option>
                        )
                      )}
                    </select>
                  )}

                  {row.pendingPaymentAmount > 0 && (
                    <div style={s.pending}>
                      PENDING: KES{" "}
                      {money(
                        row.pendingPaymentAmount
                      )}
                    </div>
                  )}

                  <div style={s.actions}>
                    {/* SAVE */}

                    <div style={s.actionRow}>
                      <span style={s.actionLabel}>
                        SAVE
                      </span>

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        style={s.input}
                        aria-label={`${row.label} save amount`}
                        value={input.save}
                        disabled={busy || !ready || dstvLocked}
                        placeholder={
                          ready
                            ? "Amount"
                            : "Select employee"
                        }
                        onChange={(event) =>
                          setInput(
                            row.key,
                            "save",
                            event.target.value
                          )
                        }
                      />

                      <button
                        type="button"
                        onClick={() =>
                          saveMoney(row)
                        }
                        disabled={busy || !ready || dstvLocked}
                        style={{
                          ...s.button,
                          ...s.saveButton,
                        }}
                      >
                        {actionKey ===
                        `SAVE-${row.key}`
                          ? "Saving..."
                          : "Save"}
                      </button>
                    </div>

                    {/* PAY */}

                    <div style={s.actionRow}>
                      <span style={s.actionLabel}>
                        PAY
                      </span>

                      {row.fixedPayment ? (
                        <input
                          type="text"
                          readOnly
                          disabled={dstvLocked}
                          tabIndex={dstvLocked ? -1 : undefined}
                          style={{
                            ...s.input,
                            ...s.readOnly,
                            ...(dstvLocked ? { pointerEvents: "none", cursor: "not-allowed" } : {}),
                          }}
                          aria-label={`${row.label} fixed payment amount`}
                          value={
                            fixedReady
                              ? money(
                                  row.obligationAmount
                                )
                              : ""
                          }
                          placeholder="Not set"
                        />
                      ) : row.key ===
                        "ELECTRICITY" ? (
                        <select
                          aria-label="Electricity payment amount"
                          style={s.input}
                          value={input.pay}
                          disabled={busy}
                          onChange={(event) =>
                            setInput(
                              "ELECTRICITY",
                              "pay",
                              event.target.value
                            )
                          }
                        >
                          <option value="">
                            Select amount
                          </option>

                          {ELECTRICITY_AMOUNTS.map(
                            (amount) => (
                              <option
                                key={amount}
                                value={amount}
                              >
                                KES{" "}
                                {amount.toLocaleString(
                                  "en-KE"
                                )}
                              </option>
                            )
                          )}
                        </select>
                      ) : (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          style={s.input}
                          aria-label={`${row.label} payment amount`}
                          value={input.pay}
                          disabled={
                            busy || !ready
                          }
                          placeholder={
                            ready
                              ? "Amount"
                              : "Select employee"
                          }
                          onChange={(event) =>
                            setInput(
                              row.key,
                              "pay",
                              event.target.value
                            )
                          }
                        />
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          requestPayment(row)
                        }
                        disabled={disablePay}
                        style={{
                          ...s.button,
                          ...s.payButton,
                        }}
                      >
                        {actionKey ===
                          `QUOTE-UTILITY-${row.key}` ||
                        (actionKey ===
                          "QUOTE-BANKING" &&
                          banking)
                          ? "Checking..."
                          : actionKey ===
                              `PAY-UTILITY-${row.key}` ||
                            actionKey ===
                              `PAY-${row.key}`
                          ? "Sending..."
                          : "Request Pay"}
                      </button>
                    </div>

                    {/* WITHDRAW */}

                    <div style={s.actionRow}>
                      <span style={s.actionLabel}>
                        WITHDRAW
                      </span>

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        style={s.input}
                        aria-label={`${row.label} withdrawal amount`}
                        value={input.withdraw}
                        disabled={disableWithdraw}
                        placeholder={
                          ready
                            ? "Amount"
                            : "Select employee"
                        }
                        onChange={(event) =>
                          setInput(
                            row.key,
                            "withdraw",
                            event.target.value
                          )
                        }
                      />

                      <button
                        type="button"
                        onClick={() =>
                          withdrawMoney(row)
                        }
                        disabled={disableWithdraw}
                        style={{
                          ...s.button,
                          ...s.withdrawButton,
                        }}
                      >
                        {actionKey ===
                        `WITHDRAW-${row.key}`
                          ? "Working..."
                          : "Withdraw"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          )}
        </section>,
        bankingTarget
      )}

      {/* =====================================
          NEW UTILITY PAYMENT CONFIRMATION
          ===================================== */}

      {utilityPayModal && (
        <div className="tl-banking-modal-backdrop">
          <div
            className="tl-banking-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tl-utility-modal-title"
          >
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void submitUtilityPayment();
              }}
            >
              <div style={s.modalHeading}>
                <strong id="tl-utility-modal-title">
                  {utilityPayModal.category} — REQUEST PAY
                </strong>

                <span style={s.fixedTag}>
                  🔒 ADMIN FEE
                </span>
              </div>

              <div style={s.modalSummary}>
                <div style={s.modalSummaryRow}>
                  <span>PAYMENT AMOUNT</span>

                  <strong>
                    KES{" "}
                    {money(
                      utilityPayModal.amount
                    )}
                  </strong>
                </div>

                <div style={s.modalSummaryRow}>
                  <span>TRANSACTION FEE</span>

                  <strong
                    style={{
                      color: "#F2DA91",
                    }}
                  >
                    KES{" "}
                    {money(
                      utilityPayModal.quotedFee
                    )}
                  </strong>
                </div>

                <div style={s.modalDivider} />

                <div style={s.modalSummaryRow}>
                  <strong>
                    TOTAL PAYMENT COST
                  </strong>

                  <strong
                    style={{
                      color: C.text,
                      fontSize: 17,
                    }}
                  >
                    KES{" "}
                    {money(
                      roundMoney(
                        utilityPayModal.amount +
                          utilityPayModal.quotedFee
                      )
                    )}
                  </strong>
                </div>
              </div>

              <p style={s.modalHint}>
                Verify the payment amount and
                transaction fee before requesting
                payment. If the fee does not match
                the actual charges, go back and
                contact Admin.
              </p>

              <p
                style={{
                  ...s.modalHint,
                  color: C.gold,
                }}
              >
                Only the payment principal will
                leave Savings after Accountant
                confirmation. The transaction fee
                is recorded separately as an
                expense.
              </p>

              {utilityModalError && (
                <div
                  role="alert"
                  style={{
                    ...s.message,
                    ...s.error,
                    margin: "0 0 12px",
                  }}
                >
                  {utilityModalError}
                </div>
              )}

              <div style={s.modalActions}>
                <button
                  type="button"
                  style={{
                    ...s.button,
                    ...s.modalCancel,
                  }}
                  disabled={utilityBusy}
                  onClick={closeUtilityPay}
                >
                  {utilityPayModal.submitted
                    ? "Close"
                    : "Go Back"}
                </button>

                <button
                  type="submit"
                  style={{
                    ...s.button,
                    ...s.modalConfirm,
                  }}
                  disabled={
                    utilityBusy ||
                    utilityPayModal.submitted === true
                  }
                >
                  {utilityBusy
                    ? "Submitting..."
                    : utilityPayModal.submitted
                    ? "Request Submitted"
                    : "Confirm Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================
          MANUAL BANKING PAYMENT POPUP
          ===================================== */}

      {bankingPayModal && (
        <div className="tl-banking-modal-backdrop">
          <div
            className="tl-banking-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tl-banking-modal-title"
          >
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void submitBankingPayment();
              }}
            >
              <div style={s.modalHeading}>
                <strong id="tl-banking-modal-title">
                  BANKING — REQUEST PAY
                </strong>

                <span style={s.fixedTag}>
                  MANUAL
                </span>
              </div>

              <div style={s.modalSummary}>
                <div style={s.modalSummaryRow}>
                  <span>EMPLOYEE</span>

                  <strong>
                    {bankingPayModal.employeeName}
                  </strong>
                </div>

                <div style={s.modalSummaryRow}>
                  <span>PAYMENT AMOUNT</span>

                  <strong>
                    KES{" "}
                    {money(
                      bankingPayModal.amount
                    )}
                  </strong>
                </div>
              </div>

              <div className="tl-banking-modal-fields">
                <label style={s.modalField}>
                  <span style={s.modalLabel}>
                    M-PESA REFERENCE
                  </span>

                  <input
                    ref={referenceInputRef}
                    type="text"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    maxLength={16}
                    required
                    style={{
                      ...s.input,
                      textAlign: "left",
                      textTransform: "uppercase",
                    }}
                    placeholder="Transaction code"
                    value={
                      bankingPayModal.reference
                    }
                    disabled={
                      actionKey ===
                      "PAY-BANKING"
                    }
                    onChange={(event) => {
                      const next = event.target.value
                        .replace(/\s+/g, "")
                        .toUpperCase();

                      setBankingPayModal(
                        (old) =>
                          old
                            ? {
                                ...old,
                                reference: next,
                              }
                            : old
                      );

                      setBankingModalError("");
                    }}
                  />
                </label>

                <label style={s.modalField}>
                  <span style={s.modalLabel}>
                    TRANSACTION FEE
                  </span>

                  <div style={s.feeReadOnlyWrap}>
                    <input
                      type="text"
                      readOnly
                      aria-label="Configured Banking transaction fee"
                      value={`KES ${money(
                        bankingPayModal.quotedFee
                      )}`}
                      style={{
                        ...s.input,
                        ...s.readOnly,
                        textAlign: "left",
                        border: "none",
                        minHeight: 37,
                        background: "transparent",
                        color: "#F2DA91",
                        fontWeight: 850,
                      }}
                    />

                    <span
                      aria-label="Read only"
                      title="Fee is controlled by Admin"
                      style={s.feeLock}
                    >
                      🔒
                    </span>
                  </div>
                </label>
              </div>

              <p style={s.modalHint}>
                Compare the displayed transaction fee
                with the transaction cost in your
                M-PESA message. If different, notify
                Admin. Cashiers cannot edit this fee.
              </p>

              {bankingModalError && (
                <div
                  role="alert"
                  style={{
                    ...s.message,
                    ...s.error,
                    margin: "0 0 12px",
                  }}
                >
                  {bankingModalError}
                </div>
              )}

              <div style={s.modalActions}>
                <button
                  type="button"
                  style={{
                    ...s.button,
                    ...s.modalCancel,
                  }}
                  disabled={
                    actionKey ===
                    "PAY-BANKING"
                  }
                  onClick={closeBankingPay}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  style={{
                    ...s.button,
                    ...s.modalConfirm,
                  }}
                  disabled={
                    actionKey ===
                      "PAY-BANKING" ||
                    !bankingPayModal.reference
                      .trim()
                  }
                >
                  {actionKey ===
                  "PAY-BANKING"
                    ? "Submitting..."
                    : "Confirm Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

// ============================================
// DISPLAY HELPERS
// ============================================

function TotalTile({ label, amount }) {
  return (
    <div style={s.totalTile}>
      <span style={s.totalLabel}>
        {label}
      </span>

      <strong style={s.totalAmount}>
        KES {money(amount)}
      </strong>
    </div>
  );
}

function StatusBadge({ status }) {
  const value = String(
    status || ""
  ).toUpperCase();

  const appearance =
    value === "CONFIRMED"
      ? s.confirmed
      : value === "PROCESSING"
      ? s.processing
      : [
          "REJECTED",
          "FAILED",
          "CANCELLED",
        ].includes(value)
      ? s.rejected
      : s.pendingStatus;

  return (
    <span
      style={{
        ...s.statusBase,
        ...appearance,
      }}
    >
      {value || "PENDING"}
    </span>
  );
}

// ============================================
// SUPABASE HELPERS
// ============================================

function authHeaders(anonKey, token) {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${token}`,
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

// ============================================
// MONEY AND DATE HELPERS
// ============================================

function money(value) {
  return Number(
    value || 0
  ).toLocaleString("en-KE", {
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

function formatDateTime(value) {
  if (!value) return "";

  try {
    return new Intl.DateTimeFormat(
      "en-KE",
      {
        timeZone: "Africa/Nairobi",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }
    ).format(new Date(value));
  } catch {
    return "";
  }
}

// ============================================
// CSS
// ============================================

const css = `
.tl-ms-overview {display:grid;grid-template-columns:repeat(4,minmax(85px,.8fr)) minmax(94px,.9fr) minmax(94px,.9fr) minmax(105px,1fr) minmax(66px,.65fr) minmax(115px,1fr);gap:4px;padding:7px 8px 4px;align-items:stretch}
.tl-ms-balance {min-width:0;background:#0A1725;border:1px solid #2A3D52;border-radius:6px;padding:5px 3px;text-align:center;display:flex;flex-direction:column;justify-content:center;gap:3px}
.tl-ms-balance span {font-size:9px;font-weight:800;color:#C4D0DC}
.tl-ms-balance strong {font-size:clamp(10px,1vw,13px);font-variant-numeric:tabular-nums;overflow-wrap:anywhere;color:#F0F5FA}
.tl-ms-total {border-color:#D9B66C;background:#292A2C}
.tl-ms-total strong {color:#F2DA91}
.tl-ms-inline-controls {min-width:0;display:flex;flex-direction:column;justify-content:center;gap:3px}
.tl-ms-inline-controls label {font-size:9px;font-weight:800;text-align:center;color:#D9B66C}
.tl-ms-inline-controls select,.tl-ms-inline-controls input {box-sizing:border-box;width:100%;min-width:0;height:29px;border:1px solid #496078;border-radius:5px;background:#0A1725;color:#F0F5FA;padding:3px 5px;font-size:11px}
.tl-ms-inline-controls select {border-color:#D9B66C}
.tl-ms-inline-controls strong {text-align:center;font-size:11px;color:#F0F5FA}
.tl-ms-inline-submit {align-self:end;height:29px;border:0;border-radius:5px;padding:0 5px;font-size:10px;font-weight:850;cursor:pointer;color:#fff}
.tl-ms-inline-save {background:#11996E}
.tl-ms-inline-withdraw {background:#345B79}
.tl-ms-inline-submit:disabled {opacity:.45;cursor:not-allowed}
.tl-ms-section-label {padding:4px 12px 0;font-size:12px;letter-spacing:.05em;color:#D9B66C;font-weight:800}
@media(max-width:950px){.tl-ms-overview{overflow-x:auto;grid-template-columns:repeat(4,85px) 94px 94px 105px 66px 115px}.tl-ms-balance span{font-size:8px}.tl-ms-balance strong{font-size:10px}}

.tl-shared-savings input[type="number"] {
  appearance: textfield;
  -moz-appearance: textfield;
}

.tl-shared-savings input[type="number"]::-webkit-inner-spin-button,
.tl-shared-savings input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.tl-shared-savings button:disabled {
  opacity: .5;
  cursor: not-allowed;
}

.tl-shared-savings button:focus-visible {
  outline: 2px solid #d9b66c;
  outline-offset: 2px;
}

.tl-banking-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 16px;
  box-sizing: border-box;
  background: rgba(3, 11, 21, .82);
}

.tl-banking-modal {
  width: min(100%, 490px);
  max-height: 92vh;
  overflow-y: auto;
  box-sizing: border-box;
  padding: 20px;
  background: #15263A;
  border: 1px solid #776441;
  border-radius: 13px;
  box-shadow: 0 20px 65px rgba(0,0,0,.45);
  color: #F0F5FA;
}

.tl-banking-modal-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin: 14px 0;
}

.tl-banking-modal input:focus {
  outline: 2px solid #d9b66c;
  outline-offset: 1px;
}

@media(max-width: 500px) {
  .tl-banking-modal {
    padding: 15px;
  }

  .tl-banking-modal-fields {
    grid-template-columns: 1fr;
  }
}
`;

// ============================================
// PROFESSIONAL NAVY STYLES
// ============================================

const s = {
  panel: {
    gridColumn: "1 / -1",
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    background: C.bg,
    color: C.text,
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    overflow: "hidden",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, sans-serif",
  },

  heading: {
    padding: "12px 16px",
    background: C.raised,
    borderLeft: `3px solid ${C.gold}`,
    borderBottom: `1px solid ${C.border}`,
    fontSize: 14,
    fontWeight: 850,
    letterSpacing: ".06em",
  },

  message: {
    margin: "9px 12px 0",
    padding: "10px 12px",
    borderRadius: 7,
    fontSize: 12,
    fontWeight: 750,
  },

  success: {
    background: "#10332E",
    border: "1px solid #2A6354",
    color: "#A8EBD1",
  },

  error: {
    background: "#38202A",
    border: "1px solid #774155",
    color: "#FFC3CE",
  },

  loading: {
    padding: 20,
    textAlign: "center",
    color: C.sub,
  },

  categoryGrid: {
    display: "grid",
    gap: 12,
    padding: 12,
    gridTemplateColumns:
      "repeat(auto-fit, minmax(min(100%, 330px), 1fr))",
  },

  categoryCard: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    padding: 13,
    boxSizing: "border-box",
    background: C.raised,
    border: `1px solid ${C.border}`,
    borderRadius: 9,
  },

  bankingCard: {
    borderColor: "#756039",
    background:
      "linear-gradient(155deg, #1C2C3F, #15263A)",
  },

  categoryHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },

  categoryName: {
    fontSize: 16,
    fontWeight: 850,
    color: C.text,
  },

  fixedTag: {
    color: C.gold,
    fontSize: 9,
    fontWeight: 800,
    padding: "4px 6px",
    border: "1px solid #6A593A",
    background: "#2A2930",
    borderRadius: 5,
  },

  balanceTile: {
    display: "grid",
    gap: 5,
    minWidth: 0,
    padding: "9px 11px",
    marginBottom: 11,
    background: C.inset,
    border: "1px solid #223448",
    borderRadius: 7,
  },

  balanceLabel: {
    fontSize: 10,
    letterSpacing: ".08em",
    fontWeight: 800,
    color: C.muted,
  },

  balanceAmount: {
    fontSize: 15,
    fontWeight: 850,
    fontVariantNumeric: "tabular-nums",
  },

  select: {
    width: "100%",
    boxSizing: "border-box",
    marginBottom: 10,
    padding: "9px 10px",
    minHeight: 39,
    border: `1px solid ${C.border}`,
    borderRadius: 7,
    background: C.bg,
    color: C.text,
    fontSize: 12,
  },

  pending: {
    marginBottom: 10,
    padding: "8px 10px",
    fontSize: 11,
    fontWeight: 800,
    color: "#FFE3A8",
    background: "#322A1D",
    border: "1px solid #695638",
    borderRadius: 7,
  },

  actions: {
    display: "grid",
    gap: 8,
    marginTop: "auto",
  },

  actionRow: {
    display: "grid",
    gridTemplateColumns:
      "66px minmax(0,1fr) 104px",
    alignItems: "center",
    gap: 7,
    minWidth: 0,
  },

  actionLabel: {
    fontSize: 10,
    fontWeight: 850,
    color: C.sub,
  },

  input: {
    minWidth: 0,
    width: "100%",
    boxSizing: "border-box",
    minHeight: 39,
    padding: "8px 10px",
    background: C.inset,
    color: C.text,
    border: `1px solid ${C.border}`,
    borderRadius: 7,
    fontSize: 12,
    fontWeight: 650,
    textAlign: "right",
    fontFamily: "inherit",
  },

  readOnly: {
    color: C.muted,
    background: "#102030",
    cursor: "not-allowed",
  },

  button: {
    minWidth: 0,
    width: "100%",
    minHeight: 39,
    padding: "7px 6px",
    borderRadius: 7,
    fontSize: 11,
    fontWeight: 850,
    cursor: "pointer",
    whiteSpace: "nowrap",
    fontFamily: "inherit",
  },

  saveButton: {
    background: "#186C60",
    border: "1px solid #268B7B",
    color: "#FFFFFF",
  },

  payButton: {
    background: "#224C74",
    border: "1px solid #346D9E",
    color: "#FFFFFF",
  },

  withdrawButton: {
    background: C.bg,
    border: `1px solid ${C.border}`,
    color: C.sub,
  },

  totalsGrid: {
    display: "grid",
    gap: 10,
    padding: "0 12px 12px",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(min(100%, 195px), 1fr))",
  },

  totalTile: {
    display: "grid",
    minWidth: 0,
    gap: 5,
    padding: "11px 13px",
    background: C.raised,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
  },

  totalLabel: {
    color: C.muted,
    fontSize: 10,
    fontWeight: 800,
  },

  totalAmount: {
    fontSize: 17,
    fontWeight: 850,
    fontVariantNumeric: "tabular-nums",
  },

  history: {
    margin: "0 12px 12px",
    padding: 11,
    background: C.raised,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
  },

  historyToggle: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    width: "100%",
    padding: "5px 2px",
    margin: 0,
    color: C.sub,
    background: "transparent",
    border: 0,
    fontSize: 11,
    fontWeight: 850,
    cursor: "pointer",
    textAlign: "left",
    fontFamily: "inherit",
  },

  historyGrid: {
    display: "grid",
    gap: 7,
    marginTop: 9,
    gridTemplateColumns:
      "repeat(auto-fit, minmax(min(100%, 290px), 1fr))",
  },

  historyRow: {
    display: "grid",
    gridTemplateColumns:
      "minmax(0,1fr) auto auto",
    alignItems: "center",
    gap: 9,
    padding: "9px 10px",
    fontSize: 11,
    background: C.inset,
    border: "1px solid #223448",
    borderRadius: 7,
  },

  historyName: {
    display: "grid",
    gap: 3,
    minWidth: 0,
    color: C.text,
  },

  historyDate: {
    color: C.muted,
    fontSize: 10,
  },

  historyAmount: {
    color: C.text,
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap",
  },

  statusBase: {
    fontSize: 9,
    fontWeight: 850,
    padding: "5px 7px",
    borderRadius: 5,
  },

  pendingStatus: {
    color: "#FFE3A8",
    background: "#322A1D",
    border: "1px solid #695638",
  },

  processing: {
    color: "#B1D2FF",
    background: "#142D48",
    border: "1px solid #355779",
  },

  confirmed: {
    color: "#A8EBD1",
    background: "#10332E",
    border: "1px solid #2A6354",
  },

  rejected: {
    color: "#FFC3CE",
    background: "#38202A",
    border: "1px solid #774155",
  },

  // PAYMENT MODALS

  modalHeading: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
    color: C.gold,
    fontSize: 15,
    fontWeight: 850,
  },

  modalSummary: {
    display: "grid",
    gap: 10,
    padding: 12,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    background: C.inset,
  },

  modalSummaryRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    fontSize: 12,
    color: C.sub,
  },

  modalDivider: {
   height: 1,
    background: C.border,
    margin: "3px 0",
  },

  modalField: {
    display: "grid",
    gap: 7,
    minWidth: 0,
  },

  modalLabel: {
    fontSize: 10,
    fontWeight: 850,
    letterSpacing: ".04em",
    color: C.sub,
  },

  feeReadOnlyWrap: {
    display: "flex",
    alignItems: "center",
    minWidth: 0,
    minHeight: 39,
    borderRadius: 7,
    background: C.inset,
    border: "1px solid #776441",
  },

  feeLock: {
    padding: "0 10px",
    fontSize: 14,
  },

  modalHint: {
    margin: "12px 0 14px",
    fontSize: 11,
    lineHeight: 1.6,
    color: C.sub,
  },

  modalActions: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2, minmax(0,1fr))",
    gap: 10,
    marginTop: 12,
  },

  modalCancel: {
    background: C.bg,
    border: `1px solid ${C.border}`,
    color: C.sub,
  },

  modalConfirm: {
    background: "#186C60",
    border: "1px solid #268B7B",
    color: "#FFFFFF",
  },
};
