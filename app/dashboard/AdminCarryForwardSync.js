"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

export default function AdminCarryForwardSync({
  user,
  selectedShift,
  selectedShop,
  onChanged,
}) {
  const [nextShift, setNextShift] = useState(null);

  const [tablePlatform, setTablePlatform] = useState(null);
  const [sourceTableClosing, setSourceTableClosing] = useState(null);
  const [nextTableOpening, setNextTableOpening] = useState(null);

  const [reason, setReason] = useState("");

  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const accessToken =
    user?.access_token || null;

  // audit_log.user_id -> profiles.id
  const adminProfileId =
    user?.profile_id || null;

  const shopId =
    selectedShift?.shop_id ||
    selectedShop?.id ||
    null;

  const shiftId =
    selectedShift?.id ||
    null;

  // ==================================================
  // SHOP / SHIFT TYPE
  // ==================================================

  const shopType =
    normalizeShopType(
      selectedShop?.shop_type ||
        selectedShift?.shop_type ||
        ""
    );

  const shiftName =
    normalizeShiftName(
      selectedShift?.shift_name
    );

  const is24HourShop =
    shopType === "24_HOUR" ||
    shiftName === "SHIFT 1" ||
    shiftName === "SHIFT 2";

  const sourceTableReadingKind =
    getSourceTableReadingKind({
      shopType,
      shiftName,
    });

  const sourceTableReadingLabel =
    getSourceTableReadingLabel({
      shopType,
      shiftName,
    });

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
  // VALUES
  // ==================================================

  const sourceClosingBalance =
    selectedShift?.closing_balance ===
      null ||
    selectedShift?.closing_balance ===
      undefined
      ? null
      : Number(
          selectedShift.closing_balance
        );

  const nextOpeningBalance =
    nextShift?.opening_balance ===
      null ||
    nextShift?.opening_balance ===
      undefined
      ? null
      : Number(
          nextShift.opening_balance
        );

  const sourceTableValue =
    sourceTableClosing?.reading_value ===
      null ||
    sourceTableClosing?.reading_value ===
      undefined
      ? null
      : Number(
          sourceTableClosing.reading_value
        );

  const nextTableValue =
    nextTableOpening?.reading_value ===
      null ||
    nextTableOpening?.reading_value ===
      undefined
      ? null
      : Number(
          nextTableOpening.reading_value
        );

  const balanceMatches =
    moneyMatches(
      sourceClosingBalance,
      nextOpeningBalance
    );

  const tableMatches =
    moneyMatches(
      sourceTableValue,
      nextTableValue
    );

  const nextShiftIsOpen =
    String(
      nextShift?.status || ""
    ).toUpperCase() === "OPEN";

  const selectedShiftIsClosed =
    String(
      selectedShift?.status || ""
    ).toUpperCase() === "CLOSED";

  // ==================================================
  // LOAD NEXT SHIFT + TABLE VALUES
  // ==================================================

  const loadData =
    useCallback(
      async () => {
        if (
          !selectedShift ||
          !shiftId ||
          !shopId ||
          !supabaseUrl ||
          !supabaseAnonKey ||
          !accessToken
        ) {
          setNextShift(null);
          setTablePlatform(null);
          setSourceTableClosing(null);
          setNextTableOpening(null);

          return;
        }

        if (
          String(
            selectedShift.status ||
              ""
          ).toUpperCase() !==
          "CLOSED"
        ) {
          setNextShift(null);
          setTablePlatform(null);
          setSourceTableClosing(null);
          setNextTableOpening(null);

          return;
        }

        try {
          setLoading(true);
          setMessage("");
          setMessageType("");

          // ==========================================
          // 1. FIND IMMEDIATELY FOLLOWING SHIFT
          // ==========================================

          const sourceOpenedAt =
            selectedShift.opened_at;

          if (!sourceOpenedAt) {
            throw new Error(
              "Selected shift does not have an opening timestamp."
            );
          }

          const nextShiftResponse =
            await fetch(
              `${supabaseUrl}/rest/v1/shifts` +
                `?shop_id=eq.${encodeURIComponent(
                  shopId
                )}` +
                `&opened_at=gt.${encodeURIComponent(
                  sourceOpenedAt
                )}` +
                `&select=` +
                `id,shop_id,cashier_id,cashier_name,shift_name,` +
                `business_date,status,opened_at,closed_at,` +
                `opening_balance,total_added_float,total_output,` +
                `total_expenses,net_income,closing_balance,` +
                `admin_manual_totals` +
                `&order=opened_at.asc` +
                `&limit=1`,
              {
                method: "GET",

                headers:
                  authHeaders,

                cache:
                  "no-store",
              }
            );

          const nextShiftResult =
            await safeJson(
              nextShiftResponse
            );

          if (
            !nextShiftResponse.ok
          ) {
            throw new Error(
              nextShiftResult?.message ||
                nextShiftResult?.details ||
                "Unable to find the next shift."
            );
          }

          const foundNextShift =
            Array.isArray(
              nextShiftResult
            ) &&
            nextShiftResult.length >
              0
              ? nextShiftResult[0]
              : null;

          setNextShift(
            foundNextShift
          );

          // ==========================================
          // 2. FIND TABLE PLATFORM
          // ==========================================

          const platformResponse =
            await fetch(
              `${supabaseUrl}/rest/v1/shop_platforms` +
                `?shop_id=eq.${encodeURIComponent(
                  shopId
                )}` +
                `&platform_name=ilike.TABLE` +
                `&select=id,shop_id,platform_name,is_active` +
                `&limit=1`,
              {
                method: "GET",

                headers:
                  authHeaders,

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
                "Unable to find TABLE platform."
            );
          }

          const table =
            Array.isArray(
              platformResult
            ) &&
            platformResult.length >
              0
              ? platformResult[0]
              : null;

          setTablePlatform(
            table
          );

          if (!table) {
            setSourceTableClosing(
              null
            );

            setNextTableOpening(
              null
            );

            return;
          }

          // ==========================================
          // 3. CLOSED SHIFT TABLE HANDOVER/CLOSING
          //
          // 12 HOUR:
          // CLOSING
          //
          // 24 HOUR SHIFT 1:
          // HANDOVER_9PM
          //
          // 24 HOUR SHIFT 2:
          // CLOSING_9AM
          // ==========================================

          const sourceTableResponse =
            await fetch(
              `${supabaseUrl}/rest/v1/platform_readings` +
                `?shift_id=eq.${encodeURIComponent(
                  shiftId
                )}` +
                `&platform_id=eq.${encodeURIComponent(
                  table.id
                )}` +
                `&reading_kind=eq.${encodeURIComponent(
                  sourceTableReadingKind
                )}` +
                `&select=id,shift_id,platform_id,reading_kind,reading_value,recorded_at,recorded_by` +
                `&order=recorded_at.desc` +
                `&limit=1`,
              {
                method: "GET",

                headers:
                  authHeaders,

                cache:
                  "no-store",
              }
            );

          const sourceTableResult =
            await safeJson(
              sourceTableResponse
            );

          if (
            !sourceTableResponse.ok
          ) {
            throw new Error(
              sourceTableResult?.message ||
                sourceTableResult?.details ||
                `Unable to load previous TABLE ${sourceTableReadingLabel}.`
            );
          }

          const sourceClosing =
            Array.isArray(
              sourceTableResult
            ) &&
            sourceTableResult.length >
              0
              ? sourceTableResult[0]
              : null;

          setSourceTableClosing(
            sourceClosing
          );

          // No later shift means there is
          // nothing to compare yet.

          if (!foundNextShift) {
            setNextTableOpening(
              null
            );

            return;
          }

          // ==========================================
          // 4. NEXT SHIFT TABLE OPENING
          // ==========================================

          const nextTableResponse =
            await fetch(
              `${supabaseUrl}/rest/v1/platform_readings` +
                `?shift_id=eq.${encodeURIComponent(
                  foundNextShift.id
                )}` +
                `&platform_id=eq.${encodeURIComponent(
                  table.id
                )}` +
                `&reading_kind=eq.OPENING` +
                `&select=id,shift_id,platform_id,reading_kind,reading_value,recorded_at,recorded_by` +
                `&order=recorded_at.desc` +
                `&limit=1`,
              {
                method: "GET",

                headers:
                  authHeaders,

                cache:
                  "no-store",
              }
            );

          const nextTableResult =
            await safeJson(
              nextTableResponse
            );

          if (
            !nextTableResponse.ok
          ) {
            throw new Error(
              nextTableResult?.message ||
                nextTableResult?.details ||
                "Unable to load next TABLE opening."
            );
          }

          const nextOpening =
            Array.isArray(
              nextTableResult
            ) &&
            nextTableResult.length >
              0
              ? nextTableResult[0]
              : null;

          setNextTableOpening(
            nextOpening
          );
        } catch (error) {
          console.error(
            "LOAD CARRY FORWARD CHECK ERROR:",
            error
          );

          setMessage(
            error?.message ||
              "Unable to check carry-forward values."
          );

          setMessageType(
            "error"
          );
        } finally {
          setLoading(false);
        }
      },
      [
        selectedShift,
        shiftId,
        shopId,
        supabaseUrl,
        supabaseAnonKey,
        accessToken,
        authHeaders,
        sourceTableReadingKind,
        sourceTableReadingLabel,
      ]
    );

  // ==================================================
  // AUTO LOAD
  // ==================================================

  useEffect(() => {
    setReason("");
    setMessage("");

    loadData();
  }, [loadData]);

  // ==================================================
  // SYNC NEXT SHIFT
  // ==================================================

  async function syncCarryForward() {
    if (!selectedShiftIsClosed) {
      setMessage(
        "Carry-forward synchronization is only used from a CLOSED shift."
      );

      setMessageType(
        "error"
      );

      return;
    }

    if (!nextShift) {
      setMessage(
        "There is no later shift to synchronize yet."
      );

      setMessageType(
        "error"
      );

      return;
    }

    if (!nextShiftIsOpen) {
      setMessage(
        "The next shift is already CLOSED. Automatic synchronization is blocked to protect the historical shift chain."
      );

      setMessageType(
        "error"
      );

      return;
    }

    if (
      sourceClosingBalance ===
      null
    ) {
      setMessage(
        "The selected closed shift has no Closing Balance."
      );

      setMessageType(
        "error"
      );

      return;
    }

    if (!tablePlatform) {
      setMessage(
        "TABLE platform could not be found for this shop."
      );

      setMessageType(
        "error"
      );

      return;
    }

    if (
      sourceTableValue ===
      null
    ) {
      setMessage(
        `The selected closed shift has no TABLE ${sourceTableReadingLabel} reading. Correct the TABLE reading first.`
      );

      setMessageType(
        "error"
      );

      return;
    }

    const cleanReason =
      String(
        reason || ""
      ).trim();

    if (
      cleanReason.length < 3
    ) {
      setMessage(
        "Enter a carry-forward correction reason first."
      );

      setMessageType(
        "error"
      );

      return;
    }

    if (
      balanceMatches &&
      tableMatches
    ) {
      setMessage(
        "Carry-forward values already match. No synchronization is required."
      );

      setMessageType(
        "success"
      );

      return;
    }

    const confirmed =
      window.confirm(
        "ADMIN CARRY-FORWARD SYNC\n\n" +
          `Closed Shift: ${
            selectedShift.business_date ||
            "-"
          } | ${
            selectedShift.shift_name ||
            "-"
          }\n\n` +
          `Closing Balance: KES ${money(
            sourceClosingBalance
          )}\n` +
          `Next Balance B/F: ${
            nextOpeningBalance ===
            null
              ? "MISSING"
              : `KES ${money(
                  nextOpeningBalance
                )}`
          }\n\n` +
          `TABLE ${sourceTableReadingLabel}: ${money(
            sourceTableValue
          )}\n` +
          `Next TABLE Opening: ${
            nextTableValue ===
            null
              ? "MISSING"
              : money(
                  nextTableValue
                )
          }\n\n` +
          "Synchronize the OPEN next shift?"
      );

    if (!confirmed) {
      return;
    }

    try {
      setSyncing(true);

      setMessage("");
      setMessageType("");

      const now =
        new Date().toISOString();

      const oldNextShift = {
        ...nextShift,
      };

      let updatedNextShift =
        nextShift;

      let updatedTableReading =
        nextTableOpening;

      let auditFailures = 0;

      // ==========================================
      // 1. SYNC NEXT SHIFT BALANCE B/F
      // ==========================================

      if (!balanceMatches) {
        const shiftResponse =
          await fetch(
            `${supabaseUrl}/rest/v1/shifts` +
              `?id=eq.${encodeURIComponent(
                nextShift.id
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
                JSON.stringify({
                  opening_balance:
                    roundMoney(
                      sourceClosingBalance
                    ),
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
              shiftResult?.hint ||
              "Unable to synchronize next shift Balance B/F."
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
            "Updated next shift was not returned."
          );
        }

        updatedNextShift =
          shiftResult[0];

        const shiftAudit =
          await writeAudit({
            action:
              "ADMIN_CARRY_FORWARD_BALANCE_SYNC",

            tableName:
              "shifts",

            recordId:
              nextShift.id,

            oldData: {
              ...oldNextShift,

              source_shift_id:
                selectedShift.id,
            },

            newData: {
              ...updatedNextShift,

              source_shift_id:
                selectedShift.id,

              correction_reason:
                cleanReason,
            },
          });

        if (!shiftAudit) {
          auditFailures += 1;
        }
      }

      // ==========================================
      // 2. SYNC TABLE OPENING
      // ==========================================

      if (!tableMatches) {
        // ----------------------------------------
        // UPDATE EXISTING TABLE OPENING
        // ----------------------------------------

        if (nextTableOpening?.id) {
          const oldReading = {
            ...nextTableOpening,
          };

          const tableResponse =
            await fetch(
              `${supabaseUrl}/rest/v1/platform_readings` +
                `?id=eq.${encodeURIComponent(
                  nextTableOpening.id
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
                  JSON.stringify({
                    reading_value:
                      roundMoney(
                        sourceTableValue
                      ),
                  }),
              }
            );

          const tableResult =
            await safeJson(
              tableResponse
            );

          if (!tableResponse.ok) {
            throw new Error(
              tableResult?.message ||
                tableResult?.details ||
                tableResult?.hint ||
                "Unable to synchronize next TABLE Opening."
            );
          }

          if (
            !Array.isArray(
              tableResult
            ) ||
            tableResult.length ===
              0
          ) {
            throw new Error(
              "Updated TABLE Opening was not returned."
            );
          }

          updatedTableReading =
            tableResult[0];

          const tableAudit =
            await writeAudit({
              action:
                "ADMIN_CARRY_FORWARD_TABLE_SYNC",

              tableName:
                "platform_readings",

              recordId:
                nextTableOpening.id,

              oldData: {
                ...oldReading,

                source_shift_id:
                  selectedShift.id,
              },

              newData: {
                ...updatedTableReading,

                platform_name:
                  "TABLE",

                source_shift_id:
                  selectedShift.id,

                source_reading_kind:
                  sourceTableReadingKind,

                correction_reason:
                  cleanReason,
              },
            });

          if (!tableAudit) {
            auditFailures += 1;
          }
        }

        // ----------------------------------------
        // CREATE MISSING TABLE OPENING
        // ----------------------------------------

        else {
          const tableResponse =
            await fetch(
              `${supabaseUrl}/rest/v1/platform_readings`,
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
                    shift_id:
                      nextShift.id,

                    platform_id:
                      tablePlatform.id,

                    reading_kind:
                      "OPENING",

                    reading_value:
                      roundMoney(
                        sourceTableValue
                      ),

                    recorded_at:
                      now,

                    recorded_by:
                      adminProfileId,
                  }),
              }
            );

          const tableResult =
            await safeJson(
              tableResponse
            );

          if (!tableResponse.ok) {
            throw new Error(
              tableResult?.message ||
                tableResult?.details ||
                tableResult?.hint ||
                "Unable to create next TABLE Opening."
            );
          }

          if (
            !Array.isArray(
              tableResult
            ) ||
            tableResult.length ===
              0
          ) {
            throw new Error(
              "Created TABLE Opening was not returned."
            );
          }

          updatedTableReading =
            tableResult[0];

          const tableAudit =
            await writeAudit({
              action:
                "ADMIN_CARRY_FORWARD_TABLE_SYNC",

              tableName:
                "platform_readings",

              recordId:
                updatedTableReading.id,

              oldData: {
                record_status:
                  "NOT_PRESENT",

                shift_id:
                  nextShift.id,

                source_shift_id:
                  selectedShift.id,
              },

              newData: {
                ...updatedTableReading,

                platform_name:
                  "TABLE",

                source_shift_id:
                  selectedShift.id,

                source_reading_kind:
                  sourceTableReadingKind,

                correction_reason:
                  cleanReason,
              },
            });

          if (!tableAudit) {
            auditFailures += 1;
          }
        }
      }

      // ==========================================
      // 3. SUMMARY AUDIT ON SOURCE CLOSED SHIFT
      // ==========================================

      const summaryAudit =
        await writeAudit({
          action:
            "ADMIN_CARRY_FORWARD_SYNC",

          tableName:
            "shifts",

          recordId:
            selectedShift.id,

          oldData: {
            shift_id:
              selectedShift.id,

            source_closing_balance:
              sourceClosingBalance,

            source_table_closing:
              sourceTableValue,

            source_table_reading_kind:
              sourceTableReadingKind,

            next_shift_id:
              nextShift.id,

            next_opening_balance:
              nextOpeningBalance,

            next_table_opening:
              nextTableValue,
          },

          newData: {
            shift_id:
              selectedShift.id,

            source_closing_balance:
              sourceClosingBalance,

            source_table_closing:
              sourceTableValue,

            source_table_reading_kind:
              sourceTableReadingKind,

            next_shift_id:
              nextShift.id,

            next_opening_balance:
              sourceClosingBalance,

            next_table_opening:
              sourceTableValue,

            correction_reason:
              cleanReason,
          },
        });

      if (!summaryAudit) {
        auditFailures += 1;
      }

      // ==========================================
      // DONE
      // ==========================================

      setReason("");

      await loadData();

      if (
        typeof onChanged ===
        "function"
      ) {
        await onChanged();
      }

      if (
        auditFailures > 0
      ) {
        setMessage(
          "Carry-forward values were synchronized, but one or more audit records could not be written."
        );

        setMessageType(
          "error"
        );
      } else {
        setMessage(
          "Carry-forward synchronized successfully. Next shift Balance B/F and TABLE Opening now match the closed shift."
        );

        setMessageType(
          "success"
        );
      }
    } catch (error) {
      console.error(
        "ADMIN CARRY FORWARD SYNC ERROR:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to synchronize carry-forward values."
      );

      setMessageType(
        "error"
      );
    } finally {
      setSyncing(false);
    }
  }

  // ==================================================
  // WRITE AUDIT LOG
  // ==================================================

  async function writeAudit({
    action,
    tableName,
    recordId,
    oldData,
    newData,
  }) {
    try {
      const response =
        await fetch(
          `${supabaseUrl}/rest/v1/audit_log`,
          {
            method: "POST",

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
                  shopId,

                action,

                table_name:
                  tableName,

                record_id:
                  recordId,

                old_data:
                  oldData || {},

                new_data:
                  newData || {},
              }),
          }
        );

      if (!response.ok) {
        const result =
          await safeJson(
            response
          );

        console.error(
          "CARRY FORWARD AUDIT ERROR:",
          result
        );

        return false;
      }

      return true;
    } catch (error) {
      console.error(
        "CARRY FORWARD AUDIT ERROR:",
        error
      );

      return false;
    }
  }

  // ==================================================
  // DISPLAY
  // ==================================================

  if (!selectedShift) {
    return null;
  }

  if (!selectedShiftIsClosed) {
    return (
      <section style={panelStyle}>
        <div style={titleStyle}>
          CARRY-FORWARD PROTECTION
        </div>

        <div style={bodyStyle}>
          <div style={infoNoticeStyle}>
            Carry-forward synchronization becomes available
            when you select a CLOSED shift.
          </div>
        </div>
      </section>
    );
  }

  return (
    <section style={panelStyle}>
      <div style={titleStyle}>
        CARRY-FORWARD PROTECTION
      </div>

      <div style={bodyStyle}>
        <div style={sourceStyle}>
          <div>
            <small>
              CLOSED SHIFT
            </small>

            <strong>
              {selectedShift.business_date ||
                "-"}{" "}
              |{" "}
              {selectedShift.shift_name ||
                "-"}
            </strong>
          </div>

          <div>
            <small>
              CLOSED AT
            </small>

            <strong>
              {formatDateTime(
                selectedShift.closed_at
              )}
            </strong>
          </div>

          <div>
            <small>
              CLOSING BALANCE
            </small>

            <strong>
              KES{" "}
              {money(
                sourceClosingBalance
              )}
            </strong>
          </div>

          <div>
            <small>
              {is24HourShop
                ? `TABLE ${sourceTableReadingLabel.toUpperCase()}`
                : "TABLE CLOSING"}
            </small>

            <strong>
              {sourceTableValue ===
              null
                ? "MISSING"
                : money(
                    sourceTableValue
                  )}
            </strong>
          </div>
        </div>

        {loading && (
          <div style={loadingStyle}>
            Checking next shift...
          </div>
        )}

        {!loading &&
          !nextShift && (
            <div style={infoNoticeStyle}>
              No later shift exists yet. There is currently
              nothing to synchronize.
            </div>
          )}

        {!loading &&
          nextShift && (
            <>
              <div style={nextShiftTitleStyle}>
                IMMEDIATELY FOLLOWING SHIFT
              </div>

              <div style={nextStyle}>
                <div>
                  <small>
                    SHIFT
                  </small>

                  <strong>
                    {nextShift.business_date ||
                      "-"}{" "}
                    |{" "}
                    {nextShift.shift_name ||
                      "-"}
                  </strong>
                </div>

                <div>
                  <small>
                    STATUS
                  </small>

                  <strong
                    style={{
                      color:
                        nextShiftIsOpen
                          ? "#15803d"
                          : "#b91c1c",
                    }}
                  >
                    {nextShift.status ||
                      "-"}
                  </strong>
                </div>

                <div>
                  <small>
                    CASHIER
                  </small>

                  <strong>
                    {nextShift.cashier_name ||
                      "-"}
                  </strong>
                </div>

                <div>
                  <small>
                    OPENED
                  </small>

                  <strong>
                    {formatDateTime(
                      nextShift.opened_at
                    )}
                  </strong>
                </div>
              </div>

              <div style={comparisonHeaderStyle}>
                <div>
                  ITEM
                </div>

                <div>
                  CLOSED SHIFT
                </div>

                <div>
                  NEXT SHIFT
                </div>

                <div>
                  RESULT
                </div>
              </div>

              <ComparisonRow
                label="Balance Carry-Forward"
                source={`KES ${money(
                  sourceClosingBalance
                )}`}
                destination={
                  nextOpeningBalance ===
                  null
                    ? "MISSING"
                    : `KES ${money(
                        nextOpeningBalance
                      )}`
                }
                match={
                  balanceMatches
                }
              />

              <ComparisonRow
                label="TABLE Carry-Forward"
                source={
                  sourceTableValue ===
                  null
                    ? "MISSING"
                    : money(
                        sourceTableValue
                      )
                }
                destination={
                  nextTableValue ===
                  null
                    ? "MISSING"
                    : money(
                        nextTableValue
                      )
                }
                match={
                  tableMatches
                }
              />

              {!nextShiftIsOpen && (
                <div style={dangerNoticeStyle}>
                  This following shift is already CLOSED.
                  Automatic synchronization is disabled to
                  prevent silently changing a historical
                  chain. Correct historical shifts in order
                  instead.
                </div>
              )}

              {nextShiftIsOpen &&
                balanceMatches &&
                tableMatches && (
                  <div style={successNoticeStyle}>
                    Carry-forward is correct. Closing Balance
                    matches the next Balance B/F, and the
                    correct TABLE handover reading matches
                    the next TABLE Opening.
                  </div>
                )}

              {nextShiftIsOpen &&
                (!balanceMatches ||
                  !tableMatches) && (
                  <>
                    <div style={warningNoticeStyle}>
                      A carry-forward mismatch was detected.
                      Synchronizing will update the OPEN next
                      shift to the values from this CLOSED
                      shift.
                    </div>

                    <label style={labelStyle}>
                      CARRY-FORWARD CORRECTION REASON *
                    </label>

                    <textarea
                      value={reason}
                      onChange={(event) => {
                        setReason(
                          event.target.value
                        );

                        setMessage("");
                      }}
                      rows={2}
                      placeholder="Example: Previous closed shift was corrected by Admin; update the next shift carry-forward."
                      style={textareaStyle}
                    />

                    <button
                      type="button"
                      onClick={
                        syncCarryForward
                      }
                      disabled={
                        syncing
                      }
                      style={syncButtonStyle}
                    >
                      {syncing
                        ? "SYNCHRONIZING..."
                        : "SYNC NEXT OPEN SHIFT"}
                    </button>
                  </>
                )}
            </>
          )}

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

        <div style={footerNoticeStyle}>
          Closing Balance → next Balance B/F. TABLE handover
          reading → next TABLE Opening. Only an OPEN following
          shift can be synchronized automatically.
        </div>
      </div>
    </section>
  );
}

// ==================================================
// COMPARISON ROW
// ==================================================

function ComparisonRow({
  label,
  source,
  destination,
  match,
}) {
  return (
    <div style={comparisonRowStyle}>
      <div>
        <strong>
          {label}
        </strong>
      </div>

      <div>
        {source}
      </div>

      <div>
        {destination}
      </div>

      <div
        style={
          match
            ? matchStyle
            : mismatchStyle
        }
      >
        {match
          ? "MATCH ✓"
          : "MISMATCH"}
      </div>
    </div>
  );
}

// ==================================================
// TABLE READING RULES
// ==================================================

function getSourceTableReadingKind({
  shopType,
  shiftName,
}) {
  const normalizedShopType =
    normalizeShopType(
      shopType
    );

  const normalizedShift =
    normalizeShiftName(
      shiftName
    );

  if (
    normalizedShopType ===
      "24_HOUR" ||
    normalizedShift ===
      "SHIFT 1" ||
    normalizedShift ===
      "SHIFT 2"
  ) {
    if (
      normalizedShift ===
      "SHIFT 1"
    ) {
      return "HANDOVER_9PM";
    }

    if (
      normalizedShift ===
      "SHIFT 2"
    ) {
      return "CLOSING_9AM";
    }
  }

  return "CLOSING";
}

function getSourceTableReadingLabel({
  shopType,
  shiftName,
}) {
  const readingKind =
    getSourceTableReadingKind({
      shopType,
      shiftName,
    });

  if (
    readingKind ===
    "HANDOVER_9PM"
  ) {
    return "9 PM Handover";
  }

  if (
    readingKind ===
    "CLOSING_9AM"
  ) {
    return "9 AM Handover";
  }

  return "Closing";
}

function normalizeShopType(
  value
) {
  const text =
    String(
      value || ""
    )
      .trim()
      .toUpperCase()
      .replace(
        /[\s-]+/g,
        "_"
      );

  if (
    text ===
      "24HOUR" ||
    text ===
      "24_HOUR"
  ) {
    return "24_HOUR";
  }

  if (
    text ===
      "12HOUR" ||
    text ===
      "12_HOUR"
  ) {
    return "12_HOUR";
  }

  return text;
}

function normalizeShiftName(
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
  if (
    value === null ||
    value === undefined ||
    Number.isNaN(
      Number(value)
    )
  ) {
    return "0.00";
  }

  return Number(
    value
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

function moneyMatches(
  first,
  second
) {
  if (
    first === null ||
    first === undefined ||
    second === null ||
    second === undefined
  ) {
    return false;
  }

  return (
    Math.abs(
      Number(first) -
        Number(second)
    ) < 0.005
  );
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

// ==================================================
// STYLES
// ==================================================

const panelStyle = {
  marginTop:
    "18px",

  border:
    "1px solid #fdba74",

  borderRadius:
    "7px",

  overflow:
    "hidden",

  backgroundColor:
    "#ffffff",
};

const titleStyle = {
  backgroundColor:
    "#c2410c",

  color:
    "white",

  padding:
    "10px 12px",

  fontWeight:
    "bold",

  fontSize:
    "13px",
};

const bodyStyle = {
  padding:
    "12px",
};

const sourceStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "repeat(4,1fr)",

  gap:
    "8px",

  marginBottom:
    "12px",
};

const nextShiftTitleStyle = {
  padding:
    "8px",

  marginTop:
    "8px",

  backgroundColor:
    "#fff7ed",

  color:
    "#9a3412",

  fontWeight:
    "bold",

  fontSize:
    "10px",
};

const nextStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "repeat(4,1fr)",

  gap:
    "8px",

  padding:
    "10px 0",

  marginBottom:
    "8px",
};

const comparisonHeaderStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "1.4fr 1fr 1fr 0.8fr",

  gap:
    "8px",

  padding:
    "8px",

  backgroundColor:
    "#ffedd5",

  color:
    "#9a3412",

  fontWeight:
    "bold",

  fontSize:
    "9px",

  textAlign:
    "center",
};

const comparisonRowStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "1.4fr 1fr 1fr 0.8fr",

  gap:
    "8px",

  alignItems:
    "center",

  padding:
    "9px 8px",

  borderTop:
    "1px solid #e2e8f0",

  fontSize:
    "10px",

  textAlign:
    "center",
};

const matchStyle = {
  padding:
    "6px",

  borderRadius:
    "4px",

  backgroundColor:
    "#dcfce7",

  color:
    "#166534",

  fontWeight:
    "bold",
};

const mismatchStyle = {
  padding:
    "6px",

  borderRadius:
    "4px",

  backgroundColor:
    "#fee2e2",

  color:
    "#991b1b",

  fontWeight:
    "bold",
};

const infoNoticeStyle = {
  padding:
    "12px",

  backgroundColor:
    "#f8fafc",

  color:
    "#475569",

  borderRadius:
    "5px",

  textAlign:
    "center",

  fontSize:
    "10px",
};

const successNoticeStyle = {
  marginTop:
    "10px",

  padding:
    "10px",

  backgroundColor:
    "#ecfdf5",

  border:
    "1px solid #86efac",

  color:
    "#166534",

  borderRadius:
    "5px",

  fontWeight:
    "bold",

  fontSize:
    "10px",
};

const warningNoticeStyle = {
  marginTop:
    "10px",

  marginBottom:
    "10px",

  padding:
    "10px",

  backgroundColor:
    "#fff7ed",

  border:
    "1px solid #fdba74",

  color:
    "#9a3412",

  borderRadius:
    "5px",

  fontSize:
    "10px",
};

const dangerNoticeStyle = {
  marginTop:
    "10px",

  padding:
    "10px",

  backgroundColor:
    "#fef2f2",

  border:
    "1px solid #fecaca",

  color:
    "#991b1b",

  borderRadius:
    "5px",

  fontWeight:
    "bold",

  fontSize:
    "10px",
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

const textareaStyle = {
  width:
    "100%",

  boxSizing:
    "border-box",

  padding:
    "8px",

  border:
    "1px solid #94a3b8",

  borderRadius:
    "4px",

  resize:
    "vertical",
};

const syncButtonStyle = {
  width:
    "100%",

  marginTop:
    "9px",

  padding:
    "10px",

  border:
    "none",

  borderRadius:
    "5px",

  backgroundColor:
    "#ea580c",

  color:
    "white",

  fontWeight:
    "bold",

  cursor:
    "pointer",
};

const messageStyle = {
  marginTop:
    "10px",

  padding:
    "9px",

  borderRadius:
    "5px",

  fontSize:
    "10px",
};

const loadingStyle = {
  padding:
    "12px",

  textAlign:
    "center",

  color:
    "#64748b",

  fontSize:
    "10px",
};

const footerNoticeStyle = {
  marginTop:
    "10px",

  padding:
    "8px",

  backgroundColor:
    "#f8fafc",

  color:
    "#64748b",

  textAlign:
    "center",

  fontSize:
    "9px",
};
