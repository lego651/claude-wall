/**
 * Firm Email Sender Mapper
 * Maps sender email/domain → firm_id.
 *
 * Two modes:
 * - mapSenderToFirm()     — sync, static fallback (kept for tests/scripts)
 * - mapSenderToFirmDB()   — async, queries firm_email_senders table first,
 *                           falls back to static if DB has no match or errors
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Static fallback maps (mirrors DB seed data; used when DB is unavailable)
// ---------------------------------------------------------------------------

const SENDER_EMAIL_MAP: Record<string, string> = {
  'updates@fundingpips.com': 'fundingpips',
  'noreply@fundingpips.com': 'fundingpips',
  'hello@fxify.com': 'fxify',
  'support@fxify.com': 'fxify',
  'hello@fundednext.com': 'fundednext',
  'support@fundednext.com': 'fundednext',
};

const SENDER_DOMAIN_MAP: Record<string, string> = {
  'fundingpips.com': 'fundingpips',
  'fxify.com': 'fxify',
  'fundednext.com': 'fundednext',
  'the5ers.com': 'the5ers',
  'instantfunding.com': 'instantfunding',
  'blueguardian.com': 'blueguardian',
  'aquafunded.com': 'aquafunded',
  'alphacapitalgroup.com': 'alphacapitalgroup',
  'ftmo.com': 'ftmo',
  'topstep.com': 'topstep',
  'apextraderfunding.com': 'apex',
  'apex.com': 'apex',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FirmMapResult {
  firmId: string | null;
  matchType: 'email' | 'domain' | null;
}

// ---------------------------------------------------------------------------
// Sync static lookup (fallback)
// ---------------------------------------------------------------------------

export function mapSenderToFirm(senderEmail: string): FirmMapResult {
  const email = senderEmail.toLowerCase().trim();

  if (SENDER_EMAIL_MAP[email]) {
    return { firmId: SENDER_EMAIL_MAP[email], matchType: 'email' };
  }

  const domain = email.split('@')[1] ?? '';
  if (domain && SENDER_DOMAIN_MAP[domain]) {
    return { firmId: SENDER_DOMAIN_MAP[domain], matchType: 'domain' };
  }

  return { firmId: null, matchType: null };
}

// ---------------------------------------------------------------------------
// Async DB-backed lookup with static fallback
// ---------------------------------------------------------------------------

/**
 * Resolve sender email → firm_id by querying the firm_email_senders table.
 * Falls back to static map if DB returns no match or throws.
 */
export async function mapSenderToFirmDB(
  senderEmail: string,
  supabase: SupabaseClient
): Promise<FirmMapResult> {
  const email = senderEmail.toLowerCase().trim();
  const domain = email.split('@')[1] ?? '';

  try {
    // Fetch all rows matching either this exact email or this domain
    const { data, error } = await supabase
      .from('firm_email_senders')
      .select('firm_id, sender_email, sender_domain')
      .or(
        [
          `sender_email.eq.${email}`,
          domain ? `sender_domain.eq.${domain}` : null,
        ]
          .filter(Boolean)
          .join(',')
      );

    if (error) throw error;

    if (data && data.length > 0) {
      // Exact email match takes priority over domain match
      const emailRow = data.find((r) => r.sender_email === email);
      if (emailRow) return { firmId: emailRow.firm_id, matchType: 'email' };

      const domainRow = data.find((r) => r.sender_domain === domain);
      if (domainRow) return { firmId: domainRow.firm_id, matchType: 'domain' };
    }
  } catch (err) {
    console.warn('[FirmMapper] DB lookup failed, falling back to static map:', err);
  }

  // Static fallback
  return mapSenderToFirm(email);
}
