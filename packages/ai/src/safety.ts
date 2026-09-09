export type SafetyDecision =
  | { blocked: false }
  | { blocked: true; category: string; message: string; resources?: string[] };

const RULES: Array<{ category: string; pattern: RegExp; message: string; resources?: string[] }> = [
  {
    category: "self-harm",
    pattern: /\b(kill myself|suicide|self[- ]harm|cut myself)\b/i,
    message: "I can't help lock a commitment that puts you in danger. Please reach out for help.",
    resources: ["https://www.iasp.info/suicidalthoughts/"],
  },
  {
    category: "eating-disorder",
    pattern: /\b(starve|calorie.?cap|purge|anorex|bulim)/i,
    message: "I won't lock eating or body-weight targets. If you want movement or meals logged as dollars, keep it kind.",
  },
  {
    category: "minors",
    pattern: /\b(underage|minor|child porn)\b/i,
    message: "This isn't something Cinch can be used for.",
  },
  {
    category: "violence",
    pattern: /\b(hurt them|attack|weapon|assault)\b/i,
    message: "I can't help with commitments that involve harming someone.",
  },
];

export function classifySafety(utterance: string): SafetyDecision {
  for (const rule of RULES) {
    if (rule.pattern.test(utterance)) {
      return {
        blocked: true,
        category: rule.category,
        message: rule.message,
        resources: rule.resources,
      };
    }
  }
  return { blocked: false };
}
