#!/usr/bin/env node

/**
 * Interactive script to add weekly trading data
 * Usage: node add-week.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const {
  calculateAllSummaries,
  getMondayFromFriday,
  getWeekNumber,
  getWeekDays
} = require('./calculate');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const STRATEGIES = ['AS_1', 'AS_2', 'EU', 'NQI', 'GOLD_1', 'GOLD_2'];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

/**
 * Prompt user for input
 */
function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

/**
 * Parse R-value input (handles empty string as null)
 */
function parseRValue(input) {
  if (input.trim() === '' || input.trim() === '-' || input.trim() === '=') {
    return null;
  }
  const value = parseFloat(input);
  return isNaN(value) ? null : value;
}

/**
 * Main execution
 */
async function main() {
  console.log('=== Trading Log Entry ===\n');

  // Get Friday's date (end of week)
  const today = new Date();
  const defaultFriday = new Date(today);
  // Adjust to most recent Friday
  const dayOfWeek = today.getDay();
  const daysToFriday = dayOfWeek <= 5 ? 5 - dayOfWeek : 0;
  defaultFriday.setDate(today.getDate() - (dayOfWeek - 5));

  const fridayDateInput = await question(
    `Enter Friday's date (YYYY-MM-DD) [${defaultFriday.toISOString().split('T')[0]}]: `
  );

  const fridayDate = fridayDateInput.trim() || defaultFriday.toISOString().split('T')[0];
  const mondayDate = getMondayFromFriday(fridayDate);
  const weekDays = getWeekDays(mondayDate);

  console.log(`\nWeek: ${mondayDate} to ${fridayDate}\n`);

  // Collect data for each day
  const weekTrades = {};

  for (let i = 0; i < 5; i++) {
    const dayName = DAY_NAMES[i];
    const date = weekDays[i];

    console.log(`\n--- ${dayName} (${date}) ---`);

    const dayData = {};

    for (const strategy of STRATEGIES) {
      const displayName = strategy.replace('_', ' ');
      const input = await question(`${displayName}: `);
      dayData[strategy] = parseRValue(input);
    }

    weekTrades[date] = dayData;
  }

  // Calculate summaries
  const summary = calculateAllSummaries(weekTrades);

  // Prepare final data structure
  const friday = new Date(fridayDate);
  const weekNumber = getWeekNumber(friday);
  const year = friday.getFullYear();

  const weekData = {
    weekNumber,
    year,
    startDate: mondayDate,
    endDate: fridayDate,
    trades: weekTrades,
    summary
  };

  // Display summary
  console.log('\n=== WEEKLY SUMMARY ===');
  console.log(`Total R: ${summary.weekly.totalR}`);
  console.log(`Average R: ${summary.weekly.averageR}`);
  console.log(`Total Trades: ${summary.weekly.totalTrades}`);
  console.log(`Win Rate: ${summary.weekly.winRate}%`);
  console.log(`Best Day: ${summary.weekly.bestDay?.date} (${summary.weekly.bestDay?.totalR}R)`);
  console.log(`Worst Day: ${summary.weekly.worstDay?.date} (${summary.weekly.worstDay?.totalR}R)`);

  console.log('\n=== BY STRATEGY ===');
  for (const [strategy, stats] of Object.entries(summary.byStrategy)) {
    if (stats.trades > 0) {
      console.log(`${strategy.replace('_', ' ')}: ${stats.totalR}R (${stats.trades} trades, ${stats.winRate}% win rate)`);
    }
  }

  // Confirm save
  const confirm = await question('\nSave this data? (y/n): ');

  if (confirm.toLowerCase() === 'y') {
    // Create directory structure
    const dataDir = path.join(__dirname, '..', 'data', year.toString());
    fs.mkdirSync(dataDir, { recursive: true });

    // Save file
    const filename = `week-${weekNumber.toString().padStart(2, '0')}.json`;
    const filepath = path.join(dataDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(weekData, null, 2));

    console.log(`\n✅ Data saved to: ${filepath}`);
  } else {
    console.log('\n❌ Data not saved.');
  }

  rl.close();
}

// Run
main().catch(err => {
  console.error('Error:', err);
  rl.close();
  process.exit(1);
});
