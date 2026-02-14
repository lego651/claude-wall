/**
 * Tests for GET /api/admin/metrics
 */
import { GET } from './route';
import { createClient } from '@/lib/supabase/server';
import { usageTracker } from '@/lib/arbiscan';
import { getCacheStats } from '@/lib/cache';

jest.mock('@/lib/supabase/server');
jest.mock('@/lib/arbiscan', () => ({
  usageTracker: { getUsage: jest.fn() },
}));
jest.mock('@/lib/cache');
jest.mock('@/lib/alerts', () => ({ sendAlert: jest.fn().mockResolvedValue(undefined) }));
jest.mock('fs', () => ({
  promises: {
    access: jest.fn().mockResolvedValue(undefined),
    readdir: jest.fn().mockResolvedValue([]),
    stat: jest.fn().mockResolvedValue({ isDirectory: () => false, size: 0 }),
  },
}));

describe('GET /api/admin/metrics', () => {
  let mockSupabase;

  beforeEach(() => {
    jest.clearAllMocks();
    const fs = require('fs');
    fs.promises.access.mockResolvedValue(undefined);
    fs.promises.readdir.mockResolvedValue([]);
    fs.promises.stat.mockResolvedValue({ isDirectory: () => false, size: 0 });
    mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          gte: jest.fn().mockResolvedValue({ data: [], error: null }),
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: { is_admin: true } }),
          }),
        }),
      }),
    };
    createClient.mockResolvedValue(mockSupabase);
    usageTracker.getUsage.mockReturnValue({ calls: 0, limit: 100000, percentage: 0, day: '2025-01-15' });
    getCacheStats.mockReturnValue({ size: 0, keys: 0 });
  });

  it('returns 401 when user is not authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 403 when user is not admin', async () => {
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'profiles') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: { is_admin: false } }),
            }),
          }),
        };
      }
      return { select: jest.fn().mockReturnValue({ gte: jest.fn().mockResolvedValue({ data: [] }) }) };
    });
    const res = await GET();
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Forbidden');
  });

  it('returns 403 when profile is null', async () => {
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'profiles') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null }),
            }),
          }),
        };
      }
      return { select: jest.fn().mockReturnValue({ gte: jest.fn().mockResolvedValue({ data: [] }) }) };
    });
    const res = await GET();
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Forbidden');
  });

  it('returns 200 with metrics when admin', async () => {
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'profiles') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: { is_admin: true } }),
            }),
          }),
        };
      }
      if (table === 'firms') {
        return {
          select: jest.fn().mockImplementation((...args) => {
            if (args[1] && args[1].head === true) return Promise.resolve({ count: 0, error: null });
            if (args[0] && String(args[0]).includes('last_scraper_run_at')) {
              return {
                not: jest.fn().mockReturnValue({
                  order: jest.fn().mockResolvedValue({
                    data: [
                      {
                        id: 'fundingpips',
                        name: 'FundingPips',
                        last_scraper_run_at: '2025-02-14T11:00:00Z',
                        last_scraper_reviews_scraped: 50,
                        last_scraper_reviews_stored: 12,
                        last_scraper_duplicates_skipped: 38,
                        last_scraper_error: null,
                      },
                    ],
                    error: null,
                  }),
                }),
              };
            }
            return Promise.resolve({ data: [] });
          }),
        };
      }
      if (['recent_payouts', 'trustpilot_reviews', 'weekly_incidents'].includes(table)) {
        return {
          select: jest.fn().mockResolvedValue({ count: 0, error: null }),
        };
      }
      return {
        select: jest.fn().mockReturnValue({
          gte: jest.fn().mockResolvedValue({ data: [] }),
        }),
      };
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('database');
    expect(body).toHaveProperty('files');
    expect(body).toHaveProperty('arbiscan');
    expect(body.trustpilotScraper).toEqual({
      firms: [
        {
          id: 'fundingpips',
          name: 'FundingPips',
          last_scraper_run_at: '2025-02-14T11:00:00Z',
          last_scraper_reviews_scraped: 50,
          last_scraper_reviews_stored: 12,
          last_scraper_duplicates_skipped: 38,
          last_scraper_error: null,
        },
      ],
      note: 'Updated by daily GitHub Actions (sync-trustpilot-reviews). Refresh to see latest run.',
    });
  });

  it('includes trustpilotScraper.firms as empty when getTrustpilotScraperStatus returns empty', async () => {
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'profiles') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: { is_admin: true } }),
            }),
          }),
        };
      }
      if (table === 'firms') {
        return {
          select: jest.fn().mockImplementation((...args) => {
            if (args[1] && args[1].head === true) return Promise.resolve({ count: 0, error: null });
            if (args[0] && String(args[0]).includes('last_scraper_run_at')) {
              return {
                not: jest.fn().mockReturnValue({
                  order: jest.fn().mockResolvedValue({ data: [], error: null }),
                }),
              };
            }
            return Promise.resolve({ data: [] });
          }),
        };
      }
      if (['recent_payouts', 'trustpilot_reviews', 'weekly_incidents'].includes(table)) {
        return { select: jest.fn().mockResolvedValue({ count: 0, error: null }) };
      }
      return {
        select: jest.fn().mockReturnValue({
          gte: jest.fn().mockResolvedValue({ data: [] }),
        }),
      };
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.trustpilotScraper.firms).toEqual([]);
  });

  it('returns file stats when payout dir has firm subdirs and json files', async () => {
    const fs = require('fs');
    fs.promises.access.mockResolvedValue(undefined);
    fs.promises.readdir.mockImplementation((p) => {
      const s = String(p);
      if (s.includes('propfirms') && !s.includes('fundingpips')) return Promise.resolve(['fundingpips']);
      if (s.includes('fundingpips')) return Promise.resolve([{ name: '2025-01.json', isFile: () => true }]);
      return Promise.resolve([]);
    });
    fs.promises.stat.mockImplementation((p) => {
      const s = String(p);
      if (s.includes('fundingpips') && !s.endsWith('.json')) return Promise.resolve({ isDirectory: () => true, size: 0 });
      if (s.endsWith('.json')) return Promise.resolve({ isDirectory: () => false, size: 5000 });
      return Promise.resolve({ isDirectory: () => false, size: 0 });
    });
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'profiles') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: { is_admin: true } }),
            }),
          }),
        };
      }
      if (table === 'firms') {
        return {
          select: jest.fn().mockImplementation((...args) => {
            if (args[1] && args[1].head === true) return Promise.resolve({ count: 0, error: null });
            if (args[0] && String(args[0]).includes('last_scraper_run_at')) {
              return { not: jest.fn().mockReturnValue({ order: jest.fn().mockResolvedValue({ data: [], error: null }) }) };
            }
            return Promise.resolve({ data: [] });
          }),
        };
      }
      if (['recent_payouts', 'trustpilot_reviews', 'weekly_incidents'].includes(table)) {
        return { select: jest.fn().mockResolvedValue({ count: 0, error: null }) };
      }
      return {
        select: jest.fn().mockReturnValue({
          gte: jest.fn().mockResolvedValue({ data: [] }),
        }),
      };
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.files.totalBytes).toBe(5000);
    expect(body.files.totalFiles).toBe(1);
  });

  it('still returns 200 when file size critical and sendAlert rejects', async () => {
    const { sendAlert } = require('@/lib/alerts');
    sendAlert.mockRejectedValue(new Error('email failed'));
    const fs = require('fs');
    const failFileBytes = 10 * 1024 * 1024 + 1;
    fs.promises.access.mockResolvedValue(undefined);
    fs.promises.readdir.mockImplementation((p) => {
      const s = String(p);
      if (s.includes('propfirms') && !s.includes('big')) return Promise.resolve(['big']);
      if (s.includes('big')) return Promise.resolve([{ name: 'huge.json', isFile: () => true }]);
      return Promise.resolve([]);
    });
    fs.promises.stat.mockImplementation((p) => {
      const s = String(p);
      if (s.includes('big') && !s.endsWith('.json')) return Promise.resolve({ isDirectory: () => true, size: 0 });
      if (s.endsWith('.json')) return Promise.resolve({ isDirectory: () => false, size: failFileBytes });
      return Promise.resolve({ isDirectory: () => false, size: 0 });
    });
    usageTracker.getUsage.mockReturnValue({ calls: 0, limit: 100000, percentage: 0, day: '2025-01-15' });
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).checks.fileSize.status).toBe('critical');
  });

  it('still returns 200 when arbiscan critical and sendAlert rejects', async () => {
    const { sendAlert } = require('@/lib/alerts');
    sendAlert.mockRejectedValue(new Error('email failed'));
    usageTracker.getUsage.mockReturnValue({ calls: 95000, limit: 100000, percentage: 95, day: '2025-01-15' });
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).checks.arbiscan.status).toBe('critical');
  });

  it('returns file size warning when largest file is between 5MB and 10MB', async () => {
    const fs = require('fs');
    const warningSize = 6 * 1024 * 1024;
    fs.promises.access.mockResolvedValue(undefined);
    fs.promises.readdir.mockImplementation((p) => {
      const s = String(p);
      if (s.includes('propfirms') && !s.includes('mid')) return Promise.resolve(['mid']);
      if (s.includes('mid')) return Promise.resolve([{ name: 'mid.json', isFile: () => true }]);
      return Promise.resolve([]);
    });
    fs.promises.stat.mockImplementation((p) => {
      const s = String(p);
      if (s.includes('mid') && !s.endsWith('.json')) return Promise.resolve({ isDirectory: () => true, size: 0 });
      if (s.endsWith('.json')) return Promise.resolve({ isDirectory: () => false, size: warningSize });
      return Promise.resolve({ isDirectory: () => false, size: 0 });
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.checks.fileSize.status).toBe('warning');
    expect(body.checks.fileSize.maxFileBytes).toBe(warningSize);
  });

  it('returns arbiscan warning when percentage is 80', async () => {
    usageTracker.getUsage.mockReturnValue({ calls: 80000, limit: 100000, percentage: 80, day: '2025-01-15' });
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).checks.arbiscan.status).toBe('warning');
  });

  it('uses default arbiscan when usageTracker.getUsage is missing', async () => {
    const orig = usageTracker.getUsage;
    usageTracker.getUsage = undefined;
    try {
      const res = await GET();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.arbiscan.calls).toBe(0);
      expect(body.arbiscan.limit).toBe(0);
      expect(body.arbiscan.percentage).toBe(0);
      expect(body.arbiscan.day).toBe(null);
      expect(body.checks.arbiscan.status).toBe('ok');
    } finally {
      usageTracker.getUsage = orig;
    }
  });

  it('returns supabase status critical when getDbStats select rejects', async () => {
    const { sendAlert } = require('@/lib/alerts');
    sendAlert.mockRejectedValue(new Error('email failed'));
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'profiles') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: { is_admin: true } }),
            }),
          }),
        };
      }
      if (table === 'trustpilot_reviews') {
        return { select: jest.fn().mockRejectedValue(new Error('timeout')) };
      }
      if (table === 'firms') {
        return {
          select: jest.fn().mockImplementation((...args) => {
            if (args[1] && args[1].head === true) return Promise.resolve({ count: 0, error: null });
            if (args[0] && String(args[0]).includes('last_scraper_run_at')) {
              return { not: jest.fn().mockReturnValue({ order: jest.fn().mockResolvedValue({ data: [], error: null }) }) };
            }
            return Promise.resolve({ data: [] });
          }),
        };
      }
      if (table === 'recent_payouts' || table === 'weekly_incidents') {
        return { select: jest.fn().mockResolvedValue({ count: 0, error: null }) };
      }
      return {
        select: jest.fn().mockReturnValue({
          gte: jest.fn().mockResolvedValue({ data: [] }),
        }),
      };
    });
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).checks.supabase.status).toBe('critical');
  });

  it('returns propfirmsData overallStatus warning when firm has only high flag', async () => {
    let gteCallIndex = 0;
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'profiles') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: { is_admin: true } }),
            }),
          }),
        };
      }
      if (table === 'firms') {
        return {
          select: jest.fn().mockImplementation((...args) => {
            if (args[1] && args[1].head === true) return Promise.resolve({ count: 0, error: null });
            if (args[0] && String(args[0]).includes('last_scraper_run_at')) {
              return {
                not: jest.fn().mockReturnValue({
                  order: jest.fn().mockResolvedValue({ data: [], error: null }),
                }),
              };
            }
            return Promise.resolve({ data: [{ id: 'fp', name: 'FundingPips' }] });
          }),
        };
      }
      if (table === 'recent_payouts') {
        return {
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockImplementation(() => {
              const idx = gteCallIndex++;
              const rows = idx === 0 ? Array(10).fill({ firm_id: 'fp' }) : idx === 1 ? Array(7).fill({ firm_id: 'fp' }) : Array(15).fill({ firm_id: 'fp' });
              return Promise.resolve({ data: rows });
            }),
          }),
        };
      }
      if (['trustpilot_reviews', 'weekly_incidents'].includes(table)) {
        return { select: jest.fn().mockResolvedValue({ count: 0, error: null }) };
      }
      return {
        select: jest.fn().mockReturnValue({
          gte: jest.fn().mockResolvedValue({ data: [] }),
        }),
      };
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.checks.propfirmsData.status).toBe('warning');
    expect(body.checks.propfirmsData.firmsWithIssues).toHaveLength(1);
    expect(body.checks.propfirmsData.firmsWithIssues[0].status).toBe('warning');
  });

  it('includes masked recipient ab*** when ALERT_EMAIL has no @', async () => {
    const orig = process.env.ALERT_EMAIL;
    process.env.ALERT_EMAIL = 'ab';
    try {
      const res = await GET();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.alerts.recipient).toBe('ab***');
    } finally {
      process.env.ALERT_EMAIL = orig;
    }
  });

  it('returns supabase status critical when getDbStats has error', async () => {
    const { sendAlert } = require('@/lib/alerts');
    sendAlert.mockRejectedValue(new Error('email failed'));
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'profiles') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: { is_admin: true } }),
            }),
          }),
        };
      }
      if (table === 'firms') {
        return {
          select: jest.fn().mockImplementation((...args) => {
            if (args[1] && args[1].head === true) return Promise.resolve({ count: 0, error: null });
            if (args[0] && String(args[0]).includes('last_scraper_run_at')) {
              return { not: jest.fn().mockReturnValue({ order: jest.fn().mockResolvedValue({ data: [], error: null }) }) };
            }
            return Promise.resolve({ data: [] });
          }),
        };
      }
      if (table === 'recent_payouts') {
        return { select: jest.fn().mockResolvedValue({ count: null, error: { message: 'Connection failed' } }) };
      }
      if (['trustpilot_reviews', 'weekly_incidents'].includes(table)) {
        return { select: jest.fn().mockResolvedValue({ count: 0, error: null }) };
      }
      return {
        select: jest.fn().mockReturnValue({
          gte: jest.fn().mockResolvedValue({ data: [] }),
        }),
      };
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.checks.supabase.status).toBe('critical');
  });

  it('returns files with zero stats when payout dir does not exist', async () => {
    const fs = require('fs');
    fs.promises.access.mockRejectedValueOnce(new Error('enoent'));
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.files.totalBytes).toBe(0);
    expect(body.files.totalFiles).toBe(0);
    expect(body.files.error).toBe(null);
  });

  it('returns files with error when getFileStats throws', async () => {
    const fs = require('fs');
    fs.promises.access.mockResolvedValueOnce(undefined);
    fs.promises.readdir.mockRejectedValueOnce(new Error('enoent'));
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.files.error).toBe('enoent');
    expect(body.files.totalBytes).toBe(0);
  });

  it('returns trustpilotScraper.firms empty when firms query returns error', async () => {
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'profiles') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: { is_admin: true } }),
            }),
          }),
        };
      }
      if (table === 'firms') {
        return {
          select: jest.fn().mockImplementation((...args) => {
            if (args[1] && args[1].head === true) return Promise.resolve({ count: 0, error: null });
            if (args[0] && String(args[0]).includes('last_scraper_run_at')) {
              return {
                not: jest.fn().mockReturnValue({
                  order: jest.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
                }),
              };
            }
            return Promise.resolve({ data: [] });
          }),
        };
      }
      if (['recent_payouts', 'trustpilot_reviews', 'weekly_incidents'].includes(table)) {
        return { select: jest.fn().mockResolvedValue({ count: 0, error: null }) };
      }
      return {
        select: jest.fn().mockReturnValue({
          gte: jest.fn().mockResolvedValue({ data: [] }),
        }),
      };
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.trustpilotScraper.firms).toEqual([]);
  });

  it('returns propfirmsData with firmsWithIssues when payout counts trigger flags', async () => {
    const { sendAlert } = require('@/lib/alerts');
    sendAlert.mockRejectedValue(new Error('email failed'));
    let gteCallIndex = 0;
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'profiles') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: { is_admin: true } }),
            }),
          }),
        };
      }
      if (table === 'firms') {
        return {
          select: jest.fn().mockImplementation((...args) => {
            if (args[1] && args[1].head === true) return Promise.resolve({ count: 0, error: null });
            if (args[0] && String(args[0]).includes('last_scraper_run_at')) {
              return {
                not: jest.fn().mockReturnValue({
                  order: jest.fn().mockResolvedValue({ data: [], error: null }),
                }),
              };
            }
            return Promise.resolve({ data: [{ id: 'fp', name: 'FundingPips' }] });
          }),
        };
      }
      if (table === 'recent_payouts') {
        return {
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockImplementation(() => {
              const idx = gteCallIndex++;
              const rows = idx === 0 ? [] : idx === 1 ? Array(7).fill({ firm_id: 'fp' }) : Array(15).fill({ firm_id: 'fp' });
              return Promise.resolve({ data: rows });
            }),
          }),
        };
      }
      if (['trustpilot_reviews', 'weekly_incidents'].includes(table)) {
        return { select: jest.fn().mockResolvedValue({ count: 0, error: null }) };
      }
      return {
        select: jest.fn().mockReturnValue({
          gte: jest.fn().mockResolvedValue({ data: [] }),
        }),
      };
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.checks.propfirmsData.status).toBe('critical');
    expect(body.checks.propfirmsData.firmsWithIssues).toHaveLength(1);
    expect(body.checks.propfirmsData.firmsWithIssues[0].firmId).toBe('fp');
    expect(body.checks.propfirmsData.firmsWithIssues[0].status).toBe('critical');
  });

  it('includes masked alert recipient when ALERT_EMAIL is set', async () => {
    const orig = process.env.ALERT_EMAIL;
    process.env.ALERT_EMAIL = 'a@b.com';
    try {
      const res = await GET();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.alerts.recipient).toBe('a***@b.com');
    } finally {
      process.env.ALERT_EMAIL = orig;
    }
  });

  it('includes trustpilotScraper.firms as empty when getTrustpilotScraperStatus throws', async () => {
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'profiles') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: { is_admin: true } }),
            }),
          }),
        };
      }
      if (table === 'firms') {
        return {
          select: jest.fn().mockImplementation((...args) => {
            if (args[1] && args[1].head === true) return Promise.resolve({ count: 0, error: null });
            if (args[0] && String(args[0]).includes('last_scraper_run_at')) {
              return {
                not: jest.fn().mockReturnValue({
                  order: jest.fn().mockRejectedValue(new Error('DB error')),
                }),
              };
            }
            return Promise.resolve({ data: [] });
          }),
        };
      }
      if (['recent_payouts', 'trustpilot_reviews', 'weekly_incidents'].includes(table)) {
        return { select: jest.fn().mockResolvedValue({ count: 0, error: null }) };
      }
      return {
        select: jest.fn().mockReturnValue({
          gte: jest.fn().mockResolvedValue({ data: [] }),
        }),
      };
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.trustpilotScraper.firms).toEqual([]);
  });
});
