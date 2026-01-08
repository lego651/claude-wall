/**
 * Calculation utilities for trading log data
 */

/**
 * Calculate daily summary statistics
 * @param {Object} dayData - Object with strategy: R-value pairs
 * @returns {Object} Summary with totalR, averageR, trades
 */
function calculateDaySummary(dayData) {
  const trades = Object.values(dayData).filter(r => r !== null);
  const totalR = trades.reduce((sum, r) => sum + r, 0);

  return {
    totalR: parseFloat(totalR.toFixed(2)),
    averageR: trades.length > 0 ? parseFloat((totalR / trades.length).toFixed(2)) : 0,
    trades: trades.length,
    winning: trades.filter(r => r > 0).length,
    losing: trades.filter(r => r < 0).length
  };
}

/**
 * Calculate strategy summary for the week
 * @param {Object} weekTrades - All trades for the week
 * @param {string} strategy - Strategy name
 * @returns {Object} Summary statistics for the strategy
 */
function calculateStrategySummary(weekTrades, strategy) {
  const strategyTrades = Object.values(weekTrades)
    .map(day => day[strategy])
    .filter(r => r !== null);

  const totalR = strategyTrades.reduce((sum, r) => sum + r, 0);
  const winning = strategyTrades.filter(r => r > 0);
  const losing = strategyTrades.filter(r => r < 0);

  return {
    totalR: parseFloat(totalR.toFixed(2)),
    averageR: strategyTrades.length > 0 ? parseFloat((totalR / strategyTrades.length).toFixed(2)) : 0,
    trades: strategyTrades.length,
    winning: winning.length,
    losing: losing.length,
    winRate: strategyTrades.length > 0 ? parseFloat(((winning.length / strategyTrades.length) * 100).toFixed(1)) : 0
  };
}

/**
 * Calculate weekly summary across all strategies
 * @param {Object} weekTrades - All trades for the week
 * @returns {Object} Overall weekly statistics
 */
function calculateWeeklySummary(weekTrades) {
  const allTrades = Object.values(weekTrades)
    .flatMap(day => Object.values(day))
    .filter(r => r !== null);

  const totalR = allTrades.reduce((sum, r) => sum + r, 0);
  const winning = allTrades.filter(r => r > 0);
  const losing = allTrades.filter(r => r < 0);

  return {
    totalR: parseFloat(totalR.toFixed(2)),
    averageR: allTrades.length > 0 ? parseFloat((totalR / allTrades.length).toFixed(2)) : 0,
    totalTrades: allTrades.length,
    winning: winning.length,
    losing: losing.length,
    winRate: allTrades.length > 0 ? parseFloat(((winning.length / allTrades.length) * 100).toFixed(1)) : 0,
    bestDay: null,
    worstDay: null
  };
}

/**
 * Calculate all summaries for a week's data
 * @param {Object} weekTrades - All trades organized by date
 * @returns {Object} Complete summary object
 */
function calculateAllSummaries(weekTrades) {
  const strategies = ['AS_1', 'AS_2', 'EU', 'NQI', 'GOLD_1', 'GOLD_2'];

  // Calculate by day
  const byDay = {};
  const dayTotals = {};
  for (const [date, dayData] of Object.entries(weekTrades)) {
    const summary = calculateDaySummary(dayData);
    byDay[date] = summary;
    dayTotals[date] = summary.totalR;
  }

  // Calculate by strategy
  const byStrategy = {};
  for (const strategy of strategies) {
    byStrategy[strategy] = calculateStrategySummary(weekTrades, strategy);
  }

  // Calculate weekly overall
  const weekly = calculateWeeklySummary(weekTrades);

  // Add best/worst day
  const sortedDays = Object.entries(dayTotals).sort((a, b) => b[1] - a[1]);
  if (sortedDays.length > 0) {
    weekly.bestDay = { date: sortedDays[0][0], totalR: sortedDays[0][1] };
    weekly.worstDay = { date: sortedDays[sortedDays.length - 1][0], totalR: sortedDays[sortedDays.length - 1][1] };
  }

  return {
    byDay,
    byStrategy,
    weekly
  };
}

/**
 * Get Monday's date for a given Friday
 * @param {string} fridayDate - ISO date string for Friday
 * @returns {string} ISO date string for Monday
 */
function getMondayFromFriday(fridayDate) {
  const friday = new Date(fridayDate);
  const monday = new Date(friday);
  monday.setDate(friday.getDate() - 4);
  return monday.toISOString().split('T')[0];
}

/**
 * Get ISO week number
 * @param {Date} date - Date object
 * @returns {number} Week number
 */
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * Get all trading days for a week (Mon-Fri)
 * @param {string} mondayDate - ISO date string for Monday
 * @returns {string[]} Array of ISO date strings
 */
function getWeekDays(mondayDate) {
  const days = [];
  const monday = new Date(mondayDate);

  for (let i = 0; i < 5; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    days.push(day.toISOString().split('T')[0]);
  }

  return days;
}

module.exports = {
  calculateDaySummary,
  calculateStrategySummary,
  calculateWeeklySummary,
  calculateAllSummaries,
  getMondayFromFriday,
  getWeekNumber,
  getWeekDays
};
