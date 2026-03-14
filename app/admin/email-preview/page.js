/**
 * Admin Email Preview — /admin/email-preview
 *
 * Live preview of the daily admin report email.
 * Renders the current template with real data so you can see exactly
 * what will be sent. Edit renderReportHtml() in lib/email/daily-admin-report.ts
 * to change the template; this page will reflect the changes immediately.
 */

import { buildDailyAdminReport } from '@/lib/email/daily-admin-report';

export const dynamic = 'force-dynamic';

export default async function EmailPreviewPage() {
  let subject = '';
  let html = '';
  let error = null;

  try {
    const result = await buildDailyAdminReport();
    subject = result.subject;
    html = result.html;
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 600, margin: '0 0 4px' }}>Daily Admin Report — Email Preview</h1>
        <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
          Live preview of the email sent by the daily cron job. Edit{' '}
          <code style={{ background: '#f1f5f9', padding: '1px 4px', borderRadius: '3px' }}>
            lib/email/daily-admin-report.ts
          </code>{' '}
          → <code style={{ background: '#f1f5f9', padding: '1px 4px', borderRadius: '3px' }}>renderReportHtml()</code>{' '}
          to update the template.
        </p>
      </div>

      {error ? (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '16px', color: '#dc2626' }}>
          <strong>Error building report:</strong> {error}
        </div>
      ) : (
        <>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px' }}>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Subject</span>
            <p style={{ margin: '4px 0 0', fontSize: '15px', fontWeight: 500 }}>{subject}</p>
          </div>

          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '8px 16px' }}>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email Body</span>
            </div>
            {/* eslint-disable-next-line @next/next/no-page-custom-font */}
            <iframe
              srcDoc={html}
              style={{ width: '100%', minHeight: '800px', border: 'none', display: 'block' }}
              title="Daily Admin Report Email Preview"
            />
          </div>
        </>
      )}
    </div>
  );
}
