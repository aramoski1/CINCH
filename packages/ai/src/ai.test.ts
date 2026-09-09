import { describe, expect, it } from "vitest";
import { classifySafety } from "./safety";
import { parseUtterance } from "./parser";
import { maySuggestStakeIncrease } from "./coach";

describe("safety", () => {
  it("blocks self-harm with a warm refusal", () => {
    const d = classifySafety("if I fail I will kill myself");
    expect(d.blocked).toBe(true);
    if (d.blocked) expect(d.resources?.length).toBeGreaterThan(0);
  });
});

describe("parser", () => {
  it("parses the gym utterance via templates", async () => {
    const result = await parseUtterance("gym by 6:30 tomorrow or I owe Ryan 25 points", {
      now: new Date(),
      timezone: "America/New_York",
      committerId: "11111111-1111-1111-1111-111111111111",
      places: [],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.spec.stake.amount.currency).toBe("POINTS");
      expect(result.spec.title.toLowerCase()).toMatch(/gym/);
    }
  });
});

describe("coach", () => {
  it("never suggests a stake increase within 24h of failure", () => {
    const failedAt = new Date();
    expect(maySuggestStakeIncrease(failedAt, new Date(failedAt.getTime() + 3600_000))).toBe(false);
    expect(maySuggestStakeIncrease(failedAt, new Date(failedAt.getTime() + 25 * 3600_000))).toBe(true);
  });
});
