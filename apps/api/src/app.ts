import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { CinchError } from "@cinch/shared";
import { ZodError } from "zod";
import { createRuntimeSnapshot, ensureRuntimeTable } from "@cinch/adapters";
import type { Env } from "./config/env";
import { registerAuth } from "./routes/auth";
import { registerCommitments } from "./routes/commitments";
import { registerSocial } from "./routes/social";
import { registerProduct } from "./routes/product";
import { dumpStore, loadStore } from "./store";

export async function buildApp(env: Env): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: env.LOG_LEVEL },
    bodyLimit: 2_000_000,
  });

  await app.register(cors, { origin: true });

  if (env.NODE_ENV !== "test") {
    await ensureRuntimeTable(env.DIRECT_URL)
      .catch(() => ensureRuntimeTable(env.DATABASE_URL))
      .catch((err) => {
        app.log.warn({ err }, "cinch_runtime table not created yet");
      });
    const snapshot = createRuntimeSnapshot({
      url: env.SUPABASE_URL,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    });
    app.addHook("onRequest", async (req) => {
      if (isHealth(req.url)) return;
      const payload = await snapshot.load();
      if (payload) loadStore(payload);
    });
    app.addHook("onResponse", async (req) => {
      if (isHealth(req.url)) return;
      await snapshot.save(dumpStore());
    });
  }

  app.addContentTypeParser("application/json", { parseAs: "string" }, (req, body, done) => {
    if (!body) {
      done(null, {});
      return;
    }
    try {
      done(null, JSON.parse(body as string));
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  app.get("/v1/health", async () => ({
    ok: true as const,
    service: "cinch-api",
    time: new Date().toISOString(),
  }));
  app.get("/health", async (_req, reply) => reply.redirect("/v1/health"));

  await registerAuth(app, env);
  await registerCommitments(app, env);
  await registerSocial(app, env);
  await registerProduct(app, env);

  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof CinchError) {
      return reply.status(error.status).send({
        error: { code: error.code, message: error.message, details: error.details },
      });
    }
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: { code: "VALIDATION", message: error.message },
      });
    }
    app.log.error(error);
    return reply.status(500).send({
      error: { code: "INTERNAL", message: "Internal error" },
    });
  });

  return app;
}

function isHealth(url: string): boolean {
  const path = url.split("?")[0] ?? url;
  return path === "/health" || path === "/v1/health";
}
