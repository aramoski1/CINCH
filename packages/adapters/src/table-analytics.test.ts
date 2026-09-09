import { describe, expect, it } from "vitest";
import { createTableAnalytics } from "./table-analytics";

describe("TableAnalytics", () => {
  it("writes events without a vendor SDK", async () => {
    const rows: Array<Record<string, unknown>> = [];
    const analytics = createTableAnalytics({
      async insert(_table, row) {
        rows.push(row);
      },
      async flagRow() {
        return null;
      },
    });
    await analytics.track("user-1", "commitment.created", { id: "c1" });
    expect(rows[0]?.event).toBe("commitment.created");
  });
});
