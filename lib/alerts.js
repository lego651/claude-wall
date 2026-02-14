/**
 * PROP-022: Alert delivery via email (Resend).
 * sendAlert(service, message, severity [, details]) sends to ALERT_EMAIL.
 * No-op if ALERT_EMAIL or RESEND_API_KEY is not set.
 */

import { sendEmail } from '@/lib/resend';
import config from '@/config';

const SEVERITIES = ['INFO', 'WARNING', 'CRITICAL'];

/**
 * Send an alert email.
 * @param {string} service - e.g. 'Arbiscan API', 'Supabase', 'Payout Sync'
 * @param {string} message - Short description
 * @param {'INFO'|'WARNING'|'CRITICAL'} severity
 * @param {Record<string, unknown>} [details] - Optional context (timestamp is always added)
 * @returns {Promise<void>} Resolves when sent or no-op; does not throw (logs on failure).
 */
export async function sendAlert(service, message, severity, details = {}) {
  const level = SEVERITIES.includes(severity) ? severity : 'INFO';
  const to = process.env.ALERT_EMAIL || process.env.ALERTS_TO;

  if (!to?.trim()) {
    console.warn('[alerts] ALERT_EMAIL / ALERTS_TO not set; alert not sent:', { service, message, level });
    return;
  }

  if (!process.env.RESEND_API_KEY) {
    console.warn('[alerts] RESEND_API_KEY not set; alert not sent:', { service, message, level });
    return;
  }

  const timestamp = new Date().toISOString();
  const subject = `[${level}] ${service}: ${message.slice(0, 60)}${message.length > 60 ? '…' : ''}`;
  const body = {
    timestamp,
    service,
    severity: level,
    message,
    ...(typeof details === 'object' && details !== null ? details : {}),
  };
  const text = [
    `Time: ${timestamp}`,
    `Service: ${service}`,
    `Severity: ${level}`,
    `Message: ${message}`,
    '',
    'Details:',
    JSON.stringify(body, null, 2),
  ].join('\n');

  try {
    await sendEmail({
      from: config?.resend?.fromNoReply ?? 'Alerts <onboarding@resend.dev>',
      to: to.trim(),
      subject,
      text,
    });
  } catch (err) {
    console.error('[alerts] Failed to send alert email:', err.message);
    // Do not rethrow so callers (e.g. circuit breaker) are not broken by alert failure
  }
}
