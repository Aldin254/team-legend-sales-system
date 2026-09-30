"use client";

import { useState } from "react";

export default function LoginPage() {
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
          password: password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "Invalid username or password.");
        setLoading(false);
        return;
      }

      // Save basic login information for the dashboard.
      sessionStorage.setItem(
        "teamLegendUser",
        JSON.stringify({
          username: data.username,
          role: data.role,
          shop: data.shop,
        })
      );

      window.location.href = "/dashboard";
    } catch (error) {
      console.error(error);
      setMessage("Unable to connect. Please try again.");
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#07111f",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "white",
          padding: "40px",
          borderRadius: "18px",
          boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
        }}
      >
        <div
          style={{
            textAlign: "center",
            marginBottom: "30px",
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: "32px",
              fontWeight: "800",
              letterSpacing: "1px",
              color: "#111827",
            }}
          >
            TEAM LEGEND
          </h1>

          <p
            style={{
              marginTop: "8px",
              color: "#6b7280",
              fontSize: "16px",
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
              color: "#111827",
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
              padding: "14px",
              marginBottom: "20px",
              border: "1px solid #d1d5db",
              borderRadius: "10px",
              fontSize: "16px",
              boxSizing: "border-box",
            }}
          />

          <label
            style={{
              display: "block",
              marginBottom: "8px",
              fontWeight: "600",
              color: "#111827",
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
              padding: "14px",
              marginBottom: "20px",
              border: "1px solid #d1d5db",
              borderRadius: "10px",
              fontSize: "16px",
              boxSizing: "border-box",
            }}
          />

          {message && (
            <div
              style={{
                marginBottom: "16px",
                padding: "10px",
                background: "#fee2e2",
                color: "#991b1b",
                borderRadius: "8px",
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
              padding: "14px",
              background: loading ? "#6b7280" : "#0284c7",
              color: "white",
              border: "none",
              borderRadius: "9px",
              fontSize: "16px",
              fontWeight: "700",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p
          style={{
            textAlign: "center",
            marginTop: "22px",
            marginBottom: 0,
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
