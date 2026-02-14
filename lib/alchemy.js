/**
 * Alchemy API Helper
 *
 * Fetches asset transfer data from Alchemy (no 10k limit like Arbiscan).
 * Supports pagination via pageKey to fetch ALL historical transactions.
 *
 * API Docs: https://www.alchemy.com/docs/reference/alchemy-getassettransfers
 * CU Cost: 120 per request
 * Free Tier: 300M CU/month (≈2.5M requests)
 */

import { logger } from '@/lib/logger';

const ALCHEMY_API_BASE = 'https://arb-mainnet.g.alchemy.com/v2';

/**
 * Fetch asset transfers for an address with pagination
 *
 * @param {string} address - Wallet address (0x...)
 * @param {string} apiKey - Alchemy API key
 * @param {Object} options - Request options
 * @param {string} [options.fromBlock] - Starting block (hex or "0x0")
 * @param {string} [options.toBlock] - Ending block (hex or "latest")
 * @param {string} [options.category] - Transfer category ("external", "erc20", etc)
 * @param {string} [options.order] - "asc" or "desc" (default: "desc")
 * @param {number} [options.maxCount] - Max results per page (default: 1000)
 * @param {string} [options.pageKey] - Pagination key from previous response
 * @param {boolean} [options.excludeZeroValue] - Exclude zero-value transfers (default: true)
 * @returns {Promise<Object>} { transfers: Array, pageKey: string }
 */
export async function fetchAssetTransfers(address, apiKey, options = {}) {
  const {
    fromBlock = '0x0',
    toBlock = 'latest',
    category,
    order = 'desc',
    maxCount = 1000,
    pageKey,
    excludeZeroValue = true,
  } = options;

  const url = `${ALCHEMY_API_BASE}/${apiKey}`;

  const params = {
    fromAddress: address,
    fromBlock,
    toBlock,
    order,
    maxCount: `0x${maxCount.toString(16)}`,
    excludeZeroValue,
    withMetadata: true, // Required to get blockTimestamp
  };

  if (category) {
    params.category = Array.isArray(category) ? category : [category];
  }

  if (pageKey) {
    params.pageKey = pageKey;
  }

  const body = {
    id: 1,
    jsonrpc: '2.0',
    method: 'alchemy_getAssetTransfers',
    params: [params],
  };

  logger.info({ context: 'alchemy', address, fromBlock, toBlock, pageKey: !!pageKey }, 'Fetching asset transfers');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Alchemy API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(`Alchemy API error: ${data.error.message}`);
  }

  const result = data.result || {};
  const transfers = result.transfers || [];
  const nextPageKey = result.pageKey;

  logger.info(
    { context: 'alchemy', address, fetched: transfers.length, hasMore: !!nextPageKey },
    'Fetched asset transfers'
  );

  return {
    transfers,
    pageKey: nextPageKey,
  };
}

/**
 * Fetch ALL asset transfers for an address (handles pagination automatically)
 *
 * @param {string} address - Wallet address (0x...)
 * @param {string} apiKey - Alchemy API key
 * @param {Object} options - Request options
 * @param {string} [options.fromBlock] - Starting block (hex or "0x0")
 * @param {string} [options.toBlock] - Ending block (hex or "latest")
 * @param {Array<string>} [options.category] - Transfer categories (e.g., ["external", "erc20"])
 * @param {number} [options.cutoffTimestamp] - Unix timestamp (seconds); stop fetching when oldest transfer is before this
 * @param {number} [options.delayMs=500] - Delay between pages to avoid rate limiting
 * @returns {Promise<Array>} All asset transfers
 */
export async function fetchAllAssetTransfers(address, apiKey, options = {}) {
  const { fromBlock, toBlock, category, cutoffTimestamp, delayMs = 500 } = options;

  const allTransfers = [];
  let pageKey = null;
  let pageCount = 0;

  logger.info({ context: 'alchemy', address, fromBlock, toBlock, cutoffTimestamp }, 'Starting fetchAllAssetTransfers');

  while (true) {
    pageCount++;

    const { transfers, pageKey: nextPageKey } = await fetchAssetTransfers(address, apiKey, {
      fromBlock,
      toBlock,
      category,
      pageKey,
      order: 'desc', // Newest first
    });

    if (transfers.length === 0) {
      logger.info({ context: 'alchemy', address, pageCount, total: allTransfers.length }, 'No more transfers');
      break;
    }

    allTransfers.push(...transfers);

    logger.info(
      { context: 'alchemy', address, page: pageCount, fetched: transfers.length, total: allTransfers.length },
      'Fetched transfer page'
    );

    // Check if we hit the cutoff
    if (cutoffTimestamp && transfers.length > 0) {
      const oldestTransfer = transfers[transfers.length - 1];
      const oldestBlock = parseInt(oldestTransfer.blockNum, 16);
      // Get block timestamp - we'll need to estimate or check
      // For now, we'll use transfer metadata if available
      const metadata = oldestTransfer.metadata;
      const oldestTimestamp = metadata?.blockTimestamp
        ? new Date(metadata.blockTimestamp).getTime() / 1000
        : null;

      if (oldestTimestamp && oldestTimestamp < cutoffTimestamp) {
        logger.info(
          { context: 'alchemy', address, page: pageCount, oldestTimestamp, cutoffTimestamp, total: allTransfers.length },
          'Hit cutoff timestamp'
        );
        break;
      }
    }

    // Check if there's more data
    if (!nextPageKey) {
      logger.info(
        { context: 'alchemy', address, pageCount, total: allTransfers.length },
        'Reached end of transfers (no pageKey)'
      );
      break;
    }

    // Rate limit: delay before next page
    await new Promise(resolve => setTimeout(resolve, delayMs));
    pageKey = nextPageKey;
  }

  // Filter by cutoff if provided (final cleanup)
  if (cutoffTimestamp) {
    const filtered = allTransfers.filter(transfer => {
      const metadata = transfer.metadata;
      if (!metadata?.blockTimestamp) return true; // Keep if no timestamp
      const timestamp = new Date(metadata.blockTimestamp).getTime() / 1000;
      return timestamp >= cutoffTimestamp;
    });

    logger.info(
      { context: 'alchemy', address, total: allTransfers.length, filtered: filtered.length },
      'Filtered transfers by cutoff'
    );

    return filtered;
  }

  return allTransfers;
}

/**
 * Convert Alchemy transfer format to our internal payout format
 *
 * @param {Object} transfer - Alchemy transfer object
 * @param {string} firmId - Firm identifier
 * @returns {Object|null} Payout object or null if invalid
 */
export function alchemyTransferToPayout(transfer, firmId) {
  // Only process outgoing transfers (from the firm)
  if (!transfer.from) return null;

  const timestamp = transfer.metadata?.blockTimestamp
    ? new Date(transfer.metadata.blockTimestamp).toISOString()
    : new Date(parseInt(transfer.blockNum, 16) * 12 * 1000).toISOString(); // Estimate from block

  const txHash = transfer.hash;
  const fromAddress = transfer.from;
  const toAddress = transfer.to;

  let amount = 0;
  let paymentMethod = 'crypto';

  // Determine amount and payment method based on transfer category
  if (transfer.category === 'external') {
    // Native ETH transfer
    amount = parseFloat(transfer.value) * 2500; // ETH to USD (approximate)
    paymentMethod = 'crypto';
  } else if (transfer.category === 'erc20' || transfer.category === 'erc721' || transfer.category === 'erc1155') {
    // Token transfer
    const tokenSymbol = transfer.asset?.toUpperCase();
    const value = parseFloat(transfer.value || 0);

    // Map token to payment method and USD value
    if (tokenSymbol === 'RISEPAY') {
      amount = value;
      paymentMethod = 'rise';
    } else if (tokenSymbol === 'USDC' || tokenSymbol === 'USDT') {
      amount = value;
      paymentMethod = 'crypto';
    } else {
      // Unknown token, skip
      return null;
    }
  }

  // Filter out small amounts (< $10)
  if (amount < 10) return null;

  return {
    tx_hash: txHash,
    firm_id: firmId,
    amount,
    payment_method: paymentMethod,
    timestamp,
    from_address: fromAddress,
    to_address: toAddress,
  };
}
