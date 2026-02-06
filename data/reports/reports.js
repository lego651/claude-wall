import fs from 'fs';
import path from 'path';

// Report metadata structure
export const reportTypes = {
  weekly: 'weekly',
  monthly: 'monthly',
};

// Helper to read markdown files
function getMarkdownContent(filename) {
  const filePath = path.join(process.cwd(), 'data', 'reports', filename);
  return fs.readFileSync(filePath, 'utf8');
}

// All available trading reports
export const reports = [
  {
    slug: 'week-06-2026',
    type: reportTypes.weekly,
    title: 'Week 6, 2026',
    period: '2026-02-02 to 2026-02-06',
    weekNumber: 6,
    year: 2026,
    publishedAt: '2026-02-06',
    summary: {
      totalR: 12.6,
      winRate: 76.5,
      totalTrades: 17,
      bestDay: 'Wednesday (+4.80R)',
    },
    // Function to get markdown content
    getContent: () => getMarkdownContent('week-06-2026.md'),
  },
  {
    slug: 'week-05-2026',
    type: reportTypes.weekly,
    title: 'Week 5, 2026',
    period: '2026-01-27 to 2026-01-31',
    weekNumber: 5,
    year: 2026,
    publishedAt: '2026-01-31',
    summary: {
      totalR: 2.6,
      winRate: 56.25,
      totalTrades: 16,
      bestDay: 'Monday (+3.70R)',
    },
    // Function to get markdown content
    getContent: () => getMarkdownContent('week-05-2026.md'),
  },
  {
    slug: 'week-04-2026',
    type: reportTypes.weekly,
    title: 'Week 4, 2026',
    period: '2026-01-19 to 2026-01-23',
    weekNumber: 4,
    year: 2026,
    publishedAt: '2026-01-23',
    summary: {
      totalR: 13.4,
      winRate: 68.4,
      totalTrades: 19,
      bestDay: 'Thursday (+7.10R)',
    },
    // Function to get markdown content
    getContent: () => getMarkdownContent('week-04-2026.md'),
  },
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
    // Function to get markdown content
    getContent: () => getMarkdownContent('week-03-2026.md'),
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
    // Function to get markdown content
    getContent: () => getMarkdownContent('week-02-2026.md'),
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
