# Database optimization (indexes)

Indexes added in **PROP-014** to speed up Supabase queries used by the propfirms API and sync jobs.

## Migration

- **File:** `supabase/migrations/002_add_indexes.sql`
- **Apply:** Run against your Supabase project (staging/production) when the tables exist.

### Using Supabase CLI

```bash
supabase db push
# or link and push:
# supabase link --project-ref <ref>
# supabase db push
```

### Manual run

In Supabase Dashboard → SQL Editor, paste and run the contents of `supabase/migrations/002_add_indexes.sql`.

## Indexes added

| Table               | Index name                           | Columns                                      | Use case |
|---------------------|--------------------------------------|----------------------------------------------|----------|
| `recent_payouts`    | `idx_recent_payouts_firm_timestamp`   | `(firm_id, timestamp DESC)`                  | Single-firm payouts (latest-payouts), list 1d by firm |
| `recent_payouts`    | `idx_recent_payouts_timestamp`        | `(timestamp DESC)`                           | Time-range filters, cleanup old rows |
| `trustpilot_reviews`| `idx_trustpilot_firm_date`            | `(firm_id, review_date DESC)`                | Signals, digest, incidents source links |
| `weekly_incidents`  | `idx_weekly_incidents_firm_year_week` | `(firm_id, year DESC, week_number DESC)`     | GET incidents by firm, incident-aggregator |

**Note:** If you applied `database/alpha-intelligence-schema.sql` earlier, `trustpilot_reviews` and `weekly_incidents` may already have equivalent indexes (`idx_trustpilot_firm_date`, `idx_incidents_firm_week`). The migration uses `CREATE INDEX IF NOT EXISTS`, so re-running is safe.

## Expected speedups

- **recent_payouts** (list by firm + time, order by timestamp): ~10x faster (e.g. 500ms → ~50ms) when tables grow.
- **trustpilot_reviews** (by firm_id + review_date): ~6x faster (e.g. 200ms → ~30ms).
- **weekly_incidents** (by firm_id + year/week): avoids full table scan on incidents listing.

## Auditing existing indexes

In Supabase SQL Editor:

```sql
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('recent_payouts', 'trustpilot_reviews', 'weekly_incidents')
ORDER BY tablename, indexname;
```

## Benchmarking (before/after)

1. Run the migration in staging.
2. Capture query times for:
   - `GET /api/v2/propfirms?period=1d` (uses `recent_payouts`).
   - `GET /api/v2/propfirms/[id]/latest-payouts` (uses `recent_payouts`).
   - `GET /api/v2/propfirms/[id]/signals` (uses `trustpilot_reviews`).
   - `GET /api/v2/propfirms/[id]/incidents` (uses `weekly_incidents`).
3. Compare with pre-migration timings (or use `EXPLAIN (ANALYZE, BUFFERS)` in SQL for the same queries).

## Deploy to production

After staging checks and benchmarks:

1. Backup (Supabase dashboard or `pg_dump` if needed).
2. Run the migration in production (Supabase CLI or SQL Editor).
3. Re-run the same API or SQL benchmarks to confirm improvement.
