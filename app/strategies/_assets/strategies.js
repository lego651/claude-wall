/**
 * Public Trading Strategies Index
 *
 * This file contains metadata for all public-facing trading strategies.
 * Used by the /strategies page to list and display strategy reports.
 */

export const strategies = [
  {
    slug: "asia-continuation-strategy",
    title: "Asia Session Continuation Strategy",
    description: "A simple 18-hour candle bias strategy with 52% win rate, demonstrating how proper risk management turns small edges into consistent profits.",
    publishedAt: "2026-01-16",
    updatedAt: "2026-01-16",
    instrument: "GOLD (GC!)",
    session: "Asian Session",
    winRate: 52,
    riskReward: "1:1 (Dynamic TP)",
    timeCommitment: "15 min/day",
    difficulty: "Beginner",
    tags: ["Gold", "Futures", "Session Trading", "Risk Management", "Prop Firm"],
    summary: {
      winRate: "52%",
      avgRisk: "0.5R - 1R",
      maxDailyLoss: "-1.5R",
      expectedReturn: "+0.04R per trade",
      backtestPeriod: "2025 (252 days)",
    },
    author: "Proprietary Strategy",
    featured: true,
  },
  // Future strategies will be added here
];

/**
 * Get all unique tags from strategies
 */
export function getAllTags() {
  const tags = new Set();
  strategies.forEach(strategy => {
    strategy.tags.forEach(tag => tags.add(tag));
  });
  return Array.from(tags).sort();
}

/**
 * Get strategies by tag
 */
export function getStrategiesByTag(tag) {
  return strategies.filter(strategy =>
    strategy.tags.includes(tag)
  );
}

/**
 * Get featured strategies
 */
export function getFeaturedStrategies() {
  return strategies.filter(strategy => strategy.featured);
}

/**
 * Get strategy by slug
 */
export function getStrategyBySlug(slug) {
  return strategies.find(strategy => strategy.slug === slug);
}

/**
 * Get strategies sorted by publish date (newest first)
 */
export function getStrategiesSorted() {
  return [...strategies].sort((a, b) =>
    new Date(b.publishedAt) - new Date(a.publishedAt)
  );
}
