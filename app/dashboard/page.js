"use client";

import { useRouter } from "next/navigation";

export default function Dashboard() {
  const router = useRouter();

  function logout() {
    router.push("/login");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#f4f7fb",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <header
        style={{
          backgroundColor: "#0f172a",
          color: "white",
          padding: "20px 30px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>TEAM LEGEND</h1>
          <p style={{ margin: "5px 0 0", color: "#cbd5e1" }}>
            Sales Management System
          </p>
        </div>

        <button
          onClick={logout}
          style={{
            padding: "10px 20px",
            border: "none",
            borderRadius: "8px",
            backgroundColor: "#dc2626",
            color: "white",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          Logout
        </button>
      </header>

      <section style={{ padding: "30px" }}>
        <h2>Dashboard</h2>
        <p>Welcome to Team Legend Sales Management System.</p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "20px",
            marginTop: "30px",
          }}
        >
          <DashboardCard title="Shops" value="27" />
          <DashboardCard title="Today's Sales" value="KES 0" />
          <DashboardCard title="Expenses" value="KES 0" />
          <DashboardCard title="Closing Balance" value="KES 0" />
        </div>
      </section>
    </main>
  );
}

function DashboardCard({ title, value }) {
  return (
    <div
      style={{
        backgroundColor: "white",
        padding: "24px",
        borderRadius: "12px",
        boxShadow: "0 4px 14px rgba(0,0,0,0.08)",
      }}
    >
      <p style={{ margin: 0, color: "#64748b" }}>{title}</p>

      <h2
        style={{
          marginTop: "10px",
          marginBottom: 0,
          color: "#0f172a",
        }}
      >
        {value}
      </h2>
    </div>
  );
}
