import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { notFound } from "@cinch/shared";
import { scoreConfidence } from "@cinch/commitments";
import { newId, store } from "../store";
import { requireUser } from "./auth";
import type { Env } from "../config/env";

export async function registerSocial(app: FastifyInstance, env: Env) {
  app.get("/v1/me", async (req) => {
    const user = requireUser(req.headers.authorization);
    return { user, wallet: store.wallet(user.id) };
  });

  app.patch("/v1/me", async (req) => {
    const user = requireUser(req.headers.authorization);
    const body = z.object({ displayName: z.string().min(1).optional(), avatarUrl: z.string().url().optional() }).parse(req.body);
    Object.assign(user, body);
    return { user };
  });

  app.get("/v1/friends", async (req) => {
    const user = requireUser(req.headers.authorization);
    return [...(store.friends.get(user.id) ?? [])];
  });

  app.post("/v1/friends", async (req) => {
    const user = requireUser(req.headers.authorization);
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const other = [...store.users.values()].find((u) => u.email === email);
    if (!other) throw notFound("User not found");
    const mine = store.friends.get(user.id) ?? new Set<string>();
    mine.add(other.id);
    store.friends.set(user.id, mine);
    return { ok: true };
  });

  app.get("/v1/feed", async (req) => {
    requireUser(req.headers.authorization);
    return store.feed;
  });

  app.post("/v1/feed/:id/react", async (req) => {
    requireUser(req.headers.authorization);
    store.feed.push({ type: "reaction", id: (req.params as { id: string }).id });
    return { ok: true };
  });

  app.post("/v1/evidence/nonce", async (req) => {
    requireUser(req.headers.authorization);
    const nonce = newId();
    return { nonce, expiresIn: 120 };
  });

  app.post("/v1/commitments/:id/evidence", async (req) => {
    requireUser(req.headers.authorization);
    const { id } = req.params as { id: string };
    const body = z
      .object({
        nonce: z.string(),
        kind: z.enum(["photo", "checkin", "partner_attest", "admin"]),
        payload: z.record(z.unknown()).default({}),
      })
      .parse(req.body);
    if (store.usedNonces.has(body.nonce)) {
      return { ok: false, reason: "replay" };
    }
    store.usedNonces.add(body.nonce);
    const list = store.evidence.get(id) ?? [];
    list.push({ id: newId(), commitmentId: id, kind: body.kind, payload: body.payload });
    store.evidence.set(id, list);
    const row = store.commitments.get(id);
    if (row && (row.state === "active" || row.state === "verification_pending")) {
      const scored = scoreConfidence([
        { source: "photo", weight: 25, observed: list.some((e) => e.kind === "photo") },
        { source: "partner", weight: 30, observed: list.some((e) => e.kind === "partner_attest") },
        { source: "checkin", weight: 40, observed: list.some((e) => e.kind === "checkin") },
      ]);
      if (scored.band === "success") store.transition(id, "success");
    }
    return { ok: true };
  });

  app.post("/v1/commitments/:id/attest", async (req) => {
    requireUser(req.headers.authorization);
    const { id } = req.params as { id: string };
    const { confirm } = z.object({ confirm: z.boolean() }).parse(req.body);
    if (confirm) {
      const list = store.evidence.get(id) ?? [];
      list.push({ id: newId(), commitmentId: id, kind: "partner_attest", payload: {} });
      store.evidence.set(id, list);
      const row = store.commitments.get(id);
      if (row && ["active", "verification_pending"].includes(row.state)) {
        store.transition(id, "success");
      }
    }
    return { ok: true };
  });

  app.post("/v1/commitments/:id/dispute", async (req) => {
    requireUser(req.headers.authorization);
    const { id } = req.params as { id: string };
    store.transition(id, "disputed");
    const disputeId = newId();
    store.disputes.set(disputeId, { id: disputeId, commitmentId: id, state: "open" });
    return { disputeId };
  });

  app.get("/v1/wallet", async (req) => {
    const user = requireUser(req.headers.authorization);
    return store.wallet(user.id);
  });

  app.get("/v1/users/:id/reputation", async (req) => {
    requireUser(req.headers.authorization);
    const user = store.users.get((req.params as { id: string }).id);
    if (!user) throw notFound();
    return { score: user.score, streak: user.streak };
  });

  app.get("/v1/groups", async (req) => {
    requireUser(req.headers.authorization);
    return [...store.groups.values()];
  });

  app.post("/v1/groups", async (req) => {
    const user = requireUser(req.headers.authorization);
    const { name } = z.object({ name: z.string().min(1) }).parse(req.body);
    const id = newId();
    store.groups.set(id, { id, name, memberIds: [user.id] });
    return { id };
  });

  app.post("/v1/groups/:id/join", async (req) => {
    const user = requireUser(req.headers.authorization);
    const group = store.groups.get((req.params as { id: string }).id);
    if (!group) throw notFound();
    if (group.memberIds.length >= 8) return { ok: false, reason: "full" };
    if (!group.memberIds.includes(user.id)) group.memberIds.push(user.id);
    return { ok: true };
  });

  app.post("/v1/ops/resolve", async (req) => {
    const token = req.headers["x-admin-token"];
    if (token !== env.INTERNAL_ADMIN_TOKEN) return { error: "forbidden" };
    const { id, outcome } = z
      .object({ id: z.string(), outcome: z.enum(["success", "failure", "voided"]) })
      .parse(req.body);
    const row = store.commitments.get(id);
    if (!row) throw notFound();
    if (row.state === "scheduled") store.transition(id, "active");
    store.transition(id, outcome);
    store.transition(id, "resolved");
    return { ok: true, state: "resolved" };
  });

  app.get("/v1/ops/audit", async (req) => {
    if (req.headers["x-admin-token"] !== env.INTERNAL_ADMIN_TOKEN) return { error: "forbidden" };
    return store.audit;
  });

  app.get("/v1/invites/:code", async (req) => {
    const { code } = req.params as { code: string };
    const row = [...store.commitments.values()].find((c) => c.inviteCode === code);
    if (!row) throw notFound();
    return {
      title: row.spec.title,
      rendered: row.spec.natural_language,
      stake: row.spec.stake.amount,
      assumptions: row.spec.meta.assumptions,
      inviteCode: code,
    };
  });
}
