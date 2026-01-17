"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import PropProofLayout from '@/components/PropProofLayout';

export default function PropFirmsListPage() {
  const [firms, setFirms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadFirms() {
      try {
        setLoading(true);
        const response = await fetch('/api/propfirms');
        if (!response.ok) throw new Error('Failed to load firms');

        const data = await response.json();
        setFirms(data.firms);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadFirms();
  }, []);

  return (
    <PropProofLayout>
      <div className="container mx-auto px-4 py-12 max-w-7xl">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Prop Firms</h1>
          <p className="text-lg text-gray-600">
            Track verified payout data for leading proprietary trading firms
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center h-64">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="alert alert-error">
            <span>Error loading firms: {error}</span>
          </div>
        )}

        {/* Firms Grid */}
        {!loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {firms.map((firm) => (
              <Link
                key={firm.id}
                href={`/propfirm/${firm.id}`}
                className="block group"
              >
                <div className="card bg-white border border-gray-200 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                  <div className="card-body">
                    {/* Firm Name */}
                    <h2 className="card-title text-2xl mb-3 group-hover:text-blue-600 transition-colors">
                      {firm.name}
                    </h2>

                    {/* Address Count */}
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                        />
                      </svg>
                      <span>
                        {firm.addresses.length} wallet address
                        {firm.addresses.length !== 1 ? 'es' : ''} tracked
                      </span>
                    </div>

                    {/* View Details Button */}
                    <div className="card-actions justify-end mt-4">
                      <button className="btn btn-sm btn-primary group-hover:btn-neutral transition-colors">
                        View Details
                        <svg
                          className="w-4 h-4 group-hover:translate-x-1 transition-transform"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17 8l4 4m0 0l-4 4m4-4H3"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && firms.length === 0 && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🏢</div>
            <h3 className="text-2xl font-bold mb-2">No firms found</h3>
            <p className="text-gray-600">Check back later for prop firm data</p>
          </div>
        )}
      </div>
    </PropProofLayout>
  );
}
