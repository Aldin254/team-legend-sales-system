"use client";

import {
  useEffect,
  useState,
} from "react";

export default function AdminShopManagementPanel({
  user,
}) {
  const [shops, setShops] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [savingId, setSavingId] =
    useState(null);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const [newShop, setNewShop] =
    useState({
      shop_name: "",
      shop_type: "12_HOUR",
    });

  const accessToken =
    user?.access_token || "";

  // ==================================================
  // LOAD SHOPS
  // ==================================================

  useEffect(() => {
    loadShops();
  }, []);

  async function loadShops() {
    try {
      setLoading(true);
      setError("");

      const response =
        await fetch(
          "/api/admin/shops",
          {
            method: "GET",

            headers: {
              Authorization:
                `Bearer ${accessToken}`,
            },

            cache: "no-store",
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data?.success
      ) {
        throw new Error(
          data?.message ||
            "Unable to load shops."
        );
      }

      setShops(
        Array.isArray(data.shops)
          ? data.shops
          : []
      );
    } catch (err) {
      setError(
        err?.message ||
          "Unable to load shops."
      );
    } finally {
      setLoading(false);
    }
  }

  // ==================================================
  // CREATE SHOP
  // ==================================================

  async function createShop() {
    try {
      setError("");
      setMessage("");

      const shopName =
        String(
          newShop.shop_name || ""
        ).trim();

      if (!shopName) {
        throw new Error(
          "Enter the new shop name."
        );
      }

      setSavingId("CREATE");

      const response =
        await fetch(
          "/api/admin/shops",
          {
            method: "POST",

            headers: {
              Authorization:
                `Bearer ${accessToken}`,

              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                shop_name:
                  shopName,

                shop_type:
                  newShop.shop_type,
              }),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data?.success
      ) {
        throw new Error(
          data?.message ||
            "Unable to create shop."
        );
      }

      setNewShop({
        shop_name: "",
        shop_type: "12_HOUR",
      });

      setMessage(
        "Shop created successfully."
      );

      await loadShops();
    } catch (err) {
      setError(
        err?.message ||
          "Unable to create shop."
      );
    } finally {
      setSavingId(null);
    }
  }

  // ==================================================
  // UPDATE LOCAL ROW
  // ==================================================

  function updateRow(
    shopId,
    field,
    value
  ) {
    setShops(
      (current) =>
        current.map(
          (shop) =>
            shop.id === shopId
              ? {
                  ...shop,
                  [field]: value,
                }
              : shop
        )
    );
  }

  // ==================================================
  // SAVE SHOP
  // ==================================================

  async function saveShop(
    shop
  ) {
    try {
      setError("");
      setMessage("");

      setSavingId(shop.id);

      const response =
        await fetch(
          "/api/admin/shops",
          {
            method: "PATCH",

            headers: {
              Authorization:
                `Bearer ${accessToken}`,

              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                shop_id:
                  shop.id,

                shop_name:
                  String(
                    shop.shop_name ||
                      ""
                  ).trim(),

                shop_type:
                  shop.shop_type,

                is_active:
                  Boolean(
                    shop.is_active
                  ),
              }),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data?.success
      ) {
        throw new Error(
          data?.message ||
            "Unable to update shop."
        );
      }

      setMessage(
        `${shop.shop_name} updated successfully.`
      );

      await loadShops();
    } catch (err) {
      setError(
        err?.message ||
          "Unable to update shop."
      );
    } finally {
      setSavingId(null);
    }
  }

  // ==================================================
  // ACTIVATE / DEACTIVATE
  // ==================================================

  async function toggleShop(
    shop
  ) {
    const newStatus =
      !shop.is_active;

    const action =
      newStatus
        ? "REACTIVATE"
        : "DEACTIVATE";

    const confirmed =
      window.confirm(
        `${action} SHOP?\n\n${shop.shop_name}`
      );

    if (!confirmed) {
      return;
    }

    await saveShop({
      ...shop,
      is_active:
        newStatus,
    });
  }

  // ==================================================
  // UI
  // ==================================================

  return (
    <div style={panelStyle}>
      <div style={titleBarStyle}>
        SHOP MANAGEMENT
      </div>

      <div style={noticeStyle}>
        Only Admin can create,
        rename, change type or
        activate/deactivate shops.
        Historical shops are preserved.
      </div>

      {error && (
        <div style={errorStyle}>
          {error}
        </div>
      )}

      {message && (
        <div style={successStyle}>
          {message}
        </div>
      )}

      {/* CREATE */}

      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>
          CREATE NEW SHOP
        </div>

        <div style={createGridStyle}>
          <label style={fieldStyle}>
            <span style={labelStyle}>
              SHOP NAME
            </span>

            <input
              value={
                newShop.shop_name
              }
              onChange={(e) =>
                setNewShop({
                  ...newShop,
                  shop_name:
                    e.target.value,
                })
              }
              placeholder="Example: Corridor"
              style={inputStyle}
            />
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>
              SHOP TYPE
            </span>

            <select
              value={
                newShop.shop_type
              }
              onChange={(e) =>
                setNewShop({
                  ...newShop,
                  shop_type:
                    e.target.value,
                })
              }
              style={inputStyle}
            >
              <option value="12_HOUR">
                12_HOUR
              </option>

              <option value="24_HOUR">
                24_HOUR
              </option>
            </select>
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>
              TIMEZONE
            </span>

            <input
              value="Africa/Nairobi"
              disabled
              style={{
                ...inputStyle,
                backgroundColor:
                  "#e2e8f0",
              }}
            />
          </label>
        </div>

        <button
          type="button"
          onClick={createShop}
          disabled={
            savingId === "CREATE"
          }
          style={createButtonStyle}
        >
          {savingId === "CREATE"
            ? "CREATING..."
            : "+ CREATE SHOP"}
        </button>
      </div>

      {/* EXISTING */}

      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>
          EXISTING SHOPS
        </div>

        {loading ? (
          <div style={loadingStyle}>
            Loading shops...
          </div>
        ) : shops.length === 0 ? (
          <div style={loadingStyle}>
            No shops found.
          </div>
        ) : (
          <div style={tableWrapperStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>
                    SHOP NAME
                  </th>

                  <th style={thStyle}>
                    TYPE
                  </th>

                  <th style={thStyle}>
                    TIMEZONE
                  </th>

                  <th style={thStyle}>
                    STATUS
                  </th>

                  <th style={thStyle}>
                    ACTION
                  </th>
                </tr>
              </thead>

              <tbody>
                {shops.map(
                  (shop) => (
                    <tr key={shop.id}>
                      <td style={tdStyle}>
                        <input
                          value={
                            shop.shop_name ||
                            ""
                          }
                          onChange={(e) =>
                            updateRow(
                              shop.id,
                              "shop_name",
                              e.target.value
                            )
                          }
                          style={compactInputStyle}
                        />
                      </td>

                      <td style={tdStyle}>
                        <select
                          value={
                            shop.shop_type
                          }
                          onChange={(e) =>
                            updateRow(
                              shop.id,
                              "shop_type",
                              e.target.value
                            )
                          }
                          style={compactInputStyle}
                        >
                          <option value="12_HOUR">
                            12_HOUR
                          </option>

                          <option value="24_HOUR">
                            24_HOUR
                          </option>
                        </select>
                      </td>

                      <td style={tdStyle}>
                        <div style={timezoneStyle}>
                          {shop.timezone ||
                            "Africa/Nairobi"}
                        </div>
                      </td>

                      <td style={tdStyle}>
                        <div
                          style={{
                            ...statusStyle,

                            backgroundColor:
                              shop.is_active
                                ? "#dcfce7"
                                : "#fee2e2",

                            color:
                              shop.is_active
                                ? "#166534"
                                : "#991b1b",
                          }}
                        >
                          {shop.is_active
                            ? "ACTIVE"
                            : "INACTIVE"}
                        </div>
                      </td>

                      <td style={tdStyle}>
                        <div style={actionStyle}>
                          <button
                            type="button"
                            onClick={() =>
                              saveShop(shop)
                            }
                            disabled={
                              savingId ===
                              shop.id
                            }
                            style={saveButtonStyle}
                          >
                            {savingId ===
                            shop.id
                              ? "SAVING..."
                              : "SAVE"}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              toggleShop(
                                shop
                              )
                            }
                            disabled={
                              savingId ===
                              shop.id
                            }
                            style={
                              shop.is_active
                                ? deactivateButtonStyle
                                : activateButtonStyle
                            }
                          >
                            {shop.is_active
                              ? "DEACTIVATE"
                              : "REACTIVATE"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}

        <button
          type="button"
          onClick={loadShops}
          style={refreshButtonStyle}
        >
          REFRESH SHOPS
        </button>
      </div>

      <div style={footerStyle}>
        Shops are never permanently
        deleted from this screen.
        Deactivation preserves previous
        shifts, reports and account
        history.
      </div>
    </div>
  );
}

// ==================================================
// STYLES
// ==================================================

const panelStyle = {
  marginTop: "18px",
  backgroundColor: "white",
  border: "1px solid #cbd5e1",
  borderRadius: "7px",
  overflow: "hidden",
};

const titleBarStyle = {
  padding: "11px 14px",
  background:
    "linear-gradient(90deg,#0f766e,#0891b2)",
  color: "white",
  fontWeight: "900",
  fontSize: "12px",
};

const noticeStyle = {
  padding: "10px 14px",
  backgroundColor: "#ecfeff",
  color: "#155e75",
  fontSize: "10px",
  borderBottom:
    "1px solid #a5f3fc",
};

const errorStyle = {
  margin: "12px",
  padding: "10px",
  backgroundColor: "#fee2e2",
  color: "#991b1b",
  border: "1px solid #fecaca",
  borderRadius: "5px",
  fontSize: "10px",
};

const successStyle = {
  margin: "12px",
  padding: "10px",
  backgroundColor: "#dcfce7",
  color: "#166534",
  border: "1px solid #bbf7d0",
  borderRadius: "5px",
  fontSize: "10px",
};

const sectionStyle = {
  padding: "14px",
  borderTop: "1px solid #e2e8f0",
};

const sectionTitleStyle = {
  fontSize: "11px",
  fontWeight: "900",
  marginBottom: "12px",
  color: "#334155",
};

const createGridStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(200px,1fr))",
  gap: "10px",
};

const fieldStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "5px",
};

const labelStyle = {
  fontSize: "8px",
  fontWeight: "bold",
  color: "#64748b",
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "9px",
  border: "1px solid #cbd5e1",
  borderRadius: "4px",
  fontSize: "11px",
};

const createButtonStyle = {
  width: "100%",
  marginTop: "12px",
  padding: "10px",
  border: "none",
  borderRadius: "4px",
  backgroundColor: "#0891b2",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
};

const loadingStyle = {
  padding: "25px",
  textAlign: "center",
  color: "#64748b",
  fontSize: "11px",
};

const tableWrapperStyle = {
  overflowX: "auto",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: "750px",
};

const thStyle = {
  padding: "8px",
  backgroundColor: "#cffafe",
  border: "1px solid #e2e8f0",
  fontSize: "8px",
  textAlign: "left",
};

const tdStyle = {
  padding: "7px",
  border: "1px solid #e2e8f0",
};

const compactInputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "7px",
  border: "1px solid #cbd5e1",
  borderRadius: "3px",
  fontSize: "10px",
};

const timezoneStyle = {
  padding: "7px",
  backgroundColor: "#f8fafc",
  borderRadius: "3px",
  fontSize: "9px",
};

const statusStyle = {
  padding: "6px",
  textAlign: "center",
  borderRadius: "3px",
  fontWeight: "bold",
  fontSize: "8px",
};

const actionStyle = {
  display: "flex",
  gap: "5px",
};

const saveButtonStyle = {
  flex: 1,
  padding: "7px",
  border: "none",
  backgroundColor: "#16a34a",
  color: "white",
  fontWeight: "bold",
  borderRadius: "3px",
  cursor: "pointer",
  fontSize: "8px",
};

const deactivateButtonStyle = {
  flex: 1,
  padding: "7px",
  border: "none",
  backgroundColor: "#f59e0b",
  color: "white",
  fontWeight: "bold",
  borderRadius: "3px",
  cursor: "pointer",
  fontSize: "8px",
};

const activateButtonStyle = {
  flex: 1,
  padding: "7px",
  border: "none",
  backgroundColor: "#0891b2",
  color: "white",
  fontWeight: "bold",
  borderRadius: "3px",
  cursor: "pointer",
  fontSize: "8px",
};

const refreshButtonStyle = {
  width: "100%",
  marginTop: "12px",
  padding: "8px",
  border: "none",
  borderRadius: "4px",
  backgroundColor: "#475569",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
  fontSize: "9px",
};

const footerStyle = {
  padding: "10px",
  backgroundColor: "#f8fafc",
  borderTop: "1px solid #e2e8f0",
  color: "#64748b",
  textAlign: "center",
  fontSize: "8px",
};
