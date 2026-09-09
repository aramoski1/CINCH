import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { amount, badRequest, notFound } from "@cinch/shared";
import {
  commitmentSpecSchema,
  firstFailure,
  renderCommitment,
  renderRule,
  validateSpec,
} from "@cinch/commitments";
import { parseUtterance } from "@cinch/ai";
import { BABSON_PLACES, createMemoryQueue, createPointsStakeProvider } from "@cinch/adapters";
import { newId, store } from "../store";
import { requireUser } from "./auth";
import type { Env } from "../config/env";

const queue = createMemoryQueue();

export async function registerCommitments(app: FastifyInstance, env: Env) {
  const stakes = createPointsStakeProvider({
    get(userId) {
      const w = store.wallet(userId);
      return { id: `w:${userId}`, available: w.available, reserved: w.reserved };
    },
    apply() {},
  });

  app.post("/v1/commitments/parse", async (req) => {
    const user = requireUser(req.headers.authorization);
    const { utterance } = z.object({ utterance: z.string().min(1) }).parse(req.body);
    const parsed = await parseUtterance(
      utterance,
      {
        now: new Date(),
        timezone: "America/New_York",
        committerId: user.id,
        places: BABSON_PLACES,
      },
      undefined,
      env.AI_PARSE_TIMEOUT_MS,
    );
    if (!parsed.ok) {
      return { blocked: parsed.blocked, message: parsed.message, resources: "resources" in parsed ? parsed.resources : [] };
    }
    return {
      spec: parsed.spec,
      rendered: renderCommitment(
        parsed.spec.title,
        parsed.spec.conditions,
        `${parsed.spec.stake.amount.minor} pts on the line`,
      ),
      assumptions: parsed.assumptions,
    };
  });

  app.post("/v1/commitments", async (req) => {
    const user = requireUser(req.headers.authorization);
    const spec = commitmentSpecSchema.parse({
      ...(req.body as object),
      committer_id: user.id,
    });
    const failure = firstFailure(
      validateSpec(spec, {
        now: new Date(),
        minStakeMinor: env.MIN_STAKE_MINOR,
        maxStakeMinor: env.MAX_STAKE_MINOR,
        committerId: user.id,
        connectedSources: spec.verification.sources,
        adultPartnerIds: new Set(
          spec.partners.map((p) => p.resolved_user_id).filter((x): x is string => Boolean(x)),
        ),
      }),
    );
    if (failure && !failure.ok) throw badRequest(failure.message, { code: failure.code });
    const id = newId();
    const inviteCode = id.slice(0, 8);
    store.commitments.set(id, {
      id,
      state: "draft",
      spec,
      inviteCode,
      createdAt: new Date().toISOString(),
    });
    return { id, state: "draft", inviteCode, rendered: renderRule(spec.conditions) };
  });

  app.get("/v1/commitments/active", async (req) => {
    const user = requireUser(req.headers.authorization);
    return [...store.commitments.values()].filter(
      (c) => c.spec.committer_id === user.id && !["resolved", "cancelled"].includes(c.state),
    );
  });

  app.get("/v1/commitments/history", async (req) => {
    requireUser(req.headers.authorization);
    return [...store.commitments.values()];
  });

  app.get("/v1/commitments/:id", async (req) => {
    requireUser(req.headers.authorization);
    const { id } = req.params as { id: string };
    const row = store.commitments.get(id);
    if (!row) throw notFound();
    return row;
  });

  app.post("/v1/commitments/:id/invite", async (req) => {
    requireUser(req.headers.authorization);
    const { id } = req.params as { id: string };
    const row = store.transition(id, "pending_acceptance");
    await queue.schedule(
      "invite.expire",
      { id },
      new Date(Date.now() + 12 * 3600_000),
      { key: `invite-expire:${id}` },
    );
    return {
      inviteCode: row.inviteCode,
      shareUrl: `${env.WEB_BASE_URL}/i/${row.inviteCode}`,
    };
  });

  app.post("/v1/commitments/:id/accept", async (req) => {
    requireUser(req.headers.authorization);
    store.transition(idParam(req), "funding");
    return { ok: true };
  });

  app.post("/v1/commitments/:id/decline", async (req) => {
    requireUser(req.headers.authorization);
    store.transition(idParam(req), "cancelled");
    return { ok: true };
  });

  app.post("/v1/commitments/:id/fund", async (req) => {
    const user = requireUser(req.headers.authorization);
    const row = store.commitments.get(idParam(req));
    if (!row) throw notFound();
    if (row.state === "draft" || row.state === "pending_acceptance") {
      store.transition(row.id, row.state === "draft" ? "funding" : "funding");
    }
    const { reservationId } = await stakes.reserve({
      commitmentId: row.id,
      userId: user.id,
      amount: row.spec.stake.amount.currency === "POINTS"
        ? row.spec.stake.amount
        : amount("POINTS", row.spec.stake.amount.minor),
    });
    row.reservationId = reservationId;
    const w = store.wallet(user.id);
    w.available = amount("POINTS", w.available.minor - row.spec.stake.amount.minor);
    w.reserved = amount("POINTS", w.reserved.minor + row.spec.stake.amount.minor);
    store.transition(row.id, "scheduled");
    await queue.schedule("commitment.start", { id: row.id }, new Date(row.spec.schedule.start_at ?? Date.now()));
    await queue.schedule("commitment.deadline", { id: row.id }, new Date(row.spec.schedule.deadline_at));
    return { state: "scheduled", reservationId };
  });

  app.post("/v1/commitments/:id/cancel", async (req) => {
    requireUser(req.headers.authorization);
    store.transition(idParam(req), "cancelled");
    return { ok: true };
  });

  app.post("/v1/commitments/:id/void", async (req) => {
    requireUser(req.headers.authorization);
    store.transition(idParam(req), "voided");
    return { ok: true };
  });
}

function idParam(req: { params: unknown }): string {
  return z.object({ id: z.string() }).parse(req.params).id;
}
