"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PropProofLayout from '@/components/PropProofLayout';
import { timeSince } from '@/lib/utils/timeSince';

const PERIODS = [
  { label: '24h', value: '1d' },
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
  { label: '12m', value: '12m' },
];

const SORT_OPTIONS = [
  { label: 'Total Payouts', value: 'totalPayouts' },
  { label: 'No. of Payouts', value: 'payoutCount' },
  { label: 'Largest Payout', value: 'largestPayout' },
  { label: 'Avg Payout', value: 'avgPayout' },
  { label: 'Latest Payout', value: 'latestPayout' },
];

export default function PropFirmsListPage() {
  const router = useRouter();
  const [firms, setFirms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('1d');
  const [sort, setSort] = useState('totalPayouts');
  const [order, setOrder] = useState('desc');

  useEffect(() => {
    async function loadFirms() {
      try {
        setLoading(true);
        const response = await fetch(`/api/v2/propfirms?period=${period}&sort=${sort}&order=${order}`);
        if (!response.ok) throw new Error('Failed to load firms');

        const data = await response.json();
        setFirms(data.data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadFirms();
  }, [period, sort, order]);

  // Toggle sort order when clicking same column
  const handleSort = (field) => {
    if (sort === field) {
      setOrder(order === 'desc' ? 'asc' : 'desc');
    } else {
      setSort(field);
      setOrder('desc');
    }
  };

  // Sort indicator
  const SortIcon = ({ field }) => {
    if (sort !== field) return null;
    return (
      <svg className="w-4 h-4 inline ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {order === 'desc' ? (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        )}
      </svg>
    );
  };

  return (
    <PropProofLayout>
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-10 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Prop Firms</h1>
          <p className="text-slate-600">
            Track verified payout data for leading proprietary trading firms
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          {/* Period Tabs */}
          <div className="flex bg-slate-100 rounded-lg p-1">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-4 py-2 text-sm font-semibold rounded-md transition-all ${
                  period === p.value
                    ? 'bg-white shadow-sm text-indigo-600'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Mobile Sort Dropdown */}
          <div className="sm:hidden">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  Sort by: {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center h-64">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="alert alert-error mb-6">
            <span>Error loading firms: {error}</span>
          </div>
        )}

        {/* Table */}
        {!loading && !error && firms.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Firm
                    </th>
                    <th 
                      className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 hidden sm:table-cell"
                      onClick={() => handleSort('totalPayouts')}
                    >
                      Total Payouts <SortIcon field="totalPayouts" />
                    </th>
                    <th 
                      className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 hidden md:table-cell"
                      onClick={() => handleSort('payoutCount')}
                    >
                      No. of Payouts <SortIcon field="payoutCount" />
                    </th>
                    <th 
                      className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 hidden lg:table-cell"
                      onClick={() => handleSort('largestPayout')}
                    >
                      Largest <SortIcon field="largestPayout" />
                    </th>
                    <th 
                      className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 hidden lg:table-cell"
                      onClick={() => handleSort('avgPayout')}
                    >
                      Avg Payout <SortIcon field="avgPayout" />
                    </th>
                    <th 
                      className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700"
                      onClick={() => handleSort('latestPayout')}
                    >
                      Latest <SortIcon field="latestPayout" />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {firms.map((firm) => (
                      <tr 
                        key={firm.id}
                        onClick={() => router.push(`/propfirm/${firm.id}`)}
                        className="hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        {/* Firm */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {firm.logo ? (
                              <img 
                                src={firm.logo} 
                                alt={firm.name} 
                                className="w-10 h-10 rounded-lg object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center">
                                <span className="text-white text-sm font-bold">
                                  {firm.name?.substring(0, 2).toUpperCase()}
                                </span>
                              </div>
                            )}
                            <div>
                              <div className="font-semibold text-slate-900">{firm.name}</div>
                              {firm.website && (
                                <div className="text-xs text-slate-400">
                                  {firm.website.replace(/^https?:\/\//, '')}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Total Payouts */}
                        <td className="px-6 py-4 text-right hidden sm:table-cell">
                          <span className="font-semibold text-slate-900">
                            ${firm.metrics?.totalPayouts?.toLocaleString() || 0}
                          </span>
                        </td>

                        {/* Payout Count */}
                        <td className="px-6 py-4 text-right hidden md:table-cell">
                          <span className="text-slate-600">
                            {firm.metrics?.payoutCount?.toLocaleString() || 0}
                          </span>
                        </td>

                        {/* Largest */}
                        <td className="px-6 py-4 text-right hidden lg:table-cell">
                          <span className="text-slate-600">
                            ${firm.metrics?.largestPayout?.toLocaleString() || 0}
                          </span>
                        </td>

                        {/* Avg Payout */}
                        <td className="px-6 py-4 text-right hidden lg:table-cell">
                          <span className="text-slate-600">
                            ${firm.metrics?.avgPayout?.toLocaleString() || 0}
                          </span>
                        </td>

                        {/* Latest */}
                        <td className="px-6 py-4 text-right">
                          <span className="text-slate-600 text-sm">
                            {timeSince(firm.metrics?.latestPayoutAt)}
                          </span>
                        </td>
                      </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && firms.length === 0 && (
          <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
            <div className="text-6xl mb-4">🏢</div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">No firms found</h3>
            <p className="text-slate-600">Check back later for prop firm data</p>
          </div>
        )}
      </div>
    </PropProofLayout>
  );
}
