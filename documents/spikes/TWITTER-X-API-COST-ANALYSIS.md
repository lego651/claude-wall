# Twitter / X API Cost Analysis – Firm Monitoring Pipeline

**Purpose:** Estimate cost to add a Twitter/X monitoring pipeline similar to Trustpilot: query tweets about prop firms, categorize/summarize, and feed into the same content queue. **Goal:** keep cost low; explore official X API and **alternative providers**.

**Context:** Trustpilot pipeline: ~8 firms, daily scrape, then classify + incidents (no per-item API fee). For Twitter we need either the official X API or a third-party provider; both charge per read/search.

---

## 1. Official X API – Source of “Free Tier” and Current Pricing

### Where the “100 reads/month” came from

The **“100 reads/month free tier”** figure was taken from **third-party summaries** (e.g. blog posts, comparison sites) that described X’s **older** product tiers (Free / Basic / Pro). Those summaries often stated:

- **Free:** 500 Posts/month, **100 Reads/month** (e.g. [X API v2 support](https://developer.x.com/en/support/x-api/v2) and community discussions).

**Current situation:** X’s own [developer.x.com](https://developer.x.com/en/products/twitter-api) and [support/x-api/v2](https://developer.x.com/en/support/x-api/v2) now emphasize a **consumption-based, pay-per-use** model (“No fixed monthly costs, no monthly caps”) and **do not** clearly publish a small free tier for read volume. So:

- The **100 reads/month** number is **not** from X’s current pricing page; it comes from **older tier descriptions** (and third-party sites citing them).
- For **current** official pricing, always check [developer.x.com](https://developer.x.com) directly. As of the last check, **Posts: Read** was **$0.005 per resource** (per tweet), with no meaningful free allowance for monitoring-scale use.

So for planning: treat the **official** X API as **pay-per-use at ~$0.005 per tweet** for reads, and assume **no usable free tier** for firm monitoring until X documents one.

---

## 2. Official X API – Cost If We Use It

| Resource      | Unit cost (official) | Notes                          |
|---------------|----------------------|--------------------------------|
| **Posts: Read** | **$0.005 per tweet** | Each tweet returned counts as 1. |
| User: Read   | $0.010 per user      | Optional (author info).         |

Example volume (8 firms, 1 search/day, 50 tweets each): **~12,000 tweets/month → ~$60/month**.  
Medium volume (~48k tweets/month): **~$240/month**.

So official API is **too high** for “keep cost low” if we want to mirror Trustpilot-like volume.

---

## 3. Alternative API Providers (Lower Cost)

These are **third-party** services that provide Twitter/X data (search, user tweets, etc.) at lower per-tweet or per-request cost. Always verify **ToS**, **data freshness**, and **reliability** before committing.

| Provider | Pricing (approx.) | Free / trial | Notes |
|----------|-------------------|--------------|--------|
| **GetXAPI** | **$0.001 per call** | $0.50 free credits, no card | Search/tweet/user endpoints; 10k calls = $10. [getxapi.com/pricing](https://www.getxapi.com/pricing) |
| **Desearch** | **$0.30 per 1,000 posts** | Free trial | Semantic search, 1k+ req/s; “16× cheaper than official.” [desearch.ai](https://desearch.ai/twitter-api) |
| **Apify** (e.g. Tweet Scraper, Kaito) | **$0.18–0.40 per 1,000 tweets** | Free trial | Pay-per-result; multiple actors; [apify.com](https://apify.com) marketplace. |
| **TwitterAPI.io** | ~**$0.15 per 1,000 tweets** | Varies | Often cited in “alternatives” roundups; confirm on their site. |

**Caveats:**

- **Not official X.** Data may come from scraping or other methods; check provider ToS and X’s ToS for compliance.
- **Rate limits / uptime** may differ from official API.
- **Data freshness** and **coverage** (e.g. recent search only, or full history) vary by provider.

---

## 4. Estimated Cost with Alternatives (Keep Cost Low)

Assume **~12,000 tweets/month** (light pipeline: 8 firms × 1 search/day × 50 tweets).

| Option | Per 1k tweets | 12k tweets/month | Rough monthly |
|--------|----------------|-------------------|----------------|
| **Official X API** | $5.00 | $60 | **~$60** |
| **GetXAPI** | $1.00 | $12 | **~$12** |
| **Desearch** | $0.30 | $3.60 | **~$4** |
| **Apify** (e.g. $0.25/1k) | $0.25 | $3 | **~$3–5** |

So with **alternatives**, the same pipeline can be on the order of **~$3–12/month** instead of **~$60/month** for the official API.

---

## 5. Recommendation for “Keep Cost Low”

1. **Do not rely on a “100 reads/month free tier”** for planning; that figure is from old tier descriptions, and X’s current public pricing is pay-per-use.
2. **Prefer alternative providers** for cost: e.g. **Desearch** or **Apify** for **~$3–5/month** at light volume, or **GetXAPI** for **~$10–12/month** with a simple per-call model.
3. **Before building:** Read each provider’s ToS and data policy; confirm they allow your use case (monitoring firm-related tweets, storing summaries, digest).
4. **Design the pipeline** in a provider-agnostic way (e.g. “fetch tweets” abstraction) so we can switch between official X and an alternative, or A/B test one alternative cheaply.

---

## 6. Summary Table

| Source | 12k tweets/mo | 48k tweets/mo | Free tier (volume) |
|--------|----------------|---------------|--------------------|
| **Official X API** | ~$60 | ~$240 | Not viable (old “100 reads” was from old tiers; verify on developer.x.com) |
| **GetXAPI** | ~$12 | ~$48 | $0.50 credits |
| **Desearch** | ~$4 | ~$14 | Free trial |
| **Apify** (e.g. $0.25/1k) | ~$3 | ~$12 | Free trial |

**Bottom line:** To keep cost low, use an **alternative provider** (GetXAPI, Desearch, or Apify) and budget **~$3–15/month** for light firm monitoring. The “100 reads/month” free tier is from **older X tier documentation**; the official API is now pay-per-use and too expensive for this use case at target volume.

**See also:** [TWITTER-API-PROVIDERS-FREE-TRIALS-AND-CHOICE.md](./TWITTER-API-PROVIDERS-FREE-TRIALS-AND-CHOICE.md) – free trial details and **recommended choice: Apify** (search by firm handle/keyword, $5/month free credits, cron-friendly API).

---

*Sources: [developer.x.com](https://developer.x.com) (pay-per-use pricing); [getxapi.com/pricing](https://www.getxapi.com/pricing); Desearch, Apify, and comparison articles (2024–2025). Re-verify each provider’s pricing and ToS before implementation.*
