"use client";

import { useEffect, useMemo, useState } from "react";

export default function ClosingPlatformReadings({
  user,
  currentShift,
}) {
  const [platforms, setPlatforms] = useState([]);
  const [openingRows, setOpeningRows] = useState({});
  const [closingRows, setClosingRows] = useState({});
  const [closingValues, setClosingValues] = useState({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const shopId =
    user?.shop_id ||
    user?.shopId ||
    null;

  const cashierId =
    user?.profile_id ||
    user?.id ||
    user?.user_id ||
    user?.auth_user_id ||
    null;

  const accessToken =
    user?.access_token || null;

  const shiftId =
    currentShift?.id || null;

  // --------------------------------------------------
  // LOAD PLATFORMS + OPENING/CLOSING READINGS
  // --------------------------------------------------

  useEffect(() => {
    if (
      !shopId ||
      !shiftId ||
      !accessToken ||
      !supabaseUrl ||
      !supabaseAnonKey
    ) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadData() {
      try {
        setLoading(true);
        setMessage("");
        setMessageType("");

        // --------------------------------------------
        // LOAD ACTIVE SHOP PLATFORMS
        // --------------------------------------------

        const platformUrl =
          `${supabaseUrl}/rest/v1/shop_platforms` +
          `?shop_id=eq.${encodeURIComponent(shopId)}` +
          `&is_active=eq.true` +
          `&select=id,shop_id,platform_name,reading_type,display_order,is_active` +
          `&order=display_order.asc`;

        const platformResponse = await fetch(
          platformUrl,
          {
            method: "GET",

            headers: {
              apikey: supabaseAnonKey,
              Authorization:
                `Bearer ${accessToken}`,
              "Content-Type":
                "application/json",
            },

            cache: "no-store",
          }
        );

        let platformData = null;

        try {
          platformData =
            await platformResponse.json();
        } catch {
          platformData = null;
        }

        if (!platformResponse.ok) {
          throw new Error(
            platformData?.message ||
              platformData?.details ||
              "Unable to load shop platforms."
          );
        }

        if (cancelled) {
          return;
        }

        const activePlatforms =
          Array.isArray(platformData)
            ? platformData
            : [];

        setPlatforms(activePlatforms);

        // --------------------------------------------
        // LOAD ALL READINGS FOR THIS SHIFT
        // --------------------------------------------

        const readingUrl =
          `${supabaseUrl}/rest/v1/platform_readings` +
          `?shift_id=eq.${encodeURIComponent(shiftId)}` +
          `&select=id,shift_id,platform_id,reading_kind,reading_value,recorded_at,recorded_by` +
          `&order=recorded_at.asc`;

        const readingResponse = await fetch(
          readingUrl,
          {
            method: "GET",

            headers: {
              apikey: supabaseAnonKey,
              Authorization:
                `Bearer ${accessToken}`,
              "Content-Type":
                "application/json",
            },

            cache: "no-store",
          }
        );

        let readingData = null;

        try {
          readingData =
            await readingResponse.json();
        } catch {
          readingData = null;
        }

        if (!readingResponse.ok) {
          throw new Error(
            readingData?.message ||
              readingData?.details ||
              "Unable to load platform readings."
          );
        }

        if (cancelled) {
          return;
        }

        const rows =
          Array.isArray(readingData)
            ? readingData
            : [];

        const openings = {};
        const closings = {};
        const closingInputs = {};

        for (const row of rows) {
          if (!row.platform_id) {
            continue;
          }

          if (row.reading_kind === "OPENING") {
            openings[row.platform_id] = row;
          }

          if (row.reading_kind === "CLOSING") {
            closings[row.platform_id] = row;

            closingInputs[row.platform_id] =
              row.reading_value ?? "";
          }
        }

        setOpeningRows(openings);
        setClosingRows(closings);
        setClosingValues(closingInputs);

        // --------------------------------------------
        // REPAIR total_output ON PAGE REFRESH
        // --------------------------------------------

        const restoredTotal =
          calculateTotalOutput({
            platforms: activePlatforms,
            openings,
            closings,
          });

        await syncShiftTotalOutput(
          restoredTotal
        );
      } catch (error) {
        console.error(
          "LOAD CLOSING READINGS ERROR:",
          error
        );

        if (!cancelled) {
          setMessage(
            error?.message ||
              "Unable to load closing readings."
          );

          setMessageType("error");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [
    shopId,
    shiftId,
    accessToken,
    supabaseUrl,
    supabaseAnonKey,
  ]);

  // --------------------------------------------------
  // SYNC shifts.total_output
  // --------------------------------------------------

  async function syncShiftTotalOutput(totalOutput) {
    if (
      !shiftId ||
      !accessToken ||
      !supabaseUrl ||
      !supabaseAnonKey
    ) {
      return;
    }

    const response = await fetch(
      `${supabaseUrl}/rest/v1/shifts?id=eq.${encodeURIComponent(
        shiftId
      )}`,
      {
        method: "PATCH",

        headers: {
          apikey: supabaseAnonKey,
          Authorization:
            `Bearer ${accessToken}`,
          "Content-Type":
            "application/json",
          Prefer:
            "return=minimal",
        },

        body: JSON.stringify({
          total_output:
            roundMoney(totalOutput),
        }),
      }
    );

    if (!response.ok) {
      let result = null;

      try {
        result =
          await response.json();
      } catch {
        result = null;
      }

      console.error(
        "TOTAL OUTPUT UPDATE ERROR:",
        result
      );

      throw new Error(
        result?.message ||
          result?.details ||
          result?.hint ||
          "Unable to update total output."
      );
    }
  }

  // --------------------------------------------------
  // INPUT CHANGE
  // --------------------------------------------------

  function updateClosingValue(
    platformId,
    value
  ) {
    setClosingValues((previous) => ({
      ...previous,
      [platformId]: value,
    }));

    setMessage("");
    setMessageType("");
  }

  // --------------------------------------------------
  // TOTAL OUTPUT SHOWN ON SCREEN
  // --------------------------------------------------

  const displayedTotalOutput =
    useMemo(() => {
      let total = 0;

      for (const platform of platforms) {
        const opening =
          Number(
            openingRows[
              platform.id
            ]?.reading_value
          );

        const closingRaw =
          closingValues[
            platform.id
          ];

        if (
          Number.isNaN(opening) ||
          closingRaw === undefined ||
          closingRaw === null ||
          closingRaw === ""
        ) {
          continue;
        }

        const closing =
          Number(closingRaw);

        if (
          Number.isNaN(closing) ||
          closing < opening
        ) {
          continue;
        }

        total +=
          closing - opening;
      }

      return roundMoney(total);
    }, [
      platforms,
      openingRows,
      closingValues,
    ]);

  // --------------------------------------------------
  // SAVE CLOSING READINGS
  // --------------------------------------------------

  async function saveClosingReadings() {
    if (!shiftId) {
      setMessage(
        "No open shift was found."
      );
      setMessageType("error");
      return;
    }

    if (!cashierId) {
      setMessage(
        "Cashier information is missing."
      );
      setMessageType("error");
      return;
    }

    if (!accessToken) {
      setMessage(
        "Login authentication is missing. Please log in again."
      );
      setMessageType("error");
      return;
    }

    const unsavedPlatforms =
      platforms.filter(
        (platform) =>
          !closingRows[platform.id]
      );

    if (
      unsavedPlatforms.length === 0
    ) {
      setMessage(
        "All closing readings have already been saved."
      );
      setMessageType("success");
      return;
    }

    const rowsToSave = [];

    for (const platform of unsavedPlatforms) {
      const openingRow =
        openingRows[platform.id];

      if (!openingRow) {
        setMessage(
          `Opening reading is missing for ${platform.platform_name}.`
        );
        setMessageType("error");
        return;
      }

      const rawClosing =
        closingValues[
          platform.id
        ];

      if (
        rawClosing === undefined ||
        rawClosing === null ||
        rawClosing === ""
      ) {
        setMessage(
          `Enter the closing reading for ${platform.platform_name}.`
        );
        setMessageType("error");
        return;
      }

      const opening =
        Number(
          openingRow.reading_value
        );

      const closing =
        Number(rawClosing);

      if (
        Number.isNaN(closing) ||
        closing < 0
      ) {
        setMessage(
          `Enter a valid closing reading for ${platform.platform_name}.`
        );
        setMessageType("error");
        return;
      }

      if (closing < opening) {
        setMessage(
          `${platform.platform_name} closing reading cannot be lower than its opening reading of ${opening}.`
        );
        setMessageType("error");
        return;
      }

      rowsToSave.push({
        platform,
        closing,
      });
    }

    try {
      setSaving(true);
      setMessage("");
      setMessageType("");

      const recordedAt =
        new Date().toISOString();

      const newClosingRows = {
        ...closingRows,
      };

      for (const item of rowsToSave) {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/platform_readings`,
          {
            method: "POST",

            headers: {
              apikey: supabaseAnonKey,
              Authorization:
                `Bearer ${accessToken}`,
              "Content-Type":
                "application/json",
              Prefer:
                "return=representation",
            },

            body: JSON.stringify({
              shift_id: shiftId,

              platform_id:
                item.platform.id,

              reading_kind:
                "CLOSING",

              reading_value:
                roundMoney(
                  item.closing
                ),

              recorded_at:
                recordedAt,

              recorded_by:
                cashierId,
            }),
          }
        );

        let result = null;

        try {
          result =
            await response.json();
        } catch {
          result = null;
        }

        if (!response.ok) {
          console.error(
            "CLOSING READING INSERT ERROR:",
            result
          );

          throw new Error(
            result?.message ||
              result?.details ||
              result?.hint ||
              `Unable to save ${item.platform.platform_name}.`
          );
        }

        if (
          Array.isArray(result) &&
          result.length > 0
        ) {
          newClosingRows[
            item.platform.id
          ] = result[0];
        }
      }

      setClosingRows(
        newClosingRows
      );

      // --------------------------------------------
      // RECALCULATE OUTPUT FROM SAVED VALUES
      // --------------------------------------------

      const newTotalOutput =
        calculateTotalOutput({
          platforms,
          openings: openingRows,
          closings:
            newClosingRows,
        });

      await syncShiftTotalOutput(
        newTotalOutput
      );

      setMessage(
        "Closing readings saved and total output updated successfully."
      );

      setMessageType("success");
    } catch (error) {
      console.error(
        "SAVE CLOSING READINGS ERROR:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to save closing readings."
      );

      setMessageType("error");
    } finally {
      setSaving(false);
    }
  }

  // --------------------------------------------------
  // COUNTS
  // --------------------------------------------------

  const savedCount =
    platforms.filter(
      (platform) =>
        Boolean(
          closingRows[
            platform.id
          ]
        )
    ).length;

  const allSaved =
    platforms.length > 0 &&
    savedCount === platforms.length;

  // --------------------------------------------------
  // DISPLAY
  // --------------------------------------------------

  if (!currentShift) {
    return null;
  }

  return (
    <div
      style={{
        marginTop: "24px",
        backgroundColor: "white",
        padding: "25px",
        borderRadius: "12px",
        boxShadow:
          "0 2px 10px rgba(0,0,0,0.08)",
        maxWidth: "700px",
      }}
    >
      <h2
        style={{
          marginTop: 0,
          marginBottom: "6px",
        }}
      >
        Closing Platform Readings
      </h2>

      <p
        style={{
          marginTop: 0,
          marginBottom: "8px",
          color: "#64748b",
        }}
      >
        Enter the final reading for each platform.
        Output is Closing minus Opening.
      </p>

      <div
        style={{
          marginBottom: "20px",
          color: "#15803d",
          fontWeight: "bold",
        }}
      >
        Saved: {savedCount} / {platforms.length}
      </div>

      {/* TOTAL OUTPUT */}

      <div
        style={{
          padding: "16px",
          backgroundColor: "#f8fafc",
          border:
            "1px solid #e2e8f0",
          borderRadius: "10px",
          marginBottom: "22px",
        }}
      >
        <div
          style={{
            color: "#64748b",
            fontSize: "13px",
          }}
        >
          Total Output
        </div>

        <div
          style={{
            fontSize: "22px",
            fontWeight: "bold",
            marginTop: "5px",
          }}
        >
          {Number(
            displayedTotalOutput
          ).toLocaleString(
            "en-KE",
            {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }
          )}
        </div>
      </div>

      {loading ? (
        <div>
          Loading closing readings...
        </div>
      ) : platforms.length === 0 ? (
        <div
          style={{
            padding: "12px",
            backgroundColor: "#fff7ed",
            color: "#9a3412",
            borderRadius: "8px",
          }}
        >
          No active platforms are assigned to this shop.
        </div>
      ) : (
        <>
          {platforms.map(
            (platform) => {
              const opening =
                openingRows[
                  platform.id
                ]?.reading_value;

              const savedRow =
                closingRows[
                  platform.id
                ];

              const saved =
                Boolean(savedRow);

              const closingValue =
                closingValues[
                  platform.id
                ] ?? "";

              const output =
                opening !== undefined &&
                opening !== null &&
                closingValue !== ""
                  ? Math.max(
                      0,
                      Number(
                        closingValue
                      ) -
                        Number(
                          opening
                        )
                    )
                  : 0;

              return (
                <div
                  key={platform.id}
                  style={{
                    marginBottom: "18px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      gap: "15px",
                      marginBottom: "7px",
                    }}
                  >
                    <label
                      style={{
                        fontWeight:
                          "bold",
                      }}
                    >
                      {platform.platform_name}
                    </label>

                    {saved && (
                      <span
                        style={{
                          color: "#15803d",
                          fontWeight: "bold",
                          fontSize: "13px",
                        }}
                      >
                        Saved ✓
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      fontSize: "12px",
                      color: "#64748b",
                      marginBottom: "6px",
                    }}
                  >
                    Opening:{" "}
                    {opening ?? "Missing"}
                    {" • "}
                    Output:{" "}
                    {Number(
                      output
                    ).toLocaleString(
                      "en-KE",
                      {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }
                    )}
                  </div>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      closingValue
                    }
                    disabled={
                      saving ||
                      saved
                    }
                    onChange={(e) =>
                      updateClosingValue(
                        platform.id,
                        e.target.value
                      )
                    }
                    placeholder={`Enter ${platform.platform_name} closing reading`}
                    style={{
                      width: "100%",
                      padding: "13px",
                      border: saved
                        ? "1px solid #86efac"
                        : "1px solid #cbd5e1",
                      borderRadius: "8px",
                      boxSizing:
                        "border-box",
                      fontSize: "16px",

                      backgroundColor:
                        saved
                          ? "#f0fdf4"
                          : "white",
                    }}
                  />
                </div>
              );
            }
          )}

          {message && (
            <div
              style={{
                padding: "12px",
                marginBottom: "16px",
                borderRadius: "8px",

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

          {allSaved ? (
            <div
              style={{
                padding: "14px",
                backgroundColor: "#ecfdf5",
                color: "#166534",
                borderRadius: "8px",
                textAlign: "center",
                fontWeight: "bold",
              }}
            >
              All closing readings saved ✓
            </div>
          ) : (
            <button
              type="button"
              onClick={
                saveClosingReadings
              }
              disabled={saving}
              style={{
                width: "100%",
                padding: "14px",
                border: "none",
                borderRadius: "8px",

                backgroundColor:
                  saving
                    ? "#94a3b8"
                    : "#168d32",

                color: "white",
                fontSize: "16px",
                fontWeight: "bold",

                cursor:
                  saving
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {saving
                ? "Saving..."
                : "Save Closing Readings"}
            </button>
          )}
        </>
      )}
    </div>
  );
}

// --------------------------------------------------
// CALCULATE TOTAL OUTPUT FROM SAVED ROWS
// --------------------------------------------------

function calculateTotalOutput({
  platforms,
  openings,
  closings,
}) {
  let total = 0;

  for (const platform of platforms) {
    const openingRow =
      openings[
        platform.id
      ];

    const closingRow =
      closings[
        platform.id
      ];

    if (
      !openingRow ||
      !closingRow
    ) {
      continue;
    }

    const opening =
      Number(
        openingRow.reading_value
      );

    const closing =
      Number(
        closingRow.reading_value
      );

    if (
      Number.isNaN(opening) ||
      Number.isNaN(closing)
    ) {
      continue;
    }

    if (closing < opening) {
      continue;
    }

    total +=
      closing - opening;
  }

  return roundMoney(total);
}

// --------------------------------------------------
// ROUND MONEY
// --------------------------------------------------

function roundMoney(value) {
  return (
    Math.round(
      (Number(value) +
        Number.EPSILON) *
        100
    ) / 100
  );
}
