# Task Plan: Twitter Bot × YouTube Picks — 3-Week Launch Cycle

**Goal:** Build a Twitter bot that posts daily top-3 YouTube picks, @mentions creators, and links back to /news. Simultaneously polish /news for conversion. Validate Twitter as an acquisition channel over 3 weeks.

**Strategy doc:** `documents/current_sprint/twitter-bot-youtube-picks-strategy.md`
**Started:** 2026-03-15
**Target:** Week 1 internal review live by end of this sprint

---

## Phase Overview

| Phase | Name | Status |
|---|---|---|
| 0 | Pre-flight: blockers & founder setup | `in_progress` |
| 1 | DB migrations + Twitter client | `pending` |
| 2 | Tweet generator cron | `pending` |
| 3 | Admin queue UI | `pending` |
| 4 | /news page polish | `pending` |
| 5 | Tweet poster cron + metrics fetch | `pending` |
| 6 | Week 1 — internal review (no posting) | `pending` |
| 7 | Week 2 — first public posts | `pending` |
| 8 | Week 3 — scale + creator engagement | `pending` |

---

## Phase 0 — Pre-flight (Founder tasks, unblocks engineering)
**Status:** `in_progress`

- [ ] **P0-1** Decide: brand account vs. founder personal account for Twitter bot
- [ ] **P0-2** Create Twitter developer app; purchase Basic tier ($100/mo); get API keys
- [ ] **P0-3** Add Twitter env vars to `.env`:
  ```
  TWITTER_API_KEY=
  TWITTER_API_SECRET=
  TWITTER_ACCESS_TOKEN=
  TWITTER_ACCESS_TOKEN_SECRET=
  TWITTER_BEARER_TOKEN=
  ```
- [ ] **P0-4** (After Phase 1 migration) Look up + enter Twitter handles for all active YouTube channels in DB via admin UI
- [ ] **P0-5** Eng: Document Twitter env vars in CLAUDE.md

**Done when:** Env vars set, account decision made.

---

## Phase 1 — DB Migrations + Twitter API Client
**Status:** `pending`
**NOTE:** Use `twitter-api-v2` free tier for posting only. No metrics from Twitter API — UTM tracking is enough. Drop `twitter_post_stats` table.

### Install dependency
- [ ] **P1-0** `npm install twitter-api-v2`

### Migrations (2 only, no stats table)
- [ ] **P1-1** `migrations/43_youtube_channels_twitter_handle.sql` — add `twitter_handle VARCHAR(100)` nullable to `youtube_channels`
- [ ] **P1-2** `migrations/44_twitter_drafts.sql` — tweet draft queue:
  - `id UUID PK`, `draft_date DATE UNIQUE`, `tweet_text TEXT`, `template CHAR(1)` (A/B)
  - `creator_handle VARCHAR(100)`, `video_title TEXT`, `video_url TEXT`, `news_url TEXT`
  - `status TEXT CHECK IN (pending,approved,posted,skipped,failed)`, `tweet_id TEXT`
  - `failure_reason TEXT`, `auto_approve BOOLEAN DEFAULT false`
  - `created_at TIMESTAMPTZ DEFAULT NOW()`, `updated_at TIMESTAMPTZ DEFAULT NOW()`
- [ ] **P1-3** Apply both migrations in Supabase

### Twitter API Client
Env vars needed (add to .env): `TWITTER_API_KEY`, `TWITTER_API_SECRET`, `TWITTER_ACCESS_TOKEN`, `TWITTER_ACCESS_TOKEN_SECRET`
- [ ] **P1-4** `lib/twitter-bot/client.ts` — thin wrapper around `twitter-api-v2`:
  - `postTweet(text: string): Promise<{ tweetId: string }>`
  - Reads 4 env vars, throws descriptive error if missing
- [ ] **P1-5** `lib/twitter-bot/client.test.ts` — mock `twitter-api-v2`, test success + missing env (≥80%)

**Done when:** Migrations applied, `npm test lib/twitter-bot/client.test.ts` passes.

---

## Phase 2 — Tweet Generator Cron
**Status:** `pending`

- [ ] **P2-1** Define LLM prompt for hook generation (review before coding):
  - Input: video title, channel name, AI summary
  - Output: hook sentence <80 chars, varied phrasing each day
  - Model: GPT-4o-mini, temperature 0.7
- [ ] **P2-2** `lib/twitter-bot/generate-tweet.ts`:
  - `generateTweetDraft(picks: YouTubePick[], channelHandles: Map<string,string>): TweetDraft`
  - Uses rank-1 pick for the daily tweet
  - Selects Template A (handle exists) or Template B (no handle)
  - Hook generated via OpenAI
  - Assembles full tweet text with UTM `?utm_source=twitter&utm_medium=bot&utm_campaign=daily-picks`
  - Validates ≤280 chars; truncates gracefully if over
- [ ] **P2-3** `lib/twitter-bot/generate-tweet.test.ts` (≥80% coverage):
  - Test Template A and B generation
  - Test character length enforcement
  - Test UTM link presence
- [ ] **P2-4** `app/api/cron/generate-twitter-draft/route.ts`:
  - Runs at **22:15 UTC** nightly (generates draft for next day)
  - Idempotent: skip if draft already exists for tomorrow
  - Inserts into `twitter_drafts` with status `pending`
  - CRON_SECRET protected
- [ ] **P2-5** `app/api/cron/generate-twitter-draft/route.test.ts`

**Done when:** Cron generates correct draft in DB; tests pass ≥80%.

---

## Phase 3 — Admin Queue UI
**Status:** `pending`

- [ ] **P3-1** `app/api/admin/twitter/drafts/route.ts` — GET list of recent drafts
- [ ] **P3-2** `app/api/admin/twitter/drafts/[id]/route.ts` — PATCH (approve/skip/edit tweet_text)
- [ ] **P3-3** `app/api/admin/twitter/drafts/[id]/route.test.ts`
- [ ] **P3-4** `app/admin/twitter-queue/page.tsx`:
  - **Upcoming:** tomorrow's draft card (full tweet text, char count, template type, creator handle, UTM link)
  - **Actions:** Approve | Edit (inline) | Skip | Retry (if failed)
  - **History table:** last 14 days — date, status badge, tweet_id link, impressions/retweets (from stats)
  - **Auto-approve toggle** (Week 3 mode)
  - Status badges: pending=orange, approved=green, posted=blue, skipped=gray, failed=red

**Done when:** Admin can view, approve, and skip drafts; history visible.

---

## Phase 4 — /news Page Polish
**Status:** `pending`

- [ ] **P4-1** Add digest signup CTA block above the fold (between header and YouTube section):
  - "Get the weekly intelligence report" headline
  - "Payout trends, firm incidents, top content — every Sunday." sub-copy
  - Email input + subscribe button (wire to existing subscription flow)
- [ ] **P4-2** Add "Follow us on 𝕏" link below YouTube section header (pointing to bot account URL)
- [ ] **P4-3** Show `Last updated: [time]` timestamp (from max created_at of today's picks)
- [ ] **P4-4** Fix empty state copy clarity

**Done when:** CTA visible, Twitter follow link present, no broken layouts.

---

## Phase 5 — Tweet Poster Cron + Metrics Fetch
**Status:** `pending`

- [ ] **P5-1** `lib/twitter-bot/post-tweet.ts`:
  - `postApprovedDraft(date: string): PostResult`
  - Finds approved (or auto-approved) draft for given date
  - Calls `client.postTweet()`
  - On success: status → `posted`, stores `tweet_id`, `posted_at`
  - On failure: status → `failed`, stores `failure_reason`, sends Resend admin alert
- [ ] **P5-2** `lib/twitter-bot/post-tweet.test.ts` (≥80% coverage)
- [ ] **P5-3** `app/api/cron/post-twitter-tweet/route.ts`:
  - Runs at **11:15 UTC** (7:15 AM ET summer; change to 12:15 UTC Nov–Mar)
  - Calls `postApprovedDraft(today)`
  - If no approved draft: sends admin warning alert, returns 200 (not 500)
  - CRON_SECRET protected
- [ ] **P5-4** `lib/twitter-bot/fetch-metrics.ts`:
  - `fetchAndStoreMetrics(draftId, tweetId): void`
  - Calls `client.getTweetMetrics()`, upserts into `twitter_post_stats`
- [ ] **P5-5** `app/api/cron/fetch-twitter-metrics/route.ts`:
  - Runs at **11:15 UTC** (24h after posting — day+1)
  - Finds all `posted` drafts from yesterday without stats
  - Calls `fetchAndStoreMetrics` for each
  - CRON_SECRET protected
- [ ] **P5-6** `lib/twitter-bot/post-tweet.test.ts` + `fetch-metrics.test.ts` (≥80%)
- [ ] **P5-7** Add both new crons to GitHub Actions or Vercel cron config

**Done when:** Can post a test tweet, metrics fetched next day, admin queue shows impressions.

---

## Phase 6 — Week 1: Internal Review (No Public Posting)
**Status:** `pending`
Generator runs nightly. Team reviews drafts each morning. No Twitter API posting.

### Daily Actions
- Open `/admin/twitter-queue`
- Review draft: hook uniqueness, @mention accuracy, summary accuracy, char count, UTM link
- Mark approve (would post) or skip (needs work)
- Log in `progress.md`

### Exit Criteria → Week 2
- [ ] 7 drafts generated without pipeline errors
- [ ] ≥5 drafts rated post-worthy without edits
- [ ] 0 incorrect @mentions
- [ ] No consecutive identical hook openings
- [ ] UTM link verified in analytics (manual test click)
- [ ] Admin queue UI feels smooth

---

## Phase 7 — Week 2: First Public Posts
**Status:** `pending`
Bot posts at 11:15 UTC Mon–Sat. Manual approval required night before.

### Exit Criteria → Week 3
- [ ] ≥10 posts published, 0 policy violations
- [ ] ≥3 creator retweets or engagements
- [ ] ≥30 UTM clicks to /news
- [ ] Account healthy, no flags
- [ ] Shadowban check passed

---

## Phase 8 — Week 3: Scale + Creator Engagement
**Status:** `pending`
Auto-approve enabled. Proactive creator replies begin.

### Tasks
- [ ] Enable auto-approve toggle
- [ ] Reply to 3+ creators
- [ ] Tag 1 adjacent account contextually
- [ ] Run performance analysis (best/worst tweet CTR)
- [ ] Generate OKR scorecard; share with PM + CEO

---

## Errors Encountered

| Error | Phase | Resolution |
|---|---|---|
| Migration `42_` name conflict (PM said `42_` but already exists) | Planning | Corrected to `43_` in all docs |

---

## Key Decisions

| Decision | Owner | Date |
|---|---|---|
| Thread support (Template C) OUT of 3-week scope | Tech Lead | 2026-03-15 |
| Post cron at 11:15 UTC (7:15 AM ET summer DST) | Tech Lead | 2026-03-15 |
| GPT-4o-mini for hook generation (temp 0.7) | Tech Lead | 2026-03-15 |
| Metrics fetched 24h post via separate cron | Tech Lead | 2026-03-15 |
| Use rank-1 pick only for the daily tweet | Tech Lead | 2026-03-15 |
