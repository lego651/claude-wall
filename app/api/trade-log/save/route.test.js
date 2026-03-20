import { POST } from './route';

jest.mock('@/lib/supabase/service', () => ({
  createServiceClient: jest.fn(),
}));

jest.mock('@/lib/schemas/trade-log', () => ({
  tradeLogSchema: {
    safeParse: jest.fn(),
  },
}));

const { createServiceClient } = require('@/lib/supabase/service');
const { tradeLogSchema } = require('@/lib/schemas/trade-log');

// Use the real Zod schema for integration-style validation tests
const realSchema = jest.requireActual('@/lib/schemas/trade-log').tradeLogSchema;

function makeRequest(body) {
  return { json: () => Promise.resolve(body) };
}

function makeBadJsonRequest() {
  return { json: () => Promise.reject(new SyntaxError('bad json')) };
}

function mockSupabase({ data = null, error = null } = {}) {
  const single = jest.fn().mockResolvedValue({ data, error });
  const select = jest.fn().mockReturnValue({ single });
  const insert = jest.fn().mockReturnValue({ select });
  const from = jest.fn().mockReturnValue({ insert });
  createServiceClient.mockReturnValue({ from });
  return { from, insert, select, single };
}

describe('POST /api/trade-log/save', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 400 for invalid JSON', async () => {
    tradeLogSchema.safeParse.mockReturnValue({ success: false, error: { flatten: () => ({}) } });
    const res = await POST(makeBadJsonRequest());
    expect(res.status).toBe(400);
  });

  it('returns 422 for validation failure', async () => {
    tradeLogSchema.safeParse.mockReturnValue({
      success: false,
      error: { flatten: () => ({ fieldErrors: { symbol: ['Required'] } }) },
    });
    const res = await POST(makeRequest({ direction: 'buy' }));
    const body = await res.json();
    expect(res.status).toBe(422);
    expect(body.error).toBe('Validation failed');
  });

  it('returns 201 and saved trade on success', async () => {
    tradeLogSchema.safeParse.mockReturnValue({
      success: true,
      data: { symbol: 'EURUSD', direction: 'buy', entry_price: 1.085 },
    });
    mockSupabase({ data: { id: 'abc-123', created_at: '2026-03-20T10:00:00Z' } });

    const res = await POST(makeRequest({ symbol: 'EURUSD', direction: 'buy', entry_price: 1.085 }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.id).toBe('abc-123');
    expect(body.created_at).toBeDefined();
  });

  it('returns 500 on Supabase error', async () => {
    tradeLogSchema.safeParse.mockReturnValue({
      success: true,
      data: { symbol: 'BTC' },
    });
    mockSupabase({ error: { message: 'connection failed' } });

    const res = await POST(makeRequest({ symbol: 'BTC' }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Database error');
  });

  it('returns 500 on unexpected throw', async () => {
    tradeLogSchema.safeParse.mockReturnValue({
      success: true,
      data: { symbol: 'ETH' },
    });
    createServiceClient.mockImplementation(() => { throw new Error('boom'); });

    const res = await POST(makeRequest({ symbol: 'ETH' }));
    expect(res.status).toBe(500);
  });
});
