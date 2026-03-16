# Findings — Twitter Bot × YouTube Picks Launch

*Previous session (news feed build) findings archived. This file covers the Twitter bot sprint.*

---

## Codebase Audit — What Exists (2026-03-15)

### Already Built (no rework needed)
- `lib/youtube/ingest.ts` — full daily ingest pipeline, tested, working
- `lib/youtube/summarize-video.ts` — GPT-4o-mini title-only summaries (3/day)
- `app/news/page.tsx` — public /news page with YouTube + Twitter sections
- `app/api/cron/fetch-youtube-news/route.ts` — daily cron at 07:00 UTC
- `youtube_daily_picks` table — has `channel_id`, `ai_summary`, `video_url` — all fields we need
- `youtube_channels` table — active channels, needs `twitter_handle` column added
- Admin channels UI at `/admin/news/channels` — already allows channel management
- `lib/twitter-bot/` — does NOT exist yet (new lib module)
- `lib/ai/openai-client.ts` — existing OpenAI singleton to reuse

### Key Schema Facts
- Last migration: `42_youtube_keywords_replace.sql` → next must be **`43_`**
- `youtube_channels` schema: `id, channel_id, channel_name, category, upload_playlist_id, active, created_at, updated_at` — no twitter_handle yet
- `youtube_daily_picks` has `channel_id` — can JOIN to `youtube_channels` to get `twitter_handle`
- Existing cron pattern: GET handler, `Authorization: Bearer CRON_SECRET`, `maxDuration = 120`

### /news Page — Current State
- **NO email signup CTA** — only a footer link to /propfirms. CEO's 8% conversion rate assumption has no mechanism currently.
- **NO "Follow on Twitter" link** — needs adding for Week 2
- Force-dynamic server component — queries Supabase on each request
- Empty state copy is functional but could be cleaner

### AI Summarizer Limitation
- `summarize-video.ts` infers content from `title + channelName + views` ONLY
- Does NOT fetch video description or transcript
- Risk: vague hook if title is generic (e.g. "My Updated Tier List 2026")
- Fix: add `videos.list` call during ingest to store `description` (costs ~3 YouTube API units/day — trivial)
- Decision: implement description enrichment in Phase 2 to improve tweet hook quality

### Twitter API Requirements — REVISED
- Existing Twitter data (reading/searching) = Apify (`lib/apify/twitter-scraper.ts`) — keep as-is
- For POSTING tweets: Twitter API v2 **free tier** ($0/month)
  - Free tier write limit: 1,500 tweets/month. We need ~30/month. Fine.
  - Posting requires OAuth 1.0a user context (not app-only bearer token)
  - Library: `twitter-api-v2` npm package (handles OAuth 1.0a signing)
  - Env vars needed: `TWITTER_API_KEY`, `TWITTER_API_SECRET`, `TWITTER_ACCESS_TOKEN`, `TWITTER_ACCESS_TOKEN_SECRET`
  - No `TWITTER_BEARER_TOKEN` needed (bearer token = read-only app context; we post as a user)
- **No metrics from Twitter API** — use UTM click tracking only. Simplifies scope, removes need for metrics-fetch cron and `twitter_post_stats` table.
- `twitter-api-v2` not in package.json yet — must install

### Cron Infrastructure
- Existing crons: `fetch-youtube-news`, `send-weekly-reports`, `ingest-firm-emails`, `sync-payouts`
- All use GET handler with CRON_SECRET Bearer auth
- GitHub Actions workflow fires them — need to add 2 new cron entries
- New crons needed:
  - `generate-twitter-draft` at 22:15 UTC nightly
  - `post-twitter-tweet` at 11:15 UTC daily (7:15 AM ET summer)
  - `fetch-twitter-metrics` at 11:15 UTC next day

### Tweet Character Budget (Template A, worst case)
```
Hook (80) + summary snippet (90) + "Via @handle" (20) + YouTube URL (23) + site UTM URL (23) + hashtags (28) + newlines (6) = ~270 chars
```
Safely under 280. Generator must validate before saving.

### UTM Strategy
All `/news` links in bot tweets: `?utm_source=twitter&utm_medium=bot&utm_campaign=daily-picks`
Allows isolation of Twitter-sourced traffic in analytics for OKR tracking.

---

## Technical Decisions

| Decision | Rationale |
|---|---|
| Next migration = `43_` | `42_youtube_keywords_replace.sql` already exists |
| Thread support OUT of 3-week scope | Requires chained API calls; adds complexity; validate single-tweet first |
| Post at 11:15 UTC (7:15 AM ET summer) | Pre-market slot; adjust to 12:15 UTC Nov–Mar (EST) |
| Rank-1 pick only for daily tweet | Simpler; rank-1 is already the best pick by score |
| GPT-4o-mini temp=0.7 for hook | Higher temp = more variation = less spam signal from identical openers |
| Metrics fetch at 24h post-tweet | Twitter's public_metrics stabilize within 24h; cleaner data |
| Add `description` field to ingest | Costs 3 YouTube API units/day; improves hook quality meaningfully |

---

## Issues & Resolutions

| Issue | Resolution |
|---|---|
| PM specified migration `42_` for twitter_handle | Corrected to `43_` in all docs and task_plan |
| No conversion CTA on /news page | Scoped as Phase 4 required task before Week 2 |
| AI summaries title-only → weak hooks | Add `description` enrichment to ingest in Phase 2 |
| ET vs UTC cron time ambiguity | Standardized to UTC in task_plan (11:15 UTC = 7:15 AM ET summer) |
