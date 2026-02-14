/**
 * Trustpilot scraper tests
 * TICKET-011: Unit tests for lib/scrapers/trustpilot.ts
 * Covers: getFirmsWithTrustpilot, storeReviews, scrapeTrustpilot, scrapeAndStoreReviews
 */

/* eslint-disable no-console */
const consoleLog = console.log;
const consoleError = console.error;

jest.mock('@/lib/supabase/service');
jest.mock('playwright', () => ({
  chromium: {
    launch: jest.fn(),
  },
}));

import { chromium } from 'playwright';
import { createServiceClient } from '@/lib/supabase/service';
import trustpilotDefault, {
  getFirmsWithTrustpilot,
  storeReviews,
  scrapeTrustpilot,
  scrapeAndStoreReviews,
  type TrustpilotReview,
  type FirmWithTrustpilot,
} from '@/lib/scrapers/trustpilot';

describe('Trustpilot scraper', () => {
  let mockSupabase: {
    from: jest.Mock;
    select: jest.Mock;
    not: jest.Mock;
    eq: jest.Mock;
    single: jest.Mock;
    insert: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn();
    console.error = jest.fn();

    const chain = {
      select: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      insert: jest.fn().mockResolvedValue({ error: null }),
    };
    mockSupabase = {
      from: jest.fn().mockReturnValue(chain),
      select: chain.select,
      not: chain.not,
      eq: chain.eq,
      single: chain.single,
      insert: chain.insert,
    };
    (createServiceClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  afterAll(() => {
    console.log = consoleLog;
    console.error = consoleError;
  });

  describe('getFirmsWithTrustpilot', () => {
    it('returns firms with trustpilot_url from DB', async () => {
      const data: FirmWithTrustpilot[] = [
        { id: 'fundingpips', trustpilot_url: 'https://www.trustpilot.com/review/fundingpips.com' },
        { id: 'fxify', trustpilot_url: 'https://www.trustpilot.com/review/fxify.com' },
      ];
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          not: jest.fn().mockResolvedValue({ data, error: null }),
        }),
      });

      const result = await getFirmsWithTrustpilot();
      expect(result).toEqual(data);
      expect(mockSupabase.from).toHaveBeenCalledWith('firms');
    });

    it('throws when Supabase returns error', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          not: jest.fn().mockResolvedValue({ data: null, error: { message: 'Connection failed' } }),
        }),
      });

      await expect(getFirmsWithTrustpilot()).rejects.toThrow('Failed to fetch firms with Trustpilot');
    });

    it('returns empty array when no data', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          not: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      });

      const result = await getFirmsWithTrustpilot();
      expect(result).toEqual([]);
    });
  });

  describe('storeReviews', () => {
    const sampleReviews: TrustpilotReview[] = [
      {
        rating: 5,
        title: 'Great',
        reviewText: 'Fast payout',
        reviewerName: 'User1',
        reviewDate: new Date('2025-01-15'),
        trustpilotUrl: 'https://www.trustpilot.com/review/1',
      },
      {
        rating: 4,
        title: null,
        reviewText: 'Good service',
        reviewerName: null,
        reviewDate: new Date('2025-01-16'),
        trustpilotUrl: 'https://www.trustpilot.com/review/2',
      },
    ];

    it('returns stored and duplicates count when all inserts succeed', async () => {
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({ error: null }),
      });

      const result = await storeReviews('fundingpips', sampleReviews);
      expect(result).toEqual({ stored: 2, duplicates: 0 });
    });

    it('counts duplicates when insert returns 23505', async () => {
      const fromChain = {
        insert: jest
          .fn()
          .mockResolvedValueOnce({ error: null })
          .mockResolvedValueOnce({ error: { code: '23505' } }),
      };
      mockSupabase.from.mockReturnValue(fromChain);

      const result = await storeReviews('fundingpips', sampleReviews);
      expect(result).toEqual({ stored: 1, duplicates: 1 });
    });

    it('counts only duplicates when all inserts are duplicate', async () => {
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({ error: { code: '23505' } }),
      });

      const result = await storeReviews('fundingpips', sampleReviews);
      expect(result).toEqual({ stored: 0, duplicates: 2 });
    });

    it('logs but does not throw on non-23505 insert error', async () => {
      mockSupabase.from.mockReturnValue({
        insert: jest
          .fn()
          .mockResolvedValueOnce({ error: null })
          .mockResolvedValueOnce({ error: { code: 'OTHER', message: 'DB error' } }),
      });

      const result = await storeReviews('fundingpips', sampleReviews);
      expect(result.stored).toBe(1);
      expect(result.duplicates).toBe(0);
    });
  });

  describe('scrapeTrustpilot', () => {
    function createMockBrowserAndPage(overrides?: { $$evalResolve?: unknown[] }) {
      const mockPage = {
        setDefaultTimeout: jest.fn(),
        goto: jest.fn().mockResolvedValue(undefined),
        waitForSelector: jest.fn().mockResolvedValue(undefined),
        $$: jest.fn().mockResolvedValue([{}, {}]),
        $$eval: jest.fn().mockResolvedValue(
          overrides?.$$evalResolve ?? [
            {
              rating: 5,
              title: 'Good',
              reviewText: 'Fast payout',
              reviewerName: 'Alice',
              dateString: 'January 24, 2026',
              reviewUrl: 'https://www.trustpilot.com/review/abc',
            },
            {
              rating: 4,
              title: null,
              reviewText: 'Solid',
              reviewerName: 'Bob',
              dateString: '2 days ago',
              reviewUrl: 'https://www.trustpilot.com/review/def',
            },
          ]
        ),
      };
      const mockContext = { newPage: jest.fn().mockResolvedValue(mockPage) };
      const mockBrowser = {
        newContext: jest.fn().mockResolvedValue(mockContext),
        close: jest.fn().mockResolvedValue(undefined),
      };
      return { mockBrowser, mockPage, mockContext };
    }

    it('returns success and reviews when URL is passed and browser returns data', async () => {
      const { mockBrowser } = createMockBrowserAndPage();
      (chromium.launch as jest.Mock).mockResolvedValue(mockBrowser);

      const result = await scrapeTrustpilot('fundingpips', { maxPages: 1, maxReviews: 10 }, 'https://www.trustpilot.com/review/fundingpips.com');

      expect(result.success).toBe(true);
      expect(result.firmId).toBe('fundingpips');
      expect(result.reviewsScraped).toBeGreaterThanOrEqual(1);
      expect(result.reviews.length).toBeGreaterThanOrEqual(1);
      expect(result.reviews[0]).toMatchObject({
        rating: 5,
        title: 'Good',
        reviewText: 'Fast payout',
        trustpilotUrl: 'https://www.trustpilot.com/review/abc',
      });
      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('throws when no URL and DB returns null', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });

      const result = await scrapeTrustpilot('unknownfirm', { maxPages: 1 });
      expect(result.success).toBe(false);
      expect(result.error).toContain('No Trustpilot URL for firm');
    });

    it('fetches URL from DB when trustpilotUrl not passed', async () => {
      const { mockBrowser } = createMockBrowserAndPage();
      (chromium.launch as jest.Mock).mockResolvedValue(mockBrowser);
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { trustpilot_url: 'https://www.trustpilot.com/review/the5ers.com' },
              error: null,
            }),
          }),
        }),
      });

      const result = await scrapeTrustpilot('the5ers', { maxPages: 1, maxReviews: 10 });
      expect(result.success).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('firms');
    });

    it('returns error result and closes browser when launch throws', async () => {
      (chromium.launch as jest.Mock).mockRejectedValue(new Error('Browser failed'));

      const result = await scrapeTrustpilot('fundingpips', { maxPages: 1 }, 'https://www.trustpilot.com/review/fundingpips.com');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Browser failed');
    });

    it('stops at maxReviews', async () => {
      const manyReviews = Array.from({ length: 25 }, (_, i) => ({
        rating: 5,
        title: `Title ${i}`,
        reviewText: `Text ${i}`,
        reviewerName: 'User',
        dateString: 'January 24, 2026',
        reviewUrl: `https://www.trustpilot.com/review/id-${i}`,
      }));
      const { mockBrowser } = createMockBrowserAndPage({ $$evalResolve: manyReviews });
      (chromium.launch as jest.Mock).mockResolvedValue(mockBrowser);

      const result = await scrapeTrustpilot('fundingpips', { maxPages: 3, maxReviews: 10 }, 'https://www.trustpilot.com/review/fundingpips.com');

      expect(result.success).toBe(true);
      expect(result.reviewsScraped).toBe(10);
      expect(result.reviews).toHaveLength(10);
    });

    it('calls randomDelay between pages when maxPages > 1', async () => {
      jest.useFakeTimers();
      const reviewsPage1 = [
        { rating: 5, title: 'A', reviewText: 'A', reviewerName: 'U', dateString: 'January 24, 2026', reviewUrl: 'https://www.trustpilot.com/review/a' },
      ];
      const reviewsPage2 = [
        { rating: 4, title: 'B', reviewText: 'B', reviewerName: 'U', dateString: 'January 23, 2026', reviewUrl: 'https://www.trustpilot.com/review/b' },
      ];
      const mockPage = {
        setDefaultTimeout: jest.fn(),
        goto: jest.fn().mockResolvedValue(undefined),
        waitForSelector: jest.fn().mockResolvedValue(undefined),
        $$: jest.fn().mockResolvedValue([{}, {}]),
        $$eval: jest
          .fn()
          .mockResolvedValueOnce(reviewsPage1)
          .mockResolvedValueOnce(reviewsPage2),
      };
      const mockContext = { newPage: jest.fn().mockResolvedValue(mockPage) };
      const mockBrowser = {
        newContext: jest.fn().mockResolvedValue(mockContext),
        close: jest.fn().mockResolvedValue(undefined),
      };
      (chromium.launch as jest.Mock).mockResolvedValue(mockBrowser);

      const resultPromise = scrapeTrustpilot('fundingpips', { maxPages: 2, maxReviews: 10, delayMs: 100 }, 'https://www.trustpilot.com/review/fundingpips.com');
      await jest.advanceTimersByTimeAsync(5000);
      const result = await resultPromise;
      jest.useRealTimers();

      expect(result.success).toBe(true);
      expect(result.reviewsScraped).toBe(2);
    });

    it('parses relative date strings (hours, weeks) and invalid date fallback', async () => {
      const { mockBrowser } = createMockBrowserAndPage({
        $$evalResolve: [
          { rating: 5, title: 'H', reviewText: 'Hour', reviewerName: 'U', dateString: '2 hours ago', reviewUrl: 'https://www.trustpilot.com/review/h' },
          { rating: 4, title: 'W', reviewText: 'Week', reviewerName: 'U', dateString: '3 weeks ago', reviewUrl: 'https://www.trustpilot.com/review/w' },
          { rating: 5, title: 'X', reviewText: 'Invalid date', reviewerName: 'U', dateString: 'not-a-date-xyz', reviewUrl: 'https://www.trustpilot.com/review/x' },
        ],
      });
      (chromium.launch as jest.Mock).mockResolvedValue(mockBrowser);

      const result = await scrapeTrustpilot('fundingpips', { maxPages: 1, maxReviews: 10 }, 'https://www.trustpilot.com/review/fundingpips.com');

      expect(result.success).toBe(true);
      expect(result.reviews).toHaveLength(3);
      expect(result.reviews[0].reviewDate).toBeInstanceOf(Date);
      expect(result.reviews[1].reviewDate).toBeInstanceOf(Date);
      expect(result.reviews[2].reviewDate).toBeInstanceOf(Date); // fallback to new Date()
    });
  });

  describe('scrapeAndStoreReviews', () => {
    function createMockBrowserAndPage($$evalResolve: unknown[] = []) {
      const mockPage = {
        setDefaultTimeout: jest.fn(),
        goto: jest.fn().mockResolvedValue(undefined),
        waitForSelector: jest.fn().mockResolvedValue(undefined),
        $$: jest.fn().mockResolvedValue($$evalResolve.length ? [{}] : []),
        $$eval: jest.fn().mockResolvedValue($$evalResolve),
      };
      const mockContext = { newPage: jest.fn().mockResolvedValue(mockPage) };
      const mockBrowser = {
        newContext: jest.fn().mockResolvedValue(mockContext),
        close: jest.fn().mockResolvedValue(undefined),
      };
      return { mockBrowser };
    }

    it('stores reviews when scrape succeeds with data', async () => {
      const { mockBrowser } = createMockBrowserAndPage([
        {
          rating: 5,
          title: 'Good',
          reviewText: 'Fast',
          reviewerName: 'U',
          dateString: 'January 24, 2026',
          reviewUrl: 'https://www.trustpilot.com/review/x',
        },
      ]);
      (chromium.launch as jest.Mock).mockResolvedValue(mockBrowser);
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({ error: null }),
      });

      const result = await scrapeAndStoreReviews('fundingpips', { maxPages: 1 }, 'https://www.trustpilot.com/review/fundingpips.com');

      expect(result.success).toBe(true);
      expect(result.reviewsScraped).toBe(1);
      expect(result.reviewsStored).toBe(1);
      expect(mockSupabase.from).toHaveBeenCalledWith('trustpilot_reviews');
    });

    it('does not set reviewsStored when scrape returns no reviews', async () => {
      const { mockBrowser } = createMockBrowserAndPage([]);
      (chromium.launch as jest.Mock).mockResolvedValue(mockBrowser);

      const result = await scrapeAndStoreReviews('fundingpips', { maxPages: 1 }, 'https://www.trustpilot.com/review/fundingpips.com');

      expect(result.success).toBe(true);
      expect(result.reviewsScraped).toBe(0);
      expect(result.reviewsStored).toBe(0);
      expect(result.duplicatesSkipped).toBe(0);
      expect(mockSupabase.from).not.toHaveBeenCalledWith('trustpilot_reviews');
    });
  });

  describe('default export', () => {
    it('exposes scrapeTrustpilot, storeReviews, scrapeAndStoreReviews', () => {
      expect(trustpilotDefault.scrapeTrustpilot).toBe(scrapeTrustpilot);
      expect(trustpilotDefault.storeReviews).toBe(storeReviews);
      expect(trustpilotDefault.scrapeAndStoreReviews).toBe(scrapeAndStoreReviews);
    });
  });
});
