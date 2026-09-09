import Anthropic from "@anthropic-ai/sdk";
import type { LanguageModel } from "@cinch/shared";

export function createAnthropicModel(input: {
  apiKey: string;
  model: string;
  maxTokens: number;
}): LanguageModel {
  const client = new Anthropic({ apiKey: input.apiKey });
  return {
    async complete({ system, user, maxTokens, timeoutMs, tools }) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await client.messages.create(
          {
            model: input.model,
            max_tokens: maxTokens || input.maxTokens,
            system,
            messages: [{ role: "user", content: user }],
            tools: tools?.map((t) => ({
              name: t.name,
              description: t.description,
              input_schema: t.inputSchema as Anthropic.Tool["input_schema"],
            })),
          },
          { signal: controller.signal },
        );
        const text = res.content
          .filter((b) => b.type === "text")
          .map((b) => (b.type === "text" ? b.text : ""))
          .join("\n");
        const toolCalls = res.content
          .filter((b) => b.type === "tool_use")
          .map((b) =>
            b.type === "tool_use"
              ? { name: b.name, input: b.input as Record<string, unknown> }
              : { name: "", input: {} },
          )
          .filter((c) => c.name);
        return { text, toolCalls };
      } finally {
        clearTimeout(timer);
      }
    },
    async reviewImage({ mediaType, data, prompt }) {
      const res = await client.messages.create({
        model: input.model,
        max_tokens: 256,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mediaType, data: Buffer.from(data).toString("base64") },
              },
              { type: "text", text: prompt },
            ],
          },
        ],
      });
      const text = res.content[0] && res.content[0].type === "text" ? res.content[0].text : "";
      const scoreMatch = text.match(/score\s*[:=]\s*(\d+(?:\.\d+)?)/i);
      return {
        score: scoreMatch ? Number(scoreMatch[1]) : 50,
        labels: [],
        rationale: text.slice(0, 400),
      };
    },
  };
}
