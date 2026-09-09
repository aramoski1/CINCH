import { describe, expect, it } from "vitest";
import { amount } from "@cinch/shared";
import { createPointsStakeProvider, type WalletStore } from "./points-stake";

function memoryStore(): WalletStore & { wallets: Map<string, ReturnType<WalletStore["get"]>> } {
  const wallets = new Map<string, ReturnType<WalletStore["get"]>>();
  return {
    wallets,
    get(userId) {
      const existing = wallets.get(userId);
      if (existing) return existing;
      const created = {
        id: `w:${userId}`,
        available: amount("POINTS", 10000),
        reserved: amount("POINTS", 0),
      };
      wallets.set(userId, created);
      return created;
    },
    apply() {},
  };
}

describe("PointsStakeProvider", () => {
  it("reserves and releases without a bare integer", async () => {
    const store = memoryStore();
    const provider = createPointsStakeProvider(store);
    const { reservationId } = await provider.reserve({
      commitmentId: "c1",
      userId: "u1",
      amount: amount("POINTS", 2500),
    });
    expect(store.get("u1").available).toEqual(amount("POINTS", 7500));
    expect(store.get("u1").reserved).toEqual(amount("POINTS", 2500));
    await provider.release(reservationId);
    expect(store.get("u1").available).toEqual(amount("POINTS", 10000));
  });
});
