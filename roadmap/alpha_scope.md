# Alpha Release Scope & Strategy
## Product Requirements Document

**Document Version:** 1.0
**Date:** January 29, 2026
**Author:** Product Management
**Status:** Draft for Review

---

## Executive Summary

### Current State Analysis

**What We Have Built (Strong Foundation):**
- ✅ On-chain payout verification system (8 prop firms tracked)
- ✅ Firm leaderboard with time-window views (24h, 7d, 30d, 12m)
- ✅ Individual firm detail pages with charts & metrics
- ✅ Trader verification system (wallet-based)
- ✅ Trader leaderboard with trust scores
- ✅ Individual trader profiles with transaction history
- ✅ Real-time blockchain data sync (Supabase + Arbiscan)
- ✅ API infrastructure (/api/v2/propfirms, /api/trader, /api/leaderboard)
- ✅ Clean, modern UI (TailwindCSS v4 + DaisyUI v5)
- ✅ Authentication system (Supabase Auth)

**Key URLs Implemented:**
- `/propfirms` - Firm leaderboard
- `/propfirm/[id]` - Firm detail page
- `/leaderboard` - Trader leaderboard
- `/trader/[handle]` - Trader profile
- `/dashboard` - User dashboard
- `/connect-wallet` - Wallet connection flow

**Data Infrastructure:**
- 8 verified prop firms with blockchain addresses
- Payout data stored in Supabase (real-time queries)
- Historical aggregations cached in JSON files
- Trader profiles with linked wallets
- Transaction verification via Arbiscan API

---

## Consultant's Recommendation Analysis

### What the Consultant Proposed

**Three Intelligence Layers:**

1. **Firm Intelligence (Per Firm)**
   - Rule change history
   - Coupon/promotion tracking
   - Incident & operational event monitoring

2. **Social Intelligence (X/Twitter)**
   - Official firm announcements
   - Community discussion monitoring
   - Industry-wide trend detection
   - AI-powered classification & clustering

3. **Data Gathering Methods**
   - Reddit monitoring (r/Daytrading, r/Forex, etc.)
   - Trustpilot scraping
   - Forex Factory forums
   - Email campaign tracking
   - Website change detection

**Consultant's Implementation Approach:**
- Hybrid: AI-powered + selective scraping
- Perplexity API or OpenAI for intelligence gathering
- Python scraping scripts (PRAW for Reddit, Playwright for reviews)
- Cost: $15-30/month for 10 firms (AI approach)

### Tech Lead's Analysis (alpha.md)

**Key Points from Tech Lead:**
- "Going deep on 10 firms is WAY smarter than going wide with 50 mediocre listings"
- Recommended Option 1: AI-powered monitoring (fastest for Alpha)
- Suggested 3-phase approach:
  - **Phase 1 (Alpha):** Manual + semi-automated
  - **Phase 2 (Beta):** Basic automation
  - **Phase 3 (Post-Beta):** AI enhancement

**Tech Lead's Alpha Launch Checklist:**
- Must have: 10 firms with basic info + blockchain payout tracking ✅
- Must have: At least 3 firms with incident history (manual OK)
- Must have: At least 3 firms with active coupons (manual OK)
- Skip for Alpha: Full automation, AI summarization, historical data >30 days

---

## Strategic Analysis: Build vs. Pivot Decision

### The Fundamental Question

Should we:
1. **Continue the current direction** (payout transparency + blockchain verification)?
2. **Pivot to the consultant's vision** (firm intelligence + social monitoring)?
3. **Hybrid approach** (combine both)?

### Competitive Positioning Analysis

**Current Differentiator: On-Chain Payout Verification**
- ✅ **Unique moat:** No competitor has real-time blockchain verification
- ✅ **Trust advantage:** Immutable, verifiable data
- ✅ **Technical barrier:** Difficult to replicate
- ❌ **Limited audience:** Only traders who received payouts

**Consultant's Vision: Contextual Intelligence**
- ✅ **Broader appeal:** Helps ALL traders (pre-purchase decision)
- ✅ **Daily habit:** Monitoring rule changes, incidents, promotions
- ✅ **Competitive gap:** PayoutJunction lacks this depth
- ❌ **No moat:** Can be copied (data scraping is commoditized)
- ❌ **Maintenance burden:** Scrapers break, AI costs scale

### Product-Market Fit Considerations

**Who is our target user?**

**Scenario A: Funded Traders (Current Focus)**
- Already passed evaluation
- Received payouts via blockchain
- Want to verify firm legitimacy
- **Market size:** ~10,000-50,000 active funded traders globally

**Scenario B: Aspiring Traders (Consultant's Focus)**
- Researching which firm to join
- Comparing rules, prices, incidents
- Looking for discounts/promotions
- **Market size:** ~500,000-2M potential customers

**Insight:** Scenario B is 10-100x larger market, but Scenario A has defensible moat.

---

## Alpha Release Strategy: Recommended Approach

### Core Philosophy

> **"Depth over breadth. Verification over speculation."**

We should **NOT pivot away** from our blockchain verification core. Instead, we should **layer contextual intelligence ON TOP** of our verification foundation.

### Why This Hybrid Approach Wins

1. **Maintains our moat:** On-chain verification remains our unique differentiator
2. **Expands our TAM:** Contextual intelligence attracts pre-funded traders
3. **Compounds trust:** Verified payouts + verified incidents = maximum credibility
4. **Phased execution:** Can ship Alpha without full automation

---

## Alpha Release Scope (8-Week Timeline)

### North Star Metric for Alpha
**Goal:** Become the trusted source for 10 deeply-profiled prop firms, combining verified payout data with curated firm intelligence.

### Feature Prioritization Framework

**Tier 1: Must Have (Non-Negotiable)**
- Features critical to Alpha value proposition
- Cannot launch without these

**Tier 2: Should Have (High Value)**
- Significantly enhance user experience
- Can be simplified for Alpha

**Tier 3: Nice to Have (Future)**
- Valuable but not essential for initial launch
- Defer to Beta/V2

---

## Tier 1: Must Have for Alpha (Weeks 1-4)

### 1.1 Enhanced Firm Pages (Current + New)

**What we have:**
- ✅ Firm leaderboard
- ✅ Payout metrics (total, average, largest, count)
- ✅ Time-window charts (30d, 12m)
- ✅ Top 10 largest payouts
- ✅ Latest payouts feed

**What we need to add:**

#### A) Firm Profile Section
```
- Logo (already implemented)
- Name, website link (already implemented)
- NEW: Short description (1-2 sentences)
- NEW: Founded year
- NEW: Headquarters location
- NEW: Verification badge ("Blockchain Verified")
```

**Implementation:**
- Add fields to `firms` table in Supabase
- Create `data/firms/[firmId]/profile.json` for static data
- Update firm detail page UI

**Effort:** 4-6 hours

#### B) Rule Highlights Card
```
- Max drawdown (e.g., "5% daily, 10% total")
- Profit split (e.g., "80% to trader")
- Payout schedule (e.g., "Bi-weekly")
- Min trading days (e.g., "5 days")
- Scaling plan (e.g., "Up to $2M")
```

**Data Source:** Manual entry in JSON files (10 firms × 10 minutes = 1.7 hours)

**Implementation:**
- Create `data/firms/[firmId]/rules.json`
- Create `RuleHighlightsCard` component
- Add to firm detail page

**Effort:** 6-8 hours

#### C) Active Promotions Card (Manual Curation)
```
- Current discount code (if any)
- Discount percentage
- Expiration date
- Terms summary
- Source link
```

**Data Source:** Manual research (10 firms × 20 minutes = 3.3 hours initial, then weekly updates)

**Implementation:**
- Create `data/firms/[firmId]/promotions.json`
- Create `ActivePromotionsCard` component
- Add "Last updated" timestamp

**Effort:** 4-5 hours development + 3-4 hours data entry

**Total for 1.1:** ~15-20 hours development + 5 hours data entry

---

### 1.2 Firm Comparison Tool (New Feature)

**User Story:**
"As a trader evaluating multiple firms, I want to compare up to 3 firms side-by-side on key metrics (rules, payouts, fees) so I can make an informed decision."

**Scope:**
```
Compare up to 3 firms on:
- Payout split
- Drawdown rules
- Min trading days
- Challenge pricing
- Total payouts (30d, 12m)
- Average payout
- Latest payout date
- Active promotions
```

**UI/UX:**
- Checkbox selection on firm leaderboard
- Sticky "Compare (2)" button at bottom
- Modal/page with side-by-side comparison table
- Highlight differences (better = green, worse = red)

**Implementation:**
- Add `CompareButton` component to leaderboard
- Create `/compare?firms=fundednext,the5ers,fundingpips` route
- Build comparison table component
- Use existing firm data + new rules.json

**Effort:** 12-16 hours

---

### 1.3 Incident Tracking (Manual for Alpha)

**What to track:**
- Payout delays (official or reported)
- Platform outages
- Rule changes (major only)
- Scam warnings (if verified)

**Data Structure:**
```json
// data/firms/[firmId]/incidents.json
{
  "incidents": [
    {
      "id": "inc-001",
      "date": "2026-01-15",
      "type": "payout_delay",
      "severity": "medium",
      "title": "Payout delays reported (resolved)",
      "description": "Users reported 3-5 day delays...",
      "status": "resolved",
      "source": "https://reddit.com/r/Forex/...",
      "verificationLevel": "community_reported"
    }
  ]
}
```

**UI:**
- New "Incident History" section on firm page
- Timeline view (most recent first)
- Color-coded by severity (red/yellow/blue)
- Link to source
- "Resolved" vs "Ongoing" badges

**Implementation:**
- Create incident data schema
- Build `IncidentTimeline` component
- Add to firm detail page
- Manual data entry for 3 firms initially

**Effort:** 8-10 hours development + 2-3 hours initial data entry

---

### 1.4 Firm "Trust Score" Calculation (Automated)

**Inputs:**
- On-chain payout consistency (coefficient of variation)
- Incident count (weighted by severity)
- Time since last payout
- Total payouts vs. industry average
- Promotion frequency (too many = suspicious)

**Formula (simplified for Alpha):**
```
Base Score = 100

Deductions:
- Critical incident: -20 points each
- Medium incident: -10 points each
- No payouts in 30 days: -15 points
- High payout volatility: -5 points

Bonuses:
- Consistent payouts (CV < 0.3): +10 points
- Total payouts > $1M (30d): +5 points
```

**Display:**
- Large number (0-100) on firm card
- Color gradient (red < 60, yellow 60-79, green 80+)
- "What affects this score?" tooltip

**Implementation:**
- Create trust score calculation function
- Run nightly via cron job
- Store in `firms` table
- Display on firm cards & detail pages

**Effort:** 10-12 hours

---

### 1.5 Improved Trader Profiles (Current + Enhancements)

**What we have:**
- ✅ Wallet-based verification
- ✅ Transaction history
- ✅ Total verified payouts
- ✅ 30-day payout change
- ✅ Avatar, display name, handle

**What we need to add:**

#### A) Multi-Firm Breakdown
```
Show which firms paid this trader:
- Firm logo + name
- Number of payouts from this firm
- Total amount from this firm
- Most recent payout date
```

**Implementation:**
- Aggregate transactions by sender address
- Match to firms via `propfirms.json`
- Create `FirmBreakdownCard` component

**Effort:** 6-8 hours

#### B) Payout Frequency Stats
```
- Average days between payouts
- Longest gap between payouts
- Most active month
```

**Implementation:**
- Calculate from transaction timestamps
- Add to `MetricsCards` component

**Effort:** 4-5 hours

**Total for 1.5:** ~10-13 hours

---

### Tier 1 Summary: Must Have Features

| Feature | Development | Data Entry | Total |
|---------|------------|------------|-------|
| 1.1 Enhanced Firm Pages | 15-20h | 5h | 20-25h |
| 1.2 Firm Comparison Tool | 12-16h | 0h | 12-16h |
| 1.3 Incident Tracking | 8-10h | 3h | 11-13h |
| 1.4 Trust Score | 10-12h | 0h | 10-12h |
| 1.5 Improved Trader Profiles | 10-13h | 0h | 10-13h |
| **TOTAL** | **55-71h** | **8h** | **63-79h** |

**Timeline:** 4 weeks with 1 full-time developer (~160 hours available)

---

## Tier 2: Should Have for Alpha (Weeks 5-6)

### 2.1 Rule Change Detection (Semi-Automated)

**Approach:**
- Use ChangeDetection.io (free tool) to monitor firm T&C pages
- Receive email alerts when pages change
- Manual review & documentation
- Publish as "Rule Update" news item

**Implementation:**
- Set up ChangeDetection.io for 10 firms
- Create `data/firms/[firmId]/rule_history.json`
- Add "Rule Changes" tab to firm page
- Simple timeline UI

**Effort:** 6-8 hours + ongoing manual review (30 min/week)

---

### 2.2 Social Proof Signals

**Add to firm pages:**
- "X traders verified on PropProof"
- "Last payout: 2 hours ago"
- "Most active payout day: Wednesday"
- "Trending this week" badge (if payout count increased)

**Implementation:**
- Calculate from existing transaction data
- Add to firm card component
- Add animations for "live" feel

**Effort:** 4-6 hours

---

### 2.3 Email Alerts (For Registered Users)

**Alert triggers:**
- Firm you're watching had a new incident
- Firm you're watching has a new promotion
- Major rule change detected
- Trust score drops below 70

**Implementation:**
- Use Resend (already integrated per CLAUDE.md)
- Create alert preferences in user settings
- Nightly job to check conditions & send emails

**Effort:** 12-15 hours

---

### 2.4 Public API Documentation

**Expose existing endpoints:**
```
GET /api/v2/propfirms
GET /api/v2/propfirms/[id]
GET /api/leaderboard
GET /api/trader/[handle]
```

**Add:**
- Rate limiting (already implemented)
- API key authentication (optional for higher limits)
- Auto-generated docs (Swagger/OpenAPI)

**Implementation:**
- Create `/docs/api` page
- Add API key generation to user settings
- Document request/response schemas

**Effort:** 8-10 hours

---

### Tier 2 Summary: Should Have Features

| Feature | Effort |
|---------|--------|
| 2.1 Rule Change Detection | 6-8h |
| 2.2 Social Proof Signals | 4-6h |
| 2.3 Email Alerts | 12-15h |
| 2.4 Public API Docs | 8-10h |
| **TOTAL** | **30-39h** |

**Timeline:** 2 weeks (Weeks 5-6)

---

## Tier 3: Nice to Have (Defer to Beta)

### Deferred Features (Post-Alpha)

- Automated social media monitoring (X/Twitter scraping)
- Reddit/Trustpilot scraping bots
- AI-powered incident summarization
- Community incident reporting system
- Mobile app
- Advanced filtering on leaderboard
- Historical data >12 months
- Firm-to-firm messaging
- Affiliate program integration

**Rationale:** These add value but aren't essential to prove the core value proposition.

---

## Data Gathering Strategy for Alpha

### Manual Curation (Weeks 1-2)

**What to gather for 10 firms:**

1. **Firm Profiles** (1-2 hours total)
   - Company description
   - Founded year, HQ
   - Official website
   - Social media links

2. **Rule Highlights** (2-3 hours total)
   - Drawdown rules
   - Profit split
   - Min trading days
   - Payout schedule
   - Scaling plan
   - Source: Firm websites, terms pages

3. **Current Promotions** (2-3 hours total)
   - Check firm websites
   - Search Google for "[firm name] discount code"
   - Check Reddit r/Forex recent posts
   - Check affiliate sites

4. **Recent Incidents** (4-6 hours total - 3 firms only)
   - Search Reddit: "site:reddit.com [firm name] scam OR delayed OR problem"
   - Check Trustpilot recent reviews (1-2 star)
   - Check Forex Factory prop firm thread
   - Document 2-5 incidents per firm (if found)

**Total Data Gathering Time:** 10-14 hours

**Who does this?** Product manager or junior researcher

---

### Semi-Automated Monitoring (Weeks 3-8)

**Tools to set up:**

1. **ChangeDetection.io** (free)
   - Monitor 10 firm T&C pages
   - Email alerts on changes
   - Review time: 15 min/alert

2. **Google Alerts**
   - "[Firm Name] scam"
   - "[Firm Name] payout delay"
   - Review time: 10 min/day

3. **Reddit Saved Searches**
   - Create saved searches for each firm
   - Manual review 2x/week
   - Time: 30 min/week

**Ongoing Time Commitment:** ~3-4 hours/week

---

## Success Metrics for Alpha

### Quantitative Goals (8 Weeks Post-Launch)

**User Engagement:**
- 500+ unique visitors
- 100+ registered users
- 50+ wallet connections
- 20+ traders on leaderboard

**Content Depth:**
- 10 firms with complete profiles ✓
- 30+ documented incidents (across 3-5 firms)
- 10+ active promotions tracked
- 5+ documented rule changes

**Technical Performance:**
- 95%+ API uptime
- <2s page load time
- <5% error rate on blockchain sync

### Qualitative Goals

- Positive user feedback on trust scores
- Users citing our incident data in decisions
- At least 1 firm reaches out to correct/dispute incident
- Community sharing firm comparison tool

---

## Risk Assessment & Mitigation

### Risk 1: Manual Data Curation Doesn't Scale
**Probability:** High
**Impact:** Medium
**Mitigation:**
- Plan automation for Beta (weeks 9-16)
- Community contribution system (GitHub PRs for incidents)
- Start with 3 firms for incidents, expand gradually

### Risk 2: Firms Dispute Our Incident Reporting
**Probability:** Medium
**Impact:** Medium
**Mitigation:**
- Always cite sources (Reddit links, Trustpilot reviews)
- Label confidence levels ("community reported" vs "verified")
- Offer firms a "Response" field to provide their side
- Remove unverified claims if disputed

### Risk 3: Blockchain Data Sync Issues
**Probability:** Low
**Impact:** High
**Mitigation:**
- Already implemented (working well per codebase review)
- Monitor Arbiscan API uptime
- Fallback: manual transaction import tool

### Risk 4: Low User Adoption
**Probability:** Medium
**Impact:** High
**Mitigation:**
- Pre-launch: Share with r/Forex, r/Daytrading communities
- Offer early users free premium features (future)
- SEO optimization for "[firm name] review" keywords

---

## Development Roadmap (8-Week Sprint)

### Week 1-2: Foundation & Data
- [ ] Set up data structure (`firms/[id]/*.json` files)
- [ ] Gather firm profiles, rules, promotions (10 firms)
- [ ] Research incidents for 3 firms
- [ ] Design trust score formula
- [ ] Create `RuleHighlightsCard` component
- [ ] Create `ActivePromotionsCard` component

### Week 3-4: Core Features
- [ ] Build firm comparison tool
- [ ] Implement trust score calculation
- [ ] Build incident timeline component
- [ ] Enhance trader profiles (firm breakdown)
- [ ] Add social proof signals
- [ ] Testing & bug fixes

### Week 5-6: Polish & Automation
- [ ] Set up ChangeDetection.io monitoring
- [ ] Implement email alert system
- [ ] Create public API documentation
- [ ] Add more incidents (2 more firms)
- [ ] Performance optimization
- [ ] Mobile responsiveness check

### Week 7-8: Launch Prep & Marketing
- [ ] Beta user testing (10 users)
- [ ] Fix critical bugs
- [ ] Write launch blog post
- [ ] Prepare Reddit/Twitter announcements
- [ ] Set up analytics (PostHog/Mixpanel)
- [ ] Soft launch to community
- [ ] Gather feedback & iterate

---

## Post-Alpha: Beta Roadmap Preview (Weeks 9-16)

### Automation Layer
- Python scraping scripts (Reddit, Trustpilot)
- AI-powered incident classification (OpenAI/Perplexity)
- Automated rule change detection
- Scheduled jobs for data refresh

### Community Features
- User-submitted incidents (with verification queue)
- Upvote/downvote on incidents
- Comments on firm pages
- "Verified trader" badges (requires payout proof)

### Advanced Analytics
- Payout trend predictions
- Firm health score over time
- Industry benchmarks
- Custom alerts & saved searches

---

## Resource Requirements

### Development Team
- 1 Full-Stack Developer (8 weeks, full-time)
- 1 Product Manager (8 weeks, 25% time)
- 1 Designer (optional, 2 weeks part-time for polish)

### External Services
- Supabase (current plan sufficient)
- Arbiscan API (current plan sufficient)
- ChangeDetection.io (free tier)
- Resend email (existing integration)
- Vercel hosting (current plan sufficient)

### Estimated Costs
- Development: $0 (internal team)
- Services: ~$50/month (existing + ChangeDetection.io)
- Data gathering: 10-14 hours (PM time)
- **Total New Cost:** ~$600 for 8-week period

---

## Conclusion & Recommendation

### Strategic Decision

**Recommended Path:** Hybrid Approach (Blockchain Verification + Curated Intelligence)

**Rationale:**
1. Preserves our unique moat (on-chain verification)
2. Expands addressable market (pre-funded traders)
3. Achievable in 8 weeks with manual curation
4. Sets foundation for automation in Beta
5. Differentiated from PayoutJunction and competitors

### Alpha Launch Definition of Done

We are ready to launch Alpha when:
- ✅ 10 firms have complete profiles (rules, promotions, trust scores)
- ✅ 3+ firms have documented incident histories
- ✅ Firm comparison tool is functional
- ✅ Trader profiles show multi-firm breakdowns
- ✅ Trust scores are calculated and displayed
- ✅ Email alerts are working (for registered users)
- ✅ Public API is documented
- ✅ No critical bugs in core flows
- ✅ Mobile-responsive on key pages
- ✅ Analytics tracking is live

### Next Steps

1. **Approve this scope** (with any modifications)
2. **Assign development resources**
3. **Kick off Week 1 sprint** (data gathering + component builds)
4. **Set up weekly check-ins** (Monday progress review)
5. **Recruit 10 beta testers** (from Reddit, Twitter)

---

## Appendix A: Competitive Analysis

### PayoutJunction (Main Competitor)
**What they do well:**
- Large firm database
- Historical payout data
- User reviews

**What they lack:**
- No blockchain verification (trust issues)
- No incident tracking
- No rule comparison
- Outdated UI

**Our Alpha Advantage:**
- Blockchain proof (immutable trust)
- Incident transparency
- Rule comparison tool
- Modern UI/UX

### PropFirmMatch (Secondary Competitor)
**What they do well:**
- Firm comparison
- Quiz to match traders with firms

**What they lack:**
- No real payout verification
- No trader profiles
- No API

**Our Alpha Advantage:**
- All of the above

---

## Appendix B: Firm Selection Criteria (Initial 10)

**Firms to include in Alpha:**
1. ✅ FundingPips (already tracked)
2. ✅ InstantFunding (already tracked)
3. ✅ Blue Guardian (already tracked)
4. ✅ the5ers (already tracked)
5. ✅ Aqua Funded (already tracked)
6. ✅ Alpha Capital Group (already tracked)
7. ✅ FXIFY (already tracked)
8. ✅ Funded Next (already tracked)
9. **To add:** FTMO (largest firm, high demand)
10. **To add:** TopStepTrader (futures focus, different niche)

**Selection Criteria:**
- On-chain payout verification possible
- Active community discussion (data availability)
- Geographic diversity (US, EU, global)
- Size diversity (large established + newer firms)

---

## Appendix C: Data Schema Examples

### Firm Profile JSON
```json
// data/firms/fundednext/profile.json
{
  "id": "fundednext",
  "name": "Funded Next",
  "description": "A proprietary trading firm offering funded accounts for forex and crypto traders.",
  "founded": 2023,
  "headquarters": "Dubai, UAE",
  "website": "https://fundednext.com",
  "social": {
    "twitter": "FundedNext",
    "instagram": "fundednext",
    "discord": "fundednext"
  },
  "logo": "/logos/firms/fundednext.jpeg",
  "lastUpdated": "2026-01-29"
}
```

### Rules JSON
```json
// data/firms/fundednext/rules.json
{
  "firmId": "fundednext",
  "rules": {
    "profitSplit": "90% to trader (with add-ons)",
    "maxDrawdown": "5% daily, 10% total",
    "minTradingDays": "5 days",
    "payoutSchedule": "Every 14 days (bi-weekly)",
    "scalingPlan": "Up to $4M virtual capital",
    "challengePricing": {
      "10k": "$69 - $99",
      "25k": "$149 - $199",
      "50k": "$249 - $349",
      "100k": "$499 - $649"
    }
  },
  "source": "https://fundednext.com/rules",
  "lastUpdated": "2026-01-29"
}
```

### Promotions JSON
```json
// data/firms/fundednext/promotions.json
{
  "firmId": "fundednext",
  "activePromotions": [
    {
      "id": "promo-jan2026",
      "code": "NEWYEAR20",
      "discount": "20% off all challenges",
      "validFrom": "2026-01-01",
      "validUntil": "2026-01-31",
      "terms": "New accounts only. Cannot be combined with other offers.",
      "source": "https://fundednext.com/promotions",
      "verified": true,
      "lastChecked": "2026-01-29"
    }
  ]
}
```

### Incidents JSON
```json
// data/firms/fundednext/incidents.json
{
  "firmId": "fundednext",
  "incidents": [
    {
      "id": "inc-fn-001",
      "date": "2026-01-15",
      "type": "payout_delay",
      "severity": "medium",
      "title": "Payout delays reported by crypto payout users",
      "description": "Multiple users on Reddit reported 3-5 day delays on crypto payouts. Firm acknowledged issue was related to exchange liquidity. Resolved within 1 week.",
      "status": "resolved",
      "resolvedDate": "2026-01-22",
      "sources": [
        "https://reddit.com/r/Forex/comments/abc123",
        "https://trustpilot.com/reviews/xyz"
      ],
      "verificationLevel": "community_reported",
      "firmResponse": "We experienced temporary delays due to exchange maintenance. All payouts have been processed.",
      "impactedUsers": "~20-30 users (estimated)",
      "lastUpdated": "2026-01-29"
    }
  ]
}
```

---

**END OF DOCUMENT**

---

## Document Review & Approval

**Prepared by:** Product Management
**Review requested from:**
- [ ] Engineering Lead
- [ ] Consultant
- [ ] Stakeholders

**Expected approval date:** February 1, 2026
**Planned sprint start:** February 3, 2026
