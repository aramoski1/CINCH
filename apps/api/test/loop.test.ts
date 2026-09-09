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

  it("parses live, blocks safety, and refuses a house-profit destination", async () => {
    const app = await buildApp(env);
    const alec = await signup(app, "alec@cinch.test");
    const auth = { authorization: `Bearer ${alec.token}` };

    const parsed = await app.inject({
      method: "POST",
      url: "/v1/commitments/parse",
      headers: auth,
      payload: { utterance: "Gym by 6:30 tomorrow or I owe Ryan 25 points" },
    });
    expect(parsed.statusCode).toBe(200);
    expect(parsed.json()).toMatchObject({ ready: true });

    const blocked = await app.inject({
      method: "POST",
      url: "/v1/commitments/parse",
      headers: auth,
      payload: { utterance: "if I fail I will kill myself" },
    });
    expect(blocked.json()).toMatchObject({ blocked: true });

    const house = gymSpec({ committer_id: alec.user.id });
    house.stake.on_failure.destination = "platform";
    const created = await app.inject({
      method: "POST",
      url: "/v1/commitments",
      headers: auth,
      payload: house,
    });
    expect(created.statusCode).toBe(200);
    const { id } = created.json() as { id: string };
    const got = await app.inject({ method: "GET", url: `/v1/commitments/${id}`, headers: auth });
    expect((got.json() as { spec: { stake: { on_failure: { destination: string } } } }).spec.stake.on_failure.destination).not.toBe("platform");
    await app.close();
  });

  it("self-exclusion blocks fund; rematch and one nudge work; ambiguous evidence voids", async () => {
    const app = await buildApp(env);
    const alec = await signup(app, "alec@cinch.test");
    const ryan = await signup(app, "ryan@cinch.test");
    const auth = { authorization: `Bearer ${alec.token}` };
    const ryanAuth = { authorization: `Bearer ${ryan.token}` };

    const excluded = await app.inject({
      method: "POST",
      url: "/v1/me/exclude",
      headers: auth,
      payload: { days: 90 },
    });
    expect(excluded.statusCode).toBe(200);

    const created = await app.inject({
      method: "POST",
      url: "/v1/commitments",
      headers: auth,
      payload: gymSpec({ committer_id: alec.user.id }),
    });
    const { id } = created.json() as { id: string };
    await app.inject({ method: "POST", url: `/v1/commitments/${id}/invite`, headers: auth });
    const funded = await app.inject({
      method: "POST",
      url: `/v1/commitments/${id}/fund`,
      headers: auth,
    });
    expect(funded.statusCode).toBe(403);

    const alec2 = await signup(app, "alec2@cinch.test");
    const auth2 = { authorization: `Bearer ${alec2.token}` };
    const c2 = await app.inject({
      method: "POST",
      url: "/v1/commitments",
      headers: auth2,
      payload: gymSpec({ committer_id: alec2.user.id }),
    });
    const id2 = (c2.json() as { id: string }).id;
    await app.inject({ method: "POST", url: `/v1/commitments/${id2}/invite`, headers: auth2 });
    expect((await app.inject({ method: "POST", url: `/v1/commitments/${id2}/fund`, headers: auth2 })).statusCode).toBe(200);

    const nudge = await app.inject({
      method: "POST",
      url: `/v1/commitments/${id2}/nudge`,
      headers: ryanAuth,
      payload: { text: "I'm watching." },
    });
    expect(nudge.statusCode).toBe(200);
    const nudge2 = await app.inject({
      method: "POST",
      url: `/v1/commitments/${id2}/nudge`,
      headers: ryanAuth,
      payload: { text: "Don't." },
    });
    expect(nudge2.statusCode).toBe(400);

    const fail = await app.inject({
      method: "POST",
      url: "/v1/ops/resolve",
      headers: { "x-admin-token": env.INTERNAL_ADMIN_TOKEN },
      payload: { id: id2, outcome: "failure" },
    });
    expect(fail.statusCode).toBe(200);

    const rematch = await app.inject({
      method: "POST",
      url: `/v1/commitments/${id2}/rematch`,
      headers: auth2,
    });
    expect(rematch.statusCode).toBe(200);

    const c3 = await app.inject({
      method: "POST",
      url: "/v1/commitments",
      headers: auth2,
      payload: gymSpec({ committer_id: alec2.user.id }),
    });
    const id3 = (c3.json() as { id: string }).id;
    await app.inject({ method: "POST", url: `/v1/commitments/${id3}/invite`, headers: auth2 });
    await app.inject({ method: "POST", url: `/v1/commitments/${id3}/fund`, headers: auth2 });
    const settled = await app.inject({
      method: "POST",
      url: `/v1/commitments/${id3}/settle`,
      headers: auth2,
    });
    expect(settled.json()).toMatchObject({ outcome: "voided" });

    const challenge = await app.inject({
      method: "POST",
      url: "/v1/challenges",
      headers: ryanAuth,
      payload: { email: "alec2@cinch.test", utterance: "Gym by 6:30 tomorrow or I owe Ryan 25 points" },
    });
    expect(challenge.statusCode).toBe(200);
    expect((challenge.json() as { state: string }).state).toBe("pending");
    await app.close();
  });

  it("locks a promise in one shot", async () => {
    const app = await buildApp(env);
    const alec = await signup(app, "alec-lock@cinch.test");
    const locked = await app.inject({
      method: "POST",
      url: "/v1/commitments/lock",
      headers: { authorization: `Bearer ${alec.token}` },
      payload: { utterance: "Gym tomorrow at 6:30", friend: "Ryan", stake: 25 },
    });
    expect(locked.statusCode).toBe(200);
    const body = locked.json() as { id: string; shareUrl: string; friend: string };
    expect(body.friend).toBe("Ryan");
    expect(body.shareUrl).toContain("/i/");
    const active = await app.inject({
      method: "GET",
      url: "/v1/commitments/active",
      headers: { authorization: `Bearer ${alec.token}` },
    });
    expect((active.json() as unknown[]).length).toBe(1);
    await app.close();
  });

  it("locks with an explicit deadline", async () => {
    const app = await buildApp(env);
    const alec = await signup(app, "alec-deadline@cinch.test");
    const due = new Date(Date.now() + 2 * 86400_000);
    due.setUTCHours(18, 0, 0, 0);
    const locked = await app.inject({
      method: "POST",
      url: "/v1/commitments/lock",
      headers: { authorization: `Bearer ${alec.token}` },
      payload: { utterance: "Gym tomorrow at 6:30", friend: "Ryan", stake: 25, deadlineAt: due.toISOString() },
    });
    expect(locked.statusCode, JSON.stringify(locked.json())).toBe(200);
    expect(Date.parse((locked.json() as { deadlineAt: string }).deadlineAt)).toBe(due.getTime());
    await app.close();
  });

  it("saves settings and lists named friends after a lock", async () => {
    const app = await buildApp(env);
    const alec = await signup(app, "alec-settings@cinch.test");
    const ryan = await signup(app, "ryan-settings@cinch.test");
    const auth = { authorization: `Bearer ${alec.token}` };

    const patched = await app.inject({
      method: "PATCH",
      url: "/v1/me/settings",
      headers: auth,
      payload: { haptics: false, defaultStake: 50, leaveNow: false },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json()).toMatchObject({
      settings: { haptics: false, defaultStake: 50, leaveNow: false, shareOnLock: true },
    });

    const me = await app.inject({ method: "GET", url: "/v1/me", headers: auth });
    expect((me.json() as { user: { settings: { defaultStake: number } } }).user.settings.defaultStake).toBe(50);

    await app.inject({
      method: "POST",
      url: "/v1/commitments/lock",
      headers: auth,
      payload: { utterance: "Gym tomorrow at 6:30", friend: "Sam", stake: 25 },
    });
    const named = await app.inject({ method: "GET", url: "/v1/friends", headers: auth });
    expect(named.json()).toMatchObject({ named: ["Sam"], people: [] });

    const added = await app.inject({
      method: "POST",
      url: "/v1/friends",
      headers: auth,
      payload: { email: "ryan-settings@cinch.test" },
    });
    expect(added.statusCode).toBe(200);
    expect(added.json()).toMatchObject({
      ok: true,
      person: { id: ryan.user.id, displayName: "ryan-settings" },
    });
    await app.close();
  });

  it("picks a real friend, requires photo proof, auto-fails without it, and ranks the board", async () => {
    const app = await buildApp(env);
    const alec = await signup(app, "alec-board@cinch.test");
    const ryan = await signup(app, "ryan-board@cinch.test");
    const auth = { authorization: `Bearer ${alec.token}` };
    const ryanAuth = { authorization: `Bearer ${ryan.token}` };

    await app.inject({
      method: "POST",
      url: "/v1/friends",
      headers: auth,
      payload: { email: "ryan-board@cinch.test" },
    });

    const locked = await app.inject({
      method: "POST",
      url: "/v1/commitments/lock",
      headers: auth,
      payload: {
        utterance: "Gym tomorrow at 6:30",
        friend: "ryan-board",
        friendId: ryan.user.id,
        stake: 25,
      },
    });
    expect(locked.statusCode).toBe(200);
    const { id } = locked.json() as { id: string };

    const refused = await app.inject({
      method: "POST",
      url: `/v1/commitments/${id}/kept`,
      headers: auth,
    });
    expect(refused.statusCode).toBe(400);

    const nonce = await app.inject({ method: "POST", url: "/v1/evidence/nonce", headers: auth });
    const proof = await app.inject({
      method: "POST",
      url: `/v1/commitments/${id}/proof`,
      headers: auth,
      payload: {
        nonce: (nonce.json() as { nonce: string }).nonce,
        data: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBD",
      },
    });
    expect(proof.statusCode).toBe(200);

    const board = await app.inject({ method: "GET", url: "/v1/leaderboard", headers: auth });
    const ranked = board.json() as { board: Array<{ id: string; you: boolean; kept: number }> };
    expect(ranked.board.some((row) => row.id === alec.user.id && row.you && row.kept === 1)).toBe(true);
    expect(ranked.board.some((row) => row.id === ryan.user.id)).toBe(true);

    const second = await app.inject({
      method: "POST",
      url: "/v1/commitments/lock",
      headers: auth,
      payload: { utterance: "Library tomorrow at 7", friend: "ryan-board", friendId: ryan.user.id, stake: 10 },
    });
    const lateId = (second.json() as { id: string }).id;
    const row = store.commitments.get(lateId);
    if (row) row.spec.schedule.deadline_at = new Date(Date.now() - 1000).toISOString();
    const active = await app.inject({ method: "GET", url: "/v1/commitments/active", headers: auth });
    expect((active.json() as unknown[]).length).toBe(0);
    expect(store.commitments.get(lateId)?.outcome).toBe("failure");

    const watching = await app.inject({ method: "GET", url: "/v1/watching", headers: ryanAuth });
    expect(watching.statusCode).toBe(200);
    await app.close();
  });

  it("checks in, lists achievements, and discovers people", async () => {
    const app = await buildApp(env);
    const alec = await signup(app, "alec-hub@cinch.test");
    const ryan = await signup(app, "ryan-hub@cinch.test");
    const auth = { authorization: `Bearer ${alec.token}` };
    const checkin = await app.inject({
      method: "POST",
      url: "/v1/checkins",
      headers: auth,
      payload: { localDate: "2026-09-09", timezone: "America/New_York", mood: "locked-in" },
    });
    expect(checkin.statusCode).toBe(200);
    const again = await app.inject({
      method: "POST",
      url: "/v1/checkins",
      headers: auth,
      payload: { localDate: "2026-09-09", timezone: "America/New_York", mood: "steady" },
    });
    expect((again.json() as { mood: string }).mood).toBe("locked-in");
    const badges = await app.inject({ method: "GET", url: "/v1/achievements", headers: auth });
    expect((badges.json() as Array<{ id: string }>).some((row) => row.id === "first-lock")).toBe(true);
    const people = await app.inject({ method: "GET", url: "/v1/people?q=ryan", headers: auth });
    expect((people.json() as Array<{ id: string }>).some((row) => row.id === ryan.user.id)).toBe(true);
    await app.close();
  });
});
