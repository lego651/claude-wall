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
- [ ] Phase 2: Ingest pipeline — cron route + orchestrator
- [ ] Migration 33: add `external_id` to `firm_content_items` for dedup

---

## Errors / Blockers

None yet.
