"use client";

import { useEffect, useState } from "react";

export default function Admin24HourShiftHandover({
  user,
  selectedShift,
  selectedShop,
  onChanged,
}) {
  const [reason, setReason] = useState("");
  const [closing, setClosing] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const accessToken =
    user?.access_token || null;

  const adminProfileId =
    user?.profile_id || null;

  const shopType = String(
    selectedShop?.shop_type || ""
  )
    .trim()
    .toUpperCase();

  const shiftStatus = String(
    selectedShift?.status || ""
  )
    .trim()
    .toUpperCase();

  const shiftName =
    normalizeShiftName(
      selectedShift?.shift_name
    );

  const is24HourShop =
    shopType === "24_HOUR";

  const isOpen =
    shiftStatus === "OPEN";

  const isLegacyDayShift =
    shiftName === "DAY";

  const isProper24HourShift =
    shiftName === "SHIFT 1" ||
    shiftName === "SHIFT 2";

  useEffect(() => {
    setReason("");
    setMessage("");
    setMessageType("");
  }, [selectedShift?.id]);

  // ==================================================
  // DO NOT SHOW FOR 12-HOUR SHOPS
  // ==================================================

  if (
    !selectedShift ||
    !selectedShop ||
    !is24HourShop
  ) {
    return null;
  }

  // ==================================================
  // COMMON ADMIN VALIDATION
  // ==================================================

  function validateAdminAccess() {
    if (!selectedShift?.id) {
      showError(
        "Select an open shift first."
      );
      return false;
    }

    if (!accessToken) {
      showError(
        "Admin authentication is missing. Please log in again."
      );
      return false;
    }

    if (!adminProfileId) {
      showError(
        "Admin profile ID is missing. Please log in again."
      );
      return false;
    }

    return true;
  }

  function getCleanReason() {
    return String(
      reason || ""
    ).trim();
  }

  function showError(text) {
    setMessage(text);
    setMessageType("error");
  }

  // ==================================================
  // LEGACY DAY SHIFT CLOSURE
  //
  // ONLY for old DAY shifts inside 24_HOUR shops.
  //
  // This does NOT perform normal 9PM / midnight / 9AM
  // platform handover validation because the legacy
  // record existed before the 24-hour engine.
  //
  // Existing financial values are preserved exactly.
  // ==================================================

  async function closeLegacyDayShift() {
    if (!validateAdminAccess()) {
      return;
    }

    if (!isLegacyDayShift) {
      showError(
        "This action is only for a legacy DAY shift."
      );
      return;
    }

    if (!isOpen) {
      showError(
        "This legacy shift is already closed."
      );
      return;
    }

    const cleanReason =
      getCleanReason();

    if (cleanReason.length < 3) {
      showError(
        "Enter the reason for closing this legacy DAY shift."
      );
      return;
    }

    const confirmed =
      window.confirm(
        "CLOSE LEGACY 24-HOUR DAY SHIFT\n\n" +
          `Shop: ${
            selectedShop?.shop_name ||
            "-"
          }\n` +
          `Shift: DAY\n` +
          `Cashier: ${
            selectedShift?.cashier_name ||
            "-"
          }\n` +
          `Business Date: ${
            selectedShift?.business_date ||
            "-"
          }\n` +
          `Closing Balance: KES ${money(
            selectedShift?.closing_balance
          )}\n\n` +
          "This is a one-time migration action for an old DAY shift created before the 24-hour SHIFT 1 / SHIFT 2 engine.\n\n" +
          "The existing financial figures will be preserved.\n" +
          "Normal 24-hour platform handover validation will NOT be applied.\n\n" +
          "Close this legacy shift?"
      );

    if (!confirmed) {
      return;
    }

    try {
      setClosing(true);
      setMessage("");
      setMessageType("");

      // ==============================================
      // GET FRESH SHIFT
      // ==============================================

      const shiftResponse =
        await fetch(
          `${supabaseUrl}/rest/v1/shifts` +
            `?id=eq.${encodeURIComponent(
              selectedShift.id
            )}` +
            `&select=*` +
            `&limit=1`,
          {
            method: "GET",

            headers: {
              apikey:
                supabaseAnonKey,

              Authorization:
                `Bearer ${accessToken}`,

              "Content-Type":
                "application/json",
            },

            cache: "no-store",
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
            "Unable to verify the legacy shift."
        );
      }

      const freshShift =
        Array.isArray(
          shiftResult
        ) &&
        shiftResult.length > 0
          ? shiftResult[0]
          : null;

      if (!freshShift) {
        throw new Error(
          "The selected legacy shift could not be found."
        );
      }

      const freshStatus =
        String(
          freshShift.status || ""
        )
          .trim()
          .toUpperCase();

      const freshName =
        normalizeShiftName(
          freshShift.shift_name
        );

      if (
        freshStatus !== "OPEN"
      ) {
        throw new Error(
          "This legacy shift is no longer open."
        );
      }

      if (
        freshName !== "DAY"
      ) {
        throw new Error(
          "The selected shift is no longer a legacy DAY shift."
        );
      }

      if (
        String(
          freshShift.shop_id || ""
        ) !==
        String(
          selectedShop.id || ""
        )
      ) {
        throw new Error(
          "The selected shift does not belong to this shop."
        );
      }

      // ==============================================
      // PRESERVE OLD SNAPSHOT
      // ==============================================

      const oldSnapshot = {
        id:
          freshShift.id,

        shop_id:
          freshShift.shop_id,

        cashier_id:
          freshShift.cashier_id,

        cashier_name:
          freshShift.cashier_name,

        shift_name:
          freshShift.shift_name,

        business_date:
          freshShift.business_date,

        scheduled_start:
          freshShift.scheduled_start,

        scheduled_end:
          freshShift.scheduled_end,

        status:
          freshShift.status,

        opened_at:
          freshShift.opened_at,

        closed_at:
          freshShift.closed_at,

        opening_balance:
          freshShift.opening_balance,

        total_added_float:
          freshShift.total_added_float,

        total_output:
          freshShift.total_output,

        total_expenses:
          freshShift.total_expenses,

        net_income:
          freshShift.net_income,

        closing_balance:
          freshShift.closing_balance,

        notes:
          freshShift.notes,
      };

      // ==============================================
      // CLOSE ONLY
      //
      // IMPORTANT:
      // We deliberately do NOT change:
      // opening_balance
      // total_added_float
      // total_output
      // total_expenses
      // net_income
      // closing_balance
      // shift_name
      //
      // This preserves the KES 100 legacy carry-forward.
      // ==============================================

      const closedAt =
        new Date().toISOString();

      const updateData = {
        status:
          "CLOSED",

        closed_at:
          closedAt,

        admin_override_note:
          cleanReason,

        admin_override_at:
          closedAt,

        admin_override_by:
          adminProfileId,
      };

      const closeResponse =
        await fetch(
          `${supabaseUrl}/rest/v1/shifts` +
            `?id=eq.${encodeURIComponent(
              freshShift.id
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

            body:
              JSON.stringify(
                updateData
              ),
          }
        );

      const closeResult =
        await safeJson(
          closeResponse
        );

      if (!closeResponse.ok) {
        throw new Error(
          closeResult?.message ||
            closeResult?.details ||
            closeResult?.hint ||
            "Unable to close the legacy DAY shift."
        );
      }

      if (
        !Array.isArray(
          closeResult
        ) ||
        closeResult.length === 0
      ) {
        throw new Error(
          "The closed legacy shift was not returned."
        );
      }

      const closedShift =
        closeResult[0];

      // ==============================================
      // AUDIT LOG
      // ==============================================

      const auditResponse =
        await fetch(
          `${supabaseUrl}/rest/v1/audit_log`,
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
              JSON.stringify({
                user_id:
                  adminProfileId,

                shop_id:
                  freshShift.shop_id,

                action:
                  "ADMIN_CLOSE_LEGACY_24H_DAY_SHIFT",

                table_name:
                  "shifts",

                record_id:
                  freshShift.id,

                old_data:
                  oldSnapshot,

                new_data: {
                  ...closedShift,

                  migration_action:
                    true,

                  legacy_shift_name:
                    "DAY",

                  migrated_to_24_hour_engine:
                    true,

                  platform_handover_validation_bypassed:
                    true,

                  financial_values_preserved:
                    true,

                  migration_reason:
                    cleanReason,
                },
              }),
          }
        );

      const auditResult =
        await safeJson(
          auditResponse
        );

      if (!auditResponse.ok) {
        console.error(
          "LEGACY SHIFT AUDIT ERROR:",
          auditResult
        );

        setMessage(
          "Legacy DAY shift was closed successfully and its figures were preserved, but the audit log could not be written. Please check the audit log."
        );

        setMessageType(
          "error"
        );

        if (
          typeof onChanged ===
          "function"
        ) {
          await onChanged();
        }

        return;
      }

      setReason("");

      setMessage(
        `Legacy DAY shift closed successfully. Closing Balance KES ${money(
          closedShift.closing_balance
        )} was preserved for the next shift. The migration was recorded in the audit log.`
      );

      setMessageType(
        "success"
      );

      if (
        typeof onChanged ===
        "function"
      ) {
        await onChanged();
      }
    } catch (error) {
      console.error(
        "LEGACY 24H SHIFT CLOSE ERROR:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to close the legacy DAY shift."
      );

      setMessageType(
        "error"
      );
    } finally {
      setClosing(false);
    }
  }

  // ==================================================
  // NORMAL ADMIN 24-HOUR CLOSE / HANDOVER
  // ==================================================

  async function adminCloseShift() {
    if (!validateAdminAccess()) {
      return;
    }

    if (
      shiftName !== "SHIFT 1" &&
      shiftName !== "SHIFT 2"
    ) {
      showError(
        "This 24-hour shift must be SHIFT 1 or SHIFT 2."
      );
      return;
    }

    const cleanReason =
      getCleanReason();

    if (cleanReason.length < 3) {
      showError(
        "Enter the reason for the Admin handover."
      );
      return;
    }

    const confirmed =
      window.confirm(
        "ADMIN 24-HOUR SHIFT HANDOVER\n\n" +
          `Shop: ${
            selectedShop?.shop_name ||
            "-"
          }\n` +
          `Shift: ${shiftName}\n` +
          `Cashier: ${
            selectedShift?.cashier_name ||
            "-"
          }\n` +
          `Business Date: ${
            selectedShift?.business_date ||
            "-"
          }\n\n` +
          "Admin can perform this handover outside the normal cashier time window.\n\n" +
          "Close this shift?"
      );

    if (!confirmed) {
      return;
    }

    try {
      setClosing(true);
      setMessage("");
      setMessageType("");

      // ==============================================
      // GET FRESH SHIFT
      // ==============================================

      const shiftResponse =
        await fetch(
          `${supabaseUrl}/rest/v1/shifts` +
            `?id=eq.${encodeURIComponent(
              selectedShift.id
            )}` +
            `&select=*` +
            `&limit=1`,
          {
            method: "GET",

            headers: {
              apikey:
                supabaseAnonKey,

              Authorization:
                `Bearer ${accessToken}`,

              "Content-Type":
                "application/json",
            },

            cache: "no-store",
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
            "Unable to verify the shift."
        );
      }

      const freshShift =
        Array.isArray(
          shiftResult
        ) &&
        shiftResult.length > 0
          ? shiftResult[0]
          : null;

      if (!freshShift) {
        throw new Error(
          "The selected shift could not be found."
        );
      }

      if (
        String(
          freshShift.status || ""
        ).toUpperCase() !==
        "OPEN"
      ) {
        throw new Error(
          "This shift is no longer open."
        );
      }

      const freshShiftName =
        normalizeShiftName(
          freshShift.shift_name
        );

      if (
        freshShiftName !==
          "SHIFT 1" &&
        freshShiftName !==
          "SHIFT 2"
      ) {
        throw new Error(
          "The selected shift is not a valid 24-hour SHIFT 1 or SHIFT 2."
        );
      }

      // ==============================================
      // LOAD ACTIVE PLATFORMS
      // ==============================================

      const platformResponse =
        await fetch(
          `${supabaseUrl}/rest/v1/shop_platforms` +
            `?shop_id=eq.${encodeURIComponent(
              selectedShop.id
            )}` +
            `&is_active=eq.true` +
            `&select=id,platform_name,display_order` +
            `&order=display_order.asc`,
          {
            method: "GET",

            headers: {
              apikey:
                supabaseAnonKey,

              Authorization:
                `Bearer ${accessToken}`,

              "Content-Type":
                "application/json",
            },

            cache: "no-store",
          }
        );

      const platformResult =
        await safeJson(
          platformResponse
        );

      if (!platformResponse.ok) {
        throw new Error(
          platformResult?.message ||
            platformResult?.details ||
            "Unable to verify shop platforms."
        );
      }

      const platforms =
        Array.isArray(
          platformResult
        )
          ? platformResult
          : [];

      if (
        platforms.length === 0
      ) {
        throw new Error(
          "No active platforms were found for this shop."
        );
      }

      // ==============================================
      // LOAD READINGS
      // ==============================================

      const readingsResponse =
        await fetch(
          `${supabaseUrl}/rest/v1/platform_readings` +
            `?shift_id=eq.${encodeURIComponent(
              selectedShift.id
            )}` +
            `&select=id,platform_id,reading_kind,reading_value,recorded_at`,
          {
            method: "GET",

            headers: {
              apikey:
                supabaseAnonKey,

              Authorization:
                `Bearer ${accessToken}`,

              "Content-Type":
                "application/json",
            },

            cache: "no-store",
          }
        );

      const readingsResult =
        await safeJson(
          readingsResponse
        );

      if (!readingsResponse.ok) {
        throw new Error(
          readingsResult?.message ||
            readingsResult?.details ||
            "Unable to verify platform readings."
        );
      }

      const readings =
        Array.isArray(
          readingsResult
        )
          ? readingsResult
          : [];

      // ==============================================
      // VERIFY REQUIRED READINGS
      //
      // Admin bypasses TIME restriction.
      // Admin does NOT silently bypass missing figures.
      // ==============================================

      const readingCheck =
        checkRequiredReadings({
          platforms,
          readings,
          shiftName:
            freshShiftName,
        });

      if (
        !readingCheck.complete
      ) {
        throw new Error(
          readingCheck.message
        );
      }

      // ==============================================
      // OLD SNAPSHOT FOR AUDIT
      // ==============================================

      const oldSnapshot = {
        id:
          freshShift.id,

        shop_id:
          freshShift.shop_id,

        cashier_id:
          freshShift.cashier_id,

        cashier_name:
          freshShift.cashier_name,

        shift_name:
          freshShift.shift_name,

        business_date:
          freshShift.business_date,

        status:
          freshShift.status,

        opened_at:
          freshShift.opened_at,

        closed_at:
          freshShift.closed_at,

        opening_balance:
          freshShift.opening_balance,

        total_added_float:
          freshShift.total_added_float,

        total_output:
          freshShift.total_output,

        total_expenses:
          freshShift.total_expenses,

        net_income:
          freshShift.net_income,

        closing_balance:
          freshShift.closing_balance,
      };

      // ==============================================
      // CLOSE SHIFT
      // ==============================================

      const closedAt =
        new Date().toISOString();

      const updateData = {
        status:
          "CLOSED",

        closed_at:
          closedAt,

        admin_override_note:
          cleanReason,

        admin_override_at:
          closedAt,

        admin_override_by:
          adminProfileId,
      };

      const closeResponse =
        await fetch(
          `${supabaseUrl}/rest/v1/shifts` +
            `?id=eq.${encodeURIComponent(
              selectedShift.id
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

            body:
              JSON.stringify(
                updateData
              ),
          }
        );

      const closeResult =
        await safeJson(
          closeResponse
        );

      if (!closeResponse.ok) {
        throw new Error(
          closeResult?.message ||
            closeResult?.details ||
            closeResult?.hint ||
            "Unable to close the shift."
        );
      }

      if (
        !Array.isArray(
          closeResult
        ) ||
        closeResult.length === 0
      ) {
        throw new Error(
          "The closed shift was not returned."
        );
      }

      const closedShift =
        closeResult[0];

      // ==============================================
      // AUDIT LOG
      // ==============================================

      const auditResponse =
        await fetch(
          `${supabaseUrl}/rest/v1/audit_log`,
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
              JSON.stringify({
                user_id:
                  adminProfileId,

                shop_id:
                  freshShift.shop_id,

                action:
                  "ADMIN_24H_SHIFT_HANDOVER",

                table_name:
                  "shifts",

                record_id:
                  freshShift.id,

                old_data:
                  oldSnapshot,

                new_data: {
                  ...closedShift,

                  admin_handover_reason:
                    cleanReason,

                  admin_handover:
                    true,

                  normal_cashier_time_window_bypassed:
                    true,
                },
              }),
          }
        );

      const auditResult =
        await safeJson(
          auditResponse
        );

      if (!auditResponse.ok) {
        console.error(
          "ADMIN HANDOVER AUDIT ERROR:",
          auditResult
        );

        setMessage(
          "Shift was closed successfully, but the audit log could not be written. Please check the audit log."
        );

        setMessageType(
          "error"
        );

        if (
          typeof onChanged ===
          "function"
        ) {
          await onChanged();
        }

        return;
      }

      setReason("");

      setMessage(
        `${freshShiftName} was closed by Admin successfully. The override was recorded in the audit log.`
      );

      setMessageType(
        "success"
      );

      if (
        typeof onChanged ===
        "function"
      ) {
        await onChanged();
      }
    } catch (error) {
      console.error(
        "ADMIN 24H HANDOVER ERROR:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to complete the Admin handover."
      );

      setMessageType(
        "error"
      );
    } finally {
      setClosing(false);
    }
  }

  // ==================================================
  // DISPLAY
  // ==================================================

  return (
    <div
      style={{
        marginTop: "16px",
        marginBottom: "16px",
        border:
          isLegacyDayShift
            ? "2px solid #dc2626"
            : "2px solid #f59e0b",
        borderRadius: "7px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "9px 12px",
          backgroundColor:
            isLegacyDayShift
              ? "#dc2626"
              : "#f59e0b",
          color: "#ffffff",
          fontSize: "11px",
          fontWeight: "bold",
        }}
      >
        {isLegacyDayShift
          ? "LEGACY 24-HOUR SHIFT MIGRATION"
          : "ADMIN 24-HOUR SHIFT HANDOVER"}
      </div>

      <div
        style={{
          padding: "14px",
          backgroundColor:
            isLegacyDayShift
              ? "#fef2f2"
              : "#fffbeb",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(3, 1fr)",
            gap: "8px",
            marginBottom: "12px",
          }}
        >
          <InfoBox
            title="SHIFT"
            value={
              shiftName || "-"
            }
          />

          <InfoBox
            title="STATUS"
            value={
              shiftStatus || "-"
            }
          />

          <InfoBox
            title="CASHIER"
            value={
              selectedShift.cashier_name ||
              "-"
            }
          />
        </div>

        {isLegacyDayShift && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(3, 1fr)",
              gap: "8px",
              marginBottom: "12px",
            }}
          >
            <InfoBox
              title="BALANCE B/F"
              value={`KES ${money(
                selectedShift.opening_balance
              )}`}
            />

            <InfoBox
              title="NET INCOME"
              value={`KES ${money(
                selectedShift.net_income
              )}`}
            />

            <InfoBox
              title="CLOSING BALANCE"
              value={`KES ${money(
                selectedShift.closing_balance
              )}`}
            />
          </div>
        )}

        {isOpen ? (
          <>
            {isLegacyDayShift ? (
              <div
                style={{
                  padding: "10px",
                  marginBottom: "12px",
                  borderRadius: "5px",
                  backgroundColor:
                    "#fee2e2",
                  color: "#991b1b",
                  fontSize: "11px",
                  fontWeight: "bold",
                }}
              >
                This is an old DAY shift created before Kings was
                switched to the proper 24-hour SHIFT 1 / SHIFT 2
                engine. Closing it here preserves its existing
                financial figures and does not require 24-hour
                platform handover readings.
              </div>
            ) : isProper24HourShift ? (
              <div
                style={{
                  padding: "10px",
                  marginBottom: "12px",
                  borderRadius: "5px",
                  backgroundColor:
                    "#fef3c7",
                  color: "#92400e",
                  fontSize: "11px",
                }}
              >
                Admin may close this shift outside the normal cashier
                9–11 AM / 9–11 PM handover windows. Required platform
                readings must still be present.
              </div>
            ) : (
              <div
                style={{
                  padding: "10px",
                  marginBottom: "12px",
                  borderRadius: "5px",
                  backgroundColor:
                    "#fef2f2",
                  color: "#991b1b",
                  fontSize: "11px",
                }}
              >
                This shift is not a recognised SHIFT 1, SHIFT 2, or
                legacy DAY shift. No Admin handover action is
                available.
              </div>
            )}

            {(isLegacyDayShift ||
              isProper24HourShift) && (
              <>
                <label
                  style={{
                    display: "block",
                    fontSize: "10px",
                    fontWeight: "bold",
                    color: "#334155",
                    marginBottom: "6px",
                  }}
                >
                  {isLegacyDayShift
                    ? "LEGACY SHIFT CLOSURE REASON *"
                    : "ADMIN HANDOVER REASON *"}
                </label>

                <textarea
                  rows={3}
                  value={reason}
                  disabled={closing}
                  onChange={(event) => {
                    setReason(
                      event.target.value
                    );

                    setMessage("");
                  }}
                  placeholder={
                    isLegacyDayShift
                      ? "Example: Closing old DAY test shift before starting the new 24-hour SHIFT 1 / SHIFT 2 system."
                      : "Example: Cashier reported late; Admin completed the morning handover."
                  }
                  style={{
                    width: "100%",
                    boxSizing:
                      "border-box",
                    padding: "10px",
                    border:
                      isLegacyDayShift
                        ? "1px solid #dc2626"
                        : "1px solid #d97706",
                    borderRadius: "5px",
                    resize: "vertical",
                    backgroundColor:
                      "#ffffff",
                    marginBottom: "10px",
                  }}
                />

                <button
                  type="button"
                  onClick={
                    isLegacyDayShift
                      ? closeLegacyDayShift
                      : adminCloseShift
                  }
                  disabled={closing}
                  style={{
                    width: "100%",
                    padding: "11px",
                    border: "none",
                    borderRadius: "5px",
                    backgroundColor:
                      closing
                        ? "#94a3b8"
                        : isLegacyDayShift
                        ? "#dc2626"
                        : "#d97706",
                    color: "white",
                    fontWeight: "bold",
                    cursor:
                      closing
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  {closing
                    ? isLegacyDayShift
                      ? "CLOSING LEGACY DAY SHIFT..."
                      : "ADMIN HANDOVER IN PROGRESS..."
                    : isLegacyDayShift
                    ? "CLOSE LEGACY DAY SHIFT"
                    : `ADMIN CLOSE ${shiftName} & HAND OVER`}
                </button>
              </>
            )}
          </>
        ) : (
          <div
            style={{
              padding: "10px",
              borderRadius: "5px",
              backgroundColor:
                "#ecfdf5",
              color: "#166534",
              fontWeight: "bold",
              fontSize: "11px",
              textAlign: "center",
            }}
          >
            This shift is already closed.
          </div>
        )}

        {message && (
          <div
            style={{
              padding: "10px",
              marginTop: "12px",
              borderRadius: "5px",
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
              fontSize: "11px",
            }}
          >
            {message}
          </div>
        )}
      </div>
    </div>
  );
}

// ==================================================
// REQUIRED READINGS
// ==================================================

function checkRequiredReadings({
  platforms,
  readings,
  shiftName,
}) {
  const readingSet =
    new Set();

  for (
    const row of readings
  ) {
    if (
      row.platform_id &&
      row.reading_kind
    ) {
      readingSet.add(
        `${row.platform_id}:${row.reading_kind}`
      );
    }
  }

  // SHIFT 1 closes at 9 PM.
  // Every platform needs HANDOVER_9PM.

  if (
    shiftName === "SHIFT 1"
  ) {
    const missing =
      platforms.filter(
        (platform) =>
          !readingSet.has(
            `${platform.id}:HANDOVER_9PM`
          )
      );

    if (
      missing.length > 0
    ) {
      return {
        complete: false,

        message:
          `Admin cannot close this shift yet. Missing 9 PM handover reading for: ${missing
            .map(
              (platform) =>
                platform.platform_name
            )
            .join(", ")}.`,
      };
    }

    return {
      complete: true,
      message: "",
    };
  }

  // SHIFT 2:
  // Resettable platforms need midnight close.
  // All platforms need CLOSING_9AM.
  // TABLE does NOT need midnight close.

  if (
    shiftName === "SHIFT 2"
  ) {
    const missingMidnight =
      platforms.filter(
        (platform) =>
          !isTable(platform) &&
          !readingSet.has(
            `${platform.id}:MIDNIGHT_CLOSE`
          )
      );

    if (
      missingMidnight.length >
      0
    ) {
      return {
        complete: false,

        message:
          `Admin cannot close this shift yet. Missing 11:59 PM reading for: ${missingMidnight
            .map(
              (platform) =>
                platform.platform_name
            )
            .join(", ")}.`,
      };
    }

    const missing9am =
      platforms.filter(
        (platform) =>
          !readingSet.has(
            `${platform.id}:CLOSING_9AM`
          )
      );

    if (
      missing9am.length > 0
    ) {
      return {
        complete: false,

        message:
          `Admin cannot close this shift yet. Missing 9 AM handover reading for: ${missing9am
            .map(
              (platform) =>
                platform.platform_name
            )
            .join(", ")}.`,
      };
    }

    return {
      complete: true,
      message: "",
    };
  }

  return {
    complete: false,

    message:
      "This is not a valid SHIFT 1 or SHIFT 2.",
  };
}

// ==================================================
// HELPERS
// ==================================================

function normalizeShiftName(
  value
) {
  const text = String(
    value || ""
  )
    .trim()
    .toUpperCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

  if (
    text === "SHIFT1" ||
    text === "SHIFT 1"
  ) {
    return "SHIFT 1";
  }

  if (
    text === "SHIFT2" ||
    text === "SHIFT 2"
  ) {
    return "SHIFT 2";
  }

  return text;
}

function isTable(platform) {
  return (
    String(
      platform?.platform_name ||
        ""
    )
      .trim()
      .toUpperCase() ===
    "TABLE"
  );
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

async function safeJson(
  response
) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function InfoBox({
  title,
  value,
}) {
  return (
    <div
      style={{
        padding: "8px",
        backgroundColor:
          "#ffffff",
        border:
          "1px solid #fde68a",
        borderRadius: "5px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: "9px",
          color: "#64748b",
          fontWeight: "bold",
        }}
      >
        {title}
      </div>

      <div
        style={{
          marginTop: "4px",
          fontSize: "11px",
          fontWeight: "bold",
          color: "#0f172a",
        }}
      >
        {value}
      </div>
    </div>
  );
}
