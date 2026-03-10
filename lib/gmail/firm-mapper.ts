/**
 * Firm Email Sender Mapper
 * Maps sender email domains/addresses → firm_id.
 *
 * This is a static config for now. Phase 5 will move this to a DB table
 * (migration 33_firm_email_senders.sql) with an admin UI.
 */

// Maps sender domain OR full email → firm_id
// Order matters: full email matches are checked first, then domain fallback.
const SENDER_EMAIL_MAP: Record<string, string> = {
  // Full email overrides (e.g. noreply@something-different.com)
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

export interface FirmMapResult {
  firmId: string | null;
  /** true = matched by full email, false = matched by domain, null = no match */
  matchType: 'email' | 'domain' | null;
}

/**
 * Resolve a sender email address to a firm_id.
 * Returns null firmId if the sender is unknown.
 */
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
