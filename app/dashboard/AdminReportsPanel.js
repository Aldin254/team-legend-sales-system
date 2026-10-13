"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const NAVY = "#0f172a";

const PLATFORM_COLUMNS =
  "minmax(115px,1.6fr) repeat(3,minmax(78px,1fr))";

// ==================================================
// DATE HELPERS
// ==================================================

function dateOnly(value) {
  return String(value || "").slice(0, 10);
}

function addDays(date, days) {
  const d = new Date(`${date}T12:00:00Z`);

  if (Number.isNaN(d.getTime())) return date;

  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function dateDifference(a, b) {
  return Math.round(
    (
      Date.parse(`${b}T12:00:00Z`) -
      Date.parse(`${a}T12:00:00Z`)
    ) / 86400000
  );
}

function dateRanges(dates, maximumDays) {
  const sorted = [
    ...new Set(
      dates.filter((d) =>
        /^\d{4}-\d{2}-\d{2}$/.test(d)
      )
    ),
  ].sort();

  const ranges = [];

  for (const date of sorted) {
    const last = ranges[ranges.length - 1];

    if (
      !last ||
      dateDifference(last.start, date) >= maximumDays
    ) {
      ranges.push({
        start: date,
        end: date,
        days: 1,
      });
    } else {
      last.end = date;
      last.days = dateDifference(last.start, date) + 1;
    }
  }

  return ranges;
}

function upper(value) {
  return String(value || "").trim().toUpperCase();
}

function usefulName(value) {
  const name = String(value || "").trim();

  return name &&
    ![
      "NOT ASSIGNED",
      "CASHIER",
      "UNKNOWN",
      "-",
    ].includes(upper(name))
    ? name
    : "";
}

function shiftPeriod(shift) {
  const n = upper(shift?.shift_name)
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ");

  if (n === "SHIFT 2" || n === "SHIFT2") {
    return "NIGHT";
  }

  return "DAY";
}

function cycleDay(date, anchor) {
  if (!anchor || !date) return null;

  const n = dateDifference(anchor, date);

  return ((n % 14) + 14) % 14;
}

function uniqueNames(ids, peopleById) {
  return [
    ...new Set(
      ids
        .map(
          (id) =>
            peopleById.get(String(id))?.full_name
        )
        .filter(Boolean)
    ),
  ].join(" / ");
}

function recordedName(shift) {
  return (
    usefulName(shift?.cashier_name) ||
    "ROTA NAME UNAVAILABLE"
  );
}

// ==================================================
// DUTY ROTA NAME RESOLUTION
// ==================================================

// Admin-safe, read-only rota previews.
// The cashier-specific display RPC is not used here
// because it requires an OPEN shift and cashier
// authorization.

async function buildDutyNameMap(
  shifts,
  shopType,
  callRpc
) {
  const dates = shifts
    .map((s) => dateOnly(s.business_date))
    .filter(Boolean);

  if (!dates.length) return {};

  const requests = [
    {
      type: "master",
      promise: callRpc(
        "tl_admin_master_employee_list"
      ),
    },
    {
      type: "config",
      promise: callRpc("tl_rota_relief_get"),
    },
  ];

  // ==================================================
  // FETCH MOVES, SWAPS, OFF DAYS AND HALF-DAYS
  // ==================================================

  for (const range of dateRanges(dates, 31)) {
    const params = {
      p_start_date: range.start,
      p_days: range.days,
    };

    requests.push({
      type: "extras",
      promise: callRpc(
        "tl_rota_extra_get",
        params
      ),
    });

    requests.push({
      type: "moves",
      promise: callRpc(
        "tl_rota_shop_move_get",
        params
      ),
    });

    requests.push({
      type: "swaps",
      promise: callRpc(
        "tl_rota_shop_swap_get",
        params
      ),
    });

    if (shopType === "24_HOUR") {
      requests.push({
        type: "twentyFour",
        promise: callRpc(
          "tl_rota_24h_shift_preview",
          params
        ),
      });
    }
  }

  for (const range of dateRanges(dates, 14)) {
    requests.push({
      type: "relief",
      promise: callRpc(
        "tl_rota_relief_preview",
        {
          p_start_date: range.start,
          p_days: range.days,
        }
      ),
    });
  }

  const results = await Promise.allSettled(
    requests.map((r) => r.promise)
  );

  const data = {
    master: [],
    anchor: "",
    extras: [],
    moves: [],
    swaps: [],
    relief: [],
    twentyFour: [],
  };

  const failures = new Set();

  results.forEach((result, index) => {
    const kind = requests[index].type;

    if (result.status !== "fulfilled") {
      failures.add(kind);

      console.warn(
        "Admin report rota source unavailable:",
        kind,
        result.reason
      );

      return;
    }

    const value = result.value;

    if (kind === "master") {
      data.master = Array.isArray(value)
        ? value
        : [];
    }

    if (kind === "config") {
      data.anchor = value?.anchor_monday || "";
    }

    if (kind === "extras") {
      data.extras.push(value);
    }

    if (
      kind === "moves" &&
      Array.isArray(value)
    ) {
      data.moves.push(...value);
    }

    if (
      kind === "swaps" &&
      Array.isArray(value)
    ) {
      data.swaps.push(...value);
    }

    if (
      kind === "relief" &&
      Array.isArray(value)
    ) {
      data.relief.push(...value);
    }

    if (
      kind === "twentyFour" &&
      Array.isArray(value?.shifts)
    ) {
      data.twentyFour.push(...value.shifts);

      if (!data.anchor) {
        data.anchor = value.anchor_monday || "";
      }
    }
  });

  if (
    !data.master.length ||
    (
      shopType === "24_HOUR" &&
      !data.twentyFour.length
    )
  ) {
    return Object.fromEntries(
      shifts.map((s) => [
        s.id,
        recordedName(s),
      ])
    );
  }

  // ==================================================
  // EMPLOYEES
  // ==================================================

  const peopleById = new Map(
    data.master.map((p) => [
      String(p.employee_id || p.id),
      p,
    ])
  );

  const offs = new Set();
  const halfDays = new Map();

  data.extras.forEach((extra) => {
    for (const off of extra?.offs || []) {
      offs.add(
        `${off.cycle_day}|${off.employee_id}`
      );
    }

    for (
      const half of extra?.half_days || []
    ) {
      halfDays.set(
        `${dateOnly(half.duty_date)}|${half.shop_id}|${half.change_id}`,
        half
      );
    }
  });

  function byDate(rows) {
    const map = new Map();

    for (const row of rows) {
      const d = dateOnly(row.duty_date);

      if (!map.has(d)) {
        map.set(d, []);
      }

      map.get(d).push(row);
    }

    return map;
  }

  const reliefByDate = byDate(data.relief);
  const movesByDate = byDate(data.moves);
  const swapsByDate = byDate(data.swaps);
  const previewByDate = byDate(data.twentyFour);
  const halvesByDate = byDate([
    ...halfDays.values(),
  ]);

  const output = {};

  // ==================================================
  // RESOLVE EACH REPORT'S DUTY ASSIGNMENT
  // ==================================================

  for (const shift of shifts) {
    const date = dateOnly(shift.business_date);
    const shopId = String(shift.shop_id);
    const period = shiftPeriod(shift);

    const shiftPreview =
      previewByDate.get(date) || [];

    const dayRelief =
      reliefByDate.get(date) || [];

    const dayMoves =
      movesByDate.get(date) || [];

    const daySwaps =
      swapsByDate.get(date) || [];

    const dayHalves =
      halvesByDate.get(date) || [];

    const cycle = cycleDay(
      date,
      data.anchor
    );

    let ids = [];

    // ==================================================
    // 24-HOUR SHOP
    // ==================================================

    if (shopType === "24_HOUR") {
      ids = shiftPreview
        .filter(
          (row) =>
            String(row.shop_id) === shopId &&
            upper(row.shift_period) === period &&
            row.employee_id
        )
        .map((row) =>
          String(row.employee_id)
        );
    } else {
      // ==================================================
      // 12-HOUR SHOP
      // ==================================================

      ids = data.master
        .filter(
          (p) =>
            String(p.shop_id || "") === shopId &&
            upper(p.employment_status) ===
              "ACTIVE"
        )
        .map((p) =>
          String(p.employee_id || p.id)
        );
    }

    const remove = (id) => {
      ids = ids.filter(
        (x) => String(x) !== String(id)
      );
    };

    const add = (id) => {
      if (
        id &&
        peopleById.has(String(id)) &&
        !ids.includes(String(id))
      ) {
        ids.push(String(id));
      }
    };

    const homeShop = (id) =>
      String(
        peopleById.get(String(id))?.shop_id || ""
      );

    const previewEntry = (id) =>
      shiftPreview.find(
        (p) =>
          String(p.employee_id) ===
            String(id) &&
          !p.is_reliever
      );

    const expectedPeriod = (id) => {
      if (shopType !== "24_HOUR") {
        return "DAY";
      }

      const value = upper(
        previewEntry(id)?.shift_period
      );

      return value === "OFF"
        ? "DAY"
        : value;
    };

    // ==================================================
    // REGULAR AND TEMPORARY RELIEF
    // ==================================================

    for (const item of dayRelief) {
      const coveredId = String(
        item.covered_employee_id || ""
      );

      if (
        homeShop(coveredId) !== shopId
      ) {
        continue;
      }

      const relevant =
        shopType !== "24_HOUR" ||
        expectedPeriod(coveredId) === period;

      if (!relevant) continue;

      remove(coveredId);
      add(item.reliever_employee_id);
    }

    // ==================================================
    // INDIVIDUAL OFF DAYS
    // ==================================================

    for (const id of [...ids]) {
      const changed =
        dayMoves.some(
          (m) =>
            String(m.moving_employee_id) ===
            id
        ) ||
        daySwaps.some(
          (s) =>
            String(s.employee_a_id) === id ||
            String(s.employee_b_id) === id
        );

      if (
        !changed &&
        cycle !== null &&
        offs.has(`${cycle}|${id}`)
      ) {
        remove(id);
      }
    }

    // ==================================================
    // TEMPORARY SHOP SWAPS
    // ==================================================

    for (const swap of daySwaps) {
      const a = String(
        swap.employee_a_id
      );

      const b = String(
        swap.employee_b_id
      );

      const shopA = String(
        swap.home_shop_a_id
      );

      const shopB = String(
        swap.home_shop_b_id
      );

      if (
        shopId === shopA &&
        (
          shopType !== "24_HOUR" ||
          expectedPeriod(a) === period
        )
      ) {
        remove(a);
        add(b);
      }

      if (
        shopId === shopB &&
        (
          shopType !== "24_HOUR" ||
          expectedPeriod(b) === period
        )
      ) {
        remove(b);
        add(a);
      }
    }

    // ==================================================
    // TEMPORARY SHOP MOVES
    // ==================================================

    for (const move of dayMoves) {
      const mover = String(
        move.moving_employee_id
      );

      const covered = String(
        move.covered_employee_id
      );

      if (
        shopId === String(move.from_shop_id)
      ) {
        remove(mover);
      }

      if (
        shopId === String(move.to_shop_id) &&
        (
          shopType !== "24_HOUR" ||
          expectedPeriod(covered) === period
        )
      ) {
        remove(covered);
        add(mover);
      }
    }

    // ==================================================
    // HALF-DAY HANDOVER
    // ==================================================

    // Historical 12-hour report displays
    // both employees assigned to the Half-Day.

    if (shopType !== "24_HOUR") {
      const half = dayHalves.find(
        (h) =>
          String(h.shop_id) === shopId
      );

      if (half) {
        ids = [
          String(half.reliever_employee_id),
          String(half.handover_employee_id),
        ];
      }
    }

    output[shift.id] =
      uniqueNames(ids, peopleById) ||
      recordedName(shift);
  }

  return output;
}

// ==================================================
// ADMIN REPORTS PANEL
// ==================================================

export default function AdminReportsPanel({
  user,
}) {
  const accessToken =
    user?.access_token || null;

  const headers = useMemo(
    () => ({
      apikey: ANON,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    }),
    [accessToken]
  );

  const [shops, setShops] = useState([]);
  const [shifts, setShifts] = useState([]);

  const [dutyNames, setDutyNames] =
    useState({});

  const [
    selectedShopId,
    setSelectedShopId,
  ] = useState("");

  const [
    selectedBusinessDate,
    setSelectedBusinessDate,
  ] = useState("ALL");

  const [
    selectedCashier,
    setSelectedCashier,
  ] = useState("ALL");

  const [
    selectedStatus,
    setSelectedStatus,
  ] = useState("ALL");

  const [
    selectedShiftId,
    setSelectedShiftId,
  ] = useState("");

  const [report, setReport] = useState(null);

  const [
    loadingShops,
    setLoadingShops,
  ] = useState(false);

  const [
    loadingShifts,
    setLoadingShifts,
  ] = useState(false);

  const [
    loadingRota,
    setLoadingRota,
  ] = useState(false);

  const [
    loadingReport,
    setLoadingReport,
  ] = useState(false);

  const [message, setMessage] = useState("");

  const reportRequestRef = useRef(0);

  // ==================================================
  // FETCH JSON
  // ==================================================

  const fetchJson = useCallback(
    async (
      path,
      method = "GET",
      args = null
    ) => {
      if (
        !URL ||
        !ANON ||
        !accessToken
      ) {
        throw new Error(
          "Database or Admin login information is missing."
        );
      }

      const response = await fetch(
        `${URL}/rest/v1/${path}`,
        {
          method,
          headers,
          cache: "no-store",
          ...(args !== null
            ? {
                body: JSON.stringify(args),
              }
            : {}),
        }
      );

      const result = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.message ||
            result?.details ||
            result?.hint ||
            "Database request failed."
        );
      }

      return result;
    },
    [headers, accessToken]
  );

  const callRpc = useCallback(
    (name, args = {}) =>
      fetchJson(
        `rpc/${name}`,
        "POST",
        args
      ),
    [fetchJson]
  );

  // ==================================================
  // SELECTED SHOP
  // ==================================================

  const selectedShop = useMemo(
    () =>
      shops.find(
        (s) =>
          String(s.id) ===
          String(selectedShopId)
      ) || null,
    [shops, selectedShopId]
  );

  const cashierForShift = useCallback(
    (s) =>
      dutyNames[s.id] ||
      recordedName(s),
    [dutyNames]
  );

  // ==================================================
  // BUSINESS DATES
  // ==================================================

  const businessDates = useMemo(
    () =>
      [
        ...new Set(
          shifts
            .map((s) => s.business_date)
            .filter(Boolean)
        ),
      ]
        .sort()
        .reverse(),
    [shifts]
  );

  // ==================================================
  // CASHIERS FROM DUTY ROTA
  // ==================================================

  const cashiers = useMemo(
    () =>
      [
        ...new Set(
          shifts.flatMap((s) =>
            cashierForShift(s)
              .split(" / ")
              .map((n) => n.trim())
              .filter(
                (n) =>
                  n !==
                  "ROTA NAME UNAVAILABLE"
              )
          )
        ),
      ].sort(),
    [shifts, cashierForShift]
  );

  // ==================================================
  // FILTERED SHIFTS
  // ==================================================

  const filteredShifts = useMemo(
    () =>
      shifts.filter(
        (s) =>
          (
            selectedBusinessDate === "ALL" ||
            s.business_date ===
              selectedBusinessDate
          ) &&
          (
            selectedCashier === "ALL" ||
            cashierForShift(s)
              .split(" / ")
              .includes(selectedCashier)
          ) &&
          (
            selectedStatus === "ALL" ||
            upper(s.status) === selectedStatus
          )
      ),
    [
      shifts,
      selectedBusinessDate,
      selectedCashier,
      selectedStatus,
      cashierForShift,
    ]
  );

  // ==================================================
  // LOAD SHOPS
  // ==================================================

  const loadShops = useCallback(
    async () => {
      setLoadingShops(true);

      try {
        setMessage("");

        const value = await fetchJson(
          "shops?select=id,shop_name,shop_type,is_active,timezone&order=shop_name.asc"
        );

        const list = Array.isArray(value)
          ? value
          : [];

        setShops(list);

        setSelectedShopId(
          (id) =>
            list.some(
              (s) =>
                String(s.id) === String(id)
            )
              ? id
              : list[0]?.id || ""
        );
      } catch (e) {
        setMessage(
          e.message || "Unable to load shops."
        );
      } finally {
        setLoadingShops(false);
      }
    },
    [fetchJson]
  );

  // ==================================================
  // LOAD SHIFTS
  // ==================================================

  const loadShifts = useCallback(
    async () => {
      if (!selectedShopId) {
        setShifts([]);
        setDutyNames({});
        setLoadingShifts(false);
        return;
      }

      setLoadingShifts(true);

      try {
        setMessage("");

        const value = await fetchJson(
          `shifts?shop_id=eq.${encodeURIComponent(
            selectedShopId
          )}` +
            `&select=id,shop_id,cashier_id,cashier_name,shift_name,business_date,scheduled_start,scheduled_end,` +
            `opened_at,closed_at,status,opening_balance,total_added_float,total_output,total_expenses,` +
            `net_income,closing_balance,notes,admin_manual_totals,admin_override_note,admin_override_at,admin_override_by` +
            `&order=business_date.desc,opened_at.desc&limit=500`
        );

        setShifts(
          Array.isArray(value) ? value : []
        );
      } catch (e) {
        setShifts([]);
        setMessage(
          e.message || "Unable to load shifts."
        );
      } finally {
        setLoadingShifts(false);
      }
    },
    [
      selectedShopId,
      fetchJson,
    ]
  );

  // ==================================================
  // INITIAL LOAD
  // ==================================================

  useEffect(() => {
    void loadShops();
  }, [loadShops]);

  useEffect(() => {
    setSelectedBusinessDate("ALL");
    setSelectedCashier("ALL");
    setSelectedStatus("ALL");
    setSelectedShiftId("");
    setReport(null);
    setShifts([]);
    setDutyNames({});

    void loadShifts();
  }, [loadShifts]);

  // ==================================================
  // LOAD DUTY ROTA NAMES
  // ==================================================

  useEffect(() => {
    let cancelled = false;

    if (
      !shifts.length ||
      !selectedShop
    ) {
      setLoadingRota(false);
      return;
    }

    setLoadingRota(true);

    buildDutyNameMap(
      shifts,
      upper(selectedShop.shop_type),
      callRpc
    )
      .then((names) => {
        if (!cancelled) {
          setDutyNames(names);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          console.error(
            "ADMIN REPORT ROTA:",
            e
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingRota(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    shifts,
    selectedShop,
    callRpc,
  ]);

  // ==================================================
  // KEEP FILTERS VALID
  // ==================================================

  useEffect(() => {
    if (
      selectedBusinessDate !== "ALL" &&
      !businessDates.includes(
        selectedBusinessDate
      )
    ) {
      setSelectedBusinessDate("ALL");
    }
  }, [
    businessDates,
    selectedBusinessDate,
  ]);

  useEffect(() => {
    if (
      selectedCashier !== "ALL" &&
      !cashiers.includes(selectedCashier) &&
      !loadingRota
    ) {
      setSelectedCashier("ALL");
    }
  }, [
    cashiers,
    selectedCashier,
    loadingRota,
  ]);

  // ==================================================
  // FIRST MATCHING SHIFT
  // ==================================================

  useEffect(() => {
    setSelectedShiftId((current) =>
      filteredShifts.some(
        (s) =>
          String(s.id) === String(current)
      )
        ? current
        : filteredShifts[0]?.id || ""
    );
  }, [filteredShifts]);

  // ==================================================
  // LOAD FULL REPORT
  // ==================================================

  const loadReport = useCallback(
    async () => {
      const requestId =
        ++reportRequestRef.current;

      if (
        !selectedShiftId ||
        !selectedShopId
      ) {
        setReport(null);
        setLoadingReport(false);
        return;
      }

      setLoadingReport(true);

      try {
        setMessage("");

        const id = encodeURIComponent(
          selectedShiftId
        );

        const shop = encodeURIComponent(
          selectedShopId
        );

        const [
          shiftResult,
          platformResult,
          readingResult,
          floatResult,
          expenseResult,
          savingsResult,
        ] = await Promise.all([
          fetchJson(
            `shifts?id=eq.${id}&select=*&limit=1`
          ),

          fetchJson(
            `shop_platforms?shop_id=eq.${shop}` +
              `&select=id,shop_id,platform_name,reading_type,display_order,is_active` +
              `&order=display_order.asc`
          ),

          fetchJson(
            `platform_readings?shift_id=eq.${id}` +
              `&reading_kind=in.(OPENING,CLOSING)` +
              `&select=id,shift_id,platform_id,reading_kind,reading_value,recorded_at,recorded_by` +
              `&order=recorded_at.asc`
          ),

          fetchJson(
            `shift_income_entries?shift_id=eq.${id}` +
              `&entry_type=in.(COMPANY_FLOAT,MSHWARI_FLOAT)` +
              `&select=id,shift_id,entry_type,description,amount,created_at` +
              `&order=created_at.asc`
          ),

          fetchJson(
            `expenses?shift_id=eq.${id}` +
              `&select=id,shift_id,description,amount,created_at,created_by` +
              `&order=created_at.asc`
          ),

          fetchJson(
            `shift_savings?shift_id=eq.${id}` +
              `&select=id,shift_id,description,amount,payment_status,created_at` +
              `&order=created_at.asc`
          ),
        ]);

        if (
          !Array.isArray(shiftResult) ||
          !shiftResult[0]
        ) {
          throw new Error(
            "Selected shift could not be found."
          );
        }

        if (
          requestId !== reportRequestRef.current
        ) {
          return;
        }

        const shift = shiftResult[0];

        const platforms =
          Array.isArray(platformResult)
            ? platformResult
            : [];

        const readings =
          Array.isArray(readingResult)
            ? readingResult
            : [];

        const floats =
          Array.isArray(floatResult)
            ? floatResult
            : [];

        const expenses =
          Array.isArray(expenseResult)
            ? expenseResult
            : [];

        const savings =
          Array.isArray(savingsResult)
            ? savingsResult
            : [];

        // ==================================================
        // PLATFORM READINGS
        // ==================================================

        const readingMap = {};

        for (const r of readings) {
          const key =
            `${r.platform_id}-${r.reading_kind}`;

          if (
            !readingMap[key] ||
            new Date(r.recorded_at || 0) >=
              new Date(
                readingMap[key].recorded_at || 0
              )
          ) {
            readingMap[key] = r;
          }
        }

        const platformRows = platforms.map(
          (platform) => {
            const opening =
              readingMap[
                `${platform.id}-OPENING`
              ] || null;

            const closing =
              readingMap[
                `${platform.id}-CLOSING`
              ] || null;

            return {
              ...platform,
              opening,
              closing,

              output:
                opening && closing
                  ? roundMoney(
                      Number(
                        closing.reading_value || 0
                      ) -
                        Number(
                          opening.reading_value ||
                            0
                        )
                    )
                  : null,
            };
          }
        );

        // ==================================================
        // SAVINGS
        // ==================================================

        let totalSavings = 0;
        let paidSavings = 0;
        let pendingSavings = 0;

        for (const saving of savings) {
          const amount = Number(
            saving.amount || 0
          );

          totalSavings += amount;

          if (
            upper(saving.payment_status) ===
            "PAID"
          ) {
            paidSavings += amount;
          } else {
            pendingSavings += amount;
          }
        }

        setReport({
          shift,
          platformRows,

          companyFloats: floats.filter(
            (x) =>
              x.entry_type === "COMPANY_FLOAT"
          ),

          mshwariFloats: floats.filter(
            (x) =>
              x.entry_type === "MSHWARI_FLOAT"
          ),

          expenses,
          savings,

          totalSavings: roundMoney(
            totalSavings
          ),

          paidSavings: roundMoney(
            paidSavings
          ),

          pendingSavings: roundMoney(
            pendingSavings
          ),
        });
      } catch (e) {
        if (
          requestId === reportRequestRef.current
        ) {
          console.error(
            "LOAD ADMIN FULL REPORT ERROR:",
            e
          );

          setMessage(
            e.message || "Unable to load report."
          );

          setReport(null);
        }
      } finally {
        if (
          requestId === reportRequestRef.current
        ) {
          setLoadingReport(false);
        }
      }
    },
    [
      selectedShiftId,
      selectedShopId,
      fetchJson,
    ]
  );

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  // ==================================================
  // DISPLAY
  // ==================================================

  return (
    <section style={styles.page}>
      <div style={styles.title}>
        VIEW REPORTS
      </div>

      <div style={styles.filters}>
        <FilterField label="SHOP">
          <select
            style={styles.select}
            value={selectedShopId}
            disabled={loadingShops}
            onChange={(e) =>
              setSelectedShopId(e.target.value)
            }
          >
            {!shops.length && (
              <option value="">
                No shops available
              </option>
            )}

            {shops.map((s) => (
              <option
                key={s.id}
                value={s.id}
              >
                {s.shop_name} ({s.shop_type})
                {!s.is_active
                  ? " - INACTIVE"
                  : ""}
              </option>
            ))}
          </select>
        </FilterField>

        <FilterField label="BUSINESS DATE">
          <select
            style={styles.select}
            value={selectedBusinessDate}
            disabled={loadingShifts}
            onChange={(e) =>
              setSelectedBusinessDate(e.target.value)
            }
          >
            <option value="ALL">
              ALL DATES
            </option>

            {businessDates.map((d) => (
              <option
                key={d}
                value={d}
              >
                {formatBusinessDate(d)}
              </option>
            ))}
          </select>
        </FilterField>

        <FilterField label="CASHIER">
          <select
            style={styles.select}
            value={selectedCashier}
            disabled={
              loadingShifts || loadingRota
            }
            onChange={(e) =>
              setSelectedCashier(e.target.value)
            }
          >
            <option value="ALL">
              {loadingRota
                ? "LOADING DUTY ROTA..."
                : "ALL CASHIERS"}
            </option>

            {cashiers.map((n) => (
              <option
                key={n}
                value={n}
              >
                {n}
              </option>
            ))}
          </select>
        </FilterField>

        <FilterField label="STATUS">
          <select
            style={styles.select}
            value={selectedStatus}
            disabled={loadingShifts}
            onChange={(e) =>
              setSelectedStatus(e.target.value)
            }
          >
            <option value="ALL">
              ALL STATUS
            </option>

            <option value="OPEN">
              OPEN
            </option>

            <option value="CLOSED">
              CLOSED
            </option>
          </select>
        </FilterField>

        <FilterField label="SHIFT">
          <select
            style={styles.select}
            value={selectedShiftId}
            disabled={
              loadingShifts ||
              !filteredShifts.length
            }
            onChange={(e) =>
              setSelectedShiftId(e.target.value)
            }
          >
            {!filteredShifts.length && (
              <option value="">
                No matching shifts
              </option>
            )}

            {filteredShifts.map((s) => (
              <option
                key={s.id}
                value={s.id}
              >
                {formatBusinessDate(
                  s.business_date
                )}
                {" | "}
                {s.shift_name || "SHIFT"}
                {" | "}
                {cashierForShift(s)}
                {" | "}
                {s.status || "-"}
                {" | "}
                {formatTime(s.opened_at)}
              </option>
            ))}
          </select>
        </FilterField>

        <button
          type="button"
          style={styles.refresh}
          onClick={loadReport}
          disabled={
            loadingReport ||
            !selectedShiftId
          }
        >
          {loadingReport
            ? "LOADING..."
            : "REFRESH REPORT"}
        </button>
      </div>

      <div style={styles.count}>
        MATCHING SHIFTS:{" "}
        <strong>
          {filteredShifts.length}
        </strong>

        {loadingRota
          ? " · Loading Duty Rota names..."
          : ""}
      </div>

      {message && (
        <div style={styles.error}>
          {message}
        </div>
      )}

      {loadingReport && (
        <div style={styles.empty}>
          Loading report...
        </div>
      )}

      {!loadingReport &&
        !report &&
        !message && (
          <div style={styles.empty}>
            No report matches the selected filters.
          </div>
        )}

      {!loadingReport && report && (
        <ReportDisplay
          shop={selectedShop}
          report={report}
          cashierName={cashierForShift(
            report.shift
          )}
        />
      )}
    </section>
  );
}

// ==================================================
// DISPLAY COMPONENTS
// ==================================================

function FilterField({
  label,
  children,
}) {
  return (
    <label
      style={{
        minWidth: 0,
        display: "block",
      }}
    >
      <span style={styles.label}>
        {label}
      </span>

      {children}
    </label>
  );
}

function InfoCard({
  label,
  value,
}) {
  return (
    <div style={styles.info}>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

function InfoLine({
  label,
  value,
}) {
  return (
    <div style={styles.infoLine}>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  background,
}) {
  return (
    <div
      style={{
        ...styles.summaryCard,
        borderTop:
          `5px solid ${background}`,
      }}
    >
      <div
        style={{
          ...styles.summaryTitle,
          backgroundColor: background,
        }}
      >
        {label}
      </div>

      <strong style={styles.summaryValue}>
        KES {money(value)}
      </strong>
    </div>
  );
}

function SectionTitle({
  children,
  background,
}) {
  return (
    <div
      style={{
        ...styles.sectionTitle,
        backgroundColor: background,
      }}
    >
      {children}
    </div>
  );
}

function MoneyRow({
  label,
  value,
  strong = false,
}) {
  return (
    <div
      style={{
        ...styles.moneyRow,
        ...(strong
          ? styles.strongRow
          : {}),
      }}
    >
      <span>{label}</span>

      <strong>
        KES {money(value)}
      </strong>
    </div>
  );
}

function MoneySummary({
  label,
  value,
  strong = false,
}) {
  return (
    <div
      style={{
        ...styles.moneySummary,
        ...(strong
          ? styles.strongSummary
          : {}),
      }}
    >
      <small>{label}</small>

      <strong>
        KES {money(value)}
      </strong>
    </div>
  );
}

// ==================================================
// FULL REPORT DISPLAY
// ==================================================

function ReportDisplay({
  shop,
  report,
  cashierName,
}) {
  const {
    shift,
    platformRows,
    companyFloats,
    mshwariFloats,
    expenses,
    savings,
    totalSavings,
    paidSavings,
    pendingSavings,
  } = report;

  // Financial calculations unchanged.
  const totalSales = roundMoney(
    Number(shift.opening_balance || 0) +
      Number(shift.total_added_float || 0) +
      Number(shift.total_output || 0)
  );

  return (
    <div style={styles.report}>
      {/* REPORT HEADER */}

      <div style={styles.reportHeader}>
        <div style={styles.shopCard}>
          <strong style={{ fontSize: 20 }}>
            {shop?.shop_name || "Shop"}
          </strong>

          <span>
            DAILY SALES REPORT
          </span>

          <small>
            {shop?.shop_type || ""}
          </small>
        </div>

        <InfoCard
          label="CASHIER"
          value={cashierName}
        />

        <InfoCard
          label="BUSINESS DATE"
          value={formatBusinessDate(
            shift.business_date
          )}
        />

        <InfoCard
          label="SHIFT"
          value={shift.shift_name || "-"}
        />

        <InfoCard
          label="STATUS"
          value={shift.status || "-"}
        />
      </div>

      {/* TIMES */}

      <div style={styles.timeGrid}>
        <InfoLine
          label="Opened"
          value={formatDateTime(
            shift.opened_at
          )}
        />

        <InfoLine
          label="Closed"
          value={
            shift.closed_at
              ? formatDateTime(
                  shift.closed_at
                )
              : "Still Open"
          }
        />

        <InfoLine
          label="Scheduled"
          value={`${formatStoredTime(
            shift.scheduled_start
          )} - ${formatStoredTime(
            shift.scheduled_end
          )}`}
        />

        <InfoLine
          label="Calculation Mode"
          value={
            shift.admin_manual_totals
              ? "ADMIN MANUAL"
              : "AUTOMATIC"
          }
        />
      </div>

      {shift.admin_manual_totals && (
        <div style={styles.manual}>
          This shift contains Admin manual totals.
        </div>
      )}

      {/* SUMMARY */}

      <div style={styles.summaryGrid}>
        <SummaryCard
          label="BALANCE B/F"
          value={shift.opening_balance}
          background="#0e7490"
        />

        <SummaryCard
          label="TOTAL SALES"
          value={totalSales}
          background="#0891b2"
        />

        <SummaryCard
          label="TOTAL EXPENSES"
          value={shift.total_expenses}
          background="#be123c"
        />

        <SummaryCard
          label="CLOSING BALANCE"
          value={shift.closing_balance}
          background="#0369a1"
        />
      </div>

      {/* INCOME AND PLATFORMS */}

      <div style={styles.twoColumn}>
        <div style={styles.section}>
          <SectionTitle background="#0891b2">
            INCOME STATEMENT
          </SectionTitle>

          <MoneyRow
            label="Balance B/F"
            value={shift.opening_balance}
          />

          {Array.from(
            { length: 3 },
            (_, index) => (
              <MoneyRow
                key={`company-${index}`}
                label={`Added Float ${
                  index + 1
                } From Company`}
                value={
                  companyFloats[index]?.amount || 0
                }
              />
            )
          )}

          {Array.from(
            { length: 3 },
            (_, index) => (
              <MoneyRow
                key={`mshwari-${index}`}
                label={`Added Float ${
                  index + 1
                } From M-Shwari`}
                value={
                  mshwariFloats[index]?.amount || 0
                }
              />
            )
          )}

          <MoneyRow
            label="TOTAL ADDED"
            value={
              Number(
                shift.opening_balance || 0
              ) +
              Number(
                shift.total_added_float || 0
              )
            }
            strong
          />
        </div>

        {/* PLATFORM SALES — ALIGNED COLUMNS */}

        <div style={styles.section}>
          <SectionTitle background="#15803d">
            PLATFORM SALES
          </SectionTitle>

          <div style={styles.platformScroll}>
            <div style={styles.platformHeader}>
              <div
                style={{
                  textAlign: "left",
                }}
              >
                PLATFORM
              </div>

              <div>OPENING</div>
              <div>CLOSING</div>
              <div>SALES</div>
            </div>

            {platformRows.map((platform) => (
              <div
                key={platform.id}
                style={styles.platformRow}
              >
                <strong
                  style={{
                    textAlign: "left",
                    overflowWrap: "anywhere",
                  }}
                >
                  {platform.platform_name}
                </strong>

                <span>
                  {platform.opening
                    ? money(
                        platform.opening
                          .reading_value
                      )
                    : "-"}
                </span>

                <span>
                  {platform.closing
                    ? money(
                        platform.closing
                          .reading_value
                      )
                    : "-"}
                </span>

                <strong>
                  {platform.output === null
                    ? "-"
                    : money(
                        platform.output
                      )}
                </strong>
              </div>
            ))}

            <div style={styles.platformTotal}>
              <strong
                style={{
                  gridColumn: "1 / 4",
                  textAlign: "left",
                }}
              >
                TOTAL PLATFORM OUTPUT
              </strong>

              <strong>
                {money(shift.total_output)}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* EXPENSES */}

      <div style={styles.section}>
        <SectionTitle background="#be123c">
          EXPENSES
        </SectionTitle>

        <div style={styles.expenseGridHeader}>
          <div>NO.</div>
          <div>DESCRIPTION</div>
          <div>AMOUNT (KES)</div>
        </div>

        {!expenses.length && (
          <div style={styles.emptyRow}>
            No expenses recorded.
          </div>
        )}

        {expenses.map((expense, i) => (
          <div
            key={expense.id}
            style={styles.expenseGridRow}
          >
            <span>{i + 1}</span>

            <span>
              {expense.description || "-"}
            </span>

            <strong>
              {money(expense.amount)}
            </strong>
          </div>
        ))}

        <MoneyRow
          label="TOTAL EXPENSES"
          value={shift.total_expenses}
          strong
        />
      </div>

      {/* SAVINGS / BANKING */}

      <div style={styles.section}>
        <SectionTitle background="#0e7490">
          SAVINGS / BANKING
        </SectionTitle>

        <div style={styles.savingsSummary}>
          <InfoLine
            label="Total Savings"
            value={`KES ${money(
              totalSavings
            )}`}
          />

          <InfoLine
            label="Paid"
            value={`KES ${money(
              paidSavings
            )}`}
          />

          <InfoLine
            label="Pending"
            value={`KES ${money(
              pendingSavings
            )}`}
          />
        </div>

        <div style={styles.savingsHeader}>
          <div>DESCRIPTION</div>
          <div>AMOUNT</div>
          <div>STATUS</div>
        </div>

        {!savings.length && (
          <div style={styles.emptyRow}>
            No Savings / Banking records.
          </div>
        )}

        {savings.map((saving) => {
          const paid =
            upper(saving.payment_status) ===
            "PAID";

          return (
            <div
              key={saving.id}
              style={styles.savingsRow}
            >
              <span>
                {saving.description || "-"}
              </span>

              <strong>
                KES {money(saving.amount)}
              </strong>

              <span
                style={
                  paid
                    ? styles.paid
                    : styles.pending
                }
              >
                {paid
                  ? "PAID"
                  : "PENDING"}
              </span>
            </div>
          );
        })}

        <div style={styles.savingsNotice}>
          Savings / Banking does not reduce
          Closing Balance.
        </div>
      </div>

      {/* FINAL TOTALS */}

      <div style={styles.finalTotals}>
        <MoneySummary
          label="BALANCE B/F"
          value={shift.opening_balance}
        />

        <MoneySummary
          label="ADDED FLOAT"
          value={shift.total_added_float}
        />

        <MoneySummary
          label="PLATFORM OUTPUT"
          value={shift.total_output}
        />

        <MoneySummary
          label="TOTAL SALES"
          value={totalSales}
        />

        <MoneySummary
          label="EXPENSES"
          value={shift.total_expenses}
        />

        <MoneySummary
          label="CLOSING BALANCE"
          value={shift.closing_balance}
          strong
        />
      </div>

      {shift.admin_override_note && (
        <div style={styles.manual}>
          <strong>Admin Note: </strong>
          {shift.admin_override_note}
        </div>
      )}

      <div style={styles.readOnly}>
        READ ONLY REPORT — use Shift Corrections
        for any Admin changes.
      </div>
    </div>
  );
}

// ==================================================
// MONEY HELPERS
// ==================================================

function money(value) {
  return Number(value || 0).toLocaleString(
    "en-KE",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  );
}

function roundMoney(value) {
  return (
    Math.round(
      (Number(value) + Number.EPSILON) * 100
    ) / 100
  );
}

// ==================================================
// TIME AND DATE HELPERS
// ==================================================

function formatBusinessDate(value) {
  if (!value) return "-";

  try {
    return new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone: "Africa/Nairobi",
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    ).format(
      new Date(
        `${value}T12:00:00+03:00`
      )
    );
  } catch {
    return String(value);
  }
}

function formatDateTime(value) {
  if (!value) return "-";

  try {
    return new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone: "Africa/Nairobi",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    ).format(new Date(value));
  } catch {
    return String(value);
  }
}

function formatTime(value) {
  if (!value) return "-";

  try {
    return new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone: "Africa/Nairobi",
        hour: "2-digit",
        minute: "2-digit",
      }
    ).format(new Date(value));
  } catch {
    return "-";
  }
}

function formatStoredTime(value) {
  return value
    ? String(value).slice(0, 5)
    : "-";
}

// ==================================================
// STYLES
// ==================================================

const styles = {
  page: {
    marginTop: 20,
    backgroundColor: "#fff",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    overflow: "hidden",
    color: NAVY,
  },

  title: {
    backgroundColor: NAVY,
    color: "white",
    padding: "12px 16px",
    fontSize: 15,
    fontWeight: "bold",
  },

  filters: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(min(100%,170px),1fr))",
    gap: 8,
    alignItems: "end",
    padding: 15,
    backgroundColor: "#f8fafc",
    borderBottom: "1px solid #e2e8f0",
  },

  label: {
    display: "block",
    marginBottom: 5,
    fontSize: 10,
    fontWeight: "bold",
    color: "#334155",
  },

  select: {
    width: "100%",
    boxSizing: "border-box",
    padding: 9,
    border: "1px solid #94a3b8",
    borderRadius: 5,
    backgroundColor: "white",
    fontSize: 11,
  },

  refresh: {
    padding: 10,
    border: "none",
    borderRadius: 5,
    backgroundColor: "#0369a1",
    color: "white",
    fontWeight: "bold",
    cursor: "pointer",
  },

  count: {
    padding: "7px 15px",
    backgroundColor: "#e0f2fe",
    color: "#075985",
    fontSize: 10,
    borderBottom: "1px solid #bae6fd",
  },

  report: {
    padding: 15,
  },

  reportHeader: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(min(100%,150px),1fr))",
    gap: 8,
    marginBottom: 10,
  },

  shopCard: {
    backgroundColor: "#0e7490",
    color: "white",
    minHeight: 72,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 5,
    textAlign: "center",
  },

  info: {
    minHeight: 72,
    padding: 8,
    backgroundColor: "#f1f5f9",
    border: "1px solid #cbd5e1",
    borderRadius: 5,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
    gap: 5,
    overflowWrap: "anywhere",
  },

  timeGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(min(100%,180px),1fr))",
    gap: 8,
    marginBottom: 12,
  },

  infoLine: {
    display: "flex",
    flexDirection: "column",
    gap: 3,
    padding: 8,
    border: "1px solid #e2e8f0",
    backgroundColor: "#f8fafc",
    borderRadius: 4,
  },

  manual: {
    padding: 9,
    marginBottom: 12,
    backgroundColor: "#fef3c7",
    color: "#92400e",
    border: "1px solid #fde68a",
    borderRadius: 5,
    textAlign: "center",
    fontWeight: "bold",
  },

  summaryGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(min(100%,180px),1fr))",
    gap: 8,
    marginBottom: 14,
  },

  summaryCard: {
    border: "1px solid #cbd5e1",
    borderRadius: 5,
    overflow: "hidden",
    textAlign: "center",
    backgroundColor: "white",
  },

  summaryTitle: {
    color: "white",
    padding: 7,
    fontSize: 10,
    fontWeight: "bold",
  },

  summaryValue: {
    display: "block",
    padding: 10,
    fontSize: 16,
  },

  twoColumn: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(min(100%,430px),1fr))",
    gap: 12,
    marginBottom: 12,
  },

  section: {
    minWidth: 0,
    border: "1px solid #cbd5e1",
    borderRadius: 5,
    overflow: "hidden",
    marginBottom: 12,
  },

  sectionTitle: {
    color: "white",
    padding: "8px 10px",
    fontWeight: "bold",
    fontSize: 11,
  },

  moneyRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    padding: "8px 10px",
    borderTop: "1px solid #e2e8f0",
    fontSize: 10,
  },

  strongRow: {
    backgroundColor: "#f1f5f9",
    fontWeight: "bold",
  },

  // ===============================================
  // PLATFORM TABLE — MATCHING COLUMN WIDTHS
  // ===============================================

  platformScroll: {
    width: "100%",
    overflowX: "auto",
  },

  platformHeader: {
    display: "grid",
    gridTemplateColumns: PLATFORM_COLUMNS,
    minWidth: 445,
    gap: 10,
    alignItems: "center",
    padding: "9px 10px",
    backgroundColor: "#dcfce7",
    color: "#166534",
    fontWeight: "bold",
    fontSize: 10,
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
    boxSizing: "border-box",
  },

  platformRow: {
    display: "grid",
    gridTemplateColumns: PLATFORM_COLUMNS,
    minWidth: 445,
    gap: 10,
    alignItems: "center",
    padding: "9px 10px",
    borderTop: "1px solid #e2e8f0",
    fontSize: 11,
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
    boxSizing: "border-box",
  },

  platformTotal: {
    display: "grid",
    gridTemplateColumns: PLATFORM_COLUMNS,
    minWidth: 445,
    gap: 10,
    padding: "10px",
    backgroundColor: "#dcfce7",
    borderTop: "1px solid #86efac",
    color: "#166534",
    textAlign: "right",
    fontSize: 11,
    boxSizing: "border-box",
    fontVariantNumeric: "tabular-nums",
  },

  expenseGridHeader: {
    display: "grid",
    gridTemplateColumns: "0.4fr 3fr 1fr",
    gap: 8,
    padding: 7,
    backgroundColor: "#ffe4e6",
    color: "#9f1239",
    fontWeight: "bold",
    fontSize: 9,
  },

  expenseGridRow: {
    display: "grid",
    gridTemplateColumns: "0.4fr 3fr 1fr",
    gap: 8,
    padding: 8,
    borderTop: "1px solid #e2e8f0",
    fontSize: 10,
  },

  savingsSummary: {
    display: "grid",
    gridTemplateColumns:
      "repeat(3,minmax(0,1fr))",
    gap: 8,
    padding: 10,
  },

  savingsHeader: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr 1fr",
    gap: 8,
    padding: 7,
    backgroundColor: "#cffafe",
    color: "#155e75",
    fontWeight: "bold",
    fontSize: 9,
  },

  savingsRow: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr 1fr",
    gap: 8,
    alignItems: "center",
    padding: 8,
    borderTop: "1px solid #e2e8f0",
    fontSize: 10,
  },

  paid: {
    padding: 5,
    backgroundColor: "#dcfce7",
    color: "#166534",
    borderRadius: 4,
    textAlign: "center",
    fontWeight: "bold",
  },

  pending: {
    padding: 5,
    backgroundColor: "#fef3c7",
    color: "#92400e",
    borderRadius: 4,
    textAlign: "center",
    fontWeight: "bold",
  },

  savingsNotice: {
    padding: 7,
    backgroundColor: "#ecfeff",
    color: "#155e75",
    textAlign: "center",
    fontSize: 9,
  },

  finalTotals: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(min(100%,145px),1fr))",
    gap: 7,
    marginTop: 12,
  },

  moneySummary: {
    padding: 9,
    border: "1px solid #cbd5e1",
    borderRadius: 5,
    backgroundColor: "#f8fafc",
    display: "flex",
    flexDirection: "column",
    gap: 4,
    textAlign: "center",
    fontSize: 9,
  },

  strongSummary: {
    backgroundColor: "#dcfce7",
    color: "#166534",
    border: "1px solid #86efac",
  },

  readOnly: {
    marginTop: 12,
    padding: 9,
    backgroundColor: "#e0e7ff",
    color: "#3730a3",
    textAlign: "center",
    fontWeight: "bold",
    fontSize: 9,
  },

  emptyRow: {
    padding: 12,
    textAlign: "center",
    color: "#64748b",
    backgroundColor: "#f8fafc",
  },

  empty: {
    padding: 25,
    textAlign: "center",
    color: "#64748b",
  },

  error: {
    margin: 12,
    padding: 10,
    backgroundColor: "#fef2f2",
    color: "#991b1b",
    borderRadius: 5,
  },
};
