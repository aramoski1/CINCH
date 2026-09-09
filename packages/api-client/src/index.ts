export type HealthResponse = {
  ok: true;
  service: "cinch-api";
  time: string;
};

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

  async me(): Promise<unknown> {
    return this.request("/v1/me");
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const res = await fetch(`${this.baseUrl}${path}`, { ...init, headers });
    const body: unknown = await res.json();
    if (!res.ok) {
      const err = body as ApiErrorBody;
      throw new Error(err.error?.message ?? `HTTP ${res.status}`);
    }
    return body as T;
  }
}
