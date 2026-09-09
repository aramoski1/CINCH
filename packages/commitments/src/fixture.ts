import type { CommitmentSpec, RuleNode } from "./spec";

export const gymConditions: RuleNode = {
  op: "AND",
  children: [
    {
      op: "LEAF",
      leaf: {
        kind: "location.enter",
        params: { place: "the gym", radius_m: 100, before: "06:30" },
      },
    },
    {
      op: "LEAF",
      leaf: {
        kind: "location.dwell",
        params: { place: "the gym", radius_m: 100, min_seconds: 2700 },
      },
    },
  ],
};

export function gymSpec(overrides: Partial<CommitmentSpec> = {}): CommitmentSpec {
  const deadline = new Date(Date.UTC(2027, 5, 15, 18, 0, 0)).toISOString();
  const start = new Date(Date.UTC(2027, 5, 15, 12, 0, 0)).toISOString();
  return {
    version: "1.0",
    title: "Gym by 6:30 AM",
    natural_language: "Gym by 6:30 tomorrow and stay 45 minutes or I owe Ryan 2500 points.",
    committer_id: "11111111-1111-1111-1111-111111111111",
    partners: [
      {
        ref: "Ryan",
        resolved_user_id: "22222222-2222-2222-2222-222222222222",
        contact_hint: { name: "Ryan", email: "ryan@example.com" },
        role: "witness",
        must_accept: true,
      },
    ],
    schedule: {
      timezone: "America/New_York",
      start_at: start,
      deadline_at: deadline,
      recurrence: null,
      occurrences: null,
      grace_period_seconds: 0,
    },
    conditions: gymConditions,
    verification: {
      required_confidence: 85,
      sources: ["checkin", "photo", "partner_attest"],
      fallback: "partner_confirm",
      evidence_window_seconds: 3600,
    },
    stake: {
      kind: "points",
      amount: { currency: "POINTS", minor: 2500 },
      on_failure: {
        destination: "partner",
        destination_id: "22222222-2222-2222-2222-222222222222",
      },
      on_success: { action: "release_to_committer" },
    },
    exceptions: [],
    dispute_policy: { window_hours: 24, default_outcome_if_unresolved: "void" },
    reminders: [{ offset_seconds: -3600, channel: "push", condition: "always" }],
    visibility: "partners_only",
    meta: {
      field_confidence: { deadline_at: 0.92, place: 0.8 },
      assumptions: ["Tomorrow = next local morning", "Gym = the gym"],
      needs_disambiguation: [],
      safety_flags: [],
      feasibility: { score: 0.8, warnings: [] },
    },
    ...overrides,
  };
}
