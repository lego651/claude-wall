# Production runbooks (PROP-024)

Operational procedures for production incidents. For alert delivery (email), see the **Configure** section below.

---

## Configure (alerts)

Alerts are sent **by email** via Resend to `ALERT_EMAIL` (or `ALERTS_TO`). Severity: **INFO**, **WARNING**, **CRITICAL**. If `ALERT_EMAIL` or `RESEND_API_KEY` is not set, alerts are only logged.

- **ALERT_EMAIL** / **ALERTS_TO**: recipient for all alerts.
- **RESEND_API_KEY**: required for sending.

---

## 1. Arbiscan API down

**Symptoms:** Payout sync fails; API returns timeouts or 5xx; circuit breaker opens (CRITICAL email); leaderboard 1d data missing or stale.

**Diagnosis:**
- Check [Arbiscan status](https://arbiscan.io/) and [Arbitrum status](https://arbitrum.io/status).
- Admin dashboard → Arbiscan usage (calls, % of limit). See [ARBISCAN-USAGE.md](./ARBISCAN-USAGE.md).
- Logs: look for `Rate limit`, `Query timeout`, `Circuit breaker opened`, `Invalid API key`.

**Mitigation:**
1. If **outage**: Wait for Arbiscan/Arbitrum recovery. Payout sync will resume on next cron run; 1d leaderboard will backfill as sync runs.
2. If **rate limit** (429 or usage ≥100%): Wait for UTC midnight reset, or reduce sync frequency / number of addresses. Optionally rotate or add API key (check Arbiscan plan).
3. If **invalid key**: Rotate `ARBISCAN_API_KEY` in Vercel (and any CI secrets). Redeploy or re-run sync.
4. If **circuit breaker open**: After 60s one request is tried (HALF_OPEN). If it succeeds, traffic resumes. Optional: redeploy to reset the circuit.

**Prevention:** Monitor usage (admin dashboard); add delay between addresses in sync if near limit.

---

## 2. Supabase outage

**Symptoms:** API routes return 500 or "Database timeout"; admin metrics fail; payout sync can’t read/write `recent_payouts` or `firms`.

**Diagnosis:**
- [Supabase status](https://status.supabase.com/).
- Logs: `Query timeout`, Supabase client errors, connection refused.

**Fallback and recovery:**
1. **Read-only APIs (1d period):** If Supabase is down, list and chart APIs may fall back to file-based data for 7d/30d/12m; 1d (Supabase-backed) will fail or return empty until Supabase is back.
2. **Payout sync:** Sync will fail for DB operations; retry after Supabase recovers. No automatic fallback for writing payouts.
3. **Manual recovery:** After outage, run sync manually (trigger cron or `POST /api/cron/sync-payouts` with auth) to backfill any missed payouts from the outage window.
4. **Connection/timeout:** We use `withQueryGuard` (5s timeout). If timeouts persist, check Supabase project health, connection pooler, and [SUPABASE-TIMEOUT.md](./SUPABASE-TIMEOUT.md).

---

## 3. File size exceeded

**Symptoms:** Slow API responses, Vercel 10s timeouts, or file-size check failing in CI (≥10 MB).

**Diagnosis:**
- Run: `node scripts/check-file-sizes.js --format=markdown`.
- CI: `.github/workflows/monitor-file-sizes.yml` fails if any file ≥10 MB.

**Mitigation:**
- **≥5 MB (timeout risk):** See [FILE-SIZE-MITIGATION.md](./FILE-SIZE-MITIGATION.md). Consider splitting by month, archiving old months, or moving large datasets to Supabase storage.
- **≥10 MB:** Fix before merging. Reduce file size (e.g. trim history, move to DB or object storage) so CI passes.
- **Migration to Supabase storage:** If you move payout history to Supabase (or object storage), update `loadMonthlyData` and related loaders to read from the new source; then deprecate or remove large JSON files.

---

## 4. Data overlap issues

**Symptoms:** Validate Data Overlap workflow fails (>5% of Supabase rows for a firm/month missing from JSON).

**Diagnosis:**
- Run: `npx tsx scripts/validate-data-overlap.js` (optionally `--month YYYY-MM`).
- Logs show firm/month and sample missing tx hashes.

**Reconciliation:** See [DATA-OVERLAP-RESOLUTION.md](./DATA-OVERLAP-RESOLUTION.md).

1. Re-run historical sync for the affected firm/month.
2. Re-run validation after sync. If Supabase had newer data than the last JSON update, the next sync usually fixes it.
3. If specific txs are missing from JSON, re-sync that firm or (last resort) manually add to JSON; prefer re-sync.
4. Do not relax the 5% threshold without fixing data or sync first.

---

## 5. Rate limit exceeded

**Symptoms:** Arbiscan returns 429; usage tracker at 80/90/95% (logs or email alerts if wired).

**Mitigation:**
- **Short term:** Wait for UTC midnight reset; avoid re-running sync repeatedly.
- **Upgrade or reduce frequency:** Consider higher-tier Arbiscan plan for more calls/day, or reduce cron frequency / number of firms or addresses per run.
- **Sync tuning:** Increase delay between addresses in payout sync to stay under the daily limit. Monitor via admin dashboard.

See [ARBISCAN-USAGE.md](./ARBISCAN-USAGE.md).

---

## 6. Sync failures

**Symptoms:** Payout sync (cron or manual) reports errors for one or many firms; leaderboard data stale.

**Mitigation:**
1. **Manual trigger:** Call `POST /api/cron/sync-payouts` with the same auth as your cron (e.g. `CRON_SECRET` header). Or run the sync job from GitHub Actions (workflow_dispatch) if you use it.
2. **Logs:** Check which firms failed and why (e.g. Arbiscan rate limit, Supabase timeout, invalid address).
3. **Single firm:** If a script supports `--firm <id>`, re-run sync for that firm only.
4. **CI/GitHub Actions:** Ensure `ARBISCAN_API_KEY`, `SUPABASE_*`, and cron secrets are set in the environment. Re-run the workflow after fixing env or upstream (Arbiscan/Supabase).

---

## 7. Database performance

**Symptoms:** Slow API responses; logs show "Query timeout" or slow-query warnings (≥1s).

**Steps:**
1. **Indexes:** Ensure [DATABASE-OPTIMIZATION.md](./DATABASE-OPTIMIZATION.md) indexes are applied: `migrations/12_add-indexes.sql` (recent_payouts, trustpilot_reviews, weekly_incidents).
2. **Audit:** In Supabase SQL Editor, run the index audit query in that doc to confirm indexes exist.
3. **Query optimization:** Use Supabase Dashboard → Logs or slow-query logs from `withQueryGuard` to find slow queries; add indexes or narrow filters (e.g. time range, firm_id).
4. **Pooling and timeouts:** We use Supabase’s managed pooler. Timeouts are 5s in `withQueryGuard`; increase only if needed and after optimizing queries.

See [SUPABASE-TIMEOUT.md](./SUPABASE-TIMEOUT.md).
