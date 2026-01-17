"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

export default function PropFirmDetailPage() {
  const params = useParams();
  const firmId = params.id;

  const [firm, setFirm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadFirm() {
      try {
        setLoading(true);
        const response = await fetch('/api/propfirms');
        if (!response.ok) throw new Error('Failed to load firms');

        const data = await response.json();
        const foundFirm = data.firms.find(f => f.id === firmId);

        if (!foundFirm) {
          throw new Error('Firm not found');
        }

        setFirm(foundFirm);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadFirm();
  }, [firmId]);

  if (loading) {
    return (
      <div className="container mx-auto p-8">
        <div className="flex items-center justify-center h-64">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-8">
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">{firm.name}</h1>
        <p className="text-base-content/60">
          Tracking {firm.addresses.length} wallet address{firm.addresses.length !== 1 ? 'es' : ''}
        </p>
      </div>

      {/* Display addresses */}
      <div className="card bg-base-100 shadow mb-8">
        <div className="card-body">
          <h2 className="card-title">Wallet Addresses</h2>
          {firm.addresses.length === 0 ? (
            <p className="text-base-content/60">No addresses configured</p>
          ) : (
            <ul className="space-y-2">
              {firm.addresses.map((address, idx) => (
                <li key={idx} className="font-mono text-sm">
                  <a
                    href={`https://arbiscan.io/address/${address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link link-primary"
                  >
                    {address}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Placeholder for future transaction data */}
      <div className="alert alert-info">
        <span>
          Transaction analytics coming soon! The addresses above will be used to fetch outgoing transactions from Arbiscan.
        </span>
      </div>
    </div>
  );
}
