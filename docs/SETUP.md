# Cinch — v0 setup

Three credentials: Supabase, Anthropic, GitHub. About 45 minutes end to end, most of it waiting on the Supabase project to provision.

Run everything from inside your `Cinch` folder.

---

## Step 1 — Tooling

```bash
node -v                                   # need 20 or 22
corepack enable && corepack prepare pnpm@9 --activate
brew install supabase/tap/supabase
```

Xcode from the App Store too, if it isn't already there. You need it for the simulator, and the download is large enough that starting it now saves you an hour later.

## Step 2 — Git and `.gitignore`, before any keys exist

```bash
cd ~/path/to/Cinch
git init
# copy lean-setup/gitignore -> .gitignore
git add .gitignore && git commit -m "chore: gitignore"
```

Do this first. A service role key in your initial commit means rotating Supabase credentials before you've written a line of product code.

## Step 3 — Supabase

1. supabase.com → **New project**. Region `us-east-1`. Save the database password somewhere real — it isn't shown again.
2. Wait for provisioning (2–3 min).
3. **Settings › Data API** → copy Project URL, `anon` key, `service_role` key, JWT secret.
4. **Settings › Database › Connection string** → copy both the **Session pooler** (port 6543) and **Direct** (port 5432) strings. Substitute your password into each.
5. **Authentication › Providers** → enable **Email**, and turn **Confirm email** off for now. That gives you 6-digit OTP sign-in with no Twilio.
6. **Storage** → create a bucket named `evidence`. **Private**, not public.

## Step 4 — Anthropic

console.anthropic.com → API Keys. Create **two**:

- `cinch-api` → goes in `apps/api/.env.local`
- `cinch-agent` → goes in the root `.env`, for Claude Code

Two keys so you can revoke the agent's access without taking the app down.

## Step 5 — GitHub

Settings › Developer settings › **Fine-grained tokens**. Scope it to the single `cinch` repo with `contents: read+write`, `pull requests: read+write`, `actions: read`. Nothing else. No org access, no delete, no admin.

Then:

```bash
gh repo create cinch --private --source=. --remote=origin
```

## Step 6 — Local secrets

```bash
for i in 1 2 3 4; do openssl rand -base64 32; done
```

Four values, in order, into `SESSION_SECRET`, `ENCRYPTION_KEY`, `INTERNAL_ADMIN_TOKEN`, `IDEMPOTENCY_SALT`.

## Step 7 — Scaffold

```bash
mkdir -p apps/api apps/mobile apps/web
mkdir -p packages/shared packages/database packages/commitments packages/ai packages/adapters packages/api-client packages/ui packages/config
mkdir -p docs

cat > package.json << 'EOF'
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
EOF

cat > pnpm-workspace.yaml << 'EOF'
packages:
  - "apps/*"
  - "packages/*"
EOF

cat > turbo.json << 'EOF'
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**"] },
    "dev": { "cache": false, "persistent": true },
    "typecheck": { "dependsOn": ["^build"] },
    "test": { "dependsOn": ["^build"] }
  }
}
EOF

pnpm install
```

Note `packages/adapters` — that's the only place in the repo allowed to import a vendor SDK. It's what makes the deferred integrations cheap to add later.

## Step 8 — Env files into place

```
Cinch/.env                        ← lean-setup/.env.example
Cinch/apps/api/.env.local         ← lean-setup/api/.env.local.example
Cinch/apps/web/.env.local         ← lean-setup/web/.env.local.example
Cinch/apps/mobile/.env.local      ← lean-setup/mobile/.env.local.example
```

Keep the `.example` copies next to the filled ones and commit only those. They're how the agent learns which variables exist without seeing values.

## Step 9 — Link Supabase and prove the connection

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase init
psql "$DIRECT_URL" -c "select version();"
```

If that last command hangs, you've got the pooler URL in `DIRECT_URL`. It has to be port **5432**. pg-boss and migrations both break on the pooler, and the failures look like intermittent Supabase problems rather than a config error — this is the single most common way to lose a day here.

## Step 10 — Drop in the PRD and commit

```bash
# PRD already lives at docs/prd.md
git add -A && git status
```

**Read that status output.** If any `.env` or `.env.local` appears, stop and fix `.gitignore`.

```bash
git commit -m "chore: scaffold + prd" && git push -u origin main
```

---

## Step 11 — Hand it to Claude Code

```bash
claude
```

Then paste this:

> Read `docs/prd.md`. **Appendix A governs this build** — it overrides §25.1, §36 Phases 0–4, and the auth parts of §26.
>
> Implement **Phase 0 only**.
>
> Scope: `packages/config` (shared tsconfig, eslint), `packages/shared` (base types plus the port interfaces from Appendix A.4), `packages/database` (Supabase client factory, generated types), `packages/adapters` (empty, with a README stating it is the only package permitted to import vendor SDKs), and `apps/api` as a Fastify server with `/health` and a Zod env schema at `src/config/env.ts` that validates on boot and throws on anything missing. Add a GitHub Actions workflow running typecheck and test.
>
> Constraints from A.7: do not add any package requiring a new API key. Do not implement `StripeStakeProvider`. Do not import a vendor SDK outside `packages/adapters`.
>
> Stop when `pnpm typecheck` and `pnpm test` pass and `curl localhost:4000/health` returns 200. Summarize and wait.

When that's green, continue phase by phase with the same shape — one phase per instruction, an explicit stop condition, and the A.7 constraints repeated each time.

---

## Two things worth knowing going in

**Give it one phase at a time.** An agent handed a 46,000-word PRD and told to build will scaffold all twelve phases shallowly. You get files everywhere that look like progress and compile to nothing. The stop condition in each prompt is what prevents that.

**Phases 5 and 6 are yours.** Background geofencing, HealthKit, and DeviceActivity are native module work that has to be tested on a physical phone by walking into an actual building. Agents write plausible-looking code for these that fails silently in the background — which is the worst possible failure mode for a product whose entire value is passive verification. Budget real time for those two phases and expect to write them yourself.
