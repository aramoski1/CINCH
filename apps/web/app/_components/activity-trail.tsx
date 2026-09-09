"use client";

import { useEffect, useState } from "react";
import type { FeedItem } from "@cinch/api-client";
import { createBrowserApi } from "../../lib/api";
import { ago } from "../../lib/signal";

const FILTERS = ["all", "locked", "kept", "broke"] as const;

export function ActivityTrail({
  api,
  limit = 4,
  compact = false,
}: {
  api: ReturnType<typeof createBrowserApi>;
  limit?: number;
  compact?: boolean;
}) {
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [open, setOpen] = useState(!compact);

  async function load() {
    try {
      setItems(await api.feed());
    } catch {
      setItems([]);
    }
  }

  useEffect(() => {
    void load();
  }, [api]);

  if (items === null) return null;
  if (compact && items.length === 0) return null;

  const visible = (filter === "all" ? items : items.filter((item) => item.type === filter)).slice(0, open ? limit : 3);

  return (
    <div>
      <div className="win-top">
        <p className="eyebrow">The trail</p>
        {compact && items.length > 3 ? (
          <button type="button" className="text-btn" onClick={() => setOpen((v) => !v)}>
            {open ? "Less" : "See more"}
          </button>
        ) : (
          <span className="muted">your circle</span>
        )}
      </div>
      {!compact ? (
        <div className="filters">
          {FILTERS.map((name) => (
            <button key={name} type="button" className={filter === name ? "chip on" : "chip"} onClick={() => setFilter(name)}>
              {name === "all" ? "Everything" : name === "broke" ? "Missed" : name}
            </button>
          ))}
        </div>
      ) : null}
      {visible.length === 0 ? (
        <p className="muted mt-3">When a friend locks or settles, it lands here. Stakes stay off the trail.</p>
      ) : (
        <div className="trail">
          {visible.map((item) => (
            <article key={`${item.id}-${item.at}`} className="trail-row">
              <i className={item.accent} aria-hidden="true" />
              <div>
                <strong>{item.title}</strong>
                <p className="muted">{item.detail}</p>
                {!item.mine ? (
                  <button
                    type="button"
                    className={item.kudosActive ? "kudos on" : "kudos"}
                    onClick={() => void api.reactFeed(item.id).then(() => load())}
                  >
                    {item.kudosActive ? "They know you saw it" : "I saw this"}
                    {item.kudosCount ? ` · ${item.kudosCount}` : ""}
                  </button>
                ) : null}
              </div>
              <span className="nums muted">{ago(item.at)}</span>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
