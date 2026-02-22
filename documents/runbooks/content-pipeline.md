# Content Pipeline Runbook (Sprint 8)

This runbook describes the **firm content and industry news pipeline**: manual upload → AI categorization → admin review → weekly digest. All content is stored in Supabase; the weekly digest (Sunday 8:00 UTC) includes published items for the current week.

---

## Overview

The content pipeline ingests:

1. **Firm content** – Company news, rule changes, promotions for a specific firm (from emails, Discord, etc.).
2. **Industry news** – Industry-wide news (regulations, multi-firm events) with optional firm mentions.

Flow: **Upload (admin UI or API) → AI categorization → Save as draft → Admin review → Publish → Included in next digest.**

---

## Content Types

### Firm content (`firm_content_items`)

| Type           | When to use |
|----------------|-------------|
| **company_news** | New features, partnerships, platform announcements |
| **rule_change**  | Changes to trading rules, drawdown, terms, account policies |
| **promotion**    | Discounts, competitions, special offers, affiliate bonuses |
| **other**        | Anything that doesn’t fit above |

### Industry news (`industry_news_items`)

- Regulatory updates (e.g. FCA, SEC).
- Events affecting multiple firms (e.g. payout suspensions, market changes).
- No single `firm_id`; use `mentioned_firm_ids` (AI-extracted or manual) to link to firms.

---

## Uploading Content

### Via admin UI

1. Go to **`/admin/content/upload`** (admin only).
2. Choose tab: **Firm Content** or **Industry News**.
3. Fill the form:
   - **Firm** (firm content only) – e.g. `fundingpips`, `fxify`.
   - **Content type** (firm) – company_news / rule_change / promotion / other.
   - **Title** – short headline.
   - **Full text** – paste from Discord, email, blog, etc.
   - **Source type** – manual_upload, firm_email, discord, twitter, reddit, blog, other.
   - **Source URL** (optional).
   - **Content date** – date the content refers to (used for digest week).
   - **Screenshot** (optional) – file upload (Vercel Blob).
4. Click **Process with AI** – calls OpenAI to get category, summary, confidence, tags (and for industry news: `mentioned_firm_ids`).
5. Review the AI result, then:
   - **Save as draft** – stored with `published = false` (pending review).
   - **Approve & publish** – `published = true` (included in next digest).

### Via API (admin auth required)

**Firm content**

```bash
POST /api/admin/content/firm
Content-Type: application/json

{
  "firm_id": "fundingpips",
  "content_type": "company_news",
  "title": "Instant payouts live",
  "raw_content": "We're excited to announce...",
  "source_type": "manual_upload",
  "source_url": "https://...",
  "content_date": "2026-02-21"
}
```

**Industry news**

```bash
POST /api/admin/content/industry
Content-Type: application/json

{
  "title": "UK regulation update",
  "raw_content": "FCA requires prop firms to...",
  "source_type": "regulatory",
  "source_url": "https://...",
  "content_date": "2026-02-20"
}
```

Both endpoints run AI categorization and return the created row (with `ai_summary`, `ai_category`, `ai_confidence`, `ai_tags`; industry also has `mentioned_firm_ids`). New rows are saved with `published = false` unless you later PATCH to set `published: true`.

---

## AI categorization

- **Service:** `lib/ai/categorize-content.ts` (OpenAI).
- **Model:** GPT-4o-mini (cost-effective).
- **Output:** `ai_category`, `ai_summary`, `ai_confidence` (0–1), `ai_tags` (keywords). For industry news, `mentioned_firm_ids` (e.g. `["fundingpips", "apex"]`).
- **Confidence:** No hard cutoff; &lt;0.5 suggests ambiguous content – review before publishing.

---

## Approval workflow

1. **Upload** → row created with `published = false`.
2. **Review** – use **`/admin/content/weekly-review`** to pick a week and see pending + published items; use **Approve** (or bulk approve) to set `published = true` and `published_at = now()`.
3. **Publish** → item is included in the next weekly digest for that week’s date range.

Optional: approve or edit via API:

- `PATCH /api/admin/content/firm/:id` or `/api/admin/content/industry/:id` with `{ "published": true }`.
- `DELETE /api/admin/content/firm/:id` or `.../industry/:id` to remove.

---

## Weekly digest integration

- **When:** Sunday 8:00 UTC (same cron as Trustpilot-based digest): `weekly-step2-send-firm-weekly-reports.yml` → `GET /api/cron/send-weekly-reports`.
- **Data:** Digest builder uses `lib/digest/weekly-cache.ts` and `lib/digest/content-aggregator.ts`:
  - **Firm content:** `firm_content_items` with `published = true` and `content_date` in the current week (Mon–Sun UTC), per user’s subscribed firms.
  - **Industry news:** `industry_news_items` with `published = true` and `content_date` in the same week (top items by date).
- **Email:** `lib/email/weekly-digest-html.ts` renders:
  - An **Industry news** section (before firm sections).
  - Per-firm: **Company news**, **Rule changes**, **Promotions**, then Trustpilot incidents and analysis.

---

## Admin dashboard metrics (S8-012)

- **`GET /api/admin/metrics`** includes **`contentStats`**:
  - `firm_content_pending` / `industry_news_pending`
  - `firm_content_published_this_week` / `industry_news_published_this_week`
  - `by_type` – counts for company_news, rule_change, promotion for the current week.
- **Dashboard:** Firms → Weekly 2 – Digest shows a **Content pipeline** panel with pending count, published-this-week count, and links to **Review queue** (`/admin/content/weekly-review`) and **Upload** (`/admin/content/upload`).

---

## Troubleshooting

### AI categorization fails

- Ensure **`OPENAI_API_KEY`** is set in `.env`.
- Check OpenAI quota/rate limits.
- Retry with a shorter or simplified `raw_content`.

### Screenshot upload fails

- Ensure **`BLOB_READ_WRITE_TOKEN`** (Vercel Blob) is set.
- Keep file size under ~5 MB.
- Check Vercel Blob dashboard for errors.

### Content not in digest

- Confirm **`published = true`** and **`published_at`** set.
- Ensure **`content_date`** falls in the digest week (Mon–Sun UTC).
- For firm content, confirm the user is subscribed to that firm and email is enabled.

### Industry news: mentioned firms wrong or missing

- AI may miss or mis-label firm names. Edit **`mentioned_firm_ids`** in Supabase if needed (array of firm IDs, e.g. `fundingpips`, `apex`).

### Database tables

- **Firm content:** `migrations/26_firm_content_items.sql`
- **Industry news:** `migrations/27_industry_news_items.sql`

RLS: public can read only where `published = true`; only admins can insert/update/delete.
