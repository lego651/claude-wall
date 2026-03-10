/**
 * Tests for lib/gmail/firm-mapper.ts
 */

import { mapSenderToFirm, mapSenderToFirmDB } from './firm-mapper';

// ---------------------------------------------------------------------------
// mapSenderToFirm (sync static)
// ---------------------------------------------------------------------------

describe('mapSenderToFirm', () => {
  it('matches by full email', () => {
    expect(mapSenderToFirm('updates@fundingpips.com')).toEqual({
      firmId: 'fundingpips',
      matchType: 'email',
    });
  });

  it('matches by domain fallback', () => {
    expect(mapSenderToFirm('anything@ftmo.com')).toEqual({
      firmId: 'ftmo',
      matchType: 'domain',
    });
  });

  it('is case-insensitive', () => {
    expect(mapSenderToFirm('HELLO@FXIFY.COM')).toEqual({
      firmId: 'fxify',
      matchType: 'email',
    });
  });

  it('returns null for unknown sender', () => {
    expect(mapSenderToFirm('unknown@randomfirm.io')).toEqual({
      firmId: null,
      matchType: null,
    });
  });

  it('returns null for email with no domain', () => {
    expect(mapSenderToFirm('nodomain')).toEqual({ firmId: null, matchType: null });
  });

  it('email match takes priority over domain match', () => {
    // hello@fxify.com is in email map; fxify.com is also in domain map
    expect(mapSenderToFirm('hello@fxify.com').matchType).toBe('email');
  });
});

// ---------------------------------------------------------------------------
// mapSenderToFirmDB (async DB-backed)
// ---------------------------------------------------------------------------

function makeSupabase(rows: any[], error: any = null) {
  const orChain = { data: rows, error };
  const selectChain = { or: jest.fn().mockReturnValue(orChain) };
  const fromChain = { select: jest.fn().mockReturnValue(selectChain) };
  return { from: jest.fn().mockReturnValue(fromChain) } as any;
}

describe('mapSenderToFirmDB', () => {
  it('returns email match from DB (priority over domain)', async () => {
    const supabase = makeSupabase([
      { firm_id: 'fundingpips', sender_email: 'updates@fundingpips.com', sender_domain: null },
      { firm_id: 'fundingpips', sender_email: null, sender_domain: 'fundingpips.com' },
    ]);
    const result = await mapSenderToFirmDB('updates@fundingpips.com', supabase);
    expect(result).toEqual({ firmId: 'fundingpips', matchType: 'email' });
  });

  it('returns domain match from DB when no email match', async () => {
    const supabase = makeSupabase([
      { firm_id: 'ftmo', sender_email: null, sender_domain: 'ftmo.com' },
    ]);
    const result = await mapSenderToFirmDB('info@ftmo.com', supabase);
    expect(result).toEqual({ firmId: 'ftmo', matchType: 'domain' });
  });

  it('falls back to static map when DB returns no rows', async () => {
    const supabase = makeSupabase([]);
    // ftmo.com is in the static domain map
    const result = await mapSenderToFirmDB('info@ftmo.com', supabase);
    expect(result).toEqual({ firmId: 'ftmo', matchType: 'domain' });
  });

  it('falls back to static map on DB error', async () => {
    const supabase = makeSupabase([], { message: 'DB connection failed' });
    const result = await mapSenderToFirmDB('updates@fundingpips.com', supabase);
    expect(result).toEqual({ firmId: 'fundingpips', matchType: 'email' });
  });

  it('returns null when no DB match and no static match', async () => {
    const supabase = makeSupabase([]);
    const result = await mapSenderToFirmDB('nobody@unknown.io', supabase);
    expect(result).toEqual({ firmId: null, matchType: null });
  });

  it('is case-insensitive', async () => {
    const supabase = makeSupabase([
      { firm_id: 'fxify', sender_email: 'hello@fxify.com', sender_domain: null },
    ]);
    const result = await mapSenderToFirmDB('HELLO@FXIFY.COM', supabase);
    expect(result).toEqual({ firmId: 'fxify', matchType: 'email' });
  });
});
