/**
 * Transaction Processor
 *
 * Processes raw Arbiscan transaction data into a clean, standardized format
 * with USD conversion and statistics calculation.
 */

// TODO (Phase 1): Replace with historical prices from CoinGecko API
const PRICES = {
  ETH: 2500,
  USDC: 1.00,
  USDT: 1.00,
  RISEPAY: 1.00, // Rise Pay token (assuming 1:1 with USD)
};

/**
 * Convert token amount to USD
 *
 * @param {number} amount - Token amount
 * @param {string} token - Token symbol (ETH, USDC, USDT, etc.)
 * @returns {number} USD value
 */
export function convertToUSD(amount, token) {
  return amount * (PRICES[token] || 0);
}

/**
 * Process raw Arbiscan transactions into clean format
 *
 * @param {Array} nativeData - Raw native ETH transactions from Arbiscan
 * @param {Array} tokenData - Raw ERC-20 token transactions from Arbiscan
 * @param {string} targetAddress - Target wallet address (for filtering incoming)
 * @returns {Array} Processed transactions sorted by timestamp (descending)
 */
export function processTransactions(nativeData, tokenData, targetAddress) {
  const targetAddressLower = targetAddress.toLowerCase();

  // Normalize native ETH transactions
  const nativeTxs = nativeData
    .filter(tx => tx.to && tx.to.toLowerCase() === targetAddressLower)
    .map(tx => ({
      txHash: tx.hash,
      timestamp: parseInt(tx.timeStamp),
      from: tx.from,
      to: tx.to,
      amount: parseFloat(tx.value) / 1e18, // Wei to ETH
      token: 'ETH',
      blockNumber: parseInt(tx.blockNumber),
    }));

  // Normalize ERC-20 token transactions
  // Filter for incoming transactions and supported tokens
  const supportedTokens = ['USDC', 'USDT', 'RISEPAY'];
  const tokenTxs = tokenData
    .filter(tx => tx.to && tx.to.toLowerCase() === targetAddressLower)
    .filter(tx => supportedTokens.includes(tx.tokenSymbol.toUpperCase()))
    .map(tx => ({
      txHash: tx.hash,
      timestamp: parseInt(tx.timeStamp),
      from: tx.from,
      to: tx.to,
      amount: parseFloat(tx.value) / Math.pow(10, parseInt(tx.tokenDecimal)),
      token: tx.tokenSymbol.toUpperCase(),
      blockNumber: parseInt(tx.blockNumber),
    }));

  // Merge and process all transactions
  const allTxs = [...nativeTxs, ...tokenTxs]
    .map(tx => ({
      ...tx,
      amountUSD: convertToUSD(tx.amount, tx.token),
      date: new Date(tx.timestamp * 1000).toISOString(),
      fromShort: `${tx.from.slice(0, 6)}...${tx.from.slice(-4)}`,
      arbiscanUrl: `https://arbiscan.io/tx/${tx.txHash}`,
    }))
    .filter(tx => tx.amountUSD >= 10) // Filter out transactions < $10 (spam)
    .sort((a, b) => b.timestamp - a.timestamp) // Most recent first
    .slice(0, 100); // Limit to 100 transactions

  return allTxs;
}

/**
 * Calculate statistics from processed transactions
 *
 * @param {Array} transactions - Processed transactions
 * @returns {Object} Statistics (totalTransactions, totalPayoutUSD, etc.)
 */
export function calculateStats(transactions) {
  const now = Date.now() / 1000;
  const thirtyDaysAgo = now - (30 * 24 * 60 * 60);

  const totalPayoutUSD = transactions.reduce((sum, tx) => sum + tx.amountUSD, 0);
  const last30DaysTxs = transactions.filter(tx => tx.timestamp >= thirtyDaysAgo);
  const last30DaysPayoutUSD = last30DaysTxs.reduce((sum, tx) => sum + tx.amountUSD, 0);

  return {
    totalTransactions: transactions.length,
    totalPayoutUSD: Math.round(totalPayoutUSD * 100) / 100,
    last30DaysPayoutUSD: Math.round(last30DaysPayoutUSD * 100) / 100,
    last30DaysCount: last30DaysTxs.length,
    avgPayoutUSD: transactions.length > 0 ? Math.round((totalPayoutUSD / transactions.length) * 100) / 100 : 0,
  };
}

/**
 * Group transactions by month for chart data (last 6 months)
 *
 * @param {Array} transactions - Processed transactions
 * @returns {Array} Monthly data [{month: 'Jan', amount: 1000}, ...]
 */
export function groupByMonth(transactions) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // If no transactions, return empty array
  if (!transactions || transactions.length === 0) {
    return [];
  }

  // Use the most recent transaction date as reference point (instead of "now")
  // This ensures chart always shows data even if system date is off
  const mostRecentTx = transactions[0]; // Already sorted by timestamp desc
  const referenceDate = new Date(mostRecentTx.timestamp * 1000);

  const monthlyData = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1);
    const monthName = months[d.getMonth()];
    const monthStart = d.getTime() / 1000;
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).getTime() / 1000;

    const monthTxs = transactions.filter(tx => tx.timestamp >= monthStart && tx.timestamp <= monthEnd);
    const amount = monthTxs.reduce((sum, tx) => sum + tx.amountUSD, 0);

    monthlyData.push({
      month: monthName,
      amount: Math.round(amount),
    });
  }

  return monthlyData;
}

// ============================================================================
// PROP FIRM FUNCTIONS (v1) - For tracking OUTGOING transactions
// ============================================================================

/**
 * Process OUTGOING transactions for prop firms
 *
 * @param {Array} nativeData - Raw native ETH transactions from Arbiscan
 * @param {Array} tokenData - Raw ERC-20 token transactions from Arbiscan
 * @param {Array} sourceAddresses - Array of firm wallet addresses
 * @param {number} days - Number of days to look back (default 7)
 * @returns {Array} Processed outgoing transactions
 */
export function processOutgoingTransactions(nativeData, tokenData, sourceAddresses, days = 7) {
  const now = Date.now() / 1000;
  const cutoffTime = now - (days * 24 * 60 * 60);
  const lowerSourceAddrs = sourceAddresses.map(a => a.toLowerCase());

  // Filter outgoing native ETH transactions
  const nativeTxs = nativeData
    .filter(tx => tx.from && lowerSourceAddrs.includes(tx.from.toLowerCase()))
    .filter(tx => parseInt(tx.timeStamp) >= cutoffTime)
    .map(tx => ({
      txHash: tx.hash,
      timestamp: parseInt(tx.timeStamp),
      from: tx.from,
      to: tx.to,
      amount: parseFloat(tx.value) / 1e18, // Wei to ETH
      token: 'ETH',
      blockNumber: parseInt(tx.blockNumber),
    }));

  // Filter outgoing ERC-20 token transactions
  const supportedTokens = ['USDC', 'USDT', 'RISEPAY'];
  const tokenTxs = tokenData
    .filter(tx => tx.from && lowerSourceAddrs.includes(tx.from.toLowerCase()))
    .filter(tx => parseInt(tx.timeStamp) >= cutoffTime)
    .filter(tx => supportedTokens.includes(tx.tokenSymbol.toUpperCase()))
    .map(tx => ({
      txHash: tx.hash,
      timestamp: parseInt(tx.timeStamp),
      from: tx.from,
      to: tx.to,
      amount: parseFloat(tx.value) / Math.pow(10, parseInt(tx.tokenDecimal)),
      token: tx.tokenSymbol.toUpperCase(),
      blockNumber: parseInt(tx.blockNumber),
    }));

  // Merge and process all outgoing transactions
  const allTxs = [...nativeTxs, ...tokenTxs]
    .map(tx => ({
      ...tx,
      amountUSD: convertToUSD(tx.amount, tx.token),
      date: new Date(tx.timestamp * 1000).toISOString(),
      toShort: `${tx.to.slice(0, 6)}...${tx.to.slice(-4)}`,
      fromShort: `${tx.from.slice(0, 6)}...${tx.from.slice(-4)}`,
      arbiscanUrl: `https://arbiscan.io/tx/${tx.txHash}`,
      paymentMethod: 'Crypto', // TODO (v2): Auto-detect payment method
    }))
    .filter(tx => tx.amountUSD >= 10) // Filter out transactions < $10 (spam)
    .sort((a, b) => b.timestamp - a.timestamp) // Most recent first
    .slice(0, 100); // Limit to 100 transactions

  return allTxs;
}

/**
 * Calculate prop firm statistics
 *
 * @param {Array} transactions - Processed outgoing transactions
 * @returns {Object} Prop firm stats
 */
export function calculatePropFirmStats(transactions) {
  if (!transactions || transactions.length === 0) {
    return {
      totalPayoutUSD: 0,
      totalPayoutCount: 0,
      largestPayoutUSD: 0,
      timeSinceLastPayout: 'N/A',
    };
  }

  const totalPayoutUSD = transactions.reduce((sum, tx) => sum + tx.amountUSD, 0);
  const largestPayoutUSD = Math.max(...transactions.map(tx => tx.amountUSD));
  const mostRecentTx = transactions[0]; // Already sorted descending

  return {
    totalPayoutUSD: Math.round(totalPayoutUSD * 100) / 100,
    totalPayoutCount: transactions.length,
    largestPayoutUSD: Math.round(largestPayoutUSD * 100) / 100,
    timeSinceLastPayout: calculateTimeSince(mostRecentTx.timestamp),
  };
}

/**
 * Group transactions by day for prop firm chart
 *
 * @param {Array} transactions - Processed transactions
 * @param {number} days - Number of days to show (default 7)
 * @returns {Array} Daily data for chart
 */
export function groupByDay(transactions, days = 7) {
  const now = new Date();
  const dailyData = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);

    const dayStart = d.getTime() / 1000;
    const dayEnd = dayStart + (24 * 60 * 60);

    const dayTxs = transactions.filter(tx =>
      tx.timestamp >= dayStart && tx.timestamp < dayEnd
    );

    const totalUSD = dayTxs.reduce((sum, tx) => sum + tx.amountUSD, 0);

    dailyData.push({
      date: d.toISOString().split('T')[0],
      totalUSD: Math.round(totalUSD),
      crypto: Math.round(totalUSD), // TODO (v2): Breakdown by payment method
      rise: 0,
      wireTransfer: 0,
    });
  }

  return dailyData;
}

/**
 * Calculate human-readable time since timestamp
 *
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {string} Human-readable time (e.g., "4hr 8min")
 */
export function calculateTimeSince(timestamp) {
  const now = Date.now() / 1000;
  const diff = now - timestamp;

  const hours = Math.floor(diff / 3600);
  const minutes = Math.floor((diff % 3600) / 60);

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}hr`;
  }

  return `${hours}hr ${minutes}min`;
}
