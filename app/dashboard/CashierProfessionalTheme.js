// ============================================================
// TEAM LEGEND
// PROFESSIONAL CASHIER THEME
// MATTE BLACK • GOLD • WHITE
// ============================================================

export const COLORS = {
  page: "#080A0D",
  surface: "#0D1115",
  card: "#11161C",
  cardRaised: "#171C22",
  cardSoft: "#1A2027",

  border: "#292F36",
  borderStrong: "#3A4149",

  text: "#FFFFFF",
  textSoft: "#FFFFFF",
  muted: "#FFFFFF",

  gold: "#D7B36A",
  goldDark: "#72531E",
  goldDeep: "#584018",
  goldSoft: "#F4DDA7",

  blue: "#60A5FA",
  green: "#34D399",
  red: "#F87171",
  amber: "#FBBF24",
};


// ============================================================
// PART 1
// PAGE • HEADER • SIDEBAR • TOP CARDS
// ============================================================

export const pageStyle = {
  minHeight: "100vh",

  background:
    "radial-gradient(circle at 72% -15%, #202832 0%, #11161B 27%, #080A0D 70%)",

  color: "#FFFFFF",

  fontFamily:
    "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",

  fontSize: "15px",

  lineHeight: 1.45,
};


export const loadingStyle = {
  minHeight: "100vh",

  display: "flex",

  justifyContent: "center",

  alignItems: "center",

  background: COLORS.page,

  color: "#FFFFFF",

  fontSize: "19px",

  fontWeight: 800,
};


// ============================================================
// TOP HEADER
// ============================================================

export const topHeaderStyle = {
  position: "relative",

  zIndex: 20,

  background:
    "linear-gradient(90deg, #090C10 0%, #11171D 50%, #090C10 100%)",

  color: "#FFFFFF",

  minHeight: "76px",

  padding: "14px 24px",

  display: "flex",

  justifyContent: "space-between",

  alignItems: "center",

  gap: "20px",

  borderBottom:
    "1px solid rgba(255,255,255,0.10)",

  boxShadow:
    "0 12px 36px rgba(0,0,0,0.28)",
};


export const brandWrapStyle = {
  display: "flex",
  alignItems: "center",
  gap: "14px",
};


export const crownStyle = {
  width: "48px",
  height: "48px",

  display: "flex",
  alignItems: "center",
  justifyContent: "center",

  borderRadius: "13px",

  background:
    "linear-gradient(145deg, rgba(215,179,106,0.20), rgba(215,179,106,0.06))",

  border:
    "1px solid rgba(215,179,106,0.32)",

  color: COLORS.gold,

  fontSize: "30px",

  lineHeight: 1,

  boxShadow:
    "0 8px 22px rgba(0,0,0,0.28)",
};


export const brandStyle = {
  fontSize: "27px",

  fontWeight: 950,

  color: "#FFFFFF",

  letterSpacing: "0.8px",

  lineHeight: 1.05,
};


export const taglineStyle = {
  marginTop: "6px",

  fontSize: "11px",

  fontWeight: 800,

  color: "#FFFFFF",

  letterSpacing: "2.4px",

  textTransform: "uppercase",
};


export const headerRightStyle = {
  display: "flex",

  alignItems: "center",

  gap: "18px",

  textAlign: "right",

  color: "#FFFFFF",

  fontSize: "14px",

  fontWeight: 700,
};


export const headerShopStyle = {
  marginTop: "4px",

  color: "#FFFFFF",

  fontSize: "13px",

  fontWeight: 950,

  letterSpacing: "0.6px",
};


export const logoutButtonStyle = {
  minHeight: "40px",

  padding: "0 17px",

  background:
    "linear-gradient(145deg, #1B2026, #13171C)",

  color: "#FFFFFF",

  border:
    "1px solid #4A535D",

  borderRadius: "10px",

  cursor: "pointer",

  fontSize: "14px",

  fontWeight: 900,

  boxShadow:
    "0 7px 18px rgba(0,0,0,0.22)",
};


// ============================================================
// BODY
// ============================================================

export const bodyStyle = {
  display: "flex",
  alignItems: "stretch",
  width: "100%",
};


// ============================================================
// SIDEBAR
// ============================================================

export const sidebarStyle = {
  width: "225px",

  flexShrink: 0,

  minHeight:
    "calc(100vh - 76px)",

  padding: "12px 0 20px",

  background:
    "linear-gradient(180deg, #0A0D11 0%, #0D1116 55%, #090C10 100%)",

  borderRight:
    "1px solid rgba(255,255,255,0.08)",

  boxShadow:
    "8px 0 28px rgba(0,0,0,0.16)",
};


export function getSidebarItemStyle(active = false) {
  return {
    margin: "6px 10px",

    minHeight: "47px",

    padding: "0 15px",

    display: "flex",

    alignItems: "center",

    gap: "13px",

    color: "#FFFFFF",

    background: active
      ? "linear-gradient(135deg, rgba(215,179,106,0.19), rgba(215,179,106,0.07))"
      : "transparent",

    border: active
      ? "1px solid rgba(215,179,106,0.42)"
      : "1px solid transparent",

    borderRadius: "11px",

    fontSize: "15px",

    fontWeight: active
      ? 900
      : 750,

    cursor: "pointer",
  };
}


export const sidebarIconStyle = {
  width: "25px",

  minWidth: "25px",

  display: "inline-flex",

  justifyContent: "center",

  alignItems: "center",

  fontSize: "18px",

  color: "#FFFFFF",
};


// ============================================================
// MAIN CONTENT
// ============================================================

export const mainStyle = {
  flex: 1,
  minWidth: 0,
  padding: "13px",
  overflow: "hidden",
};


// ============================================================
// TOP GRID
// ============================================================

export const topGridStyle = {
  display: "grid",

  gridTemplateColumns:
    "minmax(210px, 1.6fr) repeat(5, minmax(120px, 1fr))",

  gap: "9px",

  marginBottom: "10px",
};


// ============================================================
// SHOP CARD
// ============================================================

export const shopCardStyle = {
  position: "relative",

  minHeight: "86px",

  padding: "11px 13px",

  display: "flex",

  flexDirection: "column",

  justifyContent: "center",

  alignItems: "center",

  textAlign: "center",

  overflow: "hidden",

  color: "#FFFFFF",

  background:
    "linear-gradient(145deg, rgba(215,179,106,0.19), rgba(20,25,31,0.97))",

  border:
    "1px solid rgba(215,179,106,0.42)",

  borderRadius: "12px",

  boxShadow:
    "0 8px 22px rgba(0,0,0,0.20)",
};


export const shopTitleStyle = {
  color: "#FFFFFF",

  fontSize: "25px",

  fontWeight: 950,

  lineHeight: 1,

  letterSpacing: "0.5px",
};


export const shopSubtitleStyle = {
  marginTop: "7px",

  color: "#FFFFFF",

  fontSize: "14px",

  fontWeight: 900,
};


export const smallTextStyle = {
  marginTop: "7px",

  color: "#FFFFFF",

  fontSize: "12px",

  fontWeight: 750,
};


// ============================================================
// OTHER FIVE TOP CARDS
// SAME STYLE AS NYIKA01
// ============================================================

export function getInfoCardStyle() {
  return {
    position: "relative",

    minHeight: "86px",

    padding: "11px 10px",

    display: "flex",

    flexDirection: "column",

    justifyContent: "center",

    alignItems: "center",

    textAlign: "center",

    overflow: "hidden",

    color: "#FFFFFF",

    background:
      "linear-gradient(145deg, rgba(215,179,106,0.19), rgba(20,25,31,0.97))",

    border:
      "1px solid rgba(215,179,106,0.42)",

    borderRadius: "12px",

    boxShadow:
      "0 8px 22px rgba(0,0,0,0.20)",
  };
}


export const infoTitleStyle = {
  color: "#FFFFFF",

  fontSize: "12px",

  fontWeight: 900,

  letterSpacing: "0.75px",

  textTransform: "uppercase",
};


export const infoValueStyle = {
  marginTop: "8px",

  color: "#FFFFFF",

  fontSize: "19px",

  fontWeight: 950,

  lineHeight: 1.1,
};


export const infoSubvalueStyle = {
  marginTop: "6px",

  color: "#FFFFFF",

  fontSize: "12px",

  fontWeight: 750,
};


export function getInfoCardAccentStyle() {
  return {
    position: "absolute",

    left: "14px",

    right: "14px",

    bottom: 0,

    height: "3px",

    borderRadius:
      "3px 3px 0 0",

    background:
      COLORS.gold,

    opacity: 0.9,
  };
}
// ============================================================
// PART 2
// REPORT PANELS
// BLACK + WHITE
// GOLD ONLY FOR SELECTED FINANCIAL / ACTION AREAS
// ============================================================


// ============================================================
// MAIN REPORT PANEL
// ============================================================

export const panelStyle = {
  background:
    "linear-gradient(180deg, #101419 0%, #0B0F13 100%)",

  color: "#FFFFFF",

  borderRadius: "15px",

  overflow: "hidden",

  border:
    "1px solid #303840",

  boxShadow:
    "0 12px 30px rgba(0,0,0,0.20)",
};


// ============================================================
// INCOME / PLATFORM / EXPENSE HEADERS
// BLACK + WHITE + SMALL GOLD EDGE
// ============================================================

export function getPanelTitleStyle() {
  return {
    position: "relative",

    padding: "13px 15px",

    background:
      "linear-gradient(145deg, #11161C, #0B0F13)",

    color: "#FFFFFF",

    fontSize: "15px",

    fontWeight: 950,

    letterSpacing: "0.5px",

    borderBottom:
      "1px solid #343B43",

    borderLeft:
      `4px solid ${COLORS.gold}`,
  };
}


// ============================================================
// TABLE HEADER
// ============================================================

export const tableHeaderStyle = {
  display: "grid",

  gridTemplateColumns:
    "1.6fr 1fr",

  padding: "11px 13px",

  backgroundColor:
    "#11161C",

  color: "#FFFFFF",

  fontSize: "13px",

  fontWeight: 900,

  letterSpacing: "0.45px",

  borderBottom:
    "1px solid #343B43",
};


// ============================================================
// INCOME ROWS
// ============================================================

export const incomeRowStyle = {
  display: "grid",

  gridTemplateColumns:
    "1.6fr 1fr",

  gap: "10px",

  padding: "8px 12px",

  alignItems: "center",

  minHeight: "44px",

  backgroundColor:
    "#0D1115",

  color: "#FFFFFF",

  fontSize: "14px",

  fontWeight: 700,

  borderBottom:
    "1px solid #252B31",
};


export const amountBoxStyle = {
  padding: "9px 10px",

  border:
    "1px solid #3B434C",

  background:
    "#080B0E",

  color:
    "#FFFFFF",

  borderRadius:
    "8px",

  textAlign:
    "right",

  fontSize:
    "14px",

  fontWeight:
    850,
};


// ============================================================
// INPUTS
// ============================================================

export const moneyInputStyle = {
  width: "100%",

  boxSizing:
    "border-box",

  minHeight:
    "40px",

  padding:
    "9px 10px",

  border:
    "1px solid #454E58",

  backgroundColor:
    "#080B0E",

  color:
    "#FFFFFF",

  borderRadius:
    "8px",

  textAlign:
    "right",

  fontSize:
    "14px",

  fontWeight:
    800,

  outline:
    "none",
};


// ============================================================
// SAVED / LOCKED VALUES
// NOW BLACK + WHITE
// ============================================================

export const savedMoneyStyle = {
  padding:
    "9px 10px",

  border:
    "1px solid #454E58",

  backgroundColor:
    "#080B0E",

  color:
    "#FFFFFF",

  borderRadius:
    "8px",

  textAlign:
    "right",

  fontSize:
    "14px",

  fontWeight:
    850,
};


export const lockedMoneyStyle = {
  padding:
    "9px 10px",

  border:
    "1px solid #454E58",

  backgroundColor:
    "#080B0E",

  color:
    "#FFFFFF",

  borderRadius:
    "8px",

  textAlign:
    "right",

  fontSize:
    "14px",

  fontWeight:
    850,
};


export const missingReadingStyle = {
  padding:
    "9px 10px",

  border:
    "1px solid #4A535D",

  backgroundColor:
    "#0D1115",

  color:
    "#FFFFFF",

  borderRadius:
    "8px",

  textAlign:
    "center",

  fontSize:
    "13px",

  fontWeight:
    900,
};


export const savedInlineStyle = {
  color: "#FFFFFF",

  fontWeight: 950,

  fontSize: "14px",
};


export const readOnlyInlineStyle = {
  color: "#FFFFFF",

  fontWeight: 950,

  fontSize: "14px",
};


// ============================================================
// TOTAL ADDED
// GOLD
// ============================================================

export const incomeTotalStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  padding: "13px 14px",

  background:
    "linear-gradient(145deg, #11161C, #0B0F13)",

  color: "#FFFFFF",

  borderTop: "1px solid #343B43",
  borderBottom: "1px solid #343B43",

  fontSize: "16px",
  fontWeight: 950,
  fontVariantNumeric: "tabular-nums",
};

// ============================================================
// NOTICES
// BLACK + WHITE
// ============================================================

export const companyFloatNoticeStyle = {
  margin:
    "10px",

  padding:
    "11px 12px",

  backgroundColor:
    "#0D1115",

  color:
    "#FFFFFF",

  border:
    "1px solid #3D4650",

  borderRadius:
    "9px",

  textAlign:
    "center",

  fontSize:
    "12px",

  fontWeight:
    750,

  lineHeight:
    1.5,
};


export const automaticExpenseNoticeStyle = {
  margin:
    "10px",

  padding:
    "11px 12px",

  backgroundColor:
    "#0D1115",

  color:
    "#FFFFFF",

  border:
    "1px solid #3D4650",

  borderRadius:
    "9px",

  textAlign:
    "center",

  fontSize:
    "12px",

  fontWeight:
    750,

  lineHeight:
    1.5,
};


export const panelButtonWrapStyle = {
  padding:
    "10px",
};


// ============================================================
// PLATFORM SALES
// ============================================================

export const platformStatusStyle = {
  display: "flex",

  justifyContent:
    "space-between",

  alignItems:
    "center",

  gap:
    "10px",

  minHeight:
    "40px",

  padding:
    "8px 11px",

  backgroundColor:
    "#0D1115",

  color:
    "#FFFFFF",

  fontSize:
    "13px",

  fontWeight:
    700,

  borderBottom:
    "1px solid #252B31",
};


export const platformHeaderStyle = {
  display:
    "grid",

  padding:
    "10px",

  textAlign:
    "center",

  backgroundColor:
    "#11161C",

  color:
    "#FFFFFF",

  fontSize:
    "13px",

  fontWeight:
    900,

  borderBottom:
    "1px solid #343B43",
};


export const platformRowStyle = {
  display:
    "grid",

  gap:
    "8px",

  padding:
    "8px 10px",

  minHeight:
    "44px",

  alignItems:
    "center",

  backgroundColor:
    "#0D1115",

  color:
    "#FFFFFF",

  fontSize:
    "14px",

  fontWeight:
    700,

  borderBottom:
    "1px solid #252B31",
};


export const savedTextStyle = {
  fontSize:
    "12px",

  color:
    "#FFFFFF",

  fontWeight:
    900,
};


export const outputBoxStyle = {
  padding:
    "9px",

  textAlign:
    "right",

  color:
    "#FFFFFF",

  fontSize:
    "14px",

  fontWeight:
    900,
};


export const platformActionsStyle = {
  padding:
    "10px",

  display:
    "grid",

  gap:
    "7px",
};


// ============================================================
// STATUS BANNERS
// BLACK + WHITE
// ============================================================

export const completeStyle = {
  padding:
    "10px",

  textAlign:
    "center",

  backgroundColor:
    "#0D1115",

  color:
    "#FFFFFF",

  border:
    "1px solid #454E58",

  borderRadius:
    "8px",

  fontSize:
    "13px",

  fontWeight:
    900,
};


export const waitingStyle = {
  padding:
    "10px",

  textAlign:
    "center",

  backgroundColor:
    "#0D1115",

  color:
    "#FFFFFF",

  border:
    "1px solid #454E58",

  borderRadius:
    "8px",

  fontSize:
    "13px",

  fontWeight:
    900,
};


export const warningStyle = {
  padding:
    "10px",

  textAlign:
    "center",

  backgroundColor:
    "#0D1115",

  color:
    "#FFFFFF",

  border:
    "1px solid #454E58",

  borderRadius:
    "8px",

  fontSize:
    "13px",

  fontWeight:
    900,
};


// ============================================================
// NORMAL ACTION
// BLACK + WHITE
// ============================================================

export const greenActionStyle = {
  width:
    "100%",

  minHeight:
    "42px",

  padding:
    "10px 14px",

  border:
    "1px solid #4B545E",

  background:
    "linear-gradient(145deg, #181E24, #0E1216)",

  color:
    "#FFFFFF",

  borderRadius:
    "9px",

  fontSize:
    "14px",

  fontWeight:
    900,

  cursor:
    "pointer",

  boxShadow:
    "0 6px 16px rgba(0,0,0,0.20)",
};


// ============================================================
// SAVE CLOSING READINGS
// GOLD
// ============================================================

export const blueActionStyle = {
  ...greenActionStyle,

  border:
    `1px solid ${COLORS.gold}`,

  background:
    "linear-gradient(135deg, #9A7734, #654A1C)",

  color:
    "#FFFFFF",

  fontWeight:
    950,
};


// ============================================================
// SAVE EXPENSES
// GOLD
// ============================================================

export const redActionStyle = {
  width: "100%",
  minHeight: "42px",
  padding: "10px 14px",

  border: "1px solid #454E58",

  background:
    "linear-gradient(145deg, #171C22, #0D1115)",

  color: "#FFFFFF",

  borderRadius: "9px",

  fontSize: "14px",
  fontWeight: 900,

  cursor: "pointer",

  boxShadow:
    "0 6px 16px rgba(0,0,0,0.20)",
};


// ============================================================
// EXPENSES
// ============================================================

export const expenseHeaderStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "42px 1.5fr 1fr",

  padding:
    "10px",

  backgroundColor:
    "#11161C",

  color:
    "#FFFFFF",

  fontSize:
    "13px",

  fontWeight:
    900,

  borderBottom:
    "1px solid #343B43",
};


export const expenseRowStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "42px 1.5fr 1fr",

  gap:
    "8px",

  minHeight:
    "44px",

  padding:
    "7px 10px",

  alignItems:
    "center",

  backgroundColor:
    "#0D1115",

  color:
    "#FFFFFF",

  fontSize:
    "14px",

  fontWeight:
    700,

  borderBottom:
    "1px solid #252B31",
};


export const expenseInputStyle = {
  width:
    "100%",

  boxSizing:
    "border-box",

  minHeight:
    "39px",

  padding:
    "9px 10px",

  border:
    "1px solid #454E58",

  backgroundColor:
    "#080B0E",

  color:
    "#FFFFFF",

  borderRadius:
    "8px",

  fontSize:
    "14px",

  fontWeight:
    750,

  outline:
    "none",
};


export const savedExpenseStyle = {
  padding:
    "9px 10px",

  border:
    "1px solid #454E58",

  backgroundColor:
    "#080B0E",

  color:
    "#FFFFFF",

  borderRadius:
    "8px",

  fontSize:
    "14px",

  fontWeight:
    850,
};


// ============================================================
// TOTAL EXPENSES INSIDE EXPENSE PANEL
// GOLD
// ============================================================

export const expenseTotalStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  padding: "13px 14px",

  background:
    "linear-gradient(145deg, #11161C, #0B0F13)",

  color: "#FFFFFF",

  borderTop: "1px solid #343B43",
  borderBottom: "1px solid #343B43",

  fontSize: "16px",
  fontWeight: 950,
  fontVariantNumeric: "tabular-nums",
};
// ============================================================
// PART 3
// LAYOUT • SUMMARY • LOWER MODULES • MESSAGES
// ============================================================


// ============================================================
// MAIN 3-COLUMN REPORT GRID
// ============================================================

export const reportGridStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "repeat(3, minmax(300px, 1fr))",

  gap:
    "10px",

  alignItems:
    "start",

  width:
    "100%",
};


// ============================================================
// SHIFT GREETING
// BLACK + WHITE
// ============================================================

export const shiftGreetingStyle = {
  marginBottom:
    "10px",

  padding:
    "10px 14px",

  backgroundColor:
    "#0D1115",

  color:
    "#FFFFFF",

  border:
    "1px solid #3B434C",

  borderRadius:
    "9px",

  textAlign:
    "center",

  fontSize:
    "14px",

  fontWeight:
    900,
};


// ============================================================
// SYSTEM MESSAGE BASE
// ============================================================

export const messageStyle = {
  marginBottom:
    "10px",

  padding:
    "11px 13px",

  borderRadius:
    "9px",

  fontSize:
    "14px",

  fontWeight:
    850,

  lineHeight:
    1.45,

  border:
    "1px solid rgba(255,255,255,0.15)",
};


// ============================================================
// BOTTOM FINANCIAL SUMMARY GRID
// ============================================================

export const summaryGridStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "repeat(3, minmax(220px, 1fr))",

  gap:
    "10px",

  marginTop:
    "10px",
};


// ============================================================
// TOTAL SALES
// TOTAL EXPENSES
// CLOSING BALANCE
// ALL GOLD
// ============================================================

export function getSummaryBoxStyle() {
  return {
    position: "relative",

    minHeight: "86px",

    padding: "11px 13px",

    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",

    textAlign: "center",

    overflow: "hidden",

    color: "#FFFFFF",

    background:
      "linear-gradient(145deg, rgba(215,179,106,0.19), rgba(20,25,31,0.97))",

    border:
      "1px solid rgba(215,179,106,0.42)",

    borderRadius: "12px",

    boxShadow:
      "0 8px 22px rgba(0,0,0,0.20)",
  };
}


export const summaryValueStyle = {
  marginTop: "8px",

  padding: 0,

  background: "transparent",

  border: "none",

  color: "#FFFFFF",

  fontSize: "21px",

  fontWeight: 950,

  lineHeight: 1.1,

  fontVariantNumeric: "tabular-nums",
};

// ============================================================
// LOWER MODULES
// ============================================================

export const lowerGridStyle = {
  display: "grid",

  gridTemplateColumns:
    "repeat(3, minmax(0, 1fr))",

  gap: "12px",

  width: "100%",

  marginTop: "14px",

  alignItems: "start",
};


// ============================================================
// PROFESSIONAL SECTION
// ============================================================

export const professionalSectionStyle = {
  background:
    "linear-gradient(180deg, #11161C 0%, #0B0F13 100%)",

  color:
    "#FFFFFF",

  border:
    "1px solid #303840",

  borderRadius:
    "15px",

  boxShadow:
    "0 12px 30px rgba(0,0,0,0.20)",

  overflow:
    "hidden",
};


export const professionalHeadingStyle = {
  color:
    "#FFFFFF",

  fontSize:
    "18px",

  fontWeight:
    950,
};


export const professionalSubheadingStyle = {
  marginTop:
    "4px",

  color:
    "#FFFFFF",

  fontSize:
    "13px",

  fontWeight:
    700,

  lineHeight:
    1.45,
};


export const dividerStyle = {
  height:
    "1px",

  width:
    "100%",

  background:
    "#343B43",

  margin:
    "14px 0",
};


export const largeMoneyStyle = {
  color:
    "#FFFFFF",

  fontSize:
    "22px",

  fontWeight:
    950,

  fontVariantNumeric:
    "tabular-nums",
};


export const statusTextStyle = {
  color:
    "#FFFFFF",

  fontSize:
    "13px",

  fontWeight:
    750,
};


export const emptyStateStyle = {
  padding:
    "22px",

  textAlign:
    "center",

  color:
    "#FFFFFF",

  backgroundColor:
    "#0D1115",

  border:
    "1px dashed #454E58",

  borderRadius:
    "10px",

  fontSize:
    "14px",

  fontWeight:
    700,
};


// ============================================================
// RESPONSIVE HELPERS
// ============================================================

export function getProfessionalTopGridStyle(
  compact = false
) {
  if (compact) {
    return {
      ...topGridStyle,

      gridTemplateColumns:
        "repeat(2, minmax(150px, 1fr))",
    };
  }

  return topGridStyle;
}


export function getProfessionalReportGridStyle(
  compact = false
) {
  if (compact) {
    return {
      ...reportGridStyle,

      gridTemplateColumns:
        "1fr",
    };
  }

  return reportGridStyle;
}


export function getProfessionalSummaryGridStyle(
  compact = false
) {
  if (compact) {
    return {
      ...summaryGridStyle,

      gridTemplateColumns:
        "1fr",
    };
  }

  return summaryGridStyle;
}
