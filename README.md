# Cinch

Start with `docs/SETUP.md`. Then `docs/prd.md` -- **Appendix A governs the v0 build.**

v0 uses three credentials: Supabase, Anthropic, GitHub. Nothing else.

## Order of operations
1. Create the Supabase project, Anthropic keys, and GitHub PAT yourself
2. Fill in `.env` and the three `.env.local` files
3. `pnpm install`
4. `git add -A && git status` -- confirm NO .env or .env.local appear
5. Hand Phase 0 to the agent, one phase at a time
