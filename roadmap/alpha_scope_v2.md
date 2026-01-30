# Alpha Release Scope V2: Intelligence Engine
## Product Requirements Document (Revised)

**Document Version:** 2.0
**Date:** January 29, 2026
**Author:** Product Management
**Status:** Revised based on PM feedback

---

## Executive Summary

### The Pivot: From Static Comparison to Real-Time Intelligence

**Original Plan (V1):**
- Manual data entry for rules, promotions, incidents
- Static comparison pages
- Trust scores

**Problems Identified:**
1. Rules are too complex (10+ challenge types per firm) → needs dedicated pages
2. Manual promotions won't be real-time → defeats purpose
3. Current payout pages already complex → adding more hurts UX
4. Static data = commoditized, no moat

**New Plan (V2): Build an Intelligence Engine**

> **Core Value Prop:** "Get a weekly digest of everything that matters about the prop firms you follow - payouts, rule changes, incidents, community sentiment, red flags."

---

## What We're Building for Alpha

### The Intelligence Stack

```
┌─────────────────────────────────────────────────┐
│         USER INTERFACE (Subscribe & Read)        │
├─────────────────────────────────────────────────┤
│       AI Aggregation Layer (Weekly Digest)       │
├─────────────────────────────────────────────────┤
│         Monitoring Layer (Auto-Scrapers)         │
├──────────┬──────────┬──────────┬────────────────┤
│ Trustpilot│  Reddit  │   X.com  │  Firm Websites│
└──────────┴──────────┴──────────┴────────────────┘
```

---

## Alpha Feature Set (8 Weeks)

### Phase 1: Monitoring Infrastructure (Weeks 1-3)

#### 1.1 Data Source Scrapers

**A) Trustpilot Review Scraper**
```python
# What it does:
- Scrape latest 50 reviews per firm daily
- Extract: rating, title, text, date, reviewer
- Flag negative reviews (1-2 stars) for AI analysis
- Store in: Supabase `trustpilot_reviews` table

# Tech:
- Playwright or Apify actor
- Run via cron job (daily 2 AM)
- Cost: Free (Playwright) or $49/mo (Apify)
```

**B) Reddit Mention Tracker**
```python
# What it does:
- Monitor r/Forex, r/Daytrading, r/PropFirmHub
- Search for firm mentions (keyword: "[firm name]")
- Extract: title, body, upvotes, comments, URL
- Flag posts with keywords: scam, delay, problem, ban
- Store in: Supabase `reddit_mentions` table

# Tech:
- PRAW (Python Reddit API Wrapper)
- Run via cron job (every 6 hours)
- Cost: Free (Reddit API)
```

**C) X/Twitter Monitor**
```python
# What it does:
- Track official firm accounts (@FundedNext, etc.)
- Track mentions of firm names
- Extract: tweet text, author, likes, retweets, date
- Flag: announcements, complaints, scam warnings
- Store in: Supabase `twitter_mentions` table

# Tech:
- Twitter API v2 (requires approval) or Apify Twitter scraper
- Run via cron job (every 6 hours)
- Cost: $100/mo (Twitter API Basic) or $49/mo (Apify)
```

**D) Firm Website Change Detector**
```python
# What it does:
- Monitor firm T&C, rules, pricing pages
- Detect text changes (diff)
- Screenshot before/after
- Store in: Supabase `website_changes` table

# Tech:
- ChangeDetection.io (free) or custom Playwright script
- Run daily
- Cost: Free
```

**Database Schema:**
```sql
-- Trustpilot reviews
CREATE TABLE trustpilot_reviews (
  id SERIAL PRIMARY KEY,
  firm_id TEXT REFERENCES firms(id),
  rating INT,
  title TEXT,
  review_text TEXT,
  reviewer_name TEXT,
  review_date DATE,
  trustpilot_url TEXT,
  sentiment TEXT, -- negative, neutral, positive
  flagged BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reddit mentions
CREATE TABLE reddit_mentions (
  id SERIAL PRIMARY KEY,
  firm_id TEXT REFERENCES firms(id),
  post_title TEXT,
  post_body TEXT,
  author TEXT,
  subreddit TEXT,
  upvotes INT,
  comment_count INT,
  post_url TEXT,
  post_date TIMESTAMPTZ,
  keywords TEXT[], -- ['scam', 'delay']
  flagged BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Twitter mentions
CREATE TABLE twitter_mentions (
  id SERIAL PRIMARY KEY,
  firm_id TEXT REFERENCES firms(id),
  tweet_text TEXT,
  author TEXT,
  author_handle TEXT,
  is_official BOOLEAN, -- true if from firm's account
  likes INT,
  retweets INT,
  tweet_url TEXT,
  tweet_date TIMESTAMPTZ,
  sentiment TEXT,
  flagged BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Website changes
CREATE TABLE website_changes (
  id SERIAL PRIMARY KEY,
  firm_id TEXT REFERENCES firms(id),
  page_type TEXT, -- 'terms', 'rules', 'pricing'
  page_url TEXT,
  change_detected_at TIMESTAMPTZ,
  old_content_hash TEXT,
  new_content_hash TEXT,
  diff_summary TEXT, -- AI-generated summary
  screenshot_before TEXT, -- S3 URL
  screenshot_after TEXT, -- S3 URL
  reviewed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Effort Estimate:**
- Trustpilot scraper: 12-15 hours
- Reddit scraper: 10-12 hours
- Twitter scraper: 12-15 hours (includes API setup)
- Website monitor: 8-10 hours
- Database setup: 4-6 hours
- **Total: 46-58 hours (~3 weeks for 1 developer)**

---

### Phase 2: AI Analysis Layer (Weeks 4-5)

#### 2.1 Content Classifier

**What it does:**
- Takes raw data from scrapers (reviews, posts, tweets)
- Uses OpenAI/Claude to classify into categories:
  - `payout_issue` (delays, denials, missing payouts)
  - `rule_change` (new restrictions, requirement changes)
  - `platform_issue` (outages, technical problems)
  - `scam_warning` (accusations, fraud claims)
  - `promotion` (discounts, special offers)
  - `positive_feedback` (success stories, praise)
  - `noise` (irrelevant, off-topic)

**Implementation:**
```python
# lib/ai/classifier.py

import openai

def classify_content(text, source_type):
    """
    Classify user-generated content into categories
    """

    prompt = f"""
    You are analyzing {source_type} content about a prop trading firm.

    Classify this into ONE of these categories:
    - payout_issue: Problems with receiving payouts
    - rule_change: Changes to trading rules or requirements
    - platform_issue: Technical problems with platform
    - scam_warning: Accusations of fraud or scam
    - promotion: Discounts or special offers
    - positive_feedback: Success stories or praise
    - noise: Irrelevant or off-topic

    Content: "{text}"

    Respond with JSON:
    {{
      "category": "payout_issue",
      "confidence": 0.85,
      "severity": "medium",
      "summary": "User reports 5-day delay on crypto payout"
    }}
    """

    response = openai.ChatCompletion.create(
        model="gpt-4o-mini", # Fast and cheap
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
        response_format={"type": "json_object"}
    )

    return response.choices[0].message.content

# Run nightly job to classify all new unprocessed content
```

**Cost:** ~$0.001 per classification × 100 items/day = $3/month

---

#### 2.2 Signal Aggregator

**What it does:**
- Groups related content (e.g., 5 Reddit posts about same payout delay)
- Detects trends (e.g., "15 negative Trustpilot reviews this week, up 300%")
- Calculates severity scores
- Generates incident summaries

**Implementation:**
```python
# lib/ai/aggregator.py

def aggregate_incidents(firm_id, week_start, week_end):
    """
    Group related mentions into incidents
    """

    # Fetch all flagged content for the week
    reviews = fetch_trustpilot_flagged(firm_id, week_start, week_end)
    reddit = fetch_reddit_flagged(firm_id, week_start, week_end)
    twitter = fetch_twitter_flagged(firm_id, week_start, week_end)

    # Use AI to cluster similar issues
    prompt = f"""
    Analyze these mentions about {firm_id}:

    Trustpilot Reviews:
    {format_reviews(reviews)}

    Reddit Posts:
    {format_reddit(reddit)}

    Twitter Mentions:
    {format_twitter(twitter)}

    Group related issues together and summarize:
    1. What is the main issue?
    2. How many people are affected?
    3. Is this a new issue or ongoing?
    4. Severity: low/medium/high/critical

    Return JSON array of incidents.
    """

    incidents = openai_call(prompt)

    # Store in weekly_incidents table
    save_incidents(firm_id, week_start, incidents)
```

**Effort:** 15-18 hours

---

### Phase 3: Weekly Digest Generator (Weeks 6-7)

#### 3.1 Report Structure

**What it includes:**

```markdown
# [Firm Name] Weekly Report
## Week of Jan 22-28, 2026

### 📊 Payout Summary
- Total payouts this week: $234,500 (↑ 12% vs last week)
- Number of payouts: 45 (↑ 8%)
- Largest payout: $12,300
- Average payout: $5,211
- Last payout: 2 hours ago

### 🚨 Incidents & Red Flags (2 this week)
**Medium Severity: Crypto payout delays**
- First reported: Jan 24
- Affected users: ~15-20 (estimate)
- Status: Ongoing
- Sources: 8 Reddit posts, 3 Trustpilot reviews
- Summary: Users report 3-5 day delays on crypto payouts...
- Firm response: "Exchange maintenance, resolved by Jan 26"

**Low Severity: Platform login issues**
- ...

### 📝 Rule & Policy Changes (0 this week)
No changes detected.

### 🎉 Promotions & Discounts (1 active)
**20% Off New Year Sale**
- Code: NEWYEAR20
- Valid until: Jan 31
- Source: Official Twitter

### 💬 Community Sentiment
- Trustpilot: 4.2/5 (↓ 0.3 vs last week)
- Reddit mentions: 28 (↑ 40%)
- Sentiment breakdown: 60% positive, 25% neutral, 15% negative

### 📈 Trending Topics
1. "Withdrawal speed" - mentioned 12 times
2. "Customer support" - mentioned 8 times
3. "New scaling plan" - mentioned 5 times

### ⚠️ Our Take (PropProof Analysis)
This week showed increased payout delays for crypto users...
Trust score: 85/100 (↓ 3 points due to payout delays)
```

**Format options:**
- Email (HTML newsletter)
- Web page (`/reports/[firmId]/2026-week-04`)
- PDF download

---

#### 3.2 Digest Generation Pipeline

```python
# lib/digest/generator.py

def generate_weekly_digest(firm_id, week_number, year):
    """
    Generate comprehensive weekly report
    """

    week_start, week_end = get_week_dates(week_number, year)

    # 1. Fetch payout data (already have this)
    payout_summary = get_payout_summary(firm_id, week_start, week_end)

    # 2. Fetch aggregated incidents
    incidents = get_weekly_incidents(firm_id, week_start, week_end)

    # 3. Detect rule changes
    rule_changes = get_website_changes(firm_id, week_start, week_end)

    # 4. Find active promotions
    promotions = detect_promotions(firm_id, week_start, week_end)

    # 5. Calculate sentiment
    sentiment = analyze_sentiment(firm_id, week_start, week_end)

    # 6. Extract trending topics
    trending = extract_trending_topics(firm_id, week_start, week_end)

    # 7. Use AI to write "Our Take" section
    our_take = generate_analysis(
        payout_summary, incidents, rule_changes, sentiment
    )

    # 8. Compile into report
    report = {
        "firmId": firm_id,
        "weekNumber": week_number,
        "year": year,
        "payouts": payout_summary,
        "incidents": incidents,
        "ruleChanges": rule_changes,
        "promotions": promotions,
        "sentiment": sentiment,
        "trending": trending,
        "analysis": our_take,
        "trustScore": calculate_trust_score(...)
    }

    # 9. Save to database
    save_report(report)

    # 10. Send emails to subscribers
    send_email_digest(firm_id, report)

    return report
```

**Automation:**
- Cron job runs every Monday at 8 AM
- Generates reports for previous week
- Sends emails to subscribers
- Publishes web version

**Effort:** 20-24 hours

---

### Phase 4: User Interface (Weeks 7-8)

#### 4.1 Firm Subscription System

**New UI elements on firm detail page:**

```jsx
// components/FirmSubscribeCard.js

<div className="bg-white p-6 rounded-xl border">
  <h3>Get Weekly Intelligence Reports</h3>
  <p>Subscribe to receive a digest of payouts, incidents, rule changes, and community sentiment.</p>

  <button onClick={handleSubscribe}>
    {subscribed ? '✓ Subscribed' : 'Subscribe (Free)'}
  </button>

  <div className="text-xs text-gray-500 mt-2">
    Next report: Monday, Feb 3 at 8 AM
  </div>
</div>
```

**Implementation:**
- Add `firm_subscriptions` table
- "Subscribe" button on firm pages
- User can subscribe to multiple firms
- Manage subscriptions in `/settings`

---

#### 4.2 Weekly Report Archive

**New page: `/reports/[firmId]/[week]`**

Example: `/reports/fundednext/2026-w04`

**Features:**
- View all past weekly reports
- Filter by firm
- Search reports by keyword
- Download as PDF
- Share link (public, no auth required)

**UI mockup:**
```
╔════════════════════════════════════════╗
║  Funded Next - Week 4, 2026            ║
║  Jan 22-28                             ║
╠════════════════════════════════════════╣
║                                        ║
║  📊 Payouts: $234K (↑12%)              ║
║  🚨 Incidents: 2 (1 medium, 1 low)     ║
║  📝 Rule Changes: 0                    ║
║  🎉 Promotions: 1 active               ║
║  Trust Score: 85/100                   ║
║                                        ║
║  [View Full Report →]                  ║
╚════════════════════════════════════════╝
```

---

#### 4.3 Global "Latest Intelligence" Feed

**New page: `/intelligence`**

A Twitter-like feed showing:
- Latest incidents across all firms
- Recent rule changes
- New promotions
- Community sentiment shifts

**Example:**
```
┌─────────────────────────────────────┐
│ 🚨 FundedNext                       │
│ Crypto payout delays reported       │
│ 2 hours ago • Medium severity       │
│ [View Details]                      │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ 🎉 FTMO                             │
│ New promotion: 15% off challenges   │
│ 5 hours ago                         │
│ [View Promotion]                    │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ 📝 TopStep                          │
│ Rule change: Min trading days 10→7  │
│ 1 day ago                           │
│ [View Diff]                         │
└─────────────────────────────────────┘
```

**Effort:** 18-22 hours

---

## Database Schema Updates

```sql
-- Firm subscriptions
CREATE TABLE firm_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  firm_id TEXT REFERENCES firms(id),
  email_enabled BOOLEAN DEFAULT true,
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, firm_id)
);

-- Weekly reports
CREATE TABLE weekly_reports (
  id SERIAL PRIMARY KEY,
  firm_id TEXT REFERENCES firms(id),
  week_number INT,
  year INT,
  report_data JSONB, -- Full report content
  trust_score INT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(firm_id, week_number, year)
);

-- Incidents (aggregated)
CREATE TABLE weekly_incidents (
  id SERIAL PRIMARY KEY,
  firm_id TEXT REFERENCES firms(id),
  week_number INT,
  year INT,
  incident_type TEXT, -- payout_issue, rule_change, etc.
  severity TEXT, -- low, medium, high, critical
  title TEXT,
  summary TEXT,
  affected_users TEXT, -- estimate
  status TEXT, -- ongoing, resolved
  source_count INT, -- how many mentions
  sources JSONB, -- array of URLs
  firm_response TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Development Timeline (8 Weeks)

### Week 1-3: Monitoring Infrastructure ⚙️
- [ ] Set up Supabase tables (reviews, mentions, changes)
- [ ] Build Trustpilot scraper (Playwright)
- [ ] Build Reddit scraper (PRAW)
- [ ] Build Twitter monitor (API or Apify)
- [ ] Build website change detector
- [ ] Set up cron jobs (Vercel Cron or separate server)
- [ ] Test scrapers on 3 firms

**Deliverable:** Data flowing into Supabase, visible in admin dashboard

---

### Week 4-5: AI Analysis 🤖
- [ ] Implement content classifier (OpenAI API)
- [ ] Build signal aggregator (group related mentions)
- [ ] Create incident detection logic
- [ ] Build trending topics extractor
- [ ] Test AI accuracy on historical data

**Deliverable:** Automated incident detection working

---

### Week 6-7: Digest Generation 📧
- [ ] Build weekly report generator
- [ ] Create email template (HTML)
- [ ] Integrate with Resend for email delivery
- [ ] Create web report page template
- [ ] Generate first 3 sample reports manually
- [ ] Set up automated weekly cron job

**Deliverable:** First automated weekly report sent

---

### Week 8: UI & Launch Prep 🚀
- [ ] Add "Subscribe" button to firm pages
- [ ] Build `/reports/[firmId]/[week]` page
- [ ] Create `/intelligence` feed page
- [ ] Build subscription management in `/settings`
- [ ] Mobile responsive check
- [ ] Write launch announcement
- [ ] Recruit 20 beta testers

**Deliverable:** Alpha launch ready

---

## Success Metrics for Alpha

### Quantitative (8 weeks post-launch)
- **500+ weekly report subscribers** (across all firms)
- **80%+ email open rate** (industry avg: 20-25%)
- **10+ incidents detected per week** (across 10 firms)
- **90%+ scraper uptime**
- **<$200/month operational costs** (APIs + hosting)

### Qualitative
- Users cite our reports when choosing firms
- At least 1 firm responds to an incident we report
- Community shares our reports on Reddit/Twitter
- "I check PropProof every Monday" feedback

---

## Technical Architecture

### Infrastructure Stack

```
┌─────────────────────────────────────────────────────┐
│                    FRONTEND                         │
│   Next.js 15 + React 19 + Tailwind + DaisyUI       │
├─────────────────────────────────────────────────────┤
│                     API LAYER                       │
│         Next.js API Routes + Edge Functions         │
├─────────────────────────────────────────────────────┤
│                  DATA PROCESSING                    │
│   Python scrapers + OpenAI API + Aggregators       │
├──────────────┬──────────────┬───────────────────────┤
│   Supabase   │  PostgreSQL  │    Vercel Cron       │
│   (Database) │   (RLS, FTS) │  (Scheduled Jobs)    │
└──────────────┴──────────────┴───────────────────────┘
│                                                      │
│              EXTERNAL SERVICES                      │
├──────────────┬──────────────┬──────────────────────┤
│  Trustpilot  │   Reddit API │   Twitter API        │
│  (Scraping)  │   (PRAW)     │   (v2 Basic)         │
└──────────────┴──────────────┴──────────────────────┘
```

### Hosting Options for Scrapers

**Option 1: Vercel Serverless Functions**
- ✅ Already using Vercel
- ✅ Free tier includes cron jobs
- ❌ 10s timeout (need to optimize scrapers)
- **Cost:** $0

**Option 2: Separate Python Server (Railway/Render)**
- ✅ No timeout limits
- ✅ Can run heavy Playwright scripts
- ✅ Easier debugging
- ❌ Extra $5-10/month
- **Cost:** $5-10/month

**Recommendation:** Start with Vercel serverless, move to Railway if needed.

---

## Cost Breakdown (Monthly)

| Service | Cost | Purpose |
|---------|------|---------|
| Supabase Pro | $25 | Database, auth, storage |
| OpenAI API | $50-100 | Content classification, summaries |
| Twitter API Basic | $100 | Tweet monitoring (optional) |
| Apify (optional) | $49 | Twitter scraper alternative |
| Resend | $0-20 | Email delivery (free tier: 3k/month) |
| Vercel Pro (optional) | $20 | If need more cron jobs |
| **TOTAL** | **$75-189/month** | |

**Cost optimization:**
- Start without Twitter (focus on Reddit + Trustpilot)
- Use free Resend tier (3,000 emails/month)
- Use Vercel free tier
- **Alpha cost: ~$75/month**

---

## Risks & Mitigation

### Risk 1: Scrapers Break Frequently
**Probability:** High
**Impact:** High
**Mitigation:**
- Use multiple data sources (if Trustpilot breaks, Reddit still works)
- Set up alerts (Sentry) when scrapers fail
- Build fallback: manual incident submission form

### Risk 2: AI Classification Accuracy
**Probability:** Medium
**Impact:** Medium
**Mitigation:**
- Human review first 50 classifications
- Adjust prompts based on errors
- Add confidence threshold (only auto-publish >0.8 confidence)

### Risk 3: Legal Issues (Scraping ToS)
**Probability:** Low
**Impact:** High
**Mitigation:**
- Trustpilot: Use Apify's legal actor (they handle compliance)
- Reddit: Use official API (PRAW) - within ToS
- Twitter: Pay for API access - fully legal
- Cite sources, don't republish full reviews

### Risk 4: Low Email Engagement
**Probability:** Medium
**Impact:** Medium
**Mitigation:**
- A/B test subject lines
- Keep reports concise (<2 min read)
- Add "unsubscribe from this firm only" option
- Send digests on best day/time (Monday 8 AM)

---

## Why This Approach Wins

### Competitive Advantages

1. **Real-time intelligence** - Competitors have static data
2. **Multi-source verification** - Not relying on user submissions
3. **AI-powered curation** - Signal, not noise
4. **Blockchain + sentiment** - Quantitative + qualitative trust
5. **Automated + scalable** - Can add 50 firms without 50x effort

### User Value Props

**For traders evaluating firms:**
- "See incidents before they affect you"
- "Get real-time rule change alerts"
- "Know when promotions drop"

**For funded traders:**
- "Monitor your firm's reputation"
- "Early warning on payout issues"
- "Verify your payouts on-chain"

### Monetization Potential (Future)

- Premium: Real-time alerts (vs weekly digest)
- Premium: Historical incident search
- Premium: Custom firm comparison reports
- Affiliate: Discount codes in promotions section
- B2B: Firm monitoring API for affiliates

---

## Next Steps (If Approved)

### Week 1 Sprint Tasks

**Day 1-2: Infrastructure Setup**
- [ ] Create Supabase tables (schema above)
- [ ] Set up Python environment (PRAW, Playwright, OpenAI)
- [ ] Configure API keys (Reddit, OpenAI)

**Day 3-4: First Scraper**
- [ ] Build Reddit scraper
- [ ] Test on 3 firms (FundedNext, FTMO, TopStep)
- [ ] Verify data in Supabase

**Day 5: Cron Setup**
- [ ] Set up Vercel cron job
- [ ] Test scheduled Reddit scraping
- [ ] Monitor logs

### Developer Assignment
- **Backend/Scrapers:** 1 full-time developer (Python + Next.js)
- **AI/Analysis:** Same developer (or ML specialist if available)
- **Frontend:** Designer + frontend dev (part-time, weeks 7-8)
- **PM oversight:** 25% time for data review, testing, copy

---

## Comparison: V1 vs V2

| Aspect | V1 (Static Comparison) | V2 (Intelligence Engine) |
|--------|----------------------|-------------------------|
| **Data freshness** | Manual updates (weekly) | Automated (daily) |
| **Scalability** | Low (manual = bottleneck) | High (add firms = add to scraper list) |
| **User value** | Static info | Real-time alerts |
| **Differentiation** | Low (easy to copy) | High (tech + AI moat) |
| **Development time** | 8 weeks | 8 weeks |
| **Ongoing maintenance** | High (constant data entry) | Medium (scraper fixes) |
| **Monetization potential** | Low | High (premium tiers) |
| **User engagement** | One-time visit | Weekly habit |

**Winner:** V2 (Intelligence Engine)

---

## Appendix A: Sample Weekly Report (Text)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 FUNDED NEXT - WEEKLY INTELLIGENCE REPORT
 Week of Jan 22-28, 2026
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 PAYOUT SUMMARY
────────────────────────────────────────────────────
Total Payouts:       $234,500  (↑ 12% vs last week)
Number of Payouts:   45        (↑ 8%)
Largest Payout:      $12,300
Average Payout:      $5,211
Last Payout:         2 hours ago
────────────────────────────────────────────────────

🚨 INCIDENTS & RED FLAGS (2 this week)
────────────────────────────────────────────────────

⚠️  MEDIUM SEVERITY
Crypto payout delays reported

First reported:    Jan 24, 2026
Affected users:    ~15-20 (estimated from community reports)
Status:            Ongoing (as of Jan 28)

What happened:
Multiple users on r/Forex and Trustpilot reported 3-5 day
delays receiving crypto payouts (USDT). Delays typically
occur on withdrawals >$5K.

Sources:
• 8 Reddit posts (r/Forex, r/PropFirmHub)
• 3 Trustpilot reviews (2.0 avg rating)
• 2 Twitter mentions

Firm's response:
"Temporary delays due to exchange liquidity during high
volume periods. We're working on additional liquidity
providers. All payouts will be processed."

PropProof take:
This is a recurring issue for FundedNext (3rd time in 6
months). While firm has paid everyone eventually, consistent
delays hurt trust. Bank wire payouts unaffected.

────────────────────────────────────────────────────

🟡 LOW SEVERITY
Platform login issues (resolved)

Duration:          2 hours (Jan 26, 8-10 PM UTC)
Affected users:    All users
Status:            Resolved

Brief outage caused by AWS infrastructure issues. Firm
communicated proactively on Twitter. No trading accounts
affected.

────────────────────────────────────────────────────

📝 RULE & POLICY CHANGES (0 this week)
────────────────────────────────────────────────────
No changes detected to terms, challenge rules, or pricing.

────────────────────────────────────────────────────

🎉 PROMOTIONS & DISCOUNTS (1 active)
────────────────────────────────────────────────────

💰 20% Off All Challenges - "NEWYEAR20"
Valid until:       Jan 31, 2026
Applies to:        All challenge sizes
Cannot combine:    With other offers
Source:            Official Twitter (@FundedNext)

────────────────────────────────────────────────────

💬 COMMUNITY SENTIMENT
────────────────────────────────────────────────────
Trustpilot Rating:    4.2/5 (↓ 0.3 vs last week)
Total Reviews:        847 (↑ 23 new reviews)
Reddit Mentions:      28 (↑ 40% vs last week)

Sentiment Breakdown:
😊 Positive: 60%  (success stories, fast Rise payouts)
😐 Neutral:  25%  (questions, general discussion)
😟 Negative: 15%  (payout delays, customer support)

Trending Topics:
1. "Withdrawal speed"    - 12 mentions
2. "Customer support"    - 8 mentions
3. "New scaling plan"    - 5 mentions

────────────────────────────────────────────────────

⚖️  PROPPROOF ANALYSIS
────────────────────────────────────────────────────

This week showed solid payout volume ($234K, up 12%), but
the recurring crypto payout delays are concerning. This is
the 3rd occurrence in 6 months, suggesting a systemic issue
rather than isolated incidents.

However, on-chain data confirms all delayed payouts DO
eventually process - no one has reported non-payment. The
firm communicates reasonably well during issues.

Recommendation: If you rely on fast crypto payouts (>$5K),
consider requesting bank wire instead. For smaller amounts
or Rise payouts, no issues observed.

────────────────────────────────────────────────────

📈 TRUST SCORE: 85/100  (↓ 3 points)
────────────────────────────────────────────────────

Change reason: -3 points for medium-severity payout delays

Components:
• On-chain payout consistency:  92/100 ✓
• Incident history:             78/100 ⚠️
• Community sentiment:          88/100 ✓
• Rule stability:               95/100 ✓

────────────────────────────────────────────────────

View full report with sources:
https://propproof.com/reports/fundednext/2026-w04

Manage your subscriptions:
https://propproof.com/settings

────────────────────────────────────────────────────
PropProof - Blockchain-verified prop firm intelligence
```

---

## Appendix B: API Endpoints (New)

```typescript
// Get weekly report
GET /api/v2/reports/:firmId/:weekId
Response: {
  firmId: "fundednext",
  weekNumber: 4,
  year: 2026,
  payouts: { ... },
  incidents: [ ... ],
  trustScore: 85,
  ...
}

// List all reports for a firm
GET /api/v2/reports/:firmId
Response: {
  reports: [
    { weekNumber: 4, year: 2026, trustScore: 85, ... },
    { weekNumber: 3, year: 2026, trustScore: 88, ... }
  ]
}

// Subscribe to firm
POST /api/v2/subscriptions
Body: { firmId: "fundednext" }

// Get user's subscriptions
GET /api/v2/subscriptions

// Global intelligence feed
GET /api/v2/intelligence
Response: {
  items: [
    {
      type: "incident",
      firmId: "fundednext",
      title: "Payout delays",
      severity: "medium",
      timestamp: "2026-01-24T10:00:00Z"
    },
    ...
  ]
}
```

---

**END OF DOCUMENT**

Ready to proceed? Let's start with Week 1 infrastructure setup.
