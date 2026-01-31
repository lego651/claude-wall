# TICKET-015: Email Delivery Integration

Resend integration for **one aggregated weekly digest email per user** (not per firm). Each user gets one email containing reports for all firms they follow.

## Implemented

- **`lib/email/send-digest.ts`**
  - `sendWeeklyDigest(user, reports[], options)` – builds HTML from TICKET-011 template (multiple firm sections), creates unsubscribe token, sends via Resend, updates `last_sent_at` on `firm_subscriptions` for that user.
  - `user`: `{ id, email }` (from auth).
  - `reports`: array of `report_json` from `weekly_reports` (shape: `WeeklyReportJson`).
  - `options`: `{ weekStart, weekEnd, baseUrl }`.
  - From address: `process.env.DIGEST_FROM_EMAIL` or `PropProof <reports@propproof.com>`.
  - Subject: `Your Weekly PropProof Digest - Week of [Date]`.

- **`lib/email/unsubscribe-token.ts`**
  - `createUnsubscribeToken(userId, expSeconds)` – signed token (HMAC-SHA256) for unsubscribe link.
  - `verifyUnsubscribeToken(token)` – returns `userId` or `null`.
  - Secret: `DIGEST_UNSUBSCRIBE_SECRET` or fallback `RESEND_API_KEY`.

- **`app/api/unsubscribe/route.js`**
  - `GET /api/unsubscribe?token=xxx` – verifies token, sets `email_enabled = false` on all `firm_subscriptions` for that user (service role), redirects to `/settings?unsubscribed=1`. On error: `/settings?error=missing_token|invalid_token|update_failed`.

- **`libs/resend.ts`**
  - `sendEmail()` now accepts optional `from` (overrides `config.resend.fromNoReply`).

## Environment

- `RESEND_API_KEY` – required for sending (already in `.env.example`).
- `DIGEST_FROM_EMAIL` (optional) – e.g. `PropProof <reports@propproof.com>`; verify domain in Resend.
- `DIGEST_UNSUBSCRIBE_SECRET` (optional) – for unsubscribe token signing; falls back to `RESEND_API_KEY`.

## How to test and verify it's done

### Prerequisites

- `.env` has `RESEND_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- At least one user has signed in and has a profile with email.
- That user follows at least one firm (subscription in `firm_subscriptions` with `email_enabled = true`).
- At least one weekly report exists for that week for a firm they follow.

### Option A: Test script (send one digest to a subscriber)

1. **Generate a report** for a firm and week (if you don’t have one yet):
   ```bash
   npx tsx scripts/run-weekly-report.ts fundednext 2026-01-27
   ```
2. **Follow that firm** with your account: sign in → go to `/propfirm/fundednext` → click “Follow (Free)”.
3. **Send a test digest** to the first user who has subscriptions:
   ```bash
   npx tsx scripts/send-test-digest.ts 2026-01-27
   ```
   Or without a date (uses last week):
   ```bash
   npx tsx scripts/send-test-digest.ts
   ```
4. **Check inbox** for the digest (subject: “Your Weekly PropProof Digest - Week of …”). Open the email and confirm:
   - HTML renders with firm section(s), payouts, Trustpilot, incidents, “Our Take”.
   - “Manage subscriptions” and “Unsubscribe” links are present.
5. **Test unsubscribe:** click “Unsubscribe” in the email. You should be redirected to `/settings?unsubscribed=1`. In Settings → Weekly Digest, confirm that digest is disabled (or that you’re no longer receiving).

### Option B: Unsubscribe link only

1. Get a valid token (e.g. after sending a digest, or create one in code via `createUnsubscribeToken(userId)`).
2. Open: `http://localhost:3000/api/unsubscribe?token=YOUR_TOKEN`
3. Expect redirect to `/settings?unsubscribed=1` and `email_enabled = false` for that user’s subscriptions.
4. Invalid or missing token should redirect to `/settings?error=invalid_token` or `?error=missing_token`.

### Quick checklist

| Check | How |
|-------|-----|
| Digest sends | Run `send-test-digest.ts`; email arrives. |
| HTML looks correct | Open email; sections and links present. |
| Unsubscribe works | Click Unsubscribe → redirect to settings; digest disabled. |
| Invalid token | Visit `/api/unsubscribe?token=bad` → redirect with error. |
| last_sent_at updated | After send, query `firm_subscriptions` for that user; `last_sent_at` is set. |

## Dependencies

- TICKET-011 (HTML email template).
