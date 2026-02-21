/**
 * Tests for /api/inngest (Inngest serve handler)
 */
import { GET, POST, PUT } from './route';
import { syncTraderPayouts } from '@/lib/inngest-traders';

describe('/api/inngest', () => {
  it('exports GET handler', () => {
    expect(typeof GET).toBe('function');
  });

  it('exports POST handler', () => {
    expect(typeof POST).toBe('function');
  });

  it('exports PUT handler', () => {
    expect(typeof PUT).toBe('function');
  });

  it('registers sync-trader-payouts with cron every 5 min', () => {
    expect(syncTraderPayouts).toBeDefined();
    const fn = syncTraderPayouts as { opts?: { id?: string; triggers?: { cron?: string }[] } };
    expect(fn.opts?.id).toBe('sync-trader-payouts');
    expect(fn.opts?.triggers?.[0]?.cron).toBe('*/5 * * * *');
  });
});
