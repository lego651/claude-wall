import { POST } from './route';

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/schemas/trade-log', () => ({
  tradeLogSchema: { safeParse: jest.fn() },
}));

const { createClient } = require('@/lib/supabase/server');
const { tradeLogSchema } = require('@/lib/schemas/trade-log');

const VALID_DATA = { symbol: 'EURUSD', direction: 'buy', entry_price: 1.085 };
const SAVED_TRADE = { id: 'abc-123', created_at: '2026-03-20T10:00:00Z' };

/**
 * Build a minimal mock Supabase client.
 * `queryMocks` is a map of table → response config.
 */
function mockSupabase({ user = { id: 'user-123' }, queries = {} } = {}) {
  const tableMock = (table) => {
    const cfg = queries[table] || {};
    const single = jest.fn().mockResolvedValue(cfg.single || { data: null, error: null });
    const select = jest.fn().mockReturnValue({ single });
    const insert = jest.fn().mockReturnValue({ select });
    const eq = jest.fn().mockReturnThis();
    const limit = jest.fn().mockReturnValue({ single });

    // For select chains used in ownership / default-account checks
    const selectChain = {
      eq: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnValue({ single }),
      single,
    };
    selectChain.eq.mockReturnValue(selectChain);

    return {
      insert,
      select: jest.fn().mockReturnValue(selectChain),
      eq,
      limit,
      single,
    };
  };

  const from = jest.fn().mockImplementation((table) => tableMock(table));
  const client = {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user } }) },
    from,
  };
  createClient.mockResolvedValue(client);
  return client;
}

function makeRequest(body) {
  return { json: () => Promise.resolve(body) };
}

function makeBadJsonRequest() {
  return { json: () => Promise.reject(new SyntaxError('bad json')) };
}

describe('POST /api/trade-log/save', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 if unauthenticated', async () => {
    mockSupabase({ user: null });
    tradeLogSchema.safeParse.mockReturnValue({ success: true, data: VALID_DATA });
    const res = await POST(makeRequest(VALID_DATA));
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 400 for invalid JSON', async () => {
    mockSupabase();
    const res = await POST(makeBadJsonRequest());
    expect(res.status).toBe(400);
  });

  it('returns 422 for validation failure', async () => {
    mockSupabase();
    tradeLogSchema.safeParse.mockReturnValue({
      success: false,
      error: { flatten: () => ({ fieldErrors: { symbol: ['Required'] } }) },
    });
    const res = await POST(makeRequest({ direction: 'buy' }));
    const body = await res.json();
    expect(res.status).toBe(422);
    expect(body.error).toBe('Validation failed');
  });

  it('returns 201 and saved trade on success; user_id injected from session', async () => {
    const client = mockSupabase();
    tradeLogSchema.safeParse.mockReturnValue({ success: true, data: VALID_DATA });

    // Mock default account lookup → not found → create default
    const tradeAccountsFrom = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn()
        .mockResolvedValueOnce({ data: null, error: null })         // no default found
        .mockResolvedValueOnce({ data: { id: 'acct-default' }, error: null }), // created
      insert: jest.fn().mockReturnThis(),
    };
    const tradeLogsFrom = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: SAVED_TRADE, error: null }),
    };

    client.from.mockImplementation((table) => {
      if (table === 'trade_accounts') return tradeAccountsFrom;
      return tradeLogsFrom;
    });

    const res = await POST(makeRequest(VALID_DATA));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.id).toBe('abc-123');
  });

  it('returns 500 on Supabase insert error', async () => {
    const client = mockSupabase();
    tradeLogSchema.safeParse.mockReturnValue({ success: true, data: VALID_DATA });

    const acctFrom = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { id: 'acct-1' }, error: null }),
      insert: jest.fn().mockReturnThis(),
    };
    const logsFrom = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: { message: 'db error' } }),
    };

    client.from.mockImplementation((table) => {
      if (table === 'trade_accounts') return acctFrom;
      return logsFrom;
    });

    const res = await POST(makeRequest(VALID_DATA));
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).toBe('Database error');
  });

  it('returns 500 on unexpected throw inside DB operations', async () => {
    // Throw inside the try/catch (from the trade_accounts table call)
    const client = mockSupabase();
    tradeLogSchema.safeParse.mockReturnValue({ success: true, data: VALID_DATA });
    client.from.mockImplementation(() => { throw new Error('boom'); });

    const res = await POST(makeRequest(VALID_DATA));
    expect(res.status).toBe(500);
  });
});
