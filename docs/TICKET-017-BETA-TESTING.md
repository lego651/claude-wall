# TICKET-017: Beta Testing & Feedback

**Owner:** PM  
**Estimate:** 4 hours  
**Priority:** P1 (High)

## Goal

Recruit beta testers and gather structured feedback before scaling.

## Acceptance Criteria

- [ ] **Recruit 10–20 beta testers**
  - Reddit: r/Forex, r/Daytrading (get mod approval first)
  - Twitter: Tweet + signup link (e.g. `/propfirms` or landing CTA)
  - Discord: Prop trading servers
- [ ] **Send preview email** with a sample weekly report (use test digest or `scripts/send-test-digest.ts`).
- [ ] **Survey** (Google Form, Typeform, or similar):
  - Is this valuable? (1–10)
  - Too long / too short?
  - What’s missing?
  - Would you open this every week?
  - What other data sources do you want? (Reddit, Twitter, etc.)
- [ ] **Collect feedback** in a spreadsheet (link survey results, tag by source).
- [ ] **Prioritize top 3 requests** for Beta roadmap (e.g. in a Beta backlog).

## Success Criteria

- 50+ beta signups
- Average rating 7+/10
- At least 3 positive testimonials

## Dependencies

- Weekly digest and subscribe flow live (TICKET-012–016).
- Optional: `TEST_DIGEST_TO` / test digest script for preview emails.
