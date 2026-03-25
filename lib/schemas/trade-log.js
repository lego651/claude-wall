import { z } from 'zod';

export const tradeLogSchema = z.object({
  symbol: z.string().min(1, 'Symbol is required').max(20),
  direction: z.enum(['buy', 'sell']).nullable().optional(),
  entry_price: z.number().positive().nullable().optional(),
  stop_loss: z.number().positive().nullable().optional(),
  take_profit: z.number().positive().nullable().optional(),
  lots: z.number().positive().nullable().optional(),
  risk_reward: z.number().nullable().optional(),
  trade_at: z.string().datetime({ offset: true }).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  raw_input: z.string().max(5000).nullable().optional(),
  account_id: z.string().uuid().nullable().optional(),
  pnl: z.number().nullable().optional(),
  chart_url: z.string().max(2048).nullable().optional(),
  chart_image_path: z.string().max(512).nullable().optional(),
});
