import { gymSpec } from "@cinch/commitments";
import { amount } from "@cinch/shared";
import { applyHorizon, newId, store, type UserRecord } from "./store";

export const DEMO_EMAIL = "demo@cinch.app";
export const OWNER_DEMO_EMAIL = "alecramoski@gmail.com";
export const DEMO_CODE = "246810";
export const DEMO_NAME = "Alec";

const FRIENDS = [
  { email: "ryan.demo@cinch.app", name: "Ryan", score: 688, streak: 3 },
  { email: "maya.demo@cinch.app", name: "Maya", score: 710, streak: 4 },
  { email: "jules.demo@cinch.app", name: "Jules", score: 640, streak: 1 },
] as const;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isCodeDemoEmail(email: string): boolean {
  return normalizeEmail(email) === DEMO_EMAIL;
}

export function isSeededDemoEmail(email: string): boolean {
  const key = normalizeEmail(email);
  return key === DEMO_EMAIL || key === OWNER_DEMO_EMAIL;
}

export function isDemoEmail(email: string): boolean {
  return isCodeDemoEmail(email);
}

export function ensureDemoAccount(email: string = DEMO_EMAIL, opts?: { force?: boolean }): UserRecord {
  const alec = upsertUser(normalizeEmail(email), DEMO_NAME);
  const ryan = upsertUser(FRIENDS[0].email, FRIENDS[0].name);
  const maya = upsertUser(FRIENDS[1].email, FRIENDS[1].name);
  const jules = upsertUser(FRIENDS[2].email, FRIENDS[2].name);
  const sam = upsertUser("sam.demo@cinch.app", "Sam");
  const priya = upsertUser("priya.demo@cinch.app", "Priya");

  if (!opts?.force && worldComplete(alec.id)) {
    refreshLiveDeadlines(alec.id);
    return alec;
  }
  resetOwnerWorld(alec.id);

  store.linkFriends(alec.id, ryan.id);
  store.linkFriends(alec.id, maya.id);
  store.linkFriends(alec.id, jules.id);
  store.linkFriends(ryan.id, maya.id);
  store.linkFriends(maya.id, jules.id);
  store.linkFriends(ryan.id, jules.id);

  paintUser(alec, { score: 742, streak: 5, categories: { fitness: 720, focus: 640, social: 590 } });
  paintUser(ryan, { score: FRIENDS[0].score, streak: FRIENDS[0].streak, categories: { fitness: 680, focus: 540, social: 610 } });
  paintUser(maya, { score: FRIENDS[1].score, streak: FRIENDS[1].streak, categories: { fitness: 700, focus: 620, social: 560 } });
  paintUser(jules, { score: FRIENDS[2].score, streak: FRIENDS[2].streak, categories: { fitness: 560, focus: 670, social: 580 } });
  paintUser(sam, { score: 610, streak: 2, categories: { fitness: 580, focus: 600, social: 540 } });
  paintUser(priya, { score: 655, streak: 3, categories: { fitness: 620, focus: 640, social: 590 } });

  closeKept(alec, ryan, { title: "Gym by 6:30 AM", line: "Gym by 6:30 and stay 45 minutes", stake: 2500, hoursAgo: 14, hour: 6 });
  closeKept(alec, ryan, { title: "Gym by 6:30 AM", line: "Gym by 6:30 and stay 45 minutes", stake: 2500, hoursAgo: 38, hour: 6 });
  closeKept(alec, maya, { title: "Gym by 6:30 AM", line: "Gym by 6:30 and stay 45 minutes", stake: 2500, hoursAgo: 62, hour: 6 });
  closeKept(alec, maya, { title: "Library for two hours", line: "Deep work in Horn for two hours", stake: 2000, hoursAgo: 8, hour: 14 });
  closeKept(alec, ryan, { title: "Morning run", line: "Run before class or Ryan collects", stake: 1500, hoursAgo: 28, hour: 7 });
  closeKept(alec, jules, { title: "Phone in the drawer", line: "No Instagram after 10pm", stake: 1800, hoursAgo: 52, hour: 22 });
  closeKept(alec, maya, { title: "Show up to dinner", line: "Be at Reynolds by 7", stake: 2200, hoursAgo: 100, hour: 19 });
  closeMissed(alec, ryan, { title: "Lift after class", line: "Get to the Rec Center after 4:30", stake: 3000, hoursAgo: 44, hour: 16 });

  closeKept(ryan, alec, { title: "Track workout", line: "Ryan hits the track for 30 minutes", stake: 1800, hoursAgo: 20, hour: 8 });
  closeKept(maya, alec, { title: "Library night", line: "Maya stays in Horn for two hours", stake: 1600, hoursAgo: 33, hour: 20 });
  closeMissed(jules, alec, { title: "No phone in class", line: "Phone in the bag until noon", stake: 1200, hoursAgo: 70, hour: 11 });
  closeKept(ryan, maya, { title: "Morning run", line: "Ryan runs before 8", stake: 1500, hoursAgo: 18, hour: 7 });
  closeKept(maya, jules, { title: "Deep work block", line: "Maya shuts Instagram for two hours", stake: 1400, hoursAgo: 41, hour: 15 });
  closeKept(jules, ryan, { title: "Show up to dinner", line: "Jules is at Reynolds by 7", stake: 2000, hoursAgo: 90, hour: 19 });
  closeMissed(ryan, jules, { title: "Lift after class", line: "Ryan gets to the Rec after 4:30", stake: 1800, hoursAgo: 110, hour: 16 });
  closeKept(sam, priya, { title: "Library deep work", line: "Sam sits in Horn for ninety minutes", stake: 1400, hoursAgo: 22, hour: 13 });
  closeKept(priya, sam, { title: "Morning workout", line: "Priya is in the gym before 8", stake: 1600, hoursAgo: 46, hour: 7 });

  const gym = lockAndFund(
    specFor(alec, ryan, { title: "Gym by 8 tonight", line: "Gym tonight and stay 45 minutes or Ryan collects", stake: 2500, hoursFromNow: 8 }),
    "active",
  );
  gym.leaveByAt = new Date(Date.now() - 12 * 60_000).toISOString();
  gym.leaveFired = false;
  gym.nudgeBy[ryan.id] = "I'm watching.";
  markLocked(gym);

  markLocked(
    lockAndFund(
      specFor(alec, jules, { title: "Library deep work", line: "Two hours in Horn before tomorrow night", stake: 4000, hoursFromNow: 30 }),
      "scheduled",
    ),
  );

  markLocked(
    lockAndFund(
      specFor(maya, alec, { title: "Morning workout", line: "Maya hits the gym before 8 or Alec collects", stake: 2000, hoursFromNow: 18 }),
      "active",
    ),
  );

  markLocked(
    lockAndFund(
      specFor(ryan, alec, { title: "Afternoon lift", line: "Ryan lifts after class or Alec collects", stake: 1800, hoursFromNow: 22 }),
      "active",
    ),
  );

  const incoming = newId();
  store.challenges.set(incoming, {
    id: incoming,
    fromUserId: jules.id,
    toUserId: alec.id,
    utterance: "No phone in bed tonight or I collect $20",
    state: "pending",
    createdAt: new Date().toISOString(),
  });
  const outgoing = newId();
  store.challenges.set(outgoing, {
    id: outgoing,
    fromUserId: alec.id,
    toUserId: sam.id,
    utterance: "Library tomorrow at 7 or I collect $15",
    state: "pending",
    createdAt: new Date().toISOString(),
  });

  const moods = ["locked-in", "locked-in", "steady", "locked-in", "struggling", "locked-in", "steady"] as const;
  for (let i = 0; i < moods.length; i += 1) {
    store.checkins.push({
      id: newId(),
      userId: alec.id,
      localDate: nyDate(i),
      timezone: "America/New_York",
      mood: moods[i]!,
      note: i === 0 ? "Tonight's the gym one." : i === 4 ? "Missed the lift. Still here." : null,
      at: new Date(Date.now() - i * 86400_000).toISOString(),
    });
  }

  const gid = newId();
  store.groups.set(gid, {
    id: gid,
    name: "Babson mornings",
    memberIds: [alec.id, ryan.id, maya.id, jules.id],
    charityId: "food",
    targets: {
      [alec.id]: "Gym before class, five days.",
      [ryan.id]: "Run the loop twice.",
      [maya.id]: "Horn for ninety minutes.",
      [jules.id]: "Phone in the bag until noon.",
    },
  });

  store.openQuestion.votes = { kept: 6, voided: 1, broke: 3 };
  store.openQuestion.voted.add(alec.id);
  store.openQuestion.voted.add(ryan.id);
  store.openQuestion.voted.add(maya.id);

  for (const item of store.feed) {
    if (item.actorId === alec.id) item.kudos = [ryan.id, maya.id];
    if (item.actorId === ryan.id || item.actorId === maya.id) item.kudos = [alec.id];
  }

  paintUser(alec, { score: 742, streak: 5, categories: { fitness: 720, focus: 640, social: 590 } });
  paintUser(ryan, { score: 688, streak: 3, categories: { fitness: 680, focus: 540, social: 610 } });
  paintUser(maya, { score: 710, streak: 4, categories: { fitness: 700, focus: 620, social: 560 } });
  paintUser(jules, { score: FRIENDS[2].score, streak: FRIENDS[2].streak, categories: { fitness: 560, focus: 670, social: 580 } });
  paintUser(sam, { score: 610, streak: 2, categories: { fitness: 580, focus: 600, social: 540 } });
  paintUser(priya, { score: 655, streak: 3, categories: { fitness: 620, focus: 640, social: 590 } });
  for (const person of [alec, ryan, maya, jules, sam, priya]) {
    const reserved = [...store.commitments.values()]
      .filter((c) => c.spec.committer_id === person.id && !["resolved", "cancelled"].includes(c.state))
      .reduce((sum, c) => sum + c.spec.stake.amount.minor, 0);
    store.wallets.set(person.id, {
      available: amount("POINTS", person.id === alec.id ? 18600 : 12000),
      reserved: amount("POINTS", reserved),
    });
  }

  store.audit.push({ type: "demo-seed", userId: alec.id, email: alec.email, at: new Date().toISOString() });
  return alec;
}

function upsertUser(email: string, displayName: string): UserRecord {
  const key = email.trim().toLowerCase();
  const existing = [...store.users.values()].find((u) => u.email.toLowerCase() === key);
  if (existing) {
    existing.displayName = displayName;
    existing.email = key;
    return existing;
  }
  return store.newUser(key, displayName);
}

function paintUser(
  user: UserRecord,
  input: { score: number; streak: number; categories: UserRecord["categories"] },
) {
  user.score = input.score;
  user.streak = input.streak;
  user.categories = { ...input.categories };
  user.voidsLeft = 1;
  user.freezesLeft = 2;
}

const NPC_EMAILS = new Set([
  "ryan.demo@cinch.app",
  "maya.demo@cinch.app",
  "jules.demo@cinch.app",
  "sam.demo@cinch.app",
  "priya.demo@cinch.app",
]);

function worldComplete(userId: string): boolean {
  const mine = [...store.commitments.values()].filter((c) => c.spec.committer_id === userId);
  const keptGym = mine.filter((c) => c.outcome === "success" && c.spec.title === "Gym by 6:30 AM").length;
  const live = mine.filter((c) => !["resolved", "cancelled"].includes(c.state)).length;
  const watching = [...store.commitments.values()].some(
    (c) => !["resolved", "cancelled"].includes(c.state) && c.spec.partners.some((p) => p.resolved_user_id === userId),
  );
  const witnessed = [...store.commitments.values()].some(
    (c) => Boolean(c.outcome) && c.spec.partners.some((p) => p.resolved_user_id === userId),
  );
  const grouped = [...store.groups.values()].some((g) => g.memberIds.includes(userId));
  const challenged = [...store.challenges.values()].some((c) => c.toUserId === userId || c.fromUserId === userId);
  const checkedIn = store.checkins.some((c) => c.userId === userId);
  return (
    keptGym >= 3 &&
    live >= 2 &&
    watching &&
    witnessed &&
    grouped &&
    challenged &&
    checkedIn &&
    (store.friends.get(userId)?.size ?? 0) >= 3
  );
}

function resetOwnerWorld(userId: string) {
  const npcIds = new Set(
    [...store.users.values()].filter((u) => NPC_EMAILS.has(u.email.toLowerCase())).map((u) => u.id),
  );
  npcIds.add(userId);
  for (const [id, row] of [...store.commitments.entries()]) {
    const involved =
      npcIds.has(row.spec.committer_id) || row.spec.partners.some((p) => p.resolved_user_id && npcIds.has(p.resolved_user_id));
    if (!involved) continue;
    store.commitments.delete(id);
    store.evidence.delete(id);
  }
  for (const [id, row] of [...store.challenges.entries()]) {
    if (npcIds.has(row.fromUserId) || npcIds.has(row.toUserId)) store.challenges.delete(id);
  }
  for (const [id, row] of [...store.groups.entries()]) {
    if (row.memberIds.includes(userId)) store.groups.delete(id);
  }
  const keepCheckins = store.checkins.filter((row) => row.userId !== userId);
  store.checkins.length = 0;
  store.checkins.push(...keepCheckins);
  const keepNotes = store.notifications.filter((row) => row.userId !== userId);
  store.notifications.length = 0;
  store.notifications.push(...keepNotes);
  const keepFeed = store.feed.filter((row) => row.actorId !== userId && !npcIds.has(String(row.actorId ?? "")));
  store.feed.length = 0;
  store.feed.push(...keepFeed);
}

function closeKept(
  committer: UserRecord,
  witness: UserRecord,
  input: { title: string; line: string; stake: number; hoursAgo: number; hour?: number },
) {
  const row = lockAndFund(specFor(committer, witness, input));
  row.createdAt = new Date(Date.now() - input.hoursAgo * 3600_000).toISOString();
  addPhoto(row.id);
  store.resolve(row.id, "success");
  return row;
}

function closeMissed(
  committer: UserRecord,
  witness: UserRecord,
  input: { title: string; line: string; stake: number; hoursAgo: number; hour?: number },
) {
  const row = lockAndFund(specFor(committer, witness, input));
  row.createdAt = new Date(Date.now() - input.hoursAgo * 3600_000).toISOString();
  store.resolve(row.id, "failure");
  return row;
}

function markLocked(row: ReturnType<typeof lockAndFund>) {
  const actor = store.users.get(row.spec.committer_id);
  store.feed.unshift({
    type: "locked",
    id: row.id,
    title: row.spec.title,
    actor: actor?.displayName,
    actorId: actor?.id,
    hideStake: true,
    at: new Date().toISOString(),
    kudos: [],
  });
  return row;
}

function nyDate(daysAgo: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(
    new Date(Date.now() - daysAgo * 86400_000),
  );
}

function refreshLiveDeadlines(userId: string) {
  const live = [...store.commitments.values()].filter(
    (c) =>
      !["resolved", "cancelled"].includes(c.state) &&
      (c.spec.committer_id === userId || c.spec.partners.some((p) => p.resolved_user_id === userId)),
  );
  live.forEach((row, i) => {
    const hours = 8 + i * 12;
    const deadline = new Date(Date.now() + hours * 3600_000);
    row.spec.schedule.deadline_at = deadline.toISOString();
    row.spec.schedule.start_at = new Date(deadline.getTime() - 6 * 3600_000).toISOString();
    row.leaveFired = false;
    if (i === 0) row.leaveByAt = new Date(Date.now() - 12 * 60_000).toISOString();
  });
}

function specFor(
  committer: UserRecord,
  witness: UserRecord,
  input: { title: string; line: string; stake: number; hoursAgo?: number; hoursFromNow?: number; hour?: number },
) {
  const end = input.hoursFromNow
    ? new Date(Date.now() + input.hoursFromNow * 3600_000)
    : new Date(Date.now() - (input.hoursAgo ?? 24) * 3600_000);
  if (typeof input.hour === "number") end.setUTCHours(input.hour, 0, 0, 0);
  const start = new Date(end.getTime() - 6 * 3600_000);
  return gymSpec({
    title: input.title,
    natural_language: `${input.line} or I owe ${witness.displayName} $${input.stake / 100}.`,
    committer_id: committer.id,
    partners: [
      {
        ref: witness.displayName,
        resolved_user_id: witness.id,
        contact_hint: { name: witness.displayName, email: witness.email },
        role: "witness",
        must_accept: true,
      },
    ],
    schedule: {
      timezone: "America/New_York",
      start_at: start.toISOString(),
      deadline_at: end.toISOString(),
      recurrence: null,
      occurrences: null,
      grace_period_seconds: 0,
    },
    stake: {
      kind: "points",
      amount: { currency: "POINTS", minor: input.stake },
      on_failure: { destination: "partner", destination_id: witness.id },
      on_success: { action: "release_to_committer" },
    },
  });
}

function lockAndFund(spec: ReturnType<typeof gymSpec>, state: "scheduled" | "active" = "active") {
  const row = store.putCommitment({ spec });
  store.transition(row.id, "pending_acceptance");
  store.transition(row.id, "funding");
  const wallet = store.wallet(spec.committer_id);
  const stake = spec.stake.amount.minor;
  if (wallet.available.minor < stake) {
    wallet.available = amount("POINTS", wallet.available.minor + stake + 20_000);
  }
  wallet.available = amount("POINTS", wallet.available.minor - stake);
  wallet.reserved = amount("POINTS", wallet.reserved.minor + stake);
  row.reservationId = `pts:${row.id}:${spec.committer_id}`;
  store.transition(row.id, "scheduled");
  if (state === "active") store.transition(row.id, "active");
  applyHorizon(row);
  return row;
}

function addPhoto(commitmentId: string) {
  const list = store.evidence.get(commitmentId) ?? [];
  list.push({
    id: newId(),
    commitmentId,
    kind: "photo",
    payload: { source: "demo" },
    at: new Date().toISOString(),
  });
  store.evidence.set(commitmentId, list);
}
