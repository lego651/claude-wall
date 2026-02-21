# Sprint 8 Tickets - Firm Intelligence Content Expansion

**Sprint Goal:** Implement backend architecture for multi-source firm content (news, rules, promotions) and industry news monitoring with AI categorization and weekly digest integration.

**Context:** Expand beyond Trustpilot reviews to support firm emails, Discord announcements, and industry-wide news. Manual ingestion workflow with AI processing in Sprint 8, semi-automated in future sprints.

**Story Points:** Based on Fibonacci scale (1, 2, 3, 5, 8, 13)

---

## Epic 1: Database Schema & Migrations

### TICKET-S8-001: Create firm_content_items Table 🔴 CRITICAL

**Status:** 🔲 Pending
**Priority:** P0 (Blocker)
**Story Points:** 3
**Assignee:** Database Engineer

**Description:**

Create `firm_content_items` table to store firm-specific content (company news, rule changes, promotions) from multiple sources.

**Acceptance Criteria:**

- [ ] Create migration `26_firm_content_items.sql`
- [ ] Table includes all fields from schema:
  - [ ] `id` (SERIAL PRIMARY KEY)
  - [ ] `firm_id` (TEXT, FK to firm_profiles)
  - [ ] `content_type` (TEXT CHECK)
  - [ ] `title`, `raw_content`, `source_url`, `source_type`
  - [ ] AI fields: `ai_summary`, `ai_category`, `ai_confidence`, `ai_tags`
  - [ ] `screenshot_url`, `attachment_urls`
  - [ ] `published`, `published_at`
  - [ ] `ingested_at`, `content_date`
  - [ ] `admin_notes`
- [ ] Create indexes:
  - [ ] `idx_firm_content_firm_date` on (firm_id, content_date DESC)
  - [ ] `idx_firm_content_published` on (published, content_date DESC) WHERE published = true
  - [ ] `idx_firm_content_type` on (firm_id, content_type, content_date DESC)
- [ ] Enable RLS with policies:
  - [ ] Public read for published content
  - [ ] Admin-only write
- [ ] Add updated_at trigger

**Migration SQL:**

```sql
-- migrations/26_firm_content_items.sql

CREATE TABLE IF NOT EXISTS firm_content_items (
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
  raw_content TEXT NOT NULL,
  source_url TEXT,
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
  ai_summary TEXT,
  ai_category TEXT,
  ai_confidence FLOAT CHECK (ai_confidence >= 0 AND ai_confidence <= 1),
  ai_tags TEXT[],

  -- Attached media
  screenshot_url TEXT,
  attachment_urls TEXT[],

  -- Publication control
  published BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMPTZ,

  -- Timestamps
  ingested_at TIMESTAMPTZ DEFAULT NOW(),
  content_date DATE NOT NULL,

  -- Admin notes
  admin_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_firm_content_firm_date ON firm_content_items(firm_id, content_date DESC);
CREATE INDEX idx_firm_content_published ON firm_content_items(published, content_date DESC) WHERE published = true;
CREATE INDEX idx_firm_content_type ON firm_content_items(firm_id, content_type, content_date DESC);

-- RLS
ALTER TABLE firm_content_items ENABLE ROW LEVEL SECURITY;

-- Public can read published content
DROP POLICY IF EXISTS "Anyone can view published firm content" ON firm_content_items;
CREATE POLICY "Anyone can view published firm content"
  ON firm_content_items
  FOR SELECT
  USING (published = true);

-- Admins can do everything
DROP POLICY IF EXISTS "Admins can manage firm content" ON firm_content_items;
CREATE POLICY "Admins can manage firm content"
  ON firm_content_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_firm_content_items_updated_at ON firm_content_items;
CREATE TRIGGER update_firm_content_items_updated_at
  BEFORE UPDATE ON firm_content_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**Testing:**

```sql
-- Test insert
INSERT INTO firm_content_items (firm_id, content_type, title, raw_content, content_date)
VALUES ('fundingpips', 'company_news', 'Test News', 'Test content', '2026-02-21');

-- Test query with published filter
SELECT * FROM firm_content_items WHERE published = true;

-- Verify indexes
\d firm_content_items
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'firm_content_items';
```

**Dependencies:** None (blocking ticket)

**Files Changed:**
- `migrations/26_firm_content_items.sql` (new)

---

### TICKET-S8-002: Create industry_news_items Table 🔴 CRITICAL

**Status:** 🔲 Pending
**Priority:** P0 (Blocker)
**Story Points:** 3
**Assignee:** Database Engineer

**Description:**

Create `industry_news_items` table to store industry-wide news (not firm-specific, or affects multiple firms).

**Acceptance Criteria:**

- [ ] Create migration `27_industry_news_items.sql`
- [ ] Table includes all fields from schema:
  - [ ] `id`, `title`, `raw_content`, `source_url`, `source_type`
  - [ ] AI fields: `ai_summary`, `ai_category`, `ai_confidence`, `ai_tags`
  - [ ] `mentioned_firm_ids` (TEXT[]) for firm associations
  - [ ] `screenshot_url`, `attachment_urls`
  - [ ] `published`, `published_at`
  - [ ] `ingested_at`, `content_date`
  - [ ] `admin_notes`
- [ ] Create indexes:
  - [ ] `idx_industry_news_date` on (content_date DESC)
  - [ ] `idx_industry_news_published` on (published, content_date DESC) WHERE published = true
  - [ ] `idx_industry_news_firms` GIN index on (mentioned_firm_ids)
- [ ] Enable RLS with same policies as firm_content_items

**Migration SQL:**

```sql
-- migrations/27_industry_news_items.sql

CREATE TABLE IF NOT EXISTS industry_news_items (
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
  ai_category TEXT,
  ai_confidence FLOAT CHECK (ai_confidence >= 0 AND ai_confidence <= 1),
  ai_tags TEXT[],

  -- Firm associations
  mentioned_firm_ids TEXT[],

  -- Attached media
  screenshot_url TEXT,
  attachment_urls TEXT[],

  -- Publication control
  published BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMPTZ,

  -- Timestamps
  ingested_at TIMESTAMPTZ DEFAULT NOW(),
  content_date DATE NOT NULL,

  admin_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_industry_news_date ON industry_news_items(content_date DESC);
CREATE INDEX idx_industry_news_published ON industry_news_items(published, content_date DESC) WHERE published = true;
CREATE INDEX idx_industry_news_firms ON industry_news_items USING GIN(mentioned_firm_ids);

-- RLS
ALTER TABLE industry_news_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view published industry news" ON industry_news_items;
CREATE POLICY "Anyone can view published industry news"
  ON industry_news_items
  FOR SELECT
  USING (published = true);

DROP POLICY IF EXISTS "Admins can manage industry news" ON industry_news_items;
CREATE POLICY "Admins can manage industry news"
  ON industry_news_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

DROP TRIGGER IF EXISTS update_industry_news_items_updated_at ON industry_news_items;
CREATE TRIGGER update_industry_news_items_updated_at
  BEFORE UPDATE ON industry_news_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**Testing:**

```sql
-- Test insert with firm mentions
INSERT INTO industry_news_items (title, raw_content, content_date, mentioned_firm_ids)
VALUES (
  'UK regulation update',
  'FCA requires prop firms to register...',
  '2026-02-20',
  ARRAY['fundingpips', 'fxify']
);

-- Test GIN index query
SELECT * FROM industry_news_items WHERE 'fundingpips' = ANY(mentioned_firm_ids);
```

**Dependencies:** None (blocking ticket)

**Files Changed:**
- `migrations/27_industry_news_items.sql` (new)

---

## Epic 2: AI Categorization Service

### TICKET-S8-003: Implement AI Content Categorization Service 🔴 CRITICAL

**Status:** 🔲 Pending
**Priority:** P0 (Blocker)
**Story Points:** 5
**Assignee:** Backend Engineer

**Description:**

Create AI service to categorize and summarize firm content and industry news using OpenAI GPT-4o-mini.

**Acceptance Criteria:**

- [ ] Create `lib/ai/categorize-content.js` service
- [ ] Function: `categorizeContent(rawContent, metadata)` returns:
  - [ ] `ai_category` (company_news, rule_change, promotion, etc.)
  - [ ] `ai_summary` (1-2 sentence summary)
  - [ ] `ai_confidence` (0.0 - 1.0)
  - [ ] `ai_tags` (array of keywords)
  - [ ] `mentioned_firm_ids` (for industry news)
- [ ] Use GPT-4o-mini model (cost-effective for high volume)
- [ ] JSON response format enforced
- [ ] Temperature = 0.3 (deterministic)
- [ ] Handle OpenAI API errors gracefully
- [ ] Log API usage for monitoring

**Implementation:**

```javascript
// lib/ai/categorize-content.js

import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are a prop trading firm content analyzer. Categorize and summarize content from prop trading firms.

CONTENT TYPES:
- company_news: New features, partnerships, announcements, platform updates
- rule_change: Changes to trading rules, account policies, terms of service, drawdown limits
- promotion: Discounts, competitions, special offers, affiliate bonuses
- industry_news: Industry-wide events, regulations, scandals not specific to one firm
- other: Doesn't fit above categories

FIRM NAMES (for industry news):
fundingpips, fxify, fundednext, the5ers, instantfunding, blueguardian, aquafunded, alphacapitalgroup, ftmo, topstep, apex

INSTRUCTIONS:
1. Read the content carefully
2. Identify the category (pick ONE)
3. Write a concise 1-2 sentence summary
4. Extract 3-5 relevant tags (lowercase, single words)
5. If industry news, identify which firms are mentioned

RETURN JSON:
{
  "category": "company_news",
  "summary": "One to two sentence summary of the content",
  "confidence": 0.9,
  "tags": ["payout", "instant", "feature"],
  "mentioned_firms": ["fundingpips", "apex"]
}

EXAMPLES:

Input: "We're excited to announce instant payouts! Now you can withdraw within 1 hour."
Output: {
  "category": "company_news",
  "summary": "Firm launched instant payout feature allowing withdrawals within 1 hour.",
  "confidence": 0.95,
  "tags": ["payout", "instant", "withdrawal"],
  "mentioned_firms": []
}

Input: "Effective March 1st, max drawdown reduced from 10% to 8% on all accounts."
Output: {
  "category": "rule_change",
  "summary": "Maximum drawdown limit reduced from 10% to 8% starting March 1st.",
  "confidence": 0.98,
  "tags": ["drawdown", "rules", "limit"],
  "mentioned_firms": []
}

Input: "20% off all challenges this week! Use code SPRING20 at checkout."
Output: {
  "category": "promotion",
  "summary": "Limited-time 20% discount on all challenges with code SPRING20.",
  "confidence": 0.97,
  "tags": ["discount", "promotion", "sale"],
  "mentioned_firms": []
}

Input: "Breaking: Apex Trading suspends all payouts amid SEC investigation. FundingPips users unaffected."
Output: {
  "category": "industry_news",
  "summary": "Apex Trading halted payouts due to SEC investigation; FundingPips not impacted.",
  "confidence": 0.93,
  "tags": ["sec", "investigation", "payout", "suspension"],
  "mentioned_firms": ["apex", "fundingpips"]
}`;

/**
 * Categorize and summarize content using AI.
 * @param {string} rawContent - The raw text content to categorize
 * @param {object} metadata - Additional context (title, source_type, firm_id)
 * @returns {Promise<object>} { ai_category, ai_summary, ai_confidence, ai_tags, mentioned_firm_ids }
 */
export async function categorizeContent(rawContent, metadata = {}) {
  if (!rawContent?.trim()) {
    throw new Error('Raw content is required');
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error('[AI Categorize] Missing OPENAI_API_KEY');
    throw new Error('OpenAI API key not configured');
  }

  const { title, source_type, firm_id } = metadata;

  const userPrompt = [
    title && `Title: ${title}`,
    source_type && `Source: ${source_type}`,
    firm_id ? `Firm: ${firm_id}` : 'Industry news (no specific firm)',
    '',
    'Content:',
    rawContent,
  ].filter(Boolean).join('\n');

  try {
    console.log('[AI Categorize] Processing content:', {
      contentLength: rawContent.length,
      title: title || 'N/A',
      firm_id: firm_id || 'industry',
    });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const content = response.choices[0].message.content;
    const result = JSON.parse(content);

    console.log('[AI Categorize] Result:', {
      category: result.category,
      confidence: result.confidence,
      tags: result.tags,
      mentioned_firms: result.mentioned_firms,
    });

    return {
      ai_category: result.category || 'other',
      ai_summary: result.summary || '',
      ai_confidence: result.confidence || 0.5,
      ai_tags: Array.isArray(result.tags) ? result.tags : [],
      mentioned_firm_ids: Array.isArray(result.mentioned_firms) ? result.mentioned_firms : [],
    };
  } catch (error) {
    console.error('[AI Categorize] Error:', error);

    if (error.code === 'insufficient_quota') {
      throw new Error('OpenAI API quota exceeded');
    }

    if (error.status === 429) {
      throw new Error('OpenAI rate limit exceeded');
    }

    throw new Error(`AI categorization failed: ${error.message}`);
  }
}
```

**Testing:**

```javascript
// Test categorization service
import { categorizeContent } from '@/lib/ai/categorize-content';

// Test 1: Company news
const result1 = await categorizeContent(
  'We are excited to announce instant payouts! Now you can withdraw within 1 hour.',
  { title: 'Instant Payouts', source_type: 'discord', firm_id: 'fundingpips' }
);
console.log(result1);
// Expected: { ai_category: 'company_news', ai_summary: '...', ai_confidence: 0.9+, ai_tags: ['payout', 'instant'] }

// Test 2: Rule change
const result2 = await categorizeContent(
  'Effective March 1st, max drawdown reduced from 10% to 8%.',
  { title: 'Drawdown Update', source_type: 'email', firm_id: 'fxify' }
);
console.log(result2);
// Expected: { ai_category: 'rule_change', ... }

// Test 3: Industry news
const result3 = await categorizeContent(
  'Breaking: Apex Trading suspends payouts amid SEC investigation.',
  { title: 'Apex Scandal', source_type: 'twitter' }
);
console.log(result3);
// Expected: { ai_category: 'industry_news', mentioned_firm_ids: ['apex'] }
```

**Unit Tests:**

```javascript
// lib/ai/__tests__/categorize-content.test.js

import { categorizeContent } from '../categorize-content';

describe('categorizeContent', () => {
  it('categorizes company news correctly', async () => {
    const result = await categorizeContent('New instant payout feature', {
      firm_id: 'fundingpips',
    });
    expect(result.ai_category).toMatch(/company_news|promotion/);
    expect(result.ai_summary).toBeTruthy();
    expect(result.ai_confidence).toBeGreaterThan(0.5);
  });

  it('throws error for missing content', async () => {
    await expect(categorizeContent('')).rejects.toThrow('required');
  });

  it('extracts mentioned firms for industry news', async () => {
    const result = await categorizeContent(
      'Apex and FundingPips both updated their policies.',
      {}
    );
    expect(result.mentioned_firm_ids).toEqual(
      expect.arrayContaining(['apex', 'fundingpips'])
    );
  });
});
```

**Dependencies:**
- TICKET-S8-001 (database schema)

**Files Changed:**
- `lib/ai/categorize-content.js` (new)
- `lib/ai/__tests__/categorize-content.test.js` (new)

---

## Epic 3: Admin API Endpoints

### TICKET-S8-004: Implement Firm Content Upload API 🔴 CRITICAL

**Status:** 🔲 Pending
**Priority:** P0 (Blocker)
**Story Points:** 5
**Assignee:** Backend Engineer

**Description:**

Create API endpoint for admins to upload firm content with AI categorization.

**Acceptance Criteria:**

- [ ] Create `app/api/admin/content/firm/route.js`
- [ ] POST endpoint accepts:
  - [ ] `firm_id`, `content_type`, `title`, `raw_content`
  - [ ] `source_url`, `source_type`, `content_date`
  - [ ] Optional: `screenshot_file` (multipart upload)
- [ ] Authenticate admin with `is_admin` check
- [ ] Call `categorizeContent()` for AI processing
- [ ] Upload screenshot to Vercel Blob (if provided)
- [ ] Insert into `firm_content_items` with `published = false`
- [ ] Return AI results for admin review
- [ ] Handle errors: missing fields, invalid firm_id, AI failure

**Implementation:**

```javascript
// app/api/admin/content/firm/route.js

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { categorizeContent } from '@/lib/ai/categorize-content';
import { put } from '@vercel/blob';

export async function POST(req) {
  // 1. Authenticate admin
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 2. Parse request body
  const contentType = req.headers.get('content-type') || '';
  let body;

  if (contentType.includes('multipart/form-data')) {
    // Handle file upload
    const formData = await req.formData();
    body = {
      firm_id: formData.get('firm_id'),
      content_type: formData.get('content_type'),
      title: formData.get('title'),
      raw_content: formData.get('raw_content'),
      source_url: formData.get('source_url'),
      source_type: formData.get('source_type') || 'manual_upload',
      content_date: formData.get('content_date'),
      screenshot_file: formData.get('screenshot_file'),
    };
  } else {
    body = await req.json();
  }

  // 3. Validate required fields
  const { firm_id, content_type, title, raw_content, content_date } = body;

  if (!firm_id || !content_type || !title || !raw_content || !content_date) {
    return NextResponse.json({
      error: 'Missing required fields: firm_id, content_type, title, raw_content, content_date',
    }, { status: 400 });
  }

  const validTypes = ['company_news', 'rule_change', 'promotion', 'other'];
  if (!validTypes.includes(content_type)) {
    return NextResponse.json({
      error: `Invalid content_type. Must be one of: ${validTypes.join(', ')}`,
    }, { status: 400 });
  }

  // 4. Verify firm exists
  const { data: firm } = await supabase
    .from('firm_profiles')
    .select('id')
    .eq('id', firm_id)
    .single();

  if (!firm) {
    return NextResponse.json({ error: `Firm not found: ${firm_id}` }, { status: 404 });
  }

  // 5. Upload screenshot (if provided)
  let screenshot_url = null;
  if (body.screenshot_file && body.screenshot_file instanceof File) {
    try {
      const blob = await put(
        `screenshots/${firm_id}/${Date.now()}-${body.screenshot_file.name}`,
        body.screenshot_file,
        { access: 'public' }
      );
      screenshot_url = blob.url;
    } catch (uploadError) {
      console.error('[Firm Content Upload] Screenshot upload failed:', uploadError);
      return NextResponse.json({
        error: 'Screenshot upload failed',
        details: uploadError.message,
      }, { status: 500 });
    }
  }

  // 6. AI categorization
  let aiResult;
  try {
    aiResult = await categorizeContent(raw_content, {
      title,
      source_type: body.source_type,
      firm_id,
    });
  } catch (aiError) {
    console.error('[Firm Content Upload] AI categorization failed:', aiError);
    return NextResponse.json({
      error: 'AI categorization failed',
      details: aiError.message,
    }, { status: 500 });
  }

  // 7. Insert into database
  const serviceClient = createServiceClient();
  const { data: insertedItem, error: insertError } = await serviceClient
    .from('firm_content_items')
    .insert({
      firm_id,
      content_type,
      title,
      raw_content,
      source_url: body.source_url || null,
      source_type: body.source_type || 'manual_upload',
      ai_summary: aiResult.ai_summary,
      ai_category: aiResult.ai_category,
      ai_confidence: aiResult.ai_confidence,
      ai_tags: aiResult.ai_tags,
      screenshot_url,
      content_date,
      published: false, // Pending admin approval
      ingested_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertError) {
    console.error('[Firm Content Upload] Database insert failed:', insertError);
    return NextResponse.json({
      error: 'Database insert failed',
      details: insertError.message,
    }, { status: 500 });
  }

  console.log('[Firm Content Upload] Success:', {
    id: insertedItem.id,
    firm_id,
    content_type,
    ai_category: aiResult.ai_category,
  });

  return NextResponse.json({
    success: true,
    item: {
      id: insertedItem.id,
      firm_id: insertedItem.firm_id,
      content_type: insertedItem.content_type,
      title: insertedItem.title,
      ai_summary: insertedItem.ai_summary,
      ai_category: insertedItem.ai_category,
      ai_confidence: insertedItem.ai_confidence,
      ai_tags: insertedItem.ai_tags,
      screenshot_url: insertedItem.screenshot_url,
      published: insertedItem.published,
      created_at: insertedItem.created_at,
    },
  });
}
```

**Testing:**

```bash
# Test upload without screenshot
curl -X POST http://localhost:3000/api/admin/content/firm \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "firm_id": "fundingpips",
    "content_type": "company_news",
    "title": "Instant Payouts",
    "raw_content": "We launched instant payouts today!",
    "source_type": "discord",
    "source_url": "https://discord.com/...",
    "content_date": "2026-02-21"
  }'

# Test upload with screenshot (multipart)
# (Use Postman or similar for multipart testing)
```

**Dependencies:**
- TICKET-S8-001 (database schema)
- TICKET-S8-003 (AI service)

**Files Changed:**
- `app/api/admin/content/firm/route.js` (new)
- `app/api/admin/content/firm/route.test.js` (new unit tests)

---

### TICKET-S8-005: Implement Industry News Upload API 🔴 CRITICAL

**Status:** 🔲 Pending
**Priority:** P0 (Blocker)
**Story Points:** 3
**Assignee:** Backend Engineer

**Description:**

Create API endpoint for uploading industry-wide news (similar to S8-004 but for `industry_news_items` table).

**Acceptance Criteria:**

- [ ] Create `app/api/admin/content/industry/route.js`
- [ ] POST endpoint accepts:
  - [ ] `title`, `raw_content`, `source_url`, `source_type`, `content_date`
  - [ ] Optional: `screenshot_file`
- [ ] Authenticate admin
- [ ] Call `categorizeContent()` (AI extracts `mentioned_firm_ids`)
- [ ] Insert into `industry_news_items` with `published = false`
- [ ] Return AI results

**Implementation:**

```javascript
// app/api/admin/content/industry/route.js

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { categorizeContent } from '@/lib/ai/categorize-content';
import { put } from '@vercel/blob';

export async function POST(req) {
  // (Same auth logic as S8-004)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Parse body
  const contentType = req.headers.get('content-type') || '';
  let body;
  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData();
    body = {
      title: formData.get('title'),
      raw_content: formData.get('raw_content'),
      source_url: formData.get('source_url'),
      source_type: formData.get('source_type') || 'manual_upload',
      content_date: formData.get('content_date'),
      screenshot_file: formData.get('screenshot_file'),
    };
  } else {
    body = await req.json();
  }

  const { title, raw_content, content_date } = body;
  if (!title || !raw_content || !content_date) {
    return NextResponse.json({
      error: 'Missing required fields: title, raw_content, content_date',
    }, { status: 400 });
  }

  // Upload screenshot (if provided)
  let screenshot_url = null;
  if (body.screenshot_file && body.screenshot_file instanceof File) {
    try {
      const blob = await put(
        `screenshots/industry/${Date.now()}-${body.screenshot_file.name}`,
        body.screenshot_file,
        { access: 'public' }
      );
      screenshot_url = blob.url;
    } catch (uploadError) {
      return NextResponse.json({
        error: 'Screenshot upload failed',
        details: uploadError.message,
      }, { status: 500 });
    }
  }

  // AI categorization (extracts mentioned firms)
  let aiResult;
  try {
    aiResult = await categorizeContent(raw_content, {
      title,
      source_type: body.source_type,
      // No firm_id for industry news
    });
  } catch (aiError) {
    return NextResponse.json({
      error: 'AI categorization failed',
      details: aiError.message,
    }, { status: 500 });
  }

  // Insert into database
  const serviceClient = createServiceClient();
  const { data: insertedItem, error: insertError } = await serviceClient
    .from('industry_news_items')
    .insert({
      title,
      raw_content,
      source_url: body.source_url || null,
      source_type: body.source_type || 'manual_upload',
      ai_summary: aiResult.ai_summary,
      ai_category: aiResult.ai_category,
      ai_confidence: aiResult.ai_confidence,
      ai_tags: aiResult.ai_tags,
      mentioned_firm_ids: aiResult.mentioned_firm_ids || [],
      screenshot_url,
      content_date,
      published: false,
      ingested_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({
      error: 'Database insert failed',
      details: insertError.message,
    }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    item: {
      id: insertedItem.id,
      title: insertedItem.title,
      ai_summary: insertedItem.ai_summary,
      ai_category: insertedItem.ai_category,
      ai_confidence: insertedItem.ai_confidence,
      mentioned_firm_ids: insertedItem.mentioned_firm_ids,
      screenshot_url: insertedItem.screenshot_url,
      published: insertedItem.published,
      created_at: insertedItem.created_at,
    },
  });
}
```

**Testing:**

```bash
curl -X POST http://localhost:3000/api/admin/content/industry \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "title": "Apex suspends payouts",
    "raw_content": "Breaking: Apex Trading halted all payouts amid SEC investigation.",
    "source_type": "twitter",
    "source_url": "https://twitter.com/...",
    "content_date": "2026-02-20"
  }'
```

**Dependencies:**
- TICKET-S8-002 (database schema)
- TICKET-S8-003 (AI service)

**Files Changed:**
- `app/api/admin/content/industry/route.js` (new)
- `app/api/admin/content/industry/route.test.js` (new)

---

### TICKET-S8-006: Implement Content Approval API 🟡 HIGH

**Status:** 🔲 Pending
**Priority:** P1 (High)
**Story Points:** 2
**Assignee:** Backend Engineer

**Description:**

Create API endpoints to approve/publish content and manage pending items.

**Acceptance Criteria:**

- [ ] PATCH `/api/admin/content/firm/:id` - Update firm content (publish, edit)
- [ ] PATCH `/api/admin/content/industry/:id` - Update industry news
- [ ] GET `/api/admin/content/review` - List pending content (published = false)
- [ ] DELETE `/api/admin/content/firm/:id` - Delete firm content
- [ ] DELETE `/api/admin/content/industry/:id` - Delete industry news

**Implementation:**

```javascript
// app/api/admin/content/firm/[id]/route.js

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

// PATCH: Update firm content (publish, edit, notes)
export async function PATCH(req, { params }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = params;
  const body = await req.json();

  const updateData = {};
  if (body.published !== undefined) {
    updateData.published = body.published;
    if (body.published) updateData.published_at = new Date().toISOString();
  }
  if (body.admin_notes !== undefined) updateData.admin_notes = body.admin_notes;
  if (body.title !== undefined) updateData.title = body.title;
  if (body.raw_content !== undefined) updateData.raw_content = body.raw_content;

  const serviceClient = createServiceClient();
  const { data, error } = await serviceClient
    .from('firm_content_items')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, item: data });
}

// DELETE: Remove firm content
export async function DELETE(req, { params }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = params;
  const serviceClient = createServiceClient();
  const { error } = await serviceClient
    .from('firm_content_items')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
```

```javascript
// app/api/admin/content/review/route.js

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function GET(req) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || 'pending'; // pending, published, all
  const limit = parseInt(searchParams.get('limit') || '50');

  const serviceClient = createServiceClient();

  let firmQuery = serviceClient
    .from('firm_content_items')
    .select('*')
    .order('ingested_at', { ascending: false })
    .limit(limit);

  if (status === 'pending') firmQuery = firmQuery.eq('published', false);
  else if (status === 'published') firmQuery = firmQuery.eq('published', true);

  let industryQuery = serviceClient
    .from('industry_news_items')
    .select('*')
    .order('ingested_at', { ascending: false })
    .limit(limit);

  if (status === 'pending') industryQuery = industryQuery.eq('published', false);
  else if (status === 'published') industryQuery = industryQuery.eq('published', true);

  const [firmResult, industryResult] = await Promise.all([
    firmQuery,
    industryQuery,
  ]);

  return NextResponse.json({
    firm_content: firmResult.data || [],
    industry_news: industryResult.data || [],
  });
}
```

**Testing:**

```bash
# Approve firm content
curl -X PATCH http://localhost:3000/api/admin/content/firm/123 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{ "published": true, "admin_notes": "Verified" }'

# List pending content
curl http://localhost:3000/api/admin/content/review?status=pending

# Delete content
curl -X DELETE http://localhost:3000/api/admin/content/firm/123
```

**Dependencies:**
- TICKET-S8-004, S8-005 (upload APIs)

**Files Changed:**
- `app/api/admin/content/firm/[id]/route.js` (new)
- `app/api/admin/content/industry/[id]/route.js` (new)
- `app/api/admin/content/review/route.js` (new)

---

## Epic 4: Admin UI

### TICKET-S8-007: Build Admin Content Upload UI 🟡 HIGH

**Status:** 🔲 Pending
**Priority:** P1 (High)
**Story Points:** 5
**Assignee:** Frontend Engineer

**Description:**

Create admin UI page for uploading firm content and industry news with AI categorization preview.

**Acceptance Criteria:**

- [ ] Create `/app/admin/content/upload/page.js`
- [ ] Form includes:
  - [ ] Tab switcher: "Firm Content" / "Industry News"
  - [ ] Firm selector dropdown (for firm content tab)
  - [ ] Content type selector (News / Rule Change / Promotion)
  - [ ] Title input
  - [ ] Content textarea (large, 500+ chars)
  - [ ] Screenshot upload (drag & drop + file picker)
  - [ ] Source type dropdown
  - [ ] Source URL input (optional)
  - [ ] Date picker (content_date)
  - [ ] Submit button: "Process with AI"
- [ ] On submit:
  - [ ] Show loading spinner
  - [ ] Call `/api/admin/content/firm` or `/api/admin/content/industry`
  - [ ] Display AI results:
    - AI Summary (editable)
    - AI Category
    - Confidence score
    - Tags
    - Mentioned firms (for industry news)
  - [ ] Show preview card
  - [ ] Buttons: "Approve & Publish" / "Save as Draft" / "Edit & Retry"
- [ ] Error handling: validation, API errors, AI failures
- [ ] Toast notifications for success/error

**UI Mockup:**

```jsx
"use client";

import { useState } from 'react';
import AdminLayout from '@/components/common/AdminLayout';

export default function AdminContentUpload() {
  const [tab, setTab] = useState('firm'); // 'firm' or 'industry'
  const [formData, setFormData] = useState({
    firm_id: '',
    content_type: 'company_news',
    title: '',
    raw_content: '',
    source_type: 'manual_upload',
    source_url: '',
    content_date: new Date().toISOString().slice(0, 10),
  });
  const [screenshot, setScreenshot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setAiResult(null);

    try {
      const endpoint = tab === 'firm'
        ? '/api/admin/content/firm'
        : '/api/admin/content/industry';

      const formDataObj = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        if (value) formDataObj.append(key, value);
      });
      if (screenshot) formDataObj.append('screenshot_file', screenshot);

      const res = await fetch(endpoint, {
        method: 'POST',
        body: formDataObj,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      setAiResult(data.item);
      alert('Content processed! Review AI results below.');
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!aiResult) return;
    try {
      const endpoint = tab === 'firm'
        ? `/api/admin/content/firm/${aiResult.id}`
        : `/api/admin/content/industry/${aiResult.id}`;

      await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: true }),
      });

      alert('Content published!');
      window.location.reload();
    } catch (err) {
      alert(`Publish error: ${err.message}`);
    }
  };

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold mb-6">Upload Content</h1>

      {/* Tab switcher */}
      <div className="tabs tabs-boxed mb-6">
        <button
          className={`tab ${tab === 'firm' ? 'tab-active' : ''}`}
          onClick={() => setTab('firm')}
        >
          Firm Content
        </button>
        <button
          className={`tab ${tab === 'industry' ? 'tab-active' : ''}`}
          onClick={() => setTab('industry')}
        >
          Industry News
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="card card-border bg-base-100 p-6 space-y-4">
        {tab === 'firm' && (
          <div>
            <label className="label">Firm</label>
            <select
              className="select select-bordered w-full"
              value={formData.firm_id}
              onChange={(e) => setFormData({ ...formData, firm_id: e.target.value })}
              required
            >
              <option value="">Select firm...</option>
              <option value="fundingpips">FundingPips</option>
              <option value="fxify">FXIFY</option>
              <option value="fundednext">Funded Next</option>
              {/* Add more firms */}
            </select>
          </div>
        )}

        {tab === 'firm' && (
          <div>
            <label className="label">Content Type</label>
            <div className="flex gap-4">
              {['company_news', 'rule_change', 'promotion'].map((type) => (
                <label key={type} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="content_type"
                    value={type}
                    checked={formData.content_type === type}
                    onChange={(e) => setFormData({ ...formData, content_type: e.target.value })}
                    className="radio radio-primary"
                  />
                  <span className="capitalize">{type.replace('_', ' ')}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="label">Title</label>
          <input
            type="text"
            className="input input-bordered w-full"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="e.g., Instant Payout Feature Launched"
            required
          />
        </div>

        <div>
          <label className="label">Content</label>
          <textarea
            className="textarea textarea-bordered w-full h-32"
            value={formData.raw_content}
            onChange={(e) => setFormData({ ...formData, raw_content: e.target.value })}
            placeholder="Paste full text from Discord, email, screenshot..."
            required
          />
        </div>

        <div>
          <label className="label">Screenshot (Optional)</label>
          <input
            type="file"
            accept="image/*"
            className="file-input file-input-bordered w-full"
            onChange={(e) => setScreenshot(e.target.files[0])}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Source Type</label>
            <select
              className="select select-bordered w-full"
              value={formData.source_type}
              onChange={(e) => setFormData({ ...formData, source_type: e.target.value })}
            >
              <option value="manual_upload">Manual Upload</option>
              <option value="discord">Discord</option>
              <option value="firm_email">Email</option>
              <option value="twitter">Twitter</option>
              <option value="reddit">Reddit</option>
            </select>
          </div>

          <div>
            <label className="label">Date</label>
            <input
              type="date"
              className="input input-bordered w-full"
              value={formData.content_date}
              onChange={(e) => setFormData({ ...formData, content_date: e.target.value })}
              required
            />
          </div>
        </div>

        <div>
          <label className="label">Source URL (Optional)</label>
          <input
            type="url"
            className="input input-bordered w-full"
            value={formData.source_url}
            onChange={(e) => setFormData({ ...formData, source_url: e.target.value })}
            placeholder="https://discord.com/..."
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading}
        >
          {loading ? <span className="loading loading-spinner" /> : 'Process with AI'}
        </button>
      </form>

      {/* AI Results Preview */}
      {aiResult && (
        <div className="card card-border bg-base-200 p-6 mt-6">
          <h2 className="text-xl font-bold mb-4">AI Processing Results</h2>

          <div className="space-y-3">
            <div>
              <strong>AI Category:</strong> {aiResult.ai_category}
            </div>
            <div>
              <strong>Confidence:</strong> {(aiResult.ai_confidence * 100).toFixed(0)}%
            </div>
            <div>
              <strong>Tags:</strong> {aiResult.ai_tags?.join(', ') || 'None'}
            </div>
            {aiResult.mentioned_firm_ids?.length > 0 && (
              <div>
                <strong>Mentioned Firms:</strong> {aiResult.mentioned_firm_ids.join(', ')}
              </div>
            )}
            <div>
              <strong>Summary:</strong>
              <p className="mt-2 p-3 bg-base-100 rounded">{aiResult.ai_summary}</p>
            </div>
          </div>

          <div className="flex gap-4 mt-6">
            <button onClick={handleApprove} className="btn btn-success">
              Approve & Publish
            </button>
            <button className="btn btn-outline">Save as Draft</button>
            <button className="btn btn-ghost">Edit & Retry</button>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
```

**Dependencies:**
- TICKET-S8-004, S8-005 (APIs)

**Files Changed:**
- `app/admin/content/upload/page.js` (new)

---

### TICKET-S8-008: Build Content Review Queue UI 🟢 MEDIUM

**Status:** 🔲 Pending
**Priority:** P2 (Medium)
**Story Points:** 3
**Assignee:** Frontend Engineer

**Description:**

Create admin UI page to review and approve pending content.

**Acceptance Criteria:**

- [ ] Create `/app/admin/content/review/page.js`
- [ ] Table showing pending content (published = false)
- [ ] Columns: Date | Firm/Industry | Type | Title | AI Summary | Confidence | Actions
- [ ] Actions: Approve | Edit | Delete
- [ ] Filters: Status (pending/published/all), Firm, Type, Date range
- [ ] Pagination (50 items per page)
- [ ] Approve button calls PATCH `/api/admin/content/firm/:id` with `published: true`
- [ ] Delete button shows confirm dialog

**UI Mockup:**

```jsx
"use client";

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/common/AdminLayout';

export default function AdminContentReview() {
  const [items, setItems] = useState({ firm_content: [], industry_news: [] });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('pending');

  useEffect(() => {
    loadContent();
  }, [status]);

  const loadContent = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/content/review?status=${status}`);
      const data = await res.json();
      setItems(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (type, id) => {
    if (!confirm('Approve and publish this content?')) return;
    try {
      await fetch(`/api/admin/content/${type}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: true }),
      });
      alert('Approved!');
      loadContent();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleDelete = async (type, id) => {
    if (!confirm('Delete this content permanently?')) return;
    try {
      await fetch(`/api/admin/content/${type}/${id}`, { method: 'DELETE' });
      alert('Deleted!');
      loadContent();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold mb-6">Content Review Queue</h1>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <select
          className="select select-bordered"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="pending">Pending</option>
          <option value="published">Published</option>
          <option value="all">All</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <span className="loading loading-spinner loading-lg" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Firm Content Table */}
          <div>
            <h2 className="text-lg font-bold mb-3">Firm Content ({items.firm_content.length})</h2>
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Firm</th>
                    <th>Type</th>
                    <th>Title</th>
                    <th>AI Summary</th>
                    <th>Confidence</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.firm_content.map((item) => (
                    <tr key={item.id}>
                      <td>{item.content_date}</td>
                      <td>{item.firm_id}</td>
                      <td>{item.content_type}</td>
                      <td>{item.title}</td>
                      <td className="max-w-xs truncate">{item.ai_summary}</td>
                      <td>{(item.ai_confidence * 100).toFixed(0)}%</td>
                      <td>
                        <div className="flex gap-2">
                          {!item.published && (
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => handleApprove('firm', item.id)}
                            >
                              Approve
                            </button>
                          )}
                          <button
                            className="btn btn-error btn-sm"
                            onClick={() => handleDelete('firm', item.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Industry News Table */}
          <div>
            <h2 className="text-lg font-bold mb-3">Industry News ({items.industry_news.length})</h2>
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Title</th>
                    <th>AI Summary</th>
                    <th>Mentioned Firms</th>
                    <th>Confidence</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.industry_news.map((item) => (
                    <tr key={item.id}>
                      <td>{item.content_date}</td>
                      <td>{item.title}</td>
                      <td className="max-w-xs truncate">{item.ai_summary}</td>
                      <td>{item.mentioned_firm_ids?.join(', ') || 'None'}</td>
                      <td>{(item.ai_confidence * 100).toFixed(0)}%</td>
                      <td>
                        <div className="flex gap-2">
                          {!item.published && (
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => handleApprove('industry', item.id)}
                            >
                              Approve
                            </button>
                          )}
                          <button
                            className="btn btn-error btn-sm"
                            onClick={() => handleDelete('industry', item.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
```

**Dependencies:**
- TICKET-S8-006 (approval API)

**Files Changed:**
- `app/admin/content/review/page.js` (new)

---

## Epic 5: Weekly Digest Integration

### TICKET-S8-009: Update Weekly Digest Query to Include Firm Content 🔴 CRITICAL

**Status:** 🔲 Pending
**Priority:** P0 (Blocker)
**Story Points:** 5
**Assignee:** Backend Engineer

**Description:**

Update weekly digest data fetcher to include firm content and industry news alongside Trustpilot incidents.

**Acceptance Criteria:**

- [ ] Update `lib/email/digest-builder.js` (or create if missing)
- [ ] Query `firm_content_items` for subscribed firms (published = true, date in week range)
- [ ] Query `industry_news_items` for the week (published = true)
- [ ] Group firm content by type (company_news, rule_change, promotion)
- [ ] Return structured data:
  ```javascript
  {
    industryNews: [...], // Top 10 industry news items
    firmReports: [
      {
        firmId: 'fundingpips',
        incidents: [...], // Existing Trustpilot logic
        content: {
          company_news: [...],
          rule_change: [...],
          promotion: [...]
        }
      }
    ]
  }
  ```
- [ ] Maintain backward compatibility (existing digest logic)

**Implementation:**

```javascript
// lib/email/digest-builder.js

import { createServiceClient } from '@/lib/supabase/service';
import { getWeekBoundsUtc, getWeekNumberUtc, getYearUtc } from '@/lib/digest/week-utils';

export async function buildWeeklyDigest(userId, weekStart = null, weekEnd = null) {
  const supabase = createServiceClient();

  // Calculate week bounds (default to current week)
  const now = new Date();
  const bounds = weekStart && weekEnd
    ? { weekStart: new Date(weekStart), weekEnd: new Date(weekEnd) }
    : getWeekBoundsUtc(now);

  const weekStartIso = bounds.weekStart.toISOString().slice(0, 10);
  const weekEndIso = bounds.weekEnd.toISOString().slice(0, 10);
  const weekNumber = getWeekNumberUtc(bounds.weekStart);
  const year = getYearUtc(bounds.weekStart);

  // 1. Get user subscriptions
  const { data: subscriptions } = await supabase
    .from('user_subscriptions')
    .select('firm_id')
    .eq('user_id', userId)
    .eq('email_enabled', true);

  if (!subscriptions || subscriptions.length === 0) {
    return {
      userId,
      weekStart: weekStartIso,
      weekEnd: weekEndIso,
      industryNews: [],
      firmReports: [],
    };
  }

  const firmIds = subscriptions.map(s => s.firm_id);

  // 2. Get Trustpilot incidents (existing logic)
  const { data: incidents } = await supabase
    .from('firm_daily_incidents')
    .select('*')
    .in('firm_id', firmIds)
    .eq('week_number', weekNumber)
    .eq('year', year);

  // 3. NEW: Get firm content for subscribed firms
  const { data: firmContent } = await supabase
    .from('firm_content_items')
    .select('*')
    .in('firm_id', firmIds)
    .eq('published', true)
    .gte('content_date', weekStartIso)
    .lte('content_date', weekEndIso)
    .order('content_date', { ascending: false });

  // 4. NEW: Get industry news for the week
  const { data: industryNews } = await supabase
    .from('industry_news_items')
    .select('*')
    .eq('published', true)
    .gte('content_date', weekStartIso)
    .lte('content_date', weekEndIso)
    .order('content_date', { ascending: false })
    .limit(10); // Top 10 most recent

  // 5. Group content by firm
  const incidentsByFirm = {};
  const contentByFirm = {};

  for (const firmId of firmIds) {
    incidentsByFirm[firmId] = (incidents || []).filter(i => i.firm_id === firmId);
    contentByFirm[firmId] = {
      company_news: [],
      rule_change: [],
      promotion: [],
    };
  }

  for (const item of firmContent || []) {
    if (!contentByFirm[item.firm_id]) continue;
    const type = item.content_type;
    if (contentByFirm[item.firm_id][type]) {
      contentByFirm[item.firm_id][type].push(item);
    }
  }

  // 6. Build firm reports
  const firmReports = firmIds.map(firmId => ({
    firmId,
    incidents: incidentsByFirm[firmId] || [],
    content: contentByFirm[firmId],
  }));

  return {
    userId,
    weekStart: weekStartIso,
    weekEnd: weekEndIso,
    industryNews: industryNews || [],
    firmReports,
  };
}
```

**Testing:**

```javascript
// Test digest builder
import { buildWeeklyDigest } from '@/lib/email/digest-builder';

const userId = 'test-user-id';
const digest = await buildWeeklyDigest(userId);

console.log('Industry news:', digest.industryNews.length);
console.log('Firm reports:', digest.firmReports.length);
digest.firmReports.forEach(report => {
  console.log(`${report.firmId}:`, {
    incidents: report.incidents.length,
    news: report.content.company_news.length,
    rules: report.content.rule_change.length,
    promos: report.content.promotion.length,
  });
});
```

**Dependencies:**
- TICKET-S8-001, S8-002 (database tables)

**Files Changed:**
- `lib/email/digest-builder.js` (create or update)
- `lib/email/__tests__/digest-builder.test.js` (new)

---

### TICKET-S8-010: Update Weekly Email Template 🔴 CRITICAL

**Status:** 🔲 Pending
**Priority:** P0 (Blocker)
**Story Points:** 5
**Assignee:** Full-stack Engineer

**Description:**

Update email template to render industry news and firm content sections.

**Acceptance Criteria:**

- [ ] Update `lib/email/send-digest.js` (or template file)
- [ ] Add "Industry News" section before firm reports
- [ ] For each firm, add sub-sections:
  - [ ] Company News
  - [ ] Rule Changes
  - [ ] Promotions
  - [ ] Trustpilot Incidents (existing)
- [ ] Style each content type distinctly (icons, colors)
- [ ] Include links to original sources (source_url)
- [ ] Maintain responsive email design (mobile-friendly)
- [ ] Test rendering in Gmail, Outlook, Apple Mail

**Email Template Structure:**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Weekly Prop Firm Digest</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
  <div style="background: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <h1 style="color: #333; margin: 0 0 10px;">Your Weekly Prop Firm Digest</h1>
    <p style="color: #666; margin: 0 0 30px;">Week of {{weekStart}} - {{weekEnd}}</p>

    <!-- INDUSTRY NEWS SECTION -->
    {{#if industryNews.length}}
      <div style="margin: 30px 0; padding: 20px; border-left: 4px solid #3b82f6; background: #eff6ff; border-radius: 4px;">
        <h2 style="margin: 0 0 15px; color: #1e40af; font-size: 18px; display: flex; align-items: center;">
          📰 Industry News
        </h2>
        {{#each industryNews}}
          <div style="margin: 15px 0; padding: 12px; background: white; border-radius: 4px;">
            <h3 style="margin: 0 0 5px; font-size: 16px; color: #333;">{{title}}</h3>
            <p style="margin: 0; font-size: 14px; color: #555; line-height: 1.5;">{{ai_summary}}</p>
            {{#if mentioned_firm_ids.length}}
              <p style="margin: 5px 0 0; font-size: 12px; color: #9ca3af;">
                Mentioned: {{#each mentioned_firm_ids}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
              </p>
            {{/if}}
            {{#if source_url}}
              <a href="{{source_url}}" style="font-size: 12px; color: #2563eb; text-decoration: none; margin-top: 5px; display: inline-block;">
                Read more →
              </a>
            {{/if}}
          </div>
        {{/each}}
      </div>
    {{/if}}

    <!-- FIRM REPORTS -->
    <h2 style="margin: 40px 0 20px; color: #333; font-size: 20px;">Your Watched Firms</h2>

    {{#each firmReports}}
      <div style="margin: 30px 0; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background: #fafafa;">
        <div style="display: flex; align-items: center; margin-bottom: 15px;">
          <h2 style="margin: 0; color: #333; font-size: 20px;">{{firmName}}</h2>
        </div>

        <!-- Company News -->
        {{#if content.company_news.length}}
          <div style="margin: 15px 0;">
            <h3 style="color: #059669; font-size: 14px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center;">
              📢 Company News
            </h3>
            {{#each content.company_news}}
              <div style="margin: 10px 0; padding: 12px; border-left: 3px solid #10b981; background: white; border-radius: 4px;">
                <h4 style="margin: 0 0 5px; font-size: 15px; color: #333;">{{title}}</h4>
                <p style="margin: 0; font-size: 14px; color: #555; line-height: 1.5;">{{ai_summary}}</p>
                {{#if source_url}}
                  <a href="{{source_url}}" style="font-size: 12px; color: #059669; text-decoration: none; margin-top: 5px; display: inline-block;">
                    View source →
                  </a>
                {{/if}}
              </div>
            {{/each}}
          </div>
        {{/if}}

        <!-- Rule Changes -->
        {{#if content.rule_change.length}}
          <div style="margin: 15px 0;">
            <h3 style="color: #dc2626; font-size: 14px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center;">
              ⚠️ Rule Changes
            </h3>
            {{#each content.rule_change}}
              <div style="margin: 10px 0; padding: 12px; border-left: 3px solid #ef4444; background: white; border-radius: 4px;">
                <h4 style="margin: 0 0 5px; font-size: 15px; color: #333;">{{title}}</h4>
                <p style="margin: 0; font-size: 14px; color: #555; line-height: 1.5;">{{ai_summary}}</p>
                {{#if source_url}}
                  <a href="{{source_url}}" style="font-size: 12px; color: #dc2626; text-decoration: none; margin-top: 5px; display: inline-block;">
                    View source →
                  </a>
                {{/if}}
              </div>
            {{/each}}
          </div>
        {{/if}}

        <!-- Promotions -->
        {{#if content.promotion.length}}
          <div style="margin: 15px 0;">
            <h3 style="color: #7c3aed; font-size: 14px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center;">
              🎁 Promotions
            </h3>
            {{#each content.promotion}}
              <div style="margin: 10px 0; padding: 12px; border-left: 3px solid #a855f7; background: white; border-radius: 4px;">
                <h4 style="margin: 0 0 5px; font-size: 15px; color: #333;">{{title}}</h4>
                <p style="margin: 0; font-size: 14px; color: #555; line-height: 1.5;">{{ai_summary}}</p>
                {{#if source_url}}
                  <a href="{{source_url}}" style="font-size: 12px; color: #7c3aed; text-decoration: none; margin-top: 5px; display: inline-block;">
                    View offer →
                  </a>
                {{/if}}
              </div>
            {{/each}}
          </div>
        {{/if}}

        <!-- Trustpilot Incidents (existing logic) -->
        {{#if incidents.length}}
          <div style="margin-top: 20px;">
            <h3 style="color: #555; font-size: 14px; margin: 0 0 10px; text-transform: uppercase; letter-spacing: 0.5px;">
              ⚠️ Trustpilot Incidents
            </h3>
            {{#each incidents}}
              <!-- (Existing incident rendering) -->
            {{/each}}
          </div>
        {{/if}}

        {{#unless (or content.company_news.length content.rule_change.length content.promotion.length incidents.length)}}
          <p style="margin: 20px 0; padding: 20px; background: white; border-radius: 4px; color: #6b7280; text-align: center; font-size: 14px;">
            ✓ No significant updates this week
          </p>
        {{/unless}}
      </div>
    {{/each}}

    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center;">
      <p style="margin: 0 0 10px; font-size: 12px; color: #9ca3af;">
        You're receiving this because you subscribed to updates for these firms.
      </p>
      <a href="{{unsubscribeUrl}}" style="font-size: 12px; color: #6b7280; text-decoration: underline;">
        Manage your subscriptions
      </a>
    </div>
  </div>
</body>
</html>
```

**Testing:**

- [ ] Send test email to personal inbox
- [ ] Test with different scenarios:
  - [ ] Only industry news (no firm content)
  - [ ] Only firm content (no industry news)
  - [ ] Mixed content (news + rules + promos + incidents)
  - [ ] Empty week (no updates)
- [ ] Verify rendering in:
  - [ ] Gmail (web + mobile)
  - [ ] Outlook (desktop + web)
  - [ ] Apple Mail (macOS + iOS)
- [ ] Check link functionality (source_url clicks)

**Dependencies:**
- TICKET-S8-009 (digest builder)

**Files Changed:**
- `lib/email/send-digest.js` (or template file)

---

## Epic 6: Testing & Documentation

### TICKET-S8-011: End-to-End Testing of Content Pipeline 🟡 HIGH

**Status:** 🔲 Pending
**Priority:** P1 (High)
**Story Points:** 3
**Assignee:** QA Engineer

**Description:**

Test the complete workflow from content upload to weekly digest delivery.

**Acceptance Criteria:**

**Test Scenario 1: Firm Content Upload**
- [ ] Admin uploads firm news via `/admin/content/upload`
- [ ] AI categorizes correctly (verify category, summary, tags)
- [ ] Content appears in review queue as pending
- [ ] Admin approves content
- [ ] Content visible in published list

**Test Scenario 2: Industry News Upload**
- [ ] Admin uploads industry news mentioning multiple firms
- [ ] AI extracts `mentioned_firm_ids` correctly
- [ ] Content appears in review queue

**Test Scenario 3: Weekly Digest Includes New Content**
- [ ] Create test user subscribed to FundingPips
- [ ] Upload 1 company news, 1 rule change, 1 promotion for FundingPips (approve all)
- [ ] Upload 1 industry news item (approve)
- [ ] Manually trigger weekly digest send
- [ ] Verify email includes:
  - [ ] Industry news section (1 item)
  - [ ] FundingPips: Company news (1), Rule change (1), Promotion (1)

**Test Scenario 4: Content with Screenshot**
- [ ] Upload content with screenshot file
- [ ] Verify screenshot uploaded to Vercel Blob
- [ ] Verify `screenshot_url` saved in database
- [ ] Verify screenshot accessible via URL

**Test Scenario 5: AI Confidence Threshold**
- [ ] Upload ambiguous content (e.g., "Something happened")
- [ ] Verify AI returns low confidence (<0.5)
- [ ] Admin can review and override category

**Test Scenario 6: Empty Week (No Content)**
- [ ] No new content uploaded
- [ ] Weekly digest still sends (Trustpilot incidents only)
- [ ] Email doesn't show empty sections

**Manual Testing Checklist:**
- [ ] Test all content types (news, rules, promos)
- [ ] Test all source types (manual, Discord, email, Twitter)
- [ ] Test with invalid firm_id (should error)
- [ ] Test with missing required fields (should error)
- [ ] Test approve/delete actions
- [ ] Test weekly digest with 0, 1, 5, 10 content items

**Dependencies:**
- All previous tickets

**Files Changed:**
- `tests/e2e/content-pipeline.spec.js` (new)

---

### TICKET-S8-012: Update Admin Dashboard Metrics 🟢 MEDIUM

**Status:** 🔲 Pending
**Priority:** P2 (Medium)
**Story Points:** 2
**Assignee:** Backend Engineer

**Description:**

Add content metrics to admin dashboard (`/admin/dashboard`).

**Acceptance Criteria:**

- [ ] Extend `GET /api/admin/metrics` endpoint
- [ ] Add `contentStats` object to response:
  ```json
  {
    "contentStats": {
      "firm_content_pending": 5,
      "firm_content_published_this_week": 12,
      "industry_news_pending": 2,
      "industry_news_published_this_week": 3,
      "by_type": {
        "company_news": 8,
        "rule_change": 3,
        "promotion": 1
      }
    }
  }
  ```
- [ ] Add UI panel in `/app/admin/dashboard/page.js` showing:
  - Pending content count (with link to review queue)
  - Published this week (firm content + industry news)
  - Breakdown by type (pie chart or bar chart)

**Implementation:**

```javascript
// app/api/admin/metrics/route.js (add to existing)

async function getContentStats(supabase) {
  const now = new Date();
  const { weekStart, weekEnd } = getWeekBoundsUtc(now);
  const weekStartIso = weekStart.toISOString().slice(0, 10);
  const weekEndIso = weekEnd.toISOString().slice(0, 10);

  const [
    { count: firmPending },
    { count: firmPublishedThisWeek },
    { count: industryPending },
    { count: industryPublishedThisWeek },
  ] = await Promise.all([
    supabase.from('firm_content_items').select('*', { count: 'exact', head: true }).eq('published', false),
    supabase.from('firm_content_items').select('*', { count: 'exact', head: true }).eq('published', true).gte('content_date', weekStartIso).lte('content_date', weekEndIso),
    supabase.from('industry_news_items').select('*', { count: 'exact', head: true }).eq('published', false),
    supabase.from('industry_news_items').select('*', { count: 'exact', head: true }).eq('published', true).gte('content_date', weekStartIso).lte('content_date', weekEndIso),
  ]);

  const { data: byType } = await supabase
    .from('firm_content_items')
    .select('content_type')
    .eq('published', true)
    .gte('content_date', weekStartIso)
    .lte('content_date', weekEndIso);

  const typeCount = {};
  for (const item of byType || []) {
    typeCount[item.content_type] = (typeCount[item.content_type] || 0) + 1;
  }

  return {
    firm_content_pending: firmPending || 0,
    firm_content_published_this_week: firmPublishedThisWeek || 0,
    industry_news_pending: industryPending || 0,
    industry_news_published_this_week: industryPublishedThisWeek || 0,
    by_type: typeCount,
  };
}

// In GET handler, add:
const contentStats = await getContentStats(supabase);
// Include in response payload
```

**UI Panel:**

```jsx
{/* Content Stats */}
<div className="card card-border bg-base-100 shadow">
  <div className="card-body">
    <h3 className="text-sm font-medium text-base-content/70">Content Pipeline</h3>
    <div className="text-2xl font-bold">{data.contentStats?.firm_content_pending + data.contentStats?.industry_news_pending || 0}</div>
    <p className="text-xs text-base-content/60">
      Pending review
    </p>
    <div className="text-xs text-base-content/50 mt-2">
      Published this week: {data.contentStats?.firm_content_published_this_week + data.contentStats?.industry_news_published_this_week || 0}
    </div>
    <Link href="/admin/content/review" className="btn btn-sm btn-ghost mt-2">
      Review Queue →
    </Link>
  </div>
</div>
```

**Dependencies:**
- TICKET-S8-001, S8-002 (database tables)

**Files Changed:**
- `app/api/admin/metrics/route.js` (extend)
- `app/admin/dashboard/page.js` (add UI panel)

---

### TICKET-S8-013: Documentation & Runbook 📄 DOCUMENTATION

**Status:** 🔲 Pending
**Priority:** P2 (Medium)
**Story Points:** 2
**Assignee:** Tech Lead

**Description:**

Document the content pipeline for future developers and admins.

**Acceptance Criteria:**

- [ ] Create `documents/runbooks/content-pipeline.md`
- [ ] Document:
  - [ ] Content types and when to use each
  - [ ] How to upload content via admin UI
  - [ ] AI categorization process
  - [ ] Approval workflow
  - [ ] Weekly digest integration
  - [ ] Troubleshooting (AI failures, screenshot upload issues)
- [ ] Update `README.md` with content pipeline overview
- [ ] Add example screenshots to runbook

**Runbook Structure:**

```markdown
# Content Pipeline Runbook

## Overview
The content pipeline ingests firm-related content (news, rules, promotions) and industry news, processes it with AI categorization, and includes it in the weekly digest.

## Content Types

### Firm Content
- **Company News:** New features, partnerships, announcements
- **Rule Changes:** Policy updates, drawdown limits, terms changes
- **Promotions:** Discounts, competitions, special offers

### Industry News
- Regulatory changes
- Firm scandals (e.g., Apex payout suspension)
- Market trends

## Uploading Content

### Via Admin UI
1. Navigate to `/admin/content/upload`
2. Select tab: "Firm Content" or "Industry News"
3. Fill form:
   - Firm (for firm content)
   - Content type
   - Title
   - Full text (paste from Discord, email, etc.)
   - Screenshot (optional but recommended)
   - Source type and URL
   - Date
4. Click "Process with AI"
5. Review AI results (category, summary, tags)
6. Click "Approve & Publish" or "Save as Draft"

### Via API (for automation)
```bash
curl -X POST /api/admin/content/firm \
  -H "Content-Type: application/json" \
  -d '{...}'
```

## AI Categorization
- Model: GPT-4o-mini
- Returns: category, summary, confidence, tags, mentioned_firms
- Confidence threshold: No hard limit, but <0.5 indicates ambiguous content

## Approval Workflow
1. Content uploaded → `published = false` (pending)
2. Admin reviews in `/admin/content/review`
3. Admin approves → `published = true`, `published_at = now()`
4. Published content included in next weekly digest

## Weekly Digest
- Runs Sunday 8:00 AM UTC
- Includes content from Mon-Sun of previous week (`content_date` range)
- Industry news: Top 10 most recent
- Firm content: All published items for subscribed firms

## Troubleshooting

### AI categorization fails
- Check OpenAI API key (`OPENAI_API_KEY`)
- Check quota/rate limits
- Retry with simplified content

### Screenshot upload fails
- Verify Vercel Blob configuration
- Check file size (<5 MB recommended)
- Ensure `BLOB_READ_WRITE_TOKEN` is set

### Content not appearing in digest
- Verify `published = true`
- Check `content_date` is within week range
- Check user subscribed to firm

### Mentioned firms not extracted (industry news)
- AI may miss firm names if not explicitly mentioned
- Manually edit `mentioned_firm_ids` via database
```

**Dependencies:** None

**Files Changed:**
- `documents/runbooks/content-pipeline.md` (new)
- `README.md` (update with content pipeline section)

---

## Sprint Summary

### High-Level Breakdown

| Epic | Tickets | Story Points | Priority |
|------|---------|--------------|----------|
| Database Schema & Migrations | 2 | 6 | P0 |
| AI Categorization Service | 1 | 5 | P0 |
| Admin API Endpoints | 3 | 10 | P0-P1 |
| Admin UI | 2 | 8 | P1-P2 |
| Weekly Digest Integration | 2 | 10 | P0 |
| Testing & Documentation | 3 | 7 | P1-P2 |
| **Total** | **13** | **46** | — |

### Critical Path (Must Complete for Sprint Success)

1. **TICKET-S8-001 & S8-002:** Database tables (6 pts) ⚠️ **BLOCKER**
2. **TICKET-S8-003:** AI categorization service (5 pts) ⚠️ **BLOCKER**
3. **TICKET-S8-004 & S8-005:** Upload APIs (8 pts) ⚠️ **BLOCKER**
4. **TICKET-S8-007:** Admin upload UI (5 pts) 🔴 **HIGH**
5. **TICKET-S8-009 & S8-010:** Digest integration (10 pts) ⚠️ **BLOCKER**

**Total Critical Path:** 34 story points (~2 weeks with 2 engineers)

### Nice-to-Have (Can Defer)

- TICKET-S8-006: Approval API (2 pts) - Can manually approve via SQL
- TICKET-S8-008: Review queue UI (3 pts) - Can use database directly
- TICKET-S8-011: E2E testing (3 pts) - Important but not blocking
- TICKET-S8-012: Dashboard metrics (2 pts) - Enhancement
- TICKET-S8-013: Documentation (2 pts) - Post-launch

---

## Key Risks & Mitigation

**Risk 1: Manual effort too high**
- *Mitigation:* Start with 1-2 firms, limit to critical content only
- *Future:* Automate with Discord webhooks (Sprint 9)

**Risk 2: AI accuracy issues**
- *Mitigation:* Admin review step before publishing
- *Future:* Fine-tune prompts based on real data

**Risk 3: Email bloat (too much content)**
- *Mitigation:* Limit to top 3 items per category per firm
- *Future:* User preferences for content types

**Risk 4: Screenshot storage costs**
- *Mitigation:* Use Vercel Blob (generous free tier)
- *Future:* Migrate to Cloudflare R2 if needed

---

## Next Steps (Post-Sprint 8)

1. **Sprint 9:** Semi-automated Discord monitoring
2. **Sprint 10:** Email newsletter parsing
3. **Sprint 11:** Twitter/Reddit keyword tracking
4. **Sprint 12:** Public firm timelines

---

**Sprint Start Date:** 2026-02-22
**Estimated Completion:** 2026-03-08 (2 weeks)
**Tech Lead:** [Your Name]
