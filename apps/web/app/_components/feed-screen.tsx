"use client";

import { useEffect, useState } from "react";
import { createBrowserApi } from "../../lib/api";

export function FeedScreen({ api, onMatch }: { api: ReturnType<typeof createBrowserApi>; onMatch: () => void }) {
  const [items, setItems] = useState<Array<Record<string, unknown>> | null>(null);
  const [protocols, setProtocols] = useState<Array<{ id: string; name: string; why: string }>>([]);
  const [hits, setHits] = useState<Array<{ them: string; category: string }>>([]);

  useEffect(() => {
    void api.feed().then(setItems).catch(() => setItems([]));
    void api.protocols().then(setProtocols).catch(() => undefined);
    void api.collisions().then(setHits).catch(() => undefined);
  }, [api]);

  if (items === null) return <p className="muted">The ledger is catching up.</p>;

  return (
    <section>
      <p className="kicker">Ledger</p>
      <h1 className="display">Who's keeping their word.</h1>
      {hits.map((h) => (
        <p key={`${h.them}-${h.category}`} className="ok">
          You and {h.them} both have a live {h.category} streak.
        </p>
      ))}
      {!items.length ? (
        <p className="muted">When a friend locks something, it lands here. Stakes stay private.</p>
      ) : (
        items.map((item, i) => (
          <article key={String(item.id ?? i)} className="feed-item">
            <div>
              <b>{String(item.actor ?? "Someone")}</b>{" "}
              {String(item.type) === "locked"
                ? "committed"
                : String(item.type) === "kept"
                  ? "showed up"
                  : String(item.type) === "broke"
                    ? "broke a streak"
                    : String(item.type)}
              {item.title ? `: ${String(item.title)}` : ""}
            </div>
            <p className="muted">Stakes stay private.</p>
            {item.id ? (
              <button
                type="button"
                className="match"
                onClick={() => {
                  void api.match(String(item.id)).then(onMatch).catch(() => onMatch());
                }}
              >
                Match this
              </button>
            ) : null}
          </article>
        ))
      )}

      <h2 className="display-s mt-4">Protocols</h2>
      <p className="muted">Someone's proven shape. One tap.</p>
      {protocols.map((p) => (
        <article key={p.id} className="paper doc doc-flat">
          <h2>{p.name}</h2>
          <p>{p.why}</p>
          <button
            type="button"
            className="match"
            onClick={() => void api.adoptProtocol(p.id).then(onMatch)}
          >
            Take this on
          </button>
        </article>
      ))}
    </section>
  );
}
