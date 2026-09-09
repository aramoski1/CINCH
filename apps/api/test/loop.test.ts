import { afterEach, describe, expect, it } from "vitest";
import { gymSpec } from "@cinch/commitments";
import { buildApp } from "../src/app";
import { loadEnv, testEnv } from "../src/config/env";
import { store } from "../src/store";

const env = loadEnv(testEnv);

async function signup(app: Awaited<ReturnType<typeof buildApp>>, email: string) {
  const issued = await app.inject({
    method: "POST",
    url: "/v1/auth/email",
    payload: { email },
  });
  const { devCode } = issued.json() as { devCode: string };
  const verified = await app.inject({
    method: "POST",
    url: "/v1/auth/verify",
    payload: { email, code: devCode, displayName: email.split("@")[0] },
  });
  return verified.json() as { token: string; user: { id: string } };
}

describe("commitment loop", () => {
  afterEach(() => store.reset());

  it("signs up, creates, invites, funds, and admin-resolves", async () => {
    const app = await buildApp(env);
    const alec = await signup(app, "alec@cinch.test");
    const auth = { authorization: `Bearer ${alec.token}` };

    const created = await app.inject({
      method: "POST",
      url: "/v1/commitments",
      headers: auth,
      payload: gymSpec({ committer_id: alec.user.id }),
    });
    expect(created.statusCode).toBe(200);
    const { id } = created.json() as { id: string };

    const invited = await app.inject({
      method: "POST",
      url: `/v1/commitments/${id}/invite`,
      headers: auth,
    });
    expect(invited.statusCode).toBe(200);
    expect(invited.json()).toMatchObject({ inviteCode: expect.any(String), shareUrl: expect.stringContaining("/i/") });

    const funded = await app.inject({
      method: "POST",
      url: `/v1/commitments/${id}/fund`,
      headers: auth,
    });
    expect(funded.statusCode).toBe(200);

    const resolved = await app.inject({
      method: "POST",
      url: "/v1/ops/resolve",
      headers: { "x-admin-token": env.INTERNAL_ADMIN_TOKEN },
      payload: { id, outcome: "success" },
    });
    expect(resolved.statusCode).toBe(200);
    expect(resolved.json()).toMatchObject({ state: "resolved" });
    await app.close();
  });
});
