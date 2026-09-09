import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { badRequest, forbidden, notFound, safetyBlocked } from "@cinch/shared";
import {
  CHARITIES,
  MAX_WITNESSES,
  PROTOCOLS,
  STANDING_AFTER,
  canImpose,
  canOfferStreakInsurance,
  categoryFromTitle,
  destinationForMode,
  hourCards,
  hourHeatmap,
  isAllowedNudge,
  isAllowedReaction,
  leaveByAt,
  packetFromEvidence,
  partnerSplit,
  velocityOk,
  walkLeaves,
  witnessKeepRate,
  yearInReview,
  type CommitmentSpec,
  type PatternEvent,
} from "@cinch/commitments";
import { classifySafety, parseUtterance, phrasePattern, phraseSplit, VISION_PROMPT } from "@cinch/ai";
import { BABSON_PLACES, createAnthropicModel } from "@cinch/adapters";
import { applyHorizon, excluded, newId, store } from "../store";
import { requireUser } from "./auth";
import type { Env } from "../config/env";

export async function registerProduct(app: FastifyInstance, env: Env) {
  app.get("/v1/charities", async (req) => {
    requireUser(req.headers.authorization);
    return CHARITIES;
  });

  app.get("/v1/protocols", async (req) => {
    requireUser(req.headers.authorization);
    return PROTOCOLS;
  });

  app.post("/v1/protocols/:id/adopt", async (req) => {
    const user = requireUser(req.headers.authorization);
    const { id } = req.params as { id: string };
    const protocol = PROTOCOLS.find((p) => p.id === id);
    if (!protocol) throw notFound();
    const parsed = await parseUtterance(protocol.utterance, {
      now: new Date(),
      timezone: "America/New_York",
      committerId: user.id,
      places: BABSON_PLACES,
    });
    if (!parsed.ok) {
      if (parsed.blocked) throw safetyBlocked(parsed.message, { resources: parsed.resources });
      throw badRequest(parsed.message);
    }
    parsed.spec.meta.protocolId = protocol.id;
    const row = store.putCommitment({ spec: parsed.spec });
    return { id: row.id, spec: row.spec, utterance: protocol.utterance };
  });

  app.post("/v1/commitments/:id/travel", async (req) => {
    const user = requireUser(req.headers.authorization);
    const row = store.commitments.get(idParam(req));
    if (!row) throw notFound();
    if (row.spec.committer_id !== user.id) throw forbidden();
    const body = z.object({ lat: z.number(), lng: z.number() }).parse(req.body);
    const place = placeFromSpec(row.spec);
    if (!place) return { leaveAt: null, minutes: 12, meters: 0, alreadyLate: false };
    const out = leaveByAt({
      now: new Date(),
      deadline: new Date(row.spec.schedule.deadline_at),
      from: { lat: body.lat, lng: body.lng },
      place,
    });
    row.leaveByAt = out.leaveAt.toISOString();
    return { leaveAt: row.leaveByAt, minutes: out.minutes, meters: out.meters, alreadyLate: out.alreadyLate };
  });

  app.post("/v1/commitments/:id/rematch", async (req) => {
    const user = requireUser(req.headers.authorization);
    const source = store.commitments.get(idParam(req));
    if (!source) throw notFound();
    if (source.spec.committer_id !== user.id) throw forbidden();
    if (source.outcome !== "failure") throw badRequest("Rematch is for a torn card.");
    const failedAt = user.lastFailedAt ? new Date(user.lastFailedAt) : new Date();
    const prior = new Date(source.spec.schedule.deadline_at);
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 1);
    deadline.setHours(prior.getHours(), prior.getMinutes(), 0, 0);
    const spec = {
      ...source.spec,
      stake: {
        ...source.spec.stake,
        amount: { currency: "POINTS" as const, minor: source.originalStakeMinor },
      },
      schedule: {
        ...source.spec.schedule,
        start_at: new Date(deadline.getTime() - 3600_000).toISOString(),
        deadline_at: deadline.toISOString(),
      },
      meta: {
        ...source.spec.meta,
        streakInsurance: canOfferStreakInsurance(failedAt, new Date())
          ? source.spec.meta.streakInsurance
          : false,
        chainNextStakeMinor: undefined,
      },
    };
    const row = store.putCommitment({ spec, rematchOf: source.id });
    return { id: row.id, spec: row.spec };
  });

  app.post("/v1/commitments/:id/nudge", async (req) => {
    const user = requireUser(req.headers.authorization);
    const row = store.commitments.get(idParam(req));
    if (!row) throw notFound();
    const { text } = z.object({ text: z.string() }).parse(req.body);
    if (!isAllowedNudge(text)) throw badRequest("Pick from the three lines.");
    if (row.spec.committer_id === user.id) throw forbidden("You don't nudge yourself.");
    if (row.nudgeBy[user.id]) throw badRequest("One shot. You already sent it.");
    if (!["scheduled", "active", "pending_acceptance"].includes(row.state)) {
      throw badRequest("The window closed.");
    }
    row.nudgeBy[user.id] = text;
    return { ok: true, text };
  });

  app.post("/v1/commitments/:id/react", async (req) => {
    const user = requireUser(req.headers.authorization);
    const row = store.commitments.get(idParam(req));
    if (!row) throw notFound();
    const { text } = z.object({ text: z.string() }).parse(req.body);
    if (!isAllowedReaction(text)) throw badRequest("One tap. Three stamps.");
    if (row.spec.committer_id === user.id) throw forbidden();
    if (row.state !== "resolved") throw badRequest("Wait for the verdict.");
    row.reactions[user.id] = text;
    return { ok: true };
  });

  app.post("/v1/commitments/:id/witnesses", async (req) => {
    const user = requireUser(req.headers.authorization);
    const row = store.commitments.get(idParam(req));
    if (!row) throw notFound();
    if (row.spec.committer_id !== user.id) throw forbidden();
    if (row.witnessIds.length >= MAX_WITNESSES) throw badRequest("Three witnesses is the ceiling.");
    const { name, email } = z
      .object({ name: z.string().min(1), email: z.string().email().optional() })
      .parse(req.body);
    const other = email ? [...store.users.values()].find((u) => u.email === email) : undefined;
    row.spec.partners.push({
      ref: name,
      resolved_user_id: other?.id ?? null,
      contact_hint: { name, email },
      role: "witness",
      must_accept: true,
    });
    if (other) row.witnessIds.push(other.id);
    const extra = Math.min(15, row.witnessIds.length * 5);
    row.spec.verification.required_confidence = Math.min(95, 85 + extra);
    return { ok: true, witnesses: row.spec.partners.length, required: row.spec.verification.required_confidence };
  });

  app.post("/v1/commitments/:id/reauth", async (req) => {
    const user = requireUser(req.headers.authorization);
    const row = store.commitments.get(idParam(req));
    if (!row) throw notFound();
    if (row.spec.committer_id !== user.id) throw forbidden();
    applyHorizon(row);
    return { reservationExpiresAt: row.reservationExpiresAt ?? null };
  });

  app.post("/v1/commitments/:id/postmortem", async (req) => {
    const user = requireUser(req.headers.authorization);
    const row = store.commitments.get(idParam(req));
    if (!row) throw notFound();
    if (row.spec.committer_id !== user.id) throw forbidden();
    if (row.outcome !== "failure") throw badRequest("Only after a miss, and only if you want.");
    const { text } = z.object({ text: z.string().min(1).max(2000) }).parse(req.body);
    row.postmortem = text;
    return { ok: true };
  });

  app.get("/v1/commitments/:id/packet", async (req) => {
    requireUser(req.headers.authorization);
    const id = idParam(req);
    const row = store.commitments.get(id);
    if (!row) throw notFound();
    const rows = (store.evidence.get(id) ?? []).map((e) => ({
      id: e.id,
      kind: e.kind,
      at: e.at,
      payload: e.payload,
    }));
    return packetFromEvidence(rows);
  });

  app.get("/v1/commitments/:id/receipt", async (req) => {
    const id = idParam(req);
    const row = store.commitments.get(id);
    if (!row) throw notFound();
    const committer = store.users.get(row.spec.committer_id);
    const packet = packetFromEvidence(
      (store.evidence.get(id) ?? []).map((e) => ({
        id: e.id,
        kind: e.kind,
        at: e.at,
        payload: e.payload,
      })),
    );
    const hidden = Boolean(row.spec.meta.blind && row.state !== "resolved");
    return {
      id: row.id,
      title: row.spec.title,
      promise: row.spec.natural_language,
      verdict: row.outcome ?? row.state,
      stake: hidden ? { currency: "POINTS", minor: 0, hidden: true } : row.spec.stake.amount,
      faces: {
        front: { title: row.spec.title, who: committer?.displayName, when: row.spec.schedule.deadline_at },
        back: { verdict: row.outcome, math: packet.math, lines: packet.lines },
      },
      inviteCode: row.inviteCode,
      witnesses: row.spec.partners.map((p) => p.ref),
      reactions: Object.values(row.reactions),
    };
  });

  app.post("/v1/commitments/:id/vision", async (req) => {
    requireUser(req.headers.authorization);
    const id = idParam(req);
    const row = store.commitments.get(id);
    if (!row) throw notFound();
    const body = z
      .object({
        nonce: z.string(),
        mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]).default("image/jpeg"),
        data: z.string().optional(),
      })
      .parse(req.body);
    if (store.usedNonces.has(body.nonce)) return { ok: false, reason: "replay" };
    store.usedNonces.add(body.nonce);
    let score = 55;
    let rationale = "Nonce bound. Scene review skipped — no still attached.";
    if (body.data && env.ANTHROPIC_API_KEY.startsWith("sk-ant-api")) {
      const model = createAnthropicModel({
        apiKey: env.ANTHROPIC_API_KEY,
        model: env.ANTHROPIC_MODEL,
        maxTokens: env.ANTHROPIC_MAX_TOKENS,
      });
      const reviewed = await model.reviewImage({
        mediaType: body.mediaType,
        data: Buffer.from(body.data, "base64"),
        prompt: `${VISION_PROMPT} The commitment is: ${row.spec.title}.`,
      });
      score = reviewed.score;
      rationale = reviewed.rationale;
    }
    const list = store.evidence.get(id) ?? [];
    list.push({
      id: newId(),
      commitmentId: id,
      kind: "ai_vision",
      at: new Date().toISOString(),
      payload: { score, rationale, nonce: body.nonce },
    });
    store.evidence.set(id, list);
    return { ok: true, score, rationale };
  });

  app.post("/v1/commitments/:id/settle", async (req) => {
    requireUser(req.headers.authorization);
    const id = idParam(req);
    const row = store.commitments.get(id);
    if (!row) throw notFound();
    const packet = packetFromEvidence(
      (store.evidence.get(id) ?? []).map((e) => ({ id: e.id, kind: e.kind, at: e.at, payload: e.payload })),
    );
    store.resolve(id, packet.outcome);
    return { ok: true, outcome: packet.outcome, score: packet.score, band: packet.band, math: packet.math };
  });

  app.get("/v1/truth", async (req) => {
    const user = requireUser(req.headers.authorization);
    const events = eventsFor(user.id);
    const split = partnerSplit(events);
    const hours = hourCards(events);
    return {
      cards: hours.map((c) => ({ ...c, phrase: phrasePattern(c) })),
      split: split
        ? {
            partner: { ...split.partner, phrase: phrasePattern(split.partner) },
            solo: { ...split.solo, phrase: phrasePattern(split.solo) },
            line: phraseSplit(split.partner.rate, split.solo.rate),
          }
        : null,
      heat: hourHeatmap(events),
      witness: witnessKeepRate(
        [...store.commitments.values()]
          .filter((c) => c.spec.partners.some((p) => p.resolved_user_id === user.id) && c.outcome)
          .map((c) => ({ outcome: c.outcome! })),
      ),
      categories: user.categories,
    };
  });

  app.get("/v1/ledger", async (req) => {
    const user = requireUser(req.headers.authorization);
    return [...store.commitments.values()]
      .filter((c) => c.spec.committer_id === user.id)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .map((c) => ({
        id: c.id,
        title: c.spec.title,
        outcome: c.outcome ?? c.state,
        at: c.createdAt,
        deadline: c.spec.schedule.deadline_at,
        stake: c.spec.meta.blind && c.state !== "resolved" ? null : c.spec.stake.amount,
      }));
  });

  app.get("/v1/year", async (req) => {
    const user = requireUser(req.headers.authorization);
    return yearInReview(eventsFor(user.id), new Date().getFullYear());
  });

  app.get("/v1/collisions", async (req) => {
    const user = requireUser(req.headers.authorization);
    const mine = [...store.commitments.values()].filter(
      (c) =>
        c.spec.committer_id === user.id &&
        ["scheduled", "active"].includes(c.state) &&
        user.streak > 0,
    );
    const friendIds = store.friends.get(user.id) ?? new Set();
    const hits: Array<{ title: string; them: string; category: string }> = [];
    for (const row of store.commitments.values()) {
      if (!friendIds.has(row.spec.committer_id)) continue;
      if (!["scheduled", "active"].includes(row.state)) continue;
      const cat = categoryFromTitle(row.spec.title);
      if (!mine.some((m) => categoryFromTitle(m.spec.title) === cat)) continue;
      const them = store.users.get(row.spec.committer_id);
      hits.push({ title: row.spec.title, them: them?.displayName ?? "A friend", category: cat });
    }
    return hits;
  });

  app.get("/v1/standing", async (req) => {
    const user = requireUser(req.headers.authorization);
    return standingOffer(user.id);
  });

  app.post("/v1/standing", async (req) => {
    const user = requireUser(req.headers.authorization);
    const offer = standingOffer(user.id);
    if (!offer) throw badRequest("Three completions first. Then it can run itself.");
    const source = store.commitments.get(offer.id);
    if (!source) throw notFound();
    const prior = new Date(source.spec.schedule.deadline_at);
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 1);
    deadline.setHours(prior.getHours(), prior.getMinutes(), 0, 0);
    const spec = {
      ...source.spec,
      schedule: {
        ...source.spec.schedule,
        recurrence: source.spec.schedule.recurrence ?? "FREQ=DAILY",
        start_at: new Date(deadline.getTime() - 3600_000).toISOString(),
        deadline_at: deadline.toISOString(),
      },
      meta: { ...source.spec.meta, standing: true },
    };
    const row = store.putCommitment({ spec });
    return { id: row.id };
  });

  app.post("/v1/challenges", async (req) => {
    const user = requireUser(req.headers.authorization);
    const { email, utterance } = z
      .object({ email: z.string().email(), utterance: z.string().min(8) })
      .parse(req.body);
    const safety = classifySafety(utterance);
    if (safety.blocked) throw safetyBlocked(safety.message, { resources: safety.resources });
    const other = [...store.users.values()].find((u) => u.email === email);
    if (!other) throw notFound("They haven't signed in yet.");
    if (other.id === user.id) throw badRequest("That's just a commitment.");
    const id = newId();
    store.challenges.set(id, {
      id,
      fromUserId: user.id,
      toUserId: other.id,
      utterance,
      state: "pending",
      createdAt: new Date().toISOString(),
    });
    return { id, state: "pending" };
  });

  app.get("/v1/challenges", async (req) => {
    const user = requireUser(req.headers.authorization);
    return [...store.challenges.values()]
      .filter((c) => c.toUserId === user.id || c.fromUserId === user.id)
      .map((c) => ({
        ...c,
        from: store.users.get(c.fromUserId)?.displayName,
        to: store.users.get(c.toUserId)?.displayName,
      }));
  });

  app.post("/v1/challenges/:id/accept", async (req) => {
    const user = requireUser(req.headers.authorization);
    const challenge = store.challenges.get((req.params as { id: string }).id);
    if (!challenge) throw notFound();
    if (challenge.toUserId !== user.id) throw forbidden();
    if (!canImpose(challenge.fromUserId, user.id, true)) throw forbidden();
    challenge.state = "accepted";
    const parsed = await parseUtterance(challenge.utterance, {
      now: new Date(),
      timezone: "America/New_York",
      committerId: user.id,
      places: BABSON_PLACES,
    });
    if (!parsed.ok) throw badRequest("Couldn't lock that shape.");
    parsed.spec.meta.proposedBy = challenge.fromUserId;
    const row = store.putCommitment({ spec: parsed.spec });
    return { id: row.id, spec: row.spec };
  });

  app.post("/v1/challenges/:id/decline", async (req) => {
    const user = requireUser(req.headers.authorization);
    const challenge = store.challenges.get((req.params as { id: string }).id);
    if (!challenge) throw notFound();
    if (challenge.toUserId !== user.id) throw forbidden();
    challenge.state = "declined";
    return { ok: true };
  });

  app.get("/v1/open-question", async (req) => {
    const user = requireUser(req.headers.authorization);
    const q = store.openQuestion;
    return { id: q.id, title: q.title, body: q.body, votes: q.votes, voted: q.voted.has(user.id) };
  });

  app.post("/v1/open-question/vote", async (req) => {
    const user = requireUser(req.headers.authorization);
    const { choice } = z.object({ choice: z.enum(["kept", "voided", "broke"]) }).parse(req.body);
    if (store.openQuestion.voted.has(user.id)) return { ok: true, votes: store.openQuestion.votes };
    store.openQuestion.voted.add(user.id);
    store.openQuestion.votes[choice] += 1;
    return { ok: true, votes: store.openQuestion.votes };
  });

  app.post("/v1/me/exclude", async (req) => {
    const user = requireUser(req.headers.authorization);
    const { days } = z.object({ days: z.number().int().min(1).max(365) }).parse(req.body);
    user.excludedUntil = new Date(Date.now() + days * 86400_000).toISOString();
    return { excludedUntil: user.excludedUntil };
  });

  app.get("/v1/me/witness", async (req) => {
    const user = requireUser(req.headers.authorization);
    return witnessKeepRate(
      [...store.commitments.values()]
        .filter((c) => c.spec.partners.some((p) => p.resolved_user_id === user.id) && c.outcome)
        .map((c) => ({ outcome: c.outcome! })),
    );
  });
}

export function assertCanFund(
  user: ReturnType<typeof requireUser>,
  specMinor: number,
  env: Env,
): void {
  store.refreshAllowances(user);
  if (excluded(user)) throw forbidden("Self-exclusion is on. Every stake path is closed.");
  if (
    !velocityOk({
      stakeMinor: specMinor,
      dayMinor: user.dayStakeMinor,
      weekMinor: user.weekStakeMinor,
      maxStakeMinor: env.MAX_STAKE_MINOR,
      maxWeeklyMinor: env.MAX_WEEKLY_STAKE_MINOR,
      maxDailyMinor: env.MAX_STAKE_MINOR,
    })
  ) {
    throw badRequest("That's past the ceiling.");
  }
}

export function applyStakeMode(spec: CommitmentSpec): void {
  if (spec.meta.stakeMode) {
    spec.stake.on_failure.destination = destinationForMode(spec.meta.stakeMode);
  }
  if (spec.stake.on_failure.destination === "platform") {
    spec.stake.on_failure.destination = "charity";
  }
}

function standingOffer(userId: string): { id: string; title: string; count: number } | null {
  const kept = [...store.commitments.values()].filter(
    (c) => c.spec.committer_id === userId && c.outcome === "success",
  );
  const counts = new Map<string, { n: number; id: string }>();
  for (const c of kept) {
    const cur = counts.get(c.spec.title) ?? { n: 0, id: c.id };
    cur.n += 1;
    cur.id = c.id;
    counts.set(c.spec.title, cur);
  }
  for (const [title, v] of counts) {
    if (v.n >= STANDING_AFTER) return { id: v.id, title, count: v.n };
  }
  return null;
}

function eventsFor(userId: string): PatternEvent[] {
  return [...store.commitments.values()]
    .filter((c) => c.spec.committer_id === userId && c.outcome)
    .map((c) => ({
      at: c.createdAt,
      outcome: c.outcome!,
      hour: new Date(c.spec.schedule.deadline_at).getHours(),
      withPartner: c.spec.partners.length > 0,
      category: categoryFromTitle(c.spec.title),
      title: c.spec.title,
    }));
}

function placeFromSpec(spec: CommitmentSpec) {
  const name = walkLeaves(spec.conditions).find((l) => typeof l.params.place === "string")?.params.place;
  if (typeof name === "string") {
    return BABSON_PLACES.find((p) => p.name === name) ?? BABSON_PLACES[0];
  }
  return BABSON_PLACES[0];
}

function idParam(req: { params: unknown }): string {
  return z.object({ id: z.string() }).parse(req.params).id;
}
