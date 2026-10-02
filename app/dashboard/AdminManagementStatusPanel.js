"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

// ==================================================
// HELPERS
// ==================================================

function money(value) {
  const number = Number(value || 0);

  return new Intl.NumberFormat(
    "en-KE",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  ).format(number);
}

function getToken(user) {
  return (
    user?.access_token ||
    ""
  );
}

async function readJson(response) {
  const text =
    await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return {
      message: text,
    };
  }
}

// ==================================================
// MAIN COMPONENT
// ==================================================

export default function AdminManagementStatusPanel({
  user,
}) {
  const token =
    getToken(user);

  const [
    shops,
    setShops,
  ] =
    useState([]);

  const [
    selectedShopId,
    setSelectedShopId,
  ] =
    useState("");

  const [
    rows,
    setRows,
  ] =
    useState([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    message,
    setMessage,
  ] =
    useState("");

  const [
    error,
    setError,
  ] =
    useState("");

  // ----------------------------------------------
  // NEW RECORD FORM
  // ----------------------------------------------

  const [
    description,
    setDescription,
  ] =
    useState("");

  const [
    cashierName,
    setCashierName,
  ] =
    useState("");

  const [
    amount,
    setAmount,
  ] =
    useState("");

  const [
    dueDate,
    setDueDate,
  ] =
    useState("");

  const [
    status,
    setStatus,
  ] =
    useState(
      "PENDING"
    );

  // ----------------------------------------------
  // INLINE EDIT VALUES
  // ----------------------------------------------

  const [
    drafts,
    setDrafts,
  ] =
    useState({});

  // ==================================================
  // LOAD SHOPS
  // ==================================================

  const loadShops =
    useCallback(
      async () => {
        if (!token) {
          setError(
            "Admin login token is missing."
          );

          setLoading(false);
          return;
        }

        try {
          const response =
            await fetch(
              "/api/admin/shops",
              {
                method:
                  "GET",

                headers: {
                  Authorization:
                    `Bearer ${token}`,
                },

                cache:
                  "no-store",
              }
            );

          const data =
            await readJson(
              response
            );

          if (
            !response.ok ||
            !data?.success
          ) {
            throw new Error(
              data?.message ||
                "Unable to load shops."
            );
          }

          const activeShops =
            Array.isArray(
              data.shops
            )
              ? data.shops.filter(
                  (shop) =>
                    shop.is_active
                )
              : [];

          setShops(
            activeShops
          );

          setSelectedShopId(
            (current) => {
              if (current) {
                return current;
              }

              return (
                activeShops[0]
                  ?.id || ""
              );
            }
          );
        } catch (err) {
          setError(
            err?.message ||
              "Unable to load shops."
          );
        } finally {
          setLoading(false);
        }
      },
      [token]
    );

  // ==================================================
  // LOAD MANAGEMENT STATUS
  // ==================================================

  const loadRows =
    useCallback(
      async (
        shopId
      ) => {
        if (
          !token ||
          !shopId
        ) {
          setRows([]);
          setDrafts({});
          return;
        }

        setError("");

        try {
          const response =
            await fetch(
              `/api/admin/management-status?shop_id=${encodeURIComponent(
                shopId
              )}`,
              {
                method:
                  "GET",

                headers: {
                  Authorization:
                    `Bearer ${token}`,
                },

                cache:
                  "no-store",
              }
            );

          const data =
            await readJson(
              response
            );

          if (
            !response.ok ||
            !data?.success
          ) {
            throw new Error(
              data?.message ||
                "Unable to load Management Status."
            );
          }

          const loadedRows =
            Array.isArray(
              data.rows
            )
              ? data.rows
              : [];

          setRows(
            loadedRows
          );

          const nextDrafts =
            {};

          loadedRows.forEach(
            (row) => {
              nextDrafts[
                row.id
              ] = {
                description:
                  row.description ||
                  "",

                cashier_name:
                  row.cashier_name ||
                  "",

                amount:
                  String(
                    row.amount ??
                      0
                  ),

                due_date:
                  row.due_date ||
                  "",

                status:
                  row.status ||
                  "PENDING",
              };
            }
          );

          setDrafts(
            nextDrafts
          );
        } catch (err) {
          setError(
            err?.message ||
              "Unable to load Management Status."
          );
        }
      },
      [token]
    );

  // ==================================================
  // INITIAL LOAD
  // ==================================================

  useEffect(() => {
    loadShops();
  }, [loadShops]);

  useEffect(() => {
    if (
      selectedShopId
    ) {
      loadRows(
        selectedShopId
      );
    }
  }, [
    selectedShopId,
    loadRows,
  ]);

  // ==================================================
  // SELECTED SHOP
  // ==================================================

  const selectedShop =
    useMemo(
      () =>
        shops.find(
          (shop) =>
            shop.id ===
            selectedShopId
        ) || null,
      [
        shops,
        selectedShopId,
      ]
    );

  // ==================================================
  // CREATE RECORD
  // ==================================================

  async function createRecord() {
    setMessage("");
    setError("");

    if (
      !selectedShopId
    ) {
      setError(
        "Select a shop."
      );
      return;
    }

    if (
      !description.trim()
    ) {
      setError(
        "Enter a description."
      );
      return;
    }

    setSaving(true);

    try {
      const response =
        await fetch(
          "/api/admin/management-status",
          {
            method:
              "POST",

            headers: {
              Authorization:
                `Bearer ${token}`,

              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                shop_id:
                  selectedShopId,

                description:
                  description.trim(),

                cashier_name:
                  cashierName.trim(),

                amount:
                  Number(
                    amount ||
                      0
                  ),

                due_date:
                  dueDate ||
                  null,

                status,
              }),
          }
        );

      const data =
        await readJson(
          response
        );

      if (
        !response.ok ||
        !data?.success
      ) {
        throw new Error(
          data?.message ||
            "Unable to create record."
        );
      }

      setDescription("");
      setCashierName("");
      setAmount("");
      setDueDate("");
      setStatus(
        "PENDING"
      );

      setMessage(
        "Management Status record added successfully."
      );

      await loadRows(
        selectedShopId
      );
    } catch (err) {
      setError(
        err?.message ||
          "Unable to create record."
      );
    } finally {
      setSaving(false);
    }
  }

  // ==================================================
  // CHANGE DRAFT
  // ==================================================

  function updateDraft(
    id,
    field,
    value
  ) {
    setDrafts(
      (current) => ({
        ...current,

        [id]: {
          ...(current[id] ||
            {}),

          [field]:
            value,
        },
      })
    );
  }

  // ==================================================
  // SAVE RECORD
  // ==================================================

  async function saveRecord(
    row
  ) {
    const draft =
      drafts[row.id];

    if (!draft) {
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response =
        await fetch(
          "/api/admin/management-status",
          {
            method:
              "PATCH",

            headers: {
              Authorization:
                `Bearer ${token}`,

              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                id:
                  row.id,

                description:
                  draft.description,

                cashier_name:
                  draft.cashier_name,

                amount:
                  Number(
                    draft.amount ||
                      0
                  ),

                due_date:
                  draft.due_date ||
                  null,

                status:
                  draft.status,
              }),
          }
        );

      const data =
        await readJson(
          response
        );

      if (
        !response.ok ||
        !data?.success
      ) {
        throw new Error(
          data?.message ||
            "Unable to save record."
        );
      }

      setMessage(
        "Management Status record updated."
      );

      await loadRows(
        selectedShopId
      );
    } catch (err) {
      setError(
        err?.message ||
          "Unable to save record."
      );
    } finally {
      setSaving(false);
    }
  }

  // ==================================================
  // DELETE RECORD
  // ==================================================

  async function deleteRecord(
    row
  ) {
    const confirmed =
      window.confirm(
        `Delete "${row.description}"?`
      );

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response =
        await fetch(
          "/api/admin/management-status",
          {
            method:
              "DELETE",

            headers: {
              Authorization:
                `Bearer ${token}`,

              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                id:
                  row.id,
              }),
          }
        );

      const data =
        await readJson(
          response
        );

      if (
        !response.ok ||
        !data?.success
      ) {
        throw new Error(
          data?.message ||
            "Unable to delete record."
        );
      }

      setMessage(
        "Management Status record deleted."
      );

      await loadRows(
        selectedShopId
      );
    } catch (err) {
      setError(
        err?.message ||
          "Unable to delete record."
      );
    } finally {
      setSaving(false);
    }
  }

  // ==================================================
  // TOTALS
  // ==================================================

  const pendingTotal =
    rows
      .filter(
        (row) =>
          row.status ===
          "PENDING"
      )
      .reduce(
        (
          total,
          row
        ) =>
          total +
          Number(
            row.amount ||
              0
          ),
        0
      );

  const paidTotal =
    rows
      .filter(
        (row) =>
          row.status ===
          "PAID"
      )
      .reduce(
        (
          total,
          row
        ) =>
          total +
          Number(
            row.amount ||
              0
          ),
        0
      );

  // ==================================================
  // RENDER
  // ==================================================

  if (loading) {
    return (
      <div
        style={
          panelStyle
        }
      >
        Loading Management Status...
      </div>
    );
  }

  return (
    <section
      style={
        panelStyle
      }
    >
      <div
        style={
          headerStyle
        }
      >
        MANAGEMENT STATUS
      </div>

      <div
        style={
          noteStyle
        }
      >
        Only Admin can create,
        update or delete Management
        Status records. Cashiers can
        only view them.
      </div>

      {error ? (
        <div
          style={
            errorStyle
          }
        >
          {error}
        </div>
      ) : null}

      {message ? (
        <div
          style={
            successStyle
          }
        >
          {message}
        </div>
      ) : null}

      <div
        style={
          topGridStyle
        }
      >
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
            onChange={(
              event
            ) =>
              setSelectedShopId(
                event.target
                  .value
              )
            }
            style={
              inputStyle
            }
          >
            {shops.map(
              (shop) => (
                <option
                  key={
                    shop.id
                  }
                  value={
                    shop.id
                  }
                >
                  {
                    shop.shop_name
                  }{" "}
                  (
                  {
                    shop.shop_type
                  }
                  )
                </option>
              )
            )}
          </select>
        </div>

        <div
          style={
            summaryBoxStyle
          }
        >
          <span>
            SHOP
          </span>

          <strong>
            {selectedShop
              ?.shop_name ||
              "-"}
          </strong>
        </div>

        <div
          style={
            summaryBoxStyle
          }
        >
          <span>
            PENDING
          </span>

          <strong>
            KES{" "}
            {money(
              pendingTotal
            )}
          </strong>
        </div>

        <div
          style={
            summaryBoxStyle
          }
        >
          <span>
            PAID
          </span>

          <strong>
            KES{" "}
            {money(
              paidTotal
            )}
          </strong>
        </div>
      </div>

      {/* ==========================================
          CREATE
      ========================================== */}

      <div
        style={
          subHeaderStyle
        }
      >
        ADD MANAGEMENT STATUS
      </div>

      <div
        style={
          createGridStyle
        }
      >
        <div>
          <label
            style={
              labelStyle
            }
          >
            DESCRIPTION
          </label>

          <input
            value={
              description
            }
            onChange={(
              event
            ) =>
              setDescription(
                event.target
                  .value
              )
            }
            placeholder="Example: Weekly Salary"
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
            CASHIER
          </label>

          <input
            value={
              cashierName
            }
            onChange={(
              event
            ) =>
              setCashierName(
                event.target
                  .value
              )
            }
            placeholder="Cashier name"
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
            AMOUNT (KES)
          </label>

          <input
            type="number"
            min="0"
            step="0.01"
            value={
              amount
            }
            onChange={(
              event
            ) =>
              setAmount(
                event.target
                  .value
              )
            }
            placeholder="0.00"
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
            DUE DATE
          </label>

          <input
            type="date"
            value={
              dueDate
            }
            onChange={(
              event
            ) =>
              setDueDate(
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
            STATUS
          </label>

          <select
            value={
              status
            }
            onChange={(
              event
            ) =>
              setStatus(
                event.target
                  .value
              )
            }
            style={
              inputStyle
            }
          >
            <option
              value="PENDING"
            >
              PENDING
            </option>

            <option
              value="PAID"
            >
              PAID
            </option>
          </select>
        </div>
      </div>

      <button
        type="button"
        disabled={
          saving
        }
        onClick={
          createRecord
        }
        style={
          addButtonStyle
        }
      >
        {saving
          ? "SAVING..."
          : "+ ADD MANAGEMENT STATUS"}
      </button>

      {/* ==========================================
          EXISTING RECORDS
      ========================================== */}

      <div
        style={
          subHeaderStyle
        }
      >
        EXISTING MANAGEMENT STATUS
      </div>

      {rows.length ===
      0 ? (
        <div
          style={
            emptyStyle
          }
        >
          No Management Status
          records for this shop.
        </div>
      ) : (
        <div
          style={{
            overflowX:
              "auto",
          }}
        >
          <table
            style={
              tableStyle
            }
          >
            <thead>
              <tr>
                <th
                  style={
                    thStyle
                  }
                >
                  DESCRIPTION
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  CASHIER
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  AMOUNT
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  DUE DATE
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  STATUS
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  ACTION
                </th>
              </tr>
            </thead>

            <tbody>
              {rows.map(
                (row) => {
                  const draft =
                    drafts[
                      row.id
                    ] || {};

                  return (
                    <tr
                      key={
                        row.id
                      }
                    >
                      <td
                        style={
                          tdStyle
                        }
                      >
                        <input
                          value={
                            draft.description ??
                            ""
                          }
                          onChange={(
                            event
                          ) =>
                            updateDraft(
                              row.id,
                              "description",
                              event
                                .target
                                .value
                            )
                          }
                          style={
                            inputStyle
                          }
                        />
                      </td>

                      <td
                        style={
                          tdStyle
                        }
                      >
                        <input
                          value={
                            draft.cashier_name ??
                            ""
                          }
                          onChange={(
                            event
                          ) =>
                            updateDraft(
                              row.id,
                              "cashier_name",
                              event
                                .target
                                .value
                            )
                          }
                          style={
                            inputStyle
                          }
                        />
                      </td>

                      <td
                        style={
                          tdStyle
                        }
                      >
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={
                            draft.amount ??
                            ""
                          }
                          onChange={(
                            event
                          ) =>
                            updateDraft(
                              row.id,
                              "amount",
                              event
                                .target
                                .value
                            )
                          }
                          style={
                            inputStyle
                          }
                        />
                      </td>

                      <td
                        style={
                          tdStyle
                        }
                      >
                        <input
                          type="date"
                          value={
                            draft.due_date ??
                            ""
                          }
                          onChange={(
                            event
                          ) =>
                            updateDraft(
                              row.id,
                              "due_date",
                              event
                                .target
                                .value
                            )
                          }
                          style={
                            inputStyle
                          }
                        />
                      </td>

                      <td
                        style={
                          tdStyle
                        }
                      >
                        <select
                          value={
                            draft.status ||
                            "PENDING"
                          }
                          onChange={(
                            event
                          ) =>
                            updateDraft(
                              row.id,
                              "status",
                              event
                                .target
                                .value
                            )
                          }
                          style={{
                            ...inputStyle,

                            backgroundColor:
                              draft.status ===
                              "PAID"
                                ? "#dcfce7"
                                : "#fef3c7",
                          }}
                        >
                          <option
                            value="PENDING"
                          >
                            PENDING
                          </option>

                          <option
                            value="PAID"
                          >
                            PAID
                          </option>
                        </select>
                      </td>

                      <td
                        style={
                          tdStyle
                        }
                      >
                        <div
                          style={
                            actionStyle
                          }
                        >
                          <button
                            type="button"
                            disabled={
                              saving
                            }
                            onClick={() =>
                              saveRecord(
                                row
                              )
                            }
                            style={
                              saveButtonStyle
                            }
                          >
                            SAVE
                          </button>

                          <button
                            type="button"
                            disabled={
                              saving
                            }
                            onClick={() =>
                              deleteRecord(
                                row
                              )
                            }
                            style={
                              deleteButtonStyle
                            }
                          >
                            DELETE
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }
              )}
            </tbody>
          </table>
        </div>
      )}

      <button
        type="button"
        onClick={() =>
          loadRows(
            selectedShopId
          )
        }
        style={
          refreshButtonStyle
        }
      >
        REFRESH MANAGEMENT STATUS
      </button>
    </section>
  );
}

// ==================================================
// STYLES
// ==================================================

const panelStyle = {
  background:
    "#ffffff",

  border:
    "1px solid #d1d5db",

  borderRadius:
    "6px",

  overflow:
    "hidden",

  marginTop:
    "14px",

  fontFamily:
    "Arial, sans-serif",
};

const headerStyle = {
  background:
    "linear-gradient(90deg,#0f766e,#0891b2)",

  color:
    "#ffffff",

  fontWeight:
    "800",

  padding:
    "10px 14px",

  fontSize:
    "14px",
};

const subHeaderStyle = {
  background:
    "#ecfeff",

  color:
    "#164e63",

  padding:
    "8px 12px",

  fontWeight:
    "800",

  fontSize:
    "12px",

  borderTop:
    "1px solid #bae6fd",

  borderBottom:
    "1px solid #bae6fd",

  marginTop:
    "12px",
};

const noteStyle = {
  padding:
    "8px 12px",

  fontSize:
    "11px",

  color:
    "#475569",
};

const errorStyle = {
  margin:
    "8px 12px",

  padding:
    "9px 10px",

  background:
    "#fee2e2",

  color:
    "#991b1b",

  border:
    "1px solid #fecaca",

  borderRadius:
    "4px",

  fontSize:
    "12px",
};

const successStyle = {
  margin:
    "8px 12px",

  padding:
    "9px 10px",

  background:
    "#dcfce7",

  color:
    "#166534",

  border:
    "1px solid #bbf7d0",

  borderRadius:
    "4px",

  fontSize:
    "12px",
};

const topGridStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "minmax(220px,2fr) repeat(3,minmax(140px,1fr))",

  gap:
    "10px",

  padding:
    "12px",
};

const createGridStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "2fr 1.5fr 1fr 1fr 1fr",

  gap:
    "8px",

  padding:
    "12px",
};

const summaryBoxStyle = {
  border:
    "1px solid #cbd5e1",

  borderRadius:
    "4px",

  padding:
    "8px",

  display:
    "flex",

  flexDirection:
    "column",

  gap:
    "4px",

  fontSize:
    "11px",

  color:
    "#475569",
};

const labelStyle = {
  display:
    "block",

  marginBottom:
    "4px",

  fontSize:
    "10px",

  fontWeight:
    "800",

  color:
    "#475569",
};

const inputStyle = {
  width:
    "100%",

  boxSizing:
    "border-box",

  padding:
    "7px 8px",

  border:
    "1px solid #cbd5e1",

  borderRadius:
    "3px",

  background:
    "#ffffff",

  fontSize:
    "12px",
};

const addButtonStyle = {
  width:
    "calc(100% - 24px)",

  margin:
    "0 12px",

  padding:
    "9px",

  border:
    "none",

  borderRadius:
    "3px",

  background:
    "linear-gradient(90deg,#0f766e,#0891b2)",

  color:
    "#ffffff",

  fontWeight:
    "800",

  cursor:
    "pointer",
};

const tableStyle = {
  width:
    "100%",

  borderCollapse:
    "collapse",

  fontSize:
    "11px",
};

const thStyle = {
  background:
    "#cffafe",

  color:
    "#155e75",

  textAlign:
    "left",

  padding:
    "7px",

  borderBottom:
    "1px solid #a5f3fc",
};

const tdStyle = {
  padding:
    "5px",

  borderBottom:
    "1px solid #e2e8f0",

  verticalAlign:
    "middle",
};

const actionStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "1fr 1fr",

  gap:
    "5px",
};

const saveButtonStyle = {
  padding:
    "7px",

  border:
    "none",

  borderRadius:
    "3px",

  background:
    "#16a34a",

  color:
    "#ffffff",

  fontWeight:
    "800",

  cursor:
    "pointer",
};

const deleteButtonStyle = {
  padding:
    "7px",

  border:
    "none",

  borderRadius:
    "3px",

  background:
    "#e11d48",

  color:
    "#ffffff",

  fontWeight:
    "800",

  cursor:
    "pointer",
};

const refreshButtonStyle = {
  width:
    "calc(100% - 24px)",

  margin:
    "12px",

  padding:
    "8px",

  border:
    "none",

  borderRadius:
    "3px",

  background:
    "#334155",

  color:
    "#ffffff",

  fontWeight:
    "800",

  cursor:
    "pointer",
};

const emptyStyle = {
  padding:
    "24px",

  textAlign:
    "center",

  color:
    "#64748b",

  fontSize:
    "12px",
};
