"use client";

import { useEffect, useState } from "react";

export default function CloseShift({
  user,
  currentShift,
  onShiftClosed,
}) {
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);

  const [shiftData, setShiftData] = useState(null);

  const [platformCount, setPlatformCount] = useState(0);
  const [closingCount, setClosingCount] = useState(0);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const accessToken =
    user?.access_token || null;

  const shopId =
    user?.shop_id ||
    user?.shopId ||
    null;

  const shiftId =
    currentShift?.id || null;

  // --------------------------------------------------
  // LOAD FINAL SHIFT INFORMATION
  // --------------------------------------------------

  useEffect(() => {
    if (
      !shiftId ||
      !shopId ||
      !accessToken ||
      !supabaseUrl ||
      !supabaseAnonKey
    ) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadCloseShiftData() {
      try {
        setLoading(true);
        setMessage("");
        setMessageType("");

        // --------------------------------------------
        // GET LATEST SHIFT VALUES
        // --------------------------------------------

        const shiftResponse = await fetch(
          `${supabaseUrl}/rest/v1/shifts` +
            `?id=eq.${encodeURIComponent(shiftId)}` +
            `&select=*` +
            `&limit=1`,
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

        let shiftResult = null;

        try {
          shiftResult =
            await shiftResponse.json();
        } catch {
          shiftResult = null;
        }

        if (!shiftResponse.ok) {
          throw new Error(
            shiftResult?.message ||
              shiftResult?.details ||
              "Unable to load shift information."
          );
        }

        const latestShift =
          Array.isArray(shiftResult) &&
          shiftResult.length > 0
            ? shiftResult[0]
            : null;

        if (!latestShift) {
          throw new Error(
            "Current shift could not be found."
          );
        }

        // --------------------------------------------
        // GET ACTIVE SHOP PLATFORMS
        // --------------------------------------------

        const platformResponse = await fetch(
          `${supabaseUrl}/rest/v1/shop_platforms` +
            `?shop_id=eq.${encodeURIComponent(shopId)}` +
            `&is_active=eq.true` +
            `&select=id`,
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

        let platformResult = null;

        try {
          platformResult =
            await platformResponse.json();
        } catch {
          platformResult = null;
        }

        if (!platformResponse.ok) {
          throw new Error(
            platformResult?.message ||
              platformResult?.details ||
              "Unable to load shop platforms."
          );
        }

        const platforms =
          Array.isArray(platformResult)
            ? platformResult
            : [];

        // --------------------------------------------
        // GET CLOSING READINGS
        // --------------------------------------------

        const readingsResponse = await fetch(
          `${supabaseUrl}/rest/v1/platform_readings` +
            `?shift_id=eq.${encodeURIComponent(shiftId)}` +
            `&reading_kind=eq.CLOSING` +
            `&select=id,platform_id,reading_value`,
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

        let readingsResult = null;

        try {
          readingsResult =
            await readingsResponse.json();
        } catch {
          readingsResult = null;
        }

        if (!readingsResponse.ok) {
          throw new Error(
            readingsResult?.message ||
              readingsResult?.details ||
              "Unable to check closing readings."
          );
        }

        const closingRows =
          Array.isArray(readingsResult)
            ? readingsResult
            : [];

        const platformIds =
          new Set(
            platforms.map(
              (platform) => platform.id
            )
          );

        const savedClosingPlatformIds =
          new Set();

        for (const row of closingRows) {
          if (
            row.platform_id &&
            platformIds.has(row.platform_id)
          ) {
            savedClosingPlatformIds.add(
              row.platform_id
            );
          }
        }

        if (cancelled) {
          return;
        }

        setShiftData(latestShift);
        setPlatformCount(platforms.length);
        setClosingCount(
          savedClosingPlatformIds.size
        );
      } catch (error) {
        console.error(
          "CLOSE SHIFT LOAD ERROR:",
          error
        );

        if (!cancelled) {
          setMessage(
            error?.message ||
              "Unable to prepare shift closing."
          );

          setMessageType("error");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadCloseShiftData();

    return () => {
      cancelled = true;
    };
  }, [
    shiftId,
    shopId,
    accessToken,
    supabaseUrl,
    supabaseAnonKey,
  ]);

  // --------------------------------------------------
  // CLOSE SHIFT
  // --------------------------------------------------

  async function closeShift() {
    if (!shiftId) {
      setMessage(
        "No open shift was found."
      );
      setMessageType("error");
      return;
    }

    if (!accessToken) {
      setMessage(
        "Authentication is missing. Please log in again."
      );
      setMessageType("error");
      return;
    }

    try {
      setClosing(true);
      setMessage("");
      setMessageType("");

      // --------------------------------------------
      // RECHECK ACTIVE PLATFORMS
      // --------------------------------------------

      const platformResponse = await fetch(
        `${supabaseUrl}/rest/v1/shop_platforms` +
          `?shop_id=eq.${encodeURIComponent(shopId)}` +
          `&is_active=eq.true` +
          `&select=id`,
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

      const platforms =
        await platformResponse.json();

      if (!platformResponse.ok) {
        throw new Error(
          platforms?.message ||
            platforms?.details ||
            "Unable to check active platforms."
        );
      }

      // --------------------------------------------
      // RECHECK CLOSING READINGS
      // --------------------------------------------

      const readingsResponse = await fetch(
        `${supabaseUrl}/rest/v1/platform_readings` +
          `?shift_id=eq.${encodeURIComponent(shiftId)}` +
          `&reading_kind=eq.CLOSING` +
          `&select=id,platform_id`,
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

      const closingRows =
        await readingsResponse.json();

      if (!readingsResponse.ok) {
        throw new Error(
          closingRows?.message ||
            closingRows?.details ||
            "Unable to verify closing readings."
        );
      }

      const activePlatformIds =
        new Set(
          platforms.map(
            (platform) => platform.id
          )
        );

      const closingPlatformIds =
        new Set();

      for (const row of closingRows) {
        if (
          row.platform_id &&
          activePlatformIds.has(
            row.platform_id
          )
        ) {
          closingPlatformIds.add(
            row.platform_id
          );
        }
      }

      if (
        closingPlatformIds.size !==
        activePlatformIds.size
      ) {
        setPlatformCount(
          activePlatformIds.size
        );

        setClosingCount(
          closingPlatformIds.size
        );

        throw new Error(
          `All platform closing readings must be saved first. Saved ${closingPlatformIds.size} of ${activePlatformIds.size}.`
        );
      }

      // --------------------------------------------
      // GET FRESH SHIFT TOTALS
      // --------------------------------------------

      const currentResponse = await fetch(
        `${supabaseUrl}/rest/v1/shifts` +
          `?id=eq.${encodeURIComponent(shiftId)}` +
          `&select=*` +
          `&limit=1`,
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

      const currentResult =
        await currentResponse.json();

      if (!currentResponse.ok) {
        throw new Error(
          currentResult?.message ||
            currentResult?.details ||
            "Unable to verify shift totals."
        );
      }

      if (
        !Array.isArray(currentResult) ||
        currentResult.length === 0
      ) {
        throw new Error(
          "Current shift was not found."
        );
      }

      const freshShift =
        currentResult[0];

      if (
        String(
          freshShift.status || ""
        ).toUpperCase() !== "OPEN"
      ) {
        throw new Error(
          "This shift is no longer open."
        );
      }

      // --------------------------------------------
      // CLOSE SHIFT
      // --------------------------------------------

      const closedAt =
        new Date().toISOString();

      const closeResponse = await fetch(
        `${supabaseUrl}/rest/v1/shifts` +
          `?id=eq.${encodeURIComponent(shiftId)}`,
        {
          method: "PATCH",
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
            status: "CLOSED",
            closed_at: closedAt,
          }),
        }
      );

      let closeResult = null;

      try {
        closeResult =
          await closeResponse.json();
      } catch {
        closeResult = null;
      }

      if (!closeResponse.ok) {
        console.error(
          "CLOSE SHIFT UPDATE ERROR:",
          closeResult
        );

        throw new Error(
          closeResult?.message ||
            closeResult?.details ||
            closeResult?.hint ||
            "Unable to close shift."
        );
      }

      const closedShift =
        Array.isArray(closeResult) &&
        closeResult.length > 0
          ? closeResult[0]
          : {
              ...freshShift,
              status: "CLOSED",
              closed_at: closedAt,
            };

      setShiftData(closedShift);

      setMessage(
        "Shift closed successfully."
      );

      setMessageType("success");

      if (
        typeof onShiftClosed ===
        "function"
      ) {
        onShiftClosed(closedShift);
      }
    } catch (error) {
      console.error(
        "CLOSE SHIFT ERROR:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to close shift."
      );

      setMessageType("error");
    } finally {
      setClosing(false);
    }
  }

  // --------------------------------------------------
  // DISPLAY
  // --------------------------------------------------

  if (!currentShift) {
    return null;
  }

  const allClosingsSaved =
    platformCount > 0 &&
    closingCount === platformCount;

  const netIncome =
    Number(
      shiftData?.net_income ??
        currentShift?.net_income ??
        0
    );

  const closingBalance =
    Number(
      shiftData?.closing_balance ??
        currentShift?.closing_balance ??
        0
    );

  const status =
    String(
      shiftData?.status ||
        currentShift?.status ||
        "OPEN"
    ).toUpperCase();

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
          marginBottom: "7px",
        }}
      >
        Close Shift
      </h2>

      <p
        style={{
          color: "#64748b",
          marginTop: 0,
          marginBottom: "20px",
        }}
      >
        Confirm the final figures before closing
        this shift.
      </p>

      {loading ? (
        <div>
          Checking shift...
        </div>
      ) : (
        <>
          {/* CLOSING READINGS STATUS */}

          <div
            style={{
              padding: "14px",
              borderRadius: "8px",
              marginBottom: "16px",
              backgroundColor:
                allClosingsSaved
                  ? "#ecfdf5"
                  : "#fff7ed",
              color:
                allClosingsSaved
                  ? "#166534"
                  : "#9a3412",
            }}
          >
            Closing readings:{" "}
            <strong>
              {closingCount} / {platformCount}
            </strong>

            {allClosingsSaved && (
              <> ✓</>
            )}
          </div>

          {/* FINAL TOTALS */}

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(2, minmax(0, 1fr))",
              gap: "12px",
              marginBottom: "20px",
            }}
          >
            <div
              style={{
                backgroundColor: "#f8fafc",
                padding: "16px",
                borderRadius: "9px",
                border:
                  "1px solid #e2e8f0",
              }}
            >
              <div
                style={{
                  color: "#64748b",
                  fontSize: "13px",
                }}
              >
                Net Income
              </div>

              <div
                style={{
                  marginTop: "6px",
                  fontSize: "20px",
                  fontWeight: "bold",
                }}
              >
                KES{" "}
                {netIncome.toLocaleString(
                  "en-KE",
                  {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }
                )}
              </div>
            </div>

            <div
              style={{
                backgroundColor: "#f8fafc",
                padding: "16px",
                borderRadius: "9px",
                border:
                  "1px solid #e2e8f0",
              }}
            >
              <div
                style={{
                  color: "#64748b",
                  fontSize: "13px",
                }}
              >
                Closing Balance
              </div>

              <div
                style={{
                  marginTop: "6px",
                  fontSize: "20px",
                  fontWeight: "bold",
                }}
              >
                KES{" "}
                {closingBalance.toLocaleString(
                  "en-KE",
                  {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }
                )}
              </div>
            </div>
          </div>

          {message && (
            <div
              style={{
                padding: "12px",
                marginBottom: "16px",
                borderRadius: "8px",
                backgroundColor:
                  messageType === "success"
                    ? "#ecfdf5"
                    : "#fef2f2",
                color:
                  messageType === "success"
                    ? "#166534"
                    : "#991b1b",
              }}
            >
              {message}
            </div>
          )}

          {status === "CLOSED" ? (
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
              Shift Closed ✓
            </div>
          ) : (
            <button
              type="button"
              onClick={closeShift}
              disabled={
                closing ||
                !allClosingsSaved
              }
              style={{
                width: "100%",
                padding: "14px",
                border: "none",
                borderRadius: "8px",
                backgroundColor:
                  closing ||
                  !allClosingsSaved
                    ? "#94a3b8"
                    : "#dc2626",
                color: "white",
                fontWeight: "bold",
                fontSize: "16px",
                cursor:
                  closing ||
                  !allClosingsSaved
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {closing
                ? "Closing Shift..."
                : "Close Shift"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
