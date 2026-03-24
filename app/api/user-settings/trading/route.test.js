import { GET, PATCH } from './route';

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }));
const { createClient } = require('@/lib/supabase/server');

const USER = { id: 'user-123' };

function mockClient({ user = USER, selectResult = { data: null, error: null }, upsertResult = { data: { daily_trade_limit: 5 }, error: null } } = {}) {
  let callCount = 0;
  const single = jest.fn().mockImplementation(() => {
    callCount++;
    // For GET tests: only one call, returns selectResult
    // For PATCH tests: only one call (upsert), returns upsertResult
    // We distinguish by checking if upsert was called
    return Promise.resolve(isUpsert ? upsertResult : selectResult);
  });

  let isUpsert = false;
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockImplementation(function() { isUpsert = true; return this; }),
    single,
  };

  createClient.mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user } }) },
    from: jest.fn().mockImplementation(() => { isUpsert = false; return chain; }),
  });
}

describe('GET /api/user-settings/trading', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 if unauthenticated', async () => {
    mockClient({ user: null });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns default 3 if no DB row', async () => {
    mockClient({ selectResult: { data: null, error: null } });
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.daily_trade_limit).toBe(3);
  });

  it('returns stored value', async () => {
    mockClient({ selectResult: { data: { daily_trade_limit: 5 }, error: null } });
    const res = await GET();
    const body = await res.json();
    expect(body.daily_trade_limit).toBe(5);
  });
});

describe('PATCH /api/user-settings/trading', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 if unauthenticated', async () => {
    mockClient({ user: null });
    const res = await PATCH({ json: () => Promise.resolve({ daily_trade_limit: 5 }) });
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid JSON', async () => {
    mockClient();
    const res = await PATCH({ json: () => Promise.reject(new SyntaxError('bad')) });
    expect(res.status).toBe(400);
  });

  it('returns 400 for daily_trade_limit < 1', async () => {
    mockClient();
    const res = await PATCH({ json: () => Promise.resolve({ daily_trade_limit: 0 }) });
    expect(res.status).toBe(400);
  });

  it('returns 400 for non-integer', async () => {
    mockClient();
    const res = await PATCH({ json: () => Promise.resolve({ daily_trade_limit: 2.5 }) });
    expect(res.status).toBe(400);
  });

  it('returns 400 if daily_trade_limit missing', async () => {
    mockClient();
    const res = await PATCH({ json: () => Promise.resolve({}) });
    expect(res.status).toBe(400);
  });

  it('upserts and returns updated limit', async () => {
    mockClient({ upsertResult: { data: { daily_trade_limit: 5 }, error: null } });
    const res = await PATCH({ json: () => Promise.resolve({ daily_trade_limit: 5 }) });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.daily_trade_limit).toBe(5);
  });

  it('returns 500 on DB error', async () => {
    const single = jest.fn()
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValue({ data: null, error: { message: 'fail' } });

    const chain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      single,
    };

    createClient.mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: USER } }) },
      from: jest.fn().mockReturnValue(chain),
    });

    const res = await PATCH({ json: () => Promise.resolve({ daily_trade_limit: 2 }) });
    expect(res.status).toBe(500);
  });
});
