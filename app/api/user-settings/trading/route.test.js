import { GET, PATCH } from './route';

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }));
const { createClient } = require('@/lib/supabase/server');

const USER = { id: 'user-123' };

function mockClient({
  user = USER,
  selectResult = { data: null, error: null },
  upsertResult = { data: { daily_trade_limit: 5, preferred_timezone: null }, error: null },
} = {}) {
  let isUpsert = false;
  const single = jest.fn().mockImplementation(() =>
    Promise.resolve(isUpsert ? upsertResult : selectResult)
  );

  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockImplementation(function () {
      isUpsert = true;
      return this;
    }),
    single,
  };

  createClient.mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user } }) },
    from: jest.fn().mockImplementation(() => {
      isUpsert = false;
      return chain;
    }),
  });
}

describe('GET /api/user-settings/trading', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 if unauthenticated', async () => {
    mockClient({ user: null });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns defaults when no DB row exists', async () => {
    mockClient({ selectResult: { data: null, error: null } });
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.daily_trade_limit).toBe(3);
    expect(body.preferred_timezone).toBeNull();
  });

  it('returns stored values', async () => {
    mockClient({
      selectResult: {
        data: { daily_trade_limit: 5, preferred_timezone: 'America/New_York' },
        error: null,
      },
    });
    const res = await GET();
    const body = await res.json();
    expect(body.daily_trade_limit).toBe(5);
    expect(body.preferred_timezone).toBe('America/New_York');
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

  it('returns 400 when no valid fields provided', async () => {
    mockClient();
    const res = await PATCH({ json: () => Promise.resolve({}) });
    expect(res.status).toBe(400);
  });

  it('returns 400 for daily_trade_limit < 1', async () => {
    mockClient();
    const res = await PATCH({ json: () => Promise.resolve({ daily_trade_limit: 0 }) });
    expect(res.status).toBe(400);
  });

  it('returns 400 for non-integer daily_trade_limit', async () => {
    mockClient();
    const res = await PATCH({ json: () => Promise.resolve({ daily_trade_limit: 2.5 }) });
    expect(res.status).toBe(400);
  });

  it('returns 400 for empty preferred_timezone string', async () => {
    mockClient();
    const res = await PATCH({ json: () => Promise.resolve({ preferred_timezone: '' }) });
    expect(res.status).toBe(400);
  });

  it('upserts daily_trade_limit and returns it', async () => {
    mockClient({ upsertResult: { data: { daily_trade_limit: 5, preferred_timezone: null }, error: null } });
    const res = await PATCH({ json: () => Promise.resolve({ daily_trade_limit: 5 }) });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.daily_trade_limit).toBe(5);
  });

  it('upserts preferred_timezone without daily_trade_limit', async () => {
    mockClient({
      upsertResult: { data: { daily_trade_limit: 3, preferred_timezone: 'America/New_York' }, error: null },
    });
    const res = await PATCH({ json: () => Promise.resolve({ preferred_timezone: 'America/New_York' }) });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.preferred_timezone).toBe('America/New_York');
  });

  it('upserts both fields together', async () => {
    mockClient({
      upsertResult: { data: { daily_trade_limit: 4, preferred_timezone: 'Asia/Tokyo' }, error: null },
    });
    const res = await PATCH({
      json: () => Promise.resolve({ daily_trade_limit: 4, preferred_timezone: 'Asia/Tokyo' }),
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.daily_trade_limit).toBe(4);
    expect(body.preferred_timezone).toBe('Asia/Tokyo');
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
