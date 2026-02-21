# Sprint 8 Summary - Firm Intelligence Content Expansion

**Sprint Goal:** Design and implement a comprehensive backend architecture to support firm-related content beyond Trustpilot reviews, including company news, rule changes, promotions, and industry-wide news monitoring with AI-powered categorization and weekly email digest integration.

**Context:** Currently, the intelligence feed only monitors Trustpilot reviews for each firm. We need to expand this to include multiple data sources (firm emails, Discord announcements, Twitter, Reddit) and support industry-wide news that may not be directly tied to a specific firm in our watchlist.

**Story Points:** Based on Fibonacci scale (1, 2, 3, 5, 8, 13)

---

## Sprint 8 Goals

### Primary Objectives

1. **Multi-Source Content Architecture**
   - Design database schema to store firm content from multiple sources
   - Support manual content ingestion workflow via admin UI
   - Enable AI categorization and summarization pipeline

2. **Industry News Monitoring**
   - Track industry-wide events (even for firms not in our watchlist)
   - Categorize industry news vs. firm-specific updates
   - Include relevant industry news in weekly digest

3. **Content Type Support**
   - **Company News:** Firm emails, Discord announcements, blog posts
   - **Rule Changes:** Policy updates from firm communications
   - **Promotions:** Special offers, discounts, competitions
   - **Industry News:** Market-wide events, regulatory changes, firm scandals

4. **Admin Content Management**
   - Manual upload UI for screenshots, text, links
   - AI-powered categorization and summarization
   - Original source preservation (full text, images, links)

5. **Weekly Digest Integration**
   - Include new content types in existing weekly email
   - Separate sections for firm-specific vs. industry news
   - Maintain backward compatibility with Trustpilot incident feeds

---

## Key Design Decisions

### 1. Database Architecture

**New Tables:**
- `firm_content_items` - All firm-related content (news, rules, promotions)
- `industry_news_items` - Industry-wide news (may not be firm-specific)
- `content_sources` - Track ingestion sources (manual, scraper, API)

**Key Features:**
- AI-generated summaries stored alongside raw content
- Original source preservation (URLs, screenshots via cloud storage)
- Flexible categorization taxonomy (extensible for future types)
- Integration with existing `firm_profiles` and weekly digest pipeline

### 2. Manual Ingestion Workflow

**Phase 1 (Sprint 8):** Manual upload via admin UI
- Admin pastes screenshot/text/link
- AI categorizes and summarizes
- Admin reviews and approves before publishing

**Phase 2 (Future):** Semi-automated scraping
- Monitor firm Discord channels (via webhooks)
- Parse firm email newsletters
- Twitter/Reddit keyword monitoring

### 3. AI Processing Pipeline

**Content Processing Steps:**
1. **Extract:** Parse text from screenshot/paste (OCR if needed)
2. **Categorize:** Classify into news/rules/promotions/industry
3. **Summarize:** Generate 1-2 sentence summary
4. **Tag:** Identify affected firms (for industry news)
5. **Store:** Save raw + processed data

**AI Provider:** OpenAI GPT-4 (consistent with existing classifier)

### 4. Weekly Digest Updates

**Email Structure Changes:**
```
Subject: Weekly Prop Firm Digest - Week 8, 2026

[Intro]

=== INDUSTRY NEWS ===
• Apex Trading suspends payouts amid SEC investigation
• New UK regulation requires prop firms to be FCA registered
• CFTC issues warning about synthetic indices

=== YOUR WATCHED FIRMS ===

[FundingPips]
  - Trustpilot Incidents (existing)
  - Company News: "New instant payout feature launched"
  - Rule Changes: "Max drawdown reduced to 8% on all accounts"
  - Promotions: "20% off all challenges this week"

[FXIFY]
  - Trustpilot Incidents (existing)
  - Company News: "Partnership with TradingView announced"
```

---

## Technical Specifications

### Database Schema

#### 1. `firm_content_items` Table
Stores all firm-specific content (news, rules, promotions).

```sql
CREATE TABLE firm_content_items (
  id SERIAL PRIMARY KEY,
  firm_id TEXT NOT NULL REFERENCES firm_profiles(id) ON DELETE CASCADE,

  -- Content metadata
  content_type TEXT NOT NULL CHECK (content_type IN (
    'company_news',
    'rule_change',
    'promotion',
    'other'
  )),

  -- Raw content
  title TEXT NOT NULL,
  raw_content TEXT NOT NULL, -- Original text/paste
  source_url TEXT, -- If from URL
  source_type TEXT CHECK (source_type IN (
    'manual_upload',
    'firm_email',
    'discord',
    'twitter',
    'reddit',
    'blog',
    'other'
  )),

  -- AI processing
  ai_summary TEXT, -- 1-2 sentence AI summary
  ai_category TEXT, -- AI-assigned category (may differ from content_type)
  ai_confidence FLOAT CHECK (ai_confidence >= 0 AND ai_confidence <= 1),
  ai_tags TEXT[], -- e.g., ['payout', 'instant', 'feature']

  -- Attached media
  screenshot_url TEXT, -- Cloud storage URL for screenshots
  attachment_urls TEXT[], -- Additional files

  -- Publication control
  published BOOLEAN DEFAULT FALSE, -- Admin approval flag
  published_at TIMESTAMPTZ,

  -- Timestamps
  ingested_at TIMESTAMPTZ DEFAULT NOW(), -- When content was added
  content_date DATE NOT NULL, -- When content was published by firm

  -- Admin notes
  admin_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_firm_content_firm_date ON firm_content_items(firm_id, content_date DESC);
CREATE INDEX idx_firm_content_published ON firm_content_items(published, content_date DESC) WHERE published = true;
CREATE INDEX idx_firm_content_type ON firm_content_items(firm_id, content_type, content_date DESC);
```

#### 2. `industry_news_items` Table
Stores industry-wide news (not firm-specific, or affects multiple firms).

```sql
CREATE TABLE industry_news_items (
  id SERIAL PRIMARY KEY,

  -- Content metadata
  title TEXT NOT NULL,
  raw_content TEXT NOT NULL,
  source_url TEXT,
  source_type TEXT CHECK (source_type IN (
    'manual_upload',
    'news_website',
    'twitter',
    'reddit',
    'regulatory',
    'other'
  )),

  -- AI processing
  ai_summary TEXT,
  ai_category TEXT, -- e.g., 'regulation', 'firm_scandal', 'market_trend'
  ai_confidence FLOAT CHECK (ai_confidence >= 0 AND ai_confidence <= 1),
  ai_tags TEXT[],

  -- Firm associations (if industry news mentions specific firms)
  mentioned_firm_ids TEXT[], -- Array of firm IDs mentioned in the news

  -- Attached media
  screenshot_url TEXT,
  attachment_urls TEXT[],

  -- Publication control
  published BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMPTZ,

  -- Timestamps
  ingested_at TIMESTAMPTZ DEFAULT NOW(),
  content_date DATE NOT NULL, -- When news was published

  admin_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_industry_news_date ON industry_news_items(content_date DESC);
CREATE INDEX idx_industry_news_published ON industry_news_items(published, content_date DESC) WHERE published = true;
CREATE INDEX idx_industry_news_firms ON industry_news_items USING GIN(mentioned_firm_ids);
```

#### 3. `content_sources` Table (Optional - for tracking ingestion channels)
Tracks metadata about where content comes from.

```sql
CREATE TABLE content_sources (
  id SERIAL PRIMARY KEY,
  source_type TEXT NOT NULL UNIQUE, -- 'firm_email', 'discord', etc.
  is_active BOOLEAN DEFAULT TRUE,
  last_checked_at TIMESTAMPTZ,
  config_json JSONB, -- Source-specific config (e.g., Discord webhook URL)
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### API Endpoints

#### Admin Content Management

**1. Upload Firm Content**
```
POST /api/admin/content/firm
Auth: Admin required
Body: {
  firm_id: "fundingpips",
  content_type: "company_news",
  title: "New instant payout feature",
  raw_content: "Text from screenshot or paste...",
  source_url: "https://discord.com/...",
  source_type: "discord",
  screenshot_file: <File>, // Optional multipart upload
  content_date: "2026-02-21"
}

Response: {
  id: 123,
  ai_summary: "FundingPips launched instant payouts...",
  ai_category: "company_news",
  ai_confidence: 0.92,
  ai_tags: ["payout", "instant", "feature"],
  published: false, // Pending admin approval
  screenshot_url: "https://storage.../screenshot123.png"
}
```

**2. Upload Industry News**
```
POST /api/admin/content/industry
Auth: Admin required
Body: {
  title: "Apex Trading suspends payouts",
  raw_content: "Breaking news...",
  source_url: "https://twitter.com/...",
  source_type: "twitter",
  mentioned_firm_ids: ["apex"], // Optional
  content_date: "2026-02-20"
}

Response: {
  id: 456,
  ai_summary: "Apex Trading halted all payouts...",
  ai_category: "firm_scandal",
  mentioned_firm_ids: ["apex"],
  published: false
}
```

**3. Approve/Publish Content**
```
PATCH /api/admin/content/firm/:id
Auth: Admin required
Body: {
  published: true,
  admin_notes: "Verified with FundingPips Discord"
}
```

**4. List Content for Admin Review**
```
GET /api/admin/content/review
Auth: Admin required
Query: ?status=pending&limit=50

Response: {
  firm_content: [
    { id: 123, firm_id: "fundingpips", title: "...", published: false }
  ],
  industry_news: [
    { id: 456, title: "Apex scandal", published: false }
  ]
}
```

#### User-Facing APIs (for future UI pages)

**5. Get Firm Content Timeline**
```
GET /api/firms/:firmId/content
Query: ?type=company_news&limit=20

Response: {
  items: [
    {
      id: 123,
      content_type: "company_news",
      title: "New instant payout feature",
      ai_summary: "...",
      content_date: "2026-02-21",
      source_type: "discord"
    }
  ]
}
```

**6. Get Industry News**
```
GET /api/industry-news
Query: ?limit=20&mentioned_firm=fundingpips

Response: {
  items: [
    {
      id: 456,
      title: "UK regulation update",
      ai_summary: "...",
      mentioned_firm_ids: ["fundingpips", "fxify"]
    }
  ]
}
```

### AI Categorization Pipeline

**Service: `lib/ai/categorize-content.js`**

```javascript
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function categorizeContent(rawContent, metadata = {}) {
  const { source_type, title, firm_id } = metadata;

  const systemPrompt = `You are a prop firm content analyzer. Categorize and summarize content from prop trading firms.

Content Types:
- company_news: New features, partnerships, announcements
- rule_change: Changes to trading rules, account policies, terms
- promotion: Discounts, competitions, special offers
- industry_news: Industry-wide events not specific to one firm
- other: Doesn't fit above categories

Return JSON:
{
  "category": "company_news",
  "summary": "One sentence summary",
  "confidence": 0.9,
  "tags": ["payout", "instant"],
  "mentioned_firms": ["fundingpips", "apex"] // Only if industry news mentions multiple firms
}`;

  const userPrompt = `Title: ${title || 'N/A'}
Source: ${source_type || 'manual_upload'}
${firm_id ? `Firm: ${firm_id}` : 'Industry news (no specific firm)'}

Content:
${rawContent}

Categorize and summarize this content.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });

  const result = JSON.parse(response.choices[0].message.content);

  return {
    ai_category: result.category,
    ai_summary: result.summary,
    ai_confidence: result.confidence,
    ai_tags: result.tags || [],
    mentioned_firm_ids: result.mentioned_firms || [],
  };
}
```

### Weekly Digest Updates

**Updated: `lib/email/digest-builder.js`**

```javascript
export async function buildWeeklyDigest(userId, weekStart, weekEnd) {
  const supabase = createServiceClient();

  // Existing logic: Trustpilot incidents
  const { data: subscriptions } = await supabase
    .from('user_subscriptions')
    .select('firm_id')
    .eq('user_id', userId)
    .eq('email_enabled', true);

  const firmIds = subscriptions.map(s => s.firm_id);

  // NEW: Get firm content for subscribed firms
  const { data: firmContent } = await supabase
    .from('firm_content_items')
    .select('*')
    .in('firm_id', firmIds)
    .eq('published', true)
    .gte('content_date', weekStart)
    .lte('content_date', weekEnd)
    .order('content_date', { ascending: false });

  // NEW: Get industry news for the week
  const { data: industryNews } = await supabase
    .from('industry_news_items')
    .select('*')
    .eq('published', true)
    .gte('content_date', weekStart)
    .lte('content_date', weekEnd)
    .order('content_date', { ascending: false })
    .limit(10); // Top 10 industry news items

  // Group content by firm
  const contentByFirm = {};
  for (const item of firmContent || []) {
    if (!contentByFirm[item.firm_id]) {
      contentByFirm[item.firm_id] = {
        company_news: [],
        rule_change: [],
        promotion: [],
      };
    }
    contentByFirm[item.firm_id][item.content_type]?.push(item);
  }

  return {
    industryNews: industryNews || [],
    firmReports: firmIds.map(firmId => ({
      firmId,
      incidents: [], // Existing Trustpilot logic
      content: contentByFirm[firmId] || {},
    })),
  };
}
```

---

## Admin UI Design

### 1. Content Upload Page (`/admin/content/upload`)

**Components:**
- **Firm Selector:** Dropdown to select firm (or "Industry News" option)
- **Content Type Selector:** Radio buttons (News / Rule Change / Promotion)
- **Title Input:** Text field
- **Content Input:** Large textarea OR screenshot upload
- **Source Type:** Dropdown (Manual / Email / Discord / Twitter / Reddit)
- **Source URL:** Optional text field
- **Date Picker:** When content was published
- **Submit Button:** "Process with AI"

**Workflow:**
1. Admin pastes content or uploads screenshot
2. Clicks "Process with AI"
3. API calls AI categorization
4. Shows AI summary + confidence + tags
5. Admin reviews and clicks "Approve & Publish" or "Edit & Resubmit"

### 2. Content Review Queue (`/admin/content/review`)

**Table showing:**
- Pending content items (published = false)
- Columns: Date | Firm | Type | Title | AI Summary | Confidence | Actions
- Actions: Approve | Edit | Delete

**Filters:**
- Status: Pending / Published / All
- Firm: All / Specific firm
- Type: All / News / Rules / Promotions
- Date range

### 3. Published Content Archive (`/admin/content/published`)

**Table of published items with:**
- Search by title/summary
- Filter by firm, type, date
- Ability to unpublish or edit

---

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1)
- [ ] Database migrations (firm_content_items, industry_news_items)
- [ ] AI categorization service
- [ ] Admin upload API endpoints
- [ ] Basic admin UI for manual upload

### Phase 2: Review & Publishing (Week 1-2)
- [ ] Content review queue UI
- [ ] Approval workflow
- [ ] Screenshot upload to cloud storage (Vercel Blob or S3)

### Phase 3: Digest Integration (Week 2)
- [ ] Update weekly digest query to include firm content
- [ ] Update email template with new sections
- [ ] Test weekly digest with sample data

### Phase 4: Polish & Testing (Week 2)
- [ ] Admin UI polish (validation, error handling)
- [ ] End-to-end testing
- [ ] Documentation

---

## Success Metrics

**Sprint Completion Criteria:**
- [ ] Can manually upload firm content via admin UI
- [ ] AI categorizes and summarizes content with >85% accuracy
- [ ] Approved content appears in weekly digest
- [ ] Industry news section included in digest
- [ ] Original content preserved (screenshots, links)
- [ ] Admin can review and approve pending content

**Future Enhancements (Post-Sprint 8):**
- Semi-automated Discord monitoring
- Email newsletter parsing
- Twitter/Reddit keyword tracking
- User-facing firm timelines (public pages)
- Content analytics (most-viewed news, engagement)

---

## Dependencies & Risks

**Dependencies:**
- OpenAI API access (already in use for review classification)
- Cloud storage for screenshots (Vercel Blob or Cloudflare R2)
- Existing weekly digest pipeline (Sprint 6-7)

**Risks:**
- **Manual effort:** Phase 1 requires admin to manually upload content daily
  - *Mitigation:* Start with 1-2 firms, expand gradually
- **AI accuracy:** Categorization may misclassify content
  - *Mitigation:* Admin review step before publishing
- **Email bloat:** Too much content may overwhelm digest
  - *Mitigation:* Limit to top 3 items per category per firm

---

## Next Steps (Post-Sprint Review)

1. **Sprint 9:** Semi-automated content ingestion (Discord webhooks, email parsing)
2. **Sprint 10:** Public firm timelines and industry news page
3. **Sprint 11:** Twitter/Reddit monitoring with keyword alerts
4. **Sprint 12:** User-generated content (community tips, Q&A)

---

**Sprint Start Date:** 2026-02-22
**Estimated Completion:** 2026-03-01 (1-2 weeks)
**Tech Lead:** [Your Name]
**Total Story Points:** ~34 (detailed breakdown in s8_tickets.md)
