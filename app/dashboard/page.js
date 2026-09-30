"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const savedUser = sessionStorage.getItem("teamLegendUser");

      if (!savedUser) {
        router.replace("/");
        return;
      }

      const parsedUser = JSON.parse(savedUser);

      if (!parsedUser || !parsedUser.role) {
        sessionStorage.removeItem("teamLegendUser");
        router.replace("/");
        return;
      }

      setUser(parsedUser);
      setLoading(false);
    } catch (error) {
      console.error("Unable to read login session:", error);
      sessionStorage.removeItem("teamLegendUser");
      router.replace("/");
    }
  }, [router]);

  function logout() {
    sessionStorage.removeItem("teamLegendUser");
    router.push("/");
  }

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f4f7fb",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <p>Loading Team Legend...</p>
      </main>
    );
  }

  const isAdmin =
    String(user?.role || "").trim().toLowerCase() === "admin";

  const shopName =
    user?.shop && String(user.shop).trim()
      ? String(user.shop).trim()
      : "No shop assigned";

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
          gap: "20px",
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: "22px",
            }}
          >
            TEAM LEGEND
          </h2>

          <p
            style={{
              margin: "5px 0 0",
              color: "#cbd5e1",
              fontSize: "13px",
            }}
          >
            Sales Management System
          </p>
        </div>

        <button
          onClick={logout}
          style={{
            backgroundColor: "#dc2626",
            color: "white",
            border: "none",
            padding: "10px 18px",
            borderRadius: "7px",
            cursor: "pointer",
            fontWeight: "700",
          }}
        >
          Logout
        </button>
      </header>

      <section
        style={{
          padding: "30px",
        }}
      >
        <h1
          style={{
            marginTop: 0,
            marginBottom: "8px",
            color: "#0f172a",
          }}
        >
          {isAdmin ? "Admin Dashboard" : `${shopName} Dashboard`}
        </h1>

        <p
          style={{
            marginTop: 0,
            marginBottom: "30px",
            color: "#64748b",
          }}
        >
          {isAdmin
            ? "Administrator access to all Team Legend shops."
            : `You are signed in to ${shopName}.`}
        </p>

        {isAdmin ? (
          <AdminDashboard />
        ) : (
          <CashierDashboard shopName={shopName} />
        )}
      </section>
    </main>
  );
}

function AdminDashboard() {
  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "20px",
        }}
      >
        <DashboardCard title="Shops" value="27" />
        <DashboardCard title="Today's Sales" value="KES 0" />
        <DashboardCard title="Expenses" value="KES 0" />
        <DashboardCard title="Closing Balance" value="KES 0" />
      </div>

      <div
        style={{
          marginTop: "30px",
          backgroundColor: "white",
          padding: "25px",
          borderRadius: "12px",
          boxShadow: "0 4px 14px rgba(0,0,0,0.08)",
        }}
      >
        <h2
          style={{
            marginTop: 0,
            color: "#0f172a",
          }}
        >
          All Shops
        </h2>

        <p
          style={{
            color: "#64748b",
            marginBottom: 0,
          }}
        >
          Admin access is active. Shop reporting and management will be
          connected here.
        </p>
      </div>
    </div>
  );
}

function CashierDashboard({ shopName }) {
  return (
    <div>
      <div
        style={{
          backgroundColor: "white",
          padding: "30px",
          borderRadius: "14px",
          boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
          maxWidth: "700px",
        }}
      >
        <div
          style={{
            fontSize: "13px",
            color: "#64748b",
            marginBottom: "6px",
          }}
        >
          ASSIGNED SHOP
        </div>

        <h2
          style={{
            marginTop: 0,
            marginBottom: "20px",
            color: "#0f172a",
            fontSize: "28px",
          }}
        >
          {shopName}
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "15px",
          }}
        >
          <DashboardCard title="Today's Sales" value="KES 0" />
          <DashboardCard title="Expenses" value="KES 0" />
          <DashboardCard title="Closing Balance" value="KES 0" />
        </div>

        <p
          style={{
            marginTop: "25px",
            marginBottom: 0,
            color: "#64748b",
          }}
        >
          Cashier access is restricted to {shopName}.
        </p>
      </div>
    </div>
  );
}

function DashboardCard({ title, value }) {
  return (
    <div
      style={{
        backgroundColor: "white",
        padding: "22px",
        borderRadius: "12px",
        boxShadow: "0 4px 14px rgba(0,0,0,0.08)",
      }}
    >
      <div
        style={{
          color: "#64748b",
          fontSize: "13px",
          marginBottom: "8px",
        }}
      >
        {title}
      </div>

      <div
        style={{
          color: "#0f172a",
          fontSize: "24px",
          fontWeight: "700",
        }}
      >
        {value}
      </div>
    </div>
  );
}
