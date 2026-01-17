"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { usePropFirmTransactions } from '@/lib/hooks/usePropFirmTransactions';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import PropProofLayout from '@/components/PropProofLayout';

export default function PropFirmDetailPage() {
  const params = useParams();
  const firmId = params.id;

  const [firm, setFirm] = useState(null);
  const [firmLoading, setFirmLoading] = useState(true);
  const [firmError, setFirmError] = useState(null);
  const [days, setDays] = useState(7);

  // Load firm data from JSON
  useEffect(() => {
    async function loadFirm() {
      try {
        setFirmLoading(true);
        const response = await fetch('/api/propfirms');
        if (!response.ok) throw new Error('Failed to load firms');

        const data = await response.json();
        const foundFirm = data.firms.find(f => f.id === firmId);

        if (!foundFirm) {
          throw new Error('Firm not found');
        }

        setFirm(foundFirm);
      } catch (err) {
        setFirmError(err.message);
      } finally {
        setFirmLoading(false);
      }
    }

    loadFirm();
  }, [firmId]);

  // Fetch transaction data using the hook
  const { data, loading, error } = usePropFirmTransactions(firm?.addresses || [], days);

  if (firmLoading) {
    return (
      <PropProofLayout>
        <div className="container mx-auto p-8">
          <div className="flex items-center justify-center h-64">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        </div>
      </PropProofLayout>
    );
  }

  if (firmError) {
    return (
      <PropProofLayout>
        <div className="container mx-auto p-8">
          <div className="alert alert-error">
            <span>{firmError}</span>
          </div>
        </div>
      </PropProofLayout>
    );
  }

  return (
    <PropProofLayout>
      <div className="container mx-auto p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">{firm.name}</h1>
          <p className="text-base-content/60">
            Tracking {firm.addresses.length} wallet address{firm.addresses.length !== 1 ? 'es' : ''}
          </p>
        </div>

        {/* Time range selector */}
        <select
          className="select select-bordered"
          value={days}
          onChange={(e) => setDays(parseInt(e.target.value))}
        >
          <option value={7}>Last 7 Days</option>
          <option value={30}>Last 30 Days</option>
        </select>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center h-64">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="alert alert-error mb-8">
          <span>Error loading transactions: {error}</span>
        </div>
      )}

      {/* Data Display */}
      {data && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h2 className="card-title text-sm text-base-content/60 uppercase">
                  Total Payouts (Last {days} Days)
                </h2>
                <p className="text-3xl font-bold">
                  ${data.totalPayoutUSD?.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h2 className="card-title text-sm text-base-content/60 uppercase">
                  No. of Payouts (Last {days} Days)
                </h2>
                <p className="text-3xl font-bold">
                  {data.totalPayoutCount?.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h2 className="card-title text-sm text-base-content/60 uppercase">
                  Largest Single Payout
                </h2>
                <p className="text-3xl font-bold">
                  ${data.largestPayoutUSD?.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h2 className="card-title text-sm text-base-content/60 uppercase">
                  Time Since Last Payout
                </h2>
                <p className="text-3xl font-bold">
                  {data.timeSinceLastPayout}
                </p>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="card bg-base-100 shadow-xl mb-8">
            <div className="card-body">
              <h2 className="card-title mb-4">Total Payouts</h2>
              <div className="flex justify-end mb-2">
                <select className="select select-bordered select-sm">
                  <option>Last {days} Days</option>
                </select>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.dailyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(value) => `$${value.toLocaleString()}`}
                    contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151' }}
                  />
                  <Legend />
                  <Bar key="rise" dataKey="rise" stackId="a" fill="#4F46E5" name="Rise" />
                  <Bar key="crypto" dataKey="crypto" stackId="a" fill="#F59E0B" name="Crypto" />
                  <Bar key="wireTransfer" dataKey="wireTransfer" stackId="a" fill="#10B981" name="Wire Transfer" />
                </BarChart>
              </ResponsiveContainer>
              <div className="text-center text-sm text-base-content/60 mt-4">
                @payoutjunction
              </div>
            </div>
          </div>

          {/* Top 10 & Latest Payouts - Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top 10 Largest Single Payouts */}
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl">🏆</span>
                  <h2 className="card-title">Top 10 Largest Single Payouts</h2>
                </div>

                {data.topPayouts && data.topPayouts.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="table table-sm">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Amount</th>
                          <th>Method</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.topPayouts.map((tx, idx) => (
                          <tr key={tx.txHash} className="hover">
                            <td>
                              <a
                                href={tx.arbiscanUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="link link-primary"
                              >
                                {new Date(tx.timestamp * 1000).toLocaleDateString()}
                              </a>
                            </td>
                            <td className="font-semibold">
                              ${tx.amountUSD.toLocaleString()}
                            </td>
                            <td>
                              <span className={`badge badge-sm ${
                                tx.paymentMethod === 'Rise' ? 'badge-primary' :
                                tx.paymentMethod === 'Crypto' ? 'badge-warning' :
                                'badge-success'
                              }`}>
                                {tx.paymentMethod}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-base-content/60">No payouts found</p>
                )}
              </div>
            </div>

            {/* Latest Payouts */}
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl">⚡</span>
                  <h2 className="card-title">Latest Payouts</h2>
                </div>
                <div className="flex justify-end mb-2">
                  <select className="select select-bordered select-sm">
                    <option>Last 24 Hours</option>
                  </select>
                </div>

                {data.latestPayouts && data.latestPayouts.length > 0 ? (
                  <>
                    <div className="overflow-x-auto">
                      <table className="table table-sm">
                        <thead>
                          <tr>
                            <th>Time Ago</th>
                            <th>Amount</th>
                            <th>Token</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.latestPayouts.map((tx) => {
                            const hoursAgo = Math.floor((Date.now() / 1000 - tx.timestamp) / 3600);
                            const minutesAgo = Math.floor((Date.now() / 1000 - tx.timestamp) % 3600 / 60);

                            return (
                              <tr key={tx.txHash} className="hover">
                                <td>
                                  <a
                                    href={tx.arbiscanUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="link link-primary text-xs"
                                  >
                                    {hoursAgo} hours and {minutesAgo} minutes
                                  </a>
                                </td>
                                <td className="font-semibold">
                                  ${tx.amountUSD.toLocaleString()}
                                </td>
                                <td>
                                  <span className="badge badge-sm">{tx.token}</span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="text-sm text-base-content/60 mt-2">
                      1 - {data.latestPayouts.length} of {data.latestPayouts.length}
                    </div>
                  </>
                ) : (
                  <p className="text-base-content/60">No recent payouts in last 24 hours</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
      </div>
    </PropProofLayout>
  );
}
