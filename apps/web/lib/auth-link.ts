export type AuthLink = {
  accessToken?: string;
  tokenHash?: string;
  type?: string;
  error?: string;
};

export function readAuthLink(location: Location): AuthLink {
  const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(location.search);
  const accessToken = hash.get("access_token") || query.get("access_token") || undefined;
  const tokenHash = query.get("token_hash") || undefined;
  const type = query.get("type") || hash.get("type") || undefined;
  const error =
    query.get("error_description") ||
    hash.get("error_description") ||
    query.get("error") ||
    hash.get("error") ||
    undefined;
  return { accessToken, tokenHash, type, error };
}

export function hasAuthLink(link: AuthLink): boolean {
  return Boolean(link.accessToken || link.tokenHash);
}

export function stripAuthLink(): void {
  const url = new URL(window.location.href);
  url.hash = "";
  for (const key of [
    "token_hash",
    "type",
    "access_token",
    "expires_in",
    "expires_at",
    "refresh_token",
    "token_type",
    "error",
    "error_code",
    "error_description",
  ]) {
    url.searchParams.delete(key);
  }
  const nextPath = url.pathname === "/auth/callback" ? "/" : url.pathname;
  window.history.replaceState({}, "", `${nextPath}${url.search}`);
}
