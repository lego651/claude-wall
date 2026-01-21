"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import PropProofLayout from '@/components/PropProofLayout';
import { timeSince } from '@/lib/utils/timeSince';

export default function PropFirmDetailPage() {
  const params = useParams();
  const firmId = params.id;

  // State for chart data (includes firm info and summary)
  const [chartData, setChartData] = useState(null);
  const [chartPeriod, setChartPeriod] = useState('30d');
  const [chartLoading, setChartLoading] = useState(true);
  const [chartError, setChartError] = useState(null);

  // State for top payouts
  const [topPayouts, setTopPayouts] = useState([]);
  const [topPayoutsLoading, setTopPayoutsLoading] = useState(true);

  // State for latest payouts
  const [latestPayouts, setLatestPayouts] = useState([]);
  const [latestPayoutsLoading, setLatestPayoutsLoading] = useState(true);

  // Fetch chart data (includes firm info and summary)
  useEffect(() => {
    async function fetchChartData() {
      try {
        setChartLoading(true);
        setChartError(null);
        const response = await fetch(`/api/v2/propfirms/${firmId}/chart?period=${chartPeriod}`);
        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Failed to load data');
        }
        const data = await response.json();
        setChartData(data);
      } catch (err) {
        setChartError(err.message);
      } finally {
        setChartLoading(false);
      }
    }

    if (firmId) fetchChartData();
  }, [firmId, chartPeriod]);

  // Fetch top payouts
  useEffect(() => {
    async function fetchTopPayouts() {
      try {
        setTopPayoutsLoading(true);
        const response = await fetch(`/api/v2/propfirms/${firmId}/top-payouts?period=${chartPeriod}`);
        if (response.ok) {
          const data = await response.json();
          setTopPayouts(data.payouts || []);
        }
      } catch (err) {
        console.error('Failed to fetch top payouts:', err);
      } finally {
        setTopPayoutsLoading(false);
      }
    }

    if (firmId) fetchTopPayouts();
  }, [firmId, chartPeriod]);

  // Fetch latest payouts
  useEffect(() => {
    async function fetchLatestPayouts() {
      try {
        setLatestPayoutsLoading(true);
        const response = await fetch(`/api/v2/propfirms/${firmId}/latest-payouts`);
        if (response.ok) {
          const data = await response.json();
          setLatestPayouts(data.payouts || []);
        }
      } catch (err) {
        console.error('Failed to fetch latest payouts:', err);
      } finally {
        setLatestPayoutsLoading(false);
      }
    }

    if (firmId) fetchLatestPayouts();
  }, [firmId]);

  // Loading state - Skeleton
  if (chartLoading && !chartData) {
    return (
      <PropProofLayout>
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-10 py-8">
          {/* Header Skeleton */}
          <div className="flex items-center gap-5 mb-8">
            <div className="w-10 h-10 bg-slate-200 rounded-xl animate-pulse"></div>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-slate-200 rounded-xl animate-pulse"></div>
              <div>
                <div className="h-6 w-40 bg-slate-200 rounded animate-pulse mb-2"></div>
                <div className="h-4 w-32 bg-slate-100 rounded animate-pulse"></div>
              </div>
            </div>
          </div>

          {/* Stats Cards Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white p-6 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="h-3 w-24 bg-slate-200 rounded animate-pulse"></div>
                  <div className="w-8 h-8 bg-slate-100 rounded-lg animate-pulse"></div>
                </div>
                <div className="h-6 w-28 bg-slate-200 rounded animate-pulse"></div>
              </div>
            ))}
          </div>

          {/* Chart Skeleton */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 mb-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-200 rounded-lg animate-pulse"></div>
                <div className="h-5 w-32 bg-slate-200 rounded animate-pulse"></div>
              </div>
              <div className="h-8 w-48 bg-slate-100 rounded-lg animate-pulse"></div>
            </div>
            <div className="h-[350px] bg-slate-50 rounded-lg animate-pulse"></div>
          </div>

          {/* Payout Lists Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/30">
                  <div className="h-5 w-40 bg-slate-200 rounded animate-pulse"></div>
                </div>
                <div className="divide-y divide-slate-100">
                  {[1, 2, 3, 4, 5].map((j) => (
                    <div key={j} className="px-6 py-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-slate-100 rounded-full animate-pulse"></div>
                        <div>
                          <div className="h-4 w-24 bg-slate-200 rounded animate-pulse mb-1"></div>
                          <div className="h-3 w-12 bg-slate-100 rounded animate-pulse"></div>
                        </div>
                      </div>
                      <div className="h-4 w-16 bg-slate-200 rounded animate-pulse"></div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </PropProofLayout>
    );
  }

  // Error state
  if (chartError && !chartData) {
    return (
      <PropProofLayout>
        <div className="container mx-auto p-8">
          <div className="alert alert-error">
            <span>{chartError}</span>
          </div>
        </div>
      </PropProofLayout>
    );
  }

  const firm = chartData?.firm;
  const summary = chartData?.summary;
  const chart = chartData?.chart;

  return (
    <PropProofLayout>
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-10 py-8">
        {/* Header - Breadcrumb & Firm Info */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div className="flex items-center gap-5">
            {/* Back Button */}
            <button
              onClick={() => window.history.back()}
              className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
            >
              <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Firm Logo & Info */}
            <div className="flex items-center gap-4">
              {firm?.logo ? (
                <img src={firm.logo} alt={firm.name} className="w-16 h-16 rounded-xl shadow-md object-cover" />
              ) : (
                <div className="w-16 h-16 bg-slate-900 rounded-xl flex items-center justify-center shadow-md">
                  <span className="text-white text-xl font-black">
                    {firm?.name?.substring(0, 2).toUpperCase()}
                  </span>
                </div>
              )}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-2xl font-bold text-slate-900">{firm?.name}</h1>
                  <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                    Verified
                  </span>
                </div>
                <a
                  href={firm?.website || `https://${firm?.name?.toLowerCase().replace(/\s+/g, '')}.com`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:underline"
                >
                  {firm?.website?.replace(/^https?:\/\//, '') || `${firm?.name?.toLowerCase().replace(/\s+/g, '')}.com`}
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors shadow-sm">
              Follow Firm
            </button>
            <button className="px-5 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors shadow-sm flex items-center gap-2">
              <svg className="w-4 h-4 text-yellow-400 fill-yellow-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Trade Now
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {/* Total Payouts */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">
                Total Payouts
              </span>
              <div className="p-2 bg-slate-50 rounded-lg">
                <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <h3 className="text-xl font-bold text-slate-900 tracking-tight">
              ${summary?.totalPayouts?.toLocaleString() || 0}
            </h3>
          </div>

          {/* No. of Payouts */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">
                No. of Payouts
              </span>
              <div className="p-2 bg-slate-50 rounded-lg">
                <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                </svg>
              </div>
            </div>
            <h3 className="text-xl font-bold text-slate-900 tracking-tight">
              {summary?.payoutCount?.toLocaleString() || 0}
            </h3>
          </div>

          {/* Largest Single Payout */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">
                Largest Single Payout
              </span>
              <div className="p-2 bg-slate-50 rounded-lg">
                <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                </svg>
              </div>
            </div>
            <h3 className="text-xl font-bold text-slate-900 tracking-tight">
              ${summary?.largestPayout?.toLocaleString() || 0}
            </h3>
          </div>

          {/* Time Since Last Payout */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">
                Time Since Last Payout
              </span>
              <div className="p-2 bg-slate-50 rounded-lg">
                <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <h3 className="text-xl font-bold text-slate-900 tracking-tight">
              {timeSince(summary?.latestPayoutAt)}
            </h3>
          </div>
        </div>

        {/* Chart */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-8">
          {/* Chart Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-900 rounded-lg">
                <span className="text-white font-bold text-xs">TP</span>
              </div>
              <h2 className="text-lg font-bold text-slate-900">Total Payouts</h2>
              <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded-md font-medium">UTC</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex bg-slate-100 rounded-lg p-1">
                {[
                  { label: 'Last 30 Days', value: '30d' },
                  { label: 'Last 12 Months', value: '12m' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setChartPeriod(option.value)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                      chartPeriod === option.value 
                        ? 'bg-white shadow-sm text-indigo-600' 
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Chart Loading */}
          {chartLoading && (
            <div className="flex items-center justify-center h-[350px]">
              <span className="loading loading-spinner loading-md"></span>
            </div>
          )}

          {/* Chart */}
          {!chartLoading && chart?.data && (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart
                data={chart.data}
                margin={{ top: 20, right: 20, left: 0, bottom: 5 }}
                barGap={0}
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey={chart.bucketType === 'daily' ? 'date' : 'month'}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  dy={10}
                  tickFormatter={(value) => {
                    if (chart.bucketType === 'daily') {
                      // Show abbreviated date for daily
                      const date = new Date(value);
                      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    }
                    return value; // Monthly already formatted
                  }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickFormatter={(value) => {
                    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
                    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
                    return `$${value}`;
                  }}
                />
                <Tooltip
                  formatter={(value) => `$${value.toLocaleString()}`}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.75rem',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                  cursor={{ fill: '#f1f5f9' }}
                />
                <Legend
                  verticalAlign="top"
                  align="center"
                  iconType="circle"
                  wrapperStyle={{ paddingBottom: '20px', fontSize: '12px', fontWeight: 500 }}
                />
                <Bar dataKey="rise" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} name="Rise" />
                <Bar dataKey="crypto" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} name="Crypto" />
                <Bar dataKey="wire" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} name="Wire" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top 10 & Latest Payouts - Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
          {/* Top 10 Largest Single Payouts */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3 bg-slate-50/30">
              <div className="p-2 bg-white rounded-lg shadow-sm">
                <svg className="w-5 h-5 text-yellow-500 fill-yellow-500" viewBox="0 0 24 24">
                  <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="font-bold text-slate-900 text-base">Top 10 Largest Payouts</h3>
            </div>

            <div className="divide-y divide-slate-100 flex-grow">
              {topPayoutsLoading ? (
                <div className="px-6 py-8 text-center">
                  <span className="loading loading-spinner loading-sm"></span>
                </div>
              ) : topPayouts.length > 0 ? (
                topPayouts.slice(0, 7).map((tx) => (
                  <a
                    key={tx.txHash}
                    href={tx.arbiscanUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors group cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-full ${
                        tx.paymentMethod === 'crypto' ? 'bg-amber-50 text-amber-500' : 'bg-blue-50 text-blue-500'
                      }`}>
                        {tx.paymentMethod === 'crypto' ? (
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 14.708c-.223 1.487-1.716 2.291-3.63 2.058l-.742 2.977-1.812-.451.73-2.924c-.476-.119-.965-.231-1.45-.343l-.735 2.945-1.81-.451.742-2.975c-.393-.09-.778-.18-1.152-.276l.002-.008-2.498-.623.482-1.979s1.342.354 1.314.334c.733.183.865-.425.945-.67l1.348-5.405c.057-.142.014-.406-.36-.501.02-.028-1.315-.328-1.315-.328l.256-2.143 2.643.659-.001.007c.384.096.775.184 1.17.271l.735-2.948 1.812.451-.719 2.882c.495.113.977.225 1.448.344l.714-2.864 1.812.452-.735 2.947c2.392.726 4.055 1.933 3.825 4.093-.185 1.737-1.23 2.513-2.704 2.551.934.543 1.486 1.403 1.202 2.801z"/>
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                          </svg>
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-900">
                          {new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">
                          {tx.paymentMethod}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-slate-900">
                        ${tx.amount.toLocaleString()}
                      </span>
                      <svg className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </a>
                ))
              ) : (
                <div className="px-6 py-8 text-center text-slate-500">No payouts found</div>
              )}
            </div>
          </div>

          {/* Latest Payouts Feed */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg shadow-sm">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="font-bold text-slate-900 text-base">Latest Payouts Feed</h3>
              </div>
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-lg font-medium">
                Last 24 Hours
              </span>
            </div>

            <div className="divide-y divide-slate-100 flex-grow">
              {latestPayoutsLoading ? (
                <div className="px-6 py-8 text-center">
                  <span className="loading loading-spinner loading-sm"></span>
                </div>
              ) : latestPayouts.length > 0 ? (
                latestPayouts.slice(0, 7).map((tx) => (
                  <a
                    key={tx.txHash}
                    href={tx.arbiscanUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors group cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-full ${
                        tx.paymentMethod === 'crypto' ? 'bg-amber-50 text-amber-500' : 'bg-blue-50 text-blue-500'
                      }`}>
                        {tx.paymentMethod === 'crypto' ? (
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 14.708c-.223 1.487-1.716 2.291-3.63 2.058l-.742 2.977-1.812-.451.73-2.924c-.476-.119-.965-.231-1.45-.343l-.735 2.945-1.81-.451.742-2.975c-.393-.09-.778-.18-1.152-.276l.002-.008-2.498-.623.482-1.979s1.342.354 1.314.334c.733.183.865-.425.945-.67l1.348-5.405c.057-.142.014-.406-.36-.501.02-.028-1.315-.328-1.315-.328l.256-2.143 2.643.659-.001.007c.384.096.775.184 1.17.271l.735-2.948 1.812.451-.719 2.882c.495.113.977.225 1.448.344l.714-2.864 1.812.452-.735 2.947c2.392.726 4.055 1.933 3.825 4.093-.185 1.737-1.23 2.513-2.704 2.551.934.543 1.486 1.403 1.202 2.801z"/>
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                          </svg>
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-900">
                          {timeSince(tx.timestamp)}
                        </span>
                        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">
                          {tx.paymentMethod}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-slate-900">
                        ${tx.amount.toLocaleString()}
                      </span>
                      <svg className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </a>
                ))
              ) : (
                <div className="px-6 py-8 text-center text-slate-500">No recent payouts in last 24 hours</div>
              )}
            </div>

            {latestPayouts.length > 0 && (
              <div className="px-6 py-4 bg-slate-50/30 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Showing {Math.min(7, latestPayouts.length)} of {latestPayouts.length}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </PropProofLayout>
  );
}
