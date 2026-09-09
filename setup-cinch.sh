#!/bin/bash
# Cinch scaffold builder.
# Put this file inside your CINCH folder, then run:   bash setup-cinch.sh
set -e
echo "Building Cinch scaffold in $(pwd)"
mkdir -p apps/api apps/web apps/mobile docs
for d in shared database commitments ai adapters api-client ui config; do mkdir -p "packages/$d"; done

cat > .gitignore << 'CINCH_EOF'
node_modules/
.turbo/
dist/
.next/
.expo/
.env
.env.*
!.env.example
!.env.local.example
*.pem
*.p8
*.p12
*.mobileprovision
.secrets/
.DS_Store
CINCH_EOF

cat > .env << 'CINCH_EOF'
# Repo root .env — TOOLING ONLY. Not read by the app.

GITHUB_TOKEN=ghp_        # fine-grained PAT, THIS repo only:
                         # contents:rw, pull_requests:rw, actions:read
                         # no org scope, no delete, no admin
GITHUB_OWNER=aramoski1
GITHUB_REPO=cinch

ANTHROPIC_API_KEY=sk-ant-   # separate key from the API's, so either can be revoked alone

SUPABASE_ACCESS_TOKEN=      # supabase CLI
SUPABASE_PROJECT_REF=
CINCH_EOF

cat > apps/api/.env.local << 'CINCH_EOF'
# apps/api/.env.local — SERVER ONLY
# v0 lean build. Three external services. Nothing else.

NODE_ENV=development
PORT=4000
LOG_LEVEL=debug
API_BASE_URL=http://localhost:4000
WEB_BASE_URL=http://localhost:3000

# ---- SUPABASE (required) -------------------------------------
# Dashboard > Project Settings > Data API
SUPABASE_URL=https://REPLACE.supabase.co
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=
SUPABASE_STORAGE_BUCKET=evidence

# Dashboard > Project Settings > Database > Connection string
# Pooler (6543) for queries:
DATABASE_URL=postgresql://postgres.REPLACE:PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
# Direct (5432) for migrations AND for pg-boss:
DIRECT_URL=postgresql://postgres.REPLACE:PASSWORD@aws-0-us-east-1.pooler.supabase.com:5432/postgres

# ---- ANTHROPIC (required) ------------------------------------
ANTHROPIC_API_KEY=sk-ant-
ANTHROPIC_MODEL=claude-sonnet-4-6
ANTHROPIC_MAX_TOKENS=1024
AI_PARSE_TIMEOUT_MS=2500

# ---- LOCAL SECRETS (required) --------------------------------
# openssl rand -base64 32   (run four times)
SESSION_SECRET=
ENCRYPTION_KEY=
INTERNAL_ADMIN_TOKEN=
IDEMPOTENCY_SALT=

# ---- QUEUE ---------------------------------------------------
# pg-boss runs on Postgres. No Redis. Uses DIRECT_URL.
PGBOSS_SCHEMA=pgboss
SCHEDULER_TICK_SECONDS=15

# ---- PRODUCT LIMITS (§7.6, §22.4) ----------------------------
# v0 is POINTS ONLY. These become dollar limits at Phase 7.
STAKE_CURRENCY=POINTS
MIN_STAKE_MINOR=500
MAX_STAKE_MINOR=50000
MAX_WEEKLY_STAKE_MINOR=100000
SETTLEMENT_DELAY_MINUTES=60
UNDO_WINDOW_SECONDS=300
FREE_VOIDS_PER_30_DAYS=1

# ---- KILL SWITCHES (§30.4) -----------------------------------
FEATURE_PAYMENTS_ENABLED=false
FEATURE_VERIFICATION_ENABLED=false
FEATURE_AI_COMPOSER_ENABLED=true
FEATURE_SETTLEMENT_PAUSED=false

# ==============================================================
# DEFERRED — do not fill, do not let an agent add these.
# See Appendix A.3 for what replaces each and when it returns.
# ==============================================================
# TWILIO_*                 -> Supabase email OTP + OS share sheet   (Phase 6)
# REDIS_URL                -> pg-boss                               (~50k deadlines)
# STRIPE_*                 -> PointsStakeProvider                   (Phase 7, post-memo)
# GOOGLE_PLACES_API_KEY    -> seeded places table                   (Phase 4)
# MAPBOX_*                 -> react-native-maps                     (later)
# POSTHOG_*                -> analytics_events table                (first A/B test)
# SENTRY_DSN               -> error_events table                    (before TestFlight)
# EXPO_ACCESS_TOKEN        -> local expo run:ios                    (first EAS build)
CINCH_EOF

cat > apps/web/.env.local << 'CINCH_EOF'
# apps/web/.env.local — Next.js invite pages + ops console

NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000

NEXT_PUBLIC_SUPABASE_URL=https://REPLACE.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
INTERNAL_ADMIN_TOKEN=

# /i/:code renders server-side with NO signup gate (§11.4).
# Use a narrowly scoped service-role read. Never relax RLS to make it work.
CINCH_EOF

cat > apps/mobile/.env.local << 'CINCH_EOF'
# apps/mobile/.env.local — Expo
# EXPO_PUBLIC_* IS COMPILED INTO THE SHIPPED BUNDLE. No secrets here, ever.

EXPO_PUBLIC_ENV=development
EXPO_PUBLIC_API_BASE_URL=http://localhost:4000
# Physical device: use your Mac's LAN IP, not localhost.
# EXPO_PUBLIC_API_BASE_URL=http://192.168.1.XXX:4000

EXPO_PUBLIC_SUPABASE_URL=https://REPLACE.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=      # safe ONLY because RLS is on every table

EXPO_PUBLIC_APP_SCHEME=cinch

# Maps: react-native-maps uses Apple Maps on iOS. No key needed.
# Push: Expo Push needs no token in development.
CINCH_EOF

cat > package.json << 'CINCH_EOF'
{
  "name": "cinch",
  "private": true,
  "packageManager": "pnpm@9.0.0",
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "typecheck": "turbo typecheck",
    "test": "turbo test",
    "db:migrate": "supabase db push",
    "db:types": "supabase gen types typescript --linked > packages/database/src/types.ts"
  },
  "devDependencies": { "turbo": "^2.1.0", "typescript": "^5.6.0" }
}
CINCH_EOF

cat > pnpm-workspace.yaml << 'CINCH_EOF'
packages:
  - "apps/*"
  - "packages/*"
CINCH_EOF

cat > turbo.json << 'CINCH_EOF'
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**"] },
    "dev": { "cache": false, "persistent": true },
    "typecheck": { "dependsOn": ["^build"] },
    "test": { "dependsOn": ["^build"] }
  }
}
CINCH_EOF

cat > packages/adapters/README.md << 'CINCH_EOF'
# packages/adapters

**This is the only package in the repo permitted to import a vendor SDK.**

Everything else consumes external services through the port interfaces in
`packages/shared/ports/` (PRD Appendix A.4). That single rule is what makes the
deferred integrations in Appendix A.3 -- Twilio, Stripe, Redis, Google Places,
Mapbox, PostHog, Sentry -- a one-file swap later instead of a refactor.

v0 implementations:
- PointsStakeProvider   (no Stripe)
- PgBossQueue           (no Redis)
- SeededPlaceProvider   (no Google Places)
- ExpoNotifier          (no Twilio)
- TableAnalytics        (no PostHog)
CINCH_EOF

cat > README.md << 'CINCH_EOF'
# Cinch

Start with `docs/SETUP.md`. Then `docs/prd.md` -- **Appendix A governs the v0 build.**

v0 uses three credentials: Supabase, Anthropic, GitHub. Nothing else.

## Order of operations
1. Create the Supabase project, Anthropic keys, and GitHub PAT yourself
2. Fill in `.env` and the three `.env.local` files
3. `pnpm install`
4. `git add -A && git status` -- confirm NO .env or .env.local appear
5. Hand Phase 0 to the agent, one phase at a time
CINCH_EOF

# Committable copies, values stripped
sed 's/=.*/=/' .env > .env.example
sed 's/=.*/=/' apps/api/.env.local > apps/api/.env.local.example
sed 's/=.*/=/' apps/web/.env.local > apps/web/.env.local.example
sed 's/=.*/=/' apps/mobile/.env.local > apps/mobile/.env.local.example

echo ""
echo "Done. Structure created:"
ls -la
echo ""
echo "NEXT:"
echo "  1. Move cinch-prd.md into docs/prd.md"
echo "  2. Fill in Supabase + Anthropic keys in apps/api/.env.local"
echo "  3. git init && git add .gitignore && git commit -m \"chore: gitignore\""
echo "  4. pnpm install"
