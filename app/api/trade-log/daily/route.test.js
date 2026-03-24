import { GET } from './route';

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }));
const { createClient } = require('@/lib/supabase/server');

const USER = { id: 'user-123' };

const TRADE = {
  id: 'trade-1',
  symbol: 'EURUSD',
  direction: 'buy',
  entry_price: 1.085,
  stop_loss: 1.082,
  take_profit: 1.092,
  lots: 0.1,
  risk_reward: 2.33,
  trade_at: '2026-03-20T10:30:00Z',
  notes: null,
  pnl: 2.0,
  account_id: 'acct-1',
  trade_accounts: { name: 'Default', pnl_unit: 'USD' },
};

function makeRequest(params = {}) {
  const url = new URL('http://localhost/api/trade-log/daily');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return { url: url.toString() };
}

function mockClient({ user = USER, settingsData = null, tradesData = [TRADE], tradesError = null, acctData = { pnl_unit: 'USD' } } = {}) {
  const settingsSingle = jest.fn().mockResolvedValue({ data: settingsData, error: null });
  const tradesSingle = jest.fn().mockResolvedValue({ data: acctData, error: null });

  const settingsChain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: settingsSingle,
  };

  const acctChain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: tradesSingle,
  };

  const tradesResult = { data: tradesData, error: tradesError };
  const tradesChain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    then: (resolve, reject) => Promise.resolve(tradesResult).then(resolve, reject),
    catch: (fn) => Promise.resolve(tradesResult).catch(fn),
  };

  let callCount = 0;
  const from = jest.fn().mockImplementation((table) => {
    if (table === 'user_trading_settings') return settingsChain;
    if (table === 'trade_accounts') return acctChain;
    return tradesChain;
  });

  createClient.mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user } }) },
    from,
  });
}

describe('GET /api/trade-log/daily', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 if unauthenticated', async () => {
    mockClient({ user: null });
    const res = await GET(makeRequest({ date: '2026-03-20' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 if date missing', async () => {
    mockClient();
    const res = await GET(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid date format', async () => {
    mockClient();
    const res = await GET(makeRequest({ date: '20260320' }));
    expect(res.status).toBe(400);
  });

  it('returns daily summary with trades', async () => {
    mockClient({
      settingsData: { daily_trade_limit: 3 },
      tradesData: [TRADE],
    });
    const res = await GET(makeRequest({ date: '2026-03-20', account_id: 'acct-1' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.date).toBe('2026-03-20');
    expect(body.daily_limit).toBe(3);
    expect(body.trades_logged).toBe(1);
    expect(body.trades_remaining).toBe(2);
    expect(body.pnl_total).toBe(2.0);
    expect(body.trades[0].symbol).toBe('EURUSD');
    expect(body.trades[0].account_name).toBe('Default');
  });

  it('returns default daily_limit of 3 when no settings row', async () => {
    mockClient({ settingsData: null });
    const res = await GET(makeRequest({ date: '2026-03-20' }));
    const body = await res.json();
    expect(body.daily_limit).toBe(3);
  });

  it('pnl_total is null when all trades have null pnl', async () => {
    mockClient({ tradesData: [{ ...TRADE, pnl: null }] });
    const res = await GET(makeRequest({ date: '2026-03-20' }));
    const body = await res.json();
    expect(body.pnl_total).toBeNull();
  });

  it('pnl_total is null when no trades', async () => {
    mockClient({ tradesData: [] });
    const res = await GET(makeRequest({ date: '2026-03-20' }));
    const body = await res.json();
    expect(body.pnl_total).toBeNull();
    expect(body.trades_logged).toBe(0);
    expect(body.trades_remaining).toBe(3);
  });

  it('pnl_unit null when no account_id param', async () => {
    mockClient({ tradesData: [] });
    const res = await GET(makeRequest({ date: '2026-03-20' }));
    const body = await res.json();
    expect(body.pnl_unit).toBeNull();
  });

  it('returns 500 on DB error', async () => {
    mockClient({ tradesError: { message: 'fail' } });
    const res = await GET(makeRequest({ date: '2026-03-20' }));
    expect(res.status).toBe(500);
  });

  it('filters by multiple account_ids', async () => {
    mockClient({ tradesData: [TRADE], settingsData: { daily_trade_limit: 3 } });
    const url = new URL('http://localhost/api/trade-log/daily');
    url.searchParams.append('date', '2026-03-20');
    url.searchParams.append('account_id', 'acct-1');
    url.searchParams.append('account_id', 'acct-2');
    const res = await GET({ url: url.toString() });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.trades_logged).toBe(1);
    expect(body.pnl_unit).toBeNull(); // multi-account = no unit
  });
});
