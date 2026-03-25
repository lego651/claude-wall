import {
  utcToLocalInputValue,
  localInputValueToUtc,
  formatTimezoneLabel,
  getBrowserTimezone,
} from './timezone';

describe('utcToLocalInputValue', () => {
  it('converts UTC to New York time (UTC-4 in summer)', () => {
    // June: New York is EDT = UTC-4
    const result = utcToLocalInputValue('2026-06-24T22:51:00.000Z', 'America/New_York');
    expect(result).toBe('2026-06-24T18:51');
  });

  it('converts UTC to Tokyo time (UTC+9)', () => {
    // UTC 22:51 Jun 24 → Tokyo 07:51 Jun 25
    const result = utcToLocalInputValue('2026-06-24T22:51:00.000Z', 'Asia/Tokyo');
    expect(result).toBe('2026-06-25T07:51');
  });

  it('converts UTC to UTC (no shift)', () => {
    const result = utcToLocalInputValue('2026-06-24T22:51:00.000Z', 'UTC');
    expect(result).toBe('2026-06-24T22:51');
  });

  it('returns empty string for empty utcIso', () => {
    expect(utcToLocalInputValue('', 'America/New_York')).toBe('');
    expect(utcToLocalInputValue(null, 'America/New_York')).toBe('');
  });

  it('returns empty string for empty timezone', () => {
    expect(utcToLocalInputValue('2026-06-24T22:51:00.000Z', '')).toBe('');
    expect(utcToLocalInputValue('2026-06-24T22:51:00.000Z', null)).toBe('');
  });

  it('returns empty string for invalid date', () => {
    expect(utcToLocalInputValue('not-a-date', 'America/New_York')).toBe('');
  });
});

describe('localInputValueToUtc', () => {
  it('converts New York local time to UTC (UTC-4 in summer)', () => {
    // 18:51 NY EDT = 22:51 UTC
    const result = localInputValueToUtc('2026-06-24T18:51', 'America/New_York');
    expect(result).toBeTruthy();
    const d = new Date(result);
    expect(d.getUTCHours()).toBe(22);
    expect(d.getUTCMinutes()).toBe(51);
    expect(d.getUTCDate()).toBe(24);
  });

  it('converts Tokyo local time to UTC (UTC+9)', () => {
    // 07:51 Tokyo = 22:51 UTC previous day
    const result = localInputValueToUtc('2026-06-25T07:51', 'Asia/Tokyo');
    expect(result).toBeTruthy();
    const d = new Date(result);
    expect(d.getUTCHours()).toBe(22);
    expect(d.getUTCMinutes()).toBe(51);
    expect(d.getUTCDate()).toBe(24);
  });

  it('converts UTC local time to UTC (no shift)', () => {
    const result = localInputValueToUtc('2026-06-24T22:51', 'UTC');
    expect(result).toBeTruthy();
    const d = new Date(result);
    expect(d.getUTCHours()).toBe(22);
    expect(d.getUTCMinutes()).toBe(51);
  });

  it('returns null for empty localValue', () => {
    expect(localInputValueToUtc('', 'America/New_York')).toBeNull();
    expect(localInputValueToUtc(null, 'America/New_York')).toBeNull();
  });

  it('returns null for empty timezone', () => {
    expect(localInputValueToUtc('2026-06-24T18:51', '')).toBeNull();
    expect(localInputValueToUtc('2026-06-24T18:51', null)).toBeNull();
  });

  it('is the inverse of utcToLocalInputValue', () => {
    const utcIso = '2026-06-24T22:51:00.000Z';
    const tz = 'America/New_York';
    const local = utcToLocalInputValue(utcIso, tz);
    const backToUtc = localInputValueToUtc(local, tz);
    expect(new Date(backToUtc).getTime()).toBe(new Date(utcIso).getTime());
  });

  it('round-trips correctly for Tokyo timezone', () => {
    const utcIso = '2026-06-24T22:51:00.000Z';
    const tz = 'Asia/Tokyo';
    const local = utcToLocalInputValue(utcIso, tz);
    const backToUtc = localInputValueToUtc(local, tz);
    expect(new Date(backToUtc).getTime()).toBe(new Date(utcIso).getTime());
  });
});

describe('formatTimezoneLabel', () => {
  it('returns "UTC" for UTC timezone', () => {
    expect(formatTimezoneLabel('UTC')).toBe('UTC');
  });

  it('returns "UTC" for null input', () => {
    expect(formatTimezoneLabel(null)).toBe('UTC');
  });

  it('includes city name and UTC offset for New York', () => {
    const label = formatTimezoneLabel('America/New_York');
    expect(label).toMatch(/New York/);
    expect(label).toMatch(/UTC/);
    expect(label).toMatch(/[+-]\d/);
  });

  it('includes city name and UTC offset for Tokyo', () => {
    const label = formatTimezoneLabel('Asia/Tokyo');
    expect(label).toMatch(/Tokyo/);
    expect(label).toMatch(/UTC\+9/);
  });

  it('replaces underscores in city name', () => {
    const label = formatTimezoneLabel('America/Los_Angeles');
    expect(label).toMatch(/Los Angeles/);
  });
});

describe('getBrowserTimezone', () => {
  it('returns a non-empty string', () => {
    const tz = getBrowserTimezone();
    expect(typeof tz).toBe('string');
    expect(tz.length).toBeGreaterThan(0);
  });
});
