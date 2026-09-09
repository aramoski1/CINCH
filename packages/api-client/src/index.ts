export type HealthResponse = {
  ok: true;
  service: "cinch-api";
  time: string;
};

export type Amount = { currency: "POINTS" | "USD"; minor: number };

export type SessionUser = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  score: number;
  streak: number;
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
    meta?: { assumptions?: string[] };
    schedule?: { deadline_at?: string };
  };
  inviteCode: string;
  createdAt: string;
};

export type ParseOk = {
  spec: unknown;
  rendered: string;
  assumptions: string[];
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
};

export type GroupRow = { id: string; name: string; memberIds: string[] };

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};

export class CinchApi {
  constructor(
    private readonly baseUrl: string,
    private readonly getToken: () => string | null = () => null,
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

  async wallet(): Promise<Wallet> {
    return this.request("/v1/wallet");
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

  async feed(): Promise<Array<Record<string, unknown>>> {
    return this.request("/v1/feed");
  }

  async friends(): Promise<string[]> {
    return this.request("/v1/friends");
  }

  async addFriend(email: string): Promise<{ ok: true }> {
    return this.request("/v1/friends", { method: "POST", body: JSON.stringify({ email }) });
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
      throw new Error(err.error?.message ?? `HTTP ${res.status}`);
    }
    return body as T;
  }
}
