import { maySuggestStakeIncrease } from "./escalation";
import type { CommitmentSpec } from "./spec";

export const NUDGE_COPY = ["I'm watching.", "Don't.", "Twenty minutes."] as const;
export type NudgeCopy = (typeof NUDGE_COPY)[number];

export const REACTIONS = ["saw it", "knew it", "still here"] as const;
export type ReactionCopy = (typeof REACTIONS)[number];

export const STAKE_MODES = ["points", "charity", "peer"] as const;
export type StakeMode = (typeof STAKE_MODES)[number];

export const CHARITIES = [
  { id: "food", name: "A local food bank" },
  { id: "redcross", name: "Red Cross" },
  { id: "scholars", name: "A scholarship fund" },
] as const;

export const AUTH_HORIZON_MS = 7 * 24 * 60 * 60 * 1000;
export const VOID_WINDOW_DAYS = 30;
export const FREEZES_PER_MONTH = 2;
export const MAX_WITNESSES = 3;
export const GROUP_MIN = 3;
export const GROUP_MAX = 8;
export const STANDING_AFTER = 3;

export function houseNeverProfits(spec: CommitmentSpec): boolean {
  return spec.stake.on_failure.destination !== "platform";
}

export function destinationForMode(mode: StakeMode): CommitmentSpec["stake"]["on_failure"]["destination"] {
  if (mode === "peer") return "partner";
  if (mode === "charity") return "charity";
  return "charity";
}

export function canOfferStreakInsurance(failedAt: Date | undefined, now: Date): boolean {
  return maySuggestStakeIncrease(failedAt, now);
}

export function insuredStakeMinor(baseMinor: number, insured: boolean): number {
  return insured ? baseMinor * 2 : baseMinor;
}

export function nextLadderRung(ladder: number[], completions: number): number | undefined {
  if (!ladder.length) return undefined;
  const idx = Math.min(completions, ladder.length - 1);
  return ladder[idx];
}

export function ladderAfterFailure(originalMinor: number): number {
  return originalMinor;
}

export function isSelfExcluded(excludedUntil: string | undefined, now: Date): boolean {
  if (!excludedUntil) return false;
  return Date.parse(excludedUntil) > now.getTime();
}

export function velocityOk(input: {
  stakeMinor: number;
  dayMinor: number;
  weekMinor: number;
  maxStakeMinor: number;
  maxWeeklyMinor: number;
  maxDailyMinor: number;
}): boolean {
  if (input.stakeMinor > input.maxStakeMinor) return false;
  if (input.dayMinor + input.stakeMinor > input.maxDailyMinor) return false;
  if (input.weekMinor + input.stakeMinor > input.maxWeeklyMinor) return false;
  return true;
}

export function canImpose(proposedBy: string | undefined, committerId: string, accepted: boolean): boolean {
  if (!proposedBy) return true;
  if (proposedBy === committerId) return true;
  return accepted;
}

export function oneNudgeLeft(sent: boolean): boolean {
  return !sent;
}

export function isAllowedNudge(text: string): text is NudgeCopy {
  return (NUDGE_COPY as readonly string[]).includes(text);
}

export function isAllowedReaction(text: string): text is ReactionCopy {
  return (REACTIONS as readonly string[]).includes(text);
}

export function bandToOutcome(band: "success" | "review" | "ambiguous" | "failure"): "success" | "failure" | "voided" {
  if (band === "success") return "success";
  if (band === "failure") return "failure";
  return "voided";
}

export function notificationAllowedBetweenSealAndResolve(
  template: string,
): template is "leave_by_now" {
  return template === "leave_by_now";
}
