# Sprint 11 Tickets — Intelligence Feed UX Improvements

**Sprint Goal:** Make the intelligence feed immediately understandable to a first-time user — clear verdict, simplified signal categories, credible references.

**Context:**
- Scope: [intelligence-feed-scope.md](./intelligence-feed-scope.md)
- PM feedback: [documents/spikes/intelligence-feed-pm-feedback.md](../spikes/intelligence-feed-pm-feedback.md)
- Tech summary: [documents/spikes/intelligence-feed-tech-summary.md](../spikes/intelligence-feed-tech-summary.md)
- Previous sprint: [s10_tickets.md](./s10_tickets.md)

**Story points:** 1, 2, 3

**Deferred to later:** Sidebar live status (S11-001), CTA wiring (S11-005)

---

## TICKET-S11-002: Page-Level Verdict Banner

**Status:** 🔲 Pending
**Priority:** P0
**Story points:** 2

**Description:** First-time users land on a list of cards with no headline answer. Add a verdict banner at the top of the feed that gives an immediate plain-English status based on the incidents already fetched — no extra API call needed.

**Verdict logic (computed client-side from the `incidents` array):**
```
ELEVATED  — any incident with severity === 'high'
MONITORING — no high-severity, but any medium-severity incident exists
STABLE     — no incidents, or all are positive/informational only
```

**Banner content per status:**
- **ELEVATED** (red background `bg-red-50`, red border `border-red-200`):
  - Icon: ⚠ (red)
  - Headline: "Elevated Risk — Active Issues Detected"
  - Body: List up to 2 top incident titles in plain text, e.g. "Allegations of Fraud and Payout Delays · Frustration Over New Trading Rules"
- **MONITORING** (amber background `bg-amber-50`, amber border `border-amber-200`):
  - Icon: ◉ (amber)
  - Headline: "Monitoring — Issues Worth Watching"
  - Body: Same — list up to 2 top incident titles
- **STABLE** (green background `bg-emerald-50`, green border `border-emerald-200`):
  - Icon: ✓ (green)
  - Headline: "Stable — No Major Issues Detected"
  - Body: "No significant risk signals in the last 30 days."

**Acceptance criteria:**
- [ ] New component `components/propfirms/intelligence/VerdictBanner.js` — accepts `{ incidents }` prop (raw API response array, pre-mapping), computes status and renders banner
- [ ] In `app/propfirms/[id]/intelligence/page.js`: render `<VerdictBanner incidents={incidents} />` between the page header and the timeline — only after loading is complete, not during skeleton state
- [ ] When `incidents` is empty: show STABLE banner (not hidden)
- [ ] Banner is compact — max height ~80px, fits without scrolling above the first card
- [ ] No new API call — verdict computed from the existing `incidents` state already fetched
- [ ] Verify: FundedNext (likely ELEVATED based on current data), a firm with no incidents (STABLE)

**Files:** `components/propfirms/intelligence/VerdictBanner.js` (new), `app/propfirms/[id]/intelligence/page.js`

---

## TICKET-S11-003: Simplify to 3 Signal Categories + Visible Legend

**Status:** 🔲 Pending
**Priority:** P0
**Story points:** 2

**Description:** The current 5-category system (OPERATIONAL, REPUTATION, REGULATORY, POSITIVE, INFORMATIONAL) is confusing. REGULATORY generates zero signals. Dot colors don't match badge colors. Users have no explanation of what any of it means.

Collapse to 3 user-facing categories driven by both `incident_type` AND `severity`.

**New category system:**

| New category | When | Dot | Badge style |
|---|---|---|---|
| `RISK` | Any negative incident_type + `high` severity | 🔴 `bg-red-500` | `bg-red-50 text-red-600 border-red-100` label: "Risk Alert" |
| `WATCH` | Any negative incident_type + `medium` or `low` severity; also `neutral_mixed`; also `trustpilot_score_trend` medium | 🟡 `bg-amber-400` | `bg-amber-50 text-amber-600 border-amber-100` label: "Watch" |
| `POSITIVE` | `positive_experience`; also `trustpilot_score_trend` medium (improving) | 🟢 `bg-emerald-500` | `bg-emerald-50 text-emerald-700 border-emerald-100` label: "Positive" |

Negative incident_types (all map to RISK or WATCH based on severity):
`payout_delay`, `payout_denied`, `kyc_withdrawal_issue`, `platform_technical_issue`, `support_issue`, `rules_dispute`, `pricing_fee_complaint`, `execution_conditions`, `high_risk_allegation`, `scam_warning`, `payout_issue`, `platform_issue`, `rule_violation`, `other`, `trustpilot_score_trend` (high → RISK, medium → WATCH)

**Acceptance criteria:**

- [ ] `app/propfirms/[id]/intelligence/types.js` — update `IntelligenceCategory` to `{ RISK, WATCH, POSITIVE }` (remove OPERATIONAL, REPUTATION, REGULATORY, INFORMATIONAL)
- [ ] `app/propfirms/[id]/intelligence/page.js`:
  - Replace `INCIDENT_TYPE_TO_CATEGORY` map with a `getDisplayCategory(incidentType, severity)` function using the logic above
  - Update `incidentToItem()` to pass `severity` into `getDisplayCategory`
  - Update filter `<select>` options: `All Types | Risk Alerts | Watch | Positive` (remove Operational, Reputation, Regulatory, Informational)
  - Add a legend row directly above the card timeline:
    ```
    <span>● Risk Alert</span>  <span>● Watch</span>  <span>● Positive</span>
    ```
    Each dot uses its actual color class. Keep it compact — one line, small text (`text-xs`), grey label text beside each dot.
- [ ] `components/propfirms/intelligence/IntelligenceCard.js`:
  - Update `CATEGORY_MAP` to 3 entries matching the new system
  - Dot color: `RISK → bg-red-500`, `WATCH → bg-amber-400`, `POSITIVE → bg-emerald-500`
  - Dot color must now match the badge color (no more blue badge + amber dot mismatch)
- [ ] Verify on `/propfirms/fundednext/intelligence`:
  - High-severity fraud/payout incidents show red dot + "Risk Alert" badge
  - Support delay incidents show amber dot + "Watch" badge
  - No "Operational", "Reputation", "Regulatory", "Informational" badges appear anywhere
  - Legend is visible above the first card
  - Filter dropdown has 3 options (not 5); selecting "Risk Alerts" returns only red-dot cards

**Files:** `app/propfirms/[id]/intelligence/types.js`, `app/propfirms/[id]/intelligence/page.js`, `components/propfirms/intelligence/IntelligenceCard.js`

---

## TICKET-S11-004: Add Star Rating + Date to Reference Pills

**Status:** 🔲 Pending
**Priority:** P1
**Story points:** 1

**Description:** Source reference pills currently show "Trustpilot Review #1...#6" with no context. The review's star rating and date are available in the DB but not surfaced. Adding them makes each reference immediately more meaningful — a "★1 · Feb 27" pill tells a story without clicking.

**Changes required:**

**Backend — `app/api/v2/propfirms/[id]/incidents/route.js`:**
- In the `firm_trustpilot_reviews` select (line ~111), add `rating` to the selected columns:
  ```js
  .select('id, trustpilot_url, review_date, rating')
  ```
- In `idToInfo` map, store `rating` alongside `url` and `review_date`:
  ```js
  idToInfo = Object.fromEntries(
    reviewRows.map((row) => [row.id, { url: row.trustpilot_url, review_date: row.review_date || null, rating: row.rating ?? null }])
  );
  ```
- In the `source_links` map, include `rating`:
  ```js
  return { url: info.url, date: info.review_date || null, rating: info.rating ?? null };
  ```

**Frontend — `app/propfirms/[id]/intelligence/page.js`:**
- In `incidentToItem()`, each source object already maps `item` (which is `{ url, date, rating }`). Pass `rating` through to the source:
  ```js
  return { id, label, url, type: 'web', domain, date: sourceDate, rating: item.rating ?? null };
  ```

**Frontend — `components/propfirms/intelligence/IntelligenceCard.js`:**
- In the reference pill rendering, add rating + date inline before or after the label:
  ```jsx
  <a ...>
    <SourceLinkIcon />
    {source.rating != null && <span className="text-slate-400">★{source.rating}</span>}
    <span>{source.label}</span>
    {source.date && <span className="text-slate-300">· {source.date.slice(5)}</span>} {/* "02-27" */}
  </a>
  ```
  - Show `★1` in `text-red-400` (1–2 stars), `★3` in `text-slate-400` (3 stars), `★5` in `text-emerald-500` (4–5 stars)
  - Date format: `MM-DD` (e.g. "02-27") — short, fits in pill
  - If both are null (e.g. `trustpilot_score_trend` has no review_ids): pill shows label only, no change

**Acceptance criteria:**
- [ ] API response `source_links` objects now include `rating: number | null`
- [ ] Pills on the card show star rating colored by score (red=1-2, grey=3, green=4-5) and short date
- [ ] Pills with no rating/date (e.g. score trend signal) render correctly without breaking
- [ ] No layout overflow — pills remain on one or two lines without breaking the card width

**Files:** `app/api/v2/propfirms/[id]/incidents/route.js`, `app/propfirms/[id]/intelligence/page.js`, `components/propfirms/intelligence/IntelligenceCard.js`

---

## TICKET-S11-006: Fix "Updated hourly" Footer Copy

**Status:** 🔲 Pending
**Priority:** P2
**Story points:** 0

**Description:** The footer reads "Intelligence Layer • Updated hourly" — this is inaccurate. Incidents run daily, weekly reports run weekly.

**Acceptance criteria:**
- [ ] `app/propfirms/[id]/intelligence/page.js` last line of the footer: change "Updated hourly" → "Updated daily"

**Files:** `app/propfirms/[id]/intelligence/page.js`

---

## Implementation Order

```
Day 1:   S11-006  (copy fix, 5 min, do first to unblock QA)
Day 1-2: S11-003  (category simplification — touches 3 files, needs care)
Day 2:   S11-002  (verdict banner — new component, uses existing data)
Day 3:   S11-004  (reference pills — backend + frontend change)
```

S11-003 before S11-002: the banner uses the new `incidents` array, but the verdict logic (ELEVATED/MONITORING/STABLE) is based on severity, not category — so order doesn't strictly matter. However, doing S11-003 first means the QA pass for S11-002 sees the final badge system.

---

## Summary

| Ticket | Title | Points | Priority |
|--------|-------|--------|----------|
| S11-002 | Page-level verdict banner | 2 | P0 |
| S11-003 | Simplify to 3 categories + legend | 2 | P0 |
| S11-004 | Star rating + date on reference pills | 1 | P1 |
| S11-006 | Fix "updated hourly" copy | 0 | P2 |

**Total: 5 points**
