import type { ConditionLeaf, RuleNode } from "./spec";

export function renderRule(node: RuleNode): string {
  switch (node.op) {
    case "AND":
      return join(node.children.map(renderRule), "and");
    case "OR":
      return join(node.children.map(renderRule), "or");
    case "NOT":
      return `don't ${renderRule(node.child)}`;
    case "AT_LEAST":
      return `do at least ${node.n} of: ${node.children.map(renderRule).join("; ")}`;
    case "LEAF":
      return renderLeaf(node.leaf);
  }
}

function renderLeaf(leaf: ConditionLeaf): string {
  const p = leaf.params;
  switch (leaf.kind) {
    case "location.enter":
      return `get to ${String(p.place ?? "the place")} before ${String(p.before ?? "the deadline")}`;
    case "location.exit":
      return `leave ${String(p.place ?? "the place")} by ${String(p.before ?? "the deadline")}`;
    case "location.dwell":
      return `stay at ${String(p.place ?? "the place")} for at least ${formatMins(p.min_seconds)}`;
    case "location.avoid":
      return `stay away from ${String(p.place ?? "that place")}`;
    case "time.before":
      return `finish before ${String(p.deadline_at ?? "the deadline")}`;
    case "time.duration":
      return `last at least ${formatMins(p.min_seconds)}`;
    case "activity.workout":
      return `log a workout of at least ${formatMins(p.min_seconds)}`;
    case "activity.steps":
      return `hit ${String(p.min_count ?? 0)} steps`;
    case "proof.photo":
      return `send a photo${p.prompt ? ` (${String(p.prompt)})` : ""}`;
    case "proof.video":
      return "send a short video";
    case "social.partner_confirm":
      return "get your partner to confirm";
    case "ai.vision_scene":
      return `show that you're at ${String(p.expected_scene ?? "the scene")}`;
    default:
      return leaf.kind;
  }
}

function formatMins(seconds: unknown): string {
  const n = typeof seconds === "number" ? seconds : Number(seconds ?? 0);
  if (!Number.isFinite(n) || n <= 0) return "a while";
  return `${Math.round(n / 60)} minutes`;
}

function join(parts: string[], conj: string): string {
  if (parts.length === 1) return parts[0] ?? "";
  if (parts.length === 2) return `${parts[0]} ${conj} ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, ${conj} ${parts[parts.length - 1]}`;
}

export function renderCommitment(title: string, conditions: RuleNode, stakeLine: string): string {
  const body = renderRule(conditions);
  return `${title}. ${capitalize(body)}. ${stakeLine}`.trim();
}

function capitalize(s: string): string {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s;
}
