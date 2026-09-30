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
          fontFamily: "Arial, sans-serif",
        }}
      >
        Loading...
      </main>
    );
  }

  if (!user) {
    return null;
  }

  const role = String(user.role || "").toLowerCase();
  const isAdmin = role === "admin";

  const shopName =
    user.shop ||
    user.shop_name ||
    user.shopName ||
    "Assigned Shop";

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#f4f7fb",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {/* HEADER */}
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
          <h2 style={{ margin: 0 }}>TEAM LEGEND</h2>

          <p
            style={{
              margin: "5px 0 0",
              color: "#cbd5e1",
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
            borderRadius: "6px",
            padding: "10px 18px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          Logout
        </button>
      </header>

      <section style={{ padding: "30px" }}>
        {/* ADMIN DASHBOARD */}
        {isAdmin ? (
          <>
            <h1 style={{ marginTop: 0 }}>Admin Dashboard</h1>

            <p>
              Welcome to Team Legend Sales Management System.
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "20px",
                marginTop: "30px",
              }}
            >
              <DashboardCard title="Shops" value="27" />

              <DashboardCard
                title="Today's Sales"
                value="KES 0"
              />

              <DashboardCard
                title="Expenses"
                value="KES 0"
              />

              <DashboardCard
                title="Closing Balance"
                value="KES 0"
              />
            </div>
          </>
        ) : (
          /* CASHIER DASHBOARD */
          <>
            <h1 style={{ marginTop: 0 }}>
              {shopName}
            </h1>

            <p>
              Cashier Dashboard
            </p>

            <div
              style={{
                backgroundColor: "white",
                borderRadius: "10px",
                padding: "25px",
                marginTop: "25px",
                boxShadow:
                  "0 2px 10px rgba(0,0,0,0.08)",
              }}
            >
              <h2 style={{ marginTop: 0 }}>
                {shopName}
              </h2>

              <p>
                You are logged in as the cashier for this shop.
              </p>

              <p
                style={{
                  color: "#64748b",
                  marginBottom: 0,
                }}
              >
                You can only access your assigned shop.
              </p>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function DashboardCard({ title, value }) {
  return (
    <div
      style={{
        backgroundColor: "white",
        borderRadius: "10px",
        padding: "22px",
        boxShadow:
          "0 2px 10px rgba(0,0,0,0.08)",
      }}
    >
      <p
        style={{
          margin: 0,
          color: "#64748b",
        }}
      >
        {title}
      </p>

      <h2
        style={{
          margin: "8px 0 0",
        }}
      >
        {value}
      </h2>
    </div>
  );
}
