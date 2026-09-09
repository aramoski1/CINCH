export type TemplateHit = {
  id: number;
  title: string;
  placeHint?: string;
  dwellMinutes?: number;
  stakeMinor: number;
};

const TEMPLATES: Array<{ id: number; pattern: RegExp; hit: Omit<TemplateHit, "id"> }> = [
  { id: 1, pattern: /gym.*6:30|6:30.*gym/i, hit: { title: "Gym by 6:30", placeHint: "gym", dwellMinutes: 45, stakeMinor: 2500 } },
  { id: 2, pattern: /out of (my )?(house|apartment|dorm).*7/i, hit: { title: "Leave home by 7", placeHint: "home", stakeMinor: 2000 } },
  { id: 3, pattern: /run 5 miles|5k|five miles/i, hit: { title: "Run 5 miles", stakeMinor: 1000 } },
  { id: 4, pattern: /library.*two hours|study.*library/i, hit: { title: "Study at the library", placeHint: "library", dwellMinutes: 120, stakeMinor: 1500 } },
  { id: 5, pattern: /assignment|submit.*tonight/i, hit: { title: "Submit the assignment", stakeMinor: 5000 } },
  { id: 6, pattern: /wake up|out of bed/i, hit: { title: "Up and out", placeHint: "dorm", stakeMinor: 1500 } },
  { id: 7, pattern: /no instagram|off instagram/i, hit: { title: "No Instagram", stakeMinor: 1000 } },
  { id: 8, pattern: /10,?000 steps/i, hit: { title: "10,000 steps", stakeMinor: 500 } },
  { id: 9, pattern: /meditate/i, hit: { title: "Meditate 10 minutes", stakeMinor: 500 } },
  { id: 10, pattern: /pushups|push-ups/i, hit: { title: "100 pushups", stakeMinor: 400 } },
];

export function matchTemplate(utterance: string): TemplateHit | null {
  for (const t of TEMPLATES) {
    if (t.pattern.test(utterance)) return { id: t.id, ...t.hit };
  }
  return null;
}
