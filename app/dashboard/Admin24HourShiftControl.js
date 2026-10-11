"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

const NA_ZONE = "Africa/Nairobi";

function todayNairobi() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: NA_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const result = {};

  parts.forEach((part) => {
    if (part.type !== "literal") {
      result[part.type] = part.value;
    }
  });

  return (
    `${result.year}-${result.month}-${result.day}`
  );
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export default function Admin24HourShiftControl({
  user,
  shops,
  onChanged,
}) {
  const [openByShop, setOpenByShop] = useState({});
  const [reasonByShop, setReasonByShop] = useState({});
  const [messageByShop, setMessageByShop] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [busyShopId, setBusyShopId] = useState("");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = user?.access_token || "";

  const activeShops = useMemo(
    () =>
      (Array.isArray(shops) ? shops : [])
        .filter(
          (shop) =>
            String(shop.shop_type || "")
              .trim()
              .toUpperCase() === "24_HOUR" &&
            shop.is_active === true
        )
        .sort((a, b) =>
          String(a.shop_name).localeCompare(
            String(b.shop_name)
          )
        ),
    [shops]
  );

  const shopIds = activeShops
    .map((shop) => shop.id)
    .join(",");

  const headers = useMemo(
    () => ({
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    }),
    [anonKey, token]
  );

  const loadOpenShifts = useCallback(
    async (signal) => {
      if (!shopIds) {
        setOpenByShop({});
        setLoadError("");
        return;
      }

      if (!url || !anonKey || !token) {
        setLoadError(
          "Admin login information is missing."
        );
        return;
      }

      setLoading(true);
      setLoadError("");

      try {
        const response = await fetch(
          `${url}/rest/v1/shifts` +
            `?shop_id=in.(${shopIds})` +
            `&status=eq.OPEN` +
            `&select=id,shop_id,shift_name,` +
            `business_date,status,opened_at,` +
            `scheduled_start,scheduled_end`,
          {
            headers,
            cache: "no-store",
            signal,
          }
        );

        const rows = await readJson(response);

        if (
          !response.ok ||
          !Array.isArray(rows)
        ) {
          throw new Error(
            rows?.message ||
              "Unable to load 24-hour shifts."
          );
        }

        if (signal?.aborted) return;

        const grouped = {};

        for (const id of shopIds.split(",")) {
          grouped[id] = [];
        }

        for (const row of rows) {
          if (grouped[row.shop_id]) {
            grouped[row.shop_id].push(row);
          }
        }

        setOpenByShop(grouped);
      } catch (error) {
        if (!signal?.aborted) {
          setLoadError(
            error?.message ||
              "Unable to load shifts."
          );
        }
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [shopIds, url, anonKey, token, headers]
  );

  useEffect(() => {
    const controller = new AbortController();

    void loadOpenShifts(controller.signal);

    return () => controller.abort();
  }, [loadOpenShifts]);

  async function forceShift(shop, target) {
    if (busyShopId || loading) return;

    const reason = String(
      reasonByShop[shop.id] || ""
    ).trim();

    if (
      reason.length < 10 ||
      reason.length > 400
    ) {
      setMessageByShop((old) => ({
        ...old,
        [shop.id]:
          "Enter an Admin reason of 10–400 characters.",
      }));
      return;
    }

    setBusyShopId(shop.id);

    setMessageByShop((old) => ({
      ...old,
      [shop.id]: "",
    }));

    try {
      // Confirm the latest actual OPEN shift
      // before asking Admin to proceed.

      const response = await fetch(
        `${url}/rest/v1/shifts` +
          `?shop_id=eq.${shop.id}` +
          `&status=eq.OPEN` +
          `&select=id,shift_name,business_date,status`,
        {
          headers,
          cache: "no-store",
        }
      );

      const rows = await readJson(response);

      if (
        !response.ok ||
        !Array.isArray(rows)
      ) {
        throw new Error(
          rows?.message ||
            "Could not verify this shop's OPEN shift."
        );
      }

      if (rows.length !== 1) {
        throw new Error(
          rows.length === 0
            ? "No OPEN shift to correct. Use normal shift opening."
            : "Multiple OPEN shifts exist. Contact Admin for individual recovery."
        );
      }

      const current = rows[0];

      if (
        current.business_date !== todayNairobi()
      ) {
        throw new Error(
          "The OPEN shift is not on today's Nairobi business date."
        );
      }

      if (
        String(current.shift_name)
          .trim()
          .toUpperCase() === target
      ) {
        throw new Error(
          `This shop is already on ${target}.`
        );
      }

      const approved = window.confirm(
        `FORCE ${shop.shop_name} TO ${target}?\n\n` +
          `Current: ${current.shift_name}\n` +
          `Business date: ${current.business_date}\n` +
          `Shift ID: ${current.id}\n\n` +
          `This immediately corrects the OPEN shift's name and schedule.\n` +
          `Existing readings and balances are preserved.\n` +
          `Linked records may cause the server to block the correction.\n\n` +
          `Admin reason: ${reason}`
      );

      if (!approved) return;

      // Secure Admin-only Supabase RPC.
      // No direct browser UPDATE is permitted.

      const changeResponse = await fetch(
        `${url}/rest/v1/rpc/tl_admin_force_24h_shift`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            p_shop_id: shop.id,
            p_target_shift: target,
            p_reason: reason,
          }),
        }
      );

      const result = await readJson(
        changeResponse
      );

      if (!changeResponse.ok) {
        throw new Error(
          result?.message ||
            result?.details ||
            "Shift correction was refused."
        );
      }

      setMessageByShop((old) => ({
        ...old,
        [shop.id]:
          `${shop.shop_name}: ` +
          `${result?.current_shift || target}` +
          ` — ${result?.status || "SUCCESS"}.`,
      }));

      setReasonByShop((old) => ({
        ...old,
        [shop.id]: "",
      }));

      await loadOpenShifts();

      if (typeof onChanged === "function") {
        onChanged();
      }
    } catch (error) {
      setMessageByShop((old) => ({
        ...old,
        [shop.id]:
          error?.message ||
          "Unable to force shift.",
      }));

      await loadOpenShifts();
    } finally {
      setBusyShopId("");
    }
  }

  if (activeShops.length === 0) {
    return null;
  }

  const today = todayNairobi();

  return (
    <section
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 9,
        padding: 14,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <strong style={{ fontSize: 14 }}>
          24-HOUR SHIFT CONTROL — ADMIN ONLY
        </strong>

        <button
          type="button"
          onClick={() =>
            void loadOpenShifts()
          }
          disabled={
            loading || Boolean(busyShopId)
          }
          style={{
            border: "1px solid #94a3b8",
            borderRadius: 6,
            padding: "7px 10px",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          {loading
            ? "LOADING..."
            : "REFRESH"}
        </button>
      </div>

      <p
        style={{
          color: "#64748b",
          fontSize: 12,
          lineHeight: 1.5,
        }}
      >
        Correct one OPEN 24-hour shift
        immediately. Other shops remain
        unchanged. Admin reason and
        confirmation required. Nairobi date:
        {" "}
        {today}.
      </p>

      {loadError && (
        <p
          role="alert"
          style={{
            color: "#991b1b",
            fontSize: 12,
          }}
        >
          {loadError}
        </p>
      )}

      <div
        style={{
          display: "grid",
          gap: 10,
        }}
      >
        {activeShops.map((shop) => {
          const rows =
            openByShop[shop.id] || [];

          const shift =
            rows.length === 1
              ? rows[0]
              : null;

          const dateMatches =
            shift?.business_date === today;

          const reason =
            reasonByShop[shop.id] || "";

          const canCorrect =
            !loadError &&
            !loading &&
            !busyShopId &&
            rows.length === 1 &&
            dateMatches &&
            reason.trim().length >= 10 &&
            reason.trim().length <= 400;

          return (
            <div
              key={shop.id}
              style={{
                background: "#f8fafc",
                border:
                  "1px solid #e2e8f0",
                borderRadius: 8,
                padding: 12,
              }}
            >
              <div
                style={{
                  fontWeight: 800,
                  fontSize: 13,
                }}
              >
                {shop.shop_name}
              </div>

              <div
                style={{
                  color: "#64748b",
                  fontSize: 12,
                  marginTop: 4,
                }}
              >
                {loading
                  ? "Checking shift..."
                  : rows.length > 1
                  ? "Multiple OPEN shifts — correction blocked"
                  : shift
                  ? `${shift.shift_name} — OPEN | ` +
                    `${shift.business_date}` +
                    (dateMatches
                      ? ""
                      : " | Date mismatch — blocked")
                  : "No OPEN shift — correction unavailable"}
              </div>

              <textarea
                rows={2}
                maxLength={400}
                value={reason}
                disabled={
                  Boolean(busyShopId)
                }
                placeholder="Admin correction reason (minimum 10 characters)"
                onChange={(event) =>
                  setReasonByShop((old) => ({
                    ...old,
                    [shop.id]:
                      event.target.value,
                  }))
                }
                style={{
                  display: "block",
                  width: "100%",
                  boxSizing: "border-box",
                  marginTop: 9,
                  marginBottom: 9,
                  border:
                    "1px solid #94a3b8",
                  borderRadius: 6,
                  padding: 9,
                  fontSize: 12,
                  resize: "vertical",
                }}
              />

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(2,minmax(0,1fr))",
                  gap: 8,
                }}
              >
                {[
                  "SHIFT 1",
                  "SHIFT 2",
                ].map((target) => {
                  const isCurrent =
                    String(
                      shift?.shift_name || ""
                    )
                      .trim()
                      .toUpperCase() === target;

                  return (
                    <button
                      key={target}
                      type="button"
                      disabled={
                        !canCorrect ||
                        isCurrent
                      }
                      onClick={() =>
                        void forceShift(
                          shop,
                          target
                        )
                      }
                      style={{
                        border: 0,
                        borderRadius: 6,
                        padding: "11px 5px",
                        fontWeight: 800,
                        fontSize: 11,
                        color: "white",
                        background:
                          !canCorrect ||
                          isCurrent
                            ? "#94a3b8"
                            : target ===
                              "SHIFT 1"
                            ? "#0f766e"
                            : "#7f1d1d",
                        cursor:
                          !canCorrect ||
                          isCurrent
                            ? "not-allowed"
                            : "pointer",
                      }}
                    >
                      {isCurrent
                        ? `CURRENT ${target}`
                        : busyShopId ===
                          shop.id
                        ? "PROCESSING..."
                        : `FORCE ${target}`}
                    </button>
                  );
                })}
              </div>

              {messageByShop[shop.id] && (
                <p
                  role="status"
                  style={{
                    fontSize: 12,
                    marginBottom: 0,
                    overflowWrap:
                      "anywhere",
                  }}
                >
                  {messageByShop[shop.id]}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
