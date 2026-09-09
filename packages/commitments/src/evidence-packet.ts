import { scoreConfidence, type Signal } from "./confidence";
import { bandToOutcome } from "./guardrails";

export type EvidenceRow = {
  id: string;
  kind: string;
  at: string;
  payload: Record<string, unknown>;
};

export type PacketLine = {
  at: string;
  source: string;
  observed: boolean;
  weight: number;
  note: string;
  sameDevice?: boolean;
};

export type EvidencePacket = {
  lines: PacketLine[];
  signals: Signal[];
  score: number;
  band: "success" | "review" | "ambiguous" | "failure";
  outcome: "success" | "failure" | "voided";
  math: string;
};

const WEIGHTS: Record<string, number> = {
  checkin: 40,
  gps_dwell: 40,
  photo: 25,
  ai_vision: 20,
  partner_attest: 30,
  partner: 30,
  watch_workout: 30,
  motion: 15,
  health: 20,
  wifi: 15,
  screentime: 25,
};

export function packetFromEvidence(rows: EvidenceRow[], now = new Date()): EvidencePacket {
  if (!rows.length) {
    return {
      lines: [],
      signals: [],
      score: 0,
      band: "ambiguous",
      outcome: "voided",
      math: `no signals at ${now.toISOString()} → void, don't fail`,
    };
  }
  const deviceId = "phone";
  const lines: PacketLine[] = rows.map((row) => {
    const source = normalize(row.kind);
    const sameDevice = source === "motion" || source === "wifi" || source === "photo";
    return {
      at: row.at,
      source,
      observed: true,
      weight: WEIGHTS[source] ?? 10,
      sameDevice,
      note: noteFor(row),
    };
  });

  const signals: Signal[] = lines.map((line) => ({
    source: line.source,
    weight: line.weight,
    observed: line.observed,
    sameDeviceAs: line.sameDevice ? "checkin" : undefined,
    mockLocation: Boolean(rows.find((r) => r.payload.mockLocation)),
  }));

  const scored = scoreConfidence(signals.length ? signals : [{ source: "none", weight: 0, observed: false }]);
  const outcome = bandToOutcome(scored.band);
  const parts = signals
    .filter((s) => s.observed)
    .map((s) => {
      const corr = s.sameDeviceAs ? "×0.5 same-phone" : "";
      return `${s.source} ${s.weight}${corr}`;
    });
  return {
    lines,
    signals,
    score: scored.score,
    band: scored.band,
    outcome,
    math: parts.length ? `${parts.join(" + ")} = ${scored.score} → ${scored.band}` : `no signals at ${now.toISOString()}`,
  };
}

function normalize(kind: string): string {
  if (kind === "partner_attest") return "partner";
  return kind;
}

function noteFor(row: EvidenceRow): string {
  if (row.kind === "checkin") {
    const place = typeof row.payload.place === "string" ? row.payload.place : "a place";
    const inside = row.payload.inside === true;
    return inside ? `Inside ${place}` : `Not inside ${place}`;
  }
  if (row.kind === "photo") {
    const vision = typeof row.payload.rationale === "string" ? row.payload.rationale : "Nonce-bound still.";
    return vision;
  }
  if (row.kind === "partner_attest") return "Witness attested.";
  if (row.kind === "ai_vision") return String(row.payload.rationale ?? "Scene review");
  return row.kind;
}

export const VISION_PROMPT =
  "Does this photo show the committed scene (gym, library, or stated place) taken now — not a screenshot, not an old selfie? Reply with score: 0-100 and one sentence.";
