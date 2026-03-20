import { tradeLogSchema } from './trade-log';

describe('tradeLogSchema', () => {
  const valid = {
    symbol: 'EURUSD',
    direction: 'buy',
    entry_price: 1.085,
    stop_loss: 1.082,
    take_profit: 1.092,
    lots: 0.1,
    risk_reward: 2.33,
    trade_at: '2026-03-20T10:30:00Z',
    notes: 'London session breakout',
    raw_input: 'Bought EURUSD at 1.0850',
  };

  it('accepts a fully populated trade', () => {
    expect(tradeLogSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts minimal trade (symbol only)', () => {
    expect(tradeLogSchema.safeParse({ symbol: 'AAPL' }).success).toBe(true);
  });

  it('rejects missing symbol', () => {
    const result = tradeLogSchema.safeParse({ direction: 'buy' });
    expect(result.success).toBe(false);
  });

  it('rejects empty symbol', () => {
    const result = tradeLogSchema.safeParse({ symbol: '' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid direction', () => {
    const result = tradeLogSchema.safeParse({ symbol: 'BTC', direction: 'long' });
    expect(result.success).toBe(false);
  });

  it('rejects negative entry_price', () => {
    const result = tradeLogSchema.safeParse({ symbol: 'BTC', entry_price: -1 });
    expect(result.success).toBe(false);
  });

  it('accepts null optional fields', () => {
    const result = tradeLogSchema.safeParse({
      symbol: 'GBPUSD',
      direction: null,
      entry_price: null,
      stop_loss: null,
    });
    expect(result.success).toBe(true);
  });

  it('accepts sell direction', () => {
    const result = tradeLogSchema.safeParse({ symbol: 'USDJPY', direction: 'sell' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid trade_at format', () => {
    const result = tradeLogSchema.safeParse({ symbol: 'ETH', trade_at: 'not-a-date' });
    expect(result.success).toBe(false);
  });

  it('rejects notes over 1000 chars', () => {
    const result = tradeLogSchema.safeParse({ symbol: 'ETH', notes: 'x'.repeat(1001) });
    expect(result.success).toBe(false);
  });
});
