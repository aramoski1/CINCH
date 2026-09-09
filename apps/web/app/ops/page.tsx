"use client";

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
    <main className="app">
      <div className="phone">
        <div className="screen">
          <p className="eyebrow">Internal</p>
          <h1 className="hero">Ops</h1>
          <input className="field" placeholder="admin token" value={token} onChange={(e) => setToken(e.target.value)} />
          <input className="field mt-3" placeholder="commitment id" value={id} onChange={(e) => setId(e.target.value)} />
          <div className="stack mt-4">
            <button type="button" className="btn btn-lock" onClick={() => void resolve("success")}>Kept</button>
            <button type="button" className="btn btn-danger" onClick={() => void resolve("failure")}>Missed</button>
            <button type="button" className="btn btn-ghost" onClick={() => void resolve("voided")}>Void</button>
          </div>
          {out ? <p className="status mt-3 nums">{out}</p> : null}
        </div>
      </div>
    </main>
  );
}
