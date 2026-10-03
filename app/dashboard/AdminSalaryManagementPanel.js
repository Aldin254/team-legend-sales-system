"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

export default function AdminSalaryManagementPanel({
  user,
}) {
  const [shops, setShops] = useState([]);

  const [
    selectedShopId,
    setSelectedShopId,
  ] = useState("");

  const [slots, setSlots] =
    useState(
      createEmptySlots()
    );

  const [
    loadingShops,
    setLoadingShops,
  ] = useState(true);

  const [
    loadingEmployees,
    setLoadingEmployees,
  ] = useState(false);

  const [
    savingSlot,
    setSavingSlot,
  ] = useState(null);

  const [
    advanceSavingSlot,
    setAdvanceSavingSlot,
  ] = useState(null);

  const [
    unlockingSlot,
    setUnlockingSlot,
  ] = useState(null);

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    messageType,
    setMessageType,
  ] = useState("");

  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env
      .NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const accessToken =
    user?.access_token || null;

  // ==================================================
  // HEADERS
  // ==================================================

  const headers =
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
                `&is_active=eq.true` +
                `&order=shop_name.asc`,
              {
                method:
                  "GET",

                headers,

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
            (
              previous
            ) =>
              previous ||
              loaded[0]?.id ||
              ""
          );
        } catch (error) {
          console.error(
            "LOAD SALARY SHOPS ERROR:",
            error
          );

          showError(
            error?.message ||
              "Unable to load shops."
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
        headers,
      ]
    );

  // ==================================================
  // LOAD SALARY EMPLOYEES
  // ==================================================

  const loadEmployees =
    useCallback(
      async () => {
        if (
          !selectedShopId ||
          !supabaseUrl ||
          !supabaseAnonKey ||
          !accessToken
        ) {
          setSlots(
            createEmptySlots()
          );

          return;
        }

        try {
          setLoadingEmployees(
            true
          );

          const result =
            await callRpc({
              supabaseUrl,
              headers,

              functionName:
                "tl_salary_admin_list",

              body: {
                p_shop_id:
                  selectedShopId,
              },
            });

          const loaded =
            Array.isArray(
              result
            )
              ? result
              : [];

          const next =
            createEmptySlots();

          for (
            const employee of loaded
          ) {
            const slotIndex =
              Number(
                employee.slot_number
              ) - 1;

            if (
              slotIndex < 0 ||
              slotIndex > 2
            ) {
              continue;
            }

            next[
              slotIndex
            ] = {
              slot_number:
                Number(
                  employee.slot_number
                ),

              id:
                employee.id ||
                null,

              employee_name:
                employee.employee_name ||
                "",

              weekly_salary:
                String(
                  employee.weekly_salary ??
                    ""
                ),

              weekly_advance_deduction:
                String(
                  employee.weekly_advance_deduction ??
                    ""
                ),

              advance_balance:
                Number(
                  employee.advance_balance ??
                    0
                ),

              advance_status:
                employee.advance_status ||
                "NO ADVANCE",

              is_active:
                Boolean(
                  employee.is_active
                ),

              salary_start_week:
                employee.salary_start_week ||
                null,

              pin_set:
                Boolean(
                  employee.pin_set
                ),

              pin_failed_attempts:
                Number(
                  employee.pin_failed_attempts ??
                    0
                ),

              pin_locked:
                Boolean(
                  employee.pin_locked
                ),

              new_pin:
                "",

              advance_amount:
                "",

              advance_note:
                "",
            };
          }

          setSlots(
            next
          );
        } catch (error) {
          console.error(
            "LOAD SALARY EMPLOYEES ERROR:",
            error
          );

          showError(
            error?.message ||
              "Unable to load salary employees."
          );
        } finally {
          setLoadingEmployees(
            false
          );
        }
      },
      [
        selectedShopId,
        supabaseUrl,
        supabaseAnonKey,
        accessToken,
        headers,
      ]
    );

  // ==================================================
  // INITIAL LOAD
  // ==================================================

  useEffect(() => {
    loadShops();
  }, [loadShops]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  // ==================================================
  // LOCAL FIELD UPDATE
  // ==================================================

  function updateSlot(
    slotNumber,
    field,
    value
  ) {
    setSlots(
      (
        previous
      ) =>
        previous.map(
          (
            slot
          ) =>
            slot.slot_number ===
            slotNumber
              ? {
                  ...slot,
                  [field]:
                    value,
                }
              : slot
        )
    );

    clearMessage();
  }

  // ==================================================
  // SAVE EMPLOYEE SLOT
  // ==================================================

  async function saveEmployee(
    slot
  ) {
    if (!selectedShopId) {
      showError(
        "Select a shop first."
      );

      return;
    }

    const employeeName =
      String(
        slot.employee_name ||
          ""
      ).trim();

    if (
      employeeName.length <
      2
    ) {
      showError(
        `Enter the employee name for Salary Slot ${slot.slot_number}.`
      );

      return;
    }

    const weeklySalary =
      Number(
        slot.weekly_salary
      );

    if (
      !Number.isFinite(
        weeklySalary
      ) ||
      weeklySalary < 0
    ) {
      showError(
        `Enter a valid weekly salary for ${employeeName}.`
      );

      return;
    }

    if (
      slot.is_active &&
      weeklySalary <= 0
    ) {
      showError(
        `${employeeName} cannot be activated with a zero weekly salary.`
      );

      return;
    }

    const deduction =
      Number(
        slot.weekly_advance_deduction ||
          0
      );

    if (
      !Number.isFinite(
        deduction
      ) ||
      deduction < 0
    ) {
      showError(
        `Enter a valid weekly advance deduction for ${employeeName}.`
      );

      return;
    }

    const pin =
      String(
        slot.new_pin ||
          ""
      ).trim();

    if (
      pin !== "" &&
      !/^\d{4}$/.test(
        pin
      )
    ) {
      showError(
        "Salary PIN must contain exactly 4 digits."
      );

      return;
    }

    if (
      slot.is_active &&
      !slot.pin_set &&
      pin === ""
    ) {
      showError(
        `Set a 4-digit Salary PIN before activating ${employeeName}.`
      );

      return;
    }

    try {
      setSavingSlot(
        slot.slot_number
      );

      clearMessage();

      await callRpc({
        supabaseUrl,
        headers,

        functionName:
          "tl_salary_admin_save_employee",

        body: {
          p_shop_id:
            selectedShopId,

          p_slot_number:
            slot.slot_number,

          p_employee_name:
            employeeName,

          p_weekly_salary:
            roundMoney(
              weeklySalary
            ),

          p_weekly_advance_deduction:
            roundMoney(
              deduction
            ),

          p_is_active:
            Boolean(
              slot.is_active
            ),

          p_pin:
            pin === ""
              ? null
              : pin,
        },
      });

      setMessage(
        `${employeeName} saved successfully.`
      );

      setMessageType(
        "success"
      );

      await loadEmployees();
    } catch (error) {
      console.error(
        "SAVE SALARY EMPLOYEE ERROR:",
        error
      );

      showError(
        error?.message ||
          "Unable to save salary employee."
      );
    } finally {
      setSavingSlot(
        null
      );
    }
  }

  // ==================================================
  // GIVE ADVANCE
  // ==================================================

  async function giveAdvance(
    slot
  ) {
    if (!slot?.id) {
      showError(
        "Save this employee first before recording an advance."
      );

      return;
    }

    const amount =
      Number(
        slot.advance_amount
      );

    if (
      !Number.isFinite(
        amount
      ) ||
      amount <= 0
    ) {
      showError(
        "Enter a valid advance amount."
      );

      return;
    }

    const employeeName =
      slot.employee_name ||
      "Employee";

    const confirmed =
      window.confirm(
        `GIVE SALARY ADVANCE\n\n` +
          `Employee: ${employeeName}\n` +
          `Current Advance Balance: KES ${money(
            slot.advance_balance
          )}\n` +
          `New Advance: KES ${money(
            amount
          )}\n` +
          `New Balance: KES ${money(
            Number(
              slot.advance_balance ||
                0
            ) + amount
          )}\n\n` +
          "Record this employee advance?"
      );

    if (!confirmed) {
      return;
    }

    try {
      setAdvanceSavingSlot(
        slot.slot_number
      );

      clearMessage();

      await callRpc({
        supabaseUrl,
        headers,

        functionName:
          "tl_salary_admin_add_advance",

        body: {
          p_employee_id:
            slot.id,

          p_amount:
            roundMoney(
              amount
            ),

          p_note:
            String(
              slot.advance_note ||
                ""
            ).trim() ||
            null,
        },
      });

      setMessage(
        `KES ${money(
          amount
        )} advance added to ${employeeName}.`
      );

      setMessageType(
        "success"
      );

      await loadEmployees();
    } catch (error) {
      console.error(
        "SALARY ADVANCE ERROR:",
        error
      );

      showError(
        error?.message ||
          "Unable to record advance."
      );
    } finally {
      setAdvanceSavingSlot(
        null
      );
    }
  }

  // ==================================================
  // ADMIN UNLOCK PIN
  // ==================================================

  async function unlockPin(
    slot
  ) {
    if (!slot?.id) {
      return;
    }

    const confirmed =
      window.confirm(
        `UNLOCK SALARY PIN\n\n` +
          `${slot.employee_name}\n\n` +
          `Failed attempts: ${slot.pin_failed_attempts}\n\n` +
          "This will reset the failed PIN attempts to zero and unlock salary access.\n\n" +
          "Continue?"
      );

    if (!confirmed) {
      return;
    }

    try {
      setUnlockingSlot(
        slot.slot_number
      );

      clearMessage();

      await callRpc({
        supabaseUrl,
        headers,

        functionName:
          "tl_salary_admin_unlock_pin",

        body: {
          p_employee_id:
            slot.id,
        },
      });

      setMessage(
        `${slot.employee_name}'s Salary PIN has been unlocked.`
      );

      setMessageType(
        "success"
      );

      await loadEmployees();
    } catch (error) {
      console.error(
        "UNLOCK SALARY PIN ERROR:",
        error
      );

      showError(
        error?.message ||
          "Unable to unlock Salary PIN."
      );
    } finally {
      setUnlockingSlot(
        null
      );
    }
  }

  // ==================================================
  // SELECTED SHOP
  // ==================================================

  const selectedShop =
    shops.find(
      (
        shop
      ) =>
        String(
          shop.id
        ) ===
        String(
          selectedShopId
        )
    );

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
        EMPLOYEE SALARY MANAGEMENT
      </div>

      <div
        style={
          introStyle
        }
      >
        Maximum 3 salary employees per shop. Only ACTIVE employees
        will appear on the cashier dashboard. Each employee has a
        private 4-digit Salary PIN.
      </div>

      <div
        style={
          toolbarStyle
        }
      >
        <div>
          <div
            style={
              labelStyle
            }
          >
            SELECT SHOP
          </div>

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
                event.target.value
              );

              clearMessage();
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
                  {shop.shop_name} —{" "}
                  {shop.shop_type}
                </option>
              )
            )}
          </select>
        </div>

        <div
          style={
            shopInfoStyle
          }
        >
          Salary setup for{" "}
          <strong>
            {selectedShop
              ?.shop_name ||
              "-"}
          </strong>

          <button
            type="button"
            onClick={
              loadEmployees
            }
            style={
              refreshButtonStyle
            }
          >
            REFRESH
          </button>
        </div>
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

      {loadingEmployees ? (
        <div
          style={
            loadingStyle
          }
        >
          Loading salary employees...
        </div>
      ) : (
        <div
          style={
            slotsWrapStyle
          }
        >
          {slots.map(
            (
              slot
            ) => {
              const busy =
                savingSlot ===
                  slot.slot_number ||
                advanceSavingSlot ===
                  slot.slot_number ||
                unlockingSlot ===
                  slot.slot_number;

              return (
                <div
                  key={
                    slot.slot_number
                  }
                  style={{
                    ...employeeCardStyle,

                    border:
                      slot.pin_locked
                        ? "2px solid #dc2626"
                        : slot.is_active
                        ? "2px solid #16a34a"
                        : "1px solid #cbd5e1",
                  }}
                >
                  <div
                    style={
                      employeeCardHeaderStyle
                    }
                  >
                    <div>
                      SALARY SLOT{" "}
                      {
                        slot.slot_number
                      }
                    </div>

                    <div>
                      {slot.is_active
                        ? "ACTIVE"
                        : "INACTIVE"}
                    </div>
                  </div>

                  {/* =====================================
                      BASIC EMPLOYEE SETTINGS
                  ====================================== */}

                  <div
                    style={
                      formGridStyle
                    }
                  >
                    <Field
                      label="EMPLOYEE NAME"
                    >
                      <input
                        type="text"
                        value={
                          slot.employee_name
                        }
                        disabled={
                          busy
                        }
                        placeholder="Employee name"
                        onChange={(
                          event
                        ) =>
                          updateSlot(
                            slot.slot_number,
                            "employee_name",
                            event
                              .target
                              .value
                          )
                        }
                        style={
                          inputStyle
                        }
                      />
                    </Field>

                    <Field
                      label="WEEKLY SALARY"
                    >
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          slot.weekly_salary
                        }
                        disabled={
                          busy
                        }
                        placeholder="0.00"
                        onChange={(
                          event
                        ) =>
                          updateSlot(
                            slot.slot_number,
                            "weekly_salary",
                            event
                              .target
                              .value
                          )
                        }
                        style={
                          inputStyle
                        }
                      />
                    </Field>

                    <Field
                      label="WEEKLY ADVANCE DEDUCTION"
                    >
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          slot.weekly_advance_deduction
                        }
                        disabled={
                          busy
                        }
                        placeholder="0.00"
                        onChange={(
                          event
                        ) =>
                          updateSlot(
                            slot.slot_number,
                            "weekly_advance_deduction",
                            event
                              .target
                              .value
                          )
                        }
                        style={
                          inputStyle
                        }
                      />
                    </Field>

                    <Field
                      label={
                        slot.pin_set
                          ? "NEW 4-DIGIT PIN (OPTIONAL)"
                          : "4-DIGIT SALARY PIN"
                      }
                    >
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={4}
                        value={
                          slot.new_pin
                        }
                        disabled={
                          busy
                        }
                        placeholder={
                          slot.pin_set
                            ? "Leave blank to keep current PIN"
                            : "0000"
                        }
                        onChange={(
                          event
                        ) => {
                          const value =
                            event.target.value.replace(
                              /\D/g,
                              ""
                            );

                          updateSlot(
                            slot.slot_number,
                            "new_pin",
                            value.slice(
                              0,
                              4
                            )
                          );
                        }}
                        style={
                          inputStyle
                        }
                      />
                    </Field>
                  </div>

                  {/* =====================================
                      STATUS
                  ====================================== */}

                  <div
                    style={
                      statusGridStyle
                    }
                  >
                    <StatusBox
                      title="ADVANCE BALANCE"
                      value={`KES ${money(
                        slot.advance_balance
                      )}`}
                    />

                    <StatusBox
                      title="ADVANCE"
                      value={
                        Number(
                          slot.advance_balance ||
                            0
                        ) > 0
                          ? "YES"
                          : "NO"
                      }
                    />

                    <StatusBox
                      title="PIN"
                      value={
                        slot.pin_set
                          ? "SET ✓"
                          : "NOT SET"
                      }
                    />

                    <StatusBox
                      title="FAILED PIN"
                      value={`${slot.pin_failed_attempts} / 3`}
                    />

                    <StatusBox
                      title="PIN STATUS"
                      value={
                        slot.pin_locked
                          ? "LOCKED"
                          : "OPEN"
                      }
                      danger={
                        slot.pin_locked
                      }
                    />

                    <StatusBox
                      title="SALARY START WEEK"
                      value={
                        slot.salary_start_week ||
                        "-"
                      }
                    />
                  </div>

                  {/* =====================================
                      ACTIVE SWITCH
                  ====================================== */}

                  <label
                    style={
                      activeToggleStyle
                    }
                  >
                    <input
                      type="checkbox"
                      checked={
                        slot.is_active
                      }
                      disabled={
                        busy
                      }
                      onChange={(
                        event
                      ) =>
                        updateSlot(
                          slot.slot_number,
                          "is_active",
                          event
                            .target
                            .checked
                        )
                      }
                    />

                    <span>
                      Show this employee on cashier salary panel
                    </span>
                  </label>

                  <button
                    type="button"
                    onClick={() =>
                      saveEmployee(
                        slot
                      )
                    }
                    disabled={
                      busy
                    }
                    style={{
                      ...saveEmployeeButtonStyle,

                      backgroundColor:
                        busy
                          ? "#94a3b8"
                          : "#0873b9",
                    }}
                  >
                    {savingSlot ===
                    slot.slot_number
                      ? "SAVING EMPLOYEE..."
                      : "SAVE EMPLOYEE SETTINGS"}
                  </button>

                  {/* =====================================
                      ADVANCE MANAGEMENT
                  ====================================== */}

                  {slot.id && (
                    <div
                      style={
                        advanceBoxStyle
                      }
                    >
                      <div
                        style={
                          sectionTitleStyle
                        }
                      >
                        EMPLOYEE ADVANCE
                      </div>

                      <div
                        style={
                          advanceInfoStyle
                        }
                      >
                        Current outstanding advance:{" "}
                        <strong>
                          KES{" "}
                          {money(
                            slot.advance_balance
                          )}
                        </strong>
                      </div>

                      <div
                        style={
                          advanceGridStyle
                        }
                      >
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={
                            slot.advance_amount
                          }
                          disabled={
                            busy
                          }
                          placeholder="Advance amount"
                          onChange={(
                            event
                          ) =>
                            updateSlot(
                              slot.slot_number,
                              "advance_amount",
                              event
                                .target
                                .value
                            )
                          }
                          style={
                            inputStyle
                          }
                        />

                        <input
                          type="text"
                          value={
                            slot.advance_note
                          }
                          disabled={
                            busy
                          }
                          placeholder="Reason / note"
                          onChange={(
                            event
                          ) =>
                            updateSlot(
                              slot.slot_number,
                              "advance_note",
                              event
                                .target
                                .value
                            )
                          }
                          style={
                            inputStyle
                          }
                        />

                        <button
                          type="button"
                          onClick={() =>
                            giveAdvance(
                              slot
                            )
                          }
                          disabled={
                            busy
                          }
                          style={
                            advanceButtonStyle
                          }
                        >
                          {advanceSavingSlot ===
                          slot.slot_number
                            ? "SAVING..."
                            : "ADD ADVANCE"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* =====================================
                      PIN LOCK
                  ====================================== */}

                  {slot.pin_locked && (
                    <div
                      style={
                        lockedBoxStyle
                      }
                    >
                      <div>
                        <strong>
                          SALARY PIN LOCKED
                        </strong>

                        <div
                          style={
                            lockedTextStyle
                          }
                        >
                          This employee reached 3 incorrect Salary PIN
                          attempts. Cashier access remains blocked
                          until Admin unlocks it.
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          unlockPin(
                            slot
                          )
                        }
                        disabled={
                          busy
                        }
                        style={
                          unlockButtonStyle
                        }
                      >
                        {unlockingSlot ===
                        slot.slot_number
                          ? "UNLOCKING..."
                          : "ADMIN UNLOCK PIN"}
                      </button>
                    </div>
                  )}
                </div>
              );
            }
          )}
        </div>
      )}

      <div
        style={
          footerStyle
        }
      >
        Salary earned Monday–Sunday becomes payable from the following
        Monday at 00:00 Africa/Nairobi. Salary amounts remain private
        on the cashier screen until the employee enters their own
        4-digit Salary PIN.
      </div>
    </section>
  );

  // ==================================================
  // LOCAL HELPERS
  // ==================================================

  function clearMessage() {
    setMessage("");
    setMessageType("");
  }

  function showError(
    text
  ) {
    setMessage(
      text
    );

    setMessageType(
      "error"
    );
  }
}

// ==================================================
// COMPONENT HELPERS
// ==================================================

function Field({
  label,
  children,
}) {
  return (
    <div>
      <div
        style={
          labelStyle
        }
      >
        {label}
      </div>

      {children}
    </div>
  );
}

function StatusBox({
  title,
  value,
  danger = false,
}) {
  return (
    <div
      style={{
        ...statusBoxStyle,

        backgroundColor:
          danger
            ? "#fee2e2"
            : "#f8fafc",

        borderColor:
          danger
            ? "#ef4444"
            : "#cbd5e1",

        color:
          danger
            ? "#991b1b"
            : "#0f172a",
      }}
    >
      <div
        style={
          statusTitleStyle
        }
      >
        {title}
      </div>

      <div
        style={
          statusValueStyle
        }
      >
        {value}
      </div>
    </div>
  );
}

// ==================================================
// DATA HELPERS
// ==================================================

function createEmptySlots() {
  return [
    createEmptySlot(
      1
    ),
    createEmptySlot(
      2
    ),
    createEmptySlot(
      3
    ),
  ];
}

function createEmptySlot(
  slotNumber
) {
  return {
    slot_number:
      slotNumber,

    id:
      null,

    employee_name:
      "",

    weekly_salary:
      "",

    weekly_advance_deduction:
      "0",

    advance_balance:
      0,

    advance_status:
      "NO ADVANCE",

    is_active:
      false,

    salary_start_week:
      null,

    pin_set:
      false,

    pin_failed_attempts:
      0,

    pin_locked:
      false,

    new_pin:
      "",

    advance_amount:
      "",

    advance_note:
      "",
  };
}

async function callRpc({
  supabaseUrl,
  headers,
  functionName,
  body,
}) {
  const response =
    await fetch(
      `${supabaseUrl}/rest/v1/rpc/${functionName}`,
      {
        method:
          "POST",

        headers,

        body:
          JSON.stringify(
            body
          ),

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
        result?.hint ||
        `Unable to run ${functionName}.`
    );
  }

  return result;
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
  const number =
    Number(
      value ?? 0
    );

  return (
    Number.isFinite(
      number
    )
      ? number
      : 0
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
    ) / 100
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
};

const titleStyle = {
  backgroundColor:
    "#4f46e5",

  color:
    "#ffffff",

  padding:
    "14px",

  fontSize:
    "17px",

  fontWeight:
    "bold",
};

const introStyle = {
  padding:
    "10px 15px",

  backgroundColor:
    "#eef2ff",

  color:
    "#3730a3",

  fontSize:
    "11px",
};

const toolbarStyle = {
  display:
    "flex",

  justifyContent:
    "space-between",

  alignItems:
    "end",

  gap:
    "15px",

  padding:
    "15px",

  backgroundColor:
    "#f8fafc",

  borderBottom:
    "1px solid #e2e8f0",
};

const labelStyle = {
  fontSize:
    "9px",

  fontWeight:
    "bold",

  color:
    "#475569",

  marginBottom:
    "5px",
};

const selectStyle = {
  minWidth:
    "280px",

  padding:
    "9px",

  border:
    "1px solid #94a3b8",

  borderRadius:
    "5px",

  backgroundColor:
    "#ffffff",
};

const shopInfoStyle = {
  display:
    "flex",

  alignItems:
    "center",

  gap:
    "12px",

  fontSize:
    "12px",

  color:
    "#475569",
};

const refreshButtonStyle = {
  padding:
    "8px 14px",

  border:
    "none",

  borderRadius:
    "4px",

  backgroundColor:
    "#334155",

  color:
    "#ffffff",

  fontSize:
    "10px",

  fontWeight:
    "bold",

  cursor:
    "pointer",
};

const messageStyle = {
  margin:
    "10px 15px",

  padding:
    "9px",

  borderRadius:
    "5px",

  fontSize:
    "11px",
};

const loadingStyle = {
  padding:
    "30px",

  textAlign:
    "center",

  color:
    "#64748b",
};

const slotsWrapStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "repeat(3, minmax(0, 1fr))",

  gap:
    "12px",

  padding:
    "15px",
};

const employeeCardStyle = {
  borderRadius:
    "7px",

  overflow:
    "hidden",

  backgroundColor:
    "#ffffff",
};

const employeeCardHeaderStyle = {
  display:
    "flex",

  justifyContent:
    "space-between",

  padding:
    "9px 11px",

  backgroundColor:
    "#0f172a",

  color:
    "#ffffff",

  fontSize:
    "10px",

  fontWeight:
    "bold",
};

const formGridStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "repeat(2, minmax(0, 1fr))",

  gap:
    "8px",

  padding:
    "10px",
};

const inputStyle = {
  width:
    "100%",

  boxSizing:
    "border-box",

  padding:
    "8px",

  border:
    "1px solid #cbd5e1",

  borderRadius:
    "4px",

  fontSize:
    "11px",

  backgroundColor:
    "#ffffff",
};

const statusGridStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "repeat(3, minmax(0, 1fr))",

  gap:
    "6px",

  padding:
    "0 10px 10px",
};

const statusBoxStyle = {
  padding:
    "7px",

  border:
    "1px solid #cbd5e1",

  borderRadius:
    "4px",

  textAlign:
    "center",
};

const statusTitleStyle = {
  fontSize:
    "8px",

  fontWeight:
    "bold",

  color:
    "#64748b",
};

const statusValueStyle = {
  marginTop:
    "4px",

  fontSize:
    "10px",

  fontWeight:
    "bold",
};

const activeToggleStyle = {
  display:
    "flex",

  gap:
    "8px",

  alignItems:
    "center",

  margin:
    "0 10px 9px",

  padding:
    "8px",

  backgroundColor:
    "#f0fdf4",

  border:
    "1px solid #bbf7d0",

  borderRadius:
    "4px",

  fontSize:
    "10px",

  fontWeight:
    "bold",

  color:
    "#166534",
};

const saveEmployeeButtonStyle = {
  width:
    "calc(100% - 20px)",

  margin:
    "0 10px 10px",

  padding:
    "9px",

  border:
    "none",

  borderRadius:
    "5px",

  color:
    "#ffffff",

  fontSize:
    "10px",

  fontWeight:
    "bold",

  cursor:
    "pointer",
};

const advanceBoxStyle = {
  margin:
    "0 10px 10px",

  padding:
    "9px",

  border:
    "1px solid #f59e0b",

  borderRadius:
    "5px",

  backgroundColor:
    "#fffbeb",
};

const sectionTitleStyle = {
  fontSize:
    "10px",

  fontWeight:
    "bold",

  color:
    "#92400e",

  marginBottom:
    "5px",
};

const advanceInfoStyle = {
  fontSize:
    "10px",

  color:
    "#78350f",

  marginBottom:
    "7px",
};

const advanceGridStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "0.8fr 1.2fr 0.8fr",

  gap:
    "6px",
};

const advanceButtonStyle = {
  border:
    "none",

  borderRadius:
    "4px",

  backgroundColor:
    "#d97706",

  color:
    "#ffffff",

  fontWeight:
    "bold",

  fontSize:
    "9px",

  cursor:
    "pointer",
};

const lockedBoxStyle = {
  margin:
    "0 10px 10px",

  padding:
    "9px",

  display:
    "flex",

  justifyContent:
    "space-between",

  alignItems:
    "center",

  gap:
    "10px",

  backgroundColor:
    "#fee2e2",

  border:
    "1px solid #ef4444",

  borderRadius:
    "5px",

  color:
    "#991b1b",

  fontSize:
    "10px",
};

const lockedTextStyle = {
  marginTop:
    "3px",

  fontSize:
    "9px",
};

const unlockButtonStyle = {
  padding:
    "8px 10px",

  border:
    "none",

  borderRadius:
    "4px",

  backgroundColor:
    "#dc2626",

  color:
    "#ffffff",

  fontWeight:
    "bold",

  fontSize:
    "9px",

  cursor:
    "pointer",
};

const footerStyle = {
  padding:
    "12px",

  backgroundColor:
    "#f8fafc",

  color:
    "#64748b",

  fontSize:
    "10px",

  textAlign:
    "center",

  borderTop:
    "1px solid #e2e8f0",
};
