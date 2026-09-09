import { CinchApi } from "@cinch/api-client";
import { loadSession } from "./session";

export function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
}

export function createBrowserApi(): CinchApi {
  return new CinchApi(apiBase(), () => loadSession()?.token ?? null);
}
