# Data overlap validation and resolution (PROP-018)

We compare **JSON monthly payout files** (`data/payouts/{firmId}/{YYYY-MM}.json`) with **Supabase `recent_payouts`** for the same firm and month. Supabase only keeps the last 24 hours of payouts, so the comparison is meaningful mainly for the **current month** (where both may have data).

## What we validate

- **missingInJson**: Transaction hashes that exist in Supabase for that firm/month but are **not** in the JSON file. This suggests the JSON file is stale or the historical sync didn’t include these rows.
- **missingInSupabase**: Transaction hashes in the JSON file but not in Supabase. Expected for older dates in the month, since Supabase only retains 24h.

## Failure condition

The workflow **fails** if, for any firm/month, more than **5%** of Supabase rows are missing from JSON:

- `missingInJson.length / supabaseCount > 0.05` when `supabaseCount > 0`.

So: a small amount of mismatch is allowed; large mismatch fails the check.

## How to run

**Locally:**

```bash
# Current month only (default)
node scripts/validate-data-overlap.js
# or with tsx if @/ is needed:
npx tsx scripts/validate-data-overlap.js

# Specific month
npx tsx scripts/validate-data-overlap.js --month 2025-02
```

**Env:** `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. If unset, the script skips Supabase and exits 0.

**CI:** `.github/workflows/validate-data.yml` runs daily (11:45 UTC) and on `workflow_dispatch`. It runs the script and fails the job if the script exits 1.

## Resolution steps when validation fails

1. **Read the log**  
   The script prints which firm/month failed and lists up to 5 missing tx hashes (and amounts). Use the full hash from Supabase or logs if you need to look up the tx.

2. **Re-run historical sync**  
   Ensure the JSON for that firm/month is up to date:
   - Trigger **Sync Firm Payouts (Historical)** (or run `node scripts/update-firm-monthly-json.js` locally with the same env as CI).
   - Wait for it to finish, then re-run **Validate Data Overlap**.

3. **Check timing**  
   Supabase only has the last 24h. If the historical job runs once per day, there can be a window where Supabase has newer payouts than the last JSON update. Re-running validation after the next sync often clears the failure.

4. **Inspect JSON for that month**  
   Open `data/payouts/{firmId}/{YYYY-MM}.json` and confirm `transactions` includes the hashes that were reported as missing. If they’re missing, the sync for that firm/month may have failed or been skipped (e.g. rate limit, partial run).

5. **Manual backfill (if needed)**  
   If a specific tx is known to be correct in Supabase but missing from JSON, you can:
   - Re-run the historical sync for that firm (e.g. `node scripts/update-firm-monthly-json.js --firm <firmId>` if supported), or
   - Manually add the transaction to the JSON file (same shape as other entries) and commit. Prefer re-sync over manual edits when possible.

6. **Adjust threshold (last resort)**  
   If the 5% rule is too strict for your setup (e.g. many small gaps due to timing), you can change `MISMATCH_THRESHOLD` in `scripts/validate-data-overlap.js` or make the workflow not fail on exit 1 (e.g. only warn). Prefer fixing data or sync over relaxing the check.

## Monitoring and alerting

- **Report:** The script’s stdout is the report (per firm/month, counts and list of missing-in-JSON hashes).
- **Alerting:** A failing run of **Validate Data Overlap** in GitHub Actions is the alert. Optionally add a Slack (or other) notification on failure using a `workflow_run` or a step that runs when the validate job fails.
