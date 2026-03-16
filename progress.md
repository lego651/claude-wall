# Progress Log — Twitter Bot × YouTube Picks Sprint

---

## Session: 2026-03-15 — Planning & Tech Lead Review
- Full codebase audit done
- Tech Lead review added to strategy doc (Section 11) — 3 blockers, 6 gaps found
- task_plan.md, findings.md, progress.md created

---

## Session: 2026-03-16 — Build Sprint (Phases 1–5)

### Phase 0 — Pre-flight: WAITING ON FOUNDER
- [ ] Create Twitter developer app + get API keys (free tier, $0)
- [ ] Decide: brand account or personal account
- [ ] Add to .env: TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET, NEXT_PUBLIC_TWITTER_HANDLE

### Phase 1 — DB Migrations + Client: COMPLETE
- migrations/43_youtube_channels_twitter_handle.sql created
- migrations/44_twitter_drafts.sql created
- lib/twitter-bot/client.ts — OAuth 1.0a posting via twitter-api-v2 (free tier)
- 9 tests passing

### Phase 2 — Tweet Generator: COMPLETE
- lib/twitter-bot/generate-tweet.ts — Template A/B, GPT-4o-mini hooks, UTM, 280-char safe
- 12 tests passing

### Phase 3 — Admin Queue UI: COMPLETE
- app/api/admin/twitter/drafts/route.ts (GET)
- app/api/admin/twitter/drafts/[id]/route.ts (PATCH: approve/skip/edit/auto_approve)
- app/admin/twitter-queue/page.tsx — full UI with draft card, history, all actions

### Phase 4 — /news Page Polish: COMPLETE
- Digest signup CTA block added above YouTube section
- Twitter follow link added (uses NEXT_PUBLIC_TWITTER_HANDLE env var)
- "Updated daily at 07:00 UTC" text added
- Empty state copy cleaned up

### Phase 5 — Crons: COMPLETE
- app/api/cron/generate-twitter-draft/route.ts (22:15 UTC, idempotent)
- app/api/cron/post-twitter-tweet/route.ts (11:15 UTC, auto-approve mode, failure alerts)
- 11 tests passing across both crons

### Build + Test Results
- npm run build: PASSES (0 errors)
- New code tests: 32/32 passing
- Pre-existing failures NOT caused by this sprint: youtube/debug (2), lib/alerts (3)

---

## Remaining before Week 1 starts

| Item | Owner | Blocking? |
|---|---|---|
| Apply migrations 43 + 44 in Supabase | Founder | YES |
| Create Twitter developer app + API keys | Founder | YES |
| Add env vars to .env | Founder | YES |
| Add generate-draft cron (22:15 UTC) to GitHub Actions / Vercel | Founder/Eng | Before Week 1 |
| Add post-tweet cron (11:15 UTC) to GitHub Actions / Vercel | Founder/Eng | Before Week 2 |
| Look up + enter Twitter handles for YouTube channels in admin UI | Founder | No (uses Template B until then) |

---

## Week 1 Daily Review Log

| Day | Draft Generated? | Hook Quality | @Mention OK? | Char Count | Approved/Skipped |
|---|---|---|---|---|---|
| 1 | — | — | — | — | — |
| 2 | — | — | — | — | — |
| 3 | — | — | — | — | — |
| 4 | — | — | — | — | — |
| 5 | — | — | — | — | — |
| 6 | — | — | — | — | — |
| 7 | — | — | — | — | — |

---

## OKR Scorecard

| KR | Target | Week 1 | Week 2 | Week 3 |
|---|---|---|---|---|
| KR1: Posts without violation | >=15 | — | — | — |
| KR2: Creator retweets | >=5 | — | — | — |
| KR3: UTM clicks to /news | >=75 | — | — | — |
| KR4: New digest signups | >=8 | — | — | — |

---

## Error Log

| Error | Resolution |
|---|---|
| Jest hoisting: mockTweet undefined in jest.mock factory | Used jest.MockedClass pattern |
| NEXT_PUBLIC_APP_URL read at module load time | Wrapped in getNewsBaseUrl() function |
| Hashtag cut by raw string truncation | Removed hard truncation; use Twitter-counted charCount |
| Supabase FK join fails (no FK on channel_id) | Split into two separate queries |
| draft.tweet_text is unknown from Supabase | Added typedDraft cast |
| channelScoreMap unused (pre-existing lint error) | Removed unused variable |
| chainMock missing insert method in test | Added all required methods |
