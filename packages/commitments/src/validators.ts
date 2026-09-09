import { isDstTransitionWindow, isIanaTimezone } from "@cinch/shared";
import { commitmentSpecSchema, type CommitmentSpec } from "./spec";
import { treeDepth, walkLeaves, wrapsOrInNot } from "./rules";
import { renderRule } from "./renderer";

export type ValidatorContext = {
  now: Date;
  minStakeMinor: number;
  maxStakeMinor: number;
  committerId: string;
  connectedSources: string[];
  adultPartnerIds: Set<string>;
};

export type ValidatorResult = { ok: true } | { ok: false; code: string; message: string };

const V0_SOURCES = new Set([
  "photo",
  "partner_attest",
  "checkin",
  "ai_vision",
  "admin",
]);

export function validateSpec(spec: CommitmentSpec, ctx: ValidatorContext): ValidatorResult[] {
  return [
    schemaValid(spec),
    deadlineInFuture(spec, ctx),
    windowCoherent(spec),
    durationFitsWindow(spec),
    geofenceRadiusSane(spec),
    thresholdsPositive(spec),
    stakeWithinLimits(spec, ctx),
    beneficiaryNotSelf(spec, ctx),
    beneficiaryIsAdult(spec, ctx),
    verificationSourceAvailable(spec, ctx),
    verificationPlanCanSucceed(spec),
    noForbiddenCategory(spec),
    houseDoesNotProfit(spec),
    recurrenceBounded(spec),
    timezoneResolved(spec),
    dstSafe(spec),
    renderable(spec),
  ];
}

export function firstFailure(results: ValidatorResult[]): ValidatorResult | null {
  return results.find((r) => !r.ok) ?? null;
}

function ok(): ValidatorResult {
  return { ok: true };
}
function fail(code: string, message: string): ValidatorResult {
  return { ok: false, code, message };
}

export function schemaValid(spec: CommitmentSpec): ValidatorResult {
  const parsed = commitmentSpecSchema.safeParse(spec);
  return parsed.success ? ok() : fail("schemaValid", parsed.error.message);
}

export function deadlineInFuture(spec: CommitmentSpec, ctx: ValidatorContext): ValidatorResult {
  const deadline = new Date(spec.schedule.deadline_at);
  if (deadline.getTime() <= ctx.now.getTime() + 60_000) {
    return fail("deadlineInFuture", "Deadline must be at least 60 seconds from now.");
  }
  return ok();
}

export function windowCoherent(spec: CommitmentSpec): ValidatorResult {
  if (!spec.schedule.start_at) return ok();
  if (new Date(spec.schedule.start_at) >= new Date(spec.schedule.deadline_at)) {
    return fail("windowCoherent", "start_at must be before deadline_at.");
  }
  return ok();
}

export function durationFitsWindow(spec: CommitmentSpec): ValidatorResult {
  const dwell = walkLeaves(spec.conditions).find((l) => l.kind === "location.dwell");
  if (!dwell || !spec.schedule.start_at) return ok();
  const min = Number(dwell.params.min_seconds ?? 0);
  const window =
    new Date(spec.schedule.deadline_at).getTime() - new Date(spec.schedule.start_at).getTime();
  if (min > window / 1000) {
    return fail("durationFitsWindow", "Required dwell is longer than the window.");
  }
  return ok();
}

export function geofenceRadiusSane(spec: CommitmentSpec): ValidatorResult {
  for (const leaf of walkLeaves(spec.conditions)) {
    if (!leaf.kind.startsWith("location.")) continue;
    const r = Number(leaf.params.radius_m ?? 100);
    if (r < 25 || r > 2000) return fail("geofenceRadiusSane", "Radius must be 25–2000m.");
  }
  return ok();
}

export function thresholdsPositive(spec: CommitmentSpec): ValidatorResult {
  for (const leaf of walkLeaves(spec.conditions)) {
    for (const key of ["min_count", "min_seconds", "min_pages"]) {
      const v = leaf.params[key];
      if (v !== undefined && Number(v) <= 0) {
        return fail("thresholdsPositive", `${key} must be positive.`);
      }
    }
  }
  return ok();
}

export function stakeWithinLimits(spec: CommitmentSpec, ctx: ValidatorContext): ValidatorResult {
  if (spec.stake.kind === "none") return ok();
  if (spec.stake.amount.currency !== "POINTS") {
    return fail("stakeWithinLimits", "v0 stakes are POINTS only.");
  }
  const n = spec.stake.amount.minor;
  if (n < ctx.minStakeMinor || n > ctx.maxStakeMinor) {
    return fail("stakeWithinLimits", "Stake is outside allowed limits.");
  }
  return ok();
}

export function beneficiaryNotSelf(spec: CommitmentSpec, ctx: ValidatorContext): ValidatorResult {
  const dest = spec.stake.on_failure.destination_id;
  if (dest && dest === ctx.committerId) {
    return fail("beneficiaryNotSelf", "You cannot be your own beneficiary.");
  }
  return ok();
}

export function beneficiaryIsAdult(spec: CommitmentSpec, ctx: ValidatorContext): ValidatorResult {
  const dest = spec.stake.on_failure.destination_id;
  if (dest && !ctx.adultPartnerIds.has(dest) && spec.stake.on_failure.destination === "partner") {
    return fail("beneficiaryIsAdult", "Beneficiary must be an adult.");
  }
  return ok();
}

export function verificationSourceAvailable(
  spec: CommitmentSpec,
  ctx: ValidatorContext,
): ValidatorResult {
  const missing = spec.verification.sources.filter(
    (s) => !ctx.connectedSources.includes(s) && !V0_SOURCES.has(s),
  );
  if (missing.length) {
    return fail("verificationSourceAvailable", `Missing sources: ${missing.join(", ")}`);
  }
  return ok();
}

export function verificationPlanCanSucceed(spec: CommitmentSpec): ValidatorResult {
  const winnable = spec.verification.sources.some((s) => V0_SOURCES.has(s));
  if (!winnable) {
    return fail(
      "verificationPlanCanSucceed",
      "This commitment cannot reach the required confidence with available sources. Add a photo or partner confirm.",
    );
  }
  return ok();
}

const FORBIDDEN = [
  "self-harm",
  "suicide",
  "eating disorder",
  "starve",
  "purge",
  "minors",
  "violence",
  "weapon",
];

export function noForbiddenCategory(spec: CommitmentSpec): ValidatorResult {
  const hay = `${spec.title} ${spec.natural_language}`.toLowerCase();
  if (FORBIDDEN.some((w) => hay.includes(w))) {
    return fail("noForbiddenCategory", "This commitment is blocked for safety.");
  }
  if (spec.meta.safety_flags.length > 0) {
    return fail("noForbiddenCategory", "Safety classifier blocked this commitment.");
  }
  return ok();
}

export function houseDoesNotProfit(spec: CommitmentSpec): ValidatorResult {
  if (spec.stake.on_failure.destination === "platform") {
    return fail("houseDoesNotProfit", "Forfeits never reach the company.");
  }
  return ok();
}

export function recurrenceBounded(spec: CommitmentSpec): ValidatorResult {
  if (spec.schedule.occurrences && spec.schedule.occurrences > 365) {
    return fail("recurrenceBounded", "Recurrence cannot exceed 365 occurrences.");
  }
  return ok();
}

export function timezoneResolved(spec: CommitmentSpec): ValidatorResult {
  if (!isIanaTimezone(spec.schedule.timezone)) {
    return fail("timezoneResolved", "Timezone must be an IANA name, not a UTC offset.");
  }
  return ok();
}

export function dstSafe(spec: CommitmentSpec): ValidatorResult {
  const at = new Date(spec.schedule.deadline_at);
  if (isDstTransitionWindow(at, spec.schedule.timezone)) {
    return fail("dstSafe", "Deadline falls in a DST transition window.");
  }
  return ok();
}

export function renderable(spec: CommitmentSpec): ValidatorResult {
  if (treeDepth(spec.conditions) > 4) return fail("renderable", "Rule tree is too deep.");
  if (walkLeaves(spec.conditions).length > 12) return fail("renderable", "Too many conditions.");
  if (wrapsOrInNot(spec.conditions)) return fail("renderable", "NOT may not wrap OR.");
  const text = renderRule(spec.conditions);
  if (!text.trim()) return fail("renderable", "Rule tree cannot be described in English.");
  return ok();
}
