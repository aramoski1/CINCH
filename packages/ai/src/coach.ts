export type CoachInsight = {
  kind: "nudge" | "recovery" | "praise";
  text: string;
};

export function coachInsight(input: {
  failedAt?: Date;
  now: Date;
  nextDeadline?: Date;
}): CoachInsight {
  if (input.failedAt) {
    const hours = (input.now.getTime() - input.failedAt.getTime()) / 36e5;
    if (hours < 24) {
      return {
        kind: "recovery",
        text: "Shake it off. Same commitment tomorrow — keep the stake where it is.",
      };
    }
  }
  if (input.nextDeadline) {
    const mins = (input.nextDeadline.getTime() - input.now.getTime()) / 60000;
    if (mins > 0 && mins < 90) {
      return { kind: "nudge", text: "Window's tight. Leave now if you're going to make it." };
    }
  }
  return { kind: "praise", text: "One sentence. Lock it. That's the whole product." };
}

export function maySuggestStakeIncrease(failedAt: Date | undefined, now: Date): boolean {
  if (!failedAt) return true;
  return now.getTime() - failedAt.getTime() >= 24 * 60 * 60 * 1000;
}
