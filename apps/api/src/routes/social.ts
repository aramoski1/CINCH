import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { notFound } from "@cinch/shared";
import { scoreConfidence } from "@cinch/commitments";
import { coachInsight, maySuggestStakeIncrease } from "@cinch/ai";
import { newId, store } from "../store";
import { ensureDemoAccount, isSeededDemoEmail, OWNER_DEMO_EMAIL } from "../seed-demo";
import { requireUser } from "./auth";
import type { Env } from "../config/env";

export async function registerSocial(app: FastifyInstance, env: Env) {
  app.get("/v1/me", async (req) => {
    let user = requireUser(req.headers.authorization);
    if (isSeededDemoEmail(user.email)) {
      user = ensureDemoAccount(user.email);
    }
    store.refreshAllowances(user);
    store.expiredAuth();
    store.failOverdueWithoutPhoto();
    store.dueLeaveNow(user.id);
    return {
      user: {
        ...user,
        freezesLeft: user.freezesLeft,
        voidsLeft: user.voidsLeft,
        categories: user.categories,
        excludedUntil: user.excludedUntil ?? null,
        settings: user.settings ?? {
          leaveNow: true,
          haptics: true,
          shareOnLock: true,
          hideStakeOnFeed: true,
          defaultStake: 25,
        },
        kept: [...store.commitments.values()].filter((c) => c.spec.committer_id === user.id && c.outcome === "success").length,
        broken: [...store.commitments.values()].filter((c) => c.spec.committer_id === user.id && c.outcome === "failure").length,
      },
      wallet: store.wallet(user.id),
    };
  });

  app.patch("/v1/me", async (req) => {
    const user = requireUser(req.headers.authorization);
    const body = z.object({ displayName: z.string().min(1).optional(), avatarUrl: z.string().url().optional() }).parse(req.body);
    Object.assign(user, body);
    return { user };
  });

  app.patch("/v1/me/settings", async (req) => {
    const user = requireUser(req.headers.authorization);
    if (!user.settings) {
      user.settings = {
        leaveNow: true,
        haptics: true,
        shareOnLock: true,
        hideStakeOnFeed: true,
        defaultStake: 25,
      };
    }
    const body = z
      .object({
        leaveNow: z.boolean().optional(),
        haptics: z.boolean().optional(),
        shareOnLock: z.boolean().optional(),
        hideStakeOnFeed: z.boolean().optional(),
        defaultStake: z.number().int().min(5).max(500).optional(),
      })
      .parse(req.body);
    Object.assign(user.settings, body);
    return { settings: user.settings };
  });

  app.get("/v1/friends", async (req) => {
    const user = requireUser(req.headers.authorization);
    const ids = [...(store.friends.get(user.id) ?? [])];
    const fromBets = [...store.commitments.values()]
      .filter((c) => c.spec.committer_id === user.id)
      .flatMap((c) => c.spec.partners.map((p) => p.ref));
    const people = ids
      .map((id) => store.users.get(id))
      .filter((u): u is NonNullable<typeof u> => Boolean(u))
      .map((u) => ({ id: u.id, displayName: u.displayName, email: u.email }));
    const named = [...new Set(fromBets)].filter((n) => !people.some((p) => p.displayName === n));
    return {
      people,
      named,
    };
  });

  app.delete("/v1/friends/:id", async (req) => {
    const user = requireUser(req.headers.authorization);
    const { id } = req.params as { id: string };
    store.friends.get(user.id)?.delete(id);
    return { ok: true };
  });

  app.post("/v1/friends", async (req) => {
    const user = requireUser(req.headers.authorization);
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const other = [...store.users.values()].find((u) => u.email === email);
    if (!other) throw notFound("They haven't signed in yet.");
    if (other.id === user.id) throw notFound("That's you.");
    store.linkFriends(user.id, other.id);
    return {
      ok: true,
      person: { id: other.id, displayName: other.displayName, email: other.email },
    };
  });

  app.get("/v1/leaderboard", async (req) => {
    const user = requireUser(req.headers.authorization);
    store.failOverdueWithoutPhoto();
    const ids = new Set<string>([user.id, ...(store.friends.get(user.id) ?? [])]);
    const board = [...ids]
      .map((id) => {
        const person = store.users.get(id);
        if (!person) return null;
        const stats = store.userStats(id);
        return {
          id,
          displayName: person.displayName,
          you: id === user.id,
          score: stats.score,
          streak: stats.streak,
          kept: stats.kept,
          broken: stats.broken,
          rate: stats.rate,
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .sort((a, b) => b.rate - a.rate || b.streak - a.streak || b.score - a.score || b.kept - a.kept)
      .map((row, i) => ({ ...row, rank: i + 1 }));
    const you = board.find((row) => row.you);
    const rival = board.find((row) => you && row.rank === Math.max(1, (you.rank ?? 1) - 1) && !row.you) ?? null;
    return { board, rival, you: you ?? null };
  });

  app.get("/v1/watching", async (req) => {
    const user = requireUser(req.headers.authorization);
    store.failOverdueWithoutPhoto();
    return [...store.commitments.values()]
      .filter(
        (c) =>
          !["resolved", "cancelled"].includes(c.state) &&
          c.spec.partners.some((p) => p.resolved_user_id === user.id),
      )
      .map((c) => ({
        id: c.id,
        title: c.spec.title,
        deadlineAt: c.spec.schedule.deadline_at,
        stake: c.spec.stake.amount,
        inviteCode: c.inviteCode,
        committer: store.users.get(c.spec.committer_id)?.displayName ?? "A friend",
        hasPhoto: store.hasPhoto(c.id),
      }));
  });

  app.get("/v1/feed", async (req) => {
    const user = requireUser(req.headers.authorization);
    const circle = new Set<string>([user.id, ...(store.friends.get(user.id) ?? [])]);
    const names = new Set(
      [...circle].map((id) => store.users.get(id)?.displayName).filter((name): name is string => Boolean(name)),
    );
    return store.feed
      .filter((item) => {
        if (item.type === "checkin") return false;
        if (typeof item.actorId === "string") return circle.has(item.actorId);
        if (typeof item.actor === "string") return names.has(item.actor);
        return true;
      })
      .map((item) => {
        const kudos = Array.isArray(item.kudos) ? (item.kudos as string[]) : [];
        const type = String(item.type ?? "locked");
        const mine = item.actorId === user.id || item.actor === user.displayName;
        const who = mine ? "You" : String(item.actor ?? "Someone");
        return {
          id: String(item.id ?? ""),
          type,
          title:
            type === "kept"
              ? `${who} kept ${mine ? "your" : "their"} word`
              : type === "broke"
                ? `${who} missed`
                : type === "voided"
                  ? `${who} voided a pact`
                  : `${who} locked a promise`,
          detail: item.title ? String(item.title) : "A private pact moved.",
          actor: item.actor ?? null,
          at: item.at ?? new Date().toISOString(),
          accent: type === "kept" ? "ok" : type === "broke" ? "hot" : "teal",
          kudosCount: kudos.length,
          kudosActive: kudos.includes(user.id),
          mine,
        };
      });
  });

  app.post("/v1/feed/:id/react", async (req) => {
    const user = requireUser(req.headers.authorization);
    const { id } = req.params as { id: string };
    const item = store.feed.find((row) => row.id === id);
    if (!item) throw notFound();
    const kudos = Array.isArray(item.kudos) ? (item.kudos as string[]) : [];
    item.kudos = kudos.includes(user.id) ? kudos.filter((uid) => uid !== user.id) : [...kudos, user.id];
    return { ok: true, kudosCount: (item.kudos as string[]).length };
  });

  app.get("/v1/checkins", async (req) => {
    const user = requireUser(req.headers.authorization);
    return store.checkins.filter((row) => row.userId === user.id);
  });

  app.post("/v1/checkins", async (req) => {
    const user = requireUser(req.headers.authorization);
    const body = z
      .object({
        localDate: z.string().min(8),
        timezone: z.string().min(1),
        mood: z.enum(["locked-in", "steady", "struggling"]),
        note: z.string().max(240).optional().nullable(),
      })
      .parse(req.body);
    if (store.checkins.some((row) => row.userId === user.id && row.localDate === body.localDate)) {
      return store.checkins.find((row) => row.userId === user.id && row.localDate === body.localDate);
    }
    const row = {
      id: newId(),
      userId: user.id,
      localDate: body.localDate,
      timezone: body.timezone,
      mood: body.mood,
      note: body.note?.trim() || null,
      at: new Date().toISOString(),
    };
    store.checkins.unshift(row);
    return row;
  });

  app.get("/v1/people", async (req) => {
    const user = requireUser(req.headers.authorization);
    const q = String((req.query as { q?: string }).q ?? "")
      .trim()
      .toLowerCase();
    const mine = store.friends.get(user.id) ?? new Set();
    return [...store.users.values()]
      .filter((person) => person.id !== user.id)
      .filter((person) => !q || person.displayName.toLowerCase().includes(q) || person.email.toLowerCase().includes(q))
      .map((person) => ({
        id: person.id,
        displayName: person.displayName,
        email: person.email,
        relationship: mine.has(person.id) ? ("friend" as const) : ("none" as const),
        streak: person.streak,
        score: person.score,
        rate: store.userStats(person.id).rate,
      }))
      .sort((a, b) => Number(a.relationship === "friend") - Number(b.relationship === "friend") || b.rate - a.rate || b.score - a.score)
      .slice(0, 20);
  });

  app.get("/v1/people/:id", async (req) => {
    const me = requireUser(req.headers.authorization);
    const person = store.users.get((req.params as { id: string }).id);
    if (!person) throw notFound();
    const mine = [...store.commitments.values()].filter((c) => c.spec.committer_id === me.id);
    const theirs = [...store.commitments.values()].filter((c) => c.spec.committer_id === person.id);
    const shared = [...store.commitments.values()].filter(
      (c) =>
        (c.spec.committer_id === me.id && c.spec.partners.some((p) => p.resolved_user_id === person.id)) ||
        (c.spec.committer_id === person.id && c.spec.partners.some((p) => p.resolved_user_id === me.id)),
    );
    const keptTogether = shared.filter((c) => c.outcome === "success").length;
    const theirsFriends = store.friends.get(person.id) ?? new Set();
    const mineFriends = store.friends.get(me.id) ?? new Set();
    let mutual = 0;
    for (const id of mineFriends) if (theirsFriends.has(id)) mutual += 1;
    return {
      person: {
        id: person.id,
        displayName: person.displayName,
        email: person.email,
        streak: person.streak,
        score: person.score,
        relationship: mineFriends.has(person.id) ? "friend" : "none",
      },
      sharedCommitments: shared.length,
      keptTogether,
      mutualFriends: mutual,
      achievements: store.achievements(person.id).filter((a) => a.unlocked),
      theirLocks: theirs.length,
      yourLocks: mine.length,
    };
  });

  app.get("/v1/achievements", async (req) => {
    const user = requireUser(req.headers.authorization);
    return store.achievements(user.id);
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
    list.push({ id: newId(), commitmentId: id, kind: body.kind, payload: body.payload, at: new Date().toISOString() });
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
      list.push({ id: newId(), commitmentId: id, kind: "partner_attest", payload: {}, at: new Date().toISOString() });
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
    store.groups.set(id, { id, name, memberIds: [user.id], charityId: "food", targets: { [user.id]: "" } });
    return { id };
  });

  app.post("/v1/groups/:id/join", async (req) => {
    const user = requireUser(req.headers.authorization);
    const group = store.groups.get((req.params as { id: string }).id);
    if (!group) throw notFound();
    if (group.memberIds.length >= 8) return { ok: false, reason: "full" };
    if (!group.memberIds.includes(user.id)) group.memberIds.push(user.id);
    if (!group.targets[user.id]) group.targets[user.id] = "";
    return { ok: true };
  });

  app.post("/v1/groups/:id/target", async (req) => {
    const user = requireUser(req.headers.authorization);
    const group = store.groups.get((req.params as { id: string }).id);
    if (!group) throw notFound();
    const { target } = z.object({ target: z.string().min(1) }).parse(req.body);
    group.targets[user.id] = target;
    return { ok: true };
  });

  app.post("/v1/ops/seed-demo", async (req) => {
    if (req.headers["x-admin-token"] !== env.INTERNAL_ADMIN_TOKEN) return { error: "forbidden" };
    const body = z.object({ email: z.string().email().optional() }).parse(req.body ?? {});
    const user = ensureDemoAccount(body.email ?? OWNER_DEMO_EMAIL);
    return { ok: true, email: user.email, displayName: user.displayName };
  });

  app.post("/v1/ops/resolve", async (req) => {
    const token = req.headers["x-admin-token"];
    if (token !== env.INTERNAL_ADMIN_TOKEN) return { error: "forbidden" };
    const { id, outcome } = z
      .object({ id: z.string(), outcome: z.enum(["success", "failure", "voided"]) })
      .parse(req.body);
    const row = store.commitments.get(id);
    if (!row) throw notFound();
    store.resolve(id, outcome);
    return { ok: true, state: "resolved" };
  });

  app.get("/v1/ops/audit", async (req) => {
    if (req.headers["x-admin-token"] !== env.INTERNAL_ADMIN_TOKEN) return { error: "forbidden" };
    return store.audit;
  });

  app.get("/v1/coach", async (req) => {
    const user = requireUser(req.headers.authorization);
    const mine = [...store.commitments.values()].filter((c) => c.spec.committer_id === user.id);
    const withPartners = mine.filter((c) => c.spec.partners.length > 0);
    const solo = mine.filter((c) => c.spec.partners.length === 0);
    const kept = (rows: typeof mine) =>
      rows.filter((c) => c.state === "success" || (c.state === "resolved" && store.audit.some((a) => a.commitmentId === c.id && a.to === "success"))).length;
    const partnerRate = withPartners.length ? Math.round((kept(withPartners) / withPartners.length) * 100) : 91;
    const soloRate = solo.length ? Math.round((kept(solo) / Math.max(1, solo.length)) * 100) : 54;
    const insight = coachInsight({
      failedAt: user.lastFailedAt ? new Date(user.lastFailedAt) : undefined,
      now: new Date(),
      nextDeadline: mine
        .map((c) => Date.parse(c.spec.schedule.deadline_at))
        .filter((t) => t > Date.now())
        .sort((a, b) => a - b)[0]
        ? new Date(
            mine
              .map((c) => Date.parse(c.spec.schedule.deadline_at))
              .filter((t) => t > Date.now())
              .sort((a, b) => a - b)[0]!,
          )
        : undefined,
    });
    return {
      insight,
      mayRaiseStake: maySuggestStakeIncrease(
        user.lastFailedAt ? new Date(user.lastFailedAt) : undefined,
        new Date(),
      ),
      stats: [
        "Your 6am commitments succeed twice as often as your 8pms.",
        "You've never failed a Tuesday.",
        `Commitments with a partner: ${partnerRate}%. Solo: ${soloRate}%.`,
      ],
      categories: user.categories ?? { fitness: 500, focus: 500, social: 500 },
    };
  });

  app.post("/v1/streaks/freeze", async (req) => {
    const user = requireUser(req.headers.authorization);
    store.refreshAllowances(user);
    if (user.freezesLeft <= 0) return { ok: false, reason: "Two freezes a month. That's the whole valve." };
    user.freezesLeft -= 1;
    return { ok: true, freezesLeft: user.freezesLeft, streak: user.streak };
  });

  app.get("/v1/notifications", async (req) => {
    const user = requireUser(req.headers.authorization);
    const due = store.dueLeaveNow(user.id);
    return [...due, ...store.notifications.filter((n) => n.userId === user.id && n.template === "leave_by_now")];
  });

  app.get("/v1/invites/:code", async (req) => {
    const { code } = req.params as { code: string };
    const row = [...store.commitments.values()].find((c) => c.inviteCode === code);
    if (!row) throw notFound();
    const committer = store.users.get(row.spec.committer_id);
    const hidden = Boolean(row.spec.meta.blind && row.state !== "resolved");
    return {
      id: row.id,
      title: row.spec.title,
      rendered: row.spec.natural_language,
      stake: hidden ? { currency: "POINTS", minor: 0, hidden: true } : row.spec.stake.amount,
      assumptions: row.spec.meta.assumptions,
      inviteCode: code,
      state: row.state,
      deadlineAt: row.spec.schedule.deadline_at,
      outcome: row.outcome ?? null,
      nudgeUsed: Object.keys(row.nudgeBy).length > 0,
      nudges: ["I'm watching.", "Don't.", "Twenty minutes."],
      reactions: ["saw it", "knew it", "still here"],
      reacted: Object.values(row.reactions),
      committer: {
        displayName: committer?.displayName ?? "A friend",
        score: committer?.score ?? 500,
      },
      partner: row.spec.partners[0]?.ref ?? "you",
      witnesses: row.spec.partners.map((p) => p.ref),
    };
  });
}
