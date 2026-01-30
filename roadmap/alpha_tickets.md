# Alpha Release V3 - Implementation Tickets (Ultra-Minimal MVP)

**Timeline:** 4 weeks
**Scope:** Trustpilot-only intelligence engine
**Goal:** Validate market fit with minimal investment

---

## 🎯 Sprint Overview

| Sprint | Focus | Deliverables |
|--------|-------|--------------|
| Week 1 | Data Infrastructure | Scraper + Database ready |
| Week 2 | AI Classification | Auto-categorization working |
| Week 3 | Report Generation | 3 polished reports validated |
| Week 4 | Automation + Launch | Live subscription system |

---

## Week 1: Data Infrastructure (20 hours)

### TICKET-001: Database Schema Setup
**Priority:** P0 (Blocker)
**Estimate:** 2 hours
**Owner:** Backend Dev

**Description:**
Create Supabase tables for Trustpilot data and subscriptions.

**Acceptance Criteria:**
- [ ] Create `trustpilot_reviews` table with fields:
  - `id`, `firm_id`, `rating`, `title`, `review_text`, `reviewer_name`, `review_date`, `trustpilot_url`
  - `category`, `severity`, `confidence`, `ai_summary` (nullable, for AI classification)
  - `classified_at`, `created_at`
  - Indexes: `idx_firm_date` on `(firm_id, review_date DESC)`, `idx_category` on `(firm_id, category, severity)`
- [ ] Create `firm_subscriptions` table with fields:
  - `id`, `user_id` (FK to auth.users), `firm_id` (FK to firms), `email_enabled`, `subscribed_at`, `last_sent_at`
  - Unique constraint on `(user_id, firm_id)`
- [ ] Create `weekly_reports` table with fields:
  - `id`, `firm_id`, `week_number`, `year`, `report_json` (JSONB)
  - `total_subscribers`, `emails_sent`, `emails_opened`, `generated_at`
  - Unique constraint on `(firm_id, week_number, year)`
- [ ] Create `weekly_incidents` table with fields:
  - `id`, `firm_id`, `week_number`, `year`
  - `incident_type`, `severity`, `title`, `summary`, `review_count`, `affected_users`
  - `review_ids` (INT[] references)
  - Index on `(firm_id, week_number, year)`
- [ ] Run migrations in dev + staging environments
- [ ] Verify RLS policies (users can only read/modify their own subscriptions)

**Technical Notes:**
- Use existing Supabase project
- See `alpha_scope_v3.md` lines 156-234 for detailed schema

---

### TICKET-002: Trustpilot Scraper Implementation
**Priority:** P0 (Blocker)
**Estimate:** 12 hours
**Owner:** Backend Dev

**Description:**
Build Playwright-based scraper to extract reviews from Trustpilot.

**Acceptance Criteria:**
- [ ] Create `lib/scrapers/trustpilot.js` with `scrapeTrustpilot(firmName)` function
- [ ] Function accepts firm name or Trustpilot URL
- [ ] Extract per review:
  - Rating (1-5 stars)
  - Title
  - Review text (full content)
  - Reviewer name
  - Review date (parse to ISO format)
  - Review URL (permalink)
- [ ] Handle pagination (scrape 50 most recent reviews)
- [ ] Add rate limiting (2-5 second random delays between requests)
- [ ] Add error handling (network failures, missing elements)
- [ ] Add logging (console output with timestamps)
- [ ] Store reviews in `trustpilot_reviews` table (dedupe by `trustpilot_url`)
- [ ] Test on 3 firms: FundedNext, FTMO, TopStep

**Technical Notes:**
- Use Playwright in headless mode
- Selectors: `[data-service-review-card-paper]` for cards
- Handle CAPTCHA: If encountered, fail gracefully and retry with delay
- Consider using Bright Data proxies if blocked ($15/month)

**URLs:**
- FundedNext: https://www.trustpilot.com/review/fundednext.com
- FTMO: https://www.trustpilot.com/review/ftmo.com
- TopStep: https://www.trustpilot.com/review/topsteptrader.com

**Dependencies:** TICKET-001

---

### TICKET-003: Historical Data Backfill
**Priority:** P1 (High)
**Estimate:** 2 hours
**Owner:** Backend Dev

**Description:**
Run scraper to backfill last 30 days of reviews for 3 firms.

**Acceptance Criteria:**
- [ ] Run `scrapeTrustpilot()` for FundedNext, FTMO, TopStep
- [ ] Scrape ~150+ total reviews (50 per firm)
- [ ] Verify data in Supabase:
  - No duplicates
  - Dates parsed correctly
  - All fields populated
- [ ] Document any scraping issues (blocked URLs, missing data)

**Dependencies:** TICKET-002

---

### TICKET-004: Daily Scraper Cron Job
**Priority:** P1 (High)
**Estimate:** 4 hours
**Owner:** Backend Dev

**Description:**
Set up automated daily scraping via Vercel Cron.

**Acceptance Criteria:**
- [ ] Create `app/api/cron/scrape-trustpilot/route.js`
- [ ] Endpoint runs `scrapeTrustpilot()` for all active firms
- [ ] Schedule: Daily at 2 AM UTC
- [ ] Add cron secret token for security (verify in route handler)
- [ ] Configure in `vercel.json`:
  ```json
  {
    "crons": [{
      "path": "/api/cron/scrape-trustpilot",
      "schedule": "0 2 * * *"
    }]
  }
  ```
- [ ] Test manual trigger via URL
- [ ] Monitor logs in Vercel dashboard
- [ ] Set up failure alerts (email on error)

**Technical Notes:**
- Vercel free tier includes cron jobs
- Max execution time: 10 seconds (optimize scraper if needed)
- If timeout, consider Railway/Render for scraper ($5-10/month)

**Dependencies:** TICKET-002

---

## Week 2: AI Classification (16 hours)

### TICKET-005: OpenAI Integration Setup
**Priority:** P0 (Blocker)
**Estimate:** 1 hour
**Owner:** Backend Dev

**Description:**
Set up OpenAI API for review classification.

**Acceptance Criteria:**
- [ ] Add `OPENAI_API_KEY` to `.env.local` and Vercel environment
- [ ] Install `openai` npm package
- [ ] Create `lib/ai/openai-client.js` with initialized client
- [ ] Test API connection with simple prompt
- [ ] Verify billing/quota limits on OpenAI dashboard

**Cost:**
- Model: `gpt-4o-mini` ($0.15 per 1M input tokens)
- Estimated: 3,000 reviews/month × 500 tokens = 1.5M tokens/month = $0.23/month

---

### TICKET-006: Review Classifier Function
**Priority:** P0 (Blocker)
**Estimate:** 8 hours
**Owner:** Backend Dev

**Description:**
Build AI function to classify reviews into categories.

**Acceptance Criteria:**
- [ ] Create `lib/ai/classifier.js` with `classifyReview(review)` function
- [ ] Input: review object (rating, title, text)
- [ ] Output: JSON object with:
  ```json
  {
    "category": "payout_issue",
    "severity": "medium",
    "confidence": 0.85,
    "summary": "User reports 5-day delay on $3K crypto payout"
  }
  ```
- [ ] Categories:
  - `payout_issue`: Problems receiving payouts
  - `scam_warning`: Fraud accusations
  - `platform_issue`: Technical problems
  - `rule_violation`: Unfair terminations
  - `positive`: Success stories
  - `neutral`: Mixed feedback
  - `noise`: Irrelevant
- [ ] Severity levels (for negative categories): `low`, `medium`, `high`
- [ ] Use structured output (JSON mode)
- [ ] Add retry logic (3 attempts with exponential backoff)
- [ ] Store results in `trustpilot_reviews` table (update `category`, `severity`, `confidence`, `ai_summary`, `classified_at`)

**Technical Notes:**
- See `alpha_scope_v3.md` lines 310-353 for full prompt
- Set `temperature=0.2` for consistency
- Add timeout: 30 seconds per classification

**Dependencies:** TICKET-005

---

### TICKET-007: Classification Validation
**Priority:** P1 (High)
**Estimate:** 4 hours
**Owner:** PM + Backend Dev

**Description:**
Manually validate AI classification accuracy.

**Acceptance Criteria:**
- [ ] Select 50 random reviews from backfilled data
- [ ] Run classifier on all 50
- [ ] PM manually reviews results:
  - Correct category? (target: >80% accuracy)
  - Correct severity? (target: >75% accuracy)
  - Useful summary? (subjective, but should be concise)
- [ ] Document errors in spreadsheet
- [ ] Adjust prompt if accuracy <80%
- [ ] Re-run and re-validate until target met

**Dependencies:** TICKET-006

---

### TICKET-008: Batch Classification Cron Job
**Priority:** P1 (High)
**Estimate:** 3 hours
**Owner:** Backend Dev

**Description:**
Automate nightly classification of new reviews.

**Acceptance Criteria:**
- [ ] Create `app/api/cron/classify-reviews/route.js`
- [ ] Fetch all reviews where `classified_at IS NULL`
- [ ] Run `classifyReview()` on each
- [ ] Update database with results
- [ ] Schedule: Daily at 3 AM UTC (after scraping completes)
- [ ] Add to `vercel.json` cron config
- [ ] Add error handling (log failures, continue on error)
- [ ] Monitor classification success rate

**Dependencies:** TICKET-006, TICKET-007

---

## Week 3: Report Generation (12 hours)

### TICKET-009: Incident Aggregator
**Priority:** P0 (Blocker)
**Estimate:** 6 hours
**Owner:** Backend Dev

**Description:**
Group related reviews into incidents.

**Acceptance Criteria:**
- [ ] Create `lib/digest/incident-aggregator.js` with `detectIncidents(firmId, weekStart, weekEnd)` function
- [ ] Logic:
  - Fetch all reviews in date range with `category IN ('payout_issue', 'scam_warning', 'platform_issue', 'rule_violation')`
  - Group by `category`
  - If 3+ reviews in same category → create incident
  - Use AI to generate incident summary:
    - Input: Array of review summaries
    - Output: Aggregated incident title + description + affected users estimate
- [ ] Store in `weekly_incidents` table
- [ ] Test on historical data (Week of Jan 22-28)

**Example Output:**
```json
{
  "incident_type": "payout_issue",
  "severity": "medium",
  "title": "Crypto payout delays reported",
  "summary": "8 users reported 3-5 day delays on crypto payouts >$5K...",
  "review_count": 8,
  "affected_users": "~15-20 (estimated)"
}
```

**Dependencies:** TICKET-006

---

### TICKET-010: Weekly Report Generator Function
**Priority:** P0 (Blocker)
**Estimate:** 4 hours
**Owner:** Backend Dev

**Description:**
Build function to compile weekly reports.

**Acceptance Criteria:**
- [ ] Create `lib/digest/generator.js` with `generateWeeklyReport(firmId, weekStart, weekEnd)` function
- [ ] Fetch data:
  - Blockchain payouts (use existing API: `/api/v2/propfirms/[id]?window=7d`)
  - Trustpilot reviews (from database)
  - Incidents (from `detectIncidents()`)
- [ ] Calculate:
  - Payout summary (total, count, largest, average, change vs last week)
  - Trustpilot summary (avg rating, rating change, review count)
  - Sentiment breakdown (% positive/neutral/negative)
- [ ] Use AI to generate "Our Take" section:
  - Input: All above metrics + incidents
  - Output: 2-3 paragraph analysis + recommendation
- [ ] Return JSON report object
- [ ] Store in `weekly_reports` table

**Technical Notes:**
- See `alpha_scope_v3.md` lines 396-451 for detailed structure

**Dependencies:** TICKET-009

---

### TICKET-011: HTML Email Template
**Priority:** P1 (High)
**Estimate:** 2 hours
**Owner:** Frontend Dev (or Backend if needed)

**Description:**
Create mobile-responsive HTML email template.

**Acceptance Criteria:**
- [ ] Create `components/EmailTemplate.jsx` (or pure HTML if not using React)
- [ ] Sections:
  - Header (firm name, week, logo)
  - Payout summary (stats + trend indicator)
  - Trustpilot sentiment (rating + breakdown)
  - Incidents (cards with severity badges)
  - PropProof analysis ("Our Take")
  - Trust score (number + change)
  - CTA button ("View On-Chain Proof")
  - Footer (manage subscriptions, unsubscribe links)
- [ ] Styling:
  - Mobile-responsive (max-width: 600px)
  - Inline CSS (email clients don't support external stylesheets)
  - Gradient header (purple to blue)
  - Color-coded severity (red/yellow/green)
- [ ] Test rendering in:
  - Gmail (web + mobile)
  - Outlook
  - Apple Mail

**Reference:**
- See `alpha_scope_v3.md` lines 666-770 for full HTML template

---

## Week 4: Automation + Launch (16 hours)

### TICKET-012: Subscription API Endpoints
**Priority:** P0 (Blocker)
**Estimate:** 4 hours
**Owner:** Backend Dev

**Description:**
Build API routes for managing firm subscriptions.

**Acceptance Criteria:**
- [ ] Create `app/api/subscriptions/route.js`:
  - `GET /api/subscriptions` - List user's subscriptions
  - `POST /api/subscriptions` - Subscribe to firm
  - Response includes: firm details, subscribed date, next report date
- [ ] Create `app/api/subscriptions/[firmId]/route.js`:
  - `DELETE /api/subscriptions/[firmId]` - Unsubscribe from firm
- [ ] Authentication: Verify user via Supabase auth (reject if not logged in)
- [ ] Validation: Check firm exists in `firms` table
- [ ] Deduplication: Handle duplicate subscribe requests (return existing subscription)
- [ ] Write API tests (at least 5 test cases)

**Test Cases:**
1. Subscribe when logged in → success
2. Subscribe when not logged in → 401
3. Subscribe to invalid firm → 404
4. Subscribe twice → return existing
5. Unsubscribe → soft delete (or hard delete, TBD)

---

### TICKET-013: Firm Detail Page - Subscribe Card
**Priority:** P0 (Blocker)
**Estimate:** 4 hours
**Owner:** Frontend Dev

**Description:**
Add subscription card to firm detail pages.

**Acceptance Criteria:**
- [ ] Create `components/FirmWeeklyReportCard.jsx`
- [ ] Display:
  - Heading: "Get Weekly Intelligence Reports"
  - Description: "Automated digest of payouts + community sentiment every Monday"
  - Benefits list (4 bullet points with icons)
  - Subscribe/Unsubscribe button (changes based on state)
  - "Next report: Monday, [date]" timestamp
- [ ] Button states:
  - Not logged in: "Sign In to Subscribe" → redirect to `/signin`
  - Logged in, not subscribed: "Subscribe (Free)" → call API
  - Logged in, subscribed: "Subscribed ✓" → allow unsubscribe
- [ ] Styling:
  - Gradient background (purple to blue)
  - Border with shadow
  - Responsive (mobile + desktop)
- [ ] Place below payout chart on firm detail page
- [ ] Test on 3 firms

**Reference:**
- See `alpha_scope_v3.md` lines 536-599 for full component code

**Dependencies:** TICKET-012

---

### TICKET-014: Settings Page - Subscription Management
**Priority:** P1 (High)
**Estimate:** 3 hours
**Owner:** Frontend Dev

**Description:**
Add subscription management section to user settings.

**Acceptance Criteria:**
- [ ] Create `components/SubscriptionSettings.jsx`
- [ ] Display list of subscribed firms:
  - Firm logo + name
  - Subscribed date
  - Unsubscribe button per firm
- [ ] Empty state: "You're not subscribed to any firms yet" + link to `/propfirms`
- [ ] "Unsubscribe from all" button at bottom
- [ ] Add to existing `/settings` page (or `/dashboard/settings`)
- [ ] Test unsubscribe flow (confirm modal optional but nice)

**Reference:**
- See `alpha_scope_v3.md` lines 605-652 for full component code

**Dependencies:** TICKET-012

---

### TICKET-015: Email Delivery Integration
**Priority:** P0 (Blocker)
**Estimate:** 3 hours
**Owner:** Backend Dev

**Description:**
Integrate Resend for email delivery.

**Acceptance Criteria:**
- [ ] Verify `RESEND_API_KEY` exists in environment (already set up per CLAUDE.md)
- [ ] Create `lib/email/send-digest.js` with `sendWeeklyDigest(subscriber, report)` function
- [ ] Convert report JSON → HTML email using template (TICKET-011)
- [ ] Include unsubscribe link with token
- [ ] Send via Resend API
- [ ] Handle errors (log failures, mark as failed in database)
- [ ] Track sent emails (update `weekly_reports.emails_sent`)
- [ ] Test by sending to self

**Technical Notes:**
- Resend free tier: 3,000 emails/month (sufficient for Alpha)
- From address: `reports@propproof.com` (configure in Resend)
- Subject line: `[FirmName] Weekly Report - Week of [Date]`

**Dependencies:** TICKET-011

---

### TICKET-016: Weekly Digest Cron Job
**Priority:** P0 (Blocker)
**Estimate:** 2 hours
**Owner:** Backend Dev

**Description:**
Automate weekly report generation and delivery.

**Acceptance Criteria:**
- [ ] Create `app/api/cron/send-weekly-reports/route.js`
- [ ] Schedule: Every Monday at 8 AM UTC
- [ ] Logic:
  1. For each firm:
     - Generate report for previous week (Mon-Sun)
     - Fetch all subscribers
     - Send email to each subscriber
     - Update `last_sent_at` in `firm_subscriptions`
     - Update `emails_sent` in `weekly_reports`
  2. Log summary (emails sent, failures)
- [ ] Add to `vercel.json` cron config
- [ ] Test manual trigger (generate report for last week)
- [ ] Monitor first automated run

**Dependencies:** TICKET-010, TICKET-015

---

### TICKET-017: Beta Testing & Feedback
**Priority:** P1 (High)
**Estimate:** 4 hours
**Owner:** PM

**Description:**
Recruit beta testers and gather feedback.

**Acceptance Criteria:**
- [ ] Recruit 10-20 beta testers:
  - Reddit: Post in r/Forex, r/Daytrading (mods approval required)
  - Twitter: Tweet with signup form
  - Discord: Prop trading communities
- [ ] Send preview email with sample report
- [ ] Survey questions:
  - Is this valuable? (1-10)
  - Too long/short?
  - What's missing?
  - Would you open this every week?
  - What other data sources do you want? (Reddit, Twitter, etc.)
- [ ] Collect feedback in spreadsheet
- [ ] Prioritize top 3 requests for Beta

**Success Criteria:**
- 50+ beta signups
- Average rating: 7+/10
- At least 3 positive testimonials

---

### TICKET-018: Launch Announcement
**Priority:** P2 (Nice to have)
**Estimate:** 2 hours
**Owner:** PM

**Description:**
Public launch announcement.

**Acceptance Criteria:**
- [ ] Write Twitter thread:
  - Problem: Hard to track prop firm trustworthiness
  - Solution: Automated weekly intelligence reports
  - Features: Blockchain payouts + Trustpilot sentiment
  - CTA: Sign up and subscribe
- [ ] Post on Reddit (if mods allow):
  - r/Forex
  - r/Daytrading
  - r/PropFirmHub (if exists)
- [ ] Optional: ProductHunt launch (requires preparation)
- [ ] Monitor signups, subscriptions, feedback

---

## 🎯 Definition of Done (Alpha Release)

### Must Achieve:
- [ ] 150+ reviews scraped across 3 firms
- [ ] AI classification >80% accuracy (validated on 50 samples)
- [ ] 50+ total subscribers (across all firms)
- [ ] 4 automated weekly reports sent successfully (1 per week)
- [ ] 60%+ email open rate (vs 20-25% industry avg)
- [ ] 10%+ click-through rate (to firm pages)
- [ ] 0 critical bugs (scraper failures, failed email deliveries)
- [ ] All 18 tickets completed and tested

### Nice to Have:
- [ ] 100+ subscribers
- [ ] 70%+ open rate
- [ ] At least 1 user testimonial: "This helped me decide"
- [ ] Report shared on Reddit/Twitter organically
- [ ] 1+ firm reaches out about incident report

---

## 📊 Success Metrics (Track Weekly)

### Engagement:
- Subscriber count (by firm)
- Email open rate
- Click-through rate
- Unsubscribe rate

### Data Quality:
- Reviews scraped per day
- Classification accuracy (spot check 10/week)
- Scraper uptime (target: 95%+)

### User Feedback:
- Survey responses
- Reddit/Twitter mentions
- Support emails

---

## 🚨 Risk Mitigation

### Risk: Trustpilot blocks scraper
**Mitigation:**
- Use random delays (2-5 sec)
- Rotate user agents
- If blocked: Use Apify Trustpilot Actor ($49/month)

### Risk: AI classification inaccurate
**Mitigation:**
- Manual validation (TICKET-007)
- Confidence threshold (only publish >0.75)
- Show "AI-generated" disclaimer

### Risk: Low email engagement
**Mitigation:**
- A/B test subject lines
- Gather feedback from beta testers
- Keep reports <2 min read

---

## 💰 Budget

| Item | Cost | Justification |
|------|------|---------------|
| Supabase Pro | $25/mo | Already have |
| OpenAI API (GPT-4o-mini) | $5-10/mo | Ultra-cheap model |
| Resend | $0 | Free tier (3k emails/mo) |
| Vercel | $0 | Free tier includes cron |
| Playwright | $0 | Open source |
| **Total** | **$30-35/mo** | Validate before scaling |

---

## 📅 Timeline Summary

| Week | Tickets | Hours | Key Deliverable |
|------|---------|-------|-----------------|
| Week 1 | 001-004 | 20h | Scraper + Database ready |
| Week 2 | 005-008 | 16h | AI classification working |
| Week 3 | 009-011 | 12h | 3 polished reports validated |
| Week 4 | 012-018 | 16h | Live subscription system |
| **Total** | **18 tickets** | **64h** | **Alpha launched** |

---

## 🔄 Next Steps (Post-Alpha)

If Alpha succeeds (50+ subscribers, 60%+ open rate):
1. **Week 5-6:** Add Reddit scraping (PRAW)
2. **Week 7-8:** Add Twitter monitoring (apply for API during Alpha)
3. **Week 9-10:** Build report archive page (`/reports`)
4. **Week 11-12:** Build intelligence feed (`/intelligence`)

See `alpha_follow_tickets.md` for Beta expansion tickets.

---

**Ready to start Week 1? 🚀**
