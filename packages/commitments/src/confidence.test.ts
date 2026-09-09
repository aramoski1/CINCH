import { describe, expect, it } from "vitest";
import {
  GYM_MOCK_LOCATION,
  GYM_PHONE_IN_LOCKER,
  GYM_SUCCESS,
  scoreConfidence,
} from "./confidence";

describe("confidence engine §6.3", () => {
  it("scores the gym success example at 85", () => {
    expect(scoreConfidence(GYM_SUCCESS)).toEqual({ score: 85, band: "success" });
  });

  it("scores phone-in-locker at 47.5", () => {
    expect(scoreConfidence(GYM_PHONE_IN_LOCKER)).toEqual({ score: 47.5, band: "ambiguous" });
  });

  it("scores mock location at -20", () => {
    expect(scoreConfidence(GYM_MOCK_LOCATION)).toEqual({ score: -20, band: "failure" });
  });
});
