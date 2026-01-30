# Alpha Follow-Up Tickets (Post-V3 / Beta Expansion)

**Timeline:** Weeks 5-12 (after Alpha launch)
**Prerequisites:** Alpha must achieve 50+ subscribers & 60%+ open rate
**Scope:** Multi-source intelligence (Reddit, Twitter, website monitoring)

---

## 🎯 Beta Goals

1. **Expand data sources** (Reddit, Twitter, website changes)
2. **Build public report archive** (SEO + historical data)
3. **Create intelligence feed** (real-time incident monitoring)
4. **Improve trust score** (incorporate multi-source data)
5. **Scale to 10-20 firms** (beyond initial 3)

---

## Week 5-6: Reddit Integration (30 hours)

### TICKET-101: Reddit API Setup
**Priority:** P0 (Blocker)
**Estimate:** 2 hours
**Owner:** Backend Dev

**Description:**
Set up Reddit API access via PRAW.

**Acceptance Criteria:**
- [ ] Create Reddit app at https://www.reddit.com/prefs/apps
- [ ] Get API credentials (client ID, client secret)
- [ ] Add to `.env.local`: `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`
- [ ] Install PRAW: `pip install praw` (or `npm install snoowrap` for JS)
- [ ] Test API connection (fetch top posts from r/Forex)
- [ ] Verify rate limits (60 requests/minute for authenticated users)

**Cost:** Free (Reddit API is free for non-commercial use)

---

### TICKET-102: Reddit Scraper Implementation
**Priority:** P0 (Blocker)
**Estimate:** 12 hours
**Owner:** Backend Dev

**Description:**
Build Reddit scraper to monitor prop firm mentions.

**Acceptance Criteria:**
- [ ] Create `lib/scrapers/reddit.js` with `scrapeReddit(firmName)` function
- [ ] Monitor subreddits:
  - r/Forex (1.5M members)
  - r/Daytrading (500K members)
  - r/PropFirmHub (if exists)
- [ ] Search query: `[firm name]` OR `[firm name without spaces]` (e.g., "Funded Next" OR "FundedNext")
- [ ] Extract per post/comment:
  - Title
  - Body text
  - Author
  - Subreddit
  - Upvotes
  - Comment count
  - Post URL
  - Post date
- [ ] Flag keywords: `scam`, `delay`, `problem`, `ban`, `withdrawal`, `payout`
- [ ] Store in new table: `reddit_mentions`
- [ ] Dedupe by post URL

**Database Schema:**
```sql
CREATE TABLE reddit_mentions (
  id SERIAL PRIMARY KEY,
  firm_id TEXT REFERENCES firms(id),
  post_title TEXT,
  post_body TEXT,
  author TEXT,
  subreddit TEXT,
  upvotes INT,
  comment_count INT,
  post_url TEXT UNIQUE,
  post_date TIMESTAMPTZ,
  keywords TEXT[], -- ['scam', 'delay']

  -- AI classification (populated later)
  category TEXT,
  severity TEXT,
  confidence FLOAT,
  ai_summary TEXT,
  classified_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  INDEX idx_firm_date (firm_id, post_date DESC)
);
```

**Technical Notes:**
- Use PRAW's search: `subreddit.search(query, time_filter='week', limit=100)`
- Sort by relevance (default) or recency
- Handle deleted posts gracefully

---

### TICKET-103: Reddit Classification Integration
**Priority:** P1 (High)
**Estimate:** 6 hours
**Owner:** Backend Dev

**Description:**
Adapt AI classifier to work with Reddit posts.

**Acceptance Criteria:**
- [ ] Update `lib/ai/classifier.js` to accept `source_type` parameter (`trustpilot` or `reddit`)
- [ ] Adjust prompt for Reddit context:
  - Reddit posts are more informal, use slang
  - May include sarcasm (flag as `noise` if unclear)
  - Consider upvotes as signal (high upvotes = more credible)
- [ ] Classify Reddit mentions same as Trustpilot (categories: `payout_issue`, `scam_warning`, etc.)
- [ ] Update `weekly_incidents` aggregator to include Reddit mentions
- [ ] Test on 50 historical Reddit posts
- [ ] Validate accuracy (target: >75%, lower than Trustpilot due to informality)

**Prompt Adjustment:**
```
You are analyzing a Reddit post about a prop trading firm.
Reddit posts may be informal, sarcastic, or speculative.

Post Title: "..."
Post Body: "..."
Upvotes: 45

Classify into categories... (same as before)
```

---

### TICKET-104: Reddit Scraper Cron Job
**Priority:** P1 (High)
**Estimate:** 2 hours
**Owner:** Backend Dev

**Description:**
Automate Reddit scraping every 6 hours.

**Acceptance Criteria:**
- [ ] Create `app/api/cron/scrape-reddit/route.js`
- [ ] Fetch mentions for all firms
- [ ] Schedule: Every 6 hours (0, 6, 12, 18 UTC)
- [ ] Add to `vercel.json` cron config
- [ ] Monitor for rate limit errors (60 req/min)
- [ ] Log summary (posts scraped, new mentions)

**Dependencies:** TICKET-102

---

### TICKET-105: Update Weekly Report - Reddit Section
**Priority:** P1 (High)
**Estimate:** 4 hours
**Owner:** Backend Dev + Frontend Dev

**Description:**
Add Reddit mentions to weekly reports.

**Acceptance Criteria:**
- [ ] Update `generateWeeklyReport()` to fetch Reddit mentions
- [ ] Add section to report JSON:
  ```json
  {
    "reddit": {
      "mentionCount": 28,
      "upvotes": 340,
      "sentiment": { "positive": 60, "neutral": 25, "negative": 15 },
      "topPosts": [
        { "title": "...", "url": "...", "upvotes": 45 }
      ]
    }
  }
  ```
- [ ] Update email template to show:
  - "Reddit Mentions: 28 (↑40% vs last week)"
  - Top 3 most upvoted posts (title + link)
  - Sentiment breakdown
- [ ] Test on 3 firms

**Dependencies:** TICKET-103

---

### TICKET-106: Reddit Data Validation
**Priority:** P2 (Nice to have)
**Estimate:** 4 hours
**Owner:** PM

**Description:**
Validate Reddit data quality and usefulness.

**Acceptance Criteria:**
- [ ] Review 1 week of Reddit mentions for 3 firms
- [ ] Check:
  - Are mentions relevant? (vs noise)
  - Do they add value beyond Trustpilot?
  - Are incidents detected accurately?
- [ ] Survey beta testers: "Is Reddit data useful?"
- [ ] Decision: Keep Reddit section or iterate?

---

## Week 7-8: Twitter Integration (32 hours)

### TICKET-201: Twitter API Application
**Priority:** P0 (Blocker)
**Estimate:** 2 hours (+ 1-2 weeks approval time)
**Owner:** PM

**Description:**
Apply for Twitter API access during Alpha.

**Acceptance Criteria:**
- [ ] Apply at https://developer.twitter.com/en/portal/dashboard
- [ ] Choose tier: Basic ($100/month, 10K reads/month)
- [ ] Provide use case: "Monitoring prop firm announcements for transparency platform"
- [ ] Wait for approval (typically 1-2 weeks)
- [ ] Once approved: Get API key, secret, bearer token
- [ ] Add to environment: `TWITTER_API_KEY`, `TWITTER_API_SECRET`, `TWITTER_BEARER_TOKEN`

**Alternative:**
If rejected or delayed, use Apify Twitter Scraper ($49/month, no API approval needed).

**Cost:** $100/month (Basic tier)

---

### TICKET-202: Twitter Scraper Implementation
**Priority:** P0 (Blocker)
**Estimate:** 12 hours
**Owner:** Backend Dev

**Description:**
Build Twitter scraper to track firm accounts and mentions.

**Acceptance Criteria:**
- [ ] Create `lib/scrapers/twitter.js` with `scrapeTwitter(firmName, officialHandle)` function
- [ ] Track two types:
  1. **Official firm tweets** (from verified accounts)
  2. **Community mentions** (search: "[firm name]")
- [ ] Extract per tweet:
  - Tweet text
  - Author + handle
  - Is official? (bool)
  - Likes, retweets
  - Tweet URL
  - Tweet date
- [ ] Flag keywords: `promotion`, `discount`, `announcement`, `outage`, `scam`, `delay`
- [ ] Store in new table: `twitter_mentions`
- [ ] Dedupe by tweet URL

**Database Schema:**
```sql
CREATE TABLE twitter_mentions (
  id SERIAL PRIMARY KEY,
  firm_id TEXT REFERENCES firms(id),
  tweet_text TEXT,
  author TEXT,
  author_handle TEXT,
  is_official BOOLEAN, -- true if from firm's account
  likes INT,
  retweets INT,
  tweet_url TEXT UNIQUE,
  tweet_date TIMESTAMPTZ,

  -- AI classification
  category TEXT,
  severity TEXT,
  confidence FLOAT,
  ai_summary TEXT,
  classified_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  INDEX idx_firm_date (firm_id, tweet_date DESC)
);
```

**Official Accounts to Track:**
- FundedNext: @FundedNext
- FTMO: @FTMOcom
- TopStep: @topsteptrader
- (Add more as firms are added)

**Technical Notes:**
- Use Twitter API v2: `GET /2/tweets/search/recent`
- Search query: `(FundedNext OR "Funded Next") -is:retweet lang:en`
- Limit: 100 tweets per request
- Rate limit: 10K reads/month = ~333/day = ~14/hour

---

### TICKET-203: Twitter Classification Integration
**Priority:** P1 (High)
**Estimate:** 6 hours
**Owner:** Backend Dev

**Description:**
Adapt AI classifier for Twitter content.

**Acceptance Criteria:**
- [ ] Update `lib/ai/classifier.js` to handle `source_type: 'twitter'`
- [ ] Adjust prompt:
  - Twitter is 280 chars max (concise)
  - Official tweets often announce promotions, updates
  - Community tweets may be complaints or praise
  - Consider likes/retweets as credibility signal
- [ ] Add category: `promotion` (for discount codes)
- [ ] Classify both official and community tweets
- [ ] Update incident aggregator to include Twitter mentions
- [ ] Test on 50 historical tweets
- [ ] Validate accuracy (target: >80% for official, >70% for community)

**Prompt Adjustment:**
```
You are analyzing a Twitter post about a prop trading firm.

Tweet: "..."
Author: @username
Is Official: true/false
Likes: 123, Retweets: 45

Classify... (categories + new: 'promotion')
```

---

### TICKET-204: Twitter Scraper Cron Job
**Priority:** P1 (High)
**Estimate:** 2 hours
**Owner:** Backend Dev

**Description:**
Automate Twitter scraping every 6 hours.

**Acceptance Criteria:**
- [ ] Create `app/api/cron/scrape-twitter/route.js`
- [ ] Fetch tweets for all firms (official + mentions)
- [ ] Schedule: Every 6 hours (1, 7, 13, 19 UTC - offset from Reddit)
- [ ] Monitor rate limits (10K reads/month = ~14/hour)
- [ ] Log API usage (track daily quota)
- [ ] Add to `vercel.json` cron config

**Dependencies:** TICKET-202

---

### TICKET-205: Update Weekly Report - Twitter Section
**Priority:** P1 (High)
**Estimate:** 4 hours
**Owner:** Backend Dev + Frontend Dev

**Description:**
Add Twitter section to weekly reports.

**Acceptance Criteria:**
- [ ] Update `generateWeeklyReport()` to fetch Twitter mentions
- [ ] Add section to report JSON:
  ```json
  {
    "twitter": {
      "mentionCount": 45,
      "officialTweets": 3,
      "topTweet": {
        "text": "...",
        "url": "...",
        "likes": 123
      },
      "promotions": [
        { "code": "SAVE20", "discount": "20% off", "tweet_url": "..." }
      ]
    }
  }
  ```
- [ ] Update email template to show:
  - "Twitter Activity: 45 mentions (3 official)"
  - Top official tweet (if any)
  - Promotions detected (with code + link)
- [ ] Test on 3 firms

**Dependencies:** TICKET-203

---

### TICKET-206: Promotion Extractor
**Priority:** P2 (Nice to have)
**Estimate:** 6 hours
**Owner:** Backend Dev

**Description:**
Auto-detect discount codes from official tweets.

**Acceptance Criteria:**
- [ ] Create `lib/ai/promotion-extractor.js` with `extractPromotions(tweets)` function
- [ ] Input: Array of official tweets
- [ ] Use AI to extract:
  - Discount code (e.g., "SAVE20")
  - Discount amount (e.g., "20% off")
  - Expiration date (if mentioned)
  - Terms (brief)
- [ ] Store in new table: `promotions`
- [ ] Include in weekly reports (dedicated section)
- [ ] Add to firm detail pages (show active promotions)

**Database Schema:**
```sql
CREATE TABLE promotions (
  id SERIAL PRIMARY KEY,
  firm_id TEXT REFERENCES firms(id),
  code TEXT,
  discount TEXT, -- "20% off all challenges"
  valid_from DATE,
  valid_until DATE,
  terms TEXT,
  source_type TEXT, -- 'twitter', 'website'
  source_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Week 9-10: Website Monitoring & Report Archive (24 hours)

### TICKET-301: Website Change Detector
**Priority:** P1 (High)
**Estimate:** 8 hours
**Owner:** Backend Dev

**Description:**
Monitor firm websites for rule/pricing changes.

**Acceptance Criteria:**
- [ ] Use ChangeDetection.io API (free tier: 5 URLs)
- [ ] OR build custom Playwright script:
  - Fetch firm's T&C page
  - Calculate content hash (MD5)
  - Compare with previous hash
  - If different: Screenshot + store diff
- [ ] Monitor pages per firm:
  - Terms & conditions
  - Rules page
  - Pricing page
- [ ] Store in new table: `website_changes`
- [ ] Schedule: Daily at 4 AM UTC
- [ ] Generate diff summary with AI

**Database Schema:**
```sql
CREATE TABLE website_changes (
  id SERIAL PRIMARY KEY,
  firm_id TEXT REFERENCES firms(id),
  page_type TEXT, -- 'terms', 'rules', 'pricing'
  page_url TEXT,
  change_detected_at TIMESTAMPTZ,
  old_content_hash TEXT,
  new_content_hash TEXT,
  diff_summary TEXT, -- AI-generated
  screenshot_before TEXT, -- S3 URL or base64
  screenshot_after TEXT,
  reviewed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Cost:**
- ChangeDetection.io: Free (5 URLs) or $5/month (50 URLs)
- Alternative: Custom script (free, but higher maintenance)

---

### TICKET-302: Rule Change Alerts
**Priority:** P1 (High)
**Estimate:** 4 hours
**Owner:** Backend Dev

**Description:**
Add rule changes to weekly reports.

**Acceptance Criteria:**
- [ ] Update `generateWeeklyReport()` to fetch website changes
- [ ] If changes detected:
  - Use AI to summarize: "What changed?"
  - Include before/after screenshot links
  - Severity: `low` (minor wording) vs `high` (major rule change)
- [ ] Add section to email template:
  ```
  📝 Rule Changes Detected (1 this week)
  - Minimum trading days: 5 → 7 days
  - [View before/after →]
  ```
- [ ] Test on 3 firms

**Dependencies:** TICKET-301

---

### TICKET-303: Report Archive Page
**Priority:** P1 (High)
**Estimate:** 8 hours
**Owner:** Frontend Dev

**Description:**
Build public archive of past weekly reports.

**Acceptance Criteria:**
- [ ] Create page: `/reports/[firmId]/[weekId]`
  - Example: `/reports/fundednext/2026-w04`
- [ ] Display:
  - Full report (same content as email)
  - Navigation: Previous/Next week
  - Share buttons (Twitter, Reddit)
  - Download PDF (optional)
- [ ] Create index page: `/reports/[firmId]`
  - List all weeks (most recent first)
  - Show summary: trust score, incident count
- [ ] Make public (no auth required) for SEO
- [ ] Add breadcrumbs: Home > Firm > Reports > Week 4
- [ ] Mobile-responsive

**SEO Benefits:**
- Indexed by Google: "[firm name] weekly report"
- Long-tail keywords: "[firm name] incidents", "[firm name] payout delays"
- Backlinks from Reddit/Twitter when users share

---

### TICKET-304: Report Archive SEO Optimization
**Priority:** P2 (Nice to have)
**Estimate:** 4 hours
**Owner:** Frontend Dev

**Description:**
Optimize report pages for search engines.

**Acceptance Criteria:**
- [ ] Add meta tags:
  - Title: `[Firm Name] Weekly Report - Week [N], [Year] | PropProof`
  - Description: Summary of report (incidents, trust score)
  - OG image: Auto-generated graphic with key stats
- [ ] Add structured data (Schema.org):
  - Article type
  - Published date
  - Author: PropProof
- [ ] Generate sitemap: `/sitemap-reports.xml`
- [ ] Submit to Google Search Console
- [ ] Monitor indexing (target: 90%+ reports indexed within 7 days)

---

## Week 11-12: Intelligence Feed & Trust Score V2 (24 hours)

### TICKET-401: Intelligence Feed Page
**Priority:** P1 (High)
**Estimate:** 12 hours
**Owner:** Frontend Dev

**Description:**
Build real-time feed of incidents across all firms.

**Acceptance Criteria:**
- [ ] Create page: `/intelligence`
- [ ] Display:
  - Latest incidents (all firms, sorted by date)
  - Filters: Firm, severity, incident type, date range
  - Search box (keyword search)
  - Card per incident:
    - Firm logo + name
    - Incident title
    - Severity badge (color-coded)
    - Timestamp ("2 hours ago")
    - Source count ("Based on 8 reviews")
    - "View details" link → expands to full summary
- [ ] Infinite scroll or pagination (50 items per page)
- [ ] Real-time updates (optional: use WebSocket or polling)
- [ ] Mobile-responsive

**Design Reference:**
```
┌─────────────────────────────────────┐
│ 🚨 FundedNext                       │
│ Crypto payout delays reported       │
│ 2 hours ago • Medium severity       │
│ Based on 8 Trustpilot reviews       │
│ [View Details ↓]                    │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ 🎉 FTMO                             │
│ New promotion: 15% off challenges   │
│ 5 hours ago • Promotion             │
│ Official Twitter announcement       │
│ [View Promotion →]                  │
└─────────────────────────────────────┘
```

---

### TICKET-402: Intelligence Feed API
**Priority:** P1 (High)
**Estimate:** 4 hours
**Owner:** Backend Dev

**Description:**
Build API endpoint for intelligence feed.

**Acceptance Criteria:**
- [ ] Create `app/api/intelligence/route.js`
- [ ] Endpoint: `GET /api/intelligence?firm=[id]&severity=[low|medium|high]&type=[payout_issue|scam_warning|...]&page=1`
- [ ] Response:
  ```json
  {
    "items": [
      {
        "id": 123,
        "firmId": "fundednext",
        "firmName": "Funded Next",
        "firmLogo": "/logos/...",
        "type": "incident",
        "incidentType": "payout_issue",
        "severity": "medium",
        "title": "Crypto payout delays reported",
        "summary": "8 users reported...",
        "sourceCount": 8,
        "timestamp": "2026-01-24T10:00:00Z"
      },
      ...
    ],
    "pagination": { "page": 1, "total": 234, "perPage": 50 }
  }
  ```
- [ ] Add rate limiting (100 requests/hour for unauthenticated)
- [ ] Cache results (5 min TTL)

**Dependencies:** TICKET-401

---

### TICKET-403: Trust Score V2 - Multi-Source
**Priority:** P1 (High)
**Estimate:** 6 hours
**Owner:** Backend Dev

**Description:**
Update trust score calculation to incorporate Reddit, Twitter, website changes.

**Acceptance Criteria:**
- [ ] Update `lib/trust-score/calculator.js`
- [ ] New formula:
  ```
  Base Score = 100

  Deductions:
  - Critical incident (any source): -20 pts each
  - Medium incident: -10 pts each
  - Low incident: -5 pts each
  - No payouts in 30 days: -15 pts
  - High payout volatility: -5 pts
  - Major rule change (anti-trader): -10 pts
  - Negative Reddit sentiment spike: -5 pts

  Bonuses:
  - Consistent payouts (CV < 0.3): +10 pts
  - Total payouts > $1M (30d): +5 pts
  - Positive community sentiment: +5 pts
  - Active promotions: +3 pts
  ```
- [ ] Weight sources:
  - Blockchain payouts: 50% (highest weight, verifiable)
  - Trustpilot: 30% (verified purchases)
  - Reddit: 10% (unverified, but community signal)
  - Twitter: 10% (official + community)
- [ ] Recalculate weekly (during report generation)
- [ ] Show breakdown in reports ("What affects this score?")
- [ ] Display on firm detail pages

**Dependencies:** All Reddit + Twitter tickets

---

### TICKET-404: Trust Score History Chart
**Priority:** P2 (Nice to have)
**Estimate:** 4 hours
**Owner:** Frontend Dev

**Description:**
Show trust score trend over time on firm pages.

**Acceptance Criteria:**
- [ ] Create line chart showing last 12 weeks
- [ ] Annotate incidents (markers on timeline)
- [ ] Tooltip on hover: "Week 4: 85/100 (↓3 due to payout delays)"
- [ ] Add to firm detail page (below payout chart)

---

## Week 13+: Scale & Polish (Ongoing)

### TICKET-501: Add 7 More Firms
**Priority:** P1 (High)
**Estimate:** 8 hours (data entry + testing)
**Owner:** PM + Backend Dev

**Description:**
Expand from 3 firms to 10 firms.

**Firms to Add:**
1. The5ers
2. FundingPips
3. MyFundedFutures
4. FXIFY
5. Instant Funding
6. Blue Guardian
7. Alpha Capital Group

**Acceptance Criteria:**
- [ ] Add firms to `firms` table (id, name, logo, website)
- [ ] Add Trustpilot URLs
- [ ] Add Twitter handles (official accounts)
- [ ] Verify blockchain payout addresses (if tracked)
- [ ] Backfill 30 days of Trustpilot reviews
- [ ] Scrape initial Reddit/Twitter mentions
- [ ] Test weekly report generation for each firm

---

### TICKET-502: API Documentation Page
**Priority:** P2 (Nice to have)
**Estimate:** 8 hours
**Owner:** Frontend Dev

**Description:**
Create public API documentation.

**Acceptance Criteria:**
- [ ] Create page: `/docs/api`
- [ ] Document endpoints:
  - `GET /api/v2/propfirms` (existing)
  - `GET /api/v2/propfirms/[id]` (existing)
  - `GET /api/leaderboard` (existing)
  - `GET /api/intelligence` (new)
  - `GET /api/reports/[firmId]/[weekId]` (new)
- [ ] Show request/response examples
- [ ] Add rate limits
- [ ] Add "Try it out" interactive examples
- [ ] Mention: "Free tier: 100 requests/hour, Premium: 1000/hour" (future monetization)

---

### TICKET-503: Email Alert Preferences
**Priority:** P2 (Nice to have)
**Estimate:** 6 hours
**Owner:** Frontend Dev + Backend Dev

**Description:**
Allow users to customize alert frequency.

**Acceptance Criteria:**
- [ ] Add preferences to `firm_subscriptions` table:
  - `alert_frequency` (weekly, daily, real-time)
  - `alert_types` (array: incidents, promotions, rule_changes, all)
  - `minimum_severity` (low, medium, high)
- [ ] Add UI in `/settings`:
  - Dropdown: "Send me reports: Weekly (default) / Daily digest / Real-time alerts"
  - Checkboxes: "Alert me about: Incidents / Promotions / Rule changes"
  - Dropdown: "Minimum severity: All / Medium & High only / High only"
- [ ] Update email logic to respect preferences
- [ ] Test with 3 users (different preferences)

---

### TICKET-504: Community Incident Submission (Beta Feature)
**Priority:** P3 (Future)
**Estimate:** 16 hours
**Owner:** Backend Dev + Frontend Dev

**Description:**
Allow users to submit incidents manually.

**Acceptance Criteria:**
- [ ] Create form: "Report an incident"
  - Fields: Firm, incident type, title, description, source URL
- [ ] Store in `user_submitted_incidents` table (separate from auto-detected)
- [ ] Require login (prevent spam)
- [ ] Review queue for admin (approve/reject)
- [ ] If approved: Add to weekly report
- [ ] Show "Community reported" badge (vs "AI detected")

**Rationale:**
- Catch incidents AI misses
- Engage community
- Build trust (user-generated content)

---

## 🎯 Beta Definition of Done

### Must Achieve:
- [ ] 200+ subscribers (4x Alpha)
- [ ] 70%+ email open rate (vs 60% in Alpha)
- [ ] Reddit + Twitter data integrated into reports
- [ ] Report archive live & indexed by Google
- [ ] Intelligence feed functional with filters
- [ ] Trust Score V2 live (multi-source)
- [ ] 10 firms covered (vs 3 in Alpha)
- [ ] <1% email bounce rate
- [ ] <5% unsubscribe rate

### Nice to Have:
- [ ] 500+ subscribers
- [ ] Featured in major prop trading Discord/Reddit
- [ ] At least 1 firm officially references our reports
- [ ] 1,000+ monthly visitors to report archive
- [ ] API used by at least 5 developers

---

## 📊 Beta Success Metrics

### Engagement:
- Weekly active users (visit site)
- Email engagement (opens, clicks)
- Report archive pageviews
- Intelligence feed usage

### Data Coverage:
- Incidents detected per week (target: 20+ across all firms)
- Source diversity (% from Trustpilot, Reddit, Twitter, website)
- Classification accuracy (spot check 20/week)

### SEO:
- Google Search impressions
- Organic traffic growth
- Backlinks acquired
- Keywords ranked (top 10)

---

## 💰 Beta Budget

| Item | Alpha Cost | Beta Cost | Delta |
|------|-----------|-----------|-------|
| Supabase Pro | $25 | $25 | $0 |
| OpenAI API | $5-10 | $20-30 | +$15 (more data) |
| Resend | $0 | $20 | +$20 (>3K emails/mo) |
| Twitter API Basic | $0 | $100 | +$100 |
| ChangeDetection.io | $0 | $5 | +$5 |
| PRAW (Reddit) | $0 | $0 | $0 (free) |
| Playwright | $0 | $0 | $0 |
| **Total** | **$30-35** | **$170-180** | **+$140** |

**ROI Analysis:**
- Cost per subscriber: $170 / 200 = $0.85/subscriber
- If 10% convert to premium ($10/mo): 20 × $10 = $200/mo revenue
- Break-even: Month 1
- Margin: $200 - $180 = $20/mo (grows as subscribers increase)

---

## 🚀 Post-Beta: V1.0 Launch (Week 16+)

### TICKET-601: Premium Tier (Monetization)
**Features:**
- Real-time alerts (vs weekly digest)
- Historical incident search (>12 months)
- API access (higher rate limits)
- Custom firm comparison reports
- Early access to new features

**Pricing:** $10/month or $99/year

---

### TICKET-602: Affiliate Integration
**Description:**
Partner with prop firms for referral revenue.

**Implementation:**
- Add "Sign up with discount" buttons on firm pages
- Track referrals via UTM codes
- Negotiate commission: 10-20% per signup
- Display "Affiliate partner" badge (transparency)

---

### TICKET-603: Mobile App (iOS + Android)
**Description:**
Push notifications for real-time alerts.

**Tech Stack:**
- React Native or Flutter
- Reuse Next.js APIs
- Features: Intelligence feed, report archive, firm comparison

---

## 📅 Beta Timeline Summary

| Weeks | Focus | Key Deliverables |
|-------|-------|------------------|
| 5-6 | Reddit Integration | 6 tickets, 30h |
| 7-8 | Twitter Integration | 6 tickets, 32h |
| 9-10 | Website Monitoring + Archive | 4 tickets, 24h |
| 11-12 | Intelligence Feed + Trust Score V2 | 4 tickets, 24h |
| 13+ | Scale to 10 firms + Polish | Ongoing |

**Total Beta Effort:** ~110 hours (7-8 weeks with 1 full-time dev)

---

**Questions? Ready to proceed after Alpha launch? 🚀**
