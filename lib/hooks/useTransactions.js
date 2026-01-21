"use client";

import { useState, useEffect } from 'react';

/**
 * Custom hook to fetch transaction data from the API
 *
 * @param {string} address - Wallet address to fetch transactions for
 * @returns {Object} { data, loading, error }
 */
export function useTransactions(address) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!address) {
      setLoading(false);
      return;
    }

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/transactions?address=${address}`);

        const json = await response.json();

        // If API returns an error, use empty data instead of throwing
        if (!response.ok) {
          console.warn('[useTransactions] API returned error, using empty data:', json.error);
          setData({
            address,
            totalPayoutUSD: 0,
            last30DaysPayoutUSD: 0,
            avgPayoutUSD: 0,
            transactions: [],
            monthlyData: [],
          });
        } else {
          setData(json);
        }
      } catch (err) {
        // On network errors, set empty data instead of error state
        console.warn('[useTransactions] Fetch error, using empty data:', err.message);
        setData({
          address,
          totalPayoutUSD: 0,
          last30DaysPayoutUSD: 0,
          avgPayoutUSD: 0,
          transactions: [],
          monthlyData: [],
        });
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [address]);

  return { data, loading, error };
}
