"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import PropProofLayout from '@/components/PropProofLayout';
import { timeSince } from '@/lib/utils/timeSince';

const PERIODS = [
  { label: '24 Hours', value: '1d' },
  { label: '7 Days', value: '7d' },
  { label: '30 Days', value: '30d' },
  { label: '12 Months', value: '12m' },
];

// Color classes for firm cards
const COLOR_CLASSES = [
  'bg-indigo-600',
  'bg-emerald-600',
  'bg-blue-600',
  'bg-purple-600',
  'bg-pink-600',
  'bg-rose-600',
  'bg-amber-600',
  'bg-cyan-600',
];

// Get random 3 firms from the list
function getRandomFirms(firms, count = 3) {
  if (firms.length <= count) return firms;
  const shuffled = [...firms].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// Format currency
const formatCurrency = (val) => 
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val || 0);

// Format time for "Updated X ago"
function formatUpdatedTime(timestamp) {
  if (!timestamp) return 'N/A';
  
  try {
    const then = new Date(timestamp);
    const now = new Date();
    const diffMs = now - then;

    if (diffMs < 0 || isNaN(diffMs)) {
      return 'N/A';
    }

    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);

    if (months > 0) {
      return `${months}M AGO`;
    }
    if (days > 0) {
      return `${days}D AGO`;
    }
    if (hours > 0) {
      return `${hours}H AGO`;
    }
    if (minutes > 0) {
      return `${minutes}M AGO`;
    }
    return 'JUST NOW';
  } catch {
    return 'N/A';
  }
}

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

  // Get random 3 firms for featured cards
  const featuredFirms = useMemo(() => getRandomFirms(firms, 3), [firms]);

  // Get initials from firm name
  const getInitials = (name) => {
    if (!name) return '??';
    const words = name.split(' ');
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Get color class for firm (consistent based on firm id)
  const getColorClass = (firmId, index) => {
    const hash = firmId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return COLOR_CLASSES[(hash + index) % COLOR_CLASSES.length];
  };

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

  // Get max payout count for progress bar calculation
  const maxPayoutCount = useMemo(() => {
    if (firms.length === 0) return 600;
    return Math.max(...firms.map(f => f.metrics?.payoutCount || 0), 600);
  }, [firms]);

  return (
    <PropProofLayout>
      <main className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">
        {/* Header Section */}
        <div className="flex flex-col items-center text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest leading-none mt-0.5">Live On-Chain Tracking</span>
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold text-gray-900 tracking-tight mb-4">
            Prop Firm <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">Leaderboard</span>
          </h1>
          <p className="text-lg text-gray-500 font-medium max-w-2xl">
            Real-time verification of proprietary firm payout distributions using public blockchain data.
          </p>
        </div>

        {/* Featured / Trending Section */}
        {!loading && !error && featuredFirms.length > 0 && (
          <div className="mb-16">
            <div className="flex items-center gap-4 mb-8">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-amber-100 text-amber-600 rounded-lg">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </span>
                <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">Trending Now</h2>
              </div>
              <div className="h-[1px] flex-grow bg-gradient-to-r from-gray-200 to-transparent"></div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {featuredFirms.map((firm, idx) => {
              const colorClass = getColorClass(firm.id, idx);
              const payoutCount = firm.metrics?.payoutCount || 0;
              const progressPercent = Math.min((payoutCount / maxPayoutCount) * 100, 100);
              
              return (
                <div 
                  key={firm.id}
                  className="glass-card p-8 rounded-[2.5rem] transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-indigo-100/50 group"
                  style={{ animationDelay: `${(idx + 1) * 100}ms` }}
                >
                  <div className="flex justify-between items-start mb-8">
                    <div className={`relative w-16 h-16 ${colorClass} rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-xl rotate-3 group-hover:rotate-0 transition-all duration-300`}>
                      {getInitials(firm.name)}
                      <div className="absolute -top-2 -right-2 bg-amber-400 text-[8px] font-black text-white px-2 py-0.5 rounded-full uppercase tracking-tighter shadow-md border border-white">
                        Hot
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total Payouts</p>
                      <p className="text-3xl font-black text-gray-900 tabular-nums tracking-tight">{formatCurrency(firm.metrics?.totalPayouts)}</p>
                    </div>
                  </div>
                  <div className="space-y-5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 font-bold">Payout Volume</span>
                      <span className="text-gray-900 font-black">{payoutCount} Trans.</span>
                    </div>
                    <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden p-0.5 border border-gray-50">
                      <div 
                        className={`h-full ${colorClass} rounded-full transition-all duration-1000 delay-500`} 
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <div className="pt-2 flex items-center justify-between">
                      <button 
                        onClick={() => router.push(`/propfirm/${firm.id}`)}
                        className="text-xs font-bold text-indigo-600 bg-indigo-50 px-4 py-2 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300 active:scale-95"
                      >
                        View Insights
                      </button>
                      <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wide">Updated {formatUpdatedTime(firm.metrics?.latestPayoutAt)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-16">
            <p className="text-red-600">Error loading firms: {error}</p>
          </div>
        )}

        {/* Leaderboard Section */}
        {!loading && !error && firms.length > 0 && (
          <div>
            {/* Date Range Selector - Centered */}
            <div className="flex flex-col items-center mb-10">
              <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-[0.2em] mb-4">Viewing Stats For</span>
              <div className="inline-flex bg-[#0f172a] p-1.5 rounded-[20px] shadow-2xl shadow-gray-900/20 border border-white/5">
                {PERIODS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setPeriod(p.value)}
                    className={`px-8 py-2.5 text-xs font-bold rounded-[16px] transition-all duration-300 ${
                      period === p.value 
                        ? 'bg-white text-[#0f172a] shadow-xl transform scale-[1.02]' 
                        : 'text-white/80 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4 mb-8">
              <h2 className="text-2xl font-black text-gray-900 whitespace-nowrap">Verified Leaderboard</h2>
              <div className="h-[1px] flex-grow bg-gradient-to-r from-gray-200 to-transparent"></div>
            </div>
            
            <div className="glass-card rounded-[2rem] overflow-hidden border border-gray-100 shadow-2xl shadow-gray-200/40">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50/50 border-b border-gray-100">
                      <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-widest text-gray-400">Trading Entity</th>
                      <th 
                        className="px-6 py-6 text-right text-[11px] font-bold uppercase tracking-widest text-gray-400 cursor-pointer hover:text-gray-600"
                        onClick={() => handleSort('totalPayouts')}
                      >
                        Aggregate Payouts <SortIcon field="totalPayouts" />
                      </th>
                      <th 
                        className="px-6 py-6 text-right text-[11px] font-bold uppercase tracking-widest text-gray-400 cursor-pointer hover:text-gray-600"
                        onClick={() => handleSort('avgPayout')}
                      >
                        Mean Exit <SortIcon field="avgPayout" />
                      </th>
                      <th 
                        className="px-6 py-6 text-right text-[11px] font-bold uppercase tracking-widest text-gray-400 cursor-pointer hover:text-gray-600"
                        onClick={() => handleSort('largestPayout')}
                      >
                        Peak Payout <SortIcon field="largestPayout" />
                      </th>
                      <th 
                        className="px-8 py-6 text-right text-[11px] font-bold uppercase tracking-widest text-gray-400 cursor-pointer hover:text-gray-600"
                        onClick={() => handleSort('latestPayout')}
                      >
                        Activity Status <SortIcon field="latestPayout" />
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100/50">
                    {firms.map((firm, idx) => {
                      const colorClass = getColorClass(firm.id, idx);
                      return (
                        <tr 
                          key={firm.id} 
                          className="group hover:bg-indigo-50/40 transition-all duration-200 cursor-pointer"
                          onClick={() => router.push(`/propfirm/${firm.id}`)}
                        >
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 ${colorClass} rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm transition-transform group-hover:scale-110`}>
                                {getInitials(firm.name)}
                              </div>
                              <span className="font-bold text-indigo-600 hover:text-indigo-800 transition-colors underline decoration-indigo-200 underline-offset-4 decoration-2 group-hover:decoration-indigo-600">
                                {firm.name}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-6 text-right font-black text-gray-900 tabular-nums">
                            {formatCurrency(firm.metrics?.totalPayouts)}
                          </td>
                          <td className="px-6 py-6 text-right font-semibold text-gray-500 tabular-nums">
                            {formatCurrency(firm.metrics?.avgPayout)}
                          </td>
                          <td className="px-6 py-6 text-right font-bold text-gray-900 tabular-nums">
                            {formatCurrency(firm.metrics?.largestPayout)}
                          </td>
                          <td className="px-8 py-6 text-right">
                            <div className="flex flex-col items-end gap-1.5">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-wider border border-indigo-100">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                                On-Chain
                              </span>
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">{formatUpdatedTime(firm.metrics?.latestPayoutAt)}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && firms.length === 0 && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🏢</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No firms found</h3>
            <p className="text-gray-600">Check back later for prop firm data</p>
          </div>
        )}
      </main>
    </PropProofLayout>
  );
}
