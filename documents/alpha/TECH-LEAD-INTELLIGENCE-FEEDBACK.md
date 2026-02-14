# Tech Lead Feedback: Intelligence & Firm Health (Design/PM Challenge)

**Context:** Design/PM handed off Firm Overview (Firm Health, Social Sentiment, Latest Insights) and Firm Intelligence Feed. Below: confirmed behavior, gaps, and challenges so we ship without overpromising.

---

## 1. Trustpilot review gathering — confirmed

**Question:** Does it run once a day and gather 3 pages (not full scraping)?

**Answer: Yes.**

| Item | Implementation |
|------|----------------|
| **Schedule** | Daily at 3 AM PST (11:00 UTC) via [`.github/workflows/sync-trustpilot-reviews.yml`](../.github/workflows/sync-trustpilot-reviews.yml) |
| **Pages per firm** | `maxPages: 3` in [`lib/scrapers/trustpilot.ts`](../lib/scrapers/trustpilot.ts) (DEFAULT_CONFIG) |
| **Cap** | `maxReviews: 150` total per run; ~20–60 reviews per firm per day |
| **Firms in daily cron** | Backfill script uses `['the5ers', 'fundingpips', 'fundednext']`; workflow runs the same script (same 3 firms) |
| **Full scrape?** | No. We only hit pages 1–3. No traversal of all pages. |

**Challenge to PM/Design:** If we add more firms to the daily sync, we should confirm we don’t exceed Trustpilot rate limits or cron runtime (currently ~2–5 min for 3 firms). Adding many more firms may require staggering or a separate “full backfill” vs “daily delta” strategy.

---

## 2. Alerts when signals repeat — partial today

**Question:** Is the goal to trigger alerts when some signals repeat?

**Answer:** We already detect *repeating* negative signals and surface them, but as **batch weekly output**, not real-time alerts.

| What we have | Where |
|--------------|--------|
| **Incident detection** | [`lib/digest/incident-aggregator.ts`](../lib/digest/incident-aggregator.ts): groups Trustpilot reviews by negative category (`payout_issue`, `scam_warning`, `platform_issue`, `rule_violation`). If **≥3 reviews** in a category in a week → one incident with AI title/summary. |
| **Storage** | Incidents stored in `weekly_incidents` (firm, week, type, severity, title, summary, review_count, etc.). |
| **Surfacing** | Weekly digest email + weekly report JSON. No in-app “Firm Intelligence Feed” page yet, no push/email on single incident. |

So: **repeating signal** = “3+ negative reviews in same category in a week.” We do detect that and summarize it; we don’t yet “alert” (e.g. push or email) on each new incident.

**Challenge to PM/Design:**

- Do we want **real-time alerts** (e.g. email/Slack when a new incident is detected), or is weekly digest enough for v1?
- If we add Twitter/Reddit later, should “repeating” be cross-source (e.g. 2 Trustpilot + 2 Reddit = incident)?
- Do we want a threshold above 3 (e.g. “spike” = 2× last week’s count)?

---

## 3. Homepage firm health — we need algos and a benchmark

**Question:** Do we need algorithms for firm health? What’s the benchmark?

**Answer:** Yes. We have **no** firm health score or status in the codebase today. Design shows a composite (e.g. 88/100) and sub-metrics (Payout Velocity, Rule Stability, Incident Confirmation). All of that would need to be defined and implemented.

**Proposed leverage:**

- **Payout velocity:** We have payout time series; we can derive “volume trend” and “time since last payout” (we already show “Time Since Last Payout” on the firm page). So “velocity” could be a small algo on top of existing data.
- **Incident confirmation:** We have `weekly_incidents` with severity. A simple health penalty (e.g. −X per high-severity incident in last 30 days) is feasible.
- **Rule stability:** We have no rule-change data. This is either “not in scope for v1” or we need a source (e.g. scraping rule pages, or manual tagging).

**Challenges to PM/Design:**

- **Benchmark:** Is 88/100 vs “industry average,” vs “this firm’s history,” or an absolute scale? We need a clear definition so we don’t imply comparison we can’t support.
- **Status bands:** What ranges map to STABLE / WARNING / CRITICAL? Need exact thresholds.
- **Rule stability:** If we have no data, we must either drop it from the first version or accept a placeholder (e.g. “N/A” or “—”) and document it.

---

## 4. Social sentiment score — doable but fragile with 10–20 items

**Question:** Is it easy to compute? We only store limited reviews (and later 10–20 Twitter items).

**Answer:** We **already** compute a form of “sentiment” for the weekly report, but it’s **classification-based**, not a separate NLP score.

| Current behavior | Where |
|------------------|--------|
| Each review is **classified** by AI into category: `positive`, `neutral`, or one of the negative categories. | [`lib/ai/classifier.ts`](../lib/ai/classifier.ts), [`lib/digest/generator.ts`](../lib/digest/generator.ts) |
| “Sentiment” = counts: positive count, neutral count, negative count for the week. | `getReviewsAndSentiment()` → `sentiment: { positive, neutral, negative }` |
| No separate “72% positive” score in code; that would be `positive / total * 100`. | Trivial to add once we agree on denominator (e.g. last 7d, last 30d). |

So: **calculation is easy.** The issue is **statistical reliability** with small samples.

**Challenges to PM/Design:**

- With **3 pages/day** we get ~20–60 new reviews per firm per day; we keep history in DB, so for “last 7d” we may have enough for a stable %. For “last 24h” we might have only a handful → percentages swing a lot.
- If we only **store 10–20 items per source** (e.g. 10–20 tweets): a single “72% positive” from 14 tweets is **not** robust. We should either:
  - **Avoid a single “social sentiment score”** for such small samples and show **event-style** insights instead (e.g. “Spike in negative mentions”), or
  - **Label the metric** (e.g. “Based on last 14 mentions – small sample”) so users don’t over-interpret.
- Design shows “Positive feedback across **Reddit, Twitter, and Trustpilot**.” We **only** have Trustpilot today. Copy and UI must say “Trustpilot” (or “Reviews”) until Reddit/Twitter ship; otherwise we mislead.

---

## 5. Firm Intelligence Feed page — strong idea; not built yet

**Question:** What’s your take on the Firm Intelligence Feed page?

**Answer:** The **concept** is good: a timeline of curated, classified signals (e.g. “Trustpilot Review Spike”, “Platform Maintenance Latency”) with type, date, summary, sources, confidence. We have the **ingredients**, but **no** `/propfirm/[id]/intelligence` (or similar) route or API yet.

| We have | We don’t have |
|---------|-------------------------------|
| Classified reviews (category, severity, ai_summary) in `trustpilot_reviews` | UI page “Firm Intelligence Feed” |
| Weekly incidents (title, summary, type, severity) in `weekly_incidents` | API that returns a unified “intelligence feed” (e.g. last 90 days, mixed reviews + incidents) |
| AI summarization per incident | “Confidence” on each card (we have severity; confidence could be derived or added) |
| | Filtering by type (Operational, Reputation, etc.) — can map our categories to these |

**Recommendation:** Build the feed from **existing** data first:

1. **API:** One endpoint, e.g. `GET /api/v2/propfirms/[id]/intelligence?days=90`. Merge:
   - `weekly_incidents` (already have title, summary, type, week)
   - Optional: recent classified reviews with negative category as “micro-signals” (e.g. “3 payout_issue reviews this week”)
2. **Page:** List those items by date; show type badge, title, summary, “Source: Trustpilot” (no Reddit/Twitter until we have them), and severity/confidence.
3. **Design:** “All Types” filter = map our categories to design’s types (e.g. payout_issue → Operational, scam_warning → Reputation).

**Challenge to PM/Design:** The overview “Latest Insights” and the dedicated “Firm Intelligence Feed” should not duplicate the same 3 cards. Propose: Overview = last 7–14 days, top 3–5 items; Feed = full 90 days, filterable. That gives clear differentiation.

---

## 6. Only Trustpilot today; Reddit/Twitter later — UI must match

**Note:** “We now only support Trustpilot, but plan to support Twitter and Reddit in the future.”

**Answer:** Agreed. No Reddit or Twitter data or scrapers exist in the repo. Roadmap (e.g. `alpha_follow_tickets.md`, `alpha_scope_v3.md`) has Reddit/Twitter as future work.

**Critical ask for PM/Design:**

- **Every** place that mentions “Reddit,” “Twitter,” or “social sentiment” across multiple sources must be updated to **Trustpilot-only** until we ship those sources:
  - e.g. “Positive feedback across Reddit, Twitter, and Trustpilot” → “Positive feedback from Trustpilot reviews (last 7d)” or similar.
- Same for “Sources: Trustpilot, Twitter, Official Discord” on intelligence cards: show only **Trustpilot** (and Discord only if we have a Discord source). Otherwise we imply we have data we don’t.
- When we add Twitter/Reddit, we can introduce a “Source” field (Trustpilot | Twitter | Reddit) and then broaden the copy.

---

## Summary: What we have vs what design assumes

| Feature | Codebase | Design | Action |
|--------|----------|--------|--------|
| Trustpilot sync | ✅ Daily, 3 pages/firm | — | Confirm with PM only if we scale firms/pages. |
| Incident detection | ✅ 3+ reviews → incident, weekly | Alerts on signals | Decide: real-time alerts in v1 or not. |
| Firm health score | ❌ | 88/100, sub-metrics | Define formula, benchmarks, and Rule Stability source or drop. |
| Social sentiment % | ✅ Counts; % easy | 72%, multi-source | Add % if needed; label “Trustpilot”; don’t claim Reddit/Twitter. |
| Intelligence feed page | ❌ | Full feed + filters | Build from `weekly_incidents` + optional review-derived signals; API first. |
| Reddit / Twitter | ❌ | Shown in mockups | Copy and UI: Trustpilot-only until we ship. |

---

## Next steps (suggested)

1. **Copy/UI pass:** Replace any “Reddit, Twitter, and Trustpilot” (or similar) with Trustpilot-only wording and “More sources coming later” if desired.
2. **Firm health:** PM/Design to specify: formula for 88/100, STABLE/WARNING/CRITICAL bands, and whether Rule Stability is in or out of v1.
3. **Intelligence feed:** Backlog ticket(s) for `GET /api/v2/propfirms/[id]/intelligence` and Firm Intelligence Feed page consuming it; scope to Trustpilot + weekly_incidents only.
4. **Alerts:** Decide if v1 includes any real-time incident alerts or stays weekly-only; document so eng doesn’t overbuild.

I can turn this into tickets (e.g. “Copy: Trustpilot-only for sentiment”, “API: Firm intelligence feed”, “Spec: Firm health formula”) or adjust wording for a specific doc/audience.
