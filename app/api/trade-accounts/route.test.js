import { GET, POST } from './route';

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }));
const { createClient } = require('@/lib/supabase/server');

const USER = { id: 'user-123' };
const ACCOUNTS = [
  { id: 'acct-1', name: 'Default', is_default: true, pnl_unit: 'USD', created_at: '2026-01-01' },
  { id: 'acct-2', name: 'Funded A', is_default: false, pnl_unit: 'R', created_at: '2026-01-02' },
];

function mockAuth(user = USER) {
  return { auth: { getUser: jest.fn().mockResolvedValue({ data: { user } }) } };
}

function buildSupabase({ user = USER, selectResult = { data: ACCOUNTS, error: null }, insertResult = { data: ACCOUNTS[0], error: null } } = {}) {
  const single = jest.fn().mockResolvedValue(insertResult);
  const selectFn = jest.fn().mockReturnThis();
  const orderFn = jest.fn().mockReturnThis();
  const eqFn = jest.fn().mockReturnThis();
  const insertFn = jest.fn().mockReturnThis();

  const from = jest.fn().mockReturnValue({
    select: selectFn,
    order: jest.fn().mockImplementation(function () {
      // Last order call returns the result
      this._resolveWith = selectResult;
      return {
        ...this,
        then: undefined,
        // Support awaiting the chain
        order: jest.fn().mockResolvedValue(selectResult),
      };
    }),
    eq: eqFn,
    insert: insertFn,
    single,
  });

  const client = { ...mockAuth(user), from };
  createClient.mockResolvedValue(client);
  return client;
}

// Simpler mock helper
function mockClient({ user = USER, fromImpl } = {}) {
  const client = {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user } }) },
    from: fromImpl || jest.fn(),
  };
  createClient.mockResolvedValue(client);
  return client;
}

function makeGetFrom({ data, error }) {
  const result = { data, error };
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    // Make the chain itself awaitable (Supabase lazy query builder pattern)
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    catch: (fn) => Promise.resolve(result).catch(fn),
  };
  return jest.fn().mockReturnValue(chain);
}

function makePostFrom({ data, error }) {
  const single = jest.fn().mockResolvedValue({ data, error });
  const chain = {
    insert: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single,
  };
  return jest.fn().mockReturnValue(chain);
}

describe('GET /api/trade-accounts', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 if unauthenticated', async () => {
    mockClient({ user: null, fromImpl: makeGetFrom({ data: [], error: null }) });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns account list', async () => {
    mockClient({ fromImpl: makeGetFrom({ data: ACCOUNTS, error: null }) });
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual(ACCOUNTS);
  });

  it('returns 500 on DB error', async () => {
    mockClient({ fromImpl: makeGetFrom({ data: null, error: { message: 'fail' } }) });
    const res = await GET();
    expect(res.status).toBe(500);
  });
});

describe('POST /api/trade-accounts', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 if unauthenticated', async () => {
    mockClient({ user: null, fromImpl: makePostFrom({ data: null, error: null }) });
    const res = await POST({ json: () => Promise.resolve({ name: 'A', pnl_unit: 'R' }) });
    expect(res.status).toBe(401);
  });

  it('returns 400 if name missing', async () => {
    mockClient({ fromImpl: makePostFrom({ data: null, error: null }) });
    const res = await POST({ json: () => Promise.resolve({ pnl_unit: 'R' }) });
    expect(res.status).toBe(400);
  });

  it('returns 400 if pnl_unit invalid', async () => {
    mockClient({ fromImpl: makePostFrom({ data: null, error: null }) });
    const res = await POST({ json: () => Promise.resolve({ name: 'Test', pnl_unit: 'EUR' }) });
    expect(res.status).toBe(400);
  });

  it('returns 400 if name too long', async () => {
    mockClient({ fromImpl: makePostFrom({ data: null, error: null }) });
    const res = await POST({ json: () => Promise.resolve({ name: 'x'.repeat(51), pnl_unit: 'R' }) });
    expect(res.status).toBe(400);
  });

  it('creates account and returns 201', async () => {
    const newAcct = { id: 'acct-new', name: 'Funded A', is_default: false, pnl_unit: 'R', created_at: '2026-01-01' };
    mockClient({ fromImpl: makePostFrom({ data: newAcct, error: null }) });
    const res = await POST({ json: () => Promise.resolve({ name: 'Funded A', pnl_unit: 'R' }) });
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.pnl_unit).toBe('R');
    expect(body.is_default).toBe(false);
  });

  it('returns 400 for invalid JSON', async () => {
    mockClient({ fromImpl: makePostFrom({ data: null, error: null }) });
    const res = await POST({ json: () => Promise.reject(new SyntaxError('bad')) });
    expect(res.status).toBe(400);
  });

  it('returns 500 on DB error', async () => {
    mockClient({ fromImpl: makePostFrom({ data: null, error: { message: 'fail' } }) });
    const res = await POST({ json: () => Promise.resolve({ name: 'X', pnl_unit: 'USD' }) });
    expect(res.status).toBe(500);
  });
});
