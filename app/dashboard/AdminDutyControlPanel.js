"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const navy = "#073b5c";

const field = {
  boxSizing: "border-box",
  width: "100%",
  minWidth: 0,
  padding: "7px 8px",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  color: "#0f172a",
  background: "#fff",
  fontSize: 12,
  fontFamily: "inherit",
};

const button = {
  background: navy,
  color: "#fff",
  border: "1px solid #073b5c",
  borderRadius: 6,
  padding: "8px 12px",
  fontSize: 12,
  fontWeight: 750,
  cursor: "pointer",
};

const paleButton = {
  ...button,
  background: "#fff",
  color: navy,
};

function todayNairobi() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const p = Object.fromEntries(
    parts.map((x) => [x.type, x.value])
  );

  return `${p.year}-${p.month}-${p.day}`;
}

function rotaKey(day, shopId, slot) {
  return `${day}|${shopId}|${slot}`;
}

function positionKey(shopId, slot) {
  return `${shopId}|${slot}`;
}

function monday(dateString) {
  const dt = new Date(`${dateString}T12:00:00Z`);
  const days = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - days);
  return dt.toISOString().slice(0, 10);
}

function readErr(error) {
  return String(
    error?.message || "Could not save."
  ).replaceAll("_", " ");
}

export default function AdminDutyControlPanel({
  supabaseUrl,
  supabaseAnonKey,
  accessToken,
  onChanged,
}) {
  const [people, setPeople] = useState([]);
  const [shops, setShops] = useState([]);
  const [slots, setSlots] = useState([]);

  const [baseAssignments, setBaseAssignments] = useState({});
  const [draft, setDraft] = useState({});

  const [anchor, setAnchor] = useState("");
  const [savedAnchor, setSavedAnchor] = useState("");
  const [version, setVersion] = useState(null);

  const [week, setWeek] = useState(1);
  const [reason, setReason] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const [dateFrom, setDateFrom] = useState(todayNairobi);
  const [dateTo, setDateTo] = useState(todayNairobi);

  const [swapMode, setSwapMode] = useState("EMPLOYEES");
  const [personA, setPersonA] = useState("");
  const [personB, setPersonB] = useState("");
  const [positionB, setPositionB] = useState("");

  const [preview, setPreview] = useState([]);
  const [previewError, setPreviewError] = useState("");

  const base = useMemo(
    () => String(supabaseUrl || "").replace(/\/+$/, ""),
    [supabaseUrl]
  );

  const rpc = useCallback(
    async (functionName, payload = {}, signal) => {
      if (!base || !supabaseAnonKey || !accessToken) {
        throw new Error("Admin login required.");
      }

      const response = await fetch(
        `${base}/rest/v1/rpc/${functionName}`,
        {
          method: "POST",
          cache: "no-store",
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          ...(signal ? { signal } : {}),
        }
      );

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          body?.message ||
          body?.details ||
          `${functionName} failed.`
        );
      }

      return body;
    },
    [base, supabaseAnonKey, accessToken]
  );

  const load = useCallback(
    async (signal) => {
      const [rota, employees, shopOptions] = await Promise.all([
        rpc("tl_rota_v2_get", {}, signal),
        rpc("tl_admin_master_employee_list", {}, signal),
        rpc("tl_admin_master_employee_shops_v1", {}, signal),
      ]);

      if (
        !rota ||
        !Array.isArray(rota.slots) ||
        !Array.isArray(rota.baseline) ||
        !Array.isArray(employees) ||
        !Array.isArray(shopOptions)
      ) {
        throw new Error("Unexpected Master Rota data.");
      }

      const parsed = {};

      for (const item of rota.baseline) {
        parsed[
          rotaKey(
            Number(item.cycle_day),
            item.shop_id,
            Number(item.slot_no)
          )
        ] = item.employee_id;
      }

      setBaseAssignments(parsed);
      setDraft({ ...parsed });
      setPeople(employees);

      const seen = new Set(
        shopOptions.map((s) => s.id)
      );

      const mergedShops = [...shopOptions];

      for (const slot of rota.slots) {
        if (!seen.has(slot.shop_id)) {
          mergedShops.push({
            id: slot.shop_id,
            name: slot.shop_name || "Shop",
          });

          seen.add(slot.shop_id);
        }
      }

      setShops(mergedShops);
      setSlots(rota.slots);

      setAnchor(rota.anchor_monday || "");
      setSavedAnchor(rota.anchor_monday || "");
      setVersion(Number(rota.version));
    },
    [rpc]
  );

  useEffect(() => {
    if (!base || !supabaseAnonKey || !accessToken) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    setLoading(true);

    load(controller.signal)
      .catch((e) => {
        if (e?.name !== "AbortError") {
          setError(readErr(e));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [base, supabaseAnonKey, accessToken, load]);

  // Refresh Master Employees without discarding rota edits.
  useEffect(() => {
    if (!base || !accessToken) return;

    const timer = setInterval(() => {
      rpc("tl_admin_master_employee_list")
        .then((next) => {
          if (Array.isArray(next)) {
            setPeople(next);
          }
        })
        .catch(() => {});
    }, 60000);

    return () => clearInterval(timer);
  }, [base, accessToken, rpc]);

  const active = useMemo(
    () =>
      people
        .filter((p) => p.employment_status === "ACTIVE")
        .sort((a, b) =>
          String(a.full_name).localeCompare(
            String(b.full_name)
          )
        ),
    [people]
  );

  const byId = useMemo(
    () => new Map(
      people.map((p) => [p.employee_id, p])
    ),
    [people]
  );

  const shopById = useMemo(
    () => new Map(
      shops.map((s) => [s.id, s.name])
    ),
    [shops]
  );

  const sortedShops = useMemo(
    () =>
      [...shops].sort((a, b) =>
        String(a.name).localeCompare(String(b.name))
      ),
    [shops]
  );

  const slotsByShop = useMemo(() => {
    const map = new Map();

    for (const p of slots) {
      const key = p.shop_id;

      map.set(
        key,
        [...(map.get(key) || []), Number(p.slot_no)]
          .sort((a, b) => a - b)
      );
    }

    return map;
  }, [slots]);

  const orderedPositions = useMemo(
    () =>
      sortedShops.flatMap((s) =>
        (slotsByShop.get(s.id) || []).map((slot) => ({
          shop_id: s.id,
          slot_no: slot,
          shop_name: s.name,
        }))
      ),
    [sortedShops, slotsByShop]
  );

  const weekChanged = (which) => {
    const first = (which - 1) * 7;

    return orderedPositions.some((pos) =>
      DAYS.some((_, i) => {
        const key = rotaKey(
          first + i,
          pos.shop_id,
          pos.slot_no
        );

        return (
          (draft[key] || "") !==
          (baseAssignments[key] || "")
        );
      })
    );
  };

  const anyDirty =
    weekChanged(1) || weekChanged(2);

  const categorise = (person) => {
    if (person.shop_id) {
      return shopById.get(person.shop_id) || "Shop";
    }

    if (person.job_title === "TEAM_LEADER") {
      return "Team Leader";
    }

    if (person.job_title === "ACCOUNTANT") {
      return "Accountant";
    }

    return "Reliever";
  };

  const rosteredIds = useMemo(
    () =>
      new Set(
        [
          ...Object.values(baseAssignments),
          ...Object.values(draft),
        ].filter(Boolean)
      ),
    [baseAssignments, draft]
  );

  const offOnDay = (index) => {
    const scheduled = new Set(
      orderedPositions
        .map((p) =>
          draft[
            rotaKey(index, p.shop_id, p.slot_no)
          ]
        )
        .filter(Boolean)
    );

    return active.filter(
      (p) =>
        rosteredIds.has(p.employee_id) &&
        !scheduled.has(p.employee_id)
    );
  };

  // Selecting someone already assigned on a day swaps cells.
  const setCell = (day, shopId, slot, employeeId) => {
    setDraft((old) => {
      const key = rotaKey(day, shopId, slot);
      const previous = old[key] || "";

      const updated = {
        ...old,
        [key]: employeeId,
      };

      if (employeeId) {
        for (const p of orderedPositions) {
          const other = rotaKey(
            day,
            p.shop_id,
            p.slot_no
          );

          if (
            other !== key &&
            updated[other] === employeeId
          ) {
            updated[other] = previous;
            break;
          }
        }
      }

      return updated;
    });

    setNotice("");
    setError("");
  };

  const getReason = () => {
    if (reason.trim().length < 3) {
      setError("Reason required.");
      return null;
    }

    return reason.trim();
  };

  const afterSave = (result, message) => {
    if (result?.success !== true) {
      throw new Error("Save not confirmed.");
    }

    setVersion(Number(result.version));
    setReason("");
    setNotice(message);
    setError("");

    onChanged?.();
  };

  const refresh = async () => {
    if (
      anyDirty &&
      !window.confirm("Discard unsaved rota changes?")
    ) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      await load();
      setNotice("Refreshed.");
    } catch (e) {
      setError(readErr(e));
    } finally {
      setSaving(false);
    }
  };

  const saveWeek = async () => {
    if (
      saving ||
      loading ||
      !weekChanged(week)
    ) {
      return;
    }

    if (anchor !== savedAnchor) {
      setError("Set start Monday first.");
      return;
    }

    const why = getReason();
    if (!why) return;

    const first = (week - 1) * 7;
    const p_entries = [];

    for (const pos of orderedPositions) {
      for (let day = 0; day < 7; day++) {
        p_entries.push({
          day_index: day,
          shop_id: pos.shop_id,
          slot_no: pos.slot_no,
          employee_id:
            draft[
              rotaKey(
                first + day,
                pos.shop_id,
                pos.slot_no
              )
            ] || null,
        });
      }
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const result = await rpc(
        "tl_rota_v2_week_save",
        {
          p_week: week,
          p_entries,
          p_reason: why,
          p_expected_version: version,
        }
      );

      if (result?.success !== true) {
        throw new Error("Save not confirmed.");
      }

      setBaseAssignments((prev) => {
        const next = { ...prev };

        for (const pos of orderedPositions) {
          for (let day = 0; day < 7; day++) {
            const key = rotaKey(
              first + day,
              pos.shop_id,
              pos.slot_no
            );

            if (draft[key]) {
              next[key] = draft[key];
            } else {
              delete next[key];
            }
          }
        }

        return next;
      });

      afterSave(
        result,
        `Week ${week} saved.`
      );
    } catch (e) {
      setError(readErr(e));
    } finally {
      setSaving(false);
    }
  };

  const updateAnchor = async () => {
    if (saving || loading) return;

    if (anyDirty) {
      setError("Save week changes first.");
      return;
    }

    const why = getReason();
    if (!why) return;

    if (!anchor || monday(anchor) !== anchor) {
      setError("Choose a Monday.");
      return;
    }

    if (!window.confirm("Set 14-day cycle start?")) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      const result = await rpc(
        "tl_rota_v2_anchor_set",
        {
          p_anchor_monday: anchor,
          p_reason: why,
          p_expected_version: version,
        }
      );

      afterSave(
        result,
        "Start date saved."
      );

      setSavedAnchor(anchor);
    } catch (e) {
      setError(readErr(e));
    } finally {
      setSaving(false);
    }
  };

  const changeSlotCount = async (
    shopId,
    delta
  ) => {
    if (saving || loading) return;

    if (anyDirty) {
      setError("Save week changes first.");
      return;
    }

    const why = getReason();
    if (!why) return;

    const current =
      slotsByShop.get(shopId)?.length || 0;

    if (
      current + delta < 1 ||
      current + delta > 4
    ) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      const result = await rpc(
        "tl_rota_v2_slots_set",
        {
          p_shop_id: shopId,
          p_slot_count: current + delta,
          p_reason: why,
          p_expected_version: version,
        }
      );

      if (result?.success !== true) {
        throw new Error("Save not confirmed.");
      }

      await load();

      setReason("");
      setNotice("Position updated.");
      onChanged?.();
    } catch (e) {
      setError(readErr(e));
    } finally {
      setSaving(false);
    }
  };

  const loadPreview = useCallback(
    async (date, signal) => {
      if (
        !date ||
        !base ||
        !accessToken ||
        version === null
      ) {
        return;
      }

      try {
        const result = await rpc(
          "tl_rota_v2_preview",
          {
            p_start_date: date,
            p_days: 1,
          },
          signal
        );

        if (!signal?.aborted) {
          setPreview(
            Array.isArray(result) ? result : []
          );

          setPreviewError("");
        }
      } catch (e) {
        if (
          e?.name !== "AbortError" &&
          !signal?.aborted
        ) {
          setPreviewError(readErr(e));
        }
      }
    },
    [rpc, base, accessToken, version]
  );

  useEffect(() => {
    const controller = new AbortController();

    loadPreview(
      dateFrom,
      controller.signal
    );

    return () => controller.abort();
  }, [dateFrom, loadPreview]);

  const previewMap = useMemo(
    () =>
      new Map(
        preview.map((p) => [
          positionKey(
            p.shop_id,
            Number(p.slot_no)
          ),
          p,
        ])
      ),
    [preview]
  );

  const previewLabel = (position) => {
    const current = previewMap.get(
      positionKey(
        position.shop_id,
        position.slot_no
      )
    );

    const who = current?.employee_id
      ? byId.get(current.employee_id)?.full_name ||
        "Unknown"
      : "—";

    return (
      `${position.shop_name} · ` +
      `${position.slot_no} · ${who}`
    );
  };

  const applySwap = async () => {
    if (saving || loading) return;

    if (anyDirty) {
      setError("Save week changes first.");
      return;
    }

    if (anchor !== savedAnchor) {
      setError("Set start Monday first.");
      return;
    }

    const why = getReason();
    if (!why) return;

    if (
      !dateFrom ||
      !dateTo ||
      dateFrom > dateTo
    ) {
      setError("Check swap dates.");
      return;
    }

    let fn;
    let args;

    if (swapMode === "EMPLOYEES") {
      if (
        !personA ||
        !personB ||
        personA === personB
      ) {
        setError("Choose two employees.");
        return;
      }

      fn = "tl_rota_v2_employee_swap";

      args = {
        p_employee_a: personA,
        p_employee_b: personB,
      };
    } else {
      if (!personA || !positionB) {
        setError("Choose employee and destination.");
        return;
      }

      const target = orderedPositions.find(
        (p) =>
          positionKey(
            p.shop_id,
            p.slot_no
          ) === positionB
      );

      if (!target) {
        setError("Invalid position.");
        return;
      }

      fn = "tl_rota_v2_employee_move";

      args = {
        p_employee_id: personA,
        p_to_shop: target.shop_id,
        p_to_slot: target.slot_no,
      };
    }

    const action =
      swapMode === "EMPLOYEES"
        ? "employee swap"
        : "employee move";

    if (
      !window.confirm(
        `Apply ${action} ${dateFrom} → ${dateTo}?`
      )
    ) {
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const result = await rpc(fn, {
        ...args,
        p_start_date: dateFrom,
        p_end_date: dateTo,
        p_reason: why,
        p_expected_version: version,
      });

      afterSave(
        result,
        "Temporary change saved."
      );

      await loadPreview(dateFrom);
    } catch (e) {
      setError(readErr(e));
    } finally {
      setSaving(false);
    }
  };

  if (
    !base ||
    !supabaseAnonKey ||
    !accessToken
  ) {
    return (
      <div style={{ color: "#b91c1c", padding: 12 }}>
        Admin login required.
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: 16 }}>
        Loading rota...
      </div>
    );
  }

  return (
    <section
      style={{
        background: "#fff",
        border: "1px solid #cbd5e1",
        borderRadius: 10,
        overflow: "hidden",
        color: "#0f172a",
      }}
    >
      <div
        style={{
          background:
            "linear-gradient(90deg,#052d4b,#064b6b)",
          color: "#fff",
          padding: "13px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <strong style={{ fontSize: 16 }}>
          DUTY / ROTA
        </strong>

        <button
          type="button"
          style={{
            ...paleButton,
            background:
              week === 1 ? "#67e8f9" : "#fff",
          }}
          onClick={() => setWeek(1)}
        >
          Week 1
        </button>

        <button
          type="button"
          style={{
            ...paleButton,
            background:
              week === 2 ? "#67e8f9" : "#fff",
          }}
          onClick={() => setWeek(2)}
        >
          Week 2
        </button>

        <span
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
          }}
        >
          Start

          <input
            aria-label="Cycle start Monday"
            type="date"
            value={anchor}
            style={{
              ...field,
              width: 145,
            }}
            onChange={(e) =>
              setAnchor(e.target.value)
            }
            disabled={saving}
          />

          <button
            type="button"
            style={paleButton}
            onClick={updateAnchor}
            disabled={saving}
          >
            Set
          </button>

          <button
            type="button"
            style={paleButton}
            onClick={refresh}
            disabled={saving}
          >
            ↻
          </button>
        </span>
      </div>

      <div
        style={{
          overflowX: "auto",
          padding: 10,
        }}
      >
        <table
          style={{
            width: "100%",
            minWidth: 970,
            borderCollapse: "separate",
            borderSpacing: 0,
            fontSize: 11,
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  width: 165,
                  background: navy,
                  color: "#fff",
                  padding: 9,
                  textAlign: "left",
                }}
              >
                Shop / Position
              </th>

              {DAYS.map((day) => (
                <th
                  key={day}
                  style={{
                    background: navy,
                    color: "#fff",
                    minWidth: 115,
                    padding: 9,
                  }}
                >
                  {day}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {orderedPositions.map(
              (pos, rowIndex) => {
                const shopSlots =
                  slotsByShop.get(pos.shop_id) || [];

                const firstSlot =
                  pos.slot_no === 1;

                const lastSlot =
                  pos.slot_no ===
                  shopSlots[shopSlots.length - 1];

                return (
                  <tr
                    key={positionKey(
                      pos.shop_id,
                      pos.slot_no
                    )}
                    style={{
                      background:
                        rowIndex % 2
                          ? "#f8fafc"
                          : "#fff",
                    }}
                  >
                    <th
                      scope="row"
                      style={{
                        textAlign: "left",
                        padding: "7px 5px",
                        borderBottom:
                          "1px solid #e2e8f0",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <span>
                        {pos.shop_name} · {pos.slot_no}
                      </span>

                      {firstSlot &&
                        shopSlots.length < 4 && (
                          <button
                            aria-label={
                              `Add position at ${pos.shop_name}`
                            }
                            type="button"
                            disabled={saving}
                            onClick={() =>
                              changeSlotCount(
                                pos.shop_id,
                                1
                              )
                            }
                            style={{
                              ...paleButton,
                              padding: "2px 5px",
                              marginLeft: 5,
                            }}
                          >
                            +
                          </button>
                        )}

                      {lastSlot &&
                        shopSlots.length > 1 && (
                          <button
                            aria-label={
                              `Remove last position at ${pos.shop_name}`
                            }
                            type="button"
                            disabled={saving}
                            onClick={() =>
                              changeSlotCount(
                                pos.shop_id,
                                -1
                              )
                            }
                            style={{
                              ...paleButton,
                              padding: "2px 5px",
                              marginLeft: 3,
                            }}
                          >
                            −
                          </button>
                        )}
                    </th>

                    {DAYS.map((day, dayIndex) => {
                      const cycleDay =
                        (week - 1) * 7 + dayIndex;

                      const selected =
                        draft[
                          rotaKey(
                            cycleDay,
                            pos.shop_id,
                            pos.slot_no
                          )
                        ] || "";

                      return (
                        <td
                          key={day}
                          style={{
                            padding: 4,
                            borderBottom:
                              "1px solid #e2e8f0",
                          }}
                        >
                          <select
                            aria-label={
                              `${pos.shop_name} ` +
                              `position ${pos.slot_no} ` +
                              `${day} week ${week}`
                            }
                            value={selected}
                            style={{
                              ...field,
                              fontSize: 11,
                              padding: "7px 3px",
                            }}
                            disabled={saving}
                            onChange={(e) =>
                              setCell(
                                cycleDay,
                                pos.shop_id,
                                pos.slot_no,
                                e.target.value
                              )
                            }
                          >
                            <option value="">—</option>

                            {selected &&
                              !active.some(
                                (p) =>
                                  p.employee_id ===
                                  selected
                              ) && (
                                <option value={selected}>
                                  {byId.get(selected)
                                    ?.full_name ||
                                    "Unavailable"}{" "}
                                  · Inactive
                                </option>
                              )}

                            {active.map((p) => (
                              <option
                                key={p.employee_id}
                                value={p.employee_id}
                              >
                                {p.full_name} ·{" "}
                                {categorise(p)}
                              </option>
                            ))}
                          </select>
                        </td>
                      );
                    })}
                  </tr>
                );
              }
            )}

            <tr>
              <th
                scope="row"
                style={{
                  padding: 9,
                  textAlign: "left",
                  background: "#e0f2fe",
                }}
              >
                OFF
              </th>

              {DAYS.map((day, i) => {
                const off = offOnDay(
                  (week - 1) * 7 + i
                );

                return (
                  <td
                    key={day}
                    style={{
                      textAlign: "center",
                      padding: 5,
                      background: "#eff6ff",
                    }}
                  >
                    <details>
                      <summary
                        style={{
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                          fontWeight: 700,
                        }}
                      >
                        {off.length} OFF
                      </summary>

                      <div
                        style={{
                          maxHeight: 150,
                          overflowY: "auto",
                          textAlign: "left",
                          minWidth: 130,
                        }}
                      >
                        {off.map((p) => (
                          <div
                            key={p.employee_id}
                            style={{
                              padding: "2px 0",
                            }}
                          >
                            {p.full_name}
                          </div>
                        ))}
                      </div>
                    </details>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      <div
        style={{
          borderTop: "1px solid #e2e8f0",
          padding: 13,
          display: "grid",
          gap: 9,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <strong style={{ fontSize: 13 }}>
            Temporary
          </strong>

          <button
            type="button"
            style={{
              ...paleButton,
              background:
                swapMode === "EMPLOYEES"
                  ? "#e0f2fe"
                  : "#fff",
            }}
            onClick={() =>
              setSwapMode("EMPLOYEES")
            }
          >
            Swap
          </button>

          <button
            type="button"
            style={{
              ...paleButton,
              background:
                swapMode === "MOVE"
                  ? "#e0f2fe"
                  : "#fff",
            }}
            onClick={() =>
              setSwapMode("MOVE")
            }
          >
            Move
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit,minmax(160px,1fr))",
            gap: 8,
          }}
        >
          <label style={{ fontSize: 11 }}>
            From
            <input
              type="date"
              style={field}
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);

                if (e.target.value > dateTo) {
                  setDateTo(e.target.value);
                }
              }}
              disabled={saving}
            />
          </label>

          <label style={{ fontSize: 11 }}>
            To
            <input
              type="date"
              style={field}
              value={dateTo}
              min={dateFrom}
              onChange={(e) =>
                setDateTo(e.target.value)
              }
              disabled={saving}
            />
          </label>

          <label style={{ fontSize: 11 }}>
            {swapMode === "EMPLOYEES"
              ? "Employee 1"
              : "Employee"}

            <select
              style={field}
              value={personA}
              onChange={(e) =>
                setPersonA(e.target.value)
              }
              disabled={saving}
            >
              <option value="">Select</option>

              {active.map((p) => (
                <option
                  value={p.employee_id}
                  key={p.employee_id}
                >
                  {p.full_name} · {categorise(p)}
                </option>
              ))}
            </select>
          </label>

          {swapMode === "EMPLOYEES" ? (
            <label style={{ fontSize: 11 }}>
              Employee 2
              <select
                style={field}
                value={personB}
                onChange={(e) =>
                  setPersonB(e.target.value)
                }
                disabled={saving}
              >
                <option value="">Select</option>

                {active.map((p) => (
                  <option
                    value={p.employee_id}
                    key={p.employee_id}
                  >
                    {p.full_name} · {categorise(p)}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label style={{ fontSize: 11 }}>
              To position
              <select
                style={field}
                value={positionB}
                onChange={(e) =>
                  setPositionB(e.target.value)
                }
                disabled={saving}
              >
                <option value="">Select</option>

                {orderedPositions.map((p) => (
                  <option
                    value={positionKey(
                      p.shop_id,
                      p.slot_no
                    )}
                    key={positionKey(
                      p.shop_id,
                      p.slot_no
                    )}
                  >
                    {previewLabel(p)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {previewError ? (
          <span
            role="alert"
            style={{
              color: "#b91c1c",
              fontSize: 11,
            }}
          >
            {previewError}
          </span>
        ) : null}
      </div>

      <div
        style={{
          padding: 13,
          display: "grid",
          gap: 8,
          borderTop: "1px solid #e2e8f0",
        }}
      >
        <label
          htmlFor="rota-v2-reason"
          style={{
            fontSize: 12,
            fontWeight: 800,
          }}
        >
          Reason
        </label>

        <textarea
          id="rota-v2-reason"
          rows={2}
          placeholder="Reason"
          value={reason}
          onChange={(e) =>
            setReason(e.target.value)
          }
          disabled={saving}
          style={{
            ...field,
            resize: "vertical",
          }}
        />

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <button
            type="button"
            style={button}
            onClick={saveWeek}
            disabled={
              saving || !weekChanged(week)
            }
          >
            {saving
              ? "Saving..."
              : `Save Week ${week}${
                  weekChanged(week) ? " *" : ""
                }`}
          </button>

          <button
            type="button"
            style={paleButton}
            onClick={applySwap}
            disabled={saving}
          >
            Apply{" "}
            {swapMode === "EMPLOYEES"
              ? "Swap"
              : "Move"}
          </button>

          {notice ? (
            <span
              role="status"
              style={{
                color: "#15803d",
                fontSize: 12,
              }}
            >
              {notice}
            </span>
          ) : null}

          {error ? (
            <span
              role="alert"
              style={{
                color: "#b91c1c",
                fontSize: 12,
              }}
            >
              {error}
            </span>
          ) : null}
        </div>
      </div>
    </section>
  );
}
