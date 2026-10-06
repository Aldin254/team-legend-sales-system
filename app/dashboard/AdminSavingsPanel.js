"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

const REFRESH_MS = 5000;

export default function AdminSavingsPanel({
  user,
}) {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const accessToken =
    user?.access_token ||
    null;

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [summary, setSummary] =
    useState({
      pending_count: 0,
      pending_amount: 0,
      confirmed_count: 0,
      confirmed_amount: 0,
      rejected_count: 0,
    });

  const [balances, setBalances] =
    useState([]);

  const [payments, setPayments] =
    useState([]);

  const [ledger, setLedger] =
    useState([]);

  const [shopFilter, setShopFilter] =
    useState("ALL");

  const [
    categoryFilter,
    setCategoryFilter,
  ] = useState("ALL");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("ALL");

  // ==================================================
  // HEADERS
  // ==================================================

  const authHeaders =
    useCallback(
      () => ({
        apikey:
          supabaseAnonKey,

        Authorization:
          `Bearer ${accessToken}`,

        "Content-Type":
          "application/json",
      }),
      [
        supabaseAnonKey,
        accessToken,
      ]
    );

  // ==================================================
  // RPC
  // ==================================================

  const loadSavings =
    useCallback(
      async (
        silent = false
      ) => {
        if (
          !supabaseUrl ||
          !supabaseAnonKey ||
          !accessToken
        ) {
          setLoading(false);
          return;
        }

        try {
          if (!silent) {
            setRefreshing(
              true
            );
          }

          setError("");

          const response =
            await fetch(
              `${supabaseUrl}/rest/v1/rpc/tl_admin_savings_activity_snapshot`,
              {
                method:
                  "POST",

                headers:
                  authHeaders(),

                body:
                  JSON.stringify({
                    p_limit:
                      200,
                  }),

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
                result?.hint ||
                "Unable to load Savings activity."
            );
          }

          setSummary({
            pending_count:
              Number(
                result
                  ?.summary
                  ?.pending_count ||
                  0
              ),

            pending_amount:
              Number(
                result
                  ?.summary
                  ?.pending_amount ||
                  0
              ),

            confirmed_count:
              Number(
                result
                  ?.summary
                  ?.confirmed_count ||
                  0
              ),

            confirmed_amount:
              Number(
                result
                  ?.summary
                  ?.confirmed_amount ||
                  0
              ),

            rejected_count:
              Number(
                result
                  ?.summary
                  ?.rejected_count ||
                  0
              ),
          });

          setBalances(
            Array.isArray(
              result?.balances
            )
              ? result.balances
              : []
          );

          setPayments(
            Array.isArray(
              result?.payments
            )
              ? result.payments
              : []
          );

          setLedger(
            Array.isArray(
              result?.ledger
            )
              ? result.ledger
              : []
          );
        } catch (err) {
          console.error(
            "ADMIN SAVINGS ERROR:",
            err
          );

          setError(
            err?.message ||
              "Unable to load Savings control."
          );
        } finally {
          setLoading(false);

          if (!silent) {
            setRefreshing(
              false
            );
          }
        }
      },
      [
        supabaseUrl,
        supabaseAnonKey,
        accessToken,
        authHeaders,
      ]
    );

  // ==================================================
  // INITIAL + LIVE REFRESH
  // ==================================================

  useEffect(() => {
    loadSavings();

    const timer =
      setInterval(
        () => {
          loadSavings(
            true
          );
        },
        REFRESH_MS
      );

    return () => {
      clearInterval(
        timer
      );
    };
  }, [
    loadSavings,
  ]);

  // ==================================================
  // FILTER OPTIONS
  // ==================================================

  const shopOptions =
    useMemo(
      () => {
        const map =
          new Map();

        for (
          const item of [
            ...balances,
            ...payments,
            ...ledger,
          ]
        ) {
          if (
            item?.shop_id &&
            item?.shop_name
          ) {
            map.set(
              item.shop_id,
              item.shop_name
            );
          }
        }

        return [
          ...map.entries(),
        ].sort(
          (
            a,
            b
          ) =>
            String(
              a[1]
            ).localeCompare(
              String(
                b[1]
              )
            )
        );
      },
      [
        balances,
        payments,
        ledger,
      ]
    );

  // ==================================================
  // FILTERED BALANCES
  // ==================================================

  const filteredBalances =
    useMemo(
      () =>
        balances.filter(
          (
            item
          ) => {
            if (
              shopFilter !==
                "ALL" &&
              String(
                item.shop_id
              ) !==
                String(
                  shopFilter
                )
            ) {
              return false;
            }

            if (
              categoryFilter !==
                "ALL" &&
              item.category !==
                categoryFilter
            ) {
              return false;
            }

            return true;
          }
        ),
      [
        balances,
        shopFilter,
        categoryFilter,
      ]
    );

  // ==================================================
  // FILTERED PAYMENTS
  // ==================================================

  const filteredPayments =
    useMemo(
      () =>
        payments.filter(
          (
            item
          ) => {
            if (
              shopFilter !==
                "ALL" &&
              String(
                item.shop_id
              ) !==
                String(
                  shopFilter
                )
            ) {
              return false;
            }

            if (
              categoryFilter !==
                "ALL" &&
              item.category !==
                categoryFilter
            ) {
              return false;
            }

            if (
              statusFilter !==
                "ALL" &&
              item.status !==
                statusFilter
            ) {
              return false;
            }

            return true;
          }
        ),
      [
        payments,
        shopFilter,
        categoryFilter,
        statusFilter,
      ]
    );

  // ==================================================
  // FILTERED LEDGER
  // ==================================================

  const filteredLedger =
    useMemo(
      () =>
        ledger.filter(
          (
            item
          ) => {
            if (
              shopFilter !==
                "ALL" &&
              String(
                item.shop_id
              ) !==
                String(
                  shopFilter
                )
            ) {
              return false;
            }

            if (
              categoryFilter !==
                "ALL" &&
              item.category !==
                categoryFilter
            ) {
              return false;
            }

            return true;
          }
        ),
      [
        ledger,
        shopFilter,
        categoryFilter,
      ]
    );

  // ==================================================
  // TOTAL CURRENT SAVINGS
  // ==================================================

  const totalCurrentSavings =
    useMemo(
      () =>
        balances.reduce(
          (
            total,
            item
          ) =>
            total +
            Number(
              item.current_balance ||
                0
            ),
          0
        ),
      [
        balances,
      ]
    );

  // ==================================================
  // DISPLAY
  // ==================================================

  if (
    loading
  ) {
    return (
      <div
        style={
          loadingStyle
        }
      >
        Loading Savings / Banking control...
      </div>
    );
  }

  return (
    <section
      style={
        wrapperStyle
      }
    >
      {/* HEADER */}

      <div
        style={
          headerStyle
        }
      >
        <div>
          <div
            style={
              titleStyle
            }
          >
            SAVINGS / BANKING CONTROL
          </div>

          <div
            style={
              subtitleStyle
            }
          >
            Live balances, payments and full audit trail.
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            loadSavings()
          }
          disabled={
            refreshing
          }
          style={
            refreshButtonStyle
          }
        >
          {refreshing
            ? "Refreshing..."
            : "Refresh"}
        </button>
      </div>

      {/* ERROR */}

      {error && (
        <div
          style={
            errorStyle
          }
        >
          {error}
        </div>
      )}

      {/* SUMMARY */}

      <div
        style={
          summaryGridStyle
        }
      >
        <SummaryCard
          label="TOTAL SAVED"
          value={`KES ${money(
            totalCurrentSavings
          )}`}
        />

        <SummaryCard
          label="PENDING PAYMENTS"
          value={
            summary
              .pending_count
          }
          sub={`KES ${money(
            summary
              .pending_amount
          )}`}
          warning
        />

        <SummaryCard
          label="CONFIRMED PAYMENTS"
          value={
            summary
              .confirmed_count
          }
          sub={`KES ${money(
            summary
              .confirmed_amount
          )}`}
          success
        />

        <SummaryCard
          label="REJECTED / FAILED"
          value={
            summary
              .rejected_count
          }
          danger
        />
      </div>

      {/* FILTERS */}

      <div
        style={
          filterPanelStyle
        }
      >
        <div>
          <label
            style={
              labelStyle
            }
          >
            SHOP
          </label>

          <select
            value={
              shopFilter
            }
            onChange={(
              event
            ) =>
              setShopFilter(
                event.target.value
              )
            }
            style={
              inputStyle
            }
          >
            <option
              value="ALL"
            >
              All Shops
            </option>

            {shopOptions.map(
              ([
                id,
                name,
              ]) => (
                <option
                  key={
                    id
                  }
                  value={
                    id
                  }
                >
                  {name}
                </option>
              )
            )}
          </select>
        </div>

        <div>
          <label
            style={
              labelStyle
            }
          >
            CATEGORY
          </label>

          <select
            value={
              categoryFilter
            }
            onChange={(
              event
            ) =>
              setCategoryFilter(
                event.target.value
              )
            }
            style={
              inputStyle
            }
          >
            <option value="ALL">
              All Categories
            </option>

            <option value="WIFI">
              WIFI
            </option>

            <option value="DSTV">
              DSTV
            </option>

            <option value="RENT">
              RENT
            </option>

            <option value="ELECTRICITY">
              ELECTRICITY
            </option>

            <option value="BANKING">
              BANKING
            </option>
          </select>
        </div>

        <div>
          <label
            style={
              labelStyle
            }
          >
            PAYMENT STATUS
          </label>

          <select
            value={
              statusFilter
            }
            onChange={(
              event
            ) =>
              setStatusFilter(
                event.target.value
              )
            }
            style={
              inputStyle
            }
          >
            <option value="ALL">
              All Statuses
            </option>

            <option value="PENDING">
              Pending
            </option>

            <option value="PROCESSING">
              Processing
            </option>

            <option value="CONFIRMED">
              Confirmed
            </option>

            <option value="REJECTED">
              Rejected
            </option>

            <option value="FAILED">
              Failed
            </option>

            <option value="CANCELLED">
              Cancelled
            </option>
          </select>
        </div>
      </div>

      {/* CURRENT BALANCES */}

      <div
        style={
          panelStyle
        }
      >
        <div
          style={
            panelTitleStyle
          }
        >
          CURRENT SAVINGS BALANCES
        </div>

        {filteredBalances.length ===
        0 ? (
          <div
            style={
              emptyStyle
            }
          >
            No Savings balances match the selected filters.
          </div>
        ) : (
          <div
            style={
              tableWrapStyle
            }
          >
            <table
              style={
                tableStyle
              }
            >
              <thead>
                <tr>
                  <TableHead>
                    Category
                  </TableHead>

                  <TableHead>
                    Shop
                  </TableHead>

                  <TableHead>
                    Employee
                  </TableHead>

                  <TableHead right>
                    Current Balance
                  </TableHead>

                  <TableHead>
                    Status
                  </TableHead>

                  <TableHead>
                    Last Updated
                  </TableHead>
                </tr>
              </thead>

              <tbody>
                {filteredBalances.map(
                  (
                    item
                  ) => (
                    <tr
                      key={
                        item.id
                      }
                    >
                      <TableCell>
                        <strong>
                          {
                            item.category
                          }
                        </strong>
                      </TableCell>

                      <TableCell>
                        {item.shop_name ||
                          "-"}
                      </TableCell>

                      <TableCell>
                        {item.employee_name ||
                          "-"}
                      </TableCell>

                      <TableCell
                        right
                      >
                        <strong>
                          KES{" "}
                          {money(
                            item.current_balance
                          )}
                        </strong>
                      </TableCell>

                      <TableCell>
                        {item.is_active
                          ? "ACTIVE"
                          : "INACTIVE"}
                      </TableCell>

                      <TableCell>
                        {formatDateTime(
                          item.updated_at
                        )}
                      </TableCell>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PAYMENT ACTIVITY */}

      <div
        style={
          panelStyle
        }
      >
        <div
          style={
            panelTitleStyle
          }
        >
          SAVINGS / BANKING PAYMENT ACTIVITY
        </div>

        {filteredPayments.length ===
        0 ? (
          <div
            style={
              emptyStyle
            }
          >
            No payment activity matches the selected filters.
          </div>
        ) : (
          <div
            style={
              tableWrapStyle
            }
          >
            <table
              style={{
                ...tableStyle,

                minWidth:
                  "1300px",
              }}
            >
              <thead>
                <tr>
                  <TableHead>
                    Requested
                  </TableHead>

                  <TableHead>
                    Category
                  </TableHead>

                  <TableHead>
                    Shop
                  </TableHead>

                  <TableHead>
                    Employee
                  </TableHead>

                  <TableHead right>
                    Amount
                  </TableHead>

                  <TableHead>
                    Destination
                  </TableHead>

                  <TableHead>
                    Method / Provider
                  </TableHead>

                  <TableHead>
                    Reference
                  </TableHead>

                  <TableHead right>
                    Fee
                  </TableHead>

                  <TableHead>
                    Status
                  </TableHead>

                  <TableHead>
                    Completed
                  </TableHead>
                </tr>
              </thead>

              <tbody>
                {filteredPayments.map(
                  (
                    item
                  ) => (
                    <tr
                      key={
                        item.id
                      }
                    >
                      <TableCell>
                        {formatDateTime(
                          item.requested_at
                        )}
                      </TableCell>

                      <TableCell>
                        <strong>
                          {
                            item.category
                          }
                        </strong>
                      </TableCell>

                      <TableCell>
                        {item.shop_name ||
                          "-"}
                      </TableCell>

                      <TableCell>
                        {item.employee_name ||
                          "-"}
                      </TableCell>

                      <TableCell
                        right
                      >
                        KES{" "}
                        {money(
                          item.amount
                        )}
                      </TableCell>

                      <TableCell>
                        <div>
                          {item.destination_name ||
                            "-"}
                        </div>

                        <small>
                          {destinationText(
                            item
                          )}
                        </small>
                      </TableCell>

                      <TableCell>
                        {item.payment_provider ||
                          item.payment_method ||
                          "-"}
                      </TableCell>

                      <TableCell>
                        {item.payment_reference ||
                          item.external_transaction_id ||
                          item.rejection_reason ||
                          "-"}
                      </TableCell>

                      <TableCell
                        right
                      >
                        KES{" "}
                        {money(
                          item.transaction_fee
                        )}
                      </TableCell>

                      <TableCell>
                        <StatusBadge
                          status={
                            item.status
                          }
                        />
                      </TableCell>

                      <TableCell>
                        {formatDateTime(
                          item.confirmed_at ||
                            item.rejected_at
                        )}
                      </TableCell>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* LEDGER */}

      <div
        style={
          panelStyle
        }
      >
        <div
          style={
            panelTitleStyle
          }
        >
          SAVINGS LEDGER
        </div>

        <div
          style={
            ledgerNoticeStyle
          }
        >
          This is the permanent money-movement record. SAVE increases
          Savings, PAYMENT and WITHDRAWAL decrease Savings.
        </div>

        {filteredLedger.length ===
        0 ? (
          <div
            style={
              emptyStyle
            }
          >
            No ledger entries match the selected filters.
          </div>
        ) : (
          <div
            style={
              tableWrapStyle
            }
          >
            <table
              style={{
                ...tableStyle,

                minWidth:
                  "1100px",
              }}
            >
              <thead>
                <tr>
                  <TableHead>
                    Date / Time
                  </TableHead>

                  <TableHead>
                    Category
                  </TableHead>

                  <TableHead>
                    Shop
                  </TableHead>

                  <TableHead>
                    Employee
                  </TableHead>

                  <TableHead>
                    Transaction
                  </TableHead>

                  <TableHead right>
                    Amount
                  </TableHead>

                  <TableHead right>
                    Before
                  </TableHead>

                  <TableHead right>
                    After
                  </TableHead>

                  <TableHead>
                    Description
                  </TableHead>
                </tr>
              </thead>

              <tbody>
                {filteredLedger.map(
                  (
                    item
                  ) => (
                    <tr
                      key={
                        item.id
                      }
                    >
                      <TableCell>
                        {formatDateTime(
                          item.created_at
                        )}
                      </TableCell>

                      <TableCell>
                        <strong>
                          {
                            item.category
                          }
                        </strong>
                      </TableCell>

                      <TableCell>
                        {item.shop_name ||
                          "-"}
                      </TableCell>

                      <TableCell>
                        {item.employee_name ||
                          "-"}
                      </TableCell>

                      <TableCell>
                        <LedgerBadge
                          type={
                            item.transaction_type
                          }
                        />
                      </TableCell>

                      <TableCell
                        right
                      >
                        KES{" "}
                        {money(
                          item.amount
                        )}
                      </TableCell>

                      <TableCell
                        right
                      >
                        KES{" "}
                        {money(
                          item.balance_before
                        )}
                      </TableCell>

                      <TableCell
                        right
                      >
                        KES{" "}
                        {money(
                          item.balance_after
                        )}
                      </TableCell>

                      <TableCell>
                        {item.description ||
                          "-"}
                      </TableCell>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div
        style={
          safetyNoticeStyle
        }
      >
        Savings balances are controlled by the Savings ledger. Admin
        cannot directly edit balances from this screen.
      </div>
    </section>
  );
}

// ==================================================
// COMPONENTS
// ==================================================

function SummaryCard({
  label,
  value,
  sub,
  success = false,
  warning = false,
  danger = false,
}) {
  let background =
    "#eff6ff";

  let border =
    "#93c5fd";

  let color =
    "#1e3a8a";

  if (success) {
    background =
      "#f0fdf4";

    border =
      "#86efac";

    color =
      "#166534";
  }

  if (warning) {
    background =
      "#fffbeb";

    border =
      "#fde68a";

    color =
      "#92400e";
  }

  if (danger) {
    background =
      "#fef2f2";

    border =
      "#fecaca";

    color =
      "#991b1b";
  }

  return (
    <div
      style={{
        ...summaryCardStyle,

        backgroundColor:
          background,

        borderColor:
          border,

        color,
      }}
    >
      <div
        style={
          summaryLabelStyle
        }
      >
        {label}
      </div>

      <div
        style={
          summaryValueStyle
        }
      >
        {value}
      </div>

      {sub && (
        <div
          style={
            summarySubStyle
          }
        >
          {sub}
        </div>
      )}
    </div>
  );
}

function TableHead({
  children,
  right = false,
}) {
  return (
    <th
      style={{
        ...tableHeadStyle,

        textAlign:
          right
            ? "right"
            : "left",
      }}
    >
      {children}
    </th>
  );
}

function TableCell({
  children,
  right = false,
}) {
  return (
    <td
      style={{
        ...tableCellStyle,

        textAlign:
          right
            ? "right"
            : "left",
      }}
    >
      {children}
    </td>
  );
}

function StatusBadge({
  status,
}) {
  const value =
    String(
      status ||
        ""
    ).toUpperCase();

  let background =
    "#e2e8f0";

  let color =
    "#334155";

  if (
    value ===
    "CONFIRMED"
  ) {
    background =
      "#dcfce7";

    color =
      "#166534";
  } else if (
    value ===
      "PENDING" ||
    value ===
      "PROCESSING"
  ) {
    background =
      "#fef3c7";

    color =
      "#92400e";
  } else if (
    value ===
      "REJECTED" ||
    value ===
      "FAILED" ||
    value ===
      "CANCELLED"
  ) {
    background =
      "#fee2e2";

    color =
      "#991b1b";
  }

  return (
    <span
      style={{
        ...badgeStyle,

        backgroundColor:
          background,

        color,
      }}
    >
      {value || "-"}
    </span>
  );
}

function LedgerBadge({
  type,
}) {
  const value =
    String(
      type ||
        ""
    ).toUpperCase();

  let background =
    "#e2e8f0";

  let color =
    "#334155";

  if (
    value ===
      "SAVE" ||
    value ===
      "OPENING_ADJUSTMENT"
  ) {
    background =
      "#dcfce7";

    color =
      "#166534";
  }

  if (
    value ===
      "PAYMENT" ||
    value ===
      "WITHDRAWAL"
  ) {
    background =
      "#dbeafe";

    color =
      "#1d4ed8";
  }

  return (
    <span
      style={{
        ...badgeStyle,

        backgroundColor:
          background,

        color,
      }}
    >
      {value}
    </span>
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

function money(
  value
) {
  return Number(
    value ||
      0
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

function formatDateTime(
  value
) {
  if (!value) {
    return "-";
  }

  try {
    return new Intl.DateTimeFormat(
      "en-KE",
      {
        timeZone:
          "Africa/Nairobi",

        day:
          "2-digit",

        month:
          "2-digit",

        year:
          "numeric",

        hour:
          "2-digit",

        minute:
          "2-digit",

        hourCycle:
          "h23",
      }
    ).format(
      new Date(
        value
      )
    );
  } catch {
    return "-";
  }
}

function destinationText(
  item
) {
  const parts =
    [
      item.destination_bank,
      item.destination_paybill_till,
      item.destination_account,
    ].filter(
      Boolean
    );

  return parts.length
    ? parts.join(
        " • "
      )
    : "-";
}

// ==================================================
// STYLES
// ==================================================

const wrapperStyle = {
  width:
    "100%",

  display:
    "grid",

  gap:
    "14px",
};

const loadingStyle = {
  padding:
    "30px",

  textAlign:
    "center",

  backgroundColor:
    "white",

  border:
    "1px solid #cbd5e1",

  borderRadius:
    "7px",

  color:
    "#64748b",

  fontWeight:
    "bold",
};

const headerStyle = {
  padding:
    "14px",

  borderRadius:
    "7px",

  background:
    "linear-gradient(90deg,#064e3b,#0f766e)",

  color:
    "white",

  display:
    "flex",

  alignItems:
    "center",

  justifyContent:
    "space-between",

  gap:
    "12px",

  flexWrap:
    "wrap",
};

const titleStyle = {
  fontSize:
    "15px",

  fontWeight:
    "900",
};

const subtitleStyle = {
  marginTop:
    "4px",

  fontSize:
    "9px",

  color:
    "#ccfbf1",
};

const refreshButtonStyle = {
  border:
    "1px solid rgba(255,255,255,0.45)",

  borderRadius:
    "5px",

  padding:
    "8px 12px",

  backgroundColor:
    "transparent",

  color:
    "white",

  fontWeight:
    "bold",

  cursor:
    "pointer",
};

const summaryGridStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "repeat(auto-fit,minmax(170px,1fr))",

  gap:
    "10px",
};

const summaryCardStyle = {
  border:
    "1px solid",

  borderRadius:
    "7px",

  padding:
    "12px",
};

const summaryLabelStyle = {
  fontSize:
    "8px",

  fontWeight:
    "900",
};

const summaryValueStyle = {
  marginTop:
    "5px",

  fontSize:
    "18px",

  fontWeight:
    "900",
};

const summarySubStyle = {
  marginTop:
    "3px",

  fontSize:
    "10px",

  fontWeight:
    "bold",
};

const filterPanelStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "repeat(auto-fit,minmax(180px,1fr))",

  gap:
    "10px",

  padding:
    "12px",

  backgroundColor:
    "white",

  border:
    "1px solid #cbd5e1",

  borderRadius:
    "7px",
};

const labelStyle = {
  display:
    "block",

  marginBottom:
    "5px",

  color:
    "#475569",

  fontSize:
    "8px",

  fontWeight:
    "bold",
};

const inputStyle = {
  width:
    "100%",

  boxSizing:
    "border-box",

  padding:
    "8px",

  border:
    "1px solid #94a3b8",

  borderRadius:
    "4px",

  backgroundColor:
    "white",

  fontSize:
    "10px",
};

const panelStyle = {
  backgroundColor:
    "white",

  border:
    "1px solid #cbd5e1",

  borderRadius:
    "7px",

  overflow:
    "hidden",
};

const panelTitleStyle = {
  padding:
    "10px 12px",

  backgroundColor:
    "#0873b9",

  color:
    "white",

  fontSize:
    "12px",

  fontWeight:
    "900",
};

const tableWrapStyle = {
  overflowX:
    "auto",
};

const tableStyle = {
  width:
    "100%",

  minWidth:
    "850px",

  borderCollapse:
    "collapse",
};

const tableHeadStyle = {
  padding:
    "8px",

  backgroundColor:
    "#f1f5f9",

  borderBottom:
    "1px solid #cbd5e1",

  color:
    "#475569",

  fontSize:
    "8px",

  whiteSpace:
    "nowrap",
};

const tableCellStyle = {
  padding:
    "9px 8px",

  borderBottom:
    "1px solid #e2e8f0",

  color:
    "#334155",

  fontSize:
    "9px",

  verticalAlign:
    "top",
};

const badgeStyle = {
  display:
    "inline-block",

  padding:
    "4px 7px",

  borderRadius:
    "10px",

  fontSize:
    "7px",

  fontWeight:
    "900",

  whiteSpace:
    "nowrap",
};

const ledgerNoticeStyle = {
  padding:
    "9px",

  backgroundColor:
    "#ecfeff",

  color:
    "#155e75",

  borderBottom:
    "1px solid #bae6fd",

  textAlign:
    "center",

  fontSize:
    "9px",
};

const emptyStyle = {
  padding:
    "22px",

  color:
    "#64748b",

  textAlign:
    "center",

  fontSize:
    "10px",
};

const safetyNoticeStyle = {
  padding:
    "10px",

  backgroundColor:
    "#f0fdf4",

  border:
    "1px solid #86efac",

  borderRadius:
    "6px",

  color:
    "#166534",

  textAlign:
    "center",

  fontSize:
    "9px",

  fontWeight:
    "bold",
};

const errorStyle = {
  padding:
    "10px",

  backgroundColor:
    "#fef2f2",

  border:
    "1px solid #fecaca",

  borderRadius:
    "6px",

  color:
    "#991b1b",

  fontSize:
    "10px",

  fontWeight:
    "bold",
};
