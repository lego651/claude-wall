import { PATCH, DELETE } from './route';

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }));
const { createClient } = require('@/lib/supabase/server');

const USER = { id: 'user-123' };
const TRADE = { id: 'trade-1', symbol: 'EURUSD', direction: 'buy', entry_price: 1.085, pnl: null, account_id: 'acct-1', trade_accounts: { name: 'Default', pnl_unit: 'USD' } };

function makeParams(id = 'trade-1') {
  return { params: Promise.resolve({ id }) };
}

function makeRequest(body) {
  return { json: () => Promise.resolve(body) };
}

function mockClientWithOwnership({ user = USER, owned = true, updateResult = { data: TRADE, error: null }, deleteError = null } = {}) {
  const ownerSingle = jest.fn().mockResolvedValue({ data: owned ? { id: TRADE.id } : null, error: null });
  const updateSingle = jest.fn().mockResolvedValue(updateResult);

  const ownerChain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: ownerSingle,
  };

  const updateChain = {
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: updateSingle,
    delete: jest.fn().mockReturnThis(),
  };

  // Delete chain
  const deleteChain = {
    ...updateChain,
    delete: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: deleteError }),
      }),
    }),
  };

  let callCount = 0;
  const from = jest.fn().mockImplementation(() => {
    callCount++;
    if (callCount === 1) return ownerChain;
    return updateChain;
  });

  createClient.mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user } }) },
    from,
  });
}

describe('PATCH /api/trade-log/[id]', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 if unauthenticated', async () => {
    mockClientWithOwnership({ user: null });
    const res = await PATCH(makeRequest({ pnl: 2.0 }), makeParams());
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid JSON', async () => {
    mockClientWithOwnership();
    const res = await PATCH({ json: () => Promise.reject(new SyntaxError('bad')) }, makeParams());
    expect(res.status).toBe(400);
  });

  it('returns 404 if trade not owned by user', async () => {
    mockClientWithOwnership({ owned: false });
    const res = await PATCH(makeRequest({ pnl: 2.0 }), makeParams('other-id'));
    expect(res.status).toBe(404);
  });

  it('updates specified fields only', async () => {
    const updated = { ...TRADE, pnl: 2.0, trade_accounts: { name: 'Default', pnl_unit: 'USD' } };
    mockClientWithOwnership({ updateResult: { data: updated, error: null } });
    const res = await PATCH(makeRequest({ pnl: 2.0 }), makeParams());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.pnl).toBe(2.0);
    expect(body.account_name).toBe('Default');
  });

  it('clears pnl when pnl: null sent', async () => {
    const updated = { ...TRADE, pnl: null, trade_accounts: { name: 'Default', pnl_unit: 'USD' } };
    mockClientWithOwnership({ updateResult: { data: updated, error: null } });
    const res = await PATCH(makeRequest({ pnl: null }), makeParams());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.pnl).toBeNull();
  });

  it('returns 500 on DB error', async () => {
    mockClientWithOwnership({ updateResult: { data: null, error: { message: 'fail' } } });
    const res = await PATCH(makeRequest({ symbol: 'GBPUSD' }), makeParams());
    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/trade-log/[id]', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 if unauthenticated', async () => {
    mockClientWithOwnership({ user: null });
    const res = await DELETE(makeRequest({}), makeParams());
    expect(res.status).toBe(401);
  });

  it('returns 404 if trade not found', async () => {
    mockClientWithOwnership({ owned: false });
    const res = await DELETE(makeRequest({}), makeParams('bad-id'));
    expect(res.status).toBe(404);
  });

  it('deletes trade and returns success', async () => {
    const ownerSingle = jest.fn().mockResolvedValue({ data: { id: TRADE.id }, error: null });
    const deleteResult = jest.fn().mockResolvedValue({ error: null });
    const eqFn = jest.fn().mockReturnThis();

    let callCount = 0;
    createClient.mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: USER } }) },
      from: jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return { select: jest.fn().mockReturnThis(), eq: eqFn, single: ownerSingle };
        }
        return {
          delete: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: null }),
            }),
          }),
          select: jest.fn().mockReturnThis(),
          eq: eqFn,
          single: ownerSingle,
        };
      }),
    });

    const res = await DELETE(makeRequest({}), makeParams());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('returns 500 on DB error', async () => {
    const ownerSingle = jest.fn().mockResolvedValue({ data: { id: TRADE.id }, error: null });
    const eqFn = jest.fn().mockReturnThis();

    let callCount = 0;
    createClient.mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: USER } }) },
      from: jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return { select: jest.fn().mockReturnThis(), eq: eqFn, single: ownerSingle };
        }
        return {
          delete: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: { message: 'fail' } }),
            }),
          }),
          select: jest.fn().mockReturnThis(),
          eq: eqFn,
        };
      }),
    });

    const res = await DELETE(makeRequest({}), makeParams());
    expect(res.status).toBe(500);
  });
});
