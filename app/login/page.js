"use client";

import { useState } from "react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  function handleLogin(e) {
    e.preventDefault();

    if (!username || !password) {
      setMessage("Please enter your username and password.");
      return;
    }

    // Temporary login routing.
    // We will connect the real user database next.
    window.location.href = "/dashboard";
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
        <div style={{ textAlign: "center", marginBottom: "30px" }}>
          <h1
            style={{
              margin: 0,
              fontSize: "32px",
              fontWeight: "800",
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
              fontWeight: "700",
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
              boxSizing: "border-box",
              padding: "14px",
              marginBottom: "20px",
              border: "1px solid #d1d5db",
              borderRadius: "9px",
              fontSize: "15px",
            }}
          />

          <label
            style={{
              display: "block",
              marginBottom: "8px",
              fontWeight: "700",
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
              boxSizing: "border-box",
              padding: "14px",
              marginBottom: "20px",
              border: "1px solid #d1d5db",
              borderRadius: "9px",
              fontSize: "15px",
            }}
          />

          <button
            type="submit"
            style={{
              width: "100%",
              padding: "14px",
              border: "none",
              borderRadius: "9px",
              background: "#0863ce",
              color: "white",
              fontSize: "16px",
              fontWeight: "700",
              cursor: "pointer",
            }}
          >
            Sign In
          </button>

          {message && (
            <p
              style={{
                textAlign: "center",
                marginTop: "18px",
                color: "#b91c1c",
                fontWeight: "600",
              }}
            >
              {message}
            </p>
          )}
        </form>

        <p
          style={{
            textAlign: "center",
            marginTop: "24px",
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
