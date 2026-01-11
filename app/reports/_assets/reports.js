import fs from 'fs';
import path from 'path';

// Report metadata structure
export const reportTypes = {
  weekly: 'weekly',
  monthly: 'monthly',
};

// Helper to read markdown files
function getMarkdownContent(filename) {
  const filePath = path.join(process.cwd(), 'app', 'logs', '_assets', filename);
  return fs.readFileSync(filePath, 'utf8');
}

// All available trading reports
export const reports = [
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
