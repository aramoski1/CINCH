const RECENTS = "cinch.recents";
const ONBOARDED = "cinch.onboarded";
const HAPTICS = "cinch.haptics";

export function loadRecents(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENTS) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter((n): n is string => typeof n === "string" && n.trim().length > 0).slice(0, 8) : [];
  } catch {
    return [];
  }
}

export function rememberFriend(name: string): void {
  const next = [name.trim(), ...loadRecents().filter((n) => n.toLowerCase() !== name.trim().toLowerCase())].slice(0, 8);
  window.localStorage.setItem(RECENTS, JSON.stringify(next));
}

export function loadOnboarded(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(ONBOARDED) === "1";
}

export function saveOnboarded(): void {
  window.localStorage.setItem(ONBOARDED, "1");
}

export function persistHaptics(on: boolean): void {
  window.localStorage.setItem(HAPTICS, on ? "1" : "0");
}
