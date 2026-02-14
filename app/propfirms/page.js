"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import PropProofLayout from '@/components/common/PropProofLayout';
import { timeSince } from '@/lib/utils/timeSince';
import { getFirmLogoUrl, DEFAULT_LOGO_URL } from '@/lib/logoUtils';

const PERIODS = [
  { label: '24 Hours', value: '1d' },
  { label: '7 Days', value: '7d' },
  { label: '30 Days', value: '30d' },
  { label: '12 Months', value: '12m' },
];

// Color classes for firm cards
const COLOR_CLASSES = [
  '', // Stripe color will be applied via style
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

  const getLogoUrl = (firm) => getFirmLogoUrl(firm);

  // Check if we should show logo - try to show for all firms
  const shouldShowLogo = (firm) => {
    // Always try to show logo if firm.logo exists, or if we have local files
    return true; // Try to show logo for all firms
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

  const SortableTh = ({ field, label, className = '' }) => {
    const isActive = sort === field;
    const alignRight = className.includes('text-right');
    return (
      <th
        className={`px-6 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-600 ${className}`}
        onClick={() => handleSort(field)}
      >
        <div className={`flex items-center gap-1 ${alignRight ? 'justify-end' : ''}`}>
          {label}
          {isActive && (
            order === 'desc' ? (
              <svg className="w-3 h-3 text-indigo-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            ) : (
              <svg className="w-3 h-3 text-indigo-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            )
          )}
        </div>
      </th>
    );
  };

  // Get max payout count for progress bar calculation
  const maxPayoutCount = useMemo(() => {
    if (firms.length === 0) return 600;
    return Math.max(...firms.map(f => f.metrics?.payoutCount || 0), 600);
  }, [firms]);

  return (
    <PropProofLayout>
      <main className="flex-grow">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">
          {/* Hero - match design: lavender badge, title, subtitle */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#EEF0FF] mb-6">
              <span className="w-2 h-2 rounded-full bg-[#606EE6] flex-shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#3D48B4]">
                Real-Time Rise Payout Monitoring
              </span>
            </div>

            <h1 className="text-5xl md:text-6xl font-extrabold tracking-tighter mb-6">
              <span className="text-[#2A2A35]">Prop Firm </span>
              <span className="text-[#606EE6]">On-Chain Analytics</span>
            </h1>

            <p className="max-w-2xl mx-auto text-base text-[#6F788B] leading-relaxed font-normal mb-8">
              Monitoring the trending Rise Payout ecosystem. While firms use various methods (BTC, Wise, Bank), we track public blockchain data to provide transparent payout distribution insights.
            </p>

            {/* Period selector - pill shape, dark blue-grey; selected = white + black text; unselected = light grey text */}
            <div className="inline-flex flex-wrap justify-center gap-0 rounded-full p-1.5 bg-[#1A1E27] shadow-md mt-2">
              {PERIODS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPeriod(p.value)}
                  className={`px-6 py-2.5 text-sm font-semibold rounded-full transition-all ${
                    period === p.value
                      ? "bg-white text-black border border-slate-300 shadow-sm"
                      : "text-[#ADB5BD] hover:text-slate-300"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

        {/* Featured / Trending Section - hidden for now */}
        {false && !loading && !error && featuredFirms.length > 0 && (
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
                  className="glass-card p-8 rounded-[2.5rem] transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl group"
                  onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 25px 50px -12px rgba(99, 91, 255, 0.15)'}
                  onMouseLeave={(e) => e.currentTarget.style.boxShadow = ''}
                  style={{ animationDelay: `${(idx + 1) * 100}ms` }}
                >
                  <div className="flex justify-between items-start mb-8">
                    <div className="relative">
                      <div className="relative w-16 h-16 rounded-2xl overflow-hidden shadow-xl rotate-3 group-hover:rotate-0 transition-all duration-300 bg-white">
                        <img 
                          src={getLogoUrl(firm)} 
                          alt={firm.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.src = DEFAULT_LOGO_URL;
                          }}
                        />
                        <div className={`hidden w-16 h-16 ${colorClass} rounded-2xl items-center justify-center text-white font-black text-xl shadow-xl`} style={!colorClass ? { backgroundColor: '#635BFF' } : {}}>
                          {getInitials(firm.name)}
                        </div>
                      </div>
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
                        style={{ width: `${progressPercent}%`, ...(!colorClass ? { backgroundColor: '#635BFF' } : {}) }}
                      />
                    </div>
                    <div className="pt-2 flex items-center justify-between">
                      <button 
                        onClick={() => router.push(`/propfirms/${firm.id}`)}
                        className="text-xs font-bold px-4 py-2 rounded-xl transition-all duration-300 active:scale-95"
                        style={{ color: '#635BFF', backgroundColor: 'rgba(99, 91, 255, 0.1)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#635BFF'; e.currentTarget.style.color = 'white'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(99, 91, 255, 0.1)'; e.currentTarget.style.color = '#635BFF'; }}
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

        {/* Loading Skeleton */}
        {loading && (
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="h-7 w-48 bg-slate-200 rounded animate-pulse" />
            <div className="h-4 w-64 bg-slate-100 rounded animate-pulse" />
          </div>
        )}
        {loading && (
          <div className="overflow-x-auto rounded-xl border border-slate-100 bg-slate-50 shadow-sm">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-8 py-5"><div className="h-3 w-24 bg-slate-200 rounded animate-pulse" /></th>
                  <th className="px-6 py-5"><div className="h-3 w-28 bg-slate-200 rounded animate-pulse" /></th>
                  <th className="px-6 py-5"><div className="h-3 w-36 bg-slate-200 rounded animate-pulse" /></th>
                  <th className="px-6 py-5"><div className="h-3 w-32 bg-slate-200 rounded animate-pulse" /></th>
                  <th className="px-8 py-5 text-right"><div className="h-3 w-24 bg-slate-200 rounded animate-pulse ml-auto" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-slate-200 rounded-xl animate-pulse flex-shrink-0" />
                        <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
                      </div>
                    </td>
                    <td className="px-6 py-6"><div className="h-4 w-20 bg-slate-200 rounded animate-pulse" /></td>
                    <td className="px-6 py-6"><div className="h-4 w-16 bg-slate-200 rounded animate-pulse" /></td>
                    <td className="px-6 py-6"><div className="h-4 w-16 bg-slate-200 rounded animate-pulse" /></td>
                    <td className="px-8 py-6 text-right"><div className="h-6 w-20 bg-slate-200 rounded-full animate-pulse ml-auto" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-16">
            <p className="text-red-600">Error loading firms: {error}</p>
          </div>
        )}

        {/* Firm Payout Insights - headings inside card, then table */}
        {!loading && !error && firms.length > 0 && (
          <div className="rounded-2xl border border-slate-100 bg-slate-50 shadow-sm overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-8 pt-6 pb-4">
              <h2 className="text-xl font-bold text-slate-900">Firm Payout Insights</h2>
              <p className="text-sm text-slate-400 italic">Select a firm to view detailed on-chain analytics</p>
            </div>

            {/* Warning / note banner */}
            <div className="mx-8 mt-4 mb-4 flex items-start gap-2 rounded-lg bg-[#FFF8ED] px-3 py-2">
              <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-amber-600 text-amber-700 text-xs font-bold">
                !
              </span>
              <p className="text-xs text-[#B07B00] leading-snug">
                <strong>Note:</strong> Tracking is limited to <strong>Rise Payouts</strong>. Total amounts may include operational transfers (salaries) and exclude non-Rise methods (Wise, BTC, Bank).
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-50">
                    <th className="px-8 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Firm</th>
                    <SortableTh field="totalPayouts" label="Total Payouts" />
                    <SortableTh field="avgPayout" label="Average Payout Size" />
                    <SortableTh field="largestPayout" label="Largest Single Payout" />
                    <SortableTh field="latestPayout" label="Latest Payout" className="px-8 text-right" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {firms.map((firm, idx) => {
                    const colorClass = getColorClass(firm.id, idx);
                    return (
                      <tr
                        key={firm.id}
                        onClick={() => router.push(`/propfirms/${firm.id}`)}
                        className="group hover:bg-slate-50 transition-all duration-150 cursor-pointer"
                      >
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-100 group-hover:border-indigo-200 transition-colors">
                              <img
                                src={getLogoUrl(firm)}
                                alt={firm.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.target.src = DEFAULT_LOGO_URL;
                                }}
                              />
                              <div className={`hidden w-10 h-10 ${colorClass} rounded-xl items-center justify-center text-white font-bold text-sm`} style={!colorClass ? { backgroundColor: '#4f46e5' } : {}}>
                                {getInitials(firm.name)}
                              </div>
                            </div>
                            <span className="text-sm font-bold text-indigo-600 group-hover:text-indigo-700 underline decoration-indigo-200 group-hover:decoration-indigo-500 underline-offset-4 transition-all">
                              {firm.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-6">
                          <span className="text-base font-extrabold text-slate-900">{formatCurrency(firm.metrics?.totalPayouts)}</span>
                        </td>
                        <td className="px-6 py-6">
                          <span className="text-sm font-semibold text-slate-600">{formatCurrency(firm.metrics?.avgPayout)}</span>
                        </td>
                        <td className="px-6 py-6">
                          <span className="text-sm font-semibold text-slate-600">{formatCurrency(firm.metrics?.largestPayout)}</span>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
                              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                              <span className="text-[10px] font-bold uppercase tracking-wider">On-Chain</span>
                            </div>
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-tighter">{formatUpdatedTime(firm.metrics?.latestPayoutAt)}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && firms.length === 0 && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🏢</div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">No firms found</h3>
            <p className="text-slate-600">Check back later for prop firm data</p>
          </div>
        )}
        </div>
      </main>
    </PropProofLayout>
  );
}
