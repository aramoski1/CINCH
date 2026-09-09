import { VISION_PROMPT } from "@cinch/ai";
import { createAnthropicModel } from "@cinch/adapters";
import { badRequest } from "@cinch/shared";
import type { Env } from "./config/env";

export const PROOF_PASS_SCORE = 70;

export function canReviewProof(env: Env): boolean {
  return env.ANTHROPIC_API_KEY.startsWith("sk-ant-api");
}

export function parseImageDataUrl(data: string): {
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  bytes: Buffer;
} {
  const match = data.match(/^data:(image\/(?:jpeg|png|webp));base64,([\s\S]+)$/i);
  if (!match?.[1] || !match[2]) throw badRequest("Need a photo.");
  const mediaType = match[1].toLowerCase() as "image/jpeg" | "image/png" | "image/webp";
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length < 16) throw badRequest("Need a photo.");
  return { mediaType, bytes };
}

export async function reviewCommitmentPhoto(
  env: Env,
  title: string,
  dataUrl: string,
): Promise<{ score: number; rationale: string } | null> {
  if (!canReviewProof(env)) return null;
  const { mediaType, bytes } = parseImageDataUrl(dataUrl);
  const model = createAnthropicModel({
    apiKey: env.ANTHROPIC_API_KEY,
    model: env.ANTHROPIC_MODEL,
    maxTokens: env.ANTHROPIC_MAX_TOKENS,
  });
  try {
    return await model.reviewImage({
      mediaType,
      data: bytes,
      prompt: `${VISION_PROMPT}\nThe commitment is: ${title}.`,
    });
  } catch {
    throw badRequest("Couldn't check that photo. Try again.");
  }
}

export function assertProofPasses(review: { score: number; rationale: string } | null): void {
  if (!review) return;
  if (review.score >= PROOF_PASS_SCORE) return;
  const why = review.rationale.replace(/^score\s*[:=]\s*\d+(?:\.\d+)?\s*/i, "").trim();
  throw badRequest(why || "That photo doesn't show you doing it. Take another.");
}
