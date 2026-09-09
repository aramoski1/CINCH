import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { amount, badRequest, notFound, safetyBlocked } from "@cinch/shared";
import {
  canOfferStreakInsurance,
  commitmentSpecSchema,
  firstFailure,
  nextLadderRung,
  renderCommitment,
  renderRule,
  validateSpec,
} from "@cinch/commitments";
import { classifySafety, parseUtterance } from "@cinch/ai";
import { BABSON_PLACES, createMemoryQueue, createPointsStakeProvider } from "@cinch/adapters";
import { applyHorizon, applyInsurance, newId, store } from "../store";
import { assertProofPasses, parseImageDataUrl, reviewCommitmentPhoto } from "../review-proof";
import { requireUser } from "./auth";
import { applyStakeMode, assertCanFund } from "./product";
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
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York",
        committerId: user.id,
        places: BABSON_PLACES,
      },
      undefined,
      1,
    );
    if (!parsed.ok) {
      return {
        blocked: parsed.blocked,
        message: parsed.message,
        resources: "resources" in parsed ? parsed.resources : [],
      };
    }
    return {
      spec: parsed.spec,
      rendered: renderCommitment(
        parsed.spec.title,
        parsed.spec.conditions,
        `${parsed.spec.stake.amount.minor.toLocaleString()} pts on the line`,
      ),
      assumptions: parsed.assumptions,
      chips: parsed.chips,
      ready: true,
      verificationPlan: parsed.spec.verification.sources.join(" · "),
      leaveByMinutes: 12,
      insuranceOffered: canOfferStreakInsurance(
        user.lastFailedAt ? new Date(user.lastFailedAt) : undefined,
        new Date(),
      ),
    };
  });

  app.post("/v1/commitments/lock", async (req) => {
    const user = requireUser(req.headers.authorization);
    const body = z
      .object({
        utterance: z.string().min(4),
        friend: z.string().min(1),
        friendId: z.string().uuid().optional(),
        stake: z.number().int().positive().default(25),
        deadlineAt: z.string().optional(),
      })
      .parse(req.body);
    const safety = classifySafety(body.utterance);
    if (safety.blocked) throw safetyBlocked(safety.message, { resources: safety.resources });
    const parsed = await parseUtterance(
      body.utterance,
      {
        now: new Date(),
        timezone: "America/New_York",
        committerId: user.id,
        places: BABSON_PLACES,
        partnerHint: { id: newId(), name: body.friend.trim() },
      },
      undefined,
      1,
    );
    if (!parsed.ok) {
      if (parsed.blocked) throw safetyBlocked(parsed.message, { resources: parsed.resources });
      throw badRequest(parsed.message);
    }
    const named = body.friend.trim();
    const byId = body.friendId ? store.users.get(body.friendId) : undefined;
    const byName = [...store.users.values()].find(
      (u) => u.id !== user.id && u.displayName.toLowerCase() === named.toLowerCase(),
    );
    const partnerUser = byId && byId.id !== user.id ? byId : byName;
    if (partnerUser) store.linkFriends(user.id, partnerUser.id);
    const partnerId = partnerUser?.id ?? newId();
    const stakeMinor = body.stake < 500 ? body.stake * 100 : body.stake;
    parsed.spec.partners = [
      {
        ref: partnerUser?.displayName ?? named,
        resolved_user_id: partnerId,
        contact_hint: { name: partnerUser?.displayName ?? named, email: partnerUser?.email },
        role: "witness",
        must_accept: true,
      },
    ];
    parsed.spec.stake.amount = { currency: "POINTS", minor: stakeMinor };
    parsed.spec.stake.on_failure = { destination: "partner", destination_id: partnerId };
    parsed.spec.verification = {
      ...parsed.spec.verification,
      sources: ["photo", "partner_attest"],
      fallback: "auto_fail",
      evidence_window_seconds: 60,
    };
    parsed.spec.committer_id = user.id;
    parsed.spec.reminders = [];
    if (body.deadlineAt) {
      const deadline = new Date(body.deadlineAt);
      if (Number.isNaN(deadline.getTime()) || deadline.getTime() <= Date.now() + 60_000) {
        throw badRequest("Deadline must be at least 60 seconds from now.");
      }
      parsed.spec.schedule.deadline_at = deadline.toISOString();
      const existingStart = parsed.spec.schedule.start_at
        ? new Date(parsed.spec.schedule.start_at)
        : new Date(deadline.getTime() - 3600_000);
      parsed.spec.schedule.start_at =
        Number.isNaN(existingStart.getTime()) || existingStart >= deadline
          ? new Date(deadline.getTime() - 3600_000).toISOString()
          : existingStart.toISOString();
    }
    applyStakeMode(parsed.spec);
    const failure = firstFailure(
      validateSpec(parsed.spec, {
        now: new Date(),
        minStakeMinor: env.MIN_STAKE_MINOR,
        maxStakeMinor: env.MAX_STAKE_MINOR,
        committerId: user.id,
        connectedSources: parsed.spec.verification.sources,
        adultPartnerIds: new Set([partnerId]),
      }),
    );
    if (failure && !failure.ok) throw badRequest(failure.message, { code: failure.code });
    const row = store.putCommitment({ spec: parsed.spec });
    store.transition(row.id, "pending_acceptance");
    store.transition(row.id, "funding");
    assertCanFund(user, stakeMinor, env);
    const { reservationId } = await stakes.reserve({
      commitmentId: row.id,
      userId: user.id,
      amount: amount("POINTS", stakeMinor),
    });
    row.reservationId = reservationId;
    applyHorizon(row);
    user.dayStakeMinor += stakeMinor;
    user.weekStakeMinor += stakeMinor;
    store.transition(row.id, "scheduled");
    store.feed.unshift({
      type: "locked",
      id: row.id,
      title: row.spec.title,
      actor: user.displayName,
      actorId: user.id,
      hideStake: false,
      at: new Date().toISOString(),
      kudos: [],
    });
    return {
      id: row.id,
      inviteCode: row.inviteCode,
      shareUrl: `${env.WEB_BASE_URL}/i/${row.inviteCode}`,
      title: row.spec.title,
      deadlineAt: row.spec.schedule.deadline_at,
      friend: partnerUser?.displayName ?? named,
      stake: stakeMinor,
    };
  });

  app.post("/v1/commitments", async (req) => {
    const user = requireUser(req.headers.authorization);
    const body = req.body as Record<string, unknown>;
    const utterance = typeof body.natural_language === "string" ? body.natural_language : "";
    const safety = classifySafety(utterance);
    if (safety.blocked) throw safetyBlocked(safety.message, { resources: safety.resources });
    const spec = commitmentSpecSchema.parse({
      ...body,
      committer_id: user.id,
      reminders: [],
    });
    applyStakeMode(spec);
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
    const row = store.putCommitment({ spec });
    return { id: row.id, state: "draft", inviteCode: row.inviteCode, rendered: renderRule(spec.conditions) };
  });

  app.get("/v1/commitments/active", async (req) => {
    const user = requireUser(req.headers.authorization);
    store.expiredAuth();
    store.failOverdueWithoutPhoto();
    return [...store.commitments.values()]
      .filter((c) => c.spec.committer_id === user.id && !["resolved", "cancelled"].includes(c.state))
      .map((c) => ({ ...c, hasPhoto: store.hasPhoto(c.id), photoRequired: true }));
  });

  app.get("/v1/commitments/history", async (req) => {
    const user = requireUser(req.headers.authorization);
    return [...store.commitments.values()].filter((c) => c.spec.committer_id === user.id);
  });

  app.get("/v1/commitments/:id", async (req) => {
    requireUser(req.headers.authorization);
    const { id } = req.params as { id: string };
    const row = store.commitments.get(id);
    if (!row) throw notFound();
    if (row.state === "scheduled" && Date.now() >= Date.parse(row.spec.schedule.start_at ?? row.createdAt)) {
      store.transition(id, "active");
    }
    return { ...row, evidence: store.evidence.get(id) ?? [] };
  });

  app.post("/v1/commitments/:id/invite", async (req) => {
    requireUser(req.headers.authorization);
    const { id } = req.params as { id: string };
    const row = store.transition(id, "pending_acceptance");
    await queue.schedule("invite.expire", { id }, new Date(Date.now() + 12 * 3600_000), {
      key: `invite-expire:${id}`,
    });
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
    if (row.spec.committer_id !== user.id) throw badRequest("Only the person who said it can lock it.");
    if (row.spec.meta.streakInsurance && !canOfferStreakInsurance(user.lastFailedAt ? new Date(user.lastFailedAt) : undefined, new Date())) {
      row.spec.meta.streakInsurance = false;
    }
    const spec = applyInsurance(row.spec);
    if (spec.meta.standing && spec.meta.escalationLadder?.length) {
      const rung = nextLadderRung(spec.meta.escalationLadder, user.streak);
      if (rung && canOfferStreakInsurance(user.lastFailedAt ? new Date(user.lastFailedAt) : undefined, new Date())) {
        spec.stake.amount = { currency: "POINTS", minor: rung };
      }
    }
    row.spec = spec;
    assertCanFund(user, spec.stake.amount.minor, env);
    if (row.state === "draft" || row.state === "pending_acceptance") {
      store.transition(row.id, "funding");
    }
    const { reservationId } = await stakes.reserve({
      commitmentId: row.id,
      userId: user.id,
      amount:
        spec.stake.amount.currency === "POINTS"
          ? spec.stake.amount
          : amount("POINTS", spec.stake.amount.minor),
    });
    row.reservationId = reservationId;
    applyHorizon(row);
    user.dayStakeMinor += spec.stake.amount.minor;
    user.weekStakeMinor += spec.stake.amount.minor;
    store.transition(row.id, "scheduled");
    store.feed.unshift({
      type: "locked",
      id: row.id,
      title: row.spec.title,
      actor: user.displayName,
      actorId: user.id,
      hideStake: Boolean(row.spec.meta.blind),
      category: row.spec.title,
      at: new Date().toISOString(),
      kudos: [],
    });
    await queue.schedule("commitment.start", { id: row.id }, new Date(row.spec.schedule.start_at ?? Date.now()));
    await queue.schedule("commitment.deadline", { id: row.id }, new Date(row.spec.schedule.deadline_at));
    if (row.leaveByAt) {
      await queue.schedule("leave_by_now", { id: row.id }, new Date(row.leaveByAt), {
        key: `leave:${row.id}`,
      });
    }
    return { state: "scheduled", reservationId, reservationExpiresAt: row.reservationExpiresAt ?? null };
  });

  app.post("/v1/commitments/:id/cancel", async (req) => {
    requireUser(req.headers.authorization);
    store.transition(idParam(req), "cancelled");
    return { ok: true };
  });

  app.post("/v1/commitments/:id/void", async (req) => {
    requireUser(req.headers.authorization);
    const id = idParam(req);
    store.resolve(id, "voided");
    return { ok: true };
  });

  app.post("/v1/commitments/:id/match", async (req) => {
    const user = requireUser(req.headers.authorization);
    const source = store.commitments.get(idParam(req));
    if (!source) throw notFound();
    const spec = {
      ...source.spec,
      committer_id: user.id,
      meta: { ...source.spec.meta, proposedBy: undefined, standing: false },
    };
    const row = store.putCommitment({ spec, matchedFrom: source.id });
    return { id: row.id, spec: row.spec };
  });

  app.post("/v1/commitments/:id/checkin", async (req) => {
    const user = requireUser(req.headers.authorization);
    const id = idParam(req);
    const row = store.commitments.get(id);
    if (!row) throw notFound();
    const body = z.object({ lat: z.number(), lng: z.number() }).parse(req.body);
    const place = BABSON_PLACES.map((p) => ({
      ...p,
      d: haversine(body.lat, body.lng, p.lat, p.lng),
    })).sort((a, b) => a.d - b.d)[0];
    const inside = true;
    if (row.state === "scheduled") store.transition(id, "active");
    const list = store.evidence.get(id) ?? [];
    list.push({
      id: newId(),
      commitmentId: id,
      kind: "checkin",
      at: new Date().toISOString(),
      payload: {
        lat: body.lat,
        lng: body.lng,
        place: place?.name,
        inside,
        meters: Math.round((place?.d ?? 0) * 1000),
        userId: user.id,
      },
    });
    store.evidence.set(id, list);
    return { ok: true, inside, place: place?.name, meters: Math.round((place?.d ?? 0) * 1000) };
  });

  app.post("/v1/commitments/:id/proof", async (req) => {
    const user = requireUser(req.headers.authorization);
    const id = idParam(req);
    const row = store.commitments.get(id);
    if (!row) throw notFound();
    if (row.spec.committer_id !== user.id) throw badRequest("That's not your promise.");
    if (["resolved", "cancelled"].includes(row.state)) throw badRequest("Already settled.");
    const body = z
      .object({
        nonce: z.string().min(8),
        data: z.string().min(32).max(1_800_000),
      })
      .parse(req.body);
    if (store.usedNonces.has(body.nonce)) throw badRequest("That photo was already used.");
    parseImageDataUrl(body.data);
    const review = await reviewCommitmentPhoto(env, row.spec.title, body.data);
    assertProofPasses(review);
    store.usedNonces.add(body.nonce);
    const list = store.evidence.get(id) ?? [];
    list.push({
      id: newId(),
      commitmentId: id,
      kind: "photo",
      at: new Date().toISOString(),
      payload: { data: body.data, userId: user.id, score: review?.score, rationale: review?.rationale },
    });
    if (review) {
      list.push({
        id: newId(),
        commitmentId: id,
        kind: "ai_vision",
        at: new Date().toISOString(),
        payload: { score: review.score, rationale: review.rationale, nonce: body.nonce },
      });
    }
    store.evidence.set(id, list);
    if (row.state === "scheduled") store.transition(id, "active");
    store.resolve(id, "success");
    return { ok: true, state: "resolved", score: review?.score ?? null };
  });

  app.post("/v1/commitments/:id/kept", async (req) => {
    requireUser(req.headers.authorization);
    const id = idParam(req);
    if (!store.hasPhoto(id)) throw badRequest("Photo proof first. No picture, you lose.");
    store.resolve(id, "success");
    return { ok: true, state: "resolved" };
  });

  app.post("/v1/commitments/:id/honest-fail", async (req) => {
    requireUser(req.headers.authorization);
    store.resolve(idParam(req), "failure");
    return { ok: true, state: "resolved" };
  });

  app.post("/v1/commitments/:id/life-happens", async (req) => {
    const user = requireUser(req.headers.authorization);
    store.refreshAllowances(user);
    if (user.voidsLeft <= 0) throw badRequest("You've used this month's life-happens void.");
    user.voidsLeft -= 1;
    store.resolve(idParam(req), "voided");
    return { ok: true, voidsLeft: user.voidsLeft };
  });

  app.get("/v1/places", async (req) => {
    requireUser(req.headers.authorization);
    return BABSON_PLACES;
  });
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1) * Math.PI / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function idParam(req: { params: unknown }): string {
  return z.object({ id: z.string() }).parse(req.params).id;
}
