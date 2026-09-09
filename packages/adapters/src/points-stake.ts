import { amount, type Amount, type ForfeitDestination, type StakeProvider } from "@cinch/shared";

export type LedgerRow = {
  id: string;
  walletId: string;
  direction: "debit" | "credit";
  amount: Amount;
  ref: string;
};

export type WalletStore = {
  get(userId: string): { id: string; available: Amount; reserved: Amount };
  apply(entries: LedgerRow[]): void;
};

export function createPointsStakeProvider(store: WalletStore): StakeProvider {
  return {
    async reserve({ commitmentId, userId, amount: value }) {
      if (value.currency !== "POINTS") {
        throw new Error("PointsStakeProvider only accepts POINTS");
      }
      const wallet = store.get(userId);
      if (wallet.available.minor < value.minor) {
        throw new Error("Insufficient points");
      }
      store.apply([
        {
          id: `${commitmentId}:reserve:debit`,
          walletId: wallet.id,
          direction: "debit",
          amount: value,
          ref: `reserve:${commitmentId}`,
        },
        {
          id: `${commitmentId}:reserve:credit`,
          walletId: wallet.id,
          direction: "credit",
          amount: amount("POINTS", 0),
          ref: `reserve-hold:${commitmentId}`,
        },
      ]);
      wallet.available = amount("POINTS", wallet.available.minor - value.minor);
      wallet.reserved = amount("POINTS", wallet.reserved.minor + value.minor);
      return { reservationId: `pts:${commitmentId}:${userId}` };
    },
    async release(reservationId) {
      const [, commitmentId, userId] = reservationId.split(":");
      if (!commitmentId || !userId) throw new Error("Bad reservation");
      const wallet = store.get(userId);
      const reserved = wallet.reserved.minor;
      wallet.available = amount("POINTS", wallet.available.minor + reserved);
      wallet.reserved = amount("POINTS", 0);
    },
    async forfeit(reservationId, _destination: ForfeitDestination) {
      const [, commitmentId, userId] = reservationId.split(":");
      if (!commitmentId || !userId) throw new Error("Bad reservation");
      const wallet = store.get(userId);
      wallet.reserved = amount("POINTS", 0);
    },
  };
}
