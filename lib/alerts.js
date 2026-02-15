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

// ---------------------------------------------------------------------------
// TICKET-014: Intelligence Feed pipeline alerts (throttled 4h per condition)
// ---------------------------------------------------------------------------

const INTELLIGENCE_ALERT_COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours
const lastIntelligenceAlertSent = {};

function shouldSendIntelligenceAlert(checkKey) {
  const now = Date.now();
  if (lastIntelligenceAlertSent[checkKey] && now - lastIntelligenceAlertSent[checkKey] < INTELLIGENCE_ALERT_COOLDOWN_MS) {
    return false;
  }
  lastIntelligenceAlertSent[checkKey] = now;
  return true;
}

/**
 * Check intelligence pipeline conditions and send throttled alert emails.
 * Called from GET /api/admin/metrics with the response payload shape.
 * @param {Object} metrics - Payload from admin metrics (trustpilotScraper, classifyReviews)
 */
export async function checkIntelligenceFeedAlerts(metrics) {
  const alerts = [];

  // 1. Scraper: last run > 25 hours ago (or no run for any firm with Trustpilot)
  const firms = metrics?.trustpilotScraper?.firms ?? [];
  if (firms.length > 0) {
    const timestamps = firms.map((f) => f.last_scraper_run_at).filter(Boolean);
    const lastRun = timestamps.length ? new Date(Math.max(...timestamps.map((t) => new Date(t).getTime()))) : null;
    const hoursSince = lastRun ? (Date.now() - lastRun.getTime()) / (1000 * 60 * 60) : Infinity;
    if (hoursSince > 25) {
      alerts.push({
        key: 'intel_scraper',
        type: 'scraper_failure',
        message: lastRun
          ? `Scraper hasn't run in ${hoursSince.toFixed(1)} hours (last: ${lastRun.toISOString()}).`
          : 'Scraper has not run for any firm with Trustpilot.',
      });
    }
  }

  // 2. Classifier backlog: unclassified > 500
  const unclassified = metrics?.classifyReviews?.unclassified ?? 0;
  if (unclassified > 500) {
    alerts.push({
      key: 'intel_classifier',
      type: 'classifier_backlog',
      message: `${unclassified} unclassified reviews (threshold: 500).`,
    });
  }

  for (const alert of alerts) {
    if (!shouldSendIntelligenceAlert(alert.key)) continue;
    const conditionLabel = alert.type.replace(/_/g, ' ');
    const service = `🚨 Intelligence Feed Alert: ${conditionLabel}`;
    await sendAlert(service, alert.message, 'CRITICAL', { type: alert.type }).catch(() => {});
  }
}
