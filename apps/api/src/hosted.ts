import { config as loadDotenv } from "dotenv";
import { resolve } from "node:path";
import type { FastifyInstance } from "fastify";
import { loadEnv } from "./config/env";
import { buildApp } from "./app";

loadDotenv({ path: resolve(process.cwd(), ".env.local") });
loadDotenv({ path: resolve(process.cwd(), "../api/.env.local") });
loadDotenv({ path: resolve(process.cwd(), "../../apps/api/.env.local") });

function withVercelUrls(raw: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const host = raw.VERCEL_PROJECT_PRODUCTION_URL || raw.VERCEL_URL;
  if (!host) return raw;
  const origin = host.startsWith("http") ? host : `https://${host}`;
  return {
    ...raw,
    API_BASE_URL: origin,
    WEB_BASE_URL: origin,
  };
}

let appPromise: Promise<FastifyInstance> | undefined;

export function getHostedApp(): Promise<FastifyInstance> {
  appPromise ??= (async () => {
    const env = loadEnv(withVercelUrls(process.env));
    const app = await buildApp(env);
    await app.ready();
    return app;
  })();
  return appPromise;
}
