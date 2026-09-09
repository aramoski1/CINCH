export type Signal = {
  source: string;
  weight: number;
  observed: boolean;
  quality?: number;
  sameDeviceAs?: string;
  mockLocation?: boolean;
};

export type ConfidenceResult = {
  score: number;
  band: "success" | "review" | "ambiguous" | "failure";
};

export function scoreConfidence(signals: Signal[]): ConfidenceResult {
  let total = 0;
  for (const s of signals) {
    if (s.mockLocation) {
      total += (s.observed ? s.weight * (s.quality ?? 1) : 0) - 60;
      continue;
    }
    if (!s.observed) continue;
    const quality = s.quality ?? 1;
    const corr = s.sameDeviceAs ? 0.5 : 1;
    total += s.weight * quality * corr;
  }
  const band =
    total >= 85 ? "success" : total >= 70 ? "review" : total >= 26 ? "ambiguous" : "failure";
  return { score: total, band };
}

/** PRD §6.3 worked examples must produce 85, 47.5, and −20. */
export const GYM_SUCCESS: Signal[] = [
  { source: "gps_dwell", weight: 40, observed: true },
  { source: "watch_workout", weight: 30, observed: true },
  { source: "motion", weight: 15, observed: true, sameDeviceAs: "gps_dwell" },
  { source: "wifi", weight: 15, observed: true, sameDeviceAs: "gps_dwell" },
];

export const GYM_PHONE_IN_LOCKER: Signal[] = [
  { source: "gps_dwell", weight: 40, observed: true },
  { source: "watch_workout", weight: 30, observed: false },
  { source: "wifi", weight: 15, observed: true, sameDeviceAs: "gps_dwell" },
];

export const GYM_MOCK_LOCATION: Signal[] = [
  { source: "gps_dwell", weight: 40, observed: true, mockLocation: true },
];
