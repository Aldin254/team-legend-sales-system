// TEAM LEGEND / NYIKA — Cashier Professional Theme
 // Appearance only. No database calls or financial logic.

const C = {
  canvas: "#08121e",
  canvasDeep: "#050c15",
  header: "#0d1b2b",
  sidebar: "#0b1827",
  panel: "#101f30",
  panelRaised: "#15263a",
  field: "#0a1725",
  border: "#2a3d52",
  borderSoft: "#223448",
  text: "#f0f5fa",
  subtext: "#c4d0dc",
  muted: "#91a5b8",
  gold: "#d9b66c",
  teal: "#40c9ac",
  blue: "#7db8fa",
  red: "#fb8b96",
  greenBg: "#10332e",
  blueBg: "#142d48",
  redBg: "#38202a",
};

const font = {
  fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

export const pageStyle = {
  ...font,
  width: "100%",
  minHeight: "100vh",
  background: `linear-gradient(150deg, ${C.canvas} 0%, ${C.canvasDeep} 100%)`,
  color: C.text,
  fontSize: 13,
  lineHeight: 1.5,
  boxSizing: "border-box",
};

export const loadingStyle = {
  ...pageStyle,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  minHeight: "100vh",
  fontSize: 16,
  fontWeight: 600,
};

export const topHeaderStyle = {
  background: C.header,
  borderBottom: `1px solid ${C.border}`,
  boxShadow: "0 5px 24px rgba(0,0,0,.15)",
  padding: "15px clamp(16px,2.5vw,32px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: 16,
};

export const brandWrapStyle = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  minWidth: 0,
};

export const crownStyle = {
  fontSize: 31,
  lineHeight: 1,
  color: C.gold,
  textShadow: "0 1px 10px rgba(217,182,108,.12)",
};

export const brandStyle = {
  color: C.text,
  fontSize: "clamp(18px,2vw,24px)",
  fontWeight: 850,
  letterSpacing: ".04em",
  lineHeight: 1.15,
};

export const taglineStyle = {
  marginTop: 5,
  color: C.gold,
  fontSize: 9,
  letterSpacing: ".2em",
  fontWeight: 700,
};

export const headerRightStyle = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  justifyContent: "flex-end",
  gap: 16,
  color: C.subtext,
  fontSize: 12,
};

export const headerShopStyle = {
  color: C.muted,
  fontSize: 10,
  letterSpacing: ".1em",
  marginTop: 3,
};

export const logoutButtonStyle = {
  border: `1px solid ${C.border}`,
  background: C.panelRaised,
  color: C.text,
  borderRadius: 8,
  padding: "9px 16px",
  fontSize: 12,
  fontWeight: 750,
  cursor: "pointer",
};

// Flex wrapping preserves a usable layout on narrow cashier devices.
export const bodyStyle = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "stretch",
  gap: 0,
  width: "100%",
};

export const sidebarStyle = {
  flex: "0 1 172px",
  minWidth: 145,
  background: C.sidebar,
  borderRight: `1px solid ${C.borderSoft}`,
  padding: "18px 10px",
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  gap: 5,
};

export const mainStyle = {
  flex: "1 1 680px",
  minWidth: 0,
  padding: "clamp(12px,2vw,25px)",
  boxSizing: "border-box",
};

export const topGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,150px),1fr))",
  gap: 10,
  marginBottom: 12,
};

const baseTopCard = {
  borderRadius: 11,
  minWidth: 0,
  minHeight: 94,
  padding: "14px 15px",
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
};

export const shopCardStyle = {
  ...baseTopCard,
  background: "linear-gradient(145deg,#17283a,#102031)",
  border: `1px solid ${C.border}`,
  borderTop: `2px solid ${C.gold}`,
};

export const shopTitleStyle = {
  color: C.text,
  fontSize: "clamp(15px,1.5vw,19px)",
  fontWeight: 850,
  letterSpacing: ".04em",
  overflowWrap: "anywhere",
};

export const shopSubtitleStyle = {
  marginTop: 4,
  color: C.subtext,
  fontSize: 10,
  letterSpacing: ".1em",
  fontWeight: 700,
};

export const smallTextStyle = {
  marginTop: 5,
  color: C.muted,
  fontSize: 10,
};

export const infoTitleStyle = {
  color: C.muted,
  fontSize: 10,
  letterSpacing: ".12em",
  textTransform: "uppercase",
  fontWeight: 750,
};

export const infoValueStyle = {
  color: C.text,
  fontSize: "clamp(13px,1.4vw,17px)",
  lineHeight: 1.3,
  fontWeight: 800,
  marginTop: 6,
  overflowWrap: "anywhere",
};

export const infoSubvalueStyle = {
  color: C.subtext,
  fontSize: 10,
  marginTop: 4,
  fontVariantNumeric: "tabular-nums",
};

export const shiftGreetingStyle = {
  border: `1px solid ${C.borderSoft}`,
  borderLeft: `3px solid ${C.gold}`,
  borderRadius: 8,
  padding: "9px 14px",
  background: "#101e2d",
  color: C.subtext,
  fontSize: 12,
  fontWeight: 700,
  marginBottom: 16,
};

export const messageStyle = {
  padding: "10px 14px",
  borderRadius: 8,
  border: `1px solid ${C.border}`,
  fontSize: 12,
  fontWeight: 700,
  marginBottom: 12,
  overflowWrap: "anywhere",
};

export const reportGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,305px),1fr))",
  alignItems: "start",
  gap: 14,
  width: "100%",
  marginBottom: 14,
};

export const panelStyle = {
  minWidth: 0,
  background: C.panel,
  border: `1px solid ${C.border}`,
  borderRadius: 12,
  boxShadow: "0 8px 25px rgba(0,0,0,.10)",
  overflowX: "auto",
  overflowY: "hidden",
  paddingBottom: 11,
};

export const tableHeaderStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(0,1.5fr) minmax(100px,.9fr)",
  gap: 8,
  alignItems: "center",
  padding: "10px 12px",
  borderBottom: `1px solid ${C.borderSoft}`,
  background: C.field,
  color: C.muted,
  fontSize: 9,
  letterSpacing: ".08em",
  fontWeight: 800,
};

export const incomeRowStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(0,1.5fr) minmax(100px,.9fr)",
  gap: 9,
  alignItems: "center",
  padding: "8px 12px",
  minHeight: 38,
  borderBottom: `1px solid ${C.borderSoft}`,
  color: C.subtext,
  fontSize: 11,
};

const moneyCell = {
  padding: "7px 9px",
  minHeight: 29,
  boxSizing: "border-box",
  borderRadius: 6,
  fontSize: 11,
  lineHeight: 1.4,
  fontWeight: 750,
  fontVariantNumeric: "tabular-nums",
  textAlign: "right",
};

export const amountBoxStyle = {
  ...moneyCell,
  color: C.text,
  background: C.field,
  border: `1px solid ${C.borderSoft}`,
};

export const moneyInputStyle = {
  ...moneyCell,
  display: "block",
  width: "100%",
  minWidth: 65,
  outlineOffset: 2,
  background: C.field,
  color: C.text,
  border: `1px solid ${C.border}`,
  fontFamily: "inherit",
};

export const savedMoneyStyle = {
  ...moneyCell,
  color: "#8ce3c4",
  background: C.greenBg,
  border: "1px solid #2a6354",
};

export const lockedMoneyStyle = {
  ...moneyCell,
  color: C.muted,
  background: "#0d1926",
  border: `1px solid ${C.borderSoft}`,
};

export const missingReadingStyle = {
  ...moneyCell,
  color: C.red,
  background: C.redBg,
  border: "1px solid #723c49",
  textAlign: "center",
};

export const readOnlyInlineStyle = {
  marginLeft: 5,
  color: C.gold,
  fontWeight: 700,
};

export const incomeTotalStyle = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "space-between",
  gap: 8,
  margin: "9px 10px 0",
  padding: "11px 12px",
  background: "#152f30",
  border: "1px solid #2c645a",
  borderRadius: 7,
  color: "#b5f2dc",
  fontSize: 12,
  fontVariantNumeric: "tabular-nums",
};

const quietNote = {
  margin: "9px 11px 0",
  borderRadius: 7,
  padding: "9px 10px",
  color: C.muted,
  fontSize: 10,
  lineHeight: 1.6,
};

export const companyFloatNoticeStyle = {
  ...quietNote,
  background: C.field,
  border: `1px solid ${C.borderSoft}`,
};

export const automaticExpenseNoticeStyle = {
  ...quietNote,
  background: C.field,
  border: `1px solid ${C.borderSoft}`,
};

export const panelButtonWrapStyle = {
  padding: "10px 11px 3px",
};

export const platformStatusStyle = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "space-between",
  gap: 10,
  color: C.subtext,
  padding: "10px 12px",
  fontSize: 11,
  fontWeight: 700,
};

export const platformHeaderStyle = {
  display: "grid",
  gap: 7,
  minWidth: 295,
  alignItems: "center",
  background: C.field,
  borderTop: `1px solid ${C.borderSoft}`,
  borderBottom: `1px solid ${C.borderSoft}`,
  padding: "10px 12px",
  color: C.muted,
  fontSize: 9,
  letterSpacing: ".045em",
  fontWeight: 800,
  textAlign: "left",
};

export const platformRowStyle = {
  display: "grid",
  gap: 7,
  minWidth: 295,
  alignItems: "center",
  padding: "9px 12px",
  borderBottom: `1px solid ${C.borderSoft}`,
  color: C.text,
  fontSize: 11,
};

export const savedTextStyle = {
  color: C.teal,
  fontSize: 9,
  fontWeight: 750,
  marginTop: 3,
};

export const outputBoxStyle = {
  ...moneyCell,
  background: C.field,
  border: `1px solid ${C.borderSoft}`,
  color: C.subtext,
};

export const platformActionsStyle = {
  display: "grid",
  gap: 7,
  padding: "12px 11px 0",
};

export const completeStyle = {
  padding: "9px 11px",
  borderRadius: 7,
  background: C.greenBg,
  color: "#8ce3c4",
  border: "1px solid #2a6354",
  textAlign: "center",
  fontWeight: 800,
  fontSize: 11,
};

export const waitingStyle = {
  padding: "10px 11px",
  borderRadius: 7,
  background: C.blueBg,
  color: "#b1d2ff",
  border: "1px solid #355779",
  textAlign: "center",
  fontWeight: 750,
  fontSize: 11,
};

export const warningStyle = {
  padding: "10px 11px",
  borderRadius: 7,
  background: C.redBg,
  color: "#ffc2cb",
  border: "1px solid #723c49",
  textAlign: "center",
  fontWeight: 750,
  fontSize: 11,
};

const action = {
  display: "block",
  width: "100%",
  padding: "11px 12px",
  borderRadius: 8,
  border: "none",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
  transition: "filter .15s ease",
};

export const blueActionStyle = {
  ...action,
  background: "#247b93",
  color: "#fff",
  border: "1px solid #3e99ac",
};

export const redActionStyle = {
  ...action,
  background: "#9d4359",
  color: "#fff",
  border: "1px solid #c45b72",
};

export const expenseHeaderStyle = {
  display: "grid",
  gridTemplateColumns: "25px minmax(0,1.4fr) minmax(76px,.85fr)",
  gap: 6,
  padding: "10px 12px",
  background: C.field,
  borderBottom: `1px solid ${C.borderSoft}`,
  color: C.muted,
  fontSize: 9,
  letterSpacing: ".05em",
  fontWeight: 800,
};

export const expenseRowStyle = {
  display: "grid",
  gridTemplateColumns: "25px minmax(0,1.4fr) minmax(76px,.85fr)",
  gap: 6,
  alignItems: "center",
  padding: "6px 11px",
  borderBottom: `1px solid ${C.borderSoft}`,
  fontSize: 11,
  color: C.muted,
};

export const expenseInputStyle = {
  display: "block",
  width: "100%",
  minWidth: 0,
  minHeight: 32,
  boxSizing: "border-box",
  padding: "6px 8px",
  borderRadius: 6,
  border: `1px solid ${C.border}`,
  outlineOffset: 2,
  background: C.field,
  color: C.text,
  fontSize: 11,
  fontFamily: "inherit",
};

export const savedExpenseStyle = {
  background: C.greenBg,
  border: "1px solid #2a6354",
  color: "#a8ebd1",
  padding: "7px 8px",
  borderRadius: 6,
  fontSize: 11,
  overflowWrap: "anywhere",
};

export const expenseTotalStyle = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 7,
  margin: "11px 10px 0",
  padding: "11px 12px",
  background: "#34202d",
  border: "1px solid #774155",
  borderRadius: 7,
  color: "#ffc3ce",
  fontSize: 12,
  fontVariantNumeric: "tabular-nums",
};

export const summaryGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,225px),1fr))",
  gap: 12,
  margin: "15px 0",
};

export const summaryValueStyle = {
  marginTop: 7,
  fontSize: "clamp(17px,1.9vw,24px)",
  letterSpacing: "-.035em",
  fontWeight: 850,
  color: C.text,
  fontVariantNumeric: "tabular-nums",
  overflowWrap: "anywhere",
};

export const lowerGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 14,
  width: "100%",
  margin: "16px 0 22px",
  alignItems: "start",
  boxSizing: "border-box",
};

export const sidebarIconStyle = {
  fontSize: 16,
  opacity: .85,
  width: 22,
  flexShrink: 0,
  textAlign: "center",
};

export function getSidebarItemStyle(active = false) {
  return {
    display: "flex",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    padding: "11px 10px",
    background: active ? "#163846" : "transparent",
    color: active ? "#eefaf7" : C.subtext,
    border: active ? "1px solid #326775" : "1px solid transparent",
    borderLeft: active ? `3px solid ${C.teal}` : "3px solid transparent",
    fontSize: 11,
    fontWeight: active ? 800 : 650,
    minWidth: 0,
  };
}

function toneColor(tone) {
  const t = String(tone || "").toLowerCase();
  if (t === "red") return C.red;
  if (t === "green") return C.teal;
  if (t === "blue") return C.blue;
  if (t === "brown") return C.gold;
  if (t === "navy") return C.gold;
  return C.gold;
}

export function getInfoCardStyle(tone) {
  return {
    ...baseTopCard,
    position: "relative",
    overflow: "hidden",
    background: C.panel,
    border: `1px solid ${C.border}`,
    borderTop: `2px solid ${toneColor(tone)}`,
  };
}

export function getInfoCardAccentStyle(tone) {
  return {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    background: toneColor(tone),
    opacity: .42,
  };
}

export function getPanelTitleStyle(tone) {
  return {
    color: C.text,
    background: "#152639",
    borderBottom: `1px solid ${C.border}`,
    borderLeft: `3px solid ${toneColor(tone)}`,
    padding: "12px 13px",
    fontSize: 11,
    fontWeight: 850,
    letterSpacing: ".1em",
  };
}

export function getSummaryBoxStyle(tone) {
  return {
    background: "linear-gradient(130deg,#15283b,#101e2e)",
    border: `1px solid ${C.border}`,
    borderLeft: `3px solid ${toneColor(tone)}`,
    borderRadius: 10,
    padding: "15px 16px",
    fontSize: 10,
    fontWeight: 750,
    letterSpacing: ".09em",
    color: C.muted,
    minWidth: 0,
  };
}
