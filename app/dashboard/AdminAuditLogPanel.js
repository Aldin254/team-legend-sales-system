"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

export default function AdminAuditLogPanel({
  user,
  selectedShift,
  selectedShop,
}) {
  const [logs, setLogs] = useState([]);
  const [profileNames, setProfileNames] = useState({});

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const accessToken =
    user?.access_token || null;

  const shiftId =
    selectedShift?.id || null;

  const shopId =
    selectedShift?.shop_id ||
    selectedShop?.id ||
    null;

  // ==================================================
  // HEADERS
  // ==================================================

  const authHeaders =
    useMemo(() => {
      return {
        apikey:
          supabaseAnonKey,

        Authorization:
          `Bearer ${accessToken}`,

        "Content-Type":
          "application/json",
      };
    }, [
      supabaseAnonKey,
      accessToken,
    ]);

  // ==================================================
  // LOAD AUDIT LOG
  // ==================================================

  const loadAuditLog =
    useCallback(
      async () => {
        if (
          !shiftId ||
          !shopId ||
          !supabaseUrl ||
          !supabaseAnonKey ||
          !accessToken
        ) {
          setLogs([]);
          return;
        }

        try {
          setLoading(true);
          setMessage("");

          // ------------------------------------------
          // LOAD RECENT AUDIT RECORDS FOR THIS SHOP
          // ------------------------------------------

          const response =
            await fetch(
              `${supabaseUrl}/rest/v1/audit_log` +
                `?shop_id=eq.${encodeURIComponent(
                  shopId
                )}` +
                `&select=` +
                `id,user_id,shop_id,action,table_name,record_id,old_data,new_data,created_at` +
                `&order=created_at.desc` +
                `&limit=200`,
              {
                method: "GET",

                headers:
                  authHeaders,

                cache:
                  "no-store",
              }
            );

          const result =
            await safeJson(
              response
            );

          if (!response.ok) {
            throw new Error(
              result?.message ||
                result?.details ||
                "Unable to load correction history."
            );
          }

          const allLogs =
            Array.isArray(result)
              ? result
              : [];

          // ------------------------------------------
          // KEEP ONLY AUDIT RECORDS FOR SELECTED SHIFT
          //
          // Shift corrections:
          // record_id = shift id
          //
          // Child corrections:
          // old_data.shift_id / new_data.shift_id
          // ------------------------------------------

          const shiftLogs =
            allLogs.filter(
              (log) =>
                belongsToShift(
                  log,
                  shiftId
                )
            );

          setLogs(
            shiftLogs
          );

          // ------------------------------------------
          // LOAD ADMIN PROFILE NAMES
          // ------------------------------------------

          const userIds = [
            ...new Set(
              shiftLogs
                .map(
                  (log) =>
                    log.user_id
                )
                .filter(Boolean)
            ),
          ];

          if (
            userIds.length === 0
          ) {
            setProfileNames({});
            return;
          }

          const inList =
            userIds.join(",");

          const profileResponse =
            await fetch(
              `${supabaseUrl}/rest/v1/profiles` +
                `?id=in.(${encodeURIComponent(
                  inList
                )})` +
                `&select=id,full_name,role`,
              {
                method: "GET",

                headers:
                  authHeaders,

                cache:
                  "no-store",
              }
            );

          const profileResult =
            await safeJson(
              profileResponse
            );

          if (
            profileResponse.ok &&
            Array.isArray(
              profileResult
            )
          ) {
            const names = {};

            for (
              const profile
              of profileResult
            ) {
              names[
                profile.id
              ] =
                profile.full_name ||
                "Admin";
            }

            setProfileNames(
              names
            );
          }
        } catch (error) {
          console.error(
            "LOAD ADMIN AUDIT LOG ERROR:",
            error
          );

          setMessage(
            error?.message ||
              "Unable to load correction history."
          );
        } finally {
          setLoading(false);
        }
      },
      [
        shiftId,
        shopId,
        supabaseUrl,
        supabaseAnonKey,
        accessToken,
        authHeaders,
      ]
    );

  // ==================================================
  // LOAD WHEN SHIFT CHANGES
  // ==================================================

  useEffect(() => {
    loadAuditLog();
  }, [loadAuditLog]);

  // ==================================================
  // DISPLAY
  // ==================================================

  if (!selectedShift) {
    return null;
  }

  return (
    <section style={panelStyle}>
      <div style={titleBarStyle}>
        <div>
          ADMIN CORRECTION HISTORY
        </div>

        <button
          type="button"
          onClick={
            loadAuditLog
          }
          disabled={
            loading
          }
          style={refreshButtonStyle}
        >
          {loading
            ? "REFRESHING..."
            : "REFRESH HISTORY"}
        </button>
      </div>

      <div style={bodyStyle}>
        <div style={shiftInfoStyle}>
          <div>
            <small>
              SHOP
            </small>

            <strong>
              {selectedShop?.shop_name ||
                "-"}
            </strong>
          </div>

          <div>
            <small>
              BUSINESS DATE
            </small>

            <strong>
              {selectedShift.business_date ||
                "-"}
            </strong>
          </div>

          <div>
            <small>
              SHIFT
            </small>

            <strong>
              {selectedShift.shift_name ||
                "-"}
            </strong>
          </div>

          <div>
            <small>
              STATUS
            </small>

            <strong>
              {selectedShift.status ||
                "-"}
            </strong>
          </div>

          <div>
            <small>
              CORRECTIONS
            </small>

            <strong>
              {logs.length}
            </strong>
          </div>
        </div>

        {message && (
          <div style={errorStyle}>
            {message}
          </div>
        )}

        {loading && (
          <div style={loadingStyle}>
            Loading correction history...
          </div>
        )}

        {!loading &&
          logs.length === 0 && (
            <div style={emptyStyle}>
              No Admin corrections have been recorded
              for this shift yet.
            </div>
          )}

        {!loading &&
          logs.length > 0 && (
            <>
              <div style={headerStyle}>
                <div>
                  DATE / TIME
                </div>

                <div>
                  ADMIN
                </div>

                <div>
                  CORRECTION
                </div>

                <div>
                  AREA
                </div>

                <div>
                  REASON
                </div>

                <div>
                  DETAILS
                </div>
              </div>

              {logs.map(
                (log) => {
                  const reason =
                    extractReason(
                      log
                    );

                  const summary =
                    buildSummary(
                      log
                    );

                  const adminName =
                    profileNames[
                      log.user_id
                    ] ||
                    "Admin";

                  return (
                    <div
                      key={log.id}
                      style={rowStyle}
                    >
                      <div>
                        <strong>
                          {formatDateTime(
                            log.created_at
                          )}
                        </strong>
                      </div>

                      <div>
                        {adminName}
                      </div>

                      <div>
                        <span
                          style={actionBadgeStyle}
                        >
                          {friendlyAction(
                            log.action
                          )}
                        </span>
                      </div>

                      <div>
                        {friendlyTable(
                          log.table_name
                        )}
                      </div>

                      <div style={reasonStyle}>
                        {reason ||
                          "No reason recorded"}
                      </div>

                      <div>
                        <details>
                          <summary
                            style={
                              detailsSummaryStyle
                            }
                          >
                            View
                          </summary>

                          <div style={detailsBoxStyle}>
                            <div style={summaryStyle}>
                              {summary}
                            </div>

                            <div style={jsonTitleStyle}>
                              BEFORE
                            </div>

                            <pre style={jsonStyle}>
                              {prettyJson(
                                log.old_data
                              )}
                            </pre>

                            <div style={jsonTitleStyle}>
                              AFTER
                            </div>

                            <pre style={jsonStyle}>
                              {prettyJson(
                                log.new_data
                              )}
                            </pre>
                          </div>
                        </details>
                      </div>
                    </div>
                  );
                }
              )}
            </>
          )}

        <div style={noticeStyle}>
          Correction history is read-only. Each record shows
          who made the change, when it was made, the correction
          reason, and the values before and after the change.
        </div>
      </div>
    </section>
  );
}

// ==================================================
// DOES AUDIT RECORD BELONG TO SHIFT?
// ==================================================

function belongsToShift(
  log,
  shiftId
) {
  if (!log || !shiftId) {
    return false;
  }

  if (
    String(
      log.record_id || ""
    ) ===
    String(shiftId)
  ) {
    return true;
  }

  const oldShiftId =
    log.old_data?.shift_id ||
    null;

  const newShiftId =
    log.new_data?.shift_id ||
    null;

  return (
    String(
      oldShiftId || ""
    ) ===
      String(shiftId) ||
    String(
      newShiftId || ""
    ) ===
      String(shiftId)
  );
}

// ==================================================
// EXTRACT REASON
// ==================================================

function extractReason(log) {
  return (
    log?.new_data
      ?.correction_reason ||
    log?.old_data
      ?.correction_reason ||
    ""
  );
}

// ==================================================
// FRIENDLY ACTION
// ==================================================

function friendlyAction(
  action
) {
  const map = {
    ADMIN_SHIFT_CORRECTION:
      "Shift Correction",

    ADMIN_SHIFT_MANUAL_TOTAL_CORRECTION:
      "Manual Totals",

    ADMIN_FLOAT_ADD:
      "Float Added",

    ADMIN_FLOAT_UPDATE:
      "Float Updated",

    ADMIN_FLOAT_DELETE:
      "Float Deleted",

    ADMIN_PLATFORM_READING_ADD:
      "Reading Added",

    ADMIN_PLATFORM_READING_UPDATE:
      "Reading Updated",

    ADMIN_PLATFORM_READING_DELETE:
      "Reading Deleted",

    ADMIN_EXPENSE_ADD:
      "Expense Added",

    ADMIN_EXPENSE_UPDATE:
      "Expense Updated",

    ADMIN_EXPENSE_DELETE:
      "Expense Deleted",

    ADMIN_SAVINGS_ADD:
      "Savings Added",

    ADMIN_SAVINGS_UPDATE:
      "Savings Updated",

    ADMIN_SAVINGS_DELETE:
      "Savings Deleted",
  };

  return (
    map[action] ||
    String(
      action || "Correction"
    )
      .replaceAll("_", " ")
  );
}

// ==================================================
// FRIENDLY TABLE
// ==================================================

function friendlyTable(
  table
) {
  const map = {
    shifts:
      "Shift Totals",

    shift_income_entries:
      "Float",

    platform_readings:
      "Platform",

    expenses:
      "Expense",

    shift_savings:
      "Savings / Banking",
  };

  return (
    map[table] ||
    table ||
    "-"
  );
}

// ==================================================
// SUMMARY
// ==================================================

function buildSummary(log) {
  const action =
    String(
      log?.action || ""
    );

  const oldData =
    log?.old_data || {};

  const newData =
    log?.new_data || {};

  if (
    action.includes(
      "SHIFT"
    )
  ) {
    return (
      `Balance B/F: ${displayValue(
        oldData.opening_balance
      )} → ${displayValue(
        newData.opening_balance
      )}; ` +
      `Net Income: ${displayValue(
        oldData.net_income
      )} → ${displayValue(
        newData.net_income
      )}; ` +
      `Closing Balance: ${displayValue(
        oldData.closing_balance
      )} → ${displayValue(
        newData.closing_balance
      )}`
    );
  }

  if (
    action.includes(
      "FLOAT"
    )
  ) {
    return (
      `${newData.entry_type ||
        oldData.entry_type ||
        "Float"}: ` +
      `${displayValue(
        oldData.amount
      )} → ${displayValue(
        newData.amount
      )}`
    );
  }

  if (
    action.includes(
      "PLATFORM"
    )
  ) {
    return (
      `${
        newData.platform_name ||
        oldData.platform_name ||
        "Platform"
      } ` +
      `${
        newData.reading_kind ||
        oldData.reading_kind ||
        "Reading"
      }: ` +
      `${displayValue(
        oldData.reading_value
      )} → ${displayValue(
        newData.reading_value
      )}`
    );
  }

  if (
    action.includes(
      "EXPENSE"
    )
  ) {
    return (
      `${
        newData.description ||
        oldData.description ||
        "Expense"
      }: ` +
      `${displayValue(
        oldData.amount
      )} → ${displayValue(
        newData.amount
      )}`
    );
  }

  if (
    action.includes(
      "SAVINGS"
    )
  ) {
    return (
      `${
        newData.description ||
        oldData.description ||
        "Savings"
      }: ` +
      `${displayValue(
        oldData.amount
      )} → ${displayValue(
        newData.amount
      )}; ` +
      `Status: ${
        oldData.payment_status ||
        "-"
      } → ${
        newData.payment_status ||
        "-"
      }`
    );
  }

  return friendlyAction(
    log?.action
  );
}

// ==================================================
// HELPERS
// ==================================================

async function safeJson(
  response
) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function displayValue(value) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return "-";
  }

  if (
    typeof value ===
    "number"
  ) {
    return Number(
      value
    ).toLocaleString(
      "en-KE",
      {
        minimumFractionDigits:
          2,

        maximumFractionDigits:
          2,
      }
    );
  }

  return String(value);
}

function prettyJson(value) {
  try {
    return JSON.stringify(
      value || {},
      null,
      2
    );
  } catch {
    return "{}";
  }
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  try {
    return new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone:
          "Africa/Nairobi",

        day:
          "2-digit",

        month:
          "short",

        year:
          "numeric",

        hour:
          "2-digit",

        minute:
          "2-digit",

        second:
          "2-digit",
      }
    ).format(
      new Date(value)
    );
  } catch {
    return String(value);
  }
}

// ==================================================
// STYLES
// ==================================================

const panelStyle = {
  marginTop:
    "18px",

  border:
    "1px solid #c4b5fd",

  borderRadius:
    "7px",

  overflow:
    "hidden",

  backgroundColor:
    "#ffffff",
};

const titleBarStyle = {
  backgroundColor:
    "#4338ca",

  color:
    "white",

  padding:
    "10px 12px",

  fontWeight:
    "bold",

  fontSize:
    "13px",

  display:
    "flex",

  justifyContent:
    "space-between",

  alignItems:
    "center",
};

const refreshButtonStyle = {
  border:
    "1px solid rgba(255,255,255,0.55)",

  backgroundColor:
    "transparent",

  color:
    "white",

  borderRadius:
    "4px",

  padding:
    "6px 10px",

  fontWeight:
    "bold",

  cursor:
    "pointer",

  fontSize:
    "8px",
};

const bodyStyle = {
  padding:
    "12px",
};

const shiftInfoStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "repeat(5,1fr)",

  gap:
    "8px",

  marginBottom:
    "12px",
};

const headerStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "1.1fr 0.8fr 1fr 0.9fr 2fr 0.45fr",

  gap:
    "7px",

  padding:
    "8px",

  backgroundColor:
    "#e0e7ff",

  color:
    "#3730a3",

  fontSize:
    "9px",

  fontWeight:
    "bold",
};

const rowStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "1.1fr 0.8fr 1fr 0.9fr 2fr 0.45fr",

  gap:
    "7px",

  alignItems:
    "center",

  padding:
    "9px 8px",

  borderTop:
    "1px solid #e2e8f0",

  fontSize:
    "9px",
};

const actionBadgeStyle = {
  display:
    "inline-block",

  backgroundColor:
    "#ede9fe",

  color:
    "#5b21b6",

  borderRadius:
    "4px",

  padding:
    "4px 6px",

  fontWeight:
    "bold",
};

const reasonStyle = {
  whiteSpace:
    "normal",

  lineHeight:
    "1.3",
};

const detailsSummaryStyle = {
  cursor:
    "pointer",

  color:
    "#4338ca",

  fontWeight:
    "bold",
};

const detailsBoxStyle = {
  marginTop:
    "8px",

  width:
    "600px",

  maxWidth:
    "70vw",

  padding:
    "10px",

  backgroundColor:
    "#f8fafc",

  border:
    "1px solid #cbd5e1",

  borderRadius:
    "5px",
};

const summaryStyle = {
  marginBottom:
    "10px",

  padding:
    "8px",

  backgroundColor:
    "#eef2ff",

  color:
    "#3730a3",

  fontWeight:
    "bold",
};

const jsonTitleStyle = {
  marginTop:
    "8px",

  marginBottom:
    "4px",

  fontWeight:
    "bold",

  color:
    "#475569",
};

const jsonStyle = {
  margin:
    0,

  padding:
    "8px",

  overflowX:
    "auto",

  backgroundColor:
    "#0f172a",

  color:
    "#e2e8f0",

  borderRadius:
    "4px",

  fontSize:
    "8px",

  whiteSpace:
    "pre-wrap",

  wordBreak:
    "break-word",
};

const loadingStyle = {
  padding:
    "15px",

  textAlign:
    "center",

  color:
    "#64748b",
};

const emptyStyle = {
  padding:
    "20px",

  textAlign:
    "center",

  backgroundColor:
    "#f8fafc",

  color:
    "#64748b",

  borderRadius:
    "5px",
};

const errorStyle = {
  padding:
    "10px",

  marginBottom:
    "10px",

  backgroundColor:
    "#fef2f2",

  color:
    "#991b1b",

  borderRadius:
    "5px",
};

const noticeStyle = {
  marginTop:
    "12px",

  padding:
    "8px",

  backgroundColor:
    "#f8fafc",

  color:
    "#64748b",

  textAlign:
    "center",

  fontSize:
    "9px",
};
