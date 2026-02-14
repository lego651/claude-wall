# Intelligence UI & daily incidents – take and checklist

**Context:** AI-classified data is in DB. Screenshots show Firm Signals (30d), Recent Intelligence, and an Intelligence Layer page. You asked whether to move from weekly to daily incidents and how the UI should look.

---

## 1. Cron: run incident detection daily (recommended)

**Current behavior:** Incidents are produced only when the weekly report runs (Monday cron → `send-weekly-reports` API → `generateWeeklyReport` → `detectIncidents`). So the “current week” is at most refreshed once per week.

**Recommendation:** Run incident detection **daily** (e.g. after the classifier) so the dashboard always shows up-to-date “Recent Intelligence.”

**Concrete approach:**

- **Keep schema:** Still store incidents in `weekly_incidents` with `(firm_id, week_number, year)`. No schema change.
- **Daily job:** Add a cron (e.g. GitHub Action or Vercel cron) that runs **once per day** (e.g. 5 AM PST, after scraper + classifier):
  1. For each supported firm, compute **current week** bounds (Mon–Sun).
  2. Call `detectIncidents(firmId, weekStart, weekEnd)` for that week.
  3. Existing logic already **deletes** that firm+week’s rows and **re-inserts**; so we just re-run for the current week every day.
- **Effect:** “Recent Intelligence” and “Incident & Event Log” always reflect the latest 7 days of classified reviews, without changing weekly report or email semantics.

**Optional:** Run incident detection for a **rolling last-7d** window instead of calendar week; that would require passing a custom date range and still writing results into the current week (or a separate “recent” store). For v1, re-running current-week detection daily is enough.

---

## 2. UI: what the screenshots imply vs what we have

### 2.1 Firm Signals (30d) – Overview

- **PAYOUT DATA:** “Steady Activity” – we have payout series; can derive “consistent daily volume,” “high transaction velocity” from existing payout APIs.
- **TRUSTPILOT:** “Mostly Positive” + bullets (“Fast Payouts,” “Reliable customer support”) – we have `trustpilot_reviews` with `category`, `ai_summary`, sentiment. We can aggregate last 30d: count by category, derive “mostly positive” and pull representative themes from `ai_summary` or categories (e.g. support_issue, positive_experience).
- **X (TWITTER):** We **don’t** have Twitter data yet. Options: hide the card, or show a “Coming soon” / placeholder with no bullets.

**Data:** One read of classified reviews for the firm in last 30d; optional payout summary from existing APIs. No new backend tables.

### 2.2 Recent Intelligence – Overview

- List of incidents: type (OPERATIONAL / REPUTATION), date, title, one-line description.
- **Data:** `weekly_incidents` (and daily refresh as above). We have `incident_type`, `title`, `summary`, `severity`, `review_count`, `week_number`, `year`, `created_at`. We can derive a **display date** from week (e.g. week start) or `created_at`. Map `incident_type` to OPERATIONAL vs REPUTATION (e.g. platform_technical_issue, support_issue → OPERATIONAL; high_risk_allegation, rules_dispute, kyc_withdrawal_issue → REPUTATION; or keep a small mapping table).

**API:** e.g. `GET /api/v2/propfirms/[id]/incidents?days=30` (or use existing report JSON if it already includes incidents).

### 2.3 Intelligence Layer page (new)

- **Signal Deep Dive (30d):** Same as Firm Signals – PAYOUT DATA, TRUSTPILOT, X (TWITTER). Again Trustpilot from DB; X placeholder or hidden.
- **Incident & Event Log (90 days):** List incidents with type, date, title, description, “Linked Evidence,” “Confidence.”
  - **Data:** `weekly_incidents` for the firm, filter by week such that week falls in last 90 days. We have `review_ids`; “Linked Evidence” could be “Trustpilot” + link to firm’s Trustpilot page (or, later, per-review links if we store `trustpilot_url` and expose it). Confidence: we have `severity` (low/medium/high); we could show as “CONF: HIGH/MEDIUM/LOW” or derive a confidence label from severity.

**API:** Same incidents endpoint, with `days=90` and enough fields (type, date, title, summary, severity/review_count, optional review_ids/links).

---

## 3. Implementation checklist (concise)

| Item | Action |
|------|--------|
| **Daily incidents** | Add daily cron (e.g. after classifier) that for each firm runs `detectIncidents(firmId, currentWeekStart, currentWeekEnd)` and relies on existing delete+insert for that firm+week. |
| **API: incidents** | Add `GET /api/v2/propfirms/[id]/incidents?days=30|90` (or extend existing report/chart API) returning list of incidents with display date, type (OPERATIONAL/REPUTATION), title, summary, severity/confidence, optional link. |
| **API: firm signals (30d)** | Add `GET /api/v2/propfirms/[id]/signals?days=30` (or equivalent) returning payout summary + Trustpilot aggregate (sentiment, top categories/themes); omit or placeholder X/Twitter. |
| **Overview UI** | “Firm Signals (30d)” section using signals API; “Recent Intelligence” section using incidents API (e.g. last 7 or 30 days). |
| **Intelligence Layer page** | New route (e.g. `/propfirm/[id]/intelligence` or tab under existing firm page) with Signal Deep Dive (30d) and Incident & Event Log (90d), using same APIs. |
| **Copy** | Add “Signals are derived from observed trends and reported events based on sampled public sources” (or similar) where needed. |

---

## 4. Summary

- **Cron:** Yes, run incident detection **daily** for the current week so “Recent Intelligence” and the Intelligence Layer are always up to date. Keep storing in `weekly_incidents`; no schema change.
- **UI:** Build Firm Signals (30d) and Recent Intelligence from existing classified data + payout data; add the new Intelligence Layer page with Signal Deep Dive (30d) and Incident & Event Log (90d). Use Trustpilot only for now; X/Twitter as placeholder or “Coming soon.”
- **APIs:** Add (or extend) endpoints for incidents and for firm signals so the Overview and Intelligence Layer can be implemented as in the screenshots.
