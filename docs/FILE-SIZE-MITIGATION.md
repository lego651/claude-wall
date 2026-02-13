# File Size Monitoring & Mitigation

JSON files in `data/payouts/` are loaded by API routes. Large files can cause slow responses and timeouts (e.g. Vercel 10s limit). This doc describes monitoring and what to do when files grow.

## Thresholds

| Size | Action |
|------|--------|
| **>500 KB** | Logged when the file is loaded (see payoutDataLoader / API logs). |
| **≥1 MB** | Reported in file size check. Review and consider splitting or archiving. |
| **≥5 MB** | **Warn** – high timeout risk. GitHub Actions workflow warns. |
| **≥10 MB** | **Fail** – GitHub Actions workflow fails. Fix before merging. |

## Dashboard (markdown report)

Run the check script with markdown output to get a simple report:

```bash
node scripts/check-file-sizes.js --format=markdown
```

Example output:

```markdown
# File Size Report (data/payouts)

**Total:** 42 files, 12.5 MB

## Files ≥ 1 MB
- `fundingpips/2025-02.json`: 1.2 MB

## Files ≥ 5 MB (timeout risk)
- None

## Files ≥ 10 MB (fail threshold)
- None
```

In CI, the same data is in the job summary as JSON.

## Automated checks

- **Script:** `scripts/check-file-sizes.js`  
  - Scans `data/payouts/` recursively.  
  - Exit 0 if no file ≥10 MB, exit 1 otherwise.  
  - Default output: JSON. Use `--format=markdown` for the report above.

- **GitHub Actions:** `.github/workflows/monitor-file-sizes.yml`  
  - Runs daily at 11:30 UTC (after payout sync).  
  - **Fails** the job if any file ≥10 MB.  
  - **Warns** (step warning) if any file ≥5 MB.  
  - Optional: set `SLACK_WEBHOOK_URL` secret to post a short alert when the job fails.

## Mitigation steps

When files are large or the check fails:

1. **Short term**
   - Archive old months: move older JSON to cold storage or delete if not needed for 12m view.
   - Reduce payload: if files store full transaction lists, consider keeping only aggregates (e.g. dailyBuckets) for 30d/12m and loading full lists on demand or from Supabase.

2. **Medium term**
   - **Migrate to Supabase (or another DB)** for historical payout data; keep JSON only as a cache or drop it. API routes already use Supabase for 1d; extending to 7d/30d/12m from DB avoids large file reads and timeouts.

3. **Operational**
   - Run `node scripts/check-file-sizes.js --format=markdown` before or after big backfills.
   - Fix any file ≥10 MB before pushing (workflow will fail otherwise).
   - Use the “Warn on files >5MB” step in Actions to catch growth early.

## API behavior

- When a payout file **>500 KB** is loaded (e.g. for `/api/v2/propfirms/[id]/chart` or list), the loader logs a warning with path and size. Check logs/Sentry for `Loading large payout file (>500KB)` to see which firm/period is large.
