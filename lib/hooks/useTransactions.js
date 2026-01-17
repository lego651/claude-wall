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

        if (!response.ok) {
          throw new Error('Failed to fetch transactions');
        }

        const json = await response.json();
        setData(json);
      } catch (err) {
        setError(err.message);
        console.error('[useTransactions] Error:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [address]);

  return { data, loading, error };
}
