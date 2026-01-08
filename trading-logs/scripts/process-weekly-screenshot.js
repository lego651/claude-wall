#!/usr/bin/env node

/**
 * Complete workflow: Parse screenshot → Create week JSON → Generate report → Aggregate data
 *
 * This is a placeholder for Claude to follow when you provide a screenshot.
 * Claude will:
 * 1. Parse the screenshot data
 * 2. Create the weekly JSON file
 * 3. Run generate-report.js
 * 4. Run aggregate-data.js
 * 5. Show you the summary
 */

const { execSync } = require('child_process');
const path = require('path');

function processWeeklyData(weekFilePath) {
  const scriptsDir = path.join(__dirname);

  console.log('📊 Processing weekly data...\n');

  try {
    // Step 1: Generate report
    console.log('📝 Generating weekly report...');
    execSync(`node ${path.join(scriptsDir, 'generate-report.js')} ${weekFilePath}`, {
      stdio: 'inherit'
    });

    // Step 2: Aggregate data
    const year = weekFilePath.match(/\/(\d{4})\//)[1];
    console.log('\n📈 Aggregating data for frontend...');
    execSync(`node ${path.join(scriptsDir, 'aggregate-data.js')} ${year}`, {
      stdio: 'inherit'
    });

    console.log('\n✅ All done! Files created:');
    console.log('   - Weekly JSON: ' + weekFilePath);
    console.log('   - Weekly report: reports/week-XX-YYYY.md');
    console.log('   - Aggregated data: data/YYYY/aggregated/');

  } catch (error) {
    console.error('❌ Error processing data:', error.message);
    process.exit(1);
  }
}

// For manual use
if (require.main === module) {
  const weekFile = process.argv[2];
  if (!weekFile) {
    console.error('Usage: node process-weekly-screenshot.js <week-file-path>');
    console.error('Example: node process-weekly-screenshot.js ../data/2026/week-02.json');
    process.exit(1);
  }
  processWeeklyData(weekFile);
}

module.exports = { processWeeklyData };
