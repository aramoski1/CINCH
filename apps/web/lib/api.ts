import { CinchApi } from "@cinch/api-client";
import { loadSession } from "./session";

export function apiBase(): string {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, "");
  }
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") return "http://localhost:4000";
    return "";
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/^https?:\/\//, "")}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:4000";
}

export function createBrowserApi(onUnauthorized?: () => void): CinchApi {
  return new CinchApi(apiBase(), () => loadSession()?.token ?? null, onUnauthorized);
}
