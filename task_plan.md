# Task Plan: Daily News Feed — Iteration 1 (YouTube + Twitter)

## Goal
Build a public `/news` page that surfaces AI-curated top 3 YouTube videos and top 3 Twitter posts daily for prop trading platform users, backed by a YouTube Data API v3 ingest pipeline and reusing the existing Twitter pipeline.

## Current Phase
Phase 2 — DB Migrations (ready to start)

## Phases

### Phase 1: Planning & Scope Lock
- [x] Research YouTube Data API v3 quota and approach
- [x] PM/Tech-Lead sync (simulated)
- [x] Scope locked, planning files created
- **Status:** complete

---

### Phase 2: DB Migrations
- [ ] Migration 32 — `youtube_channels` table
- [ ] Migration 33 — `youtube_keywords` table
- [ ] Migration 34 — `youtube_daily_picks` table
- [ ] Migration 35 — seed 30–50 channels + 10 keywords
- **Status:** pending

---

### Phase 3: YouTube Lib Modules + Tests
- [ ] `lib/youtube/fetch-videos.ts` + `lib/youtube/fetch-videos.test.ts` (≥80% coverage)
- [ ] `lib/youtube/score-videos.ts` + `lib/youtube/score-videos.test.ts` (≥80% coverage)
- [ ] `lib/youtube/summarize-video.ts` + `lib/youtube/summarize-video.test.ts` (≥80% coverage)
- [ ] `lib/youtube/ingest.ts` + `lib/youtube/ingest.test.ts` (≥80% coverage)
- **Status:** pending

---

### Phase 4: Cron Job
- [ ] `app/api/cron/fetch-youtube-news/route.ts`
- [ ] `app/api/cron/fetch-youtube-news/route.test.ts` (≥80% coverage)
- [ ] Wire to GitHub Actions at 07:00 UTC daily
- **Status:** pending

---

### Phase 5: Public /news Page
- [ ] `app/news/page.tsx` — server component
- [ ] YouTube Top 3 section (cards: thumbnail, title, channel, views, AI summary, link)
- [ ] Twitter Top 3 section (reuses `firm_twitter_tweets` where firm_id='industry')
- [ ] Empty state ("No picks yet today")
- [ ] Mobile-responsive layout (Tailwind v4 + DaisyUI v5)
- **Status:** pending

---

### Phase 6: Admin Channel Management Page
- [ ] `app/admin/news/channels/page.tsx`
- [ ] Table view of channels (name, category, active toggle)
- [ ] Add channel form (YouTube URL → resolve channel_id via API)
- [ ] Keywords management section
- [ ] Link from `/admin/page.js` main page
- **Status:** pending

---

### Phase 7: QA & Delivery
- [ ] `npm run build` passes
- [ ] `npm run lint` clean
- [ ] All new lib/ tests pass with ≥80% coverage
- [ ] Manual smoke test of /news page
- [ ] Hand off to user
- **Status:** pending

---

## Key Decisions Made
| Decision | Rationale |
|----------|-----------|
| Playlist approach (not search.list) per channel | search.list = 100 units each; playlistItems.list = 1 unit — 100× cheaper |
| YouTube Data API v3 free tier | ~1,400–1,600 units/day vs 10,000 free limit — $0/day |
| GPT-4o-mini for summaries only (max 3/day) | ~$0.001/day; scoring uses formula not LLM |
| Scoring: views×0.4 + engagement×0.4 + freshness×0.2 | Deterministic, zero cost; refine in later iterations |
| Twitter section reuses existing `firm_twitter_tweets` | industry tweets already collected daily — zero new infra |
| Migrations numbered 32–35 | Project rule: /migrations/ folder, numbered after existing 31 files |
| Add `YOUTUBE_API_KEY` to .env | Only new env var needed |
| Reddit deferred to Iteration 2 | Reddit API OAuth changed 2023; needs separate spike |
| /news page public (no auth required) | SEO value + top-of-funnel acquisition |
| `youtube_channels` as DB table (not config) | Admin needs UI to manage list without code deploys |

## Key Questions
1. ✅ YouTube quota cost: ~$0/day (free tier sufficient)
2. ✅ Twitter section: reuse `firm_twitter_tweets` (firm_id='industry'), no new pipeline
3. ⬜ Should active toggle on channel affect next daily run only, or trigger immediate re-fetch? (assume: next daily run)
4. ⬜ Confirm migration numbering — check if any migrations already exist past 31

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| (none yet) | — | — |

## Notes
- Pre-commit hook: `npm run test:coverage:enforce-new` — all new lib/ files need ≥80% coverage
- Always run `npx jest path/to/file.test.ts --no-coverage` before staging
- Never use `--no-verify` to bypass hook
- Iteration 2 scope: Reddit (r/Forex, r/Daytrading, r/algotrading, r/Futures)
- Previous planning files (Gmail ingest project) were overwritten — that project is complete
