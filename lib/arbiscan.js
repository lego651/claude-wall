/**
 * Arbiscan API Helper
 *
 * Fetches transaction data from Arbiscan (Arbitrum blockchain explorer)
 * using the Etherscan V2 API.
 *
 * API Docs: https://docs.etherscan.io/v2-migration
 */

const ARBISCAN_API_BASE = 'https://api.etherscan.io/v2/api';
const ARBITRUM_CHAIN_ID = '42161';

/**
 * Fetch native ETH transactions for an address
 *
 * @param {string} address - Wallet address (0x...)
 * @param {string} apiKey - Arbiscan API key
 * @returns {Promise<Array>} Array of native transactions
 */
export async function fetchNativeTransactions(address, apiKey) {
  const url = `${ARBISCAN_API_BASE}?chainid=${ARBITRUM_CHAIN_ID}&module=account&action=txlist&address=${address}&sort=desc&apikey=${apiKey}`;

  const response = await fetch(url);
  const data = await response.json();

  console.log(`[Arbiscan] Native txs fetched: ${data.result?.length || 0}`);

  if (data.status === '0' && data.message !== 'No transactions found') {
    throw new Error(`Arbiscan API error: ${data.message}`);
  }

  return data.result || [];
}

/**
 * Fetch ERC-20 token transactions for an address
 *
 * @param {string} address - Wallet address (0x...)
 * @param {string} apiKey - Arbiscan API key
 * @returns {Promise<Array>} Array of token transactions
 */
export async function fetchTokenTransactions(address, apiKey) {
  const url = `${ARBISCAN_API_BASE}?chainid=${ARBITRUM_CHAIN_ID}&module=account&action=tokentx&address=${address}&sort=desc&apikey=${apiKey}`;

  const response = await fetch(url);
  const data = await response.json();

  console.log(`[Arbiscan] Token txs fetched: ${data.result?.length || 0}`);

  if (data.status === '0' && data.message !== 'No transactions found') {
    throw new Error(`Arbiscan API error: ${data.message}`);
  }

  return data.result || [];
}
