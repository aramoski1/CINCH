import { describe, expect, it } from "vitest";
import { scoreConfidence } from "./confidence";
import { clampStakeToOriginalOnFailure, maySuggestStakeIncrease } from "./escalation";
import { packetFromEvidence } from "./evidence-packet";
import {
  canImpose,
  canOfferStreakInsurance,
  houseNeverProfits,
  insuredStakeMinor,
  isAllowedNudge,
  isSelfExcluded,
  ladderAfterFailure,
  notificationAllowedBetweenSealAndResolve,
  velocityOk,
} from "./guardrails";
import { hourCards, partnerSplit, significant, yearInReview, type PatternEvent } from "./patterns";
import { gymSpec } from "./fixture";
import { leaveByAt } from "./travel";

describe("guardrails", () => {
  it("never lets the house profit", () => {
    const spec = gymSpec();
    expect(houseNeverProfits(spec)).toBe(true);
    spec.stake.on_failure.destination = "platform";
    expect(houseNeverProfits(spec)).toBe(false);
  });

  it("blocks stake raises and insurance within 24h of a loss", () => {
    const failedAt = new Date();
    const now = new Date(failedAt.getTime() + 3600_000);
    expect(maySuggestStakeIncrease(failedAt, now)).toBe(false);
    expect(canOfferStreakInsurance(failedAt, now)).toBe(false);
    expect(
      clampStakeToOriginalOnFailure({ proposedMinor: 5000, originalMinor: 2500, failedAt, now }),
    ).toBe(2500);
    expect(ladderAfterFailure(2500)).toBe(2500);
  });

  it("cannot impose a commitment on someone else", () => {
    expect(canImpose("ryan-id", "alec-id", false)).toBe(false);
    expect(canImpose("ryan-id", "alec-id", true)).toBe(true);
  });

  it("enforces the blind ceiling", () => {
    expect(
      velocityOk({
        stakeMinor: 60000,
        dayMinor: 0,
        weekMinor: 0,
        maxStakeMinor: 50000,
        maxWeeklyMinor: 100000,
        maxDailyMinor: 60000,
      }),
    ).toBe(false);
  });

  it("treats self-exclusion as a hard block", () => {
    const until = new Date(Date.now() + 90 * 86400_000).toISOString();
    expect(isSelfExcluded(until, new Date())).toBe(true);
  });

  it("allows only the leave-now ping between seal and resolve", () => {
    expect(notificationAllowedBetweenSealAndResolve("leave_by_now")).toBe(true);
    expect(notificationAllowedBetweenSealAndResolve("hour_remaining")).toBe(false);
    expect(notificationAllowedBetweenSealAndResolve("coach_nudge")).toBe(false);
  });

  it("doubles the stake for streak insurance", () => {
    expect(insuredStakeMinor(2500, true)).toBe(5000);
    expect(isAllowedNudge("I'm watching.")).toBe(true);
    expect(isAllowedNudge("You suck")).toBe(false);
  });
});

describe("leave-by", () => {
  it("fires at the last possible moment from where you are", () => {
    const deadline = new Date("2026-09-09T10:30:00Z");
    const now = new Date("2026-09-09T10:00:00Z");
    const out = leaveByAt({
      now,
      deadline,
      from: { lat: 42.299, lng: -71.263 },
      place: {
        id: "plc_rec",
        name: "the gym",
        lat: 42.296,
        lng: -71.266,
        radiusM: 120,
        source: "seeded",
      },
    });
    expect(out.meters).toBeGreaterThan(200);
    expect(out.leaveAt.getTime()).toBeLessThan(deadline.getTime());
    expect(out.alreadyLate).toBe(false);
  });
});

describe("truth surfaces", () => {
  it("does not surface a pattern until it is significant", () => {
    const events: PatternEvent[] = Array.from({ length: 4 }, (_, i) => ({
      at: "2026-01-01T06:00:00Z",
      outcome: i ? "success" : "failure",
      hour: 6,
      withPartner: true,
      category: "fitness",
      title: "Gym",
    }));
    expect(significant(events.length)).toBe(false);
    expect(hourCards(events)).toHaveLength(0);
  });

  it("prints partner vs solo when n is enough", () => {
    const events: PatternEvent[] = [
      ...Array.from({ length: 5 }, () => ({
        at: "2026-03-01T06:00:00Z",
        outcome: "success" as const,
        hour: 6,
        withPartner: true,
        category: "fitness" as const,
        title: "Gym",
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        at: "2026-03-01T20:00:00Z",
        outcome: (i < 2 ? "success" : "failure") as "success" | "failure",
        hour: 20,
        withPartner: false,
        category: "fitness" as const,
        title: "Gym",
      })),
    ];
    const split = partnerSplit(events);
    expect(split?.partner.rate).toBe(100);
    expect(split?.solo.rate).toBe(40);
    const year = yearInReview(events, 2026);
    expect(year.kept).toBe(7);
    expect(year.broken).toBe(3);
  });
});

describe("void don't fail", () => {
  it("maps ambiguous evidence to void", () => {
    const packet = packetFromEvidence([
      {
        id: "1",
        kind: "checkin",
        at: new Date().toISOString(),
        payload: { inside: true, place: "Rec" },
      },
    ]);
    expect(packet.outcome).toBe("voided");
    expect(scoreConfidence([{ source: "gps_dwell", weight: 40, observed: true }]).band).toBe("ambiguous");
  });
});
