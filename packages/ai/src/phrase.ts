import type { PatternCard } from "@cinch/commitments";

/** Numbers are computed. This only phrases them. */
export function phrasePattern(card: PatternCard): string {
  return `${card.headline}: ${card.rate}%.`;
}

export function phraseSplit(partnerRate: number, soloRate: number, partnerName?: string): string {
  const who = partnerName ? `With ${partnerName}` : "With a witness";
  return `${who}: ${partnerRate}%. Alone: ${soloRate}%.`;
}

export const VISION_PROMPT =
  "Does this photo show the committed scene taken now — not a screenshot, not an old still? Reply with score: 0-100 and one sentence.";
