"use client";

import { useState } from "react";

export default function Home() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();

    if (!username.trim() || !password) {
      setMessage("Please enter your username and password.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "Invalid username or password.");
        setLoading(false);
        return;
      }

      // Make sure API returned a user
      if (!data.user) {
        setMessage("Login succeeded, but user information is missing.");
        setLoading(false);
        return;
      }

      // Save the user returned by API.
      // IMPORTANT: shop_id is required by the dashboard
      // when creating a shift in Supabase.
      sessionStorage.setItem(
        "teamLegendUser",
        JSON.stringify({
          id: data.user.id,
          name: data.user.name || username.trim(),
          role: data.user.role,
          shop: data.user.shop || null,
          shop_id: data.user.shop_id || null,
        })
      );

      // Open dashboard
      window.location.href = "/dashboard";
    } catch (error) {
      console.error("Login error:", error);
      setMessage("Unable to connect. Please try again.");
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#07111f",
        padding: "20px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "#ffffff",
          borderRadius: "18px",
          padding: "40px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
        }}
      >
        <div
          style={{
            textAlign: "center",
            marginBottom: "32px",
          }}
        >
          <h1
            style={{
              margin: 0,
              color: "#0f2238",
              fontSize: "28px",
              fontWeight: "800",
              letterSpacing: "1px",
            }}
          >
            TEAM LEGEND
          </h1>

          <p
            style={{
              marginTop: "8px",
              color: "#6b7280",
              fontSize: "14px",
            }}
          >
            Sales Management System
          </p>
        </div>

        <form onSubmit={handleLogin}>
          <label
            style={{
              display: "block",
              marginBottom: "8px",
              fontWeight: "600",
              color: "#374151",
            }}
          >
            Username
          </label>

          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter username"
            autoComplete="username"
            style={{
              width: "100%",
              padding: "13px",
              marginBottom: "20px",
              border: "1px solid #d1d5db",
              borderRadius: "8px",
              boxSizing: "border-box",
              fontSize: "15px",
            }}
          />

          <label
            style={{
              display: "block",
              marginBottom: "8px",
              fontWeight: "600",
              color: "#374151",
            }}
          >
            Password
          </label>

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            autoComplete="current-password"
            style={{
              width: "100%",
              padding: "13px",
              marginBottom: "20px",
              border: "1px solid #d1d5db",
              borderRadius: "8px",
              boxSizing: "border-box",
              fontSize: "15px",
            }}
          />

          {message && (
            <div
              style={{
                marginBottom: "16px",
                padding: "10px",
                borderRadius: "8px",
                background: "#fee2e2",
                color: "#b91c1c",
                fontSize: "14px",
                textAlign: "center",
              }}
            >
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "13px",
              border: "none",
              borderRadius: "7px",
              background: loading ? "#64748b" : "#168bd2",
              color: "#ffffff",
              fontSize: "15px",
              fontWeight: "700",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p
          style={{
            marginTop: "20px",
            marginBottom: 0,
            textAlign: "center",
            color: "#9ca3af",
            fontSize: "12px",
          }}
        >
          Team Legend • Secure Staff Access
        </p>
      </div>
    </main>
  );
}
