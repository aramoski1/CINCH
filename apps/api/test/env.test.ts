import { describe, expect, it } from "vitest";
import { loadEnv, testEnv } from "../src/config/env";

describe("env schema", () => {
  it("accepts the lean three-vendor fixture", () => {
    const env = loadEnv(testEnv);
    expect(env.STAKE_CURRENCY).toBe("POINTS");
    expect(env.FEATURE_PAYMENTS_ENABLED).toBe(false);
  });

  it("rejects a Stripe key", () => {
    expect(() =>
      loadEnv({ ...testEnv, STRIPE_SECRET_KEY: "sk_test_forbidden" }),
    ).toThrow(/Forbidden vendor/);
  });

  it("rejects DIRECT_URL on the pooler port", () => {
    expect(() =>
      loadEnv({
        ...testEnv,
        DIRECT_URL: "postgresql://postgres:postgres@127.0.0.1:6543/postgres",
      }),
    ).toThrow(/5432/);
  });
});
