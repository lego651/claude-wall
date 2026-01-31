/**
 * TRUSTPILOT SCRAPER
 * TICKET-002: Trustpilot Scraper Implementation
 *
 * Scrapes Trustpilot reviews for prop trading firms
 * Uses Playwright for headless browser automation
 */

import { chromium, Browser, Page } from 'playwright';
import { createServiceClient } from '@/libs/supabase/service';

// ============================================================================
// TYPES
// ============================================================================

export interface TrustpilotReview {
  rating: number;
  title: string | null;
  reviewText: string;
  reviewerName: string | null;
  reviewDate: Date;
  trustpilotUrl: string;
}

export interface ScraperConfig {
  headless?: boolean;
  maxReviews?: number;
  delayMs?: number; // Random delay between requests (2000-5000ms recommended)
  timeout?: number; // Page load timeout
}

export interface ScraperResult {
  firmId: string;
  reviews: TrustpilotReview[];
  scrapedAt: Date;
  success: boolean;
  error?: string;
  reviewsScraped: number;
  reviewsStored: number;
  duplicatesSkipped: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_CONFIG: ScraperConfig = {
  headless: true,
  maxReviews: 50,
  delayMs: 3000, // 3 second delay between pages
  timeout: 30000, // 30 second timeout
};

// Trustpilot URL mappings for known firms
const TRUSTPILOT_URLS: Record<string, string> = {
  fundednext: 'https://www.trustpilot.com/review/fundednext.com',
  the5ers: 'https://www.trustpilot.com/review/the5ers.com',
  fundingpips: 'https://www.trustpilot.com/review/fundingpips.com',
  alphacapitalgroup: 'https://www.trustpilot.com/review/alphacapitalgroup.com',
  blueguardian: 'https://www.trustpilot.com/review/blueguardian.com',
  aquafunded: 'https://www.trustpilot.com/review/aquafunded.com',
  instantfunding: 'https://www.trustpilot.com/review/instantfunding.com',
  fxify: 'https://www.trustpilot.com/review/fxify.com',
  // Add more as needed for TICKET-003
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Add random delay to avoid rate limiting
 */
function randomDelay(baseMs: number): Promise<void> {
  const variation = baseMs * 0.3; // ±30% variation
  const delay = baseMs + (Math.random() * variation * 2 - variation);
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Parse Trustpilot date string to Date object
 */
function parseTrustpilotDate(dateString: string): Date {
  // Trustpilot uses format like "January 24, 2026" or relative dates
  try {
    // Handle relative dates like "2 days ago"
    if (dateString.includes('ago')) {
      const now = new Date();
      if (dateString.includes('hour')) {
        const hours = parseInt(dateString);
        now.setHours(now.getHours() - hours);
      } else if (dateString.includes('day')) {
        const days = parseInt(dateString);
        now.setDate(now.getDate() - days);
      } else if (dateString.includes('week')) {
        const weeks = parseInt(dateString);
        now.setDate(now.getDate() - weeks * 7);
      }
      return now;
    }

    // Try standard date parsing
    return new Date(dateString);
  } catch (error) {
    console.error(`Failed to parse date: ${dateString}`, error);
    return new Date(); // Fallback to current date
  }
}

// ============================================================================
// MAIN SCRAPER FUNCTION
// ============================================================================

/**
 * Scrape Trustpilot reviews for a specific firm
 *
 * @param firmId - Firm ID (must exist in TRUSTPILOT_URLS)
 * @param config - Optional scraper configuration
 * @returns ScraperResult with reviews and metadata
 */
export async function scrapeTrustpilot(
  firmId: string,
  config: ScraperConfig = {}
): Promise<ScraperResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const result: ScraperResult = {
    firmId,
    reviews: [],
    scrapedAt: new Date(),
    success: false,
    reviewsScraped: 0,
    reviewsStored: 0,
    duplicatesSkipped: 0,
  };

  let browser: Browser | null = null;

  try {
    // Validate firm ID
    const trustpilotUrl = TRUSTPILOT_URLS[firmId];
    if (!trustpilotUrl) {
      throw new Error(`No Trustpilot URL configured for firm: ${firmId}`);
    }

    console.log(`[Trustpilot Scraper] Starting scrape for ${firmId}`);
    console.log(`[Trustpilot Scraper] URL: ${trustpilotUrl}`);

    // Launch browser
    browser = await chromium.launch({
      headless: cfg.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
      ],
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
    });

    const page = await context.newPage();
    page.setDefaultTimeout(cfg.timeout!);

    // Navigate to Trustpilot page
    console.log(`[Trustpilot Scraper] Navigating to ${trustpilotUrl}`);
    await page.goto(trustpilotUrl, { waitUntil: 'networkidle' });

    // Wait for reviews to load
    await page.waitForSelector('[data-service-review-card-paper]', { timeout: 10000 });

    console.log(`[Trustpilot Scraper] Page loaded, extracting reviews...`);

    // Extract reviews
    const reviews = await page.$$eval('[data-service-review-card-paper]', (cards) => {
      return cards.slice(0, 50).map((card) => {
        // Extract rating
        const ratingElement = card.querySelector('[data-service-review-rating]');
        const ratingStr = ratingElement?.getAttribute('data-service-review-rating');
        const rating = ratingStr ? parseInt(ratingStr) : 0;

        // Extract title
        const titleElement = card.querySelector('h2');
        const title = titleElement?.textContent?.trim() || null;

        // Extract review text
        const textElement = card.querySelector('[data-service-review-text-typography]');
        const reviewText = textElement?.textContent?.trim() || '';

        // Extract reviewer name
        const nameElement = card.querySelector('[data-consumer-name-typography]');
        const reviewerName = nameElement?.textContent?.trim() || null;

        // Extract date
        const dateElement = card.querySelector('time');
        const dateString = dateElement?.getAttribute('datetime') || dateElement?.textContent?.trim() || '';

        // Extract review URL
        const linkElement = card.querySelector('a[href*="/reviews/"]');
        const reviewUrl = linkElement?.getAttribute('href') || '';

        return {
          rating,
          title,
          reviewText,
          reviewerName,
          dateString,
          reviewUrl: reviewUrl.startsWith('http') ? reviewUrl : `https://www.trustpilot.com${reviewUrl}`,
        };
      });
    });

    console.log(`[Trustpilot Scraper] Extracted ${reviews.length} reviews from page`);

    // Parse and validate reviews
    result.reviews = reviews
      .filter(r => r.reviewText && r.rating > 0)
      .map(r => ({
        rating: r.rating,
        title: r.title,
        reviewText: r.reviewText,
        reviewerName: r.reviewerName,
        reviewDate: parseTrustpilotDate(r.dateString),
        trustpilotUrl: r.reviewUrl,
      }));

    result.reviewsScraped = result.reviews.length;
    result.success = true;

    console.log(`[Trustpilot Scraper] Successfully scraped ${result.reviewsScraped} reviews`);

    // Close browser
    await browser.close();

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Trustpilot Scraper] Error scraping ${firmId}:`, errorMessage);
    result.error = errorMessage;

    if (browser) {
      await browser.close();
    }
  }

  return result;
}

// ============================================================================
// DATABASE STORAGE FUNCTION
// ============================================================================

/**
 * Store scraped reviews in Supabase
 * Handles duplicates by checking trustpilot_url uniqueness
 *
 * @param firmId - Firm ID
 * @param reviews - Array of reviews to store
 * @returns Number of reviews stored (excluding duplicates)
 */
export async function storeReviews(
  firmId: string,
  reviews: TrustpilotReview[]
): Promise<{ stored: number; duplicates: number }> {
  const supabase = createServiceClient();
  let stored = 0;
  let duplicates = 0;

  console.log(`[Trustpilot Scraper] Storing ${reviews.length} reviews for ${firmId}`);

  for (const review of reviews) {
    try {
      const { error } = await supabase
        .from('trustpilot_reviews')
        .insert({
          firm_id: firmId,
          rating: review.rating,
          title: review.title,
          review_text: review.reviewText,
          reviewer_name: review.reviewerName,
          review_date: review.reviewDate.toISOString().split('T')[0], // Date only
          trustpilot_url: review.trustpilotUrl,
        });

      if (error) {
        // Check if duplicate (unique constraint violation)
        if (error.code === '23505') {
          duplicates++;
          console.log(`[Trustpilot Scraper] Duplicate skipped: ${review.trustpilotUrl}`);
        } else {
          console.error(`[Trustpilot Scraper] Error storing review:`, error);
        }
      } else {
        stored++;
      }
    } catch (error) {
      console.error(`[Trustpilot Scraper] Unexpected error storing review:`, error);
    }
  }

  console.log(`[Trustpilot Scraper] Stored ${stored} reviews, skipped ${duplicates} duplicates`);

  return { stored, duplicates };
}

// ============================================================================
// SCRAPE AND STORE (COMBINED FUNCTION)
// ============================================================================

/**
 * Scrape Trustpilot reviews and store them in database
 * This is the main function to use for scraping
 *
 * @param firmId - Firm ID to scrape
 * @param config - Optional scraper configuration
 * @returns ScraperResult with storage metrics
 */
export async function scrapeAndStoreReviews(
  firmId: string,
  config: ScraperConfig = {}
): Promise<ScraperResult> {
  // Scrape reviews
  const result = await scrapeTrustpilot(firmId, config);

  // If scraping succeeded, store reviews
  if (result.success && result.reviews.length > 0) {
    const { stored, duplicates } = await storeReviews(firmId, result.reviews);
    result.reviewsStored = stored;
    result.duplicatesSkipped = duplicates;
  }

  return result;
}

// ============================================================================
// EXPORT DEFAULT
// ============================================================================

export default {
  scrapeTrustpilot,
  storeReviews,
  scrapeAndStoreReviews,
};
