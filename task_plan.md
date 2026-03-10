# Task Plan: Gmail Auto-Ingest → Firm Content Timeline

**Goal:** Auto-monitor a Gmail account for prop firm emails, categorize with AI, store in DB, and display as a timeline on each firm's page alongside Intelligence.

**Status:** Planning

---

## Context: What Already Exists

| What | Where | Status |
|------|-------|--------|
| DB table `firm_content_items` | `migrations/26_firm_content_items.sql` | ✅ Exists — `source_type: 'firm_email'` already planned |
| DB table `industry_news_items` | `migrations/27_industry_news_items.sql` | ✅ Exists |
| AI categorizer | `lib/ai/categorize-content.ts` | ✅ Exists — GPT-4o-mini, returns category/summary/tags |
| Admin manual upload UI | `app/admin/content/upload/page.js` | ✅ Exists (too slow to use manually) |
| Admin content API routes | `app/api/admin/content/firm/route.js` | ❌ Does not exist yet |
| Firm intelligence page | `app/propfirms/[id]/intelligence/page.js` | ✅ Exists — shows Trustpilot incidents |
| Cron system | `app/api/cron/` + `CRON_SECRET` | ✅ Exists |
| Email sending | `lib/email/`, `lib/resend.ts` | ✅ Exists (outbound only) |

---

## Phases

### Phase 1: Gmail API Integration Layer ✅
**Goal:** Connect to a Gmail account and read new emails programmatically.

Steps:
- [x] 1.1 Set up Gmail API credentials (OAuth2 service account or installed app)
- [x] 1.2 Store access/refresh tokens in `.env` or DB
- [x] 1.3 Create `lib/gmail/client.ts` — Gmail API wrapper (list messages, get message, mark as read)
- [x] 1.4 Create `lib/gmail/parser.ts` — extract subject, body (strip HTML), sender, date from raw Gmail message
- [x] 1.5 Create `lib/gmail/firm-mapper.ts` — map sender email domain → firm_id (e.g. `@fundingpips.com` → `fundingpips`)

**Decision:** Use Gmail API polling (not IMAP) — simpler, reliable, supports incremental sync via `historyId`.
**Auth method:** OAuth2 with refresh token stored in env vars (no user-facing auth needed).

---

### Phase 2: Ingest Pipeline (Cron + AI) ⬜
**Goal:** Periodically check Gmail, process new emails through AI, write to DB.

Steps:
- [ ] 2.1 Create `app/api/cron/ingest-firm-emails/route.js` — protected by `CRON_SECRET`
  - Fetch emails since last run (use `historyId` or timestamp from `cron_last_run` table)
  - For each email: parse → identify firm → categorize with AI → write to DB
- [ ] 2.2 Create `lib/gmail/ingest.ts` — orchestrator function (called by cron route)
- [ ] 2.3 Add `firm_email_senders` table or config map for sender → firm_id mapping
- [ ] 2.4 Reuse `categorizeContent()` from `lib/ai/categorize-content.ts`
- [ ] 2.5 Write results to `firm_content_items` (firm-specific) or `industry_news_items` (general)
- [ ] 2.6 Auto-publish: set `published = true` when `ai_confidence >= 0.75`; else save as draft
- [ ] 2.7 Schedule: add to Vercel cron or call via external scheduler every 15 minutes

---

### Phase 3: Admin API Routes ⬜
**Goal:** Enable the admin upload form that already exists but has no backend.

Steps:
- [ ] 3.1 Create `app/api/admin/content/firm/route.js` — POST: receive content, run AI, write to `firm_content_items`
- [ ] 3.2 Create `app/api/admin/content/industry/route.js` — POST: write to `industry_news_items`
- [ ] 3.3 Create `app/api/v2/propfirms/[id]/content/route.js` — GET: return published content for a firm

---

### Phase 4: Frontend — Company Feed Tab ⬜
**Goal:** Add a "Company Feed" section to `/propfirms/[id]/intelligence` with timeline + promo tabs.

Steps:
- [ ] 4.1 Create `components/propfirms/company-feed/CompanyFeedTab.js` — parent with two sub-tabs
- [ ] 4.2 Create `components/propfirms/company-feed/TimelineItem.js` — single feed item card
- [ ] 4.3 "Timeline" tab shows: `company_news`, `rule_change`, `other` — ordered by date
- [ ] 4.4 "Promotions" tab shows: only `promotion` type
- [ ] 4.5 Add Company Feed section to the intelligence page (below verdict banner or as separate tab)
- [ ] 4.6 Each item shows: date, content_type badge, AI-generated title, ai_summary, source tag (email)

---

### Phase 5: Firm Sender Config ⬜
**Goal:** Maintain a mapping of firm email senders for accurate routing.

Steps:
- [ ] 5.1 Create migration `33_firm_email_senders.sql` — table: `firm_id`, `sender_domain`, `sender_email`
- [ ] 5.2 Seed initial sender mappings for known firms
- [ ] 5.3 Add admin UI or config to update senders

---

## Key Technical Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Gmail auth | OAuth2 refresh token in env | No user-facing auth, works in server environment |
| Polling vs push | Cron polling every 15min | Simpler setup; push requires Cloud Pub/Sub |
| Auto-publish threshold | confidence >= 0.75 | Balance quality vs automation |
| HTML stripping | Strip HTML tags server-side | Keep raw_content readable, avoid noise |
| Dedup | Track `gmail_message_id` in DB | Prevent duplicate ingest on re-runs |

---

## Env Vars Needed (add to `.env`)

```
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REFRESH_TOKEN=
GMAIL_USER_EMAIL=propfirm.monitor@gmail.com
```

---

## Implementation Order

1. Phase 1 (Gmail client) → Phase 2 (cron ingest) → Phase 3 (API routes) → Phase 4 (frontend) → Phase 5 (sender config)
2. Phase 3 can be done in parallel with Phase 2 (different files)
3. Phase 4 depends on Phase 3 API being available

---

## Out of Scope (for now)

- Email attachments / screenshots
- Gmail push notifications (Pub/Sub)
- Unsubscribe handling
- Multi-account Gmail support
