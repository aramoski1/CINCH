"use client";

import { useEffect, useState } from "react";
import { formatStake } from "../../../lib/format";
import { apiBase } from "../../../lib/api";

type Receipt = {
  title: string;
  promise: string;
  verdict: string;
  stake: { minor: number; hidden?: boolean };
  faces: { front: { who?: string }; back: { math?: string } };
};

export default function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const [row, setRow] = useState<Receipt | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    void params.then(async ({ id }) => {
      const base = apiBase();
      try {
        const res = await fetch(`${base}/v1/commitments/${id}/receipt`, { cache: "no-store" });
        if (!res.ok) {
          setMissing(true);
          return;
        }
        setRow((await res.json()) as Receipt);
      } catch {
        setMissing(true);
      }
    });
  }, [params]);

  return (
    <main className="invite-stage">
      <article className={row?.verdict === "failure" ? "bet fail" : "bet live"} style={{ width: "min(24rem, 100%)" }}>
        <p className="eyebrow">Receipt</p>
        {missing ? <h1 className="hero">Nothing here.</h1> : null}
        {row ? (
          <>
            <h2>{row.title}</h2>
            <p className="muted">{row.faces.front.who}</p>
            <p>{row.promise}</p>
            <p className="clock nums">
              {row.verdict === "success" ? "kept" : row.verdict === "failure" ? "missed" : row.verdict}
            </p>
            <p className="muted">
              {row.verdict === "success"
                ? "You followed through. This is the evidence that makes the next promise easier."
                : row.verdict === "failure"
                  ? "You missed this one, and you closed it honestly. No disappearing act."
                  : "This promise was closed clean. Nobody pays."}
            </p>
            <p className="stake nums" style={{ marginLeft: 0 }}>
              {row.stake.hidden ? "—" : formatStake(row.stake.minor)}
            </p>
            <a className="hold mt-4" href="/">
              Back to Cinch
            </a>
          </>
        ) : null}
      </article>
    </main>
  );
}
