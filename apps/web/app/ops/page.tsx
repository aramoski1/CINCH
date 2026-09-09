"use client";

import { color } from "@cinch/ui";
import { useState } from "react";

export default function OpsPage() {
  const [token, setToken] = useState("");
  const [id, setId] = useState("");
  const [out, setOut] = useState("");

  async function resolve(outcome: "success" | "failure" | "voided") {
    const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
    const res = await fetch(`${base}/v1/ops/resolve`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-token": token },
      body: JSON.stringify({ id, outcome }),
    });
    setOut(await res.text());
  }

  return (
    <main style={{ minHeight: "100vh", background: color.ink, color: color.paper, padding: 40 }}>
      <h1 style={{ fontFamily: "Iowan Old Style, Palatino, serif" }}>Ops</h1>
      <p>Internal only. Token never stored.</p>
      <input
        placeholder="admin token"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        style={{ display: "block", width: 360, margin: "12px 0", padding: 8 }}
      />
      <input
        placeholder="commitment id"
        value={id}
        onChange={(e) => setId(e.target.value)}
        style={{ display: "block", width: 360, margin: "12px 0", padding: 8 }}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={() => void resolve("success")}>
          Success
        </button>
        <button type="button" onClick={() => void resolve("failure")}>
          Failure
        </button>
        <button type="button" onClick={() => void resolve("voided")}>
          Void
        </button>
      </div>
      <pre style={{ marginTop: 24, color: color.signalAmber }}>{out}</pre>
    </main>
  );
}
