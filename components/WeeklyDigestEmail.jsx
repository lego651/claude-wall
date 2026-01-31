/**
 * TICKET-011: Weekly Digest Email – preview component
 * Renders the same HTML as the actual email (built by lib/email/weekly-digest-html.ts)
 * for preview in the app (e.g. settings or admin). Uses dangerouslySetInnerHTML.
 */

import { buildWeeklyDigestHtml } from '@/lib/email/weekly-digest-html';

export function WeeklyDigestEmail({ reports, options }) {
  const html = buildWeeklyDigestHtml(reports, options);
  return (
    <div
      className="rounded-lg border border-base-300 overflow-hidden bg-base-100"
      style={{ maxWidth: 600 }}
    >
      <iframe
        title="Weekly digest email preview"
        srcDoc={html}
        className="w-full border-0"
        style={{ minHeight: 600, height: '80vh' }}
        sandbox="allow-same-origin"
      />
    </div>
  );
}

export default WeeklyDigestEmail;
