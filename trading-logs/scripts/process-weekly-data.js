#!/usr/bin/env node

/**
 * Complete weekly data processing workflow
 * This is the ONE script you run after creating a weekly JSON file
 *
 * It automatically:
 * 1. Generates markdown report
 * 2. Syncs to web app (copies MD + updates reports.js)
 * 3. Aggregates data for the year
 *
 * Usage: node process-weekly-data.js <week-json-path>
 * Example: node process-weekly-data.js ../data/2026/week-03.json
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function runCommand(command, description) {
  console.log(`\n🔄 ${description}...`);
  try {
    execSync(command, { stdio: 'inherit', cwd: __dirname });
    console.log(`✅ ${description} complete`);
    return true;
  } catch (error) {
    console.error(`❌ Failed: ${description}`);
    console.error(error.message);
    return false;
  }
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('❌ Usage: node process-weekly-data.js <week-json-path>');
    console.error('   Example: node process-weekly-data.js ../data/2026/week-03.json');
    process.exit(1);
  }

  const weekJsonPath = args[0];

  // Validate file exists
  if (!fs.existsSync(weekJsonPath)) {
    console.error(`❌ Error: File not found: ${weekJsonPath}`);
    process.exit(1);
  }

  // Load week data to get year
  const weekData = JSON.parse(fs.readFileSync(weekJsonPath, 'utf8'));
  const { weekNumber, year } = weekData;

  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log(`║  📊 Processing Week ${weekNumber}, ${year} - Complete Workflow             ║`);
  console.log('╚════════════════════════════════════════════════════════════════╝');

  // Step 1: Generate markdown report (this now auto-syncs to webapp)
  const success1 = runCommand(
    `node generate-report.js "${weekJsonPath}"`,
    'Generate markdown report & sync to web app'
  );

  if (!success1) {
    console.error('\n❌ Workflow failed at report generation');
    process.exit(1);
  }

  // Step 2: Aggregate data
  const success2 = runCommand(
    `node aggregate-data.js ${year}`,
    'Aggregate yearly data'
  );

  if (!success2) {
    console.error('\n❌ Workflow failed at data aggregation');
    process.exit(1);
  }

  // Summary
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║  🎉 Complete! All data processed successfully                 ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  console.log('📁 Files created/updated:');
  console.log(`   ✓ trading-logs/reports/week-${weekNumber.toString().padStart(2, '0')}-${year}.md`);
  console.log(`   ✓ app/reports/_assets/week-${weekNumber.toString().padStart(2, '0')}-${year}.md`);
  console.log('   ✓ app/reports/_assets/reports.js');
  console.log(`   ✓ trading-logs/data/${year}/aggregated/*\n`);

  console.log('🌐 View online:');
  console.log(`   • Single report: http://localhost:3000/reports/week-${weekNumber.toString().padStart(2, '0')}-${year}`);
  console.log('   • All reports:   http://localhost:3000/reports\n');
}

// Run
main();
