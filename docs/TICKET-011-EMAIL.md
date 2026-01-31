# TICKET-011: HTML Email Template

**Status:** Done

---

## What it does

- **One aggregated email per user per week** with sections for all firms they follow.
- **`lib/email/weekly-digest-html.ts`** – `buildWeeklyDigestHtml(reports[], options)` returns full HTML string (inline CSS, max-width 600px, gradient header purple→blue, severity colors red/yellow/green).
- **`components/WeeklyDigestEmail.jsx`** – Preview component: renders the same HTML in an iframe for in-app preview (e.g. settings or admin).

---

## Data shape

- **reports:** Array of `DigestReportInput` (firmId, firmName?, weekStart, weekEnd, payouts, trustpilot, incidents, ourTake).
- **options:** `DigestEmailOptions` (weekStart, weekEnd, manageSubscriptionsUrl, unsubscribeUrl, baseUrl).

---

## Usage (for TICKET-015 send-digest)

```ts
import { buildWeeklyDigestHtml } from '@/lib/email/weekly-digest-html';

const html = buildWeeklyDigestHtml(reports, {
  weekStart: '2026-01-27',
  weekEnd: '2026-02-02',
  manageSubscriptionsUrl: 'https://propproof.com/settings',
  unsubscribeUrl: 'https://propproof.com/unsubscribe?token=...',
  baseUrl: 'https://propproof.com',
});
// Send html via Resend
```

---

## How to verify TICKET-011 is complete

1. **Run the verification script** (builds sample HTML and writes to file):
   ```bash
   npx tsx scripts/verify-email-template.ts
   ```
2. **Open the generated file in a browser:**
   - File: `preview-weekly-digest.html` (project root)
   - Check: gradient header ("Your Weekly Digest"), week range, two firm sections (FundedNext, The5ers), payouts/Trustpilot/incidents/Our Take per firm, CTA "View On-Chain Proof", footer (Manage subscriptions, Unsubscribe), PropProof tagline
3. **Optional:** Use `WeeklyDigestEmail` in a page (e.g. settings or admin) with real or sample `reports` and `options` to preview in-app.

---

## Preview in app

```jsx
import WeeklyDigestEmail from '@/components/WeeklyDigestEmail';

<WeeklyDigestEmail reports={sampleReports} options={sampleOptions} />
```

---

## Styling

- Mobile-responsive (max-width: 600px).
- Inline CSS only (email clients).
- Gradient header: purple (#7c3aed) to blue (#2563eb).
- Severity: high = red, medium = yellow/amber, low = green.
- Footer: manage subscriptions, unsubscribe; PropProof tagline.
