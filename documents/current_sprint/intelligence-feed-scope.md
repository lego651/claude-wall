# Intelligence Feed — Redesign Scope

Based on: PM feedback (intelligence-feed-pm-feedback.md) + tech summary (intelligence-feed-tech-summary.md)
Status: Draft — needs prioritization

---

## User Persona

**The Cautious Prop Trader** — has passed or is considering a challenge. Wants one clear answer before risking money: *"Is this firm paying people right now, and are there any red flags?"*

---

## Core Value (what this page must deliver in 3 seconds)

> A clear, trustworthy verdict on whether a prop firm is safe to trade with right now — backed by evidence a user can inspect.

---

## Proposed Changes

---

### ~~S11-001: Replace Hardcoded Sidebar with Live Status~~ — Deferred
Ideas in progress, not in this sprint.

---

### S11-002: Add Page-Level Verdict Banner
**Priority: P0**
**Effort: 2 points**

**Problem:** First-time users have no summary. They see a list of cards with no headline answer.

**What to build:**
- At the top of the intelligence feed, above the cards, add a verdict row:
  - Icon + status (STABLE / MONITORING / ELEVATED) in large text
  - 1–2 sentence plain-English summary: "FundedNext has 2 active risk signals this month. Payout delays and rules disputes are the most reported issues."
  - Summary generated from the top incidents (can be template-based, no AI needed)
- Color-coded background: light green (stable), light amber (monitoring), light red (elevated)

**Files:** `app/propfirms/[id]/intelligence/page.js` (add VerdictBanner component above the timeline)

---

### S11-003: Simplify to 3 Signal Categories + Legend
**Priority: P0**
**Effort: 2 points**

**Problem:** 5 categories (OPERATIONAL, REPUTATION, REGULATORY, POSITIVE, INFORMATIONAL) with unexplained dot colors. REGULATORY generates zero signals. Users don't understand the difference between OPERATIONAL and REPUTATION.

**What to build:**

New 3-category system:

| New category | Old categories merged | Dot | Badge |
|---|---|---|---|
| **Risk Alert** | REPUTATION + OPERATIONAL (high severity) | 🔴 Red | Red |
| **Watch** | OPERATIONAL (medium/low) + INFORMATIONAL | 🟡 Amber | Amber |
| **Positive** | POSITIVE | 🟢 Green | Green |

- Backend mapping: severity `high` → Risk Alert; `medium/low` negative → Watch; positive → Positive
- Remove REGULATORY from filter dropdown (dead option)
- Update `IntelligenceCard.js` dot + badge color mapping
- Update filter dropdown to: All / Risk Alerts / Watch / Positive
- Add a legend row above the card list: `● Risk Alert  ● Watch  ● Positive Signal` with 1-word descriptions

**Files:** `types.js`, `IntelligenceCard.js`, `page.js` (filter options + legend), incidents route (category mapping)

---

### S11-004: Improve Reference Labels on Cards
**Priority: P1**
**Effort: 1 point**

**Problem:** References show "Trustpilot Review #1...#6" with no context. Users can't tell which review is important without clicking each one.

**What to build:**
- Show star rating + date inline on each reference pill: "★ 1 · Feb 27" or "★ 3 · Mar 1"
- Source links already carry `date` from the API — use it
- Star rating: add to `source_links` in the incidents API (requires joining `firm_trustpilot_reviews.rating` when building source_links)

**Files:** `app/api/v2/propfirms/[id]/incidents/route.js` (add rating to source_links), `IntelligenceCard.js` (display rating + date in pill)

---

### ~~S11-005: Remove / Wire Up CTAs~~ — Deferred
Will be wired up in a future sprint.

---

### S11-006: Fix "Updated hourly" copy
**Priority: P2**
**Effort: 0 points (copy change)**

"Intelligence Layer • Updated hourly" in the page footer is inaccurate. The incident pipeline runs daily, weekly reports run weekly.

**Fix:** Change to "Intelligence Layer • Updated daily"

---

## Out of Scope for S11

- Twitter/X signal cards in the intelligence feed (deferred to S12 — X topic grouping)
- Multi-firm comparison view
- Notification delivery pipeline
- Regulatory signal generation (no data source identified yet)

---

## Effort Summary

| Ticket | Title | Points | Priority |
|--------|-------|--------|----------|
| ~~S11-001~~ | ~~Live sidebar status~~ | — | Deferred |
| S11-002 | Page-level verdict banner | 2 | P0 |
| S11-003 | Simplify to 3 categories + legend | 2 | P0 |
| S11-004 | Better reference labels (star + date) | 1 | P1 |
| ~~S11-005~~ | ~~Wire CTAs~~ | — | Deferred |
| S11-006 | Fix "updated hourly" copy | 0 | P2 |

**Total: 5 points**

---

## Before / After

| | Before | After |
|---|---|---|
| Status badge | Hardcoded "STABLE" | Computed from real incidents |
| Sidebar copy | Generic hardcoded text | Live: payout count, Trustpilot avg, tweet count |
| First impression | List of cards, no verdict | Verdict banner with 1-sentence summary |
| Signal types | 5 (one dead) | 3 (all active) |
| Dot logic | Unexplained, color ≠ badge | Matches badge, legend visible |
| References | "Trustpilot Review #1" | "★ 1 · Feb 27" clickable pills |
| CTAs | 2 non-functional buttons | Removed or wired |
