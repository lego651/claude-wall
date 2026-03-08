# Intelligence Feed — Tech Summary (Tech Lead Reference)

Last updated: 2026-03-07

---

## What the page does

`/propfirms/[id]/intelligence` is a client-rendered feed of aggregated signals for a single prop trading firm. It pulls from our incident detection pipeline (Trustpilot review clustering via AI) and presents them as a timeline of cards.

---

## Data pipeline

```
Daily (GitHub Actions cron):
  firm_trustpilot_reviews
      → classified by OpenAI (category, severity, ai_summary)
      → grouped by normalized category (e.g. payout_delay, support_issue)
      → if group ≥ 3 reviews in 7d → incident detected
      → stored in firm_daily_incidents (published = true by default)
      → S10-010: score trend check also runs here
          → if weekly avg deviates >0.5 from overall for 2 consecutive weeks
          → appends trustpilot_score_trend incident to same batch

Weekly (Sunday 7:00 UTC):
  firm_daily_incidents + firm_trustpilot_reviews + payout JSON
      → compiled into firm_weekly_reports (report_json JSONB)
```

---

## Signal taxonomy (current)

### 5 display categories (frontend)

| Category | Badge color | Dot color | Logic |
|----------|-------------|-----------|-------|
| POSITIVE | Green | Green (emerald-500) | incident_type = `positive_experience` |
| OPERATIONAL | Blue | Amber (amber-400) | platform/support/payout/KYC/execution issues |
| REPUTATION | Amber | Red (red-500) if HIGH confidence, else Amber (amber-400) | rules disputes, fraud allegations, pricing complaints |
| INFORMATIONAL | Grey | Grey (slate-400) | incident_type = `neutral_mixed` |
| REGULATORY | Grey | Amber (amber-400) | currently unused — no source generates this type |

### Dot color logic (IntelligenceCard.js)
```
POSITIVE → emerald-500 (green)
INFORMATIONAL → slate-400 (grey)
REPUTATION + HIGH confidence → red-500 (red)
everything else → amber-400 (yellow)
```

**The dot colors do not match the badge colors.** This is a known UX inconsistency — OPERATIONAL badge is blue but dot is amber; REPUTATION badge is amber but dot can be red.

### 12 backend incident types → 5 display categories

| Backend type | Display category |
|---|---|
| platform_technical_issue | OPERATIONAL |
| support_issue | OPERATIONAL |
| payout_delay | OPERATIONAL |
| payout_denied | OPERATIONAL |
| kyc_withdrawal_issue | OPERATIONAL |
| execution_conditions | OPERATIONAL |
| high_risk_allegation | REPUTATION |
| scam_warning | REPUTATION |
| rules_dispute | REPUTATION |
| pricing_fee_complaint | REPUTATION |
| payout_issue (legacy) | REPUTATION |
| platform_issue (legacy) | REPUTATION |
| rule_violation (legacy) | REPUTATION |
| other | REPUTATION |
| positive_experience | POSITIVE |
| neutral_mixed | INFORMATIONAL |
| trustpilot_score_trend | REPUTATION |

REGULATORY category exists in the frontend type enum but **no backend incident type maps to it**. It is dead code.

---

## API

### `GET /api/v2/propfirms/[id]/incidents?days=30&limit=8`

Returns incidents ranked by composite score:
```
score = severity_weight + review_count + recency_boost
severity_weight: high=3, medium=2, low=1
recency_boost: +1 if evidence_date within last 7 days
```

Response fields used on the page:
- `id`, `incident_type`, `severity`, `title`, `summary`
- `evidence_date` (most recent review date), `week_start`
- `source_links[]` — array of `{ url, date }` (up to 6 shown)
- `review_count` — used for ranking, not displayed

### `GET /api/v2/propfirms/[id]/trustpilot-trend`

Returns 8 weeks of weekly avg ratings + overall score from `firm_profiles`. Powers the sidebar sparkline.

---

## Sidebar (PropFirmSidebar.js)

| Section | Status |
|---------|--------|
| Firm logo, name, website | Dynamic — from firm_profiles |
| Intelligence Status heading + "Stable" badge | **Hardcoded** |
| Payout signal text | **Hardcoded static copy** |
| Trustpilot signal text | **Hardcoded static copy** |
| Social signal text | **Hardcoded static copy** |
| Trustpilot Trend sparkline | Live — fetches from /trustpilot-trend API |
| "View full analytics" link | Links to intelligence page (self-referential if on intelligence tab) |
| Signal Alert CTA | Button is non-functional (no notification system wired) |

---

## Known gaps / tech debt

1. **REGULATORY category** — exists in type enum and filter dropdown but nothing generates it. Dead option in the UI.
2. **Sidebar status copy is hardcoded** — "Consistent daily payout volume with high velocity" is the same for every firm.
3. **"Stable" badge is hardcoded** — not computed from actual signal data.
4. **Filter icon button is non-functional** — renders but has no onClick handler / behavior.
5. **Dot color ≠ badge color** — the visual language is inconsistent (blue OPERATIONAL badge, amber dot).
6. **review_count not shown on card** — used internally for ranking but not exposed to user.
7. **Only Trustpilot as source** — all `source_links` are Trustpilot reviews. Twitter/X data ingested but not shown as card references yet.
8. **"Trustpilot Review #1...#6" labels** — references are titled sequentially, not by content.
9. **No legend or key** — no explanation of what dots mean or the difference between categories.
10. **"Updated hourly" footer copy** — inaccurate; pipeline runs daily for incidents, weekly for reports.
