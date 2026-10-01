"use client";

import { useEffect, useState } from "react";

export default function PlatformReadings({
  user,
  currentShift,
}) {
  const [platforms, setPlatforms] = useState([]);
  const [readings, setReadings] = useState({});
  const [existingRows, setExistingRows] = useState({});
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
    user?.access_token ||
    null;

  const shiftId =
    currentShift?.id ||
    null;

  const readingKind = "OPENING";
  // --------------------------------------------------
  // LOAD PLATFORMS + EXISTING READINGS
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
        // LOAD ACTIVE PLATFORMS FOR THIS SHOP
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
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
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
          console.error(
            "PLATFORM LOAD ERROR:",
            platformData
          );

          throw new Error(
            platformData?.message ||
              platformData?.details ||
              platformData?.hint ||
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
        // LOAD SAVED READINGS FOR CURRENT SHIFT
        // --------------------------------------------

        const readingUrl =
          `${supabaseUrl}/rest/v1/platform_readings` +
          `?shift_id=eq.${encodeURIComponent(shiftId)}` +
          `&reading_kind=eq.${encodeURIComponent(readingKind)}` +
          `&select=id,shift_id,platform_id,reading_kind,reading_value,recorded_at,recorded_by`;

        const readingResponse = await fetch(
          readingUrl,
          {
            method: "GET",
            headers: {
              apikey: supabaseAnonKey,
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
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
          console.error(
            "READINGS LOAD ERROR:",
            readingData
          );

          throw new Error(
            readingData?.message ||
              readingData?.details ||
              readingData?.hint ||
              "Unable to load saved readings."
          );
        }

        if (cancelled) {
          return;
        }

        const savedRows =
          Array.isArray(readingData)
            ? readingData
            : [];

        const values = {};
        const rowsByPlatform = {};

        for (const row of savedRows) {
          if (!row.platform_id) {
            continue;
          }

          values[row.platform_id] =
            row.reading_value ?? "";

          rowsByPlatform[row.platform_id] =
            row;
        }

        setReadings(values);
        setExistingRows(rowsByPlatform);
      } catch (error) {
        console.error(
          "PLATFORM READINGS LOAD ERROR:",
          error
        );

        if (!cancelled) {
          setMessage(
            error?.message ||
              "Unable to load platform readings."
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
  // UPDATE INPUT VALUE
  // --------------------------------------------------

  function updateReading(platformId, value) {
    setReadings((previous) => ({
      ...previous,
      [platformId]: value,
    }));

    setMessage("");
    setMessageType("");
  }

  // --------------------------------------------------
  // SAVE READINGS
  // --------------------------------------------------

  async function saveReadings() {
    if (!shiftId) {
      setMessage("No open shift was found.");
      setMessageType("error");
      return;
    }

    if (!shopId) {
      setMessage("Shop information is missing.");
      setMessageType("error");
      return;
    }

    if (!cashierId) {
      setMessage("Cashier information is missing.");
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

    if (!supabaseUrl || !supabaseAnonKey) {
      setMessage("Database configuration is missing.");
      setMessageType("error");
      return;
    }

    const rowsToSave = [];

    for (const platform of platforms) {
      const rawValue =
        readings[platform.id];

      if (
        rawValue === undefined ||
        rawValue === null ||
        rawValue === ""
      ) {
        continue;
      }

      const numericValue =
        Number(rawValue);

      if (
        Number.isNaN(numericValue) ||
        numericValue < 0
      ) {
        setMessage(
          `Please enter a valid reading for ${platform.platform_name}.`
        );

        setMessageType("error");
        return;
      }

      rowsToSave.push({
        platform,
        numericValue,
      });
    }

    if (rowsToSave.length === 0) {
      setMessage(
        "Enter at least one platform reading before saving."
      );

      setMessageType("error");
      return;
    }

    try {
      setSaving(true);
      setMessage("");
      setMessageType("");

      const recordedAt =
        new Date().toISOString();

      const newExistingRows = {
        ...existingRows,
      };

      for (const item of rowsToSave) {
        const platform =
          item.platform;

        const numericValue =
          item.numericValue;

        const existing =
          existingRows[platform.id];

        // --------------------------------------------
        // UPDATE EXISTING READING
        // --------------------------------------------

        if (existing?.id) {
          const response = await fetch(
            `${supabaseUrl}/rest/v1/platform_readings?id=eq.${encodeURIComponent(
              existing.id
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
                  "return=representation",
              },

              body: JSON.stringify({
                reading_kind:
                  readingKind,

                reading_value:
                  numericValue,

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
              "READING UPDATE ERROR:",
              result
            );

            throw new Error(
              result?.message ||
                result?.details ||
                result?.hint ||
                `Unable to update ${platform.platform_name}.`
            );
          }

          if (
            Array.isArray(result) &&
            result.length > 0
          ) {
            newExistingRows[
              platform.id
            ] = result[0];
          }

          continue;
        }

        // --------------------------------------------
        // INSERT NEW READING
        // --------------------------------------------

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
              shift_id:
                shiftId,

              platform_id:
                platform.id,

              reading_kind:
                readingKind,

              reading_value:
                numericValue,

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
            "READING INSERT ERROR:",
            result
          );

          throw new Error(
            result?.message ||
              result?.details ||
              result?.hint ||
              `Unable to save ${platform.platform_name}.`
          );
        }

        if (
          Array.isArray(result) &&
          result.length > 0
        ) {
          newExistingRows[
            platform.id
          ] = result[0];
        }
      }

      setExistingRows(
        newExistingRows
      );

      setMessage(
        "Platform readings saved successfully."
      );

      setMessageType("success");
    } catch (error) {
      console.error(
        "SAVE PLATFORM READINGS ERROR:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to save platform readings."
      );

      setMessageType("error");
    } finally {
      setSaving(false);
    }
  }

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
        Platform Readings
      </h2>

      <p
        style={{
          marginTop: 0,
          marginBottom: "24px",
          color: "#64748b",
        }}
      >
        Enter the current reading for each platform.
      </p>

      {loading ? (
        <div
          style={{
            padding: "15px 0",
            color: "#64748b",
          }}
        >
          Loading platforms...
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
          {platforms.map((platform) => (
            <div
              key={platform.id}
              style={{
                marginBottom: "16px",
              }}
            >
              <label
                style={{
                  display: "block",
                  fontWeight: "bold",
                  marginBottom: "7px",
                }}
              >
                {platform.platform_name}
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={
                  readings[
                    platform.id
                  ] ?? ""
                }
                disabled={saving}
                onChange={(e) =>
                  updateReading(
                    platform.id,
                    e.target.value
                  )
                }
                placeholder={`Enter ${platform.platform_name} reading`}
                style={{
                  width: "100%",
                  padding: "13px",
                  border:
                    "1px solid #cbd5e1",
                  borderRadius: "8px",
                  boxSizing:
                    "border-box",
                  fontSize: "16px",
                }}
              />
            </div>
          ))}

          {message && (
            <div
              style={{
                padding: "12px",
                marginTop: "8px",
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

          <button
            onClick={saveReadings}
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
              : "Save Readings"}
          </button>
        </>
      )}
    </div>
  );
}
