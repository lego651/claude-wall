/** Default logo when firm has no logo_url (Supabase). */
export const DEFAULT_LOGO_URL = '/icon.png';

/**
 * Firm logo URL: use Supabase/API logo (logo, logo_url, logoPath) when set; otherwise /icon.png.
 *
 * @param {{ logo?: string | null, logo_url?: string | null, logoPath?: string }} firm - Firm or subscription object
 * @returns {string} URL to use as img src
 */
export function getFirmLogoUrl(firm) {
  const url = firm?.logo ?? firm?.logo_url ?? firm?.logoPath;
  if (url && typeof url === 'string' && url.trim()) {
    return url.trim();
  }
  return DEFAULT_LOGO_URL;
}
