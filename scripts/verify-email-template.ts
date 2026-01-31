/**
 * TICKET-011: Verify email template – build sample HTML and open in browser
 *
 * Run: npx tsx scripts/verify-email-template.ts
 *
 * Writes preview-weekly-digest.html in project root. Open in browser to check layout.
 */

import { resolve } from 'path';
import { createWriteStream } from 'fs';
import { buildWeeklyDigestHtml } from '../lib/email/weekly-digest-html';

const sampleReports = [
  {
    firmId: 'fundednext',
    firmName: 'FundedNext',
    weekStart: '2026-01-27',
    weekEnd: '2026-02-02',
    payouts: {
      total: 234500,
      count: 45,
      largest: 12300,
      avgPayout: 5211,
      changeVsLastWeek: 12,
    },
    trustpilot: {
      avgRating: 4.2,
      ratingChange: -0.3,
      reviewCount: 23,
      sentiment: { positive: 14, neutral: 6, negative: 3 },
    },
    incidents: [
      {
        incident_type: 'payout_issue',
        severity: 'medium',
        title: 'Crypto payout delays reported',
        summary: '8 users reported 3-5 day delays on crypto payouts over $5K. Pattern started Jan 24.',
        review_count: 8,
      },
    ],
    ourTake:
      'Strong payout volume this week ($234K, up 12%), but recurring crypto payout delays are concerning. All delayed payouts eventually process—no non-payment reports. Recommendation: For payouts over $5K, consider bank wire.',
  },
  {
    firmId: 'the5ers',
    firmName: 'The5ers',
    weekStart: '2026-01-27',
    weekEnd: '2026-02-02',
    payouts: { total: 180000, count: 32, largest: 8500, avgPayout: 5625, changeVsLastWeek: -5 },
    trustpilot: { avgRating: 4.5, ratingChange: 0.1, reviewCount: 15, sentiment: { positive: 10, neutral: 4, negative: 1 } },
    incidents: [],
    ourTake: 'Solid week with no notable incidents. Payout volume slightly down vs last week; Trustpilot sentiment remains positive.',
  },
];

const options = {
  weekStart: '2026-01-27',
  weekEnd: '2026-02-02',
  manageSubscriptionsUrl: 'https://propproof.com/settings',
  unsubscribeUrl: 'https://propproof.com/unsubscribe?token=test',
  baseUrl: 'https://propproof.com',
};

const html = buildWeeklyDigestHtml(sampleReports, options);
const outPath = resolve(process.cwd(), 'preview-weekly-digest.html');
const stream = createWriteStream(outPath, { encoding: 'utf8' });
stream.write(html);
stream.end();

console.log('TICKET-011: Email template verification');
console.log('Wrote:', outPath);
console.log('Open this file in a browser to verify layout (header, firm sections, footer).');
console.log('Check: gradient header, payouts/Trustpilot/incidents/Our Take per firm, CTA, unsubscribe links.');
