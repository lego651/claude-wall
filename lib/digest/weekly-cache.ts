/**
 * In-Memory Cache for Weekly Digest Data
 *
 * Caches firm content and industry news for a specific week to avoid
 * redundant database queries when sending digests to multiple users.
 *
 * TTL: 1 hour (content doesn't change during digest send window)
 */

import { createServiceClient } from '@/lib/supabase/service';
import { getWeekNumberUtc, getYearUtc } from '@/lib/digest/week-utils';
import type {
  FirmContentByType,
  FirmContentItem,
  FirmTopTweet,
  IndustryNewsItem,
} from './content-aggregator';
import { getTopTweetsForFirms } from './content-aggregator';

interface WeeklyDigestCache {
  weekKey: string; // "2026-W08"
  firmContent: Map<string, FirmContentByType>;
  industryNews: IndustryNewsItem[];
  topTweets: Map<string, FirmTopTweet[]>;
  cachedAt: number;
  expiresAt: number;
}

// In-memory cache (per instance, will reset on serverless cold start)
let cache: WeeklyDigestCache | null = null;

const TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Generate cache key from week start date
 */
function getWeekKey(weekStart: string): string {
  const date = new Date(weekStart);
  const year = getYearUtc(date);
  const week = getWeekNumberUtc(date);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/**
 * Get cached weekly digest data, or fetch fresh data if cache is expired/invalid.
 *
 * This function fetches ALL firm content for ALL firms at once, then caches it.
 * Individual user digests filter this cached data based on their subscriptions.
 *
 * @param weekStart ISO date string (e.g., "2026-02-17")
 * @param weekEnd ISO date string (e.g., "2026-02-23")
 * @returns Cached or fresh digest data for the week
 */
export async function getCachedWeeklyDigestData(
  weekStart: string,
  weekEnd: string
): Promise<{
  firmContent: Map<string, FirmContentByType>;
  industryNews: IndustryNewsItem[];
  topTweets: Map<string, FirmTopTweet[]>;
}> {
  const weekKey = getWeekKey(weekStart);
  const now = Date.now();

  // Check if cache is valid
  if (cache && cache.weekKey === weekKey && cache.expiresAt > now) {
    console.log('[Weekly Cache] HIT:', weekKey, {
      age: Math.round((now - cache.cachedAt) / 1000),
      ttl: Math.round((cache.expiresAt - now) / 1000),
    });
    return {
      firmContent: cache.firmContent,
      industryNews: cache.industryNews,
      topTweets: cache.topTweets,
    };
  }

  console.log('[Weekly Cache] MISS, fetching fresh data:', weekKey);

  // Fetch fresh data
  const data = await fetchAllWeeklyDigestData(weekStart, weekEnd);

  // Update cache
  cache = {
    weekKey,
    firmContent: data.firmContent,
    industryNews: data.industryNews,
    topTweets: data.topTweets,
    cachedAt: now,
    expiresAt: now + TTL_MS,
  };

  console.log('[Weekly Cache] Cached new data:', weekKey, {
    firms: cache.firmContent.size,
    industryNews: cache.industryNews.length,
    topTweetsFirms: cache.topTweets.size,
    expiresIn: Math.round(TTL_MS / 1000),
  });

  return {
    firmContent: cache.firmContent,
    industryNews: cache.industryNews,
    topTweets: cache.topTweets,
  };
}

/**
 * Fetch all weekly digest data from database (uncached).
 * Called when cache is expired or invalid.
 */
async function fetchAllWeeklyDigestData(
  weekStart: string,
  weekEnd: string
): Promise<{
  firmContent: Map<string, FirmContentByType>;
  industryNews: IndustryNewsItem[];
  topTweets: Map<string, FirmTopTweet[]>;
}> {
  const supabase = createServiceClient();
  const weekStartDate = weekStart.slice(0, 10);
  const weekEndDate = weekEnd.slice(0, 10);

  console.log('[Weekly Cache] Fetching data for:', {
    weekStartDate,
    weekEndDate,
  });

  // Get all active firms (with Trustpilot URLs)
  const { data: firms, error: firmsError } = await supabase
    .from('firm_profiles')
    .select('id')
    .not('trustpilot_url', 'is', null);

  if (firmsError) {
    console.error('[Weekly Cache] Failed to fetch firms:', firmsError);
    throw new Error(`Failed to fetch firms: ${firmsError.message}`);
  }

  const allFirmIds = ((firms || []) as { id: string }[]).map((f) => f.id);

  // Fetch all published content for the week + top tweets (S8-TW-006b)
  const [
    { data: firmContentItems, error: firmContentError },
    { data: industryNewsItems, error: industryNewsError },
    topTweets,
  ] = await Promise.all([
    supabase
      .from('firm_content_items')
      .select('*')
      .in('firm_id', allFirmIds)
      .eq('published', true) // Only published content
      .gte('content_date', weekStartDate)
      .lte('content_date', weekEndDate)
      .order('content_date', { ascending: false }),

    supabase
      .from('industry_news_items')
      .select('*')
      .eq('published', true) // Only published content
      .gte('content_date', weekStartDate)
      .lte('content_date', weekEndDate)
      .order('content_date', { ascending: false })
      .limit(10),

    getTopTweetsForFirms(allFirmIds, weekStartDate, weekEndDate),
  ]);

  if (firmContentError) {
    console.error('[Weekly Cache] Failed to fetch firm content:', firmContentError);
    throw new Error(`Failed to fetch firm content: ${firmContentError.message}`);
  }

  if (industryNewsError) {
    console.error('[Weekly Cache] Failed to fetch industry news:', industryNewsError);
    throw new Error(`Failed to fetch industry news: ${industryNewsError.message}`);
  }

  // Group firm content by firm ID and type
  const firmContentMap = new Map<string, FirmContentByType>();

  // Initialize all firms with empty arrays
  for (const firmId of allFirmIds) {
    firmContentMap.set(firmId, {
      company_news: [],
      rule_change: [],
      promotion: [],
    });
  }

  // Populate with actual content
  const firmItems = (firmContentItems || []) as unknown as FirmContentItem[];
  for (const item of firmItems) {
    const firmContent = firmContentMap.get(item.firm_id);
    if (!firmContent) continue;

    if (item.content_type === 'company_news') {
      firmContent.company_news.push(item);
    } else if (item.content_type === 'rule_change') {
      firmContent.rule_change.push(item);
    } else if (item.content_type === 'promotion') {
      firmContent.promotion.push(item);
    }
  }

  console.log('[Weekly Cache] Fetched:', {
    firms: firmContentMap.size,
    firmContentItems: firmContentItems?.length || 0,
    industryNews: industryNewsItems?.length || 0,
    topTweetsFirms: topTweets.size,
  });

  return {
    firmContent: firmContentMap,
    industryNews: (industryNewsItems || []) as unknown as IndustryNewsItem[],
    topTweets,
  };
}

/**
 * Manually invalidate the cache (useful after admin approves new content).
 * Call this after bulk approve operations.
 */
export function invalidateWeeklyCache() {
  if (cache) {
    console.log('[Weekly Cache] Invalidated:', cache.weekKey);
    cache = null;
  }
}

/**
 * Get cache stats for monitoring/debugging
 */
export function getWeeklyCacheStats() {
  if (!cache) {
    return { cached: false };
  }

  const now = Date.now();
  const age = now - cache.cachedAt;
  const remaining = cache.expiresAt - now;

  return {
    cached: true,
    weekKey: cache.weekKey,
    firmCount: cache.firmContent.size,
    industryNewsCount: cache.industryNews.length,
    topTweetsFirmCount: cache.topTweets.size,
    ageSeconds: Math.round(age / 1000),
    remainingSeconds: Math.max(0, Math.round(remaining / 1000)),
    expired: remaining <= 0,
  };
}
