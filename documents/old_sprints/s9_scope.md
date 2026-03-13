# Sprint 9 Scope: Email Pipeline + Public Firm Timelines & Industry News Page

**Goal:**  
1. **Email pipeline** – Receive firms’ marketing emails at a dedicated address, detect sender→firm, categorize/summarize/extract with AI, push to the same queue as S8 (firm content); admin approves for weekly digest.  
2. **Public pages** – Firm timelines (news, rules, promos per firm) and an industry news page for unauthenticated users.

**Cost:** Free or minimal. Resend inbound is free; we already use Resend and OpenAI for S8. No new paid services.

**Deferred to later:** Discord monitoring (lower priority); see [DISCORD-MONITORING-GUIDE.md](./DISCORD-MONITORING-GUIDE.md) when we pick it up.

---

## Part A: Email Pipeline

**Flow:**  
Firm (or we) forwards/BCCs marketing emails to our receiving address (e.g. `firm-news@ourdomain.resend.app`) → Resend receives and sends `email.received` webhook → we verify webhook, fetch full body via Resend API → **detect firm** (sender/domain → firm_id) → **categorize + summarize + extract** (existing S8 AI) → insert into `firm_content_items` as **draft** (`published = false`, `source_type = 'firm_email'`) → admin reviews in existing queue and approves → included in weekly digest.

**Firm detection:**  
Config or table mapping sender email/domain to `firm_id` (e.g. `*@fundingpips.com` → fundingpips, `news@fxify.com` → fxify). If no match, we can still store with `firm_id = null` or a placeholder and let admin assign, or skip and log.

**Success criteria:**  
- Dedicated receiving address and webhook configured in Resend.  
- Webhook endpoint verifies Resend signature, fetches email body, detects firm (when mapped), runs AI, inserts draft.  
- Admin sees new items in existing content review queue and approves as today.  
- All doable with **free Resend inbound** and existing OpenAI usage (minimal extra cost).

---

## Part B: Public Firm Timelines & Industry News Page

**Firm timeline:**  
Public page (or section) per firm showing a **timeline** of published firm content: company news, rule changes, promotions (from `firm_content_items` where `published = true`), optionally with existing Trustpilot incidents. Can live under `/propfirms/[id]/timeline` or extend the existing Intelligence tab with a “Firm updates” block.

**Industry news page:**  
Public page listing published **industry news** (`industry_news_items` where `published = true`), e.g. `/industry-news` or `/propfirms/industry-news`, with filters (date, mentioned firms) and link from nav/footer.

**Success criteria:**  
- Unauthenticated users can view firm timeline and industry news.  
- Data is read-only from existing tables; RLS already allows public read for `published = true`.  
- Clear navigation to these pages from prop firm hub or main nav.

---

## Epics (Summary)

| Epic | What |
|------|------|
| **Email: config & detection** | Table or config for sender/domain → firm_id; admin can add mappings. |
| **Email: webhook & process** | Resend webhook route, verify, fetch body, detect firm, AI, insert draft. |
| **Email: runbook** | How to set up receiving address, webhook URL, and firm sender mapping. |
| **Public: APIs** | Public (or cached) API to list published firm content by firm; API to list published industry news. |
| **Public: Firm timeline** | Page or section for firm content timeline (news, rules, promos). |
| **Public: Industry news page** | Dedicated industry news listing page and nav. |

---

## Out of scope for S9

- Discord bot and channel mapping (moved to backlog).  
- Twitter/Reddit ingestion.  
- Sending outbound email from the same pipeline (we only receive and process).
