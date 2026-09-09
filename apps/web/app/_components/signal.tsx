"use client";

import { useState } from "react";
import { leagueFromBoard, latestWin, momentumFrom, weeklySignal, type LedgerBit } from "../../lib/signal";
import type { Leaderboard } from "@cinch/api-client";

const DISMISS_KEY = "cinch.win.dismissed";

export function WinShare({
  ledger,
  streak,
}: {
  ledger: LedgerBit[];
  streak: number;
}) {
  const win = latestWin(ledger, streak);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return window.sessionStorage.getItem(DISMISS_KEY);
    } catch {
      return null;
    }
  });
  const [copied, setCopied] = useState(false);
  if (!win || dismissed === win.id) return null;
  const winId = win.id;
  const shareText = `I just kept my word on Cinch.\n\n${win.body}\n${win.stat}\n\nMake it real, then make it happen.`;

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title: "Cinch", text: shareText }).catch(() => undefined);
      } else {
        await navigator.clipboard.writeText(shareText);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      }
    } catch {
      await navigator.clipboard.writeText(shareText).catch(() => undefined);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }
  }

  function hide() {
    try {
      window.sessionStorage.setItem(DISMISS_KEY, winId);
    } catch {
      /* ignore */
    }
    setDismissed(winId);
  }

  return (
    <article className="win-card">
      <div className="win-top">
        <p className="eyebrow">Milestone</p>
        <span className="win-lock">Private-safe</span>
      </div>
      <h2>{win.title}</h2>
      <p className="muted">{win.body}</p>
      <p className="win-stat">{win.stat}</p>
      <p className="muted">No stake. No photo. Just the fact that you showed up.</p>
      <div className="row-actions">
        <button type="button" className="text-btn" onClick={() => void share()}>
          {copied ? "Copied" : "Share it"}
        </button>
        <button type="button" className="text-btn" onClick={hide}>
          Keep it here
        </button>
      </div>
    </article>
  );
}

export function WeeklySignal({ ledger, compact = false }: { ledger: LedgerBit[]; compact?: boolean }) {
  const { score, kept, missed, dots } = weeklySignal(ledger);
  if (compact && kept + missed === 0) return null;
  return (
    <article className={compact ? "signal-strip" : "signal-card"}>
      <div className="win-top">
        <p className="eyebrow">This week</p>
        <span className="nums muted">{kept + missed === 0 ? "—" : `${score}`}</span>
      </div>
      <div className="signal-dots" aria-hidden="true">
        {dots.map((dot, i) => (
          <i key={i} className={dot} title={["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]} />
        ))}
      </div>
      <p className="muted">
        {kept + missed === 0
          ? "Dots fill when you settle. Green kept, pink missed."
          : `${kept} kept · ${missed} missed. The next photo is the part you can change.`}
      </p>
    </article>
  );
}

export function Pulse({
  board,
  insight,
  heat,
  ledger,
}: {
  board: Leaderboard | null;
  insight?: { kind: string; text: string };
  heat?: Array<{ hour: number; rate: number; tried: number }>;
  ledger: LedgerBit[];
}) {
  const league = leagueFromBoard(board);
  const m = momentumFrom({ insight, heat, ledger });
  return (
    <article className="pulse">
      <div className="pulse-row">
        <div>
          <p className="eyebrow">Keep rate</p>
          <p className="nums pulse-num">{m.score}</p>
          <p className="muted">{m.trend}</p>
        </div>
        {league ? (
          <div>
            <p className="eyebrow">{league.division}</p>
            <p className="nums pulse-num">#{league.rank}</p>
            <p className="muted">{league.daysLeft}d left · top {league.promotionZone}</p>
          </div>
        ) : (
          <div>
            <p className="eyebrow">League</p>
            <p className="muted">Add a friend and you have a table.</p>
          </div>
        )}
      </div>
      <p>{m.copy}</p>
      {m.strongest !== "Need a few keeps" ? (
        <p className="muted">Strongest at {m.strongest}. Risk around {m.risk}.</p>
      ) : null}
    </article>
  );
}

export function LeagueCard({ board }: { board: Leaderboard | null }) {
  const league = leagueFromBoard(board);
  if (!league) return null;
  const inZone = league.rank <= league.promotionZone;
  const away = Math.max(0, league.rank - league.promotionZone);
  const fill = Math.min(100, Math.max(8, 100 - ((league.rank - 1) / Math.max(board?.board.length ?? 1, 1)) * 100));
  return (
    <article className="league-card">
      <div className="win-top">
        <p className="eyebrow">{league.season}</p>
        <span className="muted">{league.daysLeft}d left</span>
      </div>
      <h2>{league.division} league</h2>
      <p className="muted">
        Rank {league.rank} · {league.rate}% kept. Top {league.promotionZone} hold the line.
      </p>
      <div className="xp-bar" aria-hidden="true">
        <i style={{ width: `${fill}%` }} />
      </div>
      <p className={inZone ? "ok" : "muted"}>{inZone ? "On track to hold" : `${away} spots from the line`}</p>
    </article>
  );
}

export function MomentumCard({
  insight,
  heat,
  ledger,
}: {
  insight?: { kind: string; text: string };
  heat?: Array<{ hour: number; rate: number; tried: number }>;
  ledger: LedgerBit[];
}) {
  const m = momentumFrom({ insight, heat, ledger });
  return (
    <article className="momentum-card">
      <p className="eyebrow">Momentum</p>
      <p className="signal-score">
        <strong className="nums">{m.score}</strong>
        <span>{m.trend}</span>
      </p>
      <p>{m.copy}</p>
      <dl className="meta-list">
        <div>
          <dt>Strongest hour</dt>
          <dd>{m.strongest}</dd>
        </div>
        <div>
          <dt>Risk window</dt>
          <dd>{m.risk}</dd>
        </div>
      </dl>
      <p className="ok">{m.action}</p>
    </article>
  );
}
