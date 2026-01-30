# Alpha Release Scope V3: Ultra-Minimal MVP
## Product Requirements Document (Final)

**Document Version:** 3.0 - Ultra-Minimal
**Date:** January 29, 2026
**Author:** Product Management
**Status:** Ready for Implementation

---

## Executive Summary

This document outlines the **absolute minimum viable product** for Alpha release based on ruthless scope reduction and cost optimization.

### Core Philosophy

> **"One data source. One value prop. Four weeks. Prove it works."**

---

## Twitter API Pricing Research (January 2026)

### Official Twitter/X API Pricing:

| Tier | Cost | Read Access | Write Access | Trial Period |
|------|------|-------------|--------------|--------------|
| **Free** | $0 | ❌ None (1 req/15 min = useless) | ✅ 1,500 tweets/month | ❌ No trial |
| **Basic** | $100/mo | ✅ 10,000 reads/month | ✅ 50,000 tweets/month | ❌ No trial |
| **Pro** | $5,000/mo | Higher limits | Higher limits | ❌ No trial |
| **Enterprise** | $42,000/mo | Custom | Custom | ❌ No trial |

**Key Findings:**
- ❌ **No free tier for reading tweets** (only write-only access)
- ❌ **No trial period** (must pay $100/month immediately)
- ⚠️ **Closed beta**: Pay-per-use model with $500 voucher (invitation only)
- ✅ **Alternative**: Apify Twitter Scraper ($49/month, no API approval needed)

### Cost Comparison:

| Option | Monthly Cost | Setup Time | Risk |
|--------|--------------|------------|------|
| Twitter API Basic | $100 | 1-2 weeks (approval) | High (unproven concept) |
| Apify Twitter Scraper | $49 | Immediate | Medium |
| Trustpilot Scraper | $0 | Immediate | Low |

**Recommendation:** Start with Trustpilot ($0) to prove concept, add Twitter in Beta.

---

## Decision: Start with Trustpilot

### Why Trustpilot Wins for Alpha:

1. **Cost**: $0 vs $49-100/month
2. **Risk**: Validate concept before spending
3. **Data Quality**: Long-form reviews = better AI classification
4. **Signal Strength**: High-intent users (only angry/happy people write reviews)
5. **Easier Implementation**: No API approval, no rate limits
6. **Faster to Market**: Start today vs 1-2 weeks approval

### Why Twitter Waits for Beta:

- You don't need to monitor Twitter to market on Twitter
- Trustpilot insights can fuel your Twitter content
- Once proven, $100/month is justified
- Can apply for API access during Alpha (takes 1-2 weeks)

---

## Ultra-Minimal Alpha Scope (4 Weeks)

### Single Value Proposition:

> **"Get automated weekly reports combining blockchain-verified payouts + Trustpilot sentiment for the prop firms you follow."**

### What We're Building:

```
┌─────────────────────────────────────────┐
│   USER: Subscribes to firm reports      │
├─────────────────────────────────────────┤
│   EMAIL: Weekly digest every Monday     │
├─────────────────────────────────────────┤
│   AI: Classify + aggregate reviews      │
├─────────────────────────────────────────┤
│   SCRAPER: Trustpilot (daily)          │
├─────────────────────────────────────────┤
│   DATA: Blockchain payouts (existing)   │
└─────────────────────────────────────────┘
```

---

## Feature Scope

### ✅ In Scope (Must Have):

1. **Trustpilot Scraper**
   - Scrape 50 latest reviews per firm daily
   - Store in Supabase `trustpilot_reviews` table
   - Tech: Playwright (headless browser)
   - Cron: Daily at 2 AM UTC

2. **AI Review Classifier**
   - Categories: `payout_issue`, `scam_warning`, `positive`, `neutral`, `noise`
   - Add severity: `low`, `medium`, `high`
   - Tech: OpenAI GPT-4o-mini (cheap + fast)
   - Batch process: Nightly

3. **Incident Aggregator**
   - Group related reviews (e.g., 5 reviews about same payout delay)
   - Generate incident summary with AI
   - Calculate: affected users (estimate), date range, status

4. **Weekly Report Generator**
   - Combines: Blockchain payouts (existing) + Trustpilot insights (new)
   - Sections:
     - Payout summary (total, count, largest, trend)
     - Trustpilot sentiment (rating, breakdown)
     - Incidents detected (title, severity, count, summary)
     - Trust score update (existing logic)
   - Format: HTML email (mobile-responsive)

5. **Subscription System**
   - Add "Subscribe" button to firm detail pages
   - User can subscribe to multiple firms
   - Store in `firm_subscriptions` table
   - Manage in `/settings`

6. **Email Delivery**
   - Send weekly digest every Monday 8 AM user's timezone
   - Use Resend (already integrated)
   - Include unsubscribe link
   - Track open rates

### ❌ Out of Scope (Move to Beta):

- Reddit scraping
- Twitter monitoring
- Website change detection
- Report archive page (`/reports`)
- Global intelligence feed (`/intelligence`)
- Trust score recalculation (keep existing formula)
- Trending topics extraction
- Firm response field
- Community incident submission
- Mobile app
- Public API documentation

---

## Technical Implementation

### Database Schema (New Tables):

```sql
-- Trustpilot reviews
CREATE TABLE trustpilot_reviews (
  id SERIAL PRIMARY KEY,
  firm_id TEXT REFERENCES firms(id),
  rating INT CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  review_text TEXT,
  reviewer_name TEXT,
  review_date DATE,
  trustpilot_url TEXT UNIQUE,

  -- AI classification (populated after scraping)
  category TEXT, -- payout_issue, scam_warning, positive, neutral, noise
  severity TEXT, -- low, medium, high
  confidence FLOAT, -- 0.0-1.0
  ai_summary TEXT,

  classified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  INDEX idx_firm_date (firm_id, review_date DESC),
  INDEX idx_category (firm_id, category, severity)
);

-- Firm subscriptions
CREATE TABLE firm_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  firm_id TEXT REFERENCES firms(id),
  email_enabled BOOLEAN DEFAULT true,
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  last_sent_at TIMESTAMPTZ,

  UNIQUE(user_id, firm_id)
);

-- Weekly reports (cache generated reports)
CREATE TABLE weekly_reports (
  id SERIAL PRIMARY KEY,
  firm_id TEXT REFERENCES firms(id),
  week_number INT,
  year INT,

  -- Report data
  report_json JSONB NOT NULL,

  -- Metadata
  total_subscribers INT,
  emails_sent INT,
  emails_opened INT,

  generated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(firm_id, week_number, year)
);

-- Aggregated incidents (grouped reviews)
CREATE TABLE weekly_incidents (
  id SERIAL PRIMARY KEY,
  firm_id TEXT REFERENCES firms(id),
  week_number INT,
  year INT,

  incident_type TEXT, -- payout_issue, scam_warning, platform_issue
  severity TEXT, -- low, medium, high
  title TEXT,
  summary TEXT, -- AI-generated
  review_count INT, -- how many reviews mentioned this
  affected_users TEXT, -- estimate (e.g., "~15-20")

  -- Source reviews
  review_ids INT[] REFERENCES trustpilot_reviews(id),

  created_at TIMESTAMPTZ DEFAULT NOW(),

  INDEX idx_firm_week (firm_id, week_number, year)
);
```

---

## Week-by-Week Timeline (4 Weeks)

### Week 1: Scraper + Database

**Goal:** Get Trustpilot data flowing into database

**Tasks:**
- [x] Create Supabase tables (schema above)
- [ ] Build Trustpilot scraper
  - Input: Firm name or Trustpilot URL
  - Output: Array of reviews (rating, title, text, date, author, URL)
  - Handle pagination (scrape 50 reviews)
  - Handle rate limiting (delays between requests)
- [ ] Test scraper on 3 firms:
  - FundedNext
  - FTMO
  - TopStep
- [ ] Backfill last 30 days of reviews (~150 reviews)
- [ ] Set up Vercel cron job (daily scraping)

**Tech Stack:**
```javascript
// lib/scrapers/trustpilot.js
import { chromium } from 'playwright';

export async function scrapeTrustpilot(firmName) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Navigate to firm's Trustpilot page
  const url = `https://www.trustpilot.com/review/${firmName.toLowerCase().replace(/\s+/g, '-')}`;
  await page.goto(url);

  // Extract reviews
  const reviews = await page.$$eval('[data-service-review-card-paper]', cards =>
    cards.map(card => ({
      rating: card.querySelector('[data-service-review-rating]')?.getAttribute('data-service-review-rating'),
      title: card.querySelector('h2')?.innerText,
      text: card.querySelector('[data-service-review-text-typography]')?.innerText,
      author: card.querySelector('[data-consumer-name]')?.innerText,
      date: card.querySelector('time')?.getAttribute('datetime'),
      url: card.querySelector('a')?.href
    }))
  );

  await browser.close();
  return reviews;
}
```

**Deliverable:** 150+ reviews in database, scraper running daily

**Effort:** 20 hours

---

### Week 2: AI Classification

**Goal:** Auto-classify reviews into categories with severity

**Tasks:**
- [ ] Set up OpenAI API key (env var)
- [ ] Build classification function
  - Input: Review text + rating
  - Output: Category, severity, confidence, summary
- [ ] Test on 50 reviews manually
  - Measure accuracy (target: >80%)
  - Adjust prompts if needed
- [ ] Run batch classification on all reviews
- [ ] Set up nightly cron job (classify new reviews)

**OpenAI Prompt:**
```javascript
// lib/ai/classifier.js

export async function classifyReview(review) {
  const prompt = `
    Analyze this Trustpilot review for a prop trading firm:

    Rating: ${review.rating}/5
    Title: "${review.title}"
    Review: "${review.text}"

    Classify into ONE category:
    - payout_issue: Problems receiving payouts (delays, denials, missing payments)
    - scam_warning: Fraud accusations, scam claims, exit scam fears
    - platform_issue: Technical problems (login, charts, platform downtime)
    - rule_violation: Unfair account termination, rule disputes
    - positive: Success stories, praise, recommendations
    - neutral: Questions, general discussion, mixed feedback
    - noise: Irrelevant, off-topic, or uninformative

    Determine severity (if negative):
    - high: Serious issue affecting many users or money (scams, non-payment, mass bans)
    - medium: Moderate issue affecting some users (delays, specific platform bugs)
    - low: Minor complaints or isolated incidents

    Respond with JSON:
    {
      "category": "payout_issue",
      "severity": "medium",
      "confidence": 0.85,
      "summary": "User reports 5-day delay on $3K crypto payout"
    }
  `;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini', // $0.15 per 1M input tokens
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
    response_format: { type: 'json_object' }
  });

  return JSON.parse(response.choices[0].message.content);
}
```

**Cost Estimate:**
- 100 reviews/day × 30 days = 3,000 reviews/month
- ~500 tokens per review = 1.5M tokens/month
- Cost: $0.15 per 1M input tokens = **$0.23/month**

**Deliverable:** All reviews classified, >80% accuracy validated

**Effort:** 16 hours

---

### Week 3: Report Generation (Semi-Manual)

**Goal:** Generate first 3 polished weekly reports

**Tasks:**
- [ ] Build incident aggregator
  - Group reviews by category + week
  - If 3+ reviews mention similar issue → create incident
  - Use AI to generate incident summary
- [ ] Build report generator function
  - Fetch: Blockchain payouts (existing API)
  - Fetch: Trustpilot reviews + incidents (new)
  - Calculate: Sentiment breakdown (% positive/neutral/negative)
  - Calculate: Rating change vs last week
  - Generate: "Our Take" section with AI
- [ ] Design HTML email template
  - Mobile-responsive
  - Brand colors
  - Clear sections
  - CTA: "View on-chain proof"
- [ ] Manually generate 3 reports:
  - FundedNext (Week of Jan 22-28)
  - FTMO (Week of Jan 22-28)
  - TopStep (Week of Jan 22-28)
- [ ] Get feedback from 5 beta testers
  - Is it valuable?
  - Too long/short?
  - What's missing?

**Report Structure:**
```javascript
// lib/digest/generator.js

export async function generateWeeklyReport(firmId, weekStart, weekEnd) {
  // 1. Fetch blockchain payout data (existing)
  const payouts = await fetchPayouts(firmId, weekStart, weekEnd);
  const payoutSummary = {
    total: sum(payouts.map(p => p.amount)),
    count: payouts.length,
    largest: max(payouts.map(p => p.amount)),
    avgPayout: average(payouts.map(p => p.amount)),
    change: calculateChange(payouts, previousWeekPayouts)
  };

  // 2. Fetch Trustpilot reviews (new)
  const reviews = await fetchReviews(firmId, weekStart, weekEnd);
  const avgRating = average(reviews.map(r => r.rating));
  const previousRating = await getPreviousWeekRating(firmId);

  // 3. Sentiment breakdown
  const sentiment = {
    positive: reviews.filter(r => r.category === 'positive').length,
    neutral: reviews.filter(r => r.category === 'neutral').length,
    negative: reviews.filter(r => ['payout_issue', 'scam_warning', 'platform_issue'].includes(r.category)).length
  };

  // 4. Detect incidents
  const incidents = await detectIncidents(firmId, weekStart, weekEnd);

  // 5. Generate "Our Take" with AI
  const analysis = await generateAnalysis({
    payoutSummary,
    avgRating,
    ratingChange: avgRating - previousRating,
    incidents,
    sentiment
  });

  // 6. Compile report
  return {
    firmId,
    weekNumber: getWeekNumber(weekStart),
    year: getYear(weekStart),
    payouts: payoutSummary,
    trustpilot: {
      avgRating,
      ratingChange: avgRating - previousRating,
      reviewCount: reviews.length,
      sentiment
    },
    incidents,
    analysis,
    trustScore: await calculateTrustScore(firmId) // existing logic
  };
}
```

**Deliverable:** 3 polished reports, validated with beta testers

**Effort:** 12 hours (including copy writing)

---

### Week 4: Automation + Launch

**Goal:** Ship subscription system + send first automated digest

**Tasks:**
- [ ] Add "Subscribe" button to firm detail pages
  - Only visible when logged in
  - Shows "Subscribed ✓" if already subscribed
  - Shows "Next report: Monday, Feb 10 at 8 AM"
- [ ] Build subscription API endpoints
  - `POST /api/subscriptions` - Subscribe to firm
  - `DELETE /api/subscriptions/:firmId` - Unsubscribe
  - `GET /api/subscriptions` - Get user's subscriptions
- [ ] Integrate Resend for email delivery
  - Already set up per CLAUDE.md
  - Create email template component
  - Send test email to self
- [ ] Build "Manage Subscriptions" in `/settings`
  - List all subscribed firms
  - Unsubscribe button per firm
  - "Unsubscribe from all" option
- [ ] Set up cron jobs (Vercel Cron):
  ```javascript
  // app/api/cron/scrape-trustpilot/route.js
  // Runs daily at 2 AM UTC
  export async function GET() {
    const firms = await getAllFirms();
    for (const firm of firms) {
      await scrapeTrustpilot(firm.name);
    }
    return new Response('OK');
  }

  // app/api/cron/classify-reviews/route.js
  // Runs daily at 3 AM UTC (after scraping)
  export async function GET() {
    const unclassifiedReviews = await getUnclassifiedReviews();
    for (const review of unclassifiedReviews) {
      await classifyReview(review);
    }
    return new Response('OK');
  }

  // app/api/cron/send-weekly-reports/route.js
  // Runs every Monday at 8 AM UTC
  export async function GET() {
    const firms = await getAllFirms();
    for (const firm of firms) {
      const report = await generateWeeklyReport(firm.id);
      const subscribers = await getSubscribers(firm.id);
      for (const subscriber of subscribers) {
        await sendEmail(subscriber.email, report);
      }
    }
    return new Response('OK');
  }
  ```
- [ ] Manually trigger first weekly report
- [ ] Send to all beta testers
- [ ] Monitor delivery rate, open rate
- [ ] Launch announcement:
  - Twitter thread
  - Reddit post (r/Forex, r/Daytrading)
  - ProductHunt (optional)

**Deliverable:** Alpha launched, automated emails sending

**Effort:** 16 hours

---

## UI Changes

### Firm Detail Page - New Card

Add this card below the payout chart:

```jsx
// components/FirmWeeklyReportCard.js

<div className="bg-gradient-to-br from-purple-50 to-blue-50 p-6 rounded-2xl border border-purple-100 shadow-sm">
  <div className="flex items-start justify-between mb-4">
    <div>
      <h3 className="text-lg font-bold text-gray-900 mb-1">
        📧 Get Weekly Intelligence Reports
      </h3>
      <p className="text-sm text-gray-600">
        Automated digest of payouts + community sentiment every Monday
      </p>
    </div>
    {subscribed && (
      <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">
        ✓ Subscribed
      </span>
    )}
  </div>

  <div className="space-y-3 mb-5">
    <div className="flex items-center gap-2 text-sm text-gray-700">
      <svg className="w-4 h-4 text-purple-600">...</svg>
      Blockchain-verified payout summary
    </div>
    <div className="flex items-center gap-2 text-sm text-gray-700">
      <svg className="w-4 h-4 text-purple-600">...</svg>
      Trustpilot sentiment analysis
    </div>
    <div className="flex items-center gap-2 text-sm text-gray-700">
      <svg className="w-4 h-4 text-purple-600">...</svg>
      Incident alerts & red flags
    </div>
    <div className="flex items-center gap-2 text-sm text-gray-700">
      <svg className="w-4 h-4 text-purple-600">...</svg>
      Trust score updates
    </div>
  </div>

  {user ? (
    <button
      onClick={subscribed ? handleUnsubscribe : handleSubscribe}
      className={`w-full py-3 rounded-xl font-bold transition-all ${
        subscribed
          ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          : 'bg-purple-600 text-white hover:bg-purple-700'
      }`}
    >
      {subscribed ? 'Unsubscribe' : 'Subscribe (Free)'}
    </button>
  ) : (
    <button
      onClick={() => router.push('/signin')}
      className="w-full py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700"
    >
      Sign In to Subscribe
    </button>
  )}

  <p className="text-xs text-gray-500 text-center mt-3">
    Next report: Monday, Feb 10 at 8:00 AM
  </p>
</div>
```

---

### Settings Page - Subscription Management

Add new section in `/settings`:

```jsx
// components/SubscriptionSettings.js

<div className="bg-white p-6 rounded-xl border">
  <h3 className="text-lg font-bold mb-4">Weekly Report Subscriptions</h3>

  {subscriptions.length === 0 ? (
    <p className="text-gray-500 text-center py-8">
      You're not subscribed to any firms yet.
      <br />
      <Link href="/propfirms" className="text-purple-600 underline">
        Browse firms
      </Link>
    </p>
  ) : (
    <div className="space-y-3">
      {subscriptions.map(sub => (
        <div key={sub.firmId} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            <img src={getFirmLogo(sub.firmId)} className="w-10 h-10 rounded-lg" />
            <div>
              <p className="font-bold text-sm">{sub.firmName}</p>
              <p className="text-xs text-gray-500">
                Subscribed on {new Date(sub.subscribedAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <button
            onClick={() => handleUnsubscribe(sub.firmId)}
            className="text-xs text-red-600 hover:text-red-700 font-semibold"
          >
            Unsubscribe
          </button>
        </div>
      ))}
    </div>
  )}

  <button
    onClick={handleUnsubscribeAll}
    className="mt-4 text-xs text-gray-500 hover:text-gray-700 underline"
  >
    Unsubscribe from all reports
  </button>
</div>
```

---

## Email Template Design

### Subject Line Options (A/B Test):

1. `[FirmName] Weekly Report - Week of [Date]` (straightforward)
2. `🚨 2 incidents detected for [FirmName] this week` (urgency)
3. `Your weekly [FirmName] intelligence - [Date]` (professional)

### HTML Email Structure:

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    /* Mobile-responsive styles */
    body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; }
    .header { background: linear-gradient(to right, #7c3aed, #2563eb); padding: 32px; text-align: center; }
    .section { padding: 24px; border-bottom: 1px solid #e5e7eb; }
    .stat { font-size: 24px; font-weight: bold; color: #111827; }
    .change-up { color: #059669; }
    .change-down { color: #dc2626; }
    .incident-card { background: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; margin: 12px 0; }
    .cta-button { display: inline-block; background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="header">
    <h1 style="color: white; margin: 0;">FundedNext</h1>
    <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0 0;">
      Weekly Report - Jan 22-28, 2026
    </p>
  </div>

  <!-- Payout Summary -->
  <div class="section">
    <h2>📊 Payout Summary</h2>
    <p class="stat">$234,500 <span class="change-up">↑12%</span></p>
    <ul style="color: #6b7280;">
      <li>45 payouts (largest: $12,300)</li>
      <li>Average: $5,211</li>
      <li>Last payout: 2 hours ago</li>
    </ul>
  </div>

  <!-- Trustpilot Sentiment -->
  <div class="section">
    <h2>💬 Trustpilot Sentiment (23 reviews)</h2>
    <p class="stat">4.2/5 <span class="change-down">↓0.3</span></p>
    <p style="color: #6b7280;">
      😊 60% Positive | 😐 25% Neutral | 😟 15% Negative
    </p>
  </div>

  <!-- Incidents -->
  <div class="section">
    <h2>🚨 Incidents Detected (1 this week)</h2>

    <div class="incident-card">
      <h3 style="margin-top: 0; color: #991b1b;">⚠️ Payout Delays (Medium Severity)</h3>
      <p style="color: #450a0a;">
        8 reviews mentioned 3-5 day delays on crypto payouts >$5K.
        Pattern started Jan 24.
      </p>
      <p style="color: #7f1d1d; font-size: 14px; margin: 0;">
        Most common: "Waiting 5 days for USDT withdrawal"
      </p>
    </div>
  </div>

  <!-- Our Take -->
  <div class="section">
    <h2>⚖️ PropProof Analysis</h2>
    <p style="color: #374151;">
      Strong payout volume this week ($234K, up 12%), but recurring
      crypto payout delays are concerning. This is the 3rd time in 6 months.
      However, all delayed payouts eventually process - no non-payment reports.
    </p>
    <p style="color: #374151;">
      <strong>Recommendation:</strong> For payouts >$5K, consider bank wire.
      Smaller amounts show no delays.
    </p>
  </div>

  <!-- Trust Score -->
  <div class="section">
    <h2>📈 Trust Score</h2>
    <p class="stat">85/100 <span class="change-down">↓3</span></p>
    <p style="color: #6b7280; font-size: 14px;">
      Change reason: -3 points for medium-severity payout delays
    </p>
  </div>

  <!-- CTA -->
  <div class="section" style="text-align: center; border: none;">
    <a href="https://propproof.com/propfirm/fundednext" class="cta-button">
      View On-Chain Proof
    </a>
    <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
      <a href="https://propproof.com/settings" style="color: #9ca3af;">Manage subscriptions</a>
      |
      <a href="{{unsubscribe_url}}" style="color: #9ca3af;">Unsubscribe</a>
    </p>
  </div>

  <!-- Footer -->
  <div style="background: #f9fafb; padding: 24px; text-align: center;">
    <p style="color: #6b7280; font-size: 12px; margin: 0;">
      PropProof - Blockchain-verified prop firm intelligence
    </p>
  </div>
</body>
</html>
```

---

## Success Criteria (4 Weeks)

### Must Achieve:
- [ ] 150+ reviews scraped across 3 firms
- [ ] AI classification >80% accuracy (manually validated on 50 samples)
- [ ] 50+ total subscribers (across all firms)
- [ ] 4 automated weekly reports sent (1 per week)
- [ ] 60%+ email open rate (industry avg: 20-25%)
- [ ] 10%+ click-through rate (to firm pages)
- [ ] 0 critical bugs (scraper failures, failed emails)

### Nice to Have:
- [ ] 100+ subscribers
- [ ] 70%+ open rate
- [ ] At least 1 user replies: "This helped me decide"
- [ ] Report shared on Reddit/Twitter by users
- [ ] 1+ firm reaches out about incident report

---

## Cost Breakdown (Monthly)

| Item | Cost | Notes |
|------|------|-------|
| Supabase Pro | $25 | Database + auth (already have) |
| OpenAI API | $5-10 | GPT-4o-mini ($0.15/1M tokens) |
| Resend | $0 | Free tier: 3,000 emails/month |
| Vercel | $0 | Free tier (cron jobs included) |
| Playwright | $0 | Open source |
| **Total** | **$30-35/month** | |

**ROI:** For $30/month, validate if users want this feature before spending $100/month on Twitter API.

---

## Risks & Mitigation

### Risk 1: Trustpilot Blocks Scraper
**Probability:** Medium
**Impact:** High
**Mitigation:**
- Use residential proxies (Bright Data: $15/month)
- Rotate user agents
- Add random delays (2-5 seconds between requests)
- Fallback: Use Apify's Trustpilot Actor ($49/month, handles anti-bot)

### Risk 2: AI Classification Inaccurate
**Probability:** Medium
**Impact:** Medium
**Mitigation:**
- Manually validate first 50 classifications
- Adjust prompts based on errors
- Add confidence threshold (only auto-publish >0.75)
- Show "AI-generated" disclaimer in reports

### Risk 3: Low Email Engagement
**Probability:** Medium
**Impact:** High
**Mitigation:**
- A/B test subject lines
- Keep reports <2 min read
- Add "unsubscribe from this firm only" option
- Send preview email to beta testers for feedback

### Risk 4: Not Enough Trustpilot Data
**Probability:** Low (for major firms)
**Impact:** Medium
**Mitigation:**
- Start with firms that have most reviews (FTMO, FundedNext)
- If <5 reviews/week, note in report: "Low review volume this week"
- Can add Reddit in Beta to supplement data

---

## Beta Expansion Plan (Weeks 5-12)

Once Alpha proves concept (50+ subscribers, 60%+ open rate):

### Week 5-6: Add Reddit Scraping
- PRAW (Python Reddit API Wrapper)
- Monitor r/Forex, r/Daytrading, r/PropFirmHub
- Add Reddit mentions to weekly report

### Week 7-8: Add Twitter Monitoring
- Apply for Twitter API during Alpha (takes 1-2 weeks)
- Start with $100/month Basic tier
- Track official firm accounts + mentions
- Add Twitter section to report

### Week 9-10: Build Report Archive
- Create `/reports/[firmId]/[weekId]` page
- Show all past reports
- Make public (no auth required) for SEO

### Week 11-12: Build Intelligence Feed
- Create `/intelligence` page
- Twitter-like feed of latest incidents
- Filter by firm, severity, date

---

## Why This Scope Works

### Validates Core Hypotheses:
1. **Do traders want automated firm intelligence?**
2. **Is Trustpilot data sufficient, or do we need Twitter/Reddit?**
3. **Will people open/read weekly emails?**
4. **Is AI classification accurate enough?**

### Low Risk:
- $30/month cost (vs $150+ with Twitter)
- 4 weeks vs 8 weeks
- Can pivot quickly if doesn't work

### High Learning:
- Email open rates tell us if format/timing is right
- User feedback tells us what sources to add next
- Incident detection accuracy improves with real data

### Sets Up Beta:
- Infrastructure built (scraper, AI, email)
- Adding Reddit/Twitter = just more scrapers (same pipeline)
- Can easily scale to 20-50 firms

---

## Next Steps (If Approved)

### Immediate Actions:

1. **Approve this scope** (confirm 4-week timeline acceptable)
2. **Assign developer** (1 full-time for 4 weeks)
3. **Set up beta tester list** (recruit 10-20 users from Reddit/Twitter)
4. **Create project board** (GitHub Issues or Linear)
5. **Schedule weekly check-ins** (Monday 9 AM, review progress)

### Week 1 Kickoff (Tomorrow):

**Day 1:**
- [ ] Create Supabase tables
- [ ] Set up Playwright project
- [ ] Find Trustpilot URLs for 3 firms

**Day 2-3:**
- [ ] Build scraper MVP
- [ ] Test on 1 firm (FundedNext)
- [ ] Debug & refine

**Day 4-5:**
- [ ] Scrape 3 firms (FundedNext, FTMO, TopStep)
- [ ] Backfill 30 days
- [ ] Set up daily cron job

---

## Comparison: V2 vs V3

| Aspect | V2 (Multi-Source) | V3 (Trustpilot Only) |
|--------|------------------|---------------------|
| **Timeline** | 8 weeks | 4 weeks ⚡ |
| **Cost** | $75-100/month | $30-35/month 💰 |
| **Data sources** | 4 (Trustpilot, Reddit, Twitter, Websites) | 1 (Trustpilot) |
| **Risk** | Higher (complex, expensive) | Lower (simple, cheap) ✅ |
| **Learning** | Same | Same |
| **Scalability** | Same | Same |
| **Market validation** | Slower | Faster ⚡ |

**Winner:** V3 (Ultra-Minimal)

---

## Appendix A: Trustpilot Firm URLs

Pre-researched URLs for first 3 firms:

1. **FundedNext**: https://www.trustpilot.com/review/fundednext.com
2. **FTMO**: https://www.trustpilot.com/review/ftmo.com
3. **TopStep**: https://www.trustpilot.com/review/topsteptrader.com

Additional firms for Beta:
4. The5ers: https://www.trustpilot.com/review/the5ers.com
5. FundingPips: https://www.trustpilot.com/review/fundingpips.com
6. MyFundedFutures: https://www.trustpilot.com/review/myfundedfutures.com

---

## Appendix B: Sample API Responses

### GET /api/subscriptions

```json
{
  "subscriptions": [
    {
      "firmId": "fundednext",
      "firmName": "Funded Next",
      "firmLogo": "/logos/firms/fundednext.jpeg",
      "subscribedAt": "2026-01-29T10:00:00Z",
      "lastSentAt": "2026-01-27T08:00:00Z",
      "nextReportAt": "2026-02-03T08:00:00Z"
    }
  ]
}
```

### POST /api/subscriptions

```json
// Request
{
  "firmId": "fundednext"
}

// Response
{
  "success": true,
  "subscription": {
    "firmId": "fundednext",
    "subscribedAt": "2026-01-29T10:30:00Z"
  }
}
```

---

**END OF DOCUMENT**

Ready to start Week 1? 🚀
