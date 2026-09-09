import { afterAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { loadEnv, testEnv } from "../src/config/env";

const env = loadEnv(testEnv);
const app = await buildApp(env);

describe("health", () => {
  afterAll(async () => {
    await app.close();
  });

  it("returns 200 on /v1/health", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/health" });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { ok: boolean; service: string };
    expect(body.ok).toBe(true);
    expect(body.service).toBe("cinch-api");
  });
});
