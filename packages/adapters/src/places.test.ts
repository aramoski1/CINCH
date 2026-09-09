import { describe, expect, it } from "vitest";
import { createSeededPlaceProvider } from "./places";

describe("SeededPlaceProvider", () => {
  it("finds Babson gym without Google Places", async () => {
    const places = createSeededPlaceProvider();
    const hits = await places.search("recreation");
    expect(hits[0]?.source).toBe("seeded");
  });
});
