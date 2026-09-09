import { amount, type Amount } from "@cinch/shared";
import {
  assertTransition,
  type CommitmentSpec,
  type CommitmentState,
} from "@cinch/commitments";

export type UserRecord = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  score: number;
  streak: number;
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
};

export type EvidenceRecord = {
  id: string;
  commitmentId: string;
  kind: "photo" | "checkin" | "partner_attest" | "admin";
  payload: Record<string, unknown>;
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
const groups = new Map<string, { id: string; name: string; memberIds: string[] }>();
const audit: Array<Record<string, unknown>> = [];

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
  },
  wallet(userId: string) {
    const existing = wallets.get(userId);
    if (existing) return existing;
    const created = { available: amount("POINTS", 10000), reserved: amount("POINTS", 0) };
    wallets.set(userId, created);
    return created;
  },
  transition(id: string, to: CommitmentState) {
    const row = commitments.get(id);
    if (!row) throw new Error("missing commitment");
    assertTransition(row.state, to);
    row.state = to;
    audit.push({ at: new Date().toISOString(), commitmentId: id, to });
    return row;
  },
};

export function newId(): string {
  return crypto.randomUUID();
}
