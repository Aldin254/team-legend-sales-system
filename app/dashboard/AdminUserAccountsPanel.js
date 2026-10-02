"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

export default function AdminUserAccountsPanel({
  user,
}) {
  const [accounts, setAccounts] =
    useState([]);

  const [shops, setShops] =
    useState([]);

  const [
    currentAdminProfileId,
    setCurrentAdminProfileId,
  ] = useState(null);

  const [loading, setLoading] =
    useState(true);

  const [savingId, setSavingId] =
    useState(null);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const [newAccount, setNewAccount] =
    useState({
      username: "",
      full_name: "",
      role: "CASHIER",
      shop_id: "",
      password: "",
    });

  const accessToken =
    user?.access_token || "";

  // ==================================================
  // ACTIVE SHOPS
  // ==================================================

  const activeShops =
    useMemo(() => {
      return shops.filter(
        (shop) =>
          shop.is_active !== false
      );
    }, [shops]);

  // ==================================================
  // LOAD
  // ==================================================

  useEffect(() => {
    loadAccounts();
  }, []);

  async function loadAccounts() {
    try {
      setLoading(true);
      setError("");
      setMessage("");

      const response =
        await fetch(
          "/api/admin/accounts",
          {
            method: "GET",

            headers: {
              Authorization:
                `Bearer ${accessToken}`,
            },

            cache:
              "no-store",
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
            "Unable to load user accounts."
        );
      }

      setAccounts(
        Array.isArray(
          data.accounts
        )
          ? data.accounts
          : []
      );

      setShops(
        Array.isArray(data.shops)
          ? data.shops
          : []
      );

      setCurrentAdminProfileId(
        data.current_admin_profile_id ||
          null
      );
    } catch (err) {
      setError(
        err?.message ||
          "Unable to load accounts."
      );
    } finally {
      setLoading(false);
    }
  }

  // ==================================================
  // CREATE
  // ==================================================

  async function createAccount() {
    try {
      setError("");
      setMessage("");

      const username =
        String(
          newAccount.username || ""
        )
          .trim()
          .toLowerCase();

      const fullName =
        String(
          newAccount.full_name || ""
        ).trim();

      const role =
        String(
          newAccount.role ||
            "CASHIER"
        ).toUpperCase();

      const password =
        String(
          newAccount.password || ""
        );

      if (!username) {
        throw new Error(
          "Enter a username."
        );
      }

      if (!fullName) {
        throw new Error(
          "Enter the staff name."
        );
      }

      if (
        role === "CASHIER" &&
        !newAccount.shop_id
      ) {
        throw new Error(
          "Select a shop for the cashier."
        );
      }

      if (
        password.length < 8
      ) {
        throw new Error(
          "Password must have at least 8 characters."
        );
      }

      setSavingId("CREATE");

      const response =
        await fetch(
          "/api/admin/accounts",
          {
            method: "POST",

            headers: {
              Authorization:
                `Bearer ${accessToken}`,

              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              username,

              full_name:
                fullName,

              role,

              shop_id:
                role === "ADMIN"
                  ? null
                  : newAccount.shop_id,

              password,
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
            "Unable to create account."
        );
      }

      setNewAccount({
        username: "",
        full_name: "",
        role: "CASHIER",
        shop_id: "",
        password: "",
      });

      setMessage(
        "Account created successfully."
      );

      await loadAccounts();
    } catch (err) {
      setError(
        err?.message ||
          "Unable to create account."
      );
    } finally {
      setSavingId(null);
    }
  }

  // ==================================================
  // UPDATE LOCAL ROW
  // ==================================================

  function updateRow(
    profileId,
    field,
    value
  ) {
    setAccounts(
      (current) =>
        current.map(
          (account) => {
            if (
              account.id !==
              profileId
            ) {
              return account;
            }

            const updated = {
              ...account,
              [field]:
                value,
            };

            if (
              field === "role" &&
              value === "ADMIN"
            ) {
              updated.shop_id =
                null;
            }

            return updated;
          }
        )
    );
  }

  // ==================================================
  // SAVE ACCOUNT
  // ==================================================

  async function saveAccount(
    account
  ) {
    try {
      setError("");
      setMessage("");

      setSavingId(
        account.id
      );

      const response =
        await fetch(
          "/api/admin/accounts",
          {
            method: "PATCH",

            headers: {
              Authorization:
                `Bearer ${accessToken}`,

              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              profile_id:
                account.id,

              username:
                String(
                  account.username ||
                    ""
                )
                  .trim()
                  .toLowerCase(),

              full_name:
                String(
                  account.full_name ||
                    ""
                ).trim(),

              role:
                account.role,

              shop_id:
                account.role ===
                "ADMIN"
                  ? null
                  : account.shop_id,

              is_active:
                Boolean(
                  account.is_active
                ),

              password:
                String(
                  account.new_password ||
                    ""
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
            "Unable to update account."
        );
      }

      setMessage(
        `${account.full_name} updated successfully.`
      );

      await loadAccounts();
    } catch (err) {
      setError(
        err?.message ||
          "Unable to update account."
      );
    } finally {
      setSavingId(null);
    }
  }

  // ==================================================
  // ACTIVATE / DEACTIVATE
  // ==================================================

  async function toggleAccount(
    account
  ) {
    const newStatus =
      !account.is_active;

    const action =
      newStatus
        ? "reactivate"
        : "deactivate";

    const confirmed =
      window.confirm(
        `${action.toUpperCase()} ${account.full_name}?`
      );

    if (!confirmed) {
      return;
    }

    await saveAccount({
      ...account,

      is_active:
        newStatus,

      new_password: "",
    });
  }

  // ==================================================
  // DELETE LOGIN
  // ==================================================

  async function deleteAccount(
    account
  ) {
    const confirmed =
      window.confirm(
        `DELETE LOGIN ACCOUNT?\n\n${account.full_name}\nUsername: ${account.username}\n\nThe login will be removed, but historical shift records will be preserved.`
      );

    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setMessage("");

      setSavingId(
        account.id
      );

      const response =
        await fetch(
          "/api/admin/accounts",
          {
            method:
              "DELETE",

            headers: {
              Authorization:
                `Bearer ${accessToken}`,

              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                profile_id:
                  account.id,
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
            "Unable to delete account."
        );
      }

      setMessage(
        "Login account deleted. Historical records were preserved."
      );

      await loadAccounts();
    } catch (err) {
      setError(
        err?.message ||
          "Unable to delete account."
      );
    } finally {
      setSavingId(null);
    }
  }

  // ==================================================
  // UI
  // ==================================================

  return (
    <div style={panelStyle}>
      <div style={titleBarStyle}>
        USER ACCOUNTS MANAGEMENT
      </div>

      <div style={noticeStyle}>
        Only Admin can create,
        rename, assign, disable,
        reactivate or delete staff
        login accounts.
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

      {/* ======================================= */}
      {/* CREATE ACCOUNT */}
      {/* ======================================= */}

      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>
          CREATE NEW ACCOUNT
        </div>

        <div style={createGridStyle}>
          <Field
            label="USERNAME"
          >
            <input
              value={
                newAccount.username
              }
              onChange={(e) =>
                setNewAccount(
                  {
                    ...newAccount,

                    username:
                      e.target.value,
                  }
                )
              }
              placeholder="example: corridor01"
              style={inputStyle}
            />
          </Field>

          <Field
            label="STAFF NAME"
          >
            <input
              value={
                newAccount.full_name
              }
              onChange={(e) =>
                setNewAccount(
                  {
                    ...newAccount,

                    full_name:
                      e.target.value,
                  }
                )
              }
              placeholder="Cashier full name"
              style={inputStyle}
            />
          </Field>

          <Field label="ROLE">
            <select
              value={
                newAccount.role
              }
              onChange={(e) =>
                setNewAccount(
                  {
                    ...newAccount,

                    role:
                      e.target.value,

                    shop_id:
                      e.target
                        .value ===
                      "ADMIN"
                        ? ""
                        : newAccount.shop_id,
                  }
                )
              }
              style={inputStyle}
            >
              <option value="CASHIER">
                CASHIER
              </option>

              <option value="ADMIN">
                ADMIN
              </option>
            </select>
          </Field>

          <Field label="SHOP">
            <select
              value={
                newAccount.shop_id
              }
              disabled={
                newAccount.role ===
                "ADMIN"
              }
              onChange={(e) =>
                setNewAccount(
                  {
                    ...newAccount,

                    shop_id:
                      e.target.value,
                  }
                )
              }
              style={{
                ...inputStyle,

                backgroundColor:
                  newAccount.role ===
                  "ADMIN"
                    ? "#e2e8f0"
                    : "white",
              }}
            >
              <option value="">
                Select shop
              </option>

              {activeShops.map(
                (shop) => (
                  <option
                    key={shop.id}
                    value={shop.id}
                  >
                    {shop.shop_name}
                    {shop.shop_type
                      ? ` (${shop.shop_type})`
                      : ""}
                  </option>
                )
              )}
            </select>
          </Field>

          <Field
            label="TEMPORARY PASSWORD"
          >
            <input
              type="password"
              value={
                newAccount.password
              }
              onChange={(e) =>
                setNewAccount(
                  {
                    ...newAccount,

                    password:
                      e.target.value,
                  }
                )
              }
              placeholder="Minimum 8 characters"
              style={inputStyle}
            />
          </Field>
        </div>

        <button
          type="button"
          onClick={
            createAccount
          }
          disabled={
            savingId ===
            "CREATE"
          }
          style={createButtonStyle}
        >
          {savingId ===
          "CREATE"
            ? "CREATING..."
            : "+ CREATE ACCOUNT"}
        </button>
      </div>

      {/* ======================================= */}
      {/* EXISTING ACCOUNTS */}
      {/* ======================================= */}

      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>
          EXISTING LOGIN ACCOUNTS
        </div>

        {loading ? (
          <div style={loadingStyle}>
            Loading accounts...
          </div>
        ) : accounts.length ===
          0 ? (
          <div style={loadingStyle}>
            No login accounts
            found.
          </div>
        ) : (
          <div style={tableWrapperStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>
                    USERNAME
                  </th>

                  <th style={thStyle}>
                    STAFF NAME
                  </th>

                  <th style={thStyle}>
                    ROLE
                  </th>

                  <th style={thStyle}>
                    SHOP
                  </th>

                  <th style={thStyle}>
                    STATUS
                  </th>

                  <th style={thStyle}>
                    NEW PASSWORD
                  </th>

                  <th style={thStyle}>
                    ACTION
                  </th>
                </tr>
              </thead>

              <tbody>
                {accounts.map(
                  (account) => {
                    const isSelf =
                      String(
                        account.id
                      ) ===
                      String(
                        currentAdminProfileId
                      );

                    return (
                      <tr
                        key={
                          account.id
                        }
                      >
                        <td style={tdStyle}>
                          <input
                            value={
                              account.username ||
                              ""
                            }
                            onChange={(e) =>
                              updateRow(
                                account.id,
                                "username",
                                e.target
                                  .value
                              )
                            }
                            style={
                              compactInputStyle
                            }
                          />

                          {isSelf && (
                            <div style={selfBadgeStyle}>
                              CURRENT ADMIN
                            </div>
                          )}
                        </td>

                        <td style={tdStyle}>
                          <input
                            value={
                              account.full_name ||
                              ""
                            }
                            onChange={(e) =>
                              updateRow(
                                account.id,
                                "full_name",
                                e.target
                                  .value
                              )
                            }
                            style={
                              compactInputStyle
                            }
                          />
                        </td>

                        <td style={tdStyle}>
                          <select
                            value={
                              account.role ||
                              "CASHIER"
                            }
                            disabled={
                              isSelf
                            }
                            onChange={(e) =>
                              updateRow(
                                account.id,
                                "role",
                                e.target
                                  .value
                              )
                            }
                            style={
                              compactInputStyle
                            }
                          >
                            <option value="CASHIER">
                              CASHIER
                            </option>

                            <option value="ADMIN">
                              ADMIN
                            </option>
                          </select>
                        </td>

                        <td style={tdStyle}>
                          <select
                            value={
                              account.shop_id ||
                              ""
                            }
                            disabled={
                              account.role ===
                              "ADMIN"
                            }
                            onChange={(e) =>
                              updateRow(
                                account.id,
                                "shop_id",
                                e.target
                                  .value
                              )
                            }
                            style={
                              compactInputStyle
                            }
                          >
                            <option value="">
                              No shop
                            </option>

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
                                  }
                                  {shop.is_active ===
                                  false
                                    ? " [INACTIVE]"
                                    : ""}
                                </option>
                              )
                            )}
                          </select>
                        </td>

                        <td style={tdStyle}>
                          <div
                            style={{
                              ...statusStyle,

                              backgroundColor:
                                account.is_active
                                  ? "#dcfce7"
                                  : "#fee2e2",

                              color:
                                account.is_active
                                  ? "#166534"
                                  : "#991b1b",
                            }}
                          >
                            {account.is_active
                              ? "ACTIVE"
                              : "INACTIVE"}
                          </div>

                          {!isSelf && (
                            <button
                              type="button"
                              onClick={() =>
                                toggleAccount(
                                  account
                                )
                              }
                              disabled={
                                savingId ===
                                account.id
                              }
                              style={
                                account.is_active
                                  ? deactivateButtonStyle
                                  : activateButtonStyle
                              }
                            >
                              {account.is_active
                                ? "Deactivate"
                                : "Reactivate"}
                            </button>
                          )}
                        </td>

                        <td style={tdStyle}>
                          <input
                            type="password"
                            value={
                              account.new_password ||
                              ""
                            }
                            onChange={(e) =>
                              updateRow(
                                account.id,
                                "new_password",
                                e.target
                                  .value
                              )
                            }
                            placeholder="Leave blank"
                            style={
                              compactInputStyle
                            }
                          />
                        </td>

                        <td style={tdStyle}>
                          <div style={actionStackStyle}>
                            <button
                              type="button"
                              onClick={() =>
                                saveAccount(
                                  account
                                )
                              }
                              disabled={
                                savingId ===
                                account.id
                              }
                              style={saveButtonStyle}
                            >
                              {savingId ===
                              account.id
                                ? "SAVING..."
                                : "SAVE"}
                            </button>

                            {!isSelf && (
                              <button
                                type="button"
                                onClick={() =>
                                  deleteAccount(
                                    account
                                  )
                                }
                                disabled={
                                  savingId ===
                                  account.id
                                }
                                style={deleteButtonStyle}
                              >
                                DELETE LOGIN
                              </button>
                            )}
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
          onClick={
            loadAccounts
          }
          style={refreshButtonStyle}
        >
          REFRESH ACCOUNTS
        </button>
      </div>

      <div style={footerNoticeStyle}>
        Deleting an account removes
        login access but preserves its
        historical profile so previous
        shifts and audit records remain
        intact.
      </div>
    </div>
  );
}

// ==================================================
// FIELD
// ==================================================

function Field({
  label,
  children,
}) {
  return (
    <label style={fieldStyle}>
      <span style={labelStyle}>
        {label}
      </span>

      {children}
    </label>
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
    "linear-gradient(90deg,#7c3aed,#4f46e5)",
  color: "white",
  fontWeight: "900",
  fontSize: "12px",
};

const noticeStyle = {
  padding: "10px 14px",
  backgroundColor: "#f5f3ff",
  color: "#5b21b6",
  fontSize: "10px",
  borderBottom: "1px solid #ddd6fe",
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
    "repeat(auto-fit,minmax(170px,1fr))",
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
  backgroundColor: "#7c3aed",
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
  minWidth: "1000px",
};

const thStyle = {
  padding: "8px",
  backgroundColor: "#eef2ff",
  border: "1px solid #e2e8f0",
  fontSize: "8px",
  textAlign: "left",
};

const tdStyle = {
  padding: "7px",
  border: "1px solid #e2e8f0",
  verticalAlign: "top",
};

const compactInputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "7px",
  border: "1px solid #cbd5e1",
  borderRadius: "3px",
  fontSize: "10px",
};

const selfBadgeStyle = {
  marginTop: "4px",
  padding: "3px 5px",
  display: "inline-block",
  backgroundColor: "#ede9fe",
  color: "#5b21b6",
  fontSize: "7px",
  fontWeight: "bold",
  borderRadius: "3px",
};

const statusStyle = {
  padding: "5px",
  textAlign: "center",
  borderRadius: "3px",
  fontWeight: "bold",
  fontSize: "8px",
  marginBottom: "5px",
};

const saveButtonStyle = {
  padding: "7px",
  border: "none",
  backgroundColor: "#16a34a",
  color: "white",
  fontWeight: "bold",
  borderRadius: "3px",
  cursor: "pointer",
  fontSize: "8px",
};

const deleteButtonStyle = {
  padding: "7px",
  border: "none",
  backgroundColor: "#dc2626",
  color: "white",
  fontWeight: "bold",
  borderRadius: "3px",
  cursor: "pointer",
  fontSize: "8px",
};

const deactivateButtonStyle = {
  width: "100%",
  padding: "5px",
  border: "none",
  backgroundColor: "#f59e0b",
  color: "white",
  fontWeight: "bold",
  borderRadius: "3px",
  cursor: "pointer",
  fontSize: "7px",
};

const activateButtonStyle = {
  width: "100%",
  padding: "5px",
  border: "none",
  backgroundColor: "#16a34a",
  color: "white",
  fontWeight: "bold",
  borderRadius: "3px",
  cursor: "pointer",
  fontSize: "7px",
};

const actionStackStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "5px",
};

const refreshButtonStyle = {
  marginTop: "12px",
  width: "100%",
  padding: "8px",
  border: "none",
  borderRadius: "4px",
  backgroundColor: "#475569",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
  fontSize: "9px",
};

const footerNoticeStyle = {
  padding: "10px",
  backgroundColor: "#f8fafc",
  borderTop: "1px solid #e2e8f0",
  color: "#64748b",
  textAlign: "center",
  fontSize: "8px",
};
