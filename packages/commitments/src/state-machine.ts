import { illegalTransition } from "@cinch/shared";

export const COMMITMENT_STATES = [
  "draft",
  "pending_acceptance",
  "funding",
  "scheduled",
  "active",
  "verification_pending",
  "success",
  "failure",
  "disputed",
  "resolved",
  "cancelled",
  "voided",
  "expired",
] as const;

export type CommitmentState = (typeof COMMITMENT_STATES)[number];

const TRANSITIONS: Record<CommitmentState, CommitmentState[]> = {
  draft: ["pending_acceptance", "funding", "cancelled"],
  pending_acceptance: ["funding", "cancelled", "expired"],
  expired: ["funding", "cancelled"],
  funding: ["scheduled", "cancelled"],
  scheduled: ["active", "cancelled", "voided"],
  active: ["success", "failure", "verification_pending", "voided"],
  verification_pending: ["success", "failure", "voided"],
  success: ["disputed", "resolved"],
  failure: ["disputed", "resolved"],
  voided: ["resolved"],
  disputed: ["success", "failure", "voided"],
  resolved: [],
  cancelled: [],
};

export function canTransition(from: CommitmentState, to: CommitmentState): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: CommitmentState, to: CommitmentState): void {
  if (!canTransition(from, to)) {
    throw illegalTransition(from, to);
  }
}

export function isTerminal(state: CommitmentState): boolean {
  return state === "resolved" || state === "cancelled";
}
