import { describe, expect, it } from "vitest";
import { runDemo } from "../src/demo";

describe("demo script", () => {
  it("locks and resolves a commitment", async () => {
    const result = await runDemo();
    expect(result.ok).toBe(true);
    expect(result.commitmentId).toBeTruthy();
  });
});
