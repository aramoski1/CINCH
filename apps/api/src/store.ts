import { amount, type Amount } from "@cinch/shared";
import {
  AUTH_HORIZON_MS,
  assertTransition,
  categoryFromTitle,
  type CommitmentSpec,
  type CommitmentState,
  FREEZES_PER_MONTH,
  insuredStakeMinor,
  isSelfExcluded,
  VOID_WINDOW_DAYS,
} from "@cinch/commitments";

export type UserRecord = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  score: number;
  streak: number;
  lastFailedAt?: string;
  freezesLeft: number;
  voidsLeft: number;
  voidsResetAt: string;
  freezesResetAt: string;
  excludedUntil?: string;
  dayStakeMinor: number;
  dayKey: string;
  weekStakeMinor: number;
  weekKey: string;
  categories: { fitness: number; focus: number; social: number };
  settings: UserSettings;
};

export type UserSettings = {
  leaveNow: boolean;
  haptics: boolean;
  shareOnLock: boolean;
  hideStakeOnFeed: boolean;
  defaultStake: number;
};

export type SessionRecord = {
  token: string;
  userId: string;
  refresh: string;
};

export type CommitmentRecord = {
  id: string;
  state: CommitmentState;
  spec: CommitmentSpec;
  inviteCode: string;
  reservationId?: string;
  createdAt: string;
  outcome?: "success" | "failure" | "voided";
  originalStakeMinor: number;
  leaveByAt?: string;
  leaveFired?: boolean;
  nudgeBy: Record<string, string>;
  reactions: Record<string, string>;
  witnessIds: string[];
  reservationExpiresAt?: string;
  rematchOf?: string;
  postmortem?: string;
  matchedFrom?: string;
};

export type EvidenceRecord = {
  id: string;
  commitmentId: string;
  kind: "photo" | "checkin" | "partner_attest" | "admin" | "ai_vision" | "motion" | "health";
  payload: Record<string, unknown>;
  at: string;
};

export type ChallengeRecord = {
  id: string;
  fromUserId: string;
  toUserId: string;
  utterance: string;
  state: "pending" | "accepted" | "declined";
  createdAt: string;
};

export type OpenQuestionRecord = {
  id: string;
  title: string;
  body: string;
  votes: { kept: number; voided: number; broke: number };
  voted: Set<string>;
};

export type GroupRecord = {
  id: string;
  name: string;
  memberIds: string[];
  charityId: string;
  targets: Record<string, string>;
};

const users = new Map<string, UserRecord>();
const sessions = new Map<string, SessionRecord>();
const otps = new Map<string, { code: string; expires: number; attempts: number }>();
const commitments = new Map<string, CommitmentRecord>();
const evidence = new Map<string, EvidenceRecord[]>();
const wallets = new Map<string, { available: Amount; reserved: Amount }>();
const usedNonces = new Set<string>();
const feed: Array<Record<string, unknown>> = [];
const friends = new Map<string, Set<string>>();
const notifications: Array<Record<string, unknown>> = [];
const disputes = new Map<string, { id: string; commitmentId: string; state: string }>();
const groups = new Map<string, GroupRecord>();
const audit: Array<Record<string, unknown>> = [];
const challenges = new Map<string, ChallengeRecord>();
const checkins: Array<{
  id: string;
  userId: string;
  localDate: string;
  timezone: string;
  mood: "locked-in" | "steady" | "struggling";
  note: string | null;
  at: string;
}> = [];
const openQuestion: OpenQuestionRecord = {
  id: "oq-today",
  title: "Was this a gym session?",
  body: "GPS says Rec Center for eleven minutes. The watch never started a workout. The nonce photo is a water fountain. Same phone, three signals.",
  votes: { kept: 0, voided: 0, broke: 0 },
  voted: new Set(),
};

export const store = {
  users,
  sessions,
  otps,
  commitments,
  evidence,
  wallets,
  usedNonces,
  feed,
  friends,
  notifications,
  disputes,
  groups,
  audit,
  challenges,
  checkins,
  openQuestion,
  reset() {
    users.clear();
    sessions.clear();
    otps.clear();
    commitments.clear();
    evidence.clear();
    wallets.clear();
    usedNonces.clear();
    feed.length = 0;
    friends.clear();
    notifications.length = 0;
    disputes.clear();
    groups.clear();
    audit.length = 0;
    challenges.clear();
    checkins.length = 0;
    openQuestion.votes = { kept: 0, voided: 0, broke: 0 };
    openQuestion.voted = new Set();
  },
  wallet(userId: string) {
    const existing = wallets.get(userId);
    if (existing) return existing;
    const created = { available: amount("POINTS", 10000), reserved: amount("POINTS", 0) };
    wallets.set(userId, created);
    return created;
  },
  refreshAllowances(user: UserRecord, now = new Date()) {
    if (Date.parse(user.voidsResetAt) <= now.getTime()) {
      user.voidsLeft = 1;
      user.voidsResetAt = new Date(now.getTime() + VOID_WINDOW_DAYS * 86400_000).toISOString();
    }
    const month = `${now.getUTCFullYear()}-${now.getUTCMonth()}`;
    if (user.freezesResetAt !== month) {
      user.freezesLeft = FREEZES_PER_MONTH;
      user.freezesResetAt = month;
    }
    const day = now.toISOString().slice(0, 10);
    if (user.dayKey !== day) {
      user.dayKey = day;
      user.dayStakeMinor = 0;
    }
    const week = isoWeek(now);
    if (user.weekKey !== week) {
      user.weekKey = week;
      user.weekStakeMinor = 0;
    }
  },
  newUser(email: string, displayName: string): UserRecord {
    const now = new Date();
    const user: UserRecord = {
      id: newId(),
      email,
      displayName,
      score: 500,
      streak: 0,
      freezesLeft: FREEZES_PER_MONTH,
      voidsLeft: 1,
      voidsResetAt: new Date(now.getTime() + VOID_WINDOW_DAYS * 86400_000).toISOString(),
      freezesResetAt: `${now.getUTCFullYear()}-${now.getUTCMonth()}`,
      dayStakeMinor: 0,
      dayKey: now.toISOString().slice(0, 10),
      weekStakeMinor: 0,
      weekKey: isoWeek(now),
      categories: { fitness: 500, focus: 500, social: 500 },
      settings: defaultSettings(),
    };
    users.set(user.id, user);
    this.wallet(user.id);
    return user;
  },
  putCommitment(input: {
    spec: CommitmentSpec;
    rematchOf?: string;
    matchedFrom?: string;
  }): CommitmentRecord {
    const id = newId();
    const row: CommitmentRecord = {
      id,
      state: "draft",
      spec: input.spec,
      inviteCode: id.slice(0, 8),
      createdAt: new Date().toISOString(),
      originalStakeMinor: input.spec.stake.amount.minor,
      nudgeBy: {},
      reactions: {},
      witnessIds: input.spec.partners
        .map((p) => p.resolved_user_id)
        .filter((x): x is string => Boolean(x)),
      rematchOf: input.rematchOf,
      matchedFrom: input.matchedFrom,
    };
    commitments.set(id, row);
    return row;
  },
  transition(id: string, to: CommitmentState) {
    const row = commitments.get(id);
    if (!row) throw new Error("missing commitment");
    assertTransition(row.state, to);
    row.state = to;
    audit.push({ at: new Date().toISOString(), commitmentId: id, to });
    return row;
  },
  settleStake(row: CommitmentRecord, outcome: "success" | "failure" | "voided") {
    const user = this.users.get(row.spec.committer_id);
    if (!user || !row.reservationId) return;
    const w = this.wallet(user.id);
    const held = row.spec.stake.amount.minor;
    if (outcome === "success" || outcome === "voided") {
      w.reserved = amount("POINTS", Math.max(0, w.reserved.minor - held));
      w.available = amount("POINTS", w.available.minor + held);
      return;
    }
    w.reserved = amount("POINTS", Math.max(0, w.reserved.minor - held));
    const dest = row.spec.stake.on_failure.destination;
    if (dest === "platform") return;
    if (dest === "partner") {
      const pid = row.spec.stake.on_failure.destination_id;
      if (pid) {
        const pw = this.wallet(pid);
        pw.available = amount("POINTS", pw.available.minor + held);
      }
    }
  },
  resolve(id: string, outcome: "success" | "failure" | "voided") {
    const current = this.commitments.get(id);
    if (!current) throw new Error("missing commitment");
    if (current.state === "scheduled" && outcome !== "voided") this.transition(id, "active");
    const row = this.transition(id, outcome);
    row.outcome = outcome;
    const user = this.users.get(row.spec.committer_id);
    const insured = Boolean(row.spec.meta.streakInsurance);
    if (user && outcome === "success") {
      user.score = Math.min(900, user.score + 14);
      user.streak += 1;
      bumpCategory(user, row.spec.title, 10);
      this.maybeChain(row);
    }
    if (user && outcome === "failure") {
      user.score = Math.max(300, user.score - 28);
      user.lastFailedAt = new Date().toISOString();
      bumpCategory(user, row.spec.title, -16);
      if (!insured) user.streak = 0;
    }
    this.settleStake(row, outcome);
    this.transition(id, "resolved");
    this.feed.unshift({
      type: outcome === "success" ? "kept" : outcome === "failure" ? "broke" : "voided",
      id,
      title: row.spec.title,
      actor: user?.displayName,
      actorId: user?.id,
      at: new Date().toISOString(),
      hideStake: true,
      category: categoryFromTitle(row.spec.title),
      streak: user?.streak,
      kudos: [],
    });
    return row;
  },
  maybeChain(row: CommitmentRecord) {
    const next = row.spec.meta.chainNextStakeMinor;
    if (!next) return;
    const deadline = new Date(Date.parse(row.spec.schedule.deadline_at) + 7 * 86400_000);
    const start = new Date(deadline.getTime() - 3600_000);
    const spec: CommitmentSpec = {
      ...row.spec,
      stake: {
        ...row.spec.stake,
        amount: { currency: "POINTS", minor: next },
      },
      schedule: {
        ...row.spec.schedule,
        start_at: start.toISOString(),
        deadline_at: deadline.toISOString(),
      },
      meta: { ...row.spec.meta, chainNextStakeMinor: undefined, streakInsurance: undefined },
    };
    this.putCommitment({ spec });
  },
  dueLeaveNow(userId: string, now = new Date()) {
    const due: Array<Record<string, unknown>> = [];
    for (const row of commitments.values()) {
      if (row.spec.committer_id !== userId) continue;
      if (!["scheduled", "active"].includes(row.state)) continue;
      if (!row.leaveByAt || row.leaveFired) continue;
      if (Date.parse(row.leaveByAt) > now.getTime()) continue;
      if (Date.parse(row.spec.schedule.deadline_at) <= now.getTime()) continue;
      row.leaveFired = true;
      const note = {
        userId,
        template: "leave_by_now",
        commitmentId: row.id,
        title: row.spec.title,
        at: now.toISOString(),
      };
      notifications.push(note);
      due.push(note);
    }
    return due;
  },
    expiredAuth(now = new Date()) {
    for (const row of [...commitments.values()]) {
      if (!row.reservationExpiresAt) continue;
      if (!["scheduled", "active"].includes(row.state)) continue;
      if (Date.parse(row.reservationExpiresAt) > now.getTime()) continue;
      this.resolve(row.id, "voided");
    }
  },
  linkFriends(a: string, b: string) {
    if (a === b) return;
    for (const [from, to] of [
      [a, b],
      [b, a],
    ] as const) {
      const set = friends.get(from) ?? new Set<string>();
      set.add(to);
      friends.set(from, set);
    }
  },
  hasPhoto(id: string): boolean {
    return (evidence.get(id) ?? []).some((e) => e.kind === "photo");
  },
  achievements(userId: string) {
    const stats = this.userStats(userId);
    const locks = [...commitments.values()].filter((c) => c.spec.committer_id === userId).length;
    const photos = [...commitments.values()].filter((c) => c.spec.committer_id === userId && this.hasPhoto(c.id)).length;
    const held = [...commitments.values()].filter((c) =>
      c.spec.partners.some((p) => p.resolved_user_id === userId),
    ).length;
    const friendsCount = friends.get(userId)?.size ?? 0;
    const defs = [
      { id: "first-lock", title: "Make it real", description: "Lock your first promise.", target: 1, progress: locks, xp: 50 },
      { id: "first-keep", title: "Word kept", description: "Close one with proof.", target: 1, progress: stats.kept, xp: 80 },
      { id: "streak-3", title: "Three in a row", description: "Hold a 3-keep streak.", target: 3, progress: stats.streak, xp: 100 },
      { id: "streak-7", title: "Week of word", description: "A 7-keep streak.", target: 7, progress: stats.streak, xp: 200 },
      { id: "kept-5", title: "Evidence trail", description: "Keep five promises.", target: 5, progress: stats.kept, xp: 150 },
      { id: "photo", title: "Show your work", description: "Send photo proof.", target: 1, progress: photos, xp: 60 },
      { id: "network", title: "Someone watching", description: "Add a friend.", target: 1, progress: friendsCount, xp: 40 },
      { id: "witness", title: "In the room", description: "Hold someone else to it.", target: 1, progress: held, xp: 40 },
      { id: "honest", title: "No disappearing act", description: "Close a miss honestly.", target: 1, progress: stats.broken, xp: 40 },
    ];
    return defs.map((d) => ({ ...d, unlocked: d.progress >= d.target }));
  },
  userStats(userId: string) {
    const mine = [...commitments.values()].filter((c) => c.spec.committer_id === userId);
    const kept = mine.filter((c) => c.outcome === "success").length;
    const broken = mine.filter((c) => c.outcome === "failure").length;
    const tried = kept + broken;
    const user = users.get(userId);
    return {
      kept,
      broken,
      tried,
      rate: tried ? Math.round((kept / tried) * 100) : 0,
      score: user?.score ?? 500,
      streak: user?.streak ?? 0,
    };
  },
  failOverdueWithoutPhoto(now = new Date()) {
    for (const row of [...commitments.values()]) {
      if (!["scheduled", "active", "verification_pending"].includes(row.state)) continue;
      const deadline = Date.parse(row.spec.schedule.deadline_at);
      if (!Number.isFinite(deadline) || deadline > now.getTime()) continue;
      this.resolve(row.id, this.hasPhoto(row.id) ? "success" : "failure");
    }
  },
};

export function seedUserAllowances(now = new Date()): Pick<
  UserRecord,
  | "freezesLeft"
  | "voidsLeft"
  | "voidsResetAt"
  | "freezesResetAt"
  | "dayStakeMinor"
  | "dayKey"
  | "weekStakeMinor"
  | "weekKey"
> {
  return {
    freezesLeft: FREEZES_PER_MONTH,
    voidsLeft: 1,
    voidsResetAt: new Date(now.getTime() + VOID_WINDOW_DAYS * 86400_000).toISOString(),
    freezesResetAt: `${now.getUTCFullYear()}-${now.getUTCMonth()}`,
    dayStakeMinor: 0,
    dayKey: now.toISOString().slice(0, 10),
    weekStakeMinor: 0,
    weekKey: isoWeek(now),
  };
}

export function applyInsurance(spec: CommitmentSpec): CommitmentSpec {
  if (!spec.meta.streakInsurance) return spec;
  return {
    ...spec,
    stake: {
      ...spec.stake,
      amount: { currency: "POINTS", minor: insuredStakeMinor(spec.stake.amount.minor, true) },
    },
  };
}

export function applyHorizon(row: CommitmentRecord, now = new Date()) {
  const deadline = Date.parse(row.spec.schedule.deadline_at);
  if (deadline - now.getTime() > AUTH_HORIZON_MS) {
    row.reservationExpiresAt = new Date(now.getTime() + AUTH_HORIZON_MS).toISOString();
  }
}

export function excluded(user: UserRecord, now = new Date()): boolean {
  return isSelfExcluded(user.excludedUntil, now);
}

function bumpCategory(user: UserRecord, title: string, delta: number) {
  if (!user.categories) user.categories = { fitness: 500, focus: 500, social: 500 };
  const key = categoryFromTitle(title);
  user.categories[key] = Math.min(900, Math.max(300, user.categories[key] + delta));
}

function isoWeek(now: Date): string {
  const t = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400_000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${week}`;
}

export function defaultSettings(): UserSettings {
  return {
    leaveNow: true,
    haptics: true,
    shareOnLock: true,
    hideStakeOnFeed: true,
    defaultStake: 25,
  };
}

export function newId(): string {
  return crypto.randomUUID();
}
