import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { CinchError } from "@cinch/shared";
import type { Env } from "./config/env";

export async function buildApp(env: Env): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: env.LOG_LEVEL },
  });

  await app.register(cors, { origin: true });

  app.get("/v1/health", async () => ({
    ok: true as const,
    service: "cinch-api",
    time: new Date().toISOString(),
  }));

  app.get("/health", async (_req, reply) => reply.redirect("/v1/health"));

  app.get("/v1/me", async (req) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new CinchError("UNAUTHORIZED", "Missing bearer token", 401);
    }
    return {
      user: null,
      message: "Auth lands in Phase 1",
    };
  });

  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof CinchError) {
      return reply.status(error.status).send({
        error: { code: error.code, message: error.message, details: error.details },
      });
    }
    app.log.error(error);
    return reply.status(500).send({
      error: { code: "INTERNAL", message: "Internal error" },
    });
  });

  return app;
}
