import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { unauthorized } from "@cinch/shared";
import { createSupabaseEmailOtp } from "@cinch/adapters";
import type { Env } from "../config/env";
import { newId, store } from "../store";

function issueSession(email: string, displayName?: string) {
  let user = [...store.users.values()].find((u) => u.email === email);
  if (!user) {
    user = store.newUser(email, displayName ?? email.split("@")[0] ?? "Friend");
  }
  const token = newId();
  const refresh = newId();
  store.sessions.set(token, { token, refresh, userId: user.id });
  return { token, refresh, user };
}

function authRedirect(env: Env) {
  return `${env.WEB_BASE_URL.replace(/\/$/, "")}/auth/callback`;
}

export async function registerAuth(app: FastifyInstance, env: Env) {
  const mail = createSupabaseEmailOtp({ url: env.SUPABASE_URL, anonKey: env.SUPABASE_ANON_KEY });
  const local = env.NODE_ENV !== "production";

  app.post("/v1/auth/email", async (req) => {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const existing = store.otps.get(email);
    if (existing && existing.attempts >= 3 && existing.expires > Date.now()) {
      return { ok: true, throttled: true };
    }
    if (!local) {
      await mail.send(email, authRedirect(env));
      return { ok: true };
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    store.otps.set(email, { code, expires: Date.now() + 5 * 60_000, attempts: 0 });
    req.log.info({ email, code }, "otp issued");
    return { ok: true, devCode: code };
  });

  app.post("/v1/auth/verify", async (req) => {
    const { email, code, displayName } = z
      .object({
        email: z.string().email(),
        code: z.string().length(6),
        displayName: z.string().min(1).optional(),
      })
      .parse(req.body);
    if (local) {
      const otp = store.otps.get(email);
      if (!otp || otp.expires < Date.now()) throw unauthorized("OTP expired");
      otp.attempts += 1;
      if (otp.attempts > 3) throw unauthorized("Too many attempts");
      if (otp.code !== code) throw unauthorized("Invalid code");
      store.otps.delete(email);
    } else {
      const ok = await mail.verify(email, code);
      if (!ok) throw unauthorized("Invalid code");
    }
    return issueSession(email, displayName);
  });

  app.post("/v1/auth/callback", async (req) => {
    const body = z
      .object({
        accessToken: z.string().min(1).optional(),
        tokenHash: z.string().min(1).optional(),
        type: z.string().optional(),
      })
      .parse(req.body);
    if (!body.accessToken && !body.tokenHash) throw unauthorized("Invalid link");
    const identity = await mail.consumeLink(body);
    if (!identity) throw unauthorized("Invalid link");
    return issueSession(identity.email, identity.displayName);
  });

  app.post("/v1/auth/refresh", async (req) => {
    const { refresh } = z.object({ refresh: z.string() }).parse(req.body);
    const session = [...store.sessions.values()].find((s) => s.refresh === refresh);
    if (!session) throw unauthorized();
    store.sessions.delete(session.token);
    const token = newId();
    const next = { token, refresh: newId(), userId: session.userId };
    store.sessions.set(token, next);
    return next;
  });

  app.post("/v1/devices", async (req) => {
    const user = requireUser(req.headers.authorization);
    const body = z
      .object({ platform: z.enum(["ios", "android", "web"]), pushToken: z.string().optional() })
      .parse(req.body);
    store.audit.push({ type: "device", userId: user.id, ...body });
    return { ok: true };
  });
}

export function requireUser(header?: string) {
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const session = token ? store.sessions.get(token) : undefined;
  const user = session ? store.users.get(session.userId) : undefined;
  if (!user) throw unauthorized();
  return user;
}
