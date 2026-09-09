import { describe, expect, it } from "vitest";
import { addAmounts, amount, formatAmount } from "./amount";

describe("Amount", () => {
  it("rejects a non-integer minor", () => {
    expect(() => amount("POINTS", 1.5)).toThrow(/integer/);
  });

  it("formats points and usd without bare integers", () => {
    expect(formatAmount(amount("POINTS", 2500))).toBe("$25");
    expect(formatAmount(amount("USD", 2550))).toBe("$25.50");
  });

  it("adds same-currency amounts", () => {
    expect(addAmounts(amount("POINTS", 100), amount("POINTS", 50))).toEqual({
      currency: "POINTS",
      minor: 150,
    });
  });
});
