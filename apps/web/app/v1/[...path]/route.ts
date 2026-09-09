import { getHostedApp } from "@cinch/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

async function handle(req: Request): Promise<Response> {
  const app = await getHostedApp();
  const url = new URL(req.url);
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    if (["content-length", "host", "connection", "transfer-encoding"].includes(key.toLowerCase())) return;
    headers[key] = value;
  });
  const payload = req.method === "GET" || req.method === "HEAD" ? undefined : await req.text();
  const injected = await app.inject({
    method: req.method as "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD",
    url: `${url.pathname}${url.search}`,
    headers,
    payload: payload || undefined,
  });
  const out = new Headers();
  for (const [key, value] of Object.entries(injected.headers)) {
    if (value == null) continue;
    if (["content-length", "transfer-encoding", "connection"].includes(key.toLowerCase())) continue;
    if (Array.isArray(value)) {
      for (const item of value) out.append(key, String(item));
    } else {
      out.set(key, String(value));
    }
  }
  return new Response(injected.body, { status: injected.statusCode, headers: out });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
