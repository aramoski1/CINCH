import type { AuthSession } from "@cinch/api-client";

const KEY = "cinch.session";

export function loadSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed?.token || !parsed.user?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(session: AuthSession): void {
  window.localStorage.setItem(KEY, JSON.stringify(session));
}

export function clearSession(): void {
  window.localStorage.removeItem(KEY);
}
