"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import AdminAccountsPanel from "./AdminAccountsPanel";
import AdminShiftOverridePanel from "./AdminShiftOverridePanel";
import AdminShiftCorrectionsPanel from "./AdminShiftCorrectionsPanel";
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
export default function AdminDashboard({
  user,  
}) {
  const supabaseUrl = 
process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = 
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const accessToken = user?.access_token 
    || null;
  
  const router = useRouter();

  const [
    activeSection,
    setActiveSection,
  ] = useState("DASHBOARD");

  const adminName =
    user?.full_name ||
    user?.name ||
    user?.username ||
    "Team Legend Admin";

  // ==================================================
  // LOGOUT
  // ==================================================

  function logout() {
    sessionStorage.removeItem(
      "teamLegendUser"
    );

    router.replace("/");
  }

  // ==================================================
  // MENU
  // ==================================================

  const menuItems = [
    {
      id: "DASHBOARD",
      label: "Dashboard",
      icon: "▦",
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
  id: "DUTY_ROTA",
  label: "Duty / Rota",
  icon: "📅",
    },
    {
  id: "LIVE_FEED",
  label: "Live Feed",
  icon: "●",
    },
    {
  id: "ATTENDANCE_CONTROL",
  label: "Attendance Control",
  icon: "✓",
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

  return (
    <main style={pageStyle}>
      {/* ========================================= */}
      {/* TOP HEADER */}
      {/* ========================================= */}

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
            <small>
              WELCOME
            </small>

            <strong>
              {adminName}
            </strong>
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

      {/* ========================================= */}
      {/* BODY */}
      {/* ========================================= */}

      <div style={bodyLayoutStyle}>
        {/* ======================================= */}
        {/* LEFT NAVIGATION */}
        {/* ======================================= */}

        <aside style={sidebarStyle}>
          <div style={menuTitleStyle}>
            ADMIN MENU
          </div>

          {menuItems.map(
            (item) => {
              const active =
                activeSection ===
                item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    setActiveSection(
                      item.id
                    )
                  }
                  style={{
                    ...menuButtonStyle,

                    ...(active
                      ? activeMenuButtonStyle
                      : {}),
                  }}
                >
                  <span
                    style={
                      menuIconStyle
                    }
                  >
                    {item.icon}
                  </span>

                  <span>
                    {item.label}
                  </span>
                </button>
              );
            }
          )}

          <div style={sidebarFooterStyle}>
            <div>
              Signed in as
            </div>

            <strong>
              ADMIN
            </strong>
          </div>
        </aside>

        {/* ======================================= */}
        {/* MAIN CONTENT */}
        {/* ======================================= */}

        <section style={contentStyle}>
          {/* ===================================== */}
          {/* DASHBOARD */}
          {/* ===================================== */}

          {activeSection ===
            "DASHBOARD" && (
            <DashboardHome
              adminName={
                adminName
              }
              setActiveSection={
                setActiveSection
              }
            />
          )}

          {/* ===================================== */}
          {/* VIEW REPORTS */}
          {/* ===================================== */}

          {activeSection ===
            "REPORTS" && (
            <>
              <PageHeading
                title="View Reports"
                subtitle="View current and historical shop sales reports."
              />

              <AdminReportsPanel
                user={user}
              />
            </>
          )}

          {/* ===================================== */}
          {/* SHIFT CORRECTIONS */}
          {/* ===================================== */}

          {activeSection ===
            "CORRECTIONS" && (
            <>
              <PageHeading
                title="Shift Corrections"
                subtitle="Admin control of shop shifts, platform readings, expenses, savings, overrides and audit history."
              />

              <AdminShiftOverridePanel
                user={user}
              />

              <AdminShiftCorrectionsPanel
                user={user}
              />
            </>
          )}

          {/* ===================================== */}
          {/* ACCOUNTS */}
          {/* ===================================== */}

          {activeSection ===
            "ACCOUNTS" && (
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

          {/* ===================================== */}
          {/* SAVINGS / BANKING */}
          {/* ===================================== */}

          {activeSection ===
            "SAVINGS_BANKING" && (
            <>
              <PageHeading
                title="Savings / Banking"
                subtitle="Live Savings balances, payment activity, Accountant confirmations and permanent ledger audit."
              />

              <AdminSavingsPanel
  user={user}
/>

</>
          )}
           {/* ====================================================== */}
{/* DUTY / ROTA */}
{/* ====================================================== */}

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
{/* ====================================================== */}
{/* LIVE FEED */}
{/* ====================================================== */}

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
{/* ====================================================== */}
{/* ATTENDANCE CONTROL */}
{/* ====================================================== */}

{activeSection === "ATTENDANCE_CONTROL" && (
  <>
    <PageHeading
      title="Attendance Control"
      subtitle="Monitor employee attendance, 24-hour shop exemptions, and grant or revoke Lunch and Supper."
    />

    <AdminAttendanceControlPanel
      user={user}
    />
  </>
)}
          {/* ===================================== */}
          {/* EMPLOYEE SALARY */}
          {/* ===================================== */}

          {activeSection ===
            "SALARY" && (
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

          {/* ===================================== */}
          {/* ACCOUNTANT CONTROL */}
          {/* ===================================== */}

          {activeSection ===
            "ACCOUNTANT" && (
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

          {/* ===================================== */}
          {/* M-PESA RATES */}
          {/* ===================================== */}

          {activeSection ===
            "MPESA_RATES" && (
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

          {/* ===================================== */}
          {/* SETTINGS */}
          {/* ===================================== */}

          {activeSection ===
            "SETTINGS" && (
            <SettingsPanel
              user={user}
            />
          )}
        </section>
      </div>
    </main>
  );
}

// ==================================================
// DASHBOARD HOME
// ==================================================

function DashboardHome({
  adminName,
  setActiveSection,
}) {
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
        <DashboardCard
          title="VIEW REPORTS"
          description="View OPEN and CLOSED sales reports by shop, date and shift."
          accent="#0891b2"
          buttonText="Open Reports"
          onClick={() =>
            setActiveSection(
              "REPORTS"
            )
          }
        />

        <DashboardCard
          title="SHIFT CORRECTIONS"
          description="Correct Balance B/F, platform readings, expenses, savings and protected shift figures."
          accent="#7c3aed"
          buttonText="Open Corrections"
          onClick={() =>
            setActiveSection(
              "CORRECTIONS"
            )
          }
        />

        <DashboardCard
          title="ACCOUNTS"
          description="Manage Rent, WIFI, DSTV, Electricity and Banking payment information for each shop."
          accent="#15803d"
          buttonText="Manage Accounts"
          onClick={() =>
            setActiveSection(
              "ACCOUNTS"
            )
          }
        />

        <DashboardCard
          title="SAVINGS / BANKING"
          description="Monitor live shop Savings, Banking balances, pending payments, confirmed payments, rejected requests and ledger history."
          accent="#0f766e"
          buttonText="Open Savings Control"
          onClick={() =>
            setActiveSection(
              "SAVINGS_BANKING"
            )
          }
        />
         <DashboardCard
          title="LIVE FEED"
          description="Post and manage shared messages shown to all cashiers in the moving Live Feed ticker."
          accent="#111C30"
          buttonText="Open Live Feed"
          onClick={() =>
            setActiveSection(
             "LIVE_FEED"
            )
           }
         />
         <DashboardCard
          title="ATTENDANCE CONTROL"
          description="Monitor employee sign-in, 24-hour exemptions, and grant or revoke Lunch and Supper with a permanent audit trail."
          accent="#b45309"
          buttonText="Open Attendance Control"
          onClick={() =>
          setActiveSection(
         "ATTENDANCE_CONTROL"
           )
          }
         />
        <DashboardCard
          title="EMPLOYEE SALARY"
          description="Manage employee salaries, 4-digit Salary PINs, advances, deductions and salary access."
          accent="#4f46e5"
          buttonText="Manage Salaries"
          onClick={() =>
            setActiveSection(
              "SALARY"
            )
          }
        />

        <DashboardCard
          title="ACCOUNTANT CONTROL"
          description="View Legend Accounts daily report, accountant expenses, cashier returns, float transfers and transaction records."
          accent="#0f766e"
          buttonText="Open Accountant"
          onClick={() =>
            setActiveSection(
              "ACCOUNTANT"
            )
          }
        />

        <DashboardCard
          title="M-PESA RATES"
          description="Manage Safaricom transaction-fee bands and test fees when tariffs change."
          accent="#059669"
          buttonText="Manage M-Pesa Rates"
          onClick={() =>
            setActiveSection(
              "MPESA_RATES"
            )
          }
        />

        <DashboardCard
          title="SETTINGS"
          description="Manage shops, user accounts and system configuration."
          accent="#475569"
          buttonText="Open Settings"
          onClick={() =>
            setActiveSection(
              "SETTINGS"
            )
          }
        />
      </div>

      <div style={systemStatusStyle}>
        <div style={systemStatusTitleStyle}>
          ADMIN CONTROL SYSTEM
        </div>

        <div style={statusGridStyle}>
          <StatusItem
            label="Shift Override"
            status="ACTIVE"
          />
           <StatusItem
           label="Attendance / Meal Control"
           status="ACTIVE"
          />
          <StatusItem
            label="Admin Corrections"
            status="ACTIVE"
          />
           <StatusItem
             label="Shared Live Feed"
             status="ACTIVE"
          />
          <StatusItem
            label="Audit History"
            status="ACTIVE"
          />

          <StatusItem
            label="Carry-Forward Protection"
            status="ACTIVE"
          />

          <StatusItem
            label="View Reports"
            status="ACTIVE"
          />

          <StatusItem
            label="Accounts Management"
            status="ACTIVE"
          />

          <StatusItem
            label="Savings / Banking Monitoring"
            status="ACTIVE"
          />

          <StatusItem
            label="Savings Ledger Audit"
            status="ACTIVE"
          />

          <StatusItem
            label="Salary Management"
            status="ACTIVE"
          />

          <StatusItem
            label="Salary PIN Protection"
            status="ACTIVE"
          />

          <StatusItem
            label="Accountant Monitoring"
            status="ACTIVE"
          />

          <StatusItem
            label="Cashier Return Tracking"
            status="ACTIVE"
          />

          <StatusItem
            label="M-Pesa Rate Control"
            status="ACTIVE"
          />

          <StatusItem
            label="M-Pesa Fee Testing"
            status="ACTIVE"
          />
        </div>
      </div>

      <div style={noticeStyle}>
        Admin can monitor Legend Accounts activity, Savings and Banking
        balances, manage Safaricom M-Pesa fee bands, review accountant
        expenses, cashier returns, transaction records and protected
        shop corrections.
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

        borderTop:
          `5px solid ${accent}`,
      }}
    >
      <div>
        <div
          style={{
            ...dashboardCardTitleStyle,

            color:
              accent,
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

          backgroundColor:
            accent,
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
      <span>
        {label}
      </span>

      <strong style={activeStatusStyle}>
        {status} ✓
      </strong>
    </div>
  );
}

// ==================================================
// SETTINGS
// ==================================================

function SettingsPanel({
  user,
}) {
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
          Additional settings will be connected here as the
          system expands. Existing sales, Accountant, Savings,
          Banking, M-Pesa rate and correction functions are unaffected.
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

// ==================================================
// SETTING ROW
// ==================================================

function SettingRow({
  label,
  value,
}) {
  return (
    <div style={settingRowStyle}>
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}

// ==================================================
// STYLES
// ==================================================

const pageStyle = {
  minHeight:
    "100vh",

  backgroundColor:
    "#eef2f7",

  fontFamily:
    "Arial, sans-serif",

  color:
    "#0f172a",
};

const headerStyle = {
  minHeight:
    "68px",

  padding:
    "10px 22px",

  background:
    "linear-gradient(90deg,#052d4b,#064b6b)",

  color:
    "white",

  display:
    "flex",

  justifyContent:
    "space-between",

  alignItems:
    "center",

  boxSizing:
    "border-box",
};

const brandStyle = {
  fontSize:
    "22px",

  fontWeight:
    "900",

  letterSpacing:
    "0.5px",
};

const sloganStyle = {
  marginTop:
    "4px",

  fontSize:
    "9px",

  letterSpacing:
    "2.5px",

  color:
    "#cbd5e1",
};

const headerRightStyle = {
  display:
    "flex",

  alignItems:
    "center",

  gap:
    "18px",
};

const welcomeStyle = {
  display:
    "flex",

  flexDirection:
    "column",

  alignItems:
    "flex-end",

  gap:
    "2px",

  fontSize:
    "11px",
};

const logoutButtonStyle = {
  padding:
    "8px 14px",

  border:
    "none",

  borderRadius:
    "5px",

  backgroundColor:
    "#e11d48",

  color:
    "white",

  fontWeight:
    "bold",

  cursor:
    "pointer",
};

const bodyLayoutStyle = {
  display:
    "flex",

  minHeight:
    "calc(100vh - 68px)",
};

const sidebarStyle = {
  width:
    "210px",

  flexShrink:
    0,

  backgroundColor:
    "#073b5c",

  padding:
    "16px 10px",

  boxSizing:
    "border-box",

  display:
    "flex",

  flexDirection:
    "column",
};

const menuTitleStyle = {
  padding:
    "8px 10px 14px",

  color:
    "#94a3b8",

  fontSize:
    "9px",

  fontWeight:
    "bold",

  letterSpacing:
    "1px",
};

const menuButtonStyle = {
  width:
    "100%",

  display:
    "flex",

  alignItems:
    "center",

  gap:
    "10px",

  padding:
    "12px 10px",

  marginBottom:
    "5px",

  border:
    "none",

  borderRadius:
    "5px",

  backgroundColor:
    "transparent",

  color:
    "#e2e8f0",

  textAlign:
    "left",

  fontSize:
    "12px",

  fontWeight:
    "bold",

  cursor:
    "pointer",
};

const activeMenuButtonStyle = {
  backgroundColor:
    "#0891b2",

  color:
    "white",
};

const menuIconStyle = {
  width:
    "20px",

  textAlign:
    "center",

  fontSize:
    "16px",
};

const sidebarFooterStyle = {
  marginTop:
    "auto",

  padding:
    "12px 10px",

  borderTop:
    "1px solid rgba(255,255,255,0.15)",

  color:
    "#cbd5e1",

  fontSize:
    "9px",

  display:
    "flex",

  flexDirection:
    "column",

  gap:
    "3px",
};

const contentStyle = {
  flex:
    1,

  minWidth:
    0,

  padding:
    "24px",

  boxSizing:
    "border-box",

  overflowX:
    "auto",
};

const pageHeadingStyle = {
  marginBottom:
    "18px",
};

const pageTitleStyle = {
  margin:
    0,

  fontSize:
    "25px",

  color:
    "#0f172a",
};

const pageSubtitleStyle = {
  margin:
    "5px 0 0",

  color:
    "#64748b",

  fontSize:
    "12px",
};

const welcomeBannerStyle = {
  padding:
    "20px",

  marginBottom:
    "18px",

  borderRadius:
    "8px",

  background:
    "linear-gradient(90deg,#0e7490,#0369a1)",

  color:
    "white",

  display:
    "flex",

  justifyContent:
    "space-between",

  alignItems:
    "center",
};

const welcomeTitleStyle = {
  fontSize:
    "20px",

  fontWeight:
    "900",
};

const welcomeSubtitleStyle = {
  marginTop:
    "5px",

  fontSize:
    "11px",

  letterSpacing:
    "1.5px",
};

const adminBadgeStyle = {
  padding:
    "8px 14px",

  border:
    "1px solid rgba(255,255,255,0.5)",

  borderRadius:
    "20px",

  fontSize:
    "10px",

  fontWeight:
    "bold",
};

const dashboardGridStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "repeat(auto-fit,minmax(220px,1fr))",

  gap:
    "14px",

  marginBottom:
    "18px",
};

const dashboardCardStyle = {
  minHeight:
    "175px",

  padding:
    "18px",

  backgroundColor:
    "white",

  border:
    "1px solid #cbd5e1",

  borderRadius:
    "7px",

  boxShadow:
    "0 2px 8px rgba(15,23,42,0.06)",

  display:
    "flex",

  flexDirection:
    "column",

  justifyContent:
    "space-between",

  gap:
    "18px",
};

const dashboardCardTitleStyle = {
  fontSize:
    "14px",

  fontWeight:
    "900",

  marginBottom:
    "9px",
};

const dashboardCardDescriptionStyle = {
  color:
    "#64748b",

  fontSize:
    "11px",

  lineHeight:
    "1.5",
};

const dashboardCardButtonStyle = {
  width:
    "100%",

  padding:
    "9px",

  border:
    "none",

  borderRadius:
    "5px",

  color:
    "white",

  fontWeight:
    "bold",

  cursor:
    "pointer",

  fontSize:
    "10px",
};

const systemStatusStyle = {
  padding:
    "16px",

  backgroundColor:
    "white",

  border:
    "1px solid #cbd5e1",

  borderRadius:
    "7px",
};

const systemStatusTitleStyle = {
  marginBottom:
    "12px",

  color:
    "#0f172a",

  fontWeight:
    "bold",

  fontSize:
    "12px",
};

const statusGridStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "repeat(auto-fit,minmax(220px,1fr))",

  gap:
    "8px",
};

const statusItemStyle = {
  padding:
    "9px",

  border:
    "1px solid #e2e8f0",

  borderRadius:
    "5px",

  display:
    "flex",

  justifyContent:
    "space-between",

  gap:
    "8px",

  fontSize:
    "10px",
};

const activeStatusStyle = {
  color:
    "#15803d",
};

const noticeStyle = {
  marginTop:
    "12px",

  padding:
    "10px",

  backgroundColor:
    "#ecfeff",

  border:
    "1px solid #a5f3fc",

  borderRadius:
    "5px",

  color:
    "#155e75",

  textAlign:
    "center",

  fontSize:
    "9px",
};

const settingsPanelStyle = {
  maxWidth:
    "750px",

  backgroundColor:
    "white",

  border:
    "1px solid #cbd5e1",

  borderRadius:
    "7px",

  overflow:
    "hidden",

  marginBottom:
    "18px",
};

const settingsTitleStyle = {
  padding:
    "10px 14px",

  backgroundColor:
    "#475569",

  color:
    "white",

  fontWeight:
    "bold",

  fontSize:
    "12px",
};

const settingRowStyle = {
  display:
    "flex",

  justifyContent:
    "space-between",

  gap:
    "20px",

  padding:
    "12px 14px",

  borderTop:
    "1px solid #e2e8f0",

  fontSize:
    "11px",
};

const settingsNoticeStyle = {
  padding:
    "12px",

  backgroundColor:
    "#f8fafc",

  color:
    "#64748b",

  textAlign:
    "center",

  fontSize:
    "9px",
};
