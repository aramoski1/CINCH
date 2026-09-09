import { spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(resolve(process.cwd(), "../api/.env.local"));
loadEnvFile(resolve(process.cwd(), "../../apps/api/.env.local"));

const KEYS = [
  "LOG_LEVEL",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_JWT_SECRET",
  "SUPABASE_STORAGE_BUCKET",
  "DATABASE_URL",
  "DIRECT_URL",
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_MODEL",
  "ANTHROPIC_MAX_TOKENS",
  "AI_PARSE_TIMEOUT_MS",
  "SESSION_SECRET",
  "ENCRYPTION_KEY",
  "INTERNAL_ADMIN_TOKEN",
  "IDEMPOTENCY_SALT",
  "PGBOSS_SCHEMA",
  "SCHEDULER_TICK_SECONDS",
  "STAKE_CURRENCY",
  "MIN_STAKE_MINOR",
  "MAX_STAKE_MINOR",
  "MAX_WEEKLY_STAKE_MINOR",
  "SETTLEMENT_DELAY_MINUTES",
  "UNDO_WINDOW_SECONDS",
  "FREE_VOIDS_PER_30_DAYS",
  "FEATURE_PAYMENTS_ENABLED",
  "FEATURE_VERIFICATION_ENABLED",
  "FEATURE_AI_COMPOSER_ENABLED",
  "FEATURE_SETTLEMENT_PAUSED",
];

function addEnv(name, value) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(
      "npx",
      ["vercel", "env", "add", name, "production,preview,development", "--force", "--yes", "--sensitive"],
      { stdio: ["pipe", "pipe", "pipe"], shell: true },
    );
    child.stdin.write(value);
    child.stdin.end();
    let err = "";
    child.stderr.on("data", (chunk) => {
      err += String(chunk);
    });
    child.on("close", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${name} failed (${code}): ${err.slice(0, 240)}`));
    });
  });
}

const REQUIRED = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_JWT_SECRET",
  "DATABASE_URL",
  "DIRECT_URL",
  "ANTHROPIC_API_KEY",
  "SESSION_SECRET",
  "ENCRYPTION_KEY",
  "INTERNAL_ADMIN_TOKEN",
  "IDEMPOTENCY_SALT",
];

const missing = REQUIRED.filter((key) => !process.env[key]?.trim());
if (missing.length) {
  throw new Error(`Missing local keys: ${missing.join(", ")}`);
}

for (const key of KEYS) {
  const value = process.env[key]?.trim();
  if (!value) continue;
  await addEnv(key, value);
  process.stdout.write(`set ${key}\n`);
}
