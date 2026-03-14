# Findings & Decisions — Daily News Feed (Iteration 1: YouTube + Twitter)

## Requirements
- Public `/news` page: daily top 3 YouTube videos + top 3 Twitter posts (prop trading industry)
- YouTube: curated channel watchlist (30–200 channels) + keyword searches via YouTube Data API v3
- Twitter: reuse existing `firm_twitter_tweets` pipeline (already runs daily, zero new infra)
- Admin page: manage YouTube channel watchlist + keywords (add/toggle/remove)
- Daily cron: 07:00 UTC — fetch, score, pick top 3, store
- Iterative delivery: YouTube first; Reddit deferred to Iteration 2
- All new lib/ files require test files ≥80% line coverage (pre-commit hook enforces)

## Research Findings

### YouTube Data API v3 Quota
- Free quota: 10,000 units/day
- `search.list` = 100 units per call — EXPENSIVE, avoid for channel monitoring
- `channels.list` = 1 unit per call — use to get upload playlist ID per channel
- `playlistItems.list` = 1 unit per page of 50 items — use to get recent video IDs
- `videos.list` = 1 unit per 50-video batch — use to get stats (views/likes/comments)
- **Daily budget for 200 channels + 10 keyword searches:**
  - `channels.list` × 200 = 200 units (playlist ID lookup, cache after first run)
  - `playlistItems.list` × 200 = 200 units (recent videos per channel)
  - `videos.list` batched for ~500 videos = 10 units
  - `search.list` × 10 keywords = 1,000 units
  - **Total: ~1,410 units/day — well within 10,000 free limit. Cost: $0/day**
- API key only (no OAuth needed for public video data)
- New env var required: `YOUTUBE_API_KEY`

### Existing Codebase — Key Integration Points
- **Twitter pipeline:** `lib/twitter-fetch/fetch-job.ts` → Apify → `lib/twitter-ingest/ingest.ts` → GPT-4o-mini → `firm_twitter_tweets` DB
- **`firm_twitter_tweets` table:** `firm_id`, `tweeted_at` (DATE), `importance_score` (0–1), `ai_summary`, `author_username`, `url`, `text`
- **Industry tweets sentinel:** `firm_id = 'industry'` — already has daily data, filter by `tweeted_at = today`
- **Cron pattern:** `/api/cron/*/route.ts`, `Authorization: Bearer CRON_SECRET` in production
- **AI pattern:** `lib/ai/openai-client.ts` singleton, GPT-4o-mini via `lib/ai/*.ts` modules
- **Admin layout:** `/app/admin/page.js` card-based hub, add link to new `/admin/news/channels`
- **DB migrations:** `/migrations/` folder, last file is #31 (`31_industry_tweets_in_firm_twitter_tweets.sql`)

### Scoring Algorithm (Formula — no LLM cost)
```
score = (normalized_views × 0.4) + (engagement_rate × 0.4) + (freshness_factor × 0.2)

where:
  normalized_views   = video_views / max_views_in_candidate_set  (0–1)
  engagement_rate    = min((likes + comments) / max(views, 1), 1.0)  (capped at 1.0)
  freshness_factor   = 1.0 - (hours_since_published / 24)  (0–1, newer = higher)
```
- Pick top 3 from all videos published in last 24h UTC
- Fallback: if fewer than 3 videos in 24h window, extend to 48h

### Channel Seed Categories & Examples
| Category | Examples |
|----------|---------|
| `prop_firm_official` | FundedNext, FTMO, The5ers, TopStep, FundingPips, Apex Trader Funding, MyForexFunds |
| `trading_educator` | Rayner Teo, Anton Kreil, Adam Khoo, Urban Forex, ForexSignals TV, TraderNick |
| `prop_firm_review` | Those Who Trade, Funded Trader Reviews |
| `industry_news` | Finance/trading news channels covering prop firms |

### Keyword Seed List (10 keywords for `youtube_keywords` table)
1. "prop firm trading 2024"
2. "funded trader review"
3. "prop firm challenge"
4. "forex prop firm"
5. "futures prop firm"
6. "FTMO review"
7. "funded trading account"
8. "best prop firm 2024"
9. "prop firm payout"
10. "trading challenge tips"

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Playlist approach over search.list | 1 unit vs 100 units per channel — 100× cheaper, stays within free quota |
| Formula scoring (not LLM) | Deterministic, zero cost, fast — LLM only for 3 summary blurbs/day |
| Separate `youtube_daily_picks` table | Caches picks — /news page is a fast DB read, not a live API call |
| `youtube_channels` as DB table | Admin needs UI to manage without code deploys |
| `youtube_keywords` as DB table | Same — active flag lets admin disable without deploys |
| UTC midnight cutoff for "today" | Consistent with "today's picks" concept, simpler than rolling 24h |
| `YOUTUBE_API_KEY` only new env var | No OAuth needed for public video data |
| Public /news page (no auth) | SEO + top-of-funnel; no sensitive data shown |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| (none yet) | — |

## Resources
- YouTube Data API v3 docs: https://developers.google.com/youtube/v3/docs
- Quota calculator: https://developers.google.com/youtube/v3/determine_quota_cost
- Existing cron example: `app/api/cron/send-weekly-reports/route.js`
- Existing AI module example: `lib/ai/categorize-tweets.ts`
- Twitter data source: `firm_twitter_tweets` WHERE `firm_id='industry'` ORDER BY `importance_score DESC` LIMIT 3

## Visual/Browser Findings
- ai-digest.liziran.com: AI-edited daily briefing, 3 stories from 20+ sources in ~5min read, English + Chinese, no sponsors, subscription model — validates "curated top 3" UX pattern in market

*Update this file after every 2 view/browser/search operations*
