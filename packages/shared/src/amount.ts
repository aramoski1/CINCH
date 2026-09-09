export const CURRENCIES = ["POINTS", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];

/** Ledger unit. Never store a bare integer. */
export type Amount = {
  currency: Currency;
  minor: number;
};

export function amount(currency: Currency, minor: number): Amount {
  if (!Number.isInteger(minor)) {
    throw new Error("Amount.minor must be an integer");
  }
  return { currency, minor };
}

export function assertAmount(value: Amount): asserts value is Amount {
  if (!value || !CURRENCIES.includes(value.currency) || !Number.isInteger(value.minor)) {
    throw new Error("Invalid Amount");
  }
}

export function addAmounts(a: Amount, b: Amount): Amount {
  if (a.currency !== b.currency) {
    throw new Error("Cannot add amounts of different currencies");
  }
  return { currency: a.currency, minor: a.minor + b.minor };
}

/** Play dollars. Ledger may still be POINTS; nothing is charged. */
export function formatAmount(value: Amount): string {
  const dollars = value.minor / 100;
  if (Number.isInteger(dollars)) return `$${dollars.toLocaleString("en-US")}`;
  return `$${dollars.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
