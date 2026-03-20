# Twitter Bot × YouTube Picks: Feature Strategy & Launch Plan

**Date:** 2026-03-15
**Feature:** Daily Top 3 YouTube Picks auto-posted to Twitter with creator @mentions
**Status:** Pre-alpha — strategic alignment phase

---

## Table of Contents
1. [Product State: What We Have Today](#1-product-state-what-we-have-today)
2. [User Personas](#2-user-personas)
3. [Strategic Rationale (CEO)](#3-strategic-rationale-ceo)
4. [Revenue Impact Analysis](#4-revenue-impact-analysis)
5. [Company OKRs for This Test](#5-company-okrs-for-this-test)
6. [Marketing Strategy: How This Works in the Wild](#6-marketing-strategy-how-this-works-in-the-wild)
7. [Feature Scope: What We're Building (PM)](#7-feature-scope-what-were-building-pm)
8. [3-Week Rollout Plan](#8-3-week-rollout-plan)
9. [Risk Assessment](#9-risk-assessment)
10. [Actionable Tasks & Measurable Metrics](#10-actionable-tasks--measurable-metrics)

---

## 1. Product State: What We Have Today

### Discovery & Research
- **Prop Firm Directory** — Browse and filter all major prop firms with search and sortable metrics across multiple time periods (1d/7d/30d/12m).
- **Firm Detail Pages** — Historical payout charts, Trustpilot sentiment trends, AI-detected incident alerts, and AI "Our Take" weekly summaries.
- **Firm Rules & Pricing** — Standardized challenge pricing, payout %, scaling models, and trading rules — versioned and auditable.

### Trust & Risk Intelligence
- **Trustpilot Sentiment Analysis** — AI classification of reviews into 15 categories (payout delays, KYC issues, rule disputes, support failures, etc.) with trend charts.
- **AI Incident Detection** — Daily scanning of new reviews; flags emerging problems at firms with severity scoring before issues become widely known.
- **Signals** — Firm-level alerts surfacing notable changes or patterns.

### Market Awareness
- **Daily News Brief (`/news`)** — Top 3 YouTube videos + top 3 Twitter posts about prop trading, scored daily (views×0.4 + engagement×0.4 + freshness×0.2), AI-summarized.
- **Firm-Specific Content** — Related YouTube and Twitter content surfaced per firm page.

### Trader Transparency
- **Verified Payout Leaderboard** — Blockchain/API-verified ranking of traders by total payouts.
- **Trader Profiles** — Individual pages with verified payout history.

### Ongoing Intelligence (Subscribers)
- **Weekly Digest Email** — Curated weekly briefing per subscriber: payout trends, Trustpilot movements, detected incidents, top tweets, firm news.

---

## 2. User Personas

### Persona 1 — Marcus (Primary User): The Serious Challenge Trader

| Attribute | Detail |
|---|---|
| **Age / Role** | 31, full-time funded trader |
| **Experience** | 4 years trading, 2 years through prop challenges |
| **Budget** | $400–800 per challenge |

**Pain points:** Has been burned by firms changing payout structures mid-challenge without warning. Piecing together intelligence from Reddit, Discord, and Twitter is exhausting and unreliable. Core fear: wasting money on a firm that moves the goalposts.

**What he needs:** Early warning on payout delays or rule changes. Reliable summary of which firms are actually paying. Verification that real traders are getting paid.

**Features he uses most:** Firm detail pages (payout chart + "Our Take" + incidents), Trustpilot sentiment, verified leaderboard, weekly digest (Sunday ritual before the week starts).

**Goal:** Scale to 2–3 funded accounts across stable firms; treat funded trading as primary income.

> *"I'm good at trading. What kills me is the firm risk, not the market risk. I need to know which firms are actually solid before I hand them my money."*

---

### Persona 2 — Priya (Secondary User): The Prop Trading Educator & Affiliate

| Attribute | Detail |
|---|---|
| **Age / Role** | 27, YouTube educator + affiliate partner (3–4 firms) |
| **Experience** | 3 years trading, 2 years creating prop trading content |
| **Output** | 2–3 YouTube videos/week, daily Twitter/X posts |

**Pain points:** Research overhead is enormous. Staying current across 10–15 firms while producing content is exhausting. Her credibility depends on being right — recommending a firm that blows up later destroys audience trust.

**What she needs:** Fast firm reputation check before featuring it. Trending topic awareness for content ideas. Structured, citable data for comparison videos. Alerts when a firm she covers changes.

**Features she uses most:** Daily News Brief (identifies trending topics for her own content), firm comparison data, Trustpilot sentiment trends, "Our Take" summaries as a research starting point.

**Goal:** Grow audience and affiliate revenue while protecting the trust she's built.

> *"My audience trusts me because I tell them the truth about firms, including the bad stuff. I can't do that if I'm always a week behind on what's actually happening."*

---

## 3. Strategic Rationale (CEO)

### Why This Feature

The platform already does the hard work — scoring videos, AI summaries, freshness signals. That value is locked inside the product. The Twitter bot unlocks it by pushing our intelligence into the stream where traders already spend time.

**Three company-level goals this serves:**

1. **Acquire top-of-funnel traffic at near-zero marginal cost.** Every subscriber today came through SEO or word of mouth. This bot creates a daily distribution channel that compounds — each post is a new inbound vector.

2. **Establish the platform as the authoritative curation layer for prop trading content.** We do not need to produce content. We need to be the entity that surfaces what matters. If traders associate "best prop trading videos today" with our brand, we own mindshare before they open their wallet.

3. **Build direct relationships with prop trading content creators.** Creator @mentions are not courtesy tags — they are partnership initiation. A creator who retweets us once has introduced us to their entire audience. At scale, this becomes our affiliate and distribution network without a formal program.

### Why Now

The account needs aging time before it can post without spam flags. Starting warmup now means by the time we have meaningful followers, the account is trusted. Waiting costs us runway.

### Strategic Bet

Curated intelligence distributed at the right time (7:15 AM ET, pre-market) positions us as the morning briefing for serious prop traders. That is a high-value attention slot. Milk Road and Bankless proved that the curator who shows up consistently in the right slot owns the category. We are making the same bet on a narrower audience — which means faster dominance.

---

## 4. Revenue Impact Analysis

### Conversion Path

```
Twitter post → /news page → firm detail page → weekly digest signup → paid subscription
```

**Step by step:**

1. Bot posts at 7:15 AM ET. Creator @mention triggers a retweet (likely for <500k-follower creators). Retweet exposes the post to the creator's audience — traders who already follow prop trading content.
2. Post links directly to `/news`. Visitors are already interested in prop trading intelligence — not cold traffic.
3. From `/news`, firm names appear in AI summaries. Curious traders click through to firm pages and hit the core product value (payout data, incidents, "Our Take").
4. Weekly digest CTA on firm pages and `/news` page. Free signup, lowest friction conversion step.
5. Digest subscribers see premium intelligence weekly. Upgrade path to paid.

### Estimated Traffic & Revenue Impact (90 days)

| Metric | Low | Mid | High |
|---|---|---|---|
| Twitter impressions/day (Week 2+) | 200 | 800 | 2,500 |
| Click-through to /news (3% CTR) | 6/day | 24/day | 75/day |
| /news → digest signup (8%) | ~0 | 2/day | 6/day |
| New digest subscribers/month | 15 | 60 | 180 |
| Digest → paid conversion (5%) | 1/mo | 3/mo | 9/mo |
| MRR added/month (@$29–49) | $29–49 | $87–147 | $261–441 |

*Low = no creator retweets, account has no followers. Mid = 2–3 creator retweets/week, modest follower growth. High = one post goes modestly viral via a 100k+ creator.*

### Secondary Revenue Effects

- **Creator partnerships:** A creator who sees consistent, quality coverage of their content is a warm lead for an affiliate or sponsored placement deal. No cold pitch needed.
- **SEO backlinks:** Creators linking back to `/news` from their own channels signals domain authority for firm pages on Google.
- **Brand authority:** Association with quality YouTube content lifts perceived credibility of our payout data and incident reports — reducing friction across all conversion points.

---

## 5. Company OKRs for This Test

**Objective:** Validate Twitter as a repeatable, low-cost acquisition channel for prop trading intelligence users.

| # | Key Result | Target | Measures |
|---|---|---|---|
| KR1 | Posts published without error or policy violation | ≥15 posts in 3 weeks | Operational reliability |
| KR2 | Creator retweets or quote-tweets | ≥5 across the test | Distribution amplification |
| KR3 | Unique UTM clicks to `/news` from Twitter | ≥75 total | Actual traffic delivery |
| KR4 | New digest signups traceable to Twitter referral | ≥8 total | Funnel conversion |

**Diagnostic use:** These OKRs are pass/fail thresholds AND diagnostics. Hit KR1+KR2 but miss KR3 → tweet copy problem. Hit KR3 but miss KR4 → `/news` page conversion problem.

---

## 6. Marketing Strategy: How This Works in the Wild

### Proven Analogues

| Account / Product | Strategy | Key Lesson |
|---|---|---|
| **Bankless** | Surfaces research + @mentions author + "Best take on X this week" | Author almost always retweets → two-way audience loop |
| **Milk Road** | Daily "top 3 reads" with hook, pull quote, link | Grew 50k newsletter subs in 6 months partly from Twitter |
| **@unusual_whales** | Curates content + pings creators + sharp commentary | Became a community node; creators check this account |
| **TLDR Tech/News** | 5-10 daily summaries as individual tweets | 200k+ followers via consistency + brevity |
| **@financialjuice** | Real-time finance headlines | Proves trading audiences follow pure-signal accounts |

**Core insight:** *Curation with voice* (even 5 words of commentary) dramatically outperforms pure link sharing. The accounts that won became nodes — entities that other creators check — not just pipes.

### Tweet Format

**Template A — Primary (with creator ping)**
```
[Hook: 1 sentence about the insight, <80 chars]

[AI summary distilled to 1 punchy sentence]

Via @[creator_handle] 📺 [YouTube link]

Full breakdown + today's other picks: [site/news link]

#PropTrading #[TopicHashtag]
```

**Template B — No ping available**
```
[Sharper hook — carries more weight without creator amplification]

"[Short pull quote or key insight from the video]"

📺 [Video Title] → [YouTube link]

More like this: [site/news link]

#PropTrading #[Hashtag]
```

**Template C — Thread (2–3x/week when all 3 picks share a theme)**
- Tweet 1: hook ("Top 3 prop trading videos worth your time today 🧵")
- Tweets 2–4: one per video (title + 1-sentence summary + creator @mention + link)
- Tweet 5: CTA back to /news + follow prompt

### When to Ping vs. Not Ping

**Ping when:**
- Creator's Twitter account is active (posted within 30 days)
- Follower count < 500k (they'll see it and are likely to retweet)
- Video posted within 7 days

**Do not ping when:**
- No linked Twitter account found
- Creator has 500k+ followers (mega-channel; won't see it)
- Video is older than 2 weeks
- Same creator was tagged in the past 7 days

### Timing

- **Post time:** 7:15 AM ET, Monday–Saturday
- **No Sunday posts** — prop trading Twitter is low-engagement; hurts account health metrics
- **Avoid:** 9:30–11:30 AM ET (market open; traders are executing)
- **Thread day:** Thursday or Friday (end-of-week recap framing)

### Spam Risk Mitigation

- Cap at 2 hashtags per tweet (3 max)
- Vary hook sentence every day — never identical consecutive tweets
- 1 @mention per tweet max
- Use full domain URLs — no link shorteners
- Build in minimum 30-minute gaps between any automated tweets
- Interleave 1–2 manual retweets/replies per week (pure bot = suspension signal)
- Complete the account profile before posting: logo, bio, pinned tweet, website URL

---

## 7. Feature Scope: What We're Building (PM)

### What Exists Already
- `/news` page with top 3 YouTube videos + top 3 Twitter posts (daily, force-dynamic)
- `youtube_daily_picks` table with video metadata + AI summaries
- Admin debug page to inspect candidates and run ingest manually

### New Components Required

**Database:**
- Add `twitter_handle` (nullable varchar) to `youtube_channels` table
- Populate manually during channel onboarding or via one-time enrichment
- New migration: `migrations/42_youtube_channels_twitter_handle.sql`

**Admin UI — Twitter Draft Queue (`/admin/twitter-queue`):**
- Shows tomorrow's drafted tweet (generated nightly at 10 PM ET)
- Displays: hook text, AI summary snippet, creator @mention (if found), links, hashtags
- Actions: Approve & Schedule | Edit | Skip Today
- Week 1: required approval before posting
- Week 3: auto-approve mode toggle (skips queue, posts directly)

**Cron Job — Tweet Generator (`/api/cron/generate-twitter-draft`):**
- Runs at 10 PM ET nightly
- Pulls today's `youtube_daily_picks` (top 3)
- Looks up `twitter_handle` for each video's channel
- Selects Template A (if handle found) or Template B
- Generates hook + summary snippet using AI summary field
- Appends UTM-tagged `/news` link
- Saves draft to new `twitter_drafts` table (status: pending | approved | posted | skipped)

**Cron Job — Tweet Poster (`/api/cron/post-twitter-tweet`):**
- Runs at 7:10 AM ET
- Checks `twitter_drafts` for today's approved (or auto-approved) draft
- Posts via Twitter API v2
- Updates `twitter_drafts.status` to `posted` + stores `tweet_id`
- On failure: sets status to `failed`, sends admin alert

**Analytics:**
- UTM parameters on all `/news` links in tweets: `?utm_source=twitter&utm_medium=bot&utm_campaign=daily-picks`
- Track clicks in existing analytics

### What Success Looks Like on `/news`
- No visual changes required for the alpha phase
- Future: small "Follow us on Twitter" CTA on the `/news` page pointing to the bot account
- Future: display tweet impressions alongside video scores (Week 4+)

---

## 8. Three-Week Rollout Plan

### Week 1 — Alpha / Internal Validation (Days 1–7)

**Goal:** Validate tweet quality, @mention accuracy, and pipeline reliability before going public.

**What happens:**
- Bot runs in draft mode: generates tweets nightly, no public posting
- Team reviews all 7 drafts in the admin queue
- Manually verify all @mentions point to correct, active Twitter handles
- Confirm AI summaries accurately represent the video content
- Confirm UTM tracking fires correctly in analytics
- Check that hook sentences vary across the 7 drafts

**Success criteria to advance to Week 2:**
- 7 drafts generated successfully
- ≥5 drafts judged post-worthy without edits
- All @mentions verified as correct
- UTM tracking confirmed working
- No consecutive tweets with identical opening phrase

**Kill condition:** If ≥3 drafts have wrong/missing @mentions, or AI summaries are consistently generic → fix pipeline before going public.

---

### Week 2 — First Public Posts (Days 8–14)

**Goal:** Validate real-world engagement, creator response, and traffic impact.

**What happens:**
- Bot posts automatically at 7:15 AM ET, Mon–Sat
- Drafts generated at 10 PM ET; team approves before 7 AM
- Monitor Twitter account health daily (impressions, follows, spam flags)
- Check shadowban status weekly (shadowban.eu or equivalent)
- Track UTM traffic to `/news` in real-time after each post
- Reply to any comments authentically; do not seek engagement proactively yet

**Success criteria to advance to Week 3:**
- ≥10 posts published without policy violation
- ≥3 creator retweets or meaningful engagements
- ≥30 UTM clicks to `/news`
- Account in good standing (no warnings, no rate limits)

**Kill condition:** Any account warning, suspension, or spam flag → pause, diagnose, reduce frequency, do not push through.

---

### Week 3 — Scale & Creator Engagement (Days 15–21)

**Goal:** Remove manual gate, engage creators directly, gather performance data for go/no-go decision.

**What happens:**
- Remove manual approval requirement; bot posts fully automatically
- Begin proactive creator engagement: reply to creators whose videos we featured ("Included your video in today's top 3 — great breakdown of [concept]")
- Start tagging 1–2 adjacent accounts per week (firm official accounts, prominent traders) when contextually appropriate
- Run performance audit: which video categories drove most clicks? Feed back into scoring weights.
- Analyze top-performing tweets: what made them work? (hook phrasing, creator size, topic, hashtag)

**Success criteria to declare test successful:**
- All 4 OKR Key Results achieved
- If yes → Twitter bot goes into permanent content distribution stack, monthly review cadence

---

## 9. Risk Assessment

### Risk 1: Twitter API Spam Detection / Account Suspension
- **Description:** New accounts posting daily links with identical formats are flagged by Twitter's systems. A suspension at Week 2 kills the test and requires starting over.
- **Likelihood:** Medium
- **Mitigation:**
  - Week 1 warmup (no posting) gives account age and trust signals
  - Admin review queue ensures no two consecutive tweets share identical opening phrases
  - Consider posting from a personal founder account first to validate format
  - Keep 7-day pre-written tweet buffer so brief suspensions don't break cadence

### Risk 2: Creator @Mention Backfires
- **Description:** A creator with a large engaged audience reacts negatively if our summary misrepresents their video, or interprets the tag as spam. A public callout from a 200k-follower creator is brand damage.
- **Likelihood:** Low
- **Mitigation:**
  - Week 1 manual review specifically validates that AI summaries accurately reflect the video's actual content
  - If summary is vague or generic, skip that day's tag
  - Never tag a creator whose content we've mischaracterized

### Risk 3: Traffic Arrives But Does Not Convert
- **Description:** Bot works, creators retweet, traffic arrives at `/news` — but traders bounce without signing up for the digest. Top-of-funnel works, mid-funnel is broken.
- **Likelihood:** Medium
- **Mitigation:**
  - Before Week 2 posts go live, audit `/news` page for a clear, low-friction digest signup CTA above the fold
  - UTM tracking isolates Twitter-sourced bounce rate specifically
  - If conversion is poor at Week 3 review, fix is on the landing page — a solvable UX problem, not a channel problem

---

## 10. Actionable Tasks & Measurable Metrics

### Pre-Launch Tasks (Before Week 1)

| # | Task | Owner | Done When |
|---|---|---|---|
| 1 | Create Twitter account for the bot; complete profile (logo, bio, pinned tweet, website = /news) | Founder | Account live, profile complete |
| 2 | Write migration `42_youtube_channels_twitter_handle.sql` — add `twitter_handle` nullable varchar to `youtube_channels` | Eng | Migration applied |
| 3 | Enrich existing channels: manually look up Twitter handles for all active YouTube channels in the DB | Founder | All channels have handle or `null` confirmed |
| 4 | Build admin Twitter draft queue page (`/admin/twitter-queue`) | Eng | Can view, approve, edit, skip drafts |
| 5 | Build tweet generator cron (`/api/cron/generate-twitter-draft`) | Eng | Runs at 10 PM ET, generates Template A or B based on handle availability |
| 6 | Build tweet poster cron (`/api/cron/post-twitter-tweet`) | Eng | Posts approved drafts at 7:10 AM ET via Twitter API v2 |
| 7 | Add UTM params to all `/news` links generated by the bot | Eng | `?utm_source=twitter&utm_medium=bot&utm_campaign=daily-picks` confirmed in URLs |
| 8 | Confirm analytics captures UTM traffic to `/news` | Founder | Verified in analytics dashboard |
| 9 | Audit `/news` page for digest signup CTA visibility | Founder | Clear CTA visible above the fold |

### Week 1 Checklist (Internal Review)

- [ ] 7 consecutive drafts generated without errors
- [ ] Each draft reviewed: hook quality, @mention correctness, summary accuracy
- [ ] No two consecutive drafts share identical opening phrase
- [ ] UTM link in each draft confirmed
- [ ] @mentions verified: active account, correct person, channel-to-twitter mapping correct
- [ ] Flagged any channels missing a Twitter handle → decide: skip tag or research further

### Week 2 Checklist (First Live Posts)

- [ ] First post published Monday 7:15 AM ET
- [ ] Check analytics for UTM traffic within 2 hours of posting
- [ ] Monitor for creator retweet within 24 hours of each post
- [ ] Check account health end of each day (no warnings, impressions baseline set)
- [ ] Shadowban check at end of Week 2

### Week 3 Checklist (Scale)

- [ ] Auto-approve mode enabled
- [ ] Reply to ≥3 creators whose content was featured
- [ ] Tag ≥1 adjacent account contextually
- [ ] Run performance analysis: top 3 tweets vs. bottom 3 by CTR
- [ ] Final OKR scorecard completed

### Key Metrics Dashboard (Track Weekly)

| Metric | Tool | Target (3-week test) |
|---|---|---|
| Tweets posted | Twitter Analytics | ≥15 |
| Impressions/tweet | Twitter Analytics | >200 avg by Week 3 |
| Creator retweets | Manual tracking | ≥5 total |
| UTM clicks to /news | Analytics (UTM filter) | ≥75 total |
| New digest signups via Twitter | Analytics (UTM → signup funnel) | ≥8 total |
| Account health status | shadowban.eu / Twitter Health | No flags |
| Bounce rate (Twitter-sourced) | Analytics | <70% |

### Definition of Success

**Test passes** if KR1–KR4 all achieved by Day 21. Decision: Twitter bot becomes permanent channel. Monthly review replaces weekly babysitting.

**Test partially passes** (KR1+KR2 hit, KR3 or KR4 missed): Diagnose the broken step in the funnel, fix it, run a 2-week extension.

**Test fails** (account suspended or <3 creator engagements): Post-mortem, fix account strategy, restart with adjusted approach. Do not abandon the channel — fix the execution.

---

*Report compiled from: product-manager (feature audit + personas), marketing-manager (channel research + tweet strategy), company-ceo (goals + OKRs + revenue analysis + rollout)*
*Sprint: current — move to `documents/sprints/` when complete*

---

## 11. Tech Lead Review — Challenges, Gaps & Questions

*Reviewed by: Tech Lead — 2026-03-15*

---

### Hard Blockers (must resolve before any code is written)

**BLOCKER 1 — Migration number conflict**
The PM spec calls for `migrations/42_youtube_channels_twitter_handle.sql`. This is wrong — `42_youtube_keywords_replace.sql` already exists. The next migration is `43_`. This is a concrete error in the PM's scope document. **Corrected: use `43_youtube_channels_twitter_handle.sql`.**

**BLOCKER 2 — Twitter API credentials not mentioned**
The entire plan assumes Twitter API v2 access but there are zero env vars defined for it. We need:
- `TWITTER_API_KEY`
- `TWITTER_API_SECRET`
- `TWITTER_ACCESS_TOKEN` (write-access token for the bot account)
- `TWITTER_ACCESS_TOKEN_SECRET`
- `TWITTER_BEARER_TOKEN`

The marketing manager recommended Basic tier ($100/month). That decision needs to be made and the developer app created **before Week 1 starts**. This is a founder-level action, not an engineering task.

**BLOCKER 3 — `/news` page has no conversion CTA today**
Reading the actual code (`app/news/page.tsx`): the page has a YouTube section, a Twitter section, and a single footer link to `/propfirms`. There is **no email signup CTA anywhere on the page**. The CEO's revenue model assumes 8% conversion from `/news` → digest signup. That assumption is currently impossible — the button doesn't exist. The PM's statement "No visual changes required for alpha phase" contradicts the CEO's conversion funnel. **This needs to be resolved before Week 2 goes live.** Building the CTA is scoped in as a required pre-Week-2 task.

---

### Technical Gaps in PM Scope

**GAP 1 — AI summary quality is title-only inference**
Looking at `lib/youtube/summarize-video.ts`: the summarizer receives only `title`, `channelName`, and `views`. It infers content from the title alone. The prompt literally says "based on the title." For a tweet that @mentions a creator, this is a meaningful risk — if the title is vague (e.g. "My Updated Prop Firm Tier List 2026"), the AI summary will be generic. The Week 1 manual review process catches individual bad outputs, but the root cause is structural. **Question for PM/CEO: Is title-only summarization acceptable long-term, or should we enrich with video description during ingest?** This would require a YouTube `videos.list` API call per pick (cost: ~3 units/day, trivial).

**GAP 2 — No metrics storage defined for Twitter performance**
The CEO's OKRs require tracking impressions, CTR, and creator retweets. Twitter API v2 returns tweet metrics only if you fetch them separately after posting (not at post time). The PM spec only mentions `twitter_drafts` table with a `tweet_id` column. That's not sufficient. We need:
- A `twitter_post_stats` table (or a metrics JSONB column on `twitter_drafts`)
- A daily metrics-fetch cron (runs ~24h after posting to capture stabilized impression counts)
- An admin metrics dashboard page

Without this, the "Key Metrics Dashboard" in section 10 has no data source. The CEO and PM are flying blind on KR2 and KR3.

**GAP 3 — Thread support not scoped but mentioned in strategy**
Template C (thread format) is described in the marketing strategy as a feature for 2-3x per week. Threads require posting a chain of tweets via `in_reply_to_tweet_id`. This is meaningfully more complex than a single tweet — it's a different code path entirely. The PM scope does not mention thread support, thread generation logic, or how the admin queue UI handles threads. **My recommendation: scope out threads for the 3-week test. Post single tweets only (Template A or B). Add threads as a Week 4+ enhancement once the core pipeline is validated.**

**GAP 4 — Cron timezone mismatch**
The strategy says "post at 7:15 AM ET." Our existing crons run in UTC. ET = UTC-5 (winter) or UTC-4 (summer). Since we're in March 2026, DST will apply (second Sunday of March). The correct UTC time is **11:15 UTC** currently. This needs to be explicit in the cron schedule, not left as "ET."

**GAP 5 — Tweet generator prompt not defined**
The PM says "Generates hook + summary snippet using AI summary field" but doesn't define the LLM prompt. This is critical — the tweet hook is what determines whether creators retweet and users click. A vague prompt produces vague hooks. This needs to be defined before the generator cron is built, not discovered during Week 1 review.

**GAP 6 — `twitter_drafts` failure recovery not defined**
PM spec says "On failure: sets status to `failed`, sends admin alert." But what then? If the 7:10 AM ET posting cron fails (network timeout, API rate limit), the draft sits as `failed`. Does it retry? At what time? Can the admin manually re-trigger from the queue UI? This edge case needs a defined answer because it will happen eventually.

---

### Questions for CEO

**Q1 — Twitter bot account: personal or brand?**
The marketing manager suggested using the founder's personal account first to validate tweet format (lower spam risk for a new account). But the CEO strategy assumes a brand account (@[productname]). These have different trust profiles and follower base growth patterns. Which account are we actually posting from in Week 2? This determines the account creation timeline.

**Q2 — $100/month Twitter API cost: approved?**
Basic tier is required for write access + read-back for metrics. This should be a line item the CEO explicitly approves before engineering starts.

**Q3 — Revenue model gap: what is the paid tier?**
The CEO's revenue table shows "paid subscription @$29–49/month" but the current Stripe config and product page need to be checked — are these tiers live and discoverable? The conversion funnel breaks if there's nowhere to upgrade to. The PM should verify this independently.

---

### Questions for PM

**Q4 — What does "polish the /news page" mean exactly?**
The user (founder) mentioned polishing the `/news` page alongside the bot. The PM spec says "No visual changes required for alpha phase." These are in tension. Tech Lead needs a concrete list of `/news` UI improvements before starting, otherwise scope creeps during implementation. Suggested minimum for Week 2 readiness:
- Email digest signup CTA above the fold (required for conversion)
- "Follow us on Twitter" link pointing to the bot account
- Display "Updated daily at 07:00 UTC" with last-updated timestamp

What else is in scope?

**Q5 — Who enriches the `twitter_handle` field?**
Migration `43_` adds `twitter_handle` to `youtube_channels`. The PM says "populate manually during channel onboarding." But we currently have N active channels already in the DB. Someone needs to look up handles for every existing channel. Is this the founder's job before Week 1? If so, how many channels are we talking about, and is there a lookup tool in the admin UI to make this easier?

---

### Tech Lead Recommendations (changes to the plan)

| # | Recommendation | Impact |
|---|---|---|
| TL-1 | Rename migration to `43_youtube_channels_twitter_handle.sql` | Fixes naming conflict |
| TL-2 | Add Twitter API credential setup as a pre-Week-1 founder task | Unblocks all engineering |
| TL-3 | Add `/news` page digest CTA as a required pre-Week-2 engineering task | Enables conversion funnel |
| TL-4 | Add `twitter_post_stats` table + daily metrics-fetch cron to scope | Enables OKR tracking |
| TL-5 | Remove thread support (Template C) from 3-week scope | Reduces risk, simplifies pipeline |
| TL-6 | Fix all cron times to UTC explicitly (7:15 AM ET = 11:15 UTC in summer, 12:15 UTC in winter) | Prevents silent timing bugs |
| TL-7 | Define LLM prompt for tweet hook generation before sprint starts | Prevents Week 1 quality failures |
| TL-8 | Add video description enrichment to ingest (3 YouTube API units/day) to improve summary quality | Addresses summary accuracy risk |
| TL-9 | Add manual re-trigger button to admin queue UI for failed posts | Operational resilience |

---

### Tech Lead Sign-off Conditions

Before any code is committed for this feature, the following must be resolved:

- [ ] CEO approves Twitter Basic API tier ($100/month)
- [ ] Twitter bot account created (brand or founder — decision made)
- [ ] All Twitter API env vars added to `.env` and documented in CLAUDE.md
- [ ] PM confirms `/news` page polish scope (minimum: digest CTA + Twitter follow link)
- [ ] PM confirms thread support is out of 3-week scope
- [ ] Migration number corrected to `43_`
- [ ] Tweet hook LLM prompt drafted and reviewed
