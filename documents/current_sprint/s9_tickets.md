# Sprint 9 Tickets – Email Pipeline + Public Firm Timelines & Industry News

**Sprint Goal:**  
1. **Email pipeline** – Receive firm marketing emails via Resend inbound → detect firm → categorize/summarize → queue as draft → admin approves for digest (free/minimal cost).  
2. **Public pages** – Firm content timeline and industry news page for unauthenticated users.

**Context:** [s9_scope.md](./s9_scope.md)  
**Discord:** Deferred; see [DISCORD-MONITORING-GUIDE.md](./DISCORD-MONITORING-GUIDE.md).

**Story points:** 1, 2, 3, 5

---

## Epic 1: Email – Sender → Firm Mapping

### TICKET-S9-001: Add firm_email_senders Table

**Status:** 🔲 Pending  
**Priority:** P0  
**Story points:** 2

**Description:** Store mapping from sender email/domain to `firm_id` so we can auto-detect which firm an inbound email belongs to.

**Acceptance criteria:**

- [ ] Migration `28_firm_email_senders.sql`.
- [ ] Table `firm_email_senders`:
  - [ ] `id` SERIAL PRIMARY KEY
  - [ ] `firm_id` TEXT NOT NULL REFERENCES firm_profiles(id) ON DELETE CASCADE
  - [ ] `sender_pattern` TEXT NOT NULL — e.g. `@fundingpips.com`, `news@fxify.com`, or full address
  - [ ] `is_active` BOOLEAN DEFAULT true
  - [ ] `created_at`, `updated_at` TIMESTAMPTZ
- [ ] Unique on `(firm_id, sender_pattern)`.
- [ ] RLS: admin-only (same pattern as firm_content_items).
- [ ] Index on `sender_pattern` (or use for matching: match if message `from` contains pattern or domain matches).

**Matching rule:** Match when the normalized "from" address or its domain equals or ends with `sender_pattern` (e.g. pattern `@fundingpips.com` matches `news@fundingpips.com`). Document in runbook.

**Files:** `migrations/28_firm_email_senders.sql`

---

## Epic 2: Email – Webhook & Processing

### TICKET-S9-002: Resend Inbound Webhook Endpoint

**Status:** 🔲 Pending  
**Priority:** P0  
**Story points:** 3

**Description:** Accept Resend `email.received` webhook, verify signature, fetch full email body via Resend API, then hand off to processor (S9-003).

**Acceptance criteria:**

- [ ] New route `POST /api/webhooks/resend/inbound` (or `/api/webhook/resend-inbound`).
- [ ] Verify webhook using Resend’s method (e.g. `resend.webhooks.verify()` with `RESEND_WEBHOOK_SECRET`). Reject with 401 if invalid.
- [ ] On `event.type === 'email.received'`: extract `event.data.email_id`, `event.data.from`, `event.data.subject`, `event.data.to`.
- [ ] Call Resend API `resend.emails.receiving.get(email_id)` to get `text` and/or `html`. Prefer plain text for AI; fallback to HTML stripped to text.
- [ ] Invoke internal processor (next ticket) with: `{ from, subject, text, html, email_id, received_at }`. Do not block webhook response: return 200 quickly; process in background (e.g. fire-and-forget or queue). If processing must be synchronous, keep it under ~25s for Vercel.
- [ ] Log errors; on processing failure do not retry webhook indefinitely (Resend will retry; processor should be idempotent where possible).

**Files:** `app/api/webhooks/resend/inbound/route.ts` (or equivalent), env `RESEND_WEBHOOK_SECRET`

**Dependencies:** Resend SDK supports `emails.receiving.get`; confirm package version.

---

### TICKET-S9-003: Inbound Email Processor (Detect Firm, AI, Insert Draft)

**Status:** 🔲 Pending  
**Priority:** P0  
**Story points:** 5

**Description:** Given raw email (from, subject, body): resolve firm_id from sender mapping, run AI categorization/summary, insert one row into `firm_content_items` as draft.

**Acceptance criteria:**

- [ ] Function or module `processInboundFirmEmail({ from, subject, text, html, email_id, received_at })`.
- [ ] **Firm detection:** Query `firm_email_senders` (active). Normalize `from` (lowercase, extract email if "Name <email>"). Match when `from` equals or ends with `sender_pattern`. If multiple matches, take first or most specific; if none, optionally create row with `firm_id` = a designated “unknown” firm or skip and log (product decision: for S9 we can require at least one mapping and skip otherwise).
- [ ] **Content:** Title = subject (or first line of body, truncated). Raw content = plain text body (or HTML stripped). `content_date` = received date (or today). `source_type` = `'firm_email'`. `source_url` = null or a mailto/link if we have one.
- [ ] Call existing `categorizeContent(rawContent, { title, source_type: 'firm_email', firm_id })` (S8). Map result to `ai_summary`, `ai_category`, `ai_confidence`, `ai_tags`.
- [ ] Insert into `firm_content_items`: `published = false`, all required fields set. Optional: store `email_id` in `admin_notes` or a dedicated column for dedupe (if we receive same email twice, skip or update).
- [ ] Idempotency: if we add a unique constraint or check on `(source_type, external_id)` and pass Resend `email_id` as external_id, skip insert when duplicate (return existing id).

**Files:** `lib/email/process-inbound-firm-email.ts` (or `lib/content/ingest-from-email.ts`), called from webhook route

**Dependencies:** S9-001, S8 categorizeContent

---

## Epic 3: Email – Admin & Runbook

### TICKET-S9-004: Runbook for Email Pipeline Setup

**Status:** 🔲 Pending  
**Priority:** P1  
**Story points:** 2

**Description:** Document how to set up the receiving address, webhook, and sender→firm mapping so the pipeline runs at no/minimal cost.

**Acceptance criteria:**

- [ ] Create `documents/runbooks/email-pipeline.md`.
- [ ] Sections: Resend receiving address (e.g. `firm-news@xxx.resend.app` or custom domain); adding `email.received` webhook and `RESEND_WEBHOOK_SECRET`; adding sender patterns in DB (with examples); how to forward/BCC firm emails to the address; troubleshooting (no firm match, webhook 401, missing body).
- [ ] Link from content-pipeline runbook to email-pipeline runbook.

**Files:** `documents/runbooks/email-pipeline.md`

**Dependencies:** S9-002, S9-003 done

---

### TICKET-S9-005: Admin UI or API to Manage firm_email_senders (Optional)

**Status:** 🔲 Pending  
**Priority:** P2  
**Story points:** 2

**Description:** Let admins add/edit/delete sender patterns without touching the DB directly.

**Acceptance criteria:**

- [ ] Either: (A) CRUD API for `firm_email_senders` and a small admin page, or (B) document SQL examples in runbook for S9 and add UI in a later sprint.
- [ ] If A: GET/POST/PATCH/DELETE for sender patterns; list by firm; validate pattern format (e.g. must contain `@`).

**Files:** `app/api/admin/email-senders/route.ts`, `app/admin/content/email-senders/page.js` (optional)

**Dependencies:** S9-001

---

## Epic 4: Public APIs for Firm Content & Industry News

### TICKET-S9-006: Public API – Published Firm Content by Firm

**Status:** 🔲 Pending  
**Priority:** P0  
**Story points:** 2

**Description:** Public (no auth) endpoint to list published firm content for a given firm, for use by the firm timeline page.

**Acceptance criteria:**

- [ ] `GET /api/v2/propfirms/[id]/content` or `GET /api/v2/propfirms/[id]/timeline` (or `/firm-content`). No auth required.
- [ ] Query `firm_content_items` where `firm_id = id` and `published = true`, order by `content_date` desc (and optionally `published_at` desc). Limit (e.g. 50) and optional date range.
- [ ] Return JSON array of items (id, firm_id, content_type, title, ai_summary, source_url, content_date, published_at, etc.). Exclude raw_content if too large or sensitive; include enough for cards.
- [ ] Validate `id` against existing firms (optional); return 404 if firm not found.

**Files:** `app/api/v2/propfirms/[id]/content/route.js` (or timeline)

**Dependencies:** None (tables exist from S8)

---

### TICKET-S9-007: Public API – Published Industry News

**Status:** 🔲 Pending  
**Priority:** P0  
**Story points:** 2

**Description:** Public endpoint to list published industry news for the industry news page.

**Acceptance criteria:**

- [ ] `GET /api/v2/industry-news` or `GET /api/public/industry-news`. No auth.
- [ ] Query `industry_news_items` where `published = true`, order by `content_date` desc. Pagination: limit (e.g. 20), offset or cursor. Optional filter by `content_date` range or `mentioned_firm_ids` contains X.
- [ ] Return JSON array of items (id, title, ai_summary, mentioned_firm_ids, source_url, content_date, published_at).

**Files:** `app/api/v2/industry-news/route.js` (or under public)

**Dependencies:** None

---

## Epic 5: Public Pages – Firm Timeline & Industry News

### TICKET-S9-008: Firm Timeline Page or Section

**Status:** 🔲 Pending  
**Priority:** P0  
**Story points:** 3

**Description:** Public page (or tab/section) showing a timeline of published firm content (company news, rule changes, promotions) for one firm.

**Acceptance criteria:**

- [ ] Either new route `/propfirms/[id]/timeline` or extend existing Intelligence (or Overview) with a “Firm updates” / “Timeline” block that uses the new content API.
- [ ] Fetch from `GET /api/v2/propfirms/[id]/content` (or timeline). Display cards or list: date, type (news / rule change / promotion), title, summary, link to source if present.
- [ ] Accessible unauthenticated; fits existing prop firm layout (sidebar, tabs).
- [ ] Empty state when no published content.

**Files:** `app/propfirms/[id]/timeline/page.js` (or component under intelligence/overview)

**Dependencies:** S9-006

---

### TICKET-S9-009: Industry News Page

**Status:** 🔲 Pending  
**Priority:** P0  
**Story points:** 3

**Description:** Public page listing published industry news with optional filters and link from nav/footer.

**Acceptance criteria:**

- [ ] New route `/industry-news` (or `/propfirms/industry-news`). Public.
- [ ] Fetch from `GET /api/v2/industry-news`. Display list/cards: date, title, summary, mentioned firms, source link.
- [ ] Optional: filter by date range or “mentioned firm”; pagination or “load more”.
- [ ] Add link from main nav, footer, or prop firm hub so users can discover it.
- [ ] Empty state when no industry news.

**Files:** `app/industry-news/page.js` (or under propfirms), nav/footer update

**Dependencies:** S9-007

---

## Summary

| Ticket   | Title                              | Points | Priority |
|----------|------------------------------------|--------|----------|
| S9-001   | firm_email_senders table           | 2      | P0       |
| S9-002   | Resend inbound webhook endpoint    | 3      | P0       |
| S9-003   | Inbound email processor (detect, AI, insert) | 5 | P0       |
| S9-004   | Runbook email-pipeline             | 2      | P1       |
| S9-005   | Admin UI for email senders (optional) | 2   | P2       |
| S9-006   | Public API firm content by firm     | 2      | P0       |
| S9-007   | Public API industry news            | 2      | P0       |
| S9-008   | Firm timeline page/section          | 3      | P0       |
| S9-009   | Industry news page                  | 3      | P0       |

**Total:** 24 points. **P0:** 19 (email pipeline + public APIs + pages). **P1:** 2. **P2:** 2.

**Suggested order:**  
- Email: S9-001 → S9-002 → S9-003 → S9-004 (S9-005 when capacity).  
- Public: S9-006 → S9-008 in parallel with S9-007 → S9-009 (APIs first, then pages).

**Cost note:** Resend inbound is free; OpenAI usage for categorization is minimal (same as S8). No new paid services required.
