import { describe, expect, it } from "vitest";
import { COMMITMENTS_PACKAGE } from "./index";

describe("commitments package", () => {
  it("loads", () => {
    expect(COMMITMENTS_PACKAGE).toBe("commitments");
  });
});
