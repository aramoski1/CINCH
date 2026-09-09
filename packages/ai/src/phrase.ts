import type { PatternCard } from "@cinch/commitments";

/** Numbers are computed. This only phrases them. */
export function phrasePattern(card: PatternCard): string {
  return `${card.headline}: ${card.rate}%.`;
}

export function phraseSplit(partnerRate: number, soloRate: number, partnerName?: string): string {
  const who = partnerName ? `With ${partnerName}` : "With a witness";
  return `${who}: ${partnerRate}%. Alone: ${soloRate}%.`;
}

export const VISION_PROMPT = `You check photo proof for a commitment.
Score 0-100: does this look like a real, current photo of a person completing the stated task?
Fail (under 70): screenshots, memes, unrelated rooms, old selfies with no task, stock photos, just a face, or anything that does not show the activity.
Pass: the scene and activity match the commitment and it looks live, not reused.
Reply exactly:
score: <number>
Then one sentence.`;
