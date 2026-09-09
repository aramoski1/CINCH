import { z } from "zod";

const FORBIDDEN_VENDOR_KEYS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_PUBLISHABLE_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "REDIS_URL",
  "GOOGLE_PLACES_API_KEY",
  "MAPBOX_ACCESS_TOKEN",
  "MAPBOX_TOKEN",
  "POSTHOG_KEY",
  "POSTHOG_API_KEY",
  "SENTRY_DSN",
] as const;

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  API_BASE_URL: z.string().url(),
  WEB_BASE_URL: z.string().url(),

  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  SUPABASE_JWT_SECRET: z.string().min(16),
  SUPABASE_STORAGE_BUCKET: z.string().default("evidence"),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),

  ANTHROPIC_API_KEY: z.string().min(20),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-4-6"),
  ANTHROPIC_MAX_TOKENS: z.coerce.number().int().positive().default(1024),
  AI_PARSE_TIMEOUT_MS: z.coerce.number().int().positive().default(2500),

  SESSION_SECRET: z.string().min(16),
  ENCRYPTION_KEY: z.string().min(16),
  INTERNAL_ADMIN_TOKEN: z.string().min(16),
  IDEMPOTENCY_SALT: z.string().min(16),

  PGBOSS_SCHEMA: z.string().default("pgboss"),
  SCHEDULER_TICK_SECONDS: z.coerce.number().int().positive().default(15),

  STAKE_CURRENCY: z.literal("POINTS").default("POINTS"),
  MIN_STAKE_MINOR: z.coerce.number().int().default(500),
  MAX_STAKE_MINOR: z.coerce.number().int().default(50000),
  MAX_WEEKLY_STAKE_MINOR: z.coerce.number().int().default(100000),
  SETTLEMENT_DELAY_MINUTES: z.coerce.number().int().default(60),
  UNDO_WINDOW_SECONDS: z.coerce.number().int().default(300),
  FREE_VOIDS_PER_30_DAYS: z.coerce.number().int().default(1),

  FEATURE_PAYMENTS_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  FEATURE_VERIFICATION_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  FEATURE_AI_COMPOSER_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  FEATURE_SETTLEMENT_PAUSED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

export type Env = z.infer<typeof envSchema>;

function assertNoForbiddenVendors(raw: NodeJS.ProcessEnv): void {
  const set = FORBIDDEN_VENDOR_KEYS.filter((key) => {
    const value = raw[key];
    return typeof value === "string" && value.trim().length > 0;
  });
  if (set.length > 0) {
    throw new Error(
      `Forbidden vendor credentials set: ${set.join(", ")}. v0 allows only Supabase, Anthropic, and GitHub.`,
    );
  }
}

export function loadEnv(raw: NodeJS.ProcessEnv = process.env): Env {
  assertNoForbiddenVendors(raw);
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment: ${issues}`);
  }
  if (parsed.data.FEATURE_PAYMENTS_ENABLED) {
    throw new Error("FEATURE_PAYMENTS_ENABLED must stay false until Phase 7 (no Stripe).");
  }
  const direct = parsed.data.DIRECT_URL;
  if (!direct.includes(":5432") && !direct.includes("port=5432")) {
    throw new Error("DIRECT_URL must use port 5432 (pg-boss and migrations).");
  }
  return parsed.data;
}

export const testEnv = {
  NODE_ENV: "test",
  PORT: "4000",
  LOG_LEVEL: "error",
  API_BASE_URL: "http://localhost:4000",
  WEB_BASE_URL: "http://localhost:3000",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_ANON_KEY: "test-anon-key-which-is-long",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key-long",
  SUPABASE_JWT_SECRET: "test-jwt-secret-16+",
  SUPABASE_STORAGE_BUCKET: "evidence",
  DATABASE_URL:
    "postgresql://postgres:postgres@127.0.0.1:6543/postgres?pgbouncer=true",
  DIRECT_URL: "postgresql://postgres:postgres@127.0.0.1:5432/postgres",
  ANTHROPIC_API_KEY: "sk-ant-test-key-which-is-long",
  ANTHROPIC_MODEL: "claude-sonnet-4-6",
  ANTHROPIC_MAX_TOKENS: "1024",
  AI_PARSE_TIMEOUT_MS: "2500",
  SESSION_SECRET: "session-secret-16chars",
  ENCRYPTION_KEY: "encryption-key-16ch",
  INTERNAL_ADMIN_TOKEN: "admin-token-16chars",
  IDEMPOTENCY_SALT: "idempotency-salt-16",
  STAKE_CURRENCY: "POINTS",
  FEATURE_PAYMENTS_ENABLED: "false",
  FEATURE_VERIFICATION_ENABLED: "false",
  FEATURE_AI_COMPOSER_ENABLED: "true",
  FEATURE_SETTLEMENT_PAUSED: "false",
} satisfies Record<string, string>;
