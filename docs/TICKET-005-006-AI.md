# TICKET-005 & TICKET-006: OpenAI + Review Classifier

**Status:** Done

---

## TICKET-005: OpenAI Integration

- **`.env.example`:** Added `OPENAI_API_KEY`. Add to `.env.local` and Vercel.
- **Package:** `openai` (add to project: `yarn add openai` if not already).
- **`lib/ai/openai-client.ts`:** `getOpenAIClient()`, `testOpenAIConnection()`.
- **Test:** Run `testOpenAIConnection()` (e.g. from a small script or API route) to verify API and billing.

---

## TICKET-006: Review Classifier

- **`lib/ai/classifier.ts`:** `classifyReview(review)`, `updateReviewClassification(reviewId, result)`.
- **Input:** `{ rating, title?, text }`.
- **Output:** `{ category, severity, confidence, summary }`.
- **Categories:** payout_issue, scam_warning, platform_issue, rule_violation, positive, neutral, noise.
- **Severity:** low, medium, high (null for positive/neutral/noise).
- **Config:** gpt-4o-mini, temperature 0.2, JSON mode, 30s timeout, 3 retries with exponential backoff.
- **Storage:** `updateReviewClassification(id, result)` writes to `trustpilot_reviews` (category, severity, confidence, ai_summary, classified_at).

---

## Usage

```ts
import { classifyReview, updateReviewClassification } from '@/lib/ai/classifier';

const result = await classifyReview({
  rating: 2,
  title: 'Payout delayed',
  text: 'Waiting 2 weeks for my withdrawal...',
});
// result: { category: 'payout_issue', severity: 'medium', confidence: 0.9, summary: '...' }

await updateReviewClassification(reviewId, result);
```

---

## Next (TICKET-008)

Batch classification cron: fetch reviews where `classified_at IS NULL`, run `classifyReview` + `updateReviewClassification` for each.
