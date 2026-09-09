import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("RLS migrations", () => {
  const files = [
    "0001_init.sql",
    "0002_auth.sql",
    "0003_commitments.sql",
    "0004_social.sql",
    "0005_verification.sql",
    "0006_jobs.sql",
    "0007_notifications.sql",
    "0008_social_plus.sql",
  ];

  it("enables RLS on every user table and never disables it", () => {
    for (const file of files) {
      const sql = readFileSync(new URL(`../../../supabase/migrations/${file}`, import.meta.url), "utf8");
      expect(sql).not.toMatch(/disable row level security/i);
      if (sql.includes("create table")) {
        expect(sql).toMatch(/enable row level security/i);
      }
    }
  });
});
