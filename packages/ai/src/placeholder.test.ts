import { describe, expect, it } from "vitest";
import { AI_PACKAGE } from "./index";

describe("ai package", () => {
  it("loads", () => {
    expect(AI_PACKAGE).toBe("ai");
  });
});
