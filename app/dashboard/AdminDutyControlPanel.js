"use client";

import AdminDutyControlPanelLegacy from "./AdminDutyControlPanelLegacy";
import AdminMasterDutyPanel from "./AdminMasterDutyPanel";

export default function AdminDutyControlPanel({
  supabaseUrl,
  supabaseAnonKey,
  accessToken,
  onChanged,
}) {
  return (
    <div
      style={{
        display: "grid",
        gap: 18,
        width: "100%",
        minWidth: 0,
      }}
    >
      {/* MASTER EMPLOYEE DUTY ROTA */}

      <AdminMasterDutyPanel
        supabaseUrl={supabaseUrl}
        supabaseAnonKey={supabaseAnonKey}
        accessToken={accessToken}
        onChanged={onChanged}
      />

      {/* ORIGINAL DUTY CONTROL */}

      <AdminDutyControlPanelLegacy
        supabaseUrl={supabaseUrl}
        supabaseAnonKey={supabaseAnonKey}
        accessToken={accessToken}
        onChanged={onChanged}
      />
    </div>
  );
}
