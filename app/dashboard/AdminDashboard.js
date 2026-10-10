"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import AdminAccountsPanel from "./AdminAccountsPanel";
import AdminShiftOverridePanel from "./AdminShiftOverridePanel";
import AdminReportsPanel from "./AdminReportsPanel";
import AdminUserAccountsPanel from "./AdminUserAccountsPanel";
import AdminShopManagementPanel from "./AdminShopManagementPanel";
import AdminSalaryManagementPanel from "./AdminSalaryManagementPanel";
import AdminAccountantPanel from "./AdminAccountantPanel";
import AdminMpesaRatesPanel from "./AdminMpesaRatesPanel";
import AdminSavingsPanel from "./AdminSavingsPanel";
import AdminDutyControlPanel from "./AdminDutyControlPanel";
import AdminLiveFeedPanel from "./AdminLiveFeedPanel";
import AdminAttendanceControlPanel from "./AdminAttendanceControlPanel";

// TEAM LEGEND / NYIKA — Admin Dashboard
// Provides the agreed editable Master Employee List using the existing
// Master Employee database and admin-only Supabase RPCs.
// The existing Duty/Rota, Live Feed and all other panels remain untouched.

const menuItems = [
  { id: "DASHBOARD", label: "Dashboard", icon: "▦" },
  { id: "REPORTS", label: "View Reports", icon: "▤" },
  { id: "CORRECTIONS", label: "Shift Corrections", icon: "✎" },
  { id: "ACCOUNTS", label: "Accounts", icon: "₿" },
  { id: "SAVINGS_BANKING", label: "Savings / Banking", icon: "▣" },
  { id: "DUTY_ROTA", label: "Duty / Rota", icon: "📅" },
  { id: "MASTER_EMPLOYEES", label: "Master Employee List", icon: "👥" },
  { id: "LIVE_FEED", label: "Live Feed", icon: "●" },
  { id: "ATTENDANCE_CONTROL", label: "Attendance Control", icon: "✓" },
  { id: "SALARY", label: "Employee Salary", icon: "💰" },
  { id: "ACCOUNTANT", label: "Accountant Control", icon: "₭" },
  { id: "MPESA_RATES", label: "M-Pesa Rates", icon: "M" },
  { id: "SETTINGS", label: "Settings", icon: "⚙" },
];

export default function AdminDashboard({ user }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const accessToken = user?.access_token || null;

  const router = useRouter();
  const [activeSection, setActiveSection] = useState("DASHBOARD");

  const adminName =
    user?.full_name ||
    user?.name ||
    user?.username ||
    "Team Legend Admin";

  function logout() {
    sessionStorage.removeItem("teamLegendUser");
    router.replace("/");
  }

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <div style={brandStyle}>
            ♛ TEAM LEGEND ADMIN
          </div>

          <div style={sloganStyle}>
            DISCIPLINE • FOCUS • RESULTS
          </div>
        </div>

        <div style={headerRightStyle}>
          <div style={welcomeStyle}>
            <small>WELCOME</small>
            <strong>{adminName}</strong>
          </div>

          <button
            type="button"
            onClick={logout}
            style={logoutButtonStyle}
          >
            Logout
          </button>
        </div>
      </header>

      <div style={bodyLayoutStyle}>
        <aside style={sidebarStyle}>
          <div style={menuTitleStyle}>
            ADMIN MENU
          </div>

          {menuItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() =>
                setActiveSection(item.id)
              }
              style={{
                ...menuButtonStyle,
                ...(activeSection === item.id
                  ? activeMenuButtonStyle
                  : {}),
              }}
            >
              <span style={menuIconStyle}>
                {item.icon}
              </span>
              <span>{item.label}</span>
            </button>
          ))}

          <div style={sidebarFooterStyle}>
            <div>Signed in as</div>
            <strong>ADMIN</strong>
          </div>
        </aside>

        <section style={contentStyle}>
          {activeSection === "DASHBOARD" && (
            <DashboardHome
              adminName={adminName}
              setActiveSection={setActiveSection}
            />
          )}

          {activeSection === "REPORTS" && (
            <>
              <PageHeading
                title="View Reports"
                subtitle="View current and historical shop sales reports."
              />
              <AdminReportsPanel user={user} />
            </>
          )}

          {activeSection === "CORRECTIONS" && (
            <>
              <PageHeading
                title="Shift Corrections"
                subtitle="Admin control of shop shifts, platform readings, expenses, savings, overrides and audit history."
              />
              <AdminShiftOverridePanel user={user} />
            </>
          )}

          {activeSection === "ACCOUNTS" && (
            <>
              <PageHeading
                title="Accounts"
                subtitle="Manage shop payment and account information."
              />
              <AdminAccountsPanel user={user} />
            </>
          )}

          {activeSection === "SAVINGS_BANKING" && (
            <>
              <PageHeading
                title="Savings / Banking"
                subtitle="Live Savings balances, payment activity, Accountant confirmations and permanent ledger audit."
              />
              <AdminSavingsPanel user={user} />
            </>
          )}

          {activeSection === "DUTY_ROTA" && (
            <>
              <PageHeading
                title="Duty / Rota"
                subtitle="Manage the 2-week duty rota, off days, relief assignments, temporary shop moves and employee swaps."
              />

              <AdminDutyControlPanel
                supabaseUrl={supabaseUrl}
                supabaseAnonKey={supabaseAnonKey}
                accessToken={accessToken}
              />
            </>
          )}

          {/* MASTER EMPLOYEE MANAGEMENT — EDITABLE */}

          {activeSection === "MASTER_EMPLOYEES" && (
            <AdminMasterEmployeeList
              supabaseUrl={supabaseUrl}
              supabaseAnonKey={supabaseAnonKey}
              accessToken={accessToken}
            />
          )}

          {activeSection === "LIVE_FEED" && (
            <>
              <PageHeading
                title="Live Feed"
                subtitle="Post and manage shared announcements shown in the moving cashier Live Feed."
              />
              <AdminLiveFeedPanel user={user} />
            </>
          )}

          {activeSection === "ATTENDANCE_CONTROL" && (
            <>
              <PageHeading
                title="Attendance Control"
                subtitle="Monitor employee attendance, 24-hour shop exemptions, and grant or revoke Lunch and Supper."
              />
              <AdminAttendanceControlPanel user={user} />
            </>
          )}

          {activeSection === "SALARY" && (
            <>
              <PageHeading
                title="Employee Salary"
                subtitle="Manage weekly salaries, private Salary PINs, advances, deductions and employee salary access."
              />
              <AdminSalaryManagementPanel user={user} />
            </>
          )}

          {activeSection === "ACCOUNTANT" && (
            <>
              <PageHeading
                title="Accountant Control"
                subtitle="Monitor Legend Accounts daily balances, accountant expenses, cashier returns, float transfers and transaction history."
              />
              <AdminAccountantPanel user={user} />
            </>
          )}

          {activeSection === "MPESA_RATES" && (
            <>
              <PageHeading
                title="M-Pesa Rates"
                subtitle="Admin control of Safaricom transaction-fee bands used by the Team Legend system."
              />
              <AdminMpesaRatesPanel user={user} />
            </>
          )}

          {activeSection === "SETTINGS" && (
            <SettingsPanel user={user} />
          )}
        </section>
      </div>
    </main>
  );
}

// ==================================================
// MASTER EMPLOYEES - AGREED EDITABLE LIST
//
// Employee name
// Shop or category
// Weekly salary
// Unique ID
// Add Employee
// One Reason for Edit at bottom.
//
// Backend:
// tl_admin_master_employee_list
// tl_admin_master_employee_shops_v1
// tl_admin_master_employee_save_v1
// ==================================================

function masterCategory(employee) {
  if (
    employee.assignment_type === "FIXED" &&
    employee.shop_id
  ) {
    return `SHOP:${employee.shop_id}`;
  }

  if (employee.job_title === "TEAM_LEADER") {
    return "TEAM_LEADER";
  }

  if (employee.job_title === "ACCOUNTANT") {
    return "ACCOUNTANT";
  }

  return "RELIEVER";
}

function toMasterDraft(employee) {
  return {
    key: employee.employee_id,
    employee_id: employee.employee_id,
    full_name: employee.full_name ?? "",
    shop_choice: masterCategory(employee),

    weekly_salary:
      employee.weekly_salary === null ||
      employee.weekly_salary === undefined
        ? ""
        : String(employee.weekly_salary),

    employment_status: employee.employment_status,
  };
}

function sameSalary(a, b) {
  if (
    String(a).trim() === "" ||
    String(b).trim() === ""
  ) {
    return String(a).trim() === String(b).trim();
  }

  return Number(a) === Number(b);
}

function masterRowChanged(current, original) {
  if (!original) return true;

  return (
    current.full_name !== original.full_name ||
    current.shop_choice !== original.shop_choice ||
    !sameSalary(
      current.weekly_salary,
      original.weekly_salary
    )
  );
}

function AdminMasterEmployeeList({
  supabaseUrl,
  supabaseAnonKey,
  accessToken,
}) {
  const [employees, setEmployees] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [shops, setShops] = useState([]);

  const [reason, setReason] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [reload, setReload] = useState(0);

  const baseUrl = useMemo(
    () => String(supabaseUrl || "").replace(/\/+$/, ""),
    [supabaseUrl]
  );

  // ==================================================
  // SUPABASE RPC
  // ==================================================

  const rpc = useCallback(
    async (functionName, payload = {}, signal) => {
      if (
        !baseUrl ||
        !supabaseAnonKey ||
        !accessToken
      ) {
        throw new Error(
          "Admin login or Supabase connection is missing."
        );
      }

      const response = await fetch(
        `${baseUrl}/rest/v1/rpc/${functionName}`,
        {
          method: "POST",

          headers: {
            apikey: supabaseAnonKey,

            Authorization:
              `Bearer ${accessToken}`,

            "Content-Type": "application/json",
          },

          body: JSON.stringify(payload),
          cache: "no-store",

          ...(signal ? { signal } : {}),
        }
      );

      const body = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        throw new Error(
          body?.message ||
          body?.details ||
          body?.hint ||
          `${functionName} failed (${response.status}).`
        );
      }

      return body;
    },
    [
      baseUrl,
      supabaseAnonKey,
      accessToken,
    ]
  );

  // ==================================================
  // LOAD MASTER EMPLOYEES AND SHOPS
  // ==================================================

  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const [people, shopOptions] =
          await Promise.all([
            rpc(
              "tl_admin_master_employee_list",
              {},
              controller.signal
            ),

            rpc(
              "tl_admin_master_employee_shops_v1",
              {},
              controller.signal
            ),
          ]);

        if (!mounted) return;

        if (
          !Array.isArray(people) ||
          !Array.isArray(shopOptions)
        ) {
          throw new Error(
            "Unexpected Master Employee database response."
          );
        }

        const current = people.map(toMasterDraft);

        setEmployees(current);
        setDrafts(current);
        setShops(shopOptions);

      } catch (err) {
        if (
          mounted &&
          err?.name !== "AbortError"
        ) {
          setError(
            err?.message ||
            "Unable to load Master Employees."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [rpc, reload]);

  // ==================================================
  // ORIGINAL EMPLOYEE VALUES
  // ==================================================

  const originals = useMemo(
    () =>
      new Map(
        employees.map((e) => [
          e.employee_id,
          e,
        ])
      ),
    [employees]
  );

  // ==================================================
  // CHANGED EMPLOYEES ONLY
  // ==================================================

  const pending = useMemo(
    () =>
      drafts.filter((e) =>
        masterRowChanged(
          e,
          originals.get(e.employee_id)
        )
      ),
    [drafts, originals]
  );

  const hasPending = pending.length > 0;

  // ==================================================
  // EDIT EMPLOYEE FIELD
  // ==================================================

  const updateDraft = (key, field, value) => {
    setDrafts((current) =>
      current.map((row) =>
        row.key === key
          ? { ...row, [field]: value }
          : row
      )
    );

    setError("");
    setNotice("");
  };

  // ==================================================
  // ADD NEW EMPLOYEE
  // ==================================================

  function addEmployee() {
    setDrafts((current) => [
      ...current,
      {
        key: `new-${Date.now()}-${Math.random()}`,
        employee_id: null,
        full_name: "",
        shop_choice: "",
        weekly_salary: "",
        employment_status: "ACTIVE",
      },
    ]);

    setNotice("");
    setError("");
  }

  // ==================================================
  // CANCEL UNSAVED NEW EMPLOYEE
  // ==================================================

  function discardNew(key) {
    setDrafts((current) =>
      current.filter((row) => row.key !== key)
    );

    setNotice("");
  }

  // ==================================================
  // SAVE CHANGES
  // ==================================================

  async function saveChanges() {
    if (
      !pending.length ||
      loading ||
      saving
    ) {
      return;
    }

    const sharedReason = reason.trim();

    if (sharedReason.length < 3) {
      setError(
        "Enter one reason for the changes at the bottom before saving."
      );

      return;
    }

    // ----------------------------------------------
    // VALIDATE ALL CHANGES BEFORE SAVING
    // ----------------------------------------------

    for (const entry of pending) {
      if (
        entry.employment_status !== "ACTIVE"
      ) {
        setError(
          "Inactive employees cannot be edited with this Save function."
        );

        return;
      }

      if (
        entry.full_name.trim().length < 2
      ) {
        setError(
          "Every employee must have a name of at least 2 characters."
        );

        return;
      }

      if (!entry.shop_choice) {
        setError(
          `Choose a Shop / Category for ${
            entry.full_name || "the new employee"
          }.`
        );

        return;
      }

      const amount = String(
        entry.weekly_salary
      ).trim();

      if (
        !/^\d+(\.\d{1,2})?$/.test(amount) ||
        Number(amount) > 1000000000
      ) {
        setError(
          `Enter a valid weekly salary (KES) for ${entry.full_name}.`
        );

        return;
      }
    }

    // ----------------------------------------------
    // SAVE TO SUPABASE
    // ----------------------------------------------

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const result = await rpc(
        "tl_admin_master_employee_save_v1",
        {
          p_reason: sharedReason,

          p_changes: pending.map((row) => ({
            employee_id: row.employee_id,
            full_name: row.full_name,
            shop_choice: row.shop_choice,
            weekly_salary: Number(
              row.weekly_salary
            ),
          })),
        }
      );

      if (result?.success !== true) {
        throw new Error(
          "The database did not confirm the Save operation."
        );
      }

      setReason("");

      setNotice(
        `${result.added || 0} employee(s) added, ` +
        `${result.edited || 0} employee(s) edited. Changes saved.`
      );

      setReload((x) => x + 1);

    } catch (err) {
      setError(
        err?.message ||
        "Unable to save employee changes."
      );
    } finally {
      setSaving(false);
    }
  }

  // ==================================================
  // MASTER EMPLOYEE INTERFACE
  // ==================================================

  return (
    <section style={masterPanelStyle}>

      {/* ========================================= */}
      {/* HEADER AND TOTAL ONLY */}
      {/* ========================================= */}

      <div style={masterPanelHeaderStyle}>
        <strong
          style={{
            fontSize: 17,
            fontWeight: 900,
          }}
        >
          MASTER EMPLOYEES
        </strong>

        <strong style={{ fontSize: 12 }}>
          Total Employees: {employees.length}
        </strong>
      </div>

      {/* ========================================= */}
      {/* ERROR / SUCCESS MESSAGES */}
      {/* ========================================= */}

      {error && (
        <div
          role="alert"
          style={masterErrorStyle}
        >
          {error}
        </div>
      )}

      {notice && (
        <div
          role="status"
          style={masterSuccessStyle}
        >
          {notice}
        </div>
      )}

      {loading ? (
        <div style={masterEmptyStyle}>
          Loading Master Employees...
        </div>
      ) : (
        <div style={masterPanelBodyStyle}>

          {/* ===================================== */}
          {/* EMPLOYEE TABLE */}
          {/* ===================================== */}

          <div style={masterTableContainerStyle}>
            <table style={masterTableStyle}>
              <thead>
                <tr>
                  {[
                    "EMPLOYEE NAME",
                    "SHOP / CATEGORY",
                    "SALARY AMOUNT (KES / WEEK)",
                    "UNIQUE EMPLOYEE ID",
                  ].map((title) => (
                    <th
                      key={title}
                      style={masterThStyle}
                    >
                      {title}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {drafts.map((row) => {
                  const isNew = !row.employee_id;

                  const original =
                    originals.get(
                      row.employee_id
                    );

                  const changed =
                    masterRowChanged(
                      row,
                      original
                    );

                  const readOnly =
                    saving ||
                    row.employment_status !== "ACTIVE";

                  return (
                    <tr
                      key={row.key}
                      style={{
                        background: changed
                          ? "#f0f9ff"
                          : "white",
                      }}
                    >

                      {/* EMPLOYEE NAME */}

                      <td style={masterTdStyle}>
                        <input
                          type="text"
                          aria-label="Employee name"
                          style={masterInputStyle}
                          value={row.full_name}
                          onChange={(e) =>
                            updateDraft(
                              row.key,
                              "full_name",
                              e.target.value
                            )
                          }
                          disabled={readOnly}
                          placeholder="Employee full name"
                        />
                      </td>

                      {/* SHOP / CATEGORY */}

                      <td style={masterTdStyle}>
                        <select
                          aria-label="Shop or category"
                          style={masterInputStyle}
                          value={row.shop_choice}
                          disabled={readOnly}
                          onChange={(e) =>
                            updateDraft(
                              row.key,
                              "shop_choice",
                              e.target.value
                            )
                          }
                        >
                          <option value="">
                            Select shop / category
                          </option>

                          {shops.map((shop) => (
                            <option
                              key={shop.id}
                              value={`SHOP:${shop.id}`}
                            >
                              {shop.name}
                            </option>
                          ))}

                          <option value="RELIEVER">
                            Reliever
                          </option>

                          <option value="TEAM_LEADER">
                            Team Leader
                          </option>

                          <option value="ACCOUNTANT">
                            Accountant
                          </option>
                        </select>
                      </td>

                      {/* WEEKLY SALARY */}

                      <td style={masterTdStyle}>
                        <input
                          type="number"
                          aria-label="Weekly salary in Kenya shillings"
                          style={masterInputStyle}
                          min="0"
                          max="1000000000"
                          step="0.01"
                          value={row.weekly_salary}
                          onChange={(e) =>
                            updateDraft(
                              row.key,
                              "weekly_salary",
                              e.target.value
                            )
                          }
                          disabled={readOnly}
                          placeholder="KES"
                        />
                      </td>

                      {/* PERMANENT UNIQUE EMPLOYEE ID */}

                      <td style={masterTdStyle}>
                        {isNew ? (
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              alignItems: "center",
                            }}
                          >
                            <span
                              style={{
                                color: "#64748b",
                                fontSize: 11,
                              }}
                            >
                              Generated on Save
                            </span>

                            <button
                              type="button"
                              style={masterRemoveStyle}
                              disabled={saving}
                              onClick={() =>
                                discardNew(row.key)
                              }
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <input
                            aria-label="Permanent employee ID"
                            type="text"
                            style={{
                              ...masterInputStyle,
                              background: "#f1f5f9",
                              fontSize: 10,
                            }}
                            value={row.employee_id}
                            title={row.employee_id}
                            readOnly
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ===================================== */}
          {/* ADD NEW EMPLOYEE */}
          {/* ===================================== */}

          <button
            type="button"
            style={masterAddButtonStyle}
            onClick={addEmployee}
            disabled={saving}
          >
            + Add Employee
          </button>

          {/* ===================================== */}
          {/* ONE REASON FOR EDIT AT BOTTOM */}
          {/* ===================================== */}

          <div style={masterBottomStyle}>
            <label
              htmlFor="master-edit-reason"
              style={{
                fontWeight: 800,
                fontSize: 12,
              }}
            >
              Reason for Edit
            </label>

            <textarea
              id="master-edit-reason"
              style={{
                ...masterInputStyle,
                minHeight: 76,
                resize: "vertical",
              }}
              placeholder="One reason for all employee changes in this Save operation"
              value={reason}
              disabled={saving}
              onChange={(e) => {
                setReason(e.target.value);
                setError("");
              }}
            />

            <button
              type="button"
              style={{
                ...masterSaveButtonStyle,

                opacity:
                  !hasPending || saving
                    ? 0.5
                    : 1,
              }}
              onClick={saveChanges}
              disabled={!hasPending || saving}
            >
              {saving
                ? "Saving..."
                : "Save Changes"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

// ==================================================
// DASHBOARD HOME
// ==================================================

function DashboardHome({
  adminName,
  setActiveSection,
}) {
  const cards = [
    [
      "VIEW REPORTS",
      "View OPEN and CLOSED sales reports by shop, date and shift.",
      "#0891b2",
      "Open Reports",
      "REPORTS",
    ],
    [
      "SHIFT CORRECTIONS",
      "Correct Balance B/F, platform readings, expenses, savings and protected shift figures.",
      "#7c3aed",
      "Open Corrections",
      "CORRECTIONS",
    ],
    [
      "ACCOUNTS",
      "Manage Rent, WIFI, DSTV, Electricity and Banking payment information for each shop.",
      "#15803d",
      "Manage Accounts",
      "ACCOUNTS",
    ],
    [
      "SAVINGS / BANKING",
      "Monitor live Savings, Banking balances, pending payments, confirmed payments, rejected requests and ledger history.",
      "#0f766e",
      "Open Savings Control",
      "SAVINGS_BANKING",
    ],
    [
      "DUTY / ROTA",
      "Manage the Master Duty Rota, OFF days, relief duties and working-shop assignments.",
      "#6366f1",
      "Open Duty / Rota",
      "DUTY_ROTA",
    ],
    [
      "MASTER EMPLOYEE LIST",
      "Add employees and edit names, shop/category and weekly salary; retain permanent IDs.",
      "#0e7490",
      "View Master Employees",
      "MASTER_EMPLOYEES",
    ],
    [
      "LIVE FEED",
      "Post and manage shared messages shown to all cashiers in the moving Live Feed ticker.",
      "#111C30",
      "Open Live Feed",
      "LIVE_FEED",
    ],
    [
      "ATTENDANCE CONTROL",
      "Monitor employee sign-in, 24-hour exemptions, and grant or revoke Lunch and Supper with a permanent audit trail.",
      "#b45309",
      "Open Attendance Control",
      "ATTENDANCE_CONTROL",
    ],
    [
      "EMPLOYEE SALARY",
      "Manage employee salaries, 4-digit Salary PINs, advances, deductions and salary access.",
      "#4f46e5",
      "Manage Salaries",
      "SALARY",
    ],
    [
      "ACCOUNTANT CONTROL",
      "View Legend Accounts daily report, accountant expenses, cashier returns, float transfers and transaction records.",
      "#0f766e",
      "Open Accountant",
      "ACCOUNTANT",
    ],
    [
      "M-PESA RATES",
      "Manage Safaricom transaction-fee bands and test fees when tariffs change.",
      "#059669",
      "Manage M-Pesa Rates",
      "MPESA_RATES",
    ],
    [
      "SETTINGS",
      "Manage shops, user accounts and system configuration.",
      "#475569",
      "Open Settings",
      "SETTINGS",
    ],
  ];

  const statuses = [
    "Shift Override",
    "Attendance / Meal Control",
    "Admin Corrections",
    "Shared Live Feed",
    "Master Employee List",
    "Audit History",
    "Carry-Forward Protection",
    "View Reports",
    "Accounts Management",
    "Savings / Banking Monitoring",
    "Savings Ledger Audit",
    "Salary Management",
    "Salary PIN Protection",
    "Accountant Monitoring",
    "Cashier Return Tracking",
    "M-Pesa Rate Control",
    "M-Pesa Fee Testing",
  ];

  return (
    <>
      <PageHeading
        title="Admin Dashboard"
        subtitle={`Welcome, ${adminName}. Manage Team Legend shops from one place.`}
      />

      <div style={welcomeBannerStyle}>
        <div>
          <div style={welcomeTitleStyle}>
            TEAM LEGEND SALES SYSTEM
          </div>

          <div style={welcomeSubtitleStyle}>
            Admin Control Centre
          </div>
        </div>

        <div style={adminBadgeStyle}>
          ADMIN ACCESS
        </div>
      </div>

      <div style={dashboardGridStyle}>
        {cards.map(
          ([
            title,
            description,
            accent,
            buttonText,
            id,
          ]) => (
            <DashboardCard
              key={id}
              title={title}
              description={description}
              accent={accent}
              buttonText={buttonText}
              onClick={() =>
                setActiveSection(id)
              }
            />
          )
        )}
      </div>

      <div style={systemStatusStyle}>
        <div style={systemStatusTitleStyle}>
          ADMIN CONTROL SYSTEM
        </div>

        <div style={statusGridStyle}>
          {statuses.map((label) => (
            <StatusItem
              key={label}
              label={label}
              status="ACTIVE"
            />
          ))}
        </div>
      </div>

      <div style={noticeStyle}>
        Admin can monitor Legend Accounts activity,
        Savings and Banking balances, manage
        Safaricom M-Pesa fee bands, review
        accountant expenses, cashier returns,
        transaction records and protected shop
        corrections.
      </div>
    </>
  );
}

// ==================================================
// PAGE HEADING
// ==================================================

function PageHeading({
  title,
  subtitle,
}) {
  return (
    <div style={pageHeadingStyle}>
      <h1 style={pageTitleStyle}>
        {title}
      </h1>

      <p style={pageSubtitleStyle}>
        {subtitle}
      </p>
    </div>
  );
}

// ==================================================
// DASHBOARD CARD
// ==================================================

function DashboardCard({
  title,
  description,
  accent,
  buttonText,
  onClick,
}) {
  return (
    <div
      style={{
        ...dashboardCardStyle,
        borderTop: `5px solid ${accent}`,
      }}
    >
      <div>
        <div
          style={{
            ...dashboardCardTitleStyle,
            color: accent,
          }}
        >
          {title}
        </div>

        <div style={dashboardCardDescriptionStyle}>
          {description}
        </div>
      </div>

      <button
        type="button"
        onClick={onClick}
        style={{
          ...dashboardCardButtonStyle,
          backgroundColor: accent,
        }}
      >
        {buttonText}
      </button>
    </div>
  );
}

// ==================================================
// STATUS ITEM
// ==================================================

function StatusItem({
  label,
  status,
}) {
  return (
    <div style={statusItemStyle}>
      <span>{label}</span>

      <strong style={activeStatusStyle}>
        {status} ✓
      </strong>
    </div>
  );
}

// ==================================================
// SETTINGS
// ==================================================

function SettingsPanel({ user }) {
  return (
    <>
      <PageHeading
        title="Settings"
        subtitle="System configuration and Admin information."
      />

      <div style={settingsPanelStyle}>
        <div style={settingsTitleStyle}>
          ADMIN PROFILE
        </div>

        <SettingRow
          label="Name"
          value={
            user?.full_name ||
            user?.name ||
            "Team Legend Admin"
          }
        />

        <SettingRow
          label="Role"
          value={user?.role || "ADMIN"}
        />

        <SettingRow
          label="System"
          value="Team Legend Sales System"
        />

        <SettingRow
          label="Timezone"
          value="Africa/Nairobi"
        />

        <div style={settingsNoticeStyle}>
          Additional settings will be connected
          here as the system expands. Existing
          sales, Accountant, Savings, Banking,
          M-Pesa rate and correction functions
          are unaffected.
        </div>
      </div>

      <AdminShopManagementPanel user={user} />

      <AdminUserAccountsPanel user={user} />
    </>
  );
}

// ==================================================
// SETTING ROW
// ==================================================

function SettingRow({
  label,
  value,
}) {
  return (
    <div style={settingRowStyle}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

// ==================================================
// EXISTING ADMIN STYLES
// ==================================================

const pageStyle = {
  minHeight: "100vh",
  backgroundColor: "#eef2f7",
  fontFamily: "Arial, sans-serif",
  color: "#0f172a",
};

const headerStyle = {
  minHeight: "68px",
  padding: "10px 22px",
  background: "linear-gradient(90deg,#052d4b,#064b6b)",
  color: "white",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  boxSizing: "border-box",
};

const brandStyle = {
  fontSize: "22px",
  fontWeight: "900",
  letterSpacing: "0.5px",
};

const sloganStyle = {
  marginTop: "4px",
  fontSize: "9px",
  letterSpacing: "2.5px",
  color: "#cbd5e1",
};

const headerRightStyle = {
  display: "flex",
  alignItems: "center",
  gap: "18px",
};

const welcomeStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: "2px",
  fontSize: "11px",
};

const logoutButtonStyle = {
  padding: "8px 14px",
  border: "none",
  borderRadius: "5px",
  backgroundColor: "#e11d48",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
};

const bodyLayoutStyle = {
  display: "flex",
  minHeight: "calc(100vh - 68px)",
};

const sidebarStyle = {
  width: "210px",
  flexShrink: 0,
  backgroundColor: "#073b5c",
  padding: "16px 10px",
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
};

const menuTitleStyle = {
  padding: "8px 10px 14px",
  color: "#94a3b8",
  fontSize: "9px",
  fontWeight: "bold",
  letterSpacing: "1px",
};

const menuButtonStyle = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "12px 10px",
  marginBottom: "5px",
  border: "none",
  borderRadius: "5px",
  backgroundColor: "transparent",
  color: "#e2e8f0",
  textAlign: "left",
  fontSize: "12px",
  fontWeight: "bold",
  cursor: "pointer",
};

const activeMenuButtonStyle = {
  backgroundColor: "#0891b2",
  color: "white",
};

const menuIconStyle = {
  width: "20px",
  textAlign: "center",
  fontSize: "16px",
};

const sidebarFooterStyle = {
  marginTop: "auto",
  padding: "12px 10px",
  borderTop:
    "1px solid rgba(255,255,255,0.15)",
  color: "#cbd5e1",
  fontSize: "9px",
  display: "flex",
  flexDirection: "column",
  gap: "3px",
};

const contentStyle = {
  flex: 1,
  minWidth: 0,
  padding: "24px",
  boxSizing: "border-box",
  overflowX: "auto",
};

const pageHeadingStyle = {
  marginBottom: "18px",
};

const pageTitleStyle = {
  margin: 0,
  fontSize: "25px",
  color: "#0f172a",
};

const pageSubtitleStyle = {
  margin: "5px 0 0",
  color: "#64748b",
  fontSize: "12px",
};

const welcomeBannerStyle = {
  padding: "20px",
  marginBottom: "18px",
  borderRadius: "8px",
  background:
    "linear-gradient(90deg,#0e7490,#0369a1)",
  color: "white",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const welcomeTitleStyle = {
  fontSize: "20px",
  fontWeight: "900",
};

const welcomeSubtitleStyle = {
  marginTop: "5px",
  fontSize: "11px",
  letterSpacing: "1.5px",
};

const adminBadgeStyle = {
  padding: "8px 14px",
  border:
    "1px solid rgba(255,255,255,0.5)",
  borderRadius: "20px",
  fontSize: "10px",
  fontWeight: "bold",
};

const dashboardGridStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(220px,1fr))",
  gap: "14px",
  marginBottom: "18px",
};

const dashboardCardStyle = {
  minHeight: "175px",
  padding: "18px",
  backgroundColor: "white",
  border: "1px solid #cbd5e1",
  borderRadius: "7px",
  boxShadow:
    "0 2px 8px rgba(15,23,42,0.06)",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  gap: "18px",
};

const dashboardCardTitleStyle = {
  fontSize: "14px",
  fontWeight: "900",
  marginBottom: "9px",
};

const dashboardCardDescriptionStyle = {
  color: "#64748b",
  fontSize: "11px",
  lineHeight: "1.5",
};

const dashboardCardButtonStyle = {
  width: "100%",
  padding: "9px",
  border: "none",
  borderRadius: "5px",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
  fontSize: "10px",
};

const systemStatusStyle = {
  padding: "16px",
  backgroundColor: "white",
  border: "1px solid #cbd5e1",
  borderRadius: "7px",
};

const systemStatusTitleStyle = {
  marginBottom: "12px",
  color: "#0f172a",
  fontWeight: "bold",
  fontSize: "12px",
};

const statusGridStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(220px,1fr))",
  gap: "8px",
};

const statusItemStyle = {
  padding: "9px",
  border: "1px solid #e2e8f0",
  borderRadius: "5px",
  display: "flex",
  justifyContent: "space-between",
  gap: "8px",
  fontSize: "10px",
};

const activeStatusStyle = {
  color: "#15803d",
};

const noticeStyle = {
  marginTop: "12px",
  padding: "10px",
  backgroundColor: "#ecfeff",
  border: "1px solid #a5f3fc",
  borderRadius: "5px",
  color: "#155e75",
  textAlign: "center",
  fontSize: "9px",
};

const settingsPanelStyle = {
  maxWidth: "750px",
  backgroundColor: "white",
  border: "1px solid #cbd5e1",
  borderRadius: "7px",
  overflow: "hidden",
  marginBottom: "18px",
};

const settingsTitleStyle = {
  padding: "10px 14px",
  backgroundColor: "#475569",
  color: "white",
  fontWeight: "bold",
  fontSize: "12px",
};

const settingRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "20px",
  padding: "12px 14px",
  borderTop: "1px solid #e2e8f0",
  fontSize: "11px",
};

const settingsNoticeStyle = {
  padding: "12px",
  backgroundColor: "#f8fafc",
  color: "#64748b",
  textAlign: "center",
  fontSize: "9px",
};

// ==================================================
// MASTER EMPLOYEE EDITABLE LIST STYLES
// ==================================================

const masterPanelStyle = {
  background: "#fff",
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  overflow: "hidden",
  boxShadow:
    "0 2px 8px rgba(15,23,42,.04)",
};

const masterPanelHeaderStyle = {
  background:
    "linear-gradient(90deg,#052d4b,#064b6b)",
  padding: 17,
  color: "white",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: 10,
};

const masterPanelBodyStyle = {
  display: "grid",
  gap: 16,
  padding: 14,
};

const masterTableContainerStyle = {
  overflowX: "auto",
  maxHeight: "70vh",
  overflowY: "auto",
};

const masterTableStyle = {
  width: "100%",
  minWidth: 840,
  borderCollapse: "collapse",
};

const masterThStyle = {
  position: "sticky",
  top: 0,
  zIndex: 1,
  textAlign: "left",
  background: "#073b5c",
  color: "white",
  fontSize: 10,
  letterSpacing: ".2px",
  padding: "12px 10px",
  whiteSpace: "nowrap",
};

const masterTdStyle = {
  padding: "7px 9px",
  borderBottom:
    "1px solid #e2e8f0",
};

const masterInputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "9px 10px",
  background: "white",
  color: "#0f172a",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  fontSize: 12,
  fontFamily: "inherit",
};

const masterAddButtonStyle = {
  width: "fit-content",
  background: "white",
  color: "#073b5c",
  border: "1px solid #073b5c",
  borderRadius: 7,
  fontSize: 12,
  fontWeight: 850,
  padding: "10px 14px",
  cursor: "pointer",
};

const masterBottomStyle = {
  display: "grid",
  gap: 9,
  borderTop: "1px solid #e2e8f0",
  paddingTop: 14,
};

const masterSaveButtonStyle = {
  width: "fit-content",
  background: "#073b5c",
  color: "white",
  border: "none",
  borderRadius: 7,
  fontWeight: 850,
  fontSize: 12,
  padding: "11px 20px",
  cursor: "pointer",
};

const masterRemoveStyle = {
  background: "transparent",
  color: "#b91c1c",
  border: "none",
  textDecoration: "underline",
  fontSize: 11,
  cursor: "pointer",
};

const masterErrorStyle = {
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#991b1b",
  borderRadius: 7,
  margin: 12,
  padding: 11,
  fontSize: 12,
};

const masterSuccessStyle = {
  background: "#f0fdf4",
  border: "1px solid #bbf7d0",
  color: "#166534",
  borderRadius: 7,
  margin: 12,
  padding: 11,
  fontSize: 12,
};

const masterEmptyStyle = {
  textAlign: "center",
  padding: 24,
  color: "#64748b",
  fontSize: 12,
};
