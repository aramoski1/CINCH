import type { LanguageModel, Place } from "@cinch/shared";
import { commitmentSpecSchema, gymSpec, type CommitmentSpec } from "@cinch/commitments";
import { classifySafety } from "./safety";
import { matchTemplate } from "./templates";

export type ParseContext = {
  now: Date;
  timezone: string;
  committerId: string;
  places: Place[];
  partnerHint?: { id: string; name: string };
};

export type ParseResult =
  | { ok: true; spec: CommitmentSpec; rendered: string; assumptions: string[] }
  | { ok: false; blocked: true; message: string; resources?: string[] }
  | { ok: false; blocked: false; message: string };

export async function parseUtterance(
  utterance: string,
  ctx: ParseContext,
  model?: LanguageModel,
  timeoutMs = 2500,
): Promise<ParseResult> {
  const safety = classifySafety(utterance);
  if (safety.blocked) {
    return { ok: false, blocked: true, message: safety.message, resources: safety.resources };
  }

  if (model) {
    try {
      const result = await model.complete({
        system:
          "Extract a Cinch CommitmentSpec. Use the emit_spec tool. Points only. Never invent Stripe or phone numbers.",
        user: JSON.stringify({ utterance, now: ctx.now.toISOString(), timezone: ctx.timezone }),
        maxTokens: 1024,
        timeoutMs,
        tools: [
          {
            name: "emit_spec",
            description: "Structured commitment",
            inputSchema: { type: "object", additionalProperties: true },
          },
        ],
      });
      const call = result.toolCalls.find((c) => c.name === "emit_spec");
      if (call) {
        const parsed = commitmentSpecSchema.safeParse({
          ...gymSpec(),
          ...call.input,
          natural_language: utterance,
          committer_id: ctx.committerId,
        });
        if (parsed.success) {
          return {
            ok: true,
            spec: parsed.data,
            rendered: parsed.data.title,
            assumptions: parsed.data.meta.assumptions,
          };
        }
      }
    } catch {
      // fall through to templates
    }
  }

  const hit = matchTemplate(utterance);
  const spec = gymSpec({
    title: hit?.title ?? inferTitle(utterance),
    natural_language: utterance,
    committer_id: ctx.committerId,
    stake: {
      kind: "points",
      amount: { currency: "POINTS", minor: hit?.stakeMinor ?? 1000 },
      on_failure: {
        destination: ctx.partnerHint ? "partner" : "platform",
        destination_id: ctx.partnerHint?.id ?? null,
      },
      on_success: { action: "release_to_committer" },
    },
    meta: {
      field_confidence: { title: 0.7 },
      assumptions: [
        `Timezone = ${ctx.timezone}`,
        hit?.placeHint
          ? `Place ≈ ${ctx.places.find((p) => p.name.toLowerCase().includes(hit.placeHint!))?.name ?? hit.placeHint}`
          : "Place will be confirmed on the card",
      ],
      needs_disambiguation: hit?.placeHint ? [] : ["place"],
      safety_flags: [],
      feasibility: { score: 0.75, warnings: [] },
    },
  });

  return { ok: true, spec, rendered: spec.title, assumptions: spec.meta.assumptions };
}

function inferTitle(utterance: string): string {
  const clipped = utterance.replace(/\s+/g, " ").trim();
  return clipped.length > 48 ? `${clipped.slice(0, 45)}…` : clipped || "Commitment";
}
