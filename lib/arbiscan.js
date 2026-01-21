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

  // TODO (Phase 1): Add retry logic with exponential backoff
  // TODO (Phase 1): Handle rate limiting gracefully (429 status)

  const response = await fetch(url);
  const data = await response.json();

  console.log(`[Arbiscan] Native txs fetched: ${data.result?.length || 0}`);

  // Handle API errors more gracefully
  if (data.status === '0') {
    // "No transactions found" is not an error - return empty array
    if (data.message === 'No transactions found') {
      return [];
    }
    
    // Rate limiting or API key issues
    if (data.message.includes('rate limit') || data.message.includes('Max rate limit')) {
      console.warn(`[Arbiscan] Rate limit hit for address ${address}`);
      return []; // Return empty array instead of throwing
    }
    
    // Invalid API key
    if (data.message.includes('Invalid API Key') || data.message === 'NOTOK') {
      console.error(`[Arbiscan] API key issue: ${data.message}`);
      // Return empty array to prevent page crash
      return [];
    }
    
    // Other errors - log but don't crash
    console.warn(`[Arbiscan] API warning for ${address}: ${data.message}`);
    return [];
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

  // TODO (Phase 1): Add retry logic with exponential backoff
  // TODO (Phase 1): Handle rate limiting gracefully (429 status)

  const response = await fetch(url);
  const data = await response.json();

  console.log(`[Arbiscan] Token txs fetched: ${data.result?.length || 0}`);

  // Handle API errors more gracefully
  if (data.status === '0') {
    // "No transactions found" is not an error - return empty array
    if (data.message === 'No transactions found' || data.message === 'No token transfers found') {
      return [];
    }
    
    // Rate limiting or API key issues
    if (data.message.includes('rate limit') || data.message.includes('Max rate limit')) {
      console.warn(`[Arbiscan] Rate limit hit for address ${address}`);
      return []; // Return empty array instead of throwing
    }
    
    // Invalid API key
    if (data.message.includes('Invalid API Key') || data.message === 'NOTOK') {
      console.error(`[Arbiscan] API key issue: ${data.message}`);
      // Return empty array to prevent page crash
      return [];
    }
    
    // Other errors - log but don't crash
    console.warn(`[Arbiscan] API warning for ${address}: ${data.message}`);
    return [];
  }

  return data.result || [];
}
