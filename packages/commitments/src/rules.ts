import type { RuleNode } from "./spec";

export type LeafResult = { id: string; passed: boolean };

export function evaluateRule(
  node: RuleNode,
  leaves: Record<string, boolean>,
  path = "root",
): boolean {
  switch (node.op) {
    case "AND":
      return node.children.every((child, i) => evaluateRule(child, leaves, `${path}.and.${i}`));
    case "OR":
      return node.children.some((child, i) => evaluateRule(child, leaves, `${path}.or.${i}`));
    case "NOT":
      return !evaluateRule(node.child, leaves, `${path}.not`);
    case "AT_LEAST": {
      const hits = node.children.filter((child, i) =>
        evaluateRule(child, leaves, `${path}.atleast.${i}`),
      ).length;
      return hits >= node.n;
    }
    case "LEAF": {
      const key = leafKey(node.leaf.kind, node.leaf.params);
      return leaves[key] === true;
    }
  }
}

export function leafKey(kind: string, params: Record<string, unknown>): string {
  return `${kind}:${JSON.stringify(params)}`;
}

export function walkLeaves(node: RuleNode, out: Array<{ kind: string; params: Record<string, unknown> }> = []) {
  if (node.op === "LEAF") {
    out.push(node.leaf);
    return out;
  }
  if (node.op === "NOT") {
    walkLeaves(node.child, out);
    return out;
  }
  for (const child of node.children) walkLeaves(child, out);
  return out;
}

export function treeDepth(node: RuleNode): number {
  if (node.op === "LEAF") return 1;
  if (node.op === "NOT") return 1 + treeDepth(node.child);
  return 1 + Math.max(...node.children.map(treeDepth));
}

export function wrapsOrInNot(node: RuleNode, insideNot = false): boolean {
  if (node.op === "NOT") return wrapsOrInNot(node.child, true);
  if (node.op === "OR" && insideNot) return true;
  if (node.op === "LEAF") return false;
  return node.children.some((child) => wrapsOrInNot(child, insideNot));
}
