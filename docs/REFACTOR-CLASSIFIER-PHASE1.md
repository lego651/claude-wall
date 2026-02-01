# Classifier refactor – Phase 1 (Option B) summary

**Done:** Taxonomy update, incident rules (spike + severity override), digest sentiment, DB migration.  
**Ref:** [CLASSIFIER-TAXONOMY.md](CLASSIFIER-TAXONOMY.md), PM/Tech Lead agreement.

## What changed

### 1. Taxonomy (single-label, expanded)

- **New categories:** payout_delay, payout_denied, kyc_withdrawal_issue, platform_technical_issue, support_issue, rules_dispute, pricing_fee_complaint, execution_conditions, high_risk_allegation, positive_experience, neutral_mixed, spam_template, low_info, off_topic.
- **Renames:** scam_warning → high_risk_allegation, rule_violation → rules_dispute, platform_issue → platform_technical_issue, payout_issue split into payout_delay / payout_denied, positive → positive_experience, neutral → neutral_mixed, noise → spam_template / low_info / off_topic.
- **Backward compat:** Legacy values (payout_issue, scam_warning, etc.) still allowed in DB and in queries; normalized to new values for grouping and storage when writing from the classifier.

### 2. Incident rules

- **Spike-based:** Incident when `count(category = X, last_7d) >= 3` for X in spike categories (payout_delay, payout_denied, kyc_withdrawal_issue, platform_technical_issue, support_issue, rules_dispute, pricing_fee_complaint, execution_conditions).
- **Severity override:** Incident when `high_risk_allegation` count in 7d >= 1 (config: `MIN_REVIEWS_FOR_HIGH_RISK_INCIDENT`).
- **Never incident:** spam_template, low_info, off_topic, positive_experience, neutral_mixed.

### 3. Digest sentiment

- **Positive:** category === positive_experience (or legacy 'positive').
- **Neutral:** category === neutral_mixed (or legacy 'neutral').
- **Negative:** category in incident-eligible negative list (new + legacy mapped to same set).

### 4. Files touched

| File | Change |
|------|--------|
| [docs/CLASSIFIER-TAXONOMY.md](CLASSIFIER-TAXONOMY.md) | New: taxonomy, incident rules, sentiment, migration ref |
| [lib/ai/classification-taxonomy.ts](lib/ai/classification-taxonomy.ts) | New: single source of truth for categories, incident/sentiment sets, legacy map |
| [lib/ai/classifier.ts](lib/ai/classifier.ts) | New prompt + categories; validate and store canonical category |
| [lib/digest/incident-aggregator.ts](lib/digest/incident-aggregator.ts) | Spike (>=3) + severity override (>=1); query includes legacy categories; group by normalized category |
| [lib/digest/generator.ts](lib/digest/generator.ts) | Sentiment from POSITIVE_SENTIMENT_CATEGORY, NEUTRAL_SENTIMENT_CATEGORY, isNegativeSentiment() |
| [database/update-classifier-taxonomy.sql](database/update-classifier-taxonomy.sql) | New: expand valid_category and incident_type CHECKs |

### 5. Deployment

1. Run migration: `psql` or Supabase SQL editor on [database/update-classifier-taxonomy.sql](database/update-classifier-taxonomy.sql).
2. Deploy app; classifier and batch job will write new taxonomy; existing rows keep legacy values until reclassified (optional).
3. Incident aggregator and digest already support both old and new values via normalization and legacy category list in queries.

### 6. How to run the AI classifier

After backfilling `trustpilot_reviews`, run the classifier so new rows get `category`, `severity`, `confidence`, `ai_summary`, and `classified_at` (Phase 1 taxonomy).

**Manual run (one-off or after backfill):**
```bash
npx tsx scripts/classify-unclassified-reviews.ts
```

**Required env (in `.env`):**
- `OPENAI_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

The script fetches all rows where `classified_at IS NULL`, calls the classifier for each, and updates the row. It processes reviews sequentially (one API call per review). Progress is logged every 10 classified reviews.

**Scheduled (daily):** The GitHub Action [.github/workflows/sync-classify-reviews.yml](../.github/workflows/sync-classify-reviews.yml) runs at 4 AM PST (12:00 UTC), 1 hour after the Trustpilot scraper, and classifies any new unclassified reviews.

### 7. Supported firms (Trustpilot scraper / backfill)

We currently support **8 firms** for Trustpilot scraping and backfill. FTMO and TopStep are **not** included (not supported yet).

- fundednext, the5ers, fundingpips, alphacapitalgroup, blueguardian, aquafunded, instantfunding, fxify

See [lib/scrapers/trustpilot.ts](../lib/scrapers/trustpilot.ts) (`TRUSTPILOT_URLS` / `TRUSTPILOT_FIRM_IDS`).

### 8. Optional follow-ups

- **Reclassify existing reviews:** Run batch classifier with new prompt to backfill canonical categories (API cost).
- **2× prev_7d spike rule:** Add optional condition “count this week >= 2 × count prev week” for spike incidents (requires prev-week counts in aggregator).
- **UI for high_risk_allegation:** Show “High-risk allegations reported” with sample size, links, disclaimers, confidence (data already in incidents).
