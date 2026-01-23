// Client-safe reports data (no fs dependency)
// This file can be imported in client components

// Report metadata structure
export const reportTypes = {
  weekly: 'weekly',
  monthly: 'monthly',
};

// All available trading reports (metadata only, no markdown content)
export const reports = [
  {
    slug: 'week-03-2026',
    type: reportTypes.weekly,
    title: 'Week 3, 2026',
    period: '2026-01-12 to 2026-01-16',
    weekNumber: 3,
    year: 2026,
    publishedAt: '2026-01-16',
    summary: {
      totalR: 11.1,
      winRate: 73.7,
      totalTrades: 19,
      bestDay: 'Monday (+9.40R)',
    },
  },
  {
    slug: 'week-02-2026',
    type: reportTypes.weekly,
    title: 'Week 2, 2026',
    period: '2026-01-05 to 2026-01-09',
    weekNumber: 2,
    year: 2026,
    publishedAt: '2026-01-10',
    summary: {
      totalR: 11.20,
      winRate: 60.9,
      totalTrades: 23,
      bestDay: 'Thursday (+4.90R)',
    },
  },
];

// Helper functions
export function getReportBySlug(slug) {
  return reports.find(report => report.slug === slug);
}

export function getReportsByType(type) {
  return reports.filter(report => report.type === type);
}

export function getReportsByYear(year) {
  return reports.filter(report => report.year === year);
}

export function getAllYears() {
  return [...new Set(reports.map(report => report.year))].sort((a, b) => b - a);
}
