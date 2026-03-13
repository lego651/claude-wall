# Twitter API Providers: Free Trials & Choice (Apify for Firm Monitoring)

**Goal:** Pick one low-cost provider for a Trustpilot-like Twitter pipeline (search tweets per firm → categorize → queue for digest). Compare free trials and fit for our use case.

---

## 1. Free Trial Summary

| Provider | Free trial / credits | Sign-up | Source |
|----------|----------------------|--------|--------|
| **Apify** | **$5 in platform credits every month** (renews; no card) | [console.apify.com](https://console.apify.com) | [apify.com/pricing](https://apify.com/pricing) |
| **GetXAPI** | **$0.50 one-time** free credits | [getxapi.com/signup](https://www.getxapi.com/signup) | [getxapi.com](https://www.getxapi.com/) |
| **Desearch** | Free credits via console (claim in console) | [console.desearch.ai](https://console.desearch.ai) | [desearch.ai](https://desearch.ai/twitter-api), [desearch.ai/pricing](https://desearch.ai/pricing) |
| **Masa (Gopher)** | **Up to 100 queries** free (then pricing not public) | [data.masa.ai](https://data.masa.ai) | [HF blog](https://huggingface.co/blog/Gopher-Lab/masa-api-scraper), [developers.gopher-ai.com](https://developers.gopher-ai.com/docs/data/twitter.md) |

**Details:**

- **Apify:** Free plan includes $5/month to spend in the Apify Store (or on your own Actors). No credit card. If you exceed $5, free plan is blocked until next month; paid plans allow overage. Credits do not roll over.
- **GetXAPI:** $0.50 free once; then $0.001/call. No subscription. Good to validate API shape; not enough for ongoing monitoring.
- **Desearch:** Free credits when you claim in console; then $0.30/1k posts. Can also use Desearch’s **Twitter Scraper (Search)** Actor **on Apify** ($0.30/1k results), so you could use Apify’s $5 to run Desearch’s actor too.
- **Masa (Gopher):** Free “up to 100 queries” (per account/lifetime unclear; from [Masa HF blog](https://huggingface.co/blog/Gopher-Lab/masa-api-scraper)). Paid pricing is **not published**; need to check [data.masa.ai](https://data.masa.ai) dashboard or contact them. UI shows “Up to 10 results” on search; API docs allow `max_results` up to 1000 per request.

---

## 2. Is Apify Good for Our Use Case?

**Use case:** Daily (or a few times per day) run: for each prop firm, search Twitter for recent tweets (by firm handle or keywords like “FundingPips”, “FXIFY”) → fetch tweet text + metadata → we categorize/summarize with AI → push to `firm_content_items` (or similar) as draft → admin approves → weekly digest.

**Why Apify fits:**

1. **Search by keyword/handle:** Apify has multiple Twitter/X **search** Actors that accept a **query** or **searchTerms** (e.g. `from:FundingPips`, or `FundingPips prop firm`). We can run one search per firm per day with different terms.
2. **Pay-per-result options:** e.g. **Cheapest Tweet Scraper** ([kaitoeasyapi/twitter-x-data-tweet-scraper-pay-per-result-cheapest](https://apify.com/kaitoeasyapi/twitter-x-data-tweet-scraper-pay-per-result-cheapest)) at **$0.25/1,000 tweets**. We only pay for tweets returned, not for failed runs. Input supports Twitter advanced search (e.g. `searchTerms: ["from:FundingPips", "FXIFY payout"]`).
3. **Trigger from our backend/cron:** Apify exposes a **REST API** to run an Actor: `POST https://api.apify.com/v2/acts/{actorId}/runs?token=API_TOKEN` with JSON input. Our GitHub Action or serverless cron can call this daily, then poll for completion and fetch the dataset (or use webhook). No need to host a scraper ourselves.
4. **Free tier:** $5/month credits. At $0.25/1k tweets, **$5 ≈ 20,000 tweets**. Our light pipeline (8 firms × 50 tweets/day × 30 days ≈ 12,000 tweets/month) can stay **within $5** for the Twitter part; if we go slightly over, we’d pay a few dollars. So we can run for **free or a few dollars/month**.
5. **Output:** Actors return structured JSON (tweet id, text, author, date, etc.), which we can map into our schema and send to the existing AI categorization step.

**Caveats:**

- **ToS:** Apify’s Twitter Actors typically rely on non-official access (scraping or third-party). Review Apify’s and X’s ToS; use at your own risk for production.
- **Rate limits / reliability:** Community Actors can change or be deprecated; pick one with good reviews and usage (e.g. Kaito’s has high runs and bookmarks).
- **Data freshness:** Search is usually “recent” (e.g. last 7 days); sufficient for daily monitoring.

**Conclusion:** Apify is a **good fit** for our use case: search per firm, low cost, triggerable from cron, and we can stay on the free tier or a few dollars per month.

---

## 3. Recommended Choice: **Apify**

**Reasons:**

1. **Best free trial for our volume:** $5/month recurring (not one-time $0.50) and enough to cover ~12k–20k tweets/month with a pay-per-result Actor.
2. **Fits the pipeline:** Search by firm handle/keyword → get tweets → we process with existing AI → push to content queue. No Twitter developer account required.
3. **Operationally simple:** Run Actor via API from our cron; fetch results; no long-running scraper to maintain.
4. **Cost control:** Pay-per-result means we only pay for tweets we get; we can cap `maxItems` per run to stay under budget.

**Suggested Actor:** Start with **Twitter/X Tweet Scraper (Pay-Per-Result, Cheapest)** – [kaitoeasyapi/twitter-x-data-tweet-scraper-pay-per-result-cheapest](https://apify.com/kaitoeasyapi/twitter-x-data-tweet-scraper-pay-per-result-cheapest) – $0.25/1k tweets, supports `searchTerms` with Twitter advanced search syntax (e.g. `from:FundingPips`, or keyword "FundingPips"). Alternative: **Desearch AI Twitter Search** on Apify ([desearch/ai-twitter-search](https://apify.com/desearch/ai-twitter-search)) at $0.30/1k if we want semantic/search features; also runnable with Apify credits.

---

## 4. Masa (data.masa.ai / Gopher) – Can It Do the Job? Is It Cheaper?

**What it is:** Masa’s **Gopher** data API ([data.masa.ai](https://data.masa.ai)) offers real-time and historical X/Twitter (and web) data via a unified API, aimed at AI agents and apps. Docs: [developers.gopher-ai.com](https://developers.gopher-ai.com/docs/data/twitter.md).

**Can it do the job?** **Yes, capability-wise.** The Twitter API supports:

- **`searchbyquery`** – search tweets with Twitter query syntax (keywords, `from:handle`, etc.), **up to 1000 results per request**.
- **`gettweets`** – user timeline by username.
- **Time filters:** `start_time`, `end_time` (ISO).
- **Pagination:** `next_cursor`.

So we can run one search per firm per day (e.g. `query: "FundingPips"` or `from:FundingPips`) with `max_results: 50` and get structured tweet data. Same pipeline shape: fetch → we categorize with AI → push to content queue.

**Free tier:** Masa’s [Hugging Face blog](https://huggingface.co/blog/Gopher-Lab/masa-api-scraper) states **“Free to use (up to 100 queries)”**. The data.masa.ai search UI shows “Up to 10 results” (likely a UI limit; API allows up to 1000). So:

- **100 queries** = e.g. 1 query per firm per day for ~12 days for 8 firms, or 100 total queries ever (unclear). Either way, **not enough** for ongoing monthly monitoring (we’d want ~8 × 30 = 240+ queries/month for one search per firm per day).

**Is it cheaper?** **Unknown.** Masa does **not** publish per-query or per-tweet pricing. After the free 100 queries, you must check the [data.masa.ai](https://data.masa.ai) dashboard or contact them (e.g. [Masa Discord](https://discord.com/invite/HyHGaKhaKs)) for paid tiers. So we **cannot** say it’s cheaper than Apify ($0.25/1k tweets, $5/month free credits ≈ 20k tweets).

**Summary:** Masa/Gopher **can** do the job (search by keyword/handle, good limits per request), but the **free tier is tight** (100 queries) for our volume, and **paid pricing is not public**, so we can’t recommend it over Apify until we have numbers. If you get a quote from Masa, we can add it to this doc and recompare.

**Next steps:**

1. Sign up at [console.apify.com](https://console.apify.com) (no card).
2. Run a test with the chosen Actor (e.g. one `searchTerms` for one firm, `maxItems: 20`) and inspect output.
3. Add a small integration: cron or API route that calls Apify Run API with per-firm search terms, then fetches dataset and feeds into our existing ingest + AI pipeline (same pattern as email pipeline: normalize → categorize → insert draft).

---

*Sources: Apify [pricing](https://apify.com/pricing), [Kaito Actor](https://apify.com/kaitoeasyapi/twitter-x-data-tweet-scraper-pay-per-result-cheapest/api), [Desearch on Apify](https://apify.com/desearch/ai-twitter-search), GetXAPI [pricing](https://www.getxapi.com/pricing), Desearch [pricing](https://desearch.ai/pricing); Masa [data.masa.ai](https://data.masa.ai), [Gopher Twitter docs](https://developers.gopher-ai.com/docs/data/twitter.md), [HF blog](https://huggingface.co/blog/Gopher-Lab/masa-api-scraper).*
