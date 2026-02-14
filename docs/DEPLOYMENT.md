# Production deployment checklist (PROP-026)

Execute this checklist before and during production deployment.

---

## 1. Environment variables

Set in Vercel (Project → Settings → Environment Variables) for **Production** (and optionally Preview):

| Variable | Required | Notes |
|----------|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-side operations, cron, sync |
| `ARBISCAN_API_KEY` | Yes | Payout sync and on-chain data |
| `RESEND_API_KEY` | Yes | Emails (digest, alerts) |
| `KV_REST_API_URL` | Yes* | Vercel KV (caching). *Required for cache; app works with cache disabled |
| `KV_REST_API_TOKEN` | Yes* | Vercel KV token |
| `SENTRY_DSN` | Recommended | Error tracking (Sentry) |
| `ALERT_EMAIL` or `ALERTS_TO` | Recommended | Alert notifications by email |
| `STRIPE_SECRET_KEY` | If using Stripe | Payments |
| `STRIPE_WEBHOOK_SECRET` | If using Stripe | Webhook verification |
| `OPENAI_API_KEY` | If using classification | Review classification |

- [ ] All required variables set in Vercel Production
- [ ] No secrets committed to repo; use Vercel env or CI secrets

*(Note: SLACK_WEBHOOK_URL is optional; we use email alerts via ALERT_EMAIL.)*

---

## 2. Database

- [ ] **Indexes:** Migration `supabase/migrations/002_add_indexes.sql` applied (see [DATABASE-OPTIMIZATION.md](./DATABASE-OPTIMIZATION.md)). In Supabase Dashboard → SQL Editor, run the migration if not using Supabase CLI.
- [ ] **RLS:** Row Level Security policies configured as required for your tables (e.g. `profiles`, `recent_payouts` access).
- [ ] **Backup:** Supabase project has Point-in-Time Recovery / backups enabled (Supabase Dashboard → Project Settings → Database).

---

## 3. Tests

- [ ] **Unit + integration:** `npm run test:coverage` passes. All Jest tests green.
- [ ] **Coverage:** Current threshold is >0%; goal is ≥90% over time. Check report in `coverage/` after run.
- [ ] **E2E:** `npm run test:e2e` passes (or run against staging URL with `PLAYWRIGHT_BASE_URL`). Requires app running or webServer will start it.

---

## 4. Monitoring

- [ ] **Sentry:** Integrated (`@sentry/nextjs`); `SENTRY_DSN` set in Vercel. Verify errors appear in Sentry dashboard.
- [ ] **Vercel Analytics:** Enabled in Vercel project (Settings → Analytics). `<Analytics />` is in the app layout.
- [ ] **Alerts:** `ALERT_EMAIL` set so critical alerts (e.g. Arbiscan circuit breaker) are received. Optional: wire more alerts (see [RUNBOOKS.md](./RUNBOOKS.md)).

---

## 5. Performance

- [ ] **Caching:** Vercel KV configured (`KV_REST_API_URL`, `KV_REST_API_TOKEN`). List and chart endpoints use cache.
- [ ] **Load tests:** Run `k6 run tests/load/propfirms-list.js` and `tests/load/firm-detail.js` against staging. Target: P95 <500ms for 1d list (see [PERFORMANCE-BASELINES.md](./PERFORMANCE-BASELINES.md)). Fix or document if thresholds fail.

---

## 6. Documentation

- [ ] **README:** Project README updated with setup, env vars, and how to run tests.
- [ ] **Runbooks:** [RUNBOOKS.md](./RUNBOOKS.md) and [INCIDENT-RESPONSE.md](./INCIDENT-RESPONSE.md) complete; contact table filled.
- [ ] **API:** Public API behavior documented (e.g. v2 propfirms endpoints in README or API doc).

---

## 7. Deploy

- [ ] **Staging:** Deploy to Vercel preview (e.g. branch `staging` or PR). Confirm build and runtime work.
- [ ] **Smoke tests on staging:** Run E2E or manual smoke: load `/propfirms`, switch period, open a firm detail page. Optionally run `npm run test:e2e` with `PLAYWRIGHT_BASE_URL=<staging-url>`.
- [ ] **Production:** Deploy to production (e.g. merge to `main` or Vercel production).
- [ ] **Post-deploy:** Complete [POST-DEPLOY-VERIFICATION.md](./POST-DEPLOY-VERIFICATION.md).
