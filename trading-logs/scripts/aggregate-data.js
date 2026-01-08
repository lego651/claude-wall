#!/usr/bin/env node

/**
 * Aggregate weekly data into monthly and yearly files
 * This makes date-range queries much easier for the frontend
 *
 * Usage: node aggregate-data.js [year]
 * Example: node aggregate-data.js 2026
 */

const fs = require('fs');
const path = require('path');

/**
 * Read all weekly files for a given year
 */
function readWeeklyData(year) {
  const dataDir = path.join(__dirname, '..', 'data', year.toString());

  if (!fs.existsSync(dataDir)) {
    console.log(`No data found for year ${year}`);
    return [];
  }

  const files = fs.readdirSync(dataDir)
    .filter(f => f.startsWith('week-') && f.endsWith('.json'))
    .sort();

  return files.map(file => {
    const filepath = path.join(dataDir, file);
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  });
}

/**
 * Create daily index - flat structure for easy date queries
 */
function createDailyIndex(weeklyData) {
  const dailyIndex = {};

  weeklyData.forEach(week => {
    Object.entries(week.trades).forEach(([date, dayData]) => {
      // Only include days with actual trades
      const hasTrades = Object.values(dayData).some(r => r !== null);
      if (hasTrades) {
        dailyIndex[date] = {
          ...dayData,
          weekNumber: week.weekNumber,
          summary: week.summary.byDay[date]
        };
      }
    });
  });

  return dailyIndex;
}

/**
 * Create monthly aggregations
 */
function createMonthlyAggregations(weeklyData) {
  const monthlyData = {};

  weeklyData.forEach(week => {
    Object.entries(week.trades).forEach(([date, dayData]) => {
      const month = date.substring(0, 7); // YYYY-MM

      if (!monthlyData[month]) {
        monthlyData[month] = {
          month,
          trades: {},
          weeks: []
        };
      }

      monthlyData[month].trades[date] = dayData;

      if (!monthlyData[month].weeks.includes(week.weekNumber)) {
        monthlyData[month].weeks.push(week.weekNumber);
      }
    });
  });

  // Calculate monthly summaries
  Object.keys(monthlyData).forEach(month => {
    const monthTrades = monthlyData[month].trades;

    // Flatten all trades
    const allTrades = Object.values(monthTrades)
      .flatMap(day => Object.values(day))
      .filter(r => r !== null);

    const winning = allTrades.filter(r => r > 0);
    const losing = allTrades.filter(r => r < 0);
    const totalR = allTrades.reduce((sum, r) => sum + r, 0);

    // By strategy
    const strategies = ['AS_1', 'AS_2', 'EU', 'NQI', 'GOLD_1', 'GOLD_2'];
    const byStrategy = {};

    strategies.forEach(strategy => {
      const strategyTrades = Object.values(monthTrades)
        .map(day => day[strategy])
        .filter(r => r !== null);

      if (strategyTrades.length > 0) {
        const strategyWinning = strategyTrades.filter(r => r > 0);
        const strategyTotal = strategyTrades.reduce((sum, r) => sum + r, 0);

        byStrategy[strategy] = {
          totalR: parseFloat(strategyTotal.toFixed(2)),
          averageR: parseFloat((strategyTotal / strategyTrades.length).toFixed(2)),
          trades: strategyTrades.length,
          winning: strategyWinning.length,
          losing: strategyTrades.length - strategyWinning.length,
          winRate: parseFloat(((strategyWinning.length / strategyTrades.length) * 100).toFixed(1))
        };
      }
    });

    monthlyData[month].summary = {
      totalR: parseFloat(totalR.toFixed(2)),
      averageR: allTrades.length > 0 ? parseFloat((totalR / allTrades.length).toFixed(2)) : 0,
      totalTrades: allTrades.length,
      winning: winning.length,
      losing: losing.length,
      winRate: allTrades.length > 0 ? parseFloat(((winning.length / allTrades.length) * 100).toFixed(1)) : 0,
      tradingDays: Object.keys(monthTrades).length,
      byStrategy
    };
  });

  return monthlyData;
}

/**
 * Create yearly summary
 */
function createYearlySummary(weeklyData, monthlyData) {
  const allTrades = weeklyData.flatMap(week =>
    Object.values(week.trades).flatMap(day => Object.values(day))
  ).filter(r => r !== null);

  const winning = allTrades.filter(r => r > 0);
  const losing = allTrades.filter(r => r < 0);
  const totalR = allTrades.reduce((sum, r) => sum + r, 0);

  // Strategy summary
  const strategies = ['AS_1', 'AS_2', 'EU', 'NQI', 'GOLD_1', 'GOLD_2'];
  const byStrategy = {};

  strategies.forEach(strategy => {
    const strategyTrades = weeklyData.flatMap(week =>
      Object.values(week.trades).map(day => day[strategy])
    ).filter(r => r !== null);

    if (strategyTrades.length > 0) {
      const strategyWinning = strategyTrades.filter(r => r > 0);
      const strategyTotal = strategyTrades.reduce((sum, r) => sum + r, 0);

      byStrategy[strategy] = {
        totalR: parseFloat(strategyTotal.toFixed(2)),
        averageR: parseFloat((strategyTotal / strategyTrades.length).toFixed(2)),
        trades: strategyTrades.length,
        winning: strategyWinning.length,
        losing: strategyTrades.length - strategyWinning.length,
        winRate: parseFloat(((strategyWinning.length / strategyTrades.length) * 100).toFixed(1))
      };
    }
  });

  // Monthly breakdown
  const byMonth = Object.entries(monthlyData).map(([month, data]) => ({
    month,
    totalR: data.summary.totalR,
    averageR: data.summary.averageR,
    trades: data.summary.totalTrades,
    winRate: data.summary.winRate,
    tradingDays: data.summary.tradingDays
  }));

  return {
    totalR: parseFloat(totalR.toFixed(2)),
    averageR: allTrades.length > 0 ? parseFloat((totalR / allTrades.length).toFixed(2)) : 0,
    totalTrades: allTrades.length,
    winning: winning.length,
    losing: losing.length,
    winRate: allTrades.length > 0 ? parseFloat(((winning.length / allTrades.length) * 100).toFixed(1)) : 0,
    totalWeeks: weeklyData.length,
    byStrategy,
    byMonth
  };
}

/**
 * Main execution
 */
function main() {
  const args = process.argv.slice(2);
  const year = args[0] || new Date().getFullYear();

  console.log(`📊 Aggregating data for ${year}...`);

  // Read weekly data
  const weeklyData = readWeeklyData(year);

  if (weeklyData.length === 0) {
    console.log('❌ No weekly data found');
    return;
  }

  console.log(`📁 Found ${weeklyData.length} weeks of data`);

  // Create aggregations
  const dailyIndex = createDailyIndex(weeklyData);
  const monthlyData = createMonthlyAggregations(weeklyData);
  const yearlySummary = createYearlySummary(weeklyData, monthlyData);

  // Save files
  const aggregateDir = path.join(__dirname, '..', 'data', year.toString(), 'aggregated');
  fs.mkdirSync(aggregateDir, { recursive: true });

  // Daily index
  const dailyIndexPath = path.join(aggregateDir, 'daily-index.json');
  fs.writeFileSync(dailyIndexPath, JSON.stringify(dailyIndex, null, 2));
  console.log(`✅ Daily index: ${dailyIndexPath}`);

  // Monthly data
  Object.entries(monthlyData).forEach(([month, data]) => {
    const monthFile = `${month}.json`; // e.g., 2026-01.json
    const monthPath = path.join(aggregateDir, monthFile);
    fs.writeFileSync(monthPath, JSON.stringify(data, null, 2));
  });
  console.log(`✅ Monthly files: ${Object.keys(monthlyData).length} months`);

  // Yearly summary
  const yearlyPath = path.join(aggregateDir, 'yearly-summary.json');
  fs.writeFileSync(yearlyPath, JSON.stringify({
    year: parseInt(year),
    summary: yearlySummary
  }, null, 2));
  console.log(`✅ Yearly summary: ${yearlyPath}`);

  // Create index file for easy navigation
  const indexPath = path.join(aggregateDir, 'index.json');
  const index = {
    year: parseInt(year),
    weeks: weeklyData.map(w => ({
      weekNumber: w.weekNumber,
      startDate: w.startDate,
      endDate: w.endDate,
      totalR: w.summary.weekly.totalR,
      trades: w.summary.weekly.totalTrades
    })),
    months: Object.keys(monthlyData).sort(),
    generated: new Date().toISOString()
  };
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
  console.log(`✅ Index file: ${indexPath}`);

  console.log('\n🎉 Aggregation complete!');
  console.log('\nFrontend can now easily query:');
  console.log('  - Single day: daily-index.json');
  console.log('  - Date range: Load relevant monthly files');
  console.log('  - Full year: yearly-summary.json');
}

// Run
main();
