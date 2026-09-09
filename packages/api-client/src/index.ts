export type HealthResponse = {
  ok: true;
  service: "cinch-api";
  time: string;
};

export type Amount = { currency: "POINTS" | "USD"; minor: number };

export type UserSettings = {
  leaveNow: boolean;
  haptics: boolean;
  shareOnLock: boolean;
  hideStakeOnFeed: boolean;
  defaultStake: number;
};

export const DEFAULT_SETTINGS: UserSettings = {
  leaveNow: true,
  haptics: true,
  shareOnLock: true,
  hideStakeOnFeed: true,
  defaultStake: 25,
};

export type SessionUser = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  score: number;
  streak: number;
  freezesLeft?: number;
  voidsLeft?: number;
  excludedUntil?: string | null;
  categories?: { fitness: number; focus: number; social: number };
  settings?: UserSettings;
  kept?: number;
  broken?: number;
};

export type FriendPerson = {
  id: string;
  displayName: string;
  email: string;
};

export type FriendsList = {
  people: FriendPerson[];
  named: string[];
};

export type Wallet = {
  available: Amount;
  reserved: Amount;
};

export type AuthSession = {
  token: string;
  refresh: string;
  user: SessionUser;
};

export type CommitmentRow = {
  id: string;
  state: string;
  spec: {
    title: string;
    natural_language: string;
    stake: { amount: Amount };
    meta?: {
      assumptions?: string[];
      blind?: boolean;
      streakInsurance?: boolean;
      stakeMode?: string;
      standing?: boolean;
    };
    schedule?: { deadline_at?: string; start_at?: string | null };
    partners?: Array<{ ref: string }>;
  };
  inviteCode: string;
  createdAt: string;
  outcome?: string;
  leaveByAt?: string;
  hasPhoto?: boolean;
  photoRequired?: boolean;
};

export type LeaderRow = {
  id: string;
  displayName: string;
  you: boolean;
  rank: number;
  score: number;
  streak: number;
  kept: number;
  broken: number;
  rate: number;
};

export type Leaderboard = {
  board: LeaderRow[];
  rival: LeaderRow | null;
  you: LeaderRow | null;
};

export type WatchingRow = {
  id: string;
  title: string;
  deadlineAt: string;
  stake: Amount;
  inviteCode: string;
  committer: string;
  hasPhoto: boolean;
};

export type Chip = { key: string; label: string; assumed: string };

export type ParseOk = {
  spec: Record<string, unknown>;
  rendered: string;
  assumptions: string[];
  chips?: Chip[];
  ready?: boolean;
  insuranceOffered?: boolean;
  verificationPlan?: string;
  blocked?: false;
};

export type ParseBlocked = {
  blocked: true;
  message: string;
  resources?: string[];
};

export type InvitePreview = {
  id: string;
  title: string;
  rendered: string;
  stake: Amount;
  assumptions: string[];
  inviteCode: string;
  deadlineAt?: string;
  outcome?: string | null;
  nudgeUsed?: boolean;
  nudges?: string[];
  reactions?: string[];
  reacted?: string[];
  committer?: { displayName: string; score: number };
  partner?: string;
  witnesses?: string[];
};

export type GroupRow = {
  id: string;
  name: string;
  memberIds: string[];
  charityId?: string;
  targets?: Record<string, string>;
};

export type FeedItem = {
  id: string;
  type: string;
  title: string;
  detail: string;
  actor: string | null;
  at: string;
  accent: string;
  kudosCount: number;
  kudosActive: boolean;
  mine?: boolean;
};

export type CheckIn = {
  id: string;
  localDate: string;
  mood: "locked-in" | "steady" | "struggling";
  note: string | null;
};

export type Achievement = {
  id: string;
  title: string;
  description: string;
  target: number;
  progress: number;
  xp: number;
  unlocked: boolean;
};

export type DiscoverPerson = {
  id: string;
  displayName: string;
  email: string;
  relationship: "friend" | "none";
  streak: number;
  score: number;
  rate?: number;
};

export type PersonProfile = {
  person: DiscoverPerson;
  sharedCommitments: number;
  keptTogether: number;
  mutualFriends: number;
  achievements: Achievement[];
};

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};

export class CinchRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "CinchRequestError";
  }
}

export function isUnauthorized(error: unknown): boolean {
  return error instanceof CinchRequestError && error.status === 401;
}

export class CinchApi {
  constructor(
    private readonly baseUrl: string,
    private readonly getToken: () => string | null = () => null,
    private readonly onUnauthorized: () => void = () => undefined,
  ) {}

  async health(): Promise<HealthResponse> {
    return this.request<HealthResponse>("/v1/health");
  }

  async requestEmailCode(email: string): Promise<{ ok: true; throttled?: boolean; devCode?: string }> {
    return this.request("/v1/auth/email", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }

  async verifyEmail(input: { email: string; code: string; displayName?: string }): Promise<AuthSession> {
    return this.request("/v1/auth/verify", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async me(): Promise<{ user: SessionUser; wallet: Wallet }> {
    return this.request("/v1/me");
  }

  async updateMe(input: { displayName?: string; avatarUrl?: string }): Promise<{ user: SessionUser }> {
    return this.request("/v1/me", { method: "PATCH", body: JSON.stringify(input) });
  }

  async patchSettings(input: Partial<UserSettings>): Promise<{ settings: UserSettings }> {
    return this.request("/v1/me/settings", { method: "PATCH", body: JSON.stringify(input) });
  }

  async wallet(): Promise<Wallet> {
    return this.request("/v1/wallet");
  }

  async lock(input: { utterance: string; friend: string; friendId?: string; stake: number; deadlineAt?: string }): Promise<{
    id: string;
    inviteCode: string;
    shareUrl: string;
    title: string;
    deadlineAt: string;
    friend: string;
    stake: number;
  }> {
    return this.request("/v1/commitments/lock", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async parse(utterance: string): Promise<ParseOk | ParseBlocked | { message?: string }> {
    return this.request("/v1/commitments/parse", {
      method: "POST",
      body: JSON.stringify({ utterance }),
    });
  }

  async createCommitment(spec: unknown): Promise<{ id: string; state: string; inviteCode: string; rendered: string }> {
    return this.request("/v1/commitments", { method: "POST", body: JSON.stringify(spec) });
  }

  async activeCommitments(): Promise<CommitmentRow[]> {
    return this.request("/v1/commitments/active");
  }

  async invite(id: string): Promise<{ inviteCode: string; shareUrl: string }> {
    return this.request(`/v1/commitments/${id}/invite`, { method: "POST", body: "{}" });
  }

  async fund(id: string): Promise<{ state: string; reservationId: string }> {
    return this.request(`/v1/commitments/${id}/fund`, { method: "POST", body: "{}" });
  }

  async accept(id: string): Promise<{ ok: true }> {
    return this.request(`/v1/commitments/${id}/accept`, { method: "POST", body: "{}" });
  }

  async feed(): Promise<FeedItem[]> {
    return this.request("/v1/feed");
  }

  async reactFeed(id: string): Promise<{ ok: true; kudosCount?: number }> {
    return this.request(`/v1/feed/${id}/react`, { method: "POST", body: "{}" });
  }

  async checkins(): Promise<CheckIn[]> {
    return this.request("/v1/checkins");
  }

  async createCheckIn(input: {
    localDate: string;
    timezone: string;
    mood: CheckIn["mood"];
    note?: string | null;
  }): Promise<CheckIn> {
    return this.request("/v1/checkins", { method: "POST", body: JSON.stringify(input) });
  }

  async people(q = ""): Promise<DiscoverPerson[]> {
    const suffix = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
    return this.request(`/v1/people${suffix}`);
  }

  async person(id: string): Promise<PersonProfile> {
    return this.request(`/v1/people/${id}`);
  }

  async achievements(): Promise<Achievement[]> {
    return this.request("/v1/achievements");
  }

  async friends(): Promise<FriendsList> {
    return this.request("/v1/friends");
  }

  async leaderboard(): Promise<Leaderboard> {
    return this.request("/v1/leaderboard");
  }

  async watching(): Promise<WatchingRow[]> {
    return this.request("/v1/watching");
  }

  async addFriend(email: string): Promise<{ ok: true; person?: FriendPerson }> {
    return this.request("/v1/friends", { method: "POST", body: JSON.stringify({ email }) });
  }

  async removeFriend(id: string): Promise<{ ok: true }> {
    return this.request(`/v1/friends/${id}`, { method: "DELETE" });
  }

  async groups(): Promise<GroupRow[]> {
    return this.request("/v1/groups");
  }

  async createGroup(name: string): Promise<{ id: string }> {
    return this.request("/v1/groups", { method: "POST", body: JSON.stringify({ name }) });
  }

  async joinGroup(id: string): Promise<{ ok: true } | { ok: false; reason: string }> {
    return this.request(`/v1/groups/${id}/join`, { method: "POST", body: "{}" });
  }

  async invitePreview(code: string): Promise<InvitePreview> {
    return this.request(`/v1/invites/${code}`);
  }

  async coach(): Promise<{
    insight: { kind: string; text: string };
    mayRaiseStake: boolean;
    stats: string[];
    categories: { fitness: number; focus: number; social: number };
  }> {
    return this.request("/v1/coach");
  }

  async freeze(): Promise<{ ok: boolean; freezesLeft?: number; reason?: string }> {
    return this.request("/v1/streaks/freeze", { method: "POST", body: "{}" });
  }

  async match(id: string): Promise<{ id: string; spec: unknown }> {
    return this.request(`/v1/commitments/${id}/match`, { method: "POST", body: "{}" });
  }

  async checkin(id: string, lat: number, lng: number): Promise<{ inside: boolean; place?: string; meters: number }> {
    return this.request(`/v1/commitments/${id}/checkin`, {
      method: "POST",
      body: JSON.stringify({ lat, lng }),
    });
  }

  async proof(id: string, nonce: string, data: string): Promise<{ ok: true; state: string }> {
    return this.request(`/v1/commitments/${id}/proof`, {
      method: "POST",
      body: JSON.stringify({ nonce, data }),
    });
  }

  async kept(id: string): Promise<{ ok: true }> {
    return this.request(`/v1/commitments/${id}/kept`, { method: "POST", body: "{}" });
  }

  async honestFail(id: string): Promise<{ ok: true }> {
    return this.request(`/v1/commitments/${id}/honest-fail`, { method: "POST", body: "{}" });
  }

  async lifeHappens(id: string): Promise<{ ok: boolean; voidsLeft?: number }> {
    return this.request(`/v1/commitments/${id}/life-happens`, { method: "POST", body: "{}" });
  }

  async nonce(): Promise<{ nonce: string }> {
    return this.request("/v1/evidence/nonce", { method: "POST", body: "{}" });
  }

  async evidence(id: string, input: { nonce: string; kind: "photo" | "checkin" | "partner_attest"; payload?: Record<string, unknown> }) {
    return this.request(`/v1/commitments/${id}/evidence`, { method: "POST", body: JSON.stringify(input) });
  }

  async places(): Promise<Array<{ id: string; name: string }>> {
    return this.request("/v1/places");
  }

  async attest(id: string, confirm: boolean): Promise<{ ok: true }> {
    return this.request(`/v1/commitments/${id}/attest`, { method: "POST", body: JSON.stringify({ confirm }) });
  }

  async dispute(id: string): Promise<{ disputeId: string }> {
    return this.request(`/v1/commitments/${id}/dispute`, { method: "POST", body: "{}" });
  }

  async travel(id: string, lat: number, lng: number): Promise<{ leaveAt: string | null; minutes: number; meters: number; alreadyLate: boolean }> {
    return this.request(`/v1/commitments/${id}/travel`, { method: "POST", body: JSON.stringify({ lat, lng }) });
  }

  async rematch(id: string): Promise<{ id: string; spec: unknown }> {
    return this.request(`/v1/commitments/${id}/rematch`, { method: "POST", body: "{}" });
  }

  async nudge(id: string, text: string): Promise<{ ok: true }> {
    return this.request(`/v1/commitments/${id}/nudge`, { method: "POST", body: JSON.stringify({ text }) });
  }

  async reactVerdict(id: string, text: string): Promise<{ ok: true }> {
    return this.request(`/v1/commitments/${id}/react`, { method: "POST", body: JSON.stringify({ text }) });
  }

  async addWitness(id: string, name: string, email?: string): Promise<{ ok: true; witnesses: number }> {
    return this.request(`/v1/commitments/${id}/witnesses`, { method: "POST", body: JSON.stringify({ name, email }) });
  }

  async postmortem(id: string, text: string): Promise<{ ok: true }> {
    return this.request(`/v1/commitments/${id}/postmortem`, { method: "POST", body: JSON.stringify({ text }) });
  }

  async packet(id: string): Promise<{ score: number; band: string; math: string; lines: Array<{ source: string; note: string }> }> {
    return this.request(`/v1/commitments/${id}/packet`);
  }

  async receipt(id: string): Promise<Record<string, unknown>> {
    return this.request(`/v1/commitments/${id}/receipt`);
  }

  async vision(id: string, nonce: string, data?: string): Promise<{ ok: boolean; score?: number; rationale?: string; reason?: string }> {
    return this.request(`/v1/commitments/${id}/vision`, { method: "POST", body: JSON.stringify({ nonce, data }) });
  }

  async settle(id: string): Promise<{ outcome: string; score: number; band: string; math: string }> {
    return this.request(`/v1/commitments/${id}/settle`, { method: "POST", body: "{}" });
  }

  async truth(): Promise<{
    cards: Array<{ headline: string; rate: number; phrase: string }>;
    split: { line: string } | null;
    heat: Array<{ hour: number; rate: number; tried: number }>;
    witness: { kept: number; tried: number; rate: number };
    categories: { fitness: number; focus: number; social: number };
  }> {
    return this.request("/v1/truth");
  }

  async ledger(): Promise<Array<{ id: string; title: string; outcome: string; at: string; stake: Amount | null }>> {
    return this.request("/v1/ledger");
  }

  async year(): Promise<{ year: number; kept: number; broken: number; voided: number; hardestKept?: string; givenUpThreeTimes?: string }> {
    return this.request("/v1/year");
  }

  async collisions(): Promise<Array<{ title: string; them: string; category: string }>> {
    return this.request("/v1/collisions");
  }

  async protocols(): Promise<Array<{ id: string; name: string; utterance: string; why: string }>> {
    return this.request("/v1/protocols");
  }

  async adoptProtocol(id: string): Promise<{ id: string; utterance: string }> {
    return this.request(`/v1/protocols/${id}/adopt`, { method: "POST", body: "{}" });
  }

  async standing(): Promise<{ id: string; title: string; count: number } | null> {
    return this.request("/v1/standing");
  }

  async makeStanding(): Promise<{ id: string }> {
    return this.request("/v1/standing", { method: "POST", body: "{}" });
  }

  async charities(): Promise<Array<{ id: string; name: string }>> {
    return this.request("/v1/charities");
  }

  async challenges(): Promise<Array<{ id: string; utterance: string; state: string; from?: string; to?: string; fromUserId: string; toUserId: string }>> {
    return this.request("/v1/challenges");
  }

  async proposeChallenge(email: string, utterance: string): Promise<{ id: string }> {
    return this.request("/v1/challenges", { method: "POST", body: JSON.stringify({ email, utterance }) });
  }

  async acceptChallenge(id: string): Promise<{ id: string }> {
    return this.request(`/v1/challenges/${id}/accept`, { method: "POST", body: "{}" });
  }

  async declineChallenge(id: string): Promise<{ ok: true }> {
    return this.request(`/v1/challenges/${id}/decline`, { method: "POST", body: "{}" });
  }

  async openQuestion(): Promise<{ id: string; title: string; body: string; votes: { kept: number; voided: number; broke: number }; voted: boolean }> {
    return this.request("/v1/open-question");
  }

  async voteQuestion(choice: "kept" | "voided" | "broke"): Promise<{ votes: { kept: number; voided: number; broke: number } }> {
    return this.request("/v1/open-question/vote", { method: "POST", body: JSON.stringify({ choice }) });
  }

  async exclude(days: number): Promise<{ excludedUntil: string }> {
    return this.request("/v1/me/exclude", { method: "POST", body: JSON.stringify({ days }) });
  }

  async witnessRecord(): Promise<{ kept: number; tried: number; rate: number }> {
    return this.request("/v1/me/witness");
  }

  async notifications(): Promise<Array<Record<string, unknown>>> {
    return this.request("/v1/notifications");
  }

  async groupTarget(id: string, target: string): Promise<{ ok: true }> {
    return this.request(`/v1/groups/${id}/target`, { method: "POST", body: JSON.stringify({ target }) });
  }

  async reauth(id: string): Promise<{ reservationExpiresAt: string | null }> {
    return this.request(`/v1/commitments/${id}/reauth`, { method: "POST", body: "{}" });
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    if (init.body && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const res = await fetch(`${this.baseUrl}${path}`, { ...init, headers });
    const body: unknown = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = body as ApiErrorBody;
      if (res.status === 401) this.onUnauthorized();
      throw new CinchRequestError(err.error?.message ?? `HTTP ${res.status}`, res.status);
    }
    return body as T;
  }
}
