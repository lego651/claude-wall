# Progress Log: Gmail Ingest → Firm Content Timeline

## Session 1 — 2026-03-09

### Completed
- [x] Explored codebase: DB schema, AI layer, admin UI, cron system, frontend
- [x] Created task_plan.md, findings.md, progress.md
- [x] Identified all gaps and existing reusable pieces

### Decisions Made
- Use Gmail API OAuth2 (not IMAP)
- Store refresh token in env vars
- Use `cron_last_run` table to track last Gmail sync timestamp
- Auto-publish when `ai_confidence >= 0.75`
- Add `external_id` column to `firm_content_items` for Gmail message ID dedup
- Use `googleapis` npm package for Gmail API calls

### Next Steps
- [x] Start Phase 1: Gmail client + parser
- [x] Run `npm install googleapis`
- [x] Set up Gmail OAuth credentials

---

## Session 2 — 2026-03-10

### Completed
- [x] Phase 1.1–1.2: OAuth credentials set up, refresh token obtained, added to .env
- [x] Phase 1.3: `lib/gmail/client.ts` — Gmail API wrapper (listMessageIds, getMessage)
- [x] Phase 1.4: `lib/gmail/parser.ts` — HTML stripper, sender/domain extractor, date parser
- [x] Phase 1.5: `lib/gmail/firm-mapper.ts` — static domain→firm_id map

### Next Steps
- [x] Phase 2: Ingest pipeline — cron route + orchestrator
- [x] Migration 33: add `external_id` to `firm_content_items` for dedup

---

## Session 3 — 2026-03-10

### Completed
- [x] Migration `33_add_external_id_to_firm_content_items.sql` — `external_id` + unique index for dedup
- [x] `lib/gmail/ingest.ts` — orchestrator: fetch → parse → map firm → AI categorize → insert with dedup + auto-publish
- [x] `scripts/ingest-firm-emails.ts` — standalone script (loads `.env`, calls ingest, exits 1 on errors)
- [x] `.github/workflows/ingest-firm-emails.yml` — runs every 15 min via GitHub Actions schedule

### Decisions Made
- GitHub Actions schedule (not Vercel cron) — consistent with rest of pipeline
- Script exits with code 1 if any errors, so GitHub Actions marks the run as failed
- `industry_news` AI category maps to `other` content_type (DB constraint only allows firm-specific types)

### Next Steps
- [x] Phase 3: Admin API routes — already existed; only missing piece was public GET endpoint
- [x] Add GitHub Actions secrets: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_USER_EMAIL

---

## Session 4 — 2026-03-10

### Completed
- [x] Phase 3 audit: POST/PATCH/DELETE admin routes for firm + industry already fully implemented
- [x] `app/api/v2/propfirms/[id]/content/route.js` — GET: published firm content (type/limit/days filters)

### Next Steps
- [ ] Phase 4: Frontend — Company Feed Tab on intelligence page

---

## Errors / Blockers

None yet.
