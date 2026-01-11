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
  const now = new Date();
  const monthlyData = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
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
