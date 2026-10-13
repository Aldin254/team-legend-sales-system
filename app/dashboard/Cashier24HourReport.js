
"use client";

import Cashier24HourReportBase from "./Cashier24HourReportBase";

export default function Cashier24HourReport(props) {
  return (
    <div className="tl24-exact-theme">
      <Cashier24HourReportBase {...props} />

      <style jsx global>{`
        /* ==========================================
           TEAM LEGEND — 24-HOUR CASHIER
           EXACT 12-HOUR COLOUR THEME

           Appearance only.
           Original operations remain in the
           Cashier24HourReportBase component.
        ========================================== */

        .tl24-exact-theme {
          --canvas: #08121e;
          --canvas-deep: #050c15;
          --header: #0d1b2b;
          --sidebar: #0b1827;
          --panel: #101f30;
          --panel-raised: #15263a;
          --field: #0a1725;
          --border: #2a3d52;
          --border-soft: #223448;
          --text: #f0f5fa;
          --subtext: #c4d0dc;
          --muted: #91a5b8;
          --gold: #d9b66c;
          --teal: #40c9ac;
          --blue: #7db8fa;
          --red: #fb8b96;
          --green-bg: #10332e;
          --blue-bg: #142d48;
          --red-bg: #38202a;

          min-height: 100vh;
          background: linear-gradient(
            150deg,
            #08121e,
            #050c15
          );
          color: var(--text);
        }

        /* PAGE BACKGROUND */

        .tl24-exact-theme > div {
          background: linear-gradient(
            150deg,
            #08121e 0%,
            #050c15 100%
          ) !important;
          color: var(--text) !important;
        }

        /* HEADER */

        .tl24-exact-theme > div > header {
          background: var(--header) !important;
          color: var(--text) !important;
          border-bottom:
            1px solid var(--border) !important;
        }

        .tl24-exact-theme > div > header button {
          background: var(--panel-raised) !important;
          color: var(--text) !important;
          border:
            1px solid var(--border) !important;
        }

        /* SIDEBAR */

        .tl24-exact-theme aside {
          background: var(--sidebar) !important;
          border-color: var(--border-soft) !important;
        }

        .tl24-exact-theme aside > div {
          color: var(--subtext) !important;
        }

        .tl24-exact-theme aside > div:first-child {
          background: #163846 !important;
          color: #eefaf7 !important;
          border-left:
            3px solid var(--teal) !important;
        }

        /* MAIN CONTENT */

        .tl24-exact-theme main {
          background: transparent !important;
          color: var(--text) !important;
        }

        /* TOP SHOP CARD */

        .tl24-exact-theme main
        > div:first-child
        > div:first-child {
          background: linear-gradient(
            145deg,
            #17283a,
            #102031
          ) !important;
          border:
            1px solid var(--border) !important;
          border-top:
            2px solid var(--gold) !important;
          color: var(--text) !important;
        }

        /* TOP INFORMATION CARDS */

        .tl24-exact-theme main
        > div:first-child
        > div:not(:first-child) {
          background: var(--panel) !important;
          color: var(--text) !important;
          border:
            1px solid var(--border) !important;
          border-top:
            2px solid var(--blue) !important;
        }

        .tl24-exact-theme main
        > div:first-child
        > div:nth-child(2) {
          border-top-color: var(--gold) !important;
        }

        .tl24-exact-theme main
        > div:first-child
        > div:nth-child(5),
        .tl24-exact-theme main
        > div:first-child
        > div:nth-child(6) {
          border-top-color: var(--teal) !important;
        }

        /* GREETING AND SHIFT BANNERS */

        .tl24-exact-theme main
        > div:nth-child(2),
        .tl24-exact-theme main
        > div:nth-child(3) {
          background: #101e2d !important;
          color: var(--subtext) !important;
          border:
            1px solid var(--border-soft) !important;
          border-left:
            3px solid var(--gold) !important;
        }

        /* INCOME / EXPENSE PANELS */

        .tl24-exact-theme section {
          background: var(--panel) !important;
          border-color: var(--border) !important;
          color: var(--text) !important;
        }

        .tl24-exact-theme
        .tl24-upper-grid > section {
          background: var(--panel) !important;
          border:
            1px solid var(--border) !important;
        }

        /* PANEL HEADINGS */

        .tl24-exact-theme
        .tl24-upper-grid > section
        > div:first-child {
          background: #152639 !important;
          color: var(--text) !important;
          border-bottom:
            1px solid var(--border) !important;
          border-left:
            3px solid var(--blue) !important;
        }

        .tl24-exact-theme
        .tl24-upper-grid > section:nth-child(2)
        > div:first-child {
          border-left-color: var(--red) !important;
        }

        /* TABLE HEADERS */

        .tl24-exact-theme
        .tl24-upper-grid > section
        > div:nth-child(2) {
          background: var(--field) !important;
          color: var(--muted) !important;
          border-bottom:
            1px solid var(--border-soft) !important;
        }

        /* TEXT */

        .tl24-exact-theme
        .tl24-upper-grid > section > div {
          color: var(--subtext);
        }

        /* INPUTS */

        .tl24-exact-theme
        .tl24-upper-grid input {
          background: var(--field) !important;
          color: var(--text) !important;
          border:
            1px solid var(--border) !important;
        }

        .tl24-exact-theme
        .tl24-upper-grid input:disabled {
          background: #0d1926 !important;
          color: var(--muted) !important;
          opacity: 0.7;
        }

        .tl24-exact-theme
        .tl24-upper-grid input::placeholder {
          color: var(--muted) !important;
        }

        .tl24-exact-theme
        .tl24-upper-grid input:focus {
          outline:
            2px solid var(--teal) !important;
          outline-offset: 1px;
        }

        /* SAVED MONEY CELLS */

        .tl24-exact-theme
        .tl24-upper-grid
        [style*="background-color: rgb(239, 250, 244)"] {
          background: var(--green-bg) !important;
          color: #8ce3c4 !important;
          border-color: #2a6354 !important;
        }

        /* DISABLED AND LOCKED VALUES */

        .tl24-exact-theme
        .tl24-upper-grid
        [style*="background-color: rgb(241, 245, 249)"] {
          background: #0d1926 !important;
          color: var(--muted) !important;
          border-color: var(--border-soft) !important;
        }

        /* SAVE BUTTONS */

        .tl24-exact-theme
        .tl24-upper-grid
        > section:first-child button:not(:disabled) {
          background: #247b93 !important;
          color: #ffffff !important;
          border-color: #3e99ac !important;
        }

        .tl24-exact-theme
        .tl24-upper-grid
        > section:nth-child(2) button:not(:disabled) {
          background: #9d4359 !important;
          color: #ffffff !important;
          border-color: #c45b72 !important;
        }

        .tl24-exact-theme
        .tl24-upper-grid button:disabled {
          background: #34465b !important;
          color: #a6b6c6 !important;
        }

        /* FINANCIAL SUMMARY */

        .tl24-exact-theme
        .tl24-summary-grid > div {
          background: linear-gradient(
            130deg,
            #15283b,
            #101e2e
          ) !important;
          border:
            1px solid var(--border) !important;
          border-left:
            3px solid var(--blue) !important;
          color: var(--muted) !important;
        }

        .tl24-exact-theme
        .tl24-summary-grid
        > div:nth-child(1) {
          border-left-color: var(--teal) !important;
        }

        .tl24-exact-theme
        .tl24-summary-grid
        > div:nth-child(3) {
          border-left-color: var(--red) !important;
        }

        .tl24-exact-theme
        .tl24-summary-grid
        > div:nth-child(4) {
          border-left-color: var(--gold) !important;
        }

        .tl24-exact-theme
        .tl24-summary-grid
        > div > div {
          color: var(--text) !important;
        }

        /* INFORMATION SECTION */

        .tl24-exact-theme
        main > section {
          background: var(--panel) !important;
          border-color: var(--border) !important;
          color: var(--subtext) !important;
        }

        .tl24-exact-theme
        main > section > div:first-child {
          background: #152639 !important;
          color: var(--text) !important;
        }

        /* FORM CONTROLS */

        .tl24-exact-theme select,
        .tl24-exact-theme textarea {
          background: var(--field);
          color: var(--text);
          border-color: var(--border);
        }

        /* NO LAYOUT OR FUNCTIONAL CHANGES */

      `}</style>
    </div>
  );
}
