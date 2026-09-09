import { gymSpec } from "@cinch/commitments";
import { buildApp } from "./app";
import { loadEnv, testEnv } from "./config/env";
import { store } from "./store";

export async function runDemo(): Promise<{ ok: true; commitmentId: string }> {
  store.reset();
  const env = loadEnv({ ...testEnv, NODE_ENV: "test" });
  const app = await buildApp(env);
  const issued = await app.inject({
    method: "POST",
    url: "/v1/auth/email",
    payload: { email: "alec@cinch.test" },
  });
  const { devCode } = issued.json() as { devCode: string };
  const verified = await app.inject({
    method: "POST",
    url: "/v1/auth/verify",
    payload: { email: "alec@cinch.test", code: devCode, displayName: "Alec" },
  });
  const { token, user } = verified.json() as { token: string; user: { id: string } };
  const auth = { authorization: `Bearer ${token}` };
  const created = await app.inject({
    method: "POST",
    url: "/v1/commitments",
    headers: auth,
    payload: gymSpec({ committer_id: user.id }),
  });
  const { id } = created.json() as { id: string };
  await app.inject({ method: "POST", url: `/v1/commitments/${id}/invite`, headers: auth });
  await app.inject({ method: "POST", url: `/v1/commitments/${id}/fund`, headers: auth });
  await app.inject({
    method: "POST",
    url: "/v1/ops/resolve",
    headers: { "x-admin-token": env.INTERNAL_ADMIN_TOKEN },
    payload: { id, outcome: "success" },
  });
  await app.close();
  return { ok: true, commitmentId: id };
}

if (process.argv[1]?.includes("demo")) {
  const result = await runDemo();
  console.log(JSON.stringify(result));
}
