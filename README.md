# Cinch

Keep your word. A friend holds you to it. Points, not money.

v0 uses three credentials: Supabase, Anthropic, GitHub. Nothing else.
Appendix A in `docs/prd.md` governs the build.

The live product is the phone web app: **Now / Promise / You**.

## Run it locally

```bash
corepack pnpm install
corepack pnpm --filter @cinch/api start
corepack pnpm --filter @cinch/web dev
```

- Web: http://localhost:3000
- API: http://localhost:4000

The API is Fastify. It is not on Vercel. Vercel only hosts the website.
Until the API has a public URL, sign-in only works on the machine running port 4000.

## Setup

First-time keys and Supabase: `docs/SETUP.md`.

Never put secrets in `.env.example` or commit `.env` / `.env.local`.
