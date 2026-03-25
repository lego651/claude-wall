/**
 * Timezone utility functions for the trading log.
 * All conversions use the IANA timezone database via the Intl API.
 */

/**
 * Convert a UTC ISO string to a datetime-local input value in the given timezone.
 * @param {string} utcIso - e.g. "2026-03-24T22:51:00.000Z"
 * @param {string} tz - IANA timezone e.g. "America/New_York"
 * @returns {string} "YYYY-MM-DDTHH:mm" in the given timezone, or "" on failure
 */
export function utcToLocalInputValue(utcIso, tz) {
  if (!utcIso || !tz) return '';
  try {
    const d = new Date(utcIso);
    if (isNaN(d.getTime())) return '';
    // 'sv' locale formats as "YYYY-MM-DD HH:MM" — we just replace the space with T
    const formatter = new Intl.DateTimeFormat('sv', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    return formatter.format(d).replace(' ', 'T');
  } catch {
    return '';
  }
}

/**
 * Convert a datetime-local input value (interpreted as being in `tz`) to a UTC ISO string.
 * @param {string} localValue - "YYYY-MM-DDTHH:mm" treated as wall-clock time in `tz`
 * @param {string} tz - IANA timezone e.g. "America/New_York"
 * @returns {string|null} UTC ISO string, or null on failure
 */
export function localInputValueToUtc(localValue, tz) {
  if (!localValue || !tz) return null;
  try {
    // Treat the naive local string as UTC to get a reference point
    const naiveUtc = new Date(localValue + ':00Z');
    if (isNaN(naiveUtc.getTime())) return null;

    // Find how this UTC instant appears in the target timezone
    const formatter = new Intl.DateTimeFormat('sv', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    const tzStr = formatter.format(naiveUtc); // "YYYY-MM-DD HH:MM"
    const displayedAsUtc = new Date(tzStr.replace(' ', 'T') + ':00Z');

    // offsetMs = how much the target timezone shifts time relative to UTC
    const offsetMs = naiveUtc.getTime() - displayedAsUtc.getTime();

    // The actual UTC time is the naive UTC shifted by that offset
    return new Date(naiveUtc.getTime() + offsetMs).toISOString();
  } catch {
    return null;
  }
}

/**
 * Format a timezone for display, e.g. "America/New_York" → "New York (UTC-4)".
 * @param {string} tz - IANA timezone
 * @returns {string}
 */
export function formatTimezoneLabel(tz) {
  if (!tz) return 'UTC';
  if (tz === 'UTC') return 'UTC';
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    }).formatToParts(now);
    const gmtPart = parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
    // gmtPart: "GMT-4", "GMT+9", "GMT+5:30", "GMT+0"
    let utcOffset = gmtPart.replace('GMT', 'UTC');
    if (utcOffset === 'UTC+0' || utcOffset === 'UTC0') utcOffset = 'UTC';

    const city = tz.split('/').pop().replace(/_/g, ' ');
    return utcOffset === 'UTC' ? `${city} (UTC)` : `${city} (${utcOffset})`;
  } catch {
    return tz;
  }
}

/**
 * Get the browser's IANA timezone identifier.
 */
export function getBrowserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
