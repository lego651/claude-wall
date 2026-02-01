# Trustpilot + AI pipeline – Q&A

## 1. Do we need to run the AI categorizer to analyze data and write back later?

**Yes.** Flow is two steps:

1. **Scrape** (daily 3 AM PST): writes rows to `trustpilot_reviews` with `category`, `classified_at` = NULL.
2. **Classify** (daily 4 AM PST, 1h after scrape): selects rows where `classified_at IS NULL`, calls OpenAI per review, then **writes back** `category`, `severity`, `confidence`, `ai_summary`, `classified_at`.

So new reviews are stored first; the AI job runs later and updates those rows. Without the classifier, reviews stay unclassified and incident/sentiment logic won’t use them.

---

## 2. Does each Trustpilot review have a timestamp? When we save, do we use its timestamp or scraping timestamp?

**Each review has a timestamp on Trustpilot** (e.g. “January 24, 2026” or “2 days ago”). We parse that in the scraper and store it.

| Field        | Meaning | Set from |
|-------------|---------|----------|
| **review_date** | Date the user wrote the review (Trustpilot) | **Review’s timestamp** (parsed from page; stored as date-only `YYYY-MM-DD`) |
| **created_at**  | When we inserted the row (Supabase)       | **Scraping time** (default `NOW()` on insert) |

So: we **use the review’s timestamp** for `review_date`. We do not overwrite it with the scraping time. Scraping time is only reflected in `created_at`.

---

## 3. For the AI analyzer: pre-defined category type or done by the AI?

**Pre-defined categories; AI chooses one.** We do not let the model invent labels.

- **Categories** (in `lib/ai/classifier.ts`):  
  `payout_issue`, `scam_warning`, `platform_issue`, `rule_violation`, `positive`, `neutral`, `noise`
- The prompt lists these and asks for exactly one. The response is validated; if the value is not in the list, we throw and retry.

So: **fixed taxonomy, AI does the classification** into one of those seven.

---

## 4. Is the AI batch job or one-by-one?

**Batch job that processes one-by-one.**  

- **Batch:** One run fetches *all* rows with `classified_at IS NULL` and processes them in a single invocation of the script.
- **One-by-one:** For each of those rows we call `classifyReview()` (one OpenAI request), then `updateReviewClassification()` (one DB update). No parallelization; sequential to avoid rate limits and to keep behavior predictable.

So: one cron job, many reviews, but each review is classified and written back individually in sequence.

---

## 5. Cover all firms we have now (not only 3)

**Done.** The backfill and daily sync now use **all firms** that have a Trustpilot URL in the scraper (including ftmo and topstep). See:

- `lib/scrapers/trustpilot.ts`: `TRUSTPILOT_URLS` includes all 10 firms; `TRUSTPILOT_FIRM_IDS` is exported for backfill/sync.
- `scripts/backfill-trustpilot.ts`: uses `TRUSTPILOT_FIRM_IDS` (all firms). Default 6 pages; set `TRUSTPILOT_BACKFILL_PAGES=3` for lighter runs.
- `.github/workflows/sync-trustpilot-reviews.yml`: runs the same script with `TRUSTPILOT_BACKFILL_PAGES=3`, so daily sync runs all firms at 3 pages per firm.
