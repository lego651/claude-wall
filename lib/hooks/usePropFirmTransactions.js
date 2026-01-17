"use client";

import { useState, useEffect } from 'react';

/**
 * React hook for fetching prop firm transaction data
 *
 * @param {Array<string>} addresses - Array of wallet addresses
 * @param {number} days - Number of days to look back (default: 7)
 * @returns {Object} { data, loading, error }
 */
export function usePropFirmTransactions(addresses, days = 7) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Skip if no addresses provided
    if (!addresses || addresses.length === 0) {
      setLoading(false);
      setError('No addresses provided');
      return;
    }

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        // Build query string
        const addressesParam = addresses.join(',');
        const url = `/api/propfirm-transactions?addresses=${addressesParam}&days=${days}`;

        console.log(`[usePropFirmTransactions] Fetching: ${url}`);

        const response = await fetch(url);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch transactions');
        }

        const json = await response.json();
        console.log(`[usePropFirmTransactions] Loaded ${json.totalPayoutCount} transactions`);

        setData(json);
      } catch (err) {
        console.error('[usePropFirmTransactions] Error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [addresses?.join(','), days]); // Re-fetch when addresses or days change

  return { data, loading, error };
}
