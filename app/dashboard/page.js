"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [balanceBF, setBalanceBF] = useState("");
  const [shiftStarted, setShiftStarted] = useState(false);
  const [message, setMessage] = useState("");

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
    router.replace("/");
  }

  function startShift() {
    const amount = Number(balanceBF);

    if (balanceBF === "" || Number.isNaN(amount) || amount < 0) {
      setMessage("Please enter a valid Balance B/F.");
      return;
    }

    setShiftStarted(true);
    setMessage("Shift opened successfully.");
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

  const role = String(user.role || "").toUpperCase();
  const isAdmin = role === "ADMIN";

  const shopName =
    user.shop ||
    user.shop_name ||
    user.shopName ||
    "Assigned Shop";

  const cashierName =
    user.name ||
    user.username ||
    "Cashier";

  const today = new Intl.DateTimeFormat("en-KE", {
    timeZone: "Africa/Nairobi",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());

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
          padding: "18px 30px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "20px",
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>TEAM LEGEND</h2>

          <p
            style={{
              margin: "5px 0 0",
              color: "#cbd5e1",
              fontSize: "14px",
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
            borderRadius: "8px",
            padding: "10px 18px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          Logout
        </button>
      </header>

      <section
        style={{
          padding: "30px",
          maxWidth: "1200px",
          margin: "0 auto",
        }}
      >
        {isAdmin ? (
          <>
            {/* ADMIN DASHBOARD */}
            <h1 style={{ marginTop: 0 }}>Admin Dashboard</h1>

            <p>Welcome to Team Legend Sales Management System.</p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(210px, 1fr))",
                gap: "20px",
                marginTop: "30px",
              }}
            >
              <DashboardCard title="Shops" value="27" />
              <DashboardCard title="Today's Sales" value="KES 0" />
              <DashboardCard title="Expenses" value="KES 0" />
              <DashboardCard title="Closing Balance" value="KES 0" />
            </div>
          </>
        ) : (
          <>
            {/* CASHIER DASHBOARD */}
            <div style={{ marginBottom: "25px" }}>
              <h1 style={{ margin: 0 }}>{shopName}</h1>

              <p
                style={{
                  marginTop: "7px",
                  color: "#64748b",
                }}
              >
                Cashier Dashboard
              </p>
            </div>

            {/* SHOP INFORMATION */}
            <div
              style={{
                backgroundColor: "white",
                padding: "22px",
                borderRadius: "12px",
                boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
                marginBottom: "20px",
              }}
            >
              <h2 style={{ marginTop: 0 }}>{shopName}</h2>

              <p>
                <strong>Cashier:</strong> {cashierName}
              </p>

              <p>
                <strong>Date:</strong> {today}
              </p>

              <p style={{ marginBottom: 0 }}>
                <strong>Status:</strong>{" "}
                <span
                  style={{
                    color: "#15803d",
                    fontWeight: "bold",
                  }}
                >
                  ACTIVE
                </span>
              </p>
            </div>

            {/* OPENING SHIFT */}
            <div
              style={{
                backgroundColor: "white",
                padding: "25px",
                borderRadius: "12px",
                boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
                maxWidth: "600px",
              }}
            >
              <h2 style={{ marginTop: 0 }}>Opening Shift</h2>

              {!shiftStarted ? (
                <>
                  <p
                    style={{
                      color: "#64748b",
                      marginBottom: "20px",
                    }}
                  >
                    Enter the opening balance before starting work.
                  </p>

                  <label
                    style={{
                      display: "block",
                      fontWeight: "bold",
                      marginBottom: "8px",
                    }}
                  >
                    Balance B/F (KES)
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={balanceBF}
                    onChange={(e) => {
                      setBalanceBF(e.target.value);
                      setMessage("");
                    }}
                    placeholder="Enter opening balance"
                    style={{
                      width: "100%",
                      padding: "13px",
                      border: "1px solid #cbd5e1",
                      borderRadius: "8px",
                      boxSizing: "border-box",
                      fontSize: "16px",
                      marginBottom: "18px",
                    }}
                  />

                  {message && (
                    <div
                      style={{
                        marginBottom: "16px",
                        padding: "10px",
                        backgroundColor: "#fef2f2",
                        color: "#991b1b",
                        borderRadius: "8px",
                      }}
                    >
                      {message}
                    </div>
                  )}

                  <button
                    onClick={startShift}
                    style={{
                      width: "100%",
                      padding: "14px",
                      border: "none",
                      borderRadius: "8px",
                      backgroundColor: "#168d32",
                      color: "white",
                      fontSize: "16px",
                      fontWeight: "bold",
                      cursor: "pointer",
                    }}
                  >
                    Start Shift
                  </button>
                </>
              ) : (
                <div>
                  <div
                    style={{
                      padding: "14px",
                      backgroundColor: "#ecfdf5",
                      borderRadius: "8px",
                      color: "#166534",
                      marginBottom: "18px",
                    }}
                  >
                    Shift opened successfully.
                  </div>

                  <p>
                    <strong>Shop:</strong> {shopName}
                  </p>

                  <p>
                    <strong>Cashier:</strong> {cashierName}
                  </p>

                  <p>
                    <strong>Balance B/F:</strong>{" "}
                    KES {Number(balanceBF).toLocaleString("en-KE")}
                  </p>

                  <p style={{ marginBottom: 0 }}>
                    <strong>Shift Status:</strong>{" "}
                    <span
                      style={{
                        color: "#15803d",
                        fontWeight: "bold",
                      }}
                    >
                      OPEN
                    </span>
                  </p>
                </div>
              )}
            </div>

            <p
              style={{
                marginTop: "20px",
                color: "#64748b",
                fontSize: "13px",
              }}
            >
              You can only access your assigned shop.
            </p>
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
        boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
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
