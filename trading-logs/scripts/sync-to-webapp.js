#!/usr/bin/env node

/**
 * Sync trading reports to Next.js web app
 * This script automatically:
 * 1. Copies markdown reports to app/reports/_assets/
 * 2. Updates the reports.js file with metadata
 *
 * Usage: node sync-to-webapp.js <week-json-path>
 * Example: node sync-to-webapp.js ../data/2026/week-03.json
 */

const fs = require('fs');
const path = require('path');

/**
 * Extract metadata from week JSON file
 */
function extractMetadata(weekData) {
  const { weekNumber, year, startDate, endDate, summary } = weekData;
  const { weekly } = summary;

  // Determine best day
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const bestDayDate = weekly.bestDay.date;
  const bestDayIndex = Object.keys(summary.byDay).indexOf(bestDayDate);
  const bestDayName = days[bestDayIndex] || 'Unknown';

  return {
    slug: `week-${weekNumber.toString().padStart(2, '0')}-${year}`,
    type: 'weekly',
    title: `Week ${weekNumber}, ${year}`,
    period: `${startDate} to ${endDate}`,
    weekNumber,
    year,
    publishedAt: endDate,
    summary: {
      totalR: parseFloat(weekly.totalR.toFixed(2)),
      winRate: weekly.winRate,
      totalTrades: weekly.totalTrades,
      bestDay: `${bestDayName} (+${weekly.bestDay.totalR.toFixed(2)}R)`,
    }
  };
}

/**
 * Update reports.js file with new report metadata
 */
function updateReportsFile(metadata, appReportsPath) {
  const reportsFilePath = path.join(appReportsPath, '_assets', 'reports.js');

  if (!fs.existsSync(reportsFilePath)) {
    console.error(`❌ Error: reports.js not found at ${reportsFilePath}`);
    process.exit(1);
  }

  let content = fs.readFileSync(reportsFilePath, 'utf8');

  // Extract existing reports array
  const arrayMatch = content.match(/export const reports = \[([\s\S]*?)\];/);
  if (!arrayMatch) {
    console.error('❌ Error: Could not find reports array in reports.js');
    process.exit(1);
  }

  // Check if report already exists
  if (content.includes(`slug: '${metadata.slug}'`)) {
    console.log(`⚠️  Report ${metadata.slug} already exists in reports.js - skipping update`);
    return false;
  }

  // Create new report entry
  const newReportEntry = `  {
    slug: '${metadata.slug}',
    type: reportTypes.${metadata.type},
    title: '${metadata.title}',
    period: '${metadata.period}',
    weekNumber: ${metadata.weekNumber},
    year: ${metadata.year},
    publishedAt: '${metadata.publishedAt}',
    summary: {
      totalR: ${metadata.summary.totalR},
      winRate: ${metadata.summary.winRate},
      totalTrades: ${metadata.summary.totalTrades},
      bestDay: '${metadata.summary.bestDay}',
    },
    // Function to get markdown content
    getContent: () => getMarkdownContent('${metadata.slug}.md'),
  },`;

  // Insert new report at the beginning of the array
  const updatedContent = content.replace(
    /export const reports = \[/,
    `export const reports = [\n${newReportEntry}`
  );

  fs.writeFileSync(reportsFilePath, updatedContent);
  return true;
}

/**
 * Copy markdown report to web app assets
 */
function copyMarkdownReport(weekData, tradingLogsPath, appReportsPath) {
  const { weekNumber, year } = weekData;
  const mdFilename = `week-${weekNumber.toString().padStart(2, '0')}-${year}.md`;

  const sourcePath = path.join(tradingLogsPath, 'reports', mdFilename);
  const destPath = path.join(appReportsPath, '_assets', mdFilename);

  if (!fs.existsSync(sourcePath)) {
    console.error(`❌ Error: Source markdown not found: ${sourcePath}`);
    process.exit(1);
  }

  // Create assets directory if it doesn't exist
  const assetsDir = path.join(appReportsPath, '_assets');
  fs.mkdirSync(assetsDir, { recursive: true });

  // Copy file
  fs.copyFileSync(sourcePath, destPath);

  return { sourcePath, destPath };
}

/**
 * Main execution
 */
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: node sync-to-webapp.js <week-json-path>');
    console.error('Example: node sync-to-webapp.js ../data/2026/week-03.json');
    process.exit(1);
  }

  const weekJsonPath = args[0];

  if (!fs.existsSync(weekJsonPath)) {
    console.error(`❌ Error: Week JSON file not found: ${weekJsonPath}`);
    process.exit(1);
  }

  // Load week data
  const weekData = JSON.parse(fs.readFileSync(weekJsonPath, 'utf8'));

  // Determine paths
  const tradingLogsPath = path.join(__dirname, '..');
  const appReportsPath = path.join(__dirname, '..', '..', 'app', 'reports');

  console.log(`\n🔄 Syncing Week ${weekData.weekNumber}, ${weekData.year} to web app...\n`);

  // Extract metadata
  const metadata = extractMetadata(weekData);

  // Step 1: Copy markdown report
  const { sourcePath, destPath } = copyMarkdownReport(weekData, tradingLogsPath, appReportsPath);
  console.log(`✅ Copied markdown report`);
  console.log(`   From: ${sourcePath}`);
  console.log(`   To:   ${destPath}`);

  // Step 2: Update reports.js
  const updated = updateReportsFile(metadata, appReportsPath);
  if (updated) {
    console.log(`✅ Updated reports.js with new metadata`);
  }

  console.log('\n🎉 Sync complete!\n');
  console.log(`📊 View report at: http://localhost:3000/reports/${metadata.slug}`);
  console.log(`📋 All reports at: http://localhost:3000/reports`);
}

// Run
main();
