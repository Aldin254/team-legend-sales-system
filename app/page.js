"use client";

import { useState } from "react";

export default function Home() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  function handleLogin(e) {
    e.preventDefault();

    if (!username || !password) {
      alert("Please enter your username and password.");
      return;
    }

    alert("Login system ready for connection.");
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
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <h1
            style={{
              margin: 0,
              color: "#07111f",
              fontSize: "28px",
              fontWeight: "800",
            }}
          >
            TEAM LEGEND
          </h1>

          <p style={{ marginTop: "8px", color: "#667085" }}>
            Sales Management System
          </p>
        </div>

        <form onSubmit={handleLogin}>
          <label
            style={{
              display: "block",
              marginBottom: "8px",
              fontWeight: "600",
              color: "#344054",
            }}
          >
            Username
          </label>

          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter username"
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "14px",
              marginBottom: "20px",
              border: "1px solid #d0d5dd",
              borderRadius: "9px",
              fontSize: "15px",
            }}
          />

          <label
            style={{
              display: "block",
              marginBottom: "8px",
              fontWeight: "600",
              color: "#344054",
            }}
          >
            Password
          </label>

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "14px",
              marginBottom: "25px",
              border: "1px solid #d0d5dd",
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
              background: "#0b63ce",
              color: "white",
              fontSize: "16px",
              fontWeight: "700",
              cursor: "pointer",
            }}
          >
            Sign In
          </button>
        </form>

        <p
          style={{
            textAlign: "center",
            marginTop: "25px",
            color: "#98a2b3",
            fontSize: "12px",
          }}
        >
          Team Legend • Secure Staff Access
        </p>
      </div>
    </main>
  );
}
