// ============================================================
// TEAM LEGEND
// PROFESSIONAL CASHIER THEME
// MATTE BLACK • PREMIUM • HIGH READABILITY
// ============================================================

export const COLORS = {
  page: "#080A0D",
  surface: "#0D1115",
  card: "#11161C",
  cardRaised: "#171C22",
  cardSoft: "#1A2027",

  border: "#292F36",
  borderStrong: "#3A4149",

  text: "#F8FAFC",
  textSoft: "#D1D6DC",
  muted: "#9AA3AD",

  gold: "#D7B36A",
  goldSoft: "#F4DDA7",

  blue: "#60A5FA",
  green: "#34D399",
  red: "#F87171",
  amber: "#FBBF24",
};
// ============================================================
// PART 1
// PAGE • HEADER • SIDEBAR • TOP INFORMATION CARDS
// ============================================================

export const pageStyle = {
  minHeight: "100vh",

  background:
    "radial-gradient(circle at 72% -15%, #202832 0%, #11161B 27%, #080A0D 70%)",

  color: COLORS.text,

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

  color: COLORS.text,

  fontSize: "19px",

  fontWeight: 800,

  letterSpacing: "0.2px",
};


// ============================================================
// TOP HEADER
// ============================================================

export const topHeaderStyle = {
  position: "relative",

  zIndex: 20,

  background:
    "linear-gradient(90deg, #090C10 0%, #11171D 50%, #090C10 100%)",

  color: COLORS.text,

  minHeight: "76px",

  padding: "14px 24px",

  display: "flex",

  justifyContent: "space-between",

  alignItems: "center",

  gap: "20px",

  borderBottom:
    "1px solid rgba(255,255,255,0.08)",

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

  color: "#F9E8BE",

  letterSpacing: "0.8px",

  lineHeight: 1.05,
};


export const taglineStyle = {
  marginTop: "6px",

  fontSize: "11px",

  fontWeight: 800,

  color: "#8E98A3",

  letterSpacing: "2.4px",

  textTransform: "uppercase",
};


export const headerRightStyle = {
  display: "flex",

  alignItems: "center",

  gap: "18px",

  textAlign: "right",

  color: COLORS.textSoft,

  fontSize: "14px",

  fontWeight: 700,
};


export const headerShopStyle = {
  marginTop: "4px",

  color: COLORS.gold,

  fontSize: "13px",

  fontWeight: 950,

  letterSpacing: "0.6px",
};


export const logoutButtonStyle = {
  minHeight: "40px",

  padding: "0 17px",

  background:
    "linear-gradient(145deg, #1B2026, #13171C)",

  color: COLORS.text,

  border:
    "1px solid #3B434C",

  borderRadius: "10px",

  cursor: "pointer",

  fontSize: "14px",

  fontWeight: 900,

  letterSpacing: "0.2px",

  boxShadow:
    "0 7px 18px rgba(0,0,0,0.22)",
};


// ============================================================
// MAIN BODY
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
    "1px solid rgba(255,255,255,0.07)",

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

    color: active
      ? "#F7E4B4"
      : "#AAB2BC",

    background: active
      ? "linear-gradient(135deg, rgba(215,179,106,0.19), rgba(215,179,106,0.07))"
      : "transparent",

    border: active
      ? "1px solid rgba(215,179,106,0.33)"
      : "1px solid transparent",

    borderRadius: "11px",

    fontSize: "15px",

    fontWeight: active
      ? 900
      : 750,

    letterSpacing: "0.1px",

    boxShadow: active
      ? "0 7px 22px rgba(0,0,0,0.22)"
      : "none",

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
};


// ============================================================
// MAIN CONTENT AREA
// ============================================================

export const mainStyle = {
  flex: 1,

  minWidth: 0,

  padding: "13px",

  overflow: "hidden",
};


// ============================================================
// TOP INFORMATION GRID
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

  color: COLORS.text,

  background:
    "linear-gradient(145deg, rgba(215,179,106,0.19), rgba(20,25,31,0.97))",

  border:
    "1px solid rgba(215,179,106,0.33)",

  borderRadius: "12px",

  boxShadow:
    "0 8px 22px rgba(0,0,0,0.20)",
};


export const shopTitleStyle = {
  color: "#F8E5B6",

  fontSize: "25px",

  fontWeight: 950,

  lineHeight: 1,

  letterSpacing: "0.5px",
};


export const shopSubtitleStyle = {
  marginTop: "7px",

  color: "#F2F4F6",

  fontSize: "14px",

  fontWeight: 900,

  letterSpacing: "0.45px",
};


export const smallTextStyle = {
  marginTop: "7px",

  color: "#9EA7B1",

  fontSize: "12px",

  fontWeight: 750,

  letterSpacing: "0.4px",
};


// ============================================================
// INFORMATION CARDS
// ============================================================

export function getInfoCardStyle(tone) {
  let accent = COLORS.blue;
  let glow = "rgba(96,165,250,0.10)";

  if (tone === "green") {
    accent = COLORS.green;
    glow = "rgba(52,211,153,0.10)";
  }

  if (tone === "brown") {
    accent = COLORS.gold;
    glow = "rgba(215,179,106,0.11)";
  }

  if (tone === "red") {
    accent = COLORS.red;
    glow = "rgba(248,113,113,0.10)";
  }

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

    color: COLORS.text,

    background:
      `linear-gradient(145deg, ${glow}, rgba(17,22,28,0.97))`,

    border:
      `1px solid ${accent}55`,

    borderRadius: "12px",

    boxShadow:
       "0 8px 22px rgba(0,0,0,0.18)",
  };
}


export const infoTitleStyle = {
  color: "#9EA7B1",

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

  color: "#AAB2BC",

  fontSize: "12px",

  fontWeight: 750,
};


export function getInfoCardAccentStyle(tone) {
  let accent = COLORS.blue;

  if (tone === "green") {
    accent = COLORS.green;
  }

  if (tone === "brown") {
    accent = COLORS.gold;
  }

  if (tone === "red") {
    accent = COLORS.red;
  }

  return {
    position: "absolute",

    left: "14px",

    right: "14px",

    bottom: 0,

    height: "3px",

    borderRadius: "3px 3px 0 0",

    background: accent,

    opacity: 0.82,
  };
}
// ============================================================
// PART 2
// REPORT PANELS • TABLES • INPUTS • PLATFORM SALES • EXPENSES
// ============================================================


// ============================================================
// MAIN REPORT PANELS
// ============================================================

export const panelStyle = {
  background:
    "linear-gradient(180deg, #12171D 0%, #0F1419 100%)",

  color:
    COLORS.textSoft,

  borderRadius:
    "15px",

  overflow:
    "hidden",

  border:
    "1px solid #2A3139",

  boxShadow:
    "0 12px 30px rgba(0,0,0,0.20)",
};


export function getPanelTitleStyle(tone) {
  let accent =
    COLORS.blue;

  if (tone === "green") {
    accent =
      COLORS.green;
  }

  if (tone === "red") {
    accent =
      COLORS.red;
  }

  if (tone === "gold") {
    accent =
      COLORS.gold;
  }

  return {
    position:
      "relative",

    padding:
      "14px 16px",

    background:
      "linear-gradient(90deg, #171D24 0%, #12171D 100%)",

    color:
      "#F8FAFC",

    fontSize:
      "16px",

    fontWeight:
      950,

    letterSpacing:
      "0.5px",

    borderBottom:
      `1px solid ${accent}44`,

    borderLeft:
      `4px solid ${accent}`,
  };
}


// ============================================================
// GENERIC TABLE HEADER
// ============================================================

export const tableHeaderStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "1.6fr 1fr",

  padding:
    "12px 14px",

  backgroundColor:
    "#181E25",

  color:
    "#AEB6C0",

  fontSize:
    "13px",

  fontWeight:
    900,

  letterSpacing:
    "0.5px",

  borderBottom:
    "1px solid #2A3139",
};


// ============================================================
// INCOME ROWS
// ============================================================

export const incomeRowStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "1.6fr 1fr",

  gap:
    "11px",

  padding:
    "9px 13px",

  alignItems:
    "center",

  minHeight:
    "48px",

  color:
    "#DDE2E7",

  fontSize:
    "14px",

  fontWeight:
    650,

  borderBottom:
    "1px solid #20262D",
};


export const amountBoxStyle = {
  padding:
    "10px 11px",

  border:
    "1px solid #353E47",

  background:
    "#0B0F13",

  color:
    "#F8FAFC",

  borderRadius:
    "9px",

  textAlign:
    "right",

  fontSize:
    "15px",

  fontWeight:
    850,

  fontVariantNumeric:
    "tabular-nums",
};


// ============================================================
// MONEY INPUT
// ============================================================

export const moneyInputStyle = {
  width:
    "100%",

  boxSizing:
    "border-box",

  minHeight:
    "41px",

  padding:
    "9px 11px",

  border:
    "1px solid #404A55",

  backgroundColor:
    "#090D11",

  color:
    "#FFFFFF",

  borderRadius:
    "9px",

  textAlign:
    "right",

  fontSize:
    "15px",

  fontWeight:
    800,

  fontVariantNumeric:
    "tabular-nums",

  outline:
    "none",

  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.025)",
};


// ============================================================
// SAVED / LOCKED MONEY
// ============================================================

export const savedMoneyStyle = {
  padding:
    "10px 11px",

  border:
    "1px solid #286746",

  background:
    "linear-gradient(145deg, #10271A, #0D2016)",

  color:
    "#6EE7A2",

  borderRadius:
    "9px",

  textAlign:
    "right",

  fontSize:
    "15px",

  fontWeight:
    900,

  fontVariantNumeric:
    "tabular-nums",
};


export const lockedMoneyStyle = {
  padding:
    "10px 11px",

  border:
    "1px solid #353D46",

  backgroundColor:
    "#171C21",

  color:
    "#7E8893",

  borderRadius:
    "9px",

  textAlign:
    "right",

  fontSize:
    "15px",

  fontWeight:
    850,

  fontVariantNumeric:
    "tabular-nums",
};


export const missingReadingStyle = {
  padding:
    "10px 11px",

  border:
    "1px solid #79363C",

  background:
    "linear-gradient(145deg, #2C1619, #251215)",

  color:
    "#FCA5A5",

  borderRadius:
    "9px",

  textAlign:
    "center",

  fontSize:
    "13px",

  fontWeight:
    900,
};


export const savedInlineStyle = {
  color:
    "#4ADE80",

  fontWeight:
    950,

  fontSize:
    "14px",
};


export const readOnlyInlineStyle = {
  color:
    "#60A5FA",

  fontWeight:
    950,

  fontSize:
    "14px",
};


// ============================================================
// INCOME TOTAL
// ============================================================

export const incomeTotalStyle = {
  display:
    "flex",

  justifyContent:
    "space-between",

  alignItems:
    "center",

  gap:
    "12px",

  padding:
    "15px",

  background:
    "linear-gradient(90deg, #10271A, #102219)",

  color:
    "#72E5A4",

  borderTop:
    "1px solid #276847",

  fontSize:
    "17px",

  fontWeight:
    950,

  fontVariantNumeric:
    "tabular-nums",
};


// ============================================================
// INFORMATION NOTICES
// ============================================================

export const companyFloatNoticeStyle = {
  margin:
    "11px",

  padding:
    "12px 13px",

  background:
    "linear-gradient(145deg, #111F31, #101A29)",

  color:
    "#9BCBFF",

  border:
    "1px solid #294E76",

  borderRadius:
    "10px",

  textAlign:
    "center",

  fontSize:
    "13px",

  fontWeight:
    750,

  lineHeight:
    1.55,
};


export const automaticExpenseNoticeStyle = {
  margin:
    "11px",

  padding:
    "12px 13px",

  background:
    "linear-gradient(145deg, #2B2111, #251C0E)",

  color:
    "#F6CD79",

  border:
    "1px solid #665024",

  borderRadius:
    "10px",

  textAlign:
    "center",

  fontSize:
    "13px",

  fontWeight:
    750,

  lineHeight:
    1.55,
};


export const panelButtonWrapStyle = {
  padding:
    "11px",
};


// ============================================================
// PLATFORM SALES
// ============================================================

export const platformStatusStyle = {
  display:
    "flex",

  justifyContent:
    "space-between",

  alignItems:
    "center",

  gap:
    "10px",

  minHeight:
    "42px",

  padding:
    "9px 12px",

  color:
    "#B9C1CA",

  fontSize:
    "13px",

  fontWeight:
    700,

  borderBottom:
    "1px solid #222931",
};


export const platformHeaderStyle = {
  display:
    "grid",

  padding:
    "11px 10px",

  textAlign:
    "center",

  background:
    "linear-gradient(90deg, #14221A, #111D17)",

  color:
    "#A5E9BC",

  fontSize:
    "13px",

  fontWeight:
    900,

  letterSpacing:
    "0.3px",

  borderBottom:
    "1px solid #28563A",
};


export const platformRowStyle = {
  display:
    "grid",

  gap:
    "8px",

  padding:
    "9px 10px",

  minHeight:
    "48px",

  alignItems:
    "center",

  color:
    "#E1E6EA",

  fontSize:
    "14px",

  fontWeight:
    650,

  borderBottom:
    "1px solid #20262D",
};


export const savedTextStyle = {
  color:
    "#4ADE80",

  fontSize:
    "12px",

  fontWeight:
    900,
};


export const outputBoxStyle = {
  padding:
    "10px",

  textAlign:
    "right",

  color:
    "#F8FAFC",

  fontSize:
    "15px",

  fontWeight:
    900,

  fontVariantNumeric:
    "tabular-nums",
};


export const platformActionsStyle = {
  padding:
    "11px",

  display:
    "grid",

  gap:
    "8px",
};


// ============================================================
// PLATFORM STATUS BANNERS
// ============================================================

export const completeStyle = {
  padding:
    "11px",

  textAlign:
    "center",

  background:
    "linear-gradient(145deg, #10271A, #0D2116)",

  color:
    "#5CE690",

  border:
    "1px solid #286746",

  borderRadius:
    "9px",

  fontSize:
    "13px",

  fontWeight:
    900,
};


export const waitingStyle = {
  padding:
    "11px",

  textAlign:
    "center",

  background:
    "linear-gradient(145deg, #111F31, #0F1B2B)",

  color:
    "#93C5FD",

  border:
    "1px solid #2C5078",

  borderRadius:
    "9px",

  fontSize:
    "13px",

  fontWeight:
    900,
};


export const warningStyle = {
  padding:
    "11px",

  textAlign:
    "center",

  background:
    "linear-gradient(145deg, #2C1619, #251215)",

  color:
    "#FCA5A5",

  border:
    "1px solid #79363C",

  borderRadius:
    "9px",

  fontSize:
    "13px",

  fontWeight:
    900,
};


// ============================================================
// PROFESSIONAL ACTION BUTTONS
// ============================================================

export const greenActionStyle = {
  width:
    "100%",

  minHeight:
    "43px",

  padding:
    "10px 14px",

  border:
    "1px solid #327B53",

  background:
    "linear-gradient(135deg, #17633D, #124A31)",

  color:
    "#FFFFFF",

  borderRadius:
    "10px",

  fontSize:
    "14px",

  fontWeight:
    900,

  letterSpacing:
    "0.2px",

  cursor:
    "pointer",

  boxShadow:
    "0 7px 18px rgba(0,0,0,0.22)",
};


export const blueActionStyle = {
  ...greenActionStyle,

  border:
    "1px solid #3574A9",

  background:
    "linear-gradient(135deg, #185D93, #124771)",
};


export const redActionStyle = {
  ...greenActionStyle,

  border:
    "1px solid #914047",

  background:
    "linear-gradient(135deg, #8D2B33, #6D1E25)",
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
    "11px 10px",

  background:
    "linear-gradient(90deg, #2A1619, #231316)",

  color:
    "#F5B7BC",

  fontSize:
    "13px",

  fontWeight:
    900,

  letterSpacing:
    "0.3px",

  borderBottom:
    "1px solid #68343A",
};


export const expenseRowStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "42px 1.5fr 1fr",

  gap:
    "8px",

  minHeight:
    "48px",

  padding:
    "8px 10px",

  alignItems:
    "center",

  color:
    "#E1E5E9",

  fontSize:
    "14px",

  fontWeight:
    650,

  borderBottom:
    "1px solid #20262D",
};


export const expenseInputStyle = {
  width:
    "100%",

  boxSizing:
    "border-box",

  minHeight:
    "40px",

  padding:
    "9px 10px",

  border:
    "1px solid #434C56",

  backgroundColor:
    "#090D11",

  color:
    "#FFFFFF",

  borderRadius:
    "9px",

  fontSize:
    "14px",

  fontWeight:
    750,

  outline:
    "none",
};


export const savedExpenseStyle = {
  padding:
    "10px",

  border:
    "1px solid #286746",

  background:
    "linear-gradient(145deg, #10271A, #0D2016)",

  color:
    "#6EE7A2",

  borderRadius:
    "9px",

  fontSize:
    "14px",

  fontWeight:
    850,
};


export const expenseTotalStyle = {
  display:
    "flex",

  justifyContent:
    "space-between",

  alignItems:
    "center",

  gap:
    "12px",

  padding:
    "15px",

  background:
    "linear-gradient(90deg, #35191D, #2D1518)",

  color:
    "#FFA1A9",

  borderTop:
    "1px solid #79383F",

  fontSize:
    "17px",

  fontWeight:
    950,

  fontVariantNumeric:
    "tabular-nums",
};
// ============================================================
// PART 3
// REPORT LAYOUT • SUMMARY • LOWER MODULES • MESSAGES
// ============================================================


// ============================================================
// MAIN REPORT GRID
// Income Statement • Platform Sales • Expenses
// ============================================================

export const reportGridStyle = {
  display: "grid",

  gridTemplateColumns:
    "repeat(3, minmax(300px, 1fr))",

  gap: "10px",

  alignItems: "start",

  width: "100%",
};


// ============================================================
// SHIFT GREETING
// ============================================================

export const shiftGreetingStyle = {
  marginBottom: "14px",

  padding: "13px 17px",

  background:
    "linear-gradient(90deg, rgba(215,179,106,0.14), rgba(215,179,106,0.055))",

  color:
    "#F5DDA7",

  border:
    "1px solid rgba(215,179,106,0.30)",

  borderRadius:
    "11px",

  textAlign:
    "center",

  fontSize:
    "16px",

  fontWeight:
    900,

  letterSpacing:
    "0.2px",

  boxShadow:
    "0 8px 22px rgba(0,0,0,0.16)",
};


// ============================================================
// SYSTEM MESSAGES
// ============================================================

export const messageStyle = {
  marginBottom: "14px",

  padding: "13px 15px",

  borderRadius: "10px",

  fontSize: "14px",

  fontWeight: 850,

  lineHeight: 1.45,

  border:
    "1px solid rgba(255,255,255,0.10)",
};


// ============================================================
// SUMMARY CARDS
// TOTAL SALES • TOTAL EXPENSES • CLOSING BALANCE
// ============================================================

export const summaryGridStyle = {
  display: "grid",

  gridTemplateColumns:
    "repeat(3, minmax(220px, 1fr))",

  gap: "14px",

  marginTop: "14px",
};


export const summaryValueStyle = {
  marginTop: "10px",

  padding: "13px 12px",

  background:
    "linear-gradient(145deg, #0A0E12, #10151A)",

  color:
    "#FFFFFF",

  border:
    "1px solid #343D47",

  borderRadius:
    "10px",

  fontSize:
    "23px",

  fontWeight:
    950,

  lineHeight:
    1.15,

  fontVariantNumeric:
    "tabular-nums",

  letterSpacing:
    "0.2px",
};


export function getSummaryBoxStyle(tone) {
  let accent =
    COLORS.blue;

  let glow =
    "rgba(96,165,250,0.11)";

  if (tone === "red") {
    accent =
      COLORS.red;

    glow =
      "rgba(248,113,113,0.10)";
  }

  if (tone === "navy") {
    accent =
      COLORS.gold;

    glow =
      "rgba(215,179,106,0.11)";
  }

  return {
    padding: "16px",

    color: "#F8FAFC",

    background:
      `linear-gradient(145deg, ${glow}, #11161C 72%)`,

    border:
      `1px solid ${accent}55`,

    borderRadius:
      "15px",

    textAlign:
      "center",

    fontSize:
      "14px",

    fontWeight:
      950,

    letterSpacing:
      "0.5px",

    boxShadow:
      "0 12px 30px rgba(0,0,0,0.22)",
  };
}


// ============================================================
// LOWER MODULES
// Savings • Salary • Management • Accounts
// ============================================================

export const lowerGridStyle = {
  display: "grid",

  gridTemplateColumns:
    "repeat(auto-fit, minmax(340px, 1fr))",

  gap: "14px",

  marginTop: "14px",

  alignItems: "start",
};


// ============================================================
// OPTIONAL PROFESSIONAL SECTION WRAPPER
// Can be reused later for new cashier modules.
// ============================================================

export const professionalSectionStyle = {
  background:
    "linear-gradient(180deg, #12171D 0%, #0E1318 100%)",

  border:
    "1px solid #292F36",

  borderRadius:
    "15px",

  boxShadow:
    "0 12px 30px rgba(0,0,0,0.20)",

  overflow:
    "hidden",
};


// ============================================================
// LARGE SECTION HEADING
// ============================================================

export const professionalHeadingStyle = {
  color:
    "#F8FAFC",

  fontSize:
    "18px",

  fontWeight:
    950,

  letterSpacing:
    "0.3px",
};


export const professionalSubheadingStyle = {
  marginTop:
    "4px",

  color:
    "#929CA7",

  fontSize:
    "13px",

  fontWeight:
    700,

  lineHeight:
    1.45,
};


// ============================================================
// DIVIDERS
// ============================================================

export const dividerStyle = {
  height:
    "1px",

  width:
    "100%",

  background:
    "#292F36",

  margin:
    "14px 0",
};


// ============================================================
// PROFESSIONAL VALUE / MONEY DISPLAY
// ============================================================

export const largeMoneyStyle = {
  color:
    "#FFFFFF",

  fontSize:
    "22px",

  fontWeight:
    950,

  fontVariantNumeric:
    "tabular-nums",

  letterSpacing:
    "0.2px",
};


// ============================================================
// SMALL STATUS TEXT
// ============================================================

export const statusTextStyle = {
  color:
    "#A9B2BC",

  fontSize:
    "13px",

  fontWeight:
    750,
};


// ============================================================
// PROFESSIONAL EMPTY STATE
// ============================================================

export const emptyStateStyle = {
  padding:
    "22px",

  textAlign:
    "center",

  color:
    "#929CA7",

  backgroundColor:
    "#10151A",

  border:
    "1px dashed #343C45",

  borderRadius:
    "10px",

  fontSize:
    "14px",

  fontWeight:
    700,
};


// ============================================================
// RESPONSIVE HELPERS
//
// These can be used later if we want CashierReport to switch
// layout depending on screen width.
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
