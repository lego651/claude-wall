# TICKET-008: Batch Classification Cron Job

**Status:** Done (via GitHub Actions)  
**Schedule:** Daily at 4 AM PST (12:00 UTC), 1 hour after scraper (3 AM PST / 11 UTC).

---

## Flow

1. **3 AM PST (11 UTC)** – Scraper runs, writes new reviews to `trustpilot_reviews` (category/classified_at = NULL).
2. **4 AM PST (12 UTC)** – This workflow runs: fetches rows where `classified_at IS NULL`, calls OpenAI classifier for each, updates same rows with category, severity, confidence, ai_summary, classified_at.

---

## Implementation

**Workflow:** [.github/workflows/sync-classify-reviews.yml](../.github/workflows/sync-classify-reviews.yml)

- **Schedule:** `0 12 * * *` (12:00 UTC = 4 AM PST).
- **Manual run:** Actions → "Classify Trustpilot Reviews (Daily)" → Run workflow.
- **Script:** `scripts/classify-unclassified-reviews.ts` (calls `lib/ai/batch-classify.ts`).
- **Error handling:** Per-review failures are logged; job continues. Summary prints classified / failed counts and up to 10 error messages.

---

## Repo secrets required

Add these in GitHub → repo → Settings → Secrets and variables → Actions (if not already present):

- `OPENAI_API_KEY` – **Required for this workflow** (not needed for scraper).
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

---

## Local run

```bash
npx tsx scripts/classify-unclassified-reviews.ts
```

Requires `.env` with `OPENAI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
