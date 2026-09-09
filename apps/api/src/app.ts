import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { CinchError } from "@cinch/shared";
import { ZodError } from "zod";
import type { Env } from "./config/env";
import { registerAuth } from "./routes/auth";
import { registerCommitments } from "./routes/commitments";
import { registerSocial } from "./routes/social";

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

  await registerAuth(app);
  await registerCommitments(app, env);
  await registerSocial(app, env);

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
