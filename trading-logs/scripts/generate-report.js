#!/usr/bin/env node

/**
 * Generate weekly trading report with charts
 * Usage: node generate-report.js <week-file-path>
 * Example: node generate-report.js ../data/2026/week-02.json
 */

const fs = require('fs');
const path = require('path');

/**
 * Create ASCII bar chart
 */
function createBarChart(data, maxWidth = 40) {
  const maxValue = Math.max(...data.map(d => Math.abs(d.value)));
  const scale = maxWidth / maxValue;

  let chart = '';
  data.forEach(item => {
    const barLength = Math.abs(item.value * scale);
    const bar = item.value >= 0
      ? '█'.repeat(Math.round(barLength))
      : '▓'.repeat(Math.round(barLength));

    const label = item.label.padEnd(12);
    const value = item.value.toFixed(2).padStart(6);
    const color = item.value >= 0 ? '🟢' : '🔴';

    chart += `${label} ${color} ${bar} ${value}R\n`;
  });

  return chart;
}

/**
 * Create daily performance chart
 */
function createDailyChart(byDay) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const data = Object.entries(byDay).map(([date, stats], idx) => ({
    label: days[idx] || date.slice(-5),
    value: stats.totalR
  }));

  return createBarChart(data, 50);
}

/**
 * Create strategy performance chart
 */
function createStrategyChart(byStrategy) {
  const data = Object.entries(byStrategy)
    .filter(([_, stats]) => stats.trades > 0)
    .map(([strategy, stats]) => ({
      label: strategy.replace('_', ' '),
      value: stats.totalR
    }))
    .sort((a, b) => b.value - a.value);

  return createBarChart(data, 50);
}

/**
 * Create win rate visualization
 */
function createWinRateBar(winRate, width = 50) {
  const filled = Math.round((winRate / 100) * width);
  const empty = width - filled;

  return '█'.repeat(filled) + '░'.repeat(empty) + ` ${winRate}%`;
}

/**
 * Format currency/R value with color
 */
function formatR(value) {
  const color = value >= 0 ? '🟢' : '🔴';
  return `${color} ${value >= 0 ? '+' : ''}${value.toFixed(2)}R`;
}

/**
 * Generate markdown report
 */
function generateReport(weekData) {
  const { weekNumber, year, startDate, endDate, summary } = weekData;
  const { byDay, byStrategy, weekly } = summary;

  const report = `# Trading Report - Week ${weekNumber}, ${year}

**Period:** ${startDate} to ${endDate}

---

## 📊 Weekly Overview

| Metric | Value |
|--------|-------|
| **Total R** | ${formatR(weekly.totalR)} |
| **Average R/Trade** | ${formatR(weekly.averageR)} |
| **Total Trades** | ${weekly.totalTrades} |
| **Winning Trades** | ${weekly.winning} 🟢 |
| **Losing Trades** | ${weekly.losing} 🔴 |
| **Win Rate** | ${weekly.winRate}% |
| **Best Day** | ${weekly.bestDay.date} (${formatR(weekly.bestDay.totalR)}) |
| **Worst Day** | ${weekly.worstDay.date} (${formatR(weekly.worstDay.totalR)}) |

### Win Rate Progress
\`\`\`
${createWinRateBar(weekly.winRate)}
\`\`\`

---

## 📈 Daily Performance

\`\`\`
${createDailyChart(byDay)}
\`\`\`

### Daily Breakdown

| Day | Date | Total R | Avg R | Trades | Win Rate |
|-----|------|---------|-------|--------|----------|
${Object.entries(byDay).map(([date, stats], idx) => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const dayName = days[idx];
  const winRate = stats.trades > 0 ? ((stats.winning / stats.trades) * 100).toFixed(1) : '0.0';
  return `| ${dayName} | ${date} | ${stats.totalR >= 0 ? '+' : ''}${stats.totalR.toFixed(2)}R | ${stats.averageR >= 0 ? '+' : ''}${stats.averageR.toFixed(2)}R | ${stats.trades} | ${winRate}% |`;
}).join('\n')}

---

## 🎯 Strategy Performance

\`\`\`
${createStrategyChart(byStrategy)}
\`\`\`

### Strategy Breakdown

| Strategy | Total R | Avg R | Trades | Win | Loss | Win Rate |
|----------|---------|-------|--------|-----|------|----------|
${Object.entries(byStrategy)
  .filter(([_, stats]) => stats.trades > 0)
  .sort((a, b) => b[1].totalR - a[1].totalR)
  .map(([strategy, stats]) => {
    return `| ${strategy.replace('_', ' ')} | ${stats.totalR >= 0 ? '+' : ''}${stats.totalR.toFixed(2)}R | ${stats.averageR >= 0 ? '+' : ''}${stats.averageR.toFixed(2)}R | ${stats.trades} | ${stats.winning} | ${stats.losing} | ${stats.winRate}% |`;
  }).join('\n')}

---

## 🏆 Highlights

### Top Performers
${Object.entries(byStrategy)
  .filter(([_, stats]) => stats.trades > 0 && stats.totalR > 0)
  .sort((a, b) => b[1].totalR - a[1].totalR)
  .slice(0, 3)
  .map(([strategy, stats], idx) => {
    const medal = ['🥇', '🥈', '🥉'][idx];
    return `${medal} **${strategy.replace('_', ' ')}** - ${stats.totalR.toFixed(2)}R (${stats.winRate}% win rate, ${stats.trades} trades)`;
  }).join('\n')}

### Areas for Improvement
${Object.entries(byStrategy)
  .filter(([_, stats]) => stats.trades > 0 && stats.totalR < 0)
  .sort((a, b) => a[1].totalR - b[1].totalR)
  .map(([strategy, stats]) => {
    return `⚠️  **${strategy.replace('_', ' ')}** - ${stats.totalR.toFixed(2)}R (${stats.winRate}% win rate, ${stats.trades} trades)`;
  }).join('\n') || '_No strategies with negative R this week_'}

---

## 📝 Key Insights

${generateInsights(weekData)}

---

## 💡 Recommendations

${generateRecommendations(weekData)}

---

*Report generated on ${new Date().toISOString().split('T')[0]}*
`;

  return report;
}

/**
 * Generate insights based on data
 */
function generateInsights(weekData) {
  const { summary } = weekData;
  const { byStrategy, weekly, byDay } = summary;

  const insights = [];

  // Overall performance
  if (weekly.totalR > 0) {
    insights.push(`✅ **Profitable week** with ${weekly.totalR.toFixed(2)}R gained across ${weekly.totalTrades} trades.`);
  } else {
    insights.push(`⚠️  **Negative week** with ${weekly.totalR.toFixed(2)}R loss. Focus on identifying what went wrong.`);
  }

  // Win rate analysis
  if (weekly.winRate >= 70) {
    insights.push(`🎯 **Excellent win rate** of ${weekly.winRate}% indicates strong trade selection.`);
  } else if (weekly.winRate >= 50) {
    insights.push(`📊 **Decent win rate** of ${weekly.winRate}%. Room for improvement in trade selection.`);
  } else {
    insights.push(`🔴 **Low win rate** of ${weekly.winRate}%. Review entry criteria and market conditions.`);
  }

  // Strategy analysis
  const activeStrategies = Object.entries(byStrategy).filter(([_, s]) => s.trades > 0);
  const profitableStrategies = activeStrategies.filter(([_, s]) => s.totalR > 0);

  insights.push(`📈 **${profitableStrategies.length} out of ${activeStrategies.length}** active strategies were profitable this week.`);

  // Best strategy
  const bestStrategy = activeStrategies.reduce((best, [name, stats]) =>
    stats.totalR > best.stats.totalR ? { name, stats } : best,
    { name: null, stats: { totalR: -Infinity } }
  );

  if (bestStrategy.name) {
    insights.push(`🌟 **${bestStrategy.name.replace('_', ' ')}** was your best performer with ${bestStrategy.stats.totalR.toFixed(2)}R.`);
  }

  // Consistency
  const dailyRs = Object.values(byDay).map(d => d.totalR);
  const positiveDays = dailyRs.filter(r => r > 0).length;

  if (positiveDays >= 4) {
    insights.push(`🔥 **Highly consistent** with ${positiveDays} out of 5 profitable days.`);
  } else if (positiveDays <= 1) {
    insights.push(`⚠️  **Low consistency** - only ${positiveDays} profitable day(s) this week.`);
  }

  return insights.map(i => `- ${i}`).join('\n');
}

/**
 * Generate recommendations
 */
function generateRecommendations(weekData) {
  const { summary } = weekData;
  const { byStrategy, weekly } = summary;

  const recommendations = [];

  // Win rate recommendations
  if (weekly.winRate < 50) {
    recommendations.push(`🎯 **Improve trade selection**: Win rate below 50% suggests entry criteria may need refinement.`);
  }

  // Strategy recommendations
  const losingStrategies = Object.entries(byStrategy)
    .filter(([_, s]) => s.trades > 0 && s.totalR < 0);

  if (losingStrategies.length > 0) {
    recommendations.push(`🔍 **Review ${losingStrategies.map(([n]) => n.replace('_', ' ')).join(', ')}**: These strategies had negative R this week.`);
  }

  // Volume recommendations
  if (weekly.totalTrades < 10) {
    recommendations.push(`📊 **Consider increasing volume**: Only ${weekly.totalTrades} trades this week. More opportunities could improve statistical significance.`);
  } else if (weekly.totalTrades > 30) {
    recommendations.push(`⚠️  **High trade volume**: ${weekly.totalTrades} trades taken. Ensure you're not overtrading or forcing setups.`);
  }

  // Focus recommendations
  const bestStrategies = Object.entries(byStrategy)
    .filter(([_, s]) => s.trades > 0 && s.winRate >= 70)
    .map(([n]) => n.replace('_', ' '));

  if (bestStrategies.length > 0) {
    recommendations.push(`💎 **Focus on strengths**: ${bestStrategies.join(', ')} ${bestStrategies.length > 1 ? 'are' : 'is'} performing well. Consider allocating more capital here.`);
  }

  // Average R recommendations
  if (weekly.averageR < 0.5 && weekly.totalR > 0) {
    recommendations.push(`📈 **Improve R:R ratio**: Average R of ${weekly.averageR.toFixed(2)} is low. Let winners run longer.`);
  }

  if (recommendations.length === 0) {
    recommendations.push(`✨ **Keep up the great work!** Your trading performance this week was solid.`);
  }

  return recommendations.map(r => `- ${r}`).join('\n');
}

/**
 * Main execution
 */
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: node generate-report.js <week-file-path>');
    console.error('Example: node generate-report.js ../data/2026/week-02.json');
    process.exit(1);
  }

  const filepath = args[0];

  if (!fs.existsSync(filepath)) {
    console.error(`Error: File not found: ${filepath}`);
    process.exit(1);
  }

  const weekData = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  const report = generateReport(weekData);

  // Save report
  const reportsDir = path.join(__dirname, '..', 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });

  const reportFilename = `week-${weekData.weekNumber.toString().padStart(2, '0')}-${weekData.year}.md`;
  const reportPath = path.join(reportsDir, reportFilename);

  fs.writeFileSync(reportPath, report);

  console.log('✅ Report generated successfully!');
  console.log(`📄 Location: ${reportPath}`);
  console.log('\nPreview:');
  console.log('─'.repeat(80));
  console.log(report);
}

// Run
main();
