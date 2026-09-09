import { describe, expect, it } from "vitest";
import { CinchError } from "@cinch/shared";
import { assertProofPasses } from "../src/review-proof";

describe("proof review", () => {
  it("lets tests skip Claude", () => {
    expect(() => assertProofPasses(null)).not.toThrow();
  });

  it("rejects a weak scene score", () => {
    expect(() =>
      assertProofPasses({ score: 22, rationale: "score: 22\nThat's a screenshot of a gym." }),
    ).toThrow(CinchError);
  });

  it("accepts a live task photo", () => {
    expect(() =>
      assertProofPasses({ score: 88, rationale: "score: 88\nThey're on the gym floor." }),
    ).not.toThrow();
  });
});
