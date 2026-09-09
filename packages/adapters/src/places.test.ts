import { describe, expect, it } from "vitest";
import { createSeededPlaceProvider } from "./places";

describe("SeededPlaceProvider", () => {
  it("finds the gym without Google Places", async () => {
    const places = createSeededPlaceProvider();
    const hits = await places.search("gym");
    expect(hits[0]?.source).toBe("seeded");
  });
});
