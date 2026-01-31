# TICKET-013: Firm Detail Page - Subscribe Card

Card on firm detail pages so users can **follow** a firm for the weekly digest (one aggregated email per week with all firms they follow).

## Implemented

- **Component:** `components/FirmWeeklyReportCard.js`
  - Props: `firmId` (firm slug, e.g. `fundingpips`)
  - Heading: "Get Weekly Intelligence Reports"
  - Description: One weekly digest with payouts + community sentiment (every Monday)
  - Four benefits with icons: payout summary, Trustpilot sentiment, incident alerts, trust score updates
  - "Next digest: Monday, [date]" (next Monday UTC)
  - Gradient background (purple to blue), border, shadow, responsive

- **Button states:**
  - Not logged in: "Sign In to Follow" → navigates to `/signin`
  - Logged in, not following: "Follow (Free)" → `POST /api/subscriptions`
  - Logged in, following: "Following ✓" → `DELETE /api/subscriptions/[firmId]`
  - Loading: spinner + "Following…" / "Unfollowing…"

- **Placement:** Below the payout chart on `/propfirm/[id]` (see `app/propfirm/[id]/page.js`).

## How to test

1. Run `npm run dev`, open e.g. `http://localhost:3000/propfirm/fundingpips`.
2. Not signed in: card shows "Sign In to Follow"; click → redirects to signin.
3. Sign in, return to firm page: card shows "Follow (Free)". Click → becomes "Following ✓".
4. Refresh: card still shows "Following ✓". Click "Following ✓" → unfollows, button becomes "Follow (Free)".
5. Check on other firms (e.g. `/propfirm/the5ers`, `/propfirm/fundednext`) to confirm per-firm state.

**Dependencies:** TICKET-012 (Subscription API).
