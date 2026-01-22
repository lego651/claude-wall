# Strategic Product Roadmap: Feature-by-Feature Approach
**For Solo Founder + AI Agents | Focus: Affiliate Revenue from Prop Firms**

> **Core Strategy**: Build features that drive traffic → convert to affiliate clicks → generate revenue. Each feature should be independently useful but feed into the revenue engine.

> **Brand Persona**: "Average Trading Friend" - Not a guru, just a regular person using prop firms for side income. Honest, relatable, transparent. See [BRAND_POSITIONING.md](./BRAND_POSITIONING.md) for full brand strategy.

---

## 🎯 Strategic Principles

1. **Feature-by-Feature, Not Product-by-Product**: Build minimal viable features, not full products
2. **Content Marketing First**: Journal drives SEO + YouTube content → traffic → revenue
3. **Revenue Loop**: Traffic → Prop Firm Discovery → Affiliate Clicks → Revenue
4. **Incremental Value**: Each feature makes the platform more useful before launch
5. **Solo Founder Constraints**: Build what one person + AI can maintain
6. **"Average Trading Friend" Brand**: Honest, relatable, transparent - not a guru. This differentiates from competitors and builds trust.

---

## 📊 Current State Assessment

### ✅ What's Built
- Prop firm payout tracking (almost done)
- Trader profile pages (`/trader/[handle]`)
- Trading reports system (`/reports`)
- Basic prop firm directory structure

### 🎯 What's Needed
- Public trading journal (content marketing engine)
- More prop firm data (post-launch)
- Affiliate link integration
- SEO-optimized content pages

---

## 🚀 Feature Roadmap: Pre-Launch → Post-Launch

### **PHASE 1: Pre-Launch Foundation (Weeks 1-4)**

#### Feature 1.1: Public Trading Journal - Core Structure ⭐ **START HERE**
**Goal**: Create content marketing engine that drives organic traffic + establishes "Average Trading Friend" brand

**Minimal Viable Features:**
- [ ] Public journal page at `/journal/[username]` (or `/trader/[handle]/journal`)
- [ ] Weekly/monthly journal entries (markdown-based, like reports)
- [ ] Simple entry form: date, strategy, R-multiple, notes
- [ ] Public listing page: `/journal` showing all public journals
- [ ] Basic stats: total R, win rate, best/worst days
- [ ] SEO: meta tags, structured data, sitemap
- [ ] **Brand Voice**: Honest entries showing wins AND losses (not just wins)

**Why First?**
- Creates content for YouTube videos
- Drives organic search traffic
- Builds trust before asking for verification
- Low technical complexity (reuse reports infrastructure)
- **Establishes "Average Trading Friend" persona** (honest, relatable, not a guru)

**Success Criteria:**
- [ ] Can create 1 journal entry in < 5 minutes
- [ ] Journal page loads in < 2 seconds
- [ ] SEO-friendly URLs and meta tags
- [ ] Ready for YouTube content creation

**Time Estimate**: 3-5 days (solo + AI)

---

#### Feature 1.2: Journal → Prop Firm Connection
**Goal**: Link journal entries to prop firms (affiliate opportunity)

**Features:**
- [ ] In journal entry: "Trading with [Prop Firm Name]" field
- [ ] Clickable prop firm link → `/propfirm/[id]` (affiliate link)
- [ ] Journal sidebar: "Recommended Prop Firms" (affiliate links)
- [ ] Journal footer: "Find verified prop firms" CTA → prop firm directory
- [ ] **Brand Voice**: "I use this prop firm, here's my honest experience" (not sales copy)

**Why Second?**
- Creates natural affiliate link placement
- Doesn't feel like advertising (it's contextual)
- Builds internal linking for SEO
- **Aligns with "Average Trading Friend"**: Honest recommendations, not pushy sales

**Success Criteria:**
- [ ] Every journal entry can link to a prop firm
- [ ] Affiliate links are trackable
- [ ] Natural user flow: journal → prop firm discovery

**Time Estimate**: 2-3 days

---

#### Feature 1.3: Prop Firm Directory - Basic Listing
**Goal**: Make prop firms discoverable (affiliate revenue target)

**Features:**
- [ ] `/propfirms` page: list all firms with basic info
- [ ] `/propfirm/[id]` page: firm detail with affiliate link
- [ ] Basic filters: payout frequency, challenge type, price range
- [ ] "Verified Payouts" badge (if firm has payout data)
- [ ] Affiliate link: "Get Started" button → prop firm signup (tracked)
- [ ] **"My Experience" section**: Honest review from "Average Trading Friend" perspective
- [ ] **Transparency**: "I get a commission if you use my link, but I only recommend what I actually use"

**Why Third?**
- This is where revenue happens
- Journal drives traffic here
- Need this before launch
- **Differentiates from competitors**: Personal experience, not just data

**Success Criteria:**
- [ ] Can list 10+ prop firms
- [ ] Each firm has affiliate link
- [ ] Clear CTA: "Get Started" → affiliate link
- [ ] Mobile-friendly

**Time Estimate**: 4-5 days

---

### **PHASE 2: Launch Preparation (Weeks 5-6)**

#### Feature 2.1: SEO Content Pages
**Goal**: Drive organic traffic for prop firm discovery + establish brand voice

**Features:**
- [ ] `/best-prop-firms` - SEO landing page
- [ ] `/prop-firms-with-verified-payouts` - Trust signal page
- [ ] `/how-to-choose-prop-firm` - Educational content
- [ ] Blog posts: "Top 5 Prop Firms for Beginners" (affiliate links)
- [ ] Internal linking: journal → content → prop firms
- [ ] **Brand Voice**: "I tested these, here's what happened" (not "Best ever!")
- [ ] **Content Ideas**:
  - "How I Make $500/Month Trading Prop Firms (Not a Guru)"
  - "I Tested 3 Prop Firms - Only 1 Actually Paid Out"
  - "Side Income from Prop Firms: Realistic Expectations"

**Why Now?**
- Need content before launch
- SEO takes time to rank
- Creates multiple entry points
- **Establishes "Average Trading Friend" brand in search results**

**Success Criteria:**
- [ ] 5+ SEO-optimized content pages
- [ ] Each page has affiliate links
- [ ] Internal linking structure in place

**Time Estimate**: 3-4 days (mostly content, AI can help)

---

#### Feature 2.2: Launch Checklist
**Goal**: Ensure everything works before public launch

**Checklist:**
- [ ] All affiliate links working and tracked
- [ ] Analytics setup (Google Analytics, affiliate tracking)
- [ ] SEO: sitemap, robots.txt, meta tags
- [ ] Mobile responsive on all pages
- [ ] Basic error handling
- [ ] Performance: pages load < 3 seconds
- [ ] Legal: privacy policy, terms of service
- [ ] Social sharing: Open Graph tags

**Time Estimate**: 2-3 days

---

### **PHASE 3: Post-Launch Growth (Weeks 7-12)**

#### Feature 3.1: Enhanced Journal Features
**Goal**: Increase journal engagement and sharing

**Features:**
- [ ] Journal entry comments (optional, can skip if too complex)
- [ ] Journal sharing: Twitter, Reddit, Discord embeds
- [ ] Journal search: find journals by strategy, prop firm, R-multiple
- [ ] Journal leaderboard: "Top R This Month" (drives competition)

**Why After Launch?**
- Validate journal is useful first
- Add features based on user feedback
- Don't over-engineer before PMF

**Success Criteria:**
- [ ] Users share journals on social media
- [ ] Journal pages get organic traffic
- [ ] Journal → prop firm conversion rate > 2%

**Time Estimate**: 5-7 days (spread over weeks)

---

#### Feature 3.2: Prop Firm Comparison Tool
**Goal**: Help users choose (more affiliate opportunities)

**Features:**
- [ ] `/compare-prop-firms` page
- [ ] Select 2-3 firms to compare
- [ ] Side-by-side: rules, prices, payout data
- [ ] "Get Started" buttons for each firm (affiliate links)
- [ ] "Recommended for You" based on journal data
- [ ] **"My Experience" for each firm**: Honest pros/cons from personal use

**Why Now?**
- High-intent users (ready to sign up)
- Natural affiliate link placement
- Differentiates from competitors
- **Adds personal touch**: Not just data, but real experience

**Success Criteria:**
- [ ] Comparison tool used by 20%+ of visitors
- [ ] Conversion rate > 5% (comparison → signup)
- [ ] Mobile-friendly comparison view

**Time Estimate**: 4-5 days

---

#### Feature 3.3: Verified Trader Payouts (Product #2)
**Goal**: Extend verification beyond prop firms

**Features:**
- [ ] Individual trader payout verification (like product #1)
- [ ] Link to trader's journal
- [ ] "Verified Trader" badge on journal
- [ ] Trader leaderboard: "Top Verified Traders"
- [ ] Each verified trader → prop firm affiliate link

**Why Now?**
- Natural extension of product #1
- Creates more content (trader profiles)
- More affiliate opportunities

**Success Criteria:**
- [ ] 10+ verified traders in first month
- [ ] Verified traders share their profiles
- [ ] Trader profiles drive prop firm clicks

**Time Estimate**: 6-8 days

---

### **PHASE 4: Scale & Optimize (Months 4-6)**

#### Feature 4.1: Trading Tools Directory (Product #4 - Simplified)
**Goal**: Additional affiliate revenue from tools + test guru services

**Features:**
- [ ] `/tools` page: list trading tools (calculators, simulators, etc.)
- [ ] Tool categories: risk calculators, challenge simulators, journals
- [ ] Each tool: description, affiliate link, "Try Now" button
- [ ] **Tool reviews**: "I tested this, here's what happened" (honest, not sales copy)
- [ ] **Guru service reviews**: "I bought [Guru's Course], here's my honest review"
- [ ] Internal linking: journal → tools → prop firms

**Why Last?**
- Depends on traffic from products 1-3
- Lower priority than prop firms (main revenue)
- Can start with 5-10 tools, expand later
- **Perfect for "Average Trading Friend"**: Testing services and sharing honest reviews

**Success Criteria:**
- [ ] 10+ tools listed
- [ ] Tool pages get organic traffic
- [ ] Tool → affiliate conversion rate > 1%

**Time Estimate**: 4-5 days (mostly content)

---

#### Feature 4.2: Advanced Analytics
**Goal**: Optimize affiliate revenue

**Features:**
- [ ] Affiliate link click tracking
- [ ] Conversion funnel: journal → prop firm → signup
- [ ] Revenue dashboard: which prop firms convert best
- [ ] A/B testing: different CTAs, placements
- [ ] User behavior: heatmaps, scroll depth

**Why Now?**
- Need data to optimize
- Can't improve what you don't measure
- Focus on high-converting features

**Success Criteria:**
- [ ] Know which features drive revenue
- [ ] Can optimize affiliate placements
- [ ] Revenue per visitor increases 20%+

**Time Estimate**: 5-7 days

---

## 📈 Success Metrics by Phase

### Phase 1 (Pre-Launch)
- [ ] 5+ journal entries created
- [ ] 10+ prop firms listed with affiliate links
- [ ] All pages SEO-optimized
- [ ] Site loads < 3 seconds

### Phase 2 (Launch)
- [ ] 100+ monthly visitors (organic + social)
- [ ] 10+ affiliate clicks
- [ ] 1+ affiliate conversions
- [ ] Journal pages indexed by Google

### Phase 3 (Growth)
- [ ] 1,000+ monthly visitors
- [ ] 100+ affiliate clicks
- [ ] 5+ affiliate conversions
- [ ] 20+ journal entries
- [ ] 10+ verified traders

### Phase 4 (Scale)
- [ ] 5,000+ monthly visitors
- [ ] 500+ affiliate clicks
- [ ] 20+ affiliate conversions
- [ ] $500+ monthly revenue
- [ ] 50+ journal entries

---

## 🎯 Feature Prioritization Matrix

| Feature | Revenue Impact | Traffic Impact | Build Time | Priority |
|---------|---------------|----------------|------------|----------|
| Public Journal | Medium | **High** | 3-5 days | **P0** |
| Journal → Prop Firm Links | **High** | Medium | 2-3 days | **P0** |
| Prop Firm Directory | **High** | **High** | 4-5 days | **P0** |
| SEO Content Pages | Medium | **High** | 3-4 days | P1 |
| Comparison Tool | **High** | Low | 4-5 days | P1 |
| Verified Traders | Medium | Medium | 6-8 days | P2 |
| Tools Directory | Low | Low | 4-5 days | P3 |

**Build Order**: P0 → P1 → P2 → P3

---

## 💡 Key Strategic Decisions

### 1. **Journal First, Not Prop Firms**
**Why**: Journal creates content → YouTube videos → traffic → prop firm clicks
**Risk**: Lower initial revenue
**Mitigation**: Add prop firm links in journal entries (Feature 1.2)

### 2. **Feature-by-Feature, Not Full Products**
**Why**: Faster to market, easier to validate, less risk
**Risk**: May feel incomplete
**Mitigation**: Each feature is independently useful

### 3. **Affiliate Revenue Only (Initially)**
**Why**: No upfront costs, scales with traffic, aligns incentives
**Risk**: Lower margins than direct sales
**Mitigation**: Focus on high-converting placements

### 4. **SEO + Content Marketing Focus**
**Why**: Free traffic, compounds over time, solo founder friendly
**Risk**: Slow initial growth
**Mitigation**: Combine with social media (YouTube, Twitter)

---

## 🚦 Go/No-Go Criteria

### Move to Next Feature When:
- ✅ Current feature is "good enough" (not perfect)
- ✅ Feature is being used (even if by you initially)
- ✅ No critical bugs blocking usage
- ✅ Can create content (journal entries, YouTube videos)

### Don't Move Forward If:
- ❌ Feature is broken or unusable
- ❌ No clear path to revenue
- ❌ Takes > 2 weeks to build (break into smaller features)
- ❌ No way to validate (no users, no data)

---

## 📝 Implementation Notes

### For Solo Founder + AI:
1. **Use AI for Content**: Journal entries, SEO pages, tool descriptions
2. **Reuse Infrastructure**: Journal = reports system, prop firms = existing directory
3. **Start Simple**: Markdown files → database later if needed
4. **Track Everything**: Analytics, affiliate clicks, conversions
5. **Iterate Fast**: Launch Feature 1.1, get feedback, improve

### Technical Stack (Already in Place):
- Next.js 15 + React 19
- Supabase (for user data, if needed)
- Markdown (for journal entries, reports)
- Static files (for prop firm data initially)

### Affiliate Integration:
- Use affiliate link parameters: `?ref=propverified&source=journal`
- Track clicks: Google Analytics events
- Track conversions: Prop firm confirmation pages (if possible)
- Start with 2-3 prop firms, expand based on performance

---

## 🎬 Next Steps

1. **This Week**: Start Feature 1.1 (Public Trading Journal)
2. **Week 2**: Complete Features 1.1 + 1.2
3. **Week 3**: Build Feature 1.3 (Prop Firm Directory)
4. **Week 4**: SEO content + launch prep
5. **Week 5**: **LAUNCH** 🚀
6. **Week 6+**: Iterate based on data

---

## ❓ Questions to Answer Before Starting

1. **Affiliate Programs**: Which prop firms have affiliate programs? What are commission rates?
2. **Journal Privacy**: Public by default, or opt-in?
3. **Content Strategy**: How many journal entries before launch? Who creates them?
4. **YouTube Strategy**: What's the video format? How often?
5. **Competition**: How does this differentiate from payoutjunction.com?
6. **Brand Voice**: How will you maintain "Average Trading Friend" persona across all content?
7. **Small Paid Group**: What's the pricing? What's the value proposition? (Not a big community)

---

## 🎯 Brand Integration Checklist

### Every Feature Should:
- [ ] Use "Average Trading Friend" voice (not guru language)
- [ ] Show honest results (wins AND losses)
- [ ] Be transparent about affiliate links
- [ ] Focus on side income, not "get rich quick"
- [ ] Feel personal and relatable

### Content Examples:
- ✅ "I made $500 this month, here's how"
- ❌ "I'll show you how to make $10,000/month"
- ✅ "I tested this prop firm, here's my honest review"
- ❌ "Best prop firm ever!"
- ✅ "I lost money this week, here's what I learned"
- ❌ "Every trade is a winner!"

---

**Remember**: The goal is not to build 4 perfect products. The goal is to build features that drive traffic → affiliate clicks → revenue. Start small, validate, iterate.
