import { z } from "zod";

export const amountSchema = z.object({
  currency: z.enum(["POINTS", "USD"]),
  minor: z.number().int(),
});

export const conditionLeafSchema = z.object({
  kind: z.enum([
    "time.before",
    "time.after",
    "time.window",
    "time.duration",
    "location.enter",
    "location.exit",
    "location.dwell",
    "location.avoid",
    "activity.steps",
    "activity.workout",
    "proof.photo",
    "proof.video",
    "social.partner_confirm",
    "ai.vision_scene",
  ]),
  params: z.record(z.unknown()),
});

export type ConditionLeaf = z.infer<typeof conditionLeafSchema>;

export type RuleNode =
  | { op: "AND"; children: RuleNode[] }
  | { op: "OR"; children: RuleNode[] }
  | { op: "NOT"; child: RuleNode }
  | { op: "AT_LEAST"; n: number; children: RuleNode[] }
  | { op: "LEAF"; leaf: ConditionLeaf };

export const ruleNodeSchema: z.ZodType<RuleNode> = z.lazy(() =>
  z.union([
    z.object({ op: z.literal("AND"), children: z.array(ruleNodeSchema).min(1) }),
    z.object({ op: z.literal("OR"), children: z.array(ruleNodeSchema).min(1) }),
    z.object({ op: z.literal("NOT"), child: ruleNodeSchema }),
    z.object({
      op: z.literal("AT_LEAST"),
      n: z.number().int().positive(),
      children: z.array(ruleNodeSchema).min(1),
    }),
    z.object({ op: z.literal("LEAF"), leaf: conditionLeafSchema }),
  ]),
);

export const commitmentSpecSchema = z.object({
  version: z.literal("1.0"),
  title: z.string().min(1),
  natural_language: z.string().min(1),
  committer_id: z.string().uuid(),
  partners: z.array(
    z.object({
      ref: z.string(),
      resolved_user_id: z.string().uuid().nullable(),
      contact_hint: z
        .object({ name: z.string(), email: z.string().email().optional() })
        .nullable(),
      role: z.enum(["witness", "beneficiary", "verifier", "co_committer"]),
      must_accept: z.boolean(),
    }),
  ),
  schedule: z.object({
    timezone: z.string().min(1),
    start_at: z.string().refine((s) => !Number.isNaN(Date.parse(s))).nullable(),
    deadline_at: z.string().refine((s) => !Number.isNaN(Date.parse(s))),
    recurrence: z.string().nullable(),
    occurrences: z.number().int().positive().nullable(),
    grace_period_seconds: z.number().int().nonnegative(),
  }),
  conditions: ruleNodeSchema,
  verification: z.object({
    required_confidence: z.number().min(0).max(100).default(85),
    sources: z.array(z.string()).min(1),
    fallback: z.enum(["evidence_request", "partner_confirm", "auto_fail", "auto_pass"]),
    evidence_window_seconds: z.number().int().positive().default(3600),
  }),
  stake: z.object({
    kind: z.enum(["points", "none"]),
    amount: amountSchema,
    on_failure: z.object({
      destination: z.enum(["partner", "charity", "group_pool", "platform", "savings"]),
      destination_id: z.string().uuid().nullable(),
    }),
    on_success: z.object({
      action: z.enum(["release_to_committer", "reward_from_partner", "release_and_bonus"]),
      reward_amount: amountSchema.optional(),
    }),
  }),
  exceptions: z.array(
    z.object({
      kind: z.enum(["illness", "emergency", "travel", "device_failure", "custom"]),
      description: z.string(),
      resolution: z.enum(["partner_approval", "auto_void", "not_allowed"]),
      max_uses: z.number().int().nonnegative(),
    }),
  ),
  dispute_policy: z.object({
    window_hours: z.number().int().positive().default(24),
    default_outcome_if_unresolved: z.enum(["success", "failure", "void"]),
  }),
  reminders: z.array(
    z.object({
      offset_seconds: z.number().int(),
      channel: z.enum(["push", "sms", "email", "partner_escalation"]),
      condition: z.enum(["always", "if_risk_above_50", "if_not_yet_started"]),
    }),
  ),
  visibility: z.enum(["private", "partners_only", "friends", "public"]),
  meta: z.object({
    field_confidence: z.record(z.number()),
    assumptions: z.array(z.string()),
    needs_disambiguation: z.array(z.string()),
    safety_flags: z.array(z.string()),
    feasibility: z.object({ score: z.number(), warnings: z.array(z.string()) }),
  }),
});

export type CommitmentSpec = z.infer<typeof commitmentSpecSchema>;
