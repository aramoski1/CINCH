export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "C") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** Ledger stores cents. People type 25 — show $25. Nothing is charged. */
export function formatStake(minor: number): string {
  const dollars = minor / 100;
  if (Number.isInteger(dollars)) return `$${dollars.toLocaleString("en-US")}`;
  return `$${dollars.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatPts(n: number): string {
  return formatStake(n);
}

/** Score lives 300–900. Fill a bar like XP. */
export function xpFill(score: number): number {
  return Math.min(100, Math.max(4, ((score - 300) / 600) * 100));
}

export function streakTier(n: number): "cold" | "lit" | "hot" | "blaze" {
  if (n >= 7) return "blaze";
  if (n >= 3) return "hot";
  if (n >= 1) return "lit";
  return "cold";
}

export function remaining(iso?: string): { label: string; risky: boolean; ms: number } {
  if (!iso) return { label: "—", risky: false, ms: 0 };
  const ms = Date.parse(iso) - Date.now();
  if (ms <= 0) return { label: "now", risky: true, ms };
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const label = h >= 24
    ? `${String(Math.floor(h / 24)).padStart(2, "0")}d ${String(h % 24).padStart(2, "0")}h`
    : h > 0
      ? `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`
      : `${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
  return { label, risky: ms < 45 * 60 * 1000, ms };
}

export function thud(): void {
  try {
    if (typeof window !== "undefined" && window.localStorage.getItem("cinch.haptics") === "0") return;
    navigator.vibrate?.([10, 20, 40]);
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(86, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(42, ctx.currentTime + 0.14);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch {
    /* gesture-gated */
  }
}
