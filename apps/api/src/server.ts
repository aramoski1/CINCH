import { config as loadDotenv } from "dotenv";
import { resolve } from "node:path";
import { loadEnv } from "./config/env";
import { buildApp } from "./app";

loadDotenv({ path: resolve(process.cwd(), ".env.local") });
loadDotenv({ path: resolve(process.cwd(), "../../.env") });

const env = loadEnv();
const app = await buildApp(env);
await app.listen({ port: env.PORT, host: "0.0.0.0" });
