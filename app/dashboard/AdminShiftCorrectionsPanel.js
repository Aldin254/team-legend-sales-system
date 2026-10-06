"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import AdminPlatformCorrections from "./AdminPlatformCorrections";
import AdminExpenseCorrections from "./AdminExpenseCorrections";
import AdminAuditLogPanel from "./AdminAuditLogPanel";
import AdminCarryForwardSync from "./AdminCarryForwardSync";
import Admin24HourShiftHandover from "./Admin24HourShiftHandover";

export default function AdminShiftCorrectionsPanel({
  user,
}) {
  const [shops, setShops] =
    useState([]);

  const [
    selectedShopId,
    setSelectedShopId,
  ] = useState("");

  const [shifts, setShifts] =
    useState([]);

  const [
    selectedShiftId,
    setSelectedShiftId,
  ] = useState("");

  const [
    openingBalance,
    setOpeningBalance,
  ] = useState("");

  const [
    netIncome,
    setNetIncome,
  ] = useState("");

  const [
    closingBalance,
    setClosingBalance,
  ] = useState("");

  const [
    manualTotals,
    setManualTotals,
  ] = useState(false);

  const [reason, setReason] =
    useState("");

  const [
    loadingShops,
    setLoadingShops,
  ] = useState(true);

  const [
    loadingShifts,
    setLoadingShifts,
  ] = useState(false);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [
    messageType,
    setMessageType,
  ] = useState("");

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const accessToken =
    user?.access_token ||
    null;

  // audit_log.user_id points to profiles.id
  const adminProfileId =
    user?.profile_id ||
    null;

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
  // SELECTED SHIFT
  // ==================================================

  const selectedShift =
    useMemo(() => {
      return (
        shifts.find(
          (shift) =>
            shift.id ===
            selectedShiftId
        ) || null
      );
    }, [
      shifts,
      selectedShiftId,
    ]);

  const selectedShop =
    useMemo(() => {
      return (
        shops.find(
          (shop) =>
            shop.id ===
            selectedShopId
        ) || null
      );
    }, [
      shops,
      selectedShopId,
    ]);

  // ==================================================
  // LOAD SHOPS
  // Includes ACTIVE and INACTIVE historical shops
  // ==================================================

  const loadShops =
    useCallback(
      async () => {
        if (
          !supabaseUrl ||
          !supabaseAnonKey ||
          !accessToken
        ) {
          setLoadingShops(
            false
          );

          return;
        }

        try {
          setLoadingShops(
            true
          );

          const response =
            await fetch(
              `${supabaseUrl}/rest/v1/shops` +
                `?select=id,shop_name,shop_type,is_active` +
                `&order=shop_name.asc`,
              {
                method:
                  "GET",

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
            Array.isArray(
              result
            )
              ? result
              : [];

          setShops(
            loaded
          );

          setSelectedShopId(
            (previous) => {
              const stillExists =
                loaded.some(
                  (shop) =>
                    shop.id ===
                    previous
                );

              if (
                previous &&
                stillExists
              ) {
                return previous;
              }

              return (
                loaded[0]?.id ||
                ""
              );
            }
          );
        } catch (error) {
          console.error(
            "LOAD CORRECTION SHOPS ERROR:",
            error
          );

          setMessage(
            error?.message ||
              "Unable to load shops."
          );

          setMessageType(
            "error"
          );
        } finally {
          setLoadingShops(
            false
          );
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
  // Loads historical shifts too
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

          setSelectedShiftId(
            ""
          );

          return;
        }

        try {
          setLoadingShifts(
            true
          );

          const response =
            await fetch(
              `${supabaseUrl}/rest/v1/shifts` +
                `?shop_id=eq.${encodeURIComponent(
                  selectedShopId
                )}` +
                `&select=` +
                `id,shop_id,cashier_id,cashier_name,shift_name,` +
                `business_date,status,opened_at,closed_at,` +
                `opening_balance,total_added_float,total_output,` +
                `total_expenses,net_income,closing_balance,` +
                `admin_manual_totals,admin_override_note,` +
                `admin_override_at,admin_override_by` +
                `&order=business_date.desc,opened_at.desc` +
                `&limit=500`,
              {
                method:
                  "GET",

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
            Array.isArray(
              result
            )
              ? result
              : [];

          setShifts(
            loaded
          );

          setSelectedShiftId(
            (previous) => {
              const stillExists =
                loaded.some(
                  (shift) =>
                    shift.id ===
                    previous
                );

              if (
                previous &&
                stillExists
              ) {
                return previous;
              }

              return (
                loaded[0]?.id ||
                ""
              );
            }
          );
        } catch (error) {
          console.error(
            "LOAD CORRECTION SHIFTS ERROR:",
            error
          );

          setMessage(
            error?.message ||
              "Unable to load shifts."
          );

          setMessageType(
            "error"
          );
        } finally {
          setLoadingShifts(
            false
          );
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
  // INITIAL LOAD
  // ==================================================

  useEffect(() => {
    loadShops();
  }, [
    loadShops,
  ]);

  useEffect(() => {
    loadShifts();
  }, [
    loadShifts,
  ]);

  // ==================================================
  // LOAD SELECTED SHIFT INTO FORM
  // ==================================================

  useEffect(() => {
    if (
      !selectedShift
    ) {
      setOpeningBalance(
        ""
      );

      setNetIncome(
        ""
      );

      setClosingBalance(
        ""
      );

      setManualTotals(
        false
      );

      setReason(
        ""
      );

      return;
    }

    setOpeningBalance(
      String(
        selectedShift.opening_balance ??
          0
      )
    );

    setNetIncome(
      String(
        selectedShift.net_income ??
          0
      )
    );

    setClosingBalance(
      String(
        selectedShift.closing_balance ??
          0
      )
    );

    setManualTotals(
      Boolean(
        selectedShift.admin_manual_totals
      )
    );

    setReason(
      ""
    );

    setMessage(
      ""
    );
  }, [
    selectedShift,
  ]);

  // ==================================================
  // RESET FORM
  // ==================================================

  function resetForm() {
    if (
      !selectedShift
    ) {
      return;
    }

    setOpeningBalance(
      String(
        selectedShift.opening_balance ??
          0
      )
    );

    setNetIncome(
      String(
        selectedShift.net_income ??
          0
      )
    );

    setClosingBalance(
      String(
        selectedShift.closing_balance ??
          0
      )
    );

    setManualTotals(
      Boolean(
        selectedShift.admin_manual_totals
      )
    );

    setReason(
      ""
    );

    setMessage(
      ""
    );
  }

  // ==================================================
  // SAVE SHIFT CORRECTION
  // ==================================================

  async function saveCorrection() {
    if (
      !selectedShift
    ) {
      setMessage(
        "Select a shift first."
      );

      setMessageType(
        "error"
      );

      return;
    }

    if (
      !adminProfileId
    ) {
      setMessage(
        "Admin profile ID is missing. Please log in again."
      );

      setMessageType(
        "error"
      );

      return;
    }

    const cleanReason =
      String(
        reason ||
          ""
      ).trim();

    if (
      cleanReason.length <
      3
    ) {
      setMessage(
        "Enter a correction reason before saving."
      );

      setMessageType(
        "error"
      );

      return;
    }

    const newOpeningBalance =
      Number(
        openingBalance
      );

    if (
      openingBalance ===
        "" ||
      Number.isNaN(
        newOpeningBalance
      ) ||
      newOpeningBalance <
        0
    ) {
      setMessage(
        "Enter a valid Balance B/F."
      );

      setMessageType(
        "error"
      );

      return;
    }

    let newNetIncome =
      null;

    let newClosingBalance =
      null;

    if (
      manualTotals
    ) {
      newNetIncome =
        Number(
          netIncome
        );

      newClosingBalance =
        Number(
          closingBalance
        );

      if (
        netIncome ===
          "" ||
        Number.isNaN(
          newNetIncome
        )
      ) {
        setMessage(
          "Enter a valid Net Income."
        );

        setMessageType(
          "error"
        );

        return;
      }

      if (
        closingBalance ===
          "" ||
        Number.isNaN(
          newClosingBalance
        )
      ) {
        setMessage(
          "Enter a valid Closing Balance."
        );

        setMessageType(
          "error"
        );

        return;
      }
    }

    const confirmed =
      window.confirm(
        "ADMIN SHIFT CORRECTION\n\n" +
          `Shop: ${
            selectedShop?.shop_name ||
            "-"
          }\n` +
          `Date: ${
            selectedShift.business_date ||
            "-"
          }\n` +
          `Status: ${
            selectedShift.status ||
            "-"
          }\n\n` +
          "Save these Admin corrections?"
      );

    if (
      !confirmed
    ) {
      return;
    }

    try {
      setSaving(
        true
      );

      setMessage(
        ""
      );

      setMessageType(
        ""
      );

      const oldSnapshot = {
        id:
          selectedShift.id,

        shop_id:
          selectedShift.shop_id,

        cashier_id:
          selectedShift.cashier_id,

        cashier_name:
          selectedShift.cashier_name,

        shift_name:
          selectedShift.shift_name,

        business_date:
          selectedShift.business_date,

        status:
          selectedShift.status,

        opening_balance:
          selectedShift.opening_balance,

        total_added_float:
          selectedShift.total_added_float,

        total_output:
          selectedShift.total_output,

        total_expenses:
          selectedShift.total_expenses,

        net_income:
          selectedShift.net_income,

        closing_balance:
          selectedShift.closing_balance,

        admin_manual_totals:
          selectedShift.admin_manual_totals,

        admin_override_note:
          selectedShift.admin_override_note,

        admin_override_at:
          selectedShift.admin_override_at,

        admin_override_by:
          selectedShift.admin_override_by,
      };

      // ==========================================
      // BUILD SHIFT UPDATE
      // ==========================================

      const updateData = {
        opening_balance:
          roundMoney(
            newOpeningBalance
          ),

        admin_manual_totals:
          manualTotals,

        admin_override_note:
          cleanReason,

        admin_override_at:
          new Date().toISOString(),

        admin_override_by:
          adminProfileId,
      };

      // If Manual Admin Totals is ON,
      // preserve Admin-entered final values.

      if (
        manualTotals
      ) {
        updateData.net_income =
          roundMoney(
            newNetIncome
          );

        updateData.closing_balance =
          roundMoney(
            newClosingBalance
          );
      }

      // ==========================================
      // UPDATE SHIFT
      // ==========================================

      const shiftResponse =
        await fetch(
          `${supabaseUrl}/rest/v1/shifts` +
            `?id=eq.${encodeURIComponent(
              selectedShift.id
            )}`,
          {
            method:
              "PATCH",

            headers: {
              ...authHeaders,

              Prefer:
                "return=representation",
            },

            body:
              JSON.stringify(
                updateData
              ),
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
            shiftResult?.hint ||
            "Unable to save shift correction."
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
          "Shift correction was not returned."
        );
      }

      const updatedShift =
        shiftResult[0];

      // ==========================================
      // WRITE AUDIT LOG
      // ==========================================

      const auditResponse =
        await fetch(
          `${supabaseUrl}/rest/v1/audit_log`,
          {
            method:
              "POST",

            headers: {
              ...authHeaders,

              Prefer:
                "return=representation",
            },

            body:
              JSON.stringify({
                user_id:
                  adminProfileId,

                shop_id:
                  selectedShift.shop_id,

                action:
                  manualTotals
                    ? "ADMIN_SHIFT_MANUAL_TOTAL_CORRECTION"
                    : "ADMIN_SHIFT_CORRECTION",

                table_name:
                  "shifts",

                record_id:
                  selectedShift.id,

                old_data:
                  oldSnapshot,

                new_data: {
                  ...updatedShift,

                  correction_reason:
                    cleanReason,

                  correction_mode:
                    manualTotals
                      ? "MANUAL_ADMIN_TOTALS"
                      : "AUTOMATIC_TOTALS",
                },
              }),
          }
        );

      const auditResult =
        await safeJson(
          auditResponse
        );

      if (
        !auditResponse.ok
      ) {
        console.error(
          "AUDIT LOG ERROR:",
          auditResult
        );

        setMessage(
          "Shift correction was saved, but the audit log could not be written. Please notify Admin."
        );

        setMessageType(
          "error"
        );

        await loadShifts();

        return;
      }

      setMessage(
        "Admin correction saved and recorded in the audit log."
      );

      setMessageType(
        "success"
      );

      await loadShifts();
    } catch (error) {
      console.error(
        "SAVE SHIFT CORRECTION ERROR:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to save correction."
      );

      setMessageType(
        "error"
      );
    } finally {
      setSaving(
        false
      );
    }
  }

  // ==================================================
  // DISPLAY
  // ==================================================

  return (
    <section
      style={
        panelStyle
      }
    >
      <div
        style={
          titleStyle
        }
      >
        ADMIN SHIFT CORRECTIONS
      </div>

      <div
        style={
          bodyStyle
        }
      >
        <div
          style={
            selectorGridStyle
          }
        >
          {/* SHOP */}

          <div>
            <label
              style={
                labelStyle
              }
            >
              SELECT SHOP
            </label>

            <select
              value={
                selectedShopId
              }
              disabled={
                loadingShops
              }
              onChange={(
                event
              ) => {
                setSelectedShopId(
                  event.target
                    .value
                );

                setSelectedShiftId(
                  ""
                );

                setMessage(
                  ""
                );
              }}
              style={
                selectStyle
              }
            >
              {shops.map(
                (
                  shop
                ) => (
                  <option
                    key={
                      shop.id
                    }
                    value={
                      shop.id
                    }
                  >
                    {shop.shop_name}{" "}
                    ({shop.shop_type})
                    {!shop.is_active
                      ? " - INACTIVE"
                      : ""}
                  </option>
                )
              )}
            </select>
          </div>

          {/* SHIFT */}

          <div>
            <label
              style={
                labelStyle
              }
            >
              SELECT SHIFT
            </label>

            <select
              value={
                selectedShiftId
              }
              disabled={
                loadingShifts ||
                shifts.length ===
                  0
              }
              onChange={(
                event
              ) => {
                setSelectedShiftId(
                  event.target
                    .value
                );

                setMessage(
                  ""
                );
              }}
              style={
                selectStyle
              }
            >
              {shifts.length ===
              0 ? (
                <option
                  value=""
                >
                  No shifts found
                </option>
              ) : (
                shifts.map(
                  (
                    shift
                  ) => (
                    <option
                      key={
                        shift.id
                      }
                      value={
                        shift.id
                      }
                    >
                      {shift.business_date}
                      {" | "}
                      {shift.shift_name}
                      {" | "}
                      {shift.status}
                      {" | "}
                      {shift.cashier_name}
                    </option>
                  )
                )
              )}
            </select>
          </div>
        </div>

        {selectedShift && (
          <>
            {/* SHIFT INFORMATION */}

            <div
              style={
                statusGridStyle
              }
            >
              <InfoBox
                title="SHOP"
                value={
                  selectedShop?.shop_name ||
                  "-"
                }
              />

              <InfoBox
                title="BUSINESS DATE"
                value={
                  selectedShift.business_date ||
                  "-"
                }
              />

              <InfoBox
                title="SHIFT"
                value={
                  selectedShift.shift_name ||
                  "-"
                }
              />

              <InfoBox
                title="STATUS"
                value={
                  selectedShift.status ||
                  "-"
                }
                status
              />

              <InfoBox
                title="CASHIER"
                value={
                  selectedShift.cashier_name ||
                  "-"
                }
              />
            </div>

            {/* CURRENT CALCULATION INFORMATION */}

            <div
              style={
                currentTotalsStyle
              }
            >
              <div>
                <small>
                  Added Float
                </small>

                <strong>
                  KES{" "}
                  {money(
                    selectedShift.total_added_float
                  )}
                </strong>
              </div>

              <div>
                <small>
                  Platform Output
                </small>

                <strong>
                  KES{" "}
                  {money(
                    selectedShift.total_output
                  )}
                </strong>
              </div>

              <div>
                <small>
                  Expenses
                </small>

                <strong>
                  KES{" "}
                  {money(
                    selectedShift.total_expenses
                  )}
                </strong>
              </div>
            </div>

            {/* PLATFORM CORRECTIONS */}

            <AdminPlatformCorrections
              user={
                user
              }
              selectedShift={
                selectedShift
              }
              selectedShop={
                selectedShop
              }
              onChanged={
                loadShifts
              }
            />

            {/* EXPENSE CORRECTIONS */}

            <AdminExpenseCorrections
              user={
                user
              }
              selectedShift={
                selectedShift
              }
              selectedShop={
                selectedShop
              }
              onChanged={
                loadShifts
              }
            />

            {/* ===================================== */}
            {/* SAVINGS CORRECTIONS REMOVED */}
            {/* Savings are controlled by the */}
            {/* Savings / Banking ledger system. */}
            {/* ===================================== */}

            {/* CARRY FORWARD */}

            <AdminCarryForwardSync
              user={
                user
              }
              selectedShift={
                selectedShift
              }
              selectedShop={
                selectedShop
              }
              onChanged={
                loadShifts
              }
            />

            {/* ADMIN 24-HOUR SHIFT HANDOVER */}

            <Admin24HourShiftHandover
              user={
                user
              }
              selectedShift={
                selectedShift
              }
              selectedShop={
                selectedShop
              }
              onChanged={
                loadShifts
              }
            />

            {/* CORRECTION FIELDS */}

            <div
              style={
                sectionTitleStyle
              }
            >
              SHIFT TOTAL CORRECTION
            </div>

            <div
              style={
                fieldGridStyle
              }
            >
              <div>
                <label
                  style={
                    labelStyle
                  }
                >
                  BALANCE B/F
                </label>

                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={
                    openingBalance
                  }
                  onChange={(
                    event
                  ) =>
                    setOpeningBalance(
                      event.target
                        .value
                    )
                  }
                  style={
                    inputStyle
                  }
                />
              </div>

              <div>
                <label
                  style={
                    labelStyle
                  }
                >
                  NET INCOME
                </label>

                <input
                  type="number"
                  step="0.01"
                  value={
                    netIncome
                  }
                  disabled={
                    !manualTotals
                  }
                  onChange={(
                    event
                  ) =>
                    setNetIncome(
                      event.target
                        .value
                    )
                  }
                  style={{
                    ...inputStyle,

                    backgroundColor:
                      manualTotals
                        ? "white"
                        : "#e2e8f0",
                  }}
                />
              </div>

              <div>
                <label
                  style={
                    labelStyle
                  }
                >
                  CLOSING BALANCE
                </label>

                <input
                  type="number"
                  step="0.01"
                  value={
                    closingBalance
                  }
                  disabled={
                    !manualTotals
                  }
                  onChange={(
                    event
                  ) =>
                    setClosingBalance(
                      event.target
                        .value
                    )
                  }
                  style={{
                    ...inputStyle,

                    backgroundColor:
                      manualTotals
                        ? "white"
                        : "#e2e8f0",
                  }}
                />
              </div>
            </div>

            {/* MANUAL TOTALS SWITCH */}

            <label
              style={
                manualStyle
              }
            >
              <input
                type="checkbox"
                checked={
                  manualTotals
                }
                onChange={(
                  event
                ) => {
                  const checked =
                    event.target
                      .checked;

                  setManualTotals(
                    checked
                  );

                  if (
                    !checked
                  ) {
                    setNetIncome(
                      String(
                        selectedShift.net_income ??
                          0
                      )
                    );

                    setClosingBalance(
                      String(
                        selectedShift.closing_balance ??
                          0
                      )
                    );
                  }
                }}
              />

              <span>
                <strong>
                  Manual Admin Totals
                </strong>

                <small
                  style={
                    manualHelpStyle
                  }
                >
                  When ON, Admin can directly set Net Income and Closing Balance.
                  When OFF, the system calculates them automatically.
                </small>
              </span>
            </label>

            {/* REASON */}

            <div
              style={
                reasonWrapStyle
              }
            >
              <label
                style={
                  labelStyle
                }
              >
                CORRECTION REASON *
              </label>

              <textarea
                value={
                  reason
                }
                onChange={(
                  event
                ) =>
                  setReason(
                    event.target
                      .value
                  )
                }
                placeholder="Example: Cashier entered the wrong opening balance."
                rows={
                  3
                }
                style={
                  textareaStyle
                }
              />
            </div>

            {/* EXISTING ADMIN CORRECTION */}

            {selectedShift.admin_override_note && (
              <div
                style={
                  previousCorrectionStyle
                }
              >
                <strong>
                  Previous Admin Note:
                </strong>{" "}
                {
                  selectedShift.admin_override_note
                }
              </div>
            )}

            {/* MESSAGE */}

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

            {/* ACTIONS */}

            <div
              style={
                buttonGridStyle
              }
            >
              <button
                type="button"
                onClick={
                  resetForm
                }
                disabled={
                  saving
                }
                style={
                  resetButtonStyle
                }
              >
                RESET CHANGES
              </button>

              <button
                type="button"
                onClick={
                  saveCorrection
                }
                disabled={
                  saving
                }
                style={
                  saveButtonStyle
                }
              >
                {saving
                  ? "SAVING CORRECTION..."
                  : "SAVE ADMIN CORRECTION"}
              </button>
            </div>

            <div
              style={
                auditNoticeStyle
              }
            >
              Every saved correction records the previous values, new values,
              Admin profile, shop, shift and correction reason in the audit log.
            </div>

            <AdminAuditLogPanel
              user={
                user
              }
              selectedShift={
                selectedShift
              }
              selectedShop={
                selectedShop
              }
            />
          </>
        )}
      </div>
    </section>
  );
}

// ==================================================
// INFO BOX
// ==================================================

function InfoBox({
  title,
  value,
  status,
}) {
  const statusValue =
    String(
      value ||
        ""
    ).toUpperCase();

  return (
    <div
      style={
        infoBoxStyle
      }
    >
      <div
        style={
          infoTitleStyle
        }
      >
        {title}
      </div>

      <div
        style={{
          ...infoValueStyle,

          color:
            status &&
            statusValue ===
              "OPEN"
              ? "#15803d"
              : status &&
                statusValue ===
                  "CLOSED"
              ? "#b91c1c"
              : "#0f172a",
        }}
      >
        {value}
      </div>
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

function money(
  value
) {
  return Number(
    value ||
      0
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

// ==================================================
// STYLES
// ==================================================

const panelStyle = {
  backgroundColor:
    "#ffffff",

  borderRadius:
    "8px",

  overflow:
    "hidden",

  boxShadow:
    "0 1px 6px rgba(0,0,0,0.12)",

  marginTop:
    "20px",
};

const titleStyle = {
  backgroundColor:
    "#7c3aed",

  color:
    "white",

  padding:
    "13px 15px",

  fontSize:
    "16px",

  fontWeight:
    "bold",
};

const bodyStyle = {
  padding:
    "16px",
};

const selectorGridStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "1fr 2fr",

  gap:
    "12px",

  marginBottom:
    "16px",
};

const labelStyle = {
  display:
    "block",

  fontSize:
    "10px",

  fontWeight:
    "bold",

  marginBottom:
    "6px",

  color:
    "#334155",
};

const selectStyle = {
  width:
    "100%",

  boxSizing:
    "border-box",

  padding:
    "10px",

  border:
    "1px solid #94a3b8",

  borderRadius:
    "5px",

  backgroundColor:
    "white",
};

const statusGridStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "repeat(5,1fr)",

  gap:
    "8px",

  marginBottom:
    "15px",
};

const infoBoxStyle = {
  padding:
    "10px",

  border:
    "1px solid #e2e8f0",

  backgroundColor:
    "#f8fafc",

  borderRadius:
    "6px",

  textAlign:
    "center",
};

const infoTitleStyle = {
  fontSize:
    "9px",

  color:
    "#64748b",

  fontWeight:
    "bold",
};

const infoValueStyle = {
  fontSize:
    "11px",

  fontWeight:
    "bold",

  marginTop:
    "5px",
};

const currentTotalsStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "repeat(3,1fr)",

  gap:
    "8px",

  marginBottom:
    "16px",
};

const sectionTitleStyle = {
  backgroundColor:
    "#ede9fe",

  color:
    "#5b21b6",

  padding:
    "8px",

  fontWeight:
    "bold",

  fontSize:
    "11px",

  marginBottom:
    "10px",
};

const fieldGridStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "repeat(3,1fr)",

  gap:
    "10px",

  marginBottom:
    "14px",
};

const inputStyle = {
  width:
    "100%",

  boxSizing:
    "border-box",

  padding:
    "10px",

  border:
    "1px solid #94a3b8",

  borderRadius:
    "5px",
};

const manualStyle = {
  display:
    "flex",

  alignItems:
    "flex-start",

  gap:
    "10px",

  padding:
    "12px",

  backgroundColor:
    "#fef3c7",

  border:
    "1px solid #fde68a",

  borderRadius:
    "6px",

  marginBottom:
    "14px",

  cursor:
    "pointer",
};

const manualHelpStyle = {
  display:
    "block",

  marginTop:
    "3px",

  color:
    "#92400e",

  fontWeight:
    "normal",
};

const reasonWrapStyle = {
  marginBottom:
    "14px",
};

const textareaStyle = {
  width:
    "100%",

  boxSizing:
    "border-box",

  padding:
    "10px",

  border:
    "1px solid #94a3b8",

  borderRadius:
    "5px",

  resize:
    "vertical",
};

const previousCorrectionStyle = {
  padding:
    "10px",

  backgroundColor:
    "#f1f5f9",

  borderRadius:
    "5px",

  marginBottom:
    "12px",

  fontSize:
    "11px",
};

const messageStyle = {
  padding:
    "10px",

  borderRadius:
    "5px",

  marginBottom:
    "12px",

  fontSize:
    "11px",
};

const buttonGridStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "1fr 2fr",

  gap:
    "10px",
};

const resetButtonStyle = {
  border:
    "none",

  backgroundColor:
    "#64748b",

  color:
    "white",

  padding:
    "11px",

  borderRadius:
    "5px",

  fontWeight:
    "bold",

  cursor:
    "pointer",
};

const saveButtonStyle = {
  border:
    "none",

  backgroundColor:
    "#7c3aed",

  color:
    "white",

  padding:
    "11px",

  borderRadius:
    "5px",

  fontWeight:
    "bold",

  cursor:
    "pointer",
};

const auditNoticeStyle = {
  marginTop:
    "10px",

  padding:
    "8px",

  textAlign:
    "center",

  fontSize:
    "9px",

  color:
    "#64748b",
};
