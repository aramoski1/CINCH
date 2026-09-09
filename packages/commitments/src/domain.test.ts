import { describe, expect, it } from "vitest";
import { gymSpec } from "./fixture";
import { evaluateRule, leafKey } from "./rules";
import { renderRule } from "./renderer";
import { assertTransition, canTransition } from "./state-machine";
import { firstFailure, validateSpec, type ValidatorContext } from "./validators";

const ctx: ValidatorContext = {
  now: new Date(),
  minStakeMinor: 500,
  maxStakeMinor: 50000,
  committerId: "11111111-1111-1111-1111-111111111111",
  connectedSources: ["photo", "partner_attest", "checkin"],
  adultPartnerIds: new Set(["22222222-2222-2222-2222-222222222222"]),
};

describe("state machine", () => {
  it("allows the happy path", () => {
    const path = [
      "draft",
      "pending_acceptance",
      "funding",
      "scheduled",
      "active",
      "success",
      "resolved",
    ] as const;
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransition(path[i]!, path[i + 1]!)).toBe(true);
    }
  });

  it("rejects illegal transitions", () => {
    expect(() => assertTransition("resolved", "active")).toThrow(/Cannot transition/);
    expect(canTransition("draft", "success")).toBe(false);
  });
});

describe("rules + renderer", () => {
  it("evaluates AND truth table", () => {
    const spec = gymSpec();
    const enter = leafKey("location.enter", {
      place: "the gym",
      radius_m: 100,
      before: "06:30",
    });
    const dwell = leafKey("location.dwell", {
      place: "the gym",
      radius_m: 100,
      min_seconds: 2700,
    });
    expect(evaluateRule(spec.conditions, { [enter]: true, [dwell]: true })).toBe(true);
    expect(evaluateRule(spec.conditions, { [enter]: true, [dwell]: false })).toBe(false);
  });

  it("renders English", () => {
    const text = renderRule(gymSpec().conditions);
    expect(text).toMatch(/get to the gym/i);
    expect(text).toMatch(/45 minutes/i);
  });
});

describe("validators", () => {
  it("accepts the gym fixture", () => {
    const results = validateSpec(gymSpec(), ctx);
    expect(firstFailure(results)).toBeNull();
  });

  it("rejects a self beneficiary", () => {
    const spec = gymSpec();
    spec.stake.on_failure.destination_id = spec.committer_id;
    const self = firstFailure(validateSpec(spec, ctx));
    expect(self && !self.ok ? self.code : null).toBe("beneficiaryNotSelf");
  });

  it("rejects an unwinnable plan", () => {
    const spec = gymSpec();
    spec.verification.sources = ["healthkit"];
    const plan = firstFailure(
      validateSpec(spec, { ...ctx, connectedSources: ["healthkit"] }),
    );
    expect(plan && !plan.ok ? plan.code : null).toBe("verificationPlanCanSucceed");
  });
});
