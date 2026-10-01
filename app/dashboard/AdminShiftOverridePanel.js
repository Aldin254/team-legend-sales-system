"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

export default function AdminShiftOverridePanel({
  user,
}) {
  const [shops, setShops] = useState([]);
  const [selectedShopId, setSelectedShopId] = useState("");

  const [latestClosed, setLatestClosed] = useState(null);
  const [openShift, setOpenShift] = useState(null);

  const [openingBalance, setOpeningBalance] = useState("");
  const [tableCarryForward, setTableCarryForward] = useState(null);

  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const accessToken =
    user?.access_token || null;

  const adminName =
    user?.full_name ||
    user?.name ||
    user?.username ||
    "Admin";

  // ==================================================
  // HEADERS
  // ==================================================

  function headers(prefer = null) {
    const result = {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };

    if (prefer) {
      result.Prefer = prefer;
    }

    return result;
  }

  // ==================================================
  // LOAD 12-HOUR SHOPS
  // ==================================================

  const loadShops = useCallback(
    async () => {
      if (
        !supabaseUrl ||
        !supabaseAnonKey ||
        !accessToken
      ) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/shops` +
            `?shop_type=eq.12_HOUR` +
            `&is_active=eq.true` +
            `&select=id,shop_name,shop_type` +
            `&order=shop_name.asc`,
          {
            method: "GET",
            headers: headers(),
            cache: "no-store",
          }
        );

        const result =
          await safeJson(response);

        if (!response.ok) {
          throw new Error(
            result?.message ||
              result?.details ||
              "Unable to load 12-hour shops."
          );
        }

        const loaded =
          Array.isArray(result)
            ? result
            : [];

        setShops(loaded);

        setSelectedShopId(
          (previous) =>
            previous ||
            loaded[0]?.id ||
            ""
        );
      } catch (error) {
        console.error(
          "LOAD OVERRIDE SHOPS ERROR:",
          error
        );

        setMessage(
          error?.message ||
            "Unable to load shops."
        );

        setMessageType("error");
      }
    },
    [
      supabaseUrl,
      supabaseAnonKey,
      accessToken,
    ]
  );

  // ==================================================
  // LOAD SELECTED SHOP STATUS
  // ==================================================

  const loadShopStatus = useCallback(
    async () => {
      if (
        !selectedShopId ||
        !supabaseUrl ||
        !supabaseAnonKey ||
        !accessToken
      ) {
        return;
      }

      try {
        setLoading(true);
        setMessage("");

        // ------------------------------------------
        // CHECK FOR OPEN SHIFT
        // ------------------------------------------

        const openResponse = await fetch(
          `${supabaseUrl}/rest/v1/shifts` +
            `?shop_id=eq.${encodeURIComponent(selectedShopId)}` +
            `&status=eq.OPEN` +
            `&select=*` +
            `&order=opened_at.desc` +
            `&limit=1`,
          {
            method: "GET",
            headers: headers(),
            cache: "no-store",
          }
        );

        const openResult =
          await safeJson(openResponse);

        if (!openResponse.ok) {
          throw new Error(
            openResult?.message ||
              openResult?.details ||
              "Unable to check open shift."
          );
        }

        const existingOpen =
          Array.isArray(openResult) &&
          openResult.length > 0
            ? openResult[0]
            : null;

        setOpenShift(existingOpen);

        // ------------------------------------------
        // LATEST CLOSED SHIFT
        // ------------------------------------------

        const closedResponse = await fetch(
          `${supabaseUrl}/rest/v1/shifts` +
            `?shop_id=eq.${encodeURIComponent(selectedShopId)}` +
            `&status=eq.CLOSED` +
            `&select=*` +
            `&order=closed_at.desc` +
            `&limit=1`,
          {
            method: "GET",
            headers: headers(),
            cache: "no-store",
          }
        );

        const closedResult =
          await safeJson(closedResponse);

        if (!closedResponse.ok) {
          throw new Error(
            closedResult?.message ||
              closedResult?.details ||
              "Unable to load latest closed shift."
          );
        }

        const previous =
          Array.isArray(closedResult) &&
          closedResult.length > 0
            ? closedResult[0]
            : null;

        setLatestClosed(previous);

        if (!previous) {
          setOpeningBalance("");
          setTableCarryForward(null);
          return;
        }

        setOpeningBalance(
          String(
            previous.closing_balance ?? 0
          )
        );

        // ------------------------------------------
        // FIND TABLE PLATFORM
        // ------------------------------------------

        const platformResponse =
          await fetch(
            `${supabaseUrl}/rest/v1/shop_platforms` +
              `?shop_id=eq.${encodeURIComponent(selectedShopId)}` +
              `&platform_name=ilike.TABLE` +
              `&is_active=eq.true` +
              `&select=id,platform_name` +
              `&limit=1`,
            {
              method: "GET",
              headers: headers(),
              cache: "no-store",
            }
          );

        const platformResult =
          await safeJson(
            platformResponse
          );

        if (!platformResponse.ok) {
          throw new Error(
            platformResult?.message ||
              platformResult?.details ||
              "Unable to find TABLE platform."
          );
        }

        if (
          !Array.isArray(platformResult) ||
          platformResult.length === 0
        ) {
          setTableCarryForward(null);
          return;
        }

        const tablePlatform =
          platformResult[0];

        // ------------------------------------------
        // PREVIOUS TABLE CLOSING
        // ------------------------------------------

        const readingResponse =
          await fetch(
            `${supabaseUrl}/rest/v1/platform_readings` +
              `?shift_id=eq.${encodeURIComponent(previous.id)}` +
              `&platform_id=eq.${encodeURIComponent(tablePlatform.id)}` +
              `&reading_kind=eq.CLOSING` +
              `&select=id,reading_value,recorded_at` +
              `&order=recorded_at.desc` +
              `&limit=1`,
            {
              method: "GET",
              headers: headers(),
              cache: "no-store",
            }
          );

        const readingResult =
          await safeJson(
            readingResponse
          );

        if (!readingResponse.ok) {
          throw new Error(
            readingResult?.message ||
              readingResult?.details ||
              "Unable to load TABLE closing."
          );
        }

        const reading =
          Array.isArray(readingResult) &&
          readingResult.length > 0
            ? readingResult[0]
            : null;

        setTableCarryForward(
          reading
            ? {
                platform:
                  tablePlatform,

                value:
                  Number(
                    reading.reading_value
                  ),
              }
            : {
                platform:
                  tablePlatform,

                value:
                  null,
              }
        );
      } catch (error) {
        console.error(
          "LOAD OVERRIDE STATUS ERROR:",
          error
        );

        setMessage(
          error?.message ||
            "Unable to load shift status."
        );

        setMessageType("error");
      } finally {
        setLoading(false);
      }
    },
    [
      selectedShopId,
      supabaseUrl,
      supabaseAnonKey,
      accessToken,
    ]
  );

  // ==================================================
  // INITIAL LOAD
  // ==================================================

  useEffect(() => {
    loadShops();
  }, [loadShops]);

  useEffect(() => {
    loadShopStatus();
  }, [loadShopStatus]);

  // ==================================================
  // ADMIN REOPEN
  // ==================================================

  async function reopenShop() {
    if (!latestClosed) {
      setMessage(
        "There is no previous closed shift to reopen from."
      );

      setMessageType("error");
      return;
    }

    if (openShift) {
      setMessage(
        "This shop already has an OPEN shift."
      );

      setMessageType("error");
      return;
    }

    const balance =
      Number(openingBalance);

    if (
      openingBalance === "" ||
      Number.isNaN(balance) ||
      balance < 0
    ) {
      setMessage(
        "Enter a valid Balance B/F."
      );

      setMessageType("error");
      return;
    }

    if (
      tableCarryForward?.platform &&
      tableCarryForward.value === null
    ) {
      setMessage(
        "Previous TABLE closing is missing. Correct TABLE before reopening this shop."
      );

      setMessageType("error");
      return;
    }

    const confirmed =
      window.confirm(
        "ADMIN OVERRIDE\n\n" +
          "Reopen this 12-hour shop today?\n\n" +
          "This bypasses the normal same-day cashier lock."
      );

    if (!confirmed) {
      return;
    }

    try {
      setOpening(true);
      setMessage("");

      // ------------------------------------------
      // RECHECK FOR OPEN SHIFT
      // ------------------------------------------

      const checkResponse =
        await fetch(
          `${supabaseUrl}/rest/v1/shifts` +
            `?shop_id=eq.${encodeURIComponent(selectedShopId)}` +
            `&status=eq.OPEN` +
            `&select=id` +
            `&limit=1`,
          {
            method: "GET",
            headers: headers(),
            cache: "no-store",
          }
        );

      const checkResult =
        await safeJson(
          checkResponse
        );

      if (!checkResponse.ok) {
        throw new Error(
          "Unable to recheck shop status."
        );
      }

      if (
        Array.isArray(checkResult) &&
        checkResult.length > 0
      ) {
        throw new Error(
          "This shop already has an OPEN shift."
        );
      }

      const now =
        new Date();

      const end =
        new Date(
          now.getTime() +
            12 * 60 * 60 * 1000
        );

      const businessDate =
        getNairobiBusinessDate(
          now
        );

      // ------------------------------------------
      // CREATE ADMIN OVERRIDE SHIFT
      // ------------------------------------------

      const response =
        await fetch(
          `${supabaseUrl}/rest/v1/shifts`,
          {
            method: "POST",

            headers:
              headers(
                "return=representation"
              ),

            body:
              JSON.stringify({
                shop_id:
                  selectedShopId,

                cashier_id:
                  latestClosed.cashier_id,

                cashier_name:
                  latestClosed.cashier_name,

                shift_name:
                  "ADMIN OVERRIDE",

                business_date:
                  businessDate,

                scheduled_start:
                  formatNairobiTime(
                    now
                  ),

                scheduled_end:
                  formatNairobiTime(
                    end
                  ),

                opened_at:
                  now.toISOString(),

                status:
                  "OPEN",

                opening_balance:
                  balance,

                total_added_float:
                  0,

                total_output:
                  0,

                total_expenses:
                  0,

                net_income:
                  0,

                closing_balance:
                  0,

                notes:
                  `ADMIN OVERRIDE by ${adminName}`,
              }),
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
            "Unable to reopen shop."
        );
      }

      if (
        !Array.isArray(result) ||
        result.length === 0
      ) {
        throw new Error(
          "Override shift was not returned."
        );
      }

      const newShift =
        result[0];

      // ------------------------------------------
      // TABLE CARRY FORWARD
      // ------------------------------------------

      if (
        tableCarryForward?.platform &&
        tableCarryForward.value !== null
      ) {
        const tableResponse =
          await fetch(
            `${supabaseUrl}/rest/v1/platform_readings`,
            {
              method: "POST",

              headers:
                headers(
                  "return=representation"
                ),

              body:
                JSON.stringify({
                  shift_id:
                    newShift.id,

                  platform_id:
                    tableCarryForward
                      .platform.id,

                  reading_kind:
                    "OPENING",

                  reading_value:
                    tableCarryForward
                      .value,

                  recorded_at:
                    now.toISOString(),

                  recorded_by:
                    latestClosed.cashier_id,
                }),
            }
          );

        const tableResult =
          await safeJson(
            tableResponse
          );

        if (!tableResponse.ok) {
          throw new Error(
            tableResult?.message ||
              "Shift opened, but TABLE carry-forward failed."
          );
        }
      }

      setMessage(
        "Admin override successful. Shop has been reopened."
      );

      setMessageType(
        "success"
      );

      await loadShopStatus();
    } catch (error) {
      console.error(
        "ADMIN OVERRIDE ERROR:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to reopen shop."
      );

      setMessageType("error");
    } finally {
      setOpening(false);
    }
  }

  const selectedShop =
    shops.find(
      (shop) =>
        shop.id ===
        selectedShopId
    );

  // ==================================================
  // DISPLAY
  // ==================================================

  return (
    <section style={panelStyle}>
      <div style={titleStyle}>
        ADMIN SHIFT OVERRIDE
      </div>

      <div style={contentStyle}>
        <label style={labelStyle}>
          12-HOUR SHOP
        </label>

        <select
          value={selectedShopId}
          onChange={(event) => {
            setSelectedShopId(
              event.target.value
            );

            setMessage("");
          }}
          style={selectStyle}
        >
          {shops.map(
            (shop) => (
              <option
                key={shop.id}
                value={shop.id}
              >
                {shop.shop_name}
              </option>
            )
          )}
        </select>

        {loading ? (
          <div style={infoStyle}>
            Loading shift status...
          </div>
        ) : (
          <>
            <div style={statusGridStyle}>
              <StatusBox
                title="SHOP"
                value={
                  selectedShop?.shop_name ||
                  "-"
                }
              />

              <StatusBox
                title="CURRENT STATUS"
                value={
                  openShift
                    ? "OPEN"
                    : "CLOSED"
                }
                good={
                  !openShift
                }
              />

              <StatusBox
                title="PREVIOUS CASHIER"
                value={
                  latestClosed?.cashier_name ||
                  "-"
                }
              />

              <StatusBox
                title="PREVIOUS CLOSE"
                value={
                  latestClosed?.closed_at
                    ? formatDateTime(
                        latestClosed.closed_at
                      )
                    : "-"
                }
              />
            </div>

            <div style={fieldGridStyle}>
              <div>
                <label style={labelStyle}>
                  BALANCE B/F
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    openingBalance
                  }
                  onChange={(event) =>
                    setOpeningBalance(
                      event.target.value
                    )
                  }
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>
                  TABLE OPENING
                </label>

                <div style={readOnlyStyle}>
                  {tableCarryForward?.value ??
                    "-"}
                </div>
              </div>
            </div>

            {message && (
              <div
                style={{
                  ...messageStyle,

                  backgroundColor:
                    messageType ===
                    "success"
                      ? "#ecfdf5"
                      : "#fef2f2",

                  color:
                    messageType ===
                    "success"
                      ? "#166534"
                      : "#991b1b",
                }}
              >
                {message}
              </div>
            )}

            <button
              type="button"
              onClick={reopenShop}
              disabled={
                opening ||
                Boolean(openShift) ||
                !latestClosed
              }
              style={{
                ...overrideButtonStyle,

                backgroundColor:
                  opening ||
                  openShift ||
                  !latestClosed
                    ? "#94a3b8"
                    : "#dc2626",
              }}
            >
              {opening
                ? "OPENING..."
                : openShift
                ? "SHOP ALREADY OPEN"
                : "ADMIN OVERRIDE — REOPEN SHOP TODAY"}
            </button>

            <div style={warningStyle}>
              Admin Override bypasses the normal same-day lock for a 12-hour shop.
            </div>
          </>
        )}
      </div>
    </section>
  );
}

// ==================================================
// SMALL COMPONENT
// ==================================================

function StatusBox({
  title,
  value,
  good,
}) {
  return (
    <div style={statusBoxStyle}>
      <div style={statusTitleStyle}>
        {title}
      </div>

      <div
        style={{
          ...statusValueStyle,

          color:
            good
              ? "#166534"
              : "#0f172a",
        }}
      >
        {value}
      </div>
    </div>
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

function getNairobiBusinessDate(
  date = new Date()
) {
  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          "Africa/Nairobi",

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",
      }
    ).formatToParts(
      date
    );

  const year =
    parts.find(
      (part) =>
        part.type === "year"
    )?.value;

  const month =
    parts.find(
      (part) =>
        part.type === "month"
    )?.value;

  const day =
    parts.find(
      (part) =>
        part.type === "day"
    )?.value;

  return `${year}-${month}-${day}`;
}

function formatNairobiTime(
  date
) {
  const parts =
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone:
          "Africa/Nairobi",

        hour:
          "2-digit",

        minute:
          "2-digit",

        second:
          "2-digit",

        hour12:
          false,
      }
    ).formatToParts(
      date
    );

  const hour =
    parts.find(
      (part) =>
        part.type === "hour"
    )?.value || "00";

  const minute =
    parts.find(
      (part) =>
        part.type === "minute"
    )?.value || "00";

  const second =
    parts.find(
      (part) =>
        part.type === "second"
    )?.value || "00";

  return `${hour}:${minute}:${second}`;
}

function formatDateTime(
  value
) {
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
    }
  ).format(
    new Date(value)
  );
}

// ==================================================
// STYLES
// ==================================================

const panelStyle = {
  backgroundColor:
    "white",

  borderRadius:
    "8px",

  overflow:
    "hidden",

  boxShadow:
    "0 1px 6px rgba(0,0,0,0.12)",

  marginTop:
    "20px",
};

const titleStyle = {
  backgroundColor:
    "#7f1d1d",

  color:
    "white",

  padding:
    "13px 15px",

  fontWeight:
    "bold",

  fontSize:
    "16px",
};

const contentStyle = {
  padding:
    "15px",
};

const labelStyle = {
  display:
    "block",

  fontSize:
    "10px",

  fontWeight:
    "bold",

  marginBottom:
    "5px",
};

const selectStyle = {
  width:
    "100%",

  padding:
    "9px",

  border:
    "1px solid #94a3b8",

  borderRadius:
    "5px",

  marginBottom:
    "15px",
};

const statusGridStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "repeat(4,1fr)",

  gap:
    "8px",

  marginBottom:
    "15px",
};

const statusBoxStyle = {
  border:
    "1px solid #e2e8f0",

  borderRadius:
    "6px",

  padding:
    "10px",

  backgroundColor:
    "#f8fafc",

  textAlign:
    "center",
};

const statusTitleStyle = {
  fontSize:
    "9px",

  fontWeight:
    "bold",

  color:
    "#64748b",
};

const statusValueStyle = {
  marginTop:
    "6px",

  fontWeight:
    "bold",

  fontSize:
    "12px",
};

const fieldGridStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "1fr 1fr",

  gap:
    "10px",

  marginBottom:
    "15px",
};

const inputStyle = {
  width:
    "100%",

  boxSizing:
    "border-box",

  padding:
    "10px",

  border:
    "1px solid #94a3b8",

  borderRadius:
    "5px",
};

const readOnlyStyle = {
  padding:
    "10px",

  backgroundColor:
    "#ecfdf5",

  border:
    "1px solid #86efac",

  borderRadius:
    "5px",

  fontWeight:
    "bold",
};

const overrideButtonStyle = {
  width:
    "100%",

  border:
    "none",

  color:
    "white",

  padding:
    "12px",

  borderRadius:
    "5px",

  fontWeight:
    "bold",

  cursor:
    "pointer",
};

const warningStyle = {
  marginTop:
    "8px",

  fontSize:
    "10px",

  color:
    "#991b1b",

  textAlign:
    "center",
};

const messageStyle = {
  padding:
    "10px",

  marginBottom:
    "12px",

  borderRadius:
    "5px",

  fontSize:
    "11px",
};

const infoStyle = {
  padding:
    "20px",

  textAlign:
    "center",

  color:
    "#64748b",
};
