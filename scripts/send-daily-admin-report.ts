/**
 * Daily Admin Report Send Script
 * S12-007: Orchestration script that builds and sends the daily admin report email.
 *
 * Usage:
 *   npx tsx scripts/send-daily-admin-report.ts
 *
 * Env (from .env at project root):
 *   RESEND_API_KEY
 *   ADMIN_ALERT_EMAILS (comma-separated list of recipient addresses)
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import 'dotenv/config';
import { buildDailyAdminReport } from '../lib/email/daily-admin-report';
import { getAdminAlertEmails } from '../lib/alerts';
import { sendEmail } from '../lib/resend';
import config from '../config';

async function main() {
  try {
    const { subject, html } = await buildDailyAdminReport();
    const recipients = getAdminAlertEmails();

    await sendEmail({
      from: config?.resend?.fromNoReply ?? 'Admin <onboarding@resend.dev>',
      to: recipients,
      subject,
      html,
    });

    console.log(`✓ Daily admin report sent to ${recipients.length} recipient${recipients.length === 1 ? '' : 's'} (${subject})`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
