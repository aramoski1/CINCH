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
