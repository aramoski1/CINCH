import type { Leaderboard } from "@cinch/api-client";

export type LedgerBit = {
  id: string;
  title: string;
  outcome: string;
  at?: string;
  stake?: { minor: number } | null;
};

export function startOfWeek(now = new Date()): Date {
  const x = new Date(now);
  const day = x.getDay();
  x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day));
  x.setHours(0, 0, 0, 0);
  return x;
}

export function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function defaultDeadlineLocal(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return toDatetimeLocal(d);
}

export function weeklySignal(ledger: LedgerBit[], now = new Date()): {
  score: number;
  kept: number;
  missed: number;
  dots: Array<"kept" | "missed" | "empty">;
} {
  const start = startOfWeek(now);
  const startMs = start.getTime();
  const week = ledger.filter((row) => {
    const at = Date.parse(row.at ?? "");
    if (!Number.isFinite(at) || at < startMs) return false;
    return row.outcome === "success" || row.outcome === "failure";
  });
  const kept = week.filter((row) => row.outcome === "success").length;
  const missed = week.filter((row) => row.outcome === "failure").length;
  const dots = Array.from({ length: 7 }, (_, i) => {
    const from = startMs + i * 86_400_000;
    const to = from + 86_400_000;
    const day = week.filter((row) => {
      const at = Date.parse(row.at ?? "");
      return at >= from && at < to;
    });
    if (day.some((row) => row.outcome === "success")) return "kept" as const;
    if (day.some((row) => row.outcome === "failure")) return "missed" as const;
    return "empty" as const;
  });
  return { score: week.length ? Math.round((kept / week.length) * 100) : 0, kept, missed, dots };
}

export function latestWin(ledger: LedgerBit[], streak: number, now = new Date()): {
  id: string;
  title: string;
  body: string;
  stat: string;
} | null {
  const win = ledger.find((row) => row.outcome === "success");
  if (!win) return null;
  const at = Date.parse(win.at ?? "");
  if (Number.isFinite(at) && now.getTime() - at > 3 * 86_400_000) return null;
  return {
    id: win.id,
    title: "You kept your word.",
    body: win.title,
    stat: streak > 1 ? `${streak}-keep streak` : "First keep on the board",
  };
}

export function ago(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 45_000) return "now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h`;
  return `${Math.floor(ms / 86_400_000)}d`;
}

export function leagueFromBoard(board: Leaderboard | null, now = new Date()) {
  if (!board?.you) return null;
  const rank = board.you.rank;
  const size = Math.max(board.board.length, 1);
  const division = rank === 1 ? "Cinch" : rank <= 2 ? "Gold" : rank <= Math.ceil(size / 2) ? "Silver" : "Bronze";
  const promotionZone = Math.max(1, Math.min(2, Math.ceil(size / 3)));
  const monday = startOfWeek(now);
  const next = new Date(monday);
  next.setDate(next.getDate() + 7);
  const daysLeft = Math.max(1, Math.ceil((next.getTime() - now.getTime()) / 86_400_000));
  return {
    division,
    rank,
    promotionZone,
    daysLeft,
    season: `${now.toLocaleString(undefined, { month: "short" })} week`,
    rate: board.you.rate,
  };
}

function hourLabel(hour: number): string {
  const n = hour % 12 || 12;
  return `${n}${hour < 12 ? "am" : "pm"}`;
}

export function momentumFrom(input: {
  insight?: { kind: string; text: string };
  heat?: Array<{ hour: number; rate: number; tried: number }>;
  ledger: LedgerBit[];
}): {
  score: number;
  trend: "rising" | "dipping" | "steady";
  copy: string;
  strongest: string;
  risk: string;
  action: string;
} {
  const settled = input.ledger.filter((row) => row.outcome === "success" || row.outcome === "failure");
  const kept = settled.filter((row) => row.outcome === "success").length;
  const score = settled.length ? Math.round((kept / settled.length) * 100) : 0;
  const recent = settled.slice(0, 3);
  const older = settled.slice(3, 6);
  const rRate = recent.length ? recent.filter((row) => row.outcome === "success").length / recent.length : 0;
  const oRate = older.length ? older.filter((row) => row.outcome === "success").length / older.length : rRate;
  const trend = rRate > oRate + 0.08 ? "rising" : rRate < oRate - 0.08 ? "dipping" : "steady";
  const tried = (input.heat ?? []).filter((h) => h.tried > 0);
  const strongest = tried.slice().sort((a, b) => b.rate - a.rate)[0];
  const risk = tried.slice().sort((a, b) => a.rate - b.rate)[0];
  const copy = input.insight?.text ?? "One sentence. Lock it. That's the whole product.";
  return {
    score,
    trend,
    copy,
    strongest: strongest ? hourLabel(strongest.hour) : "Need a few keeps",
    risk: risk && risk !== strongest ? hourLabel(risk.hour) : "Need a few more",
    action:
      input.insight?.kind === "nudge"
        ? copy
        : input.insight?.kind === "recovery"
          ? copy
          : "Lock the next one while the trail is warm.",
  };
}
