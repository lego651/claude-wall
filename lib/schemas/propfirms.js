/**
 * PROP-017: Zod schemas for propfirms API responses and related data.
 * Use safeParse + log on failure; routes can return 500 or fall back.
 */

import { z } from 'zod';
import { createLogger } from '@/lib/logger';

const log = createLogger({ context: 'schemas/propfirms' });

// ----- Reusable building blocks -----

const nonNegativeNumber = z.number().nonnegative();
const nonNegativeInt = z.number().int().nonnegative();

/** Firm id: alphanumeric, hyphens, underscores (e.g. funding-pips, ftmo) */
export const FirmIdSchema = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);

/** Metrics shown on list and chart */
export const MetricsSchema = z.object({
  totalPayouts: nonNegativeNumber,
  payoutCount: nonNegativeInt,
  largestPayout: nonNegativeNumber,
  avgPayout: nonNegativeNumber,
  latestPayoutAt: z.string().nullable().optional(),
});

/** Single firm in list response (id, name, logo, website, metrics) */
export const FirmSchema = z.object({
  id: FirmIdSchema,
  name: z.string().min(1).max(500),
  logo: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  metrics: MetricsSchema,
});

/** List response: data array + meta */
export const PropfirmsListResponseSchema = z.object({
  data: z.array(FirmSchema),
  meta: z.object({
    period: z.string(),
    sort: z.string(),
    order: z.string(),
    count: z.number().int().nonnegative(),
  }),
});

/** Single payout in latest-payouts (has timestamp) */
export const PayoutSchema = z.object({
  id: z.string().min(1),
  timestamp: z.string(),
  amount: nonNegativeNumber,
  paymentMethod: z.string(),
  txHash: z.string(),
  arbiscanUrl: z.string().url().optional(),
});

/** Single payout in top-payouts (has date, not timestamp) */
const TopPayoutItemSchema = z.object({
  id: z.string().min(1),
  date: z.string().optional(),
  timestamp: z.string().optional(),
  amount: nonNegativeNumber,
  paymentMethod: z.string(),
  txHash: z.string(),
  arbiscanUrl: z.string().optional(),
});

/** Latest payouts response */
export const LatestPayoutsResponseSchema = z.object({
  firmId: FirmIdSchema,
  payouts: z.array(PayoutSchema),
  count: z.number().int().nonnegative(),
});

/** Top payouts response */
export const TopPayoutsResponseSchema = z.object({
  firmId: FirmIdSchema,
  period: z.string(),
  payouts: z.array(TopPayoutItemSchema),
});

/** Chart bucket (daily or monthly) */
const ChartBucketSchema = z.object({
  date: z.string().optional(),
  month: z.string().optional(),
  total: nonNegativeNumber,
  rise: nonNegativeNumber.optional(),
  crypto: nonNegativeNumber.optional(),
  wire: nonNegativeNumber.optional(),
});

/** Chart API response */
export const ChartDataSchema = z.object({
  firm: z.object({
    id: FirmIdSchema,
    name: z.string(),
    logo: z.string().nullable().optional(),
    website: z.string().nullable().optional(),
  }),
  summary: MetricsSchema,
  chart: z.object({
    period: z.string(),
    bucketType: z.enum(['daily', 'monthly']),
    data: z.array(ChartBucketSchema),
  }),
});

// ----- Validation helpers -----

/**
 * Parse with schema; on failure log and return null.
 * @param {z.ZodType} schema
 * @param {unknown} data
 * @param {string} [context] - Label for logs
 * @returns {{ success: true, data: T } | { success: false, data: null }}
 */
export function parseOrLog(schema, data, context = 'response') {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  log.warn(
    { context, issues: result.error.issues, message: result.error.message },
    'Validation failed'
  );
  return { success: false, data: null };
}

/**
 * Validate list response; returns validated data or null.
 * @param {unknown} body
 * @returns {object | null}
 */
export function validatePropfirmsListResponse(body) {
  const out = parseOrLog(PropfirmsListResponseSchema, body, 'propfirms list');
  return out.success ? out.data : null;
}

/**
 * Validate latest payouts response.
 * @param {unknown} body
 * @returns {object | null}
 */
export function validateLatestPayoutsResponse(body) {
  const out = parseOrLog(LatestPayoutsResponseSchema, body, 'latest payouts');
  return out.success ? out.data : null;
}

/**
 * Validate top payouts response.
 * @param {unknown} body
 * @returns {object | null}
 */
export function validateTopPayoutsResponse(body) {
  const out = parseOrLog(TopPayoutsResponseSchema, body, 'top payouts');
  return out.success ? out.data : null;
}

/**
 * Validate chart response.
 * @param {unknown} body
 * @returns {object | null}
 */
export function validateChartResponse(body) {
  const out = parseOrLog(ChartDataSchema, body, 'chart');
  return out.success ? out.data : null;
}
