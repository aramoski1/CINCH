import { formatAmount, type LanguageModel, type Place } from "@cinch/shared";
import { gymSpec, type CommitmentSpec } from "@cinch/commitments";
import { classifySafety } from "./safety";
import { matchTemplate } from "./templates";

export type ParseContext = {
  now: Date;
  timezone: string;
  committerId: string;
  places: Place[];
  partnerHint?: { id: string; name: string };
};

export type AssumptionChip = {
  key: "what" | "when" | "where" | "who" | "stake" | "how";
  label: string;
  assumed: string;
};

export type ParseResult =
  | { ok: true; spec: CommitmentSpec; rendered: string; assumptions: string[]; chips: AssumptionChip[]; ready: boolean }
  | { ok: false; blocked: true; message: string; resources?: string[] }
  | { ok: false; blocked: false; message: string };

export async function parseUtterance(
  utterance: string,
  ctx: ParseContext,
  model?: LanguageModel,
  timeoutMs = 2500,
): Promise<ParseResult> {
  const safety = classifySafety(utterance);
  if (safety.blocked) {
    return { ok: false, blocked: true, message: safety.message, resources: safety.resources };
  }

  if (model) {
    try {
      const result = await model.complete({
        system:
          "Extract a Cinch commitment from one spoken sentence. Stakes are play dollars — never invent Stripe or a real charge. Prefer campus places from the provided list. Put every guess in meta.assumptions as 'I assumed …' sentences. Use the emit_spec tool.",
        user: JSON.stringify({
          utterance,
          now: ctx.now.toISOString(),
          timezone: ctx.timezone,
          places: ctx.places.map((p) => p.name),
        }),
        maxTokens: 1024,
        timeoutMs,
        tools: [
          {
            name: "emit_spec",
            description: "Structured commitment",
            inputSchema: { type: "object", additionalProperties: true },
          },
        ],
      });
      const call = result.toolCalls.find((c) => c.name === "emit_spec");
      if (call) {
        const extracted = extract(utterance, ctx);
        const spec = mergeSpec(utterance, ctx, extracted, call.input as Partial<CommitmentSpec>);
        return pack(spec);
      }
    } catch {
      // templates
    }
  }

  const extracted = extract(utterance, ctx);
  return pack(mergeSpec(utterance, ctx, extracted, {}));
}

export function chipsFromSpec(spec: CommitmentSpec): AssumptionChip[] {
  const place = findPlaceName(spec) ?? "the place I'll confirm";
  const who = spec.partners[0]?.ref ?? "charity";
  const when = formatWhen(spec.schedule.deadline_at, spec.schedule.timezone);
  return [
    { key: "what", label: spec.title, assumed: `I assumed you meant: ${spec.title}.` },
    { key: "when", label: when, assumed: `I assumed "${when}" in ${spec.schedule.timezone}.` },
    { key: "where", label: place, assumed: `I assumed ${place}.` },
    { key: "who", label: who, assumed: `I assumed ${who} holds you to it.` },
    {
      key: "stake",
      label: formatAmount(spec.stake.amount),
      assumed: `I assumed ${formatAmount(spec.stake.amount)} on the line.`,
    },
    { key: "how", label: howLine(spec), assumed: `I assumed I'll check this by ${howLine(spec).toLowerCase()}.` },
  ];
}

type Extracted = {
  title: string;
  place?: Place;
  partnerName?: string;
  stakeMinor: number;
  deadline: Date;
  start: Date;
  dwellSeconds: number;
  recurrence: string | null;
  kind: "place" | "screentime" | "call" | "work" | "photo";
};

function extract(utterance: string, ctx: ParseContext): Extracted {
  const hit = matchTemplate(utterance);
  const lower = utterance.toLowerCase();
  const stakeMinor = extractStake(utterance, hit?.stakeMinor ?? 2500);
  const partnerName = extractPartner(utterance) ?? ctx.partnerHint?.name;
  const { deadline, start } = extractSchedule(utterance, ctx.now);
  const place = inferPlace(utterance, ctx.places, hit?.placeHint);
  const dwellSeconds = (hit?.dwellMinutes ?? extractDwellMinutes(utterance)) * 60;
  const recurrence = /every weekday|weekdays|each weekday/i.test(utterance)
    ? "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"
    : /4x|four times/i.test(utterance)
      ? "FREQ=WEEKLY;COUNT=4"
      : null;

  let kind: Extracted["kind"] = "place";
  if (/instagram|tiktok|phone/i.test(lower) && /off|no |away from/i.test(lower)) kind = "screentime";
  else if (/call|mom|dad|phone my/i.test(lower)) kind = "call";
  else if (/deep work|study|library|assignment/i.test(lower)) kind = "work";
  else if (!place) kind = "photo";

  const title =
    hit?.title ??
    (kind === "screentime"
      ? "Off Instagram"
      : kind === "call"
        ? "Call someone who matters"
        : inferTitle(utterance));

  return { title, place, partnerName, stakeMinor, deadline, start, dwellSeconds, recurrence, kind };
}

function mergeSpec(
  utterance: string,
  ctx: ParseContext,
  extracted: Extracted,
  overlay: Partial<CommitmentSpec>,
): CommitmentSpec {
  const placeName = extracted.place?.name ?? "the gym";
  const partner = extracted.partnerName;
  const weekday = extracted.deadline.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: ctx.timezone,
  });
  const assumptions = [
    extracted.place
      ? `I assumed ${extracted.place.name}.`
      : "I assumed we'll confirm the place on the card.",
    `I assumed "then" means ${weekday}.`,
    partner
      ? `I assumed ${partner} — tap if that's the wrong ${partner}.`
      : "I assumed a charity forfeit if nobody is named.",
    `I assumed ${formatAmount({ currency: "POINTS", minor: extracted.stakeMinor })} on the line.`,
  ];

  const conditions =
    extracted.kind === "screentime"
      ? leaf("time.window", { app: "instagram", until: extracted.deadline.toISOString() })
      : extracted.kind === "call"
        ? leaf("proof.photo", { prompt: "show the call log" })
        : extracted.kind === "work"
          ? {
              op: "AND" as const,
              children: [
                leaf("location.dwell", {
                  place: placeName,
                  radius_m: extracted.place?.radiusM ?? 80,
                  min_seconds: extracted.dwellSeconds || 7200,
                }),
              ],
            }
          : {
              op: "AND" as const,
              children: [
                leaf("location.enter", {
                  place: placeName,
                  radius_m: extracted.place?.radiusM ?? 100,
                  before: extracted.deadline.toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                    timeZone: ctx.timezone,
                  }),
                }),
                leaf("location.dwell", {
                  place: placeName,
                  radius_m: extracted.place?.radiusM ?? 100,
                  min_seconds: extracted.dwellSeconds || 2700,
                }),
              ],
            };

  const spec = gymSpec({
    title: extracted.title,
    natural_language: utterance,
    committer_id: ctx.committerId,
    partners: partner
      ? [
          {
            ref: partner,
            resolved_user_id: ctx.partnerHint?.id ?? "22222222-2222-2222-2222-222222222222",
            contact_hint: { name: partner },
            role: "witness",
            must_accept: true,
          },
        ]
      : [],
    schedule: {
      timezone: ctx.timezone,
      start_at: extracted.start.toISOString(),
      deadline_at: extracted.deadline.toISOString(),
      recurrence: extracted.recurrence,
      occurrences: extracted.recurrence ? 5 : null,
      grace_period_seconds: 0,
    },
    conditions,
    reminders: [],
    verification: {
      required_confidence: 85,
      sources:
        extracted.kind === "screentime"
          ? ["screentime", "partner_attest"]
          : ["checkin", "photo", "partner_attest"],
      fallback: "partner_confirm",
      evidence_window_seconds: 3600,
    },
    stake: {
      kind: "points",
      amount: { currency: "POINTS", minor: extracted.stakeMinor },
      on_failure: {
        destination: partner ? "partner" : "charity",
        destination_id: partner ? (ctx.partnerHint?.id ?? "22222222-2222-2222-2222-222222222222") : null,
      },
      on_success: { action: "release_to_committer" },
    },
    meta: {
      field_confidence: { deadline_at: 0.86, place: extracted.place ? 0.8 : 0.4, stake: 0.9 },
      assumptions,
      needs_disambiguation: extracted.place ? [] : ["place"],
      safety_flags: [],
      feasibility: { score: 0.82, warnings: [] },
    },
  });
  return {
    ...spec,
    ...overlay,
    natural_language: utterance,
    committer_id: ctx.committerId,
    meta: overlay.meta ?? spec.meta,
  };
}

export function isParseReady(_spec: CommitmentSpec): boolean {
  return true;
}

function pack(spec: CommitmentSpec): Extract<ParseResult, { ok: true }> {
  const chips = chipsFromSpec(spec);
  return {
    ok: true,
    spec,
    rendered: spec.title,
    assumptions: spec.meta.assumptions.length ? spec.meta.assumptions : chips.map((c) => c.assumed),
    chips,
    ready: isParseReady(spec),
  };
}

function leaf(kind: "location.enter" | "location.dwell" | "time.window" | "proof.photo", params: Record<string, unknown>) {
  return { op: "LEAF" as const, leaf: { kind, params } };
}

function extractStake(utterance: string, fallback: number): number {
  const cash = utterance.match(/\$(\d[\d,]*(?:\.\d{1,2})?)/);
  const named = utterance.match(/(\d[\d,]*(?:\.\d{1,2})?)\s*(?:points?|pts|dollars?|bucks)\b/i);
  const owed = utterance.match(/\b(?:owe|lose|stake|collect|pay)\b[^0-9$]{0,16}\$?(\d[\d,]*(?:\.\d{1,2})?)/i);
  const raw = cash?.[1] ?? named?.[1] ?? owed?.[1];
  if (!raw) return fallback;
  const n = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n < 500 ? Math.round(n * 100) : Math.round(n);
}

function extractPartner(utterance: string): string | null {
  const owe = utterance.match(/\bowe\s+([A-Z][a-z]+)\b/);
  if (owe && !/points?|pts|dollars?|bucks|charity/i.test(owe[1] ?? "")) return owe[1] ?? null;
  const both = utterance.match(/\bme and ([A-Z][a-z]+)\b/i);
  if (both) return both[1] ?? null;
  const hold = utterance.match(/\b(?:with|vs|versus)\s+([A-Z][a-z]+)\b/);
  return hold?.[1] ?? null;
}

function extractDwellMinutes(utterance: string): number {
  const hours = utterance.match(/(\d+(?:\.\d+)?)\s*hours?/i);
  if (hours) return Math.round(Number(hours[1]) * 60);
  const mins = utterance.match(/(\d+)\s*min/i);
  if (mins) return Number(mins[1]);
  if (/45/i.test(utterance)) return 45;
  return 45;
}

function extractSchedule(utterance: string, now: Date): { deadline: Date; start: Date } {
  const deadline = new Date(now);
  const lower = utterance.toLowerCase();
  if (/tomorrow/i.test(lower)) deadline.setDate(deadline.getDate() + 1);
  else if (/friday/i.test(lower)) deadline.setDate(deadline.getDate() + daysUntil(deadline, 5));
  else if (/sunday/i.test(lower)) deadline.setDate(deadline.getDate() + daysUntil(deadline, 0));
  else if (/monday/i.test(lower)) deadline.setDate(deadline.getDate() + daysUntil(deadline, 1));
  else if (/weekday|this week/i.test(lower)) deadline.setDate(deadline.getDate() + daysUntil(deadline, 5));

  const time = utterance.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (time && !/instagram|hours?/i.test(time[0] ?? "")) {
    let hour = Number(time[1]);
    const minute = Number(time[2] ?? "0");
    const ap = (time[3] ?? "").toLowerCase();
    if (ap === "pm" && hour < 12) hour += 12;
    if (ap === "am" && hour === 12) hour = 0;
    deadline.setHours(hour, minute, 0, 0);
  } else if (/until friday|by sunday|by friday/i.test(lower)) {
    deadline.setHours(21, 0, 0, 0);
  } else {
    deadline.setHours(6, 30, 0, 0);
  }
  if (deadline.getTime() <= now.getTime()) deadline.setDate(deadline.getDate() + 1);
  const start = new Date(deadline.getTime() - 60 * 60 * 1000);
  return { deadline, start };
}

function daysUntil(from: Date, dow: number): number {
  const delta = (dow - from.getDay() + 7) % 7;
  return delta === 0 ? 7 : delta;
}

function inferPlace(utterance: string, places: Place[], hint?: string): Place | undefined {
  const needle = (hint ?? utterance).toLowerCase();
  const gym = places.find((p) => p.name.toLowerCase().includes("recreation") || p.name.toLowerCase().includes("gym"));
  const lib = places.find((p) => p.name.toLowerCase().includes("library"));
  const dorm = places.find((p) => p.name.toLowerCase().includes("forest") || p.name.toLowerCase().includes("hall"));
  if (/gym|lift|workout|rec/i.test(needle)) return gym ?? places[0];
  if (/library|study|deep work/i.test(needle)) return lib ?? places[1];
  if (/dorm|home|apartment|house/i.test(needle)) return dorm ?? places[1];
  return undefined;
}

function inferTitle(utterance: string): string {
  const clipped = utterance.replace(/\s+/g, " ").trim();
  return clipped.length > 42 ? `${clipped.slice(0, 39)}…` : clipped || "Commitment";
}

function findPlaceName(spec: CommitmentSpec): string | undefined {
  const walk = (node: CommitmentSpec["conditions"]): string | undefined => {
    if (node.op === "LEAF") return typeof node.leaf.params.place === "string" ? node.leaf.params.place : undefined;
    if (node.op === "NOT") return walk(node.child);
    if ("children" in node) {
      for (const c of node.children) {
        const hit = walk(c);
        if (hit) return hit;
      }
    }
    return undefined;
  };
  return walk(spec.conditions);
}

function formatWhen(iso: string, tz: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
  });
}

function howLine(spec: CommitmentSpec): string {
  const sources = spec.verification.sources;
  if (sources.includes("screentime")) return "Screen time + partner";
  if (sources.includes("checkin")) return "Geofence, photo, partner";
  return sources.join(" · ");
}
