import { GET } from './route';

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }));
const { createClient } = require('@/lib/supabase/server');

const USER = { id: 'user-123' };

function makeRequest(params = {}) {
  const url = new URL('http://localhost/api/trade-log/monthly');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return { url: url.toString() };
}

function mockClient({ user = USER, tradesData = [], tradesError = null, acctData = null } = {}) {
  const settingsSingle = jest.fn().mockResolvedValue({ data: null, error: null });
  const acctSingle = jest.fn().mockResolvedValue({ data: acctData, error: null });

  const settingsChain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: settingsSingle,
  };

  const acctChain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: acctSingle,
  };

  const tradesResult = { data: tradesData, error: tradesError };
  const tradesChain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    then: (resolve, reject) => Promise.resolve(tradesResult).then(resolve, reject),
    catch: (fn) => Promise.resolve(tradesResult).catch(fn),
  };

  createClient.mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user } }) },
    from: jest.fn().mockImplementation((table) => {
      if (table === 'trade_accounts') return acctChain;
      return tradesChain;
    }),
  });
}

describe('GET /api/trade-log/monthly', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 if unauthenticated', async () => {
    mockClient({ user: null });
    const res = await GET(makeRequest({ month: '2026-03' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 if month missing', async () => {
    mockClient();
    const res = await GET(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid month format', async () => {
    mockClient();
    const res = await GET(makeRequest({ month: '202603' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid month number', async () => {
    mockClient();
    const res = await GET(makeRequest({ month: '2026-13' }));
    expect(res.status).toBe(400);
  });

  it('returns empty response when no trades', async () => {
    mockClient({ tradesData: [] });
    const res = await GET(makeRequest({ month: '2026-03' }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.month).toBe('2026-03');
    expect(body.monthly_pnl).toBeNull();
    expect(Object.keys(body.days)).toHaveLength(0);
    expect(body.weeks.length).toBeGreaterThan(0);
  });

  it('aggregates day and week data correctly', async () => {
    const trades = [
      { trade_at: '2026-03-20T10:00:00Z', pnl: 1.0, account_id: 'a1', trade_accounts: { pnl_unit: 'R' } },
      { trade_at: '2026-03-20T11:00:00Z', pnl: 1.0, account_id: 'a1', trade_accounts: { pnl_unit: 'R' } },
      { trade_at: '2026-03-21T09:00:00Z', pnl: -0.5, account_id: 'a1', trade_accounts: { pnl_unit: 'R' } },
    ];
    mockClient({ tradesData: trades, acctData: { pnl_unit: 'R' } });
    const res = await GET(makeRequest({ month: '2026-03', account_id: 'acct-1' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.days['2026-03-20'].trade_count).toBe(2);
    expect(body.days['2026-03-20'].pnl).toBe(2.0);
    expect(body.days['2026-03-21'].pnl).toBe(-0.5);
    expect(body.monthly_pnl).toBeCloseTo(1.5);
  });

  it('pnl is null for days with all-null pnl', async () => {
    const trades = [
      { trade_at: '2026-03-20T10:00:00Z', pnl: null, account_id: 'a1', trade_accounts: { pnl_unit: 'USD' } },
    ];
    mockClient({ tradesData: trades });
    const res = await GET(makeRequest({ month: '2026-03' }));
    const body = await res.json();
    expect(body.days['2026-03-20'].pnl).toBeNull();
    expect(body.monthly_pnl).toBeNull();
  });

  it('pnl_unit null when no account_id param', async () => {
    mockClient({ tradesData: [] });
    const res = await GET(makeRequest({ month: '2026-03' }));
    const body = await res.json();
    expect(body.pnl_unit).toBeNull();
  });

  it('returns 500 on DB error', async () => {
    mockClient({ tradesError: { message: 'fail' } });
    const res = await GET(makeRequest({ month: '2026-03' }));
    expect(res.status).toBe(500);
  });

  it('generates correct week rows for March 2026', async () => {
    mockClient({ tradesData: [] });
    const res = await GET(makeRequest({ month: '2026-03' }));
    const body = await res.json();
    // March 2026 starts on Sunday → 5 rows
    expect(body.weeks.length).toBe(5);
    expect(body.weeks[0].label).toBe('Week 1');
    expect(body.weeks[0].saturday).toMatch(/^2026-03-/);
  });
});
