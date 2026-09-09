import { gymSpec } from "@cinch/commitments";
import { amount } from "@cinch/shared";
import { applyHorizon, newId, store, type UserRecord } from "./store";

export const DEMO_EMAIL = "demo@cinch.app";
export const DEMO_CODE = "246810";
export const DEMO_NAME = "Alec";

const FRIENDS = [
  { email: "ryan.demo@cinch.app", name: "Ryan", score: 688, streak: 3 },
  { email: "maya.demo@cinch.app", name: "Maya", score: 710, streak: 4 },
  { email: "jules.demo@cinch.app", name: "Jules", score: 640, streak: 1 },
] as const;

export function isDemoEmail(email: string): boolean {
  return email.trim().toLowerCase() === DEMO_EMAIL;
}

export function ensureDemoAccount(): UserRecord {
  const alec = upsertUser(DEMO_EMAIL, DEMO_NAME);
  const ryan = upsertUser(FRIENDS[0].email, FRIENDS[0].name);
  const maya = upsertUser(FRIENDS[1].email, FRIENDS[1].name);
  const jules = upsertUser(FRIENDS[2].email, FRIENDS[2].name);

  store.linkFriends(alec.id, ryan.id);
  store.linkFriends(alec.id, maya.id);
  store.linkFriends(alec.id, jules.id);
  store.linkFriends(ryan.id, maya.id);

  if (demoAlreadyPopulated(alec.id)) {
    refreshLiveDeadlines(alec.id);
    return alec;
  }

  paintUser(alec, { score: 742, streak: 5, categories: { fitness: 720, focus: 640, social: 590 } });
  paintUser(ryan, { score: FRIENDS[0].score, streak: FRIENDS[0].streak, categories: { fitness: 680, focus: 540, social: 610 } });
  paintUser(maya, { score: FRIENDS[1].score, streak: FRIENDS[1].streak, categories: { fitness: 700, focus: 620, social: 560 } });
  paintUser(jules, { score: FRIENDS[2].score, streak: FRIENDS[2].streak, categories: { fitness: 560, focus: 670, social: 580 } });

  const kept = [
    lockAndFund(specFor(alec, ryan, { title: "Gym by 6:30 AM", line: "Gym by 6:30 and stay 45 minutes", stake: 2500, hoursAgo: 26 })),
    lockAndFund(specFor(alec, maya, { title: "Library for two hours", line: "Deep work in Horn for two hours", stake: 2000, hoursAgo: 50 })),
    lockAndFund(specFor(alec, ryan, { title: "Morning run", line: "Run before class or Ryan collects", stake: 1500, hoursAgo: 74 })),
    lockAndFund(specFor(alec, jules, { title: "Phone in the drawer", line: "No Instagram after 10pm", stake: 1800, hoursAgo: 98 })),
    lockAndFund(specFor(alec, maya, { title: "Show up to dinner", line: "Be at Reynolds by 7", stake: 2200, hoursAgo: 146 })),
  ];
  for (const row of kept) {
    addPhoto(row.id);
    store.resolve(row.id, "success");
  }

  const missed = lockAndFund(
    specFor(alec, ryan, { title: "Lift after class", line: "Get to the Rec Center after 4:30", stake: 3000, hoursAgo: 170 }),
  );
  store.resolve(missed.id, "failure");

  const gym = lockAndFund(
    specFor(alec, ryan, { title: "Gym by 8 tonight", line: "Gym tonight and stay 45 minutes or Ryan collects", stake: 2500, hoursFromNow: 8 }),
    "active",
  );
  gym.leaveByAt = new Date(Date.now() - 12 * 60_000).toISOString();
  gym.leaveFired = false;

  lockAndFund(
    specFor(alec, jules, { title: "Library deep work", line: "Two hours in Horn before tomorrow night", stake: 4000, hoursFromNow: 30 }),
    "scheduled",
  );

  lockAndFund(
    specFor(maya, alec, { title: "Morning workout", line: "Maya hits the gym before 8 or Alec collects", stake: 2000, hoursFromNow: 18 }),
    "active",
  );

  const cid = newId();
  store.challenges.set(cid, {
    id: cid,
    fromUserId: jules.id,
    toUserId: alec.id,
    utterance: "No phone in bed tonight or I collect 20 points",
    state: "pending",
    createdAt: new Date().toISOString(),
  });

  const today = new Date();
  const moods = ["locked-in", "locked-in", "steady", "locked-in", "struggling"] as const;
  for (let i = 0; i < moods.length; i += 1) {
    const day = new Date(today);
    day.setDate(today.getDate() - i);
    store.checkins.push({
      id: newId(),
      userId: alec.id,
      localDate: day.toISOString().slice(0, 10),
      timezone: "America/New_York",
      mood: moods[i]!,
      note: i === 0 ? "Tonight's the gym one." : null,
      at: day.toISOString(),
    });
  }

  store.openQuestion.votes = { kept: 4, voided: 1, broke: 2 };
  store.openQuestion.voted.add(alec.id);

  paintUser(alec, { score: 742, streak: 5, categories: { fitness: 720, focus: 640, social: 590 } });
  const reserved = [...store.commitments.values()]
    .filter((c) => c.spec.committer_id === alec.id && !["resolved", "cancelled"].includes(c.state))
    .reduce((sum, c) => sum + c.spec.stake.amount.minor, 0);
  store.wallets.set(alec.id, {
    available: amount("POINTS", 18600),
    reserved: amount("POINTS", reserved),
  });

  store.audit.push({ type: "demo-seed", userId: alec.id, at: new Date().toISOString() });
  return alec;
}

function upsertUser(email: string, displayName: string): UserRecord {
  const existing = [...store.users.values()].find((u) => u.email === email);
  if (existing) {
    existing.displayName = displayName;
    return existing;
  }
  return store.newUser(email, displayName);
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

function demoAlreadyPopulated(userId: string): boolean {
  return [...store.commitments.values()].some(
    (c) => c.spec.committer_id === userId || c.spec.partners.some((p) => p.resolved_user_id === userId),
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
  input: { title: string; line: string; stake: number; hoursAgo?: number; hoursFromNow?: number },
) {
  const end = input.hoursFromNow
    ? new Date(Date.now() + input.hoursFromNow * 3600_000)
    : new Date(Date.now() - (input.hoursAgo ?? 24) * 3600_000);
  const start = new Date(end.getTime() - 6 * 3600_000);
  return gymSpec({
    title: input.title,
    natural_language: `${input.line} or I owe ${witness.displayName} ${input.stake / 100} points.`,
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
