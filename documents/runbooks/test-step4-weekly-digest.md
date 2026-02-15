# Test Plan: Step 4 – Weekly Digest (Send Weekly Reports)

**Goal:** Verify the weekly digest flow end-to-end: reports generated → API called → emails sent.

**Prerequisites:** Steps 1–3 have run (scraper, classify, incidents). You need `weekly_reports` for **last week** (Mon–Sun UTC) for at least one firm, and at least one user with `email_enabled` subscription and a valid email in `profiles`.

---

## 1. Prepare data

### 1.1 Generate last week’s reports (required for digest content)

The digest reads from `weekly_reports` for the **previous** ISO week. Populate it by running:

```bash
# From repo root, with .env loaded (Supabase + OPENAI_API_KEY for "Our Take")
npx tsx scripts/generate-weekly-reports-last-week.ts
```

- Uses the same “last week” as the cron (Monday 14:00 UTC): the week that contains (today − 7 days).
- Generates one row per firm (with Trustpilot) in `weekly_reports` for that week.
- Optional: `REPORT_FIRM_IDS=fundingpips,the5ers` to limit to specific firms.

**Check:** In Supabase, `weekly_reports` has rows for last week:

```sql
SELECT firm_id, week_number, year, generated_at
FROM weekly_reports
ORDER BY generated_at DESC
LIMIT 20;
```

### 1.2 Ensure at least one digest recipient

- **User:** Has a row in `profiles` with a valid `email` you can receive at.
- **Subscription:** `user_subscriptions` has at least one row with `email_enabled = true` for that user and a `firm_id` that has a report in `weekly_reports` for last week.

Example (Supabase SQL):

```sql
-- Create or reuse a user (user_id from auth.users)
INSERT INTO user_subscriptions (user_id, firm_id, email_enabled)
VALUES ('<your-auth-user-uuid>', 'fundingpips', true)
ON CONFLICT (user_id, firm_id) DO UPDATE SET email_enabled = true;
```

Ensure `profiles` has `email` set for that `user_id` (sign up or update profile).

---

## 2. Call the digest API

The route is **GET** (not POST). Use the same `CRON_SECRET` as in Vercel / GitHub.

### 2.1 Local

```bash
# .env must have CRON_SECRET and RESEND_API_KEY (and Supabase)
curl -s -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/cron/send-weekly-reports"
```

With dev server running: `npm run dev` then run the curl above.

### 2.2 Staging / production

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" "https://<your-app>/api/cron/send-weekly-reports"
```

Or trigger the workflow: **Actions → Step 4 – Send Weekly Reports (Weekly)** → **Run workflow** (branch e.g. `main`).

---

## 3. Verify

### 3.1 API response

- **200** with JSON, e.g.:
  - `sent`: number of emails sent
  - `failed`: count of failures
  - `skipped`: users with no reports for their firms
  - `errors`: sample of errors (if any)
  - `weekStart`, `weekEnd`: last week dates
  - `durationMs`

**No subscribers:** `sent: 0`, possible `message: "No active subscribers"`.  
**Subscribers but no reports for their firms:** `skipped` > 0, `sent` may be 0.  
**Success:** `sent` ≥ 1.

### 3.2 Resend

- [Resend](https://resend.com) → **Logs** (or **Emails**): confirm one send per recipient, status delivered (or opened).

### 3.3 Admin dashboard

- **Intelligence feed** section: “Last run of the digest cron” shows last run time and result (from `cron_last_run`).
- **Last week** coverage: firms with report vs expected; gaps explain `skipped` if a user’s firms have no report.

### 3.4 Database

```sql
SELECT * FROM cron_last_run WHERE job_name = 'send_weekly_reports';
```

`result_json` should match the API response (e.g. `sent`, `failed`, `weekStart`, `weekEnd`).

---

## 4. Optional: dry run (no email)

To test the API path and DB updates without sending email, you can temporarily point `RESEND_API_KEY` at a test key or mock, or use a test recipient in Resend’s test mode. The script above does not send email; only the API sends via `sendWeeklyDigest` → Resend.

---

## 5. Checklist summary

- [ ] Run `scripts/generate-weekly-reports-last-week.ts` (or ensure `weekly_reports` has last week for at least one firm).
- [ ] At least one user has `profiles.email` and `user_subscriptions.email_enabled = true` for a firm with a report.
- [ ] Call `GET /api/cron/send-weekly-reports` with `Authorization: Bearer $CRON_SECRET`.
- [ ] Response 200, `sent` ≥ 1 (or `skipped`/`message` as expected).
- [ ] Resend logs show delivery.
- [ ] `cron_last_run` and admin dashboard show last run and result.

---

**Runbook fix:** In [daily-scraper-weekly-incidents-reports-operations.md](./daily-scraper-weekly-incidents-reports-operations.md), the example curl uses `-X POST`; the route is **GET**. Use:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" "https://<your-app>/api/cron/send-weekly-reports"
```
