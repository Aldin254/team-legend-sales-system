"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

// TEAM LEGEND / NYIKA
// Read-only 24-hour DAY/NIGHT schedule.
// Uses the approved Duty/Rota and Master Employees.
// Does not change salaries or saved assignments.

function nairobiToday() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const v = Object.fromEntries(
    parts.map((p) => [p.type, p.value])
  );

  return `${v.year}-${v.month}-${v.day}`;
}

function nextMonday() {
  const date = new Date(
    `${nairobiToday()}T12:00:00Z`
  );

  const days =
    ((8 - date.getUTCDay()) % 7) || 7;

  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return "";

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(
    new Date(`${value}T12:00:00Z`)
  );
}

const shell = {
  background: "#fff",
  color: "#0f172a",
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  overflow: "hidden",
  marginTop: 12,
};

const field = {
  padding: "7px 9px",
  fontSize: 12,
  color: "#0f172a",
  background: "#fff",
  borderRadius: 7,
  border: "1px solid #cbd5e1",
};

const btn = {
  ...field,
  cursor: "pointer",
  fontWeight: 700,
};

export default function Admin24HourShiftDisplay({
  supabaseUrl,
  supabaseAnonKey,
  accessToken,
}) {
  const [date, setDate] = useState(nairobiToday);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [snapshot, setSnapshot] = useState(null);

  const base = useMemo(
    () =>
      String(supabaseUrl || "").replace(/\/+$/, ""),
    [supabaseUrl]
  );

  const rpc = useCallback(
    async (fn, args, signal) => {
      if (
        !base ||
        !supabaseAnonKey ||
        !accessToken
      ) {
        throw new Error("Admin login required.");
      }

      const response = await fetch(
        `${base}/rest/v1/rpc/${fn}`,
        {
          method: "POST",
          cache: "no-store",
          signal,
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(args || {}),
        }
      );

      const result = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.message ||
          result?.details ||
          `${fn} failed.`
        );
      }

      return result;
    },
    [base, supabaseAnonKey, accessToken]
  );

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError("");

    Promise.all([
      rpc(
        "tl_rota_24h_shift_preview",
        {
          p_start_date: date,
          p_days: 1,
        },
        controller.signal
      ),

      rpc(
        "tl_rota_shop_move_get",
        {
          p_start_date: date,
          p_days: 1,
        },
        controller.signal
      ),

      rpc(
        "tl_rota_shop_swap_get",
        {
          p_start_date: date,
          p_days: 1,
        },
        controller.signal
      ),

      rpc(
        "tl_rota_extra_get",
        {
          p_start_date: date,
          p_days: 1,
        },
        controller.signal
      ),

      rpc(
        "tl_admin_master_employee_list",
        {},
        controller.signal
      ),
    ])
      .then(
        ([
          shifts,
          moves,
          swaps,
          extras,
          people,
        ]) => {
          if (
            shifts?.success !== true ||
            !Array.isArray(shifts.shifts) ||
            !Array.isArray(moves) ||
            !Array.isArray(swaps) ||
            !Array.isArray(extras?.half_days) ||
            !Array.isArray(people)
          ) {
            throw new Error(
              "Unexpected 24-hour shift data."
            );
          }

          if (!controller.signal.aborted) {
            setSnapshot({
              shifts: shifts.shifts,
              moves,
              swaps,
              halfDays: extras.half_days,
              people,
            });
          }
        }
      )
      .catch((e) => {
        if (
          e.name !== "AbortError" &&
          !controller.signal.aborted
        ) {
          setSnapshot(null);
          setError(
            e.message ||
            "Unable to load shifts."
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [date, refresh, rpc]);

  const output = useMemo(() => {
    if (!snapshot) {
      return {
        shops: [],
        halfDays: [],
        week: null,
      };
    }

    const peopleById = new Map(
      snapshot.people.map((p) => [
        p.employee_id,
        p.full_name,
      ])
    );

    const personName = (id) =>
      peopleById.get(id) || "Employee";

    const rows = snapshot.shifts.map(
      (r) => ({
        ...r,
        note: "",
      })
    );

    const labelByShop = new Map(
      rows.map((r) => [
        r.shop_id,
        r.shop_name,
      ])
    );

    // Temporary shop swaps:
    // replace the employee occupying each
    // position, keeping that position's shift.

    for (const swap of snapshot.swaps) {
      const aIndex = rows.findIndex(
        (r) =>
          r.employee_id === swap.employee_a_id
      );

      const bIndex = rows.findIndex(
        (r) =>
          r.employee_id === swap.employee_b_id
      );

      if (aIndex >= 0) {
        rows[aIndex].employee_id =
          swap.employee_b_id;

        rows[aIndex].employee_name =
          personName(swap.employee_b_id);

        rows[aIndex].note = "TEMP SWAP";
      }

      if (bIndex >= 0) {
        rows[bIndex].employee_id =
          swap.employee_a_id;

        rows[bIndex].employee_name =
          personName(swap.employee_a_id);

        rows[bIndex].note = "TEMP SWAP";
      }
    }

    // Temporary shop moves:
    // original position becomes vacant;
    // covered employee becomes OFF;
    // moving employee occupies the shift.

    for (const move of snapshot.moves) {
      const movingRow = rows.find(
        (r) =>
          r.employee_id ===
          move.moving_employee_id
      );

      const coveredRow = rows.find(
        (r) =>
          r.employee_id ===
          move.covered_employee_id
      );

      const movingName = personName(
        move.moving_employee_id
      );

      const destination =
        labelByShop.get(move.to_shop_id) ||
        "another shop";

      if (movingRow) {
        movingRow.employee_id = null;

        movingRow.employee_name =
          `VACANT — ${movingName} moved to ${destination}`;

        movingRow.note = "TEMP MOVE";
      }

      if (coveredRow) {
        const shiftCovered =
          coveredRow.shift_period;

        coveredRow.shift_period = "OFF";
        coveredRow.note = "TEMP MOVE";

        rows.push({
          duty_date: date,
          shop_id: coveredRow.shop_id,
          shop_name: coveredRow.shop_name,
          employee_id:
            move.moving_employee_id,
          employee_name: movingName,

          shift_period:
            shiftCovered === "DAY" ||
            shiftCovered === "NIGHT"
              ? shiftCovered
              : "SHIFT TO CONFIRM",

          is_reliever: true,
          note: "TEMP MOVE",
        });
      }
    }

    const shopMap = new Map();

    for (const r of rows) {
      if (!shopMap.has(r.shop_id)) {
        shopMap.set(r.shop_id, {
          shop_id: r.shop_id,
          shop_name: r.shop_name,
          rows: [],
        });
      }

      shopMap.get(r.shop_id).rows.push(r);
    }

    const sort = {
      NIGHT: 0,
      DAY: 1,
      "SHIFT TO CONFIRM": 2,
      OFF: 3,
      DAY_VACANT: 4,
    };

    const shops = [
      ...shopMap.values(),
    ].sort((a, b) =>
      a.shop_name.localeCompare(b.shop_name)
    );

    for (const s of shops) {
      s.rows.sort(
        (a, b) =>
          (sort[a.shift_period] ?? 5) -
            (sort[b.shift_period] ?? 5) ||
          a.employee_name.localeCompare(
            b.employee_name
          )
      );
    }

    return {
      shops,

      week:
        snapshot.shifts[0]?.cycle_week ??
        null,

      halfDays: snapshot.halfDays
        .filter(
          (h) =>
            (h.duty_date || h.date) ===
              date &&
            shopMap.has(h.shop_id)
        )
        .map((h) => ({
          ...h,

          shop_name:
            labelByShop.get(h.shop_id) ||
            "24-hour shop",

          reliever_name: personName(
            h.reliever_employee_id
          ),

          handover_name: personName(
            h.handover_employee_id
          ),
        })),
    };
  }, [snapshot, date]);

  const labelColor = (label) => {
    if (label === "OFF") return "#b91c1c";
    if (label === "NIGHT") return "#3730a3";
    if (label === "DAY") return "#075985";

    return "#92400e";
  };

  return (
    <section style={shell}>
      <div
        style={{
          background: "#073b5c",
          color: "white",
          padding: "11px 13px",
          display: "flex",
          gap: 9,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <strong>
          24-HOUR SHIFTS · DAY / NIGHT
        </strong>

        <span
          style={{
            fontSize: 11,
            opacity: 0.8,
          }}
        >
          Read-only · from saved Duty/Rota
        </span>
      </div>

      <div
        style={{
          padding: 12,
          display: "grid",
          gap: 11,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 7,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <label
            htmlFor="admin-24h-shift-date"
            style={{
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            Date
          </label>

          <input
            id="admin-24h-shift-date"
            style={field}
            type="date"
            value={date}
            onChange={(e) =>
              setDate(e.target.value)
            }
          />

          <button
            type="button"
            style={btn}
            onClick={() =>
              setDate(nairobiToday())
            }
          >
            Today
          </button>

          <button
            type="button"
            style={btn}
            onClick={() =>
              setDate(nextMonday())
            }
          >
            Next Monday
          </button>

          <button
            type="button"
            style={btn}
            onClick={() =>
              setRefresh((v) => v + 1)
            }
          >
            ↻ Refresh
          </button>

          {output.week && (
            <span
              style={{
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              Week {output.week}
            </span>
          )}
        </div>

        <div
          style={{
            fontSize: 12,
            color: "#64748b",
          }}
        >
          {formatDate(date)}
        </div>

        {loading && (
          <div style={{ fontSize: 12 }}>
            Loading shifts...
          </div>
        )}

        {error && (
          <div
            role="alert"
            style={{
              fontSize: 12,
              color: "#b91c1c",
            }}
          >
            {error}
          </div>
        )}

        {!loading && !error && (
          <div
            style={{
              display: "grid",
              gap: 8,
              gridTemplateColumns:
                "repeat(auto-fit,minmax(225px,1fr))",
            }}
          >
            {output.shops.map((shop) => (
              <div
                key={shop.shop_id}
                style={{
                  border:
                    "1px solid #e2e8f0",
                  borderRadius: 8,
                  padding: 10,
                  display: "grid",
                  gap: 8,
                }}
              >
                <strong
                  style={{ fontSize: 13 }}
                >
                  {shop.shop_name}
                </strong>

                {shop.rows.map((r, i) => (
                  <div
                    key={`${r.employee_id || "vacant"}-${i}`}
                    style={{
                      display: "flex",
                      gap: 6,
                      alignItems: "center",
                      justifyContent:
                        "space-between",
                      fontSize: 12,
                    }}
                  >
                    <span style={{ flex: 1 }}>
                      {r.employee_name}

                      {r.note && (
                        <span
                          style={{
                            color: "#64748b",
                            fontSize: 10,
                          }}
                        >
                          {" "}· {r.note}
                        </span>
                      )}
                    </span>

                    <b
                      style={{
                        fontSize: 11,
                        color: labelColor(
                          r.shift_period
                        ),
                        whiteSpace: "nowrap",
                      }}
                    >
                      {r.shift_period ===
                      "DAY_VACANT"
                        ? "DAY VACANT"
                        : r.shift_period}
                    </b>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {!loading &&
          output.halfDays.map((h, i) => (
            <div
              key={`half-${i}`}
              style={{
                padding: 8,
                background: "#f8fafc",
                borderRadius: 7,
                fontSize: 12,
              }}
            >
              <b>
                {h.shop_name} · Half-Day
                handover:
              </b>{" "}
              {h.reliever_name}{" "}
              {String(
                h.open_time || ""
              ).slice(0, 5)}
              –
              {String(
                h.handover_time || ""
              ).slice(0, 5)}
              {" "}→{" "}
              {h.handover_name} until{" "}
              {String(
                h.close_time || ""
              ).slice(0, 5)}
            </div>
          ))}

        <span
          style={{
            fontSize: 11,
            color: "#64748b",
          }}
        >
          Monday: the previous NIGHT employee
          is OFF; scheduled relief covers DAY.
          From Tuesday, the rested employee
          works DAY. Temporary shop moves
          and swaps are reflected on selected
          dates. This display does not
          authorize salary payments.
        </span>
      </div>
    </section>
  );
}
