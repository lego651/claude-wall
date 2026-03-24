import { POST } from './route';

jest.mock('@/lib/ai/openai-client', () => ({
  getOpenAIClient: jest.fn(),
}));

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));

const { getOpenAIClient } = require('@/lib/ai/openai-client');
const { createClient } = require('@/lib/supabase/server');

function makeRequest(fields = {}, imageFile = null) {
  const formData = new Map(Object.entries(fields));
  return {
    formData: () =>
      Promise.resolve({
        get: (key) => {
          if (key === 'image') return imageFile;
          return formData.get(key) || null;
        },
      }),
  };
}

function makeImageFile(content = 'fake-image-bytes', type = 'image/png') {
  return {
    size: content.length,
    type,
    arrayBuffer: () => Promise.resolve(Buffer.from(content)),
  };
}

function mockOpenAI(jsonResponse) {
  getOpenAIClient.mockReturnValue({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: JSON.stringify(jsonResponse) } }],
        }),
      },
    },
  });
}

function mockAuth(user = { id: 'user-123' }) {
  createClient.mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user } }) },
  });
}

describe('POST /api/trade-log/parse', () => {
  const originalEnv = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key';
    mockAuth();
  });

  afterEach(() => {
    process.env.OPENAI_API_KEY = originalEnv;
    jest.clearAllMocks();
  });

  it('returns 500 if OPENAI_API_KEY missing', async () => {
    delete process.env.OPENAI_API_KEY;
    const req = makeRequest({ message: 'buy EURUSD' });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).toBe('OpenAI not configured');
  });

  it('returns 401 if unauthenticated', async () => {
    createClient.mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) },
    });
    const req = makeRequest({ message: 'buy EURUSD' });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 400 if no message or image', async () => {
    const req = makeRequest({});
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('parses a new_trade from text input', async () => {
    mockOpenAI({
      type: 'new_trade',
      symbol: 'EURUSD',
      direction: 'buy',
      entry_price: 1.085,
      stop_loss: 1.082,
      take_profit: 1.092,
      lots: 0.1,
      risk_reward: 2.33,
      trade_at: null,
      notes: null,
    });

    const req = makeRequest({ message: 'Bought EURUSD at 1.0850' });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.type).toBe('new_trade');
    expect(body.symbol).toBe('EURUSD');
    expect(body.direction).toBe('buy');
    expect(body.entry_price).toBe(1.085);
  });

  it('returns pnl_update for trade result message', async () => {
    mockOpenAI({ type: 'pnl_update', symbol: 'EURUSD', pnl: 2.0 });

    const req = makeRequest({ message: 'EURUSD closed at +2R' });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.type).toBe('pnl_update');
    expect(body.symbol).toBe('EURUSD');
    expect(body.pnl).toBe(2.0);
  });

  it('returns pnl_update with negative pnl for a loss', async () => {
    mockOpenAI({ type: 'pnl_update', symbol: 'GBPUSD', pnl: -1.5 });

    const req = makeRequest({ message: 'I lost 1.5R on GBPUSD' });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.type).toBe('pnl_update');
    expect(body.pnl).toBe(-1.5);
  });

  it('returns pnl_update from screenshot with USD amount', async () => {
    mockOpenAI({ type: 'pnl_update', symbol: 'AAPL', pnl: 1000 });

    const image = makeImageFile('fake-broker-screenshot', 'image/png');
    const req = makeRequest({}, image);
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.type).toBe('pnl_update');
    expect(body.pnl).toBe(1000);
  });

  it('defaults type to new_trade when type field is missing (backward compat)', async () => {
    mockOpenAI({
      symbol: 'BTCUSD',
      direction: 'buy',
      entry_price: 50000,
      stop_loss: null,
      take_profit: null,
      lots: null,
      risk_reward: null,
      trade_at: null,
      notes: null,
    });

    const req = makeRequest({ message: 'bought BTC at 50k' });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.type).toBe('new_trade');
  });

  it('returns non_trade error for off-topic messages', async () => {
    mockOpenAI({ error: 'non_trade' });

    const req = makeRequest({ message: "What's the weather today?" });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.error).toBe('non_trade');
  });

  it('auto-calculates risk_reward when missing but SL/TP present (new_trade)', async () => {
    mockOpenAI({
      type: 'new_trade',
      symbol: 'AAPL',
      direction: 'buy',
      entry_price: 200,
      stop_loss: 190,
      take_profit: 220,
      lots: 10,
      risk_reward: null,
      trade_at: null,
      notes: null,
    });

    const req = makeRequest({ message: 'bought AAPL at 200, SL 190, TP 220' });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.risk_reward).toBe(2);
  });

  it('returns 502 if AI response is not valid JSON', async () => {
    getOpenAIClient.mockReturnValue({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{ message: { content: 'not json at all' } }],
          }),
        },
      },
    });

    const req = makeRequest({ message: 'some trade' });
    const res = await POST(req);
    expect(res.status).toBe(502);
  });

  it('returns 500 if OpenAI throws', async () => {
    getOpenAIClient.mockReturnValue({
      chat: {
        completions: {
          create: jest.fn().mockRejectedValue(new Error('Network error')),
        },
      },
    });

    const req = makeRequest({ message: 'buy BTC' });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });

  it('extracts partial fields from vague input', async () => {
    mockOpenAI({
      type: 'new_trade',
      symbol: 'AAPL',
      direction: 'buy',
      entry_price: null,
      stop_loss: null,
      take_profit: null,
      lots: null,
      risk_reward: null,
      trade_at: null,
      notes: null,
    });

    const req = makeRequest({ message: 'I bought AAPL' });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.symbol).toBe('AAPL');
    expect(body.entry_price).toBeNull();
  });

  it('processes image upload and passes base64 to OpenAI', async () => {
    mockOpenAI({
      type: 'new_trade',
      symbol: 'EURUSD',
      direction: 'sell',
      entry_price: 1.09,
      stop_loss: 1.095,
      take_profit: 1.08,
      lots: null,
      risk_reward: 2,
      trade_at: null,
      notes: 'Extracted from MT4 screenshot',
    });

    const image = makeImageFile('fake-chart-bytes', 'image/png');
    const req = makeRequest({}, image);
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.symbol).toBe('EURUSD');

    const createCall = getOpenAIClient().chat.completions.create;
    const userContent = createCall.mock.calls[0][0].messages[1].content;
    const imageBlock = userContent.find((c) => c.type === 'image_url');
    expect(imageBlock).toBeDefined();
    expect(imageBlock.image_url.url).toMatch(/^data:image\/png;base64,/);
  });
});
