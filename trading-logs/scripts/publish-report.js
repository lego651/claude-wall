#!/usr/bin/env node

/**
 * Script to publish a weekly/monthly report to the Next.js app
 *
 * Usage:
 *   node scripts/publish-report.js data/2026/week-02.json
 */

const fs = require('fs');
const path = require('path');

function publishReport(jsonPath) {
  // Read the weekly/monthly JSON file
  const fullPath = path.join(__dirname, '..', jsonPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ Error: File not found: ${jsonPath}`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  const isWeekly = jsonPath.includes('week-');

  // Determine the report slug and markdown filename
  const reportSlug = isWeekly
    ? `week-${String(data.weekNumber).padStart(2, '0')}-${data.year}`
    : `month-${String(data.month).padStart(2, '0')}-${data.year}`;

  const markdownFilename = `${reportSlug}.md`;
  const markdownSource = path.join(__dirname, '..', 'reports', markdownFilename);

  if (!fs.existsSync(markdownSource)) {
    console.error(`❌ Error: Markdown file not found: reports/${markdownFilename}`);
    console.log(`💡 Tip: Generate it first with: node scripts/generate-report.js ${jsonPath}`);
    process.exit(1);
  }

  // Copy markdown to Next.js app assets
  const appAssetsDir = path.join(__dirname, '..', '..', 'app', 'trading-logs', '_assets');
  const markdownDest = path.join(appAssetsDir, markdownFilename);

  fs.copyFileSync(markdownSource, markdownDest);
  console.log(`✅ Copied markdown: ${markdownFilename}`);

  // Read and update the reports.js metadata file
  const reportsJsPath = path.join(appAssetsDir, 'reports.js');
  let reportsJs = fs.readFileSync(reportsJsPath, 'utf8');

  // Calculate best day name
  const bestDayDate = new Date(data.summary.weekly.bestDay.date);
  const bestDayName = bestDayDate.toLocaleDateString('en-US', { weekday: 'long' });
  const bestDayR = data.summary.weekly.bestDay.totalR;

  // Create new report entry
  const newReport = {
    slug: reportSlug,
    type: isWeekly ? 'weekly' : 'monthly',
    title: isWeekly ? `Week ${data.weekNumber}, ${data.year}` : `${getMonthName(data.month)} ${data.year}`,
    period: `${data.startDate} to ${data.endDate}`,
    weekNumber: isWeekly ? data.weekNumber : undefined,
    month: !isWeekly ? data.month : undefined,
    year: data.year,
    publishedAt: new Date().toISOString().split('T')[0],
    summary: {
      totalR: data.summary.weekly.totalR,
      winRate: data.summary.weekly.winRate,
      totalTrades: data.summary.weekly.totalTrades,
      bestDay: `${bestDayName} (+${bestDayR}R)`,
    },
  };

  // Generate the report object string
  const reportString = `  {
    slug: '${newReport.slug}',
    type: reportTypes.${newReport.type},
    title: '${newReport.title}',
    period: '${newReport.period}',${isWeekly ? `\n    weekNumber: ${newReport.weekNumber},` : `\n    month: ${newReport.month},`}
    year: ${newReport.year},
    publishedAt: '${newReport.publishedAt}',
    summary: {
      totalR: ${newReport.summary.totalR},
      winRate: ${newReport.summary.winRate},
      totalTrades: ${newReport.summary.totalTrades},
      bestDay: '${newReport.summary.bestDay}',
    },
    getContent: () => getMarkdownContent('${markdownFilename}'),
  },`;

  // Check if report already exists
  if (reportsJs.includes(`slug: '${reportSlug}'`)) {
    console.log(`⚠️  Report ${reportSlug} already exists in reports.js`);
    console.log(`💡 Tip: Manually update it if needed`);
  } else {
    // Add to the reports array (before the closing bracket)
    const reportsArrayMatch = reportsJs.match(/export const reports = \[([\s\S]*?)\];/);
    if (reportsArrayMatch) {
      const existingReports = reportsArrayMatch[1];
      const newReportsArray = existingReports.trim()
        ? existingReports + '\n' + reportString
        : '\n' + reportString + '\n';

      reportsJs = reportsJs.replace(
        /export const reports = \[([\s\S]*?)\];/,
        `export const reports = [${newReportsArray}];`
      );

      fs.writeFileSync(reportsJsPath, reportsJs);
      console.log(`✅ Added report to reports.js: ${reportSlug}`);
    }
  }

  console.log('\n✨ Report published successfully!');
  console.log(`\n📊 Report Details:`);
  console.log(`   - Slug: ${reportSlug}`);
  console.log(`   - Type: ${newReport.type}`);
  console.log(`   - Period: ${newReport.period}`);
  console.log(`   - Total R: ${newReport.summary.totalR > 0 ? '+' : ''}${newReport.summary.totalR}R`);
  console.log(`   - Win Rate: ${newReport.summary.winRate}%`);
  console.log('\n🔄 Running data sync...');

  // Auto-run aggregate and sync scripts
  const { execSync } = require('child_process');
  try {
    execSync(`node ${path.join(__dirname, 'aggregate-data.js')} ${data.year}`, { stdio: 'inherit' });
    execSync(`bash ${path.join(__dirname, 'sync-to-nextjs.sh')}`, { stdio: 'inherit' });
    console.log('\n✅ Data synced to Next.js app!');
  } catch (err) {
    console.error('\n⚠️  Data sync failed. Run manually:');
    console.log(`   node scripts/aggregate-data.js ${data.year}`);
    console.log(`   bash scripts/sync-to-nextjs.sh`);
  }

  console.log('\n🌐 Next Steps:');
  console.log('   1. Run: npm run build');
  console.log('   2. Test locally: npm run dev');
  console.log(`   3. View report: http://localhost:3000/trading-logs/reports/${reportSlug}`);
  console.log(`   4. View strategies: http://localhost:3000/admin/strategies`);
  console.log('   5. Commit and push to deploy to Vercel');
}

function getMonthName(monthNum) {
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'];
  return months[monthNum - 1];
}

// Main execution
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: node scripts/publish-report.js <path-to-json>');
  console.log('Example: node scripts/publish-report.js data/2026/week-02.json');
  process.exit(1);
}

publishReport(args[0]);
