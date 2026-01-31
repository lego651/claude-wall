# Trustpilot Scraper

**TICKET-002:** Trustpilot Scraper Implementation

## Installation

### 1. Install Playwright

```bash
npm install playwright
npx playwright install chromium
```

### 2. Install TypeScript Executor (for testing)

```bash
npm install -D tsx
```

## Usage

### Basic Scraping

```typescript
import { scrapeAndStoreReviews } from '@/lib/scrapers/trustpilot';

// Scrape and store reviews for a firm
const result = await scrapeAndStoreReviews('fundednext');

console.log(`Scraped: ${result.reviewsScraped} reviews`);
console.log(`Stored: ${result.reviewsStored} reviews`);
console.log(`Duplicates: ${result.duplicatesSkipped}`);
```

### With Custom Configuration

```typescript
const result = await scrapeAndStoreReviews('ftmo', {
  headless: true,      // Run in headless mode (default)
  maxReviews: 50,      // Max reviews to scrape (default)
  delayMs: 3000,       // Delay between requests (default 3s)
  timeout: 30000,      // Page load timeout (default 30s)
});
```

### Scrape Without Storing

```typescript
import { scrapeTrustpilot } from '@/lib/scrapers/trustpilot';

// Just scrape (don't store in database)
const result = await scrapeTrustpilot('topstep');

// Reviews available in result.reviews
result.reviews.forEach(review => {
  console.log(`${review.rating}/5: ${review.title}`);
});
```

## Testing

### Run Test Script

```bash
npx tsx scripts/test-trustpilot-scraper.ts
```

This will:
1. Scrape reviews from FundedNext, FTMO, TopStep
2. Store them in Supabase
3. Display results with sample data
4. Handle duplicates gracefully

### Expected Output

```
================================================================================
TRUSTPILOT SCRAPER TEST
================================================================================

================================================================================
Testing: FUNDEDNEXT
================================================================================
[Trustpilot Scraper] Starting scrape for fundednext
[Trustpilot Scraper] URL: https://www.trustpilot.com/review/fundednext.com
[Trustpilot Scraper] Navigating to https://www.trustpilot.com/review/fundednext.com
[Trustpilot Scraper] Page loaded, extracting reviews...
[Trustpilot Scraper] Extracted 50 reviews from page
[Trustpilot Scraper] Successfully scraped 50 reviews
[Trustpilot Scraper] Storing 50 reviews for fundednext
[Trustpilot Scraper] Stored 50 reviews, skipped 0 duplicates

📊 RESULTS:
  Success: ✅
  Reviews scraped: 50
  Reviews stored: 50
  Duplicates skipped: 0

📝 Sample review:
  Rating: 5/5 ⭐
  Title: Great experience
  Date: 1/24/2026
  Text: I've been trading with FundedNext for 6 months and received 3 payouts so far...
```

## Supported Firms

Current firms with Trustpilot URLs configured:

- `fundednext` - https://www.trustpilot.com/review/fundednext.com
- `ftmo` - https://www.trustpilot.com/review/ftmo.com
- `topstep` - https://www.trustpilot.com/review/topsteptrader.com

### Adding New Firms

Edit `lib/scrapers/trustpilot.ts` and add to `TRUSTPILOT_URLS`:

```typescript
const TRUSTPILOT_URLS: Record<string, string> = {
  // ... existing firms
  newfirm: 'https://www.trustpilot.com/review/newfirm.com',
};
```

## Database Schema

Reviews are stored in the `trustpilot_reviews` table:

```sql
CREATE TABLE trustpilot_reviews (
  id SERIAL PRIMARY KEY,
  firm_id TEXT NOT NULL REFERENCES firms(id),
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  review_text TEXT NOT NULL,
  reviewer_name TEXT,
  review_date DATE NOT NULL,
  trustpilot_url TEXT UNIQUE NOT NULL, -- Prevents duplicates
  -- AI classification fields (populated later)
  category TEXT,
  severity TEXT,
  confidence FLOAT,
  ai_summary TEXT,
  classified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Error Handling

### Common Errors

**1. Playwright not installed**
```
Error: browserType.launch: Executable doesn't exist
```
**Solution:** Run `npx playwright install chromium`

**2. Firm not found**
```
Error: No Trustpilot URL configured for firm: xyz
```
**Solution:** Add firm to `TRUSTPILOT_URLS` in `trustpilot.ts`

**3. Timeout errors**
```
Error: Timeout 30000ms exceeded
```
**Solution:** Increase timeout in config or check internet connection

**4. Duplicate reviews**
```
Error code: 23505 (unique constraint violation)
```
**Solution:** This is expected! Duplicates are automatically skipped.

### Rate Limiting

The scraper includes built-in protections:
- Random delays between requests (2-5 seconds)
- User agent rotation
- Headless mode to avoid detection
- Respectful crawling (max 50 reviews by default)

If you get blocked:
1. Increase `delayMs` to 5000-10000ms
2. Use residential proxies (Bright Data: $15/month)
3. Reduce `maxReviews` to 10-20

## Debugging

### Run in Non-Headless Mode

```typescript
const result = await scrapeAndStoreReviews('fundednext', {
  headless: false, // Opens visible browser
});
```

This lets you see exactly what the scraper is doing.

### Check Console Logs

All operations are logged with `[Trustpilot Scraper]` prefix:
- Starting scrape
- Navigating to URL
- Page loaded
- Reviews extracted
- Reviews stored

### Verify Database

```sql
-- Check total reviews
SELECT COUNT(*) FROM trustpilot_reviews;

-- Check reviews per firm
SELECT firm_id, COUNT(*) as review_count
FROM trustpilot_reviews
GROUP BY firm_id;

-- Check recent reviews
SELECT firm_id, rating, title, review_date
FROM trustpilot_reviews
ORDER BY created_at DESC
LIMIT 10;

-- Check for duplicates (should be 0)
SELECT trustpilot_url, COUNT(*) as count
FROM trustpilot_reviews
GROUP BY trustpilot_url
HAVING COUNT(*) > 1;
```

## Next Steps (TICKET-003)

After scraper is working:
1. Create cron job to run daily: `/api/cron/scrape-trustpilot`
2. Implement AI classification: `TICKET-006`
3. Add more firms to `TRUSTPILOT_URLS`

## Performance

- **Speed:** ~10-15 seconds per firm (50 reviews)
- **Memory:** ~100-200MB per scrape
- **Cost:** $0 (open source tools)

## Support

If scraper fails:
1. Check Trustpilot hasn't changed their HTML structure
2. Update selectors in `trustpilot.ts`:
   - `[data-service-review-card-paper]` - Review cards
   - `[data-service-review-rating]` - Rating
   - `[data-service-review-text-typography]` - Review text
3. Test with headless: false to see what's happening
