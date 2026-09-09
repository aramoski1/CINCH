export type OutcomeKind = "success" | "failure" | "voided";

export type PatternEvent = {
  at: string;
  outcome: OutcomeKind;
  hour: number;
  withPartner: boolean;
  category: "fitness" | "focus" | "social";
  title: string;
};

export type PatternCard = {
  id: string;
  headline: string;
  kept: number;
  tried: number;
  rate: number;
};

export type HeatCell = { hour: number; kept: number; tried: number; rate: number };

const SIGNIFICANCE = 5;

export function rate(kept: number, tried: number): number {
  if (tried <= 0) return 0;
  return Math.round((kept / tried) * 100);
}

export function significant(tried: number): boolean {
  return tried >= SIGNIFICANCE;
}

export function hourHeatmap(events: PatternEvent[]): HeatCell[] {
  return Array.from({ length: 24 }, (_, hour) => {
    const slice = events.filter((e) => e.hour === hour && e.outcome !== "voided");
    const kept = slice.filter((e) => e.outcome === "success").length;
    const tried = slice.length;
    return { hour, kept, tried, rate: rate(kept, tried) };
  });
}

export function partnerSplit(events: PatternEvent[]): { partner: PatternCard; solo: PatternCard } | null {
  const decided = events.filter((e) => e.outcome !== "voided");
  const withP = decided.filter((e) => e.withPartner);
  const solo = decided.filter((e) => !e.withPartner);
  if (!significant(withP.length) && !significant(solo.length)) return null;
  return {
    partner: card("with-partner", "With a witness", withP),
    solo: card("solo", "Alone", solo),
  };
}

export function hourCards(events: PatternEvent[]): PatternCard[] {
  const heat = hourHeatmap(events);
  return heat
    .filter((h) => significant(h.tried))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 4)
    .map((h) => ({
      id: `hour-${h.hour}`,
      headline: hourLabel(h.hour),
      kept: h.kept,
      tried: h.tried,
      rate: h.rate,
    }));
}

export function categoryRates(events: PatternEvent[]): Record<"fitness" | "focus" | "social", PatternCard> {
  const cats = ["fitness", "focus", "social"] as const;
  const out = {} as Record<"fitness" | "focus" | "social", PatternCard>;
  for (const cat of cats) {
    const slice = events.filter((e) => e.category === cat && e.outcome !== "voided");
    out[cat] = card(cat, cat, slice);
  }
  return out;
}

export function yearInReview(events: PatternEvent[], year: number): {
  year: number;
  kept: number;
  broken: number;
  voided: number;
  hardestKept?: string;
  givenUpThreeTimes?: string;
} {
  const inYear = events.filter((e) => new Date(e.at).getFullYear() === year);
  const kept = inYear.filter((e) => e.outcome === "success");
  const broken = inYear.filter((e) => e.outcome === "failure");
  const titles = new Map<string, number>();
  for (const e of broken) titles.set(e.title, (titles.get(e.title) ?? 0) + 1);
  let givenUpThreeTimes: string | undefined;
  for (const [title, n] of titles) {
    if (n >= 3) givenUpThreeTimes = title;
  }
  const hardestKept = kept.sort((a, b) => a.title.length - b.title.length).at(-1)?.title;
  return {
    year,
    kept: kept.length,
    broken: broken.length,
    voided: inYear.filter((e) => e.outcome === "voided").length,
    hardestKept,
    givenUpThreeTimes,
  };
}

export function witnessKeepRate(eventsWhereYouAreWitness: Array<{ outcome: OutcomeKind }>): {
  kept: number;
  tried: number;
  rate: number;
} {
  const tried = eventsWhereYouAreWitness.filter((e) => e.outcome !== "voided");
  const kept = tried.filter((e) => e.outcome === "success").length;
  return { kept, tried: tried.length, rate: rate(kept, tried.length) };
}

export function categoryFromTitle(title: string): "fitness" | "focus" | "social" {
  if (/gym|run|lift|steps|workout|pushup/i.test(title)) return "fitness";
  if (/instagram|phone|deep work|library|study|assignment/i.test(title)) return "focus";
  return "social";
}

function card(id: string, headline: string, events: PatternEvent[]): PatternCard {
  const kept = events.filter((e) => e.outcome === "success").length;
  return { id, headline, kept, tried: events.length, rate: rate(kept, events.length) };
}

function hourLabel(hour: number): string {
  const suffix = hour >= 12 ? "pm" : "am";
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `Your ${h}${suffix}`;
}
