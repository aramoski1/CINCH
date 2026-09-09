/** Stake increases are user-defined at creation. Never suggested after a failure. */
export function maySuggestStakeIncrease(failedAt: Date | undefined, now: Date): boolean {
  if (!failedAt) return true;
  return now.getTime() - failedAt.getTime() >= 24 * 60 * 60 * 1000;
}

export function clampStakeToOriginalOnFailure(input: {
  proposedMinor: number;
  originalMinor: number;
  failedAt?: Date;
  now: Date;
}): number {
  if (!maySuggestStakeIncrease(input.failedAt, input.now)) {
    return Math.min(input.proposedMinor, input.originalMinor);
  }
  return input.proposedMinor;
}
