"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import Admin24HourShiftDisplay from "./Admin24HourShiftDisplay";
import AdminMealsBonusPanel from "./AdminMealsBonusPanel";
import AdminFinancialPerformancePanel from "./AdminFinancialPerformancePanel";

// ==================================================
// TEAM LEGEND / NYIKA — ADMIN DASHBOARD
//
// UPDATED:
// 12-hour incomplete closing alerts
// Separate Closing Alerts menu
// Live refresh every 45 seconds
// Navigation to existing Shift Corrections
//
// PRESERVED:
// Reports
// Shift Corrections
// Accounts
// Savings / Banking
// Financial Performance
// Duty / Rota
// Master Employee List
// Live Feed
// Meals / Bonus
// Employee Salary
// Accountant Control
// M-Pesa Rates
// Settings
// 24-hour shift display
//
// IMPORTANT:
// This dashboard reads closing incidents.
// It does not automatically close shifts,
// post financial records, or resolve incidents.
// ==================================================

const menuItems = [
  {
    id: "DASHBOARD",
    label: "Dashboard",
    icon: "▦",
  },
  {
    id: "CLOSING_ALERTS",
    label: "Closing Alerts",
    icon: "⚠",
  },
  {
    id: "REPORTS",
    label: "View Reports",
    icon: "▤",
  },
  {
    id: "CORRECTIONS",
    label: "Shift Corrections",
    icon: "✎",
  },
  {
    id: "ACCOUNTS",
    label: "Accounts",
    icon: "₿",
  },
  {
    id: "SAVINGS_BANKING",
    label: "Savings / Banking",
    icon: "▣",
  },
  {
    id: "FINANCIAL_PERFORMANCE",
    label: "Financial Performance",
    icon: "▥",
  },
  {
    id: "DUTY_ROTA",
    label: "Duty / Rota",
    icon: "📅",
  },
  {
    id: "MASTER_EMPLOYEES",
    label: "Master Employee List",
    icon: "👥",
  },
  {
    id: "LIVE_FEED",
    label: "Live Feed",
    icon: "●",
  },
  {
    id: "MEALS_BONUS",
    label: "Meals / Bonus",
    icon: "🍽",
  },
  {
    id: "SALARY",
    label: "Employee Salary",
    icon: "💰",
  },
  {
    id: "ACCOUNTANT",
    label: "Accountant Control",
    icon: "₭",
  },
  {
    id: "MPESA_RATES",
    label: "M-Pesa Rates",
    icon: "M",
  },
  {
    id: "SETTINGS",
    label: "Settings",
    icon: "⚙",
  },
];

// ==================================================
// MAIN ADMIN DASHBOARD
// ==================================================

export default function AdminDashboard({ user }) {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const accessToken =
    user?.access_token || null;

  const router = useRouter();

  const [activeSection, setActiveSection] =
    useState("DASHBOARD");

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
          {/* ADMIN HOME */}

          {activeSection === "DASHBOARD" && (
            <DashboardHome
              user={user}
              adminName={adminName}
              setActiveSection={setActiveSection}
            />
          )}

          {/* NEW: 12-HOUR CLOSING ALERTS */}

          {activeSection === "CLOSING_ALERTS" && (
            <>
              <PageHeading
                title="12-Hour Closing Alerts"
                subtitle="Incomplete closing readings requiring Admin Recovery and verification."
              />

              <AdminClosingAlertsPanel
                user={user}
                setActiveSection={setActiveSection}
                compact={false}
              />
            </>
          )}

          {/* REPORTS */}

          {activeSection === "REPORTS" && (
            <>
              <PageHeading
                title="View Reports"
                subtitle="View current and historical shop sales reports."
              />

              <AdminReportsPanel user={user} />
            </>
          )}

          {/* SHIFT CORRECTIONS */}

          {activeSection === "CORRECTIONS" && (
            <>
              <PageHeading
                title="Shift Corrections"
                subtitle="Admin control of shop shifts, platform readings, expenses, savings, overrides and audit history."
              />

              <AdminShiftOverridePanel
                user={user}
              />
            </>
          )}

          {/* ACCOUNTS */}

          {activeSection === "ACCOUNTS" && (
            <>
              <PageHeading
                title="Accounts"
                subtitle="Manage shop payment and account information."
              />

              <AdminAccountsPanel
                user={user}
              />
            </>
          )}

         {/* SAVINGS / BANKING */}

{activeSection === "SAVINGS_BANKING" && (
  <>
    <PageHeading
      title="Savings / Banking"
      subtitle="Live Savings balances, payment activity, Admin banking verification and permanent ledger audit."
    />

    <AdminBankingVerificationPanel user={user} />

    <AdminSavingsPanel
      user={user}
    />
  </>
)}

          {/* FINANCIAL PERFORMANCE */}

          {activeSection ===
            "FINANCIAL_PERFORMANCE" && (
            <AdminFinancialPerformancePanel
              user={user}
            />
          )}

          {/* DUTY / ROTA */}

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

              <Admin24HourShiftDisplay
                supabaseUrl={supabaseUrl}
                supabaseAnonKey={supabaseAnonKey}
                accessToken={accessToken}
              />
            </>
          )}

          {/* MASTER EMPLOYEE LIST */}

          {activeSection === "MASTER_EMPLOYEES" && (
            <AdminMasterEmployeeList
              supabaseUrl={supabaseUrl}
              supabaseAnonKey={supabaseAnonKey}
              accessToken={accessToken}
            />
          )}

          {/* LIVE FEED */}

          {activeSection === "LIVE_FEED" && (
            <>
              <PageHeading
                title="Live Feed"
                subtitle="Post and manage shared announcements shown in the moving cashier Live Feed."
              />

              <AdminLiveFeedPanel
                user={user}
              />
            </>
          )}

          {/* MEALS / BONUS */}

          {activeSection === "MEALS_BONUS" && (
            <AdminMealsBonusPanel
              user={user}
            />
          )}

          {/* SALARY */}

          {activeSection === "SALARY" && (
            <>
              <PageHeading
                title="Employee Salary"
                subtitle="Manage weekly salaries, private Salary PINs, advances, deductions and employee salary access."
              />

              <AdminSalaryManagementPanel
                user={user}
              />
            </>
          )}

          {/* ACCOUNTANT */}

          {activeSection === "ACCOUNTANT" && (
            <>
              <PageHeading
                title="Accountant Control"
                subtitle="Monitor Legend Accounts daily balances, accountant expenses, cashier returns, float transfers and transaction history."
              />

              <AdminAccountantPanel
                user={user}
              />
            </>
          )}

          {/* M-PESA RATES */}

          {activeSection === "MPESA_RATES" && (
            <>
              <PageHeading
                title="M-Pesa Rates"
                subtitle="Admin control of Safaricom transaction-fee bands used by the Team Legend system."
              />

              <AdminMpesaRatesPanel
                user={user}
              />
            </>
          )}

          {/* SETTINGS */}

          {activeSection === "SETTINGS" && (
            <SettingsPanel
              user={user}
            />
          )}
        </section>
      </div>
    </main>
  );
}
function AdminBankingVerificationPanel({ user }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const accessToken = user?.access_token || null;

  const [reference, setReference] = useState("");
  const [pendingCount, setPendingCount] = useState(null);
  const [loadingCount, setLoadingCount] = useState(true);
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState("");

  const activeRequest = useRef(false);

  const rpc = useCallback(async (name, payload = {}, signal) => {
    if (!supabaseUrl || !supabaseAnonKey || !accessToken) {
      throw new Error("Admin session is incomplete.");
    }

    const response = await fetch(
      `${supabaseUrl}/rest/v1/rpc/${name}`,
      {
        method: "POST",
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        cache: "no-store",
        ...(signal ? { signal } : {}),
      }
    );

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        body?.message ||
        body?.details ||
        `${name} failed (${response.status}).`
      );
    }

    return body;
  }, [supabaseUrl, supabaseAnonKey, accessToken]);

  const loadCount = useCallback(async (signal) => {
    const result = await rpc(
      "tl_admin_banking_verification_snapshot",
      {},
      signal
    );

    const count = Number(result?.banking_pending_count);

    if (
      result?.banking_pending_count == null ||
      !Number.isSafeInteger(count) ||
      count < 0
    ) {
      throw new Error(
        "Admin banking verification snapshot is unavailable."
      );
    }

    return count;
  }, [rpc]);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    const refresh = async () => {
      try {
        const count = await loadCount(controller.signal);

        if (!mounted) return;

        setPendingCount(count);
        setError("");
      } catch (err) {
        if (!mounted || err?.name === "AbortError") return;

        setPendingCount(null);
        setError(
          err?.message ||
          "Unable to load Admin banking verification."
        );
      } finally {
        if (mounted) setLoadingCount(false);
      }
    };

    refresh();

    const timer = setInterval(refresh, 15000);

    return () => {
      mounted = false;
      controller.abort();
      clearInterval(timer);
    };
  }, [loadCount]);

  useEffect(() => {
    if (!notice) return;

    const timer = setTimeout(
      () => setNotice(null),
      5000
    );

    return () => clearTimeout(timer);
  }, [notice]);

  async function verifyReference(event) {
    event.preventDefault();

    if (
      activeRequest.current ||
      checking ||
      pendingCount == null
    ) return;

    const cleaned = reference.trim().toUpperCase();

    if (!/^[A-Z0-9]{8,16}$/.test(cleaned)) {
      setNotice({
        ok: false,
        message: "DECLINED — Invalid reference.",
      });
      return;
    }

    activeRequest.current = true;
    setChecking(true);
    setNotice(null);
    setError("");

    try {
      const result = await rpc(
        "tl_admin_banking_match_reference",
        { p_reference: cleaned }
      );

      const status = String(
        result?.status || ""
      ).toUpperCase();

      if (
        !["MATCHED", "DECLINED", "DUPLICATE"].includes(status)
      ) {
        throw new Error(
          "Unexpected banking verification response."
        );
      }

      setNotice({
        ok: status === "MATCHED",
        message:
          status === "MATCHED" ? "MATCHED" : "DECLINED",
      });

      setReference("");

      try {
        setPendingCount(await loadCount());
      } catch {
        setPendingCount(null);
        setError("Could not refresh pending banking count.");
      }
    } catch (err) {
      setNotice({
        ok: false,
        message:
          err?.message || "Verification unavailable.",
      });
    } finally {
      activeRequest.current = false;
      setChecking(false);
    }
  }

  const card = {
    border: "1px solid #bcd9ce",
    borderRadius: 9,
    background: "#f4fbf7",
    padding: "16px",
    marginBottom: 16,
    color: "#143d33",
    fontSize: 12,
  };

  return (
    <section
      style={card}
      aria-label="Admin banking verification"
    >
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 10,
        marginBottom: 12,
      }}>
        <strong style={{
          fontSize: 13,
          fontWeight: 900,
        }}>
          BANKING VERIFICATION
        </strong>

        <span style={{
          borderRadius: 15,
          padding: "5px 10px",
          background: "#a72525",
          color: "#fff",
          fontSize: 11,
          fontWeight: 800,
        }}>
          {loadingCount || pendingCount == null
            ? "—"
            : pendingCount} PENDING
        </span>
      </div>

      <form
        onSubmit={verifyReference}
        style={{
          display: "grid",
          gap: 9,
        }}
      >
        <label
          htmlFor="admin-banking-reference"
          style={{ fontWeight: 800 }}
        >
          M-PESA REFERENCE
        </label>

        <input
          id="admin-banking-reference"
          value={reference}
          type="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={16}
          placeholder="Reference number"
          onChange={(event) => {
            setReference(
              event.target.value.toUpperCase()
            );
            setNotice(null);
          }}
          disabled={checking || pendingCount == null}
          style={{
            padding: "11px 12px",
            border: "1px solid #b7cdc4",
            borderRadius: 5,
            background: "#fff",
            color: "#1c2d26",
            width: "100%",
            boxSizing: "border-box",
          }}
        />

        <button
          type="submit"
          disabled={
            checking ||
            pendingCount == null ||
            !reference.trim()
          }
          style={{
            border: 0,
            borderRadius: 5,
            padding: "11px 14px",
            background: "#059669",
            color: "white",
            fontWeight: 900,
            cursor: checking ? "wait" : "pointer",
            opacity:
              checking ||
              pendingCount == null ||
              !reference.trim()
                ? 0.55
                : 1,
          }}
        >
          {checking ? "Checking..." : "DONE"}
        </button>

        {notice && (
          <div
            role="status"
            style={{
              color: notice.ok
                ? "#087948"
                : "#b42318",
              fontWeight: 800,
            }}
          >
            {notice.message}
          </div>
        )}

        {error && (
          <div
            role="alert"
            style={{
              color: "#b42318",
              fontWeight: 700,
            }}
          >
            {error}
          </div>
        )}
      </form>
    </section>
  );
}
// ==================================================
// NEW: 12-HOUR INCOMPLETE CLOSING ALERTS
//
// Reads:
// tl_admin_12h_incident_snapshot_v1
//
// Admin only.
// Read-only.
// Does not write balances or close shifts.
// ==================================================

function AdminClosingAlertsPanel({
  user,
  setActiveSection,
  compact = false,
}) {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const accessToken =
    user?.access_token || null;

  const [incidents, setIncidents] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [lastUpdated, setLastUpdated] =
    useState(null);

  const [refreshKey, setRefreshKey] =
    useState(0);

  const baseUrl = useMemo(
    () =>
      String(supabaseUrl || "").replace(
        /\/+$/,
        ""
      ),
    [supabaseUrl]
  );

  const loadIncidents = useCallback(
    async (signal) => {
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
        `${baseUrl}/rest/v1/rpc/tl_admin_12h_incident_snapshot_v1`,
        {
          method: "POST",
          headers: {
            apikey: supabaseAnonKey,
            Authorization:
              `Bearer ${accessToken}`,
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({}),
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
          `Unable to load closing alerts (${response.status}).`
        );
      }

      if (
        !body ||
        body.ok !== true ||
        !Array.isArray(body.incidents)
      ) {
        throw new Error(
          "Unexpected closing alerts response."
        );
      }

      return body.incidents;
    },
    [
      baseUrl,
      supabaseAnonKey,
      accessToken,
    ]
  );

  useEffect(() => {
    let mounted = true;

    const controller =
      new AbortController();

    async function refresh() {
      try {
        const rows = await loadIncidents(
          controller.signal
        );

        if (!mounted) return;

        setIncidents(rows);
        setLastUpdated(new Date());
        setError("");
      } catch (err) {
        if (
          !mounted ||
          err?.name === "AbortError"
        ) {
          return;
        }

        setError(
          err?.message ||
          "Unable to load closing alerts."
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    setLoading(true);

    refresh();

    const interval = setInterval(
      refresh,
      45000
    );

    return () => {
      mounted = false;
      controller.abort();
      clearInterval(interval);
    };
  }, [loadIncidents, refreshKey]);

  const displayedIncidents = compact
    ? incidents.slice(0, 3)
    : incidents;

  const totalMissing = incidents.reduce(
    (sum, incident) =>
      sum + Number(
        incident?.missing_count || 0
      ),
    0
  );

  function openCorrections() {
    setActiveSection("CORRECTIONS");
  }

  function openAllAlerts() {
    setActiveSection("CLOSING_ALERTS");
  }

  function refreshNow() {
    setRefreshKey((value) => value + 1);
  }

  return (
    <section style={closingAlertPanelStyle}>
      <div style={closingAlertHeaderStyle}>
        <div>
          <div style={closingAlertTitleStyle}>
            ⚠ 12-HOUR CLOSING ALERTS
          </div>

          <div style={closingAlertSubtitleStyle}>
            Incomplete shift closings awaiting
            Admin verification
          </div>
        </div>

        <div style={closingAlertHeaderActionsStyle}>
          {!loading && !error && (
            <span style={
              incidents.length > 0
                ? closingAlertCountStyle
                : closingAlertClearCountStyle
            }>
              {incidents.length} PENDING
            </span>
          )}

          <button
            type="button"
            onClick={refreshNow}
            disabled={loading}
            style={{
              ...closingRefreshButtonStyle,
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading
              ? "Loading..."
              : "↻ Refresh"}
          </button>
        </div>
      </div>

      {loading && incidents.length === 0 && (
        <div style={closingAlertLoadingStyle}>
          Checking 12-hour closing incidents...
        </div>
      )}

      {error && (
        <div
          role="alert"
          style={closingAlertErrorStyle}
        >
          {error}
        </div>
      )}

      {!loading &&
        !error &&
        incidents.length === 0 && (
          <div style={closingAlertClearStyle}>
            <strong>
              ✓ No pending closing incidents
            </strong>

            <div style={{ marginTop: 6 }}>
              All recorded 12-hour closing
              incidents are currently resolved.
            </div>
          </div>
        )}

      {incidents.length > 0 && (
        <>
          <div style={closingSummaryGridStyle}>
            <div style={closingSummaryItemStyle}>
              <span style={closingSummaryLabelStyle}>
                SHOPS REQUIRING ADMIN
              </span>

              <strong style={
                closingSummaryValueStyle
              }>
                {new Set(
                  incidents.map(
                    (item) => item.shop_id
                  )
                ).size}
              </strong>
            </div>

            <div style={closingSummaryItemStyle}>
              <span style={closingSummaryLabelStyle}>
                PENDING INCIDENTS
              </span>

              <strong style={
                closingSummaryValueStyle
              }>
                {incidents.length}
              </strong>
            </div>

            <div style={closingSummaryItemStyle}>
              <span style={closingSummaryLabelStyle}>
                MISSING READINGS
              </span>

              <strong style={
                closingSummaryValueStyle
              }>
                {totalMissing}
              </strong>
            </div>
          </div>

          <div style={closingAlertListStyle}>
            {displayedIncidents.map(
              (incident) => {
                const platforms =
                  Array.isArray(
                    incident.missing_platforms
                  )
                    ? incident.missing_platforms
                    : [];

                const triedOpening =
                  incident.cashier_tried_opening_today ===
                  true;

                return (
                  <div
                    key={incident.shift_id}
                    style={closingIncidentCardStyle}
                  >
                    <div style={
                      closingIncidentTopStyle
                    }>
                      <div>
                        <div style={
                          closingIncidentShopStyle
                        }>
                          {incident.shop_name ||
                            "Unknown Shop"}
                        </div>

                        <div style={
                          closingIncidentDateStyle
                        }>
                          Business Date:{" "}
                          {incident.business_date ||
                            "—"}
                        </div>
                      </div>

                      <span style={
                        closingPendingBadgeStyle
                      }>
                        PENDING ADMIN
                      </span>
                    </div>

                    <div style={
                      closingIncidentDetailsStyle
                    }>
                      <div>
                        <strong>
                          Missing readings:
                        </strong>{" "}
                        {incident.missing_count ??
                          platforms.length}
                      </div>

                      <div style={{
                        marginTop: 5,
                        overflowWrap: "anywhere",
                      }}>
                        {platforms.length > 0
                          ? platforms.join(" • ")
                          : "No missing platform names supplied"}
                      </div>

                      <div style={{ marginTop: 9 }}>
                        <strong>
                          Financial access:
                        </strong>{" "}
                        <span style={{
                          color: "#b91c1c",
                          fontWeight: 900,
                        }}>
                          LOCKED
                        </span>
                      </div>

                      <div style={{ marginTop: 5 }}>
                        <strong>
                          Balance B/F:
                        </strong>{" "}
                        PENDING VERIFICATION
                      </div>

                      {incident.auto_closed_at ? (
                        <div style={{
                          marginTop: 5,
                          color: "#166534",
                        }}>
                          Automatic closure recorded
                        </div>
                      ) : (
                        <div style={{
                          marginTop: 5,
                          color: "#92400e",
                        }}>
                          Automatic closure not yet
                          recorded
                        </div>
                      )}

                      {triedOpening && (
                        <div style={
                          closingAttemptNoticeStyle
                        }>
                          Cashier attempted a new-day
                          opening while this incident
                          was pending.
                        </div>
                      )}
                    </div>

                    <div style={
                      closingIncidentFooterStyle
                    }>
                      <span style={{
                        color: "#64748b",
                        fontSize: 10,
                      }}>
                        Admin Recovery required
                      </span>

                      <button
                        type="button"
                        onClick={openCorrections}
                        style={closingCorrectionButtonStyle}
                      >
                        Open Shift Corrections
                      </button>
                    </div>
                  </div>
                );
              }
            )}
          </div>

          {compact && incidents.length > 3 && (
            <button
              type="button"
              onClick={openAllAlerts}
              style={closingViewAllButtonStyle}
            >
              View All {incidents.length} Closing Alerts →
            </button>
          )}
        </>
      )}

      {lastUpdated && (
        <div style={closingLastUpdatedStyle}>
          Updated:{" "}
          {lastUpdated.toLocaleTimeString(
            "en-KE",
            {
              timeZone: "Africa/Nairobi",
              hour: "2-digit",
              minute: "2-digit",
            }
          )}
          {" "}EAT
        </div>
      )}
    </section>
  );
}

// ==================================================
// MASTER EMPLOYEES - AGREED EDITABLE LIST
//
// Employee name
// Shop / Category
// Weekly salary
// Permanent unique employee ID
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
    employment_status:
      employee.employment_status,
  };
}

function sameSalary(a, b) {
  if (
    String(a).trim() === "" ||
    String(b).trim() === ""
  ) {
    return (
      String(a).trim() ===
      String(b).trim()
    );
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
  const [employees, setEmployees] =
    useState([]);

  const [drafts, setDrafts] =
    useState([]);

  const [shops, setShops] =
    useState([]);

  const [reason, setReason] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [notice, setNotice] =
    useState("");

  const [reload, setReload] =
    useState(0);

  const baseUrl = useMemo(
    () =>
      String(supabaseUrl || "").replace(
        /\/+$/,
        ""
      ),
    [supabaseUrl]
  );

  const rpc = useCallback(
    async (
      functionName,
      payload = {},
      signal
    ) => {
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
            "Content-Type":
              "application/json",
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

  useEffect(() => {
    const controller =
      new AbortController();

    let mounted = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const [
          people,
          shopOptions,
        ] = await Promise.all([
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

        const current =
          people.map(toMasterDraft);

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

  const originals = useMemo(
    () =>
      new Map(
        employees.map((employee) => [
          employee.employee_id,
          employee,
        ])
      ),
    [employees]
  );

  const pending = useMemo(
    () =>
      drafts.filter((employee) =>
        masterRowChanged(
          employee,
          originals.get(
            employee.employee_id
          )
        )
      ),
    [drafts, originals]
  );

  function updateDraft(key, field, value) {
    setDrafts((current) =>
      current.map((row) =>
        row.key === key
          ? {
              ...row,
              [field]: value,
            }
          : row
      )
    );

    setError("");
    setNotice("");
  }

  function addEmployee() {
    setDrafts((current) => [
      ...current,
      {
        key:
          `new-${Date.now()}-${Math.random()}`,
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

  function discardNew(key) {
    setDrafts((current) =>
      current.filter(
        (row) => row.key !== key
      )
    );

    setNotice("");
  }

  async function saveChanges() {
    if (
      !pending.length ||
      loading ||
      saving
    ) {
      return;
    }

    const sharedReason =
      reason.trim();

    if (sharedReason.length < 3) {
      setError(
        "Enter one reason for the changes at the bottom before saving."
      );

      return;
    }

    for (const entry of pending) {
      if (
        entry.employment_status !==
        "ACTIVE"
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
            entry.full_name ||
            "the new employee"
          }.`
        );

        return;
      }

      const amount =
        String(
          entry.weekly_salary
        ).trim();

      if (
        !/^\d+(\.\d{1,2})?$/.test(
          amount
        ) ||
        Number(amount) > 1000000000
      ) {
        setError(
          `Enter a valid weekly salary (KES) for ${entry.full_name}.`
        );
        return;
      }
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const result = await rpc(
        "tl_admin_master_employee_save_v1",
        {
          p_reason: sharedReason,

          p_changes: pending.map(
            (row) => ({
              employee_id:
                row.employee_id,
              full_name:
                row.full_name,
              shop_choice:
                row.shop_choice,
              weekly_salary:
                Number(
                  row.weekly_salary
                ),
            })
          ),
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
        `${result.edited || 0} employee(s) edited. ` +
        "Changes saved."
      );

      setReload(
        (value) => value + 1
      );
    } catch (err) {
      setError(
        err?.message ||
        "Unable to save employee changes."
      );
    } finally {
      setSaving(false);
    }
  }

  const hasPending =
    pending.length > 0;

  return (
    <section style={masterPanelStyle}>
      <div style={masterPanelHeaderStyle}>
        <strong
          style={{
            fontSize: 17,
            fontWeight: 900,
          }}
        >
          MASTER EMPLOYEES
        </strong>

        <div style={masterTotalWrapStyle}>
          <span style={masterTotalCountStyle}>
            {employees.length}
          </span>

          <strong style={masterTotalLabelStyle}>
            TOTAL EMPLOYEES
          </strong>
        </div>
      </div>

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
          <div style={masterTableContainerStyle}>
            <table style={masterTableStyle}>
              <thead>
                <tr>
                  <th
                    style={{
                      ...masterThStyle,
                      width: 68,
                      textAlign: "center",
                    }}
                  >
                    NO.
                  </th>

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
                {drafts.map(
                  (row, index) => {
                    const isNew =
                      !row.employee_id;

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
                      row.employment_status !==
                        "ACTIVE";

                    return (
                      <tr
                        key={row.key}
                        style={{
                          background:
                            changed
                              ? "#f0f9ff"
                              : "white",
                        }}
                      >
                        <td
                          style={{
                            ...masterTdStyle,
                            width: 68,
                            textAlign:
                              "center",
                          }}
                        >
                          <span style={
                            masterNumberBadgeStyle
                          }>
                            {index + 1}
                          </span>
                        </td>

                        <td style={masterTdStyle}>
                          <input
                            type="text"
                            aria-label="Employee name"
                            style={masterInputStyle}
                            value={row.full_name}
                            onChange={(event) =>
                              updateDraft(
                                row.key,
                                "full_name",
                                event.target.value
                              )
                            }
                            disabled={readOnly}
                            placeholder="Employee full name"
                          />
                        </td>

                        <td style={masterTdStyle}>
                          <select
                            aria-label="Shop or category"
                            style={masterInputStyle}
                            value={row.shop_choice}
                            disabled={readOnly}
                            onChange={(event) =>
                              updateDraft(
                                row.key,
                                "shop_choice",
                                event.target.value
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

                        <td style={masterTdStyle}>
                          <input
                            type="number"
                            aria-label="Weekly salary in Kenya shillings"
                            style={masterInputStyle}
                            min="0"
                            max="1000000000"
                            step="0.01"
                            value={row.weekly_salary}
                            onChange={(event) =>
                              updateDraft(
                                row.key,
                                "weekly_salary",
                                event.target.value
                              )
                            }
                            disabled={readOnly}
                            placeholder="KES"
                          />
                        </td>

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
                                background:
                                  "#f1f5f9",
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
                  }
                )}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            style={masterAddButtonStyle}
            onClick={addEmployee}
            disabled={saving}
          >
            + Add Employee
          </button>

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
              onChange={(event) => {
                setReason(
                  event.target.value
                );
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
              disabled={
                !hasPending || saving
              }
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
  user,
  adminName,
  setActiveSection,
}) {
  const cards = [
    [
      "CLOSING ALERTS",
      "Monitor 12-hour shops with incomplete closing readings and pending Admin Recovery.",
      "#b91c1c",
      "View Closing Alerts",
      "CLOSING_ALERTS",
    ],
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
      "FINANCIAL PERFORMANCE",
      "Rank individual Banking, shop platform performance, and company float balances.",
      "#b38b36",
      "Open Financial Performance",
      "FINANCIAL_PERFORMANCE",
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
      "MEALS / BONUS",
      "Set Lunch, Supper, Monday and Friday bonuses for each Master Employee.",
      "#b45309",
      "Manage Meals / Bonus",
      "MEALS_BONUS",
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

      {/* NEW: LIVE 12-HOUR CLOSING ALERTS */}

      <div style={{
        marginBottom: 18,
      }}>
        <AdminClosingAlertsPanel
          user={user}
          setActiveSection={setActiveSection}
          compact
        />
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
// SHARED ADMIN COMPONENTS
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
        borderTop:
          `5px solid ${accent}`,
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

        <div style={
          dashboardCardDescriptionStyle
        }>
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
          value={
            user?.role ||
            "ADMIN"
          }
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
          Additional settings will be
          connected here as the system
          expands. Existing sales,
          Accountant, Savings, Banking,
          M-Pesa rate and correction
          functions are unaffected.
        </div>
      </div>

      <AdminShopManagementPanel
        user={user}
      />

      <AdminUserAccountsPanel
        user={user}
      />
    </>
  );
}

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
// EXISTING ADMIN STYLES — RETAINED
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
  background:
    "linear-gradient(90deg,#052d4b,#064b6b)",
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
  minHeight:
    "calc(100vh - 68px)",
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
  justifyContent: "flex-start",
  flexWrap: "wrap",
  gap: 20,
};

const masterTotalWrapStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  gap: 10,
};

const masterTotalCountStyle = {
  width: 60,
  height: 60,
  borderRadius: "50%",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  background: "#ffffff",
  color: "#073b5c",
  fontSize: 23,
  fontWeight: 950,
  border: "3px solid #67e8f9",
  boxShadow:
    "0 2px 10px rgba(0,0,0,.15)",
};

const masterTotalLabelStyle = {
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: ".4px",
  color: "#ffffff",
};

const masterNumberBadgeStyle = {
  width: 34,
  height: 34,
  borderRadius: "50%",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  background: "#073b5c",
  border: "2px solid #06b6d4",
  color: "#ffffff",
  fontWeight: 900,
  fontSize: 13,
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
  borderTop:
    "1px solid #e2e8f0",
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

// ==================================================
// NEW: CLOSING ALERT STYLES
// ==================================================

const closingAlertPanelStyle = {
  background: "#ffffff",
  border: "1px solid #fecaca",
  borderRadius: 9,
  overflow: "hidden",
  boxShadow:
    "0 2px 8px rgba(15,23,42,0.05)",
};

const closingAlertHeaderStyle = {
  background:
    "linear-gradient(90deg,#7f1d1d,#b91c1c)",
  color: "#ffffff",
  padding: "14px 17px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 14,
  flexWrap: "wrap",
};

const closingAlertTitleStyle = {
  fontWeight: 900,
  fontSize: 15,
  letterSpacing: ".3px",
};

const closingAlertSubtitleStyle = {
  color: "#fee2e2",
  fontSize: 10,
  marginTop: 5,
  lineHeight: 1.4,
};

const closingAlertHeaderActionsStyle = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  flexWrap: "wrap",
};

const closingAlertCountStyle = {
  padding: "6px 10px",
  background: "#ffffff",
  color: "#991b1b",
  borderRadius: 20,
  fontWeight: 900,
  fontSize: 11,
};

const closingAlertClearCountStyle = {
  padding: "6px 10px",
  background: "#dcfce7",
  color: "#166534",
  borderRadius: 20,
  fontWeight: 900,
  fontSize: 11,
};

const closingRefreshButtonStyle = {
  padding: "8px 12px",
  background: "rgba(255,255,255,0.12)",
  color: "#ffffff",
  border: "1px solid rgba(255,255,255,0.5)",
  borderRadius: 6,
  fontSize: 11,
  fontWeight: 800,
  cursor: "pointer",
};

const closingAlertLoadingStyle = {
  padding: 18,
  fontSize: 12,
  color: "#64748b",
};

const closingAlertErrorStyle = {
  padding: 13,
  background: "#fef2f2",
  color: "#991b1b",
  borderBottom: "1px solid #fecaca",
  fontSize: 12,
  fontWeight: 700,
};

const closingAlertClearStyle = {
  margin: 14,
  padding: 15,
  background: "#f0fdf4",
  border: "1px solid #bbf7d0",
  color: "#166534",
  borderRadius: 7,
  fontSize: 12,
};

const closingSummaryGridStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(145px,1fr))",
  gap: 10,
  padding: 14,
  background: "#fff7f7",
  borderBottom: "1px solid #fee2e2",
};

const closingSummaryItemStyle = {
  padding: 11,
  border: "1px solid #fecaca",
  borderRadius: 7,
  background: "#ffffff",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 5,
};

const closingSummaryLabelStyle = {
  color: "#7f1d1d",
  fontWeight: 800,
  fontSize: 9,
  letterSpacing: ".3px",
};

const closingSummaryValueStyle = {
  color: "#991b1b",
  fontWeight: 950,
  fontSize: 25,
};

const closingAlertListStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(260px,1fr))",
  gap: 12,
  padding: 14,
};

const closingIncidentCardStyle = {
  padding: 13,
  border: "1px solid #fecaca",
  background: "#ffffff",
  borderRadius: 8,
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const closingIncidentTopStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 10,
  flexWrap: "wrap",
};

const closingIncidentShopStyle = {
  fontSize: 14,
  fontWeight: 900,
  color: "#0f172a",
};

const closingIncidentDateStyle = {
  marginTop: 5,
  fontSize: 10,
  color: "#64748b",
};

const closingPendingBadgeStyle = {
  padding: "5px 8px",
  borderRadius: 5,
  background: "#fee2e2",
  color: "#991b1b",
  fontWeight: 900,
  fontSize: 9,
  whiteSpace: "nowrap",
};

const closingIncidentDetailsStyle = {
  fontSize: 11,
  color: "#334155",
  lineHeight: 1.5,
};

const closingAttemptNoticeStyle = {
  marginTop: 9,
  padding: "8px 10px",
  borderRadius: 5,
  background: "#fffbeb",
  border: "1px solid #fde68a",
  color: "#92400e",
  fontSize: 10,
  fontWeight: 700,
};

const closingIncidentFooterStyle = {
  borderTop: "1px solid #e2e8f0",
  paddingTop: 11,
  marginTop: "auto",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: 9,
};

const closingCorrectionButtonStyle = {
  padding: "9px 12px",
  color: "#ffffff",
  background: "#073b5c",
  border: "none",
  borderRadius: 6,
  fontSize: 10,
  fontWeight: 850,
  cursor: "pointer",
};

const closingViewAllButtonStyle = {
  display: "block",
  width: "calc(100% - 28px)",
  margin: "0 14px 14px",
  padding: 12,
  border: "1px solid #b91c1c",
  background: "#fff7f7",
  color: "#991b1b",
  borderRadius: 7,
  fontSize: 11,
  fontWeight: 900,
  cursor: "pointer",
};

const closingLastUpdatedStyle = {
  padding: "9px 14px",
  background: "#f8fafc",
  color: "#64748b",
  borderTop: "1px solid #e2e8f0",
  textAlign: "right",
  fontSize: 10,
};
